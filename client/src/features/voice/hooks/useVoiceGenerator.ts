import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  blobToObjectUrl,
  downloadBlob,
  generateSpeech,
} from '../api/tts';
import { startAmbientPad, stopAmbientPad } from '../utils/ambientAudio';
import { DEFAULT_SETTINGS, HISTORY_STORAGE_KEY, MAX_TEXT_LENGTH } from '../constants';
import type {
  GenerationRecord,
  VoiceGenerationSettings,
  VoiceId,
} from '../types';

function loadHistory(): GenerationRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GenerationRecord[];
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

function persistHistory(records: GenerationRecord[]) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(records.slice(0, 20)));
}

export function useVoiceGenerator() {
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceId>('woman');
  const [settings, setSettings] = useState<VoiceGenerationSettings>(DEFAULT_SETTINGS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [history, setHistory] = useState<GenerationRecord[]>(loadHistory);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const charCount = text.length;
  const isOverLimit = charCount > MAX_TEXT_LENGTH;
  const canGenerate = text.trim().length > 0 && !isOverLimit && !isGenerating;

  const updateSettings = useCallback(
    <K extends keyof VoiceGenerationSettings>(
      key: K,
      value: VoiceGenerationSettings[K]
    ) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const revokeAudioUrl = useCallback((url: string | null) => {
    if (url) URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    return () => {
      revokeAudioUrl(audioUrl);
      stopAmbientPad();
    };
  }, [audioUrl, revokeAudioUrl]);

  const playWithOptionalBgm = useCallback(
    (url: string, withBgm: boolean) => {
      if (!audioRef.current) {
        audioRef.current = new Audio(url);
      } else {
        audioRef.current.pause();
        audioRef.current.src = url;
      }
      audioRef.current.play().catch(() => {});

      if (withBgm) {
        startAmbientPad();
        audioRef.current.onended = () => stopAmbientPad();
      } else {
        stopAmbientPad();
      }
    },
    []
  );

  const generate = useCallback(async () => {
    if (!canGenerate) return;

    setIsGenerating(true);
    setError(null);

    try {
      const blob = await generateSpeech({
        text: text.trim(),
        voiceId: selectedVoice,
        speed: settings.speed,
        pitch: settings.pitch,
        emotion: settings.emotion,
        language: settings.language,
        aiEnhancement: settings.aiEnhancement,
      });

      const url = blobToObjectUrl(blob);
      revokeAudioUrl(audioUrl);
      setAudioUrl(url);
      setAudioBlob(blob);
      playWithOptionalBgm(url, settings.backgroundMusic);

      const record: GenerationRecord = {
        id: crypto.randomUUID(),
        text: text.trim(),
        voiceId: selectedVoice,
        audioUrl: url,
        createdAt: Date.now(),
        settings: { ...settings },
      };

      setHistory((prev) => {
        const next = [record, ...prev].slice(0, 20);
        persistHistory(
          next.map((r) => ({
            ...r,
            audioUrl: '',
          }))
        );
        return next;
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Voice generation failed. Please try again.';
      setError(message);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, [
    canGenerate,
    text,
    selectedVoice,
    settings,
    audioUrl,
    revokeAudioUrl,
    playWithOptionalBgm,
  ]);

  const retry = useCallback(() => generate(), [generate]);

  const download = useCallback(() => {
    if (!audioBlob) return;
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadBlob(audioBlob, `clearmark-voice-${stamp}.mp3`);
  }, [audioBlob]);

  const copyText = useCallback(async () => {
    await navigator.clipboard.writeText(text);
  }, [text]);

  const replayFromHistory = useCallback((record: GenerationRecord) => {
    setText(record.text);
    setSelectedVoice(record.voiceId);
    setSettings(record.settings);
  }, []);

  const progressPercent = useMemo(
    () => Math.min(100, (charCount / MAX_TEXT_LENGTH) * 100),
    [charCount]
  );

  return {
    text,
    setText,
    selectedVoice,
    setSelectedVoice,
    settings,
    updateSettings,
    isGenerating,
    error,
    setError,
    audioUrl,
    audioBlob,
    history,
    charCount,
    isOverLimit,
    canGenerate,
    maxLength: MAX_TEXT_LENGTH,
    progressPercent,
    generate,
    retry,
    download,
    copyText,
    replayFromHistory,
    audioRef,
  };
}
