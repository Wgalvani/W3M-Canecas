/** Classes de botão compartilhadas: uma hierarquia só em toda a interface. */
export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-ink font-medium text-paper shadow-md shadow-ink/20 transition hover:-translate-y-px hover:shadow-lg hover:shadow-ink/25 active:translate-y-0 disabled:pointer-events-none disabled:opacity-55",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-full border border-line bg-card font-medium text-ink-soft transition hover:border-ink hover:text-ink disabled:pointer-events-none disabled:opacity-55",
  ghost: "inline-flex items-center justify-center gap-2 rounded-full font-medium text-ink-soft transition hover:bg-paper-deep hover:text-ink",
} as const;

/** Rótulo de seção no estilo ficha técnica. */
export const eyebrow = "font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted";
