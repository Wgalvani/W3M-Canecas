/** Nome da marca, em um só lugar para os metadados, e-mails e PDFs. */
export const BRAND_NAME = "W3M Studio";

/**
 * Símbolo da W3M Studio: monograma "W" em traço contínuo dentro de cantos de
 * corte (a herança de pré-impressão), com o último traço no laranja de sinal.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#16181d" />
      <path
        d="M5 9V5h4M23 5h4v4M27 23v4h-4M9 27H5v-4"
        fill="none"
        stroke="#f3f1eb"
        strokeOpacity=".3"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M8.5 11l3.7 10L16 13.6l3.8 7.4"
        fill="none"
        stroke="#f3f1eb"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M19.8 21l3.7-10" stroke="#ff5a1f" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** Logotipo: "W3M" forte e "Studio" mais leve. `secondary` define a cor de "Studio" conforme o fundo. */
export function BrandWordmark({ className = "", secondary = "text-muted" }: { className?: string; secondary?: string }) {
  return (
    <span className={`font-display font-semibold tracking-[-0.02em] ${className}`}>
      W3M<span className={`ml-[0.28em] font-medium tracking-[-0.01em] ${secondary}`}>Studio</span>
    </span>
  );
}
