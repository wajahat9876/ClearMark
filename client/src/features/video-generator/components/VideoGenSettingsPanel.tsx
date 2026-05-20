import {
  ASPECT_OPTIONS,
  DURATION_OPTIONS,
  FPS_OPTIONS,
  QUALITY_OPTIONS,
} from '../constants';
import type { VideoGenSettings } from '../types';

interface Props {
  settings: VideoGenSettings;
  onChange: <K extends keyof VideoGenSettings>(
    key: K,
    value: VideoGenSettings[K]
  ) => void;
  disabled?: boolean;
}

export default function VideoGenSettingsPanel({
  settings,
  onChange,
  disabled,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-300">
          Animation prompt
        </label>
        <textarea
          value={settings.prompt}
          disabled={disabled}
          onChange={(e) => onChange('prompt', e.target.value)}
          placeholder="e.g. Gentle zoom in, soft eye blink, dreamy camera drift through a magical forest at golden hour…"
          rows={4}
          className="w-full resize-y rounded-xl border border-surface-border bg-surface-elevated/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-300">Aspect ratio</p>
        <div className="grid grid-cols-3 gap-2">
          {ASPECT_OPTIONS.map((ar) => (
            <button
              key={ar.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange('aspectRatio', ar.id)}
              className={`rounded-xl border py-2.5 text-center text-sm transition ${
                settings.aspectRatio === ar.id
                  ? 'border-cyan-400/60 bg-cyan-500/15 text-white'
                  : 'border-surface-border text-slate-400 hover:text-white'
              }`}
            >
              <span className="block font-medium">{ar.label}</span>
              <span className="text-xs opacity-70">{ar.sub}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm text-slate-300">Duration (sec)</label>
          <select
            value={settings.duration}
            disabled={disabled}
            onChange={(e) => onChange('duration', Number(e.target.value))}
            className="w-full rounded-xl border border-surface-border bg-surface-elevated/60 px-3 py-2.5 text-sm text-white"
          >
            {DURATION_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} seconds
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm text-slate-300">Quality</label>
          <select
            value={settings.quality}
            disabled={disabled}
            onChange={(e) =>
              onChange('quality', e.target.value as VideoGenSettings['quality'])
            }
            className="w-full rounded-xl border border-surface-border bg-surface-elevated/60 px-3 py-2.5 text-sm text-white"
          >
            {QUALITY_OPTIONS.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm text-slate-300">Frame rate</label>
          <select
            value={settings.fps}
            disabled={disabled}
            onChange={(e) =>
              onChange('fps', Number(e.target.value) as VideoGenSettings['fps'])
            }
            className="w-full rounded-xl border border-surface-border bg-surface-elevated/60 px-3 py-2.5 text-sm text-white"
          >
            {FPS_OPTIONS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
