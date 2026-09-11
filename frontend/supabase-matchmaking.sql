-- Matchmaking columns required by the API routes.
-- supabase-single-source-reset.sql predates these columns, so a fresh reset
-- breaks queueing (missing expires_at/rating/match_type/...) and match reads
-- (missing match_players.joined_at, matches.status/created_by/started_at).
-- Run this after the reset script. Idempotent: safe to re-run.

alter table public.matchmaking_queue
  add column if not exists rating int not null default 0,
  add column if not exists match_type text not null default '1v1',
  add column if not exists time_limit_seconds int not null default 480,
  add column if not exists language text not null default 'node',
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists expires_at timestamptz not null default (now() + interval '2 minutes');

alter table public.match_players
  add column if not exists joined_at timestamptz not null default now(),
  add column if not exists seat int not null default 0,
  add column if not exists team int;

alter table public.matches
  add column if not exists status text not null default 'active',
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists started_at timestamptz not null default now();

create index if not exists idx_matchmaking_queue_lookup
  on public.matchmaking_queue (mode, match_type, expires_at);
create index if not exists idx_match_players_user_joined
  on public.match_players (user_id, joined_at desc);
