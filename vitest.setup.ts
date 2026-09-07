// Runs before any unit test file's own imports resolve. Needed because
// lib/supabaseClient.ts calls createClient() at module scope using
// NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY from
// process.env — fine under `next dev`/`next build` (Next.js loads
// .env.local itself) and under Playwright (tests/global-setup.ts and
// every e2e/integration spec call loadEnvLocal() explicitly), but
// plain `vitest run` does neither. lib/analytics.test.ts is the first
// unit test to import anything that transitively reaches
// supabaseClient.ts, which is what surfaced this gap. Both values here
// are the public anon key and project URL — safe by design to be
// client-visible, not secrets.
import { loadEnvLocal } from "./tests/loadEnv";

loadEnvLocal();
