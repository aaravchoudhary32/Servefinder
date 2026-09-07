import Button from "@/components/Button";

export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="bg-board min-h-screen flex items-center justify-center px-6">
      <div className="animate-fade-in-up relative max-w-md w-full bg-white border border-line rounded-card shadow-lift p-10 text-center rotate-[-1deg]">
        <span className="pin-tag absolute -top-3 left-1/2 -translate-x-1/2 rotate-[-2deg]">
          Not found
        </span>

        <p className="font-display text-7xl font-semibold text-moss mt-4 mb-2 tracking-tight">
          404
        </p>
        <h1 className="font-display text-xl font-semibold mb-2">
          This page got unpinned.
        </h1>
        <p className="text-sm text-ink/70 mb-8 leading-relaxed">
          Whatever was posted here has moved, been taken down, or never
          existed. Let&apos;s get you back to something real.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Button href="/dashboard" variant="primary" size="md">
            Go to dashboard
          </Button>
          <Button href="/" variant="secondary" size="md">
            Home
          </Button>
        </div>
      </div>
    </main>
  );
}
