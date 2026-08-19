"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";

import { AppShell } from "../../components/app-shell";
import { TournamentGuidelinesModal } from "../../components/tournament-guidelines-modal";

export default function TournamentsPage() {
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);

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
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col items-center gap-4 px-6 py-12 text-center md:py-16">
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
            <button
              type="button"
              onClick={() => setShowGuidelines(true)}
              className="mt-2 inline-flex items-center rounded-lg border bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-secondary/80"
            >
              Preview tournament guidelines
            </button>
          </div>
        </div>

        {acceptedAt && (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Tournament guidelines accepted {new Date(acceptedAt).toLocaleString()}.
          </p>
        )}

        {/* Footer note */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          When a tournament begins, you&apos;ll be asked to review and accept the tournament
          guidelines before you can participate.
        </p>
      </div>

      {/* When a tournament begins, open this modal to gate entry until the
          user accepts the guidelines. */}
      <TournamentGuidelinesModal
        open={showGuidelines}
        tournamentName="Upcoming Tournament"
        onClose={() => setShowGuidelines(false)}
        onAccept={() => setAcceptedAt(new Date().toISOString())}
      />
    </AppShell>
  );
}
