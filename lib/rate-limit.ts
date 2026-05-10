/**
 * Token-bucket rate limiter, in-memory, per-key (typically client IP).
 *
 * Capacity: 10 tokens. Refill rate: 10 tokens / 60s (smooth — ~1 token / 6s).
 * Resets on cold start. Good enough for the MVP per spec.
 */
type Bucket = { tokens: number; lastRefill: number };

const CAPACITY = 10;
const WINDOW_MS = 60_000;
const REFILL_PER_MS = CAPACITY / WINDOW_MS;

const buckets = new Map<string, Bucket>();

export function consumeToken(key: string, now: number = Date.now()): boolean {
  const existing = buckets.get(key);
  if (!existing) {
    buckets.set(key, { tokens: CAPACITY - 1, lastRefill: now });
    return true;
  }
  const elapsed = Math.max(0, now - existing.lastRefill);
  const refilled = Math.min(CAPACITY, existing.tokens + elapsed * REFILL_PER_MS);
  existing.lastRefill = now;
  if (refilled < 1) {
    existing.tokens = refilled;
    return false;
  }
  existing.tokens = refilled - 1;
  return true;
}

export function _resetRateLimitForTests(): void {
  buckets.clear();
}
