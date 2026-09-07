// Deletes everything tests/global-setup.ts created, and the generated
// storageState/fixture files. Runs once after either suite finishes,
// success or failure.
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, unlinkSync } from "fs";
import path from "path";
import { loadEnvLocal } from "./loadEnv";

export default async function globalTeardown() {
  loadEnvLocal();

  const fixturePath = path.join(process.cwd(), "tests/.a11y-fixture.json");
  if (!existsSync(fixturePath)) return;
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceRoleKey) {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    await admin.from("opportunities").delete().eq("organization_id", fixture.orgId);
    await admin.from("organizations").delete().eq("id", fixture.orgId);
    if (fixture.orgUserId) await admin.auth.admin.deleteUser(fixture.orgUserId);

    if (fixture.studentUserId) {
      await admin.from("admins").delete().eq("user_id", fixture.studentUserId);
      await admin.from("profiles").delete().eq("user_id", fixture.studentUserId);
      await admin.auth.admin.deleteUser(fixture.studentUserId);
    }
  }

  for (const file of ["tests/.a11y-fixture.json", "tests/.storage-student.json", "tests/.storage-org.json"]) {
    const p = path.join(process.cwd(), file);
    if (existsSync(p)) unlinkSync(p);
  }
}
