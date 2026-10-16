import "server-only";
import { cookies } from "next/headers";
import { authSecret, isProduction, SESSION_COOKIE, SESSION_HOURS } from "./config";
import { readPasswordHash } from "./store";
import { passwordVersion, signToken, verifyToken } from "./token";

export async function createSession(passwordHash: string): Promise<void> {
  const secret = authSecret();
  const expires = Date.now() + SESSION_HOURS * 3_600_000;
  const token = signToken({ purpose: "session", exp: expires, pv: passwordVersion(passwordHash, secret) }, secret);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    expires: new Date(expires),
    priority: "high",
  });
}

export async function deleteSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Verificação completa: assinatura, validade e versão da senha. Usada nas páginas
 * protegidas; o proxy faz só a checagem otimista (sem consultar o armazenamento).
 */
export async function hasValidSession(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const secret = authSecret();
  const payload = verifyToken(token, secret, "session");
  if (!payload) return false;
  const hash = await readPasswordHash();
  return !!hash && payload.pv === passwordVersion(hash, secret);
}
