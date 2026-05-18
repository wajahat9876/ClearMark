"""FastAPI service for LaMa AI inpainting."""

from __future__ import annotations

import io
import logging

from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image

from inpaint_service import InpaintService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
service: InpaintService | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global service
    service = InpaintService()
    service.start_background_load()
    logger.info("API ready — model loading in background.")
    yield
    service = None


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
