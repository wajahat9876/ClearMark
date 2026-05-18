export default function ProgressBar({ value, label }) {
  return (
    <div className="w-full space-y-2" aria-live="polite">
      <div className="flex justify-between text-sm text-slate-400">
        <span>{label || 'Processing with AI…'}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-border">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-violet-400 transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}
