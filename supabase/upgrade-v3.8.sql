-- ALPHA PLATFORM V3.8
-- Additive analytics upgrade for the hidden Super Admin Dashboard.
-- Does not modify portfolio, recommendation, performance or notification calculations.

begin;

create extension if not exists pgcrypto;

create table if not exists public.app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_token text not null unique,
  started_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0,
  last_path text,
  device_type text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_sessions_user_id_idx on public.app_sessions(user_id);
create index if not exists app_sessions_last_active_idx on public.app_sessions(last_active_at desc);
create index if not exists app_sessions_started_at_idx on public.app_sessions(started_at desc);

alter table public.app_sessions enable row level security;

drop policy if exists app_sessions_select_own_or_super_admin on public.app_sessions;
create policy app_sessions_select_own_or_super_admin
on public.app_sessions for select
to authenticated
using (auth.uid() = user_id or public.is_super_admin());

drop policy if exists app_sessions_insert_own on public.app_sessions;
create policy app_sessions_insert_own
on public.app_sessions for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists app_sessions_update_own on public.app_sessions;
create policy app_sessions_update_own
on public.app_sessions for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.touch_app_session(
  p_session_token text,
  p_path text default null,
  p_device_type text default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(p_session_token), '') is null then
    raise exception 'Session token is required';
  end if;

  insert into public.app_sessions (
    user_id,
    session_token,
    started_at,
    last_active_at,
    duration_seconds,
    last_path,
    device_type,
    user_agent,
    updated_at
  ) values (
    v_user_id,
    trim(p_session_token),
    now(),
    now(),
    0,
    nullif(p_path, ''),
    nullif(p_device_type, ''),
    nullif(left(p_user_agent, 500), ''),
    now()
  )
  on conflict (session_token) do update
  set last_active_at = now(),
      ended_at = null,
      duration_seconds = greatest(0, floor(extract(epoch from (now() - public.app_sessions.started_at)))::integer),
      last_path = coalesce(nullif(excluded.last_path, ''), public.app_sessions.last_path),
      device_type = coalesce(nullif(excluded.device_type, ''), public.app_sessions.device_type),
      user_agent = coalesce(nullif(excluded.user_agent, ''), public.app_sessions.user_agent),
      updated_at = now()
  where public.app_sessions.user_id = v_user_id
  returning id into v_session_id;

  if v_session_id is null then
    raise exception 'Session token belongs to another user';
  end if;

  return v_session_id;
end;
$$;

create or replace function public.close_app_session(p_session_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;

  update public.app_sessions
  set last_active_at = now(),
      ended_at = now(),
      duration_seconds = greatest(0, floor(extract(epoch from (now() - started_at)))::integer),
      updated_at = now()
  where session_token = p_session_token
    and user_id = auth.uid();
end;
$$;

create or replace function public.get_platform_analytics(p_window_hours integer default 24)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hours integer := greatest(1, least(coalesce(p_window_hours, 24), 24 * 365));
  v_result jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Super Admin access required';
  end if;

  select jsonb_build_object(
    'window_hours', v_hours,
    'total_signups', (select count(*) from public.profiles),
    'active_visitors', (
      select count(distinct user_id)
      from public.app_sessions
      where last_active_at >= now() - make_interval(hours => v_hours)
    ),
    'active_24h', (
      select count(distinct user_id)
      from public.app_sessions
      where last_active_at >= now() - interval '24 hours'
    ),
    'active_7d', (
      select count(distinct user_id)
      from public.app_sessions
      where last_active_at >= now() - interval '7 days'
    ),
    'total_sessions', (select count(*) from public.app_sessions),
    'sessions_in_window', (
      select count(*)
      from public.app_sessions
      where started_at >= now() - make_interval(hours => v_hours)
    ),
    'average_session_seconds', coalesce((
      select round(avg(greatest(duration_seconds, floor(extract(epoch from (last_active_at - started_at)))::integer)))::integer
      from public.app_sessions
    ), 0),
    'generated_at', now()
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.get_registered_users()
returns table (
  user_id uuid,
  full_name text,
  email text,
  signup_date timestamptz,
  last_active timestamptz,
  session_count bigint,
  total_duration_seconds bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Super Admin access required';
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.email,
    p.created_at,
    max(s.last_active_at),
    count(s.id),
    coalesce(sum(greatest(s.duration_seconds, floor(extract(epoch from (s.last_active_at - s.started_at)))::integer)), 0)::bigint
  from public.profiles p
  left join public.app_sessions s on s.user_id = p.id
  group by p.id, p.full_name, p.email, p.created_at
  order by p.created_at desc;
end;
$$;

grant select, insert, update on public.app_sessions to authenticated;
grant execute on function public.touch_app_session(text, text, text, text) to authenticated;
grant execute on function public.close_app_session(text) to authenticated;
grant execute on function public.get_platform_analytics(integer) to authenticated;
grant execute on function public.get_registered_users() to authenticated;

commit;
