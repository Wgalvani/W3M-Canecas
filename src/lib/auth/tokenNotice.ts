/** Antecedência do aviso de renovação do token da Vercel. */
export const TOKEN_WARN_DAYS = 30;

export type TokenNotice =
  | { kind: "expiring"; daysLeft: number; expiresAt: number }
  | { kind: "expired"; expiresAt?: number };

const DAY = 86_400_000;

/**
 * Decide o aviso a partir dos metadados do token (`expiresAt` em ms) ou da resposta da API.
 * `null` = nada a avisar. Token sem data de expiração nunca gera aviso.
 */
export function tokenNotice(input: { status: number; expiresAt?: number | string | null }, now = Date.now()): TokenNotice | null {
  // 401/403 com o próprio token: vencido, revogado ou apagado.
  if (input.status === 401 || input.status === 403) return { kind: "expired" };
  if (input.status !== 200 || input.expiresAt == null) return null;
  const expiresAt = Number(input.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return null;
  if (expiresAt <= now) return { kind: "expired", expiresAt };
  const daysLeft = Math.ceil((expiresAt - now) / DAY);
  return daysLeft <= TOKEN_WARN_DAYS ? { kind: "expiring", daysLeft, expiresAt } : null;
}
