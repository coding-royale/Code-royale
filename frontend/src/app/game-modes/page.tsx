"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../components/app-shell";
import { supabase } from "../../lib/supabase-browser";
import { useFriendPresence } from "../../lib/use-friend-presence";

const trophyIcon = (
  <svg
    aria-hidden
    viewBox="0 0 24 24"
    className="h-6 w-6 text-amber-300 drop-shadow-[0_0_18px_rgba(251,191,36,0.55)]"
  >
    <path
      fill="currentColor"
      d="M19 4h-1V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v1H5a1 1 0 0 0-1 1v2a4 4 0 0 0 3 3.87A6 6 0 0 0 11 14.9V17H8a1 1 0 0 0 0 2h8a1 1 0 1 0 0-2h-3v-2.1a6 6 0 0 0 4-3.99 4 4 0 0 0 3-3.87V5a1 1 0 0 0-1-1Zm-1 3a2 2 0 0 1-2 2 1 1 0 0 0-.94.66A4 4 0 0 1 12 12a4 4 0 0 1-3.06-2.34A1 1 0 0 0 8 9a2 2 0 0 1-2-2V6h2a1 1 0 0 0 1-1V4h6v1a1 1 0 0 0 1 1h2Z"
    />
  </svg>
);

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
    accent: "from-emerald-500/80 to-sky-500/40",
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
    accent: "from-sky-400/60 to-indigo-500/40",
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
    accent: "from-violet-500/70 to-purple-600/40",
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
    accent: "from-rose-500/70 to-orange-500/40",
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
    accent: "from-cyan-500/70 to-sky-500/30",
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
    accent: "from-rose-500/70 to-orange-500/40",
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
    accent: "from-indigo-500/70 to-blue-500/35",
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
    accent: "from-fuchsia-500/70 to-purple-500/40",
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
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-6 pt-8 sm:px-10 lg:px-16">
        <header className="flex flex-col justify-between gap-8 rounded-2xl border border-cr-border bg-cr-bg-secondary p-10 sm:flex-row sm:items-center sm:gap-10">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cr-accent">Command Center</p>
            <h1 className="text-4xl font-bold text-cr-fg sm:text-5xl">
              Choose your battle mode
            </h1>
            <p className="max-w-xl text-base text-cr-fg-muted">
              Squad up, duel a rival, or warm up with friends. Ranked battles award trophies, while event modes let you experiment without wrecking your ladder standing.
            </p>
          </div>
          <div className="flex items-center gap-5 rounded-xl border border-amber-400/40 bg-amber-400/10 px-8 py-5 text-amber-200">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/20">
              {trophyIcon}
            </div>
            <div>
              <div className="flex items-baseline gap-2 text-4xl font-semibold tracking-tight text-amber-100">
                <span>{viewerRating.toLocaleString()}</span>
                <span className="text-base font-medium uppercase tracking-[0.2em] text-amber-200/70">Trophies</span>
              </div>
              <p className="text-sm uppercase tracking-[0.2em] text-amber-200/80">
                Rank · {rankedBand.league} League
              </p>
              <p className="text-xs uppercase tracking-[0.2em] text-amber-100/75">
                Ranked question lane: {rankedBand.difficulty}
              </p>
            </div>
          </div>
        </header>

        {selectedFriend && state === "idle" && (
          <div className="rounded-2xl border border-violet-400/30 bg-violet-500/10 px-5 py-4 text-sm text-violet-100">
            Selected friend: <span className="font-semibold">{selectedFriend.username}</span>
          </div>
        )}

        {state === "idle" && (
          <div className="flex flex-col gap-16">
            <section className="space-y-8">
              <header className="space-y-3">
                <h2 className="text-2xl font-semibold uppercase tracking-[0.35em] text-sky-300/80">
                  Ranked & Core Modes
                </h2>
                <p className="text-base text-sky-100/70">
                  Climb the ladder, invite friends, or queue up for legacy formats. These affect your season standing.
                </p>
              </header>
              <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
                {rankedCards.map(({ mode, onClick }) => (
                  <ModeCard key={mode.id} mode={mode} onClick={onClick} />
                ))}
              </div>
            </section>

            <section className="space-y-8">
              <header className="space-y-4">
                <h2 className="text-2xl font-semibold uppercase tracking-[0.35em] text-fuchsia-300/80">
                  Non-Ranked Match Types
                </h2>
                <p className="max-w-2xl text-base text-sky-100/75">
                  Skill-focused formats with reduced or zero trophy impact. Perfect for warming up, experimenting, or casual competition.
                </p>
              </header>
              <div className="grid gap-8 md:grid-cols-2">
                {nonRankedCards.map(({ mode, onClick }) => (
                  <ModeCard key={mode.id} mode={mode} onClick={onClick} playful />
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
  if (!open) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
      <button
        type="button"
        aria-label="Close friend picker"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-3xl border border-violet-400/30 bg-[#050b18] p-7 shadow-[0_0_60px_rgba(139,92,246,0.25)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-violet-300/80">Play with a friend</p>
            <h2 className="mt-2 text-2xl font-semibold text-sky-50">Choose who to invite</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-violet-400/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-sky-100/80 transition hover:border-violet-200 hover:bg-violet-500/15"
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-5">
          {loading && <p className="text-sm text-sky-100/70">Loading friends…</p>}
          {!loading && error && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</div>
          )}

          {!loading && !error && !hasOnline && !hasOffline && (
            <div className="rounded-2xl border border-slate-600/30 bg-slate-950/50 p-4 text-sm text-sky-100/70">
              No friends yet.
            </div>
          )}

          {!loading && !error && hasOnline && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-300/80">Online</p>
              <div className="mt-3 grid gap-2">
                {onlineFriends.map((friend) => (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() => onSelect(friend)}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-left transition hover:border-emerald-200 hover:bg-emerald-500/15"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/15 text-xs font-semibold text-emerald-100">
                        {initials(friend.username)}
                      </span>
                      <span className="truncate text-sm font-semibold text-sky-50">{friend.username}</span>
                    </div>
                    <span className="text-xs uppercase tracking-[0.35em] text-emerald-200/80">Invite</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!loading && !error && hasOffline && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-300/75">Offline</p>
              <div className="mt-3 grid gap-2">
                {offlineFriends.map((friend) => (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() => onSelect(friend)}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-slate-600/35 bg-slate-950/45 px-4 py-3 text-left transition hover:border-violet-300/50 hover:bg-violet-500/10"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-500/40 bg-slate-900/40 text-xs font-semibold text-sky-100/85">
                        {initials(friend.username)}
                      </span>
                      <span className="truncate text-sm font-semibold text-sky-50">{friend.username}</span>
                    </div>
                    <span className="text-xs uppercase tracking-[0.35em] text-sky-100/70">Invite</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
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
  if (!open) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
      <button
        type="button"
        aria-label="Close invite modal"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-3xl border border-violet-400/30 bg-[#050b18] p-7 shadow-[0_0_60px_rgba(139,92,246,0.25)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-violet-300/80">Invite ready</p>
            <h2 className="mt-2 text-2xl font-semibold text-sky-50">Send this link to your friend</h2>
            <p className="mt-2 text-sm text-sky-100/70">
              {friend ? (
                <>
                  Inviting <span className="font-semibold text-sky-50">{friend.username}</span>
                </>
              ) : (
                "Inviting friend"
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-violet-400/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-sky-100/80 transition hover:border-violet-200 hover:bg-violet-500/15"
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {creating && <p className="text-sm text-sky-100/70">Creating invite…</p>}
          {!creating && error && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</div>
          )}

          {!creating && matchId && (
            <div className="rounded-2xl border border-slate-600/30 bg-slate-950/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-300/75">Invite link</p>
              <p className="mt-2 break-all text-sm text-sky-50">{inviteLink}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!canCopy}
                  className="rounded-full border border-sky-500/35 bg-sky-500/15 px-5 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-sky-50 transition hover:border-sky-200 hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Copy link
                </button>
                <button
                  type="button"
                  onClick={() => onStart(matchId)}
                  className="rounded-full border border-violet-400/70 bg-violet-500/20 px-5 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-violet-50 shadow-[0_0_34px_rgba(139,92,246,0.35)] transition hover:border-violet-200 hover:bg-violet-500/30"
                >
                  Start match
                </button>
              </div>
              <p className="mt-3 text-xs text-sky-100/60">
                Your friend can open the link and will be able to join instantly.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type ModeCardProps = {
  mode: ModeDefinition;
  onClick?: () => void;
  playful?: boolean;
};

function ModeCard({ mode, onClick, playful = false }: ModeCardProps) {
  const { title, subtitle, badge, details, enabled, accent, impact } = mode;
  const baseClasses = "group relative flex h-full flex-col justify-between gap-8 rounded-3xl border px-8 py-10 transition";
  const enabledClasses = enabled
    ? `border-sky-500/25 bg-gradient-to-br ${accent} hover:-translate-y-1 hover:shadow-[0_0_45px_rgba(56,189,248,0.25)] hover:border-sky-300/60`
    : "border-slate-700/60 bg-slate-900/60 text-slate-400";

  const impactStyles = playful
    ? "border-fuchsia-300/60 bg-fuchsia-400/10 text-fuchsia-100"
    : "border-emerald-300/60 bg-emerald-400/10 text-emerald-200";

  const playNowStyles = playful
    ? "border-fuchsia-400/60 bg-fuchsia-500/15 text-fuchsia-100 group-hover:border-fuchsia-200 group-hover:bg-fuchsia-500/30 group-hover:text-fuchsia-50"
    : "border-sky-400/60 bg-sky-500/15 text-sky-100 group-hover:border-sky-200 group-hover:bg-sky-500/30 group-hover:text-sky-50";

  const content = (
    <div className="flex h-full flex-col gap-8">
      <div className="space-y-4">
        <h3 className="text-3xl font-semibold text-sky-50">{title}</h3>
        <p className="text-base text-sky-100/70">{subtitle}</p>
      </div>
      {details && (
        <ul className="space-y-3 text-sm text-sky-100/60">
          {details.slice(0, 3).map((detail) => (
            <li key={detail} className="flex items-start gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sky-300/70" />
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-4">
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-5 py-2 text-[13px] uppercase tracking-[0.35em] ${impactStyles}`}
        >
          {impact}
        </span>
        {badge && (
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 px-4 py-2 text-[12px] uppercase tracking-[0.35em] text-sky-200/80">
            {badge}
          </span>
        )}
      </div>
      {enabled && (
        <span
          className={`mt-6 inline-flex w-max items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] shadow-[0_0_24px_rgba(56,189,248,0.3)] transition ${playNowStyles}`}
        >
          Play Now
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="m8 5 8 7-8 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
      {!enabled && (
        <div className="absolute right-8 top-8 flex items-center gap-2 text-sm uppercase tracking-[0.35em] text-slate-300">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
            <path d="M7 10V7a5 5 0 0 1 10 0v3h1.5a1.5 1.5 0 0 1 1.5 1.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-7.5A1.5 1.5 0 0 1 5.5 10H7Zm2-3a3 3 0 1 1 6 0v3H9Z" />
          </svg>
          Locked
        </div>
      )}
    </div>
  );

  if (!enabled) {
    return <div className={`${baseClasses} ${enabledClasses}`}>{content}</div>;
  }

  if (!onClick) {
    return <div className={`${baseClasses} ${enabledClasses}`}>{content}</div>;
  }

  return (
    <button type="button" onClick={onClick} className={`${baseClasses} ${enabledClasses}`}>
      {content}
    </button>
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

  const gradient = `bg-gradient-to-br ${mode.accent || "from-slate-900/80 to-slate-900/40"}`;

  return (
    <section className={`flex flex-col gap-10 rounded-3xl border border-sky-500/25 ${gradient} p-10 shadow-[0_0_55px_rgba(99,102,241,0.28)] lg:flex-row`}>
      <div className="flex flex-1 flex-col gap-6">
        <button
          type="button"
          onClick={onBack}
          className="w-max rounded-full border border-sky-500/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-sky-100/80 transition hover:border-sky-200 hover:bg-sky-500/20"
        >
          Back to modes
        </button>
        <div className="space-y-4">
          <h2 className="text-4xl font-semibold text-sky-50">{mode.title}</h2>
          <p className="text-sm text-sky-100/75">{mode.subtitle}</p>
          {mode.details && (
            <ul className="space-y-2 text-sm text-sky-100/70">
              {mode.details.map((detail) => (
                <li key={detail} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-sky-300" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-fuchsia-300/60 bg-fuchsia-400/20 px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.4em] text-fuchsia-50">
            {mode.impact}
          </span>
          {(mode.id === "ranked" || mode.id === "unranked") && (
            <span className="rounded-full border border-emerald-300/50 bg-emerald-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-emerald-100">
              Ranked lane now: {rankedBand.difficulty}
            </span>
          )}
          {mode.limited && (
            <span className="rounded-full border border-amber-300/50 bg-amber-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.4em] text-amber-100">
              Limited-time
            </span>
          )}
          {preset.note && <span className="text-xs text-sky-100/65">{preset.note}</span>}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-6 rounded-2xl border border-sky-500/25 bg-[#050b1c]/70 p-8">
        <h3 className="text-lg font-semibold text-sky-50">Match setup</h3>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="flex flex-col gap-3 text-xs font-semibold uppercase tracking-[0.35em] text-sky-400/70">
            Timer preset
            <select
              value={timer}
              onChange={(event) => setTimer(event.target.value)}
              className="rounded-2xl border border-sky-500/30 bg-[#040a16] px-4 py-3 text-sm font-medium text-sky-100 focus:border-sky-300 focus:outline-none"
            >
              {(preset.timers.length ? preset.timers : DEFAULT_CONFIG_PRESET.timers).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-3 text-xs font-semibold uppercase tracking-[0.35em] text-sky-400/70">
            Preferred language
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="rounded-2xl border border-sky-500/30 bg-[#040a16] px-4 py-3 text-sm font-medium text-sky-100 focus:border-sky-300 focus:outline-none"
            >
              {(preset.languages.length ? preset.languages : DEFAULT_CONFIG_PRESET.languages).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-3 text-xs font-semibold uppercase tracking-[0.35em] text-sky-400/70">
            Players / queue
            <select
              value={players}
              onChange={(event) => setPlayers(event.target.value)}
              className="rounded-2xl border border-sky-500/30 bg-[#040a16] px-4 py-3 text-sm font-medium text-sky-100 focus:border-sky-300 focus:outline-none"
            >
              {(preset.playerOptions.length ? preset.playerOptions : DEFAULT_CONFIG_PRESET.playerOptions).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={() => onStart({ timer, language, players })}
          className="mt-4 w-full rounded-full border border-fuchsia-400/70 bg-fuchsia-500/20 px-10 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-fuchsia-50 shadow-[0_0_40px_rgba(217,70,239,0.35)] transition hover:border-fuchsia-200 hover:bg-fuchsia-500/35"
        >
          Start matchmaking
        </button>
      </div>
    </section>
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
  const labelColor = mode.category === "non-ranked" ? "text-fuchsia-300/80" : "text-sky-300/80";
  const gradient =
    mode.category === "non-ranked"
      ? "from-fuchsia-500/20 via-[#0a0d2c] to-[#030611]"
      : "from-sky-500/20 via-[#051028] to-[#020813]";

  return (
    <section className={`relative flex flex-1 flex-col items-center justify-center gap-10 rounded-3xl border border-sky-500/25 bg-gradient-to-br ${gradient} p-12 text-center shadow-[0_0_55px_rgba(56,189,248,0.28)]`}>
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,_rgba(56,189,248,0.25),_transparent_60%)]" />
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-sky-400/20" />
          <div className="absolute inset-3 animate-pulse rounded-full bg-sky-400/10" />
          <div className="relative flex h-full w-full items-center justify-center rounded-full border border-sky-400/70 bg-sky-500/20 text-sky-100 shadow-[0_0_30px_rgba(56,189,248,0.35)]">
            {trophyIcon}
          </div>
        </div>
        <div className="space-y-2">
          <p className={`text-sm uppercase tracking-[0.45em] ${labelColor}`}>{mode.title}</p>
          <h2 className="text-3xl font-semibold text-sky-50">Searching for opponent…</h2>
          <p className="text-sm text-sky-100/70">Time remaining · {formatTime(secondsRemaining)}</p>
          <p className="text-xs uppercase tracking-[0.35em] text-sky-200/70">{mode.impact}</p>
        </div>
        {config && (
          <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs uppercase tracking-[0.25em] text-sky-200/80">
            <span>Timer · {config.timer}</span>
            <span>Queue · {config.players}</span>
            <span>Language · {config.language}</span>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-full border border-sky-400/60 px-10 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-sky-100 transition hover:border-sky-200 hover:bg-sky-500/40"
      >
        Cancel search
      </button>
    </section>
  );
}

type MatchFoundPanelProps = {
  mode: ModeDefinition;
  config: ModeConfigSelection | null;
  onEnter: () => void;
  onStay: () => void;
};

function MatchFoundPanel({ mode, config, onEnter, onStay }: MatchFoundPanelProps) {
  const accentBorder = mode.category === "non-ranked" ? "border-fuchsia-400/40" : "border-emerald-400/40";
  const accentGlow = mode.category === "non-ranked" ? "shadow-[0_0_60px_rgba(217,70,239,0.4)]" : "shadow-[0_0_60px_rgba(16,185,129,0.35)]";
  const gradientClass =
    mode.category === "non-ranked"
      ? "bg-gradient-to-br from-fuchsia-500/12 via-[#2a0a2f] to-[#090510]"
      : "bg-gradient-to-br from-emerald-500/15 via-[#04131b] to-[#01080c]";
  const radialOverlay =
    mode.category === "non-ranked"
      ? "bg-[radial-gradient(circle_at_top,_rgba(217,70,239,0.38),_transparent_55%)]"
      : "bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.35),_transparent_55%)]";
  const headlineAccent = mode.category === "non-ranked" ? "text-fuchsia-300/80" : "text-emerald-300/80";
  const statAccent = mode.category === "non-ranked" ? "text-fuchsia-200/70" : "text-emerald-200/70";
  const titleColor = mode.category === "non-ranked" ? "text-fuchsia-100" : "text-emerald-100";
  const bodyColor = mode.category === "non-ranked" ? "text-fuchsia-100/70" : "text-emerald-100/70";
  const primaryButton =
    mode.category === "non-ranked"
      ? "rounded-full border border-fuchsia-300/80 bg-fuchsia-400/20 px-10 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-fuchsia-50 transition hover:border-fuchsia-200 hover:bg-fuchsia-400/35"
      : "rounded-full border border-emerald-300/80 bg-emerald-400/20 px-10 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-emerald-50 transition hover:border-emerald-200 hover:bg-emerald-400/35";
  const secondaryButton =
    mode.category === "non-ranked"
      ? "rounded-full border border-fuchsia-300/40 px-10 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-fuchsia-100 transition hover:border-fuchsia-200/60 hover:bg-fuchsia-300/10"
      : "rounded-full border border-emerald-300/40 px-10 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-emerald-100 transition hover:border-emerald-200/60 hover:bg-emerald-300/10";

  return (
    <section className={`relative flex flex-1 flex-col items-center justify-center gap-10 overflow-hidden rounded-3xl ${accentBorder} ${gradientClass} p-12 text-center ${accentGlow}`}>
      <div className={`absolute inset-0 -z-10 ${radialOverlay}`} />
      <div className="space-y-3">
        <p className={`text-xs font-semibold uppercase tracking-[0.45em] ${headlineAccent}`}>Opponent found</p>
        <h2 className={`text-4xl font-semibold ${titleColor}`}>{mode.title}</h2>
        <p className={`max-w-lg text-sm ${bodyColor}`}>
          Match created. Enter the arena to start your duel.
        </p>
        <p className={`text-xs uppercase tracking-[0.35em] ${statAccent}`}>{mode.impact}</p>
        {config && (
          <div className={`flex flex-wrap justify-center gap-4 text-xs uppercase tracking-[0.25em] ${statAccent}`}>
            <span>Timer · {config.timer}</span>
            <span>Queue · {config.players}</span>
            <span>Language · {config.language}</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        <button type="button" onClick={onEnter} className={primaryButton}>
          Enter match
        </button>
        <button type="button" onClick={onStay} className={secondaryButton}>
          Back to modes
        </button>
      </div>
    </section>
  );
}

type NoMatchPanelProps = {
  mode: ModeDefinition;
  message: string;
  onBack: () => void;
  onTryAgain: () => void;
};

function NoMatchPanel({ mode, message, onBack, onTryAgain }: NoMatchPanelProps) {
  const accentBorder = mode.category === "non-ranked" ? "border-fuchsia-400/40" : "border-rose-400/40";
  const accentGlow = mode.category === "non-ranked" ? "shadow-[0_0_60px_rgba(217,70,239,0.28)]" : "shadow-[0_0_60px_rgba(244,63,94,0.22)]";
  const gradientClass =
    mode.category === "non-ranked"
      ? "bg-gradient-to-br from-fuchsia-500/12 via-[#200a2a] to-[#090510]"
      : "bg-gradient-to-br from-rose-500/10 via-[#18060d] to-[#06020a]";
  const headlineAccent = mode.category === "non-ranked" ? "text-fuchsia-300/80" : "text-rose-300/80";
  const titleColor = mode.category === "non-ranked" ? "text-fuchsia-100" : "text-rose-100";
  const bodyColor = mode.category === "non-ranked" ? "text-fuchsia-100/70" : "text-rose-100/70";
  const primaryButton =
    mode.category === "non-ranked"
      ? "rounded-full border border-fuchsia-300/80 bg-fuchsia-400/20 px-10 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-fuchsia-50 transition hover:border-fuchsia-200 hover:bg-fuchsia-400/35"
      : "rounded-full border border-rose-300/80 bg-rose-400/15 px-10 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-rose-50 transition hover:border-rose-200 hover:bg-rose-400/25";
  const secondaryButton =
    mode.category === "non-ranked"
      ? "rounded-full border border-fuchsia-300/40 px-10 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-fuchsia-100 transition hover:border-fuchsia-200/60 hover:bg-fuchsia-300/10"
      : "rounded-full border border-rose-300/40 px-10 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-rose-100 transition hover:border-rose-200/60 hover:bg-rose-300/10";

  return (
    <section className={`relative flex flex-1 flex-col items-center justify-center gap-10 overflow-hidden rounded-3xl ${accentBorder} ${gradientClass} p-12 text-center ${accentGlow}`}>
      <div className="space-y-3">
        <p className={`text-xs font-semibold uppercase tracking-[0.45em] ${headlineAccent}`}>Matchmaking</p>
        <h2 className={`text-4xl font-semibold ${titleColor}`}>No opponent found</h2>
        <p className={`max-w-lg text-sm ${bodyColor}`}>{message}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        <button type="button" onClick={onTryAgain} className={primaryButton}>
          Try again
        </button>
        <button type="button" onClick={onBack} className={secondaryButton}>
          Back
        </button>
      </div>
    </section>
  );
}
