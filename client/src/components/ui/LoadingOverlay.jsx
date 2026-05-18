export default function LoadingOverlay() {
  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-surface/80 backdrop-blur-sm"
      aria-hidden
    >
      <div className="relative h-16 w-16">
        <span className="absolute inset-0 animate-spin rounded-full border-4 border-surface-border border-t-accent" />
        <span className="absolute inset-2 animate-pulse-slow rounded-full bg-accent/20" />
      </div>
      <p className="mt-4 text-sm font-medium text-slate-300">
        AI is inpainting your image…
      </p>
    </div>
  );
}
