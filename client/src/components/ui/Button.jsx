const variants = {
  primary:
    'bg-accent hover:bg-accent-hover text-white shadow-lg shadow-indigo-500/25',
  secondary:
    'glass text-slate-200 hover:bg-surface-border/50 hover:text-white',
  ghost: 'text-slate-400 hover:text-white hover:bg-white/5',
  danger: 'bg-rose-600/90 hover:bg-rose-500 text-white',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-5 py-2.5 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  ...props
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`
        inline-flex items-center justify-center rounded-xl font-medium
        transition-all duration-200 focus:outline-none focus-visible:ring-2
        focus-visible:ring-accent focus-visible:ring-offset-2
        focus-visible:ring-offset-surface disabled:opacity-50
        disabled:cursor-not-allowed disabled:pointer-events-none
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
