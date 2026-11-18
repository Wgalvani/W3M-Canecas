import { describe, expect, it } from "vitest";
import type { Placement } from "@/types/garment";
import {
  AREA_ORDER,
  armholeCut,
  availableAreas,
  collarY,
  GARMENT_SIZES,
  GARMENTS,
  fabricColorName,
  garmentDims,
  garmentSpec,
  neckPoint,
  printAreas,
  torsoProfile,
} from "./garments";
import {
  alignToCollar,
  clampPlacement,
  COLLAR_GUIDE_CM,
  defaultPlacement,
  distanceFromCollar,
  formatPrintSize,
  frameCoords,
  framePoint,
  frameRight,
  maxWidthFor,
  MIN_PRINT_CM,
} from "./placement";
import { hasTransparency, removeWhiteBackground } from "./removeWhite";

const tee = garmentSpec("camiseta");
const areas = printAreas(tee, "M");

describe("catálogo de peças", () => {
  it("tem camisetas, 7 regatas e moletons, com 4 tamanhos crescentes", () => {
    expect(GARMENTS.filter((g) => g.category === "camisetas").map((g) => g.id)).toEqual(["camiseta", "gola-v", "baby-look"]);
    expect(GARMENTS.filter((g) => g.category === "regatas")).toHaveLength(7);
    expect(GARMENTS.filter((g) => g.category === "moletons").map((g) => g.id)).toEqual(["moletom", "moletom-capuz"]);
    for (const garment of GARMENTS) {
      const chests = GARMENT_SIZES.map((size) => garment.sizes[size].chestCm);
      expect([...chests].sort((a, b) => a - b)).toEqual(chests);
    }
  });

  it("baby look é mais acinturada que a camiseta", () => {
    const baby = garmentSpec("baby-look");
    const babyDims = garmentDims(baby, "M");
    const teeDims = garmentDims(tee, "M");
    const ratio = (spec: typeof tee, dims: typeof teeDims) =>
      torsoProfile(spec, dims, dims.yokeFront * 0.4).a / torsoProfile(spec, dims, dims.yokeFront * 0.75).a;
    expect(ratio(baby, babyDims)).toBeLessThan(ratio(tee, teeDims) - 0.05);
  });

  it("gola V desce mais na frente que a gola redonda", () => {
    const v = garmentSpec("gola-v");
    expect(neckPoint(v, garmentDims(v, "M"), 0)[1]).toBeLessThan(neckPoint(tee, garmentDims(tee, "M"), 0)[1] - 5);
    // Nas costas as duas ficam no topo.
    expect(neckPoint(v, garmentDims(v, "M"), Math.PI)[1]).toBeCloseTo(garmentDims(v, "M").neckBack);
  });

  it("nomeia cores do catálogo e personalizadas", () => {
    expect(fabricColorName("#1B1C1F")).toBe("Preto");
    expect(fabricColorName("#123456")).toBe("Personalizada (#123456)");
  });
});

describe("regatas", () => {
  const machao = garmentSpec("regata-machao");
  const cut = machao.tank!;

  it("não têm manga: só frente, costas e peito", () => {
    expect(availableAreas(machao)).toEqual(["front", "back", "chest"]);
    expect(availableAreas(tee)).toEqual(AREA_ORDER);
  });

  it("a cava vaza na lateral, logo abaixo do ombro", () => {
    expect(armholeCut(cut, 0, -5, 15)).toBeLessThan(0);
  });

  it("frente e costas no centro continuam com tecido", () => {
    expect(armholeCut(cut, -26, -5, 15)).toBeGreaterThan(0);
    expect(armholeCut(cut, 26, -5, 15)).toBeGreaterThan(0);
  });

  it("a alça junto à gola fica inteira e a cava termina na profundidade definida", () => {
    expect(armholeCut(cut, 0, 14, 15)).toBeGreaterThan(0);
    expect(armholeCut(cut, 0, -cut.armholeDepthCm - 1, 15)).toBeGreaterThan(0);
  });

  it("nadador é bem mais cavada nas costas que na frente", () => {
    const racer = garmentSpec("regata-nadador").tank!;
    expect(armholeCut(racer, 15, -2, 15)).toBeLessThan(0);
    expect(armholeCut(racer, -15, -2, 15)).toBeGreaterThan(0);
  });

  it("longline desce a barra sem subir o ombro", () => {
    const longline = garmentDims(garmentSpec("regata-longline"), "M");
    const regular = garmentDims(garmentSpec("regata-cavada"), "M");
    expect(longline.length).toBeGreaterThan(regular.length + 5);
    expect(longline.length - longline.yokeSide).toBeCloseTo(regular.length - regular.yokeSide, 0);
  });
});

describe("áreas de estampa", () => {
  it("todas as peças têm as áreas que usam, com a origem dentro dos limites", () => {
    for (const garment of GARMENTS) {
      for (const size of GARMENT_SIZES) {
        const all = printAreas(garment, size);
        for (const id of availableAreas(garment)) {
          const { bounds, maxWidthCm, maxHeightCm } = all[id];
          expect(bounds.minX).toBeLessThan(0);
          expect(bounds.maxX).toBeGreaterThan(0);
          expect(bounds.minY).toBeLessThan(0);
          expect(bounds.maxY).toBeGreaterThan(0);
          expect(maxWidthCm).toBeGreaterThan(MIN_PRINT_CM);
          expect(maxHeightCm).toBeGreaterThan(MIN_PRINT_CM);
        }
      }
    }
  });

  it("frente da camiseta M aceita uma estampa A3 em pé (29,7 × 42 cm)", () => {
    expect(maxWidthFor(areas.front, 29.7 / 42)).toBeGreaterThanOrEqual(29.6);
  });

  it("no moletom com capuz a frente fica acima do bolso", () => {
    const hoodie = garmentSpec("moletom-capuz");
    const front = printAreas(hoodie, "M").front;
    expect(front.frame.origin[1] + front.bounds.minY).toBeGreaterThan(garmentDims(hoodie, "M").pocketTop);
  });

  it("escudo fica no peito esquerdo de quem veste (+x)", () => {
    expect(areas.chest.frame.origin[0]).toBeGreaterThan(0);
  });

  it("direita do plano: frente +x, costas −x", () => {
    expect(frameRight(areas.front.frame)).toEqual([1, 0, 0]);
    expect(frameRight(areas.back.frame).map((n) => n + 0)).toEqual([-1, 0, 0]);
  });

  it("converte ponto ↔ plano nas mangas", () => {
    const frame = areas["sleeve-left"].frame;
    const point = framePoint(frame, 1.5, -2);
    const coords = frameCoords(frame, point);
    expect(coords.x).toBeCloseTo(1.5);
    expect(coords.y).toBeCloseTo(-2);
  });
});

describe("posição da estampa", () => {
  const base = (patch: Partial<Placement> = {}): Placement => ({
    id: "p",
    designId: "d",
    area: "front",
    x: 0,
    y: 0,
    widthCm: 26,
    rotationDeg: 0,
    ...patch,
  });

  it("estampa padrão cabe e fica no centro da frente", () => {
    const placement = defaultPlacement("p", "d", areas.front, 1);
    expect(placement).toMatchObject({ x: 0, y: 0, widthCm: 26 });
  });

  it("desenho muito alto tem a largura reduzida para caber na altura", () => {
    const aspect = 0.25;
    const placement = defaultPlacement("p", "d", areas.front, aspect);
    expect(placement.widthCm / aspect).toBeLessThanOrEqual(areas.front.maxHeightCm + 1e-9);
  });

  it("não deixa arrastar para fora da área", () => {
    const placement = clampPlacement(base({ x: 999, y: -999 }), areas.front, 1);
    expect(placement.x + 13).toBeCloseTo(areas.front.bounds.maxX);
    expect(placement.y - 13).toBeCloseTo(areas.front.bounds.minY);
  });

  it("considera a rotação (45° ocupa mais espaço)", () => {
    const straight = clampPlacement(base({ x: 999, widthCm: 10 }), areas.front, 1);
    const turned = clampPlacement(base({ x: 999, widthCm: 10, rotationDeg: 45 }), areas.front, 1);
    expect(turned.x).toBeLessThan(straight.x);
  });

  it("respeita a largura mínima e máxima", () => {
    expect(clampPlacement(base({ widthCm: 0.2 }), areas.chest, 1).widthCm).toBe(MIN_PRINT_CM);
    expect(clampPlacement(base({ area: "chest", widthCm: 80 }), areas.chest, 1).widthCm).toBe(areas.chest.maxWidthCm);
  });

  it("alinha o topo a 4 dedos (7,5 cm) da gola e centraliza", () => {
    const dims = garmentDims(tee, "M");
    const collar = collarY(tee, dims, "front");
    const placement = alignToCollar(base({ x: 6, y: -10 }), areas.front, 1, collar, COLLAR_GUIDE_CM);
    expect(placement.x).toBe(0);
    expect(distanceFromCollar(placement, areas.front, 1, collar)).toBeCloseTo(7.5);
  });

  it("nas costas a guia mede a partir do topo da gola", () => {
    const dims = garmentDims(tee, "M");
    const back = alignToCollar(base({ area: "back", widthCm: 20 }), areas.back, 1, collarY(tee, dims, "back"), 10);
    expect(distanceFromCollar(back, areas.back, 1, dims.neckBack)).toBeCloseTo(10);
  });

  it("formata a medida para o DTF", () => {
    expect(formatPrintSize(28, 28 / 31.4)).toBe("28 × 31,4 cm");
  });
});

/** Imagem RGBA de teste a partir de linhas de caracteres: W branco, K preto, . transparente. */
function rgba(rows: string[]) {
  const height = rows.length;
  const width = rows[0].length;
  const data = new Uint8ClampedArray(width * height * 4);
  rows.join("").split("").forEach((char, index) => {
    const value = char === "K" ? 0 : 255;
    data.set([value, value, value, char === "." ? 0 : 255], index * 4);
  });
  return { data, width, height };
}

const alphaAt = (data: Uint8ClampedArray, width: number, x: number, y: number) => data[(y * width + x) * 4 + 3];

describe("remover fundo branco", () => {
  it("apaga o branco das bordas e mantém o branco de dentro do desenho", () => {
    const { data, width, height } = rgba(["WWWWWWW", "WKKKKKW", "WKWWWKW", "WKKKKKW", "WWWWWWW"]);
    const out = removeWhiteBackground(data, width, height);
    expect(alphaAt(out, width, 0, 0)).toBe(0);
    expect(alphaAt(out, width, 6, 4)).toBe(0);
    expect(alphaAt(out, width, 1, 1)).toBe(255); // contorno preto
    expect(alphaAt(out, width, 3, 2)).toBe(255); // branco interno preservado
  });

  it("não altera a imagem original", () => {
    const { data, width, height } = rgba(["WW", "WK"]);
    removeWhiteBackground(data, width, height);
    expect(data[3]).toBe(255);
  });

  it("detecta transparência", () => {
    expect(hasTransparency(rgba(["WK", "KW"]).data)).toBe(false);
    expect(hasTransparency(rgba(["W.", "KW"]).data)).toBe(true);
  });
});
