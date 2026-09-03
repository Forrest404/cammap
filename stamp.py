#!/usr/bin/env python3
"""Stamp the site's own script and stylesheet tags with a version.

GitHub Pages serves files with cache-control: max-age=600, so after a
deploy a returning visitor can get new HTML with a ten-minute-old
account.js beside it - a page whose buttons do nothing. A ?v= query on
each tag makes the browser fetch afresh whenever the file changed.

The stamp is the first eight hex digits of a hash over the files
themselves, so it changes exactly when they do and not otherwise. Run
this before committing; it rewrites the .html files in place and
prints what it did. Vendored lib/ and fonts/ are not stamped - they
are pinned by their own version numbers.
"""
import glob, hashlib, io, re

OWN = ["points.js", "supabase-config.js", "account.js", "map.js", "style.css"]

h = hashlib.sha256()
for f in OWN:
    h.update(io.open(f, "rb").read())
stamp = h.hexdigest()[:8]

pat = re.compile(r'(src|href)="(' + "|".join(re.escape(f) for f in OWN) + r')(\?v=[0-9a-f]+)?"')
changed = 0
for page in sorted(glob.glob("*.html")):
    s = io.open(page, encoding="utf-8").read()
    t = pat.sub(lambda m: '%s="%s?v=%s"' % (m.group(1), m.group(2), stamp), s)
    if t != s:
        io.open(page, "w", encoding="utf-8").write(t)
        changed += 1
print("stamp %s: %d page(s) updated" % (stamp, changed))
