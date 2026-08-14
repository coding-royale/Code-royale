"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, Menu, Search, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Input } from "@/components/ui/input";

const menuItems = [
  { label: "Game Modes", href: "/game-modes" },
  { label: "Clubs", href: "/clubs" },
  { label: "Practice Arena", href: "/practice" },
  { label: "Tournaments", href: "/tournaments" },
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
        <div className="border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-3 md:px-6">
            <div className="flex items-center gap-3">
              {onMenuToggle && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onMenuToggle}
                  aria-pressed={sidebarOpen}
                  aria-label="Toggle sidebar"
                  className={cn(sidebarOpen && "border-primary/50 text-primary")}
                >
                  {sidebarOpen ? <X data-icon="inline-start" /> : <Menu data-icon="inline-start" />}
                  <span className="hidden sm:inline">Menu</span>
                </Button>
              )}
              <Link href="/home" className="group inline-flex items-center gap-3">
                <span className="flex size-10 items-center justify-center overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10 transition group-hover:ring-foreground/25">
                  <Image
                    src="/images/logo-icon.svg"
                    alt="Code Royale logo"
                    width={40}
                    height={40}
                    className="object-contain p-1"
                    priority
                  />
                </span>
                <span className="hidden text-base font-semibold tracking-wide sm:inline">
                  Code Royale
                </span>
              </Link>
            </div>

            <div className="relative ml-2 hidden min-w-[220px] flex-1 items-center lg:flex">
              <Search className="absolute left-2.5 size-4 text-muted-foreground" />
              <Input
                id="player-search"
                type="search"
                placeholder="Search players or friends"
                className="h-9 pl-8"
              />
            </div>

            <nav className="ml-auto flex items-center gap-1 text-sm font-medium text-muted-foreground">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 transition-colors hover:bg-accent/60 hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="ml-2 flex items-center gap-2 text-muted-foreground">
              <Button variant="outline" size="icon" aria-label="Search (mobile)" className="lg:hidden">
                <Search />
              </Button>
              <Button variant="outline" size="icon" aria-label="Notifications">
                <Bell />
              </Button>
              <LinkButton variant="outline" size="icon" href="/settings" aria-label="Settings">
                <Settings />
              </LinkButton>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
