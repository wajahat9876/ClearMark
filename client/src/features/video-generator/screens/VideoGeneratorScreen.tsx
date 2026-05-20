import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Clapperboard,
  Moon,
  Sparkles,
  Sun,
  Wand2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProgressBar from '../../../components/ui/ProgressBar';
import { useTheme } from '../../../contexts/ThemeContext';
import { checkVideoGenHealth } from '../api/videoGen';
import ImageUploadZone from '../components/ImageUploadZone';
import StyleGrid from '../components/StyleGrid';
import VideoGenPreview from '../components/VideoGenPreview';
import VideoGenSettingsPanel from '../components/VideoGenSettingsPanel';
import { useVideoGenerator } from '../hooks/useVideoGenerator';
import type { VideoGenHealthResponse } from '../types';

export default function VideoGeneratorScreen() {
  const { theme, toggleTheme } = useTheme();
  const gen = useVideoGenerator();
  const [health, setHealth] = useState<VideoGenHealthResponse | null>(null);

  useEffect(() => {
    checkVideoGenHealth()
      .then(setHealth)
      .catch(() =>
        setHealth({
          status: 'error',
          ffmpeg: false,
          unreachable: true,
        })
      );
  }, []);

  const serverReady = health?.ffmpeg === true;
  const apiUnreachable = health?.unreachable === true;
  const aiLabel = health?.aiMode || 'checking…';
  const aiReady = health?.aiConfigured === true;

  return (
    <motion.div
      className="vgen-page min-h-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div className="vgen-ambient pointer-events-none fixed inset-0" aria-hidden />

      <header className="sticky top-0 z-40 border-b border-surface-border/60 glass">
        <motion.div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to ClearMark
          </Link>
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 shadow-lg shadow-cyan-500/30">
              <Clapperboard className="h-4 w-4 text-white" />
            </span>
            AI Video Generator
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-xl glass p-2.5 text-slate-300 transition hover:text-white"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </motion.div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center"
        >
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-medium text-cyan-300">
            <Sparkles className="h-3.5 w-3.5" />
            Free local AI animation · No credits · No watermark
          </span>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Animate your images with AI
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-slate-400">
            Upload your photos, describe the motion and mood, and export short-form
            videos for YouTube Shorts, TikTok, and Reels. You own your uploads and prompts.
          </p>
        </motion.div>

        <AnimatePresence>
          {apiUnreachable && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
            >
              Cannot reach the API. Run <code className="text-rose-100">npm run server</code>{' '}
              on port 8000.
            </motion.div>
          )}
          {health && !apiUnreachable && !serverReady && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
            >
              FFmpeg is required. Install with{' '}
              <code className="text-amber-50">brew install ffmpeg</code>
            </motion.div>
          )}
          {health && serverReady && aiReady && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
            >
              AI engine: {aiLabel}
              {health.gpu ? ' · GPU available' : ''}
              {' · '}No watermark on export
            </motion.div>
          )}
          {health && serverReady && !aiReady && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
            >
              Animation engine not ready — ensure FFmpeg and opencv are installed, then
              restart the server.
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid gap-8 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
            <section className="glass rounded-2xl p-5 sm:p-6">
              <h2 className="mb-4 font-display text-lg font-semibold text-white">
                Your images
              </h2>
              <ImageUploadZone
                images={gen.images}
                onAdd={gen.addImages}
                onRemove={gen.removeImage}
                disabled={gen.isGenerating}
              />
            </section>

            <section className="glass rounded-2xl p-5 sm:p-6">
              <h2 className="mb-4 font-display text-lg font-semibold text-white">
                Video style
              </h2>
              <StyleGrid
                value={gen.settings.style}
                onChange={(id) => gen.updateSettings('style', id)}
                disabled={gen.isGenerating}
              />
            </section>

            <section className="glass rounded-2xl p-5 sm:p-6">
              <h2 className="mb-4 font-display text-lg font-semibold text-white">
                Story & settings
              </h2>
              <VideoGenSettingsPanel
                settings={gen.settings}
                onChange={gen.updateSettings}
                disabled={gen.isGenerating}
              />
            </section>

            {gen.error && (
              <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {gen.error}
              </p>
            )}

            <button
              type="button"
              disabled={
                !gen.canGenerate ||
                !serverReady ||
                (health != null && !aiReady && !health.motionFallback)
              }
              onClick={() => gen.generate()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 py-4 font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:brightness-110 disabled:opacity-50"
            >
              <Wand2 className="h-5 w-5" />
              {gen.isGenerating ? 'Generating…' : 'Generate AI Video'}
            </button>

            {gen.isGenerating && (
              <div className="space-y-2">
                <ProgressBar value={gen.progress} />
                <p className="text-center text-sm text-slate-400">{gen.statusMessage}</p>
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <VideoGenPreview
              videoUrl={gen.videoUrl}
              onDownload={gen.download}
              canDownload={gen.canDownload}
            />

            <ul className="mt-6 space-y-2 text-sm text-slate-500">
              <li>· Free 2.5D depth parallax — runs fully on your machine</li>
              <li>· Prompt-guided camera motion · multi-image stories</li>
              <li>· HD–4K export · 16:9, 9:16, 1:1</li>
              <li>· No API keys, credits, or watermark</li>
            </ul>
          </div>
        </div>
      </main>
    </motion.div>
  );
}
