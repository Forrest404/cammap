#!/usr/bin/env python3
"""Write pages/boroughs/*.html - one page per London borough, and an
index - and the borough block of sitemap.xml, from data/cameras.csv.

    python3 tools/build_boroughs.py            write the pages and the
                                               sitemap block
    python3 tools/build_boroughs.py --check    regenerate in memory,
                                               compare with what is
                                               committed, and exit
                                               non-zero naming the file
                                               and the first differing
                                               line

Run after tools/build_points.py whenever the record changes, and after
anything that changes the template page's head, nav or footer - which
is anything that changes them on every page, since they are copied
here at generation time rather than written out. Then run
tools/stamp.py, which regenerates all of this in memory on every run
and fails if what is committed is not what the record produces. A hand
edit to a borough page cannot survive a commit, and neither can a
record that was changed without these being rebuilt.

Why a generator, on a site with no build step
---------------------------------------------

Thirty-four pages, each carrying the same head, nav, footer and
Content-Security-Policy as the other eleven, each stating counts that
have to be right. Written by hand they would be wrong within a month:
the CSP is already four copies that stamp.py has to police, and a
borough's count would go stale the day a camera was added and say
nothing about it. Written by a generator they are one file to read and
a check that fails when they drift.

This is not the build step this project refuses, for the same reason
tools/build_points.py is not: the browser is served exactly what is
committed, nothing runs for the site to work, and CI only reads. It is
a generator the maintainer runs by hand, and a checker that holds them
to it.

Everything shared comes from a template page
--------------------------------------------

TEMPLATE below is pages/rights.html, and these pages take four things
from it verbatim at the moment they are generated:

  the prologue   everything from <!DOCTYPE> through </header> - so the
                 charset, the viewport, the referrer meta, the whole
                 Content-Security-Policy, the icons, the manifest, the
                 feed link, the stylesheets, and the nav inside the
                 masthead.
  the footer     <footer class="foot"> to </footer>.
  the tail       everything after </footer> - the </div> that closes
                 the sheet, and every <script> tag the site loads.
  the head's     the per-page tags are then replaced: title,
  own tags       description, canonical, og:url, og:title,
                 og:description, twitter:title, twitter:description.
                 Everything else in the head, the share image
                 included, is the template's.

**Nothing about any of that is written out in this file, and it must
stay that way.** A CSP typed here would be a fifth copy that stamp.py
compares and a human wrote; a nav typed here would be a nav that
disagrees with the site the first time a link is added. When a page in
pages/ gains a script tag - the service worker's, say - these pages
gain it by being regenerated, and until they are, stamp.py says so.

The pages sit one directory deeper than the template, so every
relative URL in what is copied is rewritten by deepen(): "../x"
becomes "../../x", and "about.html" becomes "../about.html". Absolute
URLs, fragments and root-relative paths are left alone. stamp.py's nav
and footer checks strip leading "../" runs before comparing, so a page
two levels down compares equal to one at the root - which is the whole
reason those checks normalise, and it is why these pages can be in the
same set as the others without a special case.

What a page says, and where every word of it comes from
------------------------------------------------------

Every number is computed from the record at generation time and none
is typed. The borough's name; how many cameras the record holds there
and of what kinds; how many of the pins are approximate; the sites
themselves, each a link into the map; the busiest spot by recorded
deployments; and which sources the borough's entries rest on. A
borough the record has no camera in still gets a page, and the page
says so plainly rather than not existing - "no camera in the record"
is an answer to "what is in Bexley", and a 404 is not.

A site links to the map at

    ../../index.html#camera=<url-encoded seed key>

which map.js resolves against the published record without needing the
database - readHash() splits on "&", HASH_CAMERA matches the whole
value, and followCameraLink() centres on it and opens its popup,
switching on Legacy or a hidden kind for the visit if the link needs
it. A seed key is name|lat|lon|type, so it is the record's own
identity for that camera and survives everything but a change to those
four fields. A database id would be shorter and would not work with
the database unreachable, which is exactly when somebody is reading a
static page about their borough.

**The share card.** Every page carries the site's own img/share.png,
inherited from the template, and not a card of its own. A per-borough
card would be a per-borough photograph of the map, and the only thing
that makes one is the screenshot harness described in NOTES.md
("Sharing the site") - a real browser driven by hand, which is not a
tool in this repository and cannot become one without the toolchain
this project exists without. So the door is left open rather than
walked through: if a harness is ever committed, this is the file that
would name a per-borough image, and the head substitution below is
where it would go.

Byte-stable output
------------------

The same record and the same template always produce the same bytes:
the boroughs in the order data/boroughs.txt writes them, the sites in
the record's own canonical order, no timestamp anywhere except
GENERATED below, which is typed. That is what lets stamp.py regenerate
all thirty-four pages in memory and compare them with what is
committed, exactly as it does for points.js, seed.sql and the GeoJSON.

Standard library only, like every other tool here, and it reads the
record through tools/build_points.py rather than parsing the CSV
again - one parser, one set of rules about what a row may say.
"""
import io
import os
import re
import sys

# Before the import below, and it has to be before it: importing a
# module writes a .pyc beside it, and tools/ is a directory somebody
# reads. stamp.py sets the same flag for the same reason before it
# imports this file's neighbour; running this script directly has to
# set it for itself, or the first run leaves a __pycache__ in the tree
# and the second commits it.
sys.dont_write_bytecode = True

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import build_points

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The page whose head, nav and footer every borough page copies. Any
# of the site's pages would do; this one is named because it is the
# one a new page is told to copy, so there is one answer to "which
# page is the pattern" rather than two.
TEMPLATE = "pages/rights.html"

BOROUGHS_FILE = "data/boroughs.txt"
OUT_DIR = "pages/boroughs"
SITEMAP = "sitemap.xml"

# The site's own address, as sitemap.xml and every page's canonical
# link already write it. NOTES.md ("Sharing the site") lists every
# file that carries it; this is one of them, and a custom domain
# changes them all in the same commit.
SITE = "https://forrest404.github.io/cammap/"

# The day the record these pages were generated from was last looked
# at. It is the sitemap's lastmod for all thirty-four and the date each
# page states, so a reader can tell a current page from an abandoned
# one - the same job RECORD_SOURCES does under the map.
#
# Typed, and deliberately not read from git. The generated check in
# stamp.py regenerates these pages in memory and compares them byte for
# byte, so the generator has to produce the same bytes on a shallow
# clone, in a tarball with no .git at all, and on a CI runner - and
# "the last commit that touched data/cameras.csv" is none of those
# things reliably. Update it when the pages are regenerated, the way
# RECORD_SOURCES in frontend/shared.js is updated when the record is
# refreshed.
GENERATED = "2026-09-10"

# Where the borough block sits in the hand-written sitemap. Everything
# between these two lines is this script's; everything outside them is
# the maintainer's and is never touched.
SITEMAP_OPEN = "  <!-- The borough pages. Everything between this line and the one that"
SITEMAP_SHUT = "  <!-- end of the generated borough pages -->"

USAGE = "usage: python3 tools/build_boroughs.py [--check]"


class BuildError(Exception):
    """Something in the record or the template this script will not
    write around."""


def path(rel):
    return os.path.join(ROOT, rel)


def read(rel):
    return io.open(path(rel), encoding="utf-8").read()


def read_boroughs():
    """The thirty-three, in the order data/boroughs.txt writes them -
    which is the order the pages are generated and the index lists
    them in."""
    out = []
    for line in read(BOROUGHS_FILE).split("\n"):
        line = line.strip()
        if line and not line.startswith("#"):
            out.append(line)
    if not out:
        raise BuildError("%s has no boroughs in it" % BOROUGHS_FILE)
    return out


def slug_of(name):
    """A borough page's address, from its name: lowered, every run of
    non-alphanumerics made one hyphen, no hyphen at either end.
    "Kensington and Chelsea" is kensington-and-chelsea; "City of
    London" is city-of-london. The twin of boroughSlug() in
    tools/check.js - change one, change the other.

    It is computed and never stored, so there is no second thing to
    keep in step; but once a page is published its address must not
    change, because it is in the sitemap and in whatever anyone has
    linked."""
    return re.sub(r"-+$", "", re.sub(r"^-+", "", re.sub(r"[^a-z0-9]+", "-", name.lower())))


# ---- text, safely ----

def escape(s):
    """For anything of the record's that lands in an element's text or
    an attribute. The record is the maintainer's own file and holds no
    markup today, but a note is free prose and a page that trusted it
    would be one apostrophe away from broken - or worse, from carrying
    whatever a moderator's correction put there."""
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
             .replace('"', "&quot;"))


def url_escape(s):
    """A seed key in a fragment. Everything but the unreserved set is
    percent-encoded, which is what encodeURIComponent does and what
    map.js's decodeURIComponent undoes."""
    keep = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()"
    out = []
    for ch in s:
        if ch in keep:
            out.append(ch)
        else:
            for byte in ch.encode("utf-8"):
                out.append("%%%02X" % byte)
    return "".join(out)


def plural(n, one, many=None):
    return one if n == 1 else (many if many is not None else one + "s")


def in_prose(name):
    """A borough's name as it goes into a sentence after a
    preposition. Thirty-two of the thirty-three are bare - "in
    Croydon", "in Kingston upon Thames" - and one takes an article,
    because English says "in the City of London" and never "in City of
    London". That is a fact about the name and not about cammap, which
    is why it is a rule about the words "City of" rather than an entry
    in a table of thirty-three; a second city whose areas are named
    that way gets it for nothing, and one whose areas are not is
    unaffected.

    The heading, the page title and the card keep the bare name: a
    heading is a label, not a sentence."""
    return "the " + name if name.startswith("City of ") else name


# ---- what the record says about a borough ----

def period_line(row):
    """How the record dates a camera's use, in its own words and never
    in words of ours: "3 deployments 2023-2025", or "1 in 2023-24, 3 in
    2025" where a site has counts from more than one record. None where
    the record names no period, which is every shop, both fixed
    installs and the King's Cross estate - and the page then says
    nothing about years rather than something vague."""
    periods = row["periods"]
    if not periods:
        return None
    items = list(periods.items())
    if len(items) == 1:
        key, count = items[0]
        return "%d %s %s" % (count, plural(count, "deployment"), key)
    return ", ".join("%d in %s" % (count, key) for key, count in items)


def kinds_list(rows, types):
    """How many of each kind, in CAMERA_TYPES order, using the legend's
    own labels.

    A count and a label, as a list, rather than a sentence - and that
    is a decision worth writing down, because a sentence was tried
    first and could not be made honest. A sentence needs a plural, and
    a plural of these labels cannot be derived: "LFR van site" takes an
    s, "Transport police" does not, "Shop (Facewatch)" takes its s in
    the middle, and "Private" takes one only if it is short for
    something. A table of plurals here would be a second copy of the
    legend's words, and adding a kind of camera would stop being the
    two edits it should be - shared.js and schema.sql - and
    become three, with the third silently producing "9 transport
    polices" until somebody read it.

    So the label is printed exactly as CAMERA_TYPES writes it, with the
    count in front, which is how a key reads and how a key is expected
    to read. A kind added tomorrow lands here correctly with no edit at
    all."""
    out = []
    for kind, label in types:
        n = sum(1 for r in rows if r["type"] == kind)
        if n:
            out.append((n, label))
    return out


def read_types():
    """(identifier, label) for every kind of camera, from CAMERA_TYPES
    in frontend/shared.js - the one list, read rather than copied, the
    same way build_points.py reads it."""
    shared = read("frontend/shared.js")
    m = re.search(r'var CAMERA_TYPES\s*=\s*\[(.*?)\];', shared, re.S)
    if not m:
        raise BuildError("CAMERA_TYPES not found in frontend/shared.js")
    found = re.findall(r'\btype:\s*"([^"]+)"[^}]*?\blabel:\s*"([^"]+)"', m.group(1))
    if not found:
        raise BuildError("CAMERA_TYPES in frontend/shared.js has no type/label pairs")
    return found


# ---- the template ----

def deepen(fragment):
    """Every relative URL in a copied fragment, moved one directory
    down. The template sits in pages/; these pages sit in
    pages/boroughs/, so "../index.html" becomes "../../index.html" and
    "about.html" becomes "../about.html". An absolute URL, a fragment,
    a root-relative path and a data: URI are all left exactly as they
    are.

    stamp.py's nav and footer checks strip leading "../" runs and a
    "pages/" prefix before comparing, so both forms normalise to the
    same thing and a page two levels down passes the same check as one
    at the root."""
    def one(m):
        attr, url = m.group(1), m.group(2)
        if re.match(r'^(?:[a-z][a-z0-9+.-]*:|//|/|#)', url):
            return m.group(0)
        return '%s="%s"' % (attr, "../" + url)

    return re.sub(r'\b(src|href)="([^"]*)"', one, fragment)


def cut(text, start, end, what):
    a = text.find(start)
    if a < 0:
        raise BuildError("%s: no %s (looking for %r)" % (TEMPLATE, what, start))
    b = text.find(end, a)
    if b < 0:
        raise BuildError("%s: no end of %s (looking for %r)" % (TEMPLATE, what, end))
    return text[a:b + len(end)]


# Head tags that say what *this* page is, and are therefore the ones
# replaced. Everything else in the template's head - the policy, the
# icons, the feed, the share image and its alt text - is the site's and
# is copied untouched. Each entry is (pattern, replacement template),
# and every one must match exactly once or the substitution is a
# failure rather than a page quietly carrying the rights page's title.
HEAD_TAGS = [
    (re.compile(r'<title>.*?</title>', re.S),
     "<title>{title}</title>"),
    (re.compile(r'<meta name="description" content="[^"]*">'),
     '<meta name="description" content="{description}">'),
    (re.compile(r'<link rel="canonical" href="[^"]*">'),
     '<link rel="canonical" href="{url}">'),
    (re.compile(r'<meta property="og:url" content="[^"]*">'),
     '<meta property="og:url" content="{url}">'),
    (re.compile(r'<meta property="og:title" content="[^"]*">'),
     '<meta property="og:title" content="{title}">'),
    (re.compile(r'<meta property="og:description" content="[^"]*">'),
     '<meta property="og:description" content="{description}">'),
    (re.compile(r'<meta name="twitter:title" content="[^"]*">'),
     '<meta name="twitter:title" content="{title}">'),
    (re.compile(r'<meta name="twitter:description" content="[^"]*">'),
     '<meta name="twitter:description" content="{description}">'),
]


def template_parts():
    """The prologue, the footer and the tail, already moved one
    directory down. Read fresh on every run, so a change to the site's
    head, nav or footer reaches these pages by regenerating them and
    by nothing else."""
    text = read(TEMPLATE)
    prologue = cut(text, "<!DOCTYPE html>", "</header>", "prologue")
    # class="current" marks which nav link is the page you are on, and
    # on the template that is Rights. Copied as it stands, every
    # borough page would light Rights in the accent and tell a visitor
    # they were somewhere they are not. stamp.py's nav check strips the
    # attribute before comparing - it legitimately differs by page - so
    # this would have passed every check and been wrong on thirty-four
    # pages. None of these pages is in the nav, so none of them carries
    # it; the nav is otherwise identical, which is what the check is
    # for.
    prologue = re.sub(r'\s+class="current"', "", prologue, count=1)
    footer = cut(text, '<footer class="foot">', "</footer>", "footer")
    at = text.find("</footer>")
    end = text.find("</body>", at)
    if end < 0:
        raise BuildError("%s: no </body> after the footer" % TEMPLATE)
    tail = text[at + len("</footer>"):end + len("</body>")]
    return deepen(prologue), deepen(footer), deepen(tail)


def head_for(prologue, title, description, url):
    """The template's prologue with this page's own title, description,
    canonical link and card text in it."""
    out = prologue
    values = {"title": escape(title), "description": escape(description), "url": escape(url)}
    for pattern, replacement in HEAD_TAGS:
        out, n = pattern.subn(replacement.format(**values).replace("\\", "\\\\"), out, count=1)
        if n != 1:
            raise BuildError("%s: expected exactly one %s in the head, found %d"
                             % (TEMPLATE, pattern.pattern, n))
    return out


# ---- a borough's page ----

def site_item(row):
    """One camera, as a list item: its name linked into the map, then
    what the record says about it on a line of its own. Nothing here is
    worked out - the kind, the state, the period and the approximate
    flag are all fields, and a camera the record dates no use for says
    nothing about years rather than something vague."""
    key = build_points.seed_key(row)
    link = "../../index.html#camera=" + url_escape(key)
    detail = [escape(row["label"])]
    if row["status"] == "legacy":
        detail.append("legacy")
    line = period_line(row)
    if line:
        detail.append("the record shows " + escape(line))
    if row["approximate"]:
        detail.append("approximate position")
    return ("      <li>\n"
            "        <a href=\"%s\">%s</a>\n"
            "        <span class=\"detail\">%s</span>\n"
            "      </li>" % (escape(link), escape(row["name"]), " &middot; ".join(detail)))


def busiest(rows):
    """The spot the record has used most often here, and the sentence
    for it - or None where nothing in the borough carries more than one
    recorded use, in which case there is no "busiest" to name and the
    page says nothing. Ties are named together: two spots with the same
    count are two answers and picking one would be this page
    deciding."""
    if not rows:
        return None
    most = max(r["deployments"] for r in rows)
    if most < 2:
        return None
    top = [r for r in rows if r["deployments"] == most]
    names = [escape(r["name"]) for r in top]
    if len(names) == 1:
        who = names[0]
    elif len(names) == 2:
        who = names[0] + " and " + names[1]
    else:
        who = ", ".join(names[:-1]) + " and " + names[-1]
    line = period_line(top[0])
    same = all(period_line(r) == line for r in top)
    if len(names) == 1:
        opening = "The spot the record has used most often here is %s" % who
    else:
        opening = ("Two spots are used equally often, more than any other here"
                   if len(names) == 2 else
                   "%d spots are used equally often, more than any other here" % len(names))
        opening += ": %s" % who
    if same and line:
        return "%s - the record shows %s." % (opening, escape(line))
    return "%s - %d %s each." % (opening, most, plural(most, "deployment"))


def sources_of(rows):
    """The documents this borough's entries rest on, each once, in the
    order the record first names them. Labels only: the link is on the
    camera's own popup, and a page of bare
    citations repeated eleven times would be a bibliography rather than
    a paragraph."""
    out = []
    for row in rows:
        label = row["source_label"]
        if label and label not in out:
            out.append(label)
    return out


def borough_page(name, rows, types, parts):
    """One borough's page, whole."""
    prologue, footer, tail = parts
    slug = slug_of(name)
    url = SITE + OUT_DIR + "/" + slug + ".html"
    n = len(rows)

    if n:
        description = ("%d recorded facial recognition %s in %s: where each one is, "
                       "what kind it is, and which published record it comes from."
                       % (n, plural(n, "camera"), in_prose(name)))
    else:
        description = ("The record holds no facial recognition camera in %s. What is "
                       "recorded elsewhere in London, and where every figure comes from."
                       % in_prose(name))

    body = []
    body.append("<main>")
    body.append('  <div class="prose borough">')
    body.append("")
    body.append("    <h2>%s</h2>" % escape(name))
    body.append("")

    if n:
        approximate = sum(1 for r in rows if r["approximate"])
        body.append("    <p>")
        body.append("      The record holds %d %s in %s."
                    % (n, plural(n, "camera"), escape(in_prose(name))))
        if approximate == n:
            body.append("      Every one of the pins marks the surrounding area rather than")
            body.append("      an exact spot, because that is all the source gave.")
        elif approximate == 1:
            body.append("      One of the pins marks the surrounding area rather than an")
            body.append("      exact spot, because that is all the source gave.")
        elif approximate:
            body.append("      %d of the pins mark the surrounding area rather than an exact"
                        % approximate)
            body.append("      spot, because that is all the source gave.")
        body.append("    </p>")
        body.append("")
        body.append('    <ul class="kinds">')
        for count, label in kinds_list(rows, types):
            body.append('      <li><span class="n">%d</span> %s</li>' % (count, escape(label)))
        body.append("    </ul>")
        body.append("")
        body.append("    <h3>Where they are</h3>")
        body.append("")
        body.append("    <p>")
        body.append("      Each opens on the map, at the camera, with what the record says")
        body.append("      about it.")
        body.append("    </p>")
        body.append("")
        body.append('    <ul class="sites">')
        for row in rows:
            body.append(site_item(row))
        body.append("    </ul>")
        body.append("")

        line = busiest(rows)
        if line:
            body.append("    <h3>The busiest spot</h3>")
            body.append("")
            body.append("    <p>%s</p>" % line)
            body.append("")

        sources = sources_of(rows)
        if sources:
            body.append("    <h3>Where this comes from</h3>")
            body.append("")
            body.append("    <p>")
            body.append("      %s in %s %s on:" % (
                "The camera" if n == 1 else "The cameras", escape(in_prose(name)),
                "rests" if n == 1 else "rest"))
            body.append("    </p>")
            body.append('    <ul class="sources">')
            for label in sources:
                body.append("      <li>%s</li>" % escape(label))
            body.append("    </ul>")
            body.append("")
            body.append("    <p>")
            body.append("      Each camera's own entry links to the document it comes from;")
            body.append("      open it on <a href=\"../../index.html\">the map</a> to follow it.")
            body.append("    </p>")
            body.append("")
    else:
        body.append("    <p>")
        body.append("      The record holds no facial recognition camera in %s."
                    % escape(in_prose(name)))
        body.append("      That is not the same as there being none: this map holds what")
        body.append("      published records say, and the sources it draws on - the")
        body.append("      Metropolitan Police's deployment records, the British Transport")
        body.append("      Police's register, named reporting for the shops - name no site")
        body.append("      here. A shop running facial recognition discloses it on a sign")
        body.append("      on its door and nowhere else, so a borough with none in the")
        body.append("      record may simply be one nobody has written about.")
        body.append("    </p>")
        body.append("")
        body.append("    <p>")
        body.append("      If you know of one, <a href=\"../report.html\">report it</a>.")
        body.append("    </p>")
        body.append("")

    body.append("    <h3>The whole record</h3>")
    body.append("")
    body.append("    <p>")
    body.append("      This page was written from the record as it stood on")
    body.append("      <time datetime=\"%s\">%s</time>. Every figure on it is counted from"
                % (GENERATED, GENERATED))
    body.append("      that record rather than typed, and the page is generated - so it")
    body.append("      cannot say one thing while the map says another.")
    body.append("      <a href=\"../../index.html\">The map</a> shows every borough at once;")
    body.append("      <a href=\"index.html\">the other boroughs</a> each have a page like")
    body.append("      this one; and <a href=\"../data.html\">the data page</a> says what the")
    body.append("      record holds, how to take it away, and on what terms.")
    body.append("    </p>")
    body.append("")
    body.append("  </div>")
    body.append("</main>")

    title = "%s &mdash; cammap" % escape(name)
    card_title = "%s — cammap" % name
    head = head_for(prologue, card_title, description, url)
    # The <title> element takes the entity, the card tags take the
    # character: the same choice pages/rights.html makes, and the
    # reason its title and its og:title are not the same string.
    head = head.replace("<title>%s</title>" % escape(card_title), "<title>%s</title>" % title)

    return "\n".join([
        head,
        "",
        GENERATED_BY % (name, TEMPLATE),
        "",
        "\n".join(body),
        "",
        footer,
        tail,
        "</html>",
        "",
    ])


GENERATED_BY = """\
<!-- ================================================================
     %s - one of the thirty-three borough pages.

     GENERATED. Written by tools/build_boroughs.py from
     data/cameras.csv, and never edited by hand: tools/stamp.py
     regenerates all thirty-four in memory on every run and fails,
     naming the file and the first differing line, if what is
     committed is not what the record produces. To change what this
     page says, change the record or change the generator.

     The head, the nav, the footer and every script tag on it were
     copied from %s at the moment it was generated, with the
     relative paths moved one directory down - so this page carries
     the same Content-Security-Policy and the same nav as the rest of
     the site by construction rather than by anyone remembering. When
     those change on the other pages, regenerate these.

     Every number here is counted from the record. None is typed.
     ================================================================ -->"""


# ---- the index ----

def index_page(boroughs, by_borough, parts):
    prologue, footer, tail = parts
    url = SITE + OUT_DIR + "/index.html"
    total = sum(len(by_borough[b]) for b in boroughs)
    with_any = sum(1 for b in boroughs if by_borough[b])

    description = ("Every London borough, and how many recorded facial recognition "
                   "cameras the record holds in each.")

    body = []
    body.append("<main>")
    body.append('  <div class="prose borough">')
    body.append("")
    body.append("    <h2>By borough</h2>")
    body.append("")
    body.append("    <p>")
    body.append("      London's thirty-three - the thirty-two boroughs and the City of")
    body.append("      London - and what the record holds in each. The counts are")
    body.append("      counted from the record as it stood on")
    body.append("      <time datetime=\"%s\">%s</time>, not typed, and every page below is"
                % (GENERATED, GENERATED))
    body.append("      generated from the same file <a href=\"../../index.html\">the map</a>")
    body.append("      draws from.")
    body.append("    </p>")
    body.append("")
    body.append('    <ul class="borough-list">')
    for name in boroughs:
        rows = by_borough[name]
        n = len(rows)
        body.append("      <li>")
        body.append("        <a href=\"%s.html\">%s</a>" % (slug_of(name), escape(name)))
        body.append("        <span class=\"count\">%s</span>" % (
            "none in the record" if not n else "%d %s" % (n, plural(n, "camera"))))
        body.append("      </li>")
    body.append("    </ul>")
    body.append("")
    body.append("    <p>")
    body.append("      %d %s in all, across %d of the thirty-three."
                % (total, plural(total, "camera"), with_any))
    body.append("      A borough with none in the record is not a borough with none in it:")
    body.append("      the map holds what published records say, and")
    body.append("      <a href=\"../about.html\">About</a> says what that does and does not")
    body.append("      claim. <a href=\"../data.html\">The data page</a> says what the record")
    body.append("      holds and how to take it away.")
    body.append("    </p>")
    body.append("")
    body.append("  </div>")
    body.append("</main>")

    title = "By borough &mdash; cammap"
    card_title = "By borough — cammap"
    head = head_for(prologue, card_title, description, url)
    head = head.replace("<title>%s</title>" % escape(card_title), "<title>%s</title>" % title)

    return "\n".join([
        head,
        "",
        INDEX_GENERATED_BY % TEMPLATE,
        "",
        "\n".join(body),
        "",
        footer,
        tail,
        "</html>",
        "",
    ])


INDEX_GENERATED_BY = """\
<!-- ================================================================
     By borough - the index to the thirty-three borough pages.

     GENERATED. Written by tools/build_boroughs.py from
     data/cameras.csv along with the pages it lists, and never edited
     by hand; tools/stamp.py fails if it is not what the record
     produces. The head, nav, footer and scripts were copied from %s
     when it was generated.

     Not in the nav: the nav has four static links and already wraps
     on a phone. This page is reached from every borough page, from
     the sitemap, and from wherever the site next chooses to link it.
     ================================================================ -->"""


# ---- the sitemap's borough block ----

def sitemap_block(boroughs):
    lines = [SITEMAP_OPEN]
    lines.append("       closes it is written by tools/build_boroughs.py from")
    lines.append("       data/boroughs.txt and data/cameras.csv, and is checked by")
    lines.append("       tools/stamp.py like the pages themselves. Everything outside")
    lines.append("       the two lines is hand-written and is never touched. lastmod is")
    lines.append("       the day the record these pages were generated from was last")
    lines.append("       looked at, which is one constant in that script. -->")
    lines.append("  <url>")
    lines.append("    <loc>%s%s/index.html</loc>" % (SITE, OUT_DIR))
    lines.append("    <lastmod>%s</lastmod>" % GENERATED)
    lines.append("  </url>")
    for name in boroughs:
        lines.append("  <url>")
        lines.append("    <loc>%s%s/%s.html</loc>" % (SITE, OUT_DIR, slug_of(name)))
        lines.append("    <lastmod>%s</lastmod>" % GENERATED)
        lines.append("  </url>")
    lines.append(SITEMAP_SHUT)
    return "\n".join(lines)


def sitemap_with(block):
    """The committed sitemap with its borough block replaced. The rest
    of the file - which is hand-written, six addresses that do not need
    generating - is returned exactly as it is."""
    text = read(SITEMAP)
    a = text.find(SITEMAP_OPEN)
    if a < 0:
        # first run: the block goes in before the closing tag
        shut = text.rfind("</urlset>")
        if shut < 0:
            raise BuildError("%s: no </urlset>" % SITEMAP)
        return text[:shut] + block + "\n" + text[shut:]
    b = text.find(SITEMAP_SHUT, a)
    if b < 0:
        raise BuildError("%s: the borough block opens and never closes (looking for %r)"
                         % (SITEMAP, SITEMAP_SHUT))
    return text[:a] + block + text[b + len(SITEMAP_SHUT):]


# ---- the three modes ----

def regenerate():
    """Every file this script writes, as strings, without touching the
    disk. stamp.py calls this."""
    rows = build_points.read_csv()
    types = read_types()
    labels = dict(types)
    boroughs = read_boroughs()

    by_borough = dict((name, []) for name in boroughs)
    for row in rows:
        if row["borough"] is None:
            raise BuildError(
                "%s has no borough - run python3 tools/boroughs.py before building the "
                "borough pages, or a page's count is wrong and says nothing about it"
                % row["name"])
        if row["borough"] not in by_borough:
            raise BuildError("%s: borough %r is not one of the thirty-three in %s"
                             % (row["name"], row["borough"], BOROUGHS_FILE))
        row = dict(row)
        row["label"] = labels.get(row["type"], row["type"])
        by_borough[row["borough"]].append(row)

    parts = template_parts()
    out = {}
    for name in boroughs:
        out["%s/%s.html" % (OUT_DIR, slug_of(name))] = borough_page(
            name, by_borough[name], types, parts)
    out["%s/index.html" % OUT_DIR] = index_page(boroughs, by_borough, parts)
    out[SITEMAP] = sitemap_with(sitemap_block(boroughs))
    return out, len(boroughs), len(rows)


def build():
    outputs, pages, cameras = regenerate()
    directory = path(OUT_DIR)
    if not os.path.isdir(directory):
        os.makedirs(directory)
    for rel, text in sorted(outputs.items()):
        io.open(path(rel), "w", encoding="utf-8", newline="\n").write(text)
    print("build_boroughs: wrote %d borough pages, an index and the %s block, "
          "from %d cameras" % (pages, SITEMAP, cameras))


def check():
    outputs, pages, cameras = regenerate()
    bad = False
    for rel, text in sorted(outputs.items()):
        try:
            committed = read(rel)
        except IOError:
            print("FAIL: %s is missing - run python3 tools/build_boroughs.py" % rel)
            bad = True
            continue
        diff = build_points.first_difference(text, committed)
        if diff:
            bad = True
            line, ours, theirs = diff
            print("FAIL: %s is not what the record and %s produce - first difference at "
                  "line %d" % (rel, TEMPLATE, line))
            print("  generated: %s" % ("<end of file>" if ours is None else ours.rstrip()))
            print("  committed: %s" % ("<end of file>" if theirs is None else theirs.rstrip()))
            print("  Never edit a borough page by hand; run python3 tools/build_boroughs.py.")
    if bad:
        return 1
    print("build_boroughs: %d borough pages, an index and the %s block match the record, "
          "%d cameras" % (pages, SITEMAP, cameras))
    return 0


def main(argv):
    try:
        if argv == []:
            build()
            return 0
        if argv == ["--check"]:
            return check()
    except (BuildError, build_points.BuildError) as e:
        print("FAIL: %s" % e)
        return 1
    sys.stderr.write(USAGE + "\n")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
