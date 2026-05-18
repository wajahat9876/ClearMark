"""FastAPI service for LaMa AI inpainting."""

from __future__ import annotations

import io
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from PIL import Image

from inpaint_service import InpaintService
from tts_service import TTSService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
service: InpaintService | None = None
tts_service: TTSService | None = None


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
    global service, tts_service
    service = InpaintService()
    service.start_background_load()
    tts_service = TTSService()
    logger.info("API ready — model loading in background.")
    yield
    service = None
    tts_service = None


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
