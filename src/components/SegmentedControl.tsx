"use client";

import { useId } from "react";

interface Option<T extends string> {
  value: T;
  label: string;
  description?: string;
}

/** Grupo de rádios com aparência de botões: acessível por teclado (setas) e leitor de tela. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  hideLabel,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  hideLabel?: boolean;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className={hideLabel ? "sr-only" : "mb-2 text-[13px] font-medium text-ink-soft"}>{label}</legend>
      <div className="flex rounded-xl border border-line bg-paper p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="relative flex min-h-10 flex-1 cursor-pointer flex-col items-center justify-center rounded-[9px] px-2 py-1.5 text-center text-sm font-medium text-muted transition hover:text-ink has-[:checked]:bg-ink has-[:checked]:text-paper has-[:checked]:shadow-md has-[:checked]:shadow-ink/15 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-signal-ink [&:has(:checked)_.desc]:text-paper/65"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
            {option.description && <span className="desc text-xs font-normal text-muted">{option.description}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
