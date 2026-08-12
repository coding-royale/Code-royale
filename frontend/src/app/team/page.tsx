"use client";

import { PracticeScaffold } from "../practice/practice-scaffold";

export default function TeamPage() {
  return (
    <PracticeScaffold defaultSidebarOpen>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 pt-8 sm:px-10 lg:px-16">
        <header className="rounded-xl border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--cr-fg-muted)]">
            Clubs &amp; Teams
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-[var(--cr-fg)] sm:text-5xl">
            Join club/team
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-[var(--cr-fg-muted)]">
            Team features are not wired yet. This page is the placeholder entry point for joining or creating a team.
          </p>
        </header>

        <section className="rounded-xl border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] p-8 text-sm text-[var(--cr-fg-muted)]">
          Add team browsing / invitations here once the Supabase tables are ready.
        </section>
      </div>
    </PracticeScaffold>
  );
}
