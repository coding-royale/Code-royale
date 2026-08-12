"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/game-modes", label: "Game Modes" },
  { href: "/auth/login", label: "Login" },
  { href: "/auth/signup", label: "Sign up" },
];

const publicRoutes = ["/", "/auth/login", "/auth/signup"];

export function Navigation() {
  const pathname = usePathname();

  const [isHidden, setIsHidden] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const lastScrollRef = useRef(0);
  const hoveringRef = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY;
      const last = lastScrollRef.current;

      if (current > last && current > 48 && !hoveringRef.current) {
        setIsHidden(true);
      } else if (current < last || current <= 48) {
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
    if (window.scrollY > 64) {
      setIsHidden(true);
    }
  };

  const isPublicShell = !pathname || publicRoutes.some((route) => {
    if (route === "/") {
      return pathname === "/";
    }
    return pathname?.startsWith(route) ?? false;
  });
  const isAuthScreen = pathname?.startsWith("/auth/login") || pathname?.startsWith("/auth/signup");

  const visibleNavItems = useMemo(() => {
    if (isAuthScreen) {
      return navItems.filter((item) =>
        item.href === "/" ||
        item.href === "/auth/login" ||
        item.href === "/auth/signup"
      );
    }

    if (isPublicShell) {
      return navItems.filter((item) =>
        item.href === "/" ||
        item.href === "/auth/login" ||
        item.href === "/auth/signup"
      );
    }
    return navItems;
  }, [isAuthScreen, isPublicShell]);

  const activeMap = useMemo(() => {
    return visibleNavItems.reduce<Record<string, boolean>>((acc, item) => {
      const isActive = item.href === "/"
        ? pathname === "/"
        : pathname?.startsWith(item.href);
      acc[item.href] = Boolean(isActive);
      return acc;
    }, {});
  }, [pathname, visibleNavItems]);

  if (pathname?.startsWith("/home") || pathname?.startsWith("/practice") || pathname?.startsWith("/game-modes") || pathname?.startsWith("/settings") || pathname?.startsWith("/profile") || pathname?.startsWith("/leaderboard") || pathname?.startsWith("/clubs") || pathname?.startsWith("/friends") || pathname?.startsWith("/tournaments")) {
    return null;
  }

  const visibilityClass = isHidden && !isHovering
    ? "-translate-y-full opacity-0 pointer-events-none"
    : "opacity-100 pointer-events-auto";

  return (
    <>
      <div
        className="fixed left-0 right-0 top-0 z-[60] h-6"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
      <header
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`fixed left-0 right-0 top-0 z-[55] transition-all duration-300 ease-out ${visibilityClass}`}
      >
        <div className="border-b border-[var(--cr-border)] bg-[var(--cr-bg)]/90 px-8 py-4 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-6">
            <Link href="/" className="group inline-flex items-center gap-3">
              <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)]">
                <Image
                  src="/images/logo-icon.svg"
                  alt="Code Royale logo"
                  fill
                  className="object-contain p-1"
                  sizes="40px"
                  priority
                />
              </span>
              <span className="text-base font-semibold tracking-wide text-[var(--cr-fg)]">
                Code Royale
              </span>
            </Link>

            {!isPublicShell && (
              <form className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] px-3.5 py-2 text-sm text-[var(--cr-fg-muted)] md:max-w-lg focus-within:border-[rgba(var(--cr-accent-rgb),0.5)]">
                <label htmlFor="global-search" className="sr-only">
                  Search players or friends
                </label>
                <SearchIcon />
                <input
                  id="global-search"
                  type="search"
                  placeholder="Search players or friends"
                  className="w-full bg-transparent text-[var(--cr-fg)] placeholder:text-[var(--cr-fg-muted)] focus:outline-none"
                />
              </form>
            )}

            <nav className="ml-auto flex items-center gap-1">
              {visibleNavItems.map((item) => {
                const isActive = activeMap[item.href];
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-md px-3.5 py-2 text-sm font-medium transition-colors duration-200 ${
                      isActive
                        ? "bg-[var(--cr-accent-soft)] text-[rgb(var(--cr-accent-rgb))]"
                        : "text-[var(--cr-fg-muted)] hover:bg-[var(--cr-bg-tertiary)] hover:text-[var(--cr-fg)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>
    </>
  );
}

const SearchIcon = () => (
  <svg
    aria-hidden
    className="h-4 w-4 text-[var(--cr-fg-muted)]"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-3.6-3.6" />
  </svg>
);
