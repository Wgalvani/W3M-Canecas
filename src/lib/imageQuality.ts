import type { Framing, ProductPreset, QualityLevel, Size } from "@/types/image";
import { QUALITY_THRESHOLDS } from "./constants";
import { mmPerPx } from "./framing";
import { MM_PER_INCH } from "./measurements";

export interface QualityAssessment {
  /** Pixels da imagem original por polegada impressa, já considerando o zoom. */
  ppi: number;
  level: QualityLevel;
}

export const QUALITY_INFO: Record<QualityLevel, { label: string; message: string; hint?: string }> = {
  excellent: {
    label: "Excelente",
    message: "Excelente qualidade para impressão.",
  },
  acceptable: {
    label: "Aceitável",
    message: "A imagem poderá ser impressa, mas pode apresentar pequena perda de definição.",
  },
  low: {
    label: "Baixa qualidade",
    message: "Esta imagem possui baixa resolução para impressão nesse tamanho.",
    hint: "Recomendamos utilizar uma imagem com resolução maior.",
  },
};

export function qualityLevel(ppi: number): QualityLevel {
  if (ppi >= QUALITY_THRESHOLDS.excellent) return "excellent";
  if (ppi >= QUALITY_THRESHOLDS.acceptable) return "acceptable";
  return "low";
}

/** Avalia a qualidade do recorte efetivamente usado (muda com o zoom e o modo). */
export function assessQuality(image: Size, preset: ProductPreset, framing: Framing): QualityAssessment {
  const ppi = MM_PER_INCH / mmPerPx(image, preset, framing);
  return { ppi, level: qualityLevel(ppi) };
}
