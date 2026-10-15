import type { ProductPreset } from "@/types/image";
import { ART_SIZE_LIMITS_MM, DEFAULT_PRESET, PRESETS, PRINT_DEFAULTS } from "./constants";

const STORAGE_KEY = "canecas:art-size";

/**
 * "9,5" / "9.5" / " 21 " → mm. Aceita até uma casa decimal (precisão de 1 mm),
 * a mesma usada para exibir as medidas. `null` quando o texto não é válido.
 */
export function parseCm(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (!/^\d+(\.\d)?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 10);
}

export function isValidSideMm(mm: number): boolean {
  return Number.isFinite(mm) && mm >= ART_SIZE_LIMITS_MM.min && mm <= ART_SIZE_LIMITS_MM.max;
}

/**
 * Preset com as medidas pedidas. Se elas coincidem com um preset conhecido,
 * devolve o próprio preset; senão, um "Personalizado" com PPI e área segura padrão.
 */
export function presetForSize(widthMm: number, heightMm: number): ProductPreset {
  const known = PRESETS.find((p) => p.widthMm === widthMm && p.heightMm === heightMm);
  if (known) return known;
  return { ...PRINT_DEFAULTS, id: "personalizado", name: "Personalizado", widthMm, heightMm };
}

/** Último tamanho usado neste navegador; o padrão quando não há (ou o armazenamento está bloqueado). */
export function loadSavedPreset(): ProductPreset {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && isValidSideMm(saved.widthMm) && isValidSideMm(saved.heightMm)) {
      return presetForSize(saved.widthMm, saved.heightMm);
    }
  } catch {
    // Armazenamento indisponível ou valor corrompido: segue com o padrão.
  }
  return DEFAULT_PRESET;
}

export function savePreset(preset: ProductPreset): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ widthMm: preset.widthMm, heightMm: preset.heightMm }));
  } catch {
    // Sem armazenamento o tamanho só não é lembrado na próxima visita.
  }
}
