"use client";

import { useLayoutEffect } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

import { getStoredAccent, applyAccent } from "@/lib/accent";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Apply the saved accent before the first paint so there is no flash.
  useLayoutEffect(() => {
    applyAccent(getStoredAccent());
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}