"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { AppShell } from "../../components/app-shell";
import { supabase } from "../../lib/supabase-browser";

type Badge = {
  id: string;
  name: string;
  description: string;
  icon: string;
  awarded_at: string;
};

type UserRow = {
  id: string;
  username: string | null;
  rating: number | null;
  wins: number | null;
  losses: number | null;
  team_name?: string | null;
  club_id?: string | null;
  club_name?: string | null;
  club_logo?: string | null;
  club_trophies?: number | null;
  badges?: Badge[];
};

type RelationshipStatus =
  | "none"
  | "incoming_pending"
  | "outgoing_pending"
  | "friends"
  | "blocked"
  | "blocked_by_other";

function getRankFromRating(rating: number) {
  if (rating >= 600) return { name: "Gold", color: "text-amber-400" };
  if (rating >= 400) return { name: "Silver", color: "text-slate-300" };
  if (rating >= 200) return { name: "Bronze", color: "text-orange-400" };
  return { name: "Unranked", color: "text-[var(--cr-fg-muted)]" };
}

function initialsFromName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "CR";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "C";
  const second = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1];
  return `${first}${second ?? "R"}`.toUpperCase();
}

function ProfileContent() {
  const searchParams = useSearchParams();
  const targetUserIdParam = searchParams.get("userId");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserRow | null>(null);
  const [friendCount, setFriendCount] = useState(0);
  const [isFriendWithViewer, setIsFriendWithViewer] = useState(false);
  const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus>("none");
  const [actionBusy, setActionBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState("Harassment");
  const [reportDescription, setReportDescription] = useState("");
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const resolvedUserId = targetUserIdParam ?? viewerUserId;
  const isSelf = Boolean(resolvedUserId && viewerUserId && resolvedUserId === viewerUserId);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (!mounted) return;

      if (authError) {
        setError(authError.message);
        setViewerUserId(null);
      } else {
        setViewerUserId(authData.user?.id ?? null);
      }

      const idToLoad = targetUserIdParam ?? authData.user?.id;
      if (!idToLoad) {
        setError("You must be signed in to view profiles.");
        setLoading(false);
        return;
      }

      const [friendCountResponse, relationshipResult] = await Promise.all([
        fetch(`/api/friends/meta?userIds=${encodeURIComponent(idToLoad)}`, { cache: "no-store" }),
        authData.user?.id && authData.user.id !== idToLoad
          ? supabase
              .from("connections")
            .select("user_id,connection_id,status")
              .or(`and(user_id.eq.${authData.user.id},connection_id.eq.${idToLoad}),and(user_id.eq.${idToLoad},connection_id.eq.${authData.user.id})`)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (!mounted) return;

      if (friendCountResponse.ok) {
        const payload = (await friendCountResponse.json()) as { counts?: Record<string, number> };
        setFriendCount(payload.counts?.[idToLoad] ?? 0);
      } else {
        setFriendCount(0);
      }

      const connectionRows = (relationshipResult.data ?? []) as Array<{
        user_id: string;
        connection_id: string;
        status: "pending" | "accepted" | "blocked";
      }>;

      const outgoing = connectionRows.find(
        (row) => row.user_id === authData.user?.id && row.connection_id === idToLoad,
      );
      const incoming = connectionRows.find(
        (row) => row.user_id === idToLoad && row.connection_id === authData.user?.id,
      );

      let resolvedRelationship: RelationshipStatus = "none";
      if (outgoing?.status === "blocked") resolvedRelationship = "blocked";
      else if (incoming?.status === "blocked") resolvedRelationship = "blocked_by_other";
      else if (outgoing?.status === "accepted" || incoming?.status === "accepted") resolvedRelationship = "friends";
      else if (outgoing?.status === "pending") resolvedRelationship = "outgoing_pending";
      else if (incoming?.status === "pending") resolvedRelationship = "incoming_pending";

      setRelationshipStatus(resolvedRelationship);

      const hasFriendConnection = resolvedRelationship === "friends";
      setIsFriendWithViewer(hasFriendConnection);

      const [
        { data: userRow, error: profileError },
        { data: badgesData },
        clubMembersResult,
      ] = await Promise.all([
        supabase
          .from("users")
          .select("id, username, rating, wins, losses, team_name")
          .eq("id", idToLoad)
          .maybeSingle(),
        supabase
          .from("user_badges")
          .select(`
            awarded_at,
            badge:badges (
              id,
              name,
              description,
              icon
            )
          `)
          .eq("user_id", idToLoad),
        supabase
          .from("club_members")
          .select("club_id")
          .eq("user_id", idToLoad)
          .maybeSingle(),
      ]);

      const clubMembership = clubMembersResult as { data?: { club_id?: string } | null } | null;

      let clubInfo:
        | { id: string; name: string; logo: string; trophies: number }
        | null = null;

      if (clubMembership?.data?.club_id) {
        const { data: clubRow } = await supabase
          .from("clubs")
          .select("id, name, logo, trophies")
          .eq("id", clubMembership.data.club_id)
          .maybeSingle();
        if (clubRow) {
          clubInfo = clubRow as { id: string; name: string; logo: string; trophies: number };
        }
      }

      if (!mounted) return;

      if (profileError) {
        setError(profileError.message);
      } else if (!userRow) {
        setError("User not found.");
      } else {
        const parsedBadges = (badgesData as any[] | null)?.map((b) => ({
          id: b.badge.id,
          name: b.badge.name,
          description: b.badge.description,
          icon: b.badge.icon,
          awarded_at: b.awarded_at,
        })) || [];
        
        setProfile({
          ...userRow as UserRow,
          badges: parsedBadges,
          club_id: clubInfo?.id ?? null,
          club_name: clubInfo?.name ?? null,
          club_logo: clubInfo?.logo ?? null,
          club_trophies: clubInfo?.trophies ?? null,
        });
      }

      setLoading(false);
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [targetUserIdParam]);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  const displayName = profile?.username || "Anonymous";
  const initials = initialsFromName(displayName);
  const rating = profile?.rating ?? 0;
  const rank = getRankFromRating(rating);
  const wins = profile?.wins ?? 0;
  const losses = profile?.losses ?? 0;
  const totalMatches = wins + losses;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  const sendFriendRequest = async () => {
    if (!viewerUserId || !resolvedUserId || isSelf) return;

    setActionBusy(true);
    setError(null);

    const { error: requestError } = await supabase
      .from("connections")
      .insert({ user_id: viewerUserId, connection_id: resolvedUserId, status: "pending" });

    if (requestError) {
      setError(requestError.message);
      setActionBusy(false);
      return;
    }

    setRelationshipStatus("outgoing_pending");
    setActionBusy(false);
  };

  const acceptFriendRequest = async () => {
    if (!viewerUserId || !resolvedUserId || isSelf) return;

    setActionBusy(true);
    setError(null);

    const { error: acceptError } = await supabase
      .from("connections")
      .update({ status: "accepted" })
      .match({ user_id: resolvedUserId, connection_id: viewerUserId });

    if (acceptError) {
      setError(acceptError.message);
      setActionBusy(false);
      return;
    }

    setRelationshipStatus("friends");
    setIsFriendWithViewer(true);
    setFriendCount((prev) => prev + 1);
    setActionBusy(false);
  };

  const declineFriendRequest = async () => {
    if (!viewerUserId || !resolvedUserId || isSelf) return;

    setActionBusy(true);
    setError(null);

    const { error: declineError } = await supabase
      .from("connections")
      .delete()
      .match({ user_id: resolvedUserId, connection_id: viewerUserId, status: "pending" });

    if (declineError) {
      setError(declineError.message);
      setActionBusy(false);
      return;
    }

    setRelationshipStatus("none");
    setActionBusy(false);
  };

  const updateBlockStatus = async (action: "block" | "unblock") => {
    if (!resolvedUserId || isSelf) return;

    setActionBusy(true);
    setError(null);

    const response = await fetch("/api/friends/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        targetUserId: resolvedUserId,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Unable to update block status right now.");
      setActionBusy(false);
      return;
    }

    if (action === "block") {
      setRelationshipStatus("blocked");
      setIsFriendWithViewer(false);
    } else {
      setRelationshipStatus("none");
    }

    setActionBusy(false);
    setMenuOpen(false);
  };

  const submitReport = () => {
    setReportSubmitted(true);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--cr-border)] border-t-[rgb(var(--cr-accent-rgb))]" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-center">
            <p className="text-red-400">{error}</p>
            <Link
              href="/auth/login"
              className="mt-4 inline-block text-sm text-[rgb(var(--cr-accent-rgb))] hover:underline"
            >
              Sign in to view profile
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Profile Header */}
            <section className="rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] p-6">
              <div className="flex flex-wrap items-start gap-6">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[rgba(var(--cr-accent-rgb),0.2)] text-2xl font-bold text-[rgb(var(--cr-accent-rgb))]">
                  {initials}
                </div>
                <div className="flex-1">
                  {!isSelf && (
                    <div className="relative mb-2 flex justify-end" ref={menuRef}>
                      <button
                        type="button"
                        onClick={() => setMenuOpen((prev) => !prev)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg)] text-[var(--cr-fg-muted)] hover:text-[var(--cr-fg)]"
                        aria-label="Open profile actions"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75h.008v.008H12V6.75zm0 5.25h.008v.008H12V12zm0 5.25h.008v.008H12v-.008z" />
                        </svg>
                      </button>

                      {menuOpen && (
                        <div className="absolute right-0 top-11 z-20 w-44 rounded-xl border border-[var(--cr-border)] bg-[var(--cr-bg)] p-1 shadow-[0_12px_32px_rgba(2,8,25,0.55)]">
                          {relationshipStatus !== "blocked" ? (
                            <button
                              type="button"
                              onClick={() => void updateBlockStatus("block")}
                              className="w-full rounded-lg px-3 py-2 text-left text-sm text-rose-300 hover:bg-rose-500/10"
                            >
                              Block User
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void updateBlockStatus("unblock")}
                              className="w-full rounded-lg px-3 py-2 text-left text-sm text-emerald-300 hover:bg-emerald-500/10"
                            >
                              Unblock User
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setReportModalOpen(true);
                              setReportSubmitted(false);
                              setMenuOpen(false);
                            }}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--cr-fg)] hover:bg-[var(--cr-bg-secondary)]"
                          >
                            Report User
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-bold text-[var(--cr-fg)]">{displayName}</h1>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${rank.color}`}>
                      {rank.name}
                    </span>
                    {!isSelf && isFriendWithViewer && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11c1.657 0 3-1.567 3-3.5S17.657 4 16 4s-3 1.567-3 3.5 1.343 3.5 3 3.5zM8 11c1.657 0 3-1.567 3-3.5S9.657 4 8 4 5 5.567 5 7.5 6.343 11 8 11zm0 2c-2.761 0-5 2.015-5 4.5V20h10v-2.5c0-2.485-2.239-4.5-5-4.5zm8 0a5.76 5.76 0 00-1.16.118A6.52 6.52 0 0119 17.5V20h5v-2.5c0-2.485-2.239-4.5-5-4.5z" />
                        </svg>
                        Friends
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-[var(--cr-fg-muted)]">Friends: {friendCount}</p>
                  {profile?.team_name && (
                    <p className="mt-1 text-sm text-[var(--cr-fg-muted)]">
                      Team: {profile.team_name}
                    </p>
                  )}
                  {/* Club Badge */}
                  {profile?.club_name && (
                    <Link
                      href={profile.club_id ? `/clubs/${profile.club_id}` : "/clubs"}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg)] px-3 py-1.5 text-sm transition-colors hover:border-[rgba(var(--cr-accent-rgb),0.3)]"
                    >
                      <span className="text-lg">{profile.club_logo || "🏆"}</span>
                      <span className="font-medium text-[var(--cr-fg)]">{profile.club_name}</span>
                      <span className="flex items-center gap-1 text-xs text-amber-400">
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 4h-1V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v1H5a1 1 0 0 0-1 1v2a4 4 0 0 0 3 3.87A6 6 0 0 0 11 14.9V17H8a1 1 0 0 0 0 2h8a1 1 0 1 0 0-2h-3v-2.1a6 6 0 0 0 4-3.99 4 4 0 0 0 3-3.87V5a1 1 0 0 0-1-1Z"/>
                        </svg>
                        {(profile.club_trophies ?? 0).toLocaleString()}
                      </span>
                    </Link>
                  )}

                  {/* Badges */}
                  {profile?.badges && profile.badges.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--cr-fg-muted)] mb-2">Badges ({profile.badges.length})</h3>
                      <div className="flex flex-wrap gap-2">
                        {profile.badges.map((badge) => (
                          <div
                            key={badge.id}
                            title={badge.description}
                            className="group relative flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg)] transition-colors hover:border-[rgba(var(--cr-accent-rgb),0.3)]"
                          >
                            <span className="text-xl cursor-help">{badge.icon}</span>
                            <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 z-10 shadow-lg">
                              <p className="font-semibold">{badge.name}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isSelf && (
                    <Link
                      href="/settings"
                      className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg)] px-4 py-2 text-sm font-medium text-[var(--cr-fg)] transition-colors hover:bg-[var(--cr-bg-tertiary)]"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                      Edit Profile
                    </Link>
                  )}
                  {!isSelf && relationshipStatus === "none" && (
                    <button
                      type="button"
                      onClick={sendFriendRequest}
                      disabled={actionBusy}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg)] px-4 py-2 text-sm font-medium text-[var(--cr-fg)] transition-colors hover:bg-[var(--cr-bg-tertiary)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {actionBusy ? "Sending..." : "Add Friend"}
                    </button>
                  )}
                  {!isSelf && relationshipStatus === "incoming_pending" && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={acceptFriendRequest}
                        disabled={actionBusy}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionBusy ? "Updating..." : "Accept Request"}
                      </button>
                      <button
                        type="button"
                        onClick={declineFriendRequest}
                        disabled={actionBusy}
                        className="inline-flex items-center gap-2 rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg)] px-4 py-2 text-sm font-medium text-[var(--cr-fg)] transition-colors hover:bg-[var(--cr-bg-tertiary)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  {!isSelf && relationshipStatus === "outgoing_pending" && (
                    <span className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg)] px-4 py-2 text-sm font-medium text-[var(--cr-fg-muted)]">
                      Request Sent
                    </span>
                  )}
                  {!isSelf && relationshipStatus === "blocked" && (
                    <span className="mt-4 inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200">
                      User blocked
                    </span>
                  )}
                  {!isSelf && relationshipStatus === "blocked_by_other" && (
                    <span className="mt-4 inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200">
                      You are blocked by this user
                    </span>
                  )}
                </div>
              </div>
            </section>

            {/* Stats Grid */}
            <section className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] p-4 text-center">
                <div className="text-2xl font-bold text-[rgb(var(--cr-accent-rgb))]">{rating}</div>
                <div className="mt-1 text-xs text-[var(--cr-fg-muted)]">Rating</div>
              </div>
              <div className="rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] p-4 text-center">
                <div className="text-2xl font-bold text-emerald-400">{wins}</div>
                <div className="mt-1 text-xs text-[var(--cr-fg-muted)]">Wins</div>
              </div>
              <div className="rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] p-4 text-center">
                <div className="text-2xl font-bold text-red-400">{losses}</div>
                <div className="mt-1 text-xs text-[var(--cr-fg-muted)]">Losses</div>
              </div>
              <div className="rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] p-4 text-center">
                <div className="text-2xl font-bold text-[var(--cr-fg)]">{winRate}%</div>
                <div className="mt-1 text-xs text-[var(--cr-fg-muted)]">Win Rate</div>
              </div>
            </section>

            {/* Recent Activity */}
            <section className="rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] p-6">
              <h2 className="mb-4 text-lg font-semibold text-[var(--cr-fg)]">Recent Activity</h2>
              <div className="flex items-center justify-center py-8 text-[var(--cr-fg-muted)]">
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="mt-2 text-sm">No recent activity</p>
                  <Link
                    href="/practice"
                    className="mt-4 inline-block text-sm text-[rgb(var(--cr-accent-rgb))] hover:underline"
                  >
                    Start practicing →
                  </Link>
                </div>
              </div>
            </section>

            {/* Achievements */}
            <section className="rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] p-6">
              <h2 className="mb-4 text-lg font-semibold text-[var(--cr-fg)]">Achievements</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { name: "First Win", description: "Win your first match", unlocked: wins > 0 },
                  { name: "5-Win Streak", description: "Win 5 matches in a row", unlocked: false },
                  { name: "Problem Solver", description: "Solve 50 practice problems", unlocked: false },
                ].map((achievement) => (
                  <div
                    key={achievement.name}
                    className={`rounded-lg border p-4 ${
                      achievement.unlocked
                        ? "border-[rgba(var(--cr-accent-rgb),0.3)] bg-[rgba(var(--cr-accent-rgb),0.1)]"
                        : "border-[var(--cr-border)] bg-[var(--cr-bg)] opacity-50"
                    }`}
                  >
                    <div className="text-sm font-medium text-[var(--cr-fg)]">{achievement.name}</div>
                    <div className="mt-1 text-xs text-[var(--cr-fg-muted)]">{achievement.description}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {reportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
            <button
              type="button"
              aria-label="Close report modal"
              className="absolute inset-0 bg-black/60"
              onClick={() => setReportModalOpen(false)}
            />
            <div className="relative w-full max-w-lg rounded-2xl border border-[var(--cr-border)] bg-[var(--cr-bg-secondary)] p-6 shadow-[0_12px_45px_rgba(2,8,25,0.7)]">
              {!reportSubmitted ? (
                <>
                  <h2 className="text-lg font-semibold text-[var(--cr-fg)]">Report {displayName}</h2>
                  <p className="mt-1 text-sm text-[var(--cr-fg-muted)]">Tell us what happened. This is a demo flow for now.</p>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {["Harassment", "Cheating", "Spam", "Inappropriate Name"].map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setReportReason(reason)}
                        className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                          reportReason === reason
                            ? "border-[rgba(var(--cr-accent-rgb),0.6)] bg-[rgba(var(--cr-accent-rgb),0.12)] text-[var(--cr-fg)]"
                            : "border-[var(--cr-border)] bg-[var(--cr-bg)] text-[var(--cr-fg-muted)] hover:text-[var(--cr-fg)]"
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={reportDescription}
                    onChange={(event) => setReportDescription(event.target.value)}
                    placeholder="Describe the issue..."
                    className="mt-4 h-28 w-full rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg)] px-3 py-2 text-sm text-[var(--cr-fg)] placeholder:text-[var(--cr-fg-muted)] focus:border-[rgba(var(--cr-accent-rgb),0.5)] focus:outline-none"
                  />

                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setReportModalOpen(false)}
                      className="rounded-lg border border-[var(--cr-border)] bg-[var(--cr-bg)] px-4 py-2 text-sm text-[var(--cr-fg)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={submitReport}
                      className="rounded-lg bg-[rgb(var(--cr-accent-rgb))] px-4 py-2 text-sm font-semibold text-[var(--cr-bg)]"
                    >
                      Submit Report
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-[var(--cr-fg)]">Report Submitted</h2>
                  <p className="mt-2 text-sm text-[var(--cr-fg-muted)]">
                    Our moderators will review your report. Thank you for helping keep Code Royale safe.
                  </p>
                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setReportModalOpen(false)}
                      className="rounded-lg bg-[rgb(var(--cr-accent-rgb))] px-4 py-2 text-sm font-semibold text-[var(--cr-bg)]"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <AppShell>
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="flex justify-center p-12 text-[var(--cr-fg-muted)]">Loading...</div>
        </div>
      </AppShell>
    }>
      <ProfileContent />
    </Suspense>
  );
}
