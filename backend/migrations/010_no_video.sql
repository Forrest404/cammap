-- ------------------------------------------------------------------
--    cammap - migration 010: video is refused
--
--    Narrows the two places the server decides what a proof file may
--    be: the check on report_proof.mime, and the proof bucket's
--    allowed_mime_types. Both go from five types to the three photo
--    types. Nothing else changes, and nothing is deleted.
--
--    Run this in the Supabase SQL editor, after 009. Nothing is
--    applied by the programme that wrote this; the maintainer runs
--    it. Safe to run again - the constraint is dropped and re-added
--    by name, the bucket update is a plain update - and a fresh
--    database gets the same result from schema.sql, which carries
--    this as "version 2.12". The two must say the same thing; if you
--    change one, change the other. After running it, Storage ->
--    proof -> settings in the dashboard should show the three types;
--    the bucket row is the same row this updates.
--
--    Why: the form used to take MP4 and WebM and send them as they
--    were, with a hint asking the person to "check what yours
--    contains" - on a site whose promise is anonymity, and to the
--    one person who can least afford to leak a position: someone
--    standing in front of a van, filming it. A video carries the
--    same things a photo does - a GPS track, the device, the time -
--    in a container the browser cannot rebuild the way it re-saves a
--    photo through a canvas, and stripping it in plain JavaScript
--    would take a library the Content-Security-Policy will not load.
--    A warning would have made the promise the person's to keep for
--    us. So the form refuses video at the moment of choosing, with
--    the reason, and the server refuses it here whatever the form
--    does. QUESTIONS.md item 1 records the decision.
--
--    Nothing is deleted. A video row that already exists stays, with
--    its file: taking a person's evidence away because the rule
--    changed is not this migration's to do. The new check is added
--    NOT VALID - enforced on every new row, not checked against old
--    ones - and validated only if no video row exists, so on a
--    database with none the constraint ends up exactly as a fresh
--    database's does (the verifier's dump diff is clean). On one
--    that has some, the notice says so and the constraint stays not
--    valid, still refusing new video rows, until you decide about
--    those rows and run
--        alter table public.report_proof validate constraint report_proof_mime_check;
--    by hand. A re-run of this file is harmless either way.
-- ------------------------------------------------------------------

alter table public.report_proof drop constraint if exists report_proof_mime_check;
alter table public.report_proof add constraint report_proof_mime_check
  check (mime in ('image/jpeg', 'image/png', 'image/webp')) not valid;

do $$
declare
  videos integer;
begin
  select count(*) into videos from public.report_proof where mime like 'video/%';
  if videos = 0 then
    alter table public.report_proof validate constraint report_proof_mime_check;
  else
    raise notice 'report_proof has % video row(s) from before version 2.12. They are kept; report_proof_mime_check stays NOT VALID (new rows are still checked) until you decide about them and run: alter table public.report_proof validate constraint report_proof_mime_check', videos;
  end if;
end $$;

-- The bucket. The same row schema.sql's insert ... on conflict do
-- update writes; on a database that has it, this is the one line
-- that changes it.
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'proof';
