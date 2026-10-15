import { pixelsPerMeter } from "./measurements";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const PNG_SIGNATURE_LENGTH = 8;
/** Assinatura + chunk IHDR (4 tamanho + 4 tipo + 13 dados + 4 CRC). */
const IHDR_END = PNG_SIGNATURE_LENGTH + 25;

/**
 * Grava a resolução (chunk pHYs) no PNG. O canvas exporta sem essa informação,
 * e sem ela programas de impressão assumem 72/96 PPI e erram o tamanho físico.
 */
export function withPngResolution(png: Uint8Array, ppi: number): Uint8Array {
  const ppm = pixelsPerMeter(ppi);
  const chunk = new Uint8Array(4 + 4 + 9 + 4);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  view.setUint32(8, ppm);
  view.setUint32(12, ppm);
  chunk[16] = 1; // unidade: metro
  view.setUint32(17, crc32(chunk.subarray(4, 17)));

  const result = new Uint8Array(png.length + chunk.length);
  result.set(png.subarray(0, IHDR_END), 0);
  result.set(chunk, IHDR_END);
  result.set(png.subarray(IHDR_END), IHDR_END + chunk.length);
  return result;
}
