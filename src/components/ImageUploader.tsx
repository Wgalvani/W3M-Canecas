"use client";

import { useRef, type ReactNode } from "react";
import { ACCEPTED_EXTENSIONS, ACCEPTED_MIME_TYPES } from "@/lib/constants";
import { formatCm, formatPresetSize } from "@/lib/measurements";
import type { ProductPreset } from "@/types/image";
import { RegMark } from "./Header";

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

const STEPS = [
  { title: "Envie a imagem", text: "JPG, PNG ou WEBP. A qualidade de impressão é avaliada na hora." },
  { title: "Enquadre na medida", text: "Arraste, aproxime e confira a área segura em tamanho real." },
  { title: "Baixe pronto para imprimir", text: "PNG ou PDF espelhado, a 300 PPI, com marcas de corte." },
];

/** Cantos com marcas de corte, como numa prova de gráfica. */
function CropCorners() {
  const corner = "absolute size-5 border-ink/70";
  return (
    <div aria-hidden className="pointer-events-none absolute -inset-3">
      <span className={`${corner} left-0 top-0 border-l border-t`} />
      <span className={`${corner} right-0 top-0 border-r border-t`} />
      <span className={`${corner} bottom-0 left-0 border-b border-l`} />
      <span className={`${corner} bottom-0 right-0 border-b border-r`} />
    </div>
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
    <div className="mx-auto grid w-full max-w-6xl items-center gap-12 py-6 sm:py-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:py-20">
      <div>
        <p className="flex animate-rise items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-signal-ink">
          <RegMark className="size-3.5" /> Pré-impressão para sublimação
        </p>
        <h2
          className="mt-4 animate-rise font-display text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.03em] text-balance sm:text-6xl"
          style={{ animationDelay: "60ms" }}
        >
          Da foto à caneca, <span className="text-muted">no tamanho exato.</span>
        </h2>
        <p className="mt-5 max-w-md animate-rise text-[17px] leading-relaxed text-ink-soft" style={{ animationDelay: "120ms" }}>
          Prepare artes de {formatPresetSize(preset)} prontas para a impressora, sem programas de edição e sem medir nada.
        </p>

        <ol className="mt-9 space-y-px overflow-hidden rounded-2xl border border-line max-lg:hidden">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex animate-rise gap-4 bg-card/70 px-5 py-4"
              style={{ animationDelay: `${200 + index * 70}ms` }}
            >
              <span className="font-mono text-sm text-signal-ink">0{index + 1}</span>
              <span>
                <span className="block font-medium">{step.title}</span>
                <span className="block text-sm text-muted">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="animate-rise" style={{ animationDelay: "160ms" }}>
        {/* Cotas da folha, como num desenho técnico. */}
        <div aria-hidden className="mb-4 flex items-center gap-2 px-3 font-mono text-[11px] text-muted">
          <span className="h-px flex-1 bg-line" />
          {formatCm(preset.widthMm)} cm
          <span className="h-px flex-1 bg-line" />
        </div>
        <div className="relative mx-3">
          <CropCorners />
          <div className="relative flex flex-col items-center overflow-hidden rounded-[22px] border border-line bg-card px-6 py-12 text-center shadow-[0_30px_60px_-30px_rgb(22_24_29/0.35)] sm:py-16">
            <div
              aria-hidden
              className="pasteboard absolute inset-0 opacity-50 [mask-image:radial-gradient(closest-side,transparent_55%,black)]"
            />
            <div className="relative grid size-16 place-items-center rounded-2xl bg-ink text-paper shadow-lg shadow-ink/20">
              <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" />
              </svg>
            </div>
            <p className="relative mt-6 font-display text-2xl font-semibold tracking-tight max-sm:hidden">
              Arraste sua imagem para cá
            </p>
            <p className="relative mt-1 text-sm text-muted max-sm:hidden">ou escolha um arquivo do computador</p>
            <FilePickerButton
              onFile={onFile}
              className="group relative mt-7 inline-flex h-13 items-center gap-3 rounded-full bg-ink pl-7 pr-2 text-base font-medium text-paper shadow-lg shadow-ink/25 transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              Selecionar imagem
              <span
                aria-hidden
                className="grid size-9 place-items-center rounded-full bg-signal text-white transition group-hover:translate-x-0.5"
              >
                →
              </span>
            </FilePickerButton>
            <p className="relative mt-7 flex flex-wrap justify-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted">
              {["JPG", "PNG", "WEBP", "até 30 MB"].map((tag) => (
                <span key={tag} className="rounded-md border border-line bg-paper px-2 py-0.5">
                  {tag}
                </span>
              ))}
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-3 text-sm">
          <p className="flex items-center gap-2 text-muted">
            <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            Processado no seu navegador. Nada é enviado.
          </p>
          <button
            type="button"
            onClick={onTestPattern}
            className="font-medium text-signal-ink underline decoration-signal/40 underline-offset-4 transition hover:decoration-signal"
          >
            Usar arte de teste
          </button>
        </div>
      </div>
    </div>
  );
}
