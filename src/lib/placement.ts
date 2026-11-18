/**
 * Regras de posição e tamanho das estampas, em cm no plano de cada área.
 * Puro (sem three.js) para ser testado e usado tanto na tela quanto na prova.
 */
import type { AreaFrame, Placement, PrintArea, Vec3 } from "@/types/garment";

/** Menor largura de estampa aceita (cm). */
export const MIN_PRINT_CM = 2;

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Direção "direita" do plano, para quem olha a área de frente. */
export function frameRight(frame: AreaFrame): Vec3 {
  return cross(frame.up, frame.normal);
}

/** Ponto do plano (x, y em cm) no espaço da peça. */
export function framePoint(frame: AreaFrame, x: number, y: number): Vec3 {
  const right = frameRight(frame);
  const { origin, up } = frame;
  return [origin[0] + right[0] * x + up[0] * y, origin[1] + right[1] * x + up[1] * y, origin[2] + right[2] * x + up[2] * y];
}

/** Coordenadas no plano de um ponto da superfície (projeção ortogonal). */
export function frameCoords(frame: AreaFrame, point: Vec3): { x: number; y: number } {
  const relative: Vec3 = [point[0] - frame.origin[0], point[1] - frame.origin[1], point[2] - frame.origin[2]];
  return { x: dot(relative, frameRight(frame)), y: dot(relative, frame.up) };
}

/** Largura × altura da estampa, mantendo a proporção do desenho (largura/altura). */
export function printSize(widthCm: number, aspect: number): { width: number; height: number } {
  return { width: widthCm, height: widthCm / aspect };
}

/** Maior largura possível na área para essa proporção. */
export function maxWidthFor(area: PrintArea, aspect: number): number {
  return Math.max(MIN_PRINT_CM, Math.min(area.maxWidthCm, area.maxHeightCm * aspect));
}

/** Meia largura e meia altura da caixa que contém a estampa girada. */
function rotatedHalfExtents(width: number, height: number, rotationDeg: number) {
  const r = (rotationDeg * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return { hx: (width * c + height * s) / 2, hy: (width * s + height * c) / 2 };
}

function clampRange(value: number, min: number, max: number) {
  if (min > max) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}

/** Mantém tamanho e posição dentro da área (a estampa girada inteira cabe nos limites). */
export function clampPlacement(placement: Placement, area: PrintArea, aspect: number): Placement {
  const widthCm = clampRange(placement.widthCm, MIN_PRINT_CM, maxWidthFor(area, aspect));
  const { width, height } = printSize(widthCm, aspect);
  const { hx, hy } = rotatedHalfExtents(width, height, placement.rotationDeg);
  const { bounds } = area;
  return {
    ...placement,
    widthCm,
    x: clampRange(placement.x, bounds.minX + hx, bounds.maxX - hx),
    y: clampRange(placement.y, bounds.minY + hy, bounds.maxY - hy),
  };
}

/** Estampa nova na posição padrão da área; a altura é limitada pela área. */
export function defaultPlacement(id: string, designId: string, area: PrintArea, aspect: number): Placement {
  return clampPlacement({ id, designId, area: area.id, x: 0, y: 0, widthCm: area.defaultWidthCm, rotationDeg: 0 }, area, aspect);
}

/**
 * Distância padrão do topo da estampa até a gola: "4 dedos" (~7,5 cm), dentro da faixa
 * de 5–10 cm usada como padrão de mercado para frente e costas.
 */
export const COLLAR_GUIDE_CM = 7.5;
/** Até onde a estampa "gruda" na guia ou no centro ao arrastar (cm). */
export const SNAP_CM = 1.2;

/** Meia altura vertical que a estampa ocupa (já girada). */
export function placementHalfHeight(placement: Placement, aspect: number): number {
  const { width, height } = printSize(placement.widthCm, aspect);
  return rotatedHalfExtents(width, height, placement.rotationDeg).hy;
}

/** Topo da estampa a `distanceCm` da gola (`collarY`, altura real) e centralizada na peça. */
export function alignToCollar(placement: Placement, area: PrintArea, aspect: number, collarY: number, distanceCm: number): Placement {
  const top = collarY - distanceCm - area.frame.origin[1];
  const centerX = area.id === "chest" ? 0 : 0 - area.frame.origin[0];
  return clampPlacement({ ...placement, x: centerX, y: top - placementHalfHeight(placement, aspect) }, area, aspect);
}

/** Distância do topo da estampa até a gola, em cm. */
export function distanceFromCollar(placement: Placement, area: PrintArea, aspect: number, collarY: number): number {
  return collarY - (area.frame.origin[1] + placement.y + placementHalfHeight(placement, aspect));
}

/** "28 × 31,4 cm" */
export function formatPrintSize(widthCm: number, aspect: number): string {
  const { width, height } = printSize(widthCm, aspect);
  const format = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${format(Math.round(width * 10) / 10)} × ${format(Math.round(height * 10) / 10)} cm`;
}
