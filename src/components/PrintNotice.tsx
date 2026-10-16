/** Aviso de escala de impressão (seção 27 do PRD). */
export function PrintNotice({ compact }: { compact?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-signal/30 bg-signal-wash p-3 pl-4 text-sm text-ink">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-signal" />
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-signal-ink">Importante na impressão</p>
      <ul className={compact ? "mt-1.5 flex flex-wrap gap-x-4 gap-y-1" : "mt-1.5 space-y-1"}>
        <li>
          <span aria-hidden className="font-semibold text-emerald-700">✓ </span>Tamanho real
        </li>
        <li>
          <span aria-hidden className="font-semibold text-emerald-700">✓ </span>Escala 100%
        </li>
        <li>
          <span aria-hidden className="font-semibold text-red-700">✕ </span>Não utilizar “Ajustar à página”
        </li>
      </ul>
    </div>
  );
}
