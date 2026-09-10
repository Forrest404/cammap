#!/usr/bin/env python3
"""Stamp the site's own script and stylesheet tags with a version, then
check the things this repository writes out more than once.

GitHub Pages serves files with cache-control: max-age=600, so after a
deploy a returning visitor can get new HTML with a ten-minute-old
account.js beside it - a page whose buttons do nothing. A ?v= query on
each tag makes the browser fetch afresh whenever the file changed.

The stamp is the first eight hex digits of a hash over the files
themselves, so it changes exactly when they do and not otherwise. It
is matched on the file name whatever folder prefix a page uses to
reach it, so index.html at the root and the pages in pages/ are both
stamped from one pass. Run it from anywhere; it finds the repo root
from its own location. Vendored lib/ and fonts/ are left alone - they
are pinned by their own version numbers.

Then it checks. There is no build step here, on purpose, and so there
are no partials and no generator: anything two pages or two files have
to agree on is written out in each of them and kept in step by hand.
That is fine right up until someone edits one copy and not the other,
which does not error, does not warn, and is close to invisible - the
page simply stops being protected, or the camera quietly goes back to
where it was, or the dot draws in the wrong colour. Every check below
guards a copy that has drifted, or nearly drifted, once already:

  the CSP         Every page carries the same Content-Security-Policy.
                  It is what makes the no-CDN rule something the browser
                  enforces rather than something we remember, and a
                  policy that drifts on one page leaves that page alone
                  unprotected, with only a console warning to say so.
  nav and footer  Also copied onto every page. A link added to six navs
                  and not the seventh is the kind of thing nobody looks
                  for. Compared after taking off what legitimately
                  differs by page: the ../ and pages/ on hrefs, and
                  which link is class="current".
  the stamp list  OWN below is every file the stamp covers. A script
                  added to frontend/ and loaded by a page but not added
                  to OWN is never stamped, and the ten-minute problem
                  above comes straight back for that one file.
  the two data    data/points.js is what the map draws when the
  files           database cannot be reached; backend/seed.sql is what
                  fills the database. Both are written out by
                  tools/build_points.py from data/cameras.csv and are
                  never edited by hand. Compared row for row all the
                  same, and each row's seed_key is recomputed from its
                  own fields - a key that no longer matches its row
                  makes the next seed run insert a second camera
                  instead of updating one.
  the generator   The two files, and data/cameras.geojson - the
                  download the same script writes for map tools - are
                  then regenerated from the CSV in memory and compared
                  byte for byte with what is committed, the first
                  differing line named. This is what makes "never
                  edited by hand" a rule the commit enforces rather
                  than one the header asks for, and it catches the
                  other case too: a CSV edited and committed without
                  the script being run.
  the bounds      CITY.bounds in shared.js is what the browser checks
                  a pin against; public.in_city() in schema.sql is
                  what the server checks against, kept separately so
                  the server never has to trust a browser. SQL cannot
                  read JavaScript, so one copy per language is as few
                  as there can be - and this is what holds the two
                  together. Both data files are checked against the
                  first; the function's four numbers are checked to be
                  the same four; the three check constraints are
                  checked to be a call to it and nothing else; and
                  nothing else in schema.sql may write the box out
                  again, which is how the fourth copy that sat inside
                  pending_near from Wave 4 to version 2.15 would be
                  caught today.
  vancam legacy   Every van site is legacy - a van parks for a shift
                  and drives away, so no van site claims to be active,
                  and the map opens on the cameras that are fixed to
                  something. The original build_points.py computed an
                  active/legacy split and would have put 97 sites back
                  to active; the one in tools/ now refuses to write an
                  active van site at all. See "What active means" in
                  NOTES.md; this is the check that makes it stick
                  whatever wrote the files.
  the types       CAMERA_TYPES in shared.js is the one list the legend
                  and every drop-down are built from; schema.sql keeps
                  its own copy in three check constraints, again so
                  the server can refuse a bad row on its own. A type
                  in one and not the other is a dot the legend cannot
                  explain, or a report the server refuses. nonfunccam
                  is allowed in the constraints without being a
                  CAMERA_TYPES type: it is a state, not a kind, and
                  shared.js names it NONFUNCTIONAL_TYPE for that reason.

Each failure names the page, the row or the constraint, and the script
exits non-zero. Run before every commit and a drift cannot survive one.

`--check` runs every check and writes nothing. A page whose stamps
would change is then a failure that names the page, not a repair -
which is what CI wants: on a checked-out tree a stale stamp means
somebody committed without running this, and the build should say so.

Standard library only, and the JavaScript and SQL are read with regular
expressions rather than a parser, deliberately: both data files are
generated-format and regular, and this has to run anywhere Python does,
with no Node and no database to hand. The bounds and the types are read
from shared.js and schema.sql each time rather than copied in here, so
this file is not one more copy to keep in step.
"""
import glob, hashlib, io, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

USAGE = "usage: python3 tools/stamp.py [--check]"

CHECK_ONLY = False
for arg in sys.argv[1:]:
    if arg == "--check":
        CHECK_ONLY = True
    else:
        sys.stderr.write(USAGE + "\n")
        sys.exit(2)


def read(path):
    return io.open(path, encoding="utf-8").read()


# Every page the site serves: whatever is at the root, and everything
# under pages/ however deep. Found rather than listed so that a new
# page - a 404, a borough page a tool wrote - is checked from the
# moment it exists, without anyone remembering to add it here.
PAGES = sorted(glob.glob("*.html")) + sorted(glob.glob("pages/**/*.html", recursive=True))

# The files the stamp covers: everything of ours a page loads. If you
# add a script or stylesheet to frontend/, add it here - and the
# "unstamped" check further down will tell you if you forget.
OWN = ["frontend/shared.js", "frontend/map.js", "frontend/account.js",
       "frontend/picker.js", "frontend/press.js", "frontend/style.css",
       "data/points.js", "supabase-config.js"]

# The tables schema.sql must carry a type constraint and a London
# constraint for. Listed so the checks cannot pass by finding nothing:
# if the schema is rewritten and the pattern below stops matching, the
# constraint is reported missing rather than silently unchecked.
TYPE_CONSTRAINTS = ["cameras.type", "reports.type", "saved_cameras.camera_type"]
BOUNDS_CONSTRAINTS = ["cameras_in_london", "reports_in_london", "saved_cameras_in_london"]

# The one place the box is written on the SQL side (schema version
# 2.15). The three constraints above call it, and so does
# pending_near; the bounds check below reads its four numbers, holds
# them to CITY.bounds in shared.js, and refuses any other test in the
# file that writes the box out for itself.
CITY_FUNCTION = "in_city"


# ---- reporting ----
#
# Every check runs and every failure prints, rather than stopping at
# the first: somebody fixing a page wants the whole list. The exit code
# is decided at the end.

failed = []


def ok(line):
    print(line)


def fail(title, lines):
    failed.append(title)
    print("")
    print("FAIL: %s" % title)
    for line in lines:
        print("  " + line)
    print("")


# ---- the stamp ----

missing_own = [f for f in OWN if not os.path.exists(f)]
if missing_own:
    fail("OWN names a file that does not exist",
         ["%s" % f for f in missing_own] +
         ["Remove it from OWN in tools/stamp.py, or put the file back."])

h = hashlib.sha256()
for f in OWN:
    if f not in missing_own:
        h.update(io.open(f, "rb").read())
stamp = h.hexdigest()[:8]

# The name has to be the whole of the basename - a "/" or the start of
# the value before it - so that a vendored lib/whatever-map.js can never
# be mistaken for our map.js and stamped.
names = "|".join(re.escape(os.path.basename(f)) for f in OWN)
STAMPED = re.compile(r'(src|href)="((?:[^"]*/)?(?:' + names + r'))(\?v=[0-9a-f]+)?"')


def stamped(html):
    return STAMPED.sub(lambda m: '%s="%s?v=%s"' % (m.group(1), m.group(2), stamp), html)


stale = []
for page in PAGES:
    s = read(page)
    t = stamped(s)
    if t != s:
        stale.append(page)
        if not CHECK_ONLY:
            io.open(page, "w", encoding="utf-8").write(t)

if CHECK_ONLY:
    if stale:
        fail("STALE STAMPS on %d page(s) - somebody committed without running tools/stamp.py" % len(stale),
             stale + ["Run python3 tools/stamp.py (no flag) and commit what it writes."])
    else:
        ok("stamp %s: current on all %d pages (nothing written)" % (stamp, len(PAGES)))
else:
    ok("stamp %s: %d page(s) updated" % (stamp, len(stale)))

# Read every page once, after stamping, for the checks below.
html = dict((page, read(page)) for page in PAGES)


# ---- every script and stylesheet a page loads from here is in OWN ----
#
# The stamp can only cover what it knows about. A page loading a file
# of ours that is not in OWN gets no ?v= on that tag, and the ten-minute
# cache problem is back for exactly that file. lib/ and fonts/ are
# excused: they are pinned by their own version numbers.

SCRIPT_SRC = re.compile(r'<script[^>]*\ssrc="([^"]+)"')
LINK_TAG = re.compile(r'<link[^>]*>')
LINK_HREF = re.compile(r'\shref="([^"]+)"')
own_names = set(os.path.basename(f) for f in OWN)
unstamped = []

for page in PAGES:
    assets = SCRIPT_SRC.findall(html[page])
    for tag in LINK_TAG.findall(html[page]):
        if 'rel="stylesheet"' in tag:
            m = LINK_HREF.search(tag)
            if m:
                assets.append(m.group(1))
    for asset in assets:
        if re.match(r'^(?:[a-z][a-z0-9+.-]*:|//)', asset):
            continue                       # not ours to stamp
        path = asset.split("?")[0]
        while path.startswith("../"):
            path = path[3:]
        if path.startswith("lib/") or path.startswith("fonts/"):
            continue
        if os.path.basename(path) not in own_names:
            unstamped.append("%s loads %s" % (page, asset))

if unstamped:
    fail("UNSTAMPED: a page loads a file of ours that is not in OWN, so it is never stamped",
         unstamped + ["Add it to OWN in tools/stamp.py."])
else:
    ok("own files: every script and stylesheet a page loads is in OWN")


# ---- the copies of the policy have to stay one policy ----

CSP = re.compile(r'<meta http-equiv="Content-Security-Policy" content="(.*?)">', re.S)

policies = {}
for page in PAGES:
    found = CSP.search(html[page])
    # whitespace is only formatting inside a CSP, so compare on the directives
    policies[page] = " ".join(found.group(1).split()) if found else None

missing = [p for p, v in policies.items() if v is None]
distinct = set(v for v in policies.values() if v is not None)

if missing:
    fail("CSP MISSING on %d page(s)" % len(missing), missing)
if len(distinct) > 1:
    lines = []
    for policy in sorted(distinct):
        who = sorted(p for p, v in policies.items() if v == policy)
        lines.append("%s" % ", ".join(who))
        lines.append("    %s" % policy)
    fail("CSP DRIFT: %d different policies across %d pages" % (len(distinct), len(PAGES)),
         lines + ["Make them identical again before committing."])
if not missing and len(distinct) == 1:
    ok("csp: one policy across %d pages" % len(PAGES))


# ---- the nav and the footer are the same on every page ----
#
# Not byte for byte, because they cannot be: a link is written relative
# to where its page sits, so index.html says pages/about.html where a
# page in pages/ says about.html and ../index.html; and class="current"
# sits on a different link on each page. Those are taken off before
# comparing, and whitespace runs are collapsed, so what is left is the
# links, their order, their text and everything else in the block. A
# link missing from one page, or added to one page only, still fails.

NAV = re.compile(r'<nav class="bar">.*?</nav>', re.S)
FOOT = re.compile(r'<footer class="foot">.*?</footer>', re.S)
HREF = re.compile(r'href="([^"]*)"')
CURRENT = re.compile(r'\s+class="current"')


def local(href):
    """The href as the site's root would write it: ../ and pages/ off."""
    if re.match(r'^(?:[a-z][a-z0-9+.-]*:|//|#)', href):
        return href
    while href.startswith("../"):
        href = href[3:]
    if href.startswith("pages/"):
        href = href[len("pages/"):]
    return href


def normalised(fragment):
    fragment = HREF.sub(lambda m: 'href="%s"' % local(m.group(1)), fragment)
    fragment = CURRENT.sub("", fragment)
    return " ".join(fragment.split())


def around_first_difference(a, b, width=90):
    """A window on both strings where they stop agreeing, so the eye
    lands on the missing link rather than reading two long lines."""
    i = 0
    while i < min(len(a), len(b)) and a[i] == b[i]:
        i += 1
    lo = max(0, i - width // 3)
    return a[lo:lo + width], b[lo:lo + width]


def same_on_every_page(label, pattern, what):
    versions = {}
    absent = []
    for page in PAGES:
        m = pattern.search(html[page])
        if not m:
            absent.append(page)
        else:
            versions.setdefault(normalised(m.group(0)), []).append(page)

    if absent:
        fail("%s MISSING on %d page(s)" % (label.upper(), len(absent)), absent)
    if len(versions) > 1:
        # the version most pages share is the reference; the rest differ from it
        ranked = sorted(versions.items(), key=lambda kv: (-len(kv[1]), kv[1]))
        reference, holders = ranked[0]
        lines = ["compared after normalising hrefs, class=\"current\" and whitespace",
                 "%s have:" % ", ".join(sorted(holders)),
                 "    %s" % reference]
        for version, pages in ranked[1:]:
            lines.append("%s differs:" % ", ".join(sorted(pages)))
            lines.append("    %s" % version)
            a, b = around_first_difference(reference, version)
            lines.append("  they part company here -")
            lines.append("    reference: ...%s..." % a)
            lines.append("    this page: ...%s..." % b)
        fail("%s DRIFT: %d different %ss across %d pages" % (label.upper(), len(versions), what, len(PAGES)), lines)
    if not absent and len(versions) == 1:
        ok("%s: the same on all %d pages" % (label, len(PAGES)))


same_on_every_page("nav", NAV, "nav")
same_on_every_page("footer", FOOT, "footer")


# ---- what shared.js and schema.sql say ----
#
# Read fresh each run. If either pattern stops matching, that is a
# failure, never a pass: a check that found nothing to check would be
# worse than no check.

shared = read("frontend/shared.js")
schema = read("backend/schema.sql")

m = re.search(r'var CITY\s*=\s*\{.*?\bbounds:\s*\[\s*\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]\s*,'
              r'\s*\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]\s*\]', shared, re.S)
if m:
    south, west, north, east = (float(x) for x in m.groups())
    bounds = ((south, west), (north, east))
else:
    bounds = None
    fail("CITY.bounds not found in frontend/shared.js",
         ["expected  var CITY = { ... bounds: [[lat, lon], [lat, lon]], ... };",
          "LONDON_BOUNDS is an alias of it now - see \"the city this map is of\" there."])

m = re.search(r'var CAMERA_TYPES\s*=\s*\[(.*?)\];', shared, re.S)
camera_types = re.findall(r'\btype:\s*"([^"]+)"', m.group(1)) if m else []
if not camera_types:
    fail("CAMERA_TYPES not found in frontend/shared.js, or has no entries", [])

m = re.search(r'var NONFUNCTIONAL_TYPE\s*=\s*"([^"]+)"', shared)
nonfunctional_type = m.group(1) if m else None
if not nonfunctional_type:
    fail("NONFUNCTIONAL_TYPE not found in frontend/shared.js", [])


# ---- reading the two data files ----
#
# Both are generated-format: one entry per object in points.js, one
# tuple per row in seed.sql, every field written every time. Strings
# are read as strings - JSON-quoted in the JS, single-quoted with
# doubled apostrophes in the SQL - so King's Cross compares equal to
# King''s Cross, and a note with a quoted phrase in it compares on the
# phrase. Anything the pattern cannot read is a failure naming the
# entry, not a row silently skipped.

JS_STRING = r'"(?:[^"\\]|\\.)*"'
# One level of nesting, for the periods object - {"2023-24": 1} - which
# holds strings and numbers and never another object. Without it the
# entry pattern below would stop at the first inner brace and read the
# periods object as an entry of its own.
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
        return json.loads(raw)       # the file writes both in JSON form
    return float(raw) if "." in raw else int(raw)


def parse_points():
    s = read("data/points.js")
    m = re.search(r'var POINTS\s*=\s*\[', s)
    if not m:
        return None, "no `var POINTS = [` in data/points.js"
    body = s[m.end():]
    end = body.rfind("];")
    if end < 0:
        return None, "no closing `];` after `var POINTS = [` in data/points.js"
    body = body[:end]

    rows = []
    for i, obj in enumerate(JS_OBJECT.finditer(body)):
        inner = obj.group(1)
        fields = {}
        pos = 0
        while inner[pos:].strip():
            pm = JS_PAIR.match(inner, pos)
            if not pm:
                return None, "entry %d (%s): cannot read `%s`" % (
                    i, fields.get("name", "?"), inner[pos:pos + 50].strip())
            fields[pm.group(1)] = js_value(pm.group(2))
            pos = pm.end()
        rows.append(fields)
    if not rows:
        return None, "read 0 entries from data/points.js - the format changed, or the pattern here broke"
    return rows, None


SQL_STRING = r"'(?:[^']|'')*'"
SQL_VALUE = SQL_STRING + r"|-?\d+(?:\.\d+)?|null|true|false"
SQL_ROW = re.compile(r"\(((?:[^()']|" + SQL_STRING + r")*)\)", re.S)
SQL_ITEM = re.compile(r"\s*(" + SQL_VALUE + r")\s*,?", re.S)


def sql_value(raw):
    if raw == "null":
        return None
    if raw == "true":
        return True
    if raw == "false":
        return False
    if raw.startswith("'"):
        return raw[1:-1].replace("''", "'")
    return float(raw) if "." in raw else int(raw)


def parse_seed():
    s = read("backend/seed.sql")
    m = re.search(r'insert into public\.cameras\s*\(([^)]*)\)\s*values', s, re.S)
    if not m:
        return None, "no `insert into public.cameras (...) values` in backend/seed.sql"
    columns = [c.strip() for c in m.group(1).split(",")]
    body = s[m.end():]
    end = re.search(r'^\s*on conflict', body, re.M)
    if not end:
        return None, "no `on conflict` after the rows in backend/seed.sql"
    body = body[:end.start()]

    rows = []
    for i, row in enumerate(SQL_ROW.finditer(body)):
        inner = row.group(1)
        values = []
        pos = 0
        while inner[pos:].strip():
            im = SQL_ITEM.match(inner, pos)
            if not im:
                return None, "row %d: cannot read `%s`" % (i, inner[pos:pos + 50].strip())
            values.append(sql_value(im.group(1)))
            pos = im.end()
        if len(values) != len(columns):
            return None, "row %d has %d values for %d columns (%s)" % (
                i, len(values), len(columns), ", ".join(columns))
        rows.append(dict(zip(columns, values)))
    if not rows:
        return None, "read 0 rows from backend/seed.sql - the format changed, or the pattern here broke"
    return rows, None


points, why = parse_points()
if points is None:
    fail("cannot read data/points.js", [why])

seed, why = parse_seed()
if seed is None:
    fail("cannot read backend/seed.sql", [why])


def describe(row):
    return "%s (%s, %s)" % (row.get("name"), row.get("lat"), row.get("lon"))


# ---- points.js and seed.sql agree row for row ----
#
# Same count, same order, and per row the same name, note, position,
# type, status, last year and deployment count. The seed_key is not
# compared with anything in points.js - it is recomputed from the seed
# row's own fields, the way seedKeyOf() in map.js computes it, and has
# to match: the key is how a seed run finds the row it already wrote,
# and a key that names an old position makes the next run insert a
# second camera at the old spot. The first offending row is named;
# after an insertion or deletion every row after it differs, and one
# is enough to find it.

PAIRED = [("name", "name"), ("note", "note"), ("lat", "lat"), ("lon", "lon"),
          ("type", "type"), ("status", "status"), ("last", "last_seen"),
          ("deployments", "deployments"), ("periods", "periods"),
          ("source_label", "source_label"), ("source_url", "source_url"),
          ("approximate", "approximate")]

# Columns the seed writes as a string literal that the database reads
# as something else. periods is jsonb, written as its JSON text, so it
# is decoded here before being compared with the object points.js has.
JSON_IN_SEED = ["periods"]


def seed_field(r, sf):
    v = r.get(sf)
    if sf in JSON_IN_SEED and isinstance(v, str):
        try:
            return json.loads(v)
        except ValueError:
            return ("not JSON", v)
    return v


if points is not None and seed is not None:
    lines = []
    if len(points) != len(seed):
        lines.append("%d entries in data/points.js, %d rows in backend/seed.sql" % (len(points), len(seed)))
    for i in range(min(len(points), len(seed))):
        p, r = points[i], seed[i]
        diffs = []
        for pf, sf in PAIRED:
            if p.get(pf) != seed_field(r, sf):
                diffs.append("%s: points.js has %r, seed.sql has %r" % (pf, p.get(pf), r.get(sf)))
        if r.get("source") != "seed":
            diffs.append("source: seed.sql has %r, every seeded row is 'seed'" % r.get("source"))
        if r.get("lat") is not None and r.get("lon") is not None:
            expected = "%s|%.6f|%.6f|%s" % (r.get("name"), r["lat"], r["lon"], r.get("type"))
            if r.get("seed_key") != expected:
                diffs.append("seed_key: seed.sql has %r, the row's own fields say %r" % (r.get("seed_key"), expected))
        if diffs:
            lines.append("row %d, %s:" % (i, describe(p)))
            lines.extend("    " + d for d in diffs)
            break
    if lines:
        fail("DATA DRIFT: data/points.js and backend/seed.sql disagree", lines +
             ["The two files are the same cameras in two forms and must agree row for row."])
    else:
        ok("data: %d rows, points.js and seed.sql agree" % len(points))


# ---- every camera is inside LONDON_BOUNDS, and so is the server ----

if bounds is not None:
    (south, west), (north, east) = bounds
    outside = []
    for label, rows in (("data/points.js", points or []), ("backend/seed.sql", seed or [])):
        for i, row in enumerate(rows):
            lat, lon = row.get("lat"), row.get("lon")
            if not (isinstance(lat, (int, float)) and isinstance(lon, (int, float))):
                outside.append("%s row %d, %s: no numeric position" % (label, i, row.get("name")))
            elif not (south <= lat <= north and west <= lon <= east):
                outside.append("%s row %d, %s" % (label, i, describe(row)))
    if outside:
        fail("OUTSIDE LONDON: a camera is outside LONDON_BOUNDS [[%s, %s], [%s, %s]]" % (south, west, north, east),
             outside)

    # Since schema version 2.15 the SQL side holds the box once, in
    # public.in_city(), and the three constraints and pending_near
    # call it. So this checks three things rather than one: that the
    # function's four numbers are CITY.bounds; that every constraint
    # named above is the call and nothing else; and that no other test
    # in the file writes the box out again. The last is the one that
    # keeps "one place" true - a fourth copy is exactly what
    # pending_near carried, unchecked, from Wave 4 until 2.15.
    wrong = []

    m = re.search(r'create or replace function public\.' + re.escape(CITY_FUNCTION) +
                  r'\s*\([^)]*\)(.*?)\$\$\s*;', schema, re.S)
    if not m:
        wrong.append("public.%s(lat, lon) not found in backend/schema.sql" % CITY_FUNCTION)
        body = ""
    else:
        body = m.group(1)
        numbers = re.search(r'lat\s+between\s+(-?[\d.]+)\s+and\s+(-?[\d.]+)\s+and\s+'
                            r'lon\s+between\s+(-?[\d.]+)\s+and\s+(-?[\d.]+)', body, re.S)
        if not numbers:
            wrong.append("public.%s: cannot read the box out of its body "
                         "(expected `lat between A and B and lon between C and D`)" % CITY_FUNCTION)
        elif tuple(float(x) for x in numbers.groups()) != (south, north, west, east):
            wrong.append("public.%s: lat between %s and %s, lon between %s and %s"
                         % ((CITY_FUNCTION,) + numbers.groups()))

    # Every *_in_london constraint, wherever it is written - inline in
    # a create table, or in the version 2.15 alter block - with the
    # whole of what it checks. The parentheses are balanced by hand
    # because the body has parentheses of its own now, and a
    # `\(([^)]*)\)` would stop inside the call.
    CALL = "public.%s(lat, lon)" % CITY_FUNCTION
    seen = {}
    for m in re.finditer(r'constraint\s+(\w+_in_london)\s+check\s*\(', schema):
        depth = 1
        i = m.end()
        while i < len(schema) and depth:
            depth += (schema[i] == "(") - (schema[i] == ")")
            i += 1
        checked = " ".join(schema[m.end():i - 1].split())
        seen.setdefault(m.group(1), []).append(checked)

    for name in BOUNDS_CONSTRAINTS:
        if name not in seen:
            wrong.append("%s: no `constraint %s check (...)` in backend/schema.sql" % (name, name))
            continue
        for checked in seen[name]:
            if checked != CALL:
                wrong.append("%s checks `%s`, not `%s` - the box belongs in %s and nowhere else"
                             % (name, checked, CALL, CITY_FUNCTION))
    for name in seen:
        if name not in BOUNDS_CONSTRAINTS:
            wrong.append("%s: a London constraint this script did not expect - "
                         "add it to BOUNDS_CONSTRAINTS" % name)

    # Nowhere else may say where the city is. `cell_lat between` and
    # `cell_lon between` are the report grid, not the box, and the \b
    # before lat leaves them alone.
    elsewhere = re.sub(re.escape(body), "", schema, count=1) if body else schema
    for m in re.finditer(r'\b(lat|lon)\s+between\s+-?[\d.]+\s+and\s+-?[\d.]+', elsewhere):
        wrong.append("a copy of the box outside %s: `%s` - call %s instead"
                     % (CITY_FUNCTION, m.group(0), CALL))

    if wrong:
        fail("BOUNDS DRIFT: schema.sql does not carry CITY.bounds [[%s, %s], [%s, %s]] in one place" % (
            south, west, north, east),
             wrong + ["shared.js says lat between %s and %s, lon between %s and %s." % (south, north, west, east)])
    if not outside and not wrong:
        ok("bounds: %d cameras inside [[%s, %s], [%s, %s]]; %s carries it and %d constraints call it" % (
            len(points or []), south, west, north, east, CITY_FUNCTION, len(BOUNDS_CONSTRAINTS)))


# ---- every vancam is legacy ----

if points is not None and seed is not None:
    active_vans = []
    for label, rows in (("data/points.js", points), ("backend/seed.sql", seed)):
        for i, row in enumerate(rows):
            if row.get("type") == "vancam" and row.get("status") != "legacy":
                active_vans.append("%s row %d, %s: status %r" % (label, i, row.get("name"), row.get("status")))
    if active_vans:
        fail("A VAN SITE IS NOT LEGACY", active_vans +
             ["Every vancam is legacy - see \"What active means\" in NOTES.md."])
    else:
        vans = sum(1 for row in points if row.get("type") == "vancam")
        ok("vancam: all %d legacy, in both files" % vans)


# ---- the types: shared.js, the data, and the three constraints ----

if camera_types:
    # a type in the data that CAMERA_TYPES does not know draws as a van
    # (colourOf falls back to it) and the legend cannot explain it
    unknown = []
    for label, rows in (("data/points.js", points or []), ("backend/seed.sql", seed or [])):
        for i, row in enumerate(rows):
            if row.get("type") not in camera_types:
                unknown.append("%s row %d, %s: type %r" % (label, i, row.get("name"), row.get("type")))
    if unknown:
        fail("UNKNOWN TYPE: a camera has a type that is not in CAMERA_TYPES", unknown)

    TYPES_SQL = re.compile(r'check\s*\(\s*(type|camera_type)\s+in\s*\(([^)]*)\)\s*\)', re.S)
    TABLE = re.compile(r'(?:create table if not exists|alter table)\s+public\.(\w+)')
    constraints = {}
    for m in TYPES_SQL.finditer(schema):
        tables = TABLE.findall(schema[:m.start()])
        table = tables[-1] if tables else "?"
        constraints["%s.%s" % (table, m.group(1))] = re.findall(r"'([^']*)'", m.group(2))

    wrong = []
    for name in TYPE_CONSTRAINTS:
        if name not in constraints:
            wrong.append("%s: no `check (%s in (...))` found in backend/schema.sql" % (name, name.split(".")[1]))
            continue
        for t in camera_types:
            if t not in constraints[name]:
                wrong.append("%s is in CAMERA_TYPES but not in the %s constraint" % (t, name))
        for t in constraints[name]:
            if t not in camera_types and t != nonfunctional_type:
                wrong.append("%s is in the %s constraint but not in CAMERA_TYPES (and is not NONFUNCTIONAL_TYPE)" % (t, name))
    for name in constraints:
        if name not in TYPE_CONSTRAINTS:
            wrong.append("%s: a type constraint this script did not expect - add it to TYPE_CONSTRAINTS" % name)
    if wrong:
        fail("TYPE DRIFT: CAMERA_TYPES and the schema's check constraints disagree", wrong +
             ["Adding a kind of camera means editing shared.js and schema.sql, and nothing else."])
    elif not unknown:
        ok("types: %s; present in %d constraints" % (", ".join(camera_types), len(TYPE_CONSTRAINTS)))


# ---- regenerated output matches committed output ----
#
# tools/build_points.py writes both data files, and the GeoJSON
# download beside them, from data/cameras.csv, and from now on that is
# the only way any of them is written. So the check is not "do the two
# files agree with each other" - the row-for-row check above still asks
# that, and would catch a generator bug that hit one file and not the
# other - but "is every output exactly what the CSV produces".
# Regenerated here in memory and compared byte for byte, the first
# differing line named. A hand edit to points.js or to cameras.geojson
# fails it; so does a CSV edited and committed without the script being
# run.
#
# The generator is imported as a module rather than run as a
# subprocess: nothing has to be written to a temporary directory, the
# comparison happens on strings, and a CSV the generator refuses is
# reported here with its own message rather than as an exit code to be
# interpreted. It is standard-library Python like this file, so
# importing it adds nothing this script did not already need. Bytecode
# writing is switched off first so that importing it does not leave a
# __pycache__ in tools/ on every run.

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(ROOT, "tools"))
try:
    import build_points
except Exception as e:                       # a syntax error is a failure, not a pass
    build_points = None
    fail("cannot import tools/build_points.py", [repr(e)])

if build_points is not None:
    generated = None
    try:
        generated, count = build_points.regenerate()
    except build_points.BuildError as e:
        fail("data/cameras.csv WILL NOT BUILD", [str(e)])
    except Exception as e:
        fail("tools/build_points.py FAILED", [repr(e)])
    if generated is not None:
        lines = []
        for rel, text in generated.items():
            diff = build_points.first_difference(text, read(rel))
            if diff:
                line, ours, theirs = diff
                lines.append("%s: first difference at line %d" % (rel, line))
                lines.append("    generated: %s" % ("<end of file>" if ours is None else ours.rstrip()))
                lines.append("    committed: %s" % ("<end of file>" if theirs is None else theirs.rstrip()))
        if lines:
            fail("GENERATED DRIFT: a data file is not what data/cameras.csv produces", lines +
                 ["Edit data/cameras.csv and run python3 tools/build_points.py; "
                  "points.js, seed.sql and cameras.geojson are never edited by hand."])
        else:
            ok("generated: points.js, seed.sql and cameras.geojson are what cameras.csv builds, %d cameras" % count)


# ---- verdict ----

print("")
if failed:
    print("%d check(s) FAILED - fix before committing:" % len(failed))
    for title in failed:
        print("  - %s" % title)
    sys.exit(1)
print("all checks passed")
