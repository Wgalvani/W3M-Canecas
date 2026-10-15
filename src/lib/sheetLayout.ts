import type { ProductPreset } from "@/types/image";
import { A4_ART_GAP_MM, A4_BORDERLESS, A4_MAX_ARTS, A4_SIZE_MM, CROP_MARKS } from "./constants";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Como a folha indica o corte: marcas de registro fora da arte, ou linhas-guia
 * (folha sem margem, onde não há espaço para as marcas).
 */
export type CutGuide = "crop-marks" | "cut-lines";

/** Folha de saída em mm, origem no canto superior esquerdo. */
export interface SheetLayout {
  widthMm: number;
  heightMm: number;
  arts: Rect[];
  guide: CutGuide;
}

/** PNG e PDF individual: a arte com uma margem em volta para as marcas de corte. */
export function singleSheet(preset: ProductPreset): SheetLayout {
  const margin = CROP_MARKS.sheetMarginMm;
  return {
    widthMm: preset.widthMm + 2 * margin,
    heightMm: preset.heightMm + 2 * margin,
    arts: [{ x: margin, y: margin, width: preset.widthMm, height: preset.heightMm }],
    guide: "crop-marks",
  };
}

/** Menor distância entre a arte e a borda do papel que ainda comporta uma marca de corte imprimível. */
const A4_MIN_EDGE_MM = CROP_MARKS.printerMarginMm + CROP_MARKS.minOffsetMm + CROP_MARKS.minLengthMm;

/** Quantas artes (0 a A4_MAX_ARTS) cabem empilhadas na A4 paisagem com as marcas de corte. */
export function a4Capacity(preset: ProductPreset): number {
  const usableWidth = A4_SIZE_MM.height - 2 * A4_MIN_EDGE_MM;
  const usableHeight = A4_SIZE_MM.width - 2 * A4_MIN_EDGE_MM;
  if (preset.widthMm > usableWidth) return 0;
  const fits = Math.floor((usableHeight + A4_ART_GAP_MM) / (preset.heightMm + A4_ART_GAP_MM));
  return Math.min(Math.max(0, fits), A4_MAX_ARTS);
}

/** Cabem as 3 artes na A4 em pé sem margem, com as linhas-guia nas pontas? */
export function a4BorderlessFits(preset: ProductPreset): boolean {
  const { count, gapMm } = A4_BORDERLESS;
  // Cada arte ocupa sua altura mais meio espaço acima e abaixo, até as linhas-guia.
  return preset.widthMm <= A4_SIZE_MM.width && count * (preset.heightMm + gapMm) <= A4_SIZE_MM.height;
}

/** Quantidades oferecidas no PDF A4: 1 e 2 na paisagem (o que couber) e 3 na folha em pé sem margem. */
export function a4Counts(preset: ProductPreset): number[] {
  const counts = Array.from({ length: a4Capacity(preset) }, (_, index) => index + 1);
  if (a4BorderlessFits(preset)) counts.push(A4_BORDERLESS.count);
  return counts;
}

/** Artes empilhadas e centralizadas na folha, com `gap` entre elas. */
function stackedArts(preset: ProductPreset, total: number, gap: number, sheet: { widthMm: number; heightMm: number }): Rect[] {
  const x = (sheet.widthMm - preset.widthMm) / 2;
  const blockHeight = total * preset.heightMm + (total - 1) * gap;
  const top = (sheet.heightMm - blockHeight) / 2;
  return Array.from({ length: total }, (_, index) => ({
    x,
    y: top + index * (preset.heightMm + gap),
    width: preset.widthMm,
    height: preset.heightMm,
  }));
}

/**
 * Folha A4 com `count` artes. Até 2: A4 paisagem com as artes empilhadas e
 * centralizadas, separadas por um pequeno espaço para que um corte desalinhado
 * não leve parte da outra arte (limitado ao que cabe, ver `a4Capacity`).
 * 3: A4 em pé para impressão sem margem, com linhas-guia de corte (ver `A4_BORDERLESS`).
 */
export function a4Sheet(preset: ProductPreset, count: number): SheetLayout {
  if (Math.round(count) >= A4_BORDERLESS.count && a4BorderlessFits(preset)) {
    const sheet = { widthMm: A4_SIZE_MM.width, heightMm: A4_SIZE_MM.height };
    return { ...sheet, arts: stackedArts(preset, A4_BORDERLESS.count, A4_BORDERLESS.gapMm, sheet), guide: "cut-lines" };
  }
  const total = Math.min(Math.max(1, Math.round(count)), Math.max(1, a4Capacity(preset)));
  const sheet = { widthMm: A4_SIZE_MM.height, heightMm: A4_SIZE_MM.width };
  return { ...sheet, arts: stackedArts(preset, total, A4_ART_GAP_MM, sheet), guide: "crop-marks" };
}

export interface CropMarkOptions {
  /** Distância preferida entre a borda da arte e a marca. */
  offset: number;
  /** Comprimento preferido da marca. */
  length: number;
  /** Limites usados quando falta espaço junto à borda do papel. */
  minOffset: number;
  minLength: number;
  /** Faixa junto à borda do papel que a impressora não imprime. */
  inset: number;
}

const EPSILON = 1e-6;

/** Valores distintos em ordem, preservando os originais (sem ruído de arredondamento). */
function uniqueSorted(values: number[]): number[] {
  return [...values]
    .sort((a, b) => a - b)
    .filter((value, index, sorted) => index === 0 || value - sorted[index - 1] > EPSILON);
}

/**
 * Marcas das linhas de corte verticais (uma por borda esquerda/direita de arte).
 * Cada linha recebe marcas acima e abaixo do bloco e também nos espaços entre
 * artes empilhadas. As marcas encolhem para caber na área imprimível e nunca
 * tocam a arte.
 */
function verticalLineMarks(arts: Rect[], sheetHeight: number, o: CropMarkOptions): Segment[] {
  const marks: Segment[] = [];
  const add = (x: number, from: number, to: number) => {
    if (Math.abs(to - from) >= o.minLength - EPSILON) marks.push({ x1: x, y1: from, x2: x, y2: to });
  };
  /** Marca saindo da borda `edge` na direção `dir`, dentro de `available` de espaço livre. */
  const outer = (x: number, edge: number, dir: 1 | -1, available: number) => {
    const offset = Math.min(o.offset, Math.max(o.minOffset, available - o.length));
    const length = Math.min(o.length, available - offset);
    add(x, edge + dir * offset, edge + dir * (offset + length));
  };

  for (const x of uniqueSorted(arts.flatMap((r) => [r.x, r.x + r.width]))) {
    const column = arts
      .filter((r) => r.x <= x + EPSILON && x <= r.x + r.width + EPSILON)
      .sort((a, b) => a.y - b.y);
    const first = column[0];
    const last = column[column.length - 1];
    outer(x, first.y, -1, first.y - o.inset);
    outer(x, last.y + last.height, 1, sheetHeight - o.inset - (last.y + last.height));
    for (let i = 0; i < column.length - 1; i++) {
      const gapStart = column[i].y + column[i].height;
      const gap = column[i + 1].y - gapStart;
      if (gap <= EPSILON) continue;
      const clearance = Math.min(o.offset, gap / 5);
      add(x, gapStart + clearance, gapStart + gap - clearance);
    }
  }
  return marks;
}

/**
 * Marcas de corte (registro) de uma folha, em qualquer unidade. As linhas
 * horizontais usam a mesma regra das verticais, com os eixos trocados.
 */
export function cropMarks(arts: Rect[], sheet: { width: number; height: number }, o: CropMarkOptions): Segment[] {
  const transposed = arts.map((r) => ({ x: r.y, y: r.x, width: r.height, height: r.width }));
  return [
    ...verticalLineMarks(arts, sheet.height, o),
    ...verticalLineMarks(transposed, sheet.width, o).map((m) => ({ x1: m.y1, y1: m.x1, x2: m.y2, y2: m.x2 })),
  ];
}

/** Opções das marcas convertidas para a unidade de desenho (mm → px quando `scale` = px/mm). */
export function cropMarkOptions(scale = 1): CropMarkOptions {
  return {
    offset: CROP_MARKS.offsetMm * scale,
    length: CROP_MARKS.lengthMm * scale,
    minOffset: CROP_MARKS.minOffsetMm * scale,
    minLength: CROP_MARKS.minLengthMm * scale,
    inset: CROP_MARKS.printerMarginMm * scale,
  };
}

/**
 * Linhas-guia de corte, de ponta a ponta da folha, a `distance` de cada borda da
 * arte (no meio do espaço entre artes vizinhas). Borda que coincide com a do papel
 * não precisa de corte e fica sem linha.
 */
export function cutLines(arts: Rect[], sheet: { width: number; height: number }, distance: number): Segment[] {
  const inside = (value: number, size: number) => value > EPSILON && value < size - EPSILON;
  const xs = uniqueSorted(arts.flatMap((r) => [r.x - distance, r.x + r.width + distance])).filter((x) => inside(x, sheet.width));
  const ys = uniqueSorted(arts.flatMap((r) => [r.y - distance, r.y + r.height + distance])).filter((y) => inside(y, sheet.height));
  return [
    ...xs.map((x) => ({ x1: x, y1: 0, x2: x, y2: sheet.height })),
    ...ys.map((y) => ({ x1: 0, y1: y, x2: sheet.width, y2: y })),
  ];
}

/** Marcas de corte ou linhas-guia da folha, na unidade de desenho (`scale` = unidades por mm). */
export function cutGuides(guide: CutGuide, arts: Rect[], sheet: { width: number; height: number }, scale = 1): Segment[] {
  return guide === "cut-lines"
    ? cutLines(arts, sheet, (A4_BORDERLESS.gapMm / 2) * scale)
    : cropMarks(arts, sheet, cropMarkOptions(scale));
}

export function sheetCutGuides(layout: SheetLayout): Segment[] {
  return cutGuides(layout.guide, layout.arts, { width: layout.widthMm, height: layout.heightMm });
}
