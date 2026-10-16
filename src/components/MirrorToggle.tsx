/** Chave liga/desliga (checkbox nativo com aparência de switch). */
export function MirrorToggle({ mirror, onChange }: { mirror: boolean; onChange: (mirror: boolean) => void }) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-signal-ink ${
        mirror ? "border-line bg-paper" : "border-amber-300 bg-amber-50"
      }`}
    >
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-card text-ink ring-1 ring-line">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M12 3v18" strokeDasharray="2 2.5" />
          <path d="M9 7 4 17h5V7Z" strokeLinejoin="round" />
          <path d="m15 7 5 10h-5V7Z" strokeLinejoin="round" fill="currentColor" fillOpacity={mirror ? 0.9 : 0} />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">Espelhar horizontalmente</span>
        <span className={`block text-xs ${mirror ? "text-muted" : "font-medium text-amber-900"}`}>
          {mirror ? "Necessário para a transferência por sublimação." : "Atenção: o arquivo sairá sem espelhamento."}
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={mirror}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-6 w-10 shrink-0 rounded-full bg-line transition peer-checked:bg-ink after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-card after:shadow after:transition-transform after:duration-300 after:ease-out-expo peer-checked:after:translate-x-4"
      />
    </label>
  );
}

/** `compact` usa textos curtos, para caber ao lado de outros controles no celular. */
export function MirrorBadge({ mirror, compact }: { mirror: boolean; compact?: boolean }) {
  return mirror ? (
    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[13px] font-medium text-emerald-900">
      <span aria-hidden className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgb(16_185_129/0.2)]" />
      {compact ? "Espelhada" : "Espelhada para sublimação"}
    </span>
  ) : (
    <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[13px] font-medium text-amber-900">
      <span aria-hidden>!</span> {compact ? "Sem espelho" : "Arte sem espelhamento"}
    </span>
  );
}
