// Business/Entrepreneurship/Finance/Marketing/Social Innovation batch —
// covers the onboarding progressive-disclosure UI for the "business"
// broad category and its focus sub-picker (mirrors the STEM sub-picker
// pattern, see app/onboarding/page.tsx and lib/interestTaxonomy.ts).
// Business now has 10 canonical focuses (widened from the original 4 by
// the 10-category canonical taxonomy batch — see
// lib/interestTaxonomy.ts's TAXONOMY); this test only asserts that a
// representative few of them (unchanged across that widening) appear and
// behave correctly, not an exact total count, so it stays valid either
// way.
//
// Deliberately runs through the ANONYMOUS preview path (no signup, no
// login) rather than creating a throwaway account and submitting the
// real form: profiles.interests has a live database CHECK constraint
// that does not yet allow every canonical focus value until
// supabase/add_canonical_focus_taxonomy.sql has actually been run in
// Supabase (a separate, explicit step gated on manual confirmation —
// see that file's header). The anonymous path never writes to
// `profiles` at all (app/onboarding/page.tsx's handleSubmit routes an
// unauthenticated visitor to showPreview() instead), so this test is
// safe to run — and this test file continues to be safe to run — both
// before and after that migration lands.
import { test, expect } from "@playwright/test";

test.describe("Onboarding — Business & Entrepreneurship taxonomy", () => {
  test("selecting 'Business & Entrepreneurship' reveals its sub-interest options; deselecting hides them again", async ({
    page,
  }) => {
    await page.goto("/onboarding");

    const businessToggle = page.getByRole("button", { name: "Business & Entrepreneurship" });
    await expect(businessToggle).toBeVisible();
    await expect(businessToggle).toHaveAttribute("aria-pressed", "false");

    // Sub-picker isn't rendered at all until the parent interest is picked.
    await expect(page.getByRole("button", { name: "Entrepreneurship", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Finance", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Marketing", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Social Innovation", exact: true })).toHaveCount(0);

    await businessToggle.click();
    await expect(businessToggle).toHaveAttribute("aria-pressed", "true");

    const entrepreneurship = page.getByRole("button", { name: "Entrepreneurship", exact: true });
    const finance = page.getByRole("button", { name: "Finance", exact: true });
    const marketing = page.getByRole("button", { name: "Marketing", exact: true });
    const socialInnovation = page.getByRole("button", { name: "Social Innovation", exact: true });
    await expect(entrepreneurship).toBeVisible();
    await expect(finance).toBeVisible();
    await expect(marketing).toBeVisible();
    await expect(socialInnovation).toBeVisible();

    // The STEM sub-picker (a separate, unrelated taxonomy) stays hidden —
    // picking "business" doesn't also reveal it.
    await expect(page.getByRole("button", { name: "Robotics", exact: true })).toHaveCount(0);

    await expect(finance).toHaveAttribute("aria-pressed", "false");
    await finance.click();
    await expect(finance).toHaveAttribute("aria-pressed", "true");

    // Deselecting the parent hides the sub-picker again.
    await businessToggle.click();
    await expect(businessToggle).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("button", { name: "Finance", exact: true })).toHaveCount(0);
  });

  test("anonymous preview submits successfully with a Business sub-interest selected (no DB write, no constraint violation)", async ({
    page,
  }) => {
    await page.goto("/onboarding");
    await page.fill("#onboarding-age", "16");
    await page.fill("#onboarding-zip", "85001");

    await page.getByRole("button", { name: "Business & Entrepreneurship" }).click();
    await page.getByRole("button", { name: "Marketing", exact: true }).click();
    await page.getByRole("button", { name: "Find My Matches" }).click();

    // Anonymous submission renders a preview (never a "profiles" insert —
    // see this file's header comment). Both the real-matches heading
    // ("Here's what matches you...") and the empty-state heading ("No
    // preview matches yet") contain "match", so this single check covers
    // either outcome — what matters is that the form submitted cleanly
    // with the new interest values, without hitting the as-yet-unwidened
    // database constraint.
    await expect(page.getByRole("heading", { name: /match/i })).toBeVisible({ timeout: 15000 });
  });
});
