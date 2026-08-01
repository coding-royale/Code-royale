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
        <div className="border-b border-sky-500/10 bg-[#05070f]/95 px-8 py-4 shadow-[0_12px_45px_rgba(5,12,28,0.6)] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-6">
            <Link href="/" className="group inline-flex items-center gap-3">
              <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-sky-500/50 bg-slate-900/80 shadow-[0_0_24px_rgba(56,189,248,0.3)] transition group-hover:border-sky-300 group-hover:shadow-[0_0_32px_rgba(56,189,248,0.45)]">
                <Image
                  src="/images/logo-icon.svg"
                  alt="Code Royale logo"
                  fill
                  className="object-contain p-0.5"
                  sizes="40px"
                  priority
                />
              </span>
              <span className="text-lg font-semibold tracking-[0.28em] text-sky-100 group-hover:text-sky-200">
                CODE ROYALE
              </span>
            </Link>

            {!isPublicShell && (
              <form className="flex min-w-[220px] flex-1 items-center gap-2 rounded-full border border-sky-500/15 bg-[#070d18] px-4 py-2 text-sm text-sky-100/70 md:max-w-lg">
                <label htmlFor="global-search" className="sr-only">
                  Search players or friends
                </label>
                <SearchIcon />
                <input
                  id="global-search"
                  type="search"
                  placeholder="Search players or friends"
                  className="w-full bg-transparent text-sky-100 placeholder:text-sky-400/50 focus:outline-none"
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
                    className={`group relative overflow-hidden px-4 py-2 text-sm font-semibold tracking-wide text-sky-100/80 transition-colors duration-200 ${
                      isActive
                        ? "text-sky-50"
                        : "hover:text-sky-100"
                    }`}
                  >
                    <span
                      className={`absolute inset-0 -z-10 rounded-md bg-sky-500/20 transition-opacity duration-200 ${
                        isActive ? "opacity-100" : "opacity-0 group-hover:opacity-30"
                      }`}
                    />
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
    className="h-4 w-4 text-sky-300"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-3.6-3.6" />
  </svg>
);
