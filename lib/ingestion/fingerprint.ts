// Cheap content-fingerprinting for change detection and a secondary
// duplicate signal, alongside findDuplicate()'s existing exact-external-
// ID and title-similarity checks in ./normalize.ts.
//
// Deliberately NOT embedding-based semantic similarity for this pass —
// that's real, ongoing per-candidate compute cost (an embed() call per
// comparison, not just per opportunity at display time), and title-
// similarity plus this fingerprint already covers the concrete gap this
// batch found (the Arizona Science Center near-duplicate had a
// different title AND different described content, so no signal
// available today would have caught it automatically either — that one
// needed a human to notice the two pages described the same program,
// which is exactly what the review queue's duplicate-candidate surface
// is for). Semantic dedup stays a real, deferred option — see the
// Phase 1 report's open decision — not built into this pass.
//
// A fingerprint answers a narrower, cheaper question well: "did this
// exact listing's content change since we last saw it," used to flag a
// re-fetched row as needing re-review rather than a rerun-safe refresh.

/** A small, fast, non-cryptographic string hash (djb2 variant) — good
 * enough for change-detection, not intended as a security primitive. */
function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  // >>> 0 coerces to an unsigned 32-bit int before hex-encoding, so the
  // result is always a positive, fixed-shape hex string.
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Fields that meaningfully define "the same listing" for fingerprint
 * purposes — deliberately excludes fields that legitimately change on
 * every refresh without the underlying opportunity being different
 * (last_verified_at, embedding) or that are already the primary dedup
 * key (external_id, title — title changes ARE meaningful and so stay
 * in scope; only the volatile bookkeeping fields are excluded). */
export type FingerprintInput = {
  title: string;
  description: string | null;
  location: string | null;
  minimum_age: number;
  application_url: string | null;
  application_deadline: string | null;
};

export function computeContentFingerprint(input: FingerprintInput): string {
  const normalized = [
    input.title.trim().toLowerCase(),
    (input.description ?? "").trim().toLowerCase(),
    (input.location ?? "").trim().toLowerCase(),
    String(input.minimum_age),
    (input.application_url ?? "").trim().toLowerCase(),
    input.application_deadline ?? "",
  ].join("|");
  return hashString(normalized);
}

/** True if a freshly-parsed listing's content differs from what's
 * already stored for the same row — the connector-level signal for
 * "this needs a human to look again," not just a silent refresh. */
export function contentChanged(previousFingerprint: string | null, current: FingerprintInput): boolean {
  if (!previousFingerprint) return true; // nothing stored yet — treat as changed
  return computeContentFingerprint(current) !== previousFingerprint;
}
