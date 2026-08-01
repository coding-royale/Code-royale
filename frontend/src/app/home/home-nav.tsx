"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const menuItems = [
  { label: "Game Modes", href: "/game-modes" },
  { label: "Tournaments", href: "#tournaments" },
  { label: "Practice Arena", href: "/practice" },
  { label: "Profile", href: "/profile" },
];

type HomeNavProps = {
  onMenuToggle?: () => void;
  sidebarOpen?: boolean;
};

export function HomeNav({ onMenuToggle, sidebarOpen = false }: HomeNavProps) {
  const [isHidden, setIsHidden] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const lastScrollRef = useRef(0);
  const hoveringRef = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY;
      const last = lastScrollRef.current;

      if (current > last && current > 64 && !hoveringRef.current) {
        setIsHidden(true);
      } else if (current < last || current <= 64) {
        setIsHidden(false);
      }

      lastScrollRef.current = current;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleMouseEnter = () => {
    hoveringRef.current = true;
    setIsHovering(true);
    setIsHidden(false);
  };

  const handleMouseLeave = () => {
    hoveringRef.current = false;
    setIsHovering(false);
    if (window.scrollY > 80) {
      setIsHidden(true);
    }
  };

  const visibilityClass = isHidden && !isHovering
    ? "-translate-y-full opacity-0 pointer-events-none"
    : "translate-y-0 opacity-100 pointer-events-auto";

  return (
    <>
      <div
        className="fixed left-0 right-0 top-0 z-[70] h-6"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
      <header
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`fixed left-0 right-0 top-0 z-[65] transition-all duration-300 ease-out ${visibilityClass}`}
      >
        <div className="border-b border-[rgba(var(--cr-accent-rgb),0.12)] bg-[#05070f]/95 shadow-[0_12px_45px_rgba(5,12,28,0.55)] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-6 px-6 py-4 md:px-8">
            <div className="flex items-center gap-5">
              {onMenuToggle && (
                <button
                  type="button"
                  aria-label="Toggle sidebar"
                  onClick={onMenuToggle}
                  aria-pressed={sidebarOpen}
                  className={`flex items-center gap-2 rounded-xl border bg-[#070d18] px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] transition shadow-[0_0_20px_rgba(var(--cr-accent-rgb),0.2)] hover:border-[rgba(var(--cr-accent-rgb),0.6)] hover:text-sky-100 ${
                    sidebarOpen
                      ? "border-[rgba(var(--cr-accent-rgb),0.6)] text-sky-100"
                      : "border-[rgba(var(--cr-accent-rgb),0.25)] text-[rgba(var(--cr-accent-rgb),0.8)]"
                  }`}
                >
                  {sidebarOpen ? <CloseIcon /> : <MenuIcon />}
                  <span className="hidden sm:inline">Menu</span>
                </button>
              )}
              <Link href="/home" className="group inline-flex items-center gap-3">
                <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[rgba(var(--cr-accent-rgb),0.50)] bg-slate-900/80 shadow-[0_0_24px_rgba(var(--cr-accent-rgb),0.40)] transition group-hover:border-[rgba(var(--cr-accent-rgb),0.75)] group-hover:shadow-[0_0_32px_rgba(var(--cr-accent-rgb),0.55)]">
                  <Image
                    src="/images/logo-icon.svg"
                    alt="Code Royale logo"
                    fill
                    className="object-contain p-0.5"
                    sizes="40px"
                    priority
                  />
                </span>
                <span className="text-lg font-semibold tracking-[0.28em] text-sky-100 group-hover:text-[rgba(var(--cr-accent-rgb),0.85)]">
                  CODE ROYALE
                </span>
              </Link>
            </div>

            <form className="ml-6 hidden min-w-[220px] flex-1 items-center gap-2 rounded-full border border-[rgba(var(--cr-accent-rgb),0.15)] bg-[#070d18] px-4 py-2 text-sm text-sky-100/75 lg:flex">
              <label htmlFor="player-search" className="sr-only">
                Search players or friends
              </label>
              <SearchIcon />
              <input
                id="player-search"
                type="search"
                placeholder="Search players or friends"
                className="w-full bg-transparent text-sky-100 placeholder:text-[rgba(var(--cr-accent-rgb),0.45)] focus:outline-none"
              />
            </form>

            <nav className="ml-auto flex items-center gap-6 text-sm font-semibold text-sky-100/80">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group relative px-1 py-1 transition-colors hover:text-sky-100"
                >
                  <span className="absolute inset-x-0 -bottom-2 h-[2px] w-full origin-center scale-x-0 bg-[rgba(var(--cr-accent-rgb),0.80)] transition-transform duration-200 group-hover:scale-x-100" />
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="ml-6 flex items-center gap-3 text-sky-100/70">
              <button
                type="button"
                aria-label="Search (mobile)"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(var(--cr-accent-rgb),0.15)] bg-[#070d18] lg:hidden"
              >
                <SearchIcon />
              </button>
              <button
                type="button"
                aria-label="Notifications"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(var(--cr-accent-rgb),0.15)] bg-[#070d18] hover:border-[rgba(var(--cr-accent-rgb),0.40)] hover:text-sky-100"
              >
                <BellIcon />
              </button>
              <a
                href="/settings"
                aria-label="Settings"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(var(--cr-accent-rgb),0.15)] bg-[#070d18] hover:border-[rgba(var(--cr-accent-rgb),0.40)] hover:text-sky-100"
              >
                <GearIcon />
              </a>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

const SearchIcon = () => (
  <svg
    aria-hidden
    className="h-4 w-4 text-[rgba(var(--cr-accent-rgb),0.75)]"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-3.6-3.6" />
  </svg>
);

const BellIcon = () => (
  <svg
    aria-hidden
    className="h-4 w-4 text-[rgba(var(--cr-accent-rgb),0.70)]"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M12 3a5 5 0 0 0-5 5v3.764c0 .597-.214 1.176-.603 1.628L5.25 15.75h13.5l-1.147-1.358A2.5 2.5 0 0 1 17 11.764V8a5 5 0 0 0-5-5Z" />
    <path d="M9.5 18a2.5 2.5 0 0 0 5 0" />
  </svg>
);

const GearIcon = () => (
  <svg
    aria-hidden
    className="h-4 w-4 text-[rgba(var(--cr-accent-rgb),0.70)]"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    <path d="M20.12 12a2.1 2.1 0 0 0-.042-.41l1.74-1.34-1.5-2.598-2.046.404a2.1 2.1 0 0 0-.71-.41l-.597-2.03H14.67l-.596 2.03a2.1 2.1 0 0 0-.71.41l-2.047-.404-1.5 2.598 1.74 1.34a2.1 2.1 0 0 0 0 .82l-1.74 1.34 1.5 2.598 2.047-.403c.2.172.44.31.71.41l.596 2.03h2.78l.597-2.03c.27-.1.51-.238.71-.41l2.046.403 1.5-2.598-1.74-1.34c.029-.134.042-.27.042-.41Z" />
  </svg>
);

const MenuIcon = () => (
  <svg
    aria-hidden
    className="h-5 w-5 text-current"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M4 6h16" />
    <path d="M6 12h12" />
    <path d="M8 18h8" />
  </svg>
);

const CloseIcon = () => (
  <svg
    aria-hidden
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M18 6 6 18" strokeLinecap="round" />
    <path d="M6 6l12 12" strokeLinecap="round" />
  </svg>
);
