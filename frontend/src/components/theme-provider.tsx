"use client";

import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

import { getStoredAccent, applyAccent } from "@/lib/accent";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Apply the saved accent choice once the client is available.
  useEffect(() => {
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