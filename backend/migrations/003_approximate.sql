-- ------------------------------------------------------------------
--    cammap - migration 003: approximate
--
--    Adds to public.cameras a boolean, approximate, not null and
--    false by default: true where the pin marks the surrounding area
--    rather than an exact spot.
--
--    Run this in the Supabase SQL editor, after 001 and 002, then run
--    backend/seed.sql again: the seed's on-conflict update carries
--    approximate, so the re-run sets it on every seed row whose
--    record gave only an area - 43 van sites at the time of writing.
--    Nothing is applied by the programme that wrote this; the
--    maintainer runs it.
--
--    Safe to run on a database that already has it, and a fresh
--    database gets the same result from schema.sql, which carries
--    this block as "version 2.5". The two must say the same thing; if
--    you change one, change the other.
--
--    Why a column: the note has always said it in prose - "(pin marks
--    the surrounding area, not an exact spot)" - and the map drew
--    those pins exactly like a pin on a known pole. Saying what is
--    not known is part of the record's honesty, and the map should be
--    able to draw the difference from a field rather than by
--    searching the note for a phrase. The note keeps its phrase, so a
--    reader of the popup is still told. Default false because a
--    camera from a report is where the reporter dropped the pin, and
--    that is a claim about a spot; a moderator who corrects a seed
--    pin with Move can then clear the flag, which is a cell, not an
--    edit to prose.
-- ------------------------------------------------------------------

alter table public.cameras
  add column if not exists approximate boolean not null default false;

comment on column public.cameras.approximate is
  'true where the pin marks the surrounding area rather than an exact spot - the record gave a borough or district, not a street.';
