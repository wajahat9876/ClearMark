import { useState } from 'react';
import EditorToolbar from '../editor/EditorToolbar';
import MaskCanvas from '../editor/MaskCanvas';
import ProgressBar from '../ui/ProgressBar';
import LoadingOverlay from '../ui/LoadingOverlay';

export default function EditorSection({
  sourceUrl,
  dimensions,
  strokes,
  onStrokesChange,
  brushSize,
  onBrushSizeChange,
  onUndo,
  onClear,
  onProcess,
  onReset,
  canProcess,
  isProcessing,
  progress,
  error,
}) {
  const [tool, setTool] = useState('brush');

  if (!sourceUrl) return null;

  return (
    <section id="editor" className="px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">
          Paint areas to remove
        </h2>
        <p className="mt-2 text-slate-400">
          Brush over watermarks, logos, or distractions. The AI will inpaint only
          the highlighted regions.
        </p>

        <div className="relative mt-6 space-y-4 min-h-[200px]">
          <EditorToolbar
            brushSize={brushSize}
            onBrushSizeChange={onBrushSizeChange}
            tool={tool}
            onToolChange={setTool}
            onUndo={onUndo}
            onClear={onClear}
            onProcess={onProcess}
            onReset={onReset}
            canProcess={canProcess}
            isProcessing={isProcessing}
          />

          <div className="relative">
            <MaskCanvas
              imageUrl={sourceUrl}
              dimensions={dimensions}
              strokes={strokes}
              onStrokesChange={onStrokesChange}
              brushSize={brushSize}
              tool={tool}
            />
            {isProcessing && <LoadingOverlay />}
          </div>

          {isProcessing && <ProgressBar value={progress} />}

          {error && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
