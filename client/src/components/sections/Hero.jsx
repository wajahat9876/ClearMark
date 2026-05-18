import { Wand2, Shield, Zap } from 'lucide-react';
import Button from '../ui/Button';

const features = [
  { icon: Wand2, text: 'AI inpainting removes watermarks cleanly' },
  { icon: Shield, text: 'Original resolution & quality preserved' },
  { icon: Zap, text: 'Fast LaMa model — runs locally on your server' },
];

export default function Hero({ onGetStarted }) {
  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-12 sm:px-6 sm:pt-20 sm:pb-24">
      <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto max-w-4xl text-center">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm text-indigo-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Open-source LaMa inpainting
        </p>
        <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl">
          Remove watermarks &{' '}
          <span className="gradient-text">distractions</span> with AI
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400 sm:text-xl">
          Upload any image, brush over Gemini watermarks or unwanted objects,
          and let AI inpainting restore the area — same dimensions, lossless PNG
          output.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" onClick={onGetStarted}>
            Start removing
          </Button>
          <Button variant="secondary" size="lg" onClick={() => document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' })}>
            Learn how it works
          </Button>
        </div>
        <ul className="mt-12 grid gap-4 text-left sm:grid-cols-3">
          {features.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-start gap-3 rounded-2xl glass p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent-hover">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-sm text-slate-300">{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
