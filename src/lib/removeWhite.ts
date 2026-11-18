/**
 * "Remover fundo branco": apaga só o branco ligado às bordas da imagem
 * (preenchimento a partir das bordas), preservando o branco de dentro do
 * desenho — olhos, letras vazadas, contornos. A borda é suavizada e a franja
 * branca descontaminada para não deixar halo claro em malha escura.
 */

/** Quão longe do branco puro (0–255, pelo canal mais escuro) ainda conta como fundo. */
export const DEFAULT_WHITE_TOLERANCE = 38;

function whiteDistance(data: Uint8ClampedArray, offset: number): number {
  return 255 - Math.min(data[offset], data[offset + 1], data[offset + 2]);
}

export function removeWhiteBackground(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  tolerance = DEFAULT_WHITE_TOLERANCE,
): Uint8ClampedArray<ArrayBuffer> {
  const data = new Uint8ClampedArray(source);
  const total = width * height;
  const background = new Uint8Array(total);
  const isWhitish = (index: number) => {
    const offset = index * 4;
    return data[offset + 3] < 16 || whiteDistance(data, offset) <= tolerance;
  };

  // Busca em largura a partir de todas as bordas (pilha explícita: sem recursão).
  const stack = new Int32Array(total);
  let top = 0;
  const seed = (index: number) => {
    if (!background[index] && isWhitish(index)) {
      background[index] = 1;
      stack[top++] = index;
    }
  };
  for (let x = 0; x < width; x++) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    seed(y * width);
    seed(y * width + width - 1);
  }
  while (top > 0) {
    const index = stack[--top];
    const x = index % width;
    if (x > 0) seed(index - 1);
    if (x < width - 1) seed(index + 1);
    if (index >= width) seed(index - width);
    if (index < total - width) seed(index + width);
  }

  for (let index = 0; index < total; index++) {
    const offset = index * 4;
    if (background[index]) {
      data[offset + 3] = 0;
      continue;
    }
    // Pixel do desenho encostado no fundo: alfa proporcional à distância do branco.
    const x = index % width;
    const touchesBackground =
      (x > 0 && background[index - 1]) ||
      (x < width - 1 && background[index + 1]) ||
      (index >= width && background[index - width]) ||
      (index < total - width && background[index + width]);
    if (!touchesBackground) continue;
    const distance = whiteDistance(data, offset);
    const coverage = Math.min(1, Math.max(0, (distance - tolerance) / (tolerance * 2)));
    if (coverage >= 1) continue;
    const alpha = Math.max(coverage, 0.05);
    // Tira o branco misturado na borda: c = (c' − 255·(1 − α)) / α.
    for (let channel = 0; channel < 3; channel++) {
      data[offset + channel] = (data[offset + channel] - 255 * (1 - alpha)) / alpha;
    }
    data[offset + 3] = Math.round(data[offset + 3] * coverage);
  }
  return data;
}

/** A imagem já tem transparência própria? (amostra até ~40 mil pixels) */
export function hasTransparency(data: Uint8ClampedArray): boolean {
  const pixels = data.length / 4;
  const step = Math.max(1, Math.floor(pixels / 40000));
  for (let index = 0; index < pixels; index += step) {
    if (data[index * 4 + 3] < 250) return true;
  }
  return false;
}

/** Cópia do canvas sem o fundo branco (no navegador). */
export function withoutWhiteBackground(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const output = document.createElement("canvas");
  output.width = canvas.width;
  output.height = canvas.height;
  const sourceCtx = canvas.getContext("2d", { willReadFrequently: true });
  const ctx = output.getContext("2d");
  if (!sourceCtx || !ctx) return canvas;
  const image = sourceCtx.getImageData(0, 0, canvas.width, canvas.height);
  const cleaned = removeWhiteBackground(image.data, canvas.width, canvas.height);
  ctx.putImageData(new ImageData(cleaned, canvas.width, canvas.height), 0, 0);
  return output;
}

export function canvasHasTransparency(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  return hasTransparency(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
}
