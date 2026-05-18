import { loadImage } from './image';

/**
 * Build a binary mask PNG (white = remove, black = keep) at full image resolution.
 */
export async function buildMaskDataUrl(strokes, width, height, brushSize) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = brushSize;

  strokes.forEach((stroke) => {
    if (!stroke.points || stroke.points.length < 2) return;
    ctx.save();
    ctx.lineWidth = stroke.brushSize ?? brushSize;
    if (stroke.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#ffffff';
    }
    ctx.beginPath();
    ctx.moveTo(stroke.points[0], stroke.points[1]);
    for (let i = 2; i < stroke.points.length; i += 2) {
      ctx.lineTo(stroke.points[i], stroke.points[i + 1]);
    }
    ctx.stroke();
    ctx.restore();
  });

  return canvas.toDataURL('image/png');
}

export function hasMaskContent(strokes) {
  return strokes.some((s) => s.points && s.points.length >= 4);
}
