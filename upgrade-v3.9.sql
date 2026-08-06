-- ALPHA PLATFORM V3.9 — ALPHA APEX Robo-Advisor
-- Additive only. Does not alter portfolio calculations, recommendation logic,
-- notifications, market prices, reports, authentication, or existing tables.

begin;

create extension if not exists pgcrypto;

create table if not exists public.robo_advisor_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null,
  score smallint not null check (score between 5 and 15),
  score_breakdown jsonb not null,
  persona text not null check (persona in ('conservative', 'balanced', 'aggressive')),
  allocation jsonb not null,
  model_version text not null default '3.9.0',
  completed_at timestamptz not null default now(),
  next_review_at timestamptz not null default (now() + interval '3 months'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists robo_advisor_assessments_user_idx
  on public.robo_advisor_assessments(user_id, completed_at desc);
create index if not exists robo_advisor_assessments_persona_idx
  on public.robo_advisor_assessments(persona, completed_at desc);

alter table public.robo_advisor_assessments enable row level security;

drop policy if exists robo_advisor_select_own_or_super_admin on public.robo_advisor_assessments;
create policy robo_advisor_select_own_or_super_admin
on public.robo_advisor_assessments for select
to authenticated
using (auth.uid() = user_id or public.is_super_admin());

grant select on public.robo_advisor_assessments to authenticated;

create or replace function public.alpha_robo_option_score(p_option text)
returns integer
language sql
immutable
as $$
  select case upper(trim(coalesce(p_option, '')))
    when 'A' then 1
    when 'B' then 2
    when 'C' then 3
    else 0
  end;
$$;

create or replace function public.submit_robo_advisor_assessment(p_answers jsonb)
returns public.robo_advisor_assessments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_q1 text := upper(trim(coalesce(p_answers ->> 'q1', '')));
  v_q2 text := upper(trim(coalesce(p_answers ->> 'q2', '')));
  v_q3 text := upper(trim(coalesce(p_answers ->> 'q3', '')));
  v_q4 text := upper(trim(coalesce(p_answers ->> 'q4', '')));
  v_q5 text := upper(trim(coalesce(p_answers ->> 'q5', '')));
  v_score integer;
  v_persona text;
  v_allocation jsonb;
  v_breakdown jsonb;
  v_result public.robo_advisor_assessments;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_q1 not in ('A','B','C')
     or v_q2 not in ('A','B','C')
     or v_q3 not in ('A','B','C')
     or v_q4 not in ('A','B','C')
     or v_q5 not in ('A','B','C') then
    raise exception 'All five answers must be A, B, or C';
  end if;

  v_score := public.alpha_robo_option_score(v_q1)
           + public.alpha_robo_option_score(v_q2)
           + public.alpha_robo_option_score(v_q3)
           + public.alpha_robo_option_score(v_q4)
           + public.alpha_robo_option_score(v_q5);

  v_breakdown := jsonb_build_object(
    'q1', public.alpha_robo_option_score(v_q1),
    'q2', public.alpha_robo_option_score(v_q2),
    'q3', public.alpha_robo_option_score(v_q3),
    'q4', public.alpha_robo_option_score(v_q4),
    'q5', public.alpha_robo_option_score(v_q5)
  );

  if v_score between 5 and 7 then
    v_persona := 'conservative';
    v_allocation := jsonb_build_array(
      jsonb_build_object('key','money_market','weight',70,'asset_class','Money Market & Fixed Income Funds','asset_type','Daily-liquidity cash and debt funds'),
      jsonb_build_object('key','gold','weight',20,'asset_class','Gold Funds','asset_type','Inflation and currency protection'),
      jsonb_build_object('key','equity_funds','weight',10,'asset_class','Equity Funds','asset_type','Low-beta managed equity exposure')
    );
  elsif v_score between 8 and 11 then
    v_persona := 'balanced';
    v_allocation := jsonb_build_array(
      jsonb_build_object('key','equity_index','weight',50,'asset_class','Equity Index / Accumulative Funds','asset_type','Fund 1000 or broad managed equity funds'),
      jsonb_build_object('key','money_market','weight',30,'asset_class','Money Market & Debt Funds','asset_type','Portfolio stability anchor'),
      jsonb_build_object('key','gold','weight',20,'asset_class','Gold Funds','asset_type','FX and inflation hedge')
    );
  else
    v_persona := 'aggressive';
    v_allocation := jsonb_build_array(
      jsonb_build_object('key','high_conviction','weight',70,'asset_class','Concentrated High-Conviction Equities','asset_type','Alpha Apex 7X / Core 5 sector strategy'),
      jsonb_build_object('key','equity_funds','weight',20,'asset_class','Equity Accumulative Funds','asset_type','Broad-market diversification'),
      jsonb_build_object('key','tactical_reserve','weight',10,'asset_class','Gold / Tactical Cash Reserve','asset_type','Reserve for buying market corrections')
    );
  end if;

  insert into public.robo_advisor_assessments (
    user_id,
    answers,
    score,
    score_breakdown,
    persona,
    allocation,
    model_version,
    completed_at,
    next_review_at,
    created_at,
    updated_at
  ) values (
    v_user_id,
    jsonb_build_object('q1',v_q1,'q2',v_q2,'q3',v_q3,'q4',v_q4,'q5',v_q5),
    v_score,
    v_breakdown,
    v_persona,
    v_allocation,
    '3.9.0',
    now(),
    now() + interval '3 months',
    now(),
    now()
  ) returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.alpha_robo_option_score(text) from public;
revoke all on function public.submit_robo_advisor_assessment(jsonb) from public;
grant execute on function public.submit_robo_advisor_assessment(jsonb) to authenticated;

-- Optional private aggregate for future Super Admin analytics. It exposes no
-- individual questionnaire answers and is protected server-side.
create or replace function public.get_robo_advisor_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Super Admin access required';
  end if;

  return jsonb_build_object(
    'total_assessments', (select count(*) from public.robo_advisor_assessments),
    'assessed_users', (select count(distinct user_id) from public.robo_advisor_assessments),
    'conservative', (select count(*) from public.robo_advisor_assessments where persona = 'conservative'),
    'balanced', (select count(*) from public.robo_advisor_assessments where persona = 'balanced'),
    'aggressive', (select count(*) from public.robo_advisor_assessments where persona = 'aggressive'),
    'average_score', coalesce((select round(avg(score), 2) from public.robo_advisor_assessments), 0),
    'generated_at', now()
  );
end;
$$;

revoke all on function public.get_robo_advisor_summary() from public;
grant execute on function public.get_robo_advisor_summary() to authenticated;

commit;
