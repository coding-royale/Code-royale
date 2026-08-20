-- ============================================================
-- Code Royale: Single Source Supabase Reset + Rebuild
-- WARNING: This script DROPS and RECREATES app tables in public schema.
-- It does NOT touch auth.users.
-- Run this once in Supabase SQL Editor to recover from schema drift.
-- ============================================================

begin;

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 0) Drop app objects in dependency-safe order
-- ------------------------------------------------------------
drop trigger if exists on_auth_user_created_profile on auth.users;
drop function if exists public.handle_new_user_profile() cascade;
drop function if exists public.get_club_member_count(uuid) cascade;
drop function if exists public.set_updated_at() cascade;

drop table if exists public.practice_submissions cascade;
drop table if exists public.match_players cascade;
drop table if exists public.matches cascade;
drop table if exists public.matchmaking_queue cascade;
drop table if exists public.practice_testcases cascade;
drop table if exists public.practice_questions cascade;
drop table if exists public.club_join_requests cascade;
drop table if exists public.club_members cascade;
drop table if exists public.clubs cascade;
drop table if exists public.player_stats cascade;
drop table if exists public.connections cascade;
drop table if exists public.users cascade;

-- ------------------------------------------------------------
-- 1) users (app profile table)
-- ------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  rating int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  team_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, username, rating, wins, losses, team_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'user_name',
      new.raw_user_meta_data->>'preferred_username',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    0,
    0,
    0,
    null
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user_profile() from public;
grant execute on function public.handle_new_user_profile() to service_role;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

-- ------------------------------------------------------------
-- 2) connections
-- ------------------------------------------------------------
create table public.connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, connection_id),
  constraint connections_not_self check (user_id <> connection_id)
);

create index connections_user_idx on public.connections (user_id);
create index connections_connection_idx on public.connections (connection_id);
create index connections_status_idx on public.connections (status);

create trigger connections_set_updated_at
before update on public.connections
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 3) clubs + leaderboard
-- ------------------------------------------------------------
create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  logo text not null default 'sword',
  emblem text not null default 'sword',
  privacy text not null default 'public' check (privacy in ('public', 'private')),
  max_members int not null default 20 check (max_members in (10, 20, 30, 40)),
  trophies int not null default 0,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('host', 'elder', 'member')),
  trophies_contributed int not null default 0,
  joined_at timestamptz not null default now(),
  unique (club_id, user_id),
  unique (user_id)
);

create table public.club_join_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique (club_id, user_id)
);

create table public.player_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null default 'Player',
  avatar_url text,
  trophies_1v1 int not null default 0,
  trophies_2v2 int not null default 0,
  wins_1v1 int not null default 0,
  losses_1v1 int not null default 0,
  wins_2v2 int not null default 0,
  losses_2v2 int not null default 0,
  matches_played int not null default 0,
  league text not null default 'bronze' check (league in ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  updated_at timestamptz not null default now()
);

create index idx_clubs_trophies on public.clubs (trophies desc);
create index clubs_owner_id_idx on public.clubs (owner_id);
create index idx_club_members_user on public.club_members (user_id);
create index idx_club_members_club on public.club_members (club_id);
create index idx_join_requests_club on public.club_join_requests (club_id);
create index idx_join_requests_user on public.club_join_requests (user_id);
create index idx_player_stats_1v1 on public.player_stats (trophies_1v1 desc);
create index idx_player_stats_2v2 on public.player_stats (trophies_2v2 desc);
create index idx_player_stats_league_1v1 on public.player_stats (league, trophies_1v1 desc);

create or replace function public.get_club_member_count(p_club_id uuid)
returns int
language sql
set search_path = ''
stable
as $$
  select count(*)::int from public.club_members where club_id = p_club_id;
$$;

-- ------------------------------------------------------------
-- 4) practice + matchmaking
-- ------------------------------------------------------------
create table public.practice_questions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  languages text[] not null default '{}',
  testcases jsonb not null default '[]'::jsonb,
  meta jsonb default null,
  created_at timestamptz not null default now()
);

-- Legacy fallback table still referenced by app code.
create table public.practice_testcases (
  id bigint generated always as identity primary key,
  question_id uuid not null references public.practice_questions(id) on delete cascade,
  stdin text not null,
  expected_output text not null,
  hidden boolean not null default true
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  mode text not null default 'ranked' check (mode in ('ranked', 'unranked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (match_id, user_id)
);

create table public.matchmaking_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'ranked' check (mode in ('ranked', 'unranked')),
  created_at timestamptz not null default now()
);

create table public.practice_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.practice_questions(id) on delete cascade,
  language text not null,
  passed boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_practice_questions_difficulty on public.practice_questions (difficulty);
create index idx_practice_questions_slug on public.practice_questions (slug);
create index idx_matchmaking_queue_mode on public.matchmaking_queue (mode, created_at);
create index matchmaking_queue_user_id_idx on public.matchmaking_queue (user_id);
create index idx_practice_submissions_user_created on public.practice_submissions (user_id, created_at desc);
create index idx_practice_submissions_user_question_passed on public.practice_submissions (user_id, question_id, passed);
create index practice_submissions_question_id_idx on public.practice_submissions (question_id);

-- ------------------------------------------------------------
-- 5) RLS + policies (idempotent after reset)
-- ------------------------------------------------------------
alter table public.users enable row level security;
alter table public.connections enable row level security;
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_join_requests enable row level security;
alter table public.player_stats enable row level security;
alter table public.practice_questions enable row level security;
alter table public.practice_testcases enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.matchmaking_queue enable row level security;
alter table public.practice_submissions enable row level security;

-- users
create policy users_select_authenticated on public.users
for select to authenticated
using (true);

create policy users_insert_self on public.users
for insert to authenticated
with check (id = auth.uid());

create policy users_update_self on public.users
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- connections
create policy connections_select_involved on public.connections
for select to authenticated
using (auth.uid() = user_id or auth.uid() = connection_id);

create policy connections_insert_sender on public.connections
for insert to authenticated
with check (auth.uid() = user_id and status = 'pending');

create policy connections_update_sender on public.connections
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy connections_update_receiver_pending on public.connections
for update to authenticated
using (auth.uid() = connection_id and status = 'pending')
with check (auth.uid() = connection_id and status in ('accepted', 'blocked'));

create policy connections_delete_involved on public.connections
for delete to authenticated
using (auth.uid() = user_id or auth.uid() = connection_id);

-- clubs
create policy clubs_select on public.clubs
for select using (true);

create policy clubs_insert on public.clubs
for insert to authenticated
with check (auth.uid() = owner_id);

create policy clubs_update on public.clubs
for update to authenticated
using (auth.uid() = owner_id);

create policy clubs_delete on public.clubs
for delete to authenticated
using (auth.uid() = owner_id);

create policy club_members_select on public.club_members
for select using (true);

create policy club_members_insert on public.club_members
for insert to authenticated
with check (auth.uid() = user_id);

create policy club_members_delete on public.club_members
for delete to authenticated
using (auth.uid() = user_id);

create policy join_requests_select on public.club_join_requests
for select to authenticated
using (
  auth.uid() = user_id
  or club_id in (select id from public.clubs where owner_id = auth.uid())
);

create policy join_requests_insert on public.club_join_requests
for insert to authenticated
with check (auth.uid() = user_id);

create policy join_requests_update on public.club_join_requests
for update to authenticated
using (
  club_id in (select id from public.clubs where owner_id = auth.uid())
);

create policy player_stats_select on public.player_stats
for select using (true);

create policy player_stats_insert on public.player_stats
for insert to authenticated
with check (auth.uid() = user_id);

create policy player_stats_update on public.player_stats
for update to authenticated
using (auth.uid() = user_id);

-- practice
create policy practice_questions_select on public.practice_questions
for select using (true);

create policy practice_testcases_select on public.practice_testcases
for select using (true);

create policy practice_submissions_select_own on public.practice_submissions
for select to authenticated
using (auth.uid() = user_id);

create policy practice_submissions_insert_own on public.practice_submissions
for insert to authenticated
with check (auth.uid() = user_id);

-- matchmaking and matches
create policy matchmaking_queue_select_own on public.matchmaking_queue
for select to authenticated
using (auth.uid() = user_id);

create policy matchmaking_queue_insert_own on public.matchmaking_queue
for insert to authenticated
with check (auth.uid() = user_id);

create policy matchmaking_queue_delete_own on public.matchmaking_queue
for delete to authenticated
using (auth.uid() = user_id);

create policy match_players_select_own on public.match_players
for select to authenticated
using (auth.uid() = user_id);

create policy matches_select_participant on public.matches
for select to authenticated
using (
  exists (
    select 1
    from public.match_players mp
    where mp.match_id = matches.id
      and mp.user_id = auth.uid()
  )
);

create policy match_players_insert_service on public.match_players
for insert
with check (auth.role() = 'service_role');

create policy matches_insert_service on public.matches
for insert
with check (auth.role() = 'service_role');

-- ------------------------------------------------------------
-- 6) Backfill app user profiles for already-registered auth users
-- ------------------------------------------------------------
insert into public.users (id, username, rating, wins, losses, team_name)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1)),
  0,
  0,
  0,
  null
from auth.users u
left join public.users p on p.id = u.id
where p.id is null;

commit;

-- After this script:
-- 1) Rerun your seed script for practice questions if needed.
-- 2) Redeploy app.
