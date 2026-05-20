"""AI video enhancement: fast FFmpeg pipeline + optional Real-ESRGAN."""

from __future__ import annotations

import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

TARGET_RESOLUTIONS = {
    "2k": (2560, 1440),
    "4k": (3840, 2160),
}

MAX_RETRIES = 2
JOB_TTL_SECONDS = 3600

_FFMPEG_SEARCH_DIRS = (
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
)


class JobStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class VideoJob:
    id: str
    status: JobStatus = JobStatus.QUEUED
    progress: float = 0.0
    message: str = "Queued"
    error: str | None = None
    resolution: str = "2k"
    original_filename: str = "video.mp4"
    output_path: Path | None = None
    created_at: float = field(default_factory=time.time)
    retries: int = 0


def _even(n: int) -> int:
    return n if n % 2 == 0 else n + 1


def _resolve_executable(name: str, env_key: str) -> str | None:
    env_val = os.getenv(env_key, "").strip()
    if env_val:
        path = Path(env_val).expanduser()
        if path.is_file() and os.access(path, os.X_OK):
            return str(path.resolve())

    found = shutil.which(name)
    if found:
        return found

    for directory in _FFMPEG_SEARCH_DIRS:
        candidate = Path(directory) / name
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate.resolve())

    return None


def compute_target_size(src_w: int, src_h: int, resolution: str) -> tuple[int, int]:
    max_w, max_h = TARGET_RESOLUTIONS.get(resolution.lower(), TARGET_RESOLUTIONS["2k"])
    scale = min(max_w / src_w, max_h / src_h)
    if scale < 1.0:
        scale = 1.0
    tw = _even(max(2, int(round(src_w * scale))))
    th = _even(max(2, int(round(src_h * scale))))
    return min(tw, max_w), min(th, max_h)


def _build_video_filter(target_w: int, target_h: int) -> str:
    """Single-pass upscale + denoise + mild sharpen (GPU-friendly, very fast)."""
    return (
        f"scale={target_w}:{target_h}:flags=lanczos,"
        "format=yuv420p,"
        "hqdn3d=2:1:3:2,"
        "unsharp=5:5:0.5:5:5:0.0"
    )


class VideoEnhanceService:
    """Video enhancement — fast FFmpeg by default; optional Real-ESRGAN AI mode."""

    def __init__(self) -> None:
        self._jobs: dict[str, VideoJob] = {}
        self._lock = threading.Lock()
        self._upsampler: Any | None = None
        self._upsampler_lock = threading.Lock()
        self._ffmpeg_bin = _resolve_executable("ffmpeg", "FFMPEG_PATH")
        self._ffprobe_bin = _resolve_executable("ffprobe", "FFPROBE_PATH")
        if self._ffmpeg_bin:
            logger.info("FFmpeg: %s", self._ffmpeg_bin)
        else:
            logger.warning(
                "FFmpeg not found. Set FFMPEG_PATH or install: brew install ffmpeg"
            )

        self.max_upload_mb = int(os.getenv("VIDEO_MAX_MB", "500"))
        self.max_duration_sec = int(os.getenv("VIDEO_MAX_DURATION_SEC", "600"))
        self._model_name = os.getenv("REALESRGAN_MODEL", "RealESRGAN_x4plus")
        self._device = os.getenv("VIDEO_DEVICE", "auto")
        self._temp_root = Path(
            os.getenv("VIDEO_TEMP_DIR", tempfile.gettempdir())
        ) / "clearmark_video"
        self._temp_root.mkdir(parents=True, exist_ok=True)

        # fast = single FFmpeg pass (default, ~10–50× faster)
        # ai = per-frame Real-ESRGAN (slow; needs GPU + pip install realesrgan)
        mode = os.getenv("VIDEO_ENHANCE_MODE", "fast").strip().lower()
        if mode == "ai" and not self._ai_usable():
            logger.warning("VIDEO_ENHANCE_MODE=ai but Real-ESRGAN/GPU unavailable — using fast")
            mode = "fast"
        self._enhance_mode = mode

        self._frame_workers = max(
            1, int(os.getenv("VIDEO_FRAME_WORKERS", str(min(8, os.cpu_count() or 4))))
        )
        self._x264_preset = os.getenv("VIDEO_X264_PRESET", "medium")
        self._crf = os.getenv("VIDEO_CRF", "19")

        self._cleanup_thread = threading.Thread(
            target=self._periodic_cleanup, daemon=True
        )
        self._cleanup_thread.start()
        logger.info("Video enhance mode: %s", self._enhance_mode)

    def _ai_usable(self) -> bool:
        if not self.realesrgan_available:
            return False
        prefer_gpu = os.getenv("VIDEO_AI_REQUIRE_GPU", "true").lower() in (
            "1",
            "true",
            "yes",
        )
        if prefer_gpu and not self.gpu_available:
            return False
        return True

    @property
    def ffmpeg_available(self) -> bool:
        return self._ffmpeg_bin is not None

    @property
    def ffprobe_available(self) -> bool:
        return self._ffprobe_bin is not None

    @property
    def realesrgan_available(self) -> bool:
        try:
            import realesrgan  # noqa: F401

            return True
        except ImportError:
            return False

    @property
    def gpu_available(self) -> bool:
        try:
            import torch

            return torch.cuda.is_available() or (
                hasattr(torch.backends, "mps")
                and torch.backends.mps.is_available()
            )
        except ImportError:
            return False

    @property
    def device_label(self) -> str:
        if self._device != "auto":
            return self._device
        if self.gpu_available:
            try:
                import torch

                if torch.cuda.is_available():
                    return "cuda"
                if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                    return "mps"
            except ImportError:
                pass
        return "cpu"

    def health(self) -> dict[str, Any]:
        ready = self.ffmpeg_available and self.ffprobe_available
        return {
            "status": "ok" if ready else "degraded",
            "ffmpeg": self.ffmpeg_available,
            "ffprobe": self.ffprobe_available,
            "ffmpeg_path": self._ffmpeg_bin,
            "ffprobe_path": self._ffprobe_bin,
            "enhance_mode": self._enhance_mode,
            "realesrgan": self.realesrgan_available,
            "gpu": self.gpu_available,
            "device": self.device_label,
            "max_upload_mb": self.max_upload_mb,
        }

    def get_job(self, job_id: str) -> VideoJob | None:
        with self._lock:
            return self._jobs.get(job_id)

    def create_job(
        self,
        video_bytes: bytes,
        filename: str,
        resolution: str,
    ) -> VideoJob:
        if not self.ffmpeg_available or not self.ffprobe_available:
            raise RuntimeError(
                "FFmpeg is required. Install FFmpeg and ensure it is on PATH."
            )

        resolution = resolution.lower()
        if resolution not in TARGET_RESOLUTIONS:
            raise ValueError("Resolution must be '2k' or '4k'.")

        size_mb = len(video_bytes) / (1024 * 1024)
        if size_mb > self.max_upload_mb:
            raise ValueError(
                f"Video exceeds maximum size ({self.max_upload_mb} MB)."
            )

        job_id = str(uuid.uuid4())
        job = VideoJob(
            id=job_id,
            resolution=resolution,
            original_filename=filename or "video.mp4",
        )
        work_dir = self._temp_root / job_id
        work_dir.mkdir(parents=True, exist_ok=True)
        ext = Path(filename).suffix.lower() or ".mp4"
        if ext not in {".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"}:
            ext = ".mp4"
        input_path = (work_dir / "input").with_suffix(ext)
        input_path.write_bytes(video_bytes)

        with self._lock:
            self._jobs[job_id] = job

        thread = threading.Thread(
            target=self._run_job,
            args=(job_id, input_path),
            daemon=True,
        )
        thread.start()
        return job

    def read_output(self, job_id: str) -> bytes | None:
        job = self.get_job(job_id)
        if not job or job.status != JobStatus.COMPLETED or not job.output_path:
            return None
        if not job.output_path.exists():
            return None
        return job.output_path.read_bytes()

    def _update_job(
        self,
        job_id: str,
        *,
        progress: float | None = None,
        message: str | None = None,
        status: JobStatus | None = None,
        error: str | None = None,
        output_path: Path | None = None,
    ) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            if progress is not None:
                job.progress = min(100.0, max(0.0, progress))
            if message is not None:
                job.message = message
            if status is not None:
                job.status = status
            if error is not None:
                job.error = error
            if output_path is not None:
                job.output_path = output_path

    def _run_job(self, job_id: str, input_path: Path) -> None:
        work_dir = input_path.parent
        attempt = 0
        while attempt <= MAX_RETRIES:
            try:
                self._update_job(
                    job_id,
                    status=JobStatus.PROCESSING,
                    progress=2,
                    message="Analyzing video…",
                )
                if self._enhance_mode == "ai":
                    self._process_video_ai(job_id, input_path, work_dir)
                else:
                    self._process_video_fast(job_id, input_path, work_dir)
                return
            except Exception as exc:
                attempt += 1
                logger.exception("Video job %s failed (attempt %s)", job_id, attempt)
                with self._lock:
                    job = self._jobs.get(job_id)
                    if job:
                        job.retries = attempt
                if attempt > MAX_RETRIES:
                    self._update_job(
                        job_id,
                        status=JobStatus.FAILED,
                        progress=0,
                        message="Enhancement failed",
                        error=str(exc),
                    )
                else:
                    self._update_job(
                        job_id,
                        progress=5,
                        message=f"Retrying ({attempt}/{MAX_RETRIES})…",
                    )
                    time.sleep(1)

    def _process_video_fast(
        self, job_id: str, input_path: Path, work_dir: Path
    ) -> None:
        """Single-pass FFmpeg — no frame extraction; typically seconds for short clips."""
        meta = self._probe(input_path)
        duration = float(meta.get("duration", 0))
        if duration > self.max_duration_sec:
            raise ValueError(
                f"Video exceeds maximum duration ({self.max_duration_sec}s)."
            )

        job = self.get_job(job_id)
        resolution = job.resolution if job else "2k"
        target_w, target_h = compute_target_size(
            int(meta["width"]), int(meta["height"]), resolution
        )
        output_path = work_dir / "enhanced_output.mp4"
        progress_file = work_dir / "ffmpeg_progress.txt"
        vf = _build_video_filter(target_w, target_h)
        level = "5.1" if target_h > 1440 else "4.2"

        hw = os.getenv("VIDEO_HW_ENCODER", "").strip().lower()
        video_codec_args: list[str]
        if hw in ("videotoolbox", "vt", "mac") and shutil.which("ffmpeg"):
            video_codec_args = [
                "-c:v",
                "h264_videotoolbox",
                "-b:v",
                "12M",
                "-profile:v",
                "high",
                "-level",
                level,
            ]
        else:
            video_codec_args = [
                "-c:v",
                "libx264",
                "-preset",
                self._x264_preset,
                "-crf",
                self._crf,
                "-pix_fmt",
                "yuv420p",
                "-profile:v",
                "high",
                "-level",
                level,
            ]

        cmd = [
            self._ffmpeg_bin,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-progress",
            str(progress_file),
            "-nostats",
            "-i",
            str(input_path),
            "-vf",
            vf,
            *video_codec_args,
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ar",
            "48000",
            "-movflags",
            "+faststart",
            str(output_path),
        ]

        self._update_job(
            job_id,
            progress=15,
            message="Enhancing video (fast pipeline)…",
        )

        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
        )

        stop_poll = threading.Event()

        def poll_progress() -> None:
            while not stop_poll.is_set() and proc.poll() is None:
                if progress_file.exists():
                    try:
                        text = progress_file.read_text()
                        match = re.search(r"out_time_ms=(\d+)", text)
                        if match and duration > 0:
                            ms = int(match.group(1))
                            pct = 15 + min(75, (ms / 1_000_000 / duration) * 75)
                            self._update_job(
                                job_id,
                                progress=pct,
                                message="Enhancing video…",
                            )
                    except OSError:
                        pass
                time.sleep(0.4)

        poller = threading.Thread(target=poll_progress, daemon=True)
        poller.start()

        try:
            _, stderr = proc.communicate(timeout=max(7200, int(duration * 30) + 120))
            stop_poll.set()
            poller.join(timeout=2)
            if proc.returncode != 0:
                raise RuntimeError(stderr or f"FFmpeg exited with {proc.returncode}")
        finally:
            stop_poll.set()
            progress_file.unlink(missing_ok=True)

        self._update_job(
            job_id,
            status=JobStatus.COMPLETED,
            progress=100,
            message="Enhancement complete",
            output_path=output_path,
        )

    def _process_video_ai(
        self, job_id: str, input_path: Path, work_dir: Path
    ) -> None:
        """Per-frame Real-ESRGAN — slow; parallel workers + JPEG I/O."""
        meta = self._probe(input_path)
        duration = float(meta.get("duration", 0))
        if duration > self.max_duration_sec:
            raise ValueError(
                f"Video exceeds maximum duration ({self.max_duration_sec}s)."
            )

        src_w = int(meta["width"])
        src_h = int(meta["height"])
        fps = meta["fps"]
        has_audio = meta.get("has_audio", False)
        job = self.get_job(job_id)
        resolution = job.resolution if job else "2k"
        target_w, target_h = compute_target_size(src_w, src_h, resolution)

        audio_path = work_dir / "audio.m4a"
        if has_audio:
            self._update_job(job_id, progress=8, message="Extracting audio…")
            self._extract_audio(input_path, audio_path)

        frames_dir = work_dir / "frames"
        enhanced_dir = work_dir / "enhanced"
        frames_dir.mkdir(exist_ok=True)
        enhanced_dir.mkdir(exist_ok=True)

        self._update_job(job_id, progress=12, message="Extracting frames…")
        frame_count = self._extract_frames_jpeg(input_path, frames_dir, fps)
        if frame_count == 0:
            raise RuntimeError("No frames extracted from video.")

        self._update_job(job_id, progress=20, message="AI upscaling frames…")
        self._enhance_frames_parallel(
            job_id, frames_dir, enhanced_dir, target_w, target_h, frame_count
        )

        self._update_job(job_id, progress=88, message="Encoding video…")
        silent_video = work_dir / "video_silent.mp4"
        self._assemble_video_jpeg(enhanced_dir, silent_video, fps, target_w, target_h)

        output_path = work_dir / "enhanced_output.mp4"
        if has_audio and audio_path.exists():
            self._update_job(job_id, progress=95, message="Syncing audio…")
            self._mux_audio(silent_video, audio_path, output_path)
        else:
            shutil.copy(silent_video, output_path)

        self._update_job(
            job_id,
            status=JobStatus.COMPLETED,
            progress=100,
            message="Enhancement complete",
            output_path=output_path,
        )

    def _probe(self, path: Path) -> dict[str, Any]:
        cmd = [
            self._ffprobe_bin,
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(path),
        ]
        result = subprocess.run(
            cmd, capture_output=True, text=True, check=True, timeout=120
        )
        data = json.loads(result.stdout)
        video_stream = next(
            (s for s in data.get("streams", []) if s.get("codec_type") == "video"),
            None,
        )
        if not video_stream:
            raise RuntimeError("No video stream found.")

        fps_raw = video_stream.get("r_frame_rate", "30/1")
        num, den = fps_raw.split("/")
        fps = float(num) / float(den) if float(den) else 30.0

        audio_streams = [
            s for s in data.get("streams", []) if s.get("codec_type") == "audio"
        ]
        duration = float(
            data.get("format", {}).get("duration")
            or video_stream.get("duration")
            or 0
        )

        return {
            "width": int(video_stream["width"]),
            "height": int(video_stream["height"]),
            "fps": round(fps, 3),
            "duration": duration,
            "has_audio": len(audio_streams) > 0,
        }

    def _extract_audio(self, input_path: Path, audio_path: Path) -> None:
        cmd = [
            self._ffmpeg_bin,
            "-y",
            "-i",
            str(input_path),
            "-vn",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ar",
            "48000",
            "-ac",
            "2",
            str(audio_path),
        ]
        subprocess.run(cmd, capture_output=True, check=True, timeout=600)

    def _extract_frames_jpeg(
        self, input_path: Path, frames_dir: Path, fps: float
    ) -> int:
        pattern = str(frames_dir / "frame_%06d.jpg")
        cmd = [
            self._ffmpeg_bin,
            "-y",
            "-i",
            str(input_path),
            "-q:v",
            "2",
            "-vf",
            f"fps={fps}",
            pattern,
        ]
        subprocess.run(cmd, capture_output=True, check=True, timeout=3600)
        return len(list(frames_dir.glob("frame_*.jpg")))

    def _get_upsampler(self) -> Any:
        with self._upsampler_lock:
            if self._upsampler is not None:
                return self._upsampler
            if not self.realesrgan_available:
                return None

            from basicsr.archs.rrdbnet_arch import RRDBNet
            from realesrgan import RealESRGANer
            from realesrgan.archs.srvgg_arch import SRVGGNetCompact

            device = self.device_label
            use_half = device == "cuda"
            model_name = self._model_name
            model_path = os.getenv("REALESRGAN_MODEL_PATH")

            if model_name == "realesr-general-x4v3":
                model = SRVGGNetCompact(
                    num_in_ch=3,
                    num_out_ch=3,
                    num_feat=64,
                    num_conv=32,
                    upscale=4,
                    act_type="prelu",
                )
                netscale = 4
                file_url = (
                    "https://github.com/xinntao/Real-ESRGAN/releases/download/"
                    "v0.2.5.0/realesr-general-x4v3.pth"
                )
            else:
                model = RRDBNet(
                    num_in_ch=3,
                    num_out_ch=3,
                    num_feat=64,
                    num_block=23,
                    num_grow_ch=32,
                    scale=4,
                )
                netscale = 4
                file_url = (
                    "https://github.com/xinntao/Real-ESRGAN/releases/download/"
                    "v0.1.0/RealESRGAN_x4plus.pth"
                )

            if not model_path:
                weights_dir = Path(__file__).parent / "weights"
                weights_dir.mkdir(exist_ok=True)
                model_path = str(weights_dir / f"{model_name}.pth")
                if not Path(model_path).exists():
                    import urllib.request

                    logger.info("Downloading Real-ESRGAN weights…")
                    urllib.request.urlretrieve(file_url, model_path)

            self._upsampler = RealESRGANer(
                scale=netscale,
                model_path=model_path,
                model=model,
                tile=int(os.getenv("REALESRGAN_TILE", "400")),
                tile_pad=10,
                pre_pad=0,
                half=use_half,
                device=device,
            )
            return self._upsampler

    def _enhance_single_frame(
        self,
        frame_path: Path,
        out_path: Path,
        target_w: int,
        target_h: int,
        upsampler: Any | None,
    ) -> None:
        import cv2

        img = cv2.imread(str(frame_path))
        if img is None:
            raise RuntimeError(f"Could not read frame {frame_path}")

        if upsampler is not None:
            scale_needed = max(target_w / img.shape[1], target_h / img.shape[0])
            outscale = min(4, max(1, int(np.ceil(scale_needed))))
            try:
                output, _ = upsampler.enhance(img, outscale=outscale)
                img = output
            except Exception:
                logger.warning("Real-ESRGAN failed on frame; using Lanczos")

        h, w = img.shape[:2]
        if (w, h) != (target_w, target_h):
            img = cv2.resize(
                img, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4
            )

        cv2.imwrite(str(out_path), img, [cv2.IMWRITE_JPEG_QUALITY, 92])

    def _enhance_frames_parallel(
        self,
        job_id: str,
        frames_dir: Path,
        enhanced_dir: Path,
        target_w: int,
        target_h: int,
        frame_count: int,
    ) -> None:
        frames = sorted(frames_dir.glob("frame_*.jpg"))
        upsampler = self._get_upsampler()
        done = 0
        lock = threading.Lock()

        def work(frame_path: Path) -> None:
            out_path = enhanced_dir / frame_path.name
            self._enhance_single_frame(
                frame_path, out_path, target_w, target_h, upsampler
            )

        with ThreadPoolExecutor(max_workers=self._frame_workers) as pool:
            futures = {pool.submit(work, f): f for f in frames}
            for fut in as_completed(futures):
                fut.result()
                with lock:
                    done += 1
                    if done % max(1, frame_count // 25) == 0 or done == frame_count:
                        pct = 20 + (done / frame_count) * 65
                        self._update_job(
                            job_id,
                            progress=pct,
                            message=f"AI frame {done}/{frame_count}…",
                        )

    def _assemble_video_jpeg(
        self,
        frames_dir: Path,
        output_path: Path,
        fps: float,
        width: int,
        height: int,
    ) -> None:
        pattern = str(frames_dir / "frame_%06d.jpg")
        level = "5.1" if height > 1440 else "4.2"
        cmd = [
            self._ffmpeg_bin,
            "-y",
            "-framerate",
            str(fps),
            "-i",
            pattern,
            "-c:v",
            "libx264",
            "-preset",
            self._x264_preset,
            "-crf",
            self._crf,
            "-pix_fmt",
            "yuv420p",
            "-profile:v",
            "high",
            "-level",
            level,
            "-movflags",
            "+faststart",
            str(output_path),
        ]
        subprocess.run(cmd, capture_output=True, check=True, timeout=7200)

    def _mux_audio(
        self,
        video_path: Path,
        audio_path: Path,
        output_path: Path,
    ) -> None:
        cmd = [
            self._ffmpeg_bin,
            "-y",
            "-i",
            str(video_path),
            "-i",
            str(audio_path),
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ar",
            "48000",
            "-shortest",
            "-movflags",
            "+faststart",
            str(output_path),
        ]
        subprocess.run(cmd, capture_output=True, check=True, timeout=600)

    def _periodic_cleanup(self) -> None:
        while True:
            time.sleep(300)
            now = time.time()
            with self._lock:
                expired = [
                    jid
                    for jid, job in self._jobs.items()
                    if now - job.created_at > JOB_TTL_SECONDS
                ]
            for jid in expired:
                work_dir = self._temp_root / jid
                if work_dir.exists():
                    shutil.rmtree(work_dir, ignore_errors=True)
                with self._lock:
                    self._jobs.pop(jid, None)
