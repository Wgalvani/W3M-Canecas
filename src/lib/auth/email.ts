import "server-only";
import { isProduction } from "./config";

/**
 * Envio do e-mail de redefinição pela API do Resend (sem dependências extras).
 * Em desenvolvimento, sem RESEND_API_KEY, o link é impresso no terminal do servidor.
 */
export async function sendResetEmail(to: string, link: string, minutes: number): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (isProduction) throw new Error("RESEND_API_KEY não configurada.");
    console.info(`\n[auth] Link de redefinição (dev, e-mail não enviado):\n${link}\n`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "W3M Canecas <onboarding@resend.dev>",
      to: [to],
      subject: "W3M Canecas · Redefinição de senha",
      text: [
        "Recebemos um pedido para redefinir a senha do usuário Administrador.",
        "",
        `Abra o link abaixo em até ${minutes} minutos para criar uma nova senha:`,
        link,
        "",
        "Se não foi você, ignore este e-mail: a senha atual continua valendo.",
      ].join("\n"),
      html: `<div style="font-family:Arial,sans-serif;max-width:480px;color:#16181d">
  <h2 style="margin:0 0 12px">Redefinição de senha</h2>
  <p>Recebemos um pedido para redefinir a senha do usuário <strong>Administrador</strong> do W3M Canecas.</p>
  <p><a href="${link}" style="display:inline-block;background:#16181d;color:#f3f1eb;padding:12px 22px;border-radius:999px;text-decoration:none">Criar nova senha</a></p>
  <p style="color:#6a6e77;font-size:13px">O link vale por ${minutes} minutos e só pode ser usado uma vez. Se não foi você, ignore este e-mail: a senha atual continua valendo.</p>
</div>`,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Falha no envio do e-mail (${res.status}): ${await res.text()}`);
}
