-- ============================================================
-- Code Royale: GitHub username fallback (non-destructive)
--
-- This script upgrades an existing database WITHOUT a full reset.
-- It replaces handle_new_user_profile() with a version that
-- reads the username from OAuth provider metadata, sanitizes it
-- to the allowed charset (letters, digits, underscore, dot),
-- deduplicates it case-insensitively, and marks the row as
-- NOT onboarded so the /auth/complete-profile page forces the
-- user to pick a final unique username + password.
--
-- GitHub users store:
--   user_name            -> the GitHub login
--   preferred_username   -> the GitHub login
--   name                 -> the GitHub display name
-- Google users store:
--   display_name         -> the Google display name
--
-- The function uses the first non-null value in this order:
--   display_name, user_name, preferred_username, name,
--   the email prefix.
--
-- NOTE: the live project already received this via migration
-- `username_uniqueness_and_onboarding`. Prefer the reset script
-- for fresh installs. Kept here for reference.
-- ============================================================

alter table public.users add column if not exists onboarded boolean not null default false;

create unique index if not exists users_username_unique_ci
  on public.users (lower(username))
  where username is not null and username <> '';

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text;
  base text;
  suffix int := 0;
begin
  candidate := coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'user_name',
    new.raw_user_meta_data->>'preferred_username',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );
  -- Keep only allowed username chars: letters, digits, underscore, dot.
  candidate := regexp_replace(coalesce(candidate, ''), '[^A-Za-z0-9_.]', '', 'g');
  candidate := regexp_replace(candidate, '^[_.]+', '');
  candidate := substr(candidate, 1, 20);
  if candidate is null or length(candidate) < 3 then
    candidate := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  base := candidate;
  -- Deduplicate case-insensitively so the unique index never rejects the trigger.
  while exists (select 1 from public.users where lower(username) = lower(candidate)) loop
    suffix := suffix + 1;
    candidate := substr(base, 1, 20 - length(suffix::text) - 1) || '_' || suffix::text;
  end loop;

  insert into public.users (id, username, rating, wins, losses, team_name, onboarded)
  values (
    new.id,
    candidate,
    0,
    0,
    0,
    null,
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user_profile() from public;
grant execute on function public.handle_new_user_profile() to service_role;

-- Grandfather existing accounts: keep current usernames, skip onboarding.
update public.users set onboarded = true where onboarded is not true;
