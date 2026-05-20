import { motion } from 'framer-motion';

interface WaveformVisualizerProps {
  levels: number[];
  active?: boolean;
  className?: string;
}

export default function WaveformVisualizer({
  levels,
  active,
  className = '',
}: WaveformVisualizerProps) {
  const bars = levels.length > 0 ? levels : Array(32).fill(0.08);

  return (
    <div
      className={`flex h-20 items-end justify-center gap-0.5 rounded-xl bg-black/30 px-3 py-2 ${className}`}
      aria-hidden
    >
      {bars.map((level, i) => (
        <motion.div
          key={i}
          className={`w-1 rounded-full transition-all duration-75 ${
            active
              ? 'bg-gradient-to-t from-fuchsia-500 to-cyan-400'
              : 'bg-slate-600'
          }`}
          style={{ height: `${Math.max(8, level * 100)}%` }}
        />
      ))}
    </div>
  );
}
