// Critical-path e2e coverage for the Settings interests/focus editor
// (app/settings/page.tsx). Creates and cleans up its own throwaway
// accounts rather than reusing tests/global-setup.ts's shared fixture —
// several scenarios here need a specific pre-existing profiles.interests
// shape (a legacy alias, a retired value, an empty array) that the
// shared fixture doesn't have and other specs depend on staying stable.
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "../loadEnv";

loadEnvLocal();

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const PASSWORD = "E2eTest-Pw-2026!";
const createdUserIds: string[] = [];

async function createStudent(emailPrefix: string, interests: string[]) {
  const admin = adminClient();
  const email = `__test__-${emailPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const { data: userData, error: userErr } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (userErr || !userData.user) throw new Error(`createUser: ${userErr?.message}`);
  const userId = userData.user.id;
  createdUserIds.push(userId);
  await admin.from("user_roles").insert({ user_id: userId, role: "student" });
  await admin.from("profiles").insert({
    user_id: userId,
    age: 16,
    city: "Phoenix",
    zip_code: "85001",
    interests,
    skills: [],
    availability: [],
  });
  return { email, userId, admin };
}

async function loginAs(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login?mode=login");
  await page.fill("#login-email", email);
  await page.fill("#login-password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard$/, { timeout: 15000 });
}

test.describe("Settings — interests/focus editor", () => {
  test.afterAll(async () => {
    const admin = adminClient();
    for (const userId of createdUserIds) {
      await admin.from("profiles").delete().eq("user_id", userId).then(() => {}, () => {});
      await admin.auth.admin.deleteUser(userId).then(() => {}, () => {});
    }
  });

  test("existing-user compatibility: a legacy alias and a retired value both display and save correctly", async ({
    page,
  }) => {
    // Pre-migration-shaped profile: "computer_science" is the old
    // spelling of the new canonical "cs_software_engineering" focus;
    // "stem_leadership" is retired (no selectable checkbox at all, but
    // must survive a save untouched) — see lib/interestTaxonomy.ts's
    // FOCUS_ALIASES/RETIRED_FOCUS_VALUES.
    const { email, userId, admin } = await createStudent("settings-legacy", [
      "stem",
      "computer_science",
      "stem_leadership",
    ]);

    await loginAs(page, email);
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const stemBroad = page.getByRole("button", { name: "STEM & Technology", exact: true });
    await expect(stemBroad).toHaveAttribute("aria-pressed", "true");

    // The legacy alias resolves to its canonical focus and shows as
    // selected under its new name, not the old spelling.
    const csFocus = page.getByRole("button", { name: "Computer Science & Software Engineering", exact: true });
    await expect(csFocus).toBeVisible();
    await expect(csFocus).toHaveAttribute("aria-pressed", "true");

    // The retired value never appears as a selectable option anywhere.
    await expect(page.getByRole("button", { name: "STEM Leadership", exact: true })).toHaveCount(0);

    // Add a second focus via real keyboard interaction (not just a
    // click) — proves the picker is actually keyboard-operable, not
    // just clickable.
    const roboticsFocus = page.getByRole("button", { name: "Robotics", exact: true });
    await roboticsFocus.focus();
    await expect(roboticsFocus).toHaveAttribute("aria-pressed", "false");
    await roboticsFocus.press("Enter");
    await expect(roboticsFocus).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Save interests" }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 10000 });

    // Reload — persistence, not just optimistic local state.
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "STEM & Technology", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(
      page.getByRole("button", { name: "Computer Science & Software Engineering", exact: true })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Robotics", exact: true })).toHaveAttribute("aria-pressed", "true");

    // Verify what's actually in the database: the legacy spelling was
    // upgraded to its canonical form (not left duplicated or dropped),
    // the newly-added focus is present, and the retired value survived
    // untouched even though it was never shown as a checkbox.
    const { data: profile } = await admin.from("profiles").select("interests").eq("user_id", userId).single();
    expect(profile?.interests).toContain("cs_software_engineering");
    expect(profile?.interests).not.toContain("computer_science");
    expect(profile?.interests).toContain("robotics");
    expect(profile?.interests).toContain("stem_leadership");
  });

  test("undecided/no-focus user: an empty profile shows nothing pre-selected and saves cleanly", async ({ page }) => {
    const { email, userId, admin } = await createStudent("settings-undecided", []);

    await loginAs(page, email);
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // No broad interest is pressed, and — since nothing is selected —
    // no focus sub-picker for any category is rendered at all.
    for (const label of ["STEM & Technology", "Healthcare & Wellness", "Community Service"]) {
      await expect(page.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "false");
    }
    await expect(page.getByRole("button", { name: "Robotics", exact: true })).toHaveCount(0);

    // Saving with nothing picked must not fabricate a selection.
    await page.getByRole("button", { name: "Save interests" }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 10000 });

    const { data: profile } = await admin.from("profiles").select("interests").eq("user_id", userId).single();
    expect(profile?.interests).toEqual([]);
  });

  test("unchecking a broad interest also drops its focus selections, both in the UI and on save", async ({
    page,
  }) => {
    const { email, userId, admin } = await createStudent("settings-uncheck", []);

    await loginAs(page, email);
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const stemBroad = page.getByRole("button", { name: "STEM & Technology", exact: true });
    await stemBroad.click();
    await page.getByRole("button", { name: "Robotics", exact: true }).click();
    await page.getByRole("button", { name: "Save interests" }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 10000 });

    let { data: profile } = await admin.from("profiles").select("interests").eq("user_id", userId).single();
    expect(profile?.interests).toEqual(expect.arrayContaining(["stem", "robotics"]));

    // Uncheck the broad interest — its focus picker (and the previously
    // selected "Robotics" button) should disappear immediately.
    await stemBroad.click();
    await expect(stemBroad).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("button", { name: "Robotics", exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Save interests" }).click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 10000 });

    ({ data: profile } = await admin.from("profiles").select("interests").eq("user_id", userId).single());
    expect(profile?.interests).not.toContain("stem");
    expect(profile?.interests).not.toContain("robotics");
  });
});
