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
"""
import glob, hashlib, io, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

OWN = ["frontend/shared.js", "frontend/map.js", "frontend/account.js",
       "frontend/style.css", "data/points.js", "supabase-config.js"]

h = hashlib.sha256()
for f in OWN:
    h.update(io.open(f, "rb").read())
stamp = h.hexdigest()[:8]

names = "|".join(re.escape(os.path.basename(f)) for f in OWN)
pat = re.compile(r'(src|href)="([^"]*?(?:' + names + r'))(\?v=[0-9a-f]+)?"')

changed = 0
for page in ["index.html"] + sorted(glob.glob("pages/*.html")):
    s = io.open(page, encoding="utf-8").read()
    t = pat.sub(lambda m: '%s="%s?v=%s"' % (m.group(1), m.group(2), stamp), s)
    if t != s:
        io.open(page, "w", encoding="utf-8").write(t)
        changed += 1
print("stamp %s: %d page(s) updated" % (stamp, changed))
