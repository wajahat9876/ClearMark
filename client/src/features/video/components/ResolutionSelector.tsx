import { RESOLUTION_OPTIONS } from '../constants';
import type { VideoResolution } from '../types';

interface ResolutionSelectorProps {
  value: VideoResolution;
  onChange: (value: VideoResolution) => void;
  disabled?: boolean;
}

export default function ResolutionSelector({
  value,
  onChange,
  disabled,
}: ResolutionSelectorProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-300">Target resolution</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {RESOLUTION_OPTIONS.map((opt) => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.id)}
              className={`
                rounded-2xl border p-4 text-left transition-all
                ${selected
                  ? 'border-violet-500/60 voice-card-selected shadow-lg shadow-violet-500/10'
                  : 'border-surface-border glass hover:border-violet-500/30'}
                ${disabled ? 'cursor-not-allowed opacity-50' : ''}
              `}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-xl font-bold">{opt.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    selected
                      ? 'bg-violet-500/30 text-violet-200'
                      : 'bg-surface-border text-slate-400'
                  }`}
                >
                  {opt.pixels}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-400">{opt.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
