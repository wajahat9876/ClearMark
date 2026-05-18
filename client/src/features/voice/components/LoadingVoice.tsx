import { motion } from 'framer-motion';

export default function LoadingVoice() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="glass rounded-3xl px-10 py-8 text-center">
        <div className="mx-auto mb-4 flex gap-1.5 justify-center">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.span
              key={i}
              className="h-8 w-1.5 rounded-full bg-gradient-to-t from-indigo-500 to-violet-400"
              animate={{ scaleY: [0.4, 1, 0.4] }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.1,
              }}
            />
          ))}
        </div>
        <p className="font-display text-lg font-semibold">Synthesizing AI voice…</p>
        <p className="mt-1 text-sm text-slate-400">This usually takes a few seconds</p>
      </div>
    </motion.div>
  );
}
