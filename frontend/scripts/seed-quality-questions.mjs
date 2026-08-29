import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { QUALITY_BANK } from "./quality-bank.mjs";

const root = process.cwd();
const envPath = path.join(root, ".env.local");

function parseDotEnv(contents) {
  const lines = contents.split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

if (fs.existsSync(envPath)) {
  const parsed = parseDotEnv(fs.readFileSync(envPath, "utf8"));
  for (const [k, v] of Object.entries(parsed)) {
    if (!process.env[k]) process.env[k] = v;
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 1) Delete the existing question bank (cascades to testcases + submissions).
const { error: delError } = await supabase
  .from("practice_questions")
  .delete()
  .neq("id", "00000000-0000-0000-0000-000000000000");
if (delError) {
  console.error("Failed to clear old questions", delError.message);
  process.exit(1);
}
console.log(`Cleared old question bank.`);

// 2) Insert the quality bank (LeetCode-style signatures included in meta).
let inserted = 0;
for (const problem of QUALITY_BANK) {
  const { error: insertError } = await supabase.from("practice_questions").insert({
    slug: problem.slug,
    title: problem.title,
    description: problem.description,
    difficulty: problem.difficulty,
    languages: problem.languages,
    testcases: problem.testcases,
    meta: { signature: problem.signature },
  });
  if (insertError) {
    console.error(`Failed to insert ${problem.slug}:`, insertError.message);
  } else {
    inserted += 1;
  }
}

const counts = QUALITY_BANK.reduce((acc, p) => {
  acc[p.difficulty] = (acc[p.difficulty] || 0) + 1;
  return acc;
}, {});
console.log(`Inserted ${inserted}/${QUALITY_BANK.length} problems:`, counts);