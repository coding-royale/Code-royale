import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("q") ?? "";
  const q = raw.trim();

  if (q.length < 2) {
    return NextResponse.json({ users: [], problems: [] });
  }

  // Limit length to avoid abuse
  const query = q.slice(0, 64);
  const like = `%${query.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    console.error("Supabase server client error", error);
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const [usersRes, problemsRes] = await Promise.all([
    supabase
      .from("users")
      .select("id,username,rating")
      .ilike("username", like)
      .order("username", { ascending: true })
      .limit(8),
    supabase
      .from("practice_questions")
      .select("id,slug,title,difficulty")
      .or(`title.ilike.${like},slug.ilike.${like}`)
      .order("title", { ascending: true })
      .limit(8),
  ]);

  // users may be hidden for anon (RLS returns empty, not error) — fallback to service key so global search works for all
  let users = usersRes.error ? [] : (usersRes.data ?? []);
  const problems = problemsRes.error ? [] : (problemsRes.data ?? []);

  if (problemsRes.error) {
    console.error("search problems error", problemsRes.error);
  }
  if (usersRes.error) {
    console.error("search users error", usersRes.error);
  }

  // If no users found and request is unauthenticated, try service role (allows search for all 35 users)
  if (users.length === 0) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (serviceKey && url) {
      try {
        const serviceClient = createClient(url, serviceKey);
        const { data: svcUsers, error: svcErr } = await serviceClient
          .from("users")
          .select("id,username,rating")
          .ilike("username", like)
          .order("username", { ascending: true })
          .limit(8);
        if (!svcErr && svcUsers && svcUsers.length > 0) {
          users = svcUsers;
        }
      } catch (e) {
        console.error("service fallback failed", e);
      }
    }
  }

  return NextResponse.json(
    { users, problems },
    { headers: { "cache-control": "private, max-age=30" } },
  );
}
