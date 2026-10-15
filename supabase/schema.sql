-- Fix the Queues: database setup (simple prototype version, no logins)
-- Paste this whole file into Supabase → SQL Editor → New query, then press Run.
-- Safe to run again later: it updates things rather than duplicating them.
--
-- How it's protected: students' browsers can't read or change the tables directly.
-- They can only call the functions at the bottom of this file, which check every
-- report and never reveal who sent an anonymous one.

------------------------------------------------------------
-- 1. Tables
------------------------------------------------------------

-- The kinds of problem students can report, and how many points each costs.
-- Change the penalties in Table Editor → issue_types at any time.
create table if not exists public.issue_types (
  label      text primary key,
  penalty    int  not null check (penalty >= 0),
  sort_order int  not null default 0
);

insert into public.issue_types (label, penalty, sort_order) values
  ('Shoving',         10, 1),
  ('Cutting in line',  5, 2),
  ('Long wait',        2, 3),
  ('Missed lunch',     0, 4),
  ('Other',            2, 5)
on conflict (label) do update
  set penalty = excluded.penalty, sort_order = excluded.sort_order;

create table if not exists public.reports (
  id            bigint generated always as identity primary key,
  reporter_name text not null,      -- always saved so staff can follow up; hidden from students if anonymous
  reporter_year int  not null check (reporter_year between 7 and 13),
  is_anonymous  boolean not null default false,
  year_group    int  not null check (year_group between 7 and 13),
  issues        text[] not null check (cardinality(issues) between 1 and 5),
  days          text[] not null check (
                  cardinality(days) between 1 and 5
                  and days <@ array['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
                ),
  details       text check (details is null or char_length(details) <= 280),
  hidden        boolean not null default false,  -- tick in Table Editor to remove a report from the feed and points
  created_at    timestamptz not null default now()
);

create index if not exists reports_created_at_idx on public.reports (created_at desc);

-- Lock the tables: no direct access from the website.
alter table public.issue_types enable row level security;
alter table public.reports     enable row level security;
revoke all on table public.issue_types from anon, authenticated;
revoke all on table public.reports     from anon, authenticated;

------------------------------------------------------------
-- 2. Helpers
------------------------------------------------------------

-- Monday 00:00 UK time of the current week. Points reset every Monday.
create or replace function public.current_week_start()
returns timestamptz
language sql
stable
as $$
  select date_trunc('week', now() at time zone 'Europe/London') at time zone 'Europe/London';
$$;

-- Points a report takes off: the penalty of each issue, or nothing if
-- the reporter is in the year group they reported.
create or replace function public.report_penalty(p_issues text[], p_reporter_year int, p_year_group int)
returns int
language sql
stable
set search_path = public
as $$
  select case
    when p_reporter_year = p_year_group then 0
    else coalesce((select sum(t.penalty) from issue_types t where t.label = any (p_issues)), 0)::int
  end;
$$;

------------------------------------------------------------
-- 3. Functions the website calls
------------------------------------------------------------

-- The issue buttons on the report page.
create or replace function public.get_issue_types()
returns table (label text, penalty int)
language sql
stable
security definer
set search_path = public
as $$
  select t.label, t.penalty from issue_types t order by t.sort_order;
$$;

-- Points for every year group this week, highest first. Everyone starts on 100.
create or replace function public.get_leaderboard()
returns table (year_group int, points int)
language sql
stable
security definer
set search_path = public
as $$
  with lost as (
    select r.year_group, report_penalty(r.issues, r.reporter_year, r.year_group) as pts
    from reports r
    where r.created_at >= current_week_start() and not r.hidden
  )
  select y::int, greatest(0, 100 - coalesce(sum(l.pts), 0))::int as points
  from generate_series(7, 13) as y
  left join lost l on l.year_group = y
  group by y
  order by points desc, y asc;
$$;

-- How many times each issue was reported this week.
create or replace function public.get_issue_counts()
returns table (label text, total int)
language sql
stable
security definer
set search_path = public
as $$
  select t.label, count(r.id)::int
  from issue_types t
  left join reports r
    on t.label = any (r.issues)
   and r.created_at >= current_week_start()
   and not r.hidden
  group by t.label, t.sort_order
  order by t.sort_order;
$$;

-- Latest reports for the feed. Anonymous reports come back with no name.
create or replace function public.get_recent_reports(max_rows int default 5)
returns table (
  id bigint, year_group int, issues text[], days text[],
  details text, reporter_name text, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.year_group, r.issues, r.days, r.details,
         case when r.is_anonymous then null else r.reporter_name end,
         r.created_at
  from reports r
  where not r.hidden
  order by r.created_at desc, r.id desc
  limit least(greatest(coalesce(max_rows, 5), 1), 20);
$$;

-- Saves a report after checking it. Returns the new report's id and the points it cost.
create or replace function public.submit_report(
  p_reporter_name text,
  p_reporter_year int,
  p_year_group    int,
  p_issues        text[],
  p_days          text[],
  p_details       text,
  p_is_anonymous  boolean
)
returns table (id bigint, points_lost int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name    text   := btrim(coalesce(p_reporter_name, ''));
  v_details text   := nullif(btrim(coalesce(p_details, '')), '');
  -- Keep issues and days in a tidy, fixed order with no repeats.
  v_issues  text[] := array(select t.label from issue_types t where t.label = any (coalesce(p_issues, '{}')) order by t.sort_order);
  v_days    text[] := array(select x.d from unnest(array['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) with ordinality as x(d, n)
                            where x.d = any (coalesce(p_days, '{}')) order by x.n);
  v_id      bigint;
begin
  if char_length(v_name) not between 1 and 61 then
    raise exception using errcode = 'P0001', message = 'Please sign in again with your name.';
  end if;
  if p_reporter_year is null or p_reporter_year not between 7 and 13 then
    raise exception using errcode = 'P0001', message = 'Please sign in again with your year group.';
  end if;
  if p_year_group is null or p_year_group not between 7 and 13 then
    raise exception using errcode = 'P0001', message = 'Choose the year group involved.';
  end if;
  if cardinality(v_issues) = 0
     or exists (select 1 from unnest(p_issues) as i(l) where i.l is null or i.l not in (select label from issue_types)) then
    raise exception using errcode = 'P0001', message = 'Choose at least one thing that happened.';
  end if;
  if cardinality(v_days) = 0 or not (p_days <@ array['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) then
    raise exception using errcode = 'P0001', message = 'Choose at least one day.';
  end if;
  if v_details is not null and char_length(v_details) > 280 then
    raise exception using errcode = 'P0001', message = 'Please keep the details under 280 characters.';
  end if;

  -- Simple limits to stop spam: 10 reports a day per student, 60 a minute overall.
  if (select count(*) from reports r
      where lower(r.reporter_name) = lower(v_name)
        and r.reporter_year = p_reporter_year
        and r.created_at > now() - interval '1 day') >= 10 then
    raise exception using errcode = 'P0001', message = 'You have reached the limit of 10 reports a day. Thanks for helping!';
  end if;
  if (select count(*) from reports r where r.created_at > now() - interval '1 minute') >= 60 then
    raise exception using errcode = 'P0001', message = 'Lots of reports are coming in right now. Please try again in a minute.';
  end if;

  insert into reports (reporter_name, reporter_year, is_anonymous, year_group, issues, days, details)
  values (v_name, p_reporter_year, coalesce(p_is_anonymous, false), p_year_group, v_issues, v_days, v_details)
  returning reports.id into v_id;

  return query select v_id, report_penalty(v_issues, p_reporter_year, p_year_group);
end;
$$;

------------------------------------------------------------
-- 4. Who can call what
------------------------------------------------------------

revoke all on function public.report_penalty(text[], int, int) from public, anon, authenticated;
revoke all on function public.get_issue_types()                from public;
revoke all on function public.get_leaderboard()                from public;
revoke all on function public.get_issue_counts()               from public;
revoke all on function public.get_recent_reports(int)          from public;
revoke all on function public.submit_report(text, int, int, text[], text[], text, boolean) from public;

grant execute on function public.get_issue_types()       to anon, authenticated;
grant execute on function public.get_leaderboard()       to anon, authenticated;
grant execute on function public.get_issue_counts()      to anon, authenticated;
grant execute on function public.get_recent_reports(int) to anon, authenticated;
grant execute on function public.submit_report(text, int, int, text[], text[], text, boolean) to anon, authenticated;
