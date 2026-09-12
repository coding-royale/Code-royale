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

-- Per-attempt feed that powers the live opponent activity panel.
create table if not exists public.match_attempts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  passed int not null default 0,
  total int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.match_attempts enable row level security;
drop policy if exists match_attempts_select_participant on public.match_attempts;
create policy match_attempts_select_participant on public.match_attempts
  for select to authenticated
  using (
    exists (
      select 1 from public.match_players mp
      where mp.match_id = match_attempts.match_id
        and mp.user_id = auth.uid()
    )
  );
create index if not exists idx_match_attempts_match_user
  on public.match_attempts (match_id, user_id, created_at desc);
