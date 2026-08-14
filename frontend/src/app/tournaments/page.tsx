"use client";

import { useState } from "react";
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
            <svg className="h-7 w-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.015 6.015 0 01-2.52.52m0 0a6.015 6.015 0 01-2.52-.52"/></svg>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--cr-fg)]">
              Tournaments
            </h1>
            <span className="ml-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-0.5 text-xs font-semibold tracking-wider text-amber-400">
              COMING SOON
            </span>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--cr-fg-muted)]">
            Organized competitive events where players battle it out for glory and bragging rights.
            Tournaments are currently under development — stay tuned for launch announcements!
          </p>
        </div>

        {/* Coming Soon banner */}
        <div className="overflow-hidden rounded-xl border border-[var(--cr-border)] bg-gradient-to-br from-[rgba(var(--cr-accent-rgb),0.08)] to-transparent">
          <div className="flex flex-col items-center gap-4 px-6 py-12 text-center md:py-16">
            <svg className="h-12 w-12 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1-3.4a1 1 0 010-1.66l5.1-3.4a1 1 0 011.08 0l5.1 3.4a1 1 0 010 1.66l-5.1 3.4a1 1 0 01-1.08 0zM12 12v9m-3.75-5.25l3.75 2.25 3.75-2.25"/></svg>
            <h2 className="text-xl font-semibold text-[var(--cr-fg)]">
              Tournaments are on the way!
            </h2>
            <p className="max-w-lg text-sm text-[var(--cr-fg-muted)]">
              We&apos;re building a fully-featured tournament system with brackets, seeding, and
              live spectating. Prizes haven&apos;t been decided yet — we&apos;ll announce
              details once everything is finalized.
            </p>
            <div className="mt-2 flex items-center gap-2 rounded-full border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] px-5 py-2 text-xs font-medium text-[var(--cr-fg-muted)]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
              In Development
            </div>
            <button
              type="button"
              onClick={() => setShowGuidelines(true)}
              className="mt-2 rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] px-4 py-2 text-sm font-medium text-[var(--cr-fg)] transition-colors hover:border-[rgba(var(--cr-accent-rgb),0.4)] hover:text-[rgb(var(--cr-accent-rgb))]"
            >
              Preview tournament guidelines
            </button>
          </div>
        </div>

        {acceptedAt && (
          <p className="mt-6 text-center text-xs text-[var(--cr-fg-muted)]">
            Tournament guidelines accepted {new Date(acceptedAt).toLocaleString()}.
          </p>
        )}

        {/* Footer note */}
        <p className="mt-8 text-center text-xs text-[var(--cr-fg-muted)]">
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
