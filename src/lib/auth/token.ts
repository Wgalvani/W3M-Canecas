import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token assinado (HMAC-SHA256), sem estado no servidor: `payload.assinatura` em base64url.
 * Usado na sessão e no link de redefinição de senha.
 */
export interface TokenPayload {
  /** Finalidade: um token de sessão nunca vale como link de redefinição e vice-versa. */
  purpose: "session" | "reset";
  /** Expiração (ms desde a época). */
  exp: number;
  /** Versão da senha: muda quando a senha muda e invalida tokens antigos. */
  pv: string;
}

const sign = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest("base64url");

export function signToken(payload: TokenPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function verifyToken(
  token: string | undefined,
  secret: string,
  purpose: TokenPayload["purpose"],
  now = Date.now(),
): TokenPayload | null {
  if (!token || token.length > 2048) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(body, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as TokenPayload;
    if (payload.purpose !== purpose || typeof payload.exp !== "number" || payload.exp <= now) return null;
    if (typeof payload.pv !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

/** Impressão digital do hash da senha atual (não revela o hash). */
export function passwordVersion(passwordHash: string, secret: string): string {
  return createHmac("sha256", secret).update(`pv:${passwordHash}`).digest("base64url").slice(0, 22);
}
