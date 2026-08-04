-- ALPHA PLATFORM V3.7.1 — dynamic notification copy and exact deep links
-- Additive function replacement only. No tables, columns, calculations or routes are removed.
begin;

create or replace function public.enqueue_recommendation_publish_notification()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  display_name text;
  message_body text;
begin
  if new.is_published is not true or coalesce(new.send_push_notification,true) is not true then return new; end if;
  if tg_op='UPDATE' and coalesce(old.is_published,false)=true then return new; end if;
  display_name := coalesce(nullif(new.ticker,''), nullif(new.company_name,''), 'ALPHA CORE');
  message_body := display_name || case when nullif(new.company_name,'') is not null and new.company_name <> display_name then ' · ' || new.company_name else '' end || ' — Read the investment thesis, target price and risk case now.';
  perform public.queue_alpha_notification(
    'new_recommendation',
    'New Recommendation: ' || display_name,
    message_body,
    '/recommendations/'||new.id::text,
    jsonb_build_object('recommendation_id',new.id,'ticker',new.ticker,'company_name',new.company_name,'deep_link','/recommendations/'||new.id::text),
    'recommendation-published:'||new.id::text
  );
  return new;
end; $$;

drop trigger if exists enqueue_recommendation_publish_notification on public.recommendations;
create trigger enqueue_recommendation_publish_notification after insert or update on public.recommendations for each row execute function public.enqueue_recommendation_publish_notification();

create or replace function public.enqueue_portfolio_update_notification()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  p record;
  event_kind text;
  event_title text;
  event_body text;
  current_alpha numeric;
  portfolio_return numeric;
  benchmark_return numeric;
  month_name text;
  target_link text;
begin
  if new.is_published is not true or coalesce(new.send_push_notification,true) is not true then return new; end if;
  if tg_op='UPDATE' and new.updated_at is not distinct from old.updated_at and new.live_portfolio_return is not distinct from old.live_portfolio_return and new.live_benchmark_return is not distinct from old.live_benchmark_return and new.final_portfolio_return is not distinct from old.final_portfolio_return and new.final_benchmark_return is not distinct from old.final_benchmark_return and new.is_closed is not distinct from old.is_closed then return new; end if;

  select name,slug into p from public.portfolios where id=new.portfolio_id;
  portfolio_return := case when coalesce(new.is_closed,false) then coalesce(new.final_portfolio_return,new.live_portfolio_return,0) else coalesce(new.live_portfolio_return,0) end;
  benchmark_return := case when coalesce(new.is_closed,false) then coalesce(new.final_benchmark_return,new.live_benchmark_return,0) else coalesce(new.live_benchmark_return,0) end;
  current_alpha := coalesce(new.live_alpha, portfolio_return-benchmark_return);
  month_name := to_char(to_date(new.month_key||'-01','YYYY-MM-DD'),'FMMonth YYYY');
  target_link := '/portfolio/'||coalesce(p.slug,new.portfolio_id::text);

  if tg_op='INSERT' or (tg_op='UPDATE' and coalesce(old.is_published,false)=false) then
    event_kind := 'portfolio_published';
    event_title := coalesce(p.name,'ALPHA CORE') || ' update: ' || month_name || ' factsheet is now live';
    event_body := 'Portfolio ' || (case when portfolio_return>=0 then '+' else '' end) || round(portfolio_return,2)::text || '%, benchmark ' || (case when benchmark_return>=0 then '+' else '' end) || round(benchmark_return,2)::text || '%, Alpha ' || (case when current_alpha>=0 then '+' else '' end) || round(current_alpha,2)::text || '%.';
  elsif new.live_portfolio_return is distinct from old.live_portfolio_return or new.live_benchmark_return is distinct from old.live_benchmark_return or new.final_portfolio_return is distinct from old.final_portfolio_return or new.final_benchmark_return is distinct from old.final_benchmark_return then
    event_kind := 'daily_performance_update';
    event_title := coalesce(p.name,'ALPHA CORE') || ' performance updated';
    event_body := month_name || ': Portfolio ' || (case when portfolio_return>=0 then '+' else '' end) || round(portfolio_return,2)::text || '%, benchmark ' || (case when benchmark_return>=0 then '+' else '' end) || round(benchmark_return,2)::text || '%, Alpha ' || (case when current_alpha>=0 then '+' else '' end) || round(current_alpha,2)::text || '%.';
  else
    event_kind := 'portfolio_rebalance';
    event_title := coalesce(p.name,'ALPHA CORE') || ' rebalanced';
    event_body := month_name || ' holdings, weights and portfolio commentary have been updated.';
  end if;

  perform public.queue_alpha_notification(
    event_kind,event_title,event_body,target_link,
    jsonb_build_object('portfolio_id',new.portfolio_id,'month_id',new.id,'month_key',new.month_key,'alpha',current_alpha,'portfolio_return',portfolio_return,'benchmark_return',benchmark_return,'deep_link',target_link),
    event_kind||':'||new.id::text||':'||to_char(coalesce(new.updated_at,now()),'YYYYMMDDHH24MISSMS')
  );
  return new;
end; $$;

drop trigger if exists enqueue_portfolio_update_notification on public.strategy_months;
create trigger enqueue_portfolio_update_notification after insert or update on public.strategy_months for each row execute function public.enqueue_portfolio_update_notification();

create or replace function public.enqueue_new_portfolio_notification()
returns trigger language plpgsql security definer set search_path=public as $$
declare target_link text;
begin
  target_link := '/portfolio/'||coalesce(new.slug,new.id::text);
  if new.is_published is true and coalesce(new.send_push_notification,true) is true and (tg_op='INSERT' or coalesce(old.is_published,false)=false) then
    perform public.queue_alpha_notification(
      'new_portfolio',
      'New Portfolio: '||coalesce(new.name,'ALPHA CORE'),
      coalesce(new.description,'A new investment strategy is now live. Open the portfolio to review its mandate, holdings and performance.'),
      target_link,
      jsonb_build_object('portfolio_id',new.id,'deep_link',target_link),
      'portfolio-launched:'||new.id::text
    );
  end if;
  return new;
end; $$;

drop trigger if exists enqueue_new_portfolio_notification on public.portfolios;
create trigger enqueue_new_portfolio_notification after insert or update on public.portfolios for each row execute function public.enqueue_new_portfolio_notification();

create or replace function public.enqueue_recommendation_update_notification()
returns trigger language plpgsql security definer set search_path=public as $$
declare r record; target_link text; display_name text;
begin
  if coalesce(new.send_push_notification,true) is not true then return new; end if;
  select ticker,company_name,is_published into r from public.recommendations where id=new.recommendation_id;
  if coalesce(r.is_published,false) then
    target_link := '/recommendations/'||new.recommendation_id::text;
    display_name := coalesce(nullif(r.ticker,''),nullif(r.company_name,''),'ALPHA CORE');
    perform public.queue_alpha_notification(
      'recommendation_update',
      display_name || ' recommendation updated',
      coalesce(nullif(new.title,''),'A new update has been added to the investment thesis and recommendation timeline.'),
      target_link,
      jsonb_build_object('recommendation_id',new.recommendation_id,'update_id',new.id,'deep_link',target_link),
      'recommendation-update:'||new.id::text
    );
  end if;
  return new;
end; $$;

drop trigger if exists enqueue_recommendation_update_notification on public.recommendation_updates;
create trigger enqueue_recommendation_update_notification after insert on public.recommendation_updates for each row execute function public.enqueue_recommendation_update_notification();

create or replace function public.queue_daily_performance_notifications()
returns integer language plpgsql security definer set search_path=public as $$
declare
  month_row record;
  portfolio_row record;
  queued_count integer := 0;
  event_id uuid;
  current_alpha numeric;
  portfolio_return numeric;
  benchmark_return numeric;
  month_name text;
  target_link text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  for month_row in select sm.* from public.strategy_months sm where sm.is_published=true and coalesce(sm.is_closed,false)=false loop
    select p.name,p.slug into portfolio_row from public.portfolios p where p.id=month_row.portfolio_id;
    portfolio_return := coalesce(month_row.live_portfolio_return,0);
    benchmark_return := coalesce(month_row.live_benchmark_return,0);
    current_alpha := coalesce(month_row.live_alpha,portfolio_return-benchmark_return);
    month_name := to_char(to_date(month_row.month_key||'-01','YYYY-MM-DD'),'FMMonth YYYY');
    target_link := '/portfolio/'||coalesce(portfolio_row.slug,month_row.portfolio_id::text);

    event_id := public.queue_alpha_notification(
      'daily_performance_update',
      coalesce(portfolio_row.name,'ALPHA CORE') || ' performance updated',
      month_name || ': Portfolio ' || (case when portfolio_return>=0 then '+' else '' end) || round(portfolio_return,2)::text || '%, benchmark ' || (case when benchmark_return>=0 then '+' else '' end) || round(benchmark_return,2)::text || '%, Alpha ' || (case when current_alpha>=0 then '+' else '' end) || round(current_alpha,2)::text || '%.',
      target_link,
      jsonb_build_object('portfolio_id',month_row.portfolio_id,'month_id',month_row.id,'month_key',month_row.month_key,'alpha',current_alpha,'portfolio_return',portfolio_return,'benchmark_return',benchmark_return,'deep_link',target_link),
      'daily-price-sync:'||month_row.id::text||':'||to_char(now(),'YYYYMMDDHH24MI')
    );
    if event_id is not null then queued_count:=queued_count+1; end if;
  end loop;
  return queued_count;
end; $$;
revoke all on function public.queue_daily_performance_notifications() from public;
grant execute on function public.queue_daily_performance_notifications() to authenticated;

commit;
