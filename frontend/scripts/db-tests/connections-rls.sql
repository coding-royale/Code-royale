-- =============================================================================
-- connections-rls.sql
-- Transactional RLS test suite for Code Royale friend-connection flows.
-- =============================================================================
-- What it does
--   Simulates real authenticated users (SET LOCAL role + request.jwt.claims),
--   creates SANDBOX connection rows between test identities, asserts expected
--   RLS behavior, then ROLLBACKs. No rows are ever committed.
--
-- How to run
--   psql "<DATABASE_URL>" -v ON_ERROR_STOP=1 -f connections-rls.sql
--   (DATABASE_URL must target the project's Postgres; the Supabase MCP
--    execute_sql tool can run this file directly against the remote DB.)
--
-- Exit code / result
--   0      -> "ALL CONNECTIONS-FLOW TESTS PASSED"
--   non-0  -> first failing assertion is raised as an EXCEPTION naming the test
--
-- Test identities (present in both public.users AND auth.users):
--   chandan       = b94a0bce-8ca7-4dc8-85a9-f6ad2c9b31bc
--   testboi       = ee4630f7-93a3-4041-ba2e-1c2276b65210
--   lohit         = 98cd11bb-2686-478d-b8bf-b1ae8600312f
--   nithitsuki    = fe7976c4-76da-4310-8846-e6f657e015a7
--   ronhere       = d6ec3edd-b1b8-4ea4-8d81-0ffd5f5a8529
--
-- Sandbox pairs avoid the existing real rows (lohit->ronhere, lohit->nithitsuki).
-- =============================================================================

begin;

-- All tests run as the `authenticated` role; only the JWT subject changes.
set local role authenticated;

-- ---------------------------------------------------------------------------
-- T1: A sender can create an outgoing pending request.
--      Pair: chandan -> testboi
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"b94a0bce-8ca7-4dc8-85a9-f6ad2c9b31bc","role":"authenticated"}', true);

insert into public.connections (user_id, connection_id, status)
values ('b94a0bce-8ca7-4dc8-85a9-f6ad2c9b31bc',   -- chandan
        'ee4630f7-93a3-4041-ba2e-1c2276b65210',  -- testboi
        'pending');

do $$
begin
  if not exists (
    select 1 from public.connections
    where user_id = 'b94a0bce-8ca7-4dc8-85a9-f6ad2c9b31bc'
      and connection_id = 'ee4630f7-93a3-4041-ba2e-1c2276b65210'
      and status = 'pending'
  ) then
    raise exception 'T1 FAIL: sender could not create a pending request';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- T2: The receiver can accept the request (pending -> accepted).
--      Regression for the missing updated_at column (42703) that broke every
--      UPDATE on connections.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"ee4630f7-93a3-4041-ba2e-1c2276b65210","role":"authenticated"}', true); -- testboi

update public.connections
   set status = 'accepted'
 where user_id = 'b94a0bce-8ca7-4dc8-85a9-f6ad2c9b31bc'
   and connection_id = 'ee4630f7-93a3-4041-ba2e-1c2276b65210';

do $$
begin
  if not exists (
    select 1 from public.connections
    where user_id = 'b94a0bce-8ca7-4dc8-85a9-f6ad2c9b31bc'
      and connection_id = 'ee4630f7-93a3-4041-ba2e-1c2276b65210'
      and status = 'accepted'
  ) then
    raise exception 'T2 FAIL: receiver could not accept the request';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- T3: The receiver can decline a request (delete the pending row).
--      Pair: testboi -> ronhere, receiver ronhere deletes.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"ee4630f7-93a3-4041-ba2e-1c2276b65210","role":"authenticated"}', true); -- testboi

insert into public.connections (user_id, connection_id, status)
values ('ee4630f7-93a3-4041-ba2e-1c2276b65210',   -- testboi
        'd6ec3edd-b1b8-4ea4-8d81-0ffd5f5a8529',  -- ronhere
        'pending');

select set_config('request.jwt.claims',
  '{"sub":"d6ec3edd-b1b8-4ea4-8d81-0ffd5f5a8529","role":"authenticated"}', true); -- ronhere (receiver)

delete from public.connections
 where user_id = 'ee4630f7-93a3-4041-ba2e-1c2276b65210'
   and connection_id = 'd6ec3edd-b1b8-4ea4-8d81-0ffd5f5a8529'
   and status = 'pending';

do $$
begin
  if exists (
    select 1 from public.connections
    where user_id = 'ee4630f7-93a3-4041-ba2e-1c2276b65210'
      and connection_id = 'd6ec3edd-b1b8-4ea4-8d81-0ffd5f5a8529'
  ) then
    raise exception 'T3 FAIL: receiver could not decline the request';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- T4: The sender can cancel their own outgoing request.
--      Pair: testboi -> chandan.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"ee4630f7-93a3-4041-ba2e-1c2276b65210","role":"authenticated"}', true); -- testboi

insert into public.connections (user_id, connection_id, status)
values ('ee4630f7-93a3-4041-ba2e-1c2276b65210',   -- testboi
        'b94a0bce-8ca7-4dc8-85a9-f6ad2c9b31bc',  -- chandan
        'pending');

delete from public.connections
 where user_id = 'ee4630f7-93a3-4041-ba2e-1c2276b65210'
   and connection_id = 'b94a0bce-8ca7-4dc8-85a9-f6ad2c9b31bc'
   and status = 'pending';

do $$
begin
  if exists (
    select 1 from public.connections
    where user_id = 'ee4630f7-93a3-4041-ba2e-1c2276b65210'
      and connection_id = 'b94a0bce-8ca7-4dc8-85a9-f6ad2c9b31bc'
  ) then
    raise exception 'T4 FAIL: sender could not cancel their own request';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- T5: A stranger (neither party) gets 0 rows on update/delete and cannot see
--     the row.
--      Pair: nithitsuki -> testboi (sender = nithitsuki).
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"fe7976c4-76da-4310-8846-e6f657e015a7","role":"authenticated"}', true); -- nithitsuki

insert into public.connections (user_id, connection_id, status)
values ('fe7976c4-76da-4310-8846-e6f657e015a7',   -- nithitsuki
        'ee4630f7-93a3-4041-ba2e-1c2276b65210',  -- testboi
        'pending');

select set_config('request.jwt.claims',
  '{"sub":"b94a0bce-8ca7-4dc8-85a9-f6ad2c9b31bc","role":"authenticated"}', true); -- chandan (stranger)

-- 5a: stranger UPDATE changes nothing.
update public.connections
   set status = 'accepted'
 where user_id = 'fe7976c4-76da-4310-8846-e6f657e015a7'
   and connection_id = 'ee4630f7-93a3-4041-ba2e-1c2276b65210';

do $$
begin
  if exists (
    select 1 from public.connections
    where user_id = 'fe7976c4-76da-4310-8846-e6f657e015a7'
      and connection_id = 'ee4630f7-93a3-4041-ba2e-1c2276b65210'
      and status = 'accepted'
  ) then
    raise exception 'T5a FAIL: stranger was able to update someone else''s edge';
  end if;
end $$;

-- 5b: stranger DELETE removes nothing (row must still physically exist).
delete from public.connections
 where user_id = 'fe7976c4-76da-4310-8846-e6f657e015a7'
   and connection_id = 'ee4630f7-93a3-4041-ba2e-1c2276b65210';

set local role postgres; -- bypass RLS to check physical existence
do $$
begin
  if not exists (
    select 1 from public.connections
    where user_id = 'fe7976c4-76da-4310-8846-e6f657e015a7'
      and connection_id = 'ee4630f7-93a3-4041-ba2e-1c2276b65210'
  ) then
    raise exception 'T5b FAIL: stranger was able to delete someone else''s edge';
  end if;
end $$;

-- 5c: stranger cannot even see the row.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b94a0bce-8ca7-4dc8-85a9-f6ad2c9b31bc","role":"authenticated"}', true); -- chandan

do $$
declare n int;
begin
  select count(*) into n  -- reads under chandan's RLS
  from public.connections
  where user_id = 'fe7976c4-76da-4310-8846-e6f657e015a7'
    and connection_id = 'ee4630f7-93a3-4041-ba2e-1c2276b65210';
  if n <> 0 then
    raise exception 'T5c FAIL: stranger could see someone else''s edge';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- T6: A blocked party cannot silently un-block themselves.
--      Regression for the over-permissive connections_update_involved policy.
--      Pair: lohit blocks testboi, then testboi tries to accept.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"98cd11bb-2686-478d-b8bf-b1ae8600312f","role":"authenticated"}', true); -- lohit

insert into public.connections (user_id, connection_id, status)
values ('98cd11bb-2686-478d-b8bf-b1ae8600312f',   -- lohit
        'ee4630f7-93a3-4041-ba2e-1c2276b65210',  -- testboi
        'pending');

update public.connections
   set status = 'blocked'
 where user_id = '98cd11bb-2686-478d-b8bf-b1ae8600312f'
   and connection_id = 'ee4630f7-93a3-4041-ba2e-1c2276b65210';

select set_config('request.jwt.claims',
  '{"sub":"ee4630f7-93a3-4041-ba2e-1c2276b65210","role":"authenticated"}', true); -- testboi (blocked party)

-- NOTE: no status filter on purpose - this mirrors the app's Accept action
-- (friends/page.tsx handleAccept), which is the vulnerable path under
-- the permissive connections_update_involved policy.
update public.connections
   set status = 'accepted'
 where user_id = '98cd11bb-2686-478d-b8bf-b1ae8600312f'
   and connection_id = 'ee4630f7-93a3-4041-ba2e-1c2276b65210';

do $$
begin
  if exists (
    select 1 from public.connections
    where user_id = '98cd11bb-2686-478d-b8bf-b1ae8600312f'
      and connection_id = 'ee4630f7-93a3-4041-ba2e-1c2276b65210'
      and status = 'accepted'
  ) then
    raise exception 'T6 FAIL: blocked party was able to un-block themselves (connections_update_involved too permissive)';
  end if;

  if not exists (
    select 1 from public.connections
    where user_id = '98cd11bb-2686-478d-b8bf-b1ae8600312f'
      and connection_id = 'ee4630f7-93a3-4041-ba2e-1c2276b65210'
      and status = 'blocked'
  ) then
    raise exception 'T6 FAIL: blocked row is missing or no longer blocked';
  end if;
end $$;

-- ---------------------------------------------------------------------------
rollback; -- never commit sandbox rows

select 'ALL CONNECTIONS-FLOW TESTS PASSED' as result;
