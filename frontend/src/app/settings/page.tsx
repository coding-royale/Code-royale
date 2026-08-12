"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

import { AppShell } from "../../components/app-shell";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { Switch } from "../../components/ui/switch";
import { Textarea } from "../../components/ui/textarea";
import { supabase } from "../../lib/supabase-browser";

const themeOptions = [
  { id: "light", name: "Light", description: "Bright and airy", icon: Sun },
  { id: "dark", name: "Dark", description: "Easy on the eyes", icon: Moon },
  { id: "system", name: "System", description: "Follow your device", icon: Monitor },
] as const;

type StoredPrefs = {
  spectateEnabled: boolean;
  tagline: string;
};

const defaultPrefs: StoredPrefs = { spectateEnabled: true, tagline: "" };

// useSyncExternalStore requires getSnapshot to return a stable (cached)
// reference — returning a fresh object every call makes React loop forever.
let cachedPrefs: StoredPrefs | null = null;

function readStoredPrefs(): StoredPrefs {
  if (typeof window === "undefined") return defaultPrefs;
  try {
    const spectate = localStorage.getItem("cr_settings_spectate_enabled");
    const tagline = localStorage.getItem("cr_settings_tagline") ?? "";
    const next: StoredPrefs = {
      spectateEnabled: spectate === null ? true : spectate === "true",
      tagline,
    };
    if (
      cachedPrefs === null ||
      cachedPrefs.spectateEnabled !== next.spectateEnabled ||
      cachedPrefs.tagline !== next.tagline
    ) {
      cachedPrefs = next;
    }
    return cachedPrefs;
  } catch {
    return defaultPrefs;
  }
}

function subscribeStoredPrefs(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const storedPrefs = useSyncExternalStore(
    subscribeStoredPrefs,
    readStoredPrefs,
    () => defaultPrefs,
  );
  const [spectateEnabled, setSpectateEnabled] = useState(storedPrefs.spectateEnabled);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [tagline, setTagline] = useState(storedPrefs.tagline);

  const spectateLabel = useMemo(
    () => (spectateEnabled ? "Friends can spectate your matches" : "Spectate disabled"),
    [spectateEnabled],
  );

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      setLoadingProfile(true);
      setError(null);
      setSuccess(null);

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!mounted) return;

      if (authError || !authData.user?.id) {
        setError(authError?.message ?? "You must be signed in to edit settings.");
        setLoadingProfile(false);
        return;
      }

      const { data: userRow, error: profileError } = await supabase
        .from("users")
        .select("username")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (profileError) {
        setError(profileError.message);
        setLoadingProfile(false);
        return;
      }

      setDisplayName(userRow?.username ?? "");
      setLoadingProfile(false);
    };

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      localStorage.setItem("cr_settings_spectate_enabled", String(spectateEnabled));
      localStorage.setItem("cr_settings_tagline", tagline);
    } catch {
      // ignore localStorage errors
    }

    const nextName = displayName.trim();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user?.id) {
      setError(authError?.message ?? "You must be signed in to save changes.");
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ username: nextName.length ? nextName : null })
      .eq("id", authData.user.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSuccess("Settings saved successfully.");
    setSaving(false);
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl p-6">
        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your account preferences and appearance.
          </p>
        </header>

        <div className="flex flex-col gap-6">
          {/* Profile Section */}
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                Your name and tagline show up across the arena.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex items-center gap-4">
                <Avatar className="size-16 text-lg font-bold">
                  <AvatarFallback>CR</AvatarFallback>
                </Avatar>
                <div>
                  <Label className="text-sm text-muted-foreground">Profile photo</Label>
                  <div>
                    <Button type="button" variant="outline" size="sm" className="mt-1">
                      Upload new
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  type="text"
                  placeholder={loadingProfile ? "Loading…" : "Enter your name"}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={loadingProfile || saving}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Textarea
                  id="tagline"
                  rows={3}
                  placeholder="A short description about yourself"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  disabled={saving}
                />
              </div>
            </CardContent>
          </Card>

          {/* Appearance Section */}
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Pick how Code Royale looks. Changes apply instantly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={theme ?? "dark"}
                onValueChange={(value) => setTheme(value)}
                className="grid gap-3 sm:grid-cols-3"
              >
                {themeOptions.map((option) => (
                  <label
                    key={option.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all hover:shadow-sm ${
                      theme === option.id
                        ? "border-primary/40 bg-accent/60 shadow-sm"
                        : "border-border hover:bg-muted/60"
                    }`}
                  >
                    <RadioGroupItem value={option.id} className="mt-0.5" />
                    <span className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <option.icon className="size-4" />
                        {option.name}
                      </span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Privacy Section */}
          <Card>
            <CardHeader>
              <CardTitle>Privacy</CardTitle>
              <CardDescription>Control who can see your activity.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Match Spectating</p>
                  <p className="text-xs text-muted-foreground">{spectateLabel}</p>
                </div>
                <Switch
                  checked={spectateEnabled}
                  onCheckedChange={setSpectateEnabled}
                  disabled={saving}
                  aria-label="Toggle match spectating"
                />
              </div>
            </CardContent>
          </Card>

          {/* Security Section */}
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Keep your account locked down.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input id="current-password" type="password" placeholder="••••••••" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input id="new-password" type="password" placeholder="Enter new password" />
              </div>
              <div>
                <Button type="button" variant="outline">
                  Update Password
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Messages */}
          {(error || success) && (
            <Alert variant={error ? "destructive" : "default"}>
              <AlertTitle>{error ? "Something went wrong" : "All good"}</AlertTitle>
              <AlertDescription>{error ?? success}</AlertDescription>
            </Alert>
          )}

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving || loadingProfile} size="lg">
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
