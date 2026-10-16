import { PDFDocument, PrintScaling, StandardFonts, rgb, type PDFPage } from "pdf-lib";
import type { ProductPreset } from "@/types/image";
import { A4_BORDERLESS, CROP_MARKS } from "./constants";
import { MM_PER_INCH, formatCm, formatPresetSize, mmToPt } from "./measurements";
import { a4Sheet, sheetCutGuides, singleSheet, type SheetLayout } from "./sheetLayout";

async function createDocument(title: string) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator("W3M Studio");
  pdf.setProducer("W3M Studio");
  // Pede ao leitor de PDF para imprimir sem "ajustar à página".
  pdf.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
  return pdf;
}

/** Desenha as artes e as marcas de corte ou linhas-guia (vetoriais) de uma folha. */
async function generateSheetPdf(png: Uint8Array, layout: SheetLayout, title: string) {
  const pdf = await createDocument(title);
  const image = await pdf.embedPng(png);
  const page = pdf.addPage([mmToPt(layout.widthMm), mmToPt(layout.heightMm)]);
  // O PDF mede y a partir de baixo; o layout, a partir de cima.
  const y = (topMm: number) => mmToPt(layout.heightMm - topMm);

  for (const art of layout.arts) {
    page.drawImage(image, {
      x: mmToPt(art.x),
      y: y(art.y + art.height),
      width: mmToPt(art.width),
      height: mmToPt(art.height),
    });
  }
  for (const mark of sheetCutGuides(layout)) {
    page.drawLine({
      start: { x: mmToPt(mark.x1), y: y(mark.y1) },
      end: { x: mmToPt(mark.x2), y: y(mark.y2) },
      thickness: mmToPt(CROP_MARKS.strokeMm),
      color: rgb(0, 0, 0),
    });
  }
  return { pdf, page };
}

/** PDF com a arte no tamanho escolhido e margem para as marcas de corte. */
export async function generateArtPdf(png: Uint8Array, preset: ProductPreset): Promise<Uint8Array> {
  const { pdf } = await generateSheetPdf(png, singleSheet(preset), `Arte para caneca ${formatPresetSize(preset)}`);
  return pdf.save();
}

/**
 * Folha A4 com cópias da arte em tamanho real: 1 ou 2 na paisagem com marcas de
 * corte, ou 3 na folha em pé sem margem com linhas-guia.
 */
export async function generateA4Pdf(png: Uint8Array, preset: ProductPreset, count: number): Promise<Uint8Array> {
  const layout = a4Sheet(preset, count);
  const { pdf, page } = await generateSheetPdf(png, layout, `Arte para caneca ${formatPresetSize(preset)} - A4`);
  if (layout.guide === "cut-lines") await drawBorderlessNotes(pdf, page, layout, preset);
  else await drawPrintNotes(pdf, page, layout, preset);
  return pdf.save();
}

/** Folha sem margem: uma linha de instrução nas sobras de cima e de baixo, que saem no corte. */
async function drawBorderlessNotes(pdf: PDFDocument, page: PDFPage, layout: SheetLayout, preset: ProductPreset) {
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const color = rgb(0.4, 0.4, 0.4);
  const first = layout.arts[0];
  const last = layout.arts[layout.arts.length - 1];
  const guide = A4_BORDERLESS.gapMm / 2;
  const notes: Array<[string, number, number]> = [
    // [texto, início da faixa livre, fim da faixa livre] em mm a partir do topo
    ["IMPRIMIR EM TAMANHO REAL (100%) E SEM MARGEM (BORDERLESS)", 0, first.y - guide],
    [`Cortar sobre as linhas · cada arte: ${formatPresetSize(preset)}`, last.y + last.height + guide, layout.heightMm],
  ];
  for (const [text, from, to] of notes) {
    const band = to - from;
    // Texto ocupa até metade da faixa, longe da linha e da borda do papel.
    const size = Math.min(6, mmToPt(band / 2) / 0.72);
    if (size < 3) continue;
    const width = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: (mmToPt(layout.widthMm) - width) / 2,
      y: mmToPt(layout.heightMm - (from + to) / 2) - (size * 0.72) / 2,
      size,
      font,
      color,
    });
  }
}

/** Comprimento da régua de conferência impressa na margem da folha paisagem. */
const SCALE_RULER_MM = 100;

/**
 * Instruções e régua de 10 cm na margem esquerda, longe das marcas de corte.
 * A régua denuncia o "ajustar à área imprimível" do diálogo de impressão, que
 * reduz a folha inteira em ~3% sem avisar.
 */
async function drawPrintNotes(pdf: PDFDocument, page: PDFPage, layout: SheetLayout, preset: ProductPreset) {
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const color = rgb(0.4, 0.4, 0.4);
  const rulerNote: [string, typeof font] = ["Régua abaixo: deve medir 10 cm", bold];
  const lines: Array<[string, typeof font]> = [
    ["IMPRIMIR EM", bold],
    ["TAMANHO REAL (100%)", bold],
    ["Não usar \"Ajustar à página\"", font],
    ["nem \"Ajustar à área imprimível\".", font],
    ["", font],
    ["Conferência da escala:", bold],
    [`entre marcas verticais: ${formatCm(preset.widthMm)} cm`, font],
    [`entre marcas horizontais: ${formatCm(preset.heightMm)} cm`, font],
    ["", font],
    rulerNote,
  ];

  const left = 6;
  // Espaço livre até o início das marcas laterais.
  const available = layout.arts[0].x - CROP_MARKS.offsetMm - CROP_MARKS.lengthMm - left - 2;
  const widest = Math.max(...lines.map(([text, f]) => f.widthOfTextAtSize(text, 1)));
  const size = Math.min(7, mmToPt(available) / widest);
  // Arte larga demais deixa a margem estreita: abaixo disso o texto seria ilegível.
  if (size < 4) return;
  const top = layout.arts[0].y + 12;
  const lineMm = (size * 1.4 * MM_PER_INCH) / 72;

  // A régua fica abaixo do texto e precisa caber antes da faixa não imprimível.
  const rulerTop = top + lines.length * lineMm;
  const rulerFits = rulerTop + SCALE_RULER_MM <= layout.heightMm - CROP_MARKS.printerMarginMm - 2;
  const notes = rulerFits ? lines : lines.slice(0, -2);

  notes.forEach(([text, f], index) => {
    page.drawText(text, {
      x: mmToPt(left),
      y: mmToPt(layout.heightMm - top) - index * size * 1.4,
      size,
      font: f,
      color,
    });
  });
  if (rulerFits) drawScaleRuler(page, layout, left + 1, rulerTop);
}

/** Régua vertical de 10 cm com traços a cada 1 cm (maiores em 0, 5 e 10). */
function drawScaleRuler(page: PDFPage, layout: SheetLayout, xMm: number, topMm: number) {
  const color = rgb(0, 0, 0);
  const thickness = mmToPt(CROP_MARKS.strokeMm);
  const y = (mm: number) => mmToPt(layout.heightMm - mm);
  page.drawLine({ start: { x: mmToPt(xMm), y: y(topMm) }, end: { x: mmToPt(xMm), y: y(topMm + SCALE_RULER_MM) }, thickness, color });
  for (let cm = 0; cm <= SCALE_RULER_MM / 10; cm++) {
    const tick = cm % 5 === 0 ? 4 : 2;
    const at = y(topMm + cm * 10);
    page.drawLine({ start: { x: mmToPt(xMm), y: at }, end: { x: mmToPt(xMm + tick), y: at }, thickness, color });
  }
}
