import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Esqueci minha senha · W3M Studio" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Recuperar acesso"
      title="Esqueci minha senha"
      description="Enviaremos um link de redefinição para o e-mail cadastrado do Administrador."
    >
      <ForgotForm />
    </AuthShell>
  );
}
