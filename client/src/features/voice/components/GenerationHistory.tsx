import { motion } from 'framer-motion';
import { Clock, RotateCcw } from 'lucide-react';
import { VOICE_OPTIONS } from '../constants';
import type { GenerationRecord } from '../types';

interface GenerationHistoryProps {
  history: GenerationRecord[];
  onReplay: (record: GenerationRecord) => void;
  onRegenerate: () => void;
}

export default function GenerationHistory({
  history,
  onReplay,
  onRegenerate,
}: GenerationHistoryProps) {
  if (history.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass voice-panel rounded-3xl p-5 sm:p-6"
    >
      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-4 w-4 text-slate-400" />
        <h2 className="font-display text-lg font-bold">Generation history</h2>
      </div>
      <ul className="space-y-2">
        {history.map((record) => {
          const voice = VOICE_OPTIONS.find((v) => v.id === record.voiceId);
          return (
            <li
              key={record.id}
              className="flex flex-col gap-2 rounded-xl border border-surface-border/50 bg-black/15 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-200">{record.text}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {voice?.icon} {voice?.title} ·{' '}
                  {new Date(record.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onReplay(record);
                  onRegenerate();
                }}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg glass px-3 py-2 text-xs font-medium text-slate-300 transition hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Replay
              </button>
            </li>
          );
        })}
      </ul>
    </motion.section>
  );
}
