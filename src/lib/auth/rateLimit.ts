/**
 * Limite de tentativas em memória, por chave (ex.: IP). Em serverless cada instância tem
 * a sua contagem, então isto é uma camada extra: o custo do scrypt e a regra de firewall
 * da Vercel (ver SEGURANCA.md) completam a proteção contra força bruta.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(limit: number, windowMs: number) {
  const buckets = new Map<string, Bucket>();

  const current = (key: string, now: number) => {
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) return null;
    return bucket;
  };

  return {
    /** Segundos até liberar, ou 0 se a chave ainda pode tentar. */
    retryAfter(key: string, now = Date.now()): number {
      const bucket = current(key, now);
      return bucket && bucket.count >= limit ? Math.ceil((bucket.resetAt - now) / 1000) : 0;
    },
    hit(key: string, now = Date.now()) {
      const bucket = current(key, now) ?? { count: 0, resetAt: now + windowMs };
      bucket.count += 1;
      buckets.set(key, bucket);
      // Evita crescer sem limite sob ataque distribuído.
      if (buckets.size > 10_000) {
        for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
      }
    },
    reset(key: string) {
      buckets.delete(key);
    },
  };
}
