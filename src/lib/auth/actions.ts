"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminAccount, appUrl, authSecret, isProduction, RESET_MINUTES } from "./config";
import { sendResetEmail } from "./email";
import { hashPassword, passwordProblem, verifyPassword } from "./password";
import { createRateLimiter } from "./rateLimit";
import { createSession, deleteSession } from "./session";
import { canStorePassword, readPasswordHash, writePasswordHash } from "./store";
import { passwordVersion, signToken, verifyToken } from "./token";

export interface FormState {
  error?: string;
  message?: string;
  /** Usuário digitado, para o formulário não esvaziar o campo após um erro. */
  username?: string;
}

const MINUTE = 60_000;
/** Por IP: 5 erros a cada 15 min. Na conta toda: 20 erros a cada 15 min (ataque distribuído). */
const loginByIp = createRateLimiter(5, 15 * MINUTE);
const loginGlobal = createRateLimiter(20, 15 * MINUTE);
/** Pedidos de redefinição: 3 por hora por IP e no máximo 1 e-mail a cada 2 min. */
const resetByIp = createRateLimiter(3, 60 * MINUTE);
const resetMail = createRateLimiter(1, 2 * MINUTE);

const GENERIC_LOGIN_ERROR = "Usuário ou senha inválidos.";
const RESET_SENT =
  "Se os dados conferem com o cadastro, enviamos um link para o e-mail do Administrador. Ele vale por " +
  `${RESET_MINUTES} minutos.`;

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

const sameText = (a: string, b: string) => a.trim().toLocaleLowerCase("pt-BR") === b.trim().toLocaleLowerCase("pt-BR");

/** Pequena espera em respostas negativas: desacelera automação e iguala tempos. */
const pause = () => new Promise((r) => setTimeout(r, 400 + Math.random() * 400));

/** Só aceita caminhos internos, para o parâmetro `next` não virar redirecionamento aberto. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

function minutesLabel(seconds: number) {
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minuto${minutes > 1 ? "s" : ""}`;
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const ip = await clientIp();
  const wait = Math.max(loginByIp.retryAfter(ip), loginGlobal.retryAfter("all"));
  if (wait > 0) return { error: `Muitas tentativas. Aguarde ${minutesLabel(wait)} e tente de novo.` };

  const username = String(formData.get("username") ?? "").slice(0, 100);
  const password = String(formData.get("password") ?? "").slice(0, 256);

  // Se o armazenamento falhar, recusa: voltar à senha da variável reabriria uma senha já trocada.
  const hash = await readPasswordHash().catch((err) => {
    console.error("[auth] Falha ao ler a senha:", err);
    return undefined;
  });
  if (hash === undefined) return { error: "Login temporariamente indisponível. Tente novamente em instantes." };
  if (!hash) {
    console.error("[auth] Nenhuma senha configurada (ADMIN_PASSWORD_HASH / Global Config).");
    await pause();
    return { error: isProduction ? GENERIC_LOGIN_ERROR : "Senha ainda não configurada: rode `npm run hash-password` (veja SEGURANCA.md)." };
  }

  // A senha é sempre verificada, mesmo com usuário errado: o tempo de resposta não revela qual campo errou.
  const passwordOk = await verifyPassword(password, hash);
  if (!passwordOk || !sameText(username, adminAccount().username)) {
    loginByIp.hit(ip);
    loginGlobal.hit("all");
    await pause();
    return { error: GENERIC_LOGIN_ERROR, username };
  }

  loginByIp.reset(ip);
  await createSession(hash);
  redirect(safeNext(formData.get("next")));
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const ip = await clientIp();
  if (resetByIp.retryAfter(ip) > 0) return { error: "Muitos pedidos. Tente novamente mais tarde." };
  resetByIp.hit(ip);

  const identifier = String(formData.get("identifier") ?? "").slice(0, 200);
  const account = adminAccount();
  const matches = !!account.email && (sameText(identifier, account.username) || sameText(identifier, account.email));

  // Resposta idêntica com ou sem cadastro: não confirma quem é o Administrador.
  if (!matches || resetMail.retryAfter("mail") > 0) {
    await pause();
    return { message: RESET_SENT };
  }

  const hash = await readPasswordHash();
  if (!hash || !canStorePassword()) {
    console.error("[auth] Redefinição indisponível: senha inicial ou armazenamento (Global Config) não configurados.");
    await pause();
    return { message: RESET_SENT };
  }

  const secret = authSecret();
  const token = signToken(
    { purpose: "reset", exp: Date.now() + RESET_MINUTES * MINUTE, pv: passwordVersion(hash, secret) },
    secret,
  );
  try {
    await sendResetEmail(account.email, `${appUrl()}/redefinir-senha?token=${encodeURIComponent(token)}`, RESET_MINUTES);
    resetMail.hit("mail");
  } catch (err) {
    console.error("[auth] Falha ao enviar e-mail de redefinição:", err);
  }
  return { message: RESET_SENT };
}

/** O link vale uma vez só: a nova senha muda a versão e invalida o token (e as sessões antigas). */
async function validResetToken(token: string): Promise<boolean> {
  const secret = authSecret();
  const payload = verifyToken(token, secret, "reset");
  if (!payload) return false;
  const hash = await readPasswordHash();
  return !!hash && payload.pv === passwordVersion(hash, secret);
}

export async function isResetTokenValid(token: string): Promise<boolean> {
  return validResetToken(token);
}

export async function resetPassword(_: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!(await validResetToken(token))) return { error: "Link inválido ou expirado. Peça um novo." };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== confirm) return { error: "As senhas não conferem." };

  try {
    await writePasswordHash(await hashPassword(password));
  } catch (err) {
    console.error("[auth] Falha ao gravar a nova senha:", err);
    return { error: "Não foi possível salvar a nova senha. Tente novamente em instantes." };
  }
  await deleteSession();
  redirect("/login?redefinida=1");
}
