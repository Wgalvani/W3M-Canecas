import type { ProductPreset } from "@/types/image";

/** Medidas do objeto mostrado na visualização 3D, em mm. */
export interface MugShape {
  diameterMm: number;
  heightMm: number;
  /** Fração da volta (0–1) coberta pela arte; o restante fica na alça. */
  wrap: number;
}

/** Parte da volta que a arte cobre quando o modelo não informa o diâmetro (21 cm em ~25,6 cm na 325 ml). */
const DEFAULT_WRAP = 0.82;
const MAX_WRAP = 0.92;
/** Folga acima e abaixo da arte quando o modelo não informa a altura. */
const DEFAULT_VERTICAL_GAP_MM = 5;

/**
 * Objeto para o 3D: usa o diâmetro/altura do preset quando conhecidos; senão
 * estima um cilindro em que a arte cobre ~82% da volta, como na caneca padrão.
 */
export function mugShape(preset: ProductPreset): MugShape {
  const diameterMm = preset.object?.diameterMm ?? preset.widthMm / (Math.PI * DEFAULT_WRAP);
  const heightMm = Math.max(preset.object?.heightMm ?? preset.heightMm + 2 * DEFAULT_VERTICAL_GAP_MM, preset.heightMm);
  const wrap = Math.min(MAX_WRAP, preset.widthMm / (Math.PI * diameterMm));
  return { diameterMm, heightMm, wrap };
}
