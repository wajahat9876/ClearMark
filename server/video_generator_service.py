"""AI Video Generator — image-to-video with cinematic motion + optional SVD."""

from __future__ import annotations

import json
import logging
import math
import os
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

import cv2
import numpy as np
from PIL import Image, ImageOps

from video_gen_ai import (
    ai_animation_configured,
    effective_engine_label,
    generate_ai_clip,
    gpu_available,
    hf_available,
    parallax_available,
    resolve_backends,
    svd_available,
)

logger = logging.getLogger(__name__)

JOB_TTL_SECONDS = 3600
_FFMPEG_SEARCH_DIRS = ("/opt/homebrew/bin", "/usr/local/bin", "/usr/bin")

ASPECT_RATIOS: dict[str, tuple[int, int]] = {
    "16:9": (16, 9),
    "9:16": (9, 16),
    "1:1": (1, 1),
}

QUALITY_HEIGHTS: dict[str, int] = {
    "720p": 720,
    "1080p": 1080,
    "2k": 1440,
    "4k": 2160,
}

VIDEO_STYLES: dict[str, dict[str, Any]] = {
    "cinematic": {
        "label": "Cinematic",
        "motion_scale": 0.85,
        "ffmpeg_grade": "eq=contrast=1.08:brightness=0.02:saturation=1.05",
        "transition": "fade",
    },
    "cartoon": {
        "label": "Cartoon",
        "motion_scale": 1.1,
        "ffmpeg_grade": "eq=saturation=1.45:contrast=1.12,unsharp=5:5:1.2:5:5:0",
        "transition": "slideleft",
    },
    "pixar": {
        "label": "Pixar-style",
        "motion_scale": 1.05,
        "ffmpeg_grade": "eq=saturation=1.25:brightness=0.04:gamma=1.05,unsharp=3:3:0.4",
        "transition": "fade",
    },
    "anime": {
        "label": "Anime",
        "motion_scale": 1.15,
        "ffmpeg_grade": "eq=contrast=1.2:saturation=1.35,unsharp=7:7:1.5:7:7:0",
        "transition": "wiperight",
    },
    "realistic": {
        "label": "Realistic",
        "motion_scale": 0.75,
        "ffmpeg_grade": "eq=contrast=1.03:saturation=1.02",
        "transition": "fade",
    },
    "fantasy": {
        "label": "Fantasy",
        "motion_scale": 1.0,
        "ffmpeg_grade": (
            "eq=saturation=1.2:brightness=0.03,"
            "colorbalance=rs=0.05:gs=-0.02:bs=0.12"
        ),
        "transition": "circleopen",
    },
    "kids": {
        "label": "Kids Story",
        "motion_scale": 1.2,
        "ffmpeg_grade": "eq=saturation=1.5:brightness=0.06:contrast=1.05",
        "transition": "zoomin",
    },
    "action": {
        "label": "Action Scene",
        "motion_scale": 1.35,
        "ffmpeg_grade": "eq=contrast=1.15:saturation=1.1,unsharp=5:5:0.8",
        "transition": "slideup",
    },
}


class JobStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class VideoGenJob:
    id: str
    status: JobStatus = JobStatus.QUEUED
    progress: float = 0.0
    message: str = "Queued"
    error: str | None = None
    output_path: Path | None = None
    settings: dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)


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


def _parse_settings(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        return {}


def _ease_in_out(t: float) -> float:
    return t * t * (3.0 - 2.0 * t)


def _target_dimensions(aspect: str, quality: str) -> tuple[int, int]:
    ar = ASPECT_RATIOS.get(aspect, ASPECT_RATIOS["16:9"])
    height = QUALITY_HEIGHTS.get(quality, 1080)
    width = _even(int(round(height * ar[0] / ar[1])))
    height = _even(height)
    return width, height


def _motion_from_prompt(prompt: str, style_id: str) -> dict[str, Any]:
    p = (prompt or "").lower()
    style = VIDEO_STYLES.get(style_id, VIDEO_STYLES["cinematic"])
    scale = float(style.get("motion_scale", 1.0))

    motion = "zoom_in"
    if any(w in p for w in ("pan left", "move left", "slide left")):
        motion = "pan_left"
    elif any(w in p for w in ("pan right", "move right", "slide right")):
        motion = "pan_right"
    elif any(w in p for w in ("zoom out", "pull back", "reveal")):
        motion = "zoom_out"
    elif any(w in p for w in ("orbit", "rotate", "spin")):
        motion = "orbit"
    elif any(w in p for w in ("shake", "action", "impact", "explosion")):
        motion = "shake"
    elif any(w in p for w in ("drift", "float", "dream")):
        motion = "drift"

    intensity = 0.12 * scale
    if any(w in p for w in ("subtle", "slow", "gentle", "calm")):
        intensity *= 0.65
    if any(w in p for w in ("fast", "dynamic", "energetic", "action")):
        intensity *= 1.45
    if any(w in p for w in ("dramatic", "cinematic", "epic")):
        intensity *= 1.15

    breathe = any(
        w in p
        for w in (
            "blink",
            "expression",
            "emotion",
            "smile",
            "react",
            "breath",
            "alive",
        )
    )
    return {
        "type": motion,
        "intensity": min(0.28, max(0.06, intensity)),
        "breathe": breathe,
        "shake": motion == "shake" or "shake" in p,
    }


def _letterbox_image(img: np.ndarray, target_w: int, target_h: int) -> np.ndarray:
    h, w = img.shape[:2]
    scale = max(target_w / w, target_h / h)
    nw, nh = int(w * scale), int(h * scale)
    resized = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_LANCZOS4)
    x0 = (nw - target_w) // 2
    y0 = (nh - target_h) // 2
    return resized[y0 : y0 + target_h, x0 : x0 + target_w]


def _transform_frame(
    base: np.ndarray,
    t: float,
    spec: dict[str, Any],
    index: int,
) -> np.ndarray:
    h, w = base.shape[:2]
    eased = _ease_in_out(t)
    intensity = float(spec.get("intensity", 0.12))
    motion = spec.get("type", "zoom_in")

    cx, cy = w / 2.0, h / 2.0
    scale = 1.0
    dx, dy = 0.0, 0.0
    angle = 0.0

    if motion == "zoom_in":
        scale = 1.0 + intensity * eased
    elif motion == "zoom_out":
        scale = 1.0 + intensity * (1.0 - eased)
    elif motion == "pan_left":
        scale = 1.0 + intensity * 0.5
        dx = -intensity * w * eased
    elif motion == "pan_right":
        scale = 1.0 + intensity * 0.5
        dx = intensity * w * eased
    elif motion == "orbit":
        angle = math.sin(eased * math.pi * 2) * 2.5
        scale = 1.0 + intensity * 0.35
    elif motion == "drift":
        dx = math.sin(eased * math.pi) * intensity * w * 0.4
        dy = math.cos(eased * math.pi * 0.5) * intensity * h * 0.25
        scale = 1.0 + intensity * 0.25
    elif motion == "shake":
        dx = math.sin(index * 0.7) * intensity * w * 0.15
        dy = math.cos(index * 0.5) * intensity * h * 0.1
        scale = 1.0 + intensity * 0.2

    if spec.get("breathe"):
        scale *= 1.0 + 0.012 * math.sin(index * 0.35)

    m = cv2.getRotationMatrix2D((cx, cy), angle, scale)
    m[0, 2] += dx
    m[1, 2] += dy
    return cv2.warpAffine(
        base,
        m,
        (w, h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REFLECT101,
    )


class VideoGeneratorService:
    def __init__(self) -> None:
        self._jobs: dict[str, VideoGenJob] = {}
        self._lock = threading.Lock()
        self._ffmpeg = _resolve_executable("ffmpeg", "FFMPEG_PATH")
        self._ffprobe = _resolve_executable("ffprobe", "FFPROBE_PATH")
        self.max_upload_mb = int(os.getenv("VIDEO_GEN_MAX_MB", "30"))
        self.max_images = int(os.getenv("VIDEO_GEN_MAX_IMAGES", "12"))
        self._temp_root = Path(tempfile.gettempdir()) / "clearmark_videogen"
        self._temp_root.mkdir(parents=True, exist_ok=True)
        self._ai_mode = os.getenv("VIDEO_GEN_AI", "auto").strip().lower()
        if self._ffmpeg:
            logger.info("Video Generator FFmpeg: %s", self._ffmpeg)
        threading.Thread(target=self._periodic_cleanup, daemon=True).start()

    @property
    def ffmpeg_available(self) -> bool:
        return self._ffmpeg is not None

    def health(self) -> dict[str, Any]:
        allow_motion = os.getenv(
            "VIDEO_GEN_ALLOW_MOTION_FALLBACK", "false"
        ).lower() in ("1", "true", "yes")
        return {
            "ffmpeg": self.ffmpeg_available,
            "ffprobe": self._ffprobe is not None,
            "opencv": True,
            "aiMode": effective_engine_label(),
            "aiConfigured": ai_animation_configured(),
            "hfAvailable": hf_available(),
            "svdAvailable": svd_available(),
            "backends": resolve_backends(),
            "gpu": gpu_available(),
            "motionFallback": allow_motion,
            "hfTokenSet": bool(
                os.getenv("HF_TOKEN", "").strip()
                or os.getenv("HUGGINGFACE_API_KEY", "").strip()
            ),
            "falKeySet": bool(os.getenv("FAL_KEY", "").strip()),
            "parallel": int(os.getenv("VIDEO_GEN_PARALLEL", "2")),
            "freeLocal": parallax_available(),
            "cloudEnabled": os.getenv("VIDEO_GEN_ALLOW_CLOUD", "").lower()
            in ("1", "true", "yes"),
            "styles": [
                {"id": k, "label": v["label"]} for k, v in VIDEO_STYLES.items()
            ],
            "aspectRatios": list(ASPECT_RATIOS.keys()),
            "qualities": list(QUALITY_HEIGHTS.keys()),
        }

    def presets_payload(self) -> dict[str, Any]:
        return self.health()

    def get_job(self, job_id: str) -> VideoGenJob | None:
        with self._lock:
            return self._jobs.get(job_id)

    def read_output(self, job_id: str) -> bytes | None:
        job = self.get_job(job_id)
        if not job or job.status != JobStatus.COMPLETED or not job.output_path:
            return None
        if not job.output_path.exists():
            return None
        return job.output_path.read_bytes()

    def create_job(
        self,
        image_files: list[tuple[bytes, str]],
        settings_json: str | None,
    ) -> VideoGenJob:
        if not self.ffmpeg_available:
            raise RuntimeError("FFmpeg is required for AI Video Generator.")

        if not image_files:
            raise ValueError("Upload at least one image.")

        if len(image_files) > self.max_images:
            raise ValueError(f"Maximum {self.max_images} images per video.")

        total_mb = sum(len(b) for b, _ in image_files) / (1024 * 1024)
        if total_mb > self.max_upload_mb:
            raise ValueError(f"Total upload exceeds {self.max_upload_mb} MB.")

        settings = _parse_settings(settings_json)
        style = str(settings.get("style", "cinematic"))
        if style not in VIDEO_STYLES:
            style = "cinematic"
        settings["style"] = style

        job_id = str(uuid.uuid4())
        job = VideoGenJob(id=job_id, settings=settings)
        work_dir = self._temp_root / job_id
        work_dir.mkdir(parents=True, exist_ok=True)

        for idx, (data, name) in enumerate(image_files):
            ext = Path(name).suffix.lower() or ".png"
            if ext not in {".jpg", ".jpeg", ".png", ".webp", ".bmp"}:
                ext = ".png"
            (work_dir / f"image_{idx:03d}").with_suffix(ext).write_bytes(data)

        with self._lock:
            self._jobs[job_id] = job

        threading.Thread(
            target=self._run_job,
            args=(job_id, work_dir),
            daemon=True,
        ).start()
        return job

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

    def _run_job(self, job_id: str, work_dir: Path) -> None:
        try:
            self._update_job(
                job_id,
                status=JobStatus.PROCESSING,
                progress=3,
                message="Preparing images…",
            )
            job = self.get_job(job_id)
            if not job:
                return
            settings = job.settings
            output_path = work_dir / "output.mp4"
            self._process(job_id, work_dir, settings, output_path)
            self._update_job(
                job_id,
                status=JobStatus.COMPLETED,
                progress=100,
                message="Video ready — no watermark",
                output_path=output_path,
            )
        except Exception as exc:
            logger.exception("Video gen job %s failed", job_id)
            self._update_job(
                job_id,
                status=JobStatus.FAILED,
                progress=0,
                message="Generation failed",
                error=str(exc),
            )

    def _process(
        self,
        job_id: str,
        work_dir: Path,
        settings: dict[str, Any],
        output_path: Path,
    ) -> None:
        image_paths = sorted(work_dir.glob("image_*"))
        if not image_paths:
            raise RuntimeError("No images found.")

        prompt = str(settings.get("prompt", "")).strip()
        style_id = str(settings.get("style", "cinematic"))
        aspect = str(settings.get("aspectRatio", "16:9"))
        quality = str(settings.get("quality", "1080p"))
        duration = float(settings.get("duration", 8))
        fps = int(settings.get("fps", 30))
        transition_sec = float(settings.get("transitionDuration", 0.5))

        duration = max(3.0, min(60.0, duration))
        fps = 24 if fps < 26 else (30 if fps < 45 else 60)
        transition_sec = max(0.2, min(1.5, transition_sec))

        width, height = _target_dimensions(aspect, quality)
        motion_spec = _motion_from_prompt(prompt, style_id)
        style_meta = VIDEO_STYLES[style_id]

        allow_motion = os.getenv(
            "VIDEO_GEN_ALLOW_MOTION_FALLBACK", "false"
        ).lower() in ("1", "true", "yes")
        backends = resolve_backends()
        if not backends and not allow_motion:
            raise RuntimeError(
                "No animation engine available. Install opencv-python-headless and FFmpeg, "
                "or set VIDEO_GEN_ALLOW_MOTION_FALLBACK=true."
            )

        per_image = max(1.5, duration / len(image_paths))
        parallel = int(os.getenv("VIDEO_GEN_PARALLEL", "2"))
        parallel = max(1, min(parallel, len(image_paths), 4))

        self._update_job(
            job_id,
            progress=12,
            message=f"AI animating {len(image_paths)} image(s)"
            + (f" ({parallel} parallel)…" if parallel > 1 else "…"),
        )

        clip_results = self._animate_images_parallel(
            job_id,
            image_paths,
            work_dir,
            width,
            height,
            per_image,
            fps,
            prompt,
            style_id,
            quality,
            motion_spec,
            allow_motion,
            parallel,
        )
        clips = [clip_results[i] for i in sorted(clip_results)]

        self._update_job(job_id, progress=82, message="Compositing & exporting…")
        merged = work_dir / "merged.mp4"
        if len(clips) == 1:
            source = clips[0]
        else:
            source = merged
            self._concat_with_transitions(
                clips,
                merged,
                transition_sec,
                str(style_meta.get("transition", "fade")),
                fps,
                fast=True,
            )

        grade = str(style_meta.get("ffmpeg_grade", ""))
        self._finalize_video(source, output_path, grade, fps, quality)

    def _ai_input_size(self, width: int, height: int, quality: str) -> tuple[int, int]:
        """Smaller input for cloud AI = faster upload/inference; export stays full quality."""
        cap = {"720p": 720, "1080p": 960, "2k": 1280, "4k": 1280}.get(quality, 960)
        if max(width, height) <= cap:
            return width, height
        scale = cap / max(width, height)
        return _even(int(width * scale)), _even(int(height * scale))

    def _prepare_image(
        self,
        src: Path,
        dest: Path,
        width: int,
        height: int,
        *,
        for_ai: bool = False,
        quality: str = "1080p",
    ) -> None:
        if for_ai:
            width, height = self._ai_input_size(width, height, quality)
        with Image.open(src) as im:
            im = ImageOps.exif_transpose(im)
            im = im.convert("RGB")
            im.thumbnail((width * 2, height * 2), Image.Resampling.LANCZOS)
            arr = np.array(im)[:, :, ::-1]
        canvas = _letterbox_image(arr, width, height)
        cv2.imwrite(str(dest), canvas)

    def _animate_images_parallel(
        self,
        job_id: str,
        image_paths: list[Path],
        work_dir: Path,
        width: int,
        height: int,
        per_image: float,
        fps: int,
        prompt: str,
        style_id: str,
        quality: str,
        motion_spec: dict[str, Any],
        allow_motion: bool,
        parallel: int,
    ) -> dict[int, Path]:
        total = len(image_paths)
        done_count = 0
        done_lock = threading.Lock()
        results: dict[int, Path] = {}

        def process_one(idx: int, img_path: Path) -> tuple[int, Path]:
            prepared = work_dir / f"prep_{idx:03d}.png"
            self._prepare_image(
                img_path, prepared, width, height, for_ai=True, quality=quality
            )

            clip_path = work_dir / f"clip_{idx:03d}.mp4"
            ai_raw = work_dir / f"ai_{idx:03d}.mp4"

            ok, _backend, ai_error = generate_ai_clip(
                prepared,
                ai_raw,
                prompt=prompt,
                style=style_id,
                fps=fps,
                quality=quality,
                duration_sec=per_image,
            )
            if ok:
                self._rescale_clip(
                    ai_raw, clip_path, width, height, per_image, fps, fast=True
                )
            elif allow_motion:
                full_prep = work_dir / f"prep_full_{idx:03d}.png"
                self._prepare_image(img_path, full_prep, width, height)
                self._render_motion_clip(
                    full_prep,
                    clip_path,
                    width,
                    height,
                    per_image,
                    fps,
                    motion_spec,
                    index_offset=idx * 17,
                )
            else:
                raise RuntimeError(
                    ai_error
                    or f"AI animation failed for image {idx + 1}."
                )
            return idx, clip_path

        if parallel <= 1:
            for idx, img_path in enumerate(image_paths):
                i, clip = process_one(idx, img_path)
                results[i] = clip
                pct = 12 + ((idx + 1) / total) * 68
                self._update_job(
                    job_id,
                    progress=pct,
                    message=f"Finished image {idx + 1}/{total}",
                )
            return results

        with ThreadPoolExecutor(max_workers=parallel) as pool:
            futures = {
                pool.submit(process_one, idx, img_path): idx
                for idx, img_path in enumerate(image_paths)
            }
            for future in as_completed(futures):
                idx, clip = future.result()
                results[idx] = clip
                with done_lock:
                    done_count += 1
                    pct = 12 + (done_count / total) * 68
                self._update_job(
                    job_id,
                    progress=pct,
                    message=f"Finished {done_count}/{total} animations",
                )
        return results

    def _render_motion_clip(
        self,
        image_path: Path,
        output_path: Path,
        width: int,
        height: int,
        duration: float,
        fps: int,
        motion_spec: dict[str, Any],
        index_offset: int = 0,
    ) -> None:
        base = cv2.imread(str(image_path))
        if base is None:
            raise RuntimeError(f"Could not read image: {image_path}")

        frames_dir = output_path.parent / f"frames_{output_path.stem}"
        frames_dir.mkdir(exist_ok=True)
        total_frames = max(2, int(duration * fps))

        for i in range(total_frames):
            t = i / max(total_frames - 1, 1)
            frame = _transform_frame(base, t, motion_spec, i + index_offset)
            cv2.imwrite(str(frames_dir / f"frame_{i:05d}.png"), frame)

        self._run_ffmpeg(
            [
                self._ffmpeg,
                "-y",
                "-framerate",
                str(fps),
                "-i",
                str(frames_dir / "frame_%05d.png"),
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-crf",
                "18",
                "-preset",
                "fast",
                str(output_path),
            ],
            "Motion clip encode failed",
        )
        shutil.rmtree(frames_dir, ignore_errors=True)

    def _rescale_clip(
        self,
        src: Path,
        dest: Path,
        width: int,
        height: int,
        duration: float,
        fps: int,
        *,
        fast: bool = False,
    ) -> None:
        preset = "veryfast" if fast else "fast"
        self._run_ffmpeg(
            [
                self._ffmpeg,
                "-y",
                "-i",
                str(src),
                "-vf",
                f"scale={width}:{height}:flags=lanczos:force_original_aspect_ratio=decrease,"
                f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,"
                f"fps={fps},trim=duration={duration},setpts=PTS-STARTPTS",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-crf",
                "19",
                "-preset",
                preset,
                str(dest),
            ],
            "Clip rescale failed",
        )

    def _concat_with_transitions(
        self,
        clips: list[Path],
        output: Path,
        transition: float,
        transition_name: str,
        fps: int,
        *,
        fast: bool = False,
    ) -> None:
        if len(clips) < 2:
            if clips:
                shutil.copy(clips[0], output)
            return

        durations = [self._probe_duration(c) for c in clips]
        inputs: list[str] = []
        for clip in clips:
            inputs.extend(["-i", str(clip)])

        valid_transitions = {
            "fade",
            "slideleft",
            "slideright",
            "slideup",
            "slidedown",
            "circleopen",
            "zoomin",
            "wiperight",
        }
        xfade = transition_name if transition_name in valid_transitions else "fade"

        parts: list[str] = []
        offset = max(0.0, durations[0] - transition)
        parts.append(
            f"[0:v][1:v]xfade=transition={xfade}:duration={transition}:offset={offset:.3f}[v01]"
        )
        current = "[v01]"
        for i in range(2, len(clips)):
            offset = max(0.0, offset + durations[i - 1] - transition)
            out_label = f"[v{i:02d}]"
            parts.append(
                f"{current}[{i}:v]xfade=transition={xfade}:duration={transition}:offset={offset:.3f}{out_label}"
            )
            current = out_label

        filter_complex = ";".join(parts)
        cmd = [
            self._ffmpeg,
            "-y",
            *inputs,
            "-filter_complex",
            filter_complex,
            "-map",
            current,
            "-r",
            str(fps),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-crf",
            "20" if fast else "18",
            "-preset",
            "veryfast" if fast else "fast",
            str(output),
        ]
        self._run_ffmpeg(cmd, "Transition concat failed")

    def _finalize_video(
        self,
        src: Path,
        dest: Path,
        grade: str,
        fps: int,
        quality: str,
    ) -> None:
        """Single high-quality encode: color grade + fps (no slow 30fps interpolation)."""
        vf_parts: list[str] = []
        if grade:
            vf_parts.append(grade)
        if fps >= 60:
            vf_parts.append("minterpolate=fps=60:mi_mode=blend")
        else:
            vf_parts.append(f"fps={fps}")

        crf = "18" if quality in ("1080p", "2k") else ("20" if quality == "720p" else "16")
        preset = os.getenv("VIDEO_X264_PRESET", "medium")
        hw = os.getenv("VIDEO_HW_ENCODER", "").strip()

        cmd = [self._ffmpeg, "-y", "-i", str(src)]
        if vf_parts:
            cmd.extend(["-vf", ",".join(vf_parts)])
        encoder = hw if hw else "libx264"
        cmd.extend(
            [
                "-c:v",
                encoder,
                "-pix_fmt",
                "yuv420p",
                "-crf",
                crf,
                "-preset",
                preset if not hw else "medium",
                "-movflags",
                "+faststart",
                "-an",
                str(dest),
            ]
        )
        self._run_ffmpeg(cmd, "Final export failed")

    def _probe_duration(self, path: Path) -> float:
        if not self._ffprobe:
            return 3.0
        cmd = [
            self._ffprobe,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        try:
            return float(result.stdout.strip())
        except ValueError:
            return 3.0

    def _run_ffmpeg(self, cmd: list[str], error_prefix: str) -> None:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "").strip()[-600:]
            logger.error("%s: %s", error_prefix, detail)
            raise RuntimeError(f"{error_prefix}: {detail}")

    def _periodic_cleanup(self) -> None:
        while True:
            time.sleep(300)
            now = time.time()
            with self._lock:
                expired = [
                    j
                    for j, job in self._jobs.items()
                    if now - job.created_at > JOB_TTL_SECONDS
                ]
            for jid in expired:
                work_dir = self._temp_root / jid
                if work_dir.exists():
                    shutil.rmtree(work_dir, ignore_errors=True)
                with self._lock:
                    self._jobs.pop(jid, None)
