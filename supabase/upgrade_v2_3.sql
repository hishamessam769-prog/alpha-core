-- ALPHA CORE V2.3
-- Independent Ideas naming + Invest/Hold action + Weekly Reports.
-- Run this file once in the SAME Supabase project after V2.2.

-- 1) Separate the performance record status from the current investor action.
alter table public.recommendations
  add column if not exists action_status text not null default 'invest';

update public.recommendations
set action_status = 'invest'
where action_status is null or action_status not in ('invest','hold');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'recommendations_action_status_check'
      and conrelid = 'public.recommendations'::regclass
  ) then
    alter table public.recommendations
      add constraint recommendations_action_status_check
      check (action_status in ('invest','hold'));
  end if;
end $$;

create index if not exists recommendations_action_status_idx
  on public.recommendations(action_status, status, recommendation_date desc);

-- 2) Weekly reports CMS.
create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  week_start date not null,
  week_end date not null,
  summary text not null,
  market_overview text,
  portfolio_update text,
  gold_update text,
  watch_next text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (week_end >= week_start)
);

create index if not exists weekly_reports_published_week_idx
  on public.weekly_reports(is_published, week_end desc);

alter table public.weekly_reports enable row level security;

drop policy if exists "members read published weekly reports" on public.weekly_reports;
drop policy if exists "admin manages weekly reports" on public.weekly_reports;

create policy "members read published weekly reports"
on public.weekly_reports for select to authenticated
using (is_published = true or public.is_admin());

create policy "admin manages weekly reports"
on public.weekly_reports for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Audit the new content if the existing audit function is available.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'audit_changes' and pronamespace = 'public'::regnamespace) then
    drop trigger if exists audit_weekly_reports on public.weekly_reports;
    create trigger audit_weekly_reports after insert or update or delete on public.weekly_reports
      for each row execute function public.audit_changes();
  end if;
end $$;

-- Realtime, safely.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'weekly_reports'
  ) then
    alter publication supabase_realtime add table public.weekly_reports;
  end if;
end $$;

update public.profiles
set is_admin = true
where email = 'hishamessam769@gmail.com';
