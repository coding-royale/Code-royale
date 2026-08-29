-- User reports (profile -> report user). Rows are written by the server via
-- the service role; authenticated users can view their own reports.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  description text not null default '',
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy reports_select_own on public.reports
  for select to authenticated
  using (auth.uid() = reporter_id);

create index reports_reported_idx on public.reports (reported_id, created_at desc);