// Single source of truth for "what kind of account is this, and where
// does it belong" — used by NavBar (nav links + badge) and by every
// role-gated page (/dashboard, /onboarding, /onboarding/organization,
// /org-dashboard) so the check and the redirect target can never drift
// apart between them.
//
// Two round trips (user_roles, then organization_accounts) rather than
// one join: `user_roles` is set at signup, before any onboarding data
// exists — an organization account with no organization_accounts row
// yet (abandoned onboarding) is a real, expected state this needs to
// distinguish from a fully set-up one, not an edge case to ignore.

import { supabase } from "./supabaseClient";

export type AccountInfo =
  | { role: "student" }
  | { role: "organization"; organizationId: string | null };

/** null = not logged in, or signed up but user_roles was never set (shouldn't happen post-signup, but not this function's job to fix). */
export async function getAccountInfo(): Promise<AccountInfo | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!roleRow) return null;

  if (roleRow.role === "organization") {
    const { data: account } = await supabase
      .from("organization_accounts")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();
    return { role: "organization", organizationId: account?.organization_id ?? null };
  }

  return { role: "student" };
}

/** Where this account should land — the same decision login/page.tsx makes at sign-in time, reused so a route guard and the login redirect never disagree. */
export function homeRouteFor(account: AccountInfo): string {
  if (account.role === "organization") {
    return account.organizationId ? "/org-dashboard" : "/onboarding/organization";
  }
  return "/dashboard";
}
