export type AppErrorCode = "unsupported" | "too-large" | "corrupt" | "export-failed" | "out-of-memory";

export const ERROR_MESSAGES: Record<AppErrorCode, string> = {
  unsupported: "Formato não suportado. Utilize JPG, PNG ou WEBP.",
  "too-large": "Esta imagem é muito grande para processamento (máximo 30 MB).",
  corrupt: "Não conseguimos abrir esta imagem.",
  "export-failed": "Não foi possível gerar o arquivo. Tente novamente.",
  "out-of-memory": "O dispositivo não possui memória suficiente para processar esta imagem nesta resolução.",
};

export class AppError extends Error {
  constructor(public readonly code: AppErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "AppError";
  }
}

export function errorMessage(error: unknown, fallback: AppErrorCode): string {
  return error instanceof AppError ? error.message : ERROR_MESSAGES[fallback];
}
