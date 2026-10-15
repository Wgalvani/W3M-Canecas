import type { ProductPreset } from "@/types/image";

/** Resolução e área segura comuns a todos os tamanhos. */
export const PRINT_DEFAULTS = { ppi: 300, safeMarginMm: 3 } as const;

/** Caneca 325 ml (11 oz): ~8,2 cm de diâmetro e 9,5 cm de altura, segundo os fornecedores. */
const MUG_325_OBJECT = { diameterMm: 82, heightMm: 95 };

export const MUG_STANDARD: ProductPreset = {
  ...PRINT_DEFAULTS,
  id: "caneca-padrao",
  name: "Caneca padrão 325 ml (arte cheia)",
  widthMm: 210,
  heightMm: 95,
  hint: "Cobre a caneca inteira, com uma pequena sobra.",
  object: MUG_325_OBJECT,
};

/** Tamanho inicial. */
export const DEFAULT_PRESET = MUG_STANDARD;

const CHECK_SUPPLIER = "A medida varia entre fornecedores: confira a área de impressão do seu modelo antes de imprimir.";

/**
 * Atalhos opcionais do seletor de tamanho; qualquer outra medida vira "Personalizado".
 * Medidas levantadas em fornecedores brasileiros (out/2026). Só objetos cilíndricos:
 * peças cônicas (xícara, tulipa) precisam de molde curvo, que o app ainda não gera.
 */
export const PRESETS: ProductPreset[] = [
  MUG_STANDARD,
  {
    ...PRINT_DEFAULTS,
    id: "caneca-325-segura",
    name: "Caneca 325 ml (área segura)",
    widthMm: 200,
    heightMm: 90,
    hint: "Cerâmica, mágica, polímero, vidro ou alça coração. Medida mais comum entre os fornecedores.",
    object: MUG_325_OBJECT,
  },
  {
    ...PRINT_DEFAULTS,
    id: "caneca-450",
    name: "Caneca 450 ml",
    widthMm: 210,
    heightMm: 100,
    warning: `Muitos modelos de 450 ml são semi-cônicos. ${CHECK_SUPPLIER}`,
  },
  {
    ...PRINT_DEFAULTS,
    id: "chopp-475",
    name: "Caneca chopp jateada 475 ml",
    widthMm: 200,
    heightMm: 85,
    warning: CHECK_SUPPLIER,
  },
  {
    ...PRINT_DEFAULTS,
    id: "caneca-aluminio",
    name: "Caneca de alumínio 350–400 ml",
    widthMm: 210,
    heightMm: 85,
    warning: CHECK_SUPPLIER,
  },
];

/**
 * Limites de cada lado da arte. O máximo mantém o PNG (arte + margem das marcas,
 * 32 × 32 cm a 300 PPI ≈ 14 Mpx) abaixo do limite de canvas do Safari no iPhone (~16,7 Mpx).
 */
export const ART_SIZE_LIMITS_MM = { min: 50, max: 300 } as const;

/** Limites de PPI efetivo. 290 tolera arredondamentos de imagens feitas para ~300 PPI. */
export const QUALITY_THRESHOLDS = {
  excellent: 290,
  acceptable: 180,
} as const;

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 0.1;

export const MAX_FILE_BYTES = 30 * 1024 * 1024;
export const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

/** Fundo das áreas vazias no modo Encaixar. */
export const BACKGROUND_COLOR = "#ffffff";

/** Maior lado da cópia reduzida usada no preview. */
export const PREVIEW_MAX_SIDE = 2400;

/** A4 usada em paisagem: 297 mm de largura deixam espaço lateral para as marcas de corte. */
export const A4_SIZE_MM = { width: 210, height: 297 } as const;
export const A4_MAX_ARTS = 2;
/** Espaço entre as duas artes da A4, para um corte desalinhado não pegar a arte vizinha. */
export const A4_ART_GAP_MM = 6;

/**
 * A4 em pé, impressa sem margem: 3 artes empilhadas de borda a borda (3 × 9,5 cm + 2 × 1,5 mm
 * cabem nos 29,7 cm). Não há espaço para marcas de corte; uma linha-guia no meio de cada
 * espaço (e à mesma distância nas pontas) indica onde cortar.
 */
export const A4_BORDERLESS = { count: 3, gapMm: 1.5 } as const;

/** Marcas de corte (registro): ficam fora da arte e nunca a tocam. */
export const CROP_MARKS = {
  /** Distância entre a borda da arte e o início da marca. */
  offsetMm: 2,
  lengthMm: 5,
  /** Quando falta espaço junto à borda do papel, a marca encosta e encurta até estes limites. */
  minOffsetMm: 1,
  minLengthMm: 2,
  /** Faixa junto à borda que impressoras comuns não imprimem. */
  printerMarginMm: 3,
  strokeMm: 0.25,
  /** Margem em volta da arte no PNG e no PDF individual, onde ficam as marcas. */
  sheetMarginMm: 10,
} as const;

export const EXPORT_FILENAMES = {
  png: "arte-caneca.png",
  "pdf-single": "arte-caneca.pdf",
  "pdf-a4": "arte-caneca-a4.pdf",
} as const;
