import type { ReactNode } from "react";
import { BrandMark, BrandWordmark } from "../Brand";
import { RegMark } from "../Header";

/** Moldura das telas de acesso: painel da marca à esquerda, formulário à direita. */
export function AuthShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink p-12 text-paper lg:flex lg:flex-col">
        <div aria-hidden className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#f3f1eb_1px,transparent_1.2px)] [background-size:16px_16px]" />
        <div aria-hidden className="absolute -right-24 top-1/2 size-[520px] -translate-y-1/2 rounded-full border border-paper/10" />
        <div aria-hidden className="absolute -right-24 top-1/2 h-px w-[640px] -translate-y-1/2 bg-paper/10" />
        <RegMark className="absolute right-[136px] top-1/2 size-16 -translate-y-1/2 text-signal" />

        <div className="relative flex items-center gap-3">
          <BrandMark className="size-10 rounded-[11px] ring-1 ring-paper/20" />
          <BrandWordmark className="text-lg" secondary="text-paper/60" />
        </div>
        <div className="relative mt-auto max-w-md">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-signal">Estúdio de sublimação</p>
          <p className="mt-4 font-display text-5xl font-semibold leading-[1.04] tracking-[-0.03em]">
            Artes no tamanho exato, <span className="text-paper/45">prontas para a prensa.</span>
          </p>
        </div>
        <p className="relative mt-12 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-paper/45">
          <span className="size-1.5 rounded-full bg-emerald-400" /> Acesso restrito · conexão protegida
        </p>
      </aside>

      <main className="flex flex-col justify-center px-5 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-sm animate-rise">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <BrandMark className="size-9" />
            <BrandWordmark className="text-lg" />
          </div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-signal-ink">{eyebrow}</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.03em]">{title}</h1>
          {description && <p className="mt-2 text-[15px] leading-relaxed text-muted">{description}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
