/** Produto de destino da arte: a caneca padrão ou um tamanho escolhido pelo usuário. */
export interface ProductPreset {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  ppi: number;
  safeMarginMm: number;
  /** Detalhe exibido abaixo do seletor (ex.: tipos de caneca que usam a medida). */
  hint?: string;
  /** Aviso para medidas que variam entre fornecedores. */
  warning?: string;
  /** Medidas reais do objeto para a visualização 3D; sem elas o formato é estimado pela arte. */
  object?: { diameterMm: number; heightMm: number };
}

export interface Size {
  width: number;
  height: number;
}

/** Preencher cobre toda a área (pode cortar); Encaixar mostra a imagem inteira. */
export type FitMode = "fill" | "fit";

/**
 * Enquadramento da imagem, guardado em medidas físicas para que o preview
 * e a exportação final usem exatamente a mesma configuração.
 */
export interface Framing {
  mode: FitMode;
  /** 1 = 100%, relativo à escala base do modo. */
  zoom: number;
  /** Deslocamento do centro da imagem em relação ao centro da arte, em mm. */
  offsetXMm: number;
  offsetYMm: number;
}

export interface LoadedImage {
  name: string;
  sizeBytes: number;
  /** Dimensões originais (já com a orientação EXIF aplicada). */
  width: number;
  height: number;
  /** Imagem original em memória — usada apenas na exportação final. */
  source: HTMLImageElement;
  /** Cópia reduzida para manter o preview fluido. */
  preview: HTMLCanvasElement;
  objectUrl: string;
}

export type QualityLevel = "excellent" | "acceptable" | "low";

export type ExportKind = "png" | "pdf-single" | "pdf-a4";
