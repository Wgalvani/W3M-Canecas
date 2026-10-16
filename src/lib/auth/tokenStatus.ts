import "server-only";
import { tokenNotice, type TokenNotice } from "./tokenNotice";

/** A consulta à Vercel é refeita no máximo a cada 6 h por instância. */
const CACHE_MS = 6 * 3_600_000;
let cached: { at: number; notice: TokenNotice | null } | null = null;

/**
 * Lê na própria Vercel quando o VERCEL_API_TOKEN (usado para gravar a senha) vence.
 * Qualquer falha de rede vira "sem aviso": o lembrete nunca atrapalha o uso do app.
 */
export async function vercelTokenNotice(): Promise<TokenNotice | null> {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) return null;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.notice;
  try {
    const res = await fetch("https://api.vercel.com/v5/user/tokens/current", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    const body = res.ok ? ((await res.json()) as { token?: { expiresAt?: number | string } }) : null;
    const notice = tokenNotice({ status: res.status, expiresAt: body?.token?.expiresAt });
    cached = { at: Date.now(), notice };
    return notice;
  } catch (err) {
    console.warn("[auth] Não foi possível consultar a validade do token da Vercel:", err);
    return null;
  }
}
