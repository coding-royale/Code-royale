"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import {
  Bell,
  Code2,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  Mail,
  Medal,
  Search,
  Settings,
  Trophy,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase } from "../lib/supabase-browser";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const sidebarItems = [
  { id: "home", label: "Dashboard", href: "/home", icon: LayoutDashboard },
  { id: "practice", label: "Practice", href: "/practice", icon: Code2 },
  { id: "game-modes", label: "Game Modes", href: "/game-modes", icon: Gamepad2 },
  { id: "leaderboard", label: "Leaderboard", href: "/leaderboard", icon: Trophy },
  { id: "clubs", label: "Clubs", href: "/clubs", icon: Users },
  { id: "tournaments", label: "Tournaments", href: "/tournaments", icon: Medal },
];

const bottomItems = [
  { id: "friends", label: "Friends", href: "/friends", icon: UserPlus },
  { id: "profile", label: "Profile", href: "/profile", icon: User },
  { id: "settings", label: "Settings", href: "/settings", icon: Settings },
];

const socialButtons: Array<{
  id: string;
  label: string;
  href?: string;
  icon: (props: { className?: string }) => ReactNode;
}> = [
  { id: "youtube", label: "YouTube", icon: YouTubeIcon },
  { id: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/lohitaksha-patary/", icon: LinkedInIcon },
  { id: "twitter", label: "Twitter", href: "https://x.com/lohitaksha06", icon: TwitterIcon },
];

type AppShellProps = {
  children: ReactNode;
  showSidebar?: boolean;
};

type PendingNotification = {
  id: string;
  requesterId: string;
  requesterName: string;
  createdAt: string;
  timeLabel: string;
};

function formatNotificationTime(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "just now";

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function AppShell({ children, showSidebar = true }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [incomingRequestCount, setIncomingRequestCount] = useState(0);
  const [pendingNotifications, setPendingNotifications] = useState<PendingNotification[]>([]);
  const [acceptingRequesterIds, setAcceptingRequesterIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;

    const refreshIncomingRequests = async (userId: string) => {
      const { data: rows, count, error } = await supabase
        .from("connections")
        .select("user_id,created_at", { count: "exact" })
        .eq("connection_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(8);

      if (!mounted || error) {
        return;
      }

      setIncomingRequestCount(count ?? 0);

      const requesterIds = Array.from(new Set((rows ?? []).map((row) => row.user_id as string).filter(Boolean)));

      if (requesterIds.length === 0) {
        setPendingNotifications([]);
        return;
      }

      const { data: userRows, error: usersError } = await supabase
        .from("users")
        .select("id,username")
        .in("id", requesterIds);

      if (!mounted || usersError) {
        return;
      }

      const usernameById = new Map(
        (userRows ?? []).map((row) => [row.id as string, ((row.username as string | null) ?? "Unknown").trim() || "Unknown"]),
      );

      const notifications: PendingNotification[] = (rows ?? []).map((row) => ({
        id: `${row.user_id as string}-${row.created_at as string}`,
        requesterId: row.user_id as string,
        requesterName: usernameById.get(row.user_id as string) ?? "Unknown",
        createdAt: row.created_at as string,
        timeLabel: formatNotificationTime(row.created_at as string),
      }));

      setPendingNotifications(notifications);
    };

    const bootstrap = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (!mounted || error || !data.user?.id) {
        setViewerId(null);
        setIncomingRequestCount(0);
        return;
      }

      setViewerId(data.user.id);
      await refreshIncomingRequests(data.user.id);
    };

    void bootstrap();

    const timer = window.setInterval(() => {
      void bootstrap();
    }, 8000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const handleAcceptFromNotification = async (requesterId: string) => {
    if (!viewerId) return;

    setAcceptingRequesterIds((prev) => new Set(prev).add(requesterId));

    const { error } = await supabase
      .from("connections")
      .update({ status: "accepted" })
      .match({ user_id: requesterId, connection_id: viewerId, status: "pending" });

    if (!error) {
      setPendingNotifications((prev) => prev.filter((item) => item.requesterId !== requesterId));
      setIncomingRequestCount((prev) => Math.max(0, prev - 1));
    }

    setAcceptingRequesterIds((prev) => {
      const next = new Set(prev);
      next.delete(requesterId);
      return next;
    });
  };

  const isActive = (href: string) => {
    if (href === "/home") return pathname === "/home";
    return pathname?.startsWith(href);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut().catch(() => {});
    router.push("/");
  };

  if (!showSidebar) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <SidebarProvider className="flex-col">
      <header className="sticky top-0 z-40 flex h-14 w-full shrink-0 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
        <SidebarTrigger />
        <Link href="/home" className="flex shrink-0 items-center gap-2.5 pr-1">
          <span className="flex size-7 items-center justify-center overflow-hidden rounded-md bg-muted ring-1 ring-foreground/10">
            <Image
              src="/images/logo-icon.svg"
              alt="Code Royale logo"
              width={28}
              height={28}
              className="object-contain p-0.5"
              priority
            />
          </span>
          <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">
            Code Royale
          </span>
        </Link>
        <Separator orientation="vertical" className="h-6 max-md:hidden" />
        <div className="relative hidden max-w-sm flex-1 items-center md:flex">
          <Search className="absolute left-2.5 size-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search problems…"
            className="h-9 pl-8 pr-14"
            aria-label="Search problems"
          />
          <kbd className="absolute right-2.5 hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:inline-block">
            ⌘K
          </kbd>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="icon" className="relative" aria-label="Friend requests">
                  <Bell />
                  {incomingRequestCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white">
                      {incomingRequestCount > 99 ? "99+" : incomingRequestCount}
                    </span>
                  )}
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-80 p-0">
              <DropdownMenuLabel className="border-b border-border px-4 py-3 text-sm font-semibold">
                Notifications
              </DropdownMenuLabel>
              <ScrollArea className="max-h-80">
                {pendingNotifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No new friend requests.
                  </div>
                ) : (
                  <div className="flex flex-col gap-1 p-2">
                    {pendingNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {notification.requesterName} sent you a friend request.
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {notification.timeLabel}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            void handleAcceptFromNotification(notification.requesterId);
                          }}
                          disabled={acceptingRequesterIds.has(notification.requesterId)}
                        >
                          {acceptingRequesterIds.has(notification.requesterId) ? "Accepting…" : "Accept"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              <div className="border-t border-border p-2">
                <DropdownMenuItem
                  className="justify-center font-medium text-foreground"
                  render={<Link href="/friends?tab=pending" />}
                >
                  Open pending requests
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <LinkButton variant="outline" size="icon" href="/profile" aria-label="Profile">
            <User />
          </LinkButton>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Sidebar collapsible="icon" className="bottom-0 top-14 h-auto">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {sidebarItems.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          render={<Link href={item.href} />}
                          isActive={active}
                          tooltip={item.label}
                        >
                          <item.icon />
                          <span className="font-semibold">{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {bottomItems.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          render={<Link href={item.href} />}
                          isActive={active}
                          tooltip={item.label}
                        >
                          <item.icon />
                          <span className="font-semibold">{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <SidebarMenuButton size="lg">
                        <Avatar className="size-8 rounded-lg">
                          <AvatarFallback className="rounded-lg bg-accent font-semibold text-accent-foreground">
                            CR
                          </AvatarFallback>
                        </Avatar>
                        <span className="grid flex-1 text-left text-sm leading-tight">
                          <span className="truncate font-semibold">Player</span>
                          <span className="truncate text-xs text-muted-foreground">Signed in</span>
                        </span>
                        <ChevronUpDownIcon />
                      </SidebarMenuButton>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="p-0 font-normal">
                        <div className="flex items-center gap-2 px-1 py-1.5 text-sm">
                          <Avatar className="size-8 rounded-lg">
                            <AvatarFallback className="rounded-lg bg-accent font-semibold text-accent-foreground">
                              CR
                            </AvatarFallback>
                          </Avatar>
                          <div className="grid flex-1 text-left leading-tight">
                            <span className="truncate font-semibold">Player</span>
                            <span className="truncate text-xs text-muted-foreground">Code Royale</span>
                          </div>
                        </div>
                      </DropdownMenuLabel>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem render={<Link href="/profile" />}>
                      <User />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href="/settings" />}>
                      <Settings />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => void handleSignOut()}>
                      <LogOut />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset>
          <div className="min-h-[calc(100vh-3.5rem)]">{children}</div>

          <footer className="border-t border-border bg-muted/30 px-6 py-10">
            <div className="mx-auto grid w-full max-w-6xl gap-8 md:grid-cols-2">
              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold">Social</h3>
                <div className="flex flex-wrap gap-2">
                  {socialButtons.map((item) => {
                    const Icon = item.icon;
                    if (item.href) {
                      return (
                        <LinkButton
                          key={item.id}
                          variant="outline"
                          size="sm"
                          href={item.href}
                          external
                        >
                          <Icon />
                          {item.label}
                        </LinkButton>
                      );
                    }
                    return (
                      <Button key={item.id} variant="outline" size="sm" disabled>
                        <Icon />
                        {item.label}
                      </Button>
                    );
                  })}
                </div>
              </section>

              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold">Contact</h3>
                <LinkButton
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  href="mailto:patarylohitaksha06@gmail.com"
                  external
                >
                  <Mail />
                  patarylohitaksha06@gmail.com
                </LinkButton>
              </section>
            </div>
          </footer>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a2.997 2.997 0 00-2.11-2.122C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.388.519A2.997 2.997 0 00.502 6.186 31.36 31.36 0 000 12a31.36 31.36 0 00.502 5.814 2.997 2.997 0 002.11 2.122c1.883.519 9.388.519 9.388.519s7.505 0 9.388-.519a2.997 2.997 0 002.11-2.122A31.36 31.36 0 0024 12a31.36 31.36 0 00-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452H16.89v-5.569c0-1.328-.024-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.346V9h3.414v1.561h.049c.476-.9 1.637-1.85 3.368-1.85 3.601 0 4.267 2.369 4.267 5.455v6.286zM5.337 7.433a2.066 2.066 0 110-4.132 2.066 2.066 0 010 4.132zM7.119 20.452H3.555V9h3.564v11.452z" />
    </svg>
  );
}

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2H21l-6.017 6.877L22 22h-5.561l-4.357-5.095L7.62 22H4.862l6.437-7.356L2 2h5.702l3.939 4.676L18.244 2zm-.968 18.347h1.531L6.87 3.566H5.227l12.049 16.781z" />
    </svg>
  );
}

const ChevronUpDownIcon = () => (
  <svg
    aria-hidden
    className="ml-auto size-4 text-muted-foreground transition-transform group-data-[state=expanded]/menu-button:rotate-180"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m7 15 5 5 5-5" />
    <path d="m7 9 5-5 5 5" />
  </svg>
);
