"use client";

import { useId, useState } from "react";
import { isValidSideMm, parseCm, presetForSize } from "@/lib/artSize";
import { ART_SIZE_LIMITS_MM, PRESETS } from "@/lib/constants";
import { formatCm, formatPresetSize } from "@/lib/measurements";
import type { ProductPreset } from "@/types/image";

type Side = "width" | "height";

const limitsLabel = `${formatCm(ART_SIZE_LIMITS_MM.min)} a ${formatCm(ART_SIZE_LIMITS_MM.max)} cm`;

/**
 * Largura e altura da arte em cm. Os campos aceitam vírgula ou ponto e só
 * aplicam medidas válidas; ao sair do campo, um valor inválido volta ao atual.
 */
export function SizeControl({ preset, onChange }: { preset: ProductPreset; onChange: (preset: ProductPreset) => void }) {
  const id = useId();
  const [draft, setDraft] = useState({ width: formatCm(preset.widthMm), height: formatCm(preset.heightMm) });
  const [shown, setShown] = useState(preset);

  // Tamanho mudou por fora (atalho, inverter, tamanho salvo): atualiza os campos que não batem mais.
  if (shown !== preset) {
    setShown(preset);
    setDraft((d) => ({
      width: parseCm(d.width) === preset.widthMm ? d.width : formatCm(preset.widthMm),
      height: parseCm(d.height) === preset.heightMm ? d.height : formatCm(preset.heightMm),
    }));
  }

  const isCustom = !PRESETS.some((option) => option.id === preset.id);

  const errorOf = (text: string) => {
    const mm = parseCm(text);
    if (mm === null) return "Use um número com até 1 casa decimal, ex.: 9,5";
    return isValidSideMm(mm) ? null : `Entre ${limitsLabel}`;
  };

  const update = (side: Side, text: string) => {
    const next = { ...draft, [side]: text };
    setDraft(next);
    const width = parseCm(next.width);
    const height = parseCm(next.height);
    if (width !== null && height !== null && isValidSideMm(width) && isValidSideMm(height)) {
      if (width !== preset.widthMm || height !== preset.heightMm) onChange(presetForSize(width, height));
    }
  };

  const restore = (side: Side) => {
    if (errorOf(draft[side])) {
      setDraft((d) => ({ ...d, [side]: formatCm(side === "width" ? preset.widthMm : preset.heightMm) }));
    }
  };

  const field = (side: Side, label: string) => {
    const error = errorOf(draft[side]);
    return (
      <div className="min-w-0 flex-1">
        <label htmlFor={`${id}-${side}`} className="font-mono text-[11px] uppercase tracking-wider text-muted">
          {label}
        </label>
        <div className="relative mt-0.5">
          <input
            id={`${id}-${side}`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={draft[side]}
            onChange={(event) => update(side, event.target.value)}
            onBlur={() => restore(side)}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-${side}-error` : undefined}
            className="h-11 w-full rounded-xl border border-line bg-card pl-3 pr-9 font-mono text-[15px] tabular-nums transition outline-none hover:border-ink-soft/40 focus:border-ink focus:ring-4 focus:ring-ink/8 aria-[invalid=true]:border-red-400 aria-[invalid=true]:bg-red-50"
          />
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center font-mono text-xs text-muted">
            cm
          </span>
        </div>
        {error && (
          <p id={`${id}-${side}-error`} className="mt-1 text-xs text-red-700">
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <fieldset>
      <legend className="mb-2 text-[13px] font-medium text-ink-soft">Tamanho da arte</legend>

      <label htmlFor={`${id}-preset`} className="sr-only">
        Modelo
      </label>
      <select
        id={`${id}-preset`}
        value={preset.id}
        onChange={(event) => {
          const chosen = PRESETS.find((option) => option.id === event.target.value);
          if (chosen) onChange(chosen);
        }}
        className="h-11 w-full cursor-pointer rounded-xl border border-line bg-card px-3 text-sm text-ink transition outline-none hover:border-ink-soft/40 focus:border-ink focus:ring-4 focus:ring-ink/8"
      >
        {PRESETS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name} · {formatPresetSize(option)}
          </option>
        ))}
        {/* Só selecionável digitando as medidas abaixo. */}
        <option value="personalizado" disabled>
          Personalizado{isCustom ? ` · ${formatPresetSize(preset)}` : " (digite abaixo)"}
        </option>
      </select>
      {preset.hint && <p className="mt-1.5 text-xs text-muted">{preset.hint}</p>}
      {preset.warning && (
        <p role="note" className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 ring-1 ring-amber-300">
          {preset.warning}
        </p>
      )}

      <div className="mt-3 flex items-start gap-2">
        {field("width", "Largura")}
        <button
          type="button"
          onClick={() => onChange(presetForSize(preset.heightMm, preset.widthMm))}
          aria-label="Inverter largura e altura"
          title="Inverter largura e altura"
          className="mt-[22px] grid size-11 shrink-0 place-items-center rounded-full border border-line bg-card text-ink-soft transition hover:rotate-180 hover:border-ink hover:text-ink duration-500 ease-out-expo"
        >
          <span aria-hidden>⇄</span>
        </button>
        {field("height", "Altura")}
      </div>
      <p className="mt-1.5 text-xs text-muted">Cada lado de {limitsLabel}.</p>
    </fieldset>
  );
}
