import { Mic, Type } from 'lucide-react';
import type { InputMode } from '../types';

interface InputModeTabsProps {
  mode: InputMode;
  onChange: (mode: InputMode) => void;
  disabled?: boolean;
}

const MODES: { id: InputMode; label: string; icon: typeof Mic }[] = [
  { id: 'record', label: 'Record / Upload', icon: Mic },
  { id: 'lyrics', label: 'Type Lyrics', icon: Type },
];

export default function InputModeTabs({ mode, onChange, disabled }: InputModeTabsProps) {
  return (
    <div className="flex rounded-xl border border-surface-border bg-black/20 p-1">
      {MODES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(id)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
            mode === id
              ? 'bg-gradient-to-r from-cyan-600/80 to-fuchsia-600/80 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
