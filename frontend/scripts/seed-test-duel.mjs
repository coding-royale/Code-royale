/**
 * Dev-only helper: provisions two confirmed test players so a real 1v1 can be
 * exercised locally (queue -> room -> shared start -> result).
 *
 * Usage: bun scripts/seed-test-duel.mjs [password]
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const raw of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  if (eq === -1) continue;
  env[line.slice(0, eq).trim()] = line
    .slice(eq + 1)
    .trim()
    .replace(/^["']|["']$/g, "");
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const password = process.argv[2] || "TestPass123!";
const players = [
  { email: "duel.alpha@test.local", username: "DuelAlpha" },
  { email: "duel.bravo@test.local", username: "DuelBravo" },
];

for (const player of players) {
  let userId = null;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: player.email,
    password,
    email_confirm: true,
    user_metadata: { display_name: player.username },
  });

  if (createError) {
    // Already exists — look it up so the script is re-runnable.
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = list?.users?.find((u) => u.email === player.email);
    if (!found) {
      console.error(`Could not create or find ${player.email}: ${createError.message}`);
      process.exit(1);
    }
    userId = found.id;
    await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    console.log(`reused ${player.email}`);
  } else {
    userId = created.user.id;
    console.log(`created ${player.email}`);
  }

  const { error: profileError } = await admin
    .from("users")
    .update({ username: player.username, onboarded: true, rating: 420 })
    .eq("id", userId);

  if (profileError) console.error(`profile update failed: ${profileError.message}`);
}

console.log(`\npassword for both: ${password}`);
