"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase-browser";
import { LinkButton } from "@/components/ui/link-button";

/**
 * Auth-aware landing CTA. The hero page itself is statically rendered;
 * only this button needs client-side auth state.
 */
export function HeroCta() {
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (mounted) setIsSignedIn(Boolean(data.user));
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <LinkButton
      size="lg"
      href={isSignedIn ? "/home" : "/auth/signup"}
      className="h-12 rounded-xl bg-white px-8 text-base font-semibold text-black hover:bg-white/85"
    >
      Enter Arena
    </LinkButton>
  );
}