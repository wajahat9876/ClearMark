import { motion } from 'framer-motion';
import { Copy, FileText } from 'lucide-react';

interface TextInputPanelProps {
  text: string;
  onChange: (value: string) => void;
  charCount: number;
  maxLength: number;
  progressPercent: number;
  isOverLimit: boolean;
  onCopy: () => void;
}

export default function TextInputPanel({
  text,
  onChange,
  charCount,
  maxLength,
  progressPercent,
  isOverLimit,
  onCopy,
}: TextInputPanelProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass voice-panel rounded-3xl p-5 sm:p-6"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20 text-accent-hover">
            <FileText className="h-4 w-4" />
          </span>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="font-display text-lg font-bold">Your script</h2>
            <p className="text-xs text-slate-400">Type or paste text to synthesize</p>
          </motion.div>
        </div>
        <button
          type="button"
          onClick={onCopy}
          disabled={!text.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy
        </button>
      </motion.div>

      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter the text you want to turn into lifelike AI speech…"
        rows={6}
        className="w-full resize-y rounded-2xl border border-surface-border/80 bg-black/20 px-4 py-3 text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/30"
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-3 space-y-2"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="h-1.5 overflow-hidden rounded-full bg-surface-border/60"
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isOverLimit
                ? 'bg-rose-500'
                : progressPercent > 85
                  ? 'bg-amber-400'
                  : 'bg-gradient-to-r from-indigo-400 to-violet-500'
            }`}
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </motion.div>
        <p
          className={`text-right text-xs ${
            isOverLimit ? 'text-rose-400' : 'text-slate-500'
          }`}
        >
          {charCount.toLocaleString()} / {maxLength.toLocaleString()} characters
        </p>
      </motion.div>
    </motion.section>
  );
}
