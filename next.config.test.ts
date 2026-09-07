import { describe, it, expect, afterEach, vi } from "vitest";
// next.config.js is CommonJS (module.exports); Vitest's transform
// handles the interop for a plain `import`.
import nextConfig from "./next.config.js";

// next.config.js always defines headers() — this cast just satisfies
// NextConfig's own type, which marks the field optional.
const getHeaders = nextConfig.headers as () => Promise<
  { source: string; headers: { key: string; value: string }[] }[]
>;

describe("security headers (next.config.js headers())", () => {
  it("applies to every route", async () => {
    const rules = await getHeaders();
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/:path*");
  });

  function headerValue(rules: Awaited<ReturnType<typeof getHeaders>>, key: string) {
    return rules[0].headers.find((h) => h.key === key)?.value;
  }

  it("sets a Content-Security-Policy that blocks framing and inline object embeds", async () => {
    const rules = await getHeaders();
    const csp = headerValue(rules, "Content-Security-Policy");
    expect(csp).toBeDefined();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("default-src 'self'");
  });

  it("keeps the geocoding domains in connect-src (regression: an earlier draft omitted these and broke student location resolution — caught by the e2e suite)", async () => {
    const rules = await getHeaders();
    const csp = headerValue(rules, "Content-Security-Policy");
    expect(csp).toContain("https://api.zippopotam.us");
    expect(csp).toContain("https://nominatim.openstreetmap.org");
  });

  it("sets X-Frame-Options to DENY as defense-in-depth alongside frame-ancestors", async () => {
    const rules = await getHeaders();
    expect(headerValue(rules, "X-Frame-Options")).toBe("DENY");
  });

  it("sets X-Content-Type-Options to nosniff", async () => {
    const rules = await getHeaders();
    expect(headerValue(rules, "X-Content-Type-Options")).toBe("nosniff");
  });

  it("sets a Strict-Transport-Security header", async () => {
    const rules = await getHeaders();
    expect(headerValue(rules, "Strict-Transport-Security")).toMatch(/^max-age=\d+/);
  });

  it("sets Referrer-Policy and Permissions-Policy", async () => {
    const rules = await getHeaders();
    expect(headerValue(rules, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headerValue(rules, "Permissions-Policy")).toContain("geolocation=()");
  });

  it("disables the X-Powered-By header", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  // Regression for a real production password-reset bug report: the
  // recovery link's destination loaded fine, but the browser showed
  // Next.js's "eval() is not supported... React requires eval() in
  // development mode" overlay — the actual cause was `npm run dev`'s
  // Fast Refresh runtime needing eval(), which this CSP's script-src
  // didn't allow in any environment. 'unsafe-eval' must be dev-only:
  // widening it unconditionally would weaken the real production policy
  // for something production never needs (Vercel always runs `next
  // build`/`next start`, never `next dev`).
  describe("script-src eval() policy (dev needs it, production must not have it)", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("does not include 'unsafe-eval' when NODE_ENV=production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const rules = await getHeaders();
      const csp = headerValue(rules, "Content-Security-Policy");
      expect(csp).toContain("script-src 'self' 'unsafe-inline'");
      expect(csp).not.toContain("unsafe-eval");
    });

    it("includes 'unsafe-eval' in script-src when NODE_ENV is not production (matches `next dev`)", async () => {
      vi.stubEnv("NODE_ENV", "development");
      const rules = await getHeaders();
      const csp = headerValue(rules, "Content-Security-Policy");
      expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    });
  });
});
