import { motion } from 'framer-motion';
import { Download, Pause, Play, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface AudioPlayerProps {
  audioUrl: string | null;
  onDownload: () => void;
  canDownload: boolean;
}

export default function AudioPlayer({
  audioUrl,
  onDownload,
  canDownload,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
    if (audioUrl && audioRef.current) {
      audioRef.current.load();
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [audioUrl]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el || !audioUrl) return;
    if (el.paused) {
      el.play();
      setIsPlaying(true);
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const formatTime = (s: number) => {
    if (!Number.isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!audioUrl) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass voice-panel flex min-h-[140px] flex-col items-center justify-center rounded-3xl p-6 text-center"
      >
        <Volume2 className="mb-2 h-8 w-8 text-slate-600" />
        <p className="text-sm text-slate-500">
          Generated audio will appear here and play automatically
        </p>
      </motion.div>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass voice-panel rounded-3xl p-5 sm:p-6"
    >
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={() => {
          const el = audioRef.current;
          if (!el) return;
          setProgress(el.currentTime);
          setDuration(el.duration || 0);
        }}
        onEnded={() => setIsPlaying(false)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
      />
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
          <Volume2 className="h-4 w-4" />
        </span>
        <div>
          <h3 className="font-display font-semibold">Voice preview</h3>
          <p className="text-xs text-slate-400">Ready to play or download</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={togglePlay}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/40"
        >
          {isPlaying ? (
            <Pause className="h-6 w-6" />
          ) : (
            <Play className="h-6 w-6 translate-x-0.5" />
          )}
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 space-y-1"
        >
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={progress}
            onChange={(e) => {
              const t = Number(e.target.value);
              if (audioRef.current) audioRef.current.currentTime = t;
              setProgress(t);
            }}
            className="voice-range w-full"
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </motion.div>

        <motion.button
          type="button"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onDownload}
          disabled={!canDownload}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:bg-accent-hover disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Download MP3</span>
        </motion.button>
      </div>
    </motion.section>
  );
}
