export function MirrorToggle({ mirror, onChange }: { mirror: boolean; onChange: (mirror: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-600">
      <input
        type="checkbox"
        checked={mirror}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-5 shrink-0 cursor-pointer accent-blue-600"
      />
      <span>
        <span className="block font-medium">Espelhar horizontalmente</span>
        <span className="block text-sm text-slate-500">
          {mirror ? "Necessário para a transferência por sublimação." : "Atenção: o arquivo sairá sem espelhamento."}
        </span>
      </span>
    </label>
  );
}

/** `compact` usa textos curtos, para caber ao lado de outros controles no celular. */
export function MirrorBadge({ mirror, compact }: { mirror: boolean; compact?: boolean }) {
  return mirror ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
      <span aria-hidden>✓</span> {compact ? "Espelhada" : "Arte espelhada para sublimação"}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900">
      <span aria-hidden>!</span> {compact ? "Sem espelho" : "Arte sem espelhamento"}
    </span>
  );
}
