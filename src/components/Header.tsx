import { formatPresetSize } from "@/lib/measurements";
import type { ProductPreset } from "@/types/image";

export function MugLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#2563eb" />
      <path d="M8 10h13v10a4 4 0 0 1-4 4h-5a4 4 0 0 1-4-4V10Z" fill="#fff" />
      <path d="M21 13h1.5a3 3 0 0 1 0 6H21" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M11 14h7M11 17h5" stroke="#2563eb" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Header({ preset, onHelp }: { preset: ProductPreset; onHelp: () => void }) {
  // No celular o cabeçalho rola junto: o espaço fixo da tela fica para a prévia (em pé) e para a arte (deitado).
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur max-lg:static">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <MugLogo className="size-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold leading-tight sm:text-lg">
            <span className="sm:hidden">Preparador</span>
            <span className="max-sm:hidden">Preparador de Canecas</span>
          </h1>
          <p className="truncate text-xs text-slate-500 sm:text-sm">
            Arte para sublimação • {formatPresetSize(preset)}
          </p>
        </div>
        <button
          type="button"
          onClick={onHelp}
          className="flex h-10 items-center gap-1.5 rounded-full border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <span aria-hidden className="grid size-5 place-items-center rounded-full bg-slate-200 text-xs font-bold">
            ?
          </span>
          Ajuda
        </button>
      </div>
    </header>
  );
}
