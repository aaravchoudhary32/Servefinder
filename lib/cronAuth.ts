// Verifies a request actually came from Vercel's cron scheduler, per
// Vercel's documented pattern: https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
// Set CRON_SECRET in the project's environment variables (a random
// string, 16+ chars) — Vercel automatically sends it as the Authorization
// bearer token on cron-triggered requests once it's set.

import type { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

// Security audit finding (Low): a plain `===` comparison is a real,
// if low-probability, timing-attack surface for a secret bearer token
// — Node.js string comparison can short-circuit on the first differing
// byte. crypto.timingSafeEqual takes the same time regardless of where
// the mismatch is. Requires both buffers to be equal length first
// (timingSafeEqual throws otherwise) — a length mismatch alone reveals
// nothing usable (guessing the exact length of a random secret this
// way is not a practical attack), so it's fine to branch on it first.
function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function isAuthorizedCronRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || !authHeader) return false;
  return timingSafeStringEqual(authHeader, `Bearer ${cronSecret}`);
}
