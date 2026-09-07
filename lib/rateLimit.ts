// A small in-process, fixed-window rate limiter. Lazily expired on each
// check (the window resets the first time it's touched after expiring)
// rather than swept on a timer — no background interval needed, fine at
// this app's current scale.
//
// Not shared across concurrent or cold server instances (Vercel Fluid
// Compute reuses warm instances but doesn't guarantee a single instance
// under load) — a real, if imperfect, mitigation rather than a
// bulletproof one. See app/api/embeddings/route.ts, its one caller.

export type RateLimitState = { count: number; windowStart: number };

/** Returns true if the request is allowed, false if `key` is over `limit` within the current window. Mutates `store`. */
export function checkRateLimit(
  store: Map<string, RateLimitState>,
  key: string,
  now: number,
  windowMs: number,
  limit: number
): boolean {
  const existing = store.get(key);

  if (!existing || now - existing.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (existing.count >= limit) {
    return false;
  }

  existing.count += 1;
  return true;
}
