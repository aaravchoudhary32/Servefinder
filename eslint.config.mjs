import nextConfig from "eslint-config-next/core-web-vitals";

// Flat config, replacing the removed `next lint` CLI (Next.js 16 no
// longer ships it — see ARCHITECTURE.md's "Known trade-offs"). Mirrors
// what `next lint` used to generate by default (`next/core-web-vitals`),
// plus repo-specific generated-output directories that
// eslint-config-next's own `.next`/`out`/`build`/`next-env.d.ts` ignores
// don't cover.
const config = [{ ignores: ["test-results/**", ".vercel/**"] }, ...nextConfig];

export default config;
