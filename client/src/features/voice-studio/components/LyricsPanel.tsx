import { Music2 } from 'lucide-react';

const MAX_LYRICS = 2000;

interface LyricsPanelProps {
  value: string;
  onChange: (text: string) => void;
  disabled?: boolean;
}

export default function LyricsPanel({ value, onChange, disabled }: LyricsPanelProps) {
  return (
    <div className="glass voice-panel rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-2">
        <Music2 className="h-4 w-4 text-fuchsia-400" />
        <p className="text-sm font-medium text-slate-300">Type your lyrics</p>
      </div>
      <textarea
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_LYRICS))}
        placeholder="Paste or type lyrics here…&#10;&#10;Example:&#10;Twinkle twinkle little star&#10;How I wonder what you are"
        rows={8}
        className="w-full resize-y rounded-xl border border-surface-border bg-black/20 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
      />
      <p className="mt-2 text-right text-xs text-slate-500">
        {value.length}/{MAX_LYRICS} · Royalty-free Microsoft neural voices (Ana, Jenny, Aria)
      </p>
    </div>
  );
}
