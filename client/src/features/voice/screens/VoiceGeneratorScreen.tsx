import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Mic2, Moon, Sun } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../../contexts/ThemeContext';
import { checkTTSHealth } from '../api/tts';
import AudioPlayer from '../components/AudioPlayer';
import GenerateButton from '../components/GenerateButton';
import GenerationHistory from '../components/GenerationHistory';
import LoadingVoice from '../components/LoadingVoice';
import TextInputPanel from '../components/TextInputPanel';
import ToastStack from '../components/ToastStack';
import VoiceSelector from '../components/VoiceSelector';
import VoiceSettings from '../components/VoiceSettings';
import { useToast } from '../hooks/useToast';
import { useVoiceGenerator } from '../hooks/useVoiceGenerator';

export default function VoiceGeneratorScreen() {
  const { theme, toggleTheme } = useTheme();
  const { toasts, show, dismiss } = useToast();
  const voice = useVoiceGenerator();
  const [ttsHealth, setTtsHealth] = useState<{
    configured: boolean;
    provider: string;
    free?: boolean;
  } | null>(null);

  useEffect(() => {
    checkTTSHealth()
      .then(setTtsHealth)
      .catch(() => setTtsHealth({ configured: false, provider: 'edge' }));
  }, []);

  const handleGenerate = useCallback(async () => {
    try {
      await voice.generate();
      show('success', 'Voice generated — now playing preview');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed';
      show('error', message);
    }
  }, [voice, show]);

  const handleCopy = useCallback(async () => {
    try {
      await voice.copyText();
      show('info', 'Text copied to clipboard');
    } catch {
      show('error', 'Could not copy text');
    }
  }, [voice, show]);

  const handleDownload = useCallback(() => {
    voice.download();
    show('success', 'Download started');
  }, [voice, show]);

  const handleReplay = useCallback(async () => {
    try {
      await voice.generate();
      show('success', 'Regenerated from history');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Replay failed';
      show('error', message);
    }
  }, [voice, show]);

  return (
    <motion.div
      className="voice-page min-h-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="voice-ambient pointer-events-none fixed inset-0" aria-hidden />

      <header className="sticky top-0 z-40 border-b border-surface-border/60 glass">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to ClearMark
          </Link>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 font-display text-lg font-bold"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
              <Mic2 className="h-4 w-4 text-white" />
            </span>
            AI Voice Generator
          </motion.div>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-xl glass p-2.5 text-slate-300 transition hover:text-white"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center"
        >
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Premium AI text-to-speech
          </p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
            Turn text into{' '}
            <span className="gradient-text">lifelike voice</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-400">
            Type your script, pick a voice personality, fine-tune emotion and delivery,
            then generate studio-quality speech in seconds.
          </p>
        </motion.div>

        {ttsHealth?.free && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-200">
            Using <strong>free voices</strong> (Edge TTS or Google fallback) — no API key required.
            {ttsHealth.provider === 'gtts' && (
              <span className="mt-1 block text-emerald-300/90">
                Google fallback active. For best quality:{' '}
                <code className="rounded bg-black/30 px-1.5 py-0.5">
                  pip install -U &apos;edge-tts&gt;=7.2.7&apos;
                </code>
              </span>
            )}
          </div>
        )}
        {ttsHealth && !ttsHealth.configured && (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-200">
            Voice server unavailable — start the backend and run{' '}
            <code className="rounded bg-black/30 px-1.5 py-0.5">pip install -r requirements.txt</code>
          </div>
        )}

        {voice.error && (
          <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-200">
            {voice.error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
            <TextInputPanel
              text={voice.text}
              onChange={voice.setText}
              charCount={voice.charCount}
              maxLength={voice.maxLength}
              progressPercent={voice.progressPercent}
              isOverLimit={voice.isOverLimit}
              onCopy={handleCopy}
            />
            <VoiceSelector
              selectedVoice={voice.selectedVoice}
              onSelect={voice.setSelectedVoice}
            />
            <GenerateButton
              onGenerate={handleGenerate}
              onRetry={handleGenerate}
              disabled={!voice.canGenerate || ttsHealth?.configured === false}
              isGenerating={voice.isGenerating}
              hasError={Boolean(voice.error)}
            />
          </div>

          <div className="space-y-6 lg:col-span-2">
            <VoiceSettings settings={voice.settings} onChange={voice.updateSettings} />
            <AudioPlayer
              audioUrl={voice.audioUrl}
              onDownload={handleDownload}
              canDownload={Boolean(voice.audioBlob)}
            />
          </div>
        </div>

        <div className="mt-8">
          <GenerationHistory
            history={voice.history}
            onReplay={voice.replayFromHistory}
            onRegenerate={handleReplay}
          />
        </div>
      </main>

      <AnimatePresence>
        {voice.isGenerating && <LoadingVoice />}
      </AnimatePresence>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </motion.div>
  );
}
