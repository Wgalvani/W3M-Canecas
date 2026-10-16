import { NextResponse, type NextRequest } from "next/server";
import { authSecret, isProduction, SESSION_COOKIE } from "@/lib/auth/config";
import { verifyToken } from "@/lib/auth/token";

/** Páginas abertas sem login (o restante do app exige sessão). */
const PUBLIC_PATHS = ["/login", "/esqueci-senha", "/redefinir-senha"];

function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    // Scripts só com o nonce desta resposta; os carregados por eles (ex.: chunk do 3D) herdam a confiança.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProduction ? "" : " 'unsafe-eval'"}`,
    // A interface usa atributos style (posições, larguras): estilo inline não executa código.
    "style-src 'self' 'unsafe-inline'",
    // Imagens do cliente são lidas como blob: no navegador e nunca saem dele.
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${isProduction ? "" : " ws: wss:"}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/**
 * Checagem otimista: só confere assinatura e validade do cookie, sem consultar o armazenamento.
 * A verificação completa (versão da senha) acontece na página protegida.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const loggedIn = !!verifyToken(token, authSecret(), "session");

  if (!isPublic && !loggedIn) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  // Páginas com sessão nunca devem ficar em cache compartilhado.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|robots.txt).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
