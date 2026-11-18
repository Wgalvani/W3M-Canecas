/** Seção do painel de propriedades, numerada como uma ficha técnica. */
export function Panel({
  number,
  title,
  className = "",
  aside,
  children,
}: {
  number: string;
  title: string;
  className?: string;
  /** Conteúdo curto à direita do título (ex.: um contador). */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={`px-5 py-5 ${className}`}>
      <h2 className="mb-4 flex items-center gap-2.5">
        <span className="font-mono text-[11px] text-signal-ink">{number}</span>
        <span className="font-display text-[15px] font-semibold tracking-tight">{title}</span>
        <span aria-hidden className="h-px flex-1 bg-line-soft" />
        {aside}
      </h2>
      {children}
    </section>
  );
}
