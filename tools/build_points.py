#!/usr/bin/env python3
"""Write data/points.js and backend/seed.sql from data/cameras.csv.

    python3 tools/build_points.py              write both files
    python3 tools/build_points.py --check      regenerate in memory, compare
                                               with what is committed, and
                                               exit non-zero naming the file
                                               and the first differing line
    python3 tools/build_points.py --import F   read a points.js at F back
                                               into data/cameras.csv

The two output files hold the same cameras in two forms: points.js is
what the map draws when the database cannot be reached, and seed.sql is
what fills the database. They must agree row for row, and for a long
time nothing made them. Both said they were written out by this script,
and this script was not in the repository, so both were edited by hand
- or one was pasted from index.html?edit and the other was brought into
line afterwards, by somebody remembering. The row-for-row check in
tools/stamp.py caught a drift after the fact; nothing prevented one.

Now there is one source table, data/cameras.csv, and the two files are
written from it and never edited by hand again. stamp.py regenerates
both in memory on every run and fails if what is committed is not what
the CSV produces, so a hand edit to either output cannot survive a
commit, and neither can a CSV edit that was not built. That is not a
build step in the sense this project refuses: the browser runs the
committed points.js exactly as before, and nothing has to run for the
site to be served. It is a generator the maintainer runs by hand, the
way stamp.py is a checker they run by hand, and CI only ever reads.

The source table
----------------

data/cameras.csv is one header row and one camera per line, UTF-8,
quoted only where a field needs it, one line per camera so that a diff
reads as "this camera changed". A CSV cannot carry comments, so the
columns are explained here and in NOTES.md ("The build script and the
record"). Columns, in the order they are written:

  name         The place, as the source names it. Two cameras may share
               a name - Croydon carries a fixed install and the van
               hotspot it also is - but not a name, position and type
               together, because that triple is the seed_key.
  type         One of the identifiers in CAMERA_TYPES in
               frontend/shared.js, read from there on every run rather
               than copied here. fixedcam, vancam, transportcam,
               facewatchcam, privatecam.
  status       active or legacy. May be left blank: a vancam is then
               legacy and anything else active, which is the same
               default tidy() in map.js gives a hand-typed entry. Every
               van site is legacy, and this script refuses to write a
               record that says otherwise - see "What active means" in
               NOTES.md. A van parks for a shift and drives away, so no
               van site claims to be active, and the map opens on the
               cameras that are fixed to something. The old version of
               this script computed an active/legacy split from the
               newest Met year; this one will not, whatever the CSV
               says.
  lat, lon     Decimal degrees, at most six decimal places. Written
               back out with exactly six, because seed_key is built
               from the six-decimal form and seedKeyOf() in shared.js
               rounds to six, and a key built from a seventh decimal
               would match nothing. A spreadsheet that drops trailing
               zeros ("51.50814") is fine; a seventh decimal is refused
               naming the row, because rounding it would be this script
               deciding where a camera is.
  last         The last year the source records the camera, or blank
               for null.
  periods      The uses, counted by the period the source gives them
               in, as PERIOD:COUNT items separated by semicolons -
               "2023-24:1", "2023-2025:3", "2026:4", or "2023-24:1;2025:3"
               once a site has counts from more than one record. Blank
               is null: the source names no period, which is the case
               for a shop or a fixed install. A period is written
               exactly as the record states it and is one of the forms
               YYYY, YYYY-YY or YYYY-YYYY, because that is the whole of
               the vocabulary the sources use. The Met publishes "3
               deployments 2023-2025" and not which year each fell in;
               a column that said {"2023": 1, "2024": 1, "2025": 1}
               would be an estimate wearing the clothes of a record,
               and this project does not estimate. So the key is the
               period, and a later reader who wants years must go back
               to the deployment-record PDFs, which do carry dates.
               The form is text so that it survives a spreadsheet
               round trip; it is written out as a JSON object in
               points.js and a jsonb column in the database.
  deployments  How many times a source records the spot being used.
               The map weighs its glow by this and "Most used" sorts by
               it. Where periods is given this is its sum, by
               construction: it may be left blank and is then filled
               in, and a value that disagrees with the sum is refused
               naming the row, so the two cannot drift. Where periods
               is blank it is what the CSV says, or one - a shop, a
               fixed camera, a site the record lists once.
  note         Free prose, written last because it is the long one.
               Preserved to the character; everything the map shows in
               a popup comes from here.

Row order in the CSV does not matter. The outputs are written in a
canonical order - by name, case-insensitively, then by type, then by
position - so that a row appended at the bottom of the CSV lands in its
alphabetical place in both files, and so that the same CSV always
produces the same bytes.

What this script will not do
----------------------------

It does not look anything up, fetch anything, or infer anything. Every
value in the outputs is a value in the CSV, or the fixed default named
above, or seed_key, which is built from three of them. "Nothing here is
estimated" is the record's own promise, and a generator that filled a
blank by guessing would break it quietly. Where the CSV is wrong the
build fails and names the row; where it is incomplete the output is
null or the default, never a plausible value.

Standard library only, and it must stay that way: this has to run on
the maintainer's machine and on a CI runner with nothing installed,
which is also why stamp.py imports it as a module rather than shelling
out to it.

Importing
---------

--import reads a points.js - the committed one, or one pasted out of
index.html?edit - and writes data/cameras.csv from it. It was used once
to make the CSV in the first place, and it is kept because a points.js
that somebody hand-published is the one situation in which the outputs
know more than the source, and the way back is to import it, look at
the diff git shows on the CSV, and build. It reads the file with the
same patterns stamp.py uses, one entry per object, every field named,
and refuses anything it cannot read rather than skipping it.

Where an entry being imported carries a field, the field is taken as
it is. Where it does not - an older points.js from before the field
existed - the import reads what it can off the note, and only what the
note states outright:

  periods      from "N deployment(s) PERIOD" in a Met van note, or
               "N deployment(s) in the YYYY station trial" in a BTP
               note, as {PERIOD: N}. That is reading the record, not
               guessing: the note is the record's own sentence about
               the site. A note in neither form gives null. A count
               read this way that disagrees with the entry's own
               deployments is refused - the record would be
               contradicting itself, and the way to find out which
               half is right is not to pick one.
"""
import csv
import io
import json
import os
import re
import sys
from decimal import Decimal, InvalidOperation

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CSV_FILE = "data/cameras.csv"
POINTS_FILE = "data/points.js"
SEED_FILE = "backend/seed.sql"
SHARED_FILE = "frontend/shared.js"

USAGE = "usage: python3 tools/build_points.py [--check | --import POINTS_JS]"

# The columns of data/cameras.csv, in the order they are written. The
# header row is checked against this on every read, so a column renamed
# or reordered in a spreadsheet is a failure that names itself rather
# than a silent shift of every value one place to the left.
COLUMNS = ["name", "type", "status", "lat", "lon", "last", "periods", "deployments", "note"]

# The statuses the published record may assert. The database also knows
# "nonfunctional", but that is a state a moderator sets on a row, never
# something the record says about a camera.
STATUSES = ("active", "legacy")

# Six decimal places, exactly, because that is what seedKeyOf() writes.
PLACES = Decimal("0.000001")

# A period as the sources write one: a year, or a span written either
# way the Met writes it ("2023-24", "2023-2025"). The same expression is
# the check constraint in schema.sql and the assertion in check.js;
# change one, change the three.
PERIOD_KEY = re.compile(r'^\d{4}(-\d{2}|-\d{4})?$')

# The two sentences the notes use for a counted deployment. Only the
# import reads these, and only for an entry that has no periods of its
# own; the build never looks at a note.
NOTE_MET = re.compile(r'^Met Police LFR van - (\d+) deployments? (\d{4}(?:-\d{2}|-\d{4})?)(?:\s|$)')
NOTE_BTP = re.compile(r'^British Transport Police LFR - (\d+) deployments? in the (\d{4}) station trial(?:\s|$)')


def period_order(key):
    """Periods are written earliest first: by the year they start,
    then by the key itself, so "2023-24" sits before "2023-2025" and
    both before "2025"."""
    return (int(key[:4]), key)


def periods_of(raw, where):
    """The periods column as a dict, or None for blank. Every key a
    period, every count a positive integer, no key twice."""
    raw = raw.strip()
    if raw == "":
        return None
    out = {}
    for item in raw.split(";"):
        item = item.strip()
        if ":" not in item:
            raise BuildError("%s: periods item %r is not PERIOD:COUNT" % (where, item))
        key, count = item.rsplit(":", 1)
        key = key.strip()
        if not PERIOD_KEY.match(key):
            raise BuildError("%s: period %r is not YYYY, YYYY-YY or YYYY-YYYY" % (where, key))
        if key in out:
            raise BuildError("%s: period %r given twice" % (where, key))
        out[key] = integer(count, "count for period %s" % key, where, 1)
    return dict(sorted(out.items(), key=lambda kv: period_order(kv[0])))


def periods_text(periods):
    """The CSV form of a periods dict: PERIOD:COUNT items joined by
    semicolons, or the empty string for None."""
    if periods is None:
        return ""
    return ";".join("%s:%d" % (k, v) for k, v in periods.items())


def periods_json(periods):
    """The points.js and seed.sql form: a JSON object with the keys in
    period order, or null. Python's json.dumps writes it with a space
    after each colon and comma, and keys in the order given, which is
    the order the dict holds them in."""
    return "null" if periods is None else json.dumps(periods)


class BuildError(Exception):
    """Something in the CSV, or in a file being imported, that this
    script will not write around. The message names the row."""


def path(rel):
    return os.path.join(ROOT, rel)


def read(rel):
    return io.open(path(rel), encoding="utf-8").read()


# ---- what shared.js says ----
#
# The kinds of camera and the London box are read from frontend/shared.js
# on every run rather than copied here, so this script is not one more
# copy of either to keep in step. If the pattern stops matching that is
# a failure, not a pass: a build that checked types against an empty
# list would accept anything.

def read_shared():
    shared = read(SHARED_FILE)

    m = re.search(r'var CAMERA_TYPES\s*=\s*\[(.*?)\];', shared, re.S)
    types = re.findall(r'\btype:\s*"([^"]+)"', m.group(1)) if m else []
    if not types:
        raise BuildError("CAMERA_TYPES not found in %s, or has no entries" % SHARED_FILE)

    m = re.search(r'var LONDON_BOUNDS\s*=\s*\[\s*\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]\s*,'
                  r'\s*\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]\s*\]', shared)
    if not m:
        raise BuildError("LONDON_BOUNDS not found in %s" % SHARED_FILE)
    south, west, north, east = (Decimal(x) for x in m.groups())

    return types, (south, west, north, east)


# ---- reading the CSV ----

def coordinate(raw, what, where):
    """A coordinate as the CSV gives it, exact, at six decimal places.
    Decimal rather than float so that "51.508140" is 51.508140 and not
    the nearest double to it, and so that a seventh decimal is seen
    rather than rounded away."""
    try:
        value = Decimal(raw.strip())
    except InvalidOperation:
        raise BuildError("%s: %s %r is not a number" % (where, what, raw))
    if not value.is_finite():
        raise BuildError("%s: %s %r is not a number" % (where, what, raw))
    if value.as_tuple().exponent < -6:
        raise BuildError("%s: %s %s has more than six decimal places - the record is "
                         "written to six, and rounding it here would be guessing" % (where, what, raw))
    value = value.quantize(PLACES)
    if value == 0:
        value = Decimal("0.000000")   # never "-0.000000"
    return value


def integer(raw, what, where, least):
    try:
        value = int(raw.strip())
    except ValueError:
        raise BuildError("%s: %s %r is not a whole number" % (where, what, raw))
    if value < least:
        raise BuildError("%s: %s is %d, and must be at least %d" % (where, what, value, least))
    return value


def read_csv(text=None):
    """Every row of data/cameras.csv, validated and normalised: strings
    as strings, coordinates as six-place Decimals, last as an int or
    None, deployments as an int, status filled in where blank. Rows are
    returned in canonical order, not CSV order."""
    types, (south, west, north, east) = read_shared()

    if text is None:
        text = read(CSV_FILE)
    reader = csv.reader(io.StringIO(text, newline=""))
    try:
        header = next(reader)
    except StopIteration:
        raise BuildError("%s is empty" % CSV_FILE)
    if header != COLUMNS:
        raise BuildError("%s: header is %s, expected %s" % (CSV_FILE, ",".join(header), ",".join(COLUMNS)))

    rows = []
    keys = {}
    for number, values in enumerate(reader, 2):        # line 2 is the first camera
        if not values or all(v.strip() == "" for v in values):
            continue                                    # a blank line is not a camera
        if len(values) != len(COLUMNS):
            raise BuildError("%s line %d has %d fields for %d columns" % (
                CSV_FILE, number, len(values), len(COLUMNS)))
        raw = dict(zip(COLUMNS, values))
        where = "%s line %d (%s)" % (CSV_FILE, number, raw["name"] or "no name")

        name = raw["name"]
        if not name or name != name.strip():
            raise BuildError("%s: name %r is empty or has surrounding whitespace" % (where, name))

        kind = raw["type"].strip()
        if kind not in types:
            raise BuildError("%s: type %r is not in CAMERA_TYPES (%s)" % (where, kind, ", ".join(types)))

        status = raw["status"].strip()
        if status == "":
            status = "legacy" if kind == "vancam" else "active"
        if status not in STATUSES:
            raise BuildError("%s: status %r is not one of %s" % (where, status, ", ".join(STATUSES)))
        if kind == "vancam" and status != "legacy":
            raise BuildError("%s: a vancam cannot be %r - every van site is legacy, see "
                             "\"What active means\" in NOTES.md" % (where, status))

        lat = coordinate(raw["lat"], "lat", where)
        lon = coordinate(raw["lon"], "lon", where)
        if not (south <= lat <= north and west <= lon <= east):
            raise BuildError("%s: %s, %s is outside LONDON_BOUNDS" % (where, lat, lon))

        last = None if raw["last"].strip() == "" else integer(raw["last"], "last", where, 1900)

        # deployments is the sum of periods wherever periods is given -
        # filled in if blank, refused if it says something else - and
        # the CSV's own number, or one, otherwise.
        periods = periods_of(raw["periods"], where)
        given = None if raw["deployments"].strip() == "" else integer(raw["deployments"], "deployments", where, 1)
        if periods is not None:
            deployments = sum(periods.values())
            if given is not None and given != deployments:
                raise BuildError("%s: deployments is %d but the periods add up to %d - "
                                 "the two must agree, and one of them is wrong" % (where, given, deployments))
        else:
            deployments = 1 if given is None else given

        row = {
            "name": name,
            "type": kind,
            "status": status,
            "lat": lat,
            "lon": lon,
            "last": last,
            "periods": periods,
            "deployments": deployments,
            "note": raw["note"],
        }
        row["seed_key"] = seed_key(row)
        if row["seed_key"] in keys:
            raise BuildError("%s: the same name, position and type as line %d - seed_key %r twice" % (
                where, keys[row["seed_key"]], row["seed_key"]))
        keys[row["seed_key"]] = number
        rows.append(row)

    if not rows:
        raise BuildError("%s has no cameras" % CSV_FILE)
    rows.sort(key=sort_key)
    return rows


def sort_key(row):
    """Case-insensitive by name, then type, then position, then the
    name as written. The published files were alphabetical this way
    when the CSV was made from them, and the tie-breaks make the order
    total, so one CSV always gives one byte sequence."""
    return (row["name"].lower(), row["type"], row["lat"], row["lon"], row["name"])


def seed_key(row):
    """name|lat|lon|type, with six-decimal coordinates - the same string
    seedKeyOf() in frontend/shared.js builds, which is how a database row
    says which published entry it is."""
    return "%s|%s|%s|%s" % (row["name"], row["lat"], row["lon"], row["type"])


# ---- writing points.js ----
#
# One entry per camera in the shape index.html?edit writes: strings
# through the JSON quoting JSON.stringify uses, coordinates at six
# places, null spelled null, a blank line between entries. The header
# is a template here so that the file explains itself to whoever opens
# it, which most people do before they open this script.

POINTS_HEADER = """\
/* ------------------------------------------------------------------
   cammap - facial recognition in London

   Every entry comes from a published source: the Met's own LFR
   deployment records (2020-2025), the British Transport Police
   deployment register (2026), and named press reporting for the
   shops. Nothing here is estimated. Where a source gave only a
   borough, the note says the pin is approximate.

   Seven fields:
     name, note, lat, lon   as before
     type    fixedcam | vancam | transportcam | facewatchcam | privatecam
     status  active | legacy
     last    the last year the source records it (or null)
     deployments  how many times a source records it being used;
                  the map weighs its heat by this, so a spot used
                  twenty times reads hotter than one used once
     periods  those uses counted by the period the source gives
              them in - {"2023-24": 1}, {"2023-2025": 3},
              {"2026": 4} - or null where the source names no
              period, which is every shop and fixed install. The
              key is the period exactly as the record states it.
              The Met publishes "3 deployments 2023-2025", not
              which year each fell in, and a per-year breakdown
              of that would be an estimate dressed as a record.
              deployments is always the sum of the values.

   Every van site is legacy, and that is not a statement about age.
   An LFR van parks for a shift and drives away, so there is no hour
   at which "a van is at this spot" is a thing this map can honestly
   say. What the record supports is that a van was deployed here, so
   many times, most recently in year Y - and `last` and `deployments`
   are where that lives. Marking the lot legacy puts them behind the
   toggle, which is the difference between a map that shows what was
   recorded and one that reads as a map of what is out there today.

   It used to split them: active if the newest Met record we held
   (2025) listed a deployment, legacy otherwise. That drew a line
   between two things that are equally uncertain in the only sense
   that matters to somebody looking at the map now.

   So `status` no longer varies across the van sites, and the
   recency that used to be folded into it is still in `last`. The
   default view is the 17 cameras that are actually fixed somewhere:
   the two Croydon installs, the station deployments and the shops.

   The only permanent police cameras in this list are the two Croydon
   fixedcam entries. Croydon appears twice on purpose: once as the
   fixed install and once as the van hotspot it also is.

   Written out by tools/build_points.py from data/cameras.csv, which
   is the record, and never edited by hand: edit the CSV, run the
   script, commit both. tools/stamp.py regenerates this file on every
   run and fails if it is not what the CSV produces. The script
   writes every van site legacy and refuses to build a record that
   says otherwise - the original build_points.py computed the split
   described above, and this one will not, whatever it is given. A
   hand-typed entry may leave out type, status and last - the map
   assumes vancam, and a vancam without a status is legacy.
   ------------------------------------------------------------------ */
"""


def js_string(s):
    # ensure_ascii off so a non-ASCII character, should one ever be
    # entered, is written as itself the way JSON.stringify writes it,
    # not as a \\u escape the browser would have to undo.
    return json.dumps(s, ensure_ascii=False)


def render_points(rows):
    lines = [POINTS_HEADER, "var POINTS = ["]
    for i, row in enumerate(rows):
        lines.append("")
        lines.append("  {")
        lines.append("    name: %s," % js_string(row["name"]))
        lines.append("    note: %s," % js_string(row["note"]))
        lines.append("    lat: %s," % row["lat"])
        lines.append("    lon: %s," % row["lon"])
        lines.append("    type: %s," % js_string(row["type"]))
        lines.append("    status: %s," % js_string(row["status"]))
        lines.append("    last: %s," % ("null" if row["last"] is None else row["last"]))
        lines.append("    deployments: %d," % row["deployments"])
        lines.append("    periods: %s" % periods_json(row["periods"]))
        lines.append("  }" if i == len(rows) - 1 else "  },")
    lines.append("")
    lines.append("];")
    lines.append("")
    return "\n".join(lines)


# ---- writing seed.sql ----
#
# One row per line, so that a diff of the seed is a list of cameras.
# The on-conflict clause names the columns the seed is allowed to bring
# up to date on a row it already wrote, and deliberately not lat or
# lon: a moderator can move a camera, the row keeps its seed_key
# through the move, and the next seed run must leave the corrected
# position alone. See "What a moderator can change" in NOTES.md.

SEED_HEADER = """\
-- ------------------------------------------------------------------
--    cammap - seed cameras
--
--    Written out by tools/build_points.py from data/cameras.csv, the
--    same source as points.js - do not edit by hand; edit the CSV and
--    run the script. Run schema.sql first, then this, in the supabase
--    SQL editor. Safe to run again: rows are matched on seed_key and
--    only rewritten when the published record changed. Cameras that
--    came from reports have no seed_key and are never touched; nor is
--    the visible flag on anything; nor is a camera's position, which
--    a moderator may have corrected - lat and lon are deliberately
--    not in the update list at the end.
--
--    Every vancam row here is 'legacy' on purpose - a van is somewhere
--    for a shift, so no van site claims to be active. See "What active
--    means" in NOTES.md. status IS in the on-conflict update list, so
--    running this against a database seeded before that change is what
--    applies it.
--
--    periods is the deployment count broken down by the period the
--    source gives it in, as jsonb, or null where the source names no
--    period. deployments is its sum, and the table checks that.
-- ------------------------------------------------------------------
"""

SEED_COLUMNS = ["name", "note", "lat", "lon", "type", "status", "last_seen", "deployments", "periods",
                "source", "seed_key"]

# What a re-run may rewrite on a row it already wrote. Position is not
# here, and must not be.
SEED_UPDATES = ["name", "note", "status", "last_seen", "deployments", "periods"]


def sql_string(s):
    return "'" + s.replace("'", "''") + "'"


def sql_value(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, Decimal)):
        return str(v)
    return sql_string(v)


def seed_values(row):
    # periods goes in as a string literal: the column is jsonb and
    # PostgreSQL casts an untyped literal to the column's type on
    # insert, so no ::jsonb is needed, and the row stays readable by
    # the plain patterns stamp.py and check.js use.
    periods = None if row["periods"] is None else json.dumps(row["periods"])
    return [row["name"], row["note"], row["lat"], row["lon"], row["type"], row["status"],
            row["last"], row["deployments"], periods, "seed", row["seed_key"]]


def render_seed(rows):
    lines = [SEED_HEADER]
    lines.append("insert into public.cameras")
    lines.append("  (%s)" % ", ".join(SEED_COLUMNS))
    lines.append("values")
    for i, row in enumerate(rows):
        values = ", ".join(sql_value(v) for v in seed_values(row))
        lines.append("  (%s)%s" % (values, "" if i == len(rows) - 1 else ","))
    lines.append("on conflict (seed_key) do update set")
    # The = signs are lined up to the widest column. (The file this
    # script first had to reproduce byte for byte lined them up to the
    # widest bar the last and left deployments hanging - the trace of
    # its having been appended in schema 2.2 - and the first build
    # copied that; once the list changed anyway the lines were
    # straightened.)
    width = max(len(c) for c in SEED_UPDATES)
    for i, column in enumerate(SEED_UPDATES):
        lines.append("  %s = excluded.%s%s" % (column.ljust(width), column, "," if i < len(SEED_UPDATES) - 1 else ""))
    ours = ", ".join("cameras.%s" % c for c in SEED_UPDATES)
    theirs = ", ".join("excluded.%s" % c for c in SEED_UPDATES)
    lines.append("where (%s)" % ours)
    lines.append("  is distinct from (%s);" % theirs)
    lines.append("")
    return "\n".join(lines)


# ---- the three modes ----

def regenerate(text=None):
    """Both outputs as strings, from the CSV (or from CSV text given),
    without touching the disk. stamp.py calls this."""
    rows = read_csv(text)
    return {POINTS_FILE: render_points(rows), SEED_FILE: render_seed(rows)}, len(rows)


def first_difference(a, b):
    """(line number, ours, theirs) where two texts first disagree, or
    None. Line numbers count from one, the way an editor does."""
    a_lines = a.split("\n")
    b_lines = b.split("\n")
    for i in range(max(len(a_lines), len(b_lines))):
        x = a_lines[i] if i < len(a_lines) else None
        y = b_lines[i] if i < len(b_lines) else None
        if x != y:
            return i + 1, x, y
    return None


def build():
    outputs, count = regenerate()
    for rel, text in outputs.items():
        io.open(path(rel), "w", encoding="utf-8", newline="\n").write(text)
    print("build_points: wrote %s and %s, %d cameras" % (POINTS_FILE, SEED_FILE, count))


def check():
    outputs, count = regenerate()
    bad = False
    for rel, text in outputs.items():
        committed = read(rel)
        diff = first_difference(text, committed)
        if diff:
            bad = True
            line, ours, theirs = diff
            print("FAIL: %s is not what %s produces - first difference at line %d" % (rel, CSV_FILE, line))
            print("  generated: %s" % ("<end of file>" if ours is None else ours.rstrip()))
            print("  committed: %s" % ("<end of file>" if theirs is None else theirs.rstrip()))
            print("  Edit %s and run python3 tools/build_points.py; never edit %s by hand." % (CSV_FILE, rel))
    if bad:
        return 1
    print("build_points: %s and %s match %s, %d cameras" % (POINTS_FILE, SEED_FILE, CSV_FILE, count))
    return 0


# ---- importing a points.js ----
#
# The same patterns stamp.py reads the file with: one object per entry,
# every field named, a value that is a JSON string, a number, null or
# a boolean. Anything else is a failure naming the entry, never an
# entry skipped.

JS_STRING = r'"(?:[^"\\]|\\.)*"'
# One level of nesting: the periods object, {"2023-24": 1}, which holds
# strings and numbers and never another object.
JS_NESTED = r'\{(?:[^{}"]|' + JS_STRING + r')*\}'
JS_VALUE = JS_STRING + r'|' + JS_NESTED + r'|-?\d+(?:\.\d+)?|null|true|false'
JS_OBJECT = re.compile(r'\{((?:[^{}"]|' + JS_STRING + r'|' + JS_NESTED + r')*)\}')
JS_PAIR = re.compile(r'\s*(\w+)\s*:\s*(' + JS_VALUE + r')\s*,?')


def js_value(raw):
    if raw == "null":
        return None
    if raw == "true":
        return True
    if raw == "false":
        return False
    if raw.startswith('"') or raw.startswith('{'):
        return json.loads(raw)     # the file writes both in JSON form
    return raw     # numbers are kept as written, so a coordinate keeps its decimals


def parse_points(text, where):
    m = re.search(r'var POINTS\s*=\s*\[', text)
    if not m:
        raise BuildError("%s: no `var POINTS = [`" % where)
    body = text[m.end():]
    end = body.rfind("];")
    if end < 0:
        raise BuildError("%s: no closing `];`" % where)
    body = body[:end]

    entries = []
    for i, obj in enumerate(JS_OBJECT.finditer(body)):
        inner = obj.group(1)
        fields = {}
        pos = 0
        while inner[pos:].strip():
            pm = JS_PAIR.match(inner, pos)
            if not pm:
                raise BuildError("%s entry %d (%s): cannot read `%s`" % (
                    where, i, fields.get("name", "?"), inner[pos:pos + 50].strip()))
            fields[pm.group(1)] = js_value(pm.group(2))
            pos = pm.end()
        entries.append(fields)
    if not entries:
        raise BuildError("%s: read 0 entries" % where)
    return entries


def periods_from_note(note, deployments, who):
    """What the note states about counted deployments, as a periods
    dict, or None where it states nothing. Used only for an imported
    entry that carries no periods of its own."""
    m = NOTE_MET.match(note) or NOTE_BTP.match(note)
    if not m:
        return None
    count, period = int(m.group(1)), m.group(2)
    if deployments is not None and int(deployments) != count:
        raise BuildError("%s: the note says %d deployments but deployments is %s - "
                         "the record contradicts itself, and this will not choose" % (who, count, deployments))
    return {period: count}


def csv_text(entries):
    """CSV text for a list of entries as parse_points returns them. A
    missing type, status or last is filled the way the map fills it;
    a missing deployments is one; a missing periods is read off the
    note; nothing else may be missing."""
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(COLUMNS)
    for i, e in enumerate(entries):
        who = "entry %d (%s)" % (i, e.get("name", "?"))
        for needed in ("name", "note", "lat", "lon"):
            if needed not in e:
                raise BuildError("%s has no %s" % (who, needed))
        kind = e.get("type", "vancam")
        status = e.get("status")
        if status is None:
            status = "legacy" if kind == "vancam" else "active"
        last = e.get("last")
        deployments = e.get("deployments")
        if "periods" in e:
            periods = e["periods"]
            if periods is not None:
                # through the same validation the CSV gets, so an
                # import never writes what a build would refuse
                periods = periods_of(";".join("%s:%s" % kv for kv in periods.items()), who)
        else:
            periods = periods_from_note(e["note"], deployments, who)
        writer.writerow([
            e["name"],
            kind,
            status,
            str(e["lat"]),
            str(e["lon"]),
            "" if last is None else str(last),
            periods_text(periods),
            "1" if deployments is None else str(deployments),
            e["note"],
        ])
    return out.getvalue()


def import_points(source):
    text = io.open(source, encoding="utf-8").read()
    entries = parse_points(text, source)
    csv_out = csv_text(entries)
    # Read it back through the same validation a build uses, so an
    # import never writes a CSV the build would then refuse.
    rows = read_csv(csv_out)
    io.open(path(CSV_FILE), "w", encoding="utf-8", newline="\n").write(csv_out)
    print("build_points: imported %d cameras from %s into %s" % (len(rows), source, CSV_FILE))


def main(argv):
    try:
        if argv == []:
            build()
            return 0
        if argv == ["--check"]:
            return check()
        if len(argv) == 2 and argv[0] == "--import":
            import_points(argv[1])
            return 0
    except BuildError as e:
        print("FAIL: %s" % e)
        return 1
    sys.stderr.write(USAGE + "\n")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
