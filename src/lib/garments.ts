/**
 * Catálogo das peças de vestuário e as medidas usadas pela cena 3D.
 * Tudo em cm, no espaço da peça: y para cima (barra em y = 0), frente em +z,
 * lado esquerdo de quem veste em +x. Sem three.js: os números são testáveis.
 */
import type { GarmentId, GarmentSize, GarmentView, PrintArea, PrintAreaId, Vec3 } from "@/types/garment";

export type NeckStyle = "crew" | "v" | "scoop" | "hood";
export type GarmentCategory = "camisetas" | "regatas" | "moletons";
/** Manequim: a peça vestida num corpo; solta: manequim invisível (foto de loja). */
export type Pose = "mannequin" | "ghost";

export interface SleeveSpec {
  lengthCm: number;
  /** Inclinação abaixo da horizontal no manequim invisível, em graus. */
  angleDeg: number;
  rootRadiusCm: number;
  endRadiusCm: number;
  /** Punho canelado, em cm (0 = sem punho). */
  cuffCm: number;
}

/** Cava da regata, em cm, medida na superfície da peça (ver `armholeCut`). */
export interface TankSpec {
  /** Largura da alça sobre o ombro. */
  strapCm: number;
  /** Quanto a cava desce abaixo da linha do ombro. */
  armholeDepthCm: number;
  /** Quanto a cava avança para a frente e para as costas (nadador: costas bem cavadas). */
  armholeFrontCm: number;
  armholeBackCm: number;
}

export interface GarmentSpec {
  id: GarmentId;
  name: string;
  short: string;
  category: GarmentCategory;
  /** Largura (meia volta, peça na mesa) e comprimento por tamanho, em cm. */
  sizes: Record<GarmentSize, { chestCm: number; lengthCm: number }>;
  /** Comprimento a mais que uma camiseta (longline): o ombro fica no lugar, a barra desce. */
  extraLengthCm: number;
  /** Barra arredondada (frente e costas mais compridas que as laterais), em cm. */
  hemCurveCm: number;
  /** Afinamento na cintura e na barra (1 = reto). */
  waist: number;
  hem: number;
  /** Volume do busto na frente (baby look). */
  bust: number;
  /** Barra canelada (moletom), em cm. */
  hemBandCm: number;
  neck: NeckStyle;
  /** Queda da gola na frente, em cm (gola V e decote são mais fundos). */
  neckDropCm: number;
  /** Meia largura da gola, em cm. */
  neckHalfWidthCm: number;
  /** Altura da ribana/debrum da gola, em cm (0 = sem ribana). */
  collarCm: number;
  sleeve: SleeveSpec | null;
  tank: TankSpec | null;
  pocket: boolean;
  /** Malha toda canelada (regata canelada). */
  ribbed: boolean;
  /** Malha: 0 = meia malha lisa, 1 = moletom felpudo. */
  plush: number;
  /** Corte feminino: o manequim tem ombros mais estreitos. */
  female: boolean;
}

const TEE_SIZES = {
  P: { chestCm: 50, lengthCm: 70 },
  M: { chestCm: 53, lengthCm: 72 },
  G: { chestCm: 56, lengthCm: 74 },
  GG: { chestCm: 59, lengthCm: 76 },
};
const FITTED_SIZES = {
  P: { chestCm: 46, lengthCm: 68 },
  M: { chestCm: 49, lengthCm: 70 },
  G: { chestCm: 52, lengthCm: 72 },
  GG: { chestCm: 55, lengthCm: 74 },
};
const LONG_SIZES = {
  P: { chestCm: 50, lengthCm: 79 },
  M: { chestCm: 53, lengthCm: 81 },
  G: { chestCm: 56, lengthCm: 83 },
  GG: { chestCm: 59, lengthCm: 85 },
};
const OVERSIZED_SIZES = {
  P: { chestCm: 56, lengthCm: 72 },
  M: { chestCm: 59, lengthCm: 74 },
  G: { chestCm: 62, lengthCm: 76 },
  GG: { chestCm: 65, lengthCm: 78 },
};
const SWEAT_SIZES = {
  P: { chestCm: 54, lengthCm: 67 },
  M: { chestCm: 57, lengthCm: 69 },
  G: { chestCm: 60, lengthCm: 71 },
  GG: { chestCm: 63, lengthCm: 73 },
};

const TEE_SLEEVE: SleeveSpec = { lengthCm: 21, angleDeg: 40, rootRadiusCm: 9.4, endRadiusCm: 8, cuffCm: 0 };
const SWEAT_SLEEVE: SleeveSpec = { lengthCm: 64, angleDeg: 72, rootRadiusCm: 9.6, endRadiusCm: 5.8, cuffCm: 6 };

const BASE: Omit<GarmentSpec, "id" | "name" | "short" | "category"> = {
  sizes: TEE_SIZES,
  extraLengthCm: 0,
  hemCurveCm: 0,
  waist: 0.98,
  hem: 1,
  bust: 0,
  hemBandCm: 0,
  neck: "crew",
  neckDropCm: 7,
  neckHalfWidthCm: 8.5,
  collarCm: 2,
  sleeve: TEE_SLEEVE,
  tank: null,
  pocket: false,
  ribbed: false,
  plush: 0,
  female: false,
};

/** Regata: sem manga, decote em U e debrum fino na gola e nas cavas. */
function tank(id: GarmentId, name: string, short: string, cut: TankSpec, extra: Partial<GarmentSpec> = {}): GarmentSpec {
  return {
    ...BASE,
    id,
    name,
    short,
    category: "regatas",
    waist: 0.97,
    neck: "scoop",
    neckDropCm: 9,
    neckHalfWidthCm: 9,
    collarCm: 1.2,
    sleeve: null,
    tank: cut,
    ...extra,
  };
}

export const GARMENTS: GarmentSpec[] = [
  { ...BASE, id: "camiseta", name: "Camiseta gola redonda", short: "Gola redonda", category: "camisetas" },
  {
    ...BASE,
    id: "gola-v",
    name: "Camiseta gola V",
    short: "Gola V",
    category: "camisetas",
    neck: "v",
    neckDropCm: 13,
    neckHalfWidthCm: 8.3,
    collarCm: 1.8,
  },
  {
    ...BASE,
    id: "baby-look",
    name: "Baby look",
    short: "Baby look",
    category: "camisetas",
    sizes: {
      P: { chestCm: 42, lengthCm: 59 },
      M: { chestCm: 44, lengthCm: 61 },
      G: { chestCm: 46, lengthCm: 63 },
      GG: { chestCm: 48, lengthCm: 65 },
    },
    waist: 0.86,
    hem: 0.95,
    bust: 0.14,
    neck: "scoop",
    neckDropCm: 9,
    neckHalfWidthCm: 9.5,
    collarCm: 1.3,
    sleeve: { lengthCm: 13, angleDeg: 36, rootRadiusCm: 7.8, endRadiusCm: 7.2, cuffCm: 0 },
    female: true,
  },
  tank("regata", "Regata tradicional", "Tradicional", { strapCm: 6.5, armholeDepthCm: 16, armholeFrontCm: 8.5, armholeBackCm: 8.5 }, { neckDropCm: 8 }),
  tank("regata-cavada", "Regata cavada", "Cavada", { strapCm: 4.5, armholeDepthCm: 22, armholeFrontCm: 10.5, armholeBackCm: 10.5 }, { neckDropCm: 10, neckHalfWidthCm: 9.5 }),
  tank(
    "regata-machao",
    "Regata machão",
    "Machão",
    { strapCm: 3.2, armholeDepthCm: 26, armholeFrontCm: 12.5, armholeBackCm: 12.5 },
    { neckDropCm: 12, neckHalfWidthCm: 10 },
  ),
  tank(
    "regata-nadador",
    "Regata nadador (racerback)",
    "Nadador",
    { strapCm: 3.5, armholeDepthCm: 21, armholeFrontCm: 10, armholeBackCm: 19 },
    { sizes: FITTED_SIZES, waist: 0.93, neckDropCm: 10 },
  ),
  tank(
    "regata-longline",
    "Regata longline",
    "Longline",
    { strapCm: 4.5, armholeDepthCm: 23, armholeFrontCm: 10.5, armholeBackCm: 10.5 },
    { sizes: LONG_SIZES, extraLengthCm: 9, hemCurveCm: 5, neckDropCm: 10, neckHalfWidthCm: 9.5 },
  ),
  tank(
    "regata-canelada",
    "Regata canelada",
    "Canelada",
    { strapCm: 5, armholeDepthCm: 18, armholeFrontCm: 9.5, armholeBackCm: 9.5 },
    { sizes: FITTED_SIZES, waist: 0.92, ribbed: true, neckDropCm: 8, neckHalfWidthCm: 8.5 },
  ),
  tank(
    "regata-oversized",
    "Regata oversized",
    "Oversized",
    { strapCm: 7, armholeDepthCm: 26, armholeFrontCm: 11, armholeBackCm: 11 },
    { sizes: OVERSIZED_SIZES, waist: 1, neckHalfWidthCm: 9.5 },
  ),
  {
    ...BASE,
    id: "moletom",
    name: "Moletom careca",
    short: "Careca",
    category: "moletons",
    sizes: SWEAT_SIZES,
    waist: 1,
    hem: 0.9,
    hemBandCm: 6,
    neckHalfWidthCm: 9,
    collarCm: 2.6,
    sleeve: SWEAT_SLEEVE,
    plush: 1,
  },
  {
    ...BASE,
    id: "moletom-capuz",
    name: "Moletom com capuz",
    short: "Com capuz",
    category: "moletons",
    sizes: SWEAT_SIZES,
    waist: 1,
    hem: 0.9,
    hemBandCm: 6,
    neck: "hood",
    neckDropCm: 9,
    neckHalfWidthCm: 9.5,
    collarCm: 0,
    sleeve: SWEAT_SLEEVE,
    pocket: true,
    plush: 1,
  },
];

export const GARMENT_CATEGORIES: { id: GarmentCategory; label: string }[] = [
  { id: "camisetas", label: "Camisetas" },
  { id: "regatas", label: "Regatas" },
  { id: "moletons", label: "Moletons" },
];

export const GARMENT_SIZES: GarmentSize[] = ["P", "M", "G", "GG"];
export const DEFAULT_GARMENT: GarmentId = "camiseta";
export const DEFAULT_SIZE: GarmentSize = "M";
export const DEFAULT_POSE: Pose = "mannequin";

export function garmentSpec(id: GarmentId): GarmentSpec {
  return GARMENTS.find((garment) => garment.id === id) ?? GARMENTS[0];
}

export interface FabricColor {
  name: string;
  hex: string;
}

/** Paleta de malhas, por família, com as cores mais comuns nos fornecedores (tom aproximado de tela). */
export const FABRIC_GROUPS: { name: string; colors: FabricColor[] }[] = [
  {
    name: "Neutros",
    colors: [
      { name: "Branco", hex: "#f7f7f4" },
      { name: "Off-white", hex: "#efe8d8" },
      { name: "Areia", hex: "#d6c4a1" },
      { name: "Cinza mescla", hex: "#a9a9a6" },
      { name: "Chumbo", hex: "#45474c" },
      { name: "Preto", hex: "#1b1c1f" },
      { name: "Marrom café", hex: "#4b3428" },
    ],
  },
  {
    name: "Azuis",
    colors: [
      { name: "Azul bebê", hex: "#a9c8e8" },
      { name: "Celeste", hex: "#5b9bd5" },
      { name: "Turquesa", hex: "#1aa3a8" },
      { name: "Royal", hex: "#2448a8" },
      { name: "Marinho", hex: "#1d2840" },
    ],
  },
  {
    name: "Verdes",
    colors: [
      { name: "Verde água", hex: "#8fd3c0" },
      { name: "Verde limão", hex: "#b5d334" },
      { name: "Verde bandeira", hex: "#12814a" },
      { name: "Verde musgo", hex: "#4a5234" },
    ],
  },
  {
    name: "Quentes",
    colors: [
      { name: "Amarelo canário", hex: "#f7d93a" },
      { name: "Amarelo ouro", hex: "#f0b323" },
      { name: "Laranja", hex: "#ef6c22" },
      { name: "Vermelho", hex: "#b81d24" },
      { name: "Bordô", hex: "#5e1a26" },
    ],
  },
  {
    name: "Rosas e roxos",
    colors: [
      { name: "Rosa bebê", hex: "#f2c4cf" },
      { name: "Pink", hex: "#e0407b" },
      { name: "Lilás", hex: "#b9a2d6" },
      { name: "Roxo", hex: "#4f2a73" },
    ],
  },
];

export const FABRIC_COLORS: FabricColor[] = FABRIC_GROUPS.flatMap((group) => group.colors);

export const DEFAULT_FABRIC = FABRIC_COLORS[0].hex;

export function fabricColorName(hex: string): string {
  return FABRIC_COLORS.find((color) => color.hex.toLowerCase() === hex.toLowerCase())?.name ?? `Personalizada (${hex.toUpperCase()})`;
}

/**
 * Marcos do manequim realista (Blender Studio Human Base Meshes, CC0), em cm: pés no
 * chão (y = 0), centro do peito em x = 0. Medidos no Blender junto com os modelos.
 */
export interface BodyLandmarks {
  /** Base do pescoço (onde a gola assenta, nas costas). */
  neckBaseY: number;
  /** Centro do pescoço em z (fica atrás do centro do peito). */
  neckZ: number;
  /** Altura da axila: acima dela o tecido apoia nos ombros. */
  armpitY: number;
  /** Eixo do braço esquerdo, do ombro ao pulso (medido em fatias do modelo). */
  armRoot: Vec3;
  armEnd: Vec3;
  armRadius: number;
  /** Cotovelo (o braço do manequim é levemente dobrado para trás). */
  armElbow: Vec3;
  /** Ponta do ombro (acrômio), em x: até onde vai o ombro da peça. */
  shoulderX: number;
}

export const BODIES: Record<"male" | "female", BodyLandmarks> = {
  male: { neckBaseY: 144, neckZ: -2.6, armpitY: 122, armRoot: [18.5, 131, -4.2], armEnd: [42, 76, 8.5], armRadius: 5, armElbow: [31.4, 105, -3], shoulderX: 24 },
  female: { neckBaseY: 139, neckZ: -1.2, armpitY: 124, armRoot: [15.3, 127, -5], armEnd: [39.5, 75, 5], armRadius: 4.3, armElbow: [24.7, 104, -5.3], shoulderX: 21 },
};

export function bodyFor(spec: GarmentSpec): BodyLandmarks {
  return spec.female ? BODIES.female : BODIES.male;
}

/** Altura (no corpo) da barra da peça: a gola assenta na base do pescoço. */
export function hemOnBody(spec: GarmentSpec, size: GarmentSize): number {
  return bodyFor(spec).neckBaseY + 1 - spec.sizes[size].lengthCm;
}

/** Medidas de construção da peça num tamanho, derivadas da tabela. */
export interface GarmentDims {
  length: number;
  /** Meia largura e meia profundidade do tronco no peito. */
  halfWidth: number;
  halfDepth: number;
  /** Altura onde o tronco encontra o ombro: na frente/costas e nas laterais. */
  yokeFront: number;
  yokeSide: number;
  /** Ponto alto da gola nas costas. */
  neckBack: number;
  neckHalfWidth: number;
  neckHalfDepth: number;
  /** Centro da gola em z (a gola fica um pouco para trás do meio). */
  neckZ: number;
  neckDrop: number;
  sleeveRoot: Vec3;
  /** Direção do braço esquerdo (do ombro ao pulso), unitária. */
  sleeveDir: Vec3;
  sleeveAngle: number;
  sleeveLength: number;
  sleeveRootRadius: number;
  sleeveEndRadius: number;
  /** Quanto do comprimento da manga fica escondido dentro do tronco. */
  sleeveInset: number;
  pocketTop: number;
}

/**
 * Medidas da peça vestida no manequim, em cm no espaço da peça (barra em y = 0).
 * A peça é a mesma com ou sem o manequim à vista (`pose` só mostra/esconde o corpo).
 */
export function garmentDims(spec: GarmentSpec, size: GarmentSize, _pose: Pose = "ghost"): GarmentDims {
  void _pose;
  const { chestCm, lengthCm } = spec.sizes[size];
  const reference = spec.sizes.M;
  const widthScale = chestCm / reference.chestCm;
  const lengthScale = lengthCm / reference.lengthCm;
  const body = bodyFor(spec);
  const hem = hemOnBody(spec, size);
  const halfWidth = chestCm * 0.4;
  // Acima da axila o tecido apoia no ombro (mesma altura em toda a volta).
  const yoke = body.armpitY + 2 - hem;
  const sleeve = spec.sleeve ?? TEE_SLEEVE;
  const long = sleeve.lengthCm > 30;
  const [ax, ay, az] = body.armRoot;
  const [ex, ey, ez] = body.armEnd;
  const span = Math.hypot(ex - ax, ey - ay, ez - az);
  const sleeveDir: Vec3 = [(ex - ax) / span, (ey - ay) / span, (ez - az) / span];
  // A manga veste o braço: nunca mais estreita que o braço com folga.
  const sleeveRootRadius = Math.max(sleeve.rootRadiusCm * widthScale * 0.86, body.armRadius + 3.4);
  return {
    length: lengthCm,
    halfWidth,
    halfDepth: chestCm * 0.235,
    yokeFront: yoke,
    yokeSide: yoke,
    neckBack: lengthCm,
    neckHalfWidth: spec.neckHalfWidthCm * widthScale,
    neckHalfDepth: spec.neckHalfWidthCm * 0.82 * widthScale,
    neckZ: body.neckZ,
    neckDrop: spec.neckDropCm * lengthScale,
    sleeveRoot: [ax, ay - hem, az],
    sleeveDir,
    sleeveAngle: Math.asin(-sleeveDir[1]),
    sleeveLength: (long ? Math.min(sleeve.lengthCm * lengthScale, span - 5) : sleeve.lengthCm * widthScale) + sleeveRootRadius * 0.6,
    sleeveRootRadius,
    sleeveEndRadius: Math.max(sleeve.endRadiusCm * widthScale * (long ? 1 : 0.86), long ? 4.5 : body.armRadius + 2.4),
    sleeveInset: sleeveRootRadius * 0.6,
    pocketTop: lengthCm * 0.42,
  };
}

/**
 * Meia largura (x) e meia profundidade (z) do tronco na altura y. Cintura e
 * barra seguem o afinamento da peça; perto do ombro a largura abre e a
 * profundidade diminui, como num manequim invisível.
 */
export function torsoProfile(spec: GarmentSpec, dims: GarmentDims, y: number): { a: number; b: number } {
  const t = Math.min(1, Math.max(0, y / dims.yokeFront));
  // Curva suave: barra (t=0) → cintura (t≈0.4) → peito (t≈0.75) → ombro (t=1).
  const waistWeight = Math.exp(-(((t - 0.4) / 0.2) ** 2));
  const hemWeight = Math.max(0, 1 - t / 0.35) ** 2;
  let factor = 1 - (1 - spec.waist) * waistWeight - (1 - spec.hem) * hemWeight;
  if (spec.hemBandCm > 0 && y < spec.hemBandCm) factor -= 0.035 * (1 - y / spec.hemBandCm);
  const shoulder = Math.max(0, (t - 0.8) / 0.2);
  // Corte feminino: ombro mais estreito.
  const a = dims.halfWidth * (factor + (spec.female ? -0.02 : 0.06) * shoulder);
  const b = dims.halfDepth * (factor * (spec.plush ? 1.02 : 1) - 0.08 * shoulder);
  return { a, b };
}

/** Volume extra da frente na altura y (busto da baby look), como fração da profundidade. */
export function bustBulge(spec: GarmentSpec, dims: GarmentDims, y: number): number {
  if (!spec.bust) return 0;
  const t = y / dims.yokeFront;
  return spec.bust * Math.exp(-(((t - 0.8) / 0.11) ** 2));
}

/** Expoente da seção do tronco: >2 deixa os lados mais retos (tecido caído). */
export const TORSO_EXPONENT = 2.5;

/** Ponto da seção (superelipse) no ângulo θ (0 = frente, π/2 = esquerda de quem veste). */
export function sectionPoint(a: number, b: number, theta: number): [number, number] {
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const e = 2 / TORSO_EXPONENT;
  return [a * Math.sign(s) * Math.abs(s) ** e, b * Math.sign(c) * Math.abs(c) ** e];
}

/** Altura do anel onde o tronco vira ombro, no ângulo θ (mais alto nas laterais). */
export function yokeHeight(dims: GarmentDims, theta: number): number {
  return dims.yokeFront + (dims.yokeSide - dims.yokeFront) * Math.sin(theta) ** 2;
}

/** Ponto da gola no ângulo θ: [x, y, z]. */
export function neckPoint(spec: GarmentSpec, dims: GarmentDims, theta: number): [number, number, number] {
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const front = Math.max(0, c);
  let drop: number;
  let x = dims.neckHalfWidth * s;
  if (spec.neck === "v" || spec.neck === "hood") {
    // V: queda linear até a ponta (no capuz o V é onde o capuz se cruza).
    const reach = Math.PI * 0.42;
    const k = Math.max(0, 1 - Math.abs(Math.atan2(s, c)) / reach);
    drop = dims.neckDrop * k;
    x *= 1 - 0.35 * k * k;
    drop = Math.max(drop, dims.neckDrop * 0.35 * front ** 2);
  } else if (spec.neck === "scoop") {
    // Decote em U: desce mais rápido e fica largo embaixo.
    drop = dims.neckDrop * front ** 1.1;
  } else {
    drop = dims.neckDrop * front ** 1.6;
  }
  return [x, dims.neckBack - drop, dims.neckZ + dims.neckHalfDepth * c];
}

/** Altura da gola acima de uma área: base da gola na frente (e peito), topo nas costas. */
export function collarY(spec: GarmentSpec, dims: GarmentDims, area: PrintAreaId): number {
  if (area === "back") return dims.neckBack;
  return dims.neckBack - dims.neckDrop;
}

/** Direção do eixo da manga (de dentro para fora), para o lado `side` (+1 esquerda, −1 direita). */
export function sleeveDirection(dims: GarmentDims, side: 1 | -1): Vec3 {
  return [side * dims.sleeveDir[0], dims.sleeveDir[1], dims.sleeveDir[2]];
}

/** Lado de fora da manga (perpendicular ao braço, para fora do corpo): onde vai o logo. */
export function sleeveOutward(dims: GarmentDims, side: 1 | -1): Vec3 {
  const d = sleeveDirection(dims, side);
  const out: Vec3 = [side, 0, 0];
  const along = out[0] * d[0] + out[1] * d[1] + out[2] * d[2];
  const v: Vec3 = [out[0] - d[0] * along, out[1] - d[1] * along, out[2] - d[2] * along];
  const length = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / length, v[1] / length, v[2] / length];
}

/**
 * Corte da cava da regata, em cm (positivo = tecido, negativo = vazado). Coordenadas
 * medidas na superfície a partir da costura lateral: `u` < 0 para a frente, > 0 para as
 * costas; `v` = 0 na linha do ombro, negativo descendo o tronco e positivo subindo o
 * ombro até a gola (em `yokeLength`). A cava é uma elipse; a alça é a faixa junto à gola.
 */
export function armholeCut(cut: TankSpec, u: number, v: number, yokeLength: number): number {
  const width = u < 0 ? cut.armholeFrontCm : cut.armholeBackCm;
  const height = cut.armholeDepthCm + yokeLength;
  const du = u / width;
  const dv = (v - yokeLength) / height;
  const e = Math.hypot(du, dv);
  // Distância aproximada até a borda da elipse: (e − 1) / |∇e|.
  const gradient = Math.hypot(du / width, dv / height) / (e || 1);
  const ellipse = (e - 1) / (gradient || 1);
  const strap = v - (yokeLength - cut.strapCm);
  return Math.max(ellipse, strap);
}

const VIEW_BY_AREA: Record<PrintAreaId, GarmentView> = {
  front: "front",
  chest: "front",
  back: "back",
  "sleeve-left": "left",
  "sleeve-right": "right",
};

export const AREA_LABELS: Record<PrintAreaId, string> = {
  front: "Frente",
  back: "Costas",
  chest: "Peito (escudo)",
  "sleeve-left": "Manga esquerda",
  "sleeve-right": "Manga direita",
};

export const AREA_ORDER: PrintAreaId[] = ["front", "back", "chest", "sleeve-left", "sleeve-right"];

/** Áreas que a peça tem (regata não tem manga). */
export function availableAreas(spec: GarmentSpec): PrintAreaId[] {
  return spec.sleeve ? AREA_ORDER : AREA_ORDER.filter((area) => area !== "sleeve-left" && area !== "sleeve-right");
}

/** Áreas de estampa da peça no tamanho escolhido. */
export function printAreas(spec: GarmentSpec, size: GarmentSize, pose: Pose = "ghost"): Record<PrintAreaId, PrintArea> {
  const dims = garmentDims(spec, size, pose);
  const L = dims.length;
  const neckFront = dims.neckBack - dims.neckDrop;
  const bodyBottom = spec.pocket ? dims.pocketTop + 2 : Math.max(spec.hemBandCm + 3, L * 0.1);
  // Na regata a cava estreita o painel: a estampa não pode invadir o vazado.
  const halfSpan = spec.tank ? Math.min(dims.halfWidth * 0.82, dims.halfWidth - spec.tank.armholeFrontCm * 0.75) : dims.halfWidth * 0.82;
  const big = spec.female ? 24 : 26;
  const front = L * 0.63;
  const back = L * 0.66;
  const chestX = dims.halfWidth * 0.45;
  const chestY = Math.min(L * 0.77, neckFront - 7);

  const sleeve = (side: 1 | -1): PrintArea => {
    const d = sleeveDirection(dims, side);
    const [rx, ry] = dims.sleeveRoot;
    const visible = dims.sleeveLength - dims.sleeveInset;
    const long = (spec.sleeve?.lengthCm ?? 0) > 30;
    const along = dims.sleeveInset + visible * (long ? 0.3 : 0.55);
    const t = along / dims.sleeveLength;
    const radius = dims.sleeveRootRadius + (dims.sleeveEndRadius - dims.sleeveRootRadius) * t;
    const normal = sleeveOutward(dims, side);
    const reachDown = visible - (along - dims.sleeveInset) - (spec.sleeve?.cuffCm || 1.5) - 1;
    const reachUp = along - dims.sleeveInset - 1;
    return {
      id: side === 1 ? "sleeve-left" : "sleeve-right",
      label: AREA_LABELS[side === 1 ? "sleeve-left" : "sleeve-right"],
      target: side === 1 ? "sleeve-left" : "sleeve-right",
      frame: {
        origin: [side * rx + d[0] * along + normal[0] * radius, ry + d[1] * along + normal[1] * radius, dims.sleeveRoot[2] + d[2] * along + normal[2] * radius],
        normal,
        up: [-d[0], -d[1], -d[2]],
      },
      defaultWidthCm: long ? 8 : 7,
      bounds: { minX: -radius * 0.5, maxX: radius * 0.5, minY: -reachDown, maxY: reachUp },
      maxWidthCm: Math.round(radius * 1.3),
      maxHeightCm: Math.round(Math.min(long ? 30 : 12, reachDown + reachUp)),
      view: VIEW_BY_AREA[side === 1 ? "sleeve-left" : "sleeve-right"],
    };
  };

  const backTop = dims.neckBack - (spec.neck === "hood" ? 16 : 4);
  const backBottom = Math.max(spec.hemBandCm + 3, L * 0.1);
  return {
    front: {
      id: "front",
      label: AREA_LABELS.front,
      target: "body",
      frame: { origin: [0, front, 0], normal: [0, 0, 1], up: [0, 1, 0] },
      defaultWidthCm: Math.min(big, Math.floor(halfSpan * 2)),
      bounds: { minX: -halfSpan, maxX: halfSpan, minY: bodyBottom - front, maxY: neckFront - 2 - front },
      maxWidthCm: Math.min(36, Math.floor(halfSpan * 2)),
      maxHeightCm: Math.floor(neckFront - 2 - bodyBottom),
      view: VIEW_BY_AREA.front,
    },
    back: {
      id: "back",
      label: AREA_LABELS.back,
      target: "body",
      frame: { origin: [0, back, 0], normal: [0, 0, -1], up: [0, 1, 0] },
      defaultWidthCm: Math.min(big + 2, Math.floor(halfSpan * 2)),
      bounds: { minX: -halfSpan, maxX: halfSpan, minY: backBottom - back, maxY: backTop - back },
      maxWidthCm: Math.min(36, Math.floor(halfSpan * 2)),
      maxHeightCm: Math.floor(backTop - backBottom),
      view: VIEW_BY_AREA.back,
    },
    chest: {
      id: "chest",
      label: AREA_LABELS.chest,
      target: "body",
      frame: { origin: [chestX, chestY, 0], normal: [0, 0, 1], up: [0, 1, 0] },
      defaultWidthCm: 9,
      bounds: { minX: -halfSpan - chestX, maxX: halfSpan - chestX, minY: bodyBottom - chestY, maxY: neckFront - 2 - chestY },
      maxWidthCm: 14,
      maxHeightCm: 14,
      view: VIEW_BY_AREA.chest,
    },
    "sleeve-left": sleeve(1),
    "sleeve-right": sleeve(-1),
  };
}
