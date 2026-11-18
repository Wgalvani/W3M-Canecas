/**
 * Folha de prova para o cliente aprovar: marca W3M Studio, cliente/pedido,
 * as vistas da peça renderizadas em 3D e a ficha com as medidas de cada
 * estampa (o que vai para o DTF). Desenhada em canvas, no navegador.
 */
import { BRAND_NAME } from "@/components/Brand";

export interface ProofView {
  label: string;
  image: Blob;
}

export interface ProofPrint {
  area: string;
  file: string;
  size: string;
  note?: string;
}

export interface ProofData {
  client: string;
  order: string;
  garment: string;
  size: string;
  colorName: string;
  colorHex: string;
  /** Gola e acabamento em outra cor. */
  trimName?: string;
  trimHex?: string;
  views: ProofView[];
  prints: ProofPrint[];
  date: Date;
}

export const PROOF_SIZE = { width: 2400, height: 1600 } as const;
const MARGIN = 80;
const HEADER = 190;
const VIEWS_TOP = 220;
const VIEWS_HEIGHT = 900;
const GAP = 36;

/** Tamanho de cada vista na folha, para renderizar o 3D já na medida certa. */
export function proofViewSize(count: number): { width: number; height: number } {
  const width = Math.floor((PROOF_SIZE.width - 2 * MARGIN - (count - 1) * GAP) / Math.max(1, count));
  return { width, height: VIEWS_HEIGHT };
}

const PAPER = "#f3f1eb";
const INK = "#16181d";
const MUTED = "#6a6e77";
const LINE = "#dcd8cd";
const SIGNAL = "#ff5a1f";

function fontFamily(variable: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value ? `${value}, ${fallback}` : fallback;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Corta o texto com reticências para caber na largura. */
function fit(ctx: CanvasRenderingContext2D, text: string, width: number) {
  if (ctx.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut}…`;
}

function drawBrandMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 32, size / 32);
  ctx.fillStyle = INK;
  roundRect(ctx, 0, 0, 32, 32, 9);
  ctx.fill();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(243,241,235,0.3)";
  ctx.lineWidth = 1;
  ctx.stroke(new Path2D("M5 9V5h4M23 5h4v4M27 23v4h-4M9 27H5v-4"));
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 2.4;
  ctx.stroke(new Path2D("M8.5 11l3.7 10L16 13.6l3.8 7.4"));
  ctx.strokeStyle = SIGNAL;
  ctx.stroke(new Path2D("M19.8 21l3.7-10"));
  ctx.restore();
}

async function loadBitmap(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}

export async function renderProof(data: ProofData): Promise<Blob> {
  await document.fonts.ready;
  const display = fontFamily("--font-bricolage", "sans-serif");
  const sans = fontFamily("--font-plex-sans", "sans-serif");
  const mono = fontFamily("--font-plex-mono", "monospace");

  const canvas = document.createElement("canvas");
  canvas.width = PROOF_SIZE.width;
  canvas.height = PROOF_SIZE.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const { width, height } = PROOF_SIZE;

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);

  /* Cabeçalho */
  drawBrandMark(ctx, MARGIN, 60, 84);
  ctx.fillStyle = INK;
  ctx.textBaseline = "alphabetic";
  ctx.font = `600 50px ${display}`;
  const [brandStrong, brandLight] = BRAND_NAME.split(" ");
  ctx.fillText(brandStrong, MARGIN + 110, 112);
  const strongWidth = ctx.measureText(`${brandStrong} `).width;
  ctx.fillStyle = MUTED;
  ctx.font = `500 50px ${display}`;
  ctx.fillText(brandLight ?? "", MARGIN + 110 + strongWidth, 112);
  ctx.font = `500 22px ${mono}`;
  ctx.fillStyle = MUTED;
  ctx.fillText("PROVA DE ESTAMPA · DTF", MARGIN + 112, 140);

  ctx.textAlign = "right";
  ctx.fillStyle = INK;
  ctx.font = `600 46px ${display}`;
  ctx.fillText(fit(ctx, data.client || "Cliente", 1100), width - MARGIN, 104);
  ctx.font = `400 26px ${sans}`;
  ctx.fillStyle = MUTED;
  const dateText = data.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  ctx.fillText(data.order ? `Pedido ${data.order} · ${dateText}` : dateText, width - MARGIN, 142);
  ctx.textAlign = "left";

  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN, HEADER);
  ctx.lineTo(width - MARGIN, HEADER);
  ctx.stroke();

  /* Vistas */
  const view = proofViewSize(data.views.length);
  for (const [index, item] of data.views.entries()) {
    const x = MARGIN + index * (view.width + GAP);
    const gradient = ctx.createRadialGradient(x + view.width / 2, VIEWS_TOP + view.height * 0.3, 40, x + view.width / 2, VIEWS_TOP + view.height * 0.4, view.height);
    gradient.addColorStop(0, "#fffefa");
    gradient.addColorStop(1, "#e4e0d6");
    ctx.fillStyle = gradient;
    roundRect(ctx, x, VIEWS_TOP, view.width, view.height, 28);
    ctx.fill();
    const bitmap = await loadBitmap(item.image);
    ctx.save();
    roundRect(ctx, x, VIEWS_TOP, view.width, view.height, 28);
    ctx.clip();
    ctx.drawImage(bitmap, x, VIEWS_TOP, view.width, view.height);
    ctx.restore();
    bitmap.close();
    // Etiqueta da vista.
    ctx.font = `500 22px ${mono}`;
    const label = item.label.toUpperCase();
    const labelWidth = ctx.measureText(label).width + 36;
    ctx.fillStyle = INK;
    roundRect(ctx, x + 24, VIEWS_TOP + 24, labelWidth, 44, 22);
    ctx.fill();
    ctx.fillStyle = PAPER;
    ctx.fillText(label, x + 42, VIEWS_TOP + 54);
  }

  /* Ficha */
  const top = VIEWS_TOP + VIEWS_HEIGHT + 50;
  const columnGap = 60;
  const pieceWidth = 560;
  const approvalWidth = 620;
  const printsX = MARGIN + pieceWidth + columnGap;
  const printsWidth = width - 2 * MARGIN - pieceWidth - approvalWidth - 2 * columnGap;
  const approvalX = width - MARGIN - approvalWidth;

  const heading = (text: string, x: number) => {
    ctx.font = `500 20px ${mono}`;
    ctx.fillStyle = SIGNAL;
    ctx.fillText(text.toUpperCase(), x, top);
  };

  heading("Peça", MARGIN);
  ctx.fillStyle = INK;
  ctx.font = `600 36px ${display}`;
  ctx.fillText(fit(ctx, data.garment, pieceWidth), MARGIN, top + 52);
  ctx.font = `400 28px ${sans}`;
  ctx.fillStyle = MUTED;
  ctx.fillText(`Tamanho ${data.size}`, MARGIN, top + 98);
  ctx.fillStyle = data.colorHex;
  ctx.beginPath();
  ctx.arc(MARGIN + 18, top + 138, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(22,24,29,0.25)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fillText(fit(ctx, data.colorName, pieceWidth - 50), MARGIN + 50, top + 148);
  if (data.trimName && data.trimHex) {
    ctx.strokeStyle = data.trimHex;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(MARGIN + 18, top + 192, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = `400 24px ${sans}`;
    ctx.fillStyle = MUTED;
    ctx.fillText(fit(ctx, `Gola e acabamento: ${data.trimName}`, pieceWidth - 50), MARGIN + 50, top + 200);
  }

  heading("Estampas DTF", printsX);
  const rowHeight = data.prints.length > 4 ? 52 : 62;
  data.prints.slice(0, 6).forEach((print, index) => {
    const y = top + 50 + index * rowHeight;
    ctx.font = `600 28px ${sans}`;
    ctx.fillStyle = INK;
    ctx.fillText(print.area, printsX, y);
    ctx.font = `500 28px ${mono}`;
    ctx.textAlign = "right";
    ctx.fillText(print.size, printsX + printsWidth, y);
    ctx.textAlign = "left";
    ctx.font = `400 22px ${sans}`;
    ctx.fillStyle = MUTED;
    const detail = [print.file, print.note].filter(Boolean).join(" · ");
    ctx.fillText(fit(ctx, detail, printsWidth), printsX, y + 26);
  });
  if (data.prints.length === 0) {
    ctx.font = `400 28px ${sans}`;
    ctx.fillStyle = MUTED;
    ctx.fillText("Peça lisa (sem estampa).", printsX, top + 50);
  }

  heading("Aprovação do cliente", approvalX);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(approvalX, top + 120);
  ctx.lineTo(approvalX + approvalWidth, top + 120);
  ctx.stroke();
  ctx.font = `400 22px ${sans}`;
  ctx.fillStyle = MUTED;
  ctx.fillText("Assinatura / data", approvalX, top + 152);

  /* Rodapé */
  ctx.font = `400 21px ${sans}`;
  ctx.fillStyle = MUTED;
  ctx.fillText(
    "Simulação digital: cores, caimento e proporções são aproximados. Confira textos, posição e medidas antes de aprovar.",
    MARGIN,
    height - 44,
  );

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => {
      canvas.width = canvas.height = 0;
      if (blob) resolve(blob);
      else reject(new Error("proof"));
    }, "image/png"),
  );
}
