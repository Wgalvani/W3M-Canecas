"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, requestPasswordReset, resetPassword, type FormState } from "@/lib/auth/actions";
import { Field, FormMessage, PasswordField, SubmitButton } from "./fields";

const linkClass = "font-medium text-signal-ink underline decoration-signal/40 underline-offset-4 transition hover:decoration-signal";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action] = useActionState<FormState, FormData>(login, {});
  return (
    <form action={action} className="space-y-4">
      {!state.error && <FormMessage message={notice} />}
      <FormMessage error={state.error} />
      <input type="hidden" name="next" value={next ?? "/"} />
      <Field
        key={state.username}
        label="Usuário"
        name="username"
        defaultValue={state.username}
        autoComplete="username"
        required
        autoCapitalize="none"
        spellCheck={false}
        autoFocus={!state.username}
      />
      <PasswordField label="Senha" name="password" autoComplete="current-password" required autoFocus={!!state.username} />
      <div className="pt-2">
        <SubmitButton pendingLabel="Entrando…">Entrar</SubmitButton>
      </div>
      <p className="pt-2 text-center text-sm">
        <Link href="/esqueci-senha" className={linkClass}>
          Esqueci minha senha
        </Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, {});
  return (
    <form action={action} className="space-y-4">
      <FormMessage error={state.error} message={state.message} />
      {!state.message && (
        <>
          <Field label="Usuário ou e-mail cadastrado" name="identifier" autoComplete="username" required autoCapitalize="none" spellCheck={false} autoFocus />
          <div className="pt-2">
            <SubmitButton pendingLabel="Enviando…">Enviar link</SubmitButton>
          </div>
        </>
      )}
      <p className="pt-2 text-center text-sm">
        <Link href="/login" className={linkClass}>
          Voltar para o login
        </Link>
      </p>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState<FormState, FormData>(resetPassword, {});
  return (
    <form action={action} className="space-y-4">
      <FormMessage error={state.error} />
      <input type="hidden" name="token" value={token} />
      <PasswordField label="Nova senha" name="password" autoComplete="new-password" required minLength={12} autoFocus />
      <PasswordField label="Confirme a nova senha" name="confirm" autoComplete="new-password" required minLength={12} />
      <p className="text-xs leading-relaxed text-muted">
        Mínimo de 12 caracteres, combinando pelo menos 3 tipos: minúsculas, maiúsculas, números e símbolos.
      </p>
      <div className="pt-2">
        <SubmitButton pendingLabel="Salvando…">Salvar nova senha</SubmitButton>
      </div>
    </form>
  );
}
