export type TtlCache<K, V> = {
  get: (key: K, nowMs: number) => V | undefined;
  set: (key: K, value: V, nowMs: number) => void;
};

export function createTtlCache<K, V>(ttlMs: number): TtlCache<K, V> {
  const map = new Map<K, { value: V; expiresAtMs: number }>();

  return {
    get(key, nowMs) {
      const v = map.get(key);
      if (!v) return undefined;
      if (nowMs >= v.expiresAtMs) {
        map.delete(key);
        return undefined;
      }
      return v.value;
    },
    set(key, value, nowMs) {
      map.set(key, { value, expiresAtMs: nowMs + ttlMs });
    }
  };
}

export type FixedWindowRateLimiter = {
  hit: (key: string, nowMs: number) => { allowed: boolean; remaining: number };
};

export function createFixedWindowRateLimiter(args: {
  limit: number;
  windowMs: number;
}): FixedWindowRateLimiter {
  const buckets = new Map<string, { windowStartMs: number; count: number }>();

  return {
    hit(key, nowMs) {
      const existing = buckets.get(key);
      if (!existing || nowMs - existing.windowStartMs >= args.windowMs) {
        buckets.set(key, { windowStartMs: nowMs, count: 1 });
        return { allowed: true, remaining: Math.max(0, args.limit - 1) };
      }

      if (existing.count >= args.limit) {
        return { allowed: false, remaining: 0 };
      }
      existing.count += 1;
      return { allowed: true, remaining: Math.max(0, args.limit - existing.count) };
    }
  };
}


