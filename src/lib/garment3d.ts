/**
 * Cena 3D das peças de vestuário. Como a caneca, a peça é construída só com
 * código (sem arquivos de modelo): tronco, ombros, gola, mangas, capuz e bolso
 * são superfícies paramétricas em cm, no estilo "manequim invisível" das fotos
 * de loja. As estampas são projetadas sobre o tecido (DecalGeometry) e
 * acompanham as curvas e dobras, como um transfer DTF prensado.
 *
 * Único módulo que importa three.js na aba Camisetas: carregado sob demanda.
 */
import {
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Euler,
  Float32BufferAttribute,
  FrontSide,
  Group,
  HemisphereLight,
  Line,
  LineDashedMaterial,
  LineLoop,
  Matrix4,
  Mesh,
  MeshDepthMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Raycaster,
  RepeatWrapping,
  RGBADepthPacking,
  Scene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
  type Texture,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import femaleBody from "./bodies/female.json";
import maleBody from "./bodies/male.json";
import type { Design, GarmentSize, GarmentView, Placement, PrintArea, PrintAreaId, Vec3 } from "@/types/garment";
import {
  armholeCut,
  bodyFor,
  collarY,
  garmentDims,
  hemOnBody,
  neckPoint,
  printAreas,
  sleeveDirection,
  type BodyLandmarks,
  type GarmentSpec,
  type Pose,
} from "./garments";
import { clampPlacement, frameCoords, frameRight, placementHalfHeight, SNAP_CM } from "./placement";

const AROUND = 216;
/** Tamanho de repetição da trama da malha e da ribana, em cm. */
const KNIT_TILE_CM = 0.9;
const RIB_TILE_CM = 1.2;

const VIEW_AZIMUTH: Record<GarmentView, number> = { front: 0, back: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 };

export interface GarmentViewerCallbacks {
  onSelect: (placementId: string | null) => void;
  onPlacementChange: (placement: Placement) => void;
}

/** Guia de posicionamento: linha a `distanceCm` da gola e eixo central, só na tela. */
export interface GuideSettings {
  enabled: boolean;
  distanceCm: number;
}

export interface GarmentViewer {
  setGarment: (spec: GarmentSpec, size: GarmentSize, pose: Pose) => void;
  setColor: (hex: string) => void;
  /** Cor da gola, punhos e debruns; `null` = mesma cor da peça. */
  setTrim: (hex: string | null) => void;
  setGuide: (guide: GuideSettings) => void;
  setPrints: (designs: Design[], placements: Placement[]) => void;
  setSelected: (placementId: string | null) => void;
  setView: (view: GarmentView) => void;
  /** Foto da peça na vista pedida, sem a seleção, com fundo transparente. */
  snapshot: (view: GarmentView, width: number, height: number) => Promise<Blob>;
  dispose: () => void;
}

/* ------------------------------------------------------------------------ */
/* Texturas procedurais da malha                                              */
/* ------------------------------------------------------------------------ */

/** Mapa de normais a partir de um campo de alturas (0–1) que se repete. */
function normalMapFromHeights(size: number, height: (x: number, y: number) => number, strength: number): CanvasTexture {
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) heights[y * size + x] = height(x, y);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(size, size);
  const at = (x: number, y: number) => heights[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const length = Math.hypot(dx, dy, 1);
      const offset = (y * size + x) * 4;
      image.data[offset] = (-dx / length) * 127.5 + 127.5;
      image.data[offset + 1] = (dy / length) * 127.5 + 127.5;
      image.data[offset + 2] = (1 / length) * 127.5 + 127.5;
      image.data[offset + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

/** Meia malha: colunas de laçadas em "V" com um pouco de irregularidade. */
function knitNormalMap(): CanvasTexture {
  const cell = 8;
  let seed = 7;
  const noise = new Float32Array(128 * 128).map(() => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  });
  return normalMapFromHeights(
    128,
    (x, y) => {
      const u = (x % cell) / cell - 0.5;
      const v = (y % cell) / cell;
      const loop = Math.exp(-((v - 0.25 - Math.abs(u) * 0.9) ** 2) / 0.035);
      return loop * 0.85 + noise[y * 128 + x] * 0.15;
    },
    2.2,
  );
}

/** Ribana: cordões verticais. */
function ribNormalMap(): CanvasTexture {
  return normalMapFromHeights(64, (x) => Math.sin((x / 64) * Math.PI * 2 * 4) ** 2, 3);
}

/* ------------------------------------------------------------------------ */
/* Malhas paramétricas                                                       */
/* ------------------------------------------------------------------------ */

interface Grid {
  columns: number;
  rows: number;
  point: (column: number, row: number) => Vec3;
  /** UV em cm (a textura repete pelo tamanho do tile). */
  uv: (column: number, row: number) => [number, number];
  /** Linhas (de-até) que usam a ribana. */
  ribRows?: Array<[number, number]>;
  /** Fecha a volta: a última coluna recebe a normal da primeira. */
  closed?: boolean;
  /** Direção "para fora" esperada num ponto de referência, para acertar a orientação das faces. */
  outward?: { column: number; row: number; direction: Vec3 };
  shade?: (point: Vec3) => number;
  /** Distância (cm) até a borda de um recorte; negativo = vazado (cava da regata). */
  cut?: (column: number, row: number) => number;
}

/** Valor de "sem recorte" do atributo `cut`. */
const NO_CUT = 100;

function buildGrid({ columns, rows, point, uv, ribRows = [], closed, outward, shade, cut }: Grid): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const cuts: number[] = [];
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const p = point(column, row);
      positions.push(p[0], p[1], p[2]);
      const [u, v] = uv(column, row);
      uvs.push(u, v);
      const s = shade ? shade(p) : 1;
      colors.push(s, s, s);
      cuts.push(cut ? cut(column, row) : NO_CUT);
    }
  }
  const isRib = (row: number) => ribRows.some(([from, to]) => row >= from && row < to);
  const fabric: number[] = [];
  const rib: number[] = [];
  const stride = columns + 1;
  for (let row = 0; row < rows; row++) {
    const target = isRib(row) ? rib : fabric;
    for (let column = 0; column < columns; column++) {
      const a = row * stride + column;
      const b = a + 1;
      const c = a + stride + 1;
      const d = a + stride;
      target.push(a, b, d, b, c, d);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setAttribute("cut", new Float32BufferAttribute(cuts, 1));
  geometry.setIndex([...fabric, ...rib]);
  geometry.addGroup(0, fabric.length, 0);
  if (rib.length) geometry.addGroup(fabric.length, rib.length, 1);
  geometry.computeVertexNormals();

  if (outward) {
    const normal = geometry.getAttribute("normal");
    const index = outward.row * stride + outward.column;
    const n: Vec3 = [normal.getX(index), normal.getY(index), normal.getZ(index)];
    if (n[0] * outward.direction[0] + n[1] * outward.direction[1] + n[2] * outward.direction[2] < 0) {
      const indices = geometry.getIndex()!;
      for (let i = 0; i < indices.count; i += 3) {
        const second = indices.getX(i + 1);
        indices.setX(i + 1, indices.getX(i + 2));
        indices.setX(i + 2, second);
      }
      indices.needsUpdate = true;
      geometry.computeVertexNormals();
    }
  }
  if (closed) {
    // Costura invisível: primeira e última coluna dividem a mesma normal.
    const normal = geometry.getAttribute("normal");
    for (let row = 0; row <= rows; row++) {
      const first = row * stride;
      const last = first + columns;
      const n = new Vector3(
        normal.getX(first) + normal.getX(last),
        normal.getY(first) + normal.getY(last),
        normal.getZ(first) + normal.getZ(last),
      ).normalize();
      normal.setXYZ(first, n.x, n.y, n.z);
      normal.setXYZ(last, n.x, n.y, n.z);
    }
  }
  return geometry;
}

/** Só os triângulos com tecido: estampas e cliques não "caem" no vazado da cava. */
function solidGeometry(geometry: BufferGeometry): BufferGeometry {
  const cut = geometry.getAttribute("cut");
  const index = geometry.getIndex();
  if (!cut || !index) return geometry;
  let hasCut = false;
  for (let i = 0; i < cut.count && !hasCut; i++) hasCut = cut.getX(i) < 0;
  if (!hasCut) return geometry;
  const kept: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    if (cut.getX(a) >= 0 && cut.getX(b) >= 0 && cut.getX(c) >= 0) kept.push(a, b, c);
  }
  const solid = new BufferGeometry();
  solid.setAttribute("position", geometry.getAttribute("position"));
  solid.setAttribute("normal", geometry.getAttribute("normal"));
  solid.setIndex(kept);
  return solid;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

/* ------------------------------------------------------------------------ */
/* Corpo medido (manequim realista)                                          */
/* ------------------------------------------------------------------------ */

interface BodyData {
  height: number;
  center: [number, number];
  torso: { angles: number; rows: { y: number; r: (number | null)[] }[] };
  top: { x0: number; z0: number; step: number; nx: number; nz: number; y: (number | null)[][] };
}

const BODY_DATA: Record<"male" | "female", BodyData> = {
  male: maleBody as BodyData,
  female: femaleBody as BodyData,
};

/**
 * Consulta às medidas do manequim (cm, coordenadas do corpo): raio do tronco por
 * ângulo/altura a partir do eixo do peito e altura do topo dos ombros em (x, z).
 */
function bodyField(data: BodyData, landmarks: BodyLandmarks) {
  const angles = data.torso.angles;
  const rows = data.torso.rows;
  const [cx, cz] = data.center;
  // Raios não medidos viram o vizinho válido mais próximo na mesma altura.
  const radii: (number[] | null)[] = rows.map((row) => {
    const valid = row.r.map((v) => v !== null && v > 2);
    if (!valid.some(Boolean)) return null;
    return row.r.map((v, i) => {
      if (valid[i]) return v as number;
      for (let d = 1; d < angles; d++) {
        if (valid[(i + d) % angles]) return row.r[(i + d) % angles] as number;
        if (valid[(i - d + angles) % angles]) return row.r[(i - d + angles) % angles] as number;
      }
      return 10;
    });
  });
  for (let j = radii.length - 2; j >= 0; j--) if (!radii[j]) radii[j] = radii[j + 1];
  for (let j = 1; j < radii.length; j++) if (!radii[j]) radii[j] = radii[j - 1];
  const table = radii as number[][];
  const y0 = rows[0].y;
  const dy = rows[1].y - rows[0].y;
  // Abaixo do quadril o tronco vira pernas: usa a medida do quadril.
  const hipY = data.height * 0.5;

  const torso = (theta: number, y: number) => {
    const t = (((theta / (Math.PI * 2)) % 1) + 1) % 1 * angles;
    const i0 = Math.floor(t) % angles;
    const i1 = (i0 + 1) % angles;
    const f = t - Math.floor(t);
    const yy = Math.min(rows.length - 1.0001, Math.max(0, (Math.max(y, hipY) - y0) / dy));
    const j0 = Math.floor(yy);
    const g = yy - j0;
    const at = (j: number) => lerp(table[j][i0], table[j][i1], f);
    return lerp(at(j0), at(j0 + 1), g);
  };

  const { x0, z0, step, nx, nz } = data.top;
  // Só vale a superfície dos ombros/peito alto (descarta cabeça e leituras por dentro do corpo).
  const usable = (v: number | null) => v !== null && v > landmarks.armpitY - 12 && v < landmarks.neckBaseY + 4;
  const topAt = (x: number, z: number): number | null => {
    const fx = (x - cx - x0) / step;
    const fz = (z - cz - z0) / step;
    if (fx < 0 || fz < 0 || fx > nx - 1 || fz > nz - 1) return null;
    const ix = Math.min(nx - 2, Math.floor(fx));
    const iz = Math.min(nz - 2, Math.floor(fz));
    const grid = data.top.y;
    const corners = [grid[iz][ix], grid[iz][ix + 1], grid[iz + 1][ix], grid[iz + 1][ix + 1]];
    if (!corners.every(usable)) {
      const ok = corners.filter(usable) as number[];
      return ok.length ? Math.max(...ok) : null;
    }
    const [a, b, c, d] = corners as number[];
    const u = fx - ix;
    const w = fz - iz;
    return lerp(lerp(a, b, u), lerp(c, d, u), w);
  };

  return { torso, topAt, cx, cz };
}

/* ------------------------------------------------------------------------ */
/* Peça vestida no manequim                                                  */
/* ------------------------------------------------------------------------ */

interface GarmentMeshes {
  group: Group;
  /** Superfície do tronco usada para projetar estampas (sem o vazado das cavas). */
  body: Mesh;
  /** Malha visível do tronco (recebe o material de profundidade com recorte). */
  shell: Mesh;
  sleeves: { left: Mesh | null; right: Mesh | null };
}

/**
 * Constrói a peça sobre o corpo medido. A geometria é feita em coordenadas do corpo
 * e o grupo desce para a barra ficar em y = 0 (o espaço das áreas de estampa).
 *  - Tronco: o tecido cai reto do ponto mais largo acima (peito, escápulas), como
 *    roupa de verdade; nas peças justas acompanha a cintura. A folga sai da tabela
 *    de medidas: no mesmo corpo, o P fica justo e o GG folgado.
 *  - Ombros: o tecido apoia na superfície real dos ombros.
 *  - Gola: assenta na base do pescoço; decotes fundos deitam sobre o peito.
 *  - Mangas: seguem o braço do manequim e caem um pouco por baixo.
 */
function buildGarment(
  spec: GarmentSpec,
  size: GarmentSize,
  pose: Pose,
  materials: { fabric: Material[]; inner: Material },
): GarmentMeshes {
  const dims = garmentDims(spec, size, pose);
  const body = bodyFor(spec);
  const field = bodyField(spec.female ? BODY_DATA.female : BODY_DATA.male, body);
  const hem = hemOnBody(spec, size);
  const group = new Group();
  group.position.y = -hem;
  const plush = spec.plush;
  const { cx, cz } = field;

  const addShell = (geometry: BufferGeometry) => {
    const outer = new Mesh(geometry, materials.fabric);
    const inner = new Mesh(geometry, materials.inner);
    group.add(outer, inner);
    return outer;
  };

  /* Medidas do tecido -------------------------------------------------------- */
  const topY = body.armpitY + 2;
  // Acima disto a medida horizontal pega o ombro/braço: o tronco para aqui.
  const chestTop = body.armpitY - 3;
  const fitted = spec.waist < 0.95 || spec.ribbed;
  const reachUp = fitted ? 7 : 200;
  const hullAt = (theta: number, y: number) => {
    const from = Math.min(y, chestTop);
    const to = Math.min(from + reachUp, chestTop);
    // Amostras contínuas (de 1 em 1 cm até o topo exato): sem degraus entre as linhas da tabela.
    let r = field.torso(theta, from);
    for (let yy = from + 1; yy < to; yy += 1) r = Math.max(r, field.torso(theta, yy));
    return Math.max(r, field.torso(theta, to));
  };
  // O tecido não afunda nos vãos (coluna, entre os peitorais): ponte entre os vizinhos.
  const span = (Math.PI * 2) / 72;
  const hull = (theta: number, y: number) =>
    Math.max(hullAt(theta, y), (hullAt(theta - span, y) + hullAt(theta + span, y)) / 2, (hullAt(theta - 2 * span, y) + hullAt(theta + 2 * span, y)) / 2);

  // Folga pela tabela: perímetro do peito da peça (2 × largura) sobre o do corpo.
  const chestY = body.armpitY - 5;
  let bodyChest = 0;
  for (let i = 0; i < 72; i++) bodyChest += hull((i / 72) * Math.PI * 2, chestY) * span;
  const ease = Math.max(1.03, (2 * spec.sizes[size].chestCm) / bodyChest);

  const radiusAt = (theta: number, y: number) => {
    let r = hull(theta, y) * ease + 0.3;
    if (spec.hemBandCm > 0 && y < hem + spec.hemBandCm) r *= lerp(0.93, 1, (y - hem) / spec.hemBandCm);
    // O tecido nunca fica por dentro do corpo (peças justas no peitoral, perto da axila).
    // Nas laterais, acima da axila, a medida pega o braço: ali não vale.
    const skinY = Math.min(y, body.armpitY + 4);
    if (Math.abs(Math.sin(theta)) < 0.7 || y < body.armpitY - 4) r = Math.max(r, field.torso(theta, skinY) + 0.8);
    // Barra: folga sobre o quadril/calça do manequim (a medida do tronco para no quadril).
    {
      // Transição gradual (sem degrau) da cintura até a barra.
      const w = smooth(Math.min(1, Math.max(0, 1 - (y - hem) / 22)));
      const hip = field.torso(theta, hem) * 1.05 + 1.4;
      if (hip > r) r = lerp(r, hip, w);
    }
    return r;
  };

  const ringPoint = (theta: number, y: number): Vec3 => {
    const r = radiusAt(theta, y);
    const s = Math.sin(theta);
    const c = Math.cos(theta);
    // Dobras: caimento vertical perto da barra e franzidos leves nas laterais.
    const low = Math.max(0, 1 - (y - hem) / (dims.length * 0.55));
    const side = Math.abs(s);
    const armpit = Math.exp(-(((y - (body.armpitY - 8)) / 7) ** 2));
    const fold =
      (plush ? 0.22 : 0.45) * Math.sin(theta * 7 + 1.3 + y * 0.06) * low * low +
      (plush ? 0.12 : 0.22) * Math.sin(y * 0.45 + side * 9) * Math.exp(-(((side - 0.8) / 0.16) ** 2)) * armpit +
      (spec.hemBandCm ? 0 : 0.16 * Math.exp(-(((y - hem - 2.2) / 0.35) ** 2)) + 0.12 * Math.max(0, 1 - (y - hem) / 0.6));
    return [cx + s * (r + fold), y, cz + c * (r + fold)];
  };

  /** Gola no ângulo θ (coordenadas do corpo); decotes fundos deitam sobre o peito. */
  const neckAt = (theta: number): Vec3 => {
    const [nx, ny, nz] = neckPoint(spec, dims, theta);
    const y = ny + hem;
    const angle = Math.atan2(nx - cx, nz - cz);
    const rho = Math.max(Math.hypot(nx - cx, nz - cz), field.torso(angle, y) * (y < body.neckBaseY - 3 ? 1.01 : 0) + 0.8);
    return [cx + Math.sin(angle) * rho, y, cz + Math.cos(angle) * rho];
  };

  /* Tronco + ombros + gola ------------------------------------------------ */
  const bandRows = spec.hemBandCm > 0 ? 6 : 0;
  const bodyRows = 96;
  const yokeRows = 44;
  const collarRows = spec.collarCm > 0 ? 6 : 0;
  const lipRows = spec.collarCm > 0 ? 3 : 0;
  const rows = bandRows + bodyRows + yokeRows + collarRows + lipRows;
  const collarStart = 1 - spec.collarCm / 20;

  const bodyY = (theta: number, row: number) => {
    const band = hem + spec.hemBandCm;
    const y = row <= bandRows && bandRows > 0 ? hem + (spec.hemBandCm * row) / bandRows : lerp(band, topY, (row - bandRows) / bodyRows);
    if (!spec.hemCurveCm) return y;
    // Barra arredondada (longline): desce na frente e nas costas.
    return y - spec.hemCurveCm * Math.cos(theta) ** 2 * Math.max(0, 1 - (y - hem) / ((topY - hem) * 0.45)) ** 2;
  };

  const yokePoint = (theta: number, s: number, start: Vec3, neck: Vec3): Vec3 => {
    const x = lerp(start[0], neck[0], s);
    const z = lerp(start[2], neck[2], s);
    // Nas laterais o ombro sobe inclinado (sem parede reta junto à manga).
    const lateral = Math.abs(Math.sin(theta)) ** 2;
    const straight = lerp(start[1], neck[1], lerp(1 - (1 - s) ** 2, s ** 0.85, lateral));
    const onBody = field.topAt(x, z);
    // O tecido apoia no ombro: nunca fica abaixo da pele (+ espessura da malha). Leituras
    // acima da gola (queixo, pescoço) são ignoradas.
    const usable = onBody !== null && onBody < Math.max(start[1], neck[1]) + 1;
    // Na ponta do ombro a leitura pega o topo do braço (parede reta): ali o tecido
    // segue a inclinação natural e a cabeça da manga cobre o resto.
    const shoulderLimit = body.shoulderX - 5;
    const overShoulder = Math.abs(x - cx) - shoulderLimit;
    if (usable && overShoulder > 0) {
      const slope = straight + Math.max(0, (onBody as number) + 0.7 - straight) * Math.max(0, 1 - overShoulder / 2);
      return [x, slope, z];
    }
    return [x, usable ? Math.max(straight, onBody + 0.7) : straight, z];
  };

  const points: [number, number, number][][] = [];
  for (let row = 0; row <= rows; row++) {
    const line: [number, number, number][] = [];
    for (let column = 0; column <= AROUND; column++) {
      const theta = (column / AROUND) * Math.PI * 2;
      if (row <= bandRows + bodyRows) {
        const ring = ringPoint(theta, bodyY(theta, row));
        line.push([ring[0], ring[1], ring[2]]);
        continue;
      }
      const start = ringPoint(theta, topY);
      const neck = neckAt(theta);
      const yokeIndex = row - bandRows - bodyRows;
      if (yokeIndex <= yokeRows + collarRows) {
        const s =
          yokeIndex <= yokeRows ? (yokeIndex / yokeRows) * (collarRows ? collarStart : 1) : lerp(collarStart, 1, (yokeIndex - yokeRows) / collarRows);
        const p: [number, number, number] = [...yokePoint(theta, s, start, neck)];
        // Cava: nas laterais o tecido sobe da axila em curva até a ponta do ombro
        // (onde a manga é costurada) e daí segue para a gola — sem degrau.
        const lateral = Math.abs(Math.sin(theta)) ** 3;
        // A cabeça da manga cobre a ponta do ombro: o corpo só encosta nela (sem quina).
        const outward = Math.max(0, body.shoulderX - 6 - Math.abs(start[0] - cx));
        p[0] += Math.sign(start[0] - cx) * outward * lateral * Math.sin(Math.PI * Math.min(1, s / 0.55));
        // Também fora do corpo na horizontal (o deltoide é mais largo que o caminho reto).
        const angle = Math.atan2(p[0] - cx, p[2] - cz);
        const radial = Math.hypot(p[0] - cx, p[2] - cz);
        const skin = field.torso(angle, p[1]) + 0.7;
        if (p[1] < body.neckBaseY - 1 && radial < skin) {
          p[0] = cx + Math.sin(angle) * skin;
          p[2] = cz + Math.cos(angle) * skin;
        }
        // Quina do ombro: a parte do corpo que passaria por fora da manga é recolhida
        // para dentro dela (arredonda junto com a cabeça da manga).
        const capHalf = body.armRoot[0] + 2;
        const over = Math.abs(p[0] - cx) - capHalf;
        if (over > 0) {
          p[0] = cx + Math.sign(p[0] - cx) * (capHalf + over * 0.25);
          p[1] -= over * 0.6;
        }
        const lift = collarRows && s > collarStart ? 0.3 * Math.sin(((s - collarStart) / (1 - collarStart)) * Math.PI) : 0;
        line.push([p[0], p[1] + lift, p[2]]);
        continue;
      }
      // Ribana dobrando para dentro da gola (mostra a espessura).
      const t = (yokeIndex - yokeRows - collarRows) / lipRows;
      const radial = Math.hypot(neck[0] - cx, neck[2] - body.neckZ) || 1;
      const inward = 0.5 * Math.sin(t * Math.PI * 0.5);
      line.push([neck[0] - ((neck[0] - cx) / radial) * inward, neck[1] - 1.6 * t, neck[2] - ((neck[2] - body.neckZ) / radial) * inward]);
    }
    points.push(line);
  }

  // Ombro sem degraus: subindo em direção à gola o tecido nunca desce (cobre os vãos
  // entre leituras do corpo) e a altura é suavizada entre colunas vizinhas.
  const firstYoke = bandRows + bodyRows + 1;
  const lastYoke = bandRows + bodyRows + yokeRows + collarRows;
  for (let column = 0; column <= AROUND; column++) {
    for (let row = firstYoke; row <= lastYoke; row++) {
      const below = points[row - 1][column][1];
      const target = Math.min(points[lastYoke][column][1], below + 4);
      if (points[row][column][1] < below) points[row][column][1] = Math.min(below, target);
    }
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let row = firstYoke; row < lastYoke; row++) {
      const heights = points[row].map((p) => p[1]);
      for (let column = 0; column <= AROUND; column++) {
        let sum = 0;
        for (let k = -2; k <= 2; k++) sum += heights[(column + k + AROUND) % AROUND];
        points[row][column][1] = Math.max(heights[column] - 0.6, sum / 5);
      }
      points[row][AROUND][1] = points[row][0][1];
    }
  }

  // Recorte das regatas: distância até a borda da cava, a partir da costura lateral.
  const reach = (dims.halfWidth + dims.halfDepth) / 2;
  const yokeLengths = Array.from({ length: AROUND + 1 }, (_, column) => {
    let total = 0;
    for (let row = bandRows + bodyRows + 1; row <= bandRows + bodyRows + yokeRows; row++) {
      const a = points[row - 1][column];
      const b = points[row][column];
      total += Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    }
    return total;
  });
  const tank = spec.tank && { ...spec.tank, armholeDepthCm: Math.max(4, spec.tank.armholeDepthCm - 5) };
  const bodyCut = (column: number, row: number) => {
    if (!tank) return NO_CUT;
    const theta = (column / AROUND) * Math.PI * 2;
    const u = theta <= Math.PI ? (theta - Math.PI / 2) * reach : ((3 * Math.PI) / 2 - theta) * reach;
    const length = yokeLengths[column];
    let v: number;
    if (row <= bandRows + bodyRows) {
      v = bodyY(theta, row) - topY;
    } else {
      const yokeIndex = row - bandRows - bodyRows;
      if (yokeIndex > yokeRows) return NO_CUT;
      v = (yokeIndex / yokeRows) * length;
    }
    return armholeCut(tank, u, v, length);
  };

  const shade = (p: Vec3) => {
    let value = 1;
    for (const side of [1, -1] as const) {
      const dx = p[0] - side * (body.shoulderX - 6);
      const dy = p[1] - (body.armpitY - 2);
      value -= 0.16 * Math.exp(-((dx * dx) / 30 + (dy * dy) / 50));
    }
    if (spec.neck === "hood" && p[2] < cz) {
      value -= 0.2 * Math.exp(-(((p[1] - (body.neckBaseY - 16)) / 4) ** 2)) * Math.exp(-((p[0] / 14) ** 2));
    }
    return Math.max(0.55, value);
  };

  const circumference = 2 * Math.PI * Math.sqrt((dims.halfWidth ** 2 + dims.halfDepth ** 2) / 2);
  const bodyGeometry = buildGrid({
    columns: AROUND,
    rows,
    point: (column, row) => points[row][column],
    uv: (column, row) => [((column / AROUND) * circumference) / KNIT_TILE_CM, points[row][column][1] / KNIT_TILE_CM],
    ribRows: [
      [0, bandRows],
      [bandRows + bodyRows + yokeRows, rows],
    ],
    closed: true,
    outward: { column: 0, row: bandRows + bodyRows / 2, direction: [0, 0, 1] },
    shade,
    cut: bodyCut,
  });
  const shell = addShell(bodyGeometry);
  const solid = solidGeometry(bodyGeometry);
  let bodyMesh = shell;
  if (solid !== bodyGeometry) {
    // Malha de apoio (invisível) para projetar estampas e arrastar sem cair no vazado.
    bodyMesh = new Mesh(solid);
    bodyMesh.visible = false;
    group.add(bodyMesh);
  }

  /* Mangas ---------------------------------------------------------------- */
  const sleeveColumns = 64;
  const sleeveRows = 56;
  const cuffRows = (spec.sleeve?.cuffCm ?? 0) > 0 ? 10 : 0;
  const hemRows = 3;
  const buildSleeve = (side: 1 | -1) => {
    const direction = new Vector3(...sleeveDirection(dims, side));
    // A manga nasce na ponta do ombro: o topo da cabeça da manga fica na linha do ombro (22°).
    const root = new Vector3(side * body.armRoot[0], body.armRoot[1], body.armRoot[2]);
    const length = dims.sleeveLength;
    const cuff = spec.sleeve?.cuffCm ?? 0;
    const long = (spec.sleeve?.lengthCm ?? 0) > 30;
    // A manga cai: o topo apoia no braço e a parte de baixo pende.
    const down = new Vector3(0, -1, 0).addScaledVector(direction, direction.y).normalize();
    const preRows = 8;
    const wrist = new Vector3(side * body.armEnd[0], body.armEnd[1], body.armEnd[2]);
    const elbow = new Vector3(side * body.armElbow[0], body.armElbow[1], body.armElbow[2]);
    const armSpan = root.distanceTo(wrist);
    // Controle da curva para ela passar pelo cotovelo no meio.
    // Meia dobra: a manga acompanha o cotovelo sem descobrir a frente do braço.
    const middle = root.clone().add(wrist).multiplyScalar(0.5);
    const control = middle.clone().lerp(elbow.clone().multiplyScalar(2).sub(middle), 0.5);
    // A manga continua para dentro do tronco com a largura cheia: o encontro forma a costura da cava.
    const hidden = (dims.sleeveRootRadius * 0.9) / length;
    // Cabeça da manga: continua subindo pelo eixo do braço até o ombro.
    // Cúpula da cabeça da manga: fecha na direção da gola, pela linha do ombro.
    // A parte escondida da manga entra no tronco (para dentro e levemente para baixo), nunca por cima do ombro.
    const inward = new Vector3(-side, -0.7, 0).normalize();
    const total = preRows + sleeveRows + cuffRows + hemRows;
    const center = (t: number) => {
      if (t < 0) {
        // Curva contínua: começa seguindo o braço e vira aos poucos para dentro do tronco.
        const u = -t / hidden;
        const heading = direction.clone().negate().lerp(inward, smooth(u)).normalize();
        return root.clone().addScaledVector(heading, -t * length);
      }
      const r = lerp(dims.sleeveRootRadius, dims.sleeveEndRadius, Math.min(1, t));
      // Desde o ombro o topo da manga apoia no braço; a folga fica embaixo.
      const sag = Math.max(0, r - body.armRadius - 0.6) * 0.85;
      // Eixo do braço dobrado: curva que passa pelo cotovelo (Bézier quadrática).
      const u = Math.min(1, (t * length) / armSpan);
      const along = root.clone().multiplyScalar((1 - u) ** 2).addScaledVector(control, 2 * u * (1 - u)).addScaledVector(wrist, u * u);
      return along.addScaledVector(down, sag);
    };
    const tangent = (t: number) => center(Math.min(1, t + 0.01)).sub(center(t - 0.01)).normalize();
    const along = (row: number) => {
      const main = row - preRows;
      if (main < 0) return -hidden * (1 - row / preRows);
      if (main <= sleeveRows) return (main / sleeveRows) * (1 - (long ? cuff / length : 0));
      if (main <= sleeveRows + cuffRows) return 1 - cuff / length + ((main - sleeveRows) / cuffRows) * (cuff / length);
      return 1;
    };
    const hemStart = preRows + sleeveRows + cuffRows;
    const radius = (row: number, phi: number) => {
      const t = along(row);
      // Afina enquanto entra no tronco: o topo da manga mergulha sob o ombro (costura curva).
      if (t < 0) return dims.sleeveRootRadius * (1 + 0.55 * (t / hidden));
      let r = lerp(dims.sleeveRootRadius, dims.sleeveEndRadius, smooth(Math.min(1, t)));
      if (long) {
        const cuffStart = 1 - cuff / length;
        // Franzido antes do punho e punho justo.
        if (t < cuffStart) r *= 1 + 0.12 * Math.exp(-(((t - cuffStart + 0.04) / 0.05) ** 2));
        else r = Math.max(body.armRadius * 0.85, r * 0.72);
        r += 0.2 * Math.sin(phi * 5 + t * 18) * Math.exp(-(((t - 0.55) / 0.2) ** 2));
        // Folga no cotovelo (o braço dobra para trás).
        r += 1.1 * Math.exp(-(((t - 0.5) / 0.14) ** 2));
      } else {
        r += 0.15 * Math.sin(phi * 4 + t * 9) * t;
        const fromEnd = (1 - t) * length;
        r += 0.16 * Math.exp(-(((fromEnd - 2) / 0.32) ** 2));
      }
      if (row > hemStart) r -= 0.5 * ((row - hemStart) / hemRows);
      return r;
    };
    const point = (column: number, row: number): Vec3 => {
      const phi = (column / sleeveColumns) * Math.PI * 2;
      const t = along(row);
      const c = center(t);
      const forward = tangent(t);
      const n1 = new Vector3(0, 0, 1).cross(forward).normalize();
      const n2 = forward.clone().cross(n1).normalize();
      const r = radius(row, phi);
      // Junto ao ombro a manga é cheia (cobre o deltoide); descendo, achata como tecido caído.
      const cap = 1 - smooth(Math.min(1, Math.max(0, t) / 0.45));
      const depth = lerp(0.84, 1.02, cap);
      const forwardShift = 0.8 * cap;
      const p = c
        .addScaledVector(n1, r * Math.cos(phi))
        .addScaledVector(n2, r * depth * Math.sin(phi))
        .add(new Vector3(0, 0, forwardShift));
      if (row > hemStart) p.addScaledVector(forward, -0.9 * ((row - hemStart) / hemRows));
      return [p.x, p.y, p.z];
    };
    const geometry = buildGrid({
      columns: sleeveColumns,
      rows: total,
      point,
      uv: (column, row) => [((column / sleeveColumns) * 2 * Math.PI * dims.sleeveRootRadius) / KNIT_TILE_CM, (along(row) * length) / KNIT_TILE_CM],
      ribRows: cuffRows ? [[preRows + sleeveRows, total]] : [],
      closed: true,
      outward: { column: 0, row: preRows + Math.round(sleeveRows / 2), direction: new Vector3(0, 0, 1).cross(direction).toArray() as Vec3 },
      shade: (p) => {
        const t = new Vector3(...p).sub(root).dot(direction) / length;
        return t < 0.2 ? lerp(0.8, 1, Math.max(0, t) / 0.2) : 1;
      },
    });
    return addShell(geometry);
  };
  const sleeves = spec.sleeve ? { left: buildSleeve(1), right: buildSleeve(-1) } : { left: null, right: null };

  /* Capuz e bolso canguru -------------------------------------------------- */
  if (spec.neck === "hood") {
    const hoodRows = 30;
    const hoodPoint = (column: number, row: number): Vec3 => {
      const theta = (column / AROUND) * Math.PI * 2;
      const neck = neckAt(theta);
      const back = (1 - Math.cos(theta)) / 2;
      const f = 0.18 + 0.82 * back ** 1.3;
      const t = row / hoodRows;
      // Bézier no plano (para fora, para cima): sobe, dobra para trás e deita nas costas.
      const p1 = [2.5 * f, 9 * f];
      const p2 = [11 * f, 6 * f];
      const p3 = [4.8 * f, -17 * f];
      const mt = 1 - t;
      const out = 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t ** 3 * p3[0];
      const up = 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t ** 3 * p3[1];
      const radial = Math.hypot(neck[0] - cx, neck[2] - body.neckZ) || 1;
      return [neck[0] + ((neck[0] - cx) / radial) * out, neck[1] + up, neck[2] + ((neck[2] - body.neckZ) / radial) * out];
    };
    const hood = buildGrid({
      columns: AROUND,
      rows: hoodRows,
      point: hoodPoint,
      uv: (column, row) => [((column / AROUND) * 60) / KNIT_TILE_CM, ((row / hoodRows) * 30) / KNIT_TILE_CM],
      closed: true,
      outward: { column: AROUND / 2, row: hoodRows / 2, direction: [0, 0.3, -1] },
      shade: (p) => (p[1] < body.neckBaseY - 3 ? 0.9 : 1),
    });
    group.add(new Mesh(hood, materials.fabric), new Mesh(hood, materials.inner));
  }

  if (spec.pocket) {
    /** Frente do tronco na altura y, no x pedido (z da superfície). */
    const frontZ = (x: number, y: number) => {
      let best = ringPoint(0, y);
      for (let i = -40; i <= 40; i++) {
        const p = ringPoint((i / 40) * (Math.PI / 2), y);
        if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
      }
      return best[2];
    };
    const pocketColumns = 40;
    const pocketRows = 24;
    const bottom = hem + spec.hemBandCm + 1;
    const top = hem + dims.pocketTop;
    const pocketPoint = (column: number, row: number): Vec3 => {
      const v = row / pocketRows;
      const y = lerp(bottom, top, v);
      const half = lerp(dims.halfWidth * 0.74, dims.halfWidth * 0.48, smooth(v));
      const u = column / pocketColumns - 0.5;
      const x = cx + u * 2 * half;
      const edge = Math.min(1, Math.min(column, pocketColumns - column, row, pocketRows - row) / 2.5);
      const lift = 0.25 + 0.6 * edge * Math.sin(Math.PI * v) * Math.cos(Math.PI * u);
      return [x, y, frontZ(x, y) + lift];
    };
    const pocketShade = (p: Vec3) => {
      const v = Math.min(1, Math.max(0, (p[1] - bottom) / (top - bottom)));
      const half = lerp(dims.halfWidth * 0.74, dims.halfWidth * 0.48, smooth(v));
      const fromSide = half - Math.abs(p[0] - cx);
      const fromEdge = Math.min(fromSide, p[1] - bottom, top - p[1]);
      const stitch = 0.1 * Math.exp(-(((fromEdge - 0.7) / 0.22) ** 2));
      const opening = v > 0.25 && v < 0.95 ? 0.14 * Math.exp(-((fromSide / 0.9) ** 2)) : 0;
      return 1 - stitch - opening;
    };
    const pocket = buildGrid({
      columns: pocketColumns,
      rows: pocketRows,
      point: pocketPoint,
      uv: (column, row) => {
        const p = pocketPoint(column, row);
        return [p[0] / KNIT_TILE_CM, p[1] / KNIT_TILE_CM];
      },
      outward: { column: pocketColumns / 2, row: pocketRows / 2, direction: [0, 0, 1] },
      shade: pocketShade,
    });
    group.add(new Mesh(pocket, materials.fabric));
  }

  return { group, body: bodyMesh, shell, sleeves };
}

/* ------------------------------------------------------------------------ */
/* Manequim (modelo realista)                                                */
/* ------------------------------------------------------------------------ */

const MANNEQUIN_URL = { male: "/models/mannequin-male.v1.glb", female: "/models/mannequin-female.v1.glb" } as const;

/* ------------------------------------------------------------------------ */
/* Visualizador                                                              */
/* ------------------------------------------------------------------------ */

interface PrintMesh {
  key: string;
  mesh: Mesh;
  material: MeshStandardMaterial;
}

export function createGarmentViewer(container: HTMLElement, callbacks: GarmentViewerCallbacks): GarmentViewer {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  // Tone mapping neutro (Khronos PBR Neutral): preserva o tom e a saturação das cores da arte e da malha.
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%" });

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;
  scene.environmentIntensity = 0.45;
  scene.add(new HemisphereLight("#ffffff", "#b9b4a8", 0.12));
  const key = new DirectionalLight("#fffaf2", 0.75);
  key.position.set(40, 90, 70);
  // Luz de costas quase tão forte quanto a da frente: a prova das costas não sai acinzentada.
  const rim = new DirectionalLight("#fbf8f2", 0.75);
  rim.position.set(-40, 80, -70);
  for (const [light, resolution] of [
    [key, 2048],
    [rim, 1024],
  ] as const) {
    light.castShadow = true;
    light.shadow.mapSize.set(resolution, resolution);
    light.shadow.camera.left = light.shadow.camera.bottom = -70;
    light.shadow.camera.right = light.shadow.camera.top = 70;
    light.shadow.camera.near = 10;
    light.shadow.camera.far = 320;
    light.shadow.radius = 6;
    // Unidades em cm: o desvio evita "acne" de sombra na própria malha.
    light.shadow.normalBias = 0.6;
    light.shadow.bias = -0.0004;
    scene.add(light.target);
  }
  scene.add(key, rim);

  const knit = knitNormalMap();
  const rib = ribNormalMap();
  const fabric = new MeshPhysicalMaterial({
    color: "#ffffff",
    roughness: 0.9,
    sheen: 0.7,
    sheenRoughness: 0.75,
    normalMap: knit,
    normalScale: new Vector2(0.35, 0.35),
    vertexColors: true,
    envMapIntensity: 0.7,
    side: FrontSide,
  });
  const ribbed = fabric.clone();
  ribbed.normalMap = rib;
  ribbed.normalScale = new Vector2(0.9, 0.9);
  ribbed.normalMap.repeat.set(KNIT_TILE_CM / RIB_TILE_CM, KNIT_TILE_CM / RIB_TILE_CM);
  const inner = new MeshStandardMaterial({ color: "#ffffff", roughness: 1, side: BackSide, vertexColors: true, envMapIntensity: 0.4 });

  // Recorte das cavas (regatas) feito no shader: borda lisa em qualquer formato, com
  // um debrum na cor do acabamento junto à borda. Peças sem recorte não mudam.
  const cutUniforms = { uTrim: { value: new Color("#ffffff") }, uBand: { value: 1.1 } };
  const withCut = (material: Material, mode: "band" | "plain" | "depth") => {
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, cutUniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float cut;\nvarying float vCut;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvCut = cut;");
      const header = "#include <common>\nuniform vec3 uTrim;\nuniform float uBand;\nvarying float vCut;";
      const band =
        mode === "band"
          ? "\nif (vCut < uBand) {\n  diffuseColor.rgb = uTrim;\n  #ifdef USE_COLOR\n  diffuseColor.rgb *= vColor.rgb;\n  #endif\n}"
          : "";
      const anchor = mode === "depth" ? "#include <alphatest_fragment>" : "#include <color_fragment>";
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", header)
        .replace(anchor, `${anchor}\nif (vCut < 0.0) discard;${band}`);
    };
    material.customProgramCacheKey = () => `garment-cut-${mode}`;
  };
  withCut(fabric, "band");
  withCut(ribbed, "plain");
  withCut(inner, "plain");
  // Sombra respeita o vazado da cava.
  const cutDepth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  withCut(cutDepth, "depth");

  // Manequim de loja: acabamento claro acetinado; da cintura para baixo, calça escura.
  // Partes do manequim cobertas pela roupa não são desenhadas: por qualquer fresta entre
  // ombro e manga aparece o avesso do tecido (como uma costura), nunca a pele.
  const mannequinUniforms = {
    uWaist: { value: 0.96 },
    uHide: { value: 0 },
    uHemY: { value: 0.7 },
    uCoverTop: { value: 1.4 },
    uSleeveEndY: { value: 1.1 },
    uChestOpen: { value: 0.085 },
    uTorsoHalf: { value: 0.17 },
  };
  const skin = new MeshPhysicalMaterial({ color: "#c8c6c1", roughness: 0.45, clearcoat: 0.25, clearcoatRoughness: 0.45, envMapIntensity: 0.8 });
  skin.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mannequinUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vBody;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBody = position.xy;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uWaist;\nuniform float uHide;\nuniform float uHemY;\nuniform float uCoverTop;\nuniform float uSleeveEndY;\nuniform float uChestOpen;\nuniform float uTorsoHalf;\nvarying vec2 vBody;")
      .replace(
        "#include <color_fragment>",
        // Calça só nas pernas: os braços e as mãos (mais afastados do centro) ficam claros.
        "#include <color_fragment>\nif (uHide > 0.5 && vBody.y > uHemY && vBody.y < uCoverTop) {\n  float ax = abs(vBody.x);\n  if (ax < uTorsoHalf ? ax > uChestOpen : vBody.y > uSleeveEndY) discard;\n}\nfloat pantsMix = (1.0 - smoothstep(uWaist - 0.004, uWaist + 0.004, vBody.y)) * (1.0 - smoothstep(0.215, 0.235, abs(vBody.x)));\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.018, 0.019, 0.022), pantsMix);",
      );
  };
  skin.customProgramCacheKey = () => "mannequin";
  const allMaterials: Material[] = [fabric, ribbed, inner, cutDepth, skin];

  // Modelos do manequim (baixados uma vez, só quando o manequim aparece).
  const loader = new GLTFLoader();
  const mannequins = new Map<"male" | "female", Promise<Group>>();
  const loadMannequin = (kind: "male" | "female") => {
    let promise = mannequins.get(kind);
    if (!promise) {
      promise = loader.loadAsync(MANNEQUIN_URL[kind]).then((gltf) => {
        const model = new Group();
        gltf.scene.traverse((object: Object3D) => {
          if (object instanceof Mesh) {
            object.material = skin;
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });
        model.add(gltf.scene);
        // O modelo vem em metros; a cena é em cm.
        model.scale.setScalar(100);
        return model;
      });
      mannequins.set(kind, promise);
    }
    return promise;
  };
  let mannequin: Group | null = null;

  const root = new Group();
  scene.add(root);
  const printsGroup = new Group();
  scene.add(printsGroup);

  let garment: GarmentMeshes | null = null;
  let spec: GarmentSpec | null = null;
  let size: GarmentSize = "M";
  let pose: Pose = "mannequin";
  let fabricHex = "#ffffff";
  let trimHex: string | null = null;
  let guide: GuideSettings = { enabled: true, distanceCm: 7.5 };
  let snapped = { x: false, y: false };
  let areas: Record<PrintAreaId, PrintArea> | null = null;
  let designs = new Map<string, Design>();
  let placements: Placement[] = [];
  let selectedId: string | null = null;
  const prints = new Map<string, PrintMesh>();
  const textures = new Map<HTMLCanvasElement, Texture>();
  let dirty = true;

  const camera = new PerspectiveCamera(28, 1, 1, 2000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.minPolarAngle = Math.PI * 0.2;
  controls.maxPolarAngle = Math.PI * 0.72;
  controls.addEventListener("change", () => (dirty = true));

  let fitDistance = 200;
  const fitCamera = (keepAngle: boolean) => {
    if (!spec) return;
    const dims = garmentDims(spec, size, pose);
    const largest = garmentDims(spec, "GG", pose);
    const withBody = pose === "mannequin";
    const hem = hemOnBody(spec, size);
    const figure = bodyFor(spec);
    // Com manequim: da cabeça até o meio da coxa; sem: só a peça.
    const top = withBody ? figure.neckBaseY + 27 - hem : largest.length + (spec.neck === "hood" ? 8 : 4);
    const bottom = withBody ? Math.min(-14, figure.armEnd[1] - hem - 6) : spec.hemCurveCm ? -spec.hemCurveCm : 0;
    const reach = withBody
      ? figure.armEnd[0] + 8
      : spec.sleeve
        ? largest.sleeveRoot[0] + Math.abs(largest.sleeveDir[0]) * largest.sleeveLength + largest.sleeveRootRadius
        : largest.halfWidth + 4;
    const width = 2 * reach;
    const fov = (camera.fov * Math.PI) / 180;
    const fitHeight = Math.max(top - bottom, width / Math.max(0.6, camera.aspect));
    fitDistance = (fitHeight * (withBody ? 1.04 : 1.12)) / (2 * Math.tan(fov / 2));
    // Com manequim o centro fica um pouco acima do meio da peça (a cabeça entra no quadro).
    const target = new Vector3(0, withBody ? (top + bottom) / 2 : dims.length * 0.5, 0);
    key.target.position.copy(target);
    rim.target.position.copy(target);
    const offset = keepAngle ? camera.position.clone().sub(controls.target).setLength(fitDistance) : new Vector3(0, fitDistance * 0.12, fitDistance);
    controls.target.copy(target);
    camera.position.copy(target).add(offset);
    controls.minDistance = fitDistance * 0.4;
    controls.maxDistance = fitDistance * 1.5;
    controls.update();
    dirty = true;
  };

  const resize = () => {
    const { clientWidth, clientHeight } = container;
    if (!clientWidth || !clientHeight) return;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    fitCamera(true);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  /* Estampas ---------------------------------------------------------------- */

  const raycaster = new Raycaster();

  const targetMesh = (area: PrintArea): Mesh | null => {
    if (!garment) return null;
    if (area.target === "sleeve-left") return garment.sleeves.left;
    if (area.target === "sleeve-right") return garment.sleeves.right;
    return garment.body;
  };

  /** Ponto da superfície sob (x, y) do plano da área, projetando de fora para dentro. */
  const surfacePoint = (area: PrintArea, x: number, y: number): Vector3 => {
    const normal = new Vector3(...area.frame.normal);
    const planar = new Vector3(...area.frame.origin)
      .addScaledVector(new Vector3(...frameRight(area.frame)), x)
      .addScaledVector(new Vector3(...area.frame.up), y);
    const mesh = targetMesh(area);
    if (mesh) {
      raycaster.set(planar.clone().addScaledVector(normal, 60), normal.clone().negate());
      const hit = raycaster.intersectObject(mesh, false)[0];
      if (hit) return hit.point;
    }
    return planar;
  };

  const placementKey = (placement: Placement, design: Design) =>
    [spec?.id, size, placement.area, placement.x.toFixed(3), placement.y.toFixed(3), placement.widthCm.toFixed(3), placement.rotationDeg, design.id, design.art.width, design.removeWhite].join("|");

  const textureFor = (design: Design) => {
    let texture = textures.get(design.art);
    if (!texture) {
      texture = new CanvasTexture(design.art);
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      textures.set(design.art, texture);
    }
    return texture;
  };

  const decalOrientation = (area: PrintArea, rotationDeg: number) => {
    const normal = new Vector3(...area.frame.normal);
    const right = new Vector3(...frameRight(area.frame));
    const up = new Vector3(...area.frame.up);
    // Ângulo positivo gira no sentido horário, como nos programas de arte.
    const turn = (-rotationDeg * Math.PI) / 180;
    const r = right.clone().multiplyScalar(Math.cos(turn)).addScaledVector(up, Math.sin(turn));
    const u = up.clone().multiplyScalar(Math.cos(turn)).addScaledVector(right, -Math.sin(turn));
    return { matrix: new Matrix4().makeBasis(r, u, normal), right: r, up: u, normal };
  };

  const buildPrint = (placement: Placement, design: Design): PrintMesh | null => {
    if (!areas) return null;
    const area = areas[placement.area];
    const mesh = targetMesh(area);
    if (!mesh) return null;
    const center = surfacePoint(area, placement.x, placement.y);
    const { matrix } = decalOrientation(area, placement.rotationDeg);
    const width = placement.widthCm;
    const height = width / design.aspect;
    const depth = area.target === "body" ? 14 : dims().sleeveRootRadius * 1.1;
    const geometry = new DecalGeometry(mesh, center, new Euler().setFromRotationMatrix(matrix), new Vector3(width, height, depth));
    const normalMap = knit.clone();
    normalMap.repeat.set(width / KNIT_TILE_CM, height / KNIT_TILE_CM);
    normalMap.needsUpdate = true;
    const material = new MeshStandardMaterial({
      map: textureFor(design),
      transparent: true,
      alphaTest: 0.03,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      // Filme DTF: fosco, acompanhando a trama (sem reflexo que desbote as cores).
      roughness: 0.9,
      normalMap,
      normalScale: new Vector2(0.22, 0.22),
      envMapIntensity: 0.45,
    });
    const decal = new Mesh(geometry, material);
    decal.userData.placementId = placement.id;
    decal.receiveShadow = true;
    decal.renderOrder = 2;
    return { key: placementKey(placement, design), mesh: decal, material };
  };

  const dims = () => garmentDims(spec!, size, pose);

  const disposePrint = (print: PrintMesh) => {
    printsGroup.remove(print.mesh);
    print.mesh.geometry.dispose();
    print.material.normalMap?.dispose();
    print.material.dispose();
  };

  /* Contorno da estampa selecionada --------------------------------------- */
  const outlineMaterial = new LineDashedMaterial({ color: "#ff5a1f", dashSize: 1.2, gapSize: 0.8 });
  let outline: LineLoop | null = null;
  const updateOutline = () => {
    if (outline) {
      scene.remove(outline);
      outline.geometry.dispose();
      outline = null;
    }
    const placement = placements.find((p) => p.id === selectedId);
    const design = placement && designs.get(placement.designId);
    if (!placement || !design || !areas) return;
    const area = areas[placement.area];
    const center = surfacePoint(area, placement.x, placement.y);
    const { right, up, normal } = decalOrientation(area, placement.rotationDeg);
    const w = placement.widthCm / 2 + 0.4;
    const h = placement.widthCm / design.aspect / 2 + 0.4;
    const lift = normal.clone().multiplyScalar(1.2);
    const corners = [
      [-w, -h],
      [w, -h],
      [w, h],
      [-w, h],
    ].map(([x, y]) => center.clone().add(lift).addScaledVector(right, x).addScaledVector(up, y));
    outline = new LineLoop(new BufferGeometry().setFromPoints(corners), outlineMaterial);
    outline.computeLineDistances();
    outline.renderOrder = 5;
    scene.add(outline);
  };

  /* Guia de posicionamento (só na tela) ------------------------------------- */
  const guideGroup = new Group();
  scene.add(guideGroup);
  const guideMaterial = new LineDashedMaterial({ color: "#0089c2", dashSize: 1, gapSize: 0.6 });
  const guideSnapMaterial = new LineDashedMaterial({ color: "#ff5a1f", dashSize: 1.4, gapSize: 0.4 });
  const clearGuides = () => {
    for (const child of [...guideGroup.children]) {
      guideGroup.remove(child);
      if (child instanceof Line) child.geometry.dispose();
      if (child instanceof Sprite) {
        child.material.map?.dispose();
        child.material.dispose();
      }
    }
  };
  const guideLabel = (text: string, snappedNow: boolean) => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 112;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = snappedNow ? "#ff5a1f" : "#0089c2";
    ctx.beginPath();
    ctx.roundRect(4, 4, 632, 104, 52);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 52px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 320, 58);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    const sprite = new Sprite(new SpriteMaterial({ map: texture, transparent: true }));
    sprite.scale.set(15, 2.6, 1);
    sprite.renderOrder = 7;
    return sprite;
  };
  const updateGuides = () => {
    clearGuides();
    const placement = placements.find((p) => p.id === selectedId);
    if (!guide.enabled || !placement || !areas || !spec) return;
    if (placement.area !== "front" && placement.area !== "back" && placement.area !== "chest") return;
    const area = areas[placement.area];
    const normal = new Vector3(...area.frame.normal);
    const onSurface = (x: number, y: number) => surfacePoint(area, x, y).addScaledVector(normal, 0.35);
    const line = (points: Vector3[], active: boolean) => {
      const object = new Line(new BufferGeometry().setFromPoints(points), active ? guideSnapMaterial : guideMaterial);
      object.computeLineDistances();
      object.renderOrder = 4;
      guideGroup.add(object);
    };
    const steps = 48;
    const { minX, maxX, minY, maxY } = area.bounds;
    const guideY = collarY(spec, dims(), area.id) - guide.distanceCm - area.frame.origin[1];
    line(
      Array.from({ length: steps + 1 }, (_, i) => onSurface(lerp(minX, maxX, i / steps), guideY)),
      snapped.y,
    );
    if (area.id !== "chest") {
      line(
        Array.from({ length: steps + 1 }, (_, i) => onSurface(0, lerp(minY, maxY + 2, i / steps))),
        snapped.x,
      );
    }
    const cm = guide.distanceCm.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    const label = guideLabel(`${guide.distanceCm === 7.5 ? "4 dedos · " : ""}${cm} cm da gola`, snapped.y);
    label.position.copy(onSurface(Math.max(minX + 8, maxX - 8), guideY + 1.9)).addScaledVector(normal, 1.2);
    guideGroup.add(label);
    dirty = true;
  };

  const syncPrints = () => {
    const alive = new Set<string>();
    for (const placement of placements) {
      const design = designs.get(placement.designId);
      if (!design) continue;
      alive.add(placement.id);
      const current = prints.get(placement.id);
      if (current && current.key === placementKey(placement, design)) continue;
      if (current) disposePrint(current);
      const next = buildPrint(placement, design);
      if (next) {
        printsGroup.add(next.mesh);
        prints.set(placement.id, next);
      } else {
        prints.delete(placement.id);
      }
    }
    for (const [id, print] of prints) {
      if (!alive.has(id)) {
        disposePrint(print);
        prints.delete(id);
      }
    }
    // Texturas de desenhos que saíram (ou cuja arte mudou) são liberadas.
    const usedCanvases = new Set([...designs.values()].map((d) => d.art));
    for (const [canvas, texture] of textures) {
      if (!usedCanvases.has(canvas)) {
        texture.dispose();
        textures.delete(canvas);
      }
    }
    updateOutline();
    updateGuides();
    dirty = true;
  };

  /* Arrastar estampas ------------------------------------------------------- */
  const pointer = new Vector2();
  const setPointer = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
  };
  const pickPrint = (): string | null => {
    const hit = raycaster.intersectObjects(printsGroup.children, false).find((h) => {
      // Ignora pixels transparentes da arte (dá para pegar a peça entre as letras).
      const material = (h.object as Mesh).material as MeshStandardMaterial;
      const image = material.map?.image as HTMLCanvasElement | undefined;
      if (!image || !h.uv) return true;
      const ctx = image.getContext("2d", { willReadFrequently: true });
      if (!ctx) return true;
      const x = Math.min(image.width - 1, Math.max(0, Math.floor(h.uv.x * image.width)));
      const y = Math.min(image.height - 1, Math.max(0, Math.floor((1 - h.uv.y) * image.height)));
      return ctx.getImageData(x, y, 1, 1).data[3] > 20;
    });
    return (hit?.object.userData.placementId as string | undefined) ?? null;
  };

  let drag: { id: string; offsetX: number; offsetY: number; pointerId: number; moved: boolean } | null = null;
  let pendingDrag: Placement | null = null;

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || !areas) return;
    setPointer(event);
    const id = pickPrint();
    if (!id) return;
    const placement = placements.find((p) => p.id === id);
    if (!placement) return;
    // A estampa "segura" o ponteiro: a órbita não recebe este gesto.
    event.stopPropagation();
    event.preventDefault();
    const area = areas[placement.area];
    const mesh = targetMesh(area);
    const hit = mesh && raycaster.intersectObject(mesh, false)[0];
    const grabbed = hit ? frameCoords(area.frame, hit.point.toArray() as Vec3) : { x: placement.x, y: placement.y };
    drag = { id, offsetX: placement.x - grabbed.x, offsetY: placement.y - grabbed.y, pointerId: event.pointerId, moved: false };
    container.setPointerCapture(event.pointerId);
    controls.enabled = false;
    container.style.cursor = "grabbing";
    if (selectedId !== id) callbacks.onSelect(id);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!areas) return;
    setPointer(event);
    if (!drag) {
      if (event.pointerType === "mouse") container.style.cursor = pickPrint() ? "grab" : "";
      return;
    }
    if (event.pointerId !== drag.pointerId) return;
    event.stopPropagation();
    const placement = placements.find((p) => p.id === drag!.id);
    const design = placement && designs.get(placement.designId);
    if (!placement || !design) return;
    const area = areas[placement.area];
    const mesh = targetMesh(area);
    const hit = mesh && raycaster.intersectObject(mesh, false)[0];
    if (!hit || !hit.face) return;
    // Só aceita o lado da peça que pertence à área (não "atravessa" para as costas).
    const faceNormal = hit.face.normal.clone().transformDirection(mesh.matrixWorld);
    if (faceNormal.dot(new Vector3(...area.frame.normal)) < 0.1) return;
    const coords = frameCoords(area.frame, hit.point.toArray() as Vec3);
    const candidate = { ...placement, x: coords.x + drag.offsetX, y: coords.y + drag.offsetY };
    // Ímã: o topo "gruda" na guia da gola e o centro no eixo da peça.
    snapped = { x: false, y: false };
    if (guide.enabled && spec && (area.id === "front" || area.id === "back" || area.id === "chest")) {
      const half = placementHalfHeight(candidate, design.aspect);
      const guideY = collarY(spec, dims(), area.id) - guide.distanceCm - area.frame.origin[1];
      if (Math.abs(candidate.y + half - guideY) < SNAP_CM) {
        candidate.y = guideY - half;
        snapped.y = true;
      }
      if (area.id !== "chest" && Math.abs(candidate.x) < SNAP_CM) {
        candidate.x = 0;
        snapped.x = true;
      }
    }
    const next = clampPlacement(candidate, area, design.aspect);
    drag.moved = true;
    placements = placements.map((p) => (p.id === next.id ? next : p));
    pendingDrag = next;
    syncPrints();
  };

  const endDrag = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
    drag = null;
    snapped = { x: false, y: false };
    updateGuides();
    controls.enabled = true;
    container.style.cursor = "";
    if (pendingDrag) callbacks.onPlacementChange(pendingDrag);
    pendingDrag = null;
  };

  container.addEventListener("pointerdown", onPointerDown, { capture: true });
  container.addEventListener("pointermove", onPointerMove, { capture: true });
  container.addEventListener("pointerup", endDrag);
  container.addEventListener("pointercancel", endDrag);

  // Envia a posição ao React no máximo uma vez por quadro durante o arraste.
  let lastSent: Placement | null = null;

  /* Vistas animadas ---------------------------------------------------------- */
  let animation: { from: number; to: number; start: number; polarFrom: number } | null = null;
  const azimuthOf = () => {
    const offset = camera.position.clone().sub(controls.target);
    return Math.atan2(offset.x, offset.z);
  };
  const placeCamera = (azimuth: number, polar: number, distance = fitDistance) => {
    const offset = new Vector3(
      distance * Math.sin(polar) * Math.sin(azimuth),
      distance * Math.cos(polar),
      distance * Math.sin(polar) * Math.cos(azimuth),
    );
    camera.position.copy(controls.target).add(offset);
    camera.lookAt(controls.target);
  };
  const DEFAULT_POLAR = Math.PI / 2 - 0.12;

  renderer.setAnimationLoop((time) => {
    if (animation) {
      const t = Math.min(1, (time - animation.start) / 650);
      const k = 1 - (1 - t) ** 3;
      const distance = camera.position.distanceTo(controls.target);
      placeCamera(lerp(animation.from, animation.to, k), lerp(animation.polarFrom, DEFAULT_POLAR, k), distance);
      if (t >= 1) animation = null;
      dirty = true;
    }
    if (controls.update()) dirty = true;
    if (drag && pendingDrag && pendingDrag !== lastSent) {
      lastSent = pendingDrag;
      callbacks.onPlacementChange(pendingDrag);
    }
    if (dirty) {
      renderer.render(scene, camera);
      dirty = false;
    }
  });

  /* Cores -------------------------------------------------------------------- */
  /** Gola, punhos e debruns: cor própria ou um tom da malha. */
  const applyTrim = () => {
    const color = new Color(trimHex ?? fabricHex);
    if (!trimHex) color.multiplyScalar(0.96);
    ribbed.color.copy(color);
    cutUniforms.uTrim.value.copy(color);
    dirty = true;
  };

  const setColor = (hex: string) => {
    const color = new Color(hex);
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    fabricHex = hex;
    fabric.color.copy(color);
    applyTrim();
    // O lado de dentro aparece mais escuro (sem luz direta).
    inner.color.copy(color).multiplyScalar(0.62);
    // Malha escura com brilho de fibra (sheen) suave; clara quase sem.
    const dark = hsl.l < 0.3;
    const sheen = new Color(hex).lerp(new Color("#ffffff"), dark ? 0.18 : 0.3);
    fabric.sheenColor.copy(sheen);
    ribbed.sheenColor.copy(sheen);
    fabric.sheen = ribbed.sheen = dark ? 0.45 : 0.5;
    // Malha escura reflete menos o ambiente: o preto continua preto.
    fabric.envMapIntensity = ribbed.envMapIntensity = dark ? 0.35 : 0.6;
    dirty = true;
  };

  const disposeGarment = () => {
    if (!garment) return;
    root.remove(garment.group);
    // O manequim é reaproveitado: sai do grupo antes de liberar a peça.
    if (mannequin) {
      garment.group.remove(mannequin);
      mannequin = null;
    }
    const geometries = new Set<BufferGeometry>([garment.body.geometry]);
    garment.group.traverse((object: Object3D) => {
      if (object instanceof Mesh) geometries.add(object.geometry);
    });
    geometries.forEach((geometry) => geometry.dispose());
    garment = null;
  };

  return {
    setGarment(nextSpec, nextSize, nextPose) {
      const firstTime = !spec;
      disposeGarment();
      spec = nextSpec;
      size = nextSize;
      pose = nextPose;
      areas = printAreas(nextSpec, nextSize, nextPose);
      garment = buildGarment(nextSpec, nextSize, nextPose, { fabric: [fabric, ribbed], inner });
      if (nextPose === "mannequin") {
        const kind = nextSpec.female ? "female" : "male";
        const target = garment;
        mannequinUniforms.uWaist.value = (nextSpec.female ? 95 : 97) / 100;
        {
          // Medidas em metros, no espaço do modelo do manequim.
          const figure = bodyFor(nextSpec);
          const d = garmentDims(nextSpec, nextSize, nextPose);
          const hemY = hemOnBody(nextSpec, nextSize);
          const visible = d.sleeveLength - d.sleeveInset;
          // Barra da manga um pouco acima do cálculo: sob a barra o braço continua visível.
          const sleeveEnd = figure.armRoot[1] + d.sleeveDir[1] * visible + 3;
          const u = mannequinUniforms;
          u.uHide.value = nextSpec.sleeve ? 1 : 0;
          u.uHemY.value = (hemY + 2) / 100;
          u.uCoverTop.value = (figure.neckBaseY - 3) / 100;
          u.uSleeveEndY.value = sleeveEnd / 100;
          // Abertura da gola: decote V e baby look mostram mais o peito.
          u.uChestOpen.value = (nextSpec.neck === "v" || nextSpec.neck === "scoop" ? 9 : 7.5) / 100;
          u.uTorsoHalf.value = (figure.shoulderX - 6) / 100;
        }
        void loadMannequin(kind).then((model) => {
          // Só entra se a peça ainda for a mesma (o usuário pode ter trocado no meio).
          if (garment !== target) return;
          mannequin = model;
          target.group.add(model);
          target.group.updateMatrixWorld(true);
          dirty = true;
        });
      }
      // Regata canelada: a malha toda vira ribana.
      fabric.normalMap = nextSpec.ribbed ? rib : knit;
      fabric.normalScale.setScalar(nextSpec.ribbed ? 0.8 : 0.35);
      garment.group.traverse((object: Object3D) => {
        if (object instanceof Mesh) {
          // O lado de dentro não projeta sombra (já projeta pelo lado de fora).
          object.castShadow = object.material !== inner;
          object.receiveShadow = true;
        }
      });
      if (nextSpec.tank) garment.shell.customDepthMaterial = cutDepth;
      root.add(garment.group);
      garment.group.updateMatrixWorld(true);
      // Peça nova: todas as estampas são reprojetadas na nova superfície.
      for (const print of prints.values()) disposePrint(print);
      prints.clear();
      resize();
      fitCamera(!firstTime);
      syncPrints();
    },
    setColor,
    setTrim(hex) {
      trimHex = hex;
      applyTrim();
    },
    setGuide(next) {
      guide = next;
      updateGuides();
    },
    setPrints(nextDesigns, nextPlacements) {
      designs = new Map(nextDesigns.map((d) => [d.id, d]));
      // Durante o arraste a posição local é a mais nova.
      placements = drag ? nextPlacements.map((p) => (p.id === drag!.id ? (placements.find((q) => q.id === p.id) ?? p) : p)) : nextPlacements;
      syncPrints();
    },
    setSelected(id) {
      selectedId = id;
      updateOutline();
      updateGuides();
      dirty = true;
    },
    setView(view) {
      const from = azimuthOf();
      let to = VIEW_AZIMUTH[view];
      // Caminho mais curto.
      while (to - from > Math.PI) to -= Math.PI * 2;
      while (to - from < -Math.PI) to += Math.PI * 2;
      const offset = camera.position.clone().sub(controls.target);
      animation = { from, to, start: performance.now(), polarFrom: Math.acos(offset.y / offset.length()) };
    },
    async snapshot(view, width, height) {
      const previous = { position: camera.position.clone(), aspect: camera.aspect, ratio: renderer.getPixelRatio() };
      const outlineVisible = outline?.visible ?? false;
      if (outline) outline.visible = false;
      // A guia é só de tela: nunca sai na prova.
      guideGroup.visible = false;
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      // Mais perto que na tela: na prova a peça ocupa o cartão inteiro.
      placeCamera(VIEW_AZIMUTH[view], DEFAULT_POLAR, fitDistance * (pose === "mannequin" ? 0.92 : 0.82));
      renderer.render(scene, camera);
      // toBlob copia a imagem no momento da chamada, antes de restaurar o tamanho.
      const blob = new Promise<Blob>((resolve, reject) =>
        renderer.domElement.toBlob((result) => (result ? resolve(result) : reject(new Error("snapshot"))), "image/png"),
      );
      if (outline) outline.visible = outlineVisible;
      guideGroup.visible = true;
      renderer.setPixelRatio(previous.ratio);
      camera.position.copy(previous.position);
      camera.lookAt(controls.target);
      resize();
      dirty = true;
      return blob;
    },
    dispose() {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      container.removeEventListener("pointerdown", onPointerDown, { capture: true });
      container.removeEventListener("pointermove", onPointerMove, { capture: true });
      container.removeEventListener("pointerup", endDrag);
      container.removeEventListener("pointercancel", endDrag);
      controls.dispose();
      for (const print of prints.values()) disposePrint(print);
      prints.clear();
      textures.forEach((texture) => texture.dispose());
      if (outline) outline.geometry.dispose();
      outlineMaterial.dispose();
      clearGuides();
      guideMaterial.dispose();
      guideSnapMaterial.dispose();
      disposeGarment();
      allMaterials.forEach((material) => material.dispose());
      for (const promise of mannequins.values()) {
        void promise.then((model) =>
          model.traverse((object: Object3D) => {
            if (object instanceof Mesh) object.geometry.dispose();
          }),
        );
      }
      knit.dispose();
      rib.dispose();
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
