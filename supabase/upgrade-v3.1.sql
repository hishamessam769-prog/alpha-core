-- ALPHA PLATFORM V3.1
-- Safe, additive upgrade over ALPHA PLATFORM V3.0 / ALPHA CORE V2.3.1.
-- Adds UI-supporting data only. Existing portfolios, calculations, auth,
-- permissions, reports, recommendations and workflows are preserved.
-- Run once in Supabase SQL Editor using the project owner role.

begin;

-- ---------------------------------------------------------------------------
-- 1) Investment thesis per portfolio holding
-- ---------------------------------------------------------------------------
alter table public.holdings
  add column if not exists investment_thesis text;

comment on column public.holdings.investment_thesis is
  'Portfolio-specific investment thesis for this selected holding.';

-- ---------------------------------------------------------------------------
-- 2) Dynamic platform identity, footer, pricing and landing highlights
-- ---------------------------------------------------------------------------
create table if not exists public.platform_settings (
  id text primary key default 'global' check (id = 'global'),
  logo_url text,
  logo_path text,
  footer_intro_en text not null default 'Independent investment intelligence designed to present performance and decisions with institutional transparency.',
  footer_intro_ar text not null default 'منصة بيانات وأبحاث استثمارية مستقلة مصممة لعرض الأداء والقرارات بشفافية مؤسسية.',
  footer_badge_en text not null default 'Auditable published data',
  footer_badge_ar text not null default 'بيانات منشورة قابلة للمراجعة',
  footer_copyright_en text default '© 2026 ALPHA PLATFORM. All rights reserved.',
  footer_copyright_ar text default '© 2026 ALPHA PLATFORM. جميع الحقوق محفوظة.',
  privacy_url text default '#privacy',
  terms_url text default '#terms',
  contact_email text not null default 'hello@alphacore.app',
  contact_phone text,
  contact_address_en text default 'Cairo, Egypt',
  contact_address_ar text default 'القاهرة، مصر',
  disclaimer_en text not null default 'Past performance does not guarantee future results.',
  disclaimer_ar text not null default 'الأداء السابق لا يضمن النتائج المستقبلية.',
  footer_custom_text_en text default 'Educational information only — not personalised investment advice.',
  footer_custom_text_ar text default 'المحتوى تعليمي ومعلوماتي عام وليس نصيحة استثمارية شخصية.',
  pricing_eyebrow_en text default 'SIMPLE ACCESS',
  pricing_eyebrow_ar text default 'وصول بسيط وواضح',
  pricing_title_en text default 'Start with complete access, free',
  pricing_title_ar text default 'ابدأ بالوصول الكامل مجانًا',
  pricing_description_en text default 'Explore performance, recommendations and reports before any future paid plans.',
  pricing_description_ar text default 'استكشف الأداء والتوصيات والتقارير قبل أي خطط مدفوعة مستقبلية.',
  pricing_plan_name_en text default 'Platform membership',
  pricing_plan_name_ar text default 'عضوية المنصة',
  pricing_plan_description_en text default 'Every current platform experience in one account.',
  pricing_plan_description_ar text default 'كل أدوات المنصة الحالية في حساب واحد.',
  pricing_price text default '£0',
  pricing_period_en text default 'currently',
  pricing_period_ar text default 'حاليًا',
  pricing_cta_en text default 'Create free account',
  pricing_cta_ar text default 'إنشاء حساب',
  pricing_features jsonb not null default '["Portfolio factsheets","Independent recommendations","Weekly reports","AI-ready summaries"]'::jsonb,
  pricing_features_ar jsonb not null default '["تقارير المحافظ","التوصيات المستقلة","التقارير الأسبوعية","ملخصات جاهزة للذكاء الاصطناعي"]'::jsonb,
  social_linkedin text,
  social_facebook text,
  social_x text,
  landing_highlights jsonb not null default '[
    {"value":"+5.00%","label_en":"Portfolio MTD","label_ar":"عائد المحفظة الشهري","detail_en":"Latest published portfolio snapshot","detail_ar":"أحدث لقطة أداء منشورة"},
    {"value":"+1.90%","label_en":"Alpha MTD","label_ar":"الألفا الشهرية","detail_en":"Return above the selected benchmark","detail_ar":"العائد فوق المؤشر المرجعي"},
    {"value":"100%","label_en":"Transparent record","label_ar":"سجل شفاف","detail_en":"Published decisions remain on record","detail_ar":"كل القرارات المنشورة تظل محفوظة"}
  ]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

-- Keep future reruns safe if a partial V3.1 table already exists.
alter table public.platform_settings
  add column if not exists logo_url text,
  add column if not exists logo_path text,
  add column if not exists footer_intro_en text,
  add column if not exists footer_intro_ar text,
  add column if not exists footer_badge_en text,
  add column if not exists footer_badge_ar text,
  add column if not exists footer_copyright_en text,
  add column if not exists footer_copyright_ar text,
  add column if not exists privacy_url text,
  add column if not exists terms_url text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists contact_address_en text,
  add column if not exists contact_address_ar text,
  add column if not exists disclaimer_en text,
  add column if not exists disclaimer_ar text,
  add column if not exists footer_custom_text_en text,
  add column if not exists footer_custom_text_ar text,
  add column if not exists pricing_eyebrow_en text,
  add column if not exists pricing_eyebrow_ar text,
  add column if not exists pricing_title_en text,
  add column if not exists pricing_title_ar text,
  add column if not exists pricing_description_en text,
  add column if not exists pricing_description_ar text,
  add column if not exists pricing_plan_name_en text,
  add column if not exists pricing_plan_name_ar text,
  add column if not exists pricing_plan_description_en text,
  add column if not exists pricing_plan_description_ar text,
  add column if not exists pricing_price text,
  add column if not exists pricing_period_en text,
  add column if not exists pricing_period_ar text,
  add column if not exists pricing_cta_en text,
  add column if not exists pricing_cta_ar text,
  add column if not exists pricing_features jsonb,
  add column if not exists pricing_features_ar jsonb,
  add column if not exists social_linkedin text,
  add column if not exists social_facebook text,
  add column if not exists social_x text,
  add column if not exists landing_highlights jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

insert into public.platform_settings (id)
values ('global')
on conflict (id) do nothing;

create or replace function public.set_platform_settings_audit_fields()
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
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

drop trigger if exists platform_settings_audit_fields on public.platform_settings;
create trigger platform_settings_audit_fields
before insert or update on public.platform_settings
for each row execute function public.set_platform_settings_audit_fields();

alter table public.platform_settings enable row level security;

drop policy if exists "public read platform settings" on public.platform_settings;
create policy "public read platform settings"
on public.platform_settings for select
to anon, authenticated
using (true);

drop policy if exists "admins insert platform settings" on public.platform_settings;
create policy "admins insert platform settings"
on public.platform_settings for insert
to authenticated
with check (public.is_admin());

drop policy if exists "admins update platform settings" on public.platform_settings;
create policy "admins update platform settings"
on public.platform_settings for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "super admins delete platform settings" on public.platform_settings;
create policy "super admins delete platform settings"
on public.platform_settings for delete
to authenticated
using (public.is_super_admin());

grant select on public.platform_settings to anon, authenticated;
grant insert, update, delete on public.platform_settings to authenticated;

-- Record settings changes in the existing V2.3.1 activity log.
do $$
begin
  if to_regprocedure('public.log_alpha_core_activity()') is not null then
    execute 'drop trigger if exists alpha_core_activity_log on public.platform_settings';
    execute 'create trigger alpha_core_activity_log after insert or update or delete on public.platform_settings for each row execute function public.log_alpha_core_activity()';
  end if;
end $$;

-- Public logo storage. Admin write access remains protected by existing roles.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'platform-assets',
  'platform-assets',
  true,
  3145728,
  array['image/png','image/jpeg','image/webp','image/svg+xml']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read platform assets" on storage.objects;
create policy "public read platform assets"
on storage.objects for select
to public
using (bucket_id = 'platform-assets');

drop policy if exists "admins upload platform assets" on storage.objects;
create policy "admins upload platform assets"
on storage.objects for insert
to authenticated
with check (bucket_id = 'platform-assets' and public.is_admin());

drop policy if exists "admins update platform assets" on storage.objects;
create policy "admins update platform assets"
on storage.objects for update
to authenticated
using (bucket_id = 'platform-assets' and public.is_admin())
with check (bucket_id = 'platform-assets' and public.is_admin());

drop policy if exists "super admins delete platform assets" on storage.objects;
create policy "super admins delete platform assets"
on storage.objects for delete
to authenticated
using (bucket_id = 'platform-assets' and public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 3) Logged-in member support inbox and persistent conversation history
-- ---------------------------------------------------------------------------
create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text,
  user_email text,
  subject text not null default 'Suggestion or support request',
  status text not null default 'open' check (status in ('open','pending','resolved')),
  assigned_to uuid references auth.users(id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('user','admin')),
  channel text not null default 'platform' check (channel in ('platform','email','system')),
  message text not null check (char_length(trim(message)) between 1 and 3000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.support_messages
  add column if not exists channel text not null default 'platform';

create index if not exists support_threads_user_idx
  on public.support_threads(user_id, last_message_at desc);
create index if not exists support_threads_status_idx
  on public.support_threads(status, last_message_at desc);
create index if not exists support_messages_thread_idx
  on public.support_messages(thread_id, created_at asc);

create or replace function public.prepare_support_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member record;
begin
  if auth.uid() is not null and not public.is_admin() then
    new.user_id := auth.uid();
  end if;

  select p.full_name, p.email
    into member
  from public.profiles p
  where p.id = new.user_id;

  new.user_name := coalesce(nullif(member.full_name, ''), nullif(member.email, ''), new.user_name, 'Platform member');
  new.user_email := coalesce(nullif(member.email, ''), new.user_email);
  new.subject := coalesce(nullif(trim(new.subject), ''), 'Suggestion or support request');
  new.updated_at := now();
  new.last_message_at := coalesce(new.last_message_at, now());
  return new;
end;
$$;

drop trigger if exists prepare_support_thread on public.support_threads;
create trigger prepare_support_thread
before insert or update on public.support_threads
for each row execute function public.prepare_support_thread();

create or replace function public.prepare_support_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.sender_id := auth.uid();
    new.sender_role := 'user';
  else
    new.sender_id := coalesce(new.sender_id, auth.uid());
  end if;
  new.message := trim(new.message);
  return new;
end;
$$;

drop trigger if exists prepare_support_message on public.support_messages;
create trigger prepare_support_message
before insert on public.support_messages
for each row execute function public.prepare_support_message();

create or replace function public.touch_support_thread_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_threads
  set last_message_at = new.created_at,
      updated_at = now(),
      status = case when new.sender_role = 'user' then 'open' else status end
  where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists touch_support_thread_from_message on public.support_messages;
create trigger touch_support_thread_from_message
after insert on public.support_messages
for each row execute function public.touch_support_thread_from_message();

-- Members may mark admin replies as read, but cannot edit message content.
create or replace function public.protect_support_message_content()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.thread_id := old.thread_id;
    new.sender_id := old.sender_id;
    new.sender_role := old.sender_role;
    new.channel := old.channel;
    new.message := old.message;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_support_message_content on public.support_messages;
create trigger protect_support_message_content
before update on public.support_messages
for each row execute function public.protect_support_message_content();

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "members and admins read support threads" on public.support_threads;
create policy "members and admins read support threads"
on public.support_threads for select
to authenticated
using (public.is_admin() or user_id = auth.uid());

drop policy if exists "members create own support threads" on public.support_threads;
create policy "members create own support threads"
on public.support_threads for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "admins update support threads" on public.support_threads;
create policy "admins update support threads"
on public.support_threads for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "super admins delete support threads" on public.support_threads;
create policy "super admins delete support threads"
on public.support_threads for delete
to authenticated
using (public.is_super_admin());

drop policy if exists "members and admins read support messages" on public.support_messages;
create policy "members and admins read support messages"
on public.support_messages for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.support_threads st
    where st.id = thread_id and st.user_id = auth.uid()
  )
);

drop policy if exists "members and admins create support messages" on public.support_messages;
create policy "members and admins create support messages"
on public.support_messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and (
    (public.is_admin() and sender_role = 'admin')
    or (
      sender_role = 'user'
      and exists (
        select 1 from public.support_threads st
        where st.id = thread_id and st.user_id = auth.uid()
      )
    )
  )
);

drop policy if exists "members mark admin support replies read" on public.support_messages;
create policy "members mark admin support replies read"
on public.support_messages for update
to authenticated
using (
  sender_role = 'admin'
  and exists (
    select 1 from public.support_threads st
    where st.id = thread_id and st.user_id = auth.uid()
  )
)
with check (
  sender_role = 'admin'
  and exists (
    select 1 from public.support_threads st
    where st.id = thread_id and st.user_id = auth.uid()
  )
);

drop policy if exists "admins update support messages" on public.support_messages;
create policy "admins update support messages"
on public.support_messages for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "super admins delete support messages" on public.support_messages;
create policy "super admins delete support messages"
on public.support_messages for delete
to authenticated
using (public.is_super_admin());

grant select, insert, update, delete on public.support_threads to authenticated;
grant select, insert, update, delete on public.support_messages to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Smart member survey and Admin analytics
-- ---------------------------------------------------------------------------
create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text,
  user_email text,
  rating smallint not null check (rating between 1 and 5),
  feedback text check (feedback is null or char_length(feedback) <= 1000),
  trigger_context text,
  page_path text,
  created_at timestamptz not null default now()
);

create index if not exists survey_responses_created_idx
  on public.survey_responses(created_at desc);
create index if not exists survey_responses_user_idx
  on public.survey_responses(user_id, created_at desc);
create index if not exists survey_responses_rating_idx
  on public.survey_responses(rating, created_at desc);

create or replace function public.prepare_survey_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member record;
begin
  if auth.uid() is not null and not public.is_admin() then
    new.user_id := auth.uid();
  end if;

  select p.full_name, p.email
    into member
  from public.profiles p
  where p.id = new.user_id;

  new.user_name := coalesce(nullif(member.full_name, ''), nullif(member.email, ''), 'Platform member');
  new.user_email := member.email;
  new.feedback := nullif(trim(new.feedback), '');
  new.page_path := left(coalesce(new.page_path, '/'), 500);
  new.trigger_context := left(coalesce(new.trigger_context, 'unknown'), 100);
  return new;
end;
$$;

drop trigger if exists prepare_survey_response on public.survey_responses;
create trigger prepare_survey_response
before insert on public.survey_responses
for each row execute function public.prepare_survey_response();

alter table public.survey_responses enable row level security;

drop policy if exists "members read own survey responses" on public.survey_responses;
create policy "members read own survey responses"
on public.survey_responses for select
to authenticated
using (public.is_admin() or user_id = auth.uid());

drop policy if exists "members submit survey responses" on public.survey_responses;
create policy "members submit survey responses"
on public.survey_responses for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "super admins delete survey responses" on public.survey_responses;
create policy "super admins delete survey responses"
on public.survey_responses for delete
to authenticated
using (public.is_super_admin());

grant select, insert, delete on public.survey_responses to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Public landing page value highlights from published data only
-- ---------------------------------------------------------------------------
create or replace function public.get_public_performance_highlights()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  latest_month record;
  month_row record;
  portfolio_count integer := 0;
  open_recommendation_count integer := 0;
  cumulative_portfolio numeric := 0;
  cumulative_benchmark numeric := 0;
  portfolio_factor numeric := 1;
  benchmark_factor numeric := 1;
  current_portfolio numeric := 0;
  current_benchmark numeric := 0;
begin
  select sm.*
    into latest_month
  from public.strategy_months sm
  join public.portfolios p on p.id = sm.portfolio_id
  where sm.is_published = true
    and p.is_published = true
  order by sm.month_key desc, sm.updated_at desc
  limit 1;

  select count(*) into portfolio_count
  from public.portfolios p
  where p.is_published = true;

  select count(*) into open_recommendation_count
  from public.recommendations r
  where r.is_published = true
    and lower(coalesce(r.status, 'open')) <> 'closed';

  if latest_month.id is null then
    return jsonb_build_object(
      'has_data', false,
      'portfolios_count', portfolio_count,
      'open_recommendations', open_recommendation_count
    );
  end if;

  current_portfolio := case
    when latest_month.is_closed and latest_month.final_portfolio_return is not null
      then latest_month.final_portfolio_return
    else coalesce(latest_month.live_portfolio_return, 0)
  end;

  current_benchmark := case
    when latest_month.is_closed and latest_month.final_benchmark_return is not null
      then latest_month.final_benchmark_return
    else coalesce(latest_month.live_benchmark_return, 0)
  end;

  for month_row in
    select sm.*
    from public.strategy_months sm
    where sm.portfolio_id = latest_month.portfolio_id
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

  return jsonb_build_object(
    'has_data', true,
    'portfolio_id', latest_month.portfolio_id,
    'month_key', latest_month.month_key,
    'portfolio_return', round(current_portfolio, 4),
    'benchmark_return', round(current_benchmark, 4),
    'alpha', round(current_portfolio - current_benchmark, 4),
    'cumulative_portfolio', round(cumulative_portfolio, 4),
    'cumulative_benchmark', round(cumulative_benchmark, 4),
    'cumulative_alpha', round(cumulative_portfolio - cumulative_benchmark, 4),
    'benchmark_ticker', latest_month.benchmark_ticker,
    'portfolios_count', portfolio_count,
    'open_recommendations', open_recommendation_count,
    'last_updated', latest_month.updated_at
  );
end;
$$;

revoke all on function public.get_public_performance_highlights() from public;
grant execute on function public.get_public_performance_highlights() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6) Realtime registration for settings and member experience
-- ---------------------------------------------------------------------------
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'platform_settings',
    'support_threads',
    'support_messages',
    'survey_responses'
  ] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target_table);
    end if;
  end loop;
end $$;

commit;
