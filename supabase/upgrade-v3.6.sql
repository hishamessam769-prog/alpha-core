-- ALPHA PLATFORM V3.6
-- Safe additive upgrade over V3.5.1.
-- Adds Web Push subscriptions/queue and a historical Peak Alpha ledger.
-- Existing portfolio calculations, tables, routes and workflows are not altered.
-- Run once in Supabase SQL Editor using the project owner role.

begin;

-- ---------------------------------------------------------------------------
-- 1) Web Push subscriptions
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  expiration_time bigint,
  user_agent text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_error text
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id, is_active);
create index if not exists push_subscriptions_active_idx
  on public.push_subscriptions(is_active) where is_active = true;

alter table public.push_subscriptions enable row level security;

drop policy if exists "members read own push subscriptions" on public.push_subscriptions;
create policy "members read own push subscriptions"
on public.push_subscriptions for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "members create own push subscriptions" on public.push_subscriptions;
create policy "members create own push subscriptions"
on public.push_subscriptions for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "members update own push subscriptions" on public.push_subscriptions;
create policy "members update own push subscriptions"
on public.push_subscriptions for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "members delete own push subscriptions" on public.push_subscriptions;
create policy "members delete own push subscriptions"
on public.push_subscriptions for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());

grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Durable notification queue
-- ---------------------------------------------------------------------------
create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  title text not null,
  body text not null,
  target_url text not null default '/dashboard',
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text unique,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0,
  recipient_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text
);

create index if not exists notification_events_pending_idx
  on public.notification_events(status, created_at)
  where status in ('pending','failed');

alter table public.notification_events enable row level security;

drop policy if exists "admins read notification events" on public.notification_events;
create policy "admins read notification events"
on public.notification_events for select
to authenticated
using (public.is_admin());

grant select on public.notification_events to authenticated;

create or replace function public.queue_alpha_notification(
  p_event_type text,
  p_title text,
  p_body text,
  p_target_url text default '/dashboard',
  p_payload jsonb default '{}'::jsonb,
  p_dedupe_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  event_id uuid;
begin
  insert into public.notification_events (
    event_type, title, body, target_url, payload, dedupe_key
  ) values (
    left(coalesce(p_event_type, 'platform_update'), 100),
    left(coalesce(p_title, 'ALPHA CORE update'), 180),
    left(coalesce(p_body, 'A new update is available.'), 500),
    left(coalesce(p_target_url, '/dashboard'), 500),
    coalesce(p_payload, '{}'::jsonb),
    nullif(left(coalesce(p_dedupe_key, ''), 300), '')
  )
  on conflict (dedupe_key) do nothing
  returning id into event_id;

  return event_id;
end;
$$;

revoke all on function public.queue_alpha_notification(text,text,text,text,jsonb,text) from public;

-- Recommendation publish event.
create or replace function public.enqueue_recommendation_publish_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_published is not true then
    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(old.is_published, false) = true then
    return new;
  end if;

  perform public.queue_alpha_notification(
    'new_recommendation',
    'New stock recommendation: ' || coalesce(new.ticker, new.company_name, 'ALPHA CORE'),
    coalesce(new.title, new.company_name, 'A new investment recommendation has been published.'),
    '/recommendations/' || new.id::text,
    jsonb_build_object(
      'recommendation_id', new.id,
      'ticker', new.ticker,
      'company_name', new.company_name
    ),
    'recommendation-published:' || new.id::text
  );
  return new;
end;
$$;

drop trigger if exists enqueue_recommendation_publish_notification on public.recommendations;
create trigger enqueue_recommendation_publish_notification
after insert or update on public.recommendations
for each row execute function public.enqueue_recommendation_publish_notification();

-- Portfolio publish / rebalance / live-performance event.
create or replace function public.enqueue_portfolio_update_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  portfolio_row record;
  event_kind text;
  event_title text;
  current_alpha numeric;
  month_name text;
begin
  if new.is_published is not true then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.updated_at is not distinct from old.updated_at
       and new.live_portfolio_return is not distinct from old.live_portfolio_return
       and new.live_benchmark_return is not distinct from old.live_benchmark_return
       and new.final_portfolio_return is not distinct from old.final_portfolio_return
       and new.final_benchmark_return is not distinct from old.final_benchmark_return
       and new.is_closed is not distinct from old.is_closed then
      return new;
    end if;
  end if;

  select p.name, p.slug into portfolio_row
  from public.portfolios p
  where p.id = new.portfolio_id;

  current_alpha := coalesce(
    new.live_alpha,
    coalesce(new.live_portfolio_return, 0) - coalesce(new.live_benchmark_return, 0)
  );
  month_name := to_char(to_date(new.month_key || '-01', 'YYYY-MM-DD'), 'Mon YYYY');

  if tg_op = 'INSERT' then
    event_kind := 'portfolio_published';
    event_title := 'Portfolio update published';
  elsif coalesce(old.is_published, false) = false then
    event_kind := 'portfolio_published';
    event_title := 'Portfolio update published';
  elsif new.live_portfolio_return is distinct from old.live_portfolio_return
     or new.live_benchmark_return is distinct from old.live_benchmark_return
     or new.final_portfolio_return is distinct from old.final_portfolio_return
     or new.final_benchmark_return is distinct from old.final_benchmark_return then
    event_kind := 'daily_performance_update';
    event_title := 'Daily performance updated';
  else
    event_kind := 'portfolio_rebalance';
    event_title := 'Portfolio changes published';
  end if;

  perform public.queue_alpha_notification(
    event_kind,
    event_title || ': ' || coalesce(portfolio_row.name, 'ALPHA CORE'),
    month_name || ' is now available. Current Alpha: ' ||
      (case when current_alpha >= 0 then '+' else '' end) || round(current_alpha, 2)::text || '%.',
    '/portfolio/' || coalesce(portfolio_row.slug, new.portfolio_id::text),
    jsonb_build_object(
      'portfolio_id', new.portfolio_id,
      'month_id', new.id,
      'month_key', new.month_key,
      'alpha', current_alpha
    ),
    event_kind || ':' || new.id::text || ':' ||
      to_char(coalesce(new.updated_at, now()), 'YYYYMMDDHH24MISSMS')
  );

  return new;
end;
$$;

drop trigger if exists enqueue_portfolio_update_notification on public.strategy_months;
create trigger enqueue_portfolio_update_notification
after insert or update on public.strategy_months
for each row execute function public.enqueue_portfolio_update_notification();

-- Explicit queue helper used after the existing bulk-price process.
create or replace function public.queue_daily_performance_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  month_row record;
  portfolio_row record;
  queued_count integer := 0;
  event_id uuid;
  current_alpha numeric;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  for month_row in
    select sm.*
    from public.strategy_months sm
    where sm.is_published = true and coalesce(sm.is_closed, false) = false
  loop
    select p.name, p.slug into portfolio_row
    from public.portfolios p where p.id = month_row.portfolio_id;

    current_alpha := coalesce(
      month_row.live_alpha,
      coalesce(month_row.live_portfolio_return, 0) - coalesce(month_row.live_benchmark_return, 0)
    );

    event_id := public.queue_alpha_notification(
      'daily_performance_update',
      'Daily performance updated: ' || coalesce(portfolio_row.name, 'ALPHA CORE'),
      to_char(to_date(month_row.month_key || '-01', 'YYYY-MM-DD'), 'Mon YYYY') ||
        ' is refreshed. Current Alpha: ' ||
        (case when current_alpha >= 0 then '+' else '' end) || round(current_alpha, 2)::text || '%.',
      '/portfolio/' || coalesce(portfolio_row.slug, month_row.portfolio_id::text),
      jsonb_build_object(
        'portfolio_id', month_row.portfolio_id,
        'month_id', month_row.id,
        'month_key', month_row.month_key,
        'alpha', current_alpha
      ),
      'daily-price-sync:' || month_row.id::text || ':' || to_char(now(), 'YYYYMMDDHH24MI')
    );

    if event_id is not null then queued_count := queued_count + 1; end if;
  end loop;

  return queued_count;
end;
$$;

revoke all on function public.queue_daily_performance_notifications() from public;
grant execute on function public.queue_daily_performance_notifications() to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Historical cumulative Alpha ledger and Peak Alpha
-- ---------------------------------------------------------------------------
create table if not exists public.portfolio_alpha_history (
  id bigint generated by default as identity primary key,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  source_month_id uuid references public.strategy_months(id) on delete set null,
  source_month_key text,
  cumulative_portfolio numeric not null,
  cumulative_benchmark numeric not null,
  cumulative_alpha numeric not null,
  observed_at timestamptz not null default now(),
  source_kind text not null default 'live_update'
);

create index if not exists portfolio_alpha_history_lookup_idx
  on public.portfolio_alpha_history(portfolio_id, observed_at desc);
create index if not exists portfolio_alpha_history_peak_idx
  on public.portfolio_alpha_history(portfolio_id, cumulative_alpha desc);

create table if not exists public.portfolio_peak_alpha (
  portfolio_id uuid primary key references public.portfolios(id) on delete cascade,
  peak_alpha numeric not null,
  cumulative_portfolio numeric not null,
  cumulative_benchmark numeric not null,
  achieved_at timestamptz not null,
  source_month_id uuid references public.strategy_months(id) on delete set null,
  source_month_key text,
  updated_at timestamptz not null default now()
);

alter table public.portfolio_alpha_history enable row level security;
alter table public.portfolio_peak_alpha enable row level security;

drop policy if exists "members read alpha history" on public.portfolio_alpha_history;
create policy "members read alpha history"
on public.portfolio_alpha_history for select
to authenticated
using (true);

drop policy if exists "public read portfolio peak alpha" on public.portfolio_peak_alpha;
create policy "public read portfolio peak alpha"
on public.portfolio_peak_alpha for select
to anon, authenticated
using (true);

grant select on public.portfolio_alpha_history to authenticated;
grant select on public.portfolio_peak_alpha to anon, authenticated;

create or replace function public.capture_portfolio_alpha_snapshot(
  p_portfolio_id uuid,
  p_source_month_id uuid default null,
  p_observed_at timestamptz default now(),
  p_source_kind text default 'live_update'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  month_row record;
  portfolio_factor numeric := 1;
  benchmark_factor numeric := 1;
  cumulative_portfolio numeric := 0;
  cumulative_benchmark numeric := 0;
  cumulative_alpha numeric := 0;
  source_key text;
begin
  for month_row in
    select sm.*
    from public.strategy_months sm
    where sm.portfolio_id = p_portfolio_id
      and sm.is_published = true
    order by sm.month_key asc
  loop
    portfolio_factor := portfolio_factor * (
      1 + (
        case
          when month_row.is_closed and month_row.final_portfolio_return is not null
            then month_row.final_portfolio_return
          else coalesce(month_row.live_portfolio_return, 0)
        end
      ) / 100.0
    );
    benchmark_factor := benchmark_factor * (
      1 + (
        case
          when month_row.is_closed and month_row.final_benchmark_return is not null
            then month_row.final_benchmark_return
          else coalesce(month_row.live_benchmark_return, 0)
        end
      ) / 100.0
    );
  end loop;

  cumulative_portfolio := (portfolio_factor - 1) * 100;
  cumulative_benchmark := (benchmark_factor - 1) * 100;
  cumulative_alpha := cumulative_portfolio - cumulative_benchmark;

  select sm.month_key into source_key
  from public.strategy_months sm
  where sm.id = p_source_month_id;

  insert into public.portfolio_alpha_history (
    portfolio_id,
    source_month_id,
    source_month_key,
    cumulative_portfolio,
    cumulative_benchmark,
    cumulative_alpha,
    observed_at,
    source_kind
  ) values (
    p_portfolio_id,
    p_source_month_id,
    source_key,
    cumulative_portfolio,
    cumulative_benchmark,
    cumulative_alpha,
    coalesce(p_observed_at, now()),
    left(coalesce(p_source_kind, 'live_update'), 50)
  );

  insert into public.portfolio_peak_alpha (
    portfolio_id,
    peak_alpha,
    cumulative_portfolio,
    cumulative_benchmark,
    achieved_at,
    source_month_id,
    source_month_key,
    updated_at
  ) values (
    p_portfolio_id,
    cumulative_alpha,
    cumulative_portfolio,
    cumulative_benchmark,
    coalesce(p_observed_at, now()),
    p_source_month_id,
    source_key,
    now()
  )
  on conflict (portfolio_id) do update
  set peak_alpha = excluded.peak_alpha,
      cumulative_portfolio = excluded.cumulative_portfolio,
      cumulative_benchmark = excluded.cumulative_benchmark,
      achieved_at = excluded.achieved_at,
      source_month_id = excluded.source_month_id,
      source_month_key = excluded.source_month_key,
      updated_at = now()
  where excluded.peak_alpha > public.portfolio_peak_alpha.peak_alpha;
end;
$$;

revoke all on function public.capture_portfolio_alpha_snapshot(uuid,uuid,timestamptz,text) from public;

create or replace function public.track_portfolio_peak_alpha()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_published is not true then return new; end if;

  if tg_op = 'INSERT' then
    perform public.capture_portfolio_alpha_snapshot(
      new.portfolio_id,
      new.id,
      coalesce(new.updated_at, now()),
      case when new.is_closed then 'month_close' else 'live_update' end
    );
    return new;
  end if;

  if new.live_portfolio_return is distinct from old.live_portfolio_return
     or new.live_benchmark_return is distinct from old.live_benchmark_return
     or new.final_portfolio_return is distinct from old.final_portfolio_return
     or new.final_benchmark_return is distinct from old.final_benchmark_return
     or new.is_closed is distinct from old.is_closed
     or new.is_published is distinct from old.is_published then
    perform public.capture_portfolio_alpha_snapshot(
      new.portfolio_id,
      new.id,
      coalesce(new.updated_at, now()),
      case when new.is_closed then 'month_close' else 'live_update' end
    );
  end if;

  return new;
end;
$$;

drop trigger if exists track_portfolio_peak_alpha on public.strategy_months;
create trigger track_portfolio_peak_alpha
after insert or update on public.strategy_months
for each row execute function public.track_portfolio_peak_alpha();

-- Backfill the maximum visible from existing monthly records. Intramonth peaks
-- that occurred before this upgrade cannot be reconstructed from absent history.
do $$
declare
  portfolio_row record;
  month_row record;
  portfolio_factor numeric;
  benchmark_factor numeric;
  cumulative_portfolio numeric;
  cumulative_benchmark numeric;
  cumulative_alpha numeric;
  peak_value numeric;
  peak_month_id uuid;
  peak_month_key text;
  peak_achieved_at timestamptz;
begin
  for portfolio_row in
    select distinct sm.portfolio_id
    from public.strategy_months sm
    where sm.is_published = true
  loop
    if exists (
      select 1 from public.portfolio_alpha_history h
      where h.portfolio_id = portfolio_row.portfolio_id
    ) then
      continue;
    end if;

    portfolio_factor := 1;
    benchmark_factor := 1;
    peak_value := null;

    for month_row in
      select sm.*
      from public.strategy_months sm
      where sm.portfolio_id = portfolio_row.portfolio_id
        and sm.is_published = true
      order by sm.month_key asc
    loop
      portfolio_factor := portfolio_factor * (
        1 + (
          case
            when month_row.is_closed and month_row.final_portfolio_return is not null
              then month_row.final_portfolio_return
            else coalesce(month_row.live_portfolio_return, 0)
          end
        ) / 100.0
      );
      benchmark_factor := benchmark_factor * (
        1 + (
          case
            when month_row.is_closed and month_row.final_benchmark_return is not null
              then month_row.final_benchmark_return
            else coalesce(month_row.live_benchmark_return, 0)
          end
        ) / 100.0
      );

      cumulative_portfolio := (portfolio_factor - 1) * 100;
      cumulative_benchmark := (benchmark_factor - 1) * 100;
      cumulative_alpha := cumulative_portfolio - cumulative_benchmark;

      insert into public.portfolio_alpha_history (
        portfolio_id, source_month_id, source_month_key,
        cumulative_portfolio, cumulative_benchmark, cumulative_alpha,
        observed_at, source_kind
      ) values (
        portfolio_row.portfolio_id, month_row.id, month_row.month_key,
        cumulative_portfolio, cumulative_benchmark, cumulative_alpha,
        coalesce(month_row.updated_at, to_date(month_row.month_key || '-01', 'YYYY-MM-DD')::timestamptz),
        'historical_backfill'
      );

      if peak_value is null or cumulative_alpha > peak_value then
        peak_value := cumulative_alpha;
        peak_month_id := month_row.id;
        peak_month_key := month_row.month_key;
        peak_achieved_at := coalesce(month_row.updated_at, to_date(month_row.month_key || '-01', 'YYYY-MM-DD')::timestamptz);
      end if;
    end loop;

    if peak_value is not null then
      insert into public.portfolio_peak_alpha (
        portfolio_id, peak_alpha, cumulative_portfolio, cumulative_benchmark,
        achieved_at, source_month_id, source_month_key
      )
      select
        portfolio_row.portfolio_id,
        h.cumulative_alpha,
        h.cumulative_portfolio,
        h.cumulative_benchmark,
        h.observed_at,
        h.source_month_id,
        h.source_month_key
      from public.portfolio_alpha_history h
      where h.portfolio_id = portfolio_row.portfolio_id
      order by h.cumulative_alpha desc, h.observed_at asc
      limit 1
      on conflict (portfolio_id) do update
      set peak_alpha = excluded.peak_alpha,
          cumulative_portfolio = excluded.cumulative_portfolio,
          cumulative_benchmark = excluded.cumulative_benchmark,
          achieved_at = excluded.achieved_at,
          source_month_id = excluded.source_month_id,
          source_month_key = excluded.source_month_key,
          updated_at = now()
      where excluded.peak_alpha > public.portfolio_peak_alpha.peak_alpha;
    end if;
  end loop;
end $$;

-- Realtime is useful for updating the Peak Alpha card without a reload.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'portfolio_peak_alpha',
    'notification_events'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target_table);
    end if;
  end loop;
end $$;

commit;
