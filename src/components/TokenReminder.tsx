"use client";

import { useState } from "react";
import type { TokenNotice } from "@/lib/auth/tokenNotice";

const formatDate = (ms: number) => new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

/** Lembrete de renovação do token da Vercel que grava a senha redefinida por e-mail. */
export function TokenReminder({ notice }: { notice: TokenNotice }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const expired = notice.kind === "expired";
  const title = expired
    ? "O token da Vercel venceu ou foi revogado: a redefinição de senha por e-mail está parada."
    : `O token da Vercel vence em ${notice.daysLeft} dia${notice.daysLeft > 1 ? "s" : ""} (${formatDate(notice.expiresAt)}).`;

  return (
    <div
      role="status"
      className={`mb-4 animate-rise rounded-2xl border p-4 text-sm ${
        expired ? "border-red-200 bg-red-50 text-red-950" : "border-amber-300 bg-amber-50 text-amber-950"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${expired ? "bg-red-600" : "bg-amber-500"}`}
        >
          !
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title}</p>
          <p className="mt-0.5 opacity-80">
            O login continua funcionando. Só o “Esqueci minha senha” depende desse token.
          </p>

          <details className="group mt-3">
            <summary className="cursor-pointer list-none font-medium underline underline-offset-4 [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Ver passo a passo da renovação</span>
              <span className="hidden group-open:inline">Ocultar passo a passo</span>
            </summary>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 leading-relaxed">
              <li>
                Na Vercel, vá em <strong>Account Settings → Tokens</strong>.
              </li>
              <li>
                Em <strong>Create Token</strong>: nome <code>w3m-canecas-senha</code>, <strong>Scope</strong> = a conta{" "}
                <strong>WG Solutions&apos; projects</strong> (não o projeto) e <strong>Expiration</strong> = 1 ano. Clique em{" "}
                <strong>Create</strong> e copie o token.
              </li>
              <li>
                No projeto <strong>w3m-canecas → Settings → Environments → Production → Environment Variables</strong>, edite{" "}
                <code>VERCEL_API_TOKEN</code> e cole o novo token (marque <em>Sensitive</em>).
              </li>
              <li>
                Em <strong>Deployments → ⋯ → Redeploy</strong>, publique de novo e aguarde ficar <em>Ready</em>.
              </li>
              <li>
                Teste o <strong>Esqueci minha senha</strong> na tela de login.
              </li>
              <li>
                Volte em <strong>Tokens</strong> e <strong>revogue o token antigo</strong> (⋯ → Revoke).
              </li>
            </ol>
          </details>
        </div>
        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label="Ocultar aviso"
          className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-full opacity-60 transition hover:bg-black/5 hover:opacity-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
