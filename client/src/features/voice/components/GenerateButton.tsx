import { motion } from 'framer-motion';
import { Loader2, Mic, RotateCcw, Sparkles } from 'lucide-react';

interface GenerateButtonProps {
  onGenerate: () => void;
  onRetry?: () => void;
  disabled: boolean;
  isGenerating: boolean;
  hasError: boolean;
}

export default function GenerateButton({
  onGenerate,
  onRetry,
  disabled,
  isGenerating,
  hasError,
}: GenerateButtonProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <motion.button
        type="button"
        onClick={onGenerate}
        disabled={disabled || isGenerating}
        whileHover={!disabled && !isGenerating ? { scale: 1.02 } : {}}
        whileTap={!disabled && !isGenerating ? { scale: 0.98 } : {}}
        className="voice-generate-btn relative flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl px-6 py-4 text-base font-semibold text-white shadow-xl shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer bg-[length:200%_100%]" />
        <span className="relative flex items-center gap-2">
          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating voice…
            </>
          ) : (
            <>
              <Mic className="h-5 w-5" />
              Generate Voice
              <Sparkles className="h-4 w-4 opacity-80" />
            </>
          )}
        </span>
      </motion.button>

      {hasError && onRetry && (
        <motion.button
          type="button"
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onRetry}
          disabled={isGenerating}
          className="inline-flex items-center justify-center gap-2 rounded-2xl glass px-5 py-4 text-sm font-medium text-slate-200 transition hover:text-white disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" />
          Retry
        </motion.button>
      )}
    </div>
  );
}
