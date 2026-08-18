"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { MenuIcon, MoonIcon, SearchIcon, SunIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/game-modes", label: "Game Modes" },
  { href: "/auth/login", label: "Login" },
  { href: "/auth/signup", label: "Sign up" },
];

const publicRoutes = ["/", "/auth/login", "/auth/signup"];

const appRoutes = [
  "/home",
  "/practice",
  "/game-modes",
  "/settings",
  "/profile",
  "/leaderboard",
  "/clubs",
  "/friends",
  "/tournaments",
  "/bot-battle",
  "/match",
];

export function Navigation() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  // True only after hydration; prevents a light/dark icon mismatch on first paint.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const isPublicShell = !pathname || publicRoutes.some((route) => {
    if (route === "/") {
      return pathname === "/";
    }
    return pathname?.startsWith(route) ?? false;
  });
  const isAuthScreen =
    pathname?.startsWith("/auth/login") || pathname?.startsWith("/auth/signup");

  const visibleNavItems = useMemo(() => {
    if (isAuthScreen || isPublicShell) {
      return navItems.filter((item) =>
        item.href === "/" ||
        item.href === "/auth/login" ||
        item.href === "/auth/signup",
      );
    }
    return navItems;
  }, [isAuthScreen, isPublicShell]);

  const activeMap = useMemo(() => {
    return visibleNavItems.reduce<Record<string, boolean>>((acc, item) => {
      const isActive =
        item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
      acc[item.href] = Boolean(isActive);
      return acc;
    }, {});
  }, [pathname, visibleNavItems]);

  if (appRoutes.some((route) => pathname?.startsWith(route))) {
    return null;
  }

  const isDark = mounted && resolvedTheme === "dark";

  const renderLinks = (mobile = false) =>
    visibleNavItems.map((item) => {
      const isActive = activeMap[item.href];
      return (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-md px-3.5 py-2 text-sm font-medium transition-colors duration-200",
            mobile && "w-full",
            isActive
              ? "bg-accent text-accent-foreground shadow-sm shadow-black/10"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      );
    });

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="group inline-flex shrink-0 items-center gap-3">
          <span className="parallelogram-sm flex size-9 items-center justify-center overflow-hidden bg-accent shadow-sm shadow-black/10 transition group-hover:shadow-md">
            <Image
              src="/images/logo-icon.svg"
              alt="Code Royale logo"
              width={36}
              height={36}
              className="object-contain p-1.5"
              priority
            />
          </span>
          <span className="text-base font-semibold tracking-tight text-foreground">
            Code Royale
          </span>
        </Link>

        {!isPublicShell && (
          <form
            role="search"
            className="hidden min-w-0 flex-1 items-center gap-2 rounded-lg border border-input bg-muted/40 px-3 md:flex md:max-w-sm lg:max-w-md"
          >
            <SearchIcon data-icon="inline-start" />
            <label htmlFor="global-search" className="sr-only">
              Search players or friends
            </label>
            <input
              id="global-search"
              type="search"
              placeholder="Search players or friends"
              className="h-8 w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </form>
        )}

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {renderLinks()}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              isDark ? "Switch to light theme" : "Switch to dark theme"
            }
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {mounted && (isDark ? <SunIcon /> : <MoonIcon />)}
          </Button>

          <Sheet>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open menu"
                />
              }
            >
              <MenuIcon />
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Code Royale</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4">
                {renderLinks(true)}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
