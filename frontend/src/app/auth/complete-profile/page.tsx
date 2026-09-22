"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ArrowLeftIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";

import { supabase } from "../../../lib/supabase-browser";
import { suggestUsername, validateUsername } from "../../../lib/username";
import { clearCachedProfile } from "../../../lib/user-profile-cache";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/home";
}

function CompleteProfileForm() {
  const router = useRouter();
  const [next] = useState(() =>
    typeof window === "undefined"
      ? "/home"
      : safeNext(new URLSearchParams(window.location.search).get("next")),
  );

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loadingSession, setLoadingSession] = useState(true);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New OAuth sign-ins land here before they can use the app. Existing
  // (grandfathered) accounts have onboarded=true and never see this page —
  // the callback route and the app shell both bounce them straight through.
  useEffect(() => {
    let alive = true;

    const load = async () => {
      const { data, error: authError } = await supabase.auth.getUser();
      if (!alive) return;
      if (authError || !data.user) {
        router.replace("/auth/login");
        return;
      }

      const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
      const metaName =
        (typeof meta.display_name === "string" && meta.display_name) ||
        (typeof meta.user_name === "string" && meta.user_name) ||
        (typeof meta.preferred_username === "string" && meta.preferred_username) ||
        (typeof meta.name === "string" && meta.name) ||
        "";
      const emailPrefix = (data.user.email ?? "").split("@")[0] ?? "";

      const { data: row } = await supabase
        .from("users")
        .select("username,onboarded")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!alive) return;

      const typedRow = row as { username?: string | null; onboarded?: boolean | null } | null;
      if (typedRow?.onboarded === true) {
        router.replace(next);
        return;
      }

      const current = typeof typedRow?.username === "string" ? typedRow.username : "";
      setUserId(data.user.id);
      setUserEmail(data.user.email ?? "");
      setCurrentUsername(current);
      setUsername(
        suggestUsername(current) ||
          suggestUsername(metaName) ||
          suggestUsername(emailPrefix) ||
          "",
      );
      setLoadingSession(false);
    };

    void load();
    return () => {
      alive = false;
    };
  }, [router, next]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !userId) return;
    setSaving(true);
    setChecking(false);
    setError(null);
    setSuccess(null);

    const name = username.trim();

    const formatError = validateUsername(name);
    if (formatError) {
      setError(formatError);
      setSaving(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setSaving(false);
      return;
    }

    // Uniqueness is case-insensitive. A name the trigger already gave this
    // very account does not count as taken.
    if (name.toLowerCase() !== currentUsername.trim().toLowerCase()) {
      setChecking(true);
      try {
        const res = await fetch(`/api/username/available?username=${encodeURIComponent(name)}`);
        const json = (await res.json()) as { available?: boolean; error?: string };
        if (!res.ok || json.available !== true) {
          setError(json.error ?? "That username is already taken.");
          setSaving(false);
          setChecking(false);
          return;
        }
      } catch {
        setError("Could not check username availability. Try again.");
        setSaving(false);
        setChecking(false);
        return;
      }
      setChecking(false);
    }

    // Attach a password so the account can also sign in with email.
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) {
      setError(passwordError.message);
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ username: name, onboarded: true })
      .eq("id", userId);

    if (updateError) {
      // Someone grabbed the name between the check and the save.
      if ((updateError as { code?: string }).code === "23505") {
        setError("That username was just taken. Pick another one.");
      } else {
        setError(updateError.message);
      }
      setSaving(false);
      return;
    }

    clearCachedProfile();
    setSuccess("Profile ready. Redirecting...");
    setSaving(false);
    setTimeout(() => router.replace(next), 900);
  };

  if (loadingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Back to home
        </Link>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Pick your username</CardTitle>
            <CardDescription>
              {userEmail
                ? `Signed in as ${userEmail}. One last step before the arena.`
                : "One last step before the arena."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  required
                  autoComplete="username"
                  placeholder="e.g. code_royale.99"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  3–20 characters. Only letters, numbers, _ and . — and it must be unique.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  At least 8 characters. This lets you sign in with email too.
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert>
                  <CheckCircle2Icon data-icon="inline-start" />
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={saving || !username || !password}>
                {(saving || checking) && (
                  <Loader2Icon data-icon="inline-start" className="animate-spin" />
                )}
                {saving ? "Saving..." : "Enter the arena"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function CompleteProfilePage() {
  return (
    <Suspense>
      <CompleteProfileForm />
    </Suspense>
  );
}
