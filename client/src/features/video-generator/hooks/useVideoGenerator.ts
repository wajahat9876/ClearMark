import { useCallback, useEffect, useRef, useState } from 'react';
import {
  downloadBlob,
  downloadVideoGenOutput,
  getVideoGenJobStatus,
  submitVideoGeneration,
} from '../api/videoGen';
import { DEFAULT_SETTINGS, POLL_INTERVAL_MS } from '../constants';
import type { UploadedImage, VideoGenSettings } from '../types';
import { createImageId, validateImageFile } from '../utils/images';

export function useVideoGenerator() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [settings, setSettings] = useState<VideoGenSettings>(DEFAULT_SETTINGS);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoBlobRef = useRef<Blob | null>(null);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const resetOutput = useCallback(() => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    videoBlobRef.current = null;
    setJobId(null);
    setProgress(0);
    setStatusMessage('');
  }, [videoUrl]);

  const addImages = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      const next: UploadedImage[] = [];
      for (const file of list) {
        const err = validateImageFile(file);
        if (err) {
          setError(err);
          continue;
        }
        next.push({
          id: createImageId(),
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }
      if (next.length) {
        setError(null);
        resetOutput();
        setImages((prev) => [...prev, ...next].slice(0, 12));
      }
    },
    [resetOutput]
  );

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
    resetOutput();
  }, [resetOutput]);

  const clearImages = useCallback(() => {
    images.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    setImages([]);
    resetOutput();
    setError(null);
    clearPoll();
    setIsGenerating(false);
  }, [images, clearPoll, resetOutput]);

  const updateSettings = useCallback(
    <K extends keyof VideoGenSettings>(key: K, value: VideoGenSettings[K]) => {
      setSettings((s) => ({ ...s, [key]: value }));
      resetOutput();
    },
    [resetOutput]
  );

  useEffect(() => {
    return () => {
      clearPoll();
      images.forEach((i) => URL.revokeObjectURL(i.previewUrl));
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [clearPoll, images, videoUrl]);

  const pollJob = useCallback(
    (id: string) => {
      clearPoll();
      pollRef.current = setInterval(async () => {
        try {
          const status = await getVideoGenJobStatus(id);
          setProgress(status.progress);
          setStatusMessage(status.message);

          if (status.status === 'completed') {
            clearPoll();
            setStatusMessage('Preparing preview…');
            const blob = await downloadVideoGenOutput(id);
            videoBlobRef.current = blob;
            if (videoUrl) URL.revokeObjectURL(videoUrl);
            setVideoUrl(URL.createObjectURL(blob));
            setProgress(100);
            setStatusMessage('Video ready — no watermark');
            setIsGenerating(false);
          } else if (status.status === 'failed') {
            clearPoll();
            setError(status.error || 'Generation failed.');
            setIsGenerating(false);
          }
        } catch (err) {
          clearPoll();
          setError(err instanceof Error ? err.message : 'Status check failed.');
          setIsGenerating(false);
        }
      }, POLL_INTERVAL_MS);
    },
    [clearPoll, videoUrl]
  );

  const generate = useCallback(async () => {
    if (!images.length) return;
    if (!settings.prompt.trim()) {
      setError('Describe how you want your images animated.');
      return;
    }
    setError(null);
    resetOutput();
    setIsGenerating(true);
    setProgress(0);
    setStatusMessage('Uploading images…');

    try {
      const job = await submitVideoGeneration(
        images.map((i) => i.file),
        settings
      );
      setJobId(job.jobId);
      setProgress(job.progress);
      setStatusMessage(job.message);
      pollJob(job.jobId);
    } catch (err) {
      setIsGenerating(false);
      setError(err instanceof Error ? err.message : 'Generation failed.');
    }
  }, [images, pollJob, resetOutput, settings]);

  const download = useCallback(() => {
    const blob = videoBlobRef.current;
    if (!blob) return;
    const ar = settings.aspectRatio.replace(':', 'x');
    downloadBlob(blob, `clearmark_${settings.style}_${ar}.mp4`);
  }, [settings.aspectRatio, settings.style]);

  return {
    images,
    settings,
    updateSettings,
    addImages,
    removeImage,
    clearImages,
    videoUrl,
    generate,
    download,
    isGenerating,
    progress,
    statusMessage,
    error,
    jobId,
    canGenerate:
      images.length > 0 && settings.prompt.trim().length > 0 && !isGenerating,
    canDownload: Boolean(videoUrl) && !isGenerating,
  };
}
