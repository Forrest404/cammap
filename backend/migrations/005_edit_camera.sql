-- ------------------------------------------------------------------
--    cammap - migration 005: edit a camera
--
--    Adds edit_camera and moderate_edit_camera: a moderator can now
--    correct a camera's name, note, kind and state. Until now a
--    moderator could add, hide, unhide and move one, and a typo in a
--    name was permanent.
--
--    Run this in the Supabase SQL editor, after 004, which makes the
--    log it writes to. Nothing is applied by the programme that wrote
--    this; the maintainer runs it. Safe to run again - both functions
--    are create-or-replace - and a fresh database gets the same result
--    from schema.sql, which carries this as "version 2.7". The two
--    must say the same thing; if you change one, change the other.
--
--    What it refuses, and why, is in the comment on edit_camera.
--    The pattern is move_camera's: an inner function for the service
--    role that does the work, a moderate_ wrapper for the browser
--    that checks the role first. Same gate, same row, same panel.
-- ------------------------------------------------------------------

-- Edit a camera. Everything on the row a moderator might have a
-- reason to correct and that nothing else corrects: the name, the
-- note, the kind, the state. Not the position (move_camera), not
-- visibility (hide_camera), not the counts or the source columns,
-- which are the record's and change in data/cameras.csv.
--
-- What it refuses:
--   - a blank name, as add_camera does;
--   - an id that is not a camera, aloud, as move_camera does;
--   - a van site marked active. Every vancam is legacy - a van parks
--     for a shift and drives away, so no van site claims to be there
--     today - and that is the one invariant of the record this map
--     is most careful about (NOTES.md, "What active means"). The
--     build script refuses it in the CSV; this refuses it here. It is
--     not a check constraint on the table because a live database
--     seeded before every van went legacy still carries van rows that
--     say active (QUESTIONS.md, item 9), and adding the constraint
--     would fail on them; approve_report also still writes a
--     reported van as active, which is left for the maintainer's
--     one-line update in NOTES.md and not changed here.
-- A bad type or state is refused by the table's own check
-- constraints, the same reasoning move_camera gives for the bounds:
-- the constraint is the lock, and a copy of the list here would be
-- one more thing to drift.
--
-- seed_key is not touched, for the reason move_camera does not
-- touch it: it is how seed.sql finds a row it has already written,
-- and rewriting it would make the next seed run insert a second
-- camera. The consequence is worth saying plainly, because it is
-- the opposite of Move's: the seed's on-conflict update rewrites
-- name, note and status from the record, so an edit to a seed
-- camera's name, note or state holds only until the next re-run of
-- seed.sql. A correction to a seed camera is made in
-- data/cameras.csv as well, or it will be undone. (The type is part
-- of the key and not in the update list, so a corrected type
-- survives - and orphans the row from its CSV line the day the
-- record is next built with the old type, which is the same reason
-- to fix the CSV.) The panel on the moderation page says this above
-- the Save button for any camera that came from the seed.
--
-- The log row records which fields changed and what they were, so
-- the previous value is never lost: "name was 'Croydon'; status was
-- active". Nothing is logged, and nothing written, when nothing
-- changed.
create or replace function public.edit_camera(
  cid bigint, new_name text, new_note text, new_type text, new_status text,
  actor uuid default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  old     public.cameras%rowtype;
  changed text[] := '{}';
  want_name   text;
  want_note   text;
  want_type   text;
  want_status text;
begin
  if new_name is null or btrim(new_name) = '' then
    raise exception 'a camera needs a name';
  end if;

  select * into old from public.cameras where id = cid;
  if not found then
    raise exception 'no camera with id %', cid;
  end if;

  want_name   := btrim(new_name);
  want_note   := coalesce(new_note, '');
  want_type   := coalesce(new_type, old.type);
  want_status := coalesce(new_status, old.status);

  if want_type = 'vancam' and want_status = 'active' then
    raise exception 'a van site cannot be active: a van parks for a shift and drives away, so no van site claims to be there today';
  end if;

  if want_name <> old.name then
    changed := changed || format('name was %L', old.name);
  end if;
  if want_note <> old.note then
    changed := changed || format('note was %L', old.note);
  end if;
  if want_type <> old.type then
    changed := changed || format('type was %s', old.type);
  end if;
  if want_status <> old.status then
    changed := changed || format('status was %s', old.status);
  end if;

  if cardinality(changed) = 0 then
    return;
  end if;

  update public.cameras
     set name = want_name, note = want_note, type = want_type, status = want_status
   where id = cid;

  perform public.log_moderation(actor, 'edit_camera', cid, array_to_string(changed, '; '));
end;
$fn$;

revoke all on function public.edit_camera(bigint, text, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.edit_camera(bigint, text, text, text, text, uuid)
  to service_role;

-- The browser's way in for a moderator. Checks the role, then edits.
create or replace function public.moderate_edit_camera(
  cam_id bigint, cam_name text, cam_note text, cam_type text, cam_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  perform public.edit_camera(cam_id, cam_name, cam_note, cam_type, cam_status, auth.uid());
end;
$fn$;

revoke all on function public.moderate_edit_camera(bigint, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.moderate_edit_camera(bigint, text, text, text, text)
  to authenticated, service_role;
