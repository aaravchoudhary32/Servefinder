"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getAccountInfo, homeRouteFor, AccountInfo } from "@/lib/accountRole";
import { PinIcon, MenuIcon, CloseIcon, MessageIcon } from "./icons";
import ReportIssueModal from "./ReportIssueModal";

// "Admin" (ADMIN_LINK below) is appended to the link list conditionally,
// once a per-user admins-table check resolves — never rendered from a
// hardcoded role/email check. The link itself is just a UX convenience
// either way: every admin page independently re-checks `admins` on
// load, and every admin-only mutation is enforced by Postgres RLS
// (`exists (select 1 from admins where user_id = auth.uid())` in
// supabase/schema.sql), so a non-admin who somehow reached /admin by
// URL still hits a real "Admin access required" wall and RLS blocks
// every write regardless of what this nav renders.
const STUDENT_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/explore", label: "Explore" },
  { href: "/applications", label: "Applications" },
  { href: "/organizations", label: "Organizations" },
  { href: "/settings", label: "Settings" },
];
const ADMIN_LINK = { href: "/admin", label: "Admin" };

const ORGANIZATION_LINKS = [
  { href: "/org-dashboard", label: "My Organization" },
  { href: "/organizations", label: "Organizations" },
  { href: "/settings", label: "Settings" },
];

// Distinct color per account type, same visual language StatusBadge
// already uses elsewhere (moss = the app's primary/positive color,
// marigold = its secondary accent) — so the badge reads as "which kind
// of account" at a glance, not just another gray pill.
const BADGE_STYLES: Record<"student" | "organization", string> = {
  student: "bg-moss-light text-moss-dark border-moss/30",
  organization: "bg-marigold-light text-marigold-dark border-marigold/30",
};
const BADGE_LABELS: Record<"student" | "organization", string> = {
  student: "Student",
  organization: "Organization",
};

type NavLink = { href: string; label: string };

// Owns mobileOpen entirely on its own — closing it on navigation is
// achieved by the parent remounting this component with a fresh `key`
// (see NavBar below) rather than an effect calling setState, so account
// fetching in the parent is never affected by a route change. React's own
// documented pattern for "reset local state when some outside value
// changes": key-remount instead of syncing via an effect.
function MobileNav({
  links,
  pathname,
  account,
  onLogout,
}: {
  links: NavLink[];
  pathname: string;
  account: AccountInfo | null;
  onLogout: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        aria-expanded={mobileOpen}
        aria-controls="mobile-nav-menu"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        className="lg:hidden flex items-center justify-center w-9 h-9 rounded-card border border-line text-ink/70 hover:border-moss hover:text-ink transition-all duration-200 ease-smooth"
      >
        {mobileOpen ? <CloseIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
      </button>

      {mobileOpen && (
        // Absolutely positioned against <nav> (the nearest positioned
        // ancestor — its own `sticky` establishes that containing block)
        // rather than relying on normal document flow, since this button
        // + panel pair now renders together from inside the header row's
        // flex container (see NavBar below) instead of as the row's
        // sibling the way the panel used to sit. Visually identical: a
        // full-width panel directly under the 64px (h-16) row.
        <div
          id="mobile-nav-menu"
          className="lg:hidden absolute top-16 inset-x-0 z-10 animate-fade-in border-t border-line bg-paper px-6 py-4 flex flex-col gap-1"
        >
          {links.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm px-3 py-2 rounded-card transition-all duration-200 ease-smooth ${
                  active
                    ? "bg-moss-light text-moss-dark font-medium"
                    : "text-ink/70 hover:text-ink hover:bg-line/40"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          {/* Deliberately outside the account/actions cluster below — a
              tester found it distracting sitting between the role badge
              and Logout. Still in the main link list (discoverable,
              same tab stop as every other nav destination), just no
              longer grouped with account controls. Sized for a real
              44px mobile touch target (py-3, not this list's usual
              py-2) since unlike the Link rows above, this is the one
              control in this menu this pass specifically re-homed. */}
          <ReportIssueModal
            reportType="general_feedback"
            triggerLabel="Feedback"
            triggerClassName="text-sm text-ink/70 hover:text-ink hover:bg-line/40 rounded-card px-3 py-3 text-left transition-all duration-200 ease-smooth"
          />
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-line">
            {account ? (
              <span
                className={`text-xs font-mono uppercase tracking-wide px-2.5 py-1 rounded-card border shadow-soft ${BADGE_STYLES[account.role]}`}
              >
                {BADGE_LABELS[account.role]}
              </span>
            ) : (
              <span />
            )}
            <button
              onClick={onLogout}
              className="text-sm px-3 py-1.5 rounded-card border border-line text-ink/70 hover:border-moss hover:text-ink hover:shadow-pop transition-all duration-200 ease-smooth"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  // null = not yet loaded (or logged out). Defaults to the student link
  // set while loading so the nav renders immediately rather than
  // blocking on a role lookup; swaps to the organization set — and the
  // badge appears — once known. A brief wrong-link flash for org
  // accounts on first paint is an acceptable trade-off for not blocking
  // every page's nav.
  const [account, setAccount] = useState<AccountInfo | null>(null);
  // false until proven true — same fail-closed default every /admin/*
  // page already uses for its own independent check. This is a nav-
  // rendering convenience only; it grants nothing by itself (see
  // STUDENT_LINKS' comment above).
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    getAccountInfo().then(setAccount);

    async function checkAdmin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
      setIsAdmin(Boolean(data));
    }
    checkAdmin();
  }, []);

  // Guards against a logged-out user seeing a stale, already-rendered
  // protected page via the browser's back/forward (bfcache) — bfcache
  // restores the DOM instantly from memory without remounting React or
  // re-running this effect, so the mount-time auth check every
  // protected page already has (supabase.auth.getUser() -> redirect if
  // null) never gets a chance to re-fire on its own. Forcing a real
  // reload on a bfcache restore makes that check run again for real.
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        window.location.reload();
      }
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const baseLinks = account?.role === "organization" ? ORGANIZATION_LINKS : STUDENT_LINKS;
  const links = isAdmin && account?.role !== "organization" ? [...baseLinks, ADMIN_LINK] : baseLinks;
  const homeHref = account ? homeRouteFor(account) : "/dashboard";

  async function handleLogout() {
    await supabase.auth.signOut();
    // supabase.auth.signOut() clears the session from local storage
    // before this resolves, so any protected page's own mount-time
    // auth check (supabase.auth.getUser() -> redirect if null) already
    // sees "logged out" from here on — a client-side route change is
    // enough; the bfcache pageshow guard above is what actually handles
    // "stale state via browser history" (a bfcache-restored page never
    // re-runs this or any mount effect on its own).
    router.push("/login?mode=login");
  }

  return (
    <nav className="sticky top-0 z-20 border-b border-line bg-paper/80 backdrop-blur-md">
      {/* Visually hidden until focused (WCAG 2.4.1 Bypass Blocks) — the
          first tab stop on every page, letting keyboard/screen-reader
          users jump straight past the nav bar to each page's own
          `<main id="main-content">` instead of tabbing through every nav
          link first. Positioned above the nav bar's own z-index/backdrop
          once focused so it's never hidden behind them. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-card focus:bg-moss focus:text-white focus:shadow-pop"
      >
        Skip to main content
      </a>
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-7">
          <Link href={homeHref} className="flex items-center gap-2 shrink-0">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-moss text-white">
              <PinIcon className="w-4 h-4" />
            </span>
            <span className="font-display text-sm font-semibold whitespace-nowrap">
              ServeFinder
            </span>
          </Link>
          {/* Desktop-row/mobile-menu split is `lg:` (1024px), not the
              more typical `sm:` (640px) — measured directly at a real
              834px tablet width: the desktop row's own link count (5,
              6 for an admin) plus the account cluster genuinely doesn't
              fit below ~1024px, and did overflow the viewport at 640px+
              before this was raised. Tablet widths get the same
              hamburger menu mobile phones use rather than a clipped
              row. */}
          <div className="hidden lg:flex items-center gap-1">
            {links.map((link) => {
              const active =
                pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative text-sm px-3 py-1.5 rounded-card transition-all duration-200 ease-smooth ${
                    active
                      ? "bg-moss-light text-moss-dark font-medium"
                      : "text-ink/70 hover:text-ink hover:bg-line/40"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            {/* Deliberately outside the badge+Logout cluster on the
                right — a tester found it distracting sitting between
                them. Kept in the main link row (still discoverable on
                desktop and mobile alike), just no longer grouped with
                account actions. Icon-only here (full "Feedback" text is
                used in the mobile/tablet menu below, where a vertical
                list has room to spell it out) keeps this compact row
                comfortable even with 6 links plus this control and,
                for an admin, a 7th — the accessible name is unchanged
                (sr-only text), so this is a visual-only difference for
                sighted users at the width this row actually renders
                at. See the `lg:` breakpoint note below for the real
                fix to the tablet-width overflow this row can cause: a
                text "Feedback" here was enough, on its own, to push a
                real ~834px tablet width past its content. */}
            <ReportIssueModal
              reportType="general_feedback"
              triggerLabel={
                <>
                  <MessageIcon className="w-4 h-4" />
                  <span className="sr-only">Feedback</span>
                </>
              }
              triggerClassName="flex items-center text-ink/70 hover:text-ink hover:bg-line/40 rounded-card px-2.5 py-1.5 transition-all duration-200 ease-smooth"
            />
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-3">
          {account && (
            <span
              className={`text-xs font-mono uppercase tracking-wide px-2.5 py-1 rounded-card border shadow-soft ${BADGE_STYLES[account.role]}`}
            >
              {BADGE_LABELS[account.role]}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="text-sm px-3 py-1.5 rounded-card border border-line text-ink/70 hover:border-moss hover:text-ink hover:shadow-pop transition-all duration-200 ease-smooth"
          >
            Logout
          </button>
        </div>
        {/* Keyed by pathname so the mobile menu's own open/closed state
            resets to closed on every navigation — Link clicks, browser
            back/forward, or a programmatic router.push from anywhere else
            in the app all change `pathname`, and any of them remounts this
            fresh. account/link-set state above is untouched by this. */}
        <MobileNav key={pathname} links={links} pathname={pathname} account={account} onLogout={handleLogout} />
      </div>
    </nav>
  );
}
