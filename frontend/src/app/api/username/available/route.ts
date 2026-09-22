import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { escapeIlikeLiteral, validateUsername } from "@/lib/username";

/**
 * GET /api/username/available?username=foo
 *
 * Public on purpose: the signup form (no session yet) needs to check a name
 * before creating the account. Only answers whether the exact name
 * (case-insensitive) is free — never leaks who owns a taken name.
 */
export async function GET(request: Request) {
  const username = new URL(request.url).searchParams.get("username")?.trim() ?? "";

  const formatError = validateUsername(username);
  if (formatError) {
    return NextResponse.json({ available: false, error: formatError });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || (!serviceKey && !anonKey)) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  // Service role bypasses RLS so anonymous signup checks work too.
  const client = createClient(url, (serviceKey ?? anonKey) as string);

  const { data, error } = await client
    .from("users")
    .select("id")
    .ilike("username", escapeIlikeLiteral(username))
    .limit(1);

  if (error) {
    return NextResponse.json({ error: "Availability check failed" }, { status: 500 });
  }

  const taken = (data ?? []).length > 0;
  return NextResponse.json(
    taken
      ? { available: false, error: "That username is already taken." }
      : { available: true },
  );
}
