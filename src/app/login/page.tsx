import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/forms";
import { hasValidSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Entrar · W3M Studio" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // Verificação completa: um cookie de antes da troca de senha não pode levar de volta ao app.
  if (await hasValidSession()) redirect("/");
  const { next, redefinida } = await searchParams;
  return (
    <AuthShell eyebrow="Acesso restrito" title="Entrar" description="Use o usuário e a senha do Administrador.">
      <LoginForm
        next={typeof next === "string" ? next : undefined}
        notice={redefinida ? "Senha redefinida. Entre com a nova senha (pode levar alguns segundos para valer)." : undefined}
      />
    </AuthShell>
  );
}
