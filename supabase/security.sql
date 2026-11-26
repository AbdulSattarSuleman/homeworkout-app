-- =====================================================================
-- Home Workout: Supabase row-level security (RLS)
--
-- Run this once in the Supabase dashboard: SQL Editor -> New query ->
-- paste this file -> Run. It is safe to run again.
--
-- What it does:
--   * Every signed-in user can read and change ONLY their own profile,
--     workout logs and activity logs.
--   * Accounts with profiles.is_admin = true can read everyone's rows
--     (this is what the admin panel uses).
--   * Nobody can make themselves admin from the app; only the SQL Editor can.
--   * Visitors who are not signed in can read nothing.
--
-- IMPORTANT: this removes ALL existing policies on profiles, workout_logs
-- and activity_logs first, because any old "anyone can read" policy would
-- otherwise still let the public read every row.
-- =====================================================================

-- 1. Admin flag on profiles -------------------------------------------
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- 2. Helper: is the current user an admin? -----------------------------
-- SECURITY DEFINER so it can read profiles without hitting the RLS policies below.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 3. Stop users from setting is_admin on themselves --------------------
-- Requests from the app run as the "anon" or "authenticated" role; the SQL
-- Editor runs as "postgres", so admins can still be granted there.
create or replace function public.protect_is_admin()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.is_admin := false;
    else
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_is_admin on public.profiles;
create trigger protect_is_admin
  before insert or update on public.profiles
  for each row execute function public.protect_is_admin();

-- 4. Remove every existing policy on these tables ----------------------
do $$
declare
  r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'workout_logs', 'activity_logs')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 5. Turn RLS on ---------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.workout_logs  enable row level security;

-- 6. profiles ------------------------------------------------------------
create policy "profiles: read own or admin"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles: insert own"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 7. workout_logs ----------------------------------------------------------
create policy "workout_logs: read own or admin"
  on public.workout_logs for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "workout_logs: insert own"
  on public.workout_logs for insert to authenticated
  with check (user_id = auth.uid());

create policy "workout_logs: update own"
  on public.workout_logs for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "workout_logs: delete own"
  on public.workout_logs for delete to authenticated
  using (user_id = auth.uid());

-- 8. activity_logs (skipped if the table does not exist) ----------------------
do $$
begin
  if to_regclass('public.activity_logs') is not null then
    execute 'alter table public.activity_logs enable row level security';
    execute $p$create policy "activity_logs: insert own"
      on public.activity_logs for insert to authenticated
      with check (user_id = auth.uid())$p$;
    execute $p$create policy "activity_logs: admin read"
      on public.activity_logs for select to authenticated
      using (public.is_admin())$p$;
  end if;
end $$;

-- =====================================================================
-- 9. Make your own account an admin (edit the email, then run this line):
--
--   update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'YOUR_ADMIN_EMAIL');
--
-- 10. Check it worked. Signed out, this should return [] (an empty list):
--   https://rpjyrbbbqrehrkpckyuv.supabase.co/rest/v1/profiles?select=id&limit=1
--   (send the publishable key in the "apikey" header)
-- =====================================================================
