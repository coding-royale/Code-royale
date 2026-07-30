'use client';

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabaseBrowserConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.local.example).",
    );
  }

  if (/^your_/i.test(supabaseAnonKey) || supabaseAnonKey.includes("YOUR_")) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY looks like a placeholder. Update it with your real Supabase anon key.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(supabaseUrl);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL is not a valid URL: ${supabaseUrl}. Expected e.g. https://<project-ref>.supabase.co`,
    );
  }

  const isLocalHost =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "0.0.0.0";

  if (!isLocalHost && parsed.protocol !== "https:") {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must use https in production (browsers block insecure auth requests and it shows up as 'Failed to fetch').",
    );
  }

  return {
    url: supabaseUrl.replace(/\/+$/, ""),
    anonKey: supabaseAnonKey,
  };
}

const { url, anonKey } = getSupabaseBrowserConfig();

export const supabaseBrowserClient = createBrowserClient(url, anonKey);

export const supabase = supabaseBrowserClient;
