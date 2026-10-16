import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetForm } from "@/components/auth/forms";
import { isResetTokenValid } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Redefinir senha · W3M Canecas", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/redefinir-senha">) {
  const { token } = await searchParams;
  const valid = typeof token === "string" && (await isResetTokenValid(token));
  return (
    <AuthShell
      eyebrow="Recuperar acesso"
      title={valid ? "Nova senha" : "Link expirado"}
      description={valid ? "Crie a nova senha do Administrador." : "Este link é inválido, já foi usado ou passou do prazo."}
    >
      {valid ? (
        <ResetForm token={token} />
      ) : (
        <Link href="/esqueci-senha" className="inline-flex h-12 w-full items-center justify-center rounded-full bg-ink font-medium text-paper">
          Pedir um novo link
        </Link>
      )}
    </AuthShell>
  );
}
