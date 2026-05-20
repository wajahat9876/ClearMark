"""Free local image animation — no API keys, credits, or cloud billing.

Uses depth-based 2.5D parallax (layered warping) for realistic motion from a still image.
Optional: Stable Video Diffusion when torch/diffusers are installed (open weights).
"""

from __future__ import annotations

import logging
import math
import os
from pathlib import Path

import cv2
import numpy as np

logger = logging.getLogger(__name__)


def _ease(t: float) -> float:
    return t * t * (3.0 - 2.0 * t)


def _motion_from_prompt(prompt: str) -> dict[str, float]:
    p = (prompt or "").lower()
    dx, dy, zoom = 0.0, 0.0, 1.0
    intensity = 1.0

    if any(w in p for w in ("pan left", "move left", "slide left")):
        dx = -1.0
    elif any(w in p for w in ("pan right", "move right", "slide right")):
        dx = 1.0
    elif any(w in p for w in ("up", "rise", "float up")):
        dy = -0.6
    elif any(w in p for w in ("down", "fall", "drop")):
        dy = 0.6

    if any(w in p for w in ("zoom out", "pull back", "reveal")):
        zoom = -1.0
    else:
        zoom = 1.0

    if any(w in p for w in ("subtle", "gentle", "slow", "calm")):
        intensity = 0.55
    if any(w in p for w in ("fast", "dynamic", "action", "energetic")):
        intensity = 1.35
    if any(w in p for w in ("orbit", "rotate", "spin")):
        dx = math.sin(2.0) * 0.5
        dy = math.cos(1.5) * 0.3

    breathe = any(
        w in p
        for w in ("blink", "expression", "smile", "breath", "alive", "emotion")
    )
    return {
        "dx": dx * intensity,
        "dy": dy * intensity,
        "zoom": zoom * intensity,
        "breathe": 1.0 if breathe else 0.0,
    }


def _estimate_depth(gray: np.ndarray) -> np.ndarray:
    """Pseudo-depth from luminance + edges + center bias (no ML download)."""
    h, w = gray.shape
    inv = 255.0 - gray.astype(np.float32)
    edges = cv2.Canny(gray, 40, 120).astype(np.float32)
    edges = cv2.GaussianBlur(edges, (9, 9), 0)
    y, x = np.ogrid[:h, :w]
    cy, cx = h / 2.0, w / 2.0
    dist = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    radial = 1.0 - np.clip(dist / (dist.max() + 1e-6), 0, 1)
    depth = inv * 0.5 + edges * 1.2 + radial * 55.0
    depth = cv2.GaussianBlur(depth, (31, 31), 0)
    depth -= depth.min()
    depth /= depth.max() + 1e-6
    return depth


def _build_layers(
    bgr: np.ndarray, depth: np.ndarray, layers: int = 4
) -> list[tuple[np.ndarray, np.ndarray]]:
    """Split image into depth layers with soft masks."""
    h, w = depth.shape
    result: list[tuple[np.ndarray, np.ndarray]] = []
    thresholds = np.linspace(0, 1, layers + 1)[1:]

    for i, thresh in enumerate(thresholds):
        mask = np.clip((depth - (thresh - 0.2)) / 0.25, 0, 1).astype(np.float32)
        if i < layers - 1:
            next_thresh = thresholds[i + 1] if i + 1 < len(thresholds) else 1.0
            fade = np.clip((next_thresh - depth) / 0.25, 0, 1)
            mask = np.minimum(mask, fade)
        mask = cv2.GaussianBlur(mask, (15, 15), 0)
        layer = (bgr.astype(np.float32) * mask[:, :, None]).astype(np.uint8)
        result.append((layer, mask))
    return result


def _warp_layer(
    layer: np.ndarray,
    mask: np.ndarray,
    shift_x: float,
    shift_y: float,
    scale: float,
) -> tuple[np.ndarray, np.ndarray]:
    h, w = layer.shape[:2]
    cx, cy = w / 2.0, h / 2.0
    m = cv2.getRotationMatrix2D((cx, cy), 0, scale)
    m[0, 2] += shift_x
    m[1, 2] += shift_y
    warped = cv2.warpAffine(
        layer, m, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT101
    )
    warped_mask = cv2.warpAffine(
        mask, m, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT
    )
    return warped, warped_mask


def _composite_layers(
    layers: list[tuple[np.ndarray, np.ndarray]],
) -> np.ndarray:
    h, w = layers[0][0].shape[:2]
    out = np.zeros((h, w, 3), dtype=np.float32)
    alpha_acc = np.zeros((h, w), dtype=np.float32)
    for layer, mask in layers:
        a = mask[:, :, None]
        out = out * (1 - a) + layer.astype(np.float32) * a
        alpha_acc = np.maximum(alpha_acc, mask)
    return np.clip(out, 0, 255).astype(np.uint8)


def generate_parallax_clip(
    image_path: Path,
    output_path: Path,
    *,
    prompt: str = "",
    duration_sec: float = 4.0,
    fps: int = 24,
) -> tuple[bool, str]:
    """Depth parallax animation — free, runs fully offline."""
    try:
        bgr = cv2.imread(str(image_path))
        if bgr is None:
            return False, f"Could not read image: {image_path}"

        motion = _motion_from_prompt(prompt)
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        depth = _estimate_depth(gray)
        layer_data = _build_layers(bgr, depth, layers=4)

        total_frames = max(12, int(duration_sec * fps))
        h, w = bgr.shape[:2]
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(output_path), fourcc, fps, (w, h))
        if not writer.isOpened():
            return False, "Could not open video writer"

        max_shift = min(w, h) * 0.04
        max_zoom = 0.08

        for i in range(total_frames):
            t = _ease(i / max(total_frames - 1, 1))
            breathe = 1.0 + motion["breathe"] * 0.012 * math.sin(i * 0.35)

            if motion["zoom"] > 0:
                scale = 1.0 + max_zoom * t * motion["zoom"]
            else:
                scale = 1.0 + max_zoom * (1.0 - t) * abs(motion["zoom"])
            scale *= breathe

            base_dx = motion["dx"] * max_shift * t
            base_dy = motion["dy"] * max_shift * t

            warped_layers: list[tuple[np.ndarray, np.ndarray]] = []
            for li, (layer, mask) in enumerate(layer_data):
                depth_weight = (li + 1) / len(layer_data)
                parallax = 0.35 + depth_weight * 0.65
                sx = base_dx * parallax
                sy = base_dy * parallax
                layer_scale = 1.0 + (scale - 1.0) * depth_weight
                wl, wm = _warp_layer(layer, mask, sx, sy, layer_scale)
                warped_layers.append((wl, wm))

            frame = _composite_layers(warped_layers)
            writer.write(frame)

        writer.release()
        if not output_path.exists() or output_path.stat().st_size < 500:
            return False, "Parallax export produced empty video"
        return True, ""
    except Exception as exc:
        logger.exception("Parallax animation failed")
        return False, str(exc)[:400]
