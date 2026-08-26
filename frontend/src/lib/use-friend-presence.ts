"use client";

import { useEffect, useMemo, useState } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase-browser";
import { fetchAvatarMap, getAvatarUrl } from "./avatars";

type ConnectionRow = {
  user_id: string;
  connection_id: string;
  status: "pending" | "accepted" | "blocked";
};

type UserRow = {
  id: string;
  username: string | null;
};

export type FriendPresenceRow = {
  id: string;
  username: string;
  avatarUrl: string | null;
  online: boolean;
};

const PRESENCE_CACHE_TTL = 90_000;
const presenceCache = new Map<string, { rows: Array<{ id: string; username: string; avatarUrl: string | null }>; expiresAt: number }>();

export function useFriendPresence() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [friendRows, setFriendRows] = useState<Array<{ id: string; username: string; avatarUrl: string | null }>>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    let channel: RealtimeChannel | null = null;

    const setup = async () => {
      setLoading(true);
      setError(null);

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!mounted) return;

      if (authError || !authData.user?.id) {
        setViewerId(null);
        setFriendRows([]);
        setOnlineIds(new Set());
        setLoading(false);
        return;
      }

      const currentViewerId = authData.user.id;
      setViewerId(currentViewerId);

      // Aggressive cache: serve friends instantly if cached
      const cachedPresence = presenceCache.get(currentViewerId);
      if (cachedPresence && cachedPresence.expiresAt > Date.now()) {
        setFriendRows(cachedPresence.rows);
        setLoading(false);
      } else {
        const { data: connectionRows, error: connError } = await supabase
          .from("connections")
          .select("user_id,connection_id,status")
          .or(`user_id.eq.${currentViewerId},connection_id.eq.${currentViewerId}`)
          .eq("status", "accepted");

        if (!mounted) return;
        if (connError) {
          setError(connError.message);
          setFriendRows([]);
          setLoading(false);
        } else {
          const rows = (connectionRows ?? []) as ConnectionRow[];
          const friendIds = Array.from(
            new Set(
              rows
                .map((row) => (row.user_id === currentViewerId ? row.connection_id : row.user_id))
                .filter(Boolean),
            ),
          );

          if (friendIds.length === 0) {
            const empty: Array<{ id: string; username: string; avatarUrl: string | null }> = [];
            presenceCache.set(currentViewerId, { rows: empty, expiresAt: Date.now() + PRESENCE_CACHE_TTL });
            setFriendRows(empty);
          } else {
            const { data: usersData, error: usersError } = await supabase
              .from("users")
              .select("id,username")
              .in("id", friendIds);

            if (!mounted) return;
            if (usersError) {
              setError(usersError.message);
              setFriendRows([]);
              setLoading(false);
            } else {
              const avatarMap = await fetchAvatarMap(friendIds);
              if (!mounted) return;

              const mapped = ((usersData ?? []) as UserRow[])
                .map((row) => ({
                  id: row.id,
                  username: row.username?.trim() || "Unknown Pilot",
                  avatarUrl: getAvatarUrl(row.id, row.username?.trim() || "Unknown Pilot", avatarMap),
                }))
                .sort((a, b) => a.username.localeCompare(b.username));

              presenceCache.set(currentViewerId, { rows: mapped, expiresAt: Date.now() + PRESENCE_CACHE_TTL });
              setFriendRows(mapped);
            }
          }
          if (mounted) setLoading(false);
        }
      }

      channel = supabase.channel("global-friend-presence", {
        config: { presence: { key: currentViewerId } },
      });

      channel.on("presence", { event: "sync" }, () => {
        const state = channel?.presenceState() ?? {};
        const present = new Set(Object.keys(state));
        if (!mounted) return;
        setOnlineIds(present);
      });

      channel.subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;

        await channel?.track({
          user_id: currentViewerId,
          seen_at: new Date().toISOString(),
        });
      });

      setLoading(false);
    };

    void setup();

    return () => {
      mounted = false;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, []);

  const friends = useMemo<FriendPresenceRow[]>(() => {
    return friendRows.map((friend) => ({
      ...friend,
      online: onlineIds.has(friend.id),
    }));
  }, [friendRows, onlineIds]);

  const onlineFriendIds = useMemo(() => {
    return friends.filter((friend) => friend.online).map((friend) => friend.id);
  }, [friends]);

  return {
    loading,
    error,
    viewerId,
    friends,
    onlineFriendIds,
  };
}
