import type { PresetItem } from '../types';

interface PresetGridProps {
  title: string;
  items: PresetItem[];
  selectedId?: string;
  selectedIds?: string[];
  multi?: boolean;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export default function PresetGrid({
  title,
  items,
  selectedId,
  selectedIds = [],
  multi,
  onSelect,
  disabled,
}: PresetGridProps) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium text-slate-300">{title}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item) => {
          const selected = multi
            ? selectedIds.includes(item.id)
            : selectedId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(item.id)}
              className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                selected
                  ? 'border-cyan-500/60 voice-card-selected text-white'
                  : 'border-surface-border glass text-slate-300 hover:border-cyan-500/30'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
