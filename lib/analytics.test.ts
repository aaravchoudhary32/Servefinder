import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ANALYTICS_METADATA_KEYS,
  DEDUPE_WINDOW_MS,
  isDuplicateWithinWindow,
  sanitizeMetadata,
} from "./analytics";

describe("sanitizeMetadata (runtime mirror of analytics_metadata_is_valid() in supabase/add_user_analytics.sql)", () => {
  it("passes through every allowed key with a valid value", () => {
    expect(
      sanitizeMetadata({
        matchMode: "classic",
        fromStatus: "saved",
        toStatus: "applied",
        category: "STEM",
        filterType: "category",
        helpful: true,
        reason: "too_far",
        context: "organization_website",
      })
    ).toEqual({
      matchMode: "classic",
      fromStatus: "saved",
      toStatus: "applied",
      category: "STEM",
      filterType: "category",
      helpful: true,
      reason: "too_far",
      context: "organization_website",
    });
  });

  it("drops a key outside the allowlist rather than sending it (regression: an `as any` cast or a dynamically-built object must not smuggle an unexpected field through)", () => {
    const withExtraKey = {
      matchMode: "classic",
      // Exactly the kind of thing this must reject: free text, an
      // email-shaped value, anything not on the allowlist.
      studentEmail: "student@example.com",
    } as Record<string, unknown>;
    expect(sanitizeMetadata(withExtraKey)).toEqual({ matchMode: "classic" });
  });

  it("drops a string value over 40 characters", () => {
    const longReason = "x".repeat(41);
    expect(sanitizeMetadata({ reason: longReason })).toEqual({});
  });

  it("keeps a string value at exactly 40 characters", () => {
    const exactly40 = "x".repeat(40);
    expect(sanitizeMetadata({ reason: exactly40 })).toEqual({ reason: exactly40 });
  });

  it("drops a non-boolean, non-string value (e.g. a nested object smuggled under an allowed key name)", () => {
    const nested = { helpful: { nested: "object" } } as unknown as Record<string, unknown>;
    expect(sanitizeMetadata(nested)).toEqual({});
  });

  it("returns an empty object for undefined metadata", () => {
    expect(sanitizeMetadata(undefined)).toEqual({});
  });

  it("keeps ANALYTICS_METADATA_KEYS in sync with this test file's own coverage (add both together)", () => {
    // Not a check against the SQL file itself (this is a unit test, no
    // database) — a guard that whoever adds a ninth key here also
    // updates this list's length assertion, as a forcing function to
    // remember the SQL side too (see add_user_analytics.sql's
    // analytics_metadata_is_valid()).
    expect(ANALYTICS_METADATA_KEYS).toHaveLength(8);
    expect(ANALYTICS_METADATA_KEYS).toEqual([
      "matchMode",
      "fromStatus",
      "toStatus",
      "category",
      "filterType",
      "helpful",
      "reason",
      "context",
    ]);
  });
});

// lib/analytics.ts checks `typeof window === "undefined"` and fails
// open (never a duplicate) outside a browser — this project's vitest
// config runs unit tests in a plain Node environment, with no jsdom/
// happy-dom dependency, so a minimal in-memory sessionStorage stub is
// what actually lets isDuplicateWithinWindow's real branch run here,
// rather than adding a new test-environment dependency for one file.
function stubBrowserSessionStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      clear: () => store.clear(),
    },
  });
}

describe("isDuplicateWithinWindow (client-side page-view dedup)", () => {
  beforeEach(() => {
    stubBrowserSessionStorage();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("does not flag the first call as a duplicate", () => {
    expect(isDuplicateWithinWindow("dashboard_viewed")).toBe(false);
  });

  it("flags a second call for the same event type within the window as a duplicate", () => {
    expect(isDuplicateWithinWindow("dashboard_viewed")).toBe(false);
    expect(isDuplicateWithinWindow("dashboard_viewed")).toBe(true);
  });

  it("does not flag a different event type as a duplicate of another (regression: a shared key across event types would cross-suppress unrelated page views)", () => {
    expect(isDuplicateWithinWindow("dashboard_viewed")).toBe(false);
    expect(isDuplicateWithinWindow("explore_viewed")).toBe(false);
  });

  it("stops flagging as a duplicate once the dedupe window has elapsed (a genuine later visit must still count)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    expect(isDuplicateWithinWindow("dashboard_viewed")).toBe(false);

    vi.setSystemTime(DEDUPE_WINDOW_MS - 1);
    expect(isDuplicateWithinWindow("dashboard_viewed")).toBe(true);

    vi.setSystemTime(DEDUPE_WINDOW_MS + 1);
    expect(isDuplicateWithinWindow("dashboard_viewed")).toBe(false);

    vi.useRealTimers();
  });
});
