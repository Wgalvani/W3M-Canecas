// Gera o hash da senha do Administrador para a variável ADMIN_PASSWORD_HASH.
// A senha é digitada sem aparecer na tela e nunca é gravada em disco.
// Uso: npm run hash-password        (ou: npm run hash-password -- --secret, para gerar também um AUTH_SECRET)
import { randomBytes, scrypt } from "node:crypto";
import { stdin, stdout } from "node:process";

const PARAMS = { N: 2 ** 15, r: 8, p: 1 };

function ask(question) {
  return new Promise((resolve) => {
    stdout.write(question);
    let value = "";
    const tty = stdin.isTTY;
    if (tty) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          if (tty) stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          return resolve(value);
        }
        if (char === "\u0003") process.exit(130); // Ctrl+C
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on("data", onData);
  });
}

function problem(password) {
  if (password.length < 12) return "use pelo menos 12 caracteres";
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  return kinds < 3 ? "combine pelo menos 3 tipos: minúsculas, maiúsculas, números e símbolos" : null;
}

const password = await ask("Nova senha do Administrador: ");
const issue = problem(password);
if (issue) {
  console.error(`Senha fraca: ${issue}.`);
  process.exit(1);
}
if ((await ask("Confirme a senha: ")) !== password) {
  console.error("As senhas não conferem.");
  process.exit(1);
}

const salt = randomBytes(16);
const key = await new Promise((resolve, reject) =>
  scrypt(password.normalize("NFKC"), salt, 64, { ...PARAMS, maxmem: 128 * 1024 * 1024 }, (err, k) => (err ? reject(err) : resolve(k))),
);
const hash = ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64url"), key.toString("base64url")].join(":");

console.log("\nCopie a linha abaixo para a variável de ambiente (Vercel → Settings → Environment Variables, ou .env.local):\n");
console.log(`ADMIN_PASSWORD_HASH=${hash}`);
if (process.argv.includes("--secret")) console.log(`AUTH_SECRET=${randomBytes(32).toString("base64url")}`);
console.log("");
