import Link from "next/link";
import { PinIcon } from "./icons";

// A minimal header for pages that must work for a fully anonymous
// visitor (About/Privacy/Terms/Contact) — the full NavBar assumes an
// account (its link set is Dashboard/Explore/Applications, which just
// bounce a logged-out visitor to /login). Matches app/page.tsx's own
// inline header exactly, since that's this app's only other
// already-public-facing header.
export default function PublicHeader() {
  return (
    <div className="max-w-3xl mx-auto px-6 pt-6 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2">
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-moss text-white">
          <PinIcon className="w-4 h-4" />
        </span>
        <span className="font-display text-sm font-semibold whitespace-nowrap">ServeFinder</span>
      </Link>
      <div className="flex items-center gap-3">
        <Link
          href="/login?mode=login"
          className="text-sm px-4 py-2 rounded-card border border-line text-ink/70 hover:border-moss hover:text-ink hover:shadow-pop transition-all duration-200 ease-smooth"
        >
          Log In
        </Link>
        <Link
          href="/login?mode=signup"
          className="text-sm px-4 py-2 rounded-card bg-moss text-white font-medium hover:bg-moss-dark hover:shadow-pop transition-all duration-200 ease-smooth"
        >
          Sign Up
        </Link>
      </div>
    </div>
  );
}
