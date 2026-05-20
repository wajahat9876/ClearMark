import { useCallback, useRef, useState } from 'react';

export function useAudioRecorder(onWaveform?: (levels: number[]) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const pausedTotalRef = useRef(0);
  const pauseStartedRef = useRef(0);

  const stopVisualizer = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  const runVisualizer = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser || !onWaveform) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const step = Math.floor(data.length / 32);
      const levels: number[] = [];
      for (let i = 0; i < 32; i++) {
        levels.push(data[i * step] / 255);
      }
      onWaveform(levels);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, [onWaveform]);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    streamRef.current = stream;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start(200);
    mediaRecorderRef.current = recorder;
    startTimeRef.current = Date.now();
    pausedTotalRef.current = 0;
    setIsRecording(true);
    setIsPaused(false);
    setDuration(0);
    runVisualizer();
  }, [runVisualizer]);

  const pause = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec?.state === 'recording') {
      rec.pause();
      pauseStartedRef.current = Date.now();
      setIsPaused(true);
      stopVisualizer();
    }
  }, [stopVisualizer]);

  const resume = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec?.state === 'paused') {
      rec.resume();
      pausedTotalRef.current += Date.now() - pauseStartedRef.current;
      setIsPaused(false);
      runVisualizer();
    }
  }, [runVisualizer]);

  const stop = useCallback(async (): Promise<Blob | null> => {
    stopVisualizer();
    const rec = mediaRecorderRef.current;
    const stream = streamRef.current;
    const ctx = audioCtxRef.current;

    if (!rec) return null;

    return new Promise((resolve) => {
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || 'audio/webm',
        });
        stream?.getTracks().forEach((t) => t.stop());
        ctx?.close();
        mediaRecorderRef.current = null;
        streamRef.current = null;
        audioCtxRef.current = null;
        analyserRef.current = null;
        setIsRecording(false);
        setIsPaused(false);
        resolve(blob);
      };
      if (rec.state !== 'inactive') rec.stop();
    });
  }, [stopVisualizer]);

  const tickDuration = useCallback(() => {
    if (!isRecording || isPaused) return;
    const elapsed =
      (Date.now() - startTimeRef.current - pausedTotalRef.current) / 1000;
    setDuration(elapsed);
  }, [isRecording, isPaused]);

  return {
    isRecording,
    isPaused,
    duration,
    start,
    pause,
    resume,
    stop,
    tickDuration,
  };
}
