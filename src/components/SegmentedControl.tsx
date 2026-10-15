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
      <legend className={hideLabel ? "sr-only" : "mb-1.5 text-sm font-medium text-slate-700"}>{label}</legend>
      <div className="flex rounded-xl bg-slate-100 p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="relative flex min-h-10 flex-1 cursor-pointer flex-col items-center justify-center rounded-lg px-2 py-1.5 text-center text-sm font-medium text-slate-600 transition has-[:checked]:bg-white has-[:checked]:text-slate-900 has-[:checked]:shadow-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-600"
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
            {option.description && <span className="text-xs font-normal text-slate-500">{option.description}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
