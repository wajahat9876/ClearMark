import { useCallback, useEffect, useRef, useState } from 'react';
import {
  downloadBlob,
  downloadEnhancedVideo,
  getVideoJobStatus,
  submitVideoEnhance,
} from '../api/video';
import { POLL_INTERVAL_MS } from '../constants';
import type { VideoResolution } from '../types';
import {
  createVideoObjectUrl,
  revokeVideoObjectUrl,
  validateVideoFile,
} from '../utils/video';

export function useVideoEnhancer() {
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null);
  const [resolution, setResolution] = useState<VideoResolution>('2k');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const enhancedBlobRef = useRef<Blob | null>(null);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const resetEnhanced = useCallback(() => {
    revokeVideoObjectUrl(enhancedUrl);
    setEnhancedUrl(null);
    enhancedBlobRef.current = null;
    setJobId(null);
    setProgress(0);
    setStatusMessage('');
  }, [enhancedUrl]);

  const loadFile = useCallback(
    (next: File) => {
      const validationError = validateVideoFile(next);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError(null);
      resetEnhanced();
      revokeVideoObjectUrl(originalUrl);
      setFile(next);
      setOriginalUrl(createVideoObjectUrl(next));
    },
    [originalUrl, resetEnhanced]
  );

  const clearFile = useCallback(() => {
    clearPoll();
    resetEnhanced();
    revokeVideoObjectUrl(originalUrl);
    setFile(null);
    setOriginalUrl(null);
    setError(null);
    setIsEnhancing(false);
  }, [clearPoll, originalUrl, resetEnhanced]);

  useEffect(() => {
    return () => {
      clearPoll();
      revokeVideoObjectUrl(originalUrl);
      revokeVideoObjectUrl(enhancedUrl);
    };
  }, [clearPoll, originalUrl, enhancedUrl]);

  const pollJob = useCallback(
    (id: string) => {
      clearPoll();
      pollRef.current = setInterval(async () => {
        try {
          const status = await getVideoJobStatus(id);
          setProgress(status.progress);
          setStatusMessage(status.message);

          if (status.status === 'completed') {
            clearPoll();
            setStatusMessage('Preparing download…');
            const blob = await downloadEnhancedVideo(id);
            enhancedBlobRef.current = blob;
            revokeVideoObjectUrl(enhancedUrl);
            setEnhancedUrl(URL.createObjectURL(blob));
            setProgress(100);
            setStatusMessage('Enhancement complete');
            setIsEnhancing(false);
          } else if (status.status === 'failed') {
            clearPoll();
            setError(status.error || 'Enhancement failed.');
            setIsEnhancing(false);
          }
        } catch (err) {
          clearPoll();
          setError(err instanceof Error ? err.message : 'Status check failed.');
          setIsEnhancing(false);
        }
      }, POLL_INTERVAL_MS);
    },
    [clearPoll, enhancedUrl]
  );

  const enhance = useCallback(async () => {
    if (!file) return;
    setError(null);
    resetEnhanced();
    setIsEnhancing(true);
    setProgress(0);
    setStatusMessage('Uploading video…');

    try {
      const job = await submitVideoEnhance(file, resolution);
      setJobId(job.jobId);
      setProgress(job.progress);
      setStatusMessage(job.message);
      pollJob(job.jobId);
    } catch (err) {
      setIsEnhancing(false);
      setError(err instanceof Error ? err.message : 'Enhancement failed.');
    }
  }, [file, pollJob, resolution, resetEnhanced]);

  const download = useCallback(() => {
    const blob = enhancedBlobRef.current;
    if (!blob || !file) return;
    const base = file.name.replace(/\.[^.]+$/, '');
    downloadBlob(blob, `${base}_enhanced_${resolution}.mp4`);
  }, [file, resolution]);

  return {
    file,
    originalUrl,
    enhancedUrl,
    resolution,
    setResolution,
    loadFile,
    clearFile,
    enhance,
    download,
    isEnhancing,
    progress,
    statusMessage,
    error,
    jobId,
    canEnhance: Boolean(file) && !isEnhancing,
    canDownload: Boolean(enhancedUrl) && !isEnhancing,
  };
}
