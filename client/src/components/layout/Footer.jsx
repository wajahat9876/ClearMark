export default function Footer() {
  return (
    <footer className="border-t border-surface-border/60 px-4 py-8 text-center text-sm text-slate-500 sm:px-6">
      <p>
        ClearMark — AI inpainting with{' '}
        <a
          href="https://github.com/advimman/lama"
          className="text-accent-hover hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          LaMa
        </a>
        . Process images locally; your files never leave your server.
      </p>
    </footer>
  );
}
