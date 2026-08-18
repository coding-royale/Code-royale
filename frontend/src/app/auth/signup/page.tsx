"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2Icon, Loader2Icon } from "lucide-react";

import { supabase } from "../../../lib/supabase-browser";
import { formatOAuthError, getOAuthRedirectTo } from "../../../lib/oauth";
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
import { Separator } from "@/components/ui/separator";

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProcessing(true);
    setError(null);
    setSuccess(null);

    let authData: Awaited<ReturnType<typeof supabase.auth.signUp>>["data"];
    let authError: Awaited<ReturnType<typeof supabase.auth.signUp>>["error"];
    try {
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      });
      authData = result.data;
      authError = result.error;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        message.toLowerCase().includes("failed to fetch")
          ? "Cannot reach Supabase (network/CORS). Verify NEXT_PUBLIC_SUPABASE_URL is correct/https, and that your Supabase project is reachable."
          : message,
      );
      setProcessing(false);
      return;
    }

    if (authError) {
      setError(authError.message);
      setProcessing(false);
      return;
    }

    const hasSession = Boolean(authData.session);

    if (!hasSession) {
      setError(
        "Account was created but no active session was returned. Disable email confirmation in Supabase (Authentication -> Providers -> Email -> Confirm email OFF) to allow instant signup.",
      );
      setProcessing(false);
      return;
    }

    setSuccess("Account ready. Redirecting to your dashboard...");

    setProcessing(false);

    if (authData.session) {
      setTimeout(() => router.push("/home"), 1200);
    }
  };

  const handleGoogleSignIn = async () => {
    setProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getOAuthRedirectTo(),
        },
      });

      if (authError) {
        setError(authError.message);
        setProcessing(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        message.toLowerCase().includes("failed to fetch")
          ? "Cannot reach Supabase (network/CORS). Verify NEXT_PUBLIC_SUPABASE_URL is correct/https, and that your Supabase project is reachable."
          : message,
      );
      setProcessing(false);
    }
  };

  const handleGithubSignIn = async () => {
    setProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: getOAuthRedirectTo(),
        },
      });

      if (error) {
        setError(formatOAuthError(error.message, "GitHub"));
        setProcessing(false);
        return;
      }

      // On success, supabase-js redirects the browser to the provider automatically.
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(formatOAuthError(message, "GitHub"));
      setProcessing(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-24">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Link href="/" className="flex items-center gap-3">
            <span className="parallelogram-sm flex size-12 items-center justify-center overflow-hidden bg-accent shadow-sm shadow-black/10">
              <Image
                src="/images/logo-icon.svg"
                alt="Code Royale logo"
                width={48}
                height={48}
                className="object-contain p-2"
              />
            </span>
            <span className="text-2xl font-semibold tracking-tight text-foreground">
              Code Royale
            </span>
          </Link>
        </div>

        {/* Card */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Create your account</CardTitle>
            <CardDescription>
              Join Code Royale and start competing
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  required
                  placeholder="Your username"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <label className="flex items-start gap-3">
                  <input
                    required
                    type="checkbox"
                    className="mt-0.5 size-4 rounded-sm border-input accent-foreground"
                  />
                  <span className="text-sm text-muted-foreground">
                    I agree to the{" "}
                    <Link
                      href="#"
                      className="font-medium text-foreground transition-colors hover:text-muted-foreground"
                    >
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link
                      href="#"
                      className="font-medium text-foreground transition-colors hover:text-muted-foreground"
                    >
                      Privacy Policy
                    </Link>
                  </span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-4 rounded-sm border-input accent-foreground"
                  />
                  <span className="text-sm text-muted-foreground">
                    Send me updates about new features
                  </span>
                </label>
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

              <Button
                type="submit"
                className="w-full"
                disabled={processing || !displayName || !email || !password}
              >
                {processing && (
                  <Loader2Icon data-icon="inline-start" className="animate-spin" />
                )}
                {processing ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">
                Or continue with
              </span>
              <Separator className="flex-1" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleSignIn}
                disabled={processing}
              >
                <svg className="size-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleGithubSignIn}
                disabled={processing}
              >
                <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub
              </Button>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="font-medium text-foreground transition-colors hover:text-muted-foreground"
              >
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
