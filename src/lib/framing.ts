import type { FitMode, Framing, ProductPreset, Size } from "@/types/image";
import { ZOOM_MAX, ZOOM_MIN } from "./constants";

export function initialFraming(mode: FitMode = "fill"): Framing {
  return { mode, zoom: 1, offsetXMm: 0, offsetYMm: 0 };
}

/** Escala (mm por pixel da imagem original) em zoom 100% para o modo escolhido. */
export function baseMmPerPx(image: Size, preset: ProductPreset, mode: FitMode): number {
  const scaleX = preset.widthMm / image.width;
  const scaleY = preset.heightMm / image.height;
  return mode === "fill" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
}

/** Uma única escala para os dois eixos: a imagem nunca é deformada. */
export function mmPerPx(image: Size, preset: ProductPreset, framing: Framing): number {
  return baseMmPerPx(image, preset, framing.mode) * framing.zoom;
}

/** Retângulo ocupado pela imagem dentro da arte, em mm a partir do canto superior esquerdo. */
export function imageRectMm(image: Size, preset: ProductPreset, framing: Framing) {
  const scale = mmPerPx(image, preset, framing);
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    x: preset.widthMm / 2 + framing.offsetXMm - width / 2,
    y: preset.heightMm / 2 + framing.offsetYMm - height / 2,
    width,
    height,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Mantém zoom e posição em limites válidos. Em cada eixo: se a imagem é maior
 * que a arte, ela precisa cobri-la (sem faixas vazias); se é menor, precisa
 * ficar inteira dentro dela.
 */
export function clampFraming(image: Size, preset: ProductPreset, framing: Framing): Framing {
  const zoom = clamp(framing.zoom, ZOOM_MIN, ZOOM_MAX);
  const scale = baseMmPerPx(image, preset, framing.mode) * zoom;
  const limitX = Math.abs(image.width * scale - preset.widthMm) / 2;
  const limitY = Math.abs(image.height * scale - preset.heightMm) / 2;
  return {
    mode: framing.mode,
    zoom,
    offsetXMm: clamp(framing.offsetXMm, -limitX, limitX),
    offsetYMm: clamp(framing.offsetYMm, -limitY, limitY),
  };
}

/**
 * Altera o zoom mantendo fixo o ponto sob o cursor/dedos.
 * `anchor` é relativo ao centro da arte, em mm.
 */
export function zoomAround(framing: Framing, nextZoom: number, anchor = { x: 0, y: 0 }): Framing {
  const zoom = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX);
  const ratio = zoom / framing.zoom;
  return {
    ...framing,
    zoom,
    offsetXMm: anchor.x + (framing.offsetXMm - anchor.x) * ratio,
    offsetYMm: anchor.y + (framing.offsetYMm - anchor.y) * ratio,
  };
}
