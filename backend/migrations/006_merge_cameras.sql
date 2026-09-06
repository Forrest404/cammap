-- ------------------------------------------------------------------
--    cammap - migration 006: merge two cameras
--
--    Adds merge_cameras and moderate_merge_cameras: two rows that are
--    one camera become one, with nothing deleted. The loser's reports
--    are repointed at the survivor, then the loser is hidden through
--    hide_camera with a note naming the survivor, and the result says
--    which row survived and how many reports moved.
--
--    Run this in the Supabase SQL editor, after 004, which makes the
--    log it writes to. Nothing is applied by the programme that wrote
--    this; the maintainer runs it. Safe to run again - both functions
--    are create-or-replace - and a fresh database gets the same result
--    from schema.sql, which carries this as "version 2.8". The two
--    must say the same thing; if you change one, change the other.
--
--    Why: approve_report clusters and merges incoming reports, so two
--    people reporting one van site make one camera. But two rows that
--    are already on the map - a seed entry and a reported one at the
--    same spot, or two reports approved a month apart at 150 m - had
--    no way to become one. A moderator could hide one, and lose its
--    reports to a hidden row nobody would look at again. Merging
--    keeps the reports where they can be seen, on the row that
--    stays, and keeps the loser too, hidden, with a note saying where
--    it went. The pattern is move_camera's: an inner function for the
--    service role, a moderate_ wrapper that checks the role first.
-- ------------------------------------------------------------------

-- What it refuses, and why:
--   - the same id twice: there is nothing to merge;
--   - an id that is not a camera, aloud, as move_camera does;
--   - a loser that is already off the map. A hidden camera's reports
--     belong to whatever took it off - a merge already done, a
--     "removed" claim that was approved - and moving them now would
--     put them under a camera they may never have been about. If it
--     really is a duplicate, put it back first and then merge it,
--     so the act is visible for what it is;
--   - a survivor that is off the map. Merging into a hidden camera
--     would take the loser off the map too and leave the reports
--     under a row nobody sees: two cameras lost for one. Merge into
--     one that is on the map, or put the survivor back first.
--
-- What it moves, and what it does not. Every report that pointed at
-- the loser now points at the survivor, with one exception: a state
-- report by someone who has also reported the survivor's state
-- stays where it is, because reports_one_status_per_camera_idx
-- allows one such report per person per camera, and it is still that
-- person's evidence about the loser. The result counts those as
-- "kept". Proof files go with their report; XP was awarded per
-- report and does not change. saved_cameras holds no camera id by
-- design (a position and a name, copied), so nothing there points
-- at either row and nothing there is touched. The survivor's own
-- columns are not touched either: its deployments, periods and
-- source are the record's and the loser's are not added to them,
-- because a sum of two records of the same site would be a count
-- the source never gave.
--
-- The kinds may differ - a shop entered as a fixed install and
-- again as a shop - and the survivor's stands. The panel says which
-- row survives before the moderator confirms.
--
-- The same two advisory locks approve_report takes: an approval
-- racing this could otherwise find the loser still visible, point a
-- fresh report at it, and commit after the loser has gone.
--
-- Returns what the browser needs to say what happened, in one
-- value: which row survived, which was hidden, how many reports
-- moved and how many stayed.
create or replace function public.merge_cameras(loser bigint, survivor bigint, actor uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  l     public.cameras%rowtype;
  s     public.cameras%rowtype;
  moved integer;
  kept  integer;
begin
  if loser is null or survivor is null then
    raise exception 'a merge needs two cameras';
  end if;
  if loser = survivor then
    raise exception 'a camera cannot be merged into itself';
  end if;

  select * into l from public.cameras where id = loser;
  if not found then
    raise exception 'no camera with id %', loser;
  end if;
  select * into s from public.cameras where id = survivor;
  if not found then
    raise exception 'no camera with id %', survivor;
  end if;

  if not l.visible then
    raise exception 'camera % is already off the map: its reports belong to whatever took it off. Put it back first if it is a duplicate', loser;
  end if;
  if not s.visible then
    raise exception 'camera % is off the map: merge into a camera that is on it, or put it back first', survivor;
  end if;

  perform pg_advisory_xact_lock(hashtext('cammap.approve.' || l.type));
  perform pg_advisory_xact_lock(hashtext('cammap.status.' || loser::text));

  update public.reports r
     set camera_id = survivor
   where r.camera_id = loser
     and not (r.kind = 'status' and exists (
           select 1 from public.reports o
            where o.user_id = r.user_id and o.camera_id = survivor and o.kind = 'status'));
  get diagnostics moved = row_count;

  select count(*) into kept from public.reports where camera_id = loser;

  perform public.hide_camera(loser, format('merged into camera #%s', survivor), actor);

  perform public.log_moderation(actor, 'merge_cameras', loser,
    format('merged into camera #%s: %s report(s) moved, %s kept', survivor, moved, kept));

  return jsonb_build_object('survivor', survivor, 'loser', loser, 'moved', moved, 'kept', kept);
end;
$fn$;

revoke all on function public.merge_cameras(bigint, bigint, uuid) from public, anon, authenticated;
grant execute on function public.merge_cameras(bigint, bigint, uuid) to service_role;

-- The browser's way in for a moderator. Checks the role, then merges.
create or replace function public.moderate_merge_cameras(loser bigint, survivor bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  return public.merge_cameras(loser, survivor, auth.uid());
end;
$fn$;

revoke all on function public.moderate_merge_cameras(bigint, bigint) from public, anon, authenticated;
grant execute on function public.moderate_merge_cameras(bigint, bigint) to authenticated, service_role;
