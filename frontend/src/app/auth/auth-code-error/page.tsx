import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We could not complete your social sign-in (Google / Microsoft /
          GitHub). The auth code may have expired &mdash; please try again. If
          it keeps failing, make sure the provider is enabled in the Supabase
          dashboard (Authentication &gt; Sign In / Providers).
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/auth/login" className="text-sm font-medium underline underline-offset-4">
            Back to sign in
          </Link>
          <Link href="/auth/signup" className="text-sm font-medium underline underline-offset-4">
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
