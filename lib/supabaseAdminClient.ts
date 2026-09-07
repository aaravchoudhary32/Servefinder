// Server-only Supabase client authenticated as the service role, which
// bypasses Row Level Security entirely. Required now that opportunities/
// organizations writes are RLS-gated to admin users only (see
// supabase/schema.sql) — the ingestion pipeline isn't a logged-in user, so
// it can't satisfy an `auth.uid() in admins` check; it authenticates as
// the service role instead, the same way Supabase's own docs recommend
// for trusted server-side jobs.
//
// NEVER import this from a "use client" component, or from any module a
// client component imports — SUPABASE_SERVICE_ROLE_KEY is a secret (unlike
// NEXT_PUBLIC_SUPABASE_ANON_KEY) and importing this file into client code
// would bundle it into JS shipped to every visitor's browser.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazy on purpose: Next.js evaluates route modules at build time to
// collect page/route metadata, even for routes that are never actually
// invoked during the build. A module-scope `createClient()` (or a
// module-scope throw when the env var is missing) runs at that
// evaluation point too, which broke `next build` the first time this was
// tried — the service role key legitimately isn't set in every
// environment that runs a build (e.g. CI). Deferring construction to
// first actual call means the env check only fires when a cron route
// handler runs for real.
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. The ingestion pipeline needs the service role key to write to opportunities/organizations now that RLS restricts those writes to admin users. Get it from Supabase → Settings → API → service_role secret key, and add it to .env.local (local) and `vercel env add SUPABASE_SERVICE_ROLE_KEY` (cron)."
    );
  }

  cached = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
