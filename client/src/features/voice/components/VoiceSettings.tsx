import { motion } from 'framer-motion';
import { Globe, Music, Sliders, Sparkles, Zap } from 'lucide-react';
import { EMOTIONS, LANGUAGES } from '../constants';
import type { VoiceGenerationSettings } from '../types';

interface VoiceSettingsProps {
  settings: VoiceGenerationSettings;
  onChange: <K extends keyof VoiceGenerationSettings>(
    key: K,
    value: VoiceGenerationSettings[K]
  ) => void;
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-surface-border/60 bg-black/15 px-4 py-3">
      <span className="text-sm text-slate-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 rounded-full transition-colors ${
          checked ? 'bg-accent' : 'bg-surface-border'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </label>
  );
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div className="space-y-2">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between text-sm"
      >
        <span className="text-slate-400">{label}</span>
        <span className="font-medium text-slate-200">{format(value)}</span>
      </motion.div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="voice-range w-full"
      />
    </div>
  );
}

export default function VoiceSettings({ settings, onChange }: VoiceSettingsProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="glass voice-panel rounded-3xl p-5 sm:p-6"
    >
      <div className="mb-5 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300">
          <Sliders className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold">Advanced AI controls</h2>
          <p className="text-xs text-slate-400">Fine-tune delivery and style</p>
        </div>
      </div>

      <div className="space-y-5">
        <SliderControl
          label="Voice speed"
          value={settings.speed}
          min={0.5}
          max={2}
          step={0.05}
          onChange={(v) => onChange('speed', v)}
          format={(v) => `${v.toFixed(2)}×`}
        />
        <SliderControl
          label="Voice pitch"
          value={settings.pitch}
          min={0.7}
          max={1.4}
          step={0.05}
          onChange={(v) => onChange('pitch', v)}
          format={(v) => `${v.toFixed(2)}×`}
        />

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm text-slate-400">
            <Zap className="h-3.5 w-3.5" />
            Emotion
          </p>
          <div className="flex flex-wrap gap-2">
            {EMOTIONS.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => onChange('emotion', e.id)}
                className={`rounded-xl px-3 py-2 text-sm transition ${
                  settings.emotion === e.id
                    ? 'bg-accent text-white shadow-md shadow-indigo-500/30'
                    : 'glass text-slate-300 hover:text-white'
                }`}
              >
                {e.emoji} {e.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm text-slate-400">
            <Globe className="h-3.5 w-3.5" />
            Language / accent
          </p>
          <select
            value={settings.language}
            onChange={(e) =>
              onChange('language', e.target.value as VoiceGenerationSettings['language'])
            }
            className="w-full rounded-xl border border-surface-border/80 bg-black/20 px-3 py-2.5 text-sm text-slate-200 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle
            label="AI text enhancement"
            checked={settings.aiEnhancement}
            onChange={(v) => onChange('aiEnhancement', v)}
          />
          <Toggle
            label="Background music"
            checked={settings.backgroundMusic}
            onChange={(v) => onChange('backgroundMusic', v)}
          />
        </div>

        {settings.aiEnhancement && (
          <p className="flex items-start gap-2 rounded-xl bg-indigo-500/10 px-3 py-2 text-xs text-indigo-200">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            GPT rewrites your script for clearer, more natural speech before synthesis.
          </p>
        )}
        {settings.backgroundMusic && (
          <p className="flex items-start gap-2 rounded-xl bg-violet-500/10 px-3 py-2 text-xs text-violet-200">
            <Music className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Subtle ambient pad plays under your voice during preview.
          </p>
        )}
      </div>
    </motion.section>
  );
}
