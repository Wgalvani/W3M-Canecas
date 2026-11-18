import type { LoadedImage } from "./image";

export type GarmentId =
  | "camiseta"
  | "gola-v"
  | "baby-look"
  | "regata"
  | "regata-cavada"
  | "regata-machao"
  | "regata-nadador"
  | "regata-longline"
  | "regata-canelada"
  | "regata-oversized"
  | "moletom"
  | "moletom-capuz";

export type GarmentSize = "P" | "M" | "G" | "GG";

/** Áreas de estampa. "Esquerda/direita" são do ponto de vista de quem veste. */
export type PrintAreaId = "front" | "back" | "chest" | "sleeve-left" | "sleeve-right";

export type Vec3 = readonly [number, number, number];

/**
 * Plano de uma área de estampa, em cm no espaço da peça (y para cima, frente em +z).
 * A estampa é projetada de fora para dentro, na direção oposta a `normal`, como
 * numa prensa térmica: x cresce para `right`, y para `up`.
 */
export interface AreaFrame {
  origin: Vec3;
  normal: Vec3;
  up: Vec3;
}

export interface PrintArea {
  id: PrintAreaId;
  label: string;
  /** Superfície onde a estampa é aplicada. */
  target: "body" | "sleeve-left" | "sleeve-right";
  frame: AreaFrame;
  /** Largura inicial da estampa (cm). */
  defaultWidthCm: number;
  /** Limites da área, em cm a partir da origem do plano. */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  /** Maior largura/altura de estampa aceita na área (cm). */
  maxWidthCm: number;
  maxHeightCm: number;
  /** Vista da câmera que mostra melhor a área. */
  view: GarmentView;
}

export type GarmentView = "front" | "back" | "left" | "right";

/** Desenho enviado pelo usuário (fica só no navegador). */
export interface Design {
  id: string;
  image: LoadedImage;
  /** Remove o fundo branco ligado às bordas (para JPG ou PNG sem transparência). */
  removeWhite: boolean;
  /** Já tem transparência própria (PNG/WEBP com alfa). */
  hasAlpha: boolean;
  /** Arte pronta para a peça (com ou sem o fundo branco removido). */
  art: HTMLCanvasElement;
  /** Largura ÷ altura. */
  aspect: number;
}

/** Uma estampa aplicada na peça. Posição em cm no plano da área. */
export interface Placement {
  id: string;
  designId: string;
  area: PrintAreaId;
  x: number;
  y: number;
  widthCm: number;
  rotationDeg: number;
}
