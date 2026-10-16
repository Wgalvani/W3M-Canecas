import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isProduction } from "./config";

/**
 * Onde fica o hash da senha do Administrador, sem banco de dados:
 *
 * 1. Vercel Edge Config (item `admin_password_hash`) — gravado ao redefinir a senha pelo app.
 * 2. Variável `ADMIN_PASSWORD_HASH` — a senha definida por você no painel da Vercel.
 * 3. Só em desenvolvimento: arquivo `.data/admin-password-hash` (ignorado pelo git).
 *
 * A primeira fonte que tiver valor vale.
 */
const ITEM_KEY = "admin_password_hash";
const DEV_FILE = path.join(process.cwd(), ".data", "admin-password-hash");

/** `EDGE_CONFIG` é a connection string criada pela Vercel: https://edge-config.vercel.com/<id>?token=<token>. */
function edgeConfig() {
  const raw = process.env.EDGE_CONFIG;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const id = url.pathname.replace(/^\/+/, "");
    const token = url.searchParams.get("token");
    return id && token ? { id, token, origin: url.origin } : null;
  } catch {
    return null;
  }
}

async function readEdgeConfig(): Promise<string | null> {
  const config = edgeConfig();
  if (!config) return null;
  const res = await fetch(`${config.origin}/${config.id}/item/${ITEM_KEY}`, {
    headers: { Authorization: `Bearer ${config.token}` },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Edge Config indisponível (${res.status})`);
  const value: unknown = await res.json();
  return typeof value === "string" && value ? value : null;
}

export async function readPasswordHash(): Promise<string | null> {
  const fromEdge = await readEdgeConfig();
  if (fromEdge) return fromEdge;
  if (!isProduction) {
    const fromFile = await readFile(DEV_FILE, "utf8").catch(() => "");
    if (fromFile.trim()) return fromFile.trim();
  }
  return process.env.ADMIN_PASSWORD_HASH?.trim() || null;
}

/** Se a redefinição por e-mail consegue gravar a nova senha neste ambiente. */
export function canStorePassword(): boolean {
  return !isProduction || (!!edgeConfig() && !!process.env.VERCEL_API_TOKEN);
}

export async function writePasswordHash(hash: string): Promise<void> {
  const config = edgeConfig();
  const apiToken = process.env.VERCEL_API_TOKEN;
  if (config && apiToken) {
    const team = process.env.VERCEL_TEAM_ID ? `?teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}` : "";
    const res = await fetch(`https://api.vercel.com/v1/edge-config/${config.id}/items${team}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ operation: "upsert", key: ITEM_KEY, value: hash }] }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Falha ao gravar no Edge Config (${res.status})`);
    return;
  }
  if (isProduction) throw new Error("Armazenamento da senha não configurado (EDGE_CONFIG + VERCEL_API_TOKEN).");
  await mkdir(path.dirname(DEV_FILE), { recursive: true });
  await writeFile(DEV_FILE, hash, { mode: 0o600 });
}
