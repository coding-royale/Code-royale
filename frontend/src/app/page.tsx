import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-cr-bg">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-cr-border bg-cr-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cr-accent to-cr-accent/60">
              <span className="text-xl font-bold text-white">CR</span>
            </div>
            <span className="text-xl font-bold text-cr-fg">Code Royale</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/auth/login" className="text-sm font-medium text-cr-fg-muted hover:text-cr-fg transition-colors">
              Sign In
            </Link>
            <Link 
              href="/auth/signup" 
              className="rounded-lg bg-cr-accent px-4 py-2 text-sm font-medium text-white hover:bg-cr-accent/90 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,_rgba(var(--cr-accent-rgb),0.15),_transparent_50%)]" />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cr-border bg-cr-bg-secondary px-4 py-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-cr-fg-muted">Beta Now Live</span>
            </div>
            <h1 className="text-5xl font-bold tracking-tight text-cr-fg md:text-6xl lg:text-7xl">
              Battle-ready coding
              <span className="block text-cr-accent">with neon intensity</span>
            </h1>
            <p className="mt-6 text-lg text-cr-fg-muted md:text-xl">
              Duel friends, climb the Royale ladder, and sharpen your reflexes in a
              futuristic arena crafted for developers.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link 
                href="/auth/signup"
                className="rounded-lg bg-cr-accent px-8 py-3 text-base font-semibold text-white shadow-lg shadow-cr-accent/25 hover:bg-cr-accent/90 transition-all hover:shadow-xl hover:shadow-cr-accent/30"
              >
                Join the Arena
              </Link>
              <Link 
                href="/game-modes"
                className="rounded-lg border border-cr-border bg-cr-bg-secondary px-8 py-3 text-base font-semibold text-cr-fg hover:bg-cr-bg-tertiary transition-colors"
              >
                Explore Modes
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-20 grid gap-6 sm:grid-cols-3">
            {[
              { value: "1v1", label: "Real-time Battles" },
              { value: "3+", label: "Game Modes" },
              { value: "∞", label: "Practice Problems" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-cr-border bg-cr-bg-secondary p-6 text-center"
              >
                <div className="text-3xl font-bold text-cr-accent">{stat.value}</div>
                <div className="mt-2 text-sm text-cr-fg-muted">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-cr-bg-secondary">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-cr-fg md:text-4xl">
              Everything you need to compete
            </h2>
            <p className="mt-4 text-cr-fg-muted">
              From quick practice sessions to intense ranked battles
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              {
                icon: (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                ),
                title: "Lightning Modes",
                description: "60-second bullet rounds, league ladders with ELO-calibrated rivals, and smart bots for practice.",
              },
              {
                icon: (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                ),
                title: "Live Telemetry",
                description: "Track your streaks, solve velocity, and performance metrics in real-time.",
              },
              {
                icon: (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                ),
                title: "Secure Sandbox",
                description: "Instant verdicts in a hardened environment. TypeScript, Python, and C++ supported.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-cr-border bg-cr-bg p-8 transition-all hover:border-cr-accent/50"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-cr-accent/10 text-cr-accent">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-cr-fg">{feature.title}</h3>
                <p className="mt-3 text-cr-fg-muted">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Game Modes Preview */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold text-cr-fg md:text-4xl">
                Built for coders who crave adrenaline
              </h2>
              <p className="mt-4 text-cr-fg-muted">
                Code Royale fuses esports presentation with rigorous assessments.
                Queue with teammates, scout rivals, and climb neon-lit leagues.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {["Real-time sockets", "Monaco editor", "Live leaderboards", "Match replays"].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-lg border border-cr-border bg-cr-bg-secondary p-4"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cr-accent/20 text-cr-accent text-sm">✓</span>
                    <span className="text-cr-fg">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cr-accent/20 to-transparent blur-2xl" />
              <div className="relative rounded-2xl border border-cr-border bg-cr-bg-secondary p-8">
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500" />
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                </div>
                <div className="space-y-3 font-mono text-sm">
                  <div className="text-cr-fg-muted">$ code-royale start</div>
                  <div className="text-green-400">✓ Connecting to arena...</div>
                  <div className="text-green-400">✓ Opponent found: @rival_coder</div>
                  <div className="text-cr-accent">⚔ Battle starting in 3...</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-cr-bg-secondary">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-cr-fg md:text-4xl">
            Ready to enter the arena?
          </h2>
          <p className="mt-4 text-cr-fg-muted">
            Join thousands of developers sharpening their skills through competitive coding.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link 
              href="/auth/signup"
              className="rounded-lg bg-cr-accent px-8 py-3 text-base font-semibold text-white shadow-lg shadow-cr-accent/25 hover:bg-cr-accent/90 transition-all"
            >
              Create Account
            </Link>
            <Link 
              href="/auth/login"
              className="rounded-lg border border-cr-border px-8 py-3 text-base font-semibold text-cr-fg hover:bg-cr-bg transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-cr-border bg-cr-bg py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cr-accent">
                <span className="text-sm font-bold text-white">CR</span>
              </div>
              <span className="font-semibold text-cr-fg">Code Royale</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-cr-fg-muted">
              <Link href="/game-modes" className="hover:text-cr-fg transition-colors">Game Modes</Link>
              <Link href="/practice" className="hover:text-cr-fg transition-colors">Practice</Link>
              <Link href="/auth/login" className="hover:text-cr-fg transition-colors">Sign In</Link>
            </div>
            <div className="text-sm text-cr-fg-muted">
              © 2024 Code Royale
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
