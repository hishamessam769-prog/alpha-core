-- ALPHA CORE MVP V1
-- Run this complete file in Supabase > SQL Editor.
-- It upgrades the database you already created and keeps the existing admin user.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists newsletter_opt_in boolean not null default true,
  add column if not exists last_seen_at timestamptz;

alter table public.strategy_months
  add column if not exists live_portfolio_return numeric not null default 0,
  add column if not exists live_benchmark_return numeric not null default 0,
  add column if not exists live_alpha numeric not null default 0,
  add column if not exists update_title text,
  add column if not exists monthly_objective text;

create table if not exists public.site_content (
  id text primary key,
  title text,
  body text,
  is_public boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.site_content(id,title,body,is_public)
values (
  'philosophy',
  'The ALPHA CORE Philosophy',
  'A transparent, focused and measurable Egyptian equity strategy.',
  true
)
on conflict (id) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id,email,full_name,newsletter_opt_in)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'newsletter_opt_in')::boolean, true)
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    newsletter_opt_in = excluded.newsletter_opt_in;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update on auth.users
for each row execute function public.handle_new_user();

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is distinct from u.email;

create or replace function public.public_member_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.profiles
  where is_admin = false;
$$;

grant execute on function public.public_member_count() to anon, authenticated;

alter table public.site_content enable row level security;

drop policy if exists "users read own profile" on public.profiles;
drop policy if exists "member reads own profile" on public.profiles;
drop policy if exists "admin reads all profiles" on public.profiles;
drop policy if exists "member updates own profile" on public.profiles;
drop policy if exists "admin updates profiles" on public.profiles;

create policy "member reads own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "admin reads all profiles"
on public.profiles for select
to authenticated
using (public.is_admin());

create policy "member updates own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid() and is_admin = false);

create policy "admin updates profiles"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "public reads published months" on public.strategy_months;
create policy "public reads published months"
on public.strategy_months for select
to anon, authenticated
using (is_published = true or public.is_admin());

drop policy if exists "public reads holdings of published months" on public.holdings;
drop policy if exists "members read holdings of published months" on public.holdings;
create policy "members read holdings of published months"
on public.holdings for select
to authenticated
using (
  exists (
    select 1 from public.strategy_months m
    where m.id = month_id
      and (m.is_published = true or public.is_admin())
  )
);

drop policy if exists "public reads snapshots of published months" on public.snapshots;
drop policy if exists "members read snapshots of published months" on public.snapshots;
create policy "members read snapshots of published months"
on public.snapshots for select
to authenticated
using (
  exists (
    select 1 from public.strategy_months m
    where m.id = month_id
      and (m.is_published = true or public.is_admin())
  )
);

drop policy if exists "public reads swaps of published months" on public.swaps;
drop policy if exists "members read swaps of published months" on public.swaps;
create policy "members read swaps of published months"
on public.swaps for select
to authenticated
using (
  exists (
    select 1 from public.strategy_months m
    where m.id = month_id
      and (m.is_published = true or public.is_admin())
  )
);

drop policy if exists "public reads site content" on public.site_content;
drop policy if exists "admin manages site content" on public.site_content;

create policy "public reads site content"
on public.site_content for select
to anon, authenticated
using (is_public = true or public.is_admin());

create policy "admin manages site content"
on public.site_content for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'strategy_months'
  ) then
    alter publication supabase_realtime add table public.strategy_months;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'holdings'
  ) then
    alter publication supabase_realtime add table public.holdings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'swaps'
  ) then
    alter publication supabase_realtime add table public.swaps;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'snapshots'
  ) then
    alter publication supabase_realtime add table public.snapshots;
  end if;
end $$;

update public.profiles
set is_admin = true
where email = 'hishamessam769@gmail.com';
