"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Lock, Trophy } from "lucide-react";

import { AppShell } from "../../../components/app-shell";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";

type ClubPrivacy = "public" | "private";

type ClubMember = {
  id: string;
  username: string;
  avatar: string;
  trophies: number;
  role: "host" | "elder" | "member";
};

type Club = {
  id: string;
  name: string;
  logo: string;
  emblem: string;
  trophies: number;
  members: number;
  maxMembers: number;
  privacy: ClubPrivacy;
  rank: number;
  description?: string;
  topPlayers: ClubMember[];
};

const STORAGE_MY_CLUB_ID = "cr_my_club_id";
const STORAGE_MY_CUSTOM_CLUB = "cr_my_custom_club";
const STORAGE_CLUB_LIST = "cr_club_list";

const emblemOptions = [
  { id: "sword",     color: "from-red-500 to-orange-500" },
  { id: "shield",    color: "from-blue-500 to-cyan-500" },
  { id: "crown",     color: "from-amber-500 to-yellow-500" },
  { id: "star",      color: "from-purple-500 to-pink-500" },
  { id: "lightning", color: "from-cyan-500 to-blue-500" },
  { id: "fire",      color: "from-orange-500 to-red-500" },
  { id: "dragon",    color: "from-emerald-500 to-teal-500" },
  { id: "target",    color: "from-rose-500 to-pink-500" },
];

const topClubs: Club[] = [];

function loadClubList(): Club[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_CLUB_LIST);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Club[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadCustomClub(): Club | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_MY_CUSTOM_CLUB);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Club;
  } catch {
    return null;
  }
}

function getMyClubId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_MY_CLUB_ID);
}

function setMyClubId(id: string, club?: Club) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_MY_CLUB_ID, id);
  if (club) {
    window.localStorage.setItem(STORAGE_MY_CUSTOM_CLUB, JSON.stringify(club));
  }
}

function clearMyClub() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_MY_CLUB_ID);
  window.localStorage.removeItem(STORAGE_MY_CUSTOM_CLUB);
}

function emblemColor(emblem: string) {
  return emblemOptions.find((e) => e.id === emblem)?.color ?? "from-blue-500 to-cyan-500";
}

/* ── External store for club storage (hydration-safe) ──── */
let myClubIdCache: string | null | undefined;
let clubListCache: Club[] | undefined;

function getStoredMyClubId(): string | null {
  if (myClubIdCache === undefined) myClubIdCache = getMyClubId();
  return myClubIdCache;
}

function getStoredClubList(): Club[] {
  if (clubListCache === undefined) clubListCache = loadClubList();
  return clubListCache;
}

function subscribeStoredClubs(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handle = () => {
    myClubIdCache = undefined;
    clubListCache = undefined;
    onChange();
  };
  window.addEventListener("storage", handle);
  return () => window.removeEventListener("storage", handle);
}

export default function ClubDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clubId = typeof params.clubId === "string" ? params.clubId : "";
  const isInviteLink = searchParams.get("invite") === "1";

  const myClubId = useSyncExternalStore(subscribeStoredClubs, getStoredMyClubId, () => null);
  const storedList = useSyncExternalStore(subscribeStoredClubs, getStoredClubList, () => []);

  const clubList = storedList.length > 0 ? storedList : topClubs;

  const club = useMemo(() => {
    const custom = loadCustomClub();
    if (custom && custom.id === clubId) return custom;
    return clubList.find((c) => c.id === clubId) ?? topClubs.find((c) => c.id === clubId) ?? null;
  }, [clubId, clubList]);

  const refreshStoredClubs = () => {
    myClubIdCache = undefined;
    clubListCache = undefined;
    window.dispatchEvent(new Event("storage"));
  };

  if (!club) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-3xl p-6">
          <Card className="p-6 text-center">
            <CardContent className="flex flex-col items-center gap-4 p-0">
              <p className="text-muted-foreground">Club not found.</p>
              <Button onClick={() => router.push("/clubs")}>Back to Clubs</Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const isMyClub = myClubId === club.id;
  const isInClub = Boolean(myClubId);
  const isFull = club.members >= club.maxMembers;

  const handleJoin = () => {
    if (isInClub) return;
    if (club.privacy === "private") {
      alert(`Request sent to join ${club.name}! The club host will review your request.`);
      return;
    }
    setMyClubId(club.id);
    refreshStoredClubs();
  };

  const handleLeave = () => {
    if (!isMyClub) return;
    if (confirm("Are you sure you want to leave this club?")) {
      clearMyClub();
      refreshStoredClubs();
      router.push("/clubs");
    }
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl p-6">
        <div className="mb-5 flex items-center justify-between">
          <Link
            href="/clubs"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft data-icon="inline-start" />
            Back to Clubs
          </Link>
          {isMyClub ? (
            <Button
              variant="outline"
              onClick={handleLeave}
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              Leave Club
            </Button>
          ) : isFull ? (
            <Badge variant="secondary">Full</Badge>
          ) : isInClub ? (
            <Badge variant="secondary">In a Club</Badge>
          ) : (
            <Button onClick={handleJoin}>
              {club.privacy === "private"
                ? (isInviteLink ? "Request via Invite" : "Request to Join")
                : (isInviteLink ? "Join via Invite" : "Join Club")}
            </Button>
          )}
        </div>

        {isInviteLink && !isMyClub && !isInClub && !isFull && (
          <Alert className="mb-4 border-accent bg-accent/40">
            <AlertDescription>
              You opened an invite link for this club.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="flex flex-wrap items-start gap-6 p-6">
            <div className={`flex size-20 items-center justify-center rounded-xl bg-gradient-to-br ${emblemColor(club.emblem)} text-4xl`}>
              {club.logo}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">{club.name}</h1>
                {club.privacy === "private" && (
                  <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400">
                    <Lock data-icon="inline-start" />
                    Private
                  </Badge>
                )}
              </div>
              {club.description && (
                <p className="mt-1 text-sm text-muted-foreground">{club.description}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Trophy className="size-4 text-amber-500" />
                  {club.trophies.toLocaleString()} Trophies
                </span>
                <span>•</span>
                <span>{club.members}/{club.maxMembers} Members</span>
                <span>•</span>
                <span>Rank #{club.rank}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Top Players</h2>
          </div>
          <div className="flex flex-col divide-y">
            {club.topPlayers.map((player, idx) => (
              <div key={player.id} className="flex items-center gap-4 p-4">
                <div
                  className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${
                    idx === 0
                      ? "bg-amber-500/20 text-amber-500"
                      : idx === 1
                        ? "bg-muted text-muted-foreground"
                        : "bg-orange-500/20 text-orange-500"
                  }`}
                >
                  {idx + 1}
                </div>
                <div className="flex size-9 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                  {player.avatar}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{player.username}</div>
                  <div className="text-xs text-muted-foreground">{player.role.toUpperCase()}</div>
                </div>
                <div className="text-sm font-semibold text-amber-500">
                  {player.trophies.toLocaleString()} trophies
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
