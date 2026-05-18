import { useState } from 'react';
import { Columns2, SlidersHorizontal } from 'lucide-react';

export default function BeforeAfterPreview({ sourceUrl, resultUrl }) {
  const [slider, setSlider] = useState(50);
  const [mode, setMode] = useState('slider');
  if (!resultUrl) return null;

  return (
    <section id="preview" className="px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">
              Before & after
            </h2>
            <p className="mt-2 text-slate-400">
              Compare your original with the AI-cleaned result.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('slider')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition ${
                mode === 'slider'
                  ? 'bg-accent text-white'
                  : 'glass text-slate-400 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Slider
            </button>
            <button
              type="button"
              onClick={() => setMode('side')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition ${
                mode === 'side'
                  ? 'bg-accent text-white'
                  : 'glass text-slate-400 hover:text-white'
              }`}
            >
              <Columns2 className="h-4 w-4" />
              Side by side
            </button>
          </div>
        </div>

        {mode === 'slider' ? (
          <div className="relative mt-6 overflow-hidden rounded-2xl border border-surface-border select-none">
            <img
              src={resultUrl}
              alt="After inpainting"
              className="block w-full h-auto"
              draggable={false}
            />
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${slider}%` }}
            >
              <img
                src={sourceUrl}
                alt="Before inpainting"
                className="block h-full min-w-full max-w-none object-cover object-left"
                draggable={false}
              />
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={slider}
              onChange={(e) => setSlider(Number(e.target.value))}
              className="absolute inset-0 z-10 h-full w-full cursor-ew-resize opacity-0"
              aria-label="Compare before and after"
            />
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-[5] w-0.5 bg-white shadow-lg"
              style={{ left: `${slider}%` }}
            >
              <span className="absolute top-1/2 left-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-accent shadow-lg">
                <SlidersHorizontal className="h-4 w-4 text-white" />
              </span>
            </div>
            <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
              Before
            </span>
            <span className="pointer-events-none absolute right-3 top-3 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
              After
            </span>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <figure className="overflow-hidden rounded-2xl border border-surface-border">
              <figcaption className="border-b border-surface-border bg-surface-elevated px-4 py-2 text-sm font-medium text-slate-300">
                Before
              </figcaption>
              <img src={sourceUrl} alt="Original" className="block w-full h-auto" />
            </figure>
            <figure className="overflow-hidden rounded-2xl border border-surface-border">
              <figcaption className="border-b border-surface-border bg-surface-elevated px-4 py-2 text-sm font-medium text-slate-300">
                After
              </figcaption>
              <img src={resultUrl} alt="Cleaned" className="block w-full h-auto" />
            </figure>
          </div>
        )}
      </div>
    </section>
  );
}
