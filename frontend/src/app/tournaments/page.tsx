"use client";

import { AppShell } from "../../components/app-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gavel, ShieldAlert, ShieldCheck, Trophy, Users } from "lucide-react";

/* ── Rule sections ──────────────────────────────────────── */
const rules = [
  {
    title: "Fair Play",
    icon: <ShieldCheck className="size-5" />,
    items: [
      "Each participant may only compete with one account per tournament. Alt accounts or shared accounts will result in immediate disqualification.",
      "All code submitted must be your own original work, written during the tournament window.",
      "The use of AI code-generation tools (e.g. ChatGPT, Copilot, or similar) to solve tournament problems is strictly prohibited.",
      "Sharing or receiving solutions, hints, or test-case information with other participants during a live tournament is not allowed.",
    ],
  },
  {
    title: "Conduct",
    icon: <Users className="size-5" />,
    items: [
      "Treat all participants, organizers, and spectators with respect at all times.",
      "Any form of harassment, hate speech, or toxic behavior in chat, lobbies, or forums will lead to penalties.",
      "Do not disrupt or interfere with other participants' ability to compete (e.g. spamming, DDoS, exploiting bugs).",
      "Publicly discussing or leaking tournament problems before the event officially concludes is forbidden.",
    ],
  },
  {
    title: "Scoring & Submissions",
    icon: <Trophy className="size-5" />,
    items: [
      "Problems are scored based on correctness and time of submission. Faster correct solutions rank higher.",
      "Partial credit may be awarded for solutions that pass a subset of test cases, depending on the tournament format.",
      "Submissions that attempt to exploit the judge system (e.g. hardcoding outputs, time-bomb solutions) will be invalidated.",
      "In the event of a tie, the participant with fewer total submissions (penalty) will be ranked higher.",
    ],
  },
  {
    title: "Penalties",
    icon: <Gavel className="size-5" />,
    items: [
      "First violation: Tournament score is nullified and a temporary ban from future tournaments (duration at organizer discretion).",
      "Second violation: Permanent ban from all Code Royale tournaments and potential account suspension.",
      "Organizers reserve the right to investigate suspicious activity and issue penalties retroactively.",
    ],
  },
];

/* ── Component ──────────────────────────────────────────── */
export default function TournamentsPage() {
  return (
    <AppShell>
      <div className="min-h-[calc(100vh-3.5rem)] p-6 md:p-10">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Trophy className="size-6" />
            </div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
              Tournaments
            </h1>
            <Badge variant="secondary" className="ml-1">COMING SOON</Badge>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Organized competitive events where players battle it out for glory and bragging rights.
            Tournaments are currently under development — stay tuned for launch announcements!
          </p>
        </div>

        {/* Coming Soon banner */}
        <div className="mb-10 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="hero-glow flex flex-col items-center gap-4 px-6 py-12 text-center md:py-16">
            <div className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Trophy className="size-7" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              Tournaments are on the way!
            </h2>
            <p className="max-w-lg text-sm text-muted-foreground">
              We&apos;re building a fully-featured tournament system with brackets, seeding, and
              live spectating. Prizes haven&apos;t been decided yet — we&apos;ll announce
              details once everything is finalized.
            </p>
            <Badge variant="secondary" className="gap-2 px-4 py-1.5">
              <span className="size-2 animate-pulse rounded-full bg-accent-foreground" />
              In Development
            </Badge>
          </div>
        </div>

        {/* Rules */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground">Tournament Rules</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Code Royale is built on fair competition. All participants must follow these rules.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {rules.map((section) => (
            <Card key={section.title} className="shadow-sm transition-all hover:shadow-md">
              <CardHeader className="flex-row items-center gap-2">
                <span className="text-primary">{section.icon}</span>
                <CardTitle className="text-sm font-semibold tracking-wide">
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-3">
                  {section.items.map((item, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Reporting section */}
        <Alert className="mt-10">
          <ShieldAlert className="size-5" />
          <AlertTitle>Report Violations</AlertTitle>
          <AlertDescription>
            We encourage all participants to help maintain fair competition. If you witness any
            rule-breaking behavior during a tournament, please report it through the in-game
            reporting system. Valid reports help keep Code Royale competitive and fun for everyone.
          </AlertDescription>
        </Alert>

        {/* Footer note */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Rules are subject to change. Organizers reserve the right to make final decisions on all disputes.
        </p>
      </div>
    </AppShell>
  );
}
