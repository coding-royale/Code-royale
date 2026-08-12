"use client";

import { ReactNode, useState } from "react";

import { HomeNav } from "../home/home-nav";

const sidebarLinks = [
  {
    id: "daily-quest",
    title: "Daily Quest",
    subtitle: "Tackle today's featured challenge and earn bonus XP.",
  },
  {
    id: "leaderboard",
    title: "Leaderboard",
    subtitle: "See who's dominating the arena this week.",
  },
  {
    id: "streak",
    title: "Your Streak",
    subtitle: "Keep the momentum - don't break your practice chain.",
  },
  {
    id: "workshop",
    title: "Tactics Workshop",
    subtitle: "Replay curated patterns to sharpen fundamentals.",
  },
  {
    id: "profile",
    title: "Profile",
    subtitle: "Review your match history and cosmetics.",
    href: "/profile",
  },
  {
    id: "friends",
    title: "Friends",
    subtitle: "Search players and manage connections.",
    href: "/friends",
  },
  {
    id: "settings",
    title: "Settings",
    subtitle: "Update account preferences and theme.",
    href: "/settings",
  },
  {
    id: "join-team",
    title: "Join club/team",
    subtitle: "Find a squad to represent in the arena.",
    href: "/team",
  },
];

type PracticeScaffoldProps = {
  children: ReactNode;
  defaultSidebarOpen?: boolean;
};

type PracticeSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  onCollapse: () => void;
};

export function PracticeScaffold({ children, defaultSidebarOpen = false }: PracticeScaffoldProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(defaultSidebarOpen);
  const openSidebar = () => setIsSidebarOpen(true);
  const closeSidebar = () => setIsSidebarOpen(false);
  const toggleSidebar = () => setIsSidebarOpen((current) => !current);
  const mainPaddingClass = isSidebarOpen ? "lg:pl-[18rem]" : "lg:pl-0";

  return (
    <div className="relative min-h-screen bg-[var(--cr-bg)] text-[var(--cr-fg)]">
      <HomeNav
        onMenuToggle={toggleSidebar}
        sidebarOpen={isSidebarOpen}
      />
      <PracticeSidebar
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
        onCollapse={closeSidebar}
      />
      {!isSidebarOpen && <CollapsedSidebarHandle onToggle={openSidebar} />}
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
        />
      )}
      <main
        className={`relative z-30 flex min-h-screen w-full flex-col transition-[padding-left] duration-300 ease-out ${mainPaddingClass}`}
      >
        <div className="flex w-full flex-1 flex-col gap-8 px-0 pb-16 pt-24">
          {children}
        </div>
      </main>
    </div>
  );
}

function PracticeSidebar({ isOpen, onClose, onCollapse }: PracticeSidebarProps) {
  return (
    <aside
      className={`fixed left-0 top-24 z-50 flex h-[calc(100vh-6rem)] w-72 flex-col gap-6 border-r border-[var(--cr-border)] bg-[var(--cr-bg-secondary)]/95 p-6 backdrop-blur-xl transition-transform duration-300 ease-out lg:top-28 lg:h-[calc(100vh-7rem)] ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[var(--cr-fg-muted)]">
        <span>More</span>
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={onClose}
          className="rounded-lg border border-[var(--cr-border)] px-2 py-1 text-[10px] text-[var(--cr-fg-muted)] transition hover:border-[rgba(var(--cr-accent-rgb),0.5)] hover:text-[var(--cr-fg)] lg:hidden"
        >
          Close
        </button>
      </div>
      <nav className="flex flex-1 flex-col gap-3 overflow-y-auto">
        {sidebarLinks.map((link) => {
          const inner = (
            <div className="flex flex-col">
              <div className="text-sm font-semibold text-[var(--cr-fg)]">
                {link.title}
              </div>
              <p className="mt-1 text-xs text-[var(--cr-fg-muted)]">{link.subtitle}</p>
            </div>
          );

          if (link.href) {
            return (
              <a
                key={link.id}
                href={link.href}
                onClick={onClose}
                className="rounded-xl border border-[var(--cr-border)] bg-[var(--cr-bg)] p-4 text-left transition hover:border-[rgba(var(--cr-accent-rgb),0.4)]"
              >
                {inner}
              </a>
            );
          }

          return (
            <button
              key={link.id}
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--cr-border)] bg-[var(--cr-bg)] p-4 text-left transition hover:border-[rgba(var(--cr-accent-rgb),0.4)]"
            >
              {inner}
            </button>
          );
        })}
      </nav>
      {isOpen && (
        <button
          type="button"
          aria-label="Collapse sidebar"
          onClick={onCollapse}
          className="absolute right-[-22px] top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] text-[var(--cr-fg-muted)] transition hover:border-[rgba(var(--cr-accent-rgb),0.6)] hover:text-[var(--cr-fg)] lg:flex"
        >
          <ChevronIcon direction="collapse" />
        </button>
      )}
    </aside>
  );
}

function CollapsedSidebarHandle({ onToggle }: { onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label="Open sidebar"
      onClick={onToggle}
      className="fixed left-0 top-1/2 z-40 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-r-full border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] text-[var(--cr-fg-muted)] transition hover:border-[rgba(var(--cr-accent-rgb),0.6)] hover:text-[var(--cr-fg)]"
    >
      <ChevronIcon direction="expand" />
    </button>
  );
}

function ChevronIcon({ direction }: { direction: "expand" | "collapse" }) {
  const rotation = direction === "collapse" ? "rotate-180" : "rotate-0";

  return (
    <svg
      className={`h-5 w-5 text-[var(--cr-fg-muted)] transition ${rotation}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
