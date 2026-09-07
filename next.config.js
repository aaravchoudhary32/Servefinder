/** @type {import('next').NextConfig} */
const nextConfig = {
  // Security audit finding (Informational): stop advertising the
  // framework in every response's X-Powered-By header — no security
  // boundary depends on hiding this, but it's a free removal of
  // information a reconnaissance pass doesn't need handed to it.
  poweredByHeader: false,

  // @huggingface/transformers (semantic matching) pulls in onnxruntime-node,
  // a native Node addon, plus WASM assets referenced in ways Webpack's
  // static analysis can't resolve at build time ("Module not found: Can't
  // resolve 'ort-wasm-simd-threaded.asyncify.wasm'"). Both need to be
  // resolved at runtime via a normal require() instead of bundled.
  // https://huggingface.co/docs/transformers.js/tutorials/next
  // Was experimental.serverComponentsExternalPackages — moved to this
  // stable top-level key as of Next.js 15; the old one still works but
  // is deprecated (config-shared.d.ts).
  serverExternalPackages: ["onnxruntime-node", "@huggingface/transformers"],
  // Next.js 16's default Turbopack production build doesn't automatically
  // trace onnxruntime-node's native libonnxruntime.so.1 into the deployed
  // output of any route that imports lib/embeddings/embed.ts — confirmed
  // live on Vercel (500 "cannot open shared object file"), even though
  // the file is physically present in node_modules and everything works
  // locally. That's not just /api/embeddings: all 9 ingestion sources
  // (lib/ingestion/sources/*.ts, dispatched via
  // app/api/cron/fetch/[source]/route.ts — see
  // lib/ingestion/sourceRegistry.ts) compute their own opportunity
  // embeddings inline, not via an HTTP round-trip, so this route needs
  // the same fix.
  //
  // Earlier attempts here are worth recording since they failed for a
  // real reason, not by accident: forcing --webpack fixed the tracing
  // gap but broke a different, harder constraint — this project's
  // Vercel plan caps a deployment at 12 Serverless Functions, and
  // Webpack's output for this app crosses that limit where Turbopack's
  // doesn't (confirmed live — the --webpack deploy failed outright on
  // the function-count check). Explicit outputFileTracingIncludes
  // entries on the original 9 separate fetch-<source> route files (both
  // individually and via one glob key) fixed the tracing gap too, but
  // also broke the function-count cap — those per-route overrides
  // apparently prevented whatever consolidation let Turbopack fit this
  // app's 15 dynamic routes under 12 in the first place (also confirmed
  // live, twice). Consolidating the 9 routes into the single shared
  // /api/cron/fetch/[source] route (see vercel.ts) fixed the count
  // (15 -> 7 dynamic routes) independently of this fix, which is why
  // this can go back to being one clean entry below.
  outputFileTracingIncludes: {
    "/api/embeddings": ["./node_modules/onnxruntime-node/bin/napi-v6/**"],
    // Not the literal "/api/cron/fetch/[source]" — these keys are
    // picomatch glob patterns matched against the route, and a literal
    // "[source]" is parsed as a character class ("one character that is
    // s, o, u, r, c, or e"), never matching the real route at all
    // (confirmed live — traced 0 files with the literal form). "*"
    // matches the dynamic segment as an ordinary wildcard instead.
    //
    // Two packages need tracing here, not one: onnxruntime-node (every
    // source embeds its own listings — see above) AND playwright-core
    // (2 of the 9 sources, city-of-phoenix and special-olympics-az,
    // drive a real headless browser). Consolidating all 9 sources into
    // this one shared route means this file's own module graph now
    // includes Playwright too, even for a request to a non-Playwright
    // source — confirmed live: playwright-core's own internal
    // require("browsers.json") also isn't traced by Turbopack's
    // default tracing, same class of gap as onnxruntime's .so file
    // ("Cannot find module '.../playwright-core/browsers.json'"), and
    // since it's a load-time crash in the registry's own import graph,
    // it broke literally every source, not just the 2 that need it.
    // Tracing the whole playwright-core package (13MB, not the actual
    // browser binary — that's provided by Vercel's own headless-browser
    // runtime support, outside this app's function bundle) rather than
    // chasing individual files one crash at a time.
    //
    // @sparticuz/chromium (city-of-phoenix, special-olympics-az) needs
    // its own entry too, same reason: its executablePath() resolves
    // "../bin" relative to its own module location at runtime, which
    // Turbopack's static tracing doesn't follow, same as the other two.
    "/api/cron/fetch/*": [
      "./node_modules/onnxruntime-node/bin/napi-v6/**",
      "./node_modules/playwright-core/**",
      "./node_modules/@sparticuz/chromium/bin/**",
    ],
  },
  // New in Next.js 16: auto-writes AGENTS.md/CLAUDE.md on every dev/build
  // run. Not something this project has adopted — off, so it doesn't
  // reappear as untracked noise on the next `next dev`.
  agentRules: false,

  // Security audit finding (Medium): this app had zero security headers
  // configured anywhere. There's no middleware.ts (see ARCHITECTURE.md
  // §5 — RLS is the app's actual authorization boundary, deliberately),
  // so these are set here rather than per-request, which also means no
  // per-request CSP nonce is available. This app's own external
  // footprint is genuinely small — confirmed by reading the codebase,
  // not assumed: next/font/google self-hosts font files at build time
  // (no runtime request to fonts.googleapis.com/fonts.gstatic.com), no
  // third-party analytics script (lib/analytics.ts writes to this app's
  // own Supabase table), no Supabase Realtime/WebSocket usage, no
  // <script src> to any external domain. The only *cross-origin*
  // fetches anywhere in app/components/lib are this project's own
  // Supabase project URL plus two geocoding APIs lib/geocode.ts calls
  // directly from the browser (dashboard/explore/onboarding are all
  // Client Components) — api.zippopotam.us (zip -> city/state/coords)
  // and nominatim.openstreetmap.org (city name -> coords fallback).
  // Missing these from connect-src on the first pass of this change
  // broke exactly the flow that depends on them (a student's own
  // location resolving, which distance-based matching needs) — caught
  // by this app's own e2e suite, not assumed safe. That's what
  // connect-src is scoped to below.
  //
  // script-src and style-src keep 'unsafe-inline': Next.js's App Router
  // emits inline scripts for its streaming RSC payload
  // (self.__next_f.push(...)) that a strict script-src would block
  // without a per-request nonce, which requires middleware this app
  // deliberately doesn't have. Documented here rather than silently
  // dropped or falsely claimed as stricter than it is.
  async headers() {
    const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    // `next dev`'s Fast Refresh/HMR runtime wraps modules in eval() calls
    // (for sourceURL-mapped stack traces and fast reloads) — a real
    // Next.js behavior, not a bug in this app, but one this CSP's
    // script-src didn't account for, so any local `npm run dev` session
    // hit a real "eval() is not supported... React requires eval() in
    // development mode" overlay on every page. Only `next build`/`next
    // start` (what Vercel actually runs — confirmed via `vercel.ts`'s
    // buildCommand and this project's own deploy history) sets
    // NODE_ENV=production, so gating 'unsafe-eval' on that keeps
    // production's script-src exactly as strict as before. Never widen
    // this to apply unconditionally — see next.config.test.ts's
    // "production CSP" tests, which fail if 'unsafe-eval' leaks into a
    // build with NODE_ENV=production.
    const isDev = process.env.NODE_ENV !== "production";
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      `connect-src 'self' https://api.zippopotam.us https://nominatim.openstreetmap.org${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          // Belt-and-suspenders alongside frame-ancestors above — older
          // browsers that don't honor CSP frame-ancestors still respect
          // this header.
          { key: "X-Frame-Options", value: "DENY" },
          // HSTS: only meaningful in production, over HTTPS (which
          // Vercel always terminates); harmless locally since browsers
          // ignore it on http://localhost.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
