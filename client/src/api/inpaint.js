const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function inpaintImage(imageBlob, maskBlob, onProgress) {
  const formData = new FormData();
  formData.append('image', imageBlob, 'image.png');
  formData.append('mask', maskBlob, 'mask.png');

  onProgress?.(10);

  const response = await fetch(`${API_BASE}/inpaint`, {
    method: 'POST',
    body: formData,
  });

  onProgress?.(70);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const detail = err.detail;
    const message = Array.isArray(detail)
      ? detail.map((d) => d.msg || d).join(', ')
      : detail || `Inpainting failed (${response.status})`;
    throw new Error(message);
  }

  onProgress?.(90);

  const blob = await response.blob();
  onProgress?.(100);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) {
      return { online: false, modelLoaded: false, modelLoading: false, loadError: null };
    }
    const data = await res.json();
    return {
      online: data.status === 'ok' || data.status === 'starting',
      modelLoaded: Boolean(data.model_loaded),
      modelLoading: Boolean(data.model_loading),
      loadError: data.load_error || null,
    };
  } catch {
    return { online: false, modelLoaded: false, modelLoading: false, loadError: null };
  }
}
