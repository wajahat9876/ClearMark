"""LaMa inpainting wrapper — CPU/MPS safe loading on Mac."""

from __future__ import annotations

import logging
import os
import threading

import numpy as np
import torch
from PIL import Image

logger = logging.getLogger(__name__)

LAMA_MODEL_URL = os.environ.get(
    "LAMA_MODEL_URL",
    "https://github.com/enesmsahin/simple-lama-inpainting/releases/download/v0.1.0/big-lama.pt",
)


def _resolve_device() -> torch.device:
    """Pick a supported device. LaMa JIT must load on CPU first (CUDA-traced weights)."""
    forced = os.environ.get("LAMA_DEVICE", "").lower()
    if forced == "cpu":
        return torch.device("cpu")
    if forced == "mps":
        return torch.device("mps")
    if forced == "cuda" and torch.cuda.is_available():
        return torch.device("cuda")

    if torch.cuda.is_available():
        return torch.device("cuda")
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        # JIT was traced on CUDA; run inference on CPU for stability on Mac.
        return torch.device("cpu")
    return torch.device("cpu")


class LamaInpainter:
    """Loads LaMa with map_location=cpu so Macs without CUDA work."""

    def __init__(self, device: torch.device | None = None) -> None:
        from simple_lama_inpainting.utils import download_model, prepare_img_and_mask

        self._prepare = prepare_img_and_mask
        self.device = device or _resolve_device()

        model_path = os.environ.get("LAMA_MODEL") or download_model(LAMA_MODEL_URL)
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"LaMa model not found: {model_path}")

        logger.info("Loading LaMa weights on CPU (map_location=cpu)…")
        self.model = torch.jit.load(model_path, map_location="cpu")
        self.model.eval()
        self.model.to(self.device)
        logger.info("LaMa running on device: %s", self.device)

    def __call__(self, image: Image.Image, mask: Image.Image) -> Image.Image:
        image_t, mask_t = self._prepare(image, mask, self.device)

        with torch.inference_mode():
            inpainted = self.model(image_t, mask_t)
            cur_res = inpainted[0].permute(1, 2, 0).detach().cpu().numpy()
            cur_res = np.clip(cur_res * 255, 0, 255).astype(np.uint8)
            return Image.fromarray(cur_res)


class InpaintService:
    def __init__(self) -> None:
        self._model: LamaInpainter | None = None
        self._lock = threading.Lock()
        self.is_loaded = False
        self.is_loading = False
        self.load_error: str | None = None
        self.device: str | None = None

    def load(self) -> None:
        with self._lock:
            if self.is_loaded:
                return
            if self.is_loading:
                return
            self.is_loading = True
            self.load_error = None

        try:
            logger.info("Loading inpainting model (first run may download ~200MB)…")
            model = LamaInpainter()
            with self._lock:
                self._model = model
                self.device = str(model.device)
                self.is_loaded = True
                logger.info("Inpainting model ready (%s).", self.device)
        except Exception as exc:
            with self._lock:
                self.load_error = str(exc)
            logger.exception("Failed to load inpainting model")
            raise
        finally:
            with self._lock:
                self.is_loading = False

    def start_background_load(self) -> None:
        if self.is_loaded or self.is_loading:
            return
        thread = threading.Thread(target=self._background_load, daemon=True)
        thread.start()

    def _background_load(self) -> None:
        try:
            self.load()
        except Exception:
            pass

    def inpaint(self, image: Image.Image, mask: Image.Image) -> Image.Image:
        if not self.is_loaded or self._model is None:
            if self.load_error:
                raise RuntimeError(self.load_error)
            if self.is_loading:
                raise RuntimeError(
                    "AI model is still loading. First run downloads ~200MB — wait and retry."
                )
            self.load()

        original_size = image.size
        result = self._model(image, mask)

        if result.size != original_size:
            result = result.resize(original_size, Image.Resampling.LANCZOS)

        return result.convert("RGB")
