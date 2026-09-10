#!/usr/bin/env python3
"""Fill the borough column in data/cameras.csv by looking each camera
up, once, in OpenStreetMap's Nominatim.

    python3 tools/boroughs.py             fill every blank borough
    python3 tools/boroughs.py --check     say what is blank; ask nothing
    python3 tools/boroughs.py --all       look every row up again, even
                                          ones that already have a value

Run by hand, by the maintainer, when a camera has been added to the
record. **Never by CI, never by stamp.py, never by anything the site
serves.** It is the one tool in this repository that talks to the
network, and it talks to somebody else's free service; a checker that
did that on every push would be abusing it within a week.

Why a borough at all
--------------------

DATA-4 asks for a page per borough - "what is in Croydon" - and the
record has no borough column: it has a name, which is sometimes a
borough ("Croydon", "Hackney") and more often a street ("Rye Lane,
Peckham"), and a position. A page that said "eleven cameras in
Southwark" would be making a claim, and this project's promise is that
nothing on it is estimated. So the borough is *looked up*, once, from a
named source, and written into the record as a column like any other
fact. From then on it is a cell the maintainer can correct, not
something a page works out on the fly and might work out differently
tomorrow.

The source, and why this one
----------------------------

OpenStreetMap's Nominatim, reverse geocode, zoom 10:

    https://nominatim.openstreetmap.org/reverse?lat=&lon=&zoom=10&format=jsonv2&addressdetails=1

The alternative considered was the Office for National Statistics'
borough boundary polygons under the Open Government Licence, committed
under data/ and read by a point-in-polygon here - no network, and
reproducible by anyone at any time, which is the better property. It
was not taken because it means vendoring a simplified copy of a
boundary file into a repository that has so far vendored only a map
library and a typeface, and because simplifying a polygon is itself a
decision about where a boundary is: a camera thirty metres from the
Brent/Camden line could land either side of it depending on how hard
the file was squeezed. Nominatim answers from the full boundary
geometry, is the same service the site's own place search already uses
and already names in its Content-Security-Policy, and its answers here
proved unambiguous - see "What it returns" below. If it ever stops
being so, the polygons are the fallback and this docstring is the
argument for making the switch.

Nominatim's usage policy, honoured:

  - **at most one request a second.** SECONDS_BETWEEN below is 1.1, and
    the wait is between requests rather than after them, so a slow
    answer does not become a fast follow-up. 182 cameras is about three
    and a half minutes.
  - **an identifying User-Agent.** USER_AGENT below names the project
    and its address, so an operator looking at a log can see who this
    is and where to complain.
  - **no bulk geocoding of an address list, and no autocomplete.** This
    is a one-off over a record of a couple of hundred rows, run when
    the record changes, and it skips every row it has already answered
    - which is why it is idempotent: run it twice and the second run
    makes no requests at all.

Run and recorded: **2026-09-10**, 182 cameras, 186 requests (the first
four were asked twice, because the run stopped at the fifth on an
answer shape this tool had not been taught and they had not been
written yet - see "What it returns"), every one answered, no row left
without a borough. What each row was given is in data/cameras.csv
itself. It was then cross-checked against the two other things in this
repository that name a borough: the research survey's own borough
column, where the two lists plainly share a site (35 of 36 agreed),
and the record's own names, where a camera is called after a borough
(30 of 30 agreed). The one disagreement - Kilburn High Road, which the
survey itself marks uncertain because the road runs along the
Brent/Camden boundary - is in QUESTIONS.md for the maintainer and is
not resolved here: the lookup's answer stands until they settle it.
Re-run it when a camera is added
to the record, or when one is moved: a moved camera keeps its borough,
and if it moved across a boundary that cell is now wrong, so clear it
and run this.

What it returns, and how it is read
-----------------------------------

At zoom 10 a London point comes back in one of four shapes. Three were
checked by hand before this was written; the fourth turned up on the
fifth camera of the first real run, at Bethnal Green, and the tool
refused it and printed what it had actually been sent rather than
picking something close, which is how it came to be in this list:

    an ordinary borough   address.city_district = "London Borough of
                          Croydon", address.city = "Greater London"
    a royal borough       address.city_district = "Royal Borough of
                          Kensington and Chelsea"
    a borough under its   no city_district; address.borough = "London
    own key               Borough of Tower Hamlets". Nominatim uses
                          this where OpenStreetMap has tagged the area
                          at a different administrative level, and it
                          is the same fact under a different name.
    the two Cities        neither; address.city = "City of London" or
                          "City of Westminster"

So the rule is: take the first of city_district, borough and city that
is there, then reduce the council's legal title to the area's name by
taking off "London Borough of " or "Royal Borough of ", and read "City
of Westminster" as Westminster through the alias below. "City of
London" is left whole - that is the area's name, not a title in front
of one.

Whatever comes out is then checked against data/boroughs.txt, which is
the list of thirty-three. **Anything that does not match is refused,
naming the camera and printing what Nominatim actually said.** It is
never guessed at, never left to the nearest match, and never written.
"Greater London" arriving in the city field with no city_district
would mean the point fell outside every borough boundary, which for a
camera in this record would be a fact worth knowing rather than a cell
to fill.

What this tool will not do
--------------------------

It will not overwrite a borough that is already there. A cell the
maintainer has corrected by hand is the record, and a tool that
reached over it on the next run would undo the correction silently -
which is the mistake "What active means" in NOTES.md describes for
status. --all is the deliberate way to ask for a fresh answer for
every row, and it says so before it starts.

It will not touch any other cell. It reads the CSV, fills blanks in
one column, and writes it back through the same csv module that wrote
it, so a run that fills nothing produces a byte-identical file.

It does not build anything. After a run, do what any edit to the record
needs: python3 tools/build_points.py, then python3 tools/stamp.py.

A machine note, not a code one: on a python.org build of Python with
no certificates installed, urllib cannot verify the certificate and
every request fails with CERTIFICATE_VERIFY_FAILED. The fix is the
machine's, not this file's - run it as

    SSL_CERT_FILE=/etc/ssl/cert.pem python3 tools/boroughs.py

or install certifi. Verification is deliberately not turned off here;
a site about surveillance does not fetch over an unverified connection
to save a line.

Standard library only, like every other tool here.
"""
import csv
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CSV_FILE = "data/cameras.csv"
BOROUGHS_FILE = "data/boroughs.txt"

USAGE = "usage: python3 tools/boroughs.py [--check | --all]"

# Nominatim's usage policy asks for a User-Agent that identifies the
# application, so that an operator can tell who is calling and where to
# say so if it is a nuisance. The site's own place search identifies
# itself by the Referer the browser sends; this runs outside a browser,
# so it says the same thing in the header it can set.
USER_AGENT = ("cammap/1.0 (+https://forrest404.github.io/cammap/; "
              "borough lookup for data/cameras.csv, run by hand)")

REVERSE = "https://nominatim.openstreetmap.org/reverse"

# One request a second at most, with a tenth of a second in hand
# against a clock that is not ours. Waited before each request rather
# than after, so an answer that took two seconds is not followed
# instantly by the next.
SECONDS_BETWEEN = 1.1

# zoom 10 is the administrative level Nominatim returns a borough at;
# closer and the answer is a suburb or a street, wider and it is
# Greater London. jsonv2 for the address block, addressdetails because
# without it there is no address block at all.
ZOOM = 10

# The councils' legal titles, and the areas' names. Taking a prefix off
# is a reduction the source's own words support; the alias is the one
# case where the title is not the name with something in front of it -
# Westminster's council is the City of Westminster, and the area is
# Westminster, which is what a page heading and a person both say.
# "City of London" is deliberately not in either: there the title IS
# the name.
TITLE_PREFIXES = ("London Borough of ", "Royal Borough of ")
ALIASES = {"City of Westminster": "Westminster"}

# Where the answer might be, best first. city_district is where a
# borough usually lands and borough is where it lands for the ones
# OpenStreetMap has tagged a level down (Tower Hamlets, among others);
# city is where the two Cities land, and is "Greater London" for
# everywhere else, which is not a borough and is refused by the list
# check like any other wrong answer. City last for exactly that
# reason: it is the field most likely to hold something that is not
# what is being asked for.
ADDRESS_FIELDS = ("city_district", "borough", "city")


class LookupError_(Exception):
    """Something this tool will not write around. The message names
    the camera and prints what the source actually said."""


def path(rel):
    return os.path.join(ROOT, rel)


def boroughs():
    """The thirty-three, in the order data/boroughs.txt writes them.
    Read on every run rather than copied here, so this file is not one
    more copy of the list to keep in step."""
    out = []
    for line in io.open(path(BOROUGHS_FILE), encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#"):
            out.append(line)
    if not out:
        raise LookupError_("%s has no boroughs in it" % BOROUGHS_FILE)
    return out


def borough_of(address, known):
    """The borough an address block names, reduced to the form
    data/boroughs.txt uses, or None if it names none of them."""
    for field in ADDRESS_FIELDS:
        raw = (address.get(field) or "").strip()
        if not raw:
            continue
        name = ALIASES.get(raw, raw)
        for prefix in TITLE_PREFIXES:
            if name.startswith(prefix):
                name = name[len(prefix):]
                break
        if name in known:
            return name
    return None


def reverse(lat, lon):
    """One reverse geocode. Returns the whole answer, so that a refusal
    can print what was actually said rather than a summary of it."""
    query = urllib.parse.urlencode({
        "lat": lat, "lon": lon,
        "zoom": ZOOM, "format": "jsonv2", "addressdetails": 1,
    })
    request = urllib.request.Request(REVERSE + "?" + query, headers={
        "User-Agent": USER_AGENT, "Accept": "application/json",
    })
    with urllib.request.urlopen(request, timeout=30) as answer:
        return json.loads(answer.read().decode("utf-8"))


def read_rows():
    """Every row of the CSV as a dict, with the header, exactly as it
    is written - no validation, no normalisation, nothing that could
    change a cell this tool is not here to change. build_points.py is
    what validates the record; this only fills one column."""
    text = io.open(path(CSV_FILE), encoding="utf-8", newline="").read()
    reader = csv.reader(io.StringIO(text, newline=""))
    header = next(reader)
    if "borough" not in header:
        raise LookupError_(
            "%s has no borough column - its header is %s. Add it to COLUMNS "
            "in tools/build_points.py first." % (CSV_FILE, ",".join(header)))
    rows = [values for values in reader if values and any(v.strip() for v in values)]
    for number, values in enumerate(rows, 2):
        if len(values) != len(header):
            raise LookupError_("%s line %d has %d fields for %d columns"
                               % (CSV_FILE, number, len(values), len(header)))
    return header, rows


def write_rows(header, rows):
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(header)
    for values in rows:
        writer.writerow(values)
    io.open(path(CSV_FILE), "w", encoding="utf-8", newline="\n").write(out.getvalue())


def run(fill, every):
    known = boroughs()
    header, rows = read_rows()
    at = header.index("borough")
    name_at = header.index("name")
    lat_at = header.index("lat")
    lon_at = header.index("lon")

    wanted = [i for i, values in enumerate(rows)
              if every or not values[at].strip()]

    if not fill:
        blank = [rows[i][name_at] for i in range(len(rows)) if not rows[i][at].strip()]
        wrong = [(values[name_at], values[at]) for values in rows
                 if values[at].strip() and values[at].strip() not in known]
        print("boroughs: %d rows, %d with a borough, %d blank" % (
            len(rows), len(rows) - len(blank), len(blank)))
        for who in blank:
            print("  blank: %s" % who)
        for who, value in wrong:
            print("  not in %s: %s has %r" % (BOROUGHS_FILE, who, value))
        return 1 if blank or wrong else 0

    if not wanted:
        print("boroughs: every row already has one; nothing to ask. "
              "(--all asks again for all %d.)" % len(rows))
        return 0

    print("boroughs: %d row(s) to look up, one request a second - about %d seconds."
          % (len(wanted), int(len(wanted) * SECONDS_BETWEEN) + 1))
    if every:
        print("  --all: every row is being asked again, including ones that "
              "already had an answer. A cell corrected by hand will be overwritten.")

    # Whatever has been answered is written before a failure is
    # raised, not after the whole run succeeds. A refusal on the
    # hundred and fiftieth camera should not throw away a hundred and
    # forty-nine answers and make somebody else's free service give
    # them again; and because this tool skips a row that already has a
    # value, a re-run after the cause is fixed carries on where it
    # stopped rather than starting over.
    counts = {}
    done = 0
    try:
        for n, i in enumerate(wanted, 1):
            values = rows[i]
            who = "%s (%s, %s)" % (values[name_at], values[lat_at], values[lon_at])
            time.sleep(SECONDS_BETWEEN)
            try:
                answer = reverse(values[lat_at], values[lon_at])
            except urllib.error.HTTPError as e:
                raise LookupError_("%s: Nominatim answered %s %s" % (who, e.code, e.reason))
            except urllib.error.URLError as e:
                raise LookupError_("%s: could not reach Nominatim - %s" % (who, e.reason))
            found = borough_of(answer.get("address") or {}, known)
            if found is None:
                raise LookupError_(
                    "%s: Nominatim names no borough in %s.\n"
                    "  it said: %s\n"
                    "  Nothing has been written for this camera. Either the point is "
                    "outside every borough boundary, which is worth knowing, or the "
                    "answer has a shape tools/boroughs.py does not read - in which "
                    "case read it here and teach the tool, rather than typing a "
                    "borough in by hand."
                    % (who, BOROUGHS_FILE, json.dumps(answer.get("address") or answer)))
            was = values[at].strip()
            values[at] = found
            counts[found] = counts.get(found, 0) + 1
            done += 1
            print("  %3d/%d  %-44s %s%s" % (
                n, len(wanted), values[name_at][:44], found,
                "" if not was or was == found else "  (was %s)" % was))
    except LookupError_:
        if done:
            write_rows(header, rows)
            print("boroughs: kept the %d answer(s) already given; a re-run asks only "
                  "for the rest." % done)
        raise

    write_rows(header, rows)
    print("boroughs: wrote %d borough(s) into %s, across %d borough(s)."
          % (len(wanted), CSV_FILE, len(counts)))
    print("  Now: python3 tools/build_points.py, then python3 tools/build_boroughs.py, "
          "then python3 tools/stamp.py.")
    return 0


def main(argv):
    try:
        if argv == []:
            return run(True, False)
        if argv == ["--check"]:
            return run(False, False)
        if argv == ["--all"]:
            return run(True, True)
    except LookupError_ as e:
        print("FAIL: %s" % e)
        return 1
    sys.stderr.write(USAGE + "\n")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
