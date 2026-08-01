"use client";

import { AppShell } from "../../components/app-shell";

/* ── Rule sections ──────────────────────────────────────── */
const rules = [
  {
    title: "Fair Play",
    icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L18.75 4.97zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L5.25 4.97z"/></svg>,
    items: [
      "Each participant may only compete with one account per tournament. Alt accounts or shared accounts will result in immediate disqualification.",
      "All code submitted must be your own original work, written during the tournament window.",
      "The use of AI code-generation tools (e.g. ChatGPT, Copilot, or similar) to solve tournament problems is strictly prohibited.",
      "Sharing or receiving solutions, hints, or test-case information with other participants during a live tournament is not allowed.",
    ],
  },
  {
    title: "Conduct",
    icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>,
    items: [
      "Treat all participants, organizers, and spectators with respect at all times.",
      "Any form of harassment, hate speech, or toxic behavior in chat, lobbies, or forums will lead to penalties.",
      "Do not disrupt or interfere with other participants' ability to compete (e.g. spamming, DDoS, exploiting bugs).",
      "Publicly discussing or leaking tournament problems before the event officially concludes is forbidden.",
    ],
  },
  {
    title: "Scoring & Submissions",
    icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>,
    items: [
      "Problems are scored based on correctness and time of submission. Faster correct solutions rank higher.",
      "Partial credit may be awarded for solutions that pass a subset of test cases, depending on the tournament format.",
      "Submissions that attempt to exploit the judge system (e.g. hardcoding outputs, time-bomb solutions) will be invalidated.",
      "In the event of a tie, the participant with fewer total submissions (penalty) will be ranked higher.",
    ],
  },
  {
    title: "Penalties",
    icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>,
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
        <div className="mb-10 overflow-hidden rounded-xl border border-[var(--cr-border)] bg-gradient-to-br from-[rgba(var(--cr-accent-rgb),0.08)] to-transparent">
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
          </div>
        </div>

        {/* Rules */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-[var(--cr-fg)]">Tournament Rules</h2>
          <p className="mt-1 text-sm text-[var(--cr-fg-muted)]">
            Code Royale is built on fair competition. All participants must follow these rules.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {rules.map((section) => (
            <div
              key={section.title}
              className="rounded-xl border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] p-5 transition-colors hover:border-[rgba(var(--cr-accent-rgb),0.3)]"
            >
              <div className="mb-4 flex items-center gap-2">
                <span className="text-cr-accent">{section.icon}</span>
                <h3 className="text-sm font-semibold tracking-wide text-[var(--cr-fg)]">
                  {section.title}
                </h3>
              </div>
              <ul className="space-y-3">
                {section.items.map((item, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed text-[var(--cr-fg-muted)]">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--cr-accent-rgb))]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Reporting section */}
        <div className="mt-10 rounded-xl border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] p-6">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46"/></svg>
            <div>
              <h3 className="text-sm font-semibold text-[var(--cr-fg)]">Report Violations</h3>
              <p className="mt-1 text-sm leading-relaxed text-[var(--cr-fg-muted)]">
                We encourage all participants to help maintain fair competition. If you witness any
                rule-breaking behavior during a tournament, please report it through the in-game
                reporting system. Valid reports help keep Code Royale competitive and fun for everyone.
              </p>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p className="mt-8 text-center text-xs text-[var(--cr-fg-muted)]">
          Rules are subject to change. Organizers reserve the right to make final decisions on all disputes.
        </p>
      </div>
    </AppShell>
  );
}
