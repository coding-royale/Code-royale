import Link from "next/link";
import { CheckIcon, SwordsIcon, TargetIcon, TrophyIcon } from "lucide-react";

import { LinkButton } from "@/components/ui/link-button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    icon: SwordsIcon,
    title: "Duel Your Friends",
    description:
      "Go head-to-head in lightning 1v1 battles or jump into chaotic 4-player brawls. Winner takes the bragging rights.",
  },
  {
    icon: TrophyIcon,
    title: "Climb the Ranks",
    description:
      "Every win pushes you up the Royale ladder. Watch your rating climb on the live leaderboard and chase the top spot.",
  },
  {
    icon: TargetIcon,
    title: "Practice to Get Faster",
    description:
      "Warm up with practice problems that level with you. The more you play, the sharper — and faster — you get.",
  },
];

const checklist = [
  "1v1 duels",
  "4-player brawls",
  "Live leaderboards",
  "Practice arena",
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero */}
      <section className="hero-glow pt-32 pb-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-5xl font-semibold tracking-tight text-foreground md:text-6xl lg:text-7xl">
              Think fast.
              <span className="block text-muted-foreground">Code faster.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
              Code Royale is a real-time coding battleground. Duel your friends,
              smash the leaderboard, and prove you&apos;re the sharpest coder in
              the room — one keystroke at a time.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <LinkButton size="lg" href="/auth/signup">
                Start Playing
              </LinkButton>
              <LinkButton
                variant="outline"
                size="lg"
                href="/game-modes"
              >
                See Game Modes
              </LinkButton>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              One arena. Every way to win.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Queue up solo, squad up with friends, or grind the practice arena
              to sharpen your edge.
            </p>
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <CardHeader>
                  <div className="mb-1 flex size-12 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <feature.icon />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Match preview */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                Every match is a test of speed and smarts
              </h2>
              <p className="mt-4 text-muted-foreground">
                Jump straight into a battle — no setup, no waiting. Read the
                prompt, write the solution, and hit submit before the clock
                runs out.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {checklist.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4 shadow-sm"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <CheckIcon />
                    </span>
                    <span className="text-sm text-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="rounded-xl border border-border bg-card shadow-lg">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <span className="size-3 rounded-full bg-muted-foreground/30" />
                  <span className="size-3 rounded-full bg-muted-foreground/30" />
                  <span className="size-3 rounded-full bg-muted-foreground/30" />
                </div>
                <div className="flex flex-col gap-3 p-6 font-mono text-sm">
                  <div className="text-muted-foreground">
                    &gt; Searching for an opponent...
                  </div>
                  <div className="text-muted-foreground">
                    &gt; Found: @shadow_coder · rating 1420
                  </div>
                  <div className="text-muted-foreground">
                    &gt; Match found — get ready!
                  </div>
                  <div className="text-foreground">
                    &gt; Round 1 begins in 3...
                  </div>
                  <div className="text-lg font-semibold text-accent-foreground">
                    GO!
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        id="get-started"
        className="border-t border-border bg-muted/30 py-20"
      >
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Your first duel is one click away
          </h2>
          <p className="mt-4 text-muted-foreground">
            Create a free account and step into the arena. No setup, no
            waiting — just you versus the best.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <LinkButton size="lg" href="/auth/signup">
              Create Account
            </LinkButton>
            <LinkButton
              variant="outline"
              size="lg"
              href="/auth/login"
            >
              Sign In
            </LinkButton>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-muted ring-1 ring-foreground/10">
              <span className="text-sm font-bold text-foreground">CR</span>
            </span>
            <span className="font-semibold text-foreground">Code Royale</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link
              href="/game-modes"
              className="transition-colors hover:text-foreground"
            >
              Game Modes
            </Link>
            <Link
              href="/practice"
              className="transition-colors hover:text-foreground"
            >
              Practice
            </Link>
            <Link
              href="/auth/login"
              className="transition-colors hover:text-foreground"
            >
              Sign In
            </Link>
          </div>
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Code Royale
          </div>
        </div>
      </footer>
    </div>
  );
}
