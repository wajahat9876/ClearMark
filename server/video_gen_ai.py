"""Image-to-video backends (no watermark on export).

Default (VIDEO_GEN_AI=free): 100% free local animation — no API credits.
  1. Depth parallax (2.5D layered motion) — always available, offline
  2. Stable Video Diffusion — optional, open weights, local GPU/CPU

Cloud (hf/fal) only when VIDEO_GEN_ALLOW_CLOUD=true and keys are set.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_svd_pipeline: Any | None = None
_svd_lock = __import__("threading").Lock()
_hf_client: Any | None = None
_hf_client_lock = __import__("threading").Lock()


def _mode() -> str:
    return os.getenv("VIDEO_GEN_AI", "free").strip().lower()


def _cloud_allowed() -> bool:
    return os.getenv("VIDEO_GEN_ALLOW_CLOUD", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def parallax_available() -> bool:
    return _mode() in ("free", "auto", "parallax", "local", "motion")


def hf_configured() -> bool:
    return bool(
        os.getenv("HF_TOKEN", "").strip()
        or os.getenv("HUGGINGFACE_API_KEY", "").strip()
        or os.getenv("FAL_KEY", "").strip()
    )


def fal_configured() -> bool:
    return bool(os.getenv("FAL_KEY", "").strip())


def fal_available() -> bool:
    if not _cloud_allowed():
        return False
    if _mode() in ("free", "parallax", "local", "motion"):
        return False
    if not fal_configured():
        return False
    try:
        import fal_client  # noqa: F401

        return True
    except ImportError:
        return False


def _friendly_error(exc: Exception | str) -> str:
    msg = str(exc)
    lower = msg.lower()
    if "402" in msg or "payment required" in lower or "depleted" in lower:
        return (
            "Cloud credits exhausted. Using free local mode: set VIDEO_GEN_AI=free "
            "in server/.env (no paid APIs needed)."
        )
    if "401" in msg or "unauthorized" in lower or "invalid" in lower and "token" in lower:
        return "Invalid HF_TOKEN or FAL_KEY — check server/.env and restart the server."
    if "403" in msg or "forbidden" in lower:
        return "API access denied — verify your token permissions or accept the model license on Hugging Face."
    return msg[:500]


def _svd_disabled() -> bool:
    return os.getenv("VIDEO_GEN_DISABLE_SVD", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def svd_deps_available() -> bool:
    """Check SVD without crashing if torch/diffusers versions are incompatible."""
    if _svd_disabled():
        return False
    try:
        import torch  # noqa: F401

        if not hasattr(torch, "Tensor"):
            return False
        from diffusers import StableVideoDiffusionPipeline  # noqa: F401

        return True
    except Exception as exc:
        logger.debug("SVD deps unavailable: %s", exc)
        return False


def gpu_available() -> bool:
    try:
        import torch

        if torch.cuda.is_available():
            return True
        return bool(
            hasattr(torch.backends, "mps") and torch.backends.mps.is_available()
        )
    except Exception:
        return False


def hf_available() -> bool:
    if not _cloud_allowed():
        return False
    if _mode() in ("free", "parallax", "local", "motion"):
        return False
    if _mode() in ("hf", "auto", "meta"):
        if not hf_configured():
            return False
        try:
            from huggingface_hub import InferenceClient  # noqa: F401

            return True
        except Exception as exc:
            logger.debug("HF client unavailable: %s", exc)
            return False
    return False


def svd_available() -> bool:
    if _mode() == "motion":
        return False
    if _mode() in ("svd", "auto", "free", "local", "parallax"):
        return svd_deps_available()
    return False


def resolve_backends() -> list[str]:
    """Ordered backends — free local first; cloud only if explicitly allowed."""
    mode = _mode()
    if mode == "motion":
        return []

    order: list[str] = []

    if mode in ("free", "auto", "parallax", "local", "meta"):
        if parallax_available():
            order.append("parallax")
        if svd_available():
            order.append("svd")

    if mode == "svd":
        return ["svd"] if svd_available() else (["parallax"] if parallax_available() else [])

    if mode in ("hf", "meta") or _cloud_allowed():
        if fal_available():
            order.append("fal")
        if hf_available() and (
            os.getenv("HF_TOKEN", "").strip()
            or os.getenv("HUGGINGFACE_API_KEY", "").strip()
        ):
            order.append("hf")

    if mode == "hf" and not order:
        if parallax_available():
            order.append("parallax")

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for b in order:
        if b not in seen:
            seen.add(b)
            unique.append(b)
    return unique


def effective_engine_label() -> str:
    try:
        backends = resolve_backends()
    except Exception as exc:
        logger.warning("Could not resolve video backends: %s", exc)
        backends = ["hf"] if hf_configured() else []
    if not backends:
        if _mode() == "motion":
            return "camera-motion (not AI animation)"
        if not hf_configured():
            return "add HF_TOKEN to server/.env"
        return "not configured"
    labels = {
        "parallax": "Free 2.5D depth animation (local)",
        "svd": "Stable Video Diffusion (local, open weights)",
        "fal": "fal.ai (cloud)",
        "hf": "Hugging Face Wan (cloud)",
    }
    return labels.get(backends[0], backends[0])


def ai_animation_configured() -> bool:
    return len(resolve_backends()) > 0


def _style_prompt_suffix(style: str) -> str:
    hints = {
        "cinematic": "cinematic lighting, smooth camera motion, film quality",
        "cartoon": "cartoon animation style, vibrant colors, playful motion",
        "pixar": "pixar style 3d animation, soft lighting, expressive motion",
        "anime": "anime style animation, dynamic motion",
        "realistic": "photorealistic natural motion, subtle realistic movement",
        "fantasy": "fantasy magical atmosphere, ethereal motion",
        "kids": "kids storybook animation, cheerful gentle motion",
        "action": "dynamic action motion, energetic camera movement",
    }
    return hints.get(style, "smooth natural motion")


def _build_prompt(user_prompt: str, style: str) -> str:
    base = (user_prompt or "").strip()
    style_hint = _style_prompt_suffix(style)
    if base:
        return f"{base}. {style_hint}"
    return style_hint


def _hf_inference_steps(quality: str) -> int:
    """Slightly fewer steps on HD exports — negligible quality loss, faster inference."""
    if quality in ("2k", "4k"):
        return int(os.getenv("VIDEO_GEN_STEPS", "30"))
    return int(os.getenv("VIDEO_GEN_STEPS_HD", "26"))


def _hf_num_frames(duration_sec: float, quality: str) -> int:
    """Match frame count to clip length (Wan caps ~81). Fewer frames = faster, still smooth."""
    cap = 81 if quality in ("2k", "4k") else 65
    target = int(max(25, min(cap, duration_sec * 16)))
    return target


def _get_hf_client():
    global _hf_client
    with _hf_client_lock:
        if _hf_client is not None:
            return _hf_client
        from huggingface_hub import InferenceClient

        timeout = int(os.getenv("VIDEO_GEN_HF_TIMEOUT", "600"))
        fal_key = os.getenv("FAL_KEY", "").strip()
        hf_token = (
            os.getenv("HF_TOKEN", "").strip()
            or os.getenv("HUGGINGFACE_API_KEY", "").strip()
        )
        provider = os.getenv("VIDEO_GEN_HF_PROVIDER", "").strip() or None
        if fal_key:
            _hf_client = InferenceClient(
                provider="fal-ai",
                api_key=fal_key,
                timeout=timeout,
            )
        elif provider:
            _hf_client = InferenceClient(
                token=hf_token, provider=provider, timeout=timeout
            )
        else:
            _hf_client = InferenceClient(
                provider="fal-ai", token=hf_token, timeout=timeout
            )
        return _hf_client


def generate_fal_direct_clip(
    image_path: Path,
    output_path: Path,
    *,
    prompt: str,
    style: str = "cinematic",
) -> tuple[bool, str]:
    """fal.ai direct API — uses FAL_KEY (separate from HF Inference credits)."""
    if not fal_available():
        return False, "fal-client not installed (pip install fal-client)"

    try:
        import fal_client
        import httpx

        model = os.getenv(
            "VIDEO_GEN_FAL_MODEL",
            "fal-ai/minimax-video/image-to-video",
        )
        full_prompt = _build_prompt(prompt, style)
        logger.info("fal.ai image_to_video model=%s", model)

        image_url = fal_client.upload_file(str(image_path))
        result = fal_client.subscribe(
            model,
            arguments={
                "image_url": image_url,
                "prompt": full_prompt,
            },
        )

        video_url = None
        if isinstance(result, dict):
            video = result.get("video")
            if isinstance(video, dict):
                video_url = video.get("url")
            if not video_url:
                video_url = result.get("video_url")

        if not video_url:
            return False, "fal.ai returned no video URL"

        resp = httpx.get(video_url, timeout=300, follow_redirects=True)
        resp.raise_for_status()
        if len(resp.content) < 1000:
            return False, "fal.ai returned empty video"
        output_path.write_bytes(resp.content)
        return True, ""
    except Exception as exc:
        logger.warning("fal.ai generation failed: %s", exc)
        return False, _friendly_error(exc)


def generate_hf_clip(
    image_path: Path,
    output_path: Path,
    *,
    prompt: str,
    style: str = "cinematic",
    quality: str = "1080p",
    duration_sec: float = 4.0,
) -> tuple[bool, str]:
    """Generate animated clip via Hugging Face Inference (Wan i2v)."""
    if not hf_available():
        return False, "Hugging Face client not available"

    model = os.getenv(
        "VIDEO_GEN_HF_MODEL",
        "Wan-AI/Wan2.1-I2V-14B-720P",
    )

    try:
        client = _get_hf_client()
        full_prompt = _build_prompt(prompt, style)
        steps = _hf_inference_steps(quality)
        num_frames = _hf_num_frames(duration_sec, quality)
        logger.info(
            "HF image_to_video model=%s steps=%d frames=%d",
            model,
            steps,
            num_frames,
        )

        video_bytes = client.image_to_video(
            str(image_path),
            model=model,
            prompt=full_prompt,
            num_inference_steps=steps,
            num_frames=num_frames,
        )

        if isinstance(video_bytes, bytes) and len(video_bytes) > 1000:
            output_path.write_bytes(video_bytes)
            return True, ""
        logger.warning("HF image_to_video returned empty or invalid data")
        return False, "Hugging Face returned empty video data"
    except Exception as exc:
        logger.warning("HF image_to_video failed: %s", exc)
        return False, _friendly_error(exc)


def _get_svd_pipeline():
    global _svd_pipeline
    with _svd_lock:
        if _svd_pipeline is not None:
            return _svd_pipeline
        import torch
        from diffusers import StableVideoDiffusionPipeline
        from diffusers.utils import load_image

        model_id = os.getenv(
            "VIDEO_GEN_SVD_MODEL",
            "stabilityai/stable-video-diffusion-img2vid-xt",
        )
        use_gpu = gpu_available()
        dtype = torch.float16 if use_gpu else torch.float32
        if torch.cuda.is_available():
            device = "cuda"
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            device = "mps"
        else:
            device = "cpu"

        logger.info("Loading SVD %s on %s", model_id, device)
        pipe = StableVideoDiffusionPipeline.from_pretrained(
            model_id,
            torch_dtype=dtype,
            variant="fp16" if dtype == torch.float16 else None,
        )
        if device == "cuda":
            try:
                pipe.enable_model_cpu_offload()
            except Exception:
                pipe.to(device)
        else:
            pipe.to(device)

        _svd_pipeline = (pipe, device, load_image)
        return _svd_pipeline


def generate_svd_clip(
    image_path: Path,
    output_path: Path,
    *,
    prompt: str = "",
    style: str = "cinematic",
    num_frames: int = 25,
    fps: int = 7,
    motion_bucket_id: int | None = None,
) -> bool:
    """Local Stable Video Diffusion — open weights, no watermark."""
    if not svd_available():
        return False

    del prompt, style  # SVD is image-conditioned only
    if motion_bucket_id is None:
        motion_bucket_id = int(os.getenv("VIDEO_GEN_MOTION_BUCKET", "127"))

    try:
        pipe, _device, load_image = _get_svd_pipeline()
        import torch
        from diffusers.utils import export_to_video

        image = load_image(str(image_path))
        image = image.resize((1024, 576))
        generator = torch.manual_seed(int(os.getenv("VIDEO_GEN_SEED", "42")))

        frames = pipe(
            image,
            num_frames=min(25, max(14, num_frames)),
            decode_chunk_size=int(os.getenv("VIDEO_GEN_DECODE_CHUNK", "4")),
            motion_bucket_id=motion_bucket_id,
            noise_aug_strength=float(os.getenv("VIDEO_GEN_NOISE_AUG", "0.02")),
            generator=generator,
        ).frames[0]

        export_to_video(frames, str(output_path), fps=fps)
        return output_path.exists() and output_path.stat().st_size > 1000
    except Exception as exc:
        logger.warning("SVD generation failed: %s", exc)
        return False


def generate_ai_clip(
    image_path: Path,
    output_path: Path,
    *,
    prompt: str,
    style: str = "cinematic",
    fps: int = 24,
    quality: str = "1080p",
    duration_sec: float = 4.0,
) -> tuple[bool, str, str]:
    """Try each configured backend. Returns (success, backend_name, error)."""
    from video_gen_local import generate_parallax_clip

    last_error = ""
    for backend in resolve_backends():
        if backend == "parallax":
            ok, err = generate_parallax_clip(
                image_path,
                output_path,
                prompt=prompt,
                duration_sec=duration_sec,
                fps=fps,
            )
        elif backend == "fal":
            ok, err = generate_fal_direct_clip(
                image_path, output_path, prompt=prompt, style=style
            )
        elif backend == "hf":
            ok, err = generate_hf_clip(
                image_path,
                output_path,
                prompt=prompt,
                style=style,
                quality=quality,
                duration_sec=duration_sec,
            )
        elif backend == "svd":
            ok = generate_svd_clip(
                image_path,
                output_path,
                prompt=prompt,
                style=style,
                fps=min(8, fps),
            )
            err = "" if ok else "Local SVD generation failed"
        else:
            ok, err = False, f"Unknown backend: {backend}"

        if ok:
            return True, backend, ""
        last_error = err or f"{backend} failed"
        logger.info("Backend %s failed: %s", backend, last_error)

    return False, "", last_error or "No AI backend available"
