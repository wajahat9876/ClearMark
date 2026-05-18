import {
  Brush,
  Eraser,
  RotateCcw,
  Undo2,
  Wand2,
} from 'lucide-react';
import Button from '../ui/Button';

export default function EditorToolbar({
  brushSize,
  onBrushSizeChange,
  tool,
  onToolChange,
  onUndo,
  onClear,
  onProcess,
  onReset,
  canProcess,
  isProcessing,
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={tool === 'brush' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => onToolChange('brush')}
          aria-pressed={tool === 'brush'}
        >
          <Brush className="h-4 w-4" />
          Brush
        </Button>
        <Button
          variant={tool === 'eraser' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => onToolChange('eraser')}
          aria-pressed={tool === 'eraser'}
        >
          <Eraser className="h-4 w-4" />
          Eraser
        </Button>
        <Button variant="ghost" size="sm" onClick={onUndo}>
          <Undo2 className="h-4 w-4" />
          Undo
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <RotateCcw className="h-4 w-4" />
          Clear mask
        </Button>
      </div>

      <label className="flex min-w-[200px] flex-1 items-center gap-3 text-sm text-slate-400 sm:max-w-xs">
        <span className="shrink-0">Size</span>
        <input
          type="range"
          min={4}
          max={120}
          value={brushSize}
          onChange={(e) => onBrushSizeChange(Number(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-border accent-accent"
        />
        <span className="w-8 shrink-0 text-right text-slate-300">{brushSize}</span>
      </label>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={onReset}>
          New image
        </Button>
        <Button
          size="md"
          onClick={onProcess}
          disabled={!canProcess || isProcessing}
        >
          <Wand2 className="h-4 w-4" />
          Remove with AI
        </Button>
      </div>
    </div>
  );
}
