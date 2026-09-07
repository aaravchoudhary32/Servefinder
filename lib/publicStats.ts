import { createClient } from "@supabase/supabase-js";

// A plain count query, scoped by the same RLS policy that already
// governs every anonymous read of `opportunities` ("Public can read
// approved opportunities from verified orgs or admin-entered
// listings") — this counts exactly what a visitor could actually see,
// nothing more. Used by the homepage to show a real, live number
// instead of a hardcoded or invented one.
export async function getPublicOpportunityCount(): Promise<number | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { count, error } = await client
    .from("opportunities")
    .select("id", { count: "exact", head: true });

  if (error) {
    console.error("getPublicOpportunityCount failed:", error.message);
    return null;
  }
  return count;
}
