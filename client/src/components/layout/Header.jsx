import { Link } from 'react-router-dom';
import { Mic2, Sparkles } from 'lucide-react';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-surface-border/60 glass">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent shadow-lg shadow-indigo-500/30">
            <Sparkles className="h-5 w-5 text-white" aria-hidden />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">
            Clear<span className="text-accent-hover">Mark</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-slate-400 sm:flex">
          <Link to="/voice-generator" className="inline-flex items-center gap-1.5 transition hover:text-white">
            <Mic2 className="h-3.5 w-3.5" />
            AI Voice
          </Link>
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
