import type { ProductPreset, Size } from "@/types/image";

export const MM_PER_INCH = 25.4;
const POINTS_PER_INCH = 72;

export function mmToPx(mm: number, ppi: number): number {
  return Math.round((mm / MM_PER_INCH) * ppi);
}

/** Unidade de medida do PDF (1 pt = 1/72 pol). */
export function mmToPt(mm: number): number {
  return (mm / MM_PER_INCH) * POINTS_PER_INCH;
}

export function pixelsPerMeter(ppi: number): number {
  return Math.round(ppi / (MM_PER_INCH / 1000));
}

/** Dimensão em pixels do arquivo final (21 × 9,5 cm a 300 PPI = 2480 × 1122). */
export function targetPixels(preset: ProductPreset): Size {
  return {
    width: mmToPx(preset.widthMm, preset.ppi),
    height: mmToPx(preset.heightMm, preset.ppi),
  };
}

/** "21" / "9,5" */
export function formatCm(mm: number): string {
  return (mm / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

/** "21 × 9,5 cm" */
export function formatPresetSize(preset: ProductPreset): string {
  return `${formatCm(preset.widthMm)} × ${formatCm(preset.heightMm)} cm`;
}

const COMMON_RATIOS: Array<[number, number]> = [
  [1, 1],
  [5, 4],
  [4, 3],
  [3, 2],
  [16, 10],
  [16, 9],
  [2, 1],
  [21, 9],
  [3, 1],
];

/** Proporção legível: "4:3", "3:4", "16:9" ou "2,21:1". */
export function formatAspectRatio(width: number, height: number): string {
  const landscape = width >= height;
  const ratio = landscape ? width / height : height / width;
  const match = COMMON_RATIOS.find(([a, b]) => Math.abs(ratio - a / b) / (a / b) < 0.01);
  if (match) {
    const [a, b] = match;
    return landscape ? `${a}:${b}` : `${b}:${a}`;
  }
  const text = ratio.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return landscape ? `${text}:1` : `1:${text}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}
