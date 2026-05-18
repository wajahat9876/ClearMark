import { Sparkles } from 'lucide-react';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-surface-border/60 glass">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <a href="#" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent shadow-lg shadow-indigo-500/30">
            <Sparkles className="h-5 w-5 text-white" aria-hidden />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">
            Clear<span className="text-accent-hover">Mark</span>
          </span>
        </a>
        <nav className="hidden items-center gap-6 text-sm text-slate-400 sm:flex">
          <a href="#upload" className="transition hover:text-white">
            Upload
          </a>
          <a href="#editor" className="transition hover:text-white">
            Editor
          </a>
          <a href="#preview" className="transition hover:text-white">
            Preview
          </a>
        </nav>
      </div>
    </header>
  );
}
