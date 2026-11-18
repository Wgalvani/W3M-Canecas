import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GarmentStudio } from "@/components/garment/GarmentStudio";
import { hasValidSession } from "@/lib/auth/session";
import { vercelTokenNotice } from "@/lib/auth/tokenStatus";

export const metadata: Metadata = {
  title: "Camisetas · W3M Studio",
  description: "Prova 3D de estampas DTF em camisetas, baby look e moletons.",
};

export default async function CamisetasPage() {
  // Mesma verificação completa da página de canecas (o proxy só faz a checagem otimista).
  if (!(await hasValidSession())) redirect("/login?next=/camisetas");
  return <GarmentStudio tokenNotice={await vercelTokenNotice()} />;
}
