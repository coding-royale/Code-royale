-- ------------------------------------------------------------
-- Server-side matchmaking.
--
-- Pairing used to live in the browser's HTTP request: `/api/matchmaking/join`
-- ran an 8-second polling loop that read the queue, guessed at candidates,
-- deleted their rows to "claim" them, and then created the match. The client
-- also polled `/status` every 1.5s, but `/status` only READS — it never
-- paired. So if two players' join windows happened to miss each other, they
-- both sat queued and both timed out after 60s, never matched, despite being
-- perfectly matchable. That is the "doesn't connect both players" bug.
--
-- The claim protocol was also not atomic. Deleting queue rows and inserting a
-- match are separate statements, so a request that died between them removed
-- both players from the queue and created no match at all. Re-queue logic and
-- "are they still there?" re-reads were band-aids over that window.
--
-- This replaces all of it with two functions:
--
--   matchmaking_enqueue(...)  upsert one queue row, keeping the player's place
--   matchmaking_pair(uid)     one atomic transaction: read, claim, create match
--
-- Both are SECURITY DEFINER because `matchmaking_queue` is not readable by
-- clients. A PostgREST call runs in a single transaction, so an error anywhere
-- rolls the whole thing back: no half-claimed queue, ever.
--
-- Pairing is serialised with a transaction-scoped advisory lock, so two
-- concurrent callers cannot pair the same player twice. Candidates are taken
-- with `FOR UPDATE SKIP LOCKED`, so a second caller takes a different set
-- instead of blocking.
-- ------------------------------------------------------------

-- One queue row per player. Without this, two concurrent joins could insert
-- two rows for the same user, and that user could be paired with themselves.
with ranked as (
  select id, row_number() over (partition by user_id order by created_at, id) as rn
  from public.matchmaking_queue
)
delete from public.matchmaking_queue q
using ranked r
where q.id = r.id and r.rn > 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.matchmaking_queue'::regclass
      and conname = 'matchmaking_queue_user_id_key'
  ) then
    alter table public.matchmaking_queue
      add constraint matchmaking_queue_user_id_key unique (user_id);
  end if;
end $$;

-- ------------------------------------------------------------
-- Cast helpers.
--
-- `metadata` is client-influenced JSON, so a bare (x->>'y')::timestamptz can
-- raise on a malformed value and take the whole matchmaking call down. These
-- return NULL instead.
-- ------------------------------------------------------------
create or replace function public.safe_timestamptz(value text)
returns timestamptz
language sql
immutable
as $$
  select case
    when value ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}' then value::timestamptz
    else null
  end;
$$;

create or replace function public.safe_int(value text)
returns int
language sql
immutable
as $$
  select case when value ~ '^-?\d+$' then value::int else null end;
$$;

-- Mirrors isMatchJoinable() in src/lib/match-room.ts. Decided beats status,
-- because the resolution routes write metadata.winner_id without moving status
-- off "active"; a clock that ran out days ago is not playable either.
create or replace function public.match_is_joinable(
  p_status text,
  p_metadata jsonb,
  p_started_at timestamptz,
  p_created_at timestamptz
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    coalesce(p_metadata->>'winner_id', '') = ''
    and coalesce(p_metadata->>'completed_at', '') = ''
    and (
      (
        p_status = 'pending'
        and public.safe_timestamptz(p_metadata->>'started_at') is null
        and p_created_at > now() - interval '10 minutes'
      )
      or (
        p_status = 'active'
        and public.safe_timestamptz(coalesce(p_metadata->>'started_at', p_started_at::text)) is not null
        and now() < public.safe_timestamptz(coalesce(p_metadata->>'started_at', p_started_at::text))
                  + ((coalesce(public.safe_int(p_metadata->>'time_limit'), 480) + 3) * interval '1 second')
      )
    );
$$;

-- ------------------------------------------------------------
-- Enqueue (or refresh) one player.
--
-- Updating in place on conflict keeps `created_at`, so a player who re-opens
-- the page does not lose their place in line to someone who joined later.
-- ------------------------------------------------------------
create or replace function public.matchmaking_enqueue(
  p_user_id uuid,
  p_mode text,
  p_match_type text,
  p_time_limit_seconds int,
  p_language text,
  p_rating int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.matchmaking_queue;
begin
  insert into public.matchmaking_queue
    (user_id, mode, match_type, time_limit_seconds, language, rating, payload, expires_at)
  values
    (p_user_id, p_mode, p_match_type, p_time_limit_seconds, p_language, coalesce(p_rating, 0),
     '{}'::jsonb, now() + interval '2 minutes')
  on conflict (user_id) do update
    set mode               = excluded.mode,
        match_type         = excluded.match_type,
        time_limit_seconds = excluded.time_limit_seconds,
        language           = excluded.language,
        rating             = excluded.rating,
        expires_at         = excluded.expires_at
  returning * into v_row;

  return jsonb_build_object('status', 'queued', 'queuedAt', v_row.created_at);
end;
$$;

-- ------------------------------------------------------------
-- One atomic pairing pass for one queued player.
--
-- Returns:
--   {"status":"matched","matchId":...,"seat":N}
--   {"status":"waiting","ahead":N}
--   {"status":"not_queued"}
--   {"status":"error","message":"..."}
-- ------------------------------------------------------------
create or replace function public.matchmaking_pair(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_self        public.matchmaking_queue;
  v_required    int;
  v_candidates  jsonb := '[]'::jsonb;
  v_avg_rating  int;
  v_difficulty  text;
  v_question_id uuid;
  v_question_difficulty text;
  v_match_id    uuid;
  v_seat        smallint;
  v_ahead       int;
begin
  -- Serialise pairing. Transaction-scoped, so it is released on commit/rollback.
  perform pg_advisory_xact_lock(hashtext('code_royale.matchmaking'));

  -- Drop expired entries first: a row past its 2-minute window is not a player
  -- who is still looking.
  delete from public.matchmaking_queue where expires_at < now();

  select * into v_self
  from public.matchmaking_queue
  where user_id = p_user_id
  for update;

  /*
   * Not queued. A concurrent caller may have paired us a moment ago: it
   * enqueued both players, ran its own pairing pass, dequeued us, and created
   * the match before this call took the lock. Reporting "not_queued" here would
   * make the losing side's /join say "still searching" even though its room
   * already exists. Hand back that room instead.
   */
  if not found then
    select m.id, mp.seat
    into v_match_id, v_seat
    from public.match_players mp
    join public.matches m on m.id = mp.match_id
    where mp.user_id = p_user_id
      and public.match_is_joinable(m.status, m.metadata, m.started_at, m.created_at)
    order by m.created_at desc
    limit 1;

    if v_match_id is not null then
      return jsonb_build_object('status', 'matched', 'matchId', v_match_id, 'seat', v_seat);
    end if;

    return jsonb_build_object('status', 'not_queued');
  end if;

  v_required := case when v_self.match_type = '1v1' then 2 else 4 end;

  /*
   * Take the peers in the same bucket.
   *
   * `live` mirrors isMatchJoinable() in src/lib/match-room.ts: a player already
   * sitting in a playable match must never be seated in a second one. Decided
   * beats status, because the resolution routes write metadata.winner_id without
   * moving status off "active".
   *
   * Ordering prefers the closest rating, then whoever has waited longest, so
   * the queue is fair rather than newest-first.
   */
  with live as (
    select mp.user_id
    from public.match_players mp
    join public.matches m on m.id = mp.match_id
    where public.match_is_joinable(m.status, m.metadata, m.started_at, m.created_at)
  )
  select
    coalesce(
      jsonb_agg(jsonb_build_object(
        'user_id', c.user_id,
        'rating', c.rating,
        'created_at', c.created_at
      )),
      '[]'::jsonb
    ),
    round(
      (coalesce(v_self.rating, 0)::numeric + coalesce(sum(c.rating), 0)::numeric)
      / greatest(1, 1 + count(*))
    )::int
  into v_candidates, v_avg_rating
  from (
    select q.user_id, q.rating, q.created_at
    from public.matchmaking_queue q
    where q.user_id <> p_user_id
      and q.mode = v_self.mode
      and q.match_type = v_self.match_type
      and q.expires_at > now()
      and not exists (select 1 from live l where l.user_id = q.user_id)
    order by abs(coalesce(q.rating, 0) - coalesce(v_self.rating, 0)) asc,
             q.created_at asc
    limit greatest(v_required - 1, 0)
    for update skip locked
  ) c;

  if jsonb_array_length(v_candidates) < v_required - 1 then
    select count(*) into v_ahead
    from public.matchmaking_queue
    where mode = v_self.mode
      and match_type = v_self.match_type
      and created_at < v_self.created_at
      and expires_at > now();

    return jsonb_build_object('status', 'waiting', 'ahead', coalesce(v_ahead, 0));
  end if;

  -- Claim every seat. Same transaction as the match insert below, so there is
  -- no window where players are dequeued but no match exists.
  delete from public.matchmaking_queue
  where user_id = p_user_id
     or user_id in (
       select (e->>'user_id')::uuid from jsonb_array_elements(v_candidates) e
     );

  if v_self.mode = 'ranked' then
    v_difficulty := case
      when coalesce(v_avg_rating, 0) < 300 then 'easy'
      when coalesce(v_avg_rating, 0) < 700 then 'medium'
      else 'hard'
    end;
  end if;

  select id, difficulty into v_question_id, v_question_difficulty
  from public.practice_questions
  where v_difficulty is null or difficulty = v_difficulty
  order by random()
  limit 1;

  if v_question_id is null then
    select id, difficulty into v_question_id, v_question_difficulty
    from public.practice_questions order by random() limit 1;
  end if;

  if v_question_id is null then
    return jsonb_build_object('status', 'error', 'message', 'PvP questions not seeded');
  end if;

  /*
   * The match opens as a room, not a running clock. `started_at` is left unset;
   * the arena's sync endpoint writes it exactly once, after both players are
   * actually present. Seating both here is what makes them both see the same
   * room on their very next request.
   */
  insert into public.matches (mode, status, created_by, metadata)
  values (
    v_self.mode,
    'pending',
    p_user_id,
    jsonb_build_object(
      'question_id', v_question_id,
      'question_difficulty', v_question_difficulty,
      'time_limit', v_self.time_limit_seconds,
      'language', v_self.language,
      'match_type', v_self.match_type,
      'trophy_multiplier', case when v_self.time_limit_seconds >= 3600 then 1.5 else 1 end,
      'started_at', null,
      'mode', v_self.mode
    )
  )
  returning id into v_match_id;

  /*
   * Seats are assigned by queue age, oldest first. The old code gave seat 0 to
   * whichever player's request happened to win the race, which made seat
   * assignment a function of network timing.
   */
  insert into public.match_players (match_id, user_id, seat, team)
  select
    v_match_id,
    t.user_id,
    (row_number() over (order by t.created_at, t.user_id) - 1)::smallint,
    case
      when v_self.match_type = '2v2' then
        (case when row_number() over (order by t.created_at, t.user_id) <= 2 then 0 else 1 end)::smallint
      else null
    end
  from (
    select p_user_id as user_id, v_self.created_at as created_at
    union all
    select (e->>'user_id')::uuid, (e->>'created_at')::timestamptz
    from jsonb_array_elements(v_candidates) e
  ) t;

  select seat into v_seat
  from public.match_players
  where match_id = v_match_id and user_id = p_user_id;

  return jsonb_build_object('status', 'matched', 'matchId', v_match_id, 'seat', v_seat);
end;
$$;

-- ------------------------------------------------------------
-- Service role only.
--
-- These are SECURITY DEFINER; Postgres grants EXECUTE to PUBLIC by default, so
-- without this any anonymous visitor could enqueue or pair on someone's behalf
-- through /rest/v1/rpc/. Same class of hole as bump_submit_rate.
-- ------------------------------------------------------------
revoke all on function public.matchmaking_enqueue(uuid, text, text, int, text, int) from public;
revoke all on function public.matchmaking_enqueue(uuid, text, text, int, text, int) from anon;
revoke all on function public.matchmaking_enqueue(uuid, text, text, int, text, int) from authenticated;
grant execute on function public.matchmaking_enqueue(uuid, text, text, int, text, int) to service_role;

revoke all on function public.matchmaking_pair(uuid) from public;
revoke all on function public.matchmaking_pair(uuid) from anon;
revoke all on function public.matchmaking_pair(uuid) from authenticated;
grant execute on function public.matchmaking_pair(uuid) to service_role;
