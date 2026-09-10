# The source survey

A survey of live facial recognition in London, made on 6 September 2026, which
is where most of the record's `source_url` values come from and what
`pages/rights.html` cites for the legal position.

- `results/` — one file per topic (the Met's fixed installs, its van
  deployments, British Transport Police, Facewatch, the transport network, the
  regulatory position, and so on). Each holds the operator, the sites, the
  status, and the sources those came from.
- `master_cameras.csv` / `master_cameras.json` — the 44 unique sites the topic
  files between them named, deduplicated.

**This is not the record.** `data/cameras.csv` is, and the two are deliberately
not kept in step: the survey found things the map does not carry (casinos,
a tenth BTP station) and disagrees with the record in a few places. NOTES.md
"Open decisions", item 8 says what was taken from it and what was not, and
item 18 covers the one borough the two disagree about.

Nothing builds from this folder. It is kept so that a claim on the site can be
traced back to what was read, and so it is obvious when a citation has gone
stale.
