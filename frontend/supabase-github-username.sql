-- ============================================================
-- Code Royale: GitHub username fallback (non-destructive)
--
-- This script upgrades an existing database WITHOUT a full reset.
-- It replaces handle_new_user_profile() with a version that
-- reads the username from OAuth provider metadata.
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
-- Run this once in the Supabase SQL Editor. New sign-ups then
-- get the correct username. The reset script already contains
-- this change for fresh installs.
-- ============================================================

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
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