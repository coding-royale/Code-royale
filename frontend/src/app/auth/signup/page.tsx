"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "../../../lib/supabase-browser";
import { formatOAuthError, getOAuthRedirectTo } from "../../../lib/oauth";

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
    <div className="relative min-h-screen flex items-center justify-center bg-cr-bg px-4 py-12">
      <Link
        href="/"
        className="absolute left-6 top-6 inline-flex items-center rounded-md border border-cr-border bg-cr-bg-secondary px-4 py-2.5 text-base font-semibold text-cr-fg shadow-sm transition-colors hover:border-cr-accent hover:text-cr-accent"
      >
        ← Back
      </Link>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cr-accent to-cr-accent/60">
              <span className="text-2xl font-bold text-white">CR</span>
            </div>
            <span className="text-2xl font-bold text-cr-fg">Code Royale</span>
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-cr-border bg-cr-bg-secondary p-8">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-cr-fg">Create your account</h1>
            <p className="mt-2 text-sm text-cr-fg-muted">
              Join Code Royale and start competing
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-cr-fg mb-2">
                Display Name
              </label>
              <input
                required
                placeholder="Your username"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="w-full rounded-lg border border-cr-border bg-cr-bg px-4 py-3 text-cr-fg placeholder:text-cr-fg-muted/50 focus:border-cr-accent focus:outline-none focus:ring-1 focus:ring-cr-accent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-cr-fg mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-cr-border bg-cr-bg px-4 py-3 text-cr-fg placeholder:text-cr-fg-muted/50 focus:border-cr-accent focus:outline-none focus:ring-1 focus:ring-cr-accent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-cr-fg mb-2">
                Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-cr-border bg-cr-bg px-4 py-3 text-cr-fg placeholder:text-cr-fg-muted/50 focus:border-cr-accent focus:outline-none focus:ring-1 focus:ring-cr-accent"
              />
              <p className="mt-1 text-xs text-cr-fg-muted">
                Must be at least 8 characters
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3">
                <input
                  required
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-cr-border bg-cr-bg text-cr-accent focus:ring-cr-accent"
                />
                <span className="text-sm text-cr-fg-muted">
                  I agree to the{" "}
                  <Link href="#" className="text-cr-accent hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="#" className="text-cr-accent hover:underline">
                    Privacy Policy
                  </Link>
                </span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-cr-border bg-cr-bg text-cr-accent focus:ring-cr-accent"
                />
                <span className="text-sm text-cr-fg-muted">
                  Send me updates about new features
                </span>
              </label>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-400">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={processing || !displayName || !email || !password}
              className="w-full rounded-lg bg-cr-accent py-3 font-semibold text-white transition-colors hover:bg-cr-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-cr-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-cr-bg-secondary px-4 text-cr-fg-muted">Or continue with</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={processing}
                className="flex items-center justify-center gap-2 rounded-lg border border-cr-border bg-cr-bg px-4 py-2.5 text-sm font-medium text-cr-fg hover:bg-cr-bg-tertiary transition-colors"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </button>
              <button
                type="button"
                onClick={handleGithubSignIn}
                disabled={processing}
                className="flex items-center justify-center gap-2 rounded-lg border border-cr-border bg-cr-bg px-4 py-2.5 text-sm font-medium text-cr-fg hover:bg-cr-bg-tertiary transition-colors"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub
              </button>
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-cr-fg-muted">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-cr-accent hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
