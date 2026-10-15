import { QUALITY_INFO, type QualityAssessment } from "@/lib/imageQuality";
import type { QualityLevel } from "@/types/image";

const STYLES: Record<QualityLevel, { box: string; dot: string; icon: string }> = {
  excellent: { box: "border-emerald-200 bg-emerald-50 text-emerald-900", dot: "bg-emerald-500", icon: "✓" },
  acceptable: { box: "border-amber-200 bg-amber-50 text-amber-900", dot: "bg-amber-400", icon: "!" },
  low: { box: "border-red-200 bg-red-50 text-red-900", dot: "bg-red-500", icon: "✕" },
};

/** Status com ícone + texto, nunca só a cor. */
export function ImageQuality({ quality, sizeLabel }: { quality: QualityAssessment; sizeLabel: string }) {
  const info = QUALITY_INFO[quality.level];
  const style = STYLES[quality.level];
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${style.box}`} role="status" aria-live="polite">
      <div className="flex items-center gap-2">
        <span aria-hidden className={`grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${style.dot}`}>
          {style.icon}
        </span>
        <span className="font-semibold">{info.label}</span>
        <span className="ml-auto text-xs opacity-75" title="Pontos por polegada no tamanho impresso">
          ≈ {Math.round(quality.ppi)} PPI
        </span>
      </div>
      {quality.level !== "excellent" && (
        <p className="mt-1.5 text-sm">
          {info.message}
          {quality.level === "low" && <> ({sizeLabel})</>}
          {info.hint && <span className="mt-1 block font-medium">{info.hint}</span>}
        </p>
      )}
    </div>
  );
}
