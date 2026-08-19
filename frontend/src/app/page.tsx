import Link from "next/link";
import Image from "next/image";
import { CheckIcon, SwordsIcon, TargetIcon, TrophyIcon } from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase";
import { LinkButton } from "@/components/ui/link-button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Hero background. Flickr serves only the 6k original for this photo;
// next/image re-serves it at the viewport's actual width and quality.
const HERO_IMAGE =
  "https://live.staticflickr.com/8497/8308573411_7d12b44e12_6k.jpg";
const HERO_IMAGE_BLUR =
  "data:image/jpeg;base64,/9j/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAQABgDASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAABQAEBv/EAB8QAAIBBAMBAQAAAAAAAAAAAAEDAgAEESESIkFRE//EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwDjKTQmbxGKh0jjJPu90cqPJkY/TTdlaPu4cZSCl9SB8wc0GS4StS5hMxPgczHoqpK4tU2ynNA/SbNziToDPlVB/9k=";

const features = [
  {
    icon: SwordsIcon,
    title: "Duel Your Friends",
    description:
      "Fight head-to-head in 1v1 duels or join 4-player brawls. The winner takes the bragging rights.",
  },
  {
    icon: TrophyIcon,
    title: "Climb the Ranks",
    description:
      "Every win moves you up the Royale ladder. The live leaderboard shows your rating. Aim for the top spot.",
  },
  {
    icon: TargetIcon,
    title: "Practice to Get Faster",
    description:
      "Warm up with practice problems that match your level. The more you play, the faster you get.",
  },
];

const checklist = [
  "1v1 duels",
  "4-player brawls",
  "Live leaderboards",
  "Practice arena",
];

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const isSignedIn = Boolean(authData.user);

  return (
    <div className="h-dvh snap-y snap-mandatory overflow-y-auto">
      {/* Hero */}
      <section className="relative flex min-h-dvh snap-start snap-always flex-col justify-center overflow-hidden bg-black">
        <Image
          src={HERO_IMAGE}
          alt=""
          fill
          priority
          sizes="100vw"
          placeholder="blur"
          blurDataURL={HERO_IMAGE_BLUR}
          className="object-cover object-left"
        />
        {/* Scrim: keeps the left text zone readable over any part of the image */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />
        <div className="relative mx-auto w-full max-w-7xl px-6 py-16">
          <div className="max-w-md text-left">
            <h1 className="font-heading text-5xl font-semibold tracking-tight text-white md:text-6xl">
              Think fast.
              <span className="block text-white/70">Code faster.</span>
            </h1>
            <p className="mt-6 text-lg text-white/70 md:text-xl">
              Multiplayer game where you program to kill.
            </p>
            <div className="mt-12 flex flex-wrap items-center gap-5">
              <LinkButton
                size="lg"
                href={isSignedIn ? "/home" : "/auth/signup"}
                className="h-12 rounded-xl bg-white px-8 text-base font-semibold text-black hover:bg-white/85"
              >
                {isSignedIn ? "Enter Arena" : "Start Playing"}
              </LinkButton>
              <LinkButton
                variant="outline"
                size="lg"
                href="/game-modes"
                className="h-12 rounded-xl border-white/30 px-8 text-base font-semibold text-white hover:bg-white/10"
              >
                See Game Modes
              </LinkButton>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="flex min-h-dvh snap-start snap-always flex-col justify-center border-y border-border bg-muted/30 py-16">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="text-center">
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              One arena. Every way to win.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Play solo. Play with friends. Train in the practice arena.
            </p>
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-3">
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
      <section className="flex min-h-dvh snap-start snap-always flex-col justify-center py-16">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="font-heading text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                Every match tests speed and smarts
              </h2>
              <p className="mt-4 text-muted-foreground">
                Start a battle in seconds. No setup. No waiting. Read the
                prompt. Write the solution. Submit before the clock runs out.
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
                  <span className="ml-auto font-mono text-xs tracking-[0.15em] text-muted-foreground">
                    MATCH · 0x4A3F
                  </span>
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
        className="flex min-h-dvh snap-start snap-always flex-col justify-center border-t border-border bg-muted/30 py-16"
      >
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {isSignedIn
              ? "Your next duel starts now"
              : "Start your first duel with one click"}
          </h2>
          <p className="mt-4 text-muted-foreground">
            {isSignedIn
              ? "No setup. No waiting. You versus the best."
              : "Create a free account. Enter the arena. No setup. No waiting. You versus the best."}
          </p>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-5">
            {isSignedIn ? (
              <>
                <LinkButton
                  size="lg"
                  href="/home"
                  className="h-12 rounded-xl px-8 text-base font-semibold"
                >
                  Enter Arena
                </LinkButton>
                <LinkButton
                  variant="outline"
                  size="lg"
                  href="/practice"
                  className="h-12 rounded-xl px-8 text-base font-semibold"
                >
                  Practice
                </LinkButton>
              </>
            ) : (
              <>
                <LinkButton
                  size="lg"
                  href="/auth/signup"
                  className="h-12 rounded-xl px-8 text-base font-semibold"
                >
                  Create Account
                </LinkButton>
                <LinkButton
                  variant="outline"
                  size="lg"
                  href="/auth/login"
                  className="h-12 rounded-xl px-8 text-base font-semibold"
                >
                  Sign In
                </LinkButton>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="snap-start snap-always border-t border-border py-12">
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
              href={isSignedIn ? "/home" : "/auth/login"}
              className="transition-colors hover:text-foreground"
            >
              {isSignedIn ? "Dashboard" : "Sign In"}
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
