# cammap — implementation brief

**Commit this file to the repository at `.claude/PROMPT-BRIEF.md`.** Every phase prompt
begins by telling Claude to read it, so it is the one place the shared context lives.
Phase prompts stay short because this file carries the weight.

---

## 1. What you are doing

cammap maps live facial recognition (LFR) cameras in London. A September 2026 review of the
repository at commit `c17c544` produced 58 changes across eight areas. This brief plus the
accompanying phase prompts implement all of them, in ten phases.

The review's own summary of the situation, which is the thing to keep in mind while working:

> The engineering here is unusually disciplined — no build step, no CDN, a
> Content-Security-Policy that enforces it, and comments that explain why. The gaps are
> almost all in the other direction: **the site is a campaign that cannot yet be shared,
> contributed to easily, or cited.**

So: you are not fixing a broken codebase. You are adding reach, provenance and the missing
half of the contribution loop to a codebase that is already careful. Match its care.

---

## 2. The repository, as the review found it

Verify all of this against the actual code before you rely on it. The review was read off
commit `c17c544` plus two uncommitted working-tree features — moderator Move, and every van
site marked legacy — touching sixteen files. Nothing after `c17c544` is committed yet, so
"the code" means the working tree until it is; and the tree may have moved since.

```
index.html        the map, at the repository root — a server hands it out for
                  the site's own address, so it is not in frontend/
frontend/         style.css, map.js, shared.js, picker.js, account.js
pages/            about.html, account.html, blog.html, leaderboard.html,
                  moderate.html, report.html  (7 pages total including index)
data/             points.js          — the camera data as executable JS
backend/          schema.sql, seed.sql
tools/            stamp.py           — asset stamping + CSP drift check
                  build_points.py    — REFERENCED IN FOUR PLACES, DOES NOT EXIST
NOTES.md, CLAUDE.md                  — about 4,700 words of reasoning between them;
                                       the code comments carry another ~17,000
```

Figures the review verified: **182 cameras**, 17 shown by default, 7 pages, 1 blog post,
1 sentence on About, 0 tests, 0 CI, 0 share cards. 43 van sites carry an approximate
position. Hosting is GitHub Pages; the database and auth are Supabase; the map is MapLibre;
place search is Nominatim.

Key names you will meet: `CAMERA_TYPES`, `DRAW_ORDER`, `LONDON_BOUNDS`, `LONDON_CENTRE`,
`colourOf`, `inLondon`, `typeColourExpression`, `seedKeyOf`, `QUEUE_PAGE` (= 30), `xp_rules`,
`saved_cameras`, `report_proof`, `approve_report`, `moderate_move_camera`. That last one is in
the working tree only, and not in the live database until `schema.sql` is re-run.

**If the code contradicts the review, the code wins.** Say so in your summary, adjust the
task, and carry on. Do not implement a fix for a problem that no longer exists.

---

## 3. Invariants — do not break these

The review calls these load-bearing. They are hard constraints on every phase.

1. **No build step, no CDN, no bundler.** Everything here is achievable in plain browser
   JavaScript and static files. The CSP would refuse an outside script anyway. If a task
   seems to need a bundler, you have misread the task.
2. **"Nothing here is estimated."** Every change adds detail to the record. None of them
   guesses, predicts, or infers where a van will go next. This is the project's credibility.
3. **No email, no name, no IP.** An endpoint that answers questions about accounts leaks as
   surely as a column does — which is why `username_available()` was deliberately dropped.
   Check every new endpoint against that test before you write it.
4. **The brightness rule.** Nothing the base map draws may be brighter than the dimmest
   camera dot. Any new layer — accuracy circles, radius rings, borough outlines, clustering
   badges — answers to it.
5. **Server-side gating.** Every moderating action is a `security definer` function that
   re-checks the role. A page hiding itself is a courtesy, never the lock. Bulk actions and
   merges must go through the same door.
6. **The comments stay.** They explain *why*, at length, and they are most of what makes
   this codebase legible to whoever arrives next. Do not strip them to make a diff smaller.
   Write new comments in the same register.

Also treat as fixed unless a phase says otherwise: the single dark theme, the one typeface,
the absence of gradients/rounded corners/shadows, 4.5:1 contrast on every colour, and the
seven identical CSP blocks that `stamp.py` polices.

---

## 4. House rules

- **Read before writing.** Read `CLAUDE.md` and `NOTES.md` in full at the start of every
  phase. Most design questions you are about to ask are already answered there, usually
  better than you would answer them.
- **Follow the local pattern.** New moderator functions look like `moderate_move_camera`.
  New colours come out of `CAMERA_TYPES`. New pages copy an existing page's `<head>`, nav
  and footer exactly — `stamp.py` will fail you if they drift.
- **Touch seven files or none.** Anything in a `<head>`, the nav or the footer must be
  applied identically to all seven pages in the same commit.
- **Progressive enhancement.** Geolocation, service workers, clipboard and `localStorage`
  may all be unavailable or denied. The page must still work.
- **No new dependencies** without saying so explicitly and explaining why the CSP permits it.
- **Schema changes are additive.** New columns are nullable or defaulted; existing rows keep
  working; `points.js` and `seed.sql` change together, always.
- **Do not invent data.** If a source URL for a camera is unknown, leave it null and let the
  UI say nothing rather than say something unsupported.

---

## 5. How to work a phase

1. Read this brief, `CLAUDE.md`, `NOTES.md`, and the files the phase names.
2. Restate the phase's items in your own words, flagging any the code has made obsolete or
   any you think should be resequenced. Wait for a go-ahead only if something is genuinely
   blocking; otherwise proceed.
3. Work item by item, smallest first, committing each as its own commit.
4. After each item: run `python3 tools/stamp.py`, run `node tools/check.js` if it exists yet,
   and load the affected page in a browser. The review's own standard — *"there is no build,
   so it is checked by running it"* — is the minimum bar, and phase 0 raises it.
5. At the end of the phase, update `NOTES.md` and `CLAUDE.md` with anything a future reader
   needs and post a summary: what landed, what changed shape, what you deliberately did not do.

**Commit messages:** one line, imperative, naming the item id, e.g.
`REACH-1: add Open Graph and Twitter card metadata to all seven pages`.

**Definition of done for any item:**

- it works with JavaScript enabled and degrades sanely without it, where that applies;
- it works on a phone-width viewport;
- it is reachable and legible by keyboard and by screen reader;
- it respects the six invariants above;
- `stamp.py` and `check.js` pass;
- the *why* is in a comment or in `NOTES.md`, not only in the commit message.

---

## 6. Phase map

| Phase | Name | Items |
|---|---|---|
| 0 | Ground truth and the safety net | KEEP-1, KEEP-2, KEEP-3 |
| 1 | Make it shareable | REACH-1…5, REACH-7, WORD-5 |
| 2 | The map as a tool | MAP-1, MAP-2, MAP-3, MAP-5 |
| 3 | Accessibility, print, legend | MAP-6…10, WORD-6 |
| 4 | One source of truth | DATA-5, DATA-3 |
| 5 | Provenance, downloads, the record | DATA-1, 2, 6, 7, 8, MAP-4, REACH-6 |
| 6 | The reporting loop | REP-1…8 |
| 7 | Moderation at scale | MOD-1…7 |
| 8 | Accounts and anonymity | ACCT-1…6 |
| 9 | The words, the feed, the long tail | WORD-1…4, DATA-4, KEEP-4, 5, 6 |

Phases 0 and 1 are independent of everything. Phase 4 must precede phase 5. Phases 6, 7
and 8 are independent of each other. Phase 9 can be done any time after phase 5.

---

## 7. Item index

Each item gives: what is true now, the change, and what "done" means. Effort figures are the
review's, for sequencing only — they are not deadlines.

### REACH — the site cannot be posted (7)

**REACH-1 · Share cards and page descriptions · ~2h · 7 × `<head>`, new `/img`**
No meta description, Open Graph or Twitter card anywhere; a shared link renders as a bare
grey URL. Add `og:title`, `og:description`, `og:image`, `twitter:card` per page with a
1200×630 PNG committed to the repo — a screenshot of the glow over London with the count on
it. *Done when:* all seven pages validate in a card debugger and each has its own title and
description, not a shared one.

**REACH-2 · Favicon and home-screen icon · ~1h · 7 × `<head>`, `manifest.json`**
No favicon, no `apple-touch-icon`, no manifest. Add one SVG favicon, a 180px PNG, and a small
manifest with `theme-color: #0d0d0d`. *Done when:* "Add to Home Screen" on iOS and Android
produces the icon, not a screenshot thumbnail.

**REACH-3 · robots.txt and sitemap · ~30m · 2 new root files**
Neither exists. Write a four-line `robots.txt` and a hand-written `sitemap.xml`. Seven URLs;
it does not need generating. *Done when:* both are served from the site root and the sitemap
lists every page with a `lastmod`.

**REACH-4 · A 404 page · ~20m · `404.html`**
A rotted link gets GitHub's own error page. GitHub Pages serves a root `404.html`
automatically: same masthead, one line, a link back to the map. *Done when:* a nonsense URL
on the deployed site shows it.

**REACH-5 · Say when the data was last updated · ~1h · `shared.js`, `index.html`**
Nothing dates the dataset, so a visitor cannot tell current from abandoned. Add a line under
the map: "182 cameras · Met records to 2025, BTP to 2026 · last checked September 2026",
driven by constants in `shared.js` beside the rest. *Done when:* the counts are computed
from the data rather than typed, and the dates are single constants.

**REACH-6 · Something to send to press · ~half a day · `pages/press.html`** *(phase 5)*
No contact route and no press page. One page: the counts, the methodology in three
paragraphs, the download links, permission to reuse under a named licence, one contact
address. *Done when:* it links working downloads (DATA-2) and the API note (DATA-6).

**REACH-7 · Name the licence · ~30m · `LICENSE`, footer × 7**
No `LICENSE` and no statement about reusing the data. Pick one for the code and one for the
data — ODbL or CC BY-SA suits a dataset assembled from public records — and say so in the
footer. *Done when:* both are named in the footer of all seven pages and the file exists.

### MAP — a picture that is not yet a tool (10)

**MAP-1 · Deep links to a place and a camera · ~half a day · `map.js`**
`map.js` reads `#lat,lon` on load and jumps there; nothing writes it back and no button
offers it. Keep the hash in step as the map moves, in the OpenStreetMap convention
(`#14/51.5169/-0.0977`); support `#camera=<id>` to open a popup; add a *Copy link* row to the
popup. Keep the existing `#lat,lon` form working — the moderation queue depends on it.
*Done when:* copying the URL and opening it in a new tab reproduces the view and the open
popup, and hash writes are throttled so they do not spam history.

**MAP-2 · Cameras near me · ~1d · `map.js`, `index.html`**
Geolocation exists only on the report form. Add a *Near me* button beside the view toggles —
pressed, never automatic, the line `NOTES.md` already draws. Centre, draw an accuracy circle,
re-sort the list by distance with a metre count per row. *Done when:* denial and unavailable
geolocation both leave the map usable and say why, and the accuracy circle obeys the
brightness rule.

**MAP-3 · Open the place search to everyone · ~2h · `index.html`, `map.js`**
The Nominatim box carries `class="edit-only"` and is hidden outside `?edit`, though the CSP
already allows the host on every page. Show it to everybody. *Done when:* typing a postcode
or "Peckham" moves the map for a signed-out visitor, with debounce and an empty-result state.

**MAP-4 · A time slider · ~1d · `map.js`** *(phase 5)*
`last` holds the most recent year per camera and is used only for popup text; it plays no
part in the legacy split, since every van site is legacy whatever its year (see "What active
means" in `NOTES.md`). Add a year scrubber under the map, 2020–2026, filtering the layer. *Done when:* it is
driven by the per-year deployments column (DATA-3) rather than by `last` alone, is keyboard
operable, and updates the count line and list together with the dots.

**MAP-5 · Say how many are stacked on one spot · ~1d · `map.js`**
Two cameras on one corner draw as a single darker dot and `DRAW_ORDER` picks a winner —
Croydon deliberately holds a fixed install and a van hotspot at nearly the same point. At
close zoom, fan overlapping dots on click or badge the dot with a count. *Done when:* the
Croydon pair is individually reachable and the map no longer under-reports density.

**MAP-6 · Solo a camera type from the legend · ~2h · `map.js`**
Keys toggle one type at a time, so "only the shops" takes four clicks and cannot be undone in
one. Keep click-to-toggle; add click-and-hold or a small *only* affordance to solo, and a
click on the soloed key to restore all. *Done when:* it is reachable by keyboard, with the
solo state announced.

**MAP-7 · Keyboard focus is invisible · ~1h · `style.css`**
`:focus` is defined for inputs and the donate link only. Every button on the site gives a
keyboard user no indication of where they are. Add one `:focus-visible` rule with a 2px
accent outline covering `button, a, [tabindex]`. *Done when:* tabbing through index, report
and moderate never loses the focus ring, at 4.5:1 against every background it lands on.

**MAP-8 · Respect reduced motion · ~1h · `map.js`**
Every list row and search result calls `flyTo`, which animates across London. No
`prefers-reduced-motion` rule exists. Read the media query once and use `jumpTo` when it is
set — `CLAUDE.md` already notes `jumpTo` is the reliable one. *Done when:* the query is also
re-read on change, not only at load.

**MAP-9 · Tell a screen reader the list is the map · ~2h · `index.html`, `map.js`**
The canvas dots are unreachable by assistive technology; the camera list beside it is a
genuinely good text equivalent but nothing says so. Mark the canvas `aria-hidden`, label the
list as the accessible equivalent, announce the result count on filter changes with a live
region. *Done when:* a screen reader pass reaches every camera and hears the count change.

**MAP-10 · Print and export the view · ~2h · `style.css`**
No print stylesheet; printing gives a dark rectangle and a truncated list. Put the list on
paper with coordinates. *Done when:* a borough's van sites print as a usable leafletable
list on white, with the filter state reflected.

### DATA — the argument is honoured but not demonstrated (8)

**DATA-1 · Cite the source on every camera · ~1d · `schema.sql`, `points.js`, `seed.sql`, `map.js`** *(phase 5 UI, phase 4 schema)*
Provenance lives in prose inside `note` with no link to the FOI release, register entry or
article. Add `source_url` and `source_label`; show "Source: Met FOI 01.FOI.24.036239" in the
popup. The review calls this the highest-value schema change on the list: it converts the map
from a claim into evidence. *Done when:* cameras without a source say nothing rather than
something vague, and existing `note` prose is preserved.

**DATA-2 · Let people take the data away · ~half a day · `tools/`, new data files**
No download; the data is public but only as JavaScript a browser executes. Ship
`cameras.csv` and `cameras.geojson` beside it, generated by the build script, plus a
*Download the data* line in the footer. *Done when:* the GeoJSON opens in QGIS and the files
are regenerated by `build_points.py`, never hand-edited.

**DATA-3 · Deployments by year, not just a total · ~1d · `schema.sql`, `points.js`, `seed.sql`** *(phase 4)*
`deployments` is a single integer and `last` a single year, so "8 deployments 2023–2025"
cannot be broken down. Store `{"2023":1,"2024":3,"2025":4}` as a JSON column. *Done when:*
the old integer is derivable from the new column, the check constraint validates shape, and
a five-bar sparkline is available to the popup.

**DATA-4 · Borough pages · ~1w · new pages, `tools/`** *(phase 9)*
No way to ask "what is in Croydon" except the list filter. A page per borough with its count,
sites, busiest spot and a share card — thirty-three pages generated from the same data.
*Done when:* they are generated by a tool, carry the identical nav/footer/CSP, and are in the
sitemap.

**DATA-5 · Write the missing build script · ~1w · `tools/build_points.py`** *(phase 4)*
`build_points.py` is named in `points.js`, `seed.sql`, `NOTES.md` and `CLAUDE.md`, and does
not exist. Two files that must agree are kept in step by hand. Rewrite it from one source
table to both outputs. **The largest standing risk in the repository: the invariant is
documented in four places and enforced in none.** *Done when:* regenerating from the current
source produces byte-identical `points.js` and `seed.sql` to what is committed today, and
`stamp.py` fails if they drift.

**DATA-6 · Document the read API · ~2h · `pages/`**
The `cameras` table is already readable with the public key by anyone, and nothing says so.
Half a page with the endpoint, the columns and a `curl` line. *Done when:* the `curl` line
works as written, copy-pasted.

**DATA-7 · Say what is *not* known · ~half a day · `shared.js`, `map.js`**
43 van sites carry "pin marks the surrounding area, not an exact spot" buried in note text
and are drawn identically to a precise one. Make approximation visible — a wider, softer dot
or a radius ring — and add a legend entry. *Done when:* the marker distinction is derived
from a data field, not from parsing the note text, and the new drawing obeys the brightness
rule.

**DATA-8 · Be honest when the database is unreachable · ~1h · `map.js`**
If Supabase fails the map silently falls back to the seed — good behaviour, but the visitor
sees possibly stale data with no indication. One dim line: "showing the published record;
live updates unavailable". *Done when:* the notice appears on failure and on timeout, and
clears on a later successful fetch.

### REP — the contribution loop (8)

**REP-1 · An account is required before you can even look · ~1d · `report.html`, `account.js`**
`#report-locked` hides the form, the map and the crosshair from anyone signed out. Show the
whole form to everyone; ask for an account at the moment of submitting, carrying the
filled-in report through sign-up. *Done when:* a signed-out visitor can fill everything
including the pin and the photo, and loses nothing across sign-up.

**REP-2 · Warn about a duplicate before the form is filled · ~half a day · `account.js`, `schema.sql`**
The database refuses a second pending report in the same cell, so the reporter finds out on
submit, after typing everything and attaching a photo. As the pin lands, check the cell:
"someone reported this corner two days ago — add to it?". *Done when:* the check runs on pin
placement, respects RLS without leaking who reported, and offers a path forward rather than
only a refusal.

**REP-3 · Reports vanish into a queue · ~half a day · `account.html`, `account.js`**
The account page lists saved cameras and an XP number, never what you reported or what became
of it — though `reports: read own or moderator` already permits it. Add a *Your reports* list
with state, date and the moderator's resolution note. *Done when:* it paginates (see MOD-1)
and shows pending, approved and rejected alike.

**REP-4 · More than one photo · ~half a day · `report.html`, `account.js`**
One file per report; a moderator often needs a close shot and a wide shot. Accept up to
three. `report_proof` is already a separate table with a `report_id`, so the schema expects
this. *Done when:* EXIF stripping applies to all three and partial upload failure is
recoverable.

**REP-5 · Video keeps its metadata · ~2h · `report.html`, `account.js`**
The hint says photos are re-saved to strip location but "videos are sent as they are, so
check what yours contains" — on a site whose central promise is anonymity. Either refuse
video, or warn far more loudly at the point of choosing the file. *Done when:* the decision
is made explicitly and recorded in `NOTES.md`; a person filming a van is exactly the person
who cannot afford to leak a location.

**REP-6 · No way to report from the map · ~2h · `map.js`, `account.js`**
The popup offers "Report its state" for an existing camera; a gap on the map offers nothing.
Right-click or long-press anywhere: "Report a camera here", opening the form with the pin
placed. *Done when:* it works by long-press on touch and does not fight the browser context
menu on desktop.

**REP-7 · Show what a report is worth before it is written · ~1h · `leaderboard.html`, `account.js`**
XP per type is a hint on the form, but the leaderboard never explains that a transport camera
is worth 50 and a van site 5. Publish the `xp_rules` table on the leaderboard page — it is
already readable by everyone, and it tells contributors where the gaps are. *Done when:* it
reads the table rather than hard-coding the numbers.

**REP-8 · Nothing tells you a report succeeded except a sentence · ~1h · `account.js`**
"Sent for review. Thank you." and the form clears. No reference number, no link. Show the
report id and link it to *Your reports*. *Done when:* the id is copyable and survives a
page reload.

### MOD — the interface that will fail under load (7)

**MOD-1 · The queue stops at thirty · ~2h · `account.js`** — *closest thing to a bug on the list*
Queue and history both call `.limit(QUEUE_PAGE)` with `QUEUE_PAGE = 30` and there is no
`.range()` anywhere in `account.js`. Report 31 onwards is unreachable. Add `.range()` and a
*Load more* button. *Done when:* every list in `account.js` that can grow is paginated, and
it bites nobody precisely when the project succeeds.

**MOD-2 · Cameras can be moved but not renamed · ~half a day · `schema.sql`, `account.js`**
A moderator can add, hide, unhide and move. Name, note, type and status have no edit path — a
typo is permanent. Add `moderate_edit_camera`: same gate, same row, same panel, reusing the
pattern `moderate_move_camera` established. *Done when:* it is a `security definer` function
that re-checks the role, and the edit is recorded like any other action.

**MOD-3 · No way to merge two entries for one camera · ~1d · `schema.sql`, `account.js`**
`approve_report` has clustering and merge logic for incoming reports, but a moderator looking
at two duplicate rows can only hide one, which loses its reports. Merge should repoint the
loser's reports at the survivor before hiding it. *Done when:* it is one server function, is
non-destructive (nothing is deleted), and states which row survived.

**MOD-4 · Every decision is one at a time · ~half a day · `account.js`**
Twenty approvals means twenty clicks and twenty round trips. Add checkboxes and bulk approve
or reject, **gated identically on the server**. Moderation is volunteer time; it is the
scarcest resource the project has. *Done when:* the bulk path calls the same
`security definer` functions and reports per-row failures rather than failing silently.

**MOD-5 · The queue cannot be sorted or filtered · ~half a day · `account.js`**
Newest first, everything mixed. Filter by kind and type; sort by distance to the nearest
existing camera, which surfaces likely duplicates first. *Done when:* sorting is done where
it can see the whole queue, not only the loaded page.

**MOD-6 · Nobody can see who did what · ~half a day · `account.js`, `moderate.html`**
`resolved_by`, `resolved_at` and `resolution_note` are all recorded and none is shown.
Add a moderator activity view. *On a project that publishes accusations about surveillance,
being able to audit its own moderators is not optional.* *Done when:* it is visible to
moderators, paginated, and shows the note.

**MOD-7 · No sense of the backlog · ~2h · `account.js`**
Nothing counts what is waiting. Put a pending count on the Moderate nav link and the oldest
waiting report's age at the top of the queue. *Done when:* the count is a cheap head query,
not a full fetch.

### ACCT — the ordinary operations principle did not cover (6)

**ACCT-1 · You cannot change your password · ~2h · `account.html`, `account.js`**
No `updateUser` call anywhere. A password typed on a shared machine is that account's
password forever. Add a change-password box. *Done when:* it requires the current password
and confirms success without revealing anything about the account.

**ACCT-2 · You cannot delete your account · ~half a day · `schema.sql`, `account.js`**
No delete path; the only way out is abandonment. Add a `security definer` function that
deletes the profile and cascades. A site built on collecting nothing should let you take back
the little it holds. *Done when:* the UI states plainly what happens to reports already on
the map, and requires a typed confirmation.

**ACCT-3 · Make the recovery sheet a thing you can keep · ~half a day · `account.html`, `account.js`**
Sign-up shows the generated username and warns, in a hint, that it is the only way back in.
After sign-up, offer a printable card with the username and a generated passphrase, and
require an "I have saved this" tick. *Lockout is the predictable cost of the anonymity choice
and should be designed for, not just disclosed.* *Done when:* the card prints on one side of
paper and the passphrase is generated client-side.

**ACCT-4 · The leaderboard has no opt-out · ~2h · `schema.sql`, `account.js`**
Every contributor's name, XP and confirmed count are public and enumerable at `.limit(100)`.
Add a per-account *show me on the leaderboard* switch, defaulting to on. The names carry
nothing personal, but the pattern of what someone reported is itself information. *Done
when:* the opt-out is enforced by RLS, not by the query.

**ACCT-5 · Sessions cannot be reviewed or ended · ~1h · `account.js`**
Sign out ends the local session only. Add "sign out everywhere" using Supabase's global
scope. Small, and it matters most to the people this site is for. *Done when:* it is
confirmed before firing.

**ACCT-6 · Saved cameras are a snapshot, not a link · ~2h · `account.js`**
`saved_cameras` copies name, type and position at save time, deliberately holding no
`camera_id`. Keep the copy — it is the right privacy call — but show "this camera has since
been marked non-functional" by matching on position when the list is drawn. *Done when:* the
matching happens client-side and the database gains no link between a person and a camera.

### WORD — the argument is in the comments where nobody reads it (6)

**WORD-1 · About is one sentence · ~1d · `pages/about.html`**
The whole page is "Our mission is to map out every facial recognition camera in London",
inside an editing marker that invites more. Write: what LFR is and how it differs from CCTV;
where every figure comes from; what the map does not claim; who runs this and how it is
funded. `NOTES.md` already contains most of it, written better than a first draft would be.
*Done when:* it is drawn from `NOTES.md` rather than composed fresh, and claims nothing the
data does not support.

**WORD-2 · Know your rights · ~1d · `pages/rights.html`**
Nothing tells a person what to do when they are standing in front of a van, which is the
moment they are most likely to be looking at this on a phone. One page: whether you must show
your face, what covering it means, what to do if stopped, who to complain to, how to make a
subject access request. *Probably the most useful page the site could add.* *Done when:*
every legal claim carries a citation and the page reads well on a phone in one thumb.

**WORD-3 · Blog posts cannot be linked to · ~1h · `pages/blog.html`**
Posts are hand-pasted `<article>` blocks with no anchors and no machine-readable dates. Add
an `id` per post and a `<time datetime>` on each date. Neither needs a build step. *Done
when:* a post URL opens scrolled to that post.

**WORD-4 · No feed · ~2h · `feed.xml`, 7 × `<head>`**
No RSS or Atom, so nobody can follow the project without checking the page. A hand-maintained
`feed.xml` — one post so far, so it starts trivial — linked from the head of every page.
*Done when:* it validates and is discoverable from all seven pages.

**WORD-5 · The donate link explains nothing · ~30m · footer × 7**
"cammap is free and has no advertising. Donations pay for the hosting." No figure, no goal,
no account of what it costs. Name the actual monthly cost. *A precise small number is far
more persuasive than an unspecified appeal*, and it fits the project's stance on saying
exactly what is known. *Done when:* the figure is real — ask the maintainer rather than
inventing one, and leave a `TODO` if it is not available.

**WORD-6 · Nothing explains the legend in words · ~2h · `index.html`**
The legend gives five colours and two states; a visitor has to infer that a hollow ring means
a van site. Add a short "how to read this map" block under the legend — four sentences
covering the colours, the ring, the glow and why van sites sit behind a toggle. *Done when:*
it is collapsible and open by default on first visit only.

### KEEP — rules written down thoroughly and enforced almost nowhere (6)

**KEEP-1 · Extend stamp.py into a checker · ~1d · `tools/stamp.py`**
It stamps assets and compares the seven CSP copies, and stops there. Have it also verify:
`points.js` and `seed.sql` agree row for row; every camera is inside `LONDON_BOUNDS`; every
vancam is legacy (an invariant new in the working tree — see "What active means" in
`NOTES.md`); every type appears in both `CAMERA_TYPES` and the check constraint; the nav
and footer are identical across pages. All are a few lines each, **and each has already been
got wrong once.** *Done when:* each check fails loudly with the offending row named, and
deliberately breaking each one is demonstrated.

**KEEP-2 · Run it automatically · ~2h · `.github/workflows`**
No `.github` directory. Every rule depends on someone remembering to run one script. One
workflow file running `stamp.py` on every push and failing the build. The no-build philosophy
survives this: *it is a checker, not a compiler.* *Done when:* it runs on push and pull
request, installs nothing beyond Python and Node, and finishes in under a minute.

**KEEP-3 · A handful of real tests · ~half a day · `tools/check.js`**
"There are no tests. There is no build. So it is checked by running it." Node can load
`points.js` and `shared.js` with no toolchain at all — `colourOf`, `inLondon`,
`typeColourExpression` and `seedKeyOf` are all pure and all load-bearing. Twenty assertions
in one file, no dependencies. *Done when:* `node tools/check.js` exits non-zero on failure
and is wired into KEEP-2.

**KEEP-4 · Work offline · ~1d · `sw.js`**
Camera rows are cached in `localStorage` for five minutes; the page itself is not cached at
all. Add a service worker precaching the shell, the fonts, MapLibre and the last tiles seen.
*This site is meant to be opened on a street with bad signal*, and it can be made to work
there in plain JavaScript with no build step. *Done when:* a cold offline load of the map
works, and there is a tested path for shipping an update without stranding old clients.

**KEEP-5 · Serve fresh data faster than five minutes · ~2h · `map.js`**
A five-minute TTL means a moderator's change can take five minutes to appear, and a cold
visitor waits on the network before seeing database state. Draw from cache immediately, then
revalidate in the background and redraw if it differs. *Done when:* the redraw does not throw
away the user's pan, zoom, filters or open popup.

**KEEP-6 · Plan for the second city · ~half a day · `shared.js`, `schema.sql`**
The bounds and the centre already sit together in `shared.js` (`LONDON_BOUNDS`,
`LONDON_CENTRE`); the three check constraints in `schema.sql` and the opening zoom in `map.js`
do not. Move the box, the centre and the name into one `CITY` object that the schema reads
from too.
*Doing it while there is one city is an afternoon; doing it with two is a migration.* *Done
when:* there is exactly one place to change, and KEEP-1's bounds check reads from it.

---

## 8. When you disagree

Say so. The review is a careful reading of a snapshot, not an instruction from someone who
knows the code better than you will after an hour in it. If an item is wrong, obsolete, or
would break an invariant, write two sentences explaining why and propose the alternative
before implementing anything. Skipping an item silently is the only unacceptable outcome.
