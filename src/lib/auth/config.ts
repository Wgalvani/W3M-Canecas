import "server-only";

/** Configuração lida das variáveis de ambiente. Sem segredo válido, o login falha fechado. */
export const SESSION_HOURS = 12;
export const RESET_MINUTES = 30;

export const isProduction = process.env.NODE_ENV === "production";

/** `__Host-` exige HTTPS, caminho "/" e nenhum domínio: o cookie não vaza para subdomínios. */
export const SESSION_COOKIE = isProduction ? "__Host-w3m_session" : "w3m_session";

export function authSecret(): string {
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error("AUTH_SECRET ausente ou curto (mínimo 32 caracteres). Veja SEGURANCA.md.");
  }
  return secret;
}

export function adminAccount() {
  return {
    username: (process.env.ADMIN_USERNAME || "Administrador").trim(),
    email: (process.env.ADMIN_EMAIL ?? "").trim(),
  };
}

/** URL pública do app, usada no link do e-mail (nunca derivada do cabeçalho Host, que o cliente controla). */
export function appUrl(): string {
  const url = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  return (url || "http://localhost:3001").replace(/\/+$/, "");
}
