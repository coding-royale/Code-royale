-- ============================================================
-- Supabase SQL: Clubs & Leaderboard tables
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- 1) Clubs table
CREATE TABLE IF NOT EXISTS clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  logo TEXT NOT NULL DEFAULT '⚔️',
  emblem TEXT NOT NULL DEFAULT 'sword',
  privacy TEXT NOT NULL DEFAULT 'public' CHECK (privacy IN ('public', 'private')),
  max_members INT NOT NULL DEFAULT 20 CHECK (max_members IN (10, 20, 30, 40)),
  trophies INT NOT NULL DEFAULT 0,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Club members (junction)
CREATE TABLE IF NOT EXISTS club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('host', 'elder', 'member')),
  trophies_contributed INT NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(club_id, user_id)
);

-- 3) Club join requests (for private clubs)
CREATE TABLE IF NOT EXISTS club_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(club_id, user_id)
);

-- 4) Player stats / leaderboard
CREATE TABLE IF NOT EXISTS player_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL DEFAULT 'Player',
  avatar_url TEXT,
  -- ELO / trophies for each mode
  trophies_1v1 INT NOT NULL DEFAULT 0,
  trophies_2v2 INT NOT NULL DEFAULT 0,
  wins_1v1 INT NOT NULL DEFAULT 0,
  losses_1v1 INT NOT NULL DEFAULT 0,
  wins_2v2 INT NOT NULL DEFAULT 0,
  losses_2v2 INT NOT NULL DEFAULT 0,
  matches_played INT NOT NULL DEFAULT 0,
  -- League: bronze, silver, gold, platinum, diamond
  league TEXT NOT NULL DEFAULT 'bronze' CHECK (league IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5) Indexes
CREATE INDEX IF NOT EXISTS idx_club_members_user ON club_members(user_id);
CREATE INDEX IF NOT EXISTS idx_club_members_club ON club_members(club_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_1v1 ON player_stats(trophies_1v1 DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_2v2 ON player_stats(trophies_2v2 DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_league ON player_stats(league, trophies_1v1 DESC);
CREATE INDEX IF NOT EXISTS idx_clubs_trophies ON clubs(trophies DESC);

-- 6) RLS policies (enable Row Level Security)
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

-- Everyone can read clubs
CREATE POLICY "clubs_select" ON clubs FOR SELECT USING (true);
-- Only owners can update their club
CREATE POLICY "clubs_update" ON clubs FOR UPDATE USING (auth.uid() = owner_id);
-- Authenticated users can insert
CREATE POLICY "clubs_insert" ON clubs FOR INSERT WITH CHECK (auth.uid() = owner_id);
-- Only owners can delete
CREATE POLICY "clubs_delete" ON clubs FOR DELETE USING (auth.uid() = owner_id);

-- Club members: everyone can read, users manage own membership
CREATE POLICY "club_members_select" ON club_members FOR SELECT USING (true);
CREATE POLICY "club_members_insert" ON club_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "club_members_delete" ON club_members FOR DELETE USING (auth.uid() = user_id);

-- Join requests: users can see their own + club host can see club's requests
CREATE POLICY "join_requests_select" ON club_join_requests FOR SELECT USING (
  auth.uid() = user_id OR
  club_id IN (SELECT id FROM clubs WHERE owner_id = auth.uid())
);
CREATE POLICY "join_requests_insert" ON club_join_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "join_requests_update" ON club_join_requests FOR UPDATE USING (
  club_id IN (SELECT id FROM clubs WHERE owner_id = auth.uid())
);

-- Player stats: everyone can read, users update own row
CREATE POLICY "player_stats_select" ON player_stats FOR SELECT USING (true);
CREATE POLICY "player_stats_insert" ON player_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "player_stats_update" ON player_stats FOR UPDATE USING (auth.uid() = user_id);

-- 7) Helper function: get member count for a club
CREATE OR REPLACE FUNCTION get_club_member_count(p_club_id UUID)
RETURNS INT AS $$
  SELECT COUNT(*)::INT FROM club_members WHERE club_id = p_club_id;
$$ LANGUAGE SQL STABLE;

-- ============================================================
-- Practice Questions, Matches & Matchmaking tables
-- ============================================================

-- 8) Practice questions (seeded via bun run seed:pvp)
CREATE TABLE IF NOT EXISTS practice_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  languages TEXT[] NOT NULL DEFAULT '{}',
  testcases JSONB NOT NULL DEFAULT '[]',
  meta JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practice_questions_difficulty ON practice_questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_practice_questions_slug ON practice_questions(slug);

-- 9) Matches
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL DEFAULT 'ranked' CHECK (mode IN ('ranked', 'unranked')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10) Match players (junction)
CREATE TABLE IF NOT EXISTS match_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(match_id, user_id)
);

-- 11) Matchmaking queue
CREATE TABLE IF NOT EXISTS matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'ranked' CHECK (mode IN ('ranked', 'unranked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_mode ON matchmaking_queue(mode, created_at);

-- RLS for new tables
ALTER TABLE practice_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practice_questions_select" ON practice_questions FOR SELECT USING (true);
CREATE POLICY "matches_select" ON matches FOR SELECT USING (true);
CREATE POLICY "match_players_select" ON match_players FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "matchmaking_queue_select" ON matchmaking_queue FOR SELECT USING (auth.uid() = user_id);

-- 12) Practice submissions (for real profile/home progress)
CREATE TABLE IF NOT EXISTS practice_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES practice_questions(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  passed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practice_submissions_user_created
  ON practice_submissions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_submissions_user_question_passed
  ON practice_submissions(user_id, question_id, passed);

ALTER TABLE practice_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "practice_submissions_select_own" ON practice_submissions;
CREATE POLICY "practice_submissions_select_own"
  ON practice_submissions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "practice_submissions_insert_own" ON practice_submissions;
CREATE POLICY "practice_submissions_insert_own"
  ON practice_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
