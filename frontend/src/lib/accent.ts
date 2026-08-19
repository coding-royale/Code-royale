"use client";

export const ACCENT_STORAGE_KEY = "cr_settings_accent";

export type Accent = "mono" | "indigo";

export function getStoredAccent(): Accent {
  if (typeof window === "undefined") return "mono";
  try {
    return localStorage.getItem(ACCENT_STORAGE_KEY) === "indigo" ? "indigo" : "mono";
  } catch {
    return "mono";
  }
}

export function applyAccent(accent: Accent) {
  if (typeof document === "undefined") return;
  if (accent === "indigo") document.documentElement.dataset.accent = "indigo";
  else delete document.documentElement.dataset.accent;
}

export function setStoredAccent(accent: Accent) {
  try {
    if (accent === "indigo") localStorage.setItem(ACCENT_STORAGE_KEY, "indigo");
    else localStorage.removeItem(ACCENT_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
  applyAccent(accent);
}