"use client";

import { useState } from "react";
import { tournamentGuidelines } from "../lib/tournament-guidelines";

type TournamentGuidelinesModalProps = {
  open: boolean;
  tournamentName?: string;
  onAccept: () => void;
  onClose: () => void;
};

const sectionIcons: Record<string, React.ReactNode> = {
  "Fair Play": (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L18.75 4.97zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L5.25 4.97z"/></svg>
  ),
  Conduct: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>
  ),
  "Scoring & Submissions": (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>
  ),
  Penalties: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
  ),
};

export function TournamentGuidelinesModal({
  open,
  tournamentName,
  onAccept,
  onClose,
}: TournamentGuidelinesModalProps) {
  const [accepted, setAccepted] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[var(--cr-border)] px-6 py-4">
          <svg className="h-7 w-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.015 6.015 0 01-2.52.52m0 0a6.015 6.015 0 01-2.52-.52"/></svg>
          <div>
            <h2 className="text-lg font-semibold text-[var(--cr-fg)]">Tournament Guidelines</h2>
            <p className="text-xs text-[var(--cr-fg-muted)]">
              {tournamentName ? `${tournamentName} — read carefully before joining` : "Read carefully before joining"}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[55vh] overflow-y-auto px-6 py-4">
          <p className="mb-4 text-sm leading-relaxed text-[var(--cr-fg-muted)]">
            Code Royale is built on fair competition. All participants must follow these rules.
            By accepting, you agree to be bound by them for the duration of the tournament.
          </p>

          {showDetails ? (
            <div className="space-y-4">
              {tournamentGuidelines.map((section) => (
                <div key={section.title}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-amber-400">{sectionIcons[section.title]}</span>
                    <h3 className="text-sm font-semibold tracking-wide text-[var(--cr-fg)]">
                      {section.title}
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-[var(--cr-fg-muted)]">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--cr-accent-rgb))]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="flex w-full items-center justify-between rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg)] px-4 py-3 text-sm text-[rgb(var(--cr-accent-rgb))] transition-colors hover:border-[rgba(var(--cr-accent-rgb),0.4)]"
            >
              <span>View full guidelines</span>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          )}
        </div>

        {/* Accept */}
        <div className="border-t border-[var(--cr-border)] px-6 py-4">
          <label className="mb-3 flex cursor-pointer items-start gap-3 text-sm text-[var(--cr-fg-muted)]">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[var(--cr-border)] bg-[var(--cr-bg)] text-[rgb(var(--cr-accent-rgb))] accent-[rgb(var(--cr-accent-rgb))]"
            />
            <span>
              I have read and agree to the tournament guidelines above.
            </span>
          </label>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg)] px-4 py-2 text-sm font-medium text-[var(--cr-fg)] transition-colors hover:bg-[var(--cr-bg-tertiary)]"
            >
              Not Now
            </button>
            <button
              type="button"
              disabled={!accepted}
              onClick={() => {
                onAccept();
                setAccepted(false);
                setShowDetails(false);
              }}
              className="rounded-lg bg-[rgb(var(--cr-accent-rgb))] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Accept & Proceed
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}