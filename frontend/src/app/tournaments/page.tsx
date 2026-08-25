"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollText, Trophy } from "lucide-react";

import { AppShell } from "../../components/app-shell";
import { TournamentGuidelinesModal } from "../../components/tournament-guidelines-modal";

export default function TournamentsPage() {
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);

  return (
    <AppShell>
      <div className="min-h-[calc(100vh-3.5rem)] p-6 md:p-10">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <Trophy className="size-5 text-muted-foreground" aria-hidden="true" />
              <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
                Tournaments
              </h1>
              <Badge variant="secondary" className="ml-1">
                COMING SOON
              </Badge>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Tournaments are timed competitions. You solve problems and the system ranks you by
              accuracy and speed.
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              This feature is not available yet. This page shows the launch date when it is ready.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowGuidelines(true)}
            className="shrink-0 gap-2"
          >
            <ScrollText className="size-4" />
            Rules
          </Button>
        </div>

        {/* Status */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-sm font-semibold tracking-wide text-foreground">
                Status: Not Available
              </h2>
              <Badge variant="secondary" className="ml-2">
                In Development
              </Badge>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              The team builds brackets, seeding, and live view. The feature opens after tests pass.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Brackets show the match order.</li>
              <li>Seeding sets the initial rank.</li>
              <li>Live view shows current scores.</li>
            </ul>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Prize details are not final. The announcement will list prizes and dates.
            </p>
          </div>
        </div>

        {acceptedAt && (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            You accepted the guidelines on {new Date(acceptedAt).toLocaleString()}.
          </p>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Before you join a tournament, read and accept the guidelines. The app shows the
          guidelines when a tournament starts.
        </p>
      </div>

      <TournamentGuidelinesModal
        open={showGuidelines}
        tournamentName="Upcoming Tournament"
        onClose={() => setShowGuidelines(false)}
        onAccept={() => setAcceptedAt(new Date().toISOString())}
      />
    </AppShell>
  );
}
