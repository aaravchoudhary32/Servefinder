import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.ts"],
    // Integration tests (vitest.integration.config.mts) hit the real,
    // shared Supabase project over the network and need
    // SUPABASE_SERVICE_ROLE_KEY — excluded here so `npm test`/CI never
    // need that secret. Belt-and-suspenders alongside the *.integration.test.ts
    // filename convention itself.
    exclude: ["node_modules/**", ".next/**", "**/*.integration.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/matching.ts", "lib/ingestion/**/*.ts"],
    },
  },
  resolve: {
    alias: {
      "@": rootDir,
    },
  },
});
