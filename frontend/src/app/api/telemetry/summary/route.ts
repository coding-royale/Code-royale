export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { serverCached } from "@/lib/server-cache";

type TelemetryState = {
  activeByClient: Map<string, number>;
  totalHits: number;
};

function getState(): TelemetryState {
  const globalAny = globalThis as unknown as { __crTelemetry?: TelemetryState };
  if (!globalAny.__crTelemetry) {
    globalAny.__crTelemetry = {
      activeByClient: new Map<string, number>(),
      totalHits: 0,
    };
  }
  return globalAny.__crTelemetry;
}

function getClientId(request: NextRequest): { id: string; setCookie?: { name: string; value: string } } {
  const existing = request.cookies.get("cr_vid")?.value;
  if (existing) return { id: existing };

  const id = crypto.randomUUID();
  return { id, setCookie: { name: "cr_vid", value: id } };
}

export async function GET(request: NextRequest) {
  const state = getState();

  const now = Date.now();
  const ttlMs = 5 * 60 * 1000; // "active" window = last 5 minutes

  const client = getClientId(request);
  state.totalHits += 1;
  state.activeByClient.set(client.id, now);

  for (const [key, lastSeen] of state.activeByClient.entries()) {
    if (now - lastSeen > ttlMs) state.activeByClient.delete(key);
  }

  const currentVisits = state.activeByClient.size;

  // Query real data from Supabase, cached for 60s per instance — the numbers
  // change slowly and the dashboard polls on an interval.
  const { activePlayers, matchesToday } = await serverCached("telemetry-db-stats", 60_000, async () => {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return { activePlayers: 0, matchesToday: 0 };
      }

      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Count players with rating > 0 (have played at least one match)
      const { count: ratedPlayers } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .gt("wins", 0);

      // Count matches completed today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayIso = todayStart.toISOString();

      const { count: todayMatches } = await supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayIso);

      return { activePlayers: ratedPlayers ?? 0, matchesToday: todayMatches ?? 0 };
    } catch {
      // Fall back to 0s if Supabase is unavailable
      return { activePlayers: 0, matchesToday: 0 };
    }
  });

  const response = NextResponse.json(
    {
      activePlayers,
      currentVisits,
      matchesToday,
      serverTime: new Date(now).toISOString(),
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );

  if (client.setCookie) {
    response.cookies.set({
      name: client.setCookie.name,
      value: client.setCookie.value,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}
