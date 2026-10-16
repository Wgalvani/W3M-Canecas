import { describe, expect, it } from "vitest";
import { hashPassword, passwordProblem, verifyPassword } from "./password";
import { createRateLimiter } from "./rateLimit";
import { tokenNotice } from "./tokenNotice";
import { passwordVersion, signToken, verifyToken } from "./token";

const SECRET = "x".repeat(40);

describe("senha (scrypt)", () => {
  it("confere a senha certa e recusa a errada", async () => {
    const hash = await hashPassword("Caneca#Segura2026");
    expect(hash.startsWith("scrypt:")).toBe(true);
    expect(hash).not.toContain("$");
    expect(await verifyPassword("Caneca#Segura2026", hash)).toBe(true);
    expect(await verifyPassword("caneca#segura2026", hash)).toBe(false);
  });

  it("gera sal diferente a cada hash", async () => {
    expect(await hashPassword("Caneca#Segura2026")).not.toBe(await hashPassword("Caneca#Segura2026"));
  });

  it("recusa hash mal formado ou com parâmetros abusivos", async () => {
    expect(await verifyPassword("a", "")).toBe(false);
    expect(await verifyPassword("a", "bcrypt:1:2:3:4:5")).toBe(false);
    expect(await verifyPassword("a", "scrypt:1073741824:8:1:AAAA:AAAA")).toBe(false);
  });

  it("exige senha forte", () => {
    expect(passwordProblem("curta1A!")).toMatch(/12/);
    expect(passwordProblem("somenteminusculas")).toMatch(/3 tipos/);
    expect(passwordProblem("Caneca#Segura2026")).toBeNull();
  });
});

describe("token assinado", () => {
  const future = Date.now() + 60_000;

  it("valida o próprio token", () => {
    const token = signToken({ purpose: "session", exp: future, pv: "v1" }, SECRET);
    expect(verifyToken(token, SECRET, "session")?.pv).toBe("v1");
  });

  it("recusa assinatura adulterada, outro segredo e outra finalidade", () => {
    const token = signToken({ purpose: "session", exp: future, pv: "v1" }, SECRET);
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ purpose: "session", exp: future * 2, pv: "v1" })).toString("base64url");
    expect(verifyToken(`${forged}.${sig}`, SECRET, "session")).toBeNull();
    expect(verifyToken(`${body}.${sig}x`, SECRET, "session")).toBeNull();
    expect(verifyToken(token, "y".repeat(40), "session")).toBeNull();
    expect(verifyToken(token, SECRET, "reset")).toBeNull();
  });

  it("recusa token expirado ou vazio", () => {
    const token = signToken({ purpose: "reset", exp: Date.now() - 1, pv: "v1" }, SECRET);
    expect(verifyToken(token, SECRET, "reset")).toBeNull();
    expect(verifyToken(undefined, SECRET, "reset")).toBeNull();
    expect(verifyToken("lixo", SECRET, "reset")).toBeNull();
  });

  it("a versão da senha muda quando o hash muda", () => {
    expect(passwordVersion("hash-a", SECRET)).not.toBe(passwordVersion("hash-b", SECRET));
    expect(passwordVersion("hash-a", SECRET)).toBe(passwordVersion("hash-a", SECRET));
  });
});

describe("limite de tentativas", () => {
  it("bloqueia após o limite e libera depois da janela", () => {
    const limiter = createRateLimiter(2, 1000);
    limiter.hit("ip", 0);
    expect(limiter.retryAfter("ip", 10)).toBe(0);
    limiter.hit("ip", 20);
    expect(limiter.retryAfter("ip", 30)).toBeGreaterThan(0);
    expect(limiter.retryAfter("ip", 1001)).toBe(0);
  });
});

describe("lembrete do token da Vercel", () => {
  const now = Date.UTC(2027, 8, 1);
  const day = 86_400_000;

  it("não avisa longe do vencimento nem sem data", () => {
    expect(tokenNotice({ status: 200, expiresAt: now + 60 * day }, now)).toBeNull();
    expect(tokenNotice({ status: 200, expiresAt: null }, now)).toBeNull();
    expect(tokenNotice({ status: 500 }, now)).toBeNull();
  });

  it("avisa nos últimos 30 dias, inclusive com data em texto", () => {
    expect(tokenNotice({ status: 200, expiresAt: String(now + 10 * day) }, now)).toMatchObject({ kind: "expiring", daysLeft: 10 });
    expect(tokenNotice({ status: 200, expiresAt: now + 30 * day }, now)).toMatchObject({ kind: "expiring", daysLeft: 30 });
  });

  it("marca como vencido após a data ou quando a Vercel recusa o token", () => {
    expect(tokenNotice({ status: 200, expiresAt: now - day }, now)?.kind).toBe("expired");
    expect(tokenNotice({ status: 401 }, now)?.kind).toBe("expired");
    expect(tokenNotice({ status: 403 }, now)?.kind).toBe("expired");
  });
});
