# Questions for the maintainer

Decisions the programme cannot make for you. Each has a recommended default; where an item
could not wait, it has proceeded on that default and the ledger (`BUILD-LOG.md`) marks it so
it can be revisited. Answer by editing this file or by telling the orchestrator.

## Open

*(none at present)*

## Answered

**All eight below: defaults accepted by the maintainer, 2026-09-06**, at the Wave 0 gate.
Each item proceeds on its recommended default. Kept in full so the reasoning is still here
when one of them is revisited.

### 1. Video proof keeps its metadata (REP-5)
The report form accepts MP4/WebM and sends them untouched; the hint tells the reporter to
"check what yours contains". On a site whose promise is anonymity, and where the person
filming a van is the person who can least afford to leak a location, that is not enough.
**Options:** (a) refuse video outright; (b) keep video, with a loud interstitial at the moment
of choosing the file that names what a video can carry (GPS track, device serial, timestamps)
and requires a tick.
**Recommended default: (a) refuse video.** Plain JavaScript cannot strip container metadata
reliably without a library the CSP will not load, and a warning is a promise the reporter has
to keep for us. The `proof` bucket's MIME allow-list and `report_proof.mime` check would be
narrowed in a migration. *Proceeding on (a) in Wave 4 unless told otherwise.*

### 2. The real monthly hosting cost (WORD-5)
The footer says donations pay for the hosting and names no figure. GitHub Pages is free; the
Supabase project is presumably on the free tier; the `cammap.app` domain (used for the hidden
login address) costs something a year if it is registered. **What does this actually cost per
month?** Until answered the footer carries a clearly marked `TODO` rather than a number.

### 3. Licences for the code and the data (REACH-7)
Nothing in the repository says how either may be reused.
**Recommended default:** code under the **MIT** licence; data (`points.js`, `seed.sql`, the
CSV and GeoJSON downloads) under **ODbL 1.0**, which is what OpenStreetMap uses and what a
dataset assembled from public records sits most comfortably under. CC BY-SA 4.0 is the
alternative if you would rather the data be citable like a document than queried like a
database. *Proceeding on MIT + ODbL in Wave 1; a `LICENSE` file and footer line will say so,
and both are one edit to change.*

### 4. Who runs this, for the About page (WORD-1)
The brief wants About to say who runs the site and how it is funded. `NOTES.md` names two
handles, Forrest404 and Laki2128, in what reads as a working-notes section. **Do you want
handles on the public About page, a collective name, or "run by volunteers" with no names?**
*Recommended default: "run by volunteers, funded by donations, no organisation behind it" and
no handles, on the principle the site applies to everyone else.* Proceeding on that.

### 5. Per-period deployments, not per-year (DATA-3, MAP-4)
The brief's example column is `{"2023":1,"2024":3,"2025":4}`. The repository holds no
per-calendar-year counts: the record's own vocabulary is `2023-24`, `2025`, `2023-2025`,
`2020-2025`, `2020-24`, `2020-22` and "the 2026 station trial". Splitting "3 deployments
2023-2025" into years would be estimating, which the project forbids.
**Decision taken:** the column stores counts keyed by the period exactly as the source gives
it (`{"2023-24": 1, "2025": 3}`), the check constraint validates keys against
`^\d{4}(-\d{2}|-\d{4})?$` and positive integer values, the old total is the sum, and the
time slider shows a site in any year its recorded period covers. The Met's deployment-record
PDFs would allow a finer split later; that is a data-collection task, not a programme one.
**Tell the orchestrator if you disagree before Wave 1 merges.**

### 6. The leaderboard opt-out is enforced in the view, not in RLS (ACCT-4)
The brief says "enforced by RLS, not by the query". The three leaderboards are materialized
views refreshed by `pg_cron`; PostgreSQL does not apply row-level security to materialized
views. The equivalent that meets the intent — server-side, not in the client's query — is a
`profiles.show_on_leaderboard` column read by the view definitions, so an opted-out account
never enters the table the page reads. *Proceeding on that in Wave 3.*

### 7. Canonical site URL
GitHub's API reports the site at `https://forrest404.github.io/cammap/` with no custom
domain. The sitemap, Open Graph tags, manifest and feed will use that. **If a custom domain
is planned, say so now** — every one of those files carries the absolute URL.

### 8. The research survey in `london-lfr-cameras/`
Committed with `8bfad60` and not mentioned in the brief. It carries a `source_url` for every
one of its 43 sites, which is exactly what DATA-1 needs for the fixed and shop cameras, and
it disagrees with the record in places (10 BTP stations to the record's 9; casinos the map
does not carry; East Dulwich paused). **Two questions:** may DATA-1 take its `source_url`
values for the sites the two lists agree on? And is refreshing the record from it (adding the
tenth station, the casinos) something you want, as a separate data task outside the 58 items?
*Proceeding on: yes to the first, for agreed sites only; no to the second without a word from you.*
