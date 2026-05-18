import { useCallback, useState } from 'react';
import { dataUrlToBlob } from '../utils/image';
import { buildMaskDataUrl, hasMaskContent } from '../utils/mask';
import { inpaintImage } from '../api/inpaint';

export function useImageEditor() {
  const [sourceUrl, setSourceUrl] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [strokes, setStrokes] = useState([]);
  const [brushSize, setBrushSize] = useState(24);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const loadImage = useCallback((dataUrl, width, height) => {
    setSourceUrl(dataUrl);
    setDimensions({ width, height });
    setResultUrl(null);
    setStrokes([]);
    setError(null);
    setProgress(0);
  }, []);

  const reset = useCallback(() => {
    setSourceUrl(null);
    setResultUrl(null);
    setDimensions({ width: 0, height: 0 });
    setStrokes([]);
    setError(null);
    setProgress(0);
  }, []);

  const clearMask = useCallback(() => {
    setStrokes([]);
    setResultUrl(null);
    setError(null);
  }, []);

  const undoStroke = useCallback(() => {
    setStrokes((prev) => prev.slice(0, -1));
    setResultUrl(null);
  }, []);

  const processImage = useCallback(async () => {
    if (!sourceUrl || !hasMaskContent(strokes)) {
      setError('Paint over the watermark or area you want to remove.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgress(5);

    try {
      const maskDataUrl = await buildMaskDataUrl(
        strokes,
        dimensions.width,
        dimensions.height,
        brushSize
      );

      const imageBlob = dataUrlToBlob(sourceUrl);
      const maskBlob = dataUrlToBlob(maskDataUrl);

      const result = await inpaintImage(imageBlob, maskBlob, setProgress);
      setResultUrl(result);
    } catch (err) {
      setError(err.message || 'Processing failed. Is the AI server running?');
    } finally {
      setIsProcessing(false);
    }
  }, [sourceUrl, strokes, dimensions, brushSize]);

  return {
    sourceUrl,
    resultUrl,
    dimensions,
    strokes,
    setStrokes,
    brushSize,
    setBrushSize,
    isProcessing,
    progress,
    error,
    loadImage,
    reset,
    clearMask,
    undoStroke,
    processImage,
    hasMask: hasMaskContent(strokes),
  };
}
