"""FastAPI service for LaMa AI inpainting."""

from __future__ import annotations

import io
import logging
import tempfile
import uuid
from contextlib import asynccontextmanager
from typing import List, Optional

from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent / ".env")

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from PIL import Image

from inpaint_service import InpaintService
from tts_service import TTSService
from video_enhance_service import VideoEnhanceService
from video_generator_service import VideoGeneratorService
from voice_studio_service import VoiceStudioService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
service: InpaintService | None = None
tts_service: TTSService | None = None
video_service: VideoEnhanceService | None = None
video_gen_service: VideoGeneratorService | None = None
studio_service: VoiceStudioService | None = None


class TTSGenerateBody(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    voiceId: str = "woman"
    speed: float = Field(1.0, ge=0.5, le=2.0)
    pitch: float = Field(1.0, ge=0.7, le=1.4)
    emotion: str = "calm"
    language: str = "en-US"
    aiEnhancement: bool = False


@asynccontextmanager
async def lifespan(_: FastAPI):
    global service, tts_service, video_service, video_gen_service, studio_service
    service = InpaintService()
    service.start_background_load()
    tts_service = TTSService()
    video_service = VideoEnhanceService()
    video_gen_service = VideoGeneratorService()
    studio_service = VoiceStudioService()
    logger.info("API ready — model loading in background.")
    yield
    service = None
    tts_service = None
    video_service = None
    video_gen_service = None
    studio_service = None


app = FastAPI(
    title="ClearMark API",
    description="AI inpainting for watermark and object removal",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
@app.get("/health")
async def health():
    if service is None:
        return {"status": "starting", "model_loaded": False, "model_loading": False}

    return {
        "status": "ok",
        "model_loaded": service.is_loaded,
        "model_loading": service.is_loading,
        "load_error": service.load_error,
        "device": service.device,
    }


@app.post("/api/inpaint")
@app.post("/inpaint")
async def inpaint(
    image: UploadFile = File(...),
    mask: UploadFile = File(...),
):
    if service is None:
        raise HTTPException(status_code=503, detail="Server is starting up.")

    if not service.is_loaded:
        if service.load_error:
            raise HTTPException(status_code=500, detail=service.load_error)
        if service.is_loading:
            raise HTTPException(
                status_code=503,
                detail=(
                    "AI model is still loading. On first run it downloads ~200MB — "
                    "wait until the server log says 'SimpleLama model ready', then retry."
                ),
            )
        raise HTTPException(status_code=503, detail="Model not loaded yet.")

    try:
        image_bytes = await image.read()
        mask_bytes = await mask.read()

        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        pil_mask = Image.open(io.BytesIO(mask_bytes)).convert("L")

        if pil_image.size != pil_mask.size:
            pil_mask = pil_mask.resize(pil_image.size, Image.Resampling.NEAREST)

        result = service.inpaint(pil_image, pil_mask)

        buffer = io.BytesIO()
        result.save(buffer, format="PNG", compress_level=1)
        buffer.seek(0)

        return Response(
            content=buffer.getvalue(),
            media_type="image/png",
            headers={
                "Content-Disposition": 'attachment; filename="cleared.png"',
                "X-Image-Width": str(result.width),
                "X-Image-Height": str(result.height),
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Inpainting failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/tts/health")
@app.get("/tts/health")
async def tts_health():
    if tts_service is None:
        return {"status": "starting", "configured": False, "provider": "edge"}

    return {
        "status": "ok",
        "configured": tts_service.is_configured,
        "provider": tts_service.provider,
        "free": tts_service.uses_free_tier,
        "edge_tts_min_version": "7.2.7",
    }


@app.post("/api/tts/generate")
@app.post("/tts/generate")
async def tts_generate(body: TTSGenerateBody):
    if tts_service is None:
        raise HTTPException(status_code=503, detail="Server is starting up.")

    try:
        audio_bytes, media_type = await tts_service.synthesize(
            text=body.text,
            voice_id=body.voiceId,
            speed=body.speed,
            pitch=body.pitch,
            emotion=body.emotion,
            language=body.language,
            ai_enhancement=body.aiEnhancement,
        )
        return Response(
            content=audio_bytes,
            media_type=media_type,
            headers={
                "Content-Disposition": 'attachment; filename="voice.mp3"',
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("TTS generation failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/video/health")
@app.get("/video/health")
async def video_health():
    if video_service is None:
        return {"status": "starting", "ffmpeg": False}
    return {"status": "ok", **video_service.health()}


@app.post("/api/video/enhance")
@app.post("/video/enhance")
async def video_enhance(
    video: UploadFile = File(...),
    resolution: str = Form("2k"),
):
    if video_service is None:
        raise HTTPException(status_code=503, detail="Server is starting up.")

    try:
        data = await video.read()
        filename = video.filename or "video.mp4"
        job = video_service.create_job(data, filename, resolution)
        return {
            "jobId": job.id,
            "status": job.status.value,
            "progress": job.progress,
            "message": job.message,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Video enhance submit failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/video/jobs/{job_id}")
@app.get("/video/jobs/{job_id}")
async def video_job_status(job_id: str):
    if video_service is None:
        raise HTTPException(status_code=503, detail="Server is starting up.")

    job = video_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    return {
        "jobId": job.id,
        "status": job.status.value,
        "progress": job.progress,
        "message": job.message,
        "error": job.error,
        "retries": job.retries,
    }


@app.get("/api/video/jobs/{job_id}/download")
@app.get("/video/jobs/{job_id}/download")
async def video_job_download(job_id: str):
    if video_service is None:
        raise HTTPException(status_code=503, detail="Server is starting up.")

    job = video_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job.status.value != "completed":
        raise HTTPException(
            status_code=409,
            detail=f"Job not ready (status: {job.status.value}).",
        )

    content = video_service.read_output(job_id)
    if not content:
        raise HTTPException(status_code=404, detail="Output file not found.")

    stem = job.original_filename.rsplit(".", 1)[0] if job.original_filename else "video"
    filename = f"{stem}_enhanced_{job.resolution}.mp4"
    return Response(
        content=content,
        media_type="video/mp4",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@app.get("/api/studio/health")
@app.get("/studio/health")
async def studio_health():
    if studio_service is None:
        return {"status": "starting", "ffmpeg": False}
    return {"status": "ok", **studio_service.health()}


@app.get("/api/studio/presets")
@app.get("/studio/presets")
async def studio_presets():
    if studio_service is None:
        raise HTTPException(status_code=503, detail="Server is starting up.")
    return studio_service.presets_payload()


@app.post("/api/studio/process")
@app.post("/studio/process")
async def studio_process(
    settings: str = Form("{}"),
    audio: Optional[UploadFile] = File(None),
    background: Optional[UploadFile] = File(None),
):
    if studio_service is None:
        raise HTTPException(status_code=503, detail="Server is starting up.")

    try:
        import json as json_lib
        from pathlib import Path as PathLib

        parsed = json_lib.loads(settings) if settings else {}
        lyrics = str(parsed.get("lyricsText", "")).strip()

        data: bytes | None = None
        filename = "recording.webm"
        if audio:
            data = await audio.read()
            filename = audio.filename or filename

        if not data and len(lyrics) < 2:
            raise HTTPException(
                status_code=400,
                detail="Provide audio or type lyrics (at least 2 characters).",
            )

        settings_data = settings
        if background:
            bg_bytes = await background.read()
            bg_path = PathLib(tempfile.gettempdir()) / f"studio_bg_{uuid.uuid4().hex}"
            bg_path.write_bytes(bg_bytes)
            parsed["backgroundPath"] = str(bg_path)
            settings_data = json_lib.dumps(parsed)

        job = studio_service.create_job(data, filename, settings_data)
        return {
            "jobId": job.id,
            "status": job.status.value,
            "progress": job.progress,
            "message": job.message,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Studio process failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/studio/jobs/{job_id}")
@app.get("/studio/jobs/{job_id}")
async def studio_job_status(job_id: str):
    if studio_service is None:
        raise HTTPException(status_code=503, detail="Server is starting up.")

    job = studio_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    return {
        "jobId": job.id,
        "status": job.status.value,
        "progress": job.progress,
        "message": job.message,
        "error": job.error,
        "format": job.output_format,
    }


@app.get("/api/studio/jobs/{job_id}/download")
@app.get("/studio/jobs/{job_id}/download")
async def studio_job_download(job_id: str):
    if studio_service is None:
        raise HTTPException(status_code=503, detail="Server is starting up.")

    job = studio_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job.status.value != "completed":
        raise HTTPException(
            status_code=409,
            detail=f"Job not ready (status: {job.status.value}).",
        )

    content = studio_service.read_output(job_id)
    if not content:
        raise HTTPException(status_code=404, detail="Output file not found.")

    media = {
        "mp3": ("audio/mpeg", "studio.mp3"),
        "wav": ("audio/wav", "studio.wav"),
        "aac": ("audio/aac", "studio.m4a"),
    }.get(job.output_format, ("audio/mpeg", "studio.mp3"))

    return Response(
        content=content,
        media_type=media[0],
        headers={"Content-Disposition": f'attachment; filename="{media[1]}"'},
    )


@app.get("/api/video-gen/health")
@app.get("/video-gen/health")
async def video_gen_health():
    if video_gen_service is None:
        return {"status": "starting", "ffmpeg": False}
    return {"status": "ok", **video_gen_service.health()}


@app.get("/api/video-gen/presets")
@app.get("/video-gen/presets")
async def video_gen_presets():
    if video_gen_service is None:
        raise HTTPException(status_code=503, detail="Server is starting up.")
    return video_gen_service.presets_payload()


@app.post("/api/video-gen/generate")
@app.post("/video-gen/generate")
async def video_gen_generate(
    images: List[UploadFile] = File(...),
    settings: str = Form("{}"),
):
    if video_gen_service is None:
        raise HTTPException(status_code=503, detail="Server is starting up.")

    try:
        files: list[tuple[bytes, str]] = []
        for img in images:
            data = await img.read()
            if data:
                files.append((data, img.filename or "image.png"))
        job = video_gen_service.create_job(files, settings)
        return {
            "jobId": job.id,
            "status": job.status.value,
            "progress": job.progress,
            "message": job.message,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Video generation submit failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/video-gen/jobs/{job_id}")
@app.get("/video-gen/jobs/{job_id}")
async def video_gen_job_status(job_id: str):
    if video_gen_service is None:
        raise HTTPException(status_code=503, detail="Server is starting up.")

    job = video_gen_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    return {
        "jobId": job.id,
        "status": job.status.value,
        "progress": job.progress,
        "message": job.message,
        "error": job.error,
    }


@app.get("/api/video-gen/jobs/{job_id}/download")
@app.get("/video-gen/jobs/{job_id}/download")
async def video_gen_job_download(job_id: str):
    if video_gen_service is None:
        raise HTTPException(status_code=503, detail="Server is starting up.")

    job = video_gen_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job.status.value != "completed":
        raise HTTPException(
            status_code=409,
            detail=f"Job not ready (status: {job.status.value}).",
        )

    content = video_gen_service.read_output(job_id)
    if not content:
        raise HTTPException(status_code=404, detail="Output file not found.")

    return Response(
        content=content,
        media_type="video/mp4",
        headers={
            "Content-Disposition": 'attachment; filename="clearmark_ai_video.mp4"',
        },
    )
