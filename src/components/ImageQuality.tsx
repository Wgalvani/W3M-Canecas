import { QUALITY_THRESHOLDS } from "@/lib/constants";
import { QUALITY_INFO, type QualityAssessment } from "@/lib/imageQuality";
import type { QualityLevel } from "@/types/image";

const STYLES: Record<QualityLevel, { text: string; bar: string; icon: string }> = {
  excellent: { text: "text-emerald-800", bar: "bg-emerald-500", icon: "✓" },
  acceptable: { text: "text-amber-800", bar: "bg-amber-400", icon: "!" },
  low: { text: "text-red-800", bar: "bg-red-500", icon: "✕" },
};

/** Escala do medidor: até ~1,25× o limite de "Excelente". */
const GAUGE_MAX = QUALITY_THRESHOLDS.excellent * 1.25;

/** Status com ícone + texto, nunca só a cor; o medidor mostra onde a imagem está entre os limites. */
export function ImageQuality({ quality, sizeLabel }: { quality: QualityAssessment; sizeLabel: string }) {
  const info = QUALITY_INFO[quality.level];
  const style = STYLES[quality.level];
  const position = Math.min(100, (quality.ppi / GAUGE_MAX) * 100);
  const mark = (ppi: number) => `${(ppi / GAUGE_MAX) * 100}%`;
  return (
    <div className="rounded-xl border border-line bg-paper p-3" role="status" aria-live="polite">
      <div className="flex items-center gap-2">
        <span aria-hidden className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white ${style.bar}`}>
          {style.icon}
        </span>
        <span className={`text-sm font-semibold ${style.text}`}>{info.label}</span>
        <span className="ml-auto font-mono text-xs tabular-nums text-muted" title="Pontos por polegada no tamanho impresso">
          ≈ {Math.round(quality.ppi)} PPI
        </span>
      </div>

      <div aria-hidden className="relative mt-3 h-1.5 rounded-full bg-line">
        <div className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out-expo ${style.bar}`} style={{ width: `${position}%` }} />
        <span className="absolute -top-1 h-3.5 w-px bg-ink/40" style={{ left: mark(QUALITY_THRESHOLDS.acceptable) }} />
        <span className="absolute -top-1 h-3.5 w-px bg-ink/40" style={{ left: mark(QUALITY_THRESHOLDS.excellent) }} />
      </div>
      <div aria-hidden className="relative mt-1 h-3 font-mono text-[10px] text-muted">
        <span className="absolute -translate-x-1/2" style={{ left: mark(QUALITY_THRESHOLDS.acceptable) }}>
          {QUALITY_THRESHOLDS.acceptable}
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: mark(QUALITY_THRESHOLDS.excellent) }}>
          {QUALITY_THRESHOLDS.excellent}
        </span>
      </div>

      {quality.level !== "excellent" && (
        <p className={`mt-2 text-[13px] ${style.text}`}>
          {info.message}
          {quality.level === "low" && <> ({sizeLabel})</>}
          {info.hint && <span className="mt-1 block font-medium">{info.hint}</span>}
        </p>
      )}
    </div>
  );
}
