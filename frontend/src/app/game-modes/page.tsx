"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  Copy,
  Dumbbell,
  Gamepad2,
  Loader2,
  Lock,
  Play,
  Search,
  Skull,
  Sparkles,
  Swords,
  Trophy,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { supabase } from "../../lib/supabase-browser";
import { useFriendPresence } from "../../lib/use-friend-presence";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ModeCategory = "ranked" | "non-ranked";
type TrophyImpact = "High Trophy Impact" | "Low Trophy Impact" | "No Trophy Impact";
type MatchmakingState = "idle" | "configuring" | "searching" | "match_found" | "error";

type FriendRow = {
  id: string;
  username: string;
};

type ModeDefinition = {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  details?: string[];
  enabled: boolean;
  accent: string;
  impact: TrophyImpact;
  category: ModeCategory;
  limited?: boolean;
};

type ModeConfigPreset = {
  timers: string[];
  languages: string[];
  playerOptions: string[];
  note?: string;
};

type ModeConfigSelection = {
  timer: string;
  language: string;
  players: string;
};

type RankedBand = {
  league: string;
  difficulty: "easy" | "medium" | "hard";
};

function resolveLanguageCode(selection: string) {
  const normalized = selection.toLowerCase();
  if (normalized.includes("javascript") || normalized.includes("node")) return "node";
  if (normalized.includes("python")) return "python";
  if (normalized.includes("c++") || normalized.includes("cpp")) return "cpp";
  if (normalized.includes("java")) return "java";
  if (normalized === "c" || normalized.includes(" c")) return "c";
  return null;
}

function resolveMatchType(selection: string) {
  const normalized = selection.toLowerCase();
  if (normalized.includes("2v2")) return "2v2";
  if (normalized.includes("free") || normalized.includes("ffa") || normalized.includes("1v1v1v1")) return "ffa";
  return "1v1";
}

function getRankedBandFromRating(rating: number): RankedBand {
  if (rating < 300) {
    return { league: "Bronze", difficulty: "easy" };
  }
  if (rating < 700) {
    return { league: "Silver", difficulty: "medium" };
  }
  return { league: "Gold", difficulty: "hard" };
}

const RANKED_MODES: ModeDefinition[] = [
  {
    id: "ranked",
    title: "Ranked 1v1 Battle",
    subtitle: "Competitive matchmaking",
    details: ["Head-to-head ladder play", "Balanced by trophy rating", "Win streak bonuses"],
    badge: "Earn / lose trophies",
    enabled: true,
    accent: "",
    impact: "High Trophy Impact",
    category: "ranked",
  },
  {
    id: "unranked",
    title: "Unranked 1v1",
    subtitle: "Just for fun sparring",
    details: ["No ladder pressure", "Great for warm ups", "Match with similar skill"],
    badge: "No trophy change",
    enabled: true,
    accent: "",
    impact: "No Trophy Impact",
    category: "ranked",
  },
  {
    id: "friend",
    title: "Play with Friend",
    subtitle: "Queue up together",
    details: ["Private lobby code", "Spectate others", "Share practice strats"],
    badge: "Invite a friend",
    enabled: true,
    accent: "",
    impact: "No Trophy Impact",
    category: "ranked",
  },
  {
    id: "friends-2v2",
    title: "2v2 With Friends",
    subtitle: "Bring a teammate",
    details: ["Invite one teammate", "Private 2v2 lobby", "Team rating & rewards (soon)"],
    badge: "Locked feature",
    enabled: false,
    accent: "",
    impact: "Low Trophy Impact",
    category: "ranked",
  },
  {
    id: "battle-royale",
    title: "4 Player Battle",
    subtitle: "Free-for-all chaos",
    details: ["Race to solve", "Sabotage power-ups", "Seasonal events"],
    badge: "Coming soon",
    enabled: false,
    accent: "",
    impact: "High Trophy Impact",
    category: "ranked",
  },
  {
    id: "bots",
    title: "Battle vs Bots",
    subtitle: "Sharpen your tactics",
    details: ["Adaptive AI rivals with 3 difficulty levels", "Earn bot trophies", "Perfect for learning"],
    badge: "Bot Trophies",
    enabled: true,
    accent: "",
    impact: "Low Trophy Impact",
    category: "ranked",
  },
];

const NON_RANKED_MODES: ModeDefinition[] = [
  {
    id: "rapid-fire",
    title: "Rapid Fire",
    subtitle: "Solve fast. Chain streaks. Climb casually.",
    details: [
      "Multiple micro rounds with tiny prompts",
      "Minimal trophy swing, streak multipliers",
      "Leaderboards reward consistency and speed",
    ],
    badge: "Low Trophy Impact",
    enabled: true,
    accent: "",
    impact: "Low Trophy Impact",
    category: "non-ranked",
  },
  {
    id: "ffa",
    title: "Free-For-All",
    subtitle: "Outcode everyone. No teams. No mercy.",
    details: [
      "3–6 players battle on the same prompt",
      "Live leaderboard updates with every test",
      "Light trophy rewards, heavy bragging rights",
    ],
    badge: "Low Trophy Impact",
    enabled: true,
    accent: "",
    impact: "Low Trophy Impact",
    category: "non-ranked",
  },
  {
    id: "duos",
    title: "2v2 Team Battle",
    subtitle: "Win together or fall together.",
    details: [
      "Shared score, independent submits",
      "Coordinate hints and division of labor",
      "Momentum bonuses for synced solves",
    ],
    badge: "Low Trophy Impact",
    enabled: true,
    accent: "",
    impact: "Low Trophy Impact",
    category: "non-ranked",
  },
  {
    id: "events",
    title: "Experimental / Event Mode",
    subtitle: "Rules change. Skill adapts.",
    details: [
      "Rotating rule sets: short timers, language locks, random difficulty",
      "Limited-time rewards and cosmetics",
      "Perfect playground for creative problem solving",
    ],
    badge: "Limited-time",
    enabled: true,
    accent: "",
    impact: "No Trophy Impact",
    category: "non-ranked",
    limited: true,
  },
];

const DEFAULT_CONFIG_PRESET: ModeConfigPreset = {
  timers: ["5 minutes", "8 minutes", "12 minutes"],
  languages: ["Auto assign", "JavaScript", "Python", "C++", "Java"],
  playerOptions: ["Auto match", "Invite friends"],
};

const PVP_TIMER_OPTIONS = [
  "5 minutes (Blitz)",
  "10 minutes",
  "30 minutes",
  "60 minutes (Marathon)",
];

const PVP_LANGUAGE_OPTIONS = [
  "JavaScript (Node)",
  "Python",
  "C++",
  "Java",
  "C",
];

const PVP_MATCH_TYPE_OPTIONS = ["1v1", "2v2", "Free-for-all (1v1v1v1)"];

const BOT_DIFFICULTY_OPTIONS = ["Easy (~15 min)", "Medium (~10 min)", "Hard (~5 min)"];

const MODE_CONFIG_PRESETS: Record<string, ModeConfigPreset> = {
  ranked: {
    timers: PVP_TIMER_OPTIONS,
    languages: PVP_LANGUAGE_OPTIONS,
    playerOptions: PVP_MATCH_TYPE_OPTIONS,
    note: "Pick a language + timer before entering matchmaking.",
  },
  unranked: {
    timers: PVP_TIMER_OPTIONS,
    languages: PVP_LANGUAGE_OPTIONS,
    playerOptions: PVP_MATCH_TYPE_OPTIONS,
    note: "Same battle flow without ladder pressure.",
  },
  bots: {
    timers: ["No timer (elapsed)"],
    languages: PVP_LANGUAGE_OPTIONS,
    playerOptions: BOT_DIFFICULTY_OPTIONS,
    note: "Pick a language and difficulty, then start your bot battle.",
  },
  "rapid-fire": {
    timers: ["3 minutes", "5 minutes", "7 minutes"],
    languages: ["Auto assign", "JavaScript", "Python", "Rust"],
    playerOptions: ["Solo queue", "Party queue"],
    note: "Shortest problems, accelerated scoring windows.",
  },
  ffa: {
    timers: ["6 minutes", "8 minutes", "10 minutes"],
    languages: ["Any language", "JavaScript", "Python", "C++", "Java"],
    playerOptions: ["3 players", "4 players", "5 players", "6 players"],
    note: "Leaderboard rank updates in real time.",
  },
  duos: {
    timers: ["8 minutes", "10 minutes", "12 minutes"],
    languages: ["Any language", "JavaScript", "Python", "Java"],
    playerOptions: ["Auto team match", "Queue with partner"],
    note: "Team bonus for synchronized solves.",
  },
  events: {
    timers: ["Randomized", "4 minutes", "6 minutes"],
    languages: ["Mode decides", "JavaScript", "Python"],
    playerOptions: ["Event lobby", "Invite-only"],
    note: "Rule set rotates weekly. Expect surprises.",
  },
};

const MODE_ICONS: Record<string, typeof Swords> = {
  ranked: Trophy,
  unranked: Dumbbell,
  friend: UserPlus,
  "friends-2v2": Users,
  "battle-royale": Skull,
  bots: Bot,
  "rapid-fire": Zap,
  ffa: Users,
  duos: Users,
  events: Sparkles,
};

export default function GameModesPage() {
  const router = useRouter();
  const [state, setState] = useState<MatchmakingState>("idle");
  const [selectedMode, setSelectedMode] = useState<ModeDefinition | null>(null);
  const [configSelection, setConfigSelection] = useState<ModeConfigSelection | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollRef, setPollRef] = useState<ReturnType<typeof setInterval> | null>(null);
  const [searchSecondsRemaining, setSearchSecondsRemaining] = useState(60);

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [friendPickerOpen, setFriendPickerOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendRow | null>(null);

  const [inviteCreating, setInviteCreating] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteMatchId, setInviteMatchId] = useState<string | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [viewerRating, setViewerRating] = useState(0);

  const {
    loading: friendsLoading,
    error: friendsError,
    friends: presenceFriends,
  } = useFriendPresence();

  // Countdown timer for matchmaking search
  useEffect(() => {
    if (state !== "searching") return;

    const timer = window.setInterval(() => {
      setSearchSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(() => {
    let mounted = true;

    const loadViewer = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!mounted) return;
      if (error) {
        setViewerId(null);
        setViewerRating(0);
        return;
      }

      const resolvedViewerId = data.user?.id ?? null;
      setViewerId(resolvedViewerId);

      if (!resolvedViewerId) {
        setViewerRating(0);
        return;
      }

      const { data: userRow, error: userError } = await supabase
        .from("users")
        .select("rating")
        .eq("id", resolvedViewerId)
        .maybeSingle();

      if (!mounted) return;
      if (userError) {
        setViewerRating(0);
        return;
      }

      const rating = typeof userRow?.rating === "number" ? userRow.rating : 0;
      setViewerRating(rating);
    };

    void loadViewer();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef) clearInterval(pollRef);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const resetQueue = () => {
    if (pollRef) {
      clearInterval(pollRef);
      setPollRef(null);
    }
    setMatchId(null);
    setConfigSelection(null);
    setSelectedMode(null);
    setErrorMessage(null);
    setState("idle");
  };

  const openFriendPicker = async () => {
    if (!viewerId) {
      setErrorMessage("You must be signed in to invite a friend.");
      setSelectedMode(RANKED_MODES.find((mode) => mode.id === "friend") ?? null);
      setState("error");
      return;
    }

    setFriendPickerOpen(true);
  };

  const onlineFriends = presenceFriends
    .filter((friend) => friend.online)
    .map((friend) => ({ id: friend.id, username: friend.username }));

  const offlineFriends = presenceFriends
    .filter((friend) => !friend.online)
    .map((friend) => ({ id: friend.id, username: friend.username }));

  const createFriendInviteMatch = async (friend: FriendRow) => {
    setInviteCreating(true);
    setInviteError(null);
    setInviteMatchId(null);

    let res: Response;
    try {
      res = await fetch("/api/friend-match/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          friendUserId: friend.id,
          timeLimitSeconds: 10 * 60,
          language: null,
        }),
      });
    } catch (error) {
      console.error(error);
      setInviteError("Unable to create invite right now.");
      setInviteCreating(false);
      return;
    }

    if (!res.ok) {
      const contentType = res.headers.get("content-type") ?? "";
      let details = "";
      if (contentType.includes("application/json")) {
        const json = (await res.json().catch(() => null)) as null | { error?: string };
        details = json?.error ?? "";
      }
      if (!details) {
        details = await res.text().catch(() => "");
      }
      setInviteError(details?.trim() ? details : "Failed to create invite.");
      setInviteCreating(false);
      return;
    }

    const data = (await res.json().catch(() => ({}))) as { matchId?: string };
    if (!data.matchId) {
      setInviteError("Failed to create invite.");
      setInviteCreating(false);
      return;
    }

    setInviteMatchId(data.matchId);
    setInviteCreating(false);
    setInviteModalOpen(true);
  };

  const startInviteMatch = async (id: string) => {
    setInviteError(null);

    let res: Response;
    try {
      res = await fetch("/api/friend-match/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: id }),
      });
    } catch (error) {
      console.error(error);
      setInviteError("Unable to start match right now.");
      return;
    }

    if (!res.ok) {
      const contentType = res.headers.get("content-type") ?? "";
      let details = "";
      if (contentType.includes("application/json")) {
        const json = (await res.json().catch(() => null)) as null | { error?: string };
        details = json?.error ?? "";
      }
      if (!details) {
        details = await res.text().catch(() => "");
      }
      setInviteError(details?.trim() ? details : "Failed to start match.");
      return;
    }

    router.push(`/match/${id}`);
  };

  const parseTimerSeconds = (selection: ModeConfigSelection | null) => {
    const raw = selection?.timer ?? "";
    const minutesMatch = raw.match(/(\d+)\s*minute/i);
    if (minutesMatch?.[1]) return Number(minutesMatch[1]) * 60;
    const hoursMatch = raw.match(/(\d+)\s*hour/i);
    if (hoursMatch?.[1]) return Number(hoursMatch[1]) * 60 * 60;
    return 8 * 60;
  };

  const resolveBotDifficulty = (selection: string | undefined): "easy" | "medium" | "hard" => {
    const raw = selection ?? "";
    if (raw.toLowerCase().includes("medium")) return "medium";
    if (raw.toLowerCase().includes("hard")) return "hard";
    return "easy";
  };

  const startBotBattle = (modeId: string, selection: ModeConfigSelection | null) => {
    const difficulty = resolveBotDifficulty(selection?.players);
    const lang = resolveLanguageCode(selection?.language ?? "") ?? "node";
    router.push(`/bot-battle?difficulty=${difficulty}&language=${lang}`);
  };

  const startMatchmaking = async (modeId: string, selection: ModeConfigSelection | null) => {
    if (modeId === "bots") {
      startBotBattle(modeId, selection);
      return;
    }

    setErrorMessage(null);
    setMatchId(null);
    setSearchSecondsRemaining(60);

    const matchType = resolveMatchType(selection?.players ?? "1v1");
    if (matchType !== "1v1") {
      setErrorMessage("2v2 and Free-for-all matchmaking are coming soon. Use 1v1 for now.");
      setState("error");
      return;
    }

    setState("searching");

    const timeLimitSeconds = parseTimerSeconds(selection);
    const language = resolveLanguageCode(selection?.language ?? "");

    const { data: { session } } = await supabase.auth.getSession();

    let joinResponse: Response;
    try {
      joinResponse = await fetch("/api/matchmaking/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          mode: modeId === "unranked" ? "unranked" : "ranked",
          timeLimitSeconds,
          language,
          matchType,
        }),
      });
    } catch (error) {
      console.error(error);
      setErrorMessage("Matchmaking is unavailable right now.");
      setState("error");
      return;
    }

    if (!joinResponse.ok) {
      let details = "";
      const contentType = joinResponse.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const json = (await joinResponse.json().catch(() => null)) as null | { error?: string };
        details = json?.error ?? "";
      }

      if (!details) {
        details = await joinResponse.text().catch(() => "");
      }

      console.error("Join matchmaking failed", joinResponse.status, details);

      const friendly =
        joinResponse.status === 401
          ? "You must be signed in to start matchmaking."
          : details?.trim()
            ? details
            : "Unable to start matchmaking.";

      setErrorMessage(friendly);
      setState("error");
      return;
    }

    const joinData = (await joinResponse.json().catch(() => ({}))) as
      | { matchId: string }
      | { status: "queued" }
      | { error: string };

    if ("matchId" in joinData && joinData.matchId) {
      setMatchId(joinData.matchId);
      setState("match_found");
      return;
    }

    // Poll for up to 1 minute; if nobody joins, fail gracefully.
    const started = Date.now();
    const timeoutMs = 60_000;
    const intervalMs = 1_500;

    const interval = setInterval(async () => {
      if (Date.now() - started > timeoutMs) {
        clearInterval(interval);
        setPollRef(null);

        // Cancel the queue entry since we timed out
        await fetch("/api/matchmaking/cancel", { method: "POST" }).catch(() => {});

        setErrorMessage("No opponent found after 1 minute. Try again later.");
        setState("error");
        return;
      }

      try {
        const res = await fetch("/api/matchmaking/status", { 
          method: "GET",
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        });
        if (!res.ok) return;
        const data = (await res.json().catch(() => ({}))) as { matchId?: string | null };
        if (data.matchId) {
          clearInterval(interval);
          setPollRef(null);
          setMatchId(data.matchId);
          setState("match_found");
        }
      } catch {
        // ignore transient network errors
      }
    }, intervalMs);

    setPollRef(interval);
  };

  const handleRankedClick = (mode: ModeDefinition) => {
    setSelectedMode(mode);
    setConfigSelection(null);
    setMatchId(null);
    setState("configuring");
  };

  const handleNonRankedClick = (mode: ModeDefinition) => {
    setSelectedMode(mode);
    setConfigSelection(null);
    setState("configuring");
  };

  const handleEnterMatch = () => {
    if (matchId) {
      router.push(`/match/${matchId}`);
    }
  };

  const handleCancelSearch = async () => {
    try {
      await fetch("/api/matchmaking/cancel", { method: "POST" });
    } catch {
      // ignore
    }
    resetQueue();
  };

  const rankedCards = RANKED_MODES.map((mode) => ({
    mode,
    onClick:
      mode.enabled && (mode.id === "ranked" || mode.id === "unranked")
        ? () => handleRankedClick(mode)
        : mode.enabled && mode.id === "friend"
          ? () => void openFriendPicker()
          : mode.enabled && mode.id === "bots"
            ? () => handleRankedClick(mode)
            : undefined,
  }));

  const nonRankedCards = NON_RANKED_MODES.map((mode) => ({
    mode,
    onClick: mode.enabled ? () => handleNonRankedClick(mode) : undefined,
  }));

  const activeMode = selectedMode ?? RANKED_MODES[0];
  const rankedBand = getRankedBandFromRating(viewerRating);

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 pt-6 sm:px-8 lg:px-10">
        <header className="flex flex-col justify-between gap-8 rounded-xl bg-secondary/40 p-6 shadow-sm ring-1 ring-black/8 dark:ring-white/10 sm:flex-row sm:items-center sm:gap-10 sm:p-8">
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Choose your battle mode
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
              Squad up, duel a rival, or warm up with friends. Ranked battles award trophies, while event modes let you experiment without wrecking your ladder standing.
            </p>
          </div>
          <div className="flex items-center gap-4 rounded-lg border border-primary/30 bg-primary/10 px-6 py-4">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary/15">
              <Trophy className="size-5 text-primary" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-3xl font-semibold tracking-tight text-primary">
                  {viewerRating.toLocaleString()}
                </span>
                <span className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-primary/70">
                  Trophies
                </span>
              </div>
              <p className="font-mono text-xs uppercase tracking-[0.15em] text-primary/80">
                {rankedBand.league} League · {rankedBand.difficulty} lane
              </p>
            </div>
          </div>
        </header>

        {selectedFriend && state === "idle" && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Selected friend: <span className="font-semibold text-foreground">{selectedFriend.username}</span>
          </div>
        )}

        {state === "idle" && (
          <div className="flex flex-col gap-12">
            <section className="flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-semibold tracking-tight">Ranked & Core Modes</h2>
                <p className="text-sm text-muted-foreground">
                  Climb the ladder, invite friends, or queue up for legacy formats. These affect your season standing.
                </p>
              </div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {rankedCards.map(({ mode, onClick }) => (
                  <ModeCard key={mode.id} mode={mode} onClick={onClick} />
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-semibold tracking-tight">Non-Ranked Match Types</h2>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Skill-focused formats with reduced or zero trophy impact. Perfect for warming up, experimenting, or casual competition.
                </p>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                {nonRankedCards.map(({ mode, onClick }) => (
                  <ModeCard key={mode.id} mode={mode} onClick={onClick} />
                ))}
              </div>
            </section>
          </div>
        )}

        {state === "configuring" && selectedMode && (
          <ModeConfigPanel
            mode={selectedMode}
            preset={MODE_CONFIG_PRESETS[selectedMode.id] ?? DEFAULT_CONFIG_PRESET}
            rankedBand={rankedBand}
            onBack={resetQueue}
            onStart={(selection) => {
              setConfigSelection(selection);
              setMatchId(null);
              void startMatchmaking(selectedMode.id, selection);
            }}
          />
        )}

        {state === "searching" && (
          <MatchmakingPanel
            mode={activeMode}
            config={configSelection}
            onCancel={handleCancelSearch}
            secondsRemaining={searchSecondsRemaining}
          />
        )}

        {state === "match_found" && (
          <MatchFoundPanel
            mode={activeMode}
            config={configSelection}
            onEnter={handleEnterMatch}
            onStay={resetQueue}
          />
        )}

        {state === "error" && (
          <NoMatchPanel
            mode={activeMode}
            message={errorMessage ?? "No match found. Come back later."}
            onBack={resetQueue}
            onTryAgain={() => {
              void startMatchmaking(activeMode.id, configSelection);
            }}
          />
        )}
      </div>

      <FriendPickerModal
        open={friendPickerOpen}
        loading={friendsLoading}
        error={friendsError}
        onlineFriends={onlineFriends}
        offlineFriends={offlineFriends}
        onClose={() => setFriendPickerOpen(false)}
        onSelect={(friend) => {
          setSelectedFriend(friend);
          setFriendPickerOpen(false);
          void createFriendInviteMatch(friend);
        }}
      />

      <FriendInviteModal
        open={inviteModalOpen}
        creating={inviteCreating}
        error={inviteError}
        friend={selectedFriend}
        matchId={inviteMatchId}
        onClose={() => setInviteModalOpen(false)}
        onStart={(id) => void startInviteMatch(id)}
      />
    </AppShell>
  );
}

function impactBadgeClass(impact: TrophyImpact) {
  if (impact === "High Trophy Impact") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  if (impact === "Low Trophy Impact") {
    return "border-border bg-muted text-muted-foreground";
  }
  return "border-border text-muted-foreground";
}

type FriendPickerModalProps = {
  open: boolean;
  loading: boolean;
  error: string | null;
  onlineFriends: FriendRow[];
  offlineFriends: FriendRow[];
  onClose: () => void;
  onSelect: (friend: FriendRow) => void;
};

function FriendPickerModal({ open, loading, error, onlineFriends, offlineFriends, onClose, onSelect }: FriendPickerModalProps) {
  const hasOnline = onlineFriends.length > 0;
  const hasOffline = offlineFriends.length > 0;

  const initials = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return "CR";
    const parts = trimmed.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? "C";
    const second = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1];
    return `${first}${second ?? "R"}`.toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose who to invite</DialogTitle>
          <DialogDescription>
            Pick a friend to start a private duel. They&apos;ll get a link to jump straight in.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {loading && <p className="text-sm text-muted-foreground">Loading friends…</p>}
          {!loading && error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {!loading && !error && !hasOnline && !hasOffline && (
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
              No friends yet. Add players from the Friends tab first.
            </div>
          )}

          {!loading && !error && hasOnline && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Online
              </p>
              {onlineFriends.map((friend) => (
                <Button
                  key={friend.id}
                  variant="outline"
                  className="h-auto justify-between px-3 py-2.5"
                  onClick={() => onSelect(friend)}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">
                        {initials(friend.username)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-sm font-medium">{friend.username}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    Invite
                    <ArrowRight className="size-3.5" />
                  </span>
                </Button>
              ))}
            </div>
          )}

          {!loading && !error && hasOffline && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Offline
              </p>
              {offlineFriends.map((friend) => (
                <Button
                  key={friend.id}
                  variant="outline"
                  className="h-auto justify-between px-3 py-2.5"
                  onClick={() => onSelect(friend)}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-muted text-xs font-semibold text-muted-foreground">
                        {initials(friend.username)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-sm font-medium">{friend.username}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    Invite
                    <ArrowRight className="size-3.5" />
                  </span>
                </Button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type FriendInviteModalProps = {
  open: boolean;
  creating: boolean;
  error: string | null;
  friend: FriendRow | null;
  matchId: string | null;
  onClose: () => void;
  onStart: (matchId: string) => void;
};

function FriendInviteModal({ open, creating, error, friend, matchId, onClose, onStart }: FriendInviteModalProps) {
  const inviteLink =
    typeof window !== "undefined" && matchId ? `${window.location.origin}/match/${matchId}` : matchId ? `/match/${matchId}` : "";

  const canCopy = Boolean(matchId) && typeof navigator !== "undefined" && Boolean(navigator.clipboard);

  const handleCopy = async () => {
    if (!inviteLink || !canCopy) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      // ignore
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite ready</DialogTitle>
          <DialogDescription>
            {friend ? (
              <>Send this link to <span className="font-medium text-foreground">{friend.username}</span> so they can join the match.</>
            ) : (
              "Send this link so your friend can join the match."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {creating && <p className="text-sm text-muted-foreground">Creating invite…</p>}
          {!creating && error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {!creating && matchId && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Input readOnly value={inviteLink} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => void handleCopy()} disabled={!canCopy} aria-label="Copy invite link">
                  <Copy />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Your friend can open the link and join instantly.
              </p>
            </div>
          )}
        </div>

        {!creating && matchId && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => onStart(matchId)}>
              <Play data-icon="inline-start" />
              Start match
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

type ModeCardProps = {
  mode: ModeDefinition;
  onClick?: () => void;
};

function ModeCard({ mode, onClick }: ModeCardProps) {
  const { title, subtitle, badge, details, enabled, impact, limited } = mode;
  const Icon = MODE_ICONS[mode.id] ?? Gamepad2;

  const content = (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </div>
        {!enabled && (
          <Badge variant="secondary" className="gap-1">
            <Lock className="size-3" />
            {badge ?? "Locked"}
          </Badge>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {details && (
        <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          {details.slice(0, 3).map((detail) => (
            <li key={detail} className="flex items-start gap-2">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent-foreground/60" />
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        <Badge variant="outline" className={cn("gap-1", impactBadgeClass(impact))}>
          <Trophy className="size-3" />
          {impact}
        </Badge>
        {badge && enabled && (
          <Badge variant="secondary">{badge}</Badge>
        )}
        {limited && <Badge variant="outline">Limited-time</Badge>}
      </div>
      {enabled ? (
        <Button className="mt-2 w-full" onClick={onClick} disabled={!onClick}>
          <Play data-icon="inline-start" />
          Play Now
        </Button>
      ) : null}
    </div>
  );

  const cardClasses = cn(
    "h-full rounded-xl bg-card shadow-sm ring-1 ring-foreground/10 transition-all duration-200",
    enabled
      ? "hover:-translate-y-0.5 hover:shadow-md hover:ring-foreground/20"
      : "opacity-70",
  );

  return (
    <Card className={cardClasses}>
      <CardContent className="flex h-full flex-col">{content}</CardContent>
    </Card>
  );
}

type ModeConfigPanelProps = {
  mode: ModeDefinition;
  preset: ModeConfigPreset;
  rankedBand: RankedBand;
  onBack: () => void;
  onStart: (selection: ModeConfigSelection) => void;
};

function ModeConfigPanel({ mode, preset, rankedBand, onBack, onStart }: ModeConfigPanelProps) {
  const [timer, setTimer] = useState<string>(preset.timers[0] ?? DEFAULT_CONFIG_PRESET.timers[0]);
  const [language, setLanguage] = useState<string>(preset.languages[0] ?? DEFAULT_CONFIG_PRESET.languages[0]);
  const [players, setPlayers] = useState<string>(preset.playerOptions[0] ?? DEFAULT_CONFIG_PRESET.playerOptions[0]);

  return (
    <Card className="shadow-md ring-foreground/15">
      <CardContent className="flex flex-col gap-8 p-6 sm:p-8 lg:flex-row">
        <div className="flex flex-1 flex-col gap-5">
          <Button variant="ghost" size="sm" className="w-fit -ml-2" onClick={onBack}>
            <ArrowLeft data-icon="inline-start" />
            Back to modes
          </Button>
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{mode.title}</h2>
            <p className="text-sm text-muted-foreground">{mode.subtitle}</p>
          </div>
          {mode.details && (
            <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              {mode.details.map((detail) => (
                <li key={detail} className="flex items-start gap-2">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent-foreground/60" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("gap-1", impactBadgeClass(mode.impact))}>
              <Trophy className="size-3" />
              {mode.impact}
            </Badge>
            {(mode.id === "ranked" || mode.id === "unranked") && (
              <Badge variant="secondary">Ranked lane: {rankedBand.difficulty}</Badge>
            )}
            {mode.limited && <Badge variant="outline">Limited-time</Badge>}
            {preset.note && <span className="text-xs text-muted-foreground">{preset.note}</span>}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-5 rounded-xl border border-border bg-muted/30 p-5 sm:p-6">
          <h3 className="text-sm font-semibold">Match setup</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="config-timer">Timer preset</Label>
              <Select value={timer} onValueChange={(value) => { if (value !== null) setTimer(value); }}>
                <SelectTrigger id="config-timer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(preset.timers.length ? preset.timers : DEFAULT_CONFIG_PRESET.timers).map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="config-language">Preferred language</Label>
              <Select value={language} onValueChange={(value) => { if (value !== null) setLanguage(value); }}>
                <SelectTrigger id="config-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(preset.languages.length ? preset.languages : DEFAULT_CONFIG_PRESET.languages).map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="config-players">Players / queue</Label>
              <Select value={players} onValueChange={(value) => { if (value !== null) setPlayers(value); }}>
                <SelectTrigger id="config-players">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(preset.playerOptions.length ? preset.playerOptions : DEFAULT_CONFIG_PRESET.playerOptions).map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            className="mt-2 w-full"
            size="lg"
            onClick={() => onStart({ timer, language, players })}
          >
            <Search data-icon="inline-start" />
            Start matchmaking
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type MatchmakingPanelProps = {
  mode: ModeDefinition;
  config: ModeConfigSelection | null;
  onCancel: () => void;
  secondsRemaining: number;
};

function MatchmakingPanel({ mode, config, onCancel, secondsRemaining }: MatchmakingPanelProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Card className="shadow-md ring-foreground/15">
      <CardContent className="flex flex-col items-center gap-8 px-6 py-14 text-center sm:py-16">
        <div className="relative flex size-20 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/30" />
          <div className="relative flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm">
            <Loader2 className="size-7 animate-spin" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            {mode.title}
          </p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Searching for opponent…</h2>
          <p className="text-sm text-muted-foreground">
            Time remaining · <span className="font-mono font-medium text-foreground">{formatTime(secondsRemaining)}</span>
          </p>
          <Badge variant="outline" className={cn("mt-1 gap-1", impactBadgeClass(mode.impact))}>
            <Trophy className="size-3" />
            {mode.impact}
          </Badge>
        </div>
        {config && (
          <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">Timer · {config.timer}</Badge>
            <Badge variant="secondary">Queue · {config.players}</Badge>
            <Badge variant="secondary">Language · {config.language}</Badge>
          </div>
        )}
        <Button variant="outline" onClick={onCancel}>
          Cancel search
        </Button>
      </CardContent>
    </Card>
  );
}

type MatchFoundPanelProps = {
  mode: ModeDefinition;
  config: ModeConfigSelection | null;
  onEnter: () => void;
  onStay: () => void;
};

function MatchFoundPanel({ mode, config, onEnter, onStay }: MatchFoundPanelProps) {
  return (
    <Card className="shadow-md ring-emerald-500/30">
      <CardContent className="flex flex-col items-center gap-8 px-6 py-14 text-center sm:py-16">
        <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/15">
          <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400">
            Opponent found
          </p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{mode.title}</h2>
          <p className="max-w-lg text-sm text-muted-foreground">
            Match created. Enter the arena to start your duel.
          </p>
        </div>
        {config && (
          <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">Timer · {config.timer}</Badge>
            <Badge variant="secondary">Queue · {config.players}</Badge>
            <Badge variant="secondary">Language · {config.language}</Badge>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={onEnter}>
            <Play data-icon="inline-start" />
            Enter match
          </Button>
          <Button variant="outline" size="lg" onClick={onStay}>
            Back to modes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type NoMatchPanelProps = {
  mode: ModeDefinition;
  message: string;
  onBack: () => void;
  onTryAgain: () => void;
};

function NoMatchPanel({ mode, message, onBack, onTryAgain }: NoMatchPanelProps) {
  return (
    <Card className="shadow-md ring-destructive/20">
      <CardContent className="flex flex-col items-center gap-8 px-6 py-14 text-center sm:py-16">
        <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="size-8 text-destructive" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            {mode.title}
          </p>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">No opponent found</h2>
          <p className="max-w-lg text-sm text-muted-foreground">{message}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={onTryAgain}>
            Try again
          </Button>
          <Button variant="outline" size="lg" onClick={onBack}>
            Back
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
