-- ALPHA CORE V2.3.1
-- Safe in-place upgrade over the existing V2.3 Supabase database.
-- Preserves all current portfolios, recommendations, reports, users and history.
-- Run once in Supabase SQL Editor using the project owner role.

begin;

-- ---------------------------------------------------------------------------
-- 1) Super Admin role and reusable permission function
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_super_admin boolean not null default false;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.is_super_admin
    from public.profiles p
    where p.id = auth.uid()
  ), false);
$$;

grant execute on function public.is_super_admin() to authenticated;

-- Keep the existing owner as Super Admin without changing other admins.
update public.profiles
set is_admin = true,
    is_super_admin = true
where lower(email) = lower('hishamessam769@gmail.com');

create or replace function public.protect_super_admin_flag()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.is_super_admin is distinct from old.is_super_admin
     and not public.is_super_admin()
     and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Only a Super Admin can change Super Admin access';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_super_admin_flag on public.profiles;
create trigger protect_super_admin_flag
before update of is_super_admin on public.profiles
for each row execute function public.protect_super_admin_flag();

-- ---------------------------------------------------------------------------
-- 2) Transparency metadata
-- ---------------------------------------------------------------------------
alter table public.portfolios
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists is_demo boolean not null default false;

alter table public.strategy_months
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists is_demo boolean not null default false,
  add column if not exists current_investor_guidance text,
  add column if not exists new_investor_guidance text;

alter table public.recommendations
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists is_demo boolean not null default false;

alter table public.recommendation_updates
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.weekly_reports
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists is_demo boolean not null default false;

do $$
declare
  legacy_owner_id uuid;
begin
  select id into legacy_owner_id
  from public.profiles
  where lower(email) = lower('hishamessam769@gmail.com')
  limit 1;

  if legacy_owner_id is not null then
    update public.portfolios
      set created_by = coalesce(created_by, legacy_owner_id),
          updated_by = coalesce(updated_by, created_by, legacy_owner_id)
      where created_by is null or updated_by is null;
    update public.strategy_months
      set created_by = coalesce(created_by, legacy_owner_id),
          updated_by = coalesce(updated_by, created_by, legacy_owner_id)
      where created_by is null or updated_by is null;
    update public.recommendations
      set created_by = coalesce(created_by, legacy_owner_id),
          updated_by = coalesce(updated_by, created_by, legacy_owner_id)
      where created_by is null or updated_by is null;
    update public.recommendation_updates
      set created_by = coalesce(created_by, legacy_owner_id),
          updated_by = coalesce(updated_by, created_by, legacy_owner_id)
      where created_by is null or updated_by is null;
    update public.weekly_reports
      set created_by = coalesce(created_by, legacy_owner_id),
          updated_by = coalesce(updated_by, created_by, legacy_owner_id)
      where created_by is null or updated_by is null;
  end if;
end $$;

update public.portfolios
set updated_by = coalesce(updated_by, created_by)
where updated_by is null;

update public.strategy_months
set updated_by = coalesce(updated_by, created_by),
    current_investor_guidance = coalesce(nullif(current_investor_guidance, ''), investor_guidance),
    new_investor_guidance = coalesce(nullif(new_investor_guidance, ''), investor_guidance)
where updated_by is null
   or current_investor_guidance is null
   or new_investor_guidance is null;

update public.recommendations
set updated_by = coalesce(updated_by, created_by)
where updated_by is null;

update public.recommendation_updates
set updated_by = coalesce(updated_by, created_by)
where updated_by is null;

update public.weekly_reports
set updated_by = coalesce(updated_by, created_by)
where updated_by is null;

create or replace function public.set_alpha_core_audit_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'portfolios',
    'strategy_months',
    'recommendations',
    'recommendation_updates',
    'weekly_reports'
  ] loop
    execute format('drop trigger if exists alpha_core_audit_fields on public.%I', target_table);
    execute format(
      'create trigger alpha_core_audit_fields before insert or update on public.%I for each row execute function public.set_alpha_core_audit_fields()',
      target_table
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Activity Log
-- ---------------------------------------------------------------------------
create table if not exists public.activity_logs (
  id bigint generated by default as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  actor_email text,
  action text not null check (action in ('CREATE','UPDATE','DELETE')),
  entity_type text not null,
  entity_id uuid,
  entity_label text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists activity_logs_occurred_at_idx
  on public.activity_logs(occurred_at desc);
create index if not exists activity_logs_entity_idx
  on public.activity_logs(entity_type, entity_id, occurred_at desc);
create index if not exists activity_logs_actor_idx
  on public.activity_logs(actor_id, occurred_at desc);

alter table public.activity_logs enable row level security;

drop policy if exists "admins read activity log" on public.activity_logs;
create policy "admins read activity log"
on public.activity_logs for select to authenticated
using (public.is_admin());

create or replace function public.log_alpha_core_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb;
  old_data jsonb;
  actor record;
  changed_fields jsonb := '[]'::jsonb;
  entity_uuid uuid;
  entity_name text;
begin
  if tg_op = 'DELETE' then
    row_data := to_jsonb(old);
  else
    row_data := to_jsonb(new);
  end if;

  if tg_op = 'UPDATE' then
    old_data := to_jsonb(old);
    select coalesce(jsonb_agg(n.key order by n.key), '[]'::jsonb)
      into changed_fields
    from jsonb_each(row_data) n
    where n.key not in ('updated_at','updated_by')
      and n.value is distinct from (old_data -> n.key);

    if jsonb_array_length(changed_fields) = 0 then
      return new;
    end if;
  end if;

  begin
    entity_uuid := nullif(row_data ->> 'id', '')::uuid;
  exception when invalid_text_representation then
    entity_uuid := null;
  end;

  entity_name := coalesce(
    nullif(row_data ->> 'name', ''),
    nullif(row_data ->> 'title', ''),
    nullif(row_data ->> 'ticker', ''),
    nullif(row_data ->> 'month_key', ''),
    nullif(row_data ->> 'slug', ''),
    entity_uuid::text
  );

  select p.full_name, p.email
    into actor
  from public.profiles p
  where p.id = auth.uid();

  insert into public.activity_logs (
    actor_id,
    actor_name,
    actor_email,
    action,
    entity_type,
    entity_id,
    entity_label,
    metadata
  ) values (
    auth.uid(),
    coalesce(actor.full_name, actor.email, 'System'),
    actor.email,
    case tg_op when 'INSERT' then 'CREATE' when 'UPDATE' then 'UPDATE' else 'DELETE' end,
    tg_table_name,
    entity_uuid,
    entity_name,
    jsonb_strip_nulls(jsonb_build_object(
      'changed_fields', case when tg_op = 'UPDATE' then changed_fields else null end,
      'portfolio_id', row_data ->> 'portfolio_id',
      'month_id', row_data ->> 'month_id',
      'recommendation_id', row_data ->> 'recommendation_id'
    ))
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'portfolios',
    'strategy_months',
    'holdings',
    'swaps',
    'snapshots',
    'recommendations',
    'recommendation_updates',
    'weekly_reports',
    'market_prices',
    'profiles'
  ] loop
    if to_regclass(format('public.%I', target_table)) is not null then
      execute format('drop trigger if exists alpha_core_activity_log on public.%I', target_table);
      execute format(
        'create trigger alpha_core_activity_log after insert or update or delete on public.%I for each row execute function public.log_alpha_core_activity()',
        target_table
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4) RLS: Admins can read/create/update; only Super Admin can delete entities
-- ---------------------------------------------------------------------------
do $$
declare
  target_table text;
  policy_row record;
begin
  foreach target_table in array array[
    'portfolios',
    'strategy_months',
    'recommendations',
    'recommendation_updates',
    'weekly_reports'
  ] loop
    execute format('alter table public.%I enable row level security', target_table);

    for policy_row in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = target_table
        and cmd in ('ALL','DELETE')
    loop
      execute format('drop policy if exists %I on public.%I', policy_row.policyname, target_table);
    end loop;

    execute format('drop policy if exists %I on public.%I', 'admins select ' || target_table, target_table);
    execute format('drop policy if exists %I on public.%I', 'admins insert ' || target_table, target_table);
    execute format('drop policy if exists %I on public.%I', 'admins update ' || target_table, target_table);
    execute format('drop policy if exists %I on public.%I', 'super admins delete ' || target_table, target_table);

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_admin())',
      'admins select ' || target_table,
      target_table
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_admin())',
      'admins insert ' || target_table,
      target_table
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())',
      'admins update ' || target_table,
      target_table
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_super_admin())',
      'super admins delete ' || target_table,
      target_table
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5) Safe Super Admin deletion functions
-- ---------------------------------------------------------------------------
create or replace function public.delete_strategy_month(p_month_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  month_name text;
begin
  if not public.is_super_admin() then
    raise exception 'Super Admin permission required';
  end if;

  select month_key into month_name
  from public.strategy_months
  where id = p_month_id;

  if month_name is null then
    raise exception 'Month not found';
  end if;

  delete from public.snapshots where month_id = p_month_id;
  delete from public.swaps where month_id = p_month_id;
  delete from public.holdings where month_id = p_month_id;
  delete from public.strategy_months where id = p_month_id;

  return jsonb_build_object('deleted', true, 'entity', 'strategy_month', 'label', month_name);
end;
$$;

create or replace function public.delete_portfolio_cascade(p_portfolio_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  portfolio_name text;
  month_row record;
begin
  if not public.is_super_admin() then
    raise exception 'Super Admin permission required';
  end if;

  select name into portfolio_name
  from public.portfolios
  where id = p_portfolio_id;

  if portfolio_name is null then
    raise exception 'Portfolio not found';
  end if;

  for month_row in select id from public.strategy_months where portfolio_id = p_portfolio_id loop
    perform public.delete_strategy_month(month_row.id);
  end loop;

  delete from public.portfolios where id = p_portfolio_id;
  return jsonb_build_object('deleted', true, 'entity', 'portfolio', 'label', portfolio_name);
end;
$$;

create or replace function public.delete_recommendation_cascade(p_recommendation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  recommendation_name text;
begin
  if not public.is_super_admin() then
    raise exception 'Super Admin permission required';
  end if;

  select coalesce(ticker, title) into recommendation_name
  from public.recommendations
  where id = p_recommendation_id;

  if recommendation_name is null then
    raise exception 'Recommendation not found';
  end if;

  delete from public.recommendation_updates where recommendation_id = p_recommendation_id;
  delete from public.recommendations where id = p_recommendation_id;
  return jsonb_build_object('deleted', true, 'entity', 'recommendation', 'label', recommendation_name);
end;
$$;

create or replace function public.delete_recommendation_update(p_update_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  update_name text;
begin
  if not public.is_super_admin() then
    raise exception 'Super Admin permission required';
  end if;

  select title into update_name
  from public.recommendation_updates
  where id = p_update_id;

  if update_name is null then
    raise exception 'Recommendation update not found';
  end if;

  delete from public.recommendation_updates where id = p_update_id;
  return jsonb_build_object('deleted', true, 'entity', 'recommendation_update', 'label', update_name);
end;
$$;

create or replace function public.delete_weekly_report(p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  report_name text;
begin
  if not public.is_super_admin() then
    raise exception 'Super Admin permission required';
  end if;

  select title into report_name
  from public.weekly_reports
  where id = p_report_id;

  if report_name is null then
    raise exception 'Weekly report not found';
  end if;

  delete from public.weekly_reports where id = p_report_id;
  return jsonb_build_object('deleted', true, 'entity', 'weekly_report', 'label', report_name);
end;
$$;

create or replace function public.delete_demo_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  portfolio_row record;
  month_row record;
  recommendation_row record;
  portfolio_count integer := 0;
  month_count integer := 0;
  recommendation_count integer := 0;
  report_count integer := 0;
  portfolio_month_count integer := 0;
begin
  if not public.is_super_admin() then
    raise exception 'Super Admin permission required';
  end if;

  for recommendation_row in select id from public.recommendations where is_demo = true loop
    perform public.delete_recommendation_cascade(recommendation_row.id);
    recommendation_count := recommendation_count + 1;
  end loop;

  delete from public.weekly_reports where is_demo = true;
  get diagnostics report_count = row_count;

  for month_row in
    select sm.id
    from public.strategy_months sm
    where sm.is_demo = true
      and not exists (
        select 1 from public.portfolios p
        where p.id = sm.portfolio_id and p.is_demo = true
      )
  loop
    perform public.delete_strategy_month(month_row.id);
    month_count := month_count + 1;
  end loop;

  for portfolio_row in select id from public.portfolios where is_demo = true loop
    select count(*) into portfolio_month_count
    from public.strategy_months
    where portfolio_id = portfolio_row.id;
    month_count := month_count + portfolio_month_count;
    perform public.delete_portfolio_cascade(portfolio_row.id);
    portfolio_count := portfolio_count + 1;
  end loop;

  return jsonb_build_object(
    'deleted', true,
    'portfolios', portfolio_count,
    'months', month_count,
    'recommendations', recommendation_count,
    'weekly_reports', report_count
  );
end;
$$;

revoke all on function public.delete_strategy_month(uuid) from public, anon;
revoke all on function public.delete_portfolio_cascade(uuid) from public, anon;
revoke all on function public.delete_recommendation_cascade(uuid) from public, anon;
revoke all on function public.delete_recommendation_update(uuid) from public, anon;
revoke all on function public.delete_weekly_report(uuid) from public, anon;
revoke all on function public.delete_demo_data() from public, anon;

grant execute on function public.delete_strategy_month(uuid) to authenticated;
grant execute on function public.delete_portfolio_cascade(uuid) to authenticated;
grant execute on function public.delete_recommendation_cascade(uuid) to authenticated;
grant execute on function public.delete_recommendation_update(uuid) to authenticated;
grant execute on function public.delete_weekly_report(uuid) to authenticated;
grant execute on function public.delete_demo_data() to authenticated;

-- Realtime for the activity feed, safely.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'activity_logs'
  ) then
    alter publication supabase_realtime add table public.activity_logs;
  end if;
end $$;

commit;
