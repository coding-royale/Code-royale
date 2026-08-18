import Link from "next/link";
import { CheckIcon, ChevronRightIcon, SwordsIcon } from "lucide-react";

import { LinkButton } from "@/components/ui/link-button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

const feedLines = [
  { text: "> Searching for an opponent…", muted: true },
  { text: "> Found: @shadow_coder · rating 1420", muted: true },
  { text: "> Match found — get ready!", muted: true },
  { text: "> Round 1 begins in 3…", muted: false },
];

const features = [
  {
    title: "Duel head-to-head",
    description:
      "Go 1v1 against friends or rivals in ranked matches. First correct submission wins — speed and accuracy decide who takes the rating.",
    href: "/game-modes",
    link: "Enter the duel",
  },
  {
    title: "Climb by rating",
    description:
      "Every win folds you higher on the ladder. Watch your rating move on the live leaderboard and chase the top of the sheet.",
    href: "/leaderboard",
    link: "Read the ladder",
  },
  {
    title: "Practice to get faster",
    description:
      "Warm up on a problem library that levels with you. The more you solve, the sharper — and faster — you get.",
    href: "/practice",
    link: "Open the practice arena",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero: the match sheet deploys on the night desk */}
      <section className="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-28">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Think fast.
              <span className="block text-muted-foreground">Code faster.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Code Royale is a real-time coding battleground. Duel your
              friends, smash the leaderboard, and prove you&apos;re the
              sharpest coder in the room — one keystroke at a time.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <LinkButton size="lg" href="/auth/signup">
                Start Playing
              </LinkButton>
              <LinkButton variant="outline" size="lg" href="/game-modes">
                See Game Modes
              </LinkButton>
            </div>
          </div>

          {/* The deployed sheet */}
          <div className="relative mx-auto mt-16 max-w-3xl">
            <div
              aria-hidden="true"
              className="absolute -inset-x-8 top-1/2 -z-10 h-40 -translate-y-1/2 bg-gradient-to-r from-transparent via-accent/10 to-transparent"
            />
            <Card className="sheet-deploy parallelogram shadow-xl">
              <CardContent className="flex flex-col gap-4 p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <SwordsIcon className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Ranked Duel
                      </p>
                      <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                        sheet 01 · 1v1 · rating ±32
                      </p>
                    </div>
                  </div>
                  <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
                    DEMO FEED · EST. 45s
                  </span>
                </div>

                <div className="flex flex-col gap-2 rounded-lg bg-muted p-4 font-mono text-sm">
                  {feedLines.map((line, index) => (
                    <div
                      key={index}
                      className={
                        line.muted ? "text-muted-foreground" : "text-foreground"
                      }
                    >
                      {line.text}
                    </div>
                  ))}
                  <LinkButton
                    href="/game-modes"
                    className="mt-2 self-start bg-primary-plate text-primary-foreground shadow-sm shadow-black/20 hover:bg-primary"
                  >
                    GO!
                  </LinkButton>
                </div>
              </CardContent>
            </Card>
            {/* crease labels */}
            <div className="pointer-events-none absolute -bottom-3 left-6 hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:block">
              M-01 · V-02 · R-03
            </div>
          </div>
        </div>
      </section>

      {/* Features: cells of the same sheet */}
      <section className="relative border-y border-border bg-muted/20 py-20">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="max-w-2xl">
            <h2 className="fold-rule text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              One sheet. Every way to win.
            </h2>
            <p className="mt-6 text-muted-foreground">
              Queue up solo, squad up with friends, or grind the practice
              arena to sharpen your edge. Every mode is a fold of the same
              sheet.
            </p>
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <CardContent className="flex flex-col gap-4 p-6">
                  <h3 className="text-xl font-semibold tracking-tight text-foreground">
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                  <Link
                    href={feature.href}
                    className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/70"
                  >
                    {feature.link}
                    <ChevronRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="get-started" className="relative py-20">
        <div className="mx-auto w-full max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
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
            <LinkButton variant="outline" size="lg" href="/auth/login">
              Sign In
            </LinkButton>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <span className="parallelogram-sm flex size-8 items-center justify-center bg-accent text-sm font-bold text-accent-foreground">
              CR
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
          <div className="flex items-center gap-3">
            <CheckIcon className="size-3.5 text-primary" />
            <span className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Code Royale
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
