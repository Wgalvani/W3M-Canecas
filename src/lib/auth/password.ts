import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Hash de senha com scrypt (memória-intensivo: caro para força bruta em GPU).
 * Formato: `scrypt:N:r:p:salt:hash` em base64url — sem `$`, para não ser
 * expandido pelo carregador de `.env` do Next.
 */
const PARAMS = { N: 2 ** 15, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const MAX_MEM = 128 * 1024 * 1024;

export const PASSWORD_MIN_LENGTH = 12;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { ...options, maxmem: MAX_MEM }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64url"), key.toString("base64url")].join(":");
}

/** Compara em tempo constante. Hash mal formado nunca autentica. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.trim().split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltText, keyText] = parts;
  const N = Number(n);
  const options = { N, r: Number(r), p: Number(p) };
  // Limita parâmetros para um valor adulterado não travar o servidor.
  if (!Number.isInteger(N) || N < 2 ** 14 || N > 2 ** 20 || options.r > 16 || options.p > 4) return false;
  const expected = Buffer.from(keyText, "base64url");
  if (expected.length !== KEY_LENGTH) return false;
  try {
    const actual = await derive(password, Buffer.from(saltText, "base64url"), options);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Regras mínimas da senha; retorna a mensagem de erro ou `null`. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (password.length > 256) return "Senha longa demais.";
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (kinds < 3) return "Combine pelo menos 3 tipos: minúsculas, maiúsculas, números e símbolos.";
  return null;
}
