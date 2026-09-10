-- ------------------------------------------------------------------
--    cammap - migration 007: a way off the leaderboard
--
--    Adds profiles.show_on_leaderboard (true by default), the one
--    function a signed-in person may call to change their own row's
--    value, and the three leaderboard views rebuilt so that a row
--    with it false never enters them.
--
--    Run this in the Supabase SQL editor, after 006. Nothing is
--    applied automatically; the maintainer runs
--    it. Safe to run on a database that already has it - the column
--    is add-if-missing, the function is create-or-replace, and the
--    views are dropped and rebuilt exactly as schema.sql rebuilds
--    them on every run. A fresh database gets the same result from
--    schema.sql, which carries this as "version 2.9". The two must
--    say the same thing; if you change one, change the other. The
--    views are empty until the next refresh: run
--    select public.refresh_leaderboards() once by hand, or wait for
--    the five-minute job.
--
--    Why: every contributor's username, XP and count of approved
--    reports were public and enumerable, a hundred at a time, to
--    anyone at all. The names carry nothing personal - two random
--    words - but what someone has reported, and how much, is itself
--    a pattern, and on this site that can be enough. A person should
--    be able to keep their name off the list without giving up the
--    account or the points.
--
--    Where it is enforced, and why not in row-level security: the
--    three leaderboards are materialized views, and PostgreSQL does
--    not apply RLS to a materialized view - a policy on profiles is
--    never consulted when the view is refreshed, and a view cannot
--    carry a policy of its own. The equivalent that meets the intent
--    (server-side, never the client's query) is the view definition
--    itself: an opted-out row never enters the table the page reads,
--    so no query the browser could write, and no future page that
--    forgets to filter, can show it. NOTES.md "Open decisions" 6 records the
--    substitution.
-- ------------------------------------------------------------------

-- ---------------- the column ----------------

-- Default true: the list is the reward the site offers, and a new
-- account expects to appear on it. Not null, because a view
-- definition that has to handle "unknown" is a view definition that
-- will one day handle it wrong.
alter table public.profiles
  add column if not exists show_on_leaderboard boolean not null default true;

comment on column public.profiles.show_on_leaderboard is
  'false keeps the account off leaderboard_all, _daily and _weekly; enforced in the view definitions, since RLS does not reach a materialized view. Set only through set_leaderboard_visibility().';

-- ---------------- the switch ----------------

-- The one thing on a profile a person may change themselves, and
-- the only way they may change it: the client roles have no update
-- privilege on profiles at all (see the revoke above the table), on
-- purpose, so a column-level grant is not the door. This is. It
-- takes a boolean and nothing else, and writes it to the caller's
-- own row, found by auth.uid(); there is no parameter that could
-- name another account, and nothing comes back.
--
-- The anonymity test: what does a stranger learn by calling this
-- repeatedly with guesses? Nothing. It carries no username, no id,
-- answers nothing, and acts only on the account whose token made
-- the call. Signed out, auth.uid() is null and it refuses.
create or replace function public.set_leaderboard_visibility(shown boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  update public.profiles
     set show_on_leaderboard = coalesce(shown, true)
   where id = auth.uid();
end;
$fn$;

revoke all on function public.set_leaderboard_visibility(boolean) from public, anon, authenticated;
grant execute on function public.set_leaderboard_visibility(boolean) to authenticated, service_role;

-- ---------------- the views, rebuilt ----------------

-- The same three definitions as schema.sql, each with the one added
-- line: "and p.show_on_leaderboard". Dropped and rebuilt rather than
-- altered, because a materialized view cannot be altered in place
-- and this is how schema.sql treats them on every run anyway; the
-- unique indexes and the grants go with the drop and are put back.

drop materialized view if exists public.leaderboard_all;
create materialized view public.leaderboard_all as
  select p.username,
         p.xp_total,
         coalesce(a.n, 0)::integer as reports_approved
    from public.profiles p
    left join (select user_id, count(*) as n
                 from public.reports
                where state = 'approved'
                group by user_id) a on a.user_id = p.id
   where p.username is not null
     and p.xp_total > 0
     and p.show_on_leaderboard
   order by p.xp_total desc, p.username
   limit 100;

drop materialized view if exists public.leaderboard_daily;
create materialized view public.leaderboard_daily as
  select p.username,
         sum(e.xp)::integer as xp_total,
         count(*)::integer  as reports_approved
    from public.xp_events e
    join public.profiles p on p.id = e.user_id
   where e.created_at > now() - interval '1 day'
     and p.username is not null
     and p.show_on_leaderboard
   group by p.username
   order by xp_total desc, p.username
   limit 100;

drop materialized view if exists public.leaderboard_weekly;
create materialized view public.leaderboard_weekly as
  select p.username,
         sum(e.xp)::integer as xp_total,
         count(*)::integer  as reports_approved
    from public.xp_events e
    join public.profiles p on p.id = e.user_id
   where e.created_at > now() - interval '7 days'
     and p.username is not null
     and p.show_on_leaderboard
   group by p.username
   order by xp_total desc, p.username
   limit 100;

create unique index if not exists leaderboard_all_username_idx    on public.leaderboard_all (username);
create unique index if not exists leaderboard_daily_username_idx  on public.leaderboard_daily (username);
create unique index if not exists leaderboard_weekly_username_idx on public.leaderboard_weekly (username);

revoke all on public.leaderboard_all, public.leaderboard_daily, public.leaderboard_weekly
  from anon, authenticated;
grant select on public.leaderboard_all, public.leaderboard_daily, public.leaderboard_weekly
  to anon, authenticated, service_role;
