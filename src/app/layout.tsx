import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "W3M Studio · Estúdio de Arte",
  description: "Prepare artes para sublimação em canecas (21 × 9,5 cm ou no tamanho que você escolher): enquadre, espelhe e gere PNG ou PDF prontos para impressão.",
  applicationName: "W3M Studio",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#16181d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // CSP com nonce exige renderização por requisição: página estática não recebe o nonce dos scripts.
  await connection();
  return (
    <html lang="pt-BR" className={`${plexSans.variable} ${plexMono.variable} ${bricolage.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
