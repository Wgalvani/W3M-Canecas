"use client";

import { useRef, type ReactNode } from "react";
import { ACCEPTED_EXTENSIONS, ACCEPTED_MIME_TYPES } from "@/lib/constants";
import { formatPresetSize } from "@/lib/measurements";
import type { ProductPreset } from "@/types/image";

const ACCEPT = [...ACCEPTED_MIME_TYPES, ...ACCEPTED_EXTENSIONS].join(",");

/**
 * Botão com input de arquivo oculto. Sem o atributo `capture`, o celular
 * oferece galeria, arquivos e câmera.
 */
export function FilePickerButton({
  onFile,
  className,
  children,
}: {
  onFile: (file: File) => void;
  className?: string;
  children: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => inputRef.current?.click()}>
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Limpa para permitir selecionar o mesmo arquivo novamente.
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
    </>
  );
}

export function ImageUploader({
  preset,
  onFile,
  onTestPattern,
}: {
  preset: ProductPreset;
  onFile: (file: File) => void;
  onTestPattern: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-8 text-center sm:py-16">
      <h2 className="text-2xl font-semibold sm:text-3xl">Preparador de Canecas</h2>
      <p className="mt-1 text-slate-500">{formatPresetSize(preset)} · tamanho ajustável no editor</p>

      <div className="mt-8 flex w-full flex-col items-center rounded-3xl border-2 border-dashed border-slate-300 bg-white px-6 py-12 shadow-sm">
        <svg viewBox="0 0 48 48" className="size-14 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <rect x="6" y="10" width="36" height="28" rx="4" />
          <circle cx="17" cy="20" r="3.5" />
          <path d="M6 33l10-9 8 7 6-5 12 10" strokeLinejoin="round" />
        </svg>
        <p className="mt-4 text-lg font-medium max-sm:hidden">Arraste sua imagem aqui</p>
        <p className="my-2 text-sm text-slate-400 max-sm:hidden">ou</p>
        <FilePickerButton
          onFile={onFile}
          className="mt-2 h-12 rounded-full bg-blue-600 px-8 text-base font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-offset-4"
        >
          Selecionar imagem
        </FilePickerButton>
        <p className="mt-6 text-sm text-slate-500">JPG • PNG • WEBP · até 30 MB</p>
      </div>

      <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
        <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        Suas imagens são processadas localmente e não são armazenadas.
      </p>
      <button type="button" onClick={onTestPattern} className="mt-3 text-sm text-blue-700 underline-offset-2 hover:underline">
        Usar arte de teste (régua e espelhamento)
      </button>
    </div>
  );
}
