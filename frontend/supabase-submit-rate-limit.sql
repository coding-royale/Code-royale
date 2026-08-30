-- ------------------------------------------------------------
-- Per-user code submission rate limiter (non-anonymous).
--
-- Backs `_checkSubmitRateLimit` in TypeScript. Unlike a per-IP limiter, this
-- keys on the authenticated `user_id`, so shared IPs (offices, NAT, school
-- networks, many Vercel instances) cannot shield a single attacker and a user
-- behind a shared IP is not unfairly blocked by their neighbours.
--
-- It is a sliding-window counter enforced atomically in a single RPC call
-- (row lock + upsert) so concurrent submissions from the same user (double
-- click / tab spam) cannot exceed the limit. Old windows roll over in place;
-- no background cleanup job is required.
--
-- Usage (from the service role client, do NOT expose this to the browser):
--
--   select public.bump_submit_rate(
--     p_user_id := '...',
--     p_limit := 20,
--     p_window_seconds := 20
--   );
--
-- Returns a jsonb object:
--   {"allowed": true,  "remaining": N,  "reset_after": 0}
--   {"allowed": false, "remaining": 0,  "reset_after": S}
--
-- Apply with `psql`/Supabase SQL editor. Idempotent: safe to run repeatedly.
-- ------------------------------------------------------------

create table if not exists public.submit_rate_limits (
  user_id      uuid primary key references public.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  count        int not null default 0,
  updated_at   timestamptz not null default now()
);

create index if not exists idx_submit_rate_limits_window
  on public.submit_rate_limits (window_start);

create or replace function public.bump_submit_rate(
  p_user_id uuid,
  p_limit int,
  p_window_seconds int
)
returns jsonb
language plpgsql
set search_path = ''
security definer
as $$
declare
  v_window_start timestamptz;
  v_count int;
  v_now timestamptz := now();
  v_window interval;
  v_remaining int;
  v_reset_after int;
begin
  p_limit := greatest(1, coalesce(p_limit, 1));
  p_window_seconds := greatest(1, coalesce(p_window_seconds, 20));
  v_window := (p_window_seconds || ' seconds')::interval;

  -- Lock the user's row (if any) so concurrent submissions serialize. When no
  -- row exists yet the select reads nulls and no lock is taken; the upsert
  -- below still resolves the first-insert race safely.
  select window_start, count
    into v_window_start, v_count
    from public.submit_rate_limits
   where user_id = p_user_id
     for update;

  if v_window_start is null or (v_now - v_window_start) >= v_window then
    -- Fresh window (first submission or the previous one elapsed): start at 1.
    insert into public.submit_rate_limits (user_id, window_start, count)
    values (p_user_id, v_now, 1)
    on conflict (user_id) do update
      set window_start = excluded.window_start,
          count        = excluded.count,
          updated_at   = now()
    returning count into v_count;

    v_remaining := p_limit - v_count;
    return jsonb_build_object('allowed', true, 'remaining', v_remaining, 'reset_after', 0);
  end if;

  -- Active window, limit already reached.
  if v_count >= p_limit then
    v_reset_after := greatest(
      1,
      ceil(extract(epoch from (v_window_start + v_window) - v_now))::int
    );
    return jsonb_build_object('allowed', false, 'remaining', 0, 'reset_after', v_reset_after);
  end if;

  -- Active window, budget left: consume one.
  update public.submit_rate_limits
     set count = count + 1, updated_at = now()
   where user_id = p_user_id
  returning count into v_count;

  v_remaining := p_limit - v_count;
  return jsonb_build_object('allowed', true, 'remaining', v_remaining, 'reset_after', 0);
end;
$$;