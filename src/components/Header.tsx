import Link from "next/link";
import { logout } from "@/lib/auth/actions";
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

export type Product = "canecas" | "camisetas";

const PRODUCTS: { id: Product; href: string; label: string; tagline: string; icon: React.ReactNode }[] = [
  {
    id: "canecas",
    href: "/",
    label: "Canecas",
    tagline: "Sublimação · arte e PDF",
    icon: (
      <path
        d="M5 6h10v9a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V6Zm10 2.5h1.5a2.5 2.5 0 0 1 0 5H15"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    ),
  },
  {
    id: "camisetas",
    href: "/camisetas",
    label: "Camisetas",
    tagline: "DTF · prova 3D",
    icon: (
      <path
        d="M9 4 4 6.5 2.5 11l3 1.2L7 10v10h10V10l1.5 2.2 3-1.2L20 6.5 15 4a3 3 0 0 1-6 0Z"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    ),
  },
];

type ProductInfo = (typeof PRODUCTS)[number];

function ProductIcon({ product, className }: { product: ProductInfo; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      {product.icon}
    </svg>
  );
}

/** Abas dos estúdios no celular e tablet (no desktop o menu lateral assume). */
function ProductTabs({ current }: { current: Product }) {
  return (
    <nav aria-label="Estúdios">
      <ul className="flex rounded-full border border-line bg-card p-1">
        {PRODUCTS.map((product) => {
          const active = product.id === current;
          return (
            <li key={product.id} className="flex-1">
              <Link
                href={product.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-9 items-center justify-center gap-2 rounded-full px-3.5 text-[13px] font-medium transition ${
                  active ? "bg-ink text-paper shadow-md shadow-ink/15" : "text-muted hover:text-ink"
                }`}
              >
                <ProductIcon product={product} className="size-4" />
                {product.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function LogoutButton({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <form action={logout}>
      <button type="submit" title="Sair (Administrador)" className={className}>
        <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {children}
      </button>
    </form>
  );
}

/** Menu lateral do desktop: a marca, os estúdios separados e as ações da conta. */
function Sidebar({ current, onHelp }: { current: Product; onHelp: () => void }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-ink text-paper lg:flex">
      <div className="flex items-center gap-3 px-5 pb-8 pt-6">
        <BrandMark className="size-10 shrink-0" />
        <span className="text-[19px] leading-none">
          <BrandWordmark secondary="text-paper/55" />
        </span>
      </div>

      <p className="px-6 pb-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-paper/45">Estúdios</p>
      <nav aria-label="Estúdios" className="px-3">
        <ul className="space-y-1">
          {PRODUCTS.map((product) => {
            const active = product.id === current;
            return (
              <li key={product.id}>
                <Link
                  href={product.href}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 transition ${
                    active ? "bg-paper/[0.08]" : "hover:bg-paper/[0.05]"
                  }`}
                >
                  {active && <span aria-hidden className="absolute bottom-3 -left-3 top-3 w-[3px] rounded-r-full bg-signal" />}
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-xl transition ${
                      active ? "bg-signal text-ink" : "bg-paper/[0.07] text-paper/70 group-hover:text-paper"
                    }`}
                  >
                    <ProductIcon product={product} className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[15px] font-medium ${active ? "text-paper" : "text-paper/80"}`}>{product.label}</span>
                    <span className="block truncate text-xs text-paper/45">{product.tagline}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto space-y-1 border-t border-paper/10 px-3 py-4">
        <button
          type="button"
          onClick={onHelp}
          className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-paper/75 transition hover:bg-paper/[0.06] hover:text-paper"
        >
          <span aria-hidden className="grid size-4 place-items-center rounded-full border border-current font-mono text-[10px]">
            ?
          </span>
          Ajuda
        </button>
        <LogoutButton className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-paper/75 transition hover:bg-paper/[0.06] hover:text-paper">
          Sair
        </LogoutButton>
        <p className="flex items-center gap-2 px-3 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-paper/35">
          <RegMark className="size-3" /> Processamento local
        </p>
      </div>
    </aside>
  );
}

/**
 * Navegação do app. Desktop: menu lateral fixo + barra do estúdio (título e etapas).
 * Celular/tablet: cabeçalho com a marca e as abas dos estúdios. A página usa `lg:pl-60`.
 */
export function Header({
  product,
  subtitle,
  step,
  onHelp,
}: {
  product: Product;
  subtitle: string;
  step?: Step;
  onHelp: () => void;
}) {
  const current = PRODUCTS.find((p) => p.id === product) ?? PRODUCTS[0];
  return (
    <>
      <Sidebar current={product} onHelp={onHelp} />

      {/* Desktop: barra do estúdio atual. */}
      <div className="sticky top-0 z-20 hidden border-b border-line bg-paper/85 backdrop-blur-md lg:block">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-6 px-6">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[22px] font-semibold leading-tight tracking-tight">{current.label}</h1>
            <p className="truncate font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              {current.tagline} · {subtitle}
            </p>
          </div>
          {step && (
            <nav aria-label="Etapas">
              <Stepper current={step} />
            </nav>
          )}
        </div>
      </div>

      {/* Celular e tablet: o cabeçalho rola junto (o espaço fixo fica para a prévia). */}
      <header className="border-b border-line bg-paper/85 lg:hidden">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <BrandMark className="size-9 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] leading-tight">
              <BrandWordmark />
            </p>
            <p className="truncate font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onHelp}
            className="flex h-10 items-center gap-2 rounded-full border border-line bg-card px-3.5 text-sm font-medium text-ink-soft transition hover:border-ink hover:text-ink"
          >
            <span aria-hidden className="grid size-5 place-items-center rounded-full bg-paper-deep font-mono text-[11px] font-semibold">
              ?
            </span>
            <span className="max-sm:sr-only">Ajuda</span>
          </button>
          <LogoutButton className="grid size-10 place-items-center rounded-full text-muted transition hover:bg-paper-deep hover:text-ink">
            <span className="sr-only">Sair</span>
          </LogoutButton>
        </div>
        <div className="px-4 pb-3 sm:px-6">
          <ProductTabs current={product} />
        </div>
      </header>
    </>
  );
}
