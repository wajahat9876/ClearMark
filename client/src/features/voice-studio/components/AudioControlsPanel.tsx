import type { ExportFormat, StudioSettings } from '../types';

interface AudioControlsPanelProps {
  settings: StudioSettings;
  onChange: (patch: Partial<StudioSettings>) => void;
  onBackgroundFile?: (file: File | null) => void;
  disabled?: boolean;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span>{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="voice-range w-full"
      />
    </label>
  );
}

export default function AudioControlsPanel({
  settings,
  onChange,
  onBackgroundFile,
  disabled,
}: AudioControlsPanelProps) {
  return (
    <div className="glass voice-panel space-y-4 rounded-2xl p-5">
      <p className="text-sm font-medium text-slate-300">Audio controls</p>
      <Slider
        label="Pitch"
        value={settings.pitch}
        min={0.7}
        max={1.5}
        step={0.01}
        format={(v) => `${v.toFixed(2)}×`}
        onChange={(pitch) => onChange({ pitch })}
        disabled={disabled}
      />
      <Slider
        label="Speed"
        value={settings.speed}
        min={0.75}
        max={1.5}
        step={0.01}
        format={(v) => `${v.toFixed(2)}×`}
        onChange={(speed) => onChange({ speed })}
        disabled={disabled}
      />
      <Slider
        label="Volume"
        value={settings.volume}
        min={0.5}
        max={1.5}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(volume) => onChange({ volume })}
        disabled={disabled}
      />
      <Slider
        label="Fade in"
        value={settings.fadeIn}
        min={0}
        max={3}
        step={0.1}
        format={(v) => `${v.toFixed(1)}s`}
        onChange={(fadeIn) => onChange({ fadeIn })}
        disabled={disabled}
      />
      <Slider
        label="Fade out"
        value={settings.fadeOut}
        min={0}
        max={3}
        step={0.1}
        format={(v) => `${v.toFixed(1)}s`}
        onChange={(fadeOut) => onChange({ fadeOut })}
        disabled={disabled}
      />
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2 text-slate-400">
          <input
            type="checkbox"
            checked={settings.denoise}
            disabled={disabled}
            onChange={(e) => onChange({ denoise: e.target.checked })}
          />
          Noise reduction
        </label>
        <label className="flex items-center gap-2 text-slate-400">
          <input
            type="checkbox"
            checked={settings.normalize}
            disabled={disabled}
            onChange={(e) => onChange({ normalize: e.target.checked })}
          />
          Auto normalize
        </label>
      </div>
      <div>
        <p className="mb-2 text-xs text-slate-400">Export format</p>
        <div className="flex gap-2">
          {(['mp3', 'wav', 'aac'] as ExportFormat[]).map((fmt) => (
            <button
              key={fmt}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ format: fmt })}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium uppercase ${
                settings.format === fmt
                  ? 'bg-cyan-500/30 text-cyan-200'
                  : 'bg-surface-border text-slate-400'
              }`}
            >
              {fmt}
            </button>
          ))}
        </div>
      </div>
      <label className="block text-xs text-slate-400">
        Background music (optional)
        <input
          type="file"
          accept="audio/*"
          disabled={disabled}
          className="mt-1 block w-full text-xs text-slate-500"
          onChange={(e) => onBackgroundFile?.(e.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  );
}
