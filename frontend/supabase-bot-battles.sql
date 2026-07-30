-- Bot Battle Stats
-- Add bot-specific columns to player_stats

ALTER TABLE public.player_stats
ADD COLUMN IF NOT EXISTS bot_matches_played integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS bot_wins integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS bot_trophies integer DEFAULT 0;
