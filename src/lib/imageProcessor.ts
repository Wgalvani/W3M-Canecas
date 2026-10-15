import type { Framing, LoadedImage, ProductPreset, Size } from "@/types/image";
import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_MIME_TYPES,
  BACKGROUND_COLOR,
  CROP_MARKS,
  MAX_FILE_BYTES,
  PREVIEW_MAX_SIDE,
} from "./constants";
import { AppError } from "./errors";
import { imageRectMm } from "./framing";
import { MM_PER_INCH, targetPixels } from "./measurements";
import { withPngResolution } from "./png";
import { cutGuides, singleSheet, type SheetLayout } from "./sheetLayout";

export function validateFile(file: File): void {
  const name = file.name.toLowerCase();
  const typeOk = ACCEPTED_MIME_TYPES.includes(file.type);
  const extensionOk = ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  // Alguns celulares enviam o arquivo sem MIME type; nesse caso vale a extensão.
  if (!typeOk && !(file.type === "" && extensionOk)) {
    throw new AppError("unsupported");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new AppError("too-large");
  }
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  // Sem contexto (ou com tamanho zerado) o navegador recusou a memória.
  if (!ctx || canvas.width !== width || canvas.height !== height) {
    throw new AppError("out-of-memory");
  }
  return { canvas, ctx };
}

function createPreview(source: HTMLImageElement): HTMLCanvasElement {
  const { naturalWidth: w, naturalHeight: h } = source;
  const scale = Math.min(1, PREVIEW_MAX_SIDE / Math.max(w, h));
  const { canvas, ctx } = createCanvas(Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Abre o arquivo e mantém a imagem original em memória. Os navegadores atuais
 * já aplicam a orientação EXIF (fotos de celular) ao decodificar.
 */
export async function loadImage(file: File): Promise<LoadedImage> {
  validateFile(file);
  const objectUrl = URL.createObjectURL(file);
  const source = new Image();
  source.decoding = "async";
  source.src = objectUrl;
  try {
    await source.decode();
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new AppError("corrupt");
  }
  if (!source.naturalWidth || !source.naturalHeight) {
    URL.revokeObjectURL(objectUrl);
    throw new AppError("corrupt");
  }
  try {
    return {
      name: file.name,
      sizeBytes: file.size,
      width: source.naturalWidth,
      height: source.naturalHeight,
      source,
      preview: createPreview(source),
      objectUrl,
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export function releaseImage(image: LoadedImage): void {
  URL.revokeObjectURL(image.objectUrl);
  image.preview.width = 0;
  image.preview.height = 0;
}

export interface RenderOptions {
  mirror: boolean;
  background?: string;
}

/**
 * Desenha a arte em um contexto de qualquer tamanho. Preview e exportação usam
 * esta mesma função; só muda a fonte (cópia reduzida ou original) e o tamanho
 * de saída. A imagem é reamostrada uma única vez, direto da fonte.
 */
export function renderArt(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  image: Size,
  preset: ProductPreset,
  framing: Framing,
  output: Size,
  { mirror, background = BACKGROUND_COLOR }: RenderOptions,
): void {
  const pxPerMmX = output.width / preset.widthMm;
  const pxPerMmY = output.height / preset.heightMm;
  const rect = imageRectMm(image, preset, framing);

  // Desenha a partir da origem atual do contexto (permite compor várias artes numa folha).
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, output.width, output.height);
  ctx.clip();
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, output.width, output.height);
  if (mirror) {
    ctx.translate(output.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, rect.x * pxPerMmX, rect.y * pxPerMmY, rect.width * pxPerMmX, rect.height * pxPerMmY);
  ctx.restore();
}

/**
 * Desenha uma folha completa: fundo branco, cada arte na sua posição e as
 * marcas de corte. `artPixels` força o tamanho exato da arte (exportação).
 */
export function renderSheet(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  image: Size,
  preset: ProductPreset,
  framing: Framing,
  layout: SheetLayout,
  pxPerMm: number,
  { mirror, artPixels }: { mirror: boolean; artPixels?: Size },
): void {
  const art = artPixels ?? {
    width: Math.round(preset.widthMm * pxPerMm),
    height: Math.round(preset.heightMm * pxPerMm),
  };
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, Math.round(layout.widthMm * pxPerMm), Math.round(layout.heightMm * pxPerMm));
  // Posições em pixels inteiros; as marcas são calculadas sobre elas para coincidir com a borda real da arte.
  const rects = layout.arts.map((slot) => ({
    x: Math.round(slot.x * pxPerMm),
    y: Math.round(slot.y * pxPerMm),
    ...art,
  }));
  for (const rect of rects) {
    ctx.save();
    ctx.translate(rect.x, rect.y);
    renderArt(ctx, source, image, preset, framing, art, { mirror });
    ctx.restore();
  }
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = Math.max(1, CROP_MARKS.strokeMm * pxPerMm);
  ctx.lineCap = "butt";
  ctx.beginPath();
  const sheetPx = { width: layout.widthMm * pxPerMm, height: layout.heightMm * pxPerMm };
  for (const mark of cutGuides(layout.guide, rects, sheetPx, pxPerMm)) {
    ctx.moveTo(mark.x1, mark.y1);
    ctx.lineTo(mark.x2, mark.y2);
  }
  ctx.stroke();
  ctx.restore();
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new AppError("out-of-memory"))), type);
  });
}

async function exportCanvasPng(canvas: HTMLCanvasElement, ppi: number): Promise<Uint8Array> {
  try {
    const blob = await canvasToBlob(canvas, "image/png");
    return withPngResolution(new Uint8Array(await blob.arrayBuffer()), ppi);
  } finally {
    // Libera a memória do canvas imediatamente (importante no iOS).
    canvas.width = 0;
    canvas.height = 0;
  }
}

/** Só a arte (2480 × 1122 px), renderizada a partir da imagem original. Usada dentro dos PDFs. */
export async function renderArtPng(
  image: LoadedImage,
  preset: ProductPreset,
  framing: Framing,
  mirror: boolean,
): Promise<Uint8Array> {
  const output = targetPixels(preset);
  const { canvas, ctx } = createCanvas(output.width, output.height);
  renderArt(ctx, image.source, image, preset, framing, output, { mirror });
  return exportCanvasPng(canvas, preset.ppi);
}

/** PNG para impressão: arte de 2480 × 1122 px com margem e marcas de corte, a 300 PPI. */
export async function renderPrintPng(
  image: LoadedImage,
  preset: ProductPreset,
  framing: Framing,
  mirror: boolean,
): Promise<Uint8Array> {
  const art = targetPixels(preset);
  const layout = singleSheet(preset);
  const pxPerMm = preset.ppi / MM_PER_INCH;
  const margin = Math.round(layout.arts[0].x * pxPerMm);
  const { canvas, ctx } = createCanvas(art.width + 2 * margin, art.height + 2 * margin);
  renderSheet(ctx, image.source, image, preset, framing, layout, pxPerMm, { mirror, artPixels: art });
  return exportCanvasPng(canvas, preset.ppi);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
