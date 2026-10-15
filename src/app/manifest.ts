import type { MetadataRoute } from "next";

/** Base para instalar como PWA no futuro (seção 45 do PRD). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Preparador de Canecas",
    short_name: "Canecas",
    description: "Artes para canecas prontas para sublimação, no tamanho que você escolher.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#2563eb",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
