"""AI Voice Studio — FFmpeg-based voice FX, cleanup, and export (no celebrity cloning)."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_FFMPEG_SEARCH_DIRS = ("/opt/homebrew/bin", "/usr/local/bin", "/usr/bin")
JOB_TTL_SECONDS = 3600
MAX_RETRIES = 1

# Stylized voices: pitch ratio + optional EQ/FX (no celebrity cloning)
_BASE_RATE = 48000

VOICE_PRESETS: dict[str, dict[str, Any]] = {
    "original": {"label": "Original", "pitch": 1.0, "fx": ""},
    # Kid profiles: formant EQ + pitch (natural child timbre, not chipmunk)
    "child_2yo": {
        "label": "2-Year-Old Child",
        "neural_voice": "en-GB-MaisieNeural",
        "neural_rate": "+3%",
        "neural_pitch": "+6Hz",
        "kid_profile": True,
        "pitch": 1.44,
        "highpass_hz": 300,
        "formant_eq": [
            "equalizer=f=2600:width_type=h:width=1400:g=6",
            "equalizer=f=3800:width_type=h:width=2000:g=5",
            "equalizer=f=5500:width_type=h:width=2200:g=3",
        ],
        "bass_cut": -9,
        "breathiness": False,
        "fx": "",
    },
    "baby_cute": {
        "label": "Baby Girl Voice",
        "neural_voice": "en-US-AnaNeural",
        "neural_rate": "+6%",
        "neural_pitch": "+10Hz",
        "kid_profile": True,
        "pitch": 1.58,
        "highpass_hz": 380,
        "formant_eq": [
            "equalizer=f=3000:width_type=h:width=1500:g=7",
            "equalizer=f=4400:width_type=h:width=2200:g=8",
            "equalizer=f=6800:width_type=h:width=2800:g=5",
        ],
        "bass_cut": -11,
        "breathiness": True,
        "fx": "",
    },
    "baby_girl": {
        "label": "Baby Girl (Soft)",
        "neural_voice": "en-US-AnaNeural",
        "neural_rate": "+2%",
        "neural_pitch": "+6Hz",
        "kid_profile": True,
        "pitch": 1.54,
        "highpass_hz": 360,
        "formant_eq": [
            "equalizer=f=2900:width_type=h:width=1400:g=6",
            "equalizer=f=4100:width_type=h:width=2000:g=7",
            "equalizer=f=6200:width_type=h:width=2600:g=4",
        ],
        "bass_cut": -10,
        "breathiness": True,
        "fx": "lowpass=f=11000",
    },
    "cartoon_kid": {
        "label": "Cartoon Kid",
        "kid_profile": True,
        "pitch": 1.36,
        "highpass_hz": 260,
        "formant_eq": [
            "equalizer=f=2400:width_type=h:width=1300:g=5",
            "equalizer=f=3600:width_type=h:width=1800:g=5",
        ],
        "bass_cut": -7,
        "breathiness": False,
        "fx": "",
    },
    "female": {
        "label": "Female Voice",
        "pitch": 1.10,
        "fx": "equalizer=f=3500:width_type=h:width=2000:g=2",
    },
    "female_neural": {
        "label": "Female (Natural)",
        "neural_voice": "en-US-JennyNeural",
        "neural_rate": "+0%",
        "neural_pitch": "+0Hz",
        "pitch": 1.0,
        "fx": "",
    },
    "female_soft": {
        "label": "Soft Female",
        "neural_voice": "en-US-AriaNeural",
        "neural_rate": "-2%",
        "neural_pitch": "+0Hz",
        "pitch": 1.0,
        "fx": "lowpass=f=12000",
    },
    "female_bright": {
        "label": "Bright Female",
        "neural_voice": "en-US-EmmaNeural",
        "neural_rate": "+4%",
        "neural_pitch": "+2Hz",
        "pitch": 1.0,
        "fx": "treble=g=2",
    },
    "male": {
        "label": "Male Voice",
        "pitch": 0.90,
        "fx": "equalizer=f=250:width_type=h:width=120:g=3",
    },
    "chipmunk": {
        "label": "Funny Chipmunk",
        "pitch": 1.42,
        "fx": "treble=g=3",
    },
    "deep_cinematic": {
        "label": "Deep Cinematic",
        "pitch": 0.82,
        "fx": "bass=g=4,equalizer=f=120:width_type=h:width=80:g=4",
    },
    "robot": {
        "label": "Robot Voice",
        "pitch": 1.0,
        "fx": "aphaser=type=t:speed=0.6:decay=0.4,vibrato=f=10:d=0.25,acompressor=threshold=-20dB:ratio=4",
    },
    "anime": {
        "label": "Anime Style",
        "pitch": 1.16,
        "fx": "treble=g=3,equalizer=f=4200:width_type=h:width=2200:g=2",
    },
}

# Emotion effects — applied one-by-one in separate passes (reliable on all FFmpeg builds)
EMOTION_EFFECTS: dict[str, dict[str, Any]] = {
    "laughing": {
        "label": "Laughing",
        "filters": "vibrato=f=8:d=0.55,acompressor=threshold=-14dB:ratio=2,treble=g=5",
    },
    "crying": {
        "label": "Crying",
        "filters": "tremolo=f=5:d=0.55,lowpass=f=2200,equalizer=f=350:width_type=h:width=200:g=4",
    },
    "giggling": {
        "label": "Giggling",
        "filters": "vibrato=f=12:d=0.6,treble=g=6,acompressor=threshold=-16dB:ratio=2",
    },
    "cheering": {
        "label": "Happy Cheering",
        "filters": "bass=g=5,treble=g=5,acompressor=threshold=-12dB:ratio=2",
    },
    "angry": {
        "label": "Angry Tone",
        "filters": "bass=g=7,equalizer=f=180:width_type=h:width=90:g=7,acompressor=threshold=-14dB:ratio=5",
    },
    "scared": {
        "label": "Scared Reaction",
        "filters": "vibrato=f=14:d=0.65,tremolo=f=9:d=0.45,treble=g=4",
    },
    "whisper": {
        "label": "Whisper Mode",
        "filters": "highpass=f=400,lowpass=f=4800,volume=0.5,acompressor=threshold=-22dB:ratio=2",
    },
    "echo": {
        "label": "Echo",
        "filters": "aecho=0.85:0.9:1000:0.5",
    },
    "reverb": {
        "label": "Reverb",
        "filters": "aecho=0.75:0.55:500:0.35,aecho=0.55:0.4:1400:0.28",
    },
    "stadium": {
        "label": "Stadium Voice",
        "filters": "aecho=0.92:0.88:150:0.55,aecho=0.7:0.6:320:0.38,bass=g=4",
    },
    "party": {
        "label": "Party Effect",
        "filters": (
            "chorus=delays=40|50|60:decays=0.35|0.4|0.45:"
            "depths=0.3|0.35|0.4:speeds=0.25|0.3|0.28,treble=g=4,bass=g=3"
        ),
    },
}

# Singing-style FX applied when songMode is enabled (royalty-free procedural backing)
SONG_STYLES: dict[str, dict[str, Any]] = {
    "pop": {
        "label": "Pop",
        "vocal_filters": (
            "vibrato=f=5.5:d=0.38,"
            "chorus=0.5:0.9:50|60:0.4|0.45:0.25|0.3:0.35|0.4,"
            "acompressor=threshold=-16dB:ratio=3,treble=g=2"
        ),
        "backing_chords": [261.63, 329.63, 392.0, 523.25],
        "backing_volume": 0.32,
    },
    "lullaby": {
        "label": "Lullaby",
        "vocal_filters": (
            "vibrato=f=3.2:d=0.28,"
            "tremolo=f=1.8:d=0.12,"
            "lowpass=f=9000,"
            "aecho=0.55:0.45:700:0.28"
        ),
        "backing_chords": [196.0, 246.94, 293.66, 329.63],
        "backing_volume": 0.28,
    },
    "acoustic": {
        "label": "Acoustic",
        "vocal_filters": (
            "vibrato=f=4.2:d=0.32,"
            "acompressor=threshold=-18dB:ratio=2.5,"
            "aecho=0.45:0.35:420:0.22"
        ),
        "backing_chords": [220.0, 277.18, 329.63, 440.0],
        "backing_volume": 0.30,
    },
}


def _split_filter_chain(filters: str) -> list[str]:
    """Split an FFmpeg -af chain on top-level commas (one filter per pass)."""
    if not filters.strip():
        return []
    parts: list[str] = []
    current: list[str] = []
    depth = 0
    for ch in filters:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        elif ch == "," and depth == 0:
            segment = "".join(current).strip()
            if segment:
                parts.append(segment)
            current = []
            continue
        current.append(ch)
    segment = "".join(current).strip()
    if segment:
        parts.append(segment)
    return parts


def _normalize_effect_ids(effect_ids: Any) -> list[str]:
    if isinstance(effect_ids, str):
        effect_ids = [effect_ids]
    if not isinstance(effect_ids, list):
        return []
    valid: list[str] = []
    for raw in effect_ids:
        if not isinstance(raw, str):
            continue
        key = raw.strip().lower()
        if key in EMOTION_EFFECTS and key not in valid:
            valid.append(key)
    return valid


def _pitch_shift_filter(pitch_ratio: float) -> str:
    """Shift pitch while keeping duration (single asetrate + atempo pair)."""
    if abs(pitch_ratio - 1.0) < 0.02:
        return ""
    ratio = max(0.5, min(2.0, pitch_ratio))
    new_rate = int(_BASE_RATE * ratio)
    tempo = 1.0 / ratio
    tempo_filters: list[str] = []
    remaining = tempo
    while remaining > 2.0:
        tempo_filters.append("atempo=2.0")
        remaining /= 2.0
    while remaining < 0.5:
        tempo_filters.append("atempo=0.5")
        remaining /= 0.5
    tempo_filters.append(f"atempo={remaining:.6f}")
    return f"asetrate={new_rate},{','.join(tempo_filters)},aresample={_BASE_RATE}"


def _kid_voice_filter(preset: dict[str, Any], user_pitch: float = 1.0) -> str:
    """
    Child / baby voice: pitch + formant EQ + bass cut.
    Mimics a smaller vocal tract (brighter, thinner) instead of only speeding up pitch.
    """
    base_pitch = float(preset.get("pitch", 1.4))
    ratio = base_pitch * float(user_pitch)
    ratio = max(1.18, min(1.72, ratio))

    parts: list[str] = []
    pitch_part = _pitch_shift_filter(ratio)
    if pitch_part:
        parts.append(pitch_part)

    hp = int(preset.get("highpass_hz", 300))
    parts.append(f"highpass=f={hp}")

    for eq in preset.get("formant_eq") or []:
        parts.append(eq)

    bass_cut = int(preset.get("bass_cut", -8))
    parts.append(f"bass=g={bass_cut}")

    parts.append(
        "acompressor=threshold=-20dB:ratio=2.8:attack=6:release=60,"
        "speechnorm=e=12.5:r=0.01:l=1"
    )

    if preset.get("breathiness"):
        parts.append("aecho=0.35:0.5:45:0.07")

    if preset.get("fx"):
        parts.append(preset["fx"])

    return ",".join(parts)


class JobStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class StudioJob:
    id: str
    status: JobStatus = JobStatus.QUEUED
    progress: float = 0.0
    message: str = "Queued"
    error: str | None = None
    output_path: Path | None = None
    output_format: str = "mp3"
    original_filename: str = "audio.webm"
    created_at: float = field(default_factory=time.time)


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
        if not isinstance(data, dict):
            return {}
        data["effects"] = _normalize_effect_ids(data.get("effects"))
        return data
    except json.JSONDecodeError:
        return {}


class VoiceStudioService:
    def __init__(self) -> None:
        self._jobs: dict[str, StudioJob] = {}
        self._lock = threading.Lock()
        self._ffmpeg = _resolve_executable("ffmpeg", "FFMPEG_PATH")
        self._ffprobe = _resolve_executable("ffprobe", "FFPROBE_PATH")
        self.max_upload_mb = int(os.getenv("STUDIO_MAX_MB", "50"))
        self.max_duration_sec = int(os.getenv("STUDIO_MAX_DURATION_SEC", "300"))
        self._temp_root = Path(tempfile.gettempdir()) / "clearmark_studio"
        self._temp_root.mkdir(parents=True, exist_ok=True)
        if self._ffmpeg:
            logger.info("Voice Studio FFmpeg: %s", self._ffmpeg)
        threading.Thread(target=self._periodic_cleanup, daemon=True).start()

    @property
    def ffmpeg_available(self) -> bool:
        return self._ffmpeg is not None

    def presets_payload(self) -> dict[str, Any]:
        return {
            "voicePresets": [
                {"id": k, "label": v["label"], "category": "voice"}
                for k, v in VOICE_PRESETS.items()
            ],
            "emotionEffects": [
                {"id": k, "label": v["label"], "category": "emotion"}
                for k, v in EMOTION_EFFECTS.items()
            ],
            "songStyles": [
                {"id": k, "label": v["label"], "category": "song"}
                for k, v in SONG_STYLES.items()
            ],
        }

    def health(self) -> dict[str, Any]:
        return {
            "status": "ok" if self.ffmpeg_available else "degraded",
            "ffmpeg": self.ffmpeg_available,
            "ffmpeg_path": self._ffmpeg,
            "max_upload_mb": self.max_upload_mb,
            "neural_child_voices": True,
            "neural_engine": "Microsoft Edge neural (royalty-free, e.g. AnaNeural)",
            "lyrics_to_song": True,
            "song_styles": list(SONG_STYLES.keys()),
        }

    def get_job(self, job_id: str) -> StudioJob | None:
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
        audio_bytes: bytes | None,
        filename: str,
        settings_json: str | None,
    ) -> StudioJob:
        if not self.ffmpeg_available:
            raise RuntimeError("FFmpeg is required for Voice Studio.")

        settings = _parse_settings(settings_json)
        lyrics = str(settings.get("lyricsText", "")).strip()

        if not audio_bytes and len(lyrics) < 2:
            raise ValueError("Provide a recording/upload or type at least 2 characters of lyrics.")

        if audio_bytes:
            size_mb = len(audio_bytes) / (1024 * 1024)
            if size_mb > self.max_upload_mb:
                raise ValueError(f"Audio exceeds maximum size ({self.max_upload_mb} MB).")

        out_fmt = str(settings.get("format", "mp3")).lower()
        if out_fmt not in {"mp3", "wav", "aac"}:
            out_fmt = "mp3"

        job_id = str(uuid.uuid4())
        job = StudioJob(
            id=job_id,
            output_format=out_fmt,
            original_filename=filename or "recording.webm",
        )
        work_dir = self._temp_root / job_id
        work_dir.mkdir(parents=True, exist_ok=True)

        input_path: Path | None = None
        if audio_bytes:
            ext = Path(filename).suffix.lower() or ".webm"
            if ext not in {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".webm", ".flac", ".opus"}:
                ext = ".webm"
            input_path = (work_dir / "input").with_suffix(ext)
            input_path.write_bytes(audio_bytes)

        with self._lock:
            self._jobs[job_id] = job

        threading.Thread(
            target=self._run_job,
            args=(job_id, input_path, settings),
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

    def _run_job(
        self, job_id: str, input_path: Path | None, settings: dict[str, Any]
    ) -> None:
        work_dir = (
            input_path.parent if input_path else self._temp_root / job_id
        )
        try:
            self._update_job(
                job_id,
                status=JobStatus.PROCESSING,
                progress=5,
                message="Analyzing audio…",
            )
            lyrics = str(settings.get("lyricsText", "")).strip()
            if input_path and input_path.exists():
                duration = self._probe_duration(input_path)
                if duration > self.max_duration_sec:
                    raise ValueError(
                        f"Audio exceeds maximum duration ({self.max_duration_sec}s)."
                    )
            else:
                word_count = max(1, len(lyrics.split()))
                duration = min(
                    self.max_duration_sec,
                    max(4.0, word_count / 2.2),
                )

            job = self.get_job(job_id)
            out_fmt = job.output_format if job else "mp3"
            output_path = work_dir / f"output.{out_fmt}"

            self._process_audio(job_id, input_path, output_path, settings, duration)

            self._update_job(
                job_id,
                status=JobStatus.COMPLETED,
                progress=100,
                message="Ready to preview & download",
                output_path=output_path,
            )
        except Exception as exc:
            logger.exception("Studio job %s failed", job_id)
            self._update_job(
                job_id,
                status=JobStatus.FAILED,
                progress=0,
                message="Processing failed",
                error=str(exc),
            )

    def _probe_duration(self, path: Path) -> float:
        if not self._ffprobe:
            return 0.0
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
        if result.returncode != 0:
            return 0.0
        try:
            return float(result.stdout.strip())
        except ValueError:
            return 0.0

    def _combined_pitch_ratio(self, settings: dict[str, Any]) -> float:
        preset_id = settings.get("voicePreset", "original")
        preset = VOICE_PRESETS.get(preset_id, VOICE_PRESETS["original"])
        preset_pitch = float(preset.get("pitch", 1.0))
        user_pitch = float(settings.get("pitch", 1.0))
        combined = preset_pitch * user_pitch
        return max(0.5, min(2.0, combined))

    def _build_filter_chain(self, settings: dict[str, Any], duration: float = 0) -> str:
        parts: list[str] = []

        if settings.get("denoise", True):
            parts.append("afftdn=nr=10:nf=-25")

        preset_id = settings.get("voicePreset", "original")
        preset = VOICE_PRESETS.get(preset_id, VOICE_PRESETS["original"])
        user_pitch = float(settings.get("pitch", 1.0))

        if preset.get("kid_profile"):
            voice_filter = _kid_voice_filter(preset, user_pitch)
        else:
            voice_filter = _pitch_shift_filter(self._combined_pitch_ratio(settings))
            if preset.get("fx"):
                voice_filter = ",".join(
                    p for p in (voice_filter, preset["fx"]) if p
                )

        if voice_filter:
            parts.append(voice_filter)

        # Emotion effects are applied in separate passes (_apply_emotion_effects)

        speed = float(settings.get("speed", 1.0))
        if speed != 1.0 and 0.5 <= speed <= 2.0:
            parts.append(self._atempo_chain(speed))

        volume = float(settings.get("volume", 1.0))
        if volume != 1.0:
            parts.append(f"volume={max(0.1, min(3.0, volume)):.2f}")

        fade_in = float(settings.get("fadeIn", 0))
        fade_out = float(settings.get("fadeOut", 0))
        if fade_in > 0:
            parts.append(f"afade=t=in:st=0:d={fade_in:.2f}")
        if fade_out > 0 and duration > fade_out:
            parts.append(
                f"afade=t=out:st={duration - fade_out:.2f}:d={fade_out:.2f}"
            )

        return ",".join(parts) if parts else "anull"

    @staticmethod
    def _atempo_chain(speed: float) -> str:
        """FFmpeg atempo supports 0.5–2.0 per filter; chain for wider range."""
        remaining = speed
        filters: list[str] = []
        while remaining > 2.0:
            filters.append("atempo=2.0")
            remaining /= 2.0
        while remaining < 0.5:
            filters.append("atempo=0.5")
            remaining /= 0.5
        filters.append(f"atempo={remaining:.4f}")
        return ",".join(filters)

    def _process_audio(
        self,
        job_id: str,
        input_path: Path | None,
        output_path: Path,
        settings: dict[str, Any],
        duration: float,
    ) -> None:
        work_dir = (
            input_path.parent if input_path else self._temp_root / job_id
        )
        preset_id = settings.get("voicePreset", "original")
        preset = VOICE_PRESETS.get(preset_id, VOICE_PRESETS["original"])
        lyrics_text = str(settings.get("lyricsText", "")).strip() or None
        song_mode = bool(settings.get("songMode"))

        use_neural = (
            preset.get("neural_voice")
            and os.getenv("STUDIO_NEURAL_VOICE", "true").lower()
            in ("1", "true", "yes")
        )

        if use_neural or (lyrics_text and not input_path):
            if not preset.get("neural_voice"):
                preset = VOICE_PRESETS.get("female_neural", preset)
            try:
                processed = self._process_neural_voice(
                    job_id,
                    input_path,
                    work_dir,
                    preset,
                    duration,
                    lyrics_text=lyrics_text,
                )
            except Exception as exc:
                if lyrics_text and not input_path:
                    raise
                logger.warning(
                    "Neural voice failed (%s), using FX fallback", exc
                )
                self._update_job(
                    job_id,
                    message="Neural voice unavailable — using audio FX…",
                )
                processed = self._process_fx_voice(
                    job_id, input_path, work_dir, settings, duration
                )
        else:
            if not input_path or not input_path.exists():
                raise RuntimeError(
                    "Record or upload audio, or type lyrics with a neural voice preset."
                )
            processed = self._process_fx_voice(
                job_id, input_path, work_dir, settings, duration
            )

        if song_mode:
            processed = self._apply_song_style(
                job_id, processed, work_dir, settings
            )

        effect_ids = _normalize_effect_ids(settings.get("effects"))
        mix_input = self._apply_emotion_effects(
            job_id, processed, work_dir, effect_ids
        )

        bg_path = settings.get("backgroundPath")
        if song_mode and not bg_path:
            vocal_dur = self._probe_duration(mix_input) or duration
            style_id = str(settings.get("songStyle", "pop"))
            bg_path = str(
                self._generate_backing_track(work_dir, vocal_dur, style_id)
            )
            settings["backgroundVolume"] = float(
                SONG_STYLES.get(style_id, SONG_STYLES["pop"]).get(
                    "backing_volume", 0.3
                )
            )

        if bg_path and Path(bg_path).exists():
            self._update_job(job_id, progress=70, message="Mixing background…")
            mixed = work_dir / "mixed.wav"
            bg_vol = float(settings.get("backgroundVolume", 0.25))
            self._run_ffmpeg(
                [
                    self._ffmpeg,
                    "-y",
                    "-i",
                    str(mix_input),
                    "-i",
                    str(bg_path),
                    "-filter_complex",
                    f"[1:a]volume={bg_vol}[bg];[0:a][bg]amix=inputs=2:duration=first",
                    str(mixed),
                ],
                "Background mix failed",
            )
            mix_input = mixed

        self._update_job(job_id, progress=85, message="Exporting…")
        self._export(mix_input, output_path, output_path.suffix.lstrip("."))

        input_resolved = input_path.resolve() if input_path else None
        for temp in work_dir.glob("*"):
            resolved = temp.resolve()
            keep = {mix_input.resolve(), output_path.resolve()}
            if input_resolved:
                keep.add(input_resolved)
            if resolved in keep:
                continue
            if temp.suffix in {".wav", ".mp3"}:
                temp.unlink(missing_ok=True)

    def _process_fx_voice(
        self,
        job_id: str,
        input_path: Path | None,
        work_dir: Path,
        settings: dict[str, Any],
        duration: float,
    ) -> Path:
        if not input_path or not input_path.exists():
            raise RuntimeError("Audio input required for FX-only processing.")
        normalized = work_dir / "normalized.wav"
        self._update_job(job_id, progress=20, message="Cleaning & normalizing…")
        trim_start = float(settings.get("trimStart", 0))
        trim_end = settings.get("trimEnd")
        pre_input: list[str] = []
        if trim_start > 0:
            pre_input.extend(["-ss", str(trim_start)])
        if trim_end is not None:
            pre_input.extend(["-to", str(float(trim_end))])

        self._run_ffmpeg(
            [
                self._ffmpeg,
                "-y",
                *pre_input,
                "-i",
                str(input_path),
                "-af",
                "highpass=f=80,lowpass=f=12000,loudnorm=I=-16:TP=-1.5:LRA=11",
                "-ar",
                str(_BASE_RATE),
                "-ac",
                "2",
                str(normalized),
            ],
            "Audio cleanup failed",
        )

        self._update_job(job_id, progress=50, message="Applying voice FX…")
        norm_duration = self._probe_duration(normalized) or duration
        filter_chain = self._build_filter_chain(settings, norm_duration)
        processed = work_dir / "processed.wav"

        self._run_ffmpeg(
            [
                self._ffmpeg,
                "-y",
                "-i",
                str(normalized),
                "-af",
                filter_chain,
                "-ar",
                str(_BASE_RATE),
                "-ac",
                "2",
                str(processed),
            ],
            "Voice FX failed",
        )
        return processed

    async def _synthesize_neural_async(
        self, text: str, voice: str, rate: str, pitch: str
    ) -> bytes:
        import edge_tts

        communicate = edge_tts.Communicate(
            text.strip()[:4096], voice, rate=rate, pitch=pitch
        )
        chunks: list[bytes] = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                chunks.append(chunk["data"])
        if not chunks:
            raise RuntimeError("Neural voice returned no audio. Check internet.")
        return b"".join(chunks)

    def _transcribe_speech(self, wav_path: Path) -> str:
        import speech_recognition as sr

        recognizer = sr.Recognizer()
        with sr.AudioFile(str(wav_path)) as source:
            audio = recognizer.record(source)
        try:
            return recognizer.recognize_google(audio, language="en-US").strip()
        except sr.UnknownValueError:
            return ""
        except sr.RequestError as exc:
            raise RuntimeError(
                "Speech recognition needs internet (Google STT)."
            ) from exc

    def _process_neural_voice(
        self,
        job_id: str,
        input_path: Path | None,
        work_dir: Path,
        preset: dict[str, Any],
        duration: float,
        lyrics_text: str | None = None,
    ) -> Path:
        """Re-speak lyrics with royalty-free Microsoft neural voice (AnaNeural, JennyNeural, etc.)."""
        text = (lyrics_text or "").strip()

        if len(text) < 2:
            if not input_path or not input_path.exists():
                raise RuntimeError("Type lyrics or record/upload speech to convert.")
            self._update_job(job_id, progress=22, message="Preparing audio…")
            stt_wav = work_dir / "stt_16k.wav"
            self._run_ffmpeg(
                [
                    self._ffmpeg,
                    "-y",
                    "-i",
                    str(input_path),
                    "-af",
                    "highpass=f=100,lowpass=f=7000",
                    "-ar",
                    "16000",
                    "-ac",
                    "1",
                    str(stt_wav),
                ],
                "Audio prep failed",
            )

            self._update_job(job_id, progress=32, message="Transcribing speech…")
            text = self._transcribe_speech(stt_wav)
            if len(text) < 2:
                raise RuntimeError(
                    "Could not detect clear English speech. Speak clearly or type your lyrics."
                )
        else:
            self._update_job(job_id, progress=28, message="Using your lyrics…")

        voice = str(preset["neural_voice"])
        rate = str(preset.get("neural_rate", "+5%"))
        pitch = str(preset.get("neural_pitch", "+8Hz"))
        label = preset.get("label", "neural")

        self._update_job(
            job_id,
            progress=48,
            message=f"Synthesizing {label} (royalty-free neural)…",
        )
        mp3_path = work_dir / "neural_raw.mp3"
        mp3_bytes = asyncio.run(
            self._synthesize_neural_async(text, voice, rate, pitch)
        )
        mp3_path.write_bytes(mp3_bytes)

        neural_wav = work_dir / "neural_voice.wav"
        self._run_ffmpeg(
            [
                self._ffmpeg,
                "-y",
                "-i",
                str(mp3_path),
                "-af",
                "loudnorm=I=-16:TP=-1.5:LRA=11",
                "-ar",
                str(_BASE_RATE),
                "-ac",
                "2",
                str(neural_wav),
            ],
            "Neural voice export failed",
        )

        neural_dur = self._probe_duration(neural_wav) or 0.0
        if duration > 0.8 and neural_dur > 0.3:
            ratio = duration / neural_dur
            if ratio < 0.88 or ratio > 1.15:
                matched = work_dir / "neural_timed.wav"
                tempo = self._atempo_chain(max(0.5, min(2.0, ratio)))
                self._run_ffmpeg(
                    [
                        self._ffmpeg,
                        "-y",
                        "-i",
                        str(neural_wav),
                        "-af",
                        tempo,
                        "-ar",
                        str(_BASE_RATE),
                        "-ac",
                        "2",
                        str(matched),
                    ],
                    "Timing adjust failed",
                )
                neural_wav = matched

        logger.info("Neural voice: voice=%s text_len=%d", voice, len(text))
        return neural_wav

    def _apply_song_style(
        self,
        job_id: str,
        source: Path,
        work_dir: Path,
        settings: dict[str, Any],
    ) -> Path:
        style_id = str(settings.get("songStyle", "pop"))
        style = SONG_STYLES.get(style_id, SONG_STYLES["pop"])
        label = str(style.get("label", "Song"))

        self._update_job(
            job_id, progress=58, message=f"Applying {label} singing style…"
        )
        sung = work_dir / "song_vocal.wav"
        vocal_filters = str(style.get("vocal_filters", ""))
        self._run_ffmpeg(
            [
                self._ffmpeg,
                "-y",
                "-i",
                str(source),
                "-af",
                vocal_filters,
                "-ar",
                str(_BASE_RATE),
                "-ac",
                "2",
                str(sung),
            ],
            f"Song style '{label}' failed",
        )
        return sung

    def _generate_backing_track(
        self, work_dir: Path, duration: float, style_id: str
    ) -> Path:
        """Procedural royalty-free chord pad — no external samples."""
        style = SONG_STYLES.get(style_id, SONG_STYLES["pop"])
        chords: list[float] = style.get("backing_chords") or [261.63, 329.63, 392.0]
        dur = max(duration + 3.0, 8.0)
        backing = work_dir / "song_backing.wav"

        inputs: list[str] = []
        for index, freq in enumerate(chords[:4]):
            inputs.extend(
                [
                    "-f",
                    "lavfi",
                    "-i",
                    f"sine=frequency={freq}:duration={dur:.2f}",
                ]
            )

        mix_inputs = "".join(f"[{i}:a]" for i in range(len(chords[:4])))
        filter_complex = (
            f"{mix_inputs}amix=inputs={len(chords[:4])}:duration=longest,"
            f"volume=0.22,lowpass=f=1800,highpass=f=80,"
            f"tremolo=f=1.2:d=0.18,aecho=0.5:0.4:500:0.25"
        )

        cmd = [self._ffmpeg, "-y", *inputs, "-filter_complex", filter_complex]
        cmd.extend(["-ar", str(_BASE_RATE), "-ac", "2", str(backing)])
        self._run_ffmpeg(cmd, "Backing track generation failed")
        return backing

    def _apply_emotion_effects(
        self,
        job_id: str,
        source: Path,
        work_dir: Path,
        effect_ids: list[str],
    ) -> Path:
        """Apply each emotion filter in its own FFmpeg pass (reliable on FFmpeg 8+)."""
        valid = _normalize_effect_ids(effect_ids)
        if not valid:
            return source

        steps: list[tuple[str, str, str]] = []
        for effect_id in valid:
            meta = EMOTION_EFFECTS[effect_id]
            label = str(meta.get("label", effect_id))
            for fx in _split_filter_chain(str(meta.get("filters", ""))):
                steps.append((effect_id, label, fx))

        if not steps:
            return source

        logger.info(
            "Applying emotion effects: %s (%d filter passes)",
            valid,
            len(steps),
        )

        current = source
        temp_files: list[Path] = []
        total = len(steps)

        for index, (_effect_id, label, fx) in enumerate(steps):
            pct = 52 + (index + 1) / total * 28
            self._update_job(
                job_id,
                progress=pct,
                message=f"Applying {label}…",
            )

            out_path = work_dir / f"emotion_{index:03d}.wav"
            self._run_ffmpeg(
                [
                    self._ffmpeg,
                    "-y",
                    "-i",
                    str(current),
                    "-af",
                    fx,
                    "-ar",
                    str(_BASE_RATE),
                    "-ac",
                    "2",
                    str(out_path),
                ],
                f"Effect '{label}' failed ({fx})",
            )

            if current != source and current.exists():
                temp_files.append(current)
            current = out_path

        for temp in temp_files:
            temp.unlink(missing_ok=True)

        return current

    def _run_ffmpeg(self, cmd: list[str], error_prefix: str) -> None:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "").strip()[-500:]
            logger.error("%s: %s", error_prefix, detail)
            raise RuntimeError(f"{error_prefix}: {detail}")

    def _export(self, input_path: Path, output_path: Path, fmt: str) -> None:
        cmd = [self._ffmpeg, "-y", "-i", str(input_path), "-map_metadata", "-1"]
        if fmt == "mp3":
            cmd.extend(["-c:a", "libmp3lame", "-b:a", "320k", "-ar", "48000"])
        elif fmt == "aac":
            cmd.extend(["-c:a", "aac", "-b:a", "256k", "-ar", "48000"])
        else:
            cmd.extend(["-c:a", "pcm_s16le", "-ar", "48000"])
        cmd.append(str(output_path))
        subprocess.run(cmd, capture_output=True, check=True, timeout=300)

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
