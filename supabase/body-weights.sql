-- =====================================================================
-- Home Workout: body_weights table & Row-Level Security (RLS)
--
-- Run this once in the Supabase dashboard: SQL Editor -> New query ->
-- paste this file -> Run. It is safe to run again.
--
-- What it does:
--   * Stores one body-weight entry per user per day (measured_on).
--   * Every signed-in user can select, insert, update and delete
--     ONLY their own rows (user_id = auth.uid()).
--   * Signed-out visitors (anon) cannot read or write anything.
-- =====================================================================

create table if not exists public.body_weights (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  measured_on date not null,
  weight_kg numeric(5,2) not null,
  created_at timestamptz default now(),
  unique (user_id, measured_on)
);

alter table public.body_weights enable row level security;

drop policy if exists "body_weights: read own" on public.body_weights;
create policy "body_weights: read own"
  on public.body_weights for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "body_weights: insert own" on public.body_weights;
create policy "body_weights: insert own"
  on public.body_weights for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "body_weights: update own" on public.body_weights;
create policy "body_weights: update own"
  on public.body_weights for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "body_weights: delete own" on public.body_weights;
create policy "body_weights: delete own"
  on public.body_weights for delete to authenticated
  using (user_id = auth.uid());
