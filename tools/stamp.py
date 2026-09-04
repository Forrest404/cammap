#!/usr/bin/env python3
"""Stamp the site's own script and stylesheet tags with a version.

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

It also checks one thing it cannot fix. Every page carries the same
Content-Security-Policy, and with no build step there is nothing to
generate it from - seven copies, kept in step by hand. A policy that
drifts on one page is close to invisible: that page simply stops
being protected, or quietly breaks, and nobody looks. So the policies
are compared here and a difference is reported loudly. Run before
every commit and a drift cannot survive one.
"""
import glob, hashlib, io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

PAGES = ["index.html"] + sorted(glob.glob("pages/*.html"))

OWN = ["frontend/shared.js", "frontend/map.js", "frontend/account.js",
       "frontend/picker.js", "frontend/style.css", "data/points.js",
       "supabase-config.js"]

h = hashlib.sha256()
for f in OWN:
    h.update(io.open(f, "rb").read())
stamp = h.hexdigest()[:8]

names = "|".join(re.escape(os.path.basename(f)) for f in OWN)
pat = re.compile(r'(src|href)="([^"]*?(?:' + names + r'))(\?v=[0-9a-f]+)?"')

changed = 0
for page in PAGES:
    s = io.open(page, encoding="utf-8").read()
    t = pat.sub(lambda m: '%s="%s?v=%s"' % (m.group(1), m.group(2), stamp), s)
    if t != s:
        io.open(page, "w", encoding="utf-8").write(t)
        changed += 1
print("stamp %s: %d page(s) updated" % (stamp, changed))

# ---- the seven copies of the policy have to stay one policy ----

CSP = re.compile(r'<meta http-equiv="Content-Security-Policy" content="(.*?)">', re.S)

policies = {}
for page in PAGES:
    found = CSP.search(io.open(page, encoding="utf-8").read())
    # whitespace is only formatting inside a CSP, so compare on the directives
    policies[page] = " ".join(found.group(1).split()) if found else None

missing = [p for p, v in policies.items() if v is None]
distinct = set(v for v in policies.values() if v is not None)

if missing:
    print("CSP MISSING on: %s" % ", ".join(missing))
if len(distinct) > 1:
    print("CSP DRIFT: %d different policies across %d pages -" % (len(distinct), len(PAGES)))
    for policy in sorted(distinct):
        who = sorted(p for p, v in policies.items() if v == policy)
        print("  %s\n    %s" % (", ".join(who), policy[:110] + "..."))

if missing or len(distinct) > 1:
    print("Make them identical again before committing.")
    sys.exit(1)

print("csp: one policy across %d pages" % len(PAGES))
