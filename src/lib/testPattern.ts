import type { ProductPreset } from "@/types/image";
import { AppError } from "./errors";
import { formatCm, targetPixels } from "./measurements";

/** Altura de referência do desenho (a caneca padrão); artes menores reduzem o conjunto. */
const LAYOUT_HEIGHT_MM = 95;

/**
 * Trecho da régua indicado para conferir a escala: 5 → 15 cm quando a arte
 * tem pelo menos 15 cm de largura; senão, do 0 até o último centímetro inteiro.
 */
export function testRulerSpanCm(preset: ProductPreset): [number, number] {
  const widthCm = preset.widthMm / 10;
  return widthCm >= 15 ? [5, 15] : [0, Math.floor(widthCm)];
}

/**
 * Gera a arte de teste das seções 49/50 do PRD: régua com marcas em cm
 * (para medir a escala impressa) e texto/seta (para conferir o espelhamento).
 * O conteúdo é centralizado na vertical e reduzido para caber em qualquer tamanho.
 */
export async function createTestPatternFile(preset: ProductPreset): Promise<File> {
  const { width, height } = targetPixels(preset);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new AppError("out-of-memory");

  const pxPerMm = width / preset.widthMm;
  const mm = (value: number) => value * pxPerMm;
  const scale = Math.min(1, preset.heightMm / LAYOUT_HEIGHT_MM);
  const top = (preset.heightMm - LAYOUT_HEIGHT_MM * scale) / 2;
  /** Posição vertical do desenho de referência (0–95 mm) convertida para pixels. */
  const y = (layoutMm: number) => mm(top + layoutMm * scale);

  /** Texto centralizado, com a fonte reduzida se não couber em 92% da largura. */
  const fillFitted = (text: string, sizeMm: number, atY: number, weight = "") => {
    ctx.font = `${weight} ${mm(sizeMm * scale)}px sans-serif`;
    const fit = Math.min(1, (width * 0.92) / ctx.measureText(text).width);
    ctx.font = `${weight} ${mm(sizeMm * scale) * fit}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(text, width / 2, atY);
  };

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#111111";
  ctx.strokeStyle = "#111111";
  ctx.textBaseline = "alphabetic";

  fillFitted("TESTE 123 ABC →", 12, y(24), "bold");
  fillFitted(`LINHA DE TESTE — ${formatCm(preset.widthMm)} cm`, 5, y(36));

  // Régua: linha de ponta a ponta com marcas a cada 1 cm.
  const rulerY = y(58);
  ctx.lineWidth = mm(0.3);
  ctx.beginPath();
  ctx.moveTo(0, rulerY);
  ctx.lineTo(width, rulerY);
  ctx.stroke();

  const totalCm = preset.widthMm / 10;
  for (let cm = 0; cm <= Math.floor(totalCm); cm++) {
    const x = Math.min(mm(cm * 10), width - ctx.lineWidth / 2);
    const major = cm % 5 === 0;
    ctx.beginPath();
    ctx.moveTo(x, rulerY);
    ctx.lineTo(x, rulerY + mm((major ? 8 : 4) * scale));
    ctx.stroke();
  }

  // Rótulos a cada 5 cm, mais os do trecho de conferência (que pode não ser múltiplo de 5).
  const [spanFrom, spanTo] = testRulerSpanCm(preset);
  const labels = new Set<number>([spanFrom, spanTo]);
  for (let cm = 0; cm <= totalCm; cm += 5) labels.add(cm);
  ctx.font = `${mm(4 * scale)}px sans-serif`;
  for (const cm of labels) {
    // O rótulo do fim da arte fica acima da linha; aqui só os que não encostam nele.
    if (cm > 0 && totalCm - cm < 1.5) continue;
    ctx.textAlign = cm === 0 ? "left" : "center";
    ctx.fillText(`${cm} cm`, mm(cm * 10), rulerY + mm(14 * scale));
  }
  ctx.textAlign = "right";
  ctx.fillText(`${formatCm(preset.widthMm)} cm`, width, rulerY - mm(3 * scale));

  fillFitted(
    `Meça com régua entre as marcas de ${spanFrom} cm e ${spanTo} cm: deve dar exatamente ${spanTo - spanFrom} cm.`,
    3.5,
    y(88),
  );

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new AppError("out-of-memory"))), "image/png"),
  );
  canvas.width = 0;
  canvas.height = 0;
  return new File([blob], "arte-de-teste.png", { type: "image/png" });
}
