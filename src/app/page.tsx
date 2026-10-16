import { redirect } from "next/navigation";
import { MugPreparer } from "@/components/MugPreparer";
import { hasValidSession } from "@/lib/auth/session";

export default async function Home() {
  // Verificação completa (inclui a versão da senha); o proxy só faz a checagem otimista.
  if (!(await hasValidSession())) redirect("/login");
  return <MugPreparer />;
}
