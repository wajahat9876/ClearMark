import { motion } from 'framer-motion';
import type { VoiceOption } from '../types';

interface VoiceCardProps {
  voice: VoiceOption;
  selected: boolean;
  onSelect: () => void;
}

export default function VoiceCard({ voice, selected, onSelect }: VoiceCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      animate={selected ? { scale: 1.03 } : { scale: 1 }}
      className={`
        group relative flex flex-col items-center gap-2 rounded-2xl p-4 text-center
        transition-shadow duration-300 focus:outline-none focus-visible:ring-2
        focus-visible:ring-accent
        ${selected
          ? 'voice-card-selected glass ring-2 ring-accent shadow-lg shadow-indigo-500/30'
          : 'glass hover:shadow-lg hover:shadow-indigo-500/10'
        }
      `}
    >
      {selected && (
        <motion.span
          layoutId="voice-glow"
          className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${voice.gradient} opacity-15`}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
      <span
        className={`
          relative flex h-14 w-14 items-center justify-center rounded-xl text-2xl
          bg-gradient-to-br ${voice.gradient} shadow-md
          ${selected ? 'shadow-indigo-500/40' : 'opacity-90 group-hover:opacity-100'}
        `}
      >
        {voice.icon}
      </span>
      <span className="relative font-display text-sm font-semibold text-slate-100">
        {voice.title}
      </span>
      <span className="relative text-xs text-slate-400 leading-snug">
        {voice.description}
      </span>
      {selected && (
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] text-white"
        >
          ✓
        </motion.span>
      )}
    </motion.button>
  );
}
