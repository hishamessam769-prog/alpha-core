-- ALPHA CORE V2.2
-- Multiple portfolios + independent recommendations + research updates + Excel price import.
-- Run this complete file once in Supabase > SQL Editor BEFORE uploading the V2.2 website files.

create extension if not exists pgcrypto;

-- 1) Multiple portfolios
create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  name_ar text,
  description text,
  description_ar text,
  benchmark_ticker text not null default 'EGX30CAP',
  launch_date date not null default current_date,
  status text not null default 'live' check (status in ('draft','live','closed')),
  is_published boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.portfolios (
  slug, name, name_ar, description, description_ar, benchmark_ticker, launch_date, status, is_published
)
values (
  'alpha-core',
  'ALPHA CORE Portfolio',
  'محفظة ALPHA CORE',
  'The original ALPHA CORE monthly portfolio.',
  'المحفظة الشهرية الأساسية لمنصة ALPHA CORE.',
  'EGX30CAP',
  current_date,
  'live',
  true
)
on conflict (slug) do nothing;

alter table public.strategy_months
  add column if not exists portfolio_id uuid references public.portfolios(id) on delete cascade,
  add column if not exists benchmark_ticker text not null default 'EGX30CAP';

update public.strategy_months
set portfolio_id = (select id from public.portfolios where slug = 'alpha-core' limit 1)
where portfolio_id is null;

alter table public.strategy_months alter column portfolio_id set not null;

alter table public.strategy_months drop constraint if exists strategy_months_month_key_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'strategy_months_portfolio_month_key'
      and conrelid = 'public.strategy_months'::regclass
  ) then
    alter table public.strategy_months
      add constraint strategy_months_portfolio_month_key unique (portfolio_id, month_key);
  end if;
end $$;

create index if not exists strategy_months_portfolio_idx on public.strategy_months(portfolio_id, month_key desc);

-- 2) Master market prices and history
create table if not exists public.market_prices (
  ticker text primary key,
  company_name text,
  close_price numeric not null check (close_price >= 0),
  price_date date not null,
  source text not null default 'Excel upload',
  updated_at timestamptz not null default now()
);

create table if not exists public.price_history (
  id bigint generated always as identity primary key,
  ticker text not null,
  price_date date not null,
  close_price numeric not null check (close_price >= 0),
  source text not null default 'Excel upload',
  created_at timestamptz not null default now(),
  unique(ticker, price_date)
);

create index if not exists price_history_ticker_date_idx on public.price_history(ticker, price_date desc);

-- 3) Independent recommendations and research
create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  company_name text not null,
  title text not null,
  recommendation_date date not null,
  entry_price numeric not null check (entry_price > 0),
  target_price numeric not null check (target_price > 0),
  horizon_months integer not null default 12 check (horizon_months > 0),
  benchmark_ticker text not null default 'EGX30CAP',
  benchmark_entry numeric not null check (benchmark_entry > 0),
  status text not null default 'open' check (status in ('draft','open','closed','target_hit','stopped')),
  close_date date,
  close_price numeric check (close_price >= 0),
  benchmark_close numeric check (benchmark_close >= 0),
  company_story text,
  why_selected text,
  positives text,
  risks text,
  valuation text,
  is_published boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recommendations_status_date_idx on public.recommendations(status, recommendation_date desc);
create index if not exists recommendations_ticker_idx on public.recommendations(ticker);

create table if not exists public.recommendation_updates (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  update_date date not null default current_date,
  title text not null,
  body text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists recommendation_updates_rec_date_idx
  on public.recommendation_updates(recommendation_id, update_date desc);

-- 4) Apply uploaded prices only to OPEN records. Closed months and closed recommendations remain frozen.
create or replace function public.apply_latest_market_prices()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  holding_count integer := 0;
  month_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  update public.holdings h
  set close_price = mp.close_price
  from public.market_prices mp, public.strategy_months sm
  where h.month_id = sm.id
    and sm.is_closed = false
    and upper(h.ticker) = upper(mp.ticker);
  get diagnostics holding_count = row_count;

  update public.strategy_months sm
  set benchmark_close = mp.close_price,
      updated_at = now()
  from public.market_prices mp
  where sm.is_closed = false
    and upper(sm.benchmark_ticker) = upper(mp.ticker);

  with portfolio_returns as (
    select
      sm.id,
      coalesce(sum(
        (h.weight / 100.0) *
        case when h.open_price > 0 then ((h.close_price - h.open_price) / h.open_price) * 100 else 0 end
      ), 0) as portfolio_return,
      case when sm.benchmark_open > 0
        then ((sm.benchmark_close - sm.benchmark_open) / sm.benchmark_open) * 100
        else 0
      end as benchmark_return
    from public.strategy_months sm
    left join public.holdings h on h.month_id = sm.id
    where sm.is_closed = false
    group by sm.id, sm.benchmark_open, sm.benchmark_close
  )
  update public.strategy_months sm
  set live_portfolio_return = pr.portfolio_return,
      live_benchmark_return = pr.benchmark_return,
      live_alpha = pr.portfolio_return - pr.benchmark_return,
      updated_at = now()
  from portfolio_returns pr
  where sm.id = pr.id;
  get diagnostics month_count = row_count;

  return jsonb_build_object(
    'holdings_updated', holding_count,
    'open_months_recalculated', month_count,
    'applied_at', now()
  );
end;
$$;

grant execute on function public.apply_latest_market_prices() to authenticated;

-- 5) Row level security
alter table public.portfolios enable row level security;
alter table public.market_prices enable row level security;
alter table public.price_history enable row level security;
alter table public.recommendations enable row level security;
alter table public.recommendation_updates enable row level security;

drop policy if exists "members read published portfolios" on public.portfolios;
drop policy if exists "admin manages portfolios" on public.portfolios;
create policy "members read published portfolios"
on public.portfolios for select to authenticated
using (is_published = true or public.is_admin());
create policy "admin manages portfolios"
on public.portfolios for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "members read market prices" on public.market_prices;
drop policy if exists "admin manages market prices" on public.market_prices;
create policy "members read market prices"
on public.market_prices for select to authenticated
using (true);
create policy "admin manages market prices"
on public.market_prices for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "members read price history" on public.price_history;
drop policy if exists "admin manages price history" on public.price_history;
create policy "members read price history"
on public.price_history for select to authenticated
using (true);
create policy "admin manages price history"
on public.price_history for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "members read published recommendations" on public.recommendations;
drop policy if exists "admin manages recommendations" on public.recommendations;
create policy "members read published recommendations"
on public.recommendations for select to authenticated
using (is_published = true or public.is_admin());
create policy "admin manages recommendations"
on public.recommendations for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "members read published recommendation updates" on public.recommendation_updates;
drop policy if exists "admin manages recommendation updates" on public.recommendation_updates;
create policy "members read published recommendation updates"
on public.recommendation_updates for select to authenticated
using (
  exists (
    select 1 from public.recommendations r
    where r.id = recommendation_id
      and (r.is_published = true or public.is_admin())
  )
);
create policy "admin manages recommendation updates"
on public.recommendation_updates for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Existing strategy month rules already protect unpublished months.
-- Recreate the select policy so it also respects the portfolio publication status.
drop policy if exists "public reads published months" on public.strategy_months;
create policy "public reads published months"
on public.strategy_months for select to anon, authenticated
using (
  public.is_admin()
  or (
    is_published = true
    and exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.is_published = true
    )
  )
);

-- Audit new admin-managed data if the V1 audit function exists.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'audit_changes' and pronamespace = 'public'::regnamespace) then
    drop trigger if exists audit_portfolios on public.portfolios;
    create trigger audit_portfolios after insert or update or delete on public.portfolios
      for each row execute function public.audit_changes();

    drop trigger if exists audit_recommendations on public.recommendations;
    create trigger audit_recommendations after insert or update or delete on public.recommendations
      for each row execute function public.audit_changes();

    drop trigger if exists audit_recommendation_updates on public.recommendation_updates;
    create trigger audit_recommendation_updates after insert or update or delete on public.recommendation_updates
      for each row execute function public.audit_changes();
  end if;
end $$;

-- Realtime additions, safely.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='portfolios') then
    alter publication supabase_realtime add table public.portfolios;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='market_prices') then
    alter publication supabase_realtime add table public.market_prices;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='recommendations') then
    alter publication supabase_realtime add table public.recommendations;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='recommendation_updates') then
    alter publication supabase_realtime add table public.recommendation_updates;
  end if;
end $$;

update public.profiles
set is_admin = true
where email = 'hishamessam769@gmail.com';
