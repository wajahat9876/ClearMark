import { useCallback, useEffect, useRef, useState } from 'react';
import {
  downloadBlob,
  downloadStudioOutput,
  formatForExtension,
  getStudioJobStatus,
  submitStudioProcess,
} from '../api/studio';
import { DEFAULT_SETTINGS, POLL_INTERVAL_MS } from '../constants';
import type { PresetItem, StudioSettings } from '../types';

export function useVoiceStudio() {
  const [sourceBlob, setSourceBlob] = useState<Blob | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState('recording.webm');
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [voicePresets, setVoicePresets] = useState<PresetItem[]>([]);
  const [emotionEffects, setEmotionEffects] = useState<PresetItem[]>([]);
  const [songStyles, setSongStyles] = useState<PresetItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const outputBlobRef = useRef<Blob | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const setAudio = useCallback(
    (blob: Blob, name: string) => {
      setError(null);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(null);
      outputBlobRef.current = null;
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      setSourceBlob(blob);
      setSourceName(name);
      setSourceUrl(URL.createObjectURL(blob));
    },
    [outputUrl, sourceUrl]
  );

  const clearAudio = useCallback(() => {
    clearPoll();
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setSourceBlob(null);
    setSourceUrl(null);
    setOutputUrl(null);
    outputBlobRef.current = null;
    setError(null);
    setIsProcessing(false);
  }, [clearPoll, outputUrl, sourceUrl]);

  useEffect(() => {
    return () => {
      clearPoll();
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
    };
  }, [clearPoll, sourceUrl, outputUrl]);

  const updateSettings = useCallback((patch: Partial<StudioSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const toggleEffect = useCallback((id: string) => {
    setSettings((s) => {
      const has = s.effects.includes(id);
      return {
        ...s,
        effects: has ? s.effects.filter((e) => e !== id) : [...s.effects, id],
      };
    });
  }, []);

  const pollJob = useCallback(
    (jobId: string) => {
      clearPoll();
      pollRef.current = setInterval(async () => {
        try {
          const st = await getStudioJobStatus(jobId);
          setProgress(st.progress);
          setStatusMessage(st.message);
          if (st.status === 'completed') {
            clearPoll();
            const blob = await downloadStudioOutput(jobId);
            outputBlobRef.current = blob;
            setOutputUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return URL.createObjectURL(blob);
            });
            setProgress(100);
            setStatusMessage('Done!');
            setIsProcessing(false);
          } else if (st.status === 'failed') {
            clearPoll();
            setError(st.error || 'Processing failed');
            setIsProcessing(false);
          }
        } catch (e) {
          clearPoll();
          setError(e instanceof Error ? e.message : 'Status check failed');
          setIsProcessing(false);
        }
      }, POLL_INTERVAL_MS);
    },
    [clearPoll]
  );

  const process = useCallback(async () => {
    const lyricsReady =
      settings.inputMode === 'lyrics' && settings.lyricsText.trim().length >= 2;
    const audioReady = Boolean(sourceBlob);
    if (!lyricsReady && !audioReady) return;

    setError(null);
    setIsProcessing(true);
    setProgress(0);
    setStatusMessage('Uploading…');
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setOutputUrl(null);

    try {
      const job = await submitStudioProcess(
        settings,
        lyricsReady ? null : sourceBlob,
        sourceName,
        backgroundFile
      );
      setProgress(job.progress);
      setStatusMessage(job.message);
      pollJob(job.jobId);
    } catch (e) {
      setIsProcessing(false);
      setError(e instanceof Error ? e.message : 'Processing failed');
    }
  }, [backgroundFile, outputUrl, pollJob, settings, sourceBlob, sourceName]);

  const hasInput =
    settings.inputMode === 'lyrics'
      ? settings.lyricsText.trim().length >= 2
      : Boolean(sourceBlob);

  const download = useCallback(() => {
    const blob = outputBlobRef.current;
    if (!blob) return;
    const ext = formatForExtension(settings.format);
    downloadBlob(blob, `voice_studio.${ext}`);
  }, [settings.format]);

  return {
    sourceBlob,
    sourceUrl,
    outputUrl,
    settings,
    updateSettings,
    toggleEffect,
    setAudio,
    clearAudio,
    backgroundFile,
    setBackgroundFile,
    voicePresets,
    setVoicePresets,
    emotionEffects,
    setEmotionEffects,
    songStyles,
    setSongStyles,
    process,
    download,
    isProcessing,
    progress,
    statusMessage,
    error,
    canProcess: hasInput && !isProcessing,
    canDownload: Boolean(outputUrl) && !isProcessing,
  };
}
