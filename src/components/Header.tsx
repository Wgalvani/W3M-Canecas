import { logout } from "@/lib/auth/actions";
import { formatPresetSize } from "@/lib/measurements";
import type { ProductPreset } from "@/types/image";
import { BrandMark, BrandWordmark } from "./Brand";

/** Marca de registro (alvo de impressão) usada como ornamento. */
export function RegMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
      <circle cx="12" cy="12" r="6" />
      <path d="M12 1v22M1 12h22" />
    </svg>
  );
}

export type Step = 1 | 2 | 3;

const STEPS: { step: Step; label: string }[] = [
  { step: 1, label: "Imagem" },
  { step: 2, label: "Enquadrar" },
  { step: 3, label: "Exportar" },
];

function Stepper({ current }: { current: Step }) {
  return (
    <ol className="flex items-center gap-1.5" aria-label="Etapas">
      {STEPS.map(({ step, label }, index) => {
        const state = step < current ? "done" : step === current ? "current" : "todo";
        return (
          <li key={step} className="flex items-center gap-1.5" aria-current={state === "current" ? "step" : undefined}>
            {index > 0 && (
              <span aria-hidden className={`h-px w-6 transition-colors xl:w-10 ${step <= current ? "bg-ink" : "bg-line"}`} />
            )}
            <span
              className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[13px] font-medium transition-colors ${
                state === "current" ? "bg-ink text-paper" : state === "done" ? "text-ink" : "text-muted"
              }`}
            >
              <span
                aria-hidden
                className={`grid size-5 place-items-center rounded-full font-mono text-[11px] ${
                  state === "current"
                    ? "bg-signal text-white"
                    : state === "done"
                      ? "bg-ink text-paper"
                      : "border border-line text-muted"
                }`}
              >
                {state === "done" ? "✓" : step}
              </span>
              {label}
              {state === "done" && <span className="sr-only"> (concluída)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function Header({ preset, step, onHelp }: { preset: ProductPreset; step: Step; onHelp: () => void }) {
  // No celular o cabeçalho rola junto: o espaço fixo da tela fica para a prévia (em pé) e para a arte (deitado).
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur-md max-lg:static">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <BrandMark className="size-9 shrink-0" />
          <div className="min-w-0">
            <h1 className="truncate text-[17px] leading-tight">
              <BrandWordmark />
            </h1>
            <p className="truncate font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              <span className="max-sm:hidden">Estúdio de sublimação · </span>
              {formatPresetSize(preset)}
            </p>
          </div>
        </div>

        <nav className="hidden lg:block">
          <Stepper current={step} />
        </nav>

        <div className="flex flex-1 items-center justify-end gap-2">
          <button
            type="button"
            onClick={onHelp}
            className="group flex h-10 items-center gap-2 rounded-full border border-line bg-card px-3.5 text-sm font-medium text-ink-soft transition hover:border-ink hover:text-ink"
          >
            <span
              aria-hidden
              className="grid size-5 place-items-center rounded-full bg-paper-deep font-mono text-[11px] font-semibold transition group-hover:bg-ink group-hover:text-paper"
            >
              ?
            </span>
            Ajuda
          </button>
          <form action={logout}>
            <button
              type="submit"
              title="Sair (Administrador)"
              className="flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium text-muted transition hover:bg-paper-deep hover:text-ink"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="max-sm:sr-only">Sair</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
