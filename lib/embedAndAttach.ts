// Fire-and-forget: computed after an opportunity is already saved, so a
// slow (or first-ever, model-downloading) embedding call never blocks
// the form/import it's attached to. Semantic matching just treats the
// row as unembedded until this finishes. Extracted from identical
// copies in app/admin/page.tsx and app/org-dashboard/page.tsx — now a
// third caller (CsvImportPanel) needs it too, so duplicating it a third
// time stopped being the simpler option.
import { supabase } from "./supabaseClient";

export async function embedAndAttach(opportunityId: string, text: string) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated.");

    const res = await fetch("/api/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`embeddings API returned ${res.status}`);
    const { embedding } = await res.json();
    await supabase.from("opportunities").update({ embedding }).eq("id", opportunityId);
  } catch (err) {
    console.error("Failed to compute embedding for opportunity", opportunityId, err);
  }
}
