type PracticePrefs = {
  language?: string;
  timer?: number;
};

const KEY = "code-royale:practice-prefs";

export function getPracticePrefs(): PracticePrefs {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as PracticePrefs) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function setPracticePrefs(prefs: PracticePrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...getPracticePrefs(), ...prefs }));
  } catch {
    // ignore storage failures (private mode, quota, etc.)
  }
}