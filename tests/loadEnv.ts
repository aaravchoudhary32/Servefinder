// Loads .env.local into process.env for scripts that run outside
// Next.js's own dotenv handling (Playwright's global setup/teardown, and
// the test specs themselves, all run via the plain `playwright` CLI, not
// `next`). Same parsing shape as the ad hoc verification scripts used
// throughout this project's development.
import { existsSync, readFileSync } from "fs";
import path from "path";

export function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
