// A 500 response's body is public — anyone who can trigger the error
// path can read it, including unauthenticated callers of /api/health.
// Every route's own catch block already sends the real error detail to
// lib/errorLog.ts's recordError() (admin-only readable) or console.error
// for cron routes; this helper is only ever responsible for what goes
// back to the caller, which must never be raw Postgres/Supabase/
// internal error text (schema hints, internal paths, provider error
// codes) — a generic, safe message instead.

import { NextResponse } from "next/server";

export function safeErrorResponse(status: number, publicMessage = "Something went wrong. Please try again.") {
  return NextResponse.json({ error: publicMessage }, { status });
}
