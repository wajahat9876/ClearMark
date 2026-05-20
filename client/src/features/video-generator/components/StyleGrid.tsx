import { motion } from 'framer-motion';
import { STYLE_OPTIONS } from '../constants';
import type { VideoStyleId } from '../types';

interface Props {
  value: VideoStyleId;
  onChange: (id: VideoStyleId) => void;
  disabled?: boolean;
}

export default function StyleGrid({ value, onChange, disabled }: Props) {
  return (
    <motion.div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {STYLE_OPTIONS.map((style) => (
        <button
          key={style.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(style.id as VideoStyleId)}
          className={`rounded-xl border px-3 py-3 text-left transition ${
            value === style.id
              ? 'border-cyan-400/60 bg-cyan-500/15 ring-1 ring-cyan-400/40'
              : 'border-surface-border bg-surface-elevated/50 hover:border-slate-500'
          }`}
        >
          <span className="text-xl" aria-hidden>
            {style.emoji}
          </span>
          <span className="mt-1 block text-sm font-medium text-white">
            {style.label}
          </span>
        </button>
      ))}
    </motion.div>
  );
}
