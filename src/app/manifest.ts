import type { MetadataRoute } from "next";

/** Base para instalar como PWA no futuro (seção 45 do PRD). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "W3M Canecas · Estúdio de Arte",
    short_name: "W3M Canecas",
    description: "Artes para canecas prontas para sublimação, no tamanho que você escolher.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f1eb",
    theme_color: "#16181d",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
