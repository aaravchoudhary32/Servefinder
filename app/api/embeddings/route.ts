// Embeds free text server-side. The dashboard uses it to embed a
// student's interests at load time; lib/embedAndAttach.ts (admin,
// org-dashboard, and CSV import) uses it to embed an opportunity's
// description. Everything else (the fetcher, the backfill script) runs
// server-side already and calls lib/embeddings/embed.ts directly,
// without an HTTP round-trip.
//
// Requires the caller to be an authenticated user (same pattern as
// app/api/org/applicants/route.ts and app/api/account/route.ts: a
// per-request client built from the caller's own JWT, validated via
// .auth.getUser()) and rate-limits per user — this endpoint runs real
// ML inference per call, so being public and unauthenticated made it a
// real compute/cost abuse vector. See lib/rateLimit.ts for the limiter
// itself and why its per-user threshold is set where it is.
//
// Explicit Node runtime: the embedding model needs onnxruntime-node,
// which does not run on the Edge runtime.
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { embed } from "@/lib/embeddings/embed";
import { getSupabaseAdmin } from "@/lib/supabaseAdminClient";
import { recordError } from "@/lib/errorLog";
import { safeErrorResponse } from "@/lib/apiError";
import { checkRateLimit, type RateLimitState } from "@/lib/rateLimit";
import { validateEmbeddingText } from "@/lib/embeddings/validateText";

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
// lib/ingestion/csvImport.ts caps a single CSV import at 200 rows, each
// firing its own embedAndAttach() call — the single highest-volume
// legitimate caller in the app. 300 clears that with margin while still
// meaningfully capping a runaway or malicious loop.
const RATE_LIMIT_MAX_REQUESTS = 300;
// Module-scope, so it persists across requests on a warm instance — see
// lib/rateLimit.ts's header comment for what this does and doesn't
// guarantee under concurrent/cold instances.
const rateLimitStore = new Map<string, RateLimitState>();

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Missing Authorization header." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 500 });
  }

  // A per-request client carrying the caller's own JWT, not the anon key
  // alone — this is only used to prove who's calling (.auth.getUser()
  // below), the same identity-proving shape used everywhere else server
  // routes need to know the caller in this codebase.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!checkRateLimit(rateLimitStore, user.id, Date.now(), RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS)) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const validation = validateEmbeddingText(body?.text);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const text = validation.value;

  try {
    const embedding = await embed(text);
    return NextResponse.json({ embedding });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("embeddings route failed:", message);
    await recordError(getSupabaseAdmin(), { route: "/api/embeddings", message });
    return safeErrorResponse(500, "Couldn't process that request.");
  }
}
