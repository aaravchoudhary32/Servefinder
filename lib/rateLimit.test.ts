import { describe, it, expect } from "vitest";
import { checkRateLimit, type RateLimitState } from "./rateLimit";

describe("checkRateLimit", () => {
  it("allows requests up to the limit within a window", () => {
    const store = new Map<string, RateLimitState>();
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(store, "user-1", 1000, 60_000, 3)).toBe(true);
    }
  });

  it("rejects the request that exceeds the limit", () => {
    const store = new Map<string, RateLimitState>();
    for (let i = 0; i < 3; i++) checkRateLimit(store, "user-1", 1000, 60_000, 3);
    expect(checkRateLimit(store, "user-1", 1000, 60_000, 3)).toBe(false);
  });

  it("keeps rejecting further requests in the same window once over the limit", () => {
    const store = new Map<string, RateLimitState>();
    for (let i = 0; i < 3; i++) checkRateLimit(store, "user-1", 1000, 60_000, 3);
    checkRateLimit(store, "user-1", 1000, 60_000, 3);
    expect(checkRateLimit(store, "user-1", 1500, 60_000, 3)).toBe(false);
  });

  it("resets the count once the window has elapsed", () => {
    const store = new Map<string, RateLimitState>();
    for (let i = 0; i < 3; i++) checkRateLimit(store, "user-1", 1000, 60_000, 3);
    expect(checkRateLimit(store, "user-1", 1000, 60_000, 3)).toBe(false);

    // Same key, but now past the window boundary — should be a fresh window.
    expect(checkRateLimit(store, "user-1", 1000 + 60_000, 60_000, 3)).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const store = new Map<string, RateLimitState>();
    for (let i = 0; i < 3; i++) checkRateLimit(store, "user-1", 1000, 60_000, 3);
    expect(checkRateLimit(store, "user-1", 1000, 60_000, 3)).toBe(false);
    // A different user's own count is untouched by user-1 being over limit.
    expect(checkRateLimit(store, "user-2", 1000, 60_000, 3)).toBe(true);
  });

  it("accommodates a large legitimate burst under the CSV-import ceiling", () => {
    // lib/ingestion/csvImport.ts caps a single import at 200 rows, each
    // firing its own embedAndAttach() call — the production limit (300
    // per 5-minute window) must clear that with margin.
    const store = new Map<string, RateLimitState>();
    const windowMs = 5 * 60 * 1000;
    const limit = 300;
    let allowed = 0;
    for (let i = 0; i < 200; i++) {
      if (checkRateLimit(store, "org-rep-1", 1000, windowMs, limit)) allowed++;
    }
    expect(allowed).toBe(200);
  });
});
