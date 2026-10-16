import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { A4_ART_GAP_MM, A4_BORDERLESS, CROP_MARKS, MUG_STANDARD, PRESETS } from "./constants";
import { clampFraming, imageRectMm, initialFraming, zoomAround } from "./framing";
import { assessQuality } from "./imageQuality";
import { formatAspectRatio, formatPresetSize, mmToPt, targetPixels } from "./measurements";
import { generateA4Pdf, generateArtPdf } from "./pdfGenerator";
import { a4BorderlessFits, a4Capacity, a4Counts, a4Sheet, sheetCutGuides, singleSheet, type Rect, type Segment, type SheetLayout } from "./sheetLayout";
import { isValidSideMm, parseCm, presetForSize } from "./artSize";
import { testRulerSpanCm } from "./testPattern";
import { mugShape } from "./mugShape";
import { crc32, withPngResolution } from "./png";

const preset = MUG_STANDARD;

describe("medidas", () => {
  it("21 × 9,5 cm a 300 PPI = 2480 × 1122 px", () => {
    expect(targetPixels(preset)).toEqual({ width: 2480, height: 1122 });
    expect(formatPresetSize(preset)).toBe("21 × 9,5 cm");
  });

  it("formata proporções", () => {
    expect(formatAspectRatio(4032, 3024)).toBe("4:3");
    expect(formatAspectRatio(3024, 4032)).toBe("3:4");
    expect(formatAspectRatio(1920, 1080)).toBe("16:9");
    expect(formatAspectRatio(2480, 1122)).toBe("2,21:1");
  });
});

describe("qualidade (seção 51 do PRD)", () => {
  const fill = initialFraming("fill");
  it.each([
    [4000, 2500, "excellent"],
    [1800, 900, "acceptable"],
    [600, 300, "low"],
  ])("%i × %i px → %s", (width, height, level) => {
    expect(assessQuality({ width, height }, preset, fill).level).toBe(level);
  });

  it("piora com o zoom, pois o recorte usado é menor", () => {
    const image = { width: 4000, height: 2500 };
    expect(assessQuality(image, preset, fill).level).toBe("excellent");
    expect(assessQuality(image, preset, { ...fill, zoom: 3 }).level).toBe("low");
  });
});

describe("enquadramento", () => {
  const image = { width: 4000, height: 3000 };

  it("Preencher cobre toda a área sem deformar", () => {
    const rect = imageRectMm(image, preset, initialFraming("fill"));
    expect(rect.width).toBeGreaterThanOrEqual(preset.widthMm - 1e-9);
    expect(rect.height).toBeGreaterThanOrEqual(preset.heightMm - 1e-9);
    expect(rect.width / rect.height).toBeCloseTo(4 / 3);
  });

  it("Encaixar mostra a imagem inteira", () => {
    const rect = imageRectMm(image, preset, initialFraming("fit"));
    expect(rect.height).toBeCloseTo(preset.heightMm);
    expect(rect.width).toBeLessThanOrEqual(preset.widthMm);
    expect(rect.x).toBeCloseTo((preset.widthMm - rect.width) / 2);
  });

  it("não deixa faixas vazias ao arrastar no modo Preencher", () => {
    const framing = clampFraming(image, preset, { ...initialFraming("fill"), offsetXMm: 500, offsetYMm: -500 });
    const rect = imageRectMm(image, preset, framing);
    expect(rect.x).toBeCloseTo(0);
    expect(rect.y).toBeLessThanOrEqual(0);
    expect(rect.x + rect.width).toBeGreaterThanOrEqual(preset.widthMm - 1e-9);
    expect(rect.y + rect.height).toBeCloseTo(preset.heightMm);
  });

  it("mantém a imagem dentro da área no modo Encaixar", () => {
    const framing = clampFraming(image, preset, { ...initialFraming("fit"), offsetXMm: 500 });
    const rect = imageRectMm(image, preset, framing);
    expect(rect.x + rect.width).toBeCloseTo(preset.widthMm);
  });

  it("limita o zoom entre 100% e 300%", () => {
    expect(clampFraming(image, preset, { ...initialFraming(), zoom: 10 }).zoom).toBe(3);
    expect(clampFraming(image, preset, { ...initialFraming(), zoom: 0.2 }).zoom).toBe(1);
  });

  it("zoom mantém o ponto âncora parado", () => {
    const anchor = { x: 40, y: 10 };
    const before = { ...initialFraming(), offsetXMm: 5 };
    const after = zoomAround(before, 2, anchor);
    const pointBefore = imageRectMm(image, preset, before);
    const pointAfter = imageRectMm(image, preset, after);
    // Coordenada (relativa à imagem) do ponto âncora deve ser a mesma.
    const u = (anchor.x + preset.widthMm / 2 - pointBefore.x) / pointBefore.width;
    const v = (anchor.x + preset.widthMm / 2 - pointAfter.x) / pointAfter.width;
    expect(v).toBeCloseTo(u);
  });
});

describe("PNG", () => {
  it("calcula CRC32 padrão", () => {
    expect(crc32(new TextEncoder().encode("IEND"))).toBe(0xae426082);
  });

  it("insere pHYs de 300 PPI logo após o IHDR", () => {
    const fakePng = new Uint8Array(33 + 12);
    const out = withPngResolution(fakePng, 300);
    const view = new DataView(out.buffer);
    expect(new TextDecoder().decode(out.subarray(37, 41))).toBe("pHYs");
    expect(view.getUint32(41)).toBe(11811);
    expect(out[49]).toBe(1);
    expect(out.length).toBe(fakePng.length + 21);
  });
});

/** Validações de registro que valem para qualquer folha. */
function expectValidCropMarks(layout: SheetLayout, minEdgeMm: number) {
  const marks = sheetCutGuides(layout);
  const edgesX = new Set(layout.arts.flatMap((a) => [a.x, a.x + a.width]));
  const edgesY = new Set(layout.arts.flatMap((a) => [a.y, a.y + a.height]));
  const intersects = (m: Segment, r: Rect) =>
    Math.max(m.x1, m.x2) > r.x && Math.min(m.x1, m.x2) < r.x + r.width &&
    Math.max(m.y1, m.y2) > r.y && Math.min(m.y1, m.y2) < r.y + r.height;

  for (const mark of marks) {
    // Nunca sobre a arte.
    for (const art of layout.arts) expect(intersects(mark, art)).toBe(false);
    // Dentro da folha e fora da faixa que a impressora não imprime.
    for (const x of [mark.x1, mark.x2]) {
      expect(x).toBeGreaterThanOrEqual(minEdgeMm);
      expect(x).toBeLessThanOrEqual(layout.widthMm - minEdgeMm);
    }
    for (const y of [mark.y1, mark.y2]) {
      expect(y).toBeGreaterThanOrEqual(minEdgeMm);
      expect(y).toBeLessThanOrEqual(layout.heightMm - minEdgeMm);
    }
    // Alinhada exatamente com uma borda da arte.
    if (mark.x1 === mark.x2) expect(edgesX.has(mark.x1)).toBe(true);
    else expect(edgesY.has(mark.y1)).toBe(true);
    const length = Math.hypot(mark.x2 - mark.x1, mark.y2 - mark.y1);
    expect(length).toBeGreaterThanOrEqual(CROP_MARKS.minLengthMm - 1e-9);
    expect(length).toBeLessThanOrEqual(CROP_MARKS.lengthMm + 1e-9);
  }
  // Cada linha de corte tem pelo menos 2 pontos de alinhamento (um de cada lado).
  for (const x of edgesX) expect(marks.filter((m) => m.x1 === m.x2 && m.x1 === x).length).toBeGreaterThanOrEqual(2);
  for (const y of edgesY) expect(marks.filter((m) => m.y1 === m.y2 && m.y1 === y).length).toBeGreaterThanOrEqual(2);
  return marks;
}

describe("marcas de corte", () => {
  it("arte avulsa (PNG / PDF individual): 8 marcas, distância entre elas = 21 × 9,5 cm", () => {
    const layout = singleSheet(preset);
    expect(layout.widthMm).toBe(230);
    expect(layout.heightMm).toBe(115);
    const marks = expectValidCropMarks(layout, 0);
    expect(marks).toHaveLength(8);
    const verticalXs = [...new Set(marks.filter((m) => m.x1 === m.x2).map((m) => m.x1))];
    const horizontalYs = [...new Set(marks.filter((m) => m.y1 === m.y2).map((m) => m.y1))];
    expect(Math.max(...verticalXs) - Math.min(...verticalXs)).toBe(210);
    expect(Math.max(...horizontalYs) - Math.min(...horizontalYs)).toBe(95);
  });

  it("arte avulsa mantém as marcas no tamanho padrão (2 mm da arte, 5 mm de comprimento)", () => {
    for (const mark of sheetCutGuides(singleSheet(preset))) {
      expect(Math.hypot(mark.x2 - mark.x1, mark.y2 - mark.y1)).toBeCloseTo(CROP_MARKS.lengthMm);
    }
  });

  it("A4 paisagem com 2 artes: espaço entre elas, centralizadas e marcas imprimíveis", () => {
    const layout = a4Sheet(preset, 2);
    expect([layout.widthMm, layout.heightMm]).toEqual([297, 210]);
    const [a, b] = layout.arts;
    expect(a.x).toBeCloseTo((297 - 210) / 2);
    expect(b.y - (a.y + a.height)).toBeCloseTo(A4_ART_GAP_MM);
    expect(a.y).toBeCloseTo(210 - (b.y + b.height));
    // Impressoras comuns não imprimem os ~3 mm junto à borda.
    const marks = expectValidCropMarks(layout, CROP_MARKS.printerMarginMm);
    // 2 linhas verticais × (acima + no espaço + abaixo) + 4 horizontais × (esquerda + direita)
    expect(marks).toHaveLength(14);
    const inGap = marks.filter((m) => m.x1 === m.x2 && Math.min(m.y1, m.y2) > a.y + a.height && Math.max(m.y1, m.y2) < b.y);
    expect(inGap).toHaveLength(2);
  });

  it("A4 em pé sem margem: 3 artes de 21 × 9,5 cm de borda a borda, com linhas-guia nos espaços", () => {
    const layout = a4Sheet(preset, 3);
    expect([layout.widthMm, layout.heightMm]).toEqual([210, 297]);
    expect(layout.guide).toBe("cut-lines");
    expect(layout.arts).toHaveLength(3);
    const [a, b, c] = layout.arts;
    expect(a.x).toBe(0);
    expect(b.y - (a.y + a.height)).toBeCloseTo(A4_BORDERLESS.gapMm);
    expect(a.y).toBeCloseTo(297 - (c.y + c.height));
    const lines = sheetCutGuides(layout);
    // Arte da largura do papel: só cortes horizontais, de ponta a ponta, sem tocar a arte.
    expect(lines.every((l) => l.y1 === l.y2 && l.x1 === 0 && l.x2 === 210)).toBe(true);
    const ys = lines.map((l) => l.y1);
    expect(ys).toHaveLength(4);
    expect(ys[0]).toBeCloseTo(a.y - A4_BORDERLESS.gapMm / 2);
    expect(ys[1]).toBeCloseTo(a.y + a.height + A4_BORDERLESS.gapMm / 2);
    expect(ys[3]).toBeCloseTo(c.y + c.height + A4_BORDERLESS.gapMm / 2);
    for (const y of ys) for (const art of layout.arts) expect(y < art.y || y > art.y + art.height).toBe(true);
  });

  it("A4 sem margem com arte mais estreita que o papel ganha linhas-guia verticais", () => {
    const layout = a4Sheet(presetForSize(200, 90), 3);
    const vertical = sheetCutGuides(layout).filter((l) => l.x1 === l.x2);
    expect(vertical.map((l) => l.x1)).toEqual([5 - A4_BORDERLESS.gapMm / 2, 205 + A4_BORDERLESS.gapMm / 2]);
  });

  it("3 artes só são oferecidas quando cabem na A4 em pé", () => {
    expect(a4Counts(MUG_STANDARD)).toEqual([1, 2, 3]);
    expect(a4BorderlessFits(presetForSize(210, 97))).toBe(true);
    expect(a4Counts(presetForSize(210, 97))).toEqual([1, 3]);
    expect(a4BorderlessFits(presetForSize(210, 98))).toBe(false);
    expect(a4BorderlessFits(presetForSize(211, 90))).toBe(false);
    // Sem caber, pedir 3 volta à folha paisagem.
    expect(a4Sheet(presetForSize(210, 98), 3).guide).toBe("crop-marks");
  });

  it("A4 paisagem com 1 arte", () => {
    const layout = a4Sheet(preset, 1);
    expect(layout.arts[0].y).toBeCloseTo((210 - 95) / 2);
    expect(expectValidCropMarks(layout, 3)).toHaveLength(8);
  });
});

describe("PDF", () => {
  // PNG 1×1 válido
  const png = Uint8Array.from(
    atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="),
    (c) => c.charCodeAt(0),
  );

  async function inspect(bytes: Uint8Array) {
    const doc = await PDFDocument.load(bytes);
    const page = doc.getPage(0);
    const contents = page.node.Contents();
    const refs = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
    const ops = refs
      .map((ref) => doc.context.lookup(ref))
      .filter((stream): stream is PDFRawStream => stream instanceof PDFRawStream)
      .map((stream) => new TextDecoder().decode(decodePDFRawStream(stream).decode()))
      .join("\n");
    return {
      ops,
      size: page.getSize(),
      lines: (ops.match(/ l\b/g) ?? []).length,
      images: (ops.match(/ Do\b/g) ?? []).length,
      // Escala aplicada a cada imagem: a matriz "w 0 0 h 0 0 cm" (seguida do skew nulo) antes do Do.
      imageSizes: [...ops.matchAll(/([\d.]+) 0 0 ([\d.]+) 0 0 cm\s+1 0 0 1 0 0 cm\s+\/\S+ Do/g)].map((m) => ({ width: +m[1], height: +m[2] })),
    };
  }

  it.each([1, 2, 3])("PDF A4 com %i arte(s): cada arte desenhada em exatos 21 × 9,5 cm", async (count) => {
    const { imageSizes } = await inspect(await generateA4Pdf(png, preset, count));
    expect(imageSizes).toHaveLength(count);
    for (const size of imageSizes) {
      expect(size.width).toBeCloseTo(mmToPt(210), 2);
      expect(size.height).toBeCloseTo(mmToPt(95), 2);
    }
  });

  it("PDF A4 paisagem traz a régua de conferência de 10 cm", async () => {
    const { ops } = await inspect(await generateA4Pdf(png, preset, 2));
    const vertical = [...ops.matchAll(/([\d.]+) ([\d.]+) m\s+([\d.]+) ([\d.]+) l/g)]
      .map((m) => m.slice(1).map(Number))
      .filter(([x1, y1, x2, y2]) => Math.abs(x1 - x2) < 1e-3 && Math.abs(y1 - y2) > 1);
    expect(vertical.some(([, y1, , y2]) => Math.abs(Math.abs(y1 - y2) - mmToPt(100)) < 1e-2)).toBe(true);
  });

  it("PDF individual: 230 × 115 mm, 1 arte e 8 marcas", async () => {
    const { size, lines, images } = await inspect(await generateArtPdf(png, preset));
    expect(size.width).toBeCloseTo(mmToPt(230));
    expect(size.height).toBeCloseTo(mmToPt(115));
    expect(images).toBe(1);
    expect(lines).toBe(8);
  });

  it("PDF A4: paisagem, 2 artes, 14 marcas e a régua (1 linha + 11 traços)", async () => {
    const { size, lines, images } = await inspect(await generateA4Pdf(png, preset, 2));
    expect(size.width).toBeCloseTo(mmToPt(297));
    expect(size.height).toBeCloseTo(mmToPt(210));
    expect(images).toBe(2);
    expect(lines).toBe(14 + 12);
  });
});

describe("PDF A4 sem margem", () => {
  const png = Uint8Array.from(
    atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="),
    (c) => c.charCodeAt(0),
  );

  it("sai em pé, 210 × 297 mm", async () => {
    const doc = await PDFDocument.load(await generateA4Pdf(png, preset, 3));
    const size = doc.getPage(0).getSize();
    expect(size.width).toBeCloseTo(mmToPt(210));
    expect(size.height).toBeCloseTo(mmToPt(297));
  });
});

describe("tamanho escolhido pelo usuário", () => {
  it("lê cm com vírgula ou ponto, com até 1 casa decimal", () => {
    expect(parseCm("9,5")).toBe(95);
    expect(parseCm(" 21 ")).toBe(210);
    expect(parseCm("20.3")).toBe(203);
    expect(parseCm("9,55")).toBeNull();
    expect(parseCm("abc")).toBeNull();
    expect(parseCm("")).toBeNull();
  });

  it("aceita lados de 5 a 30 cm", () => {
    expect(isValidSideMm(50)).toBe(true);
    expect(isValidSideMm(300)).toBe(true);
    expect(isValidSideMm(49)).toBe(false);
    expect(isValidSideMm(301)).toBe(false);
  });

  it("reconhece o preset padrão e cria um personalizado com PPI e área segura do padrão", () => {
    expect(presetForSize(210, 95)).toBe(MUG_STANDARD);
    const custom = presetForSize(200, 91);
    expect(custom).toMatchObject({ id: "personalizado", widthMm: 200, heightMm: 91, ppi: 300, safeMarginMm: 3 });
    expect(custom.warning).toBeUndefined();
    expect(targetPixels(custom)).toEqual({ width: 2362, height: 1075 });
    expect(formatPresetSize(custom)).toBe("20 × 9,1 cm");
  });

  it("atalhos têm medidas válidas, ids e tamanhos distintos (o tamanho identifica o atalho)", () => {
    for (const option of PRESETS) {
      expect(isValidSideMm(option.widthMm) && isValidSideMm(option.heightMm)).toBe(true);
      expect(presetForSize(option.widthMm, option.heightMm)).toBe(option);
    }
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    expect(PRESETS[0]).toBe(MUG_STANDARD);
  });

  it("calcula quantas artes cabem na A4 paisagem", () => {
    expect(a4Capacity(MUG_STANDARD)).toBe(2);
    expect(a4Capacity(presetForSize(200, 96))).toBe(2);
    expect(a4Capacity(presetForSize(200, 97))).toBe(1);
    expect(a4Capacity(presetForSize(285, 198))).toBe(1);
    expect(a4Capacity(presetForSize(286, 90))).toBe(0);
    expect(a4Capacity(presetForSize(200, 199))).toBe(0);
  });

  it("A4 nunca coloca mais artes do que cabem, e as marcas continuam imprimíveis", () => {
    const tall = presetForSize(150, 150);
    const layout = a4Sheet(tall, 2);
    expect(layout.arts).toHaveLength(1);
    expectValidCropMarks(layout, CROP_MARKS.printerMarginMm);
  });

  it.each([
    [285, 96, 2],
    [285, 198, 1],
    [50, 50, 2],
  ])("A4 com arte de %i × %i mm (%i) tem marcas válidas", (w, h, count) => {
    const layout = a4Sheet(presetForSize(w, h), count);
    expect(layout.arts).toHaveLength(count);
    expectValidCropMarks(layout, CROP_MARKS.printerMarginMm);
  });

  it("arte avulsa em retrato mantém a distância entre marcas igual ao tamanho", () => {
    const marks = expectValidCropMarks(singleSheet(presetForSize(100, 250)), 0);
    const xs = marks.filter((m) => m.x1 === m.x2).map((m) => m.x1);
    const ys = marks.filter((m) => m.y1 === m.y2).map((m) => m.y1);
    expect(Math.max(...xs) - Math.min(...xs)).toBe(100);
    expect(Math.max(...ys) - Math.min(...ys)).toBe(250);
  });

  it("PDF A4 de uma arte larga demais para a nota lateral sai sem erro", async () => {
    const png = Uint8Array.from(
      atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="),
      (c) => c.charCodeAt(0),
    );
    const doc = await PDFDocument.load(await generateA4Pdf(png, presetForSize(285, 90), 2));
    expect(doc.getPageCount()).toBe(1);
  });

  it("trecho de conferência da arte de teste cabe na régua", () => {
    expect(testRulerSpanCm(MUG_STANDARD)).toEqual([5, 15]);
    expect(testRulerSpanCm(presetForSize(120, 80))).toEqual([0, 12]);
    expect(testRulerSpanCm(presetForSize(55, 50))).toEqual([0, 5]);
  });
});

describe("formato do objeto no 3D", () => {
  it("caneca 325 ml usa as medidas reais; a arte cheia cobre ~82% da volta", () => {
    const shape = mugShape(MUG_STANDARD);
    expect(shape).toMatchObject({ diameterMm: 82, heightMm: 95 });
    expect(shape.wrap).toBeCloseTo(210 / (Math.PI * 82));
  });

  it("sem medidas do objeto, estima um cilindro com folga acima e abaixo da arte", () => {
    const shape = mugShape(presetForSize(200, 85));
    expect(shape.wrap).toBeCloseTo(0.82);
    expect(shape.heightMm).toBe(95);
  });

  it("a arte nunca passa da volta inteira nem é mais alta que o objeto", () => {
    const shape = mugShape({ ...MUG_STANDARD, widthMm: 300, heightMm: 120 });
    expect(shape.wrap).toBeLessThanOrEqual(0.92);
    expect(shape.heightMm).toBeGreaterThanOrEqual(120);
  });
});
