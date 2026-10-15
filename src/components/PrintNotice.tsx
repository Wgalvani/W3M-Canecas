/** Aviso de escala de impressão (seção 27 do PRD). */
export function PrintNotice({ compact }: { compact?: boolean }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
      <p className="font-semibold uppercase tracking-wide">Importante</p>
      <p className="mt-1">Na impressão selecione:</p>
      <ul className={compact ? "mt-1 flex flex-wrap gap-x-4" : "mt-1 space-y-0.5"}>
        <li>
          <span aria-hidden className="text-emerald-700">✓ </span>Tamanho real
        </li>
        <li>
          <span aria-hidden className="text-emerald-700">✓ </span>Escala 100%
        </li>
        <li>
          <span aria-hidden className="text-red-700">✕ </span>Não utilizar “Ajustar à página”
        </li>
      </ul>
    </div>
  );
}
