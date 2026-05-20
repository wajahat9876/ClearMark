import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Film, Moon, Sun } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProgressBar from '../../../components/ui/ProgressBar';
import { useTheme } from '../../../contexts/ThemeContext';
import { checkVideoHealth } from '../api/video';
import EnhanceButton from '../components/EnhanceButton';
import ResolutionSelector from '../components/ResolutionSelector';
import VideoPreviewCompare from '../components/VideoPreviewCompare';
import VideoUploadZone from '../components/VideoUploadZone';
import { useVideoEnhancer } from '../hooks/useVideoEnhancer';
import type { VideoHealthResponse } from '../types';

export default function VideoEnhanceScreen() {
  const { theme, toggleTheme } = useTheme();
  const video = useVideoEnhancer();
  const [health, setHealth] = useState<VideoHealthResponse | null>(null);

  useEffect(() => {
    checkVideoHealth()
      .then(setHealth)
      .catch(() =>
        setHealth({
          status: 'error',
          ffmpeg: false,
          unreachable: true,
        })
      );
  }, []);

  const handleEnhance = useCallback(async () => {
    await video.enhance();
  }, [video]);

  const serverReady =
    health?.ffmpeg === true && health?.ffprobe !== false;
  const apiUnreachable = health?.unreachable === true;
  const ffmpegMissing = health && !apiUnreachable && !serverReady;

  return (
    <motion.div
      className="video-page min-h-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="video-ambient pointer-events-none fixed inset-0" aria-hidden />

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
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-lg shadow-violet-500/30">
              <Film className="h-4 w-4 text-white" />
            </span>
            Video Enhancement
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
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            AI video upscaling for creators
          </p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
            Upscale to{' '}
            <span className="gradient-text">2K &amp; 4K</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-400">
            Enhance clarity, reduce noise, and export YouTube-ready MP4 — no watermarks,
            original aspect ratio and frame rate preserved.
          </p>
        </motion.div>

        {apiUnreachable && (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-200">
            Cannot reach the API server. Start it with{' '}
            <code className="rounded bg-black/30 px-1.5 py-0.5">npm run server</code>
            , then restart the Vite dev server if you changed{' '}
            <code className="rounded bg-black/30 px-1.5 py-0.5">.env</code>.
          </div>
        )}

        {ffmpegMissing && (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-200">
            FFmpeg was not found by the Python API (even if installed in your terminal).
            Install with{' '}
            <code className="rounded bg-black/30 px-1.5 py-0.5">brew install ffmpeg</code>
            , then restart the API. If it is already installed, add to{' '}
            <code className="rounded bg-black/30 px-1.5 py-0.5">server/.env</code>:{' '}
            <code className="mt-2 block rounded bg-black/30 px-1.5 py-0.5">
              FFMPEG_PATH=/usr/local/bin/ffmpeg
            </code>
            <code className="mt-1 block rounded bg-black/30 px-1.5 py-0.5">
              FFPROBE_PATH=/usr/local/bin/ffprobe
            </code>
            (Apple Silicon: use <code className="rounded bg-black/30 px-1">/opt/homebrew/bin/</code>
            ).
          </div>
        )}

        {serverReady && health?.enhance_mode === 'fast' && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-200">
            Fast enhancement enabled — single-pass processing for quick exports.
          </div>
        )}

        {health?.enhance_mode === 'ai' && health.realesrgan && (
          <div className="mb-6 rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-center text-sm text-violet-200">
            AI mode (Real-ESRGAN) — higher quality but slower; GPU recommended
            {health.gpu && ` (${health.device})`}.
          </div>
        )}

        {video.error && (
          <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-200">
            {video.error}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-2">
            <VideoUploadZone
              file={video.file}
              onFileSelect={video.loadFile}
              onClear={video.clearFile}
              disabled={video.isEnhancing}
            />
            <ResolutionSelector
              value={video.resolution}
              onChange={video.setResolution}
              disabled={video.isEnhancing}
            />
            <EnhanceButton
              onEnhance={handleEnhance}
              disabled={!video.canEnhance || !serverReady}
              isEnhancing={video.isEnhancing}
            />
            {video.isEnhancing && (
              <ProgressBar
                value={video.progress}
                label={video.statusMessage || 'Enhancing video…'}
              />
            )}
          </div>

          <div className="lg:col-span-3">
            <VideoPreviewCompare
              originalUrl={video.originalUrl}
              enhancedUrl={video.enhancedUrl}
              onDownload={video.download}
              canDownload={video.canDownload}
            />
          </div>
        </div>
      </main>

      <AnimatePresence>
        {video.isEnhancing && video.progress < 15 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <div className="rounded-2xl glass px-8 py-6 text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
              <p className="text-sm text-slate-300">Uploading &amp; starting enhancement…</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
