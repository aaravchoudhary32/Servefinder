import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Deliberately separate from vitest.config.mts (which drives the default
// `npm test`/CI run): these tests hit the real, shared Supabase project
// over the network using the service role key, so they're slower, need
// real credentials, and create/delete real (throwaway) rows. Keeping
// them out of the default include glob means `npm test` and CI never
// need SUPABASE_SERVICE_ROLE_KEY. See vitest.integration.setup.ts.
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.integration.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    setupFiles: ["./vitest.integration.setup.ts"],
    // Real network calls (auth signups, RLS-scoped queries, an RPC) per
    // test — the default 5s timeout is too tight for a full
    // create-users-then-sign-in-then-query sequence.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": rootDir,
    },
  },
});
