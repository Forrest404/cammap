# Live facial recognition in London — what is running, and where you can see it

Survey date 2026-09-06. 14 research units, 7 agents, all files at 100% field
coverage. Site list deduplicated to `master_cameras.csv` / `master_cameras.json`
(60 raw entries from overlapping agents → 44 unique sites).

## The short answer

**Fixed live facial recognition cameras in London: 16 sites, of which 11 are
active, 1 paused, 1 ended and 3 unverified.** That is the whole list. It is
small because the premise of the question does not match the technology's
deployment model — UK live facial recognition is overwhelmingly *mobile*, and
the fixed estate is two police cameras in Croydon plus a scatter of private
retail and hospitality installations.

**Is there a live map of the LFR vans? No.** Not official, not third-party, not
campaign-run, not crowdsourced, and nothing found that is being built.

## Fixed sites

### Police — 2 sites

Croydon is the UK's **only** operating fixed police LFR installation: two
mounting locations at either end of North End, the northern one at the London
Road junction. Pilot Oct 2025 – Mar 2026, 24 operations, 173 arrests; the Met
confirmed in May 2026 it will keep them.

The Met has never published a mounting point, postcode or coordinate. Sources
also conflict on hardware: the Met says "two cameras / two locations", Inside
Croydon reported 15 units across the two. Both entries are marked `reported`,
not `confirmed`, and carry null coordinates.

**Expansion is announced but not yet built.** Static LFR across the West End
and Soho was announced 23 June 2026 for end-2026, London-wide in 2027. As of
today no West End site is confirmed installed, so none are listed.

### Facewatch and retail — 11 sites

| Site | Borough | Status |
| --- | --- | --- |
| Sainsbury's Sydenham | Lewisham | active |
| Sainsbury's Dalston | Hackney | active |
| Sainsbury's Elephant & Castle | Southwark | active |
| Sainsbury's Ladbroke Grove | Kensington and Chelsea | active |
| Sainsbury's Camden | Camden | active |
| Sainsbury's Whitechapel | Tower Hamlets | active |
| Sainsbury's East Dulwich | Southwark | **paused 17 Aug 2026** |
| Gordon's Wine Bar, 47 Villiers Street WC2N 6NE | Westminster | active |
| Eat 17 (Spar), Hackney | Hackney | unverified |
| Eat 17, Walthamstow | Waltham Forest | unverified |
| Village Wholefoods, Clapham | Lambeth | unverified |

The seven Sainsbury's come from Sainsbury's **own corporate press page** — a
subscriber disclosing its own estate, which is the only reason they are
nameable. Gordon's Wine Bar comes from the venue's own privacy policy and is
**the only site in this entire survey with a real street address**.

### Venues — 3 sites

The live private FR in London is in **casinos, not malls or stadiums**:
the Hippodrome Casino, Leicester Square (all entrances, 24/7) and Genting
Casino Stratford. Both self-publish, with named legal bases under Gambling
Commission self-exclusion duties. King's Cross Central is recorded as **ended**
— two cameras, May 2016 – Mar 2018, cancelled 2019 after the ICO opened its
investigation and the Met admitted supplying seven images.

## Mobile deployments — 27 recurring locations

Not installations, but the places vans repeatedly return to.

- **Met, 17 locations** — from four retrospective "Deployment Record" PDFs. The
  2025 record alone: 231 deployments, 110 distinct locations, 0.64 threshold
  throughout. Recurring sites include Powis St Woolwich, Oxford Circus,
  Stratford Broadway, Rye Lane Peckham, Walthamstow Central, Wembley Central,
  Kilburn High Road, South St Romford, Clarence St Kingston.
- **BTP, 10 stations** — from BTP's own deployment register PDF: 22 deployments
  11 Feb – 27 Aug 2026, ~733,000 faces, **one confirmed false alert and one
  unconfirmed true alert in the entire trial**. Pilot runs to Nov 2026. BTP has
  installed nothing permanent; rigs go up for a shift and come down.

**Only two forces run LFR in London: the Met and BTP.** City of London Police
operates none, and no neighbouring force deploys inside the Greater London
boundary.

## Is the van location published anywhere?

| Channel | Direction | Lag |
| --- | --- | --- |
| Met deployment-record PDFs | retrospective | weeks to months |
| BTP deployment register | retrospective | days |
| **BTP "Upcoming deployments" line** | **forward** | **hours** |
| Borough BCU accounts on X | forward-ish | same day to ~48h |
| Any live map | — | **does not exist** |

The Met's forward channel is a text post on a borough BCU account
(@MPSWestminster, @MPSCroydon and ~a dozen others) naming a borough with no
street, no time window, no index and no archive. This is despite **MPS Overt
LFR Policy §10** committing that "the public should be notified of LFR
Deployments in advance using the MPS website" — the old advice-section page now
404s and no upcoming-deployments listing survived the move.

BTP's page is the one genuinely forward-looking official source in London. On
11 August 2026 it read, in full: *"Tuesday 11 August – London Victoria
Underground station."* Hours of notice, transport only.

**The decisive obstacle to any van map** is a Mayor's Answer of 30 July 2024 to
Zoë Garbett AM: *"location data for Live Facial Recognition (LFR) deployments
is not recorded in coordinate format."* Any van layer is therefore a geocode of
free text like "Powis St, Woolwich" — accurate to a high street, never to a
parking position.

For contrast: **Surrey pledges seven days' notice and Essex publishes
multi-week forward schedules.** The gap in London is a choice, not a technical
limit.

## Can I import someone else's dataset?

No.

- **No campaign group or crowdsourced project publishes a site-level LFR
  dataset for London.** Big Brother Watch is closest — a deployment table with
  true/false match counts — but it **stops at 16 May 2023**, is HTML only, no
  licence, no CSV, no API. It runs no tracker and attends "when we are tipped
  off", soliciting sightings by email and Signal.
- **OpenStreetMap is the only reusable geodata.** Queried via Overpass on
  2026-09-06: **2,456 `man_made=surveillance` nodes in the Greater London bbox,
  zero tagged as facial recognition.** The only FR convention in use,
  `surveillance:type=AFR`, has 67 uses worldwide — all 67 in Quebec City. ODbL,
  so share-alike applies to derivatives.
- **Retail LFR has no FOI route at all.** Facewatch is a private company; when
  Big Brother Watch asked the ICO, which does hold material and is subject to
  FOI, the substance came back redacted.

There is no upstream to sync from. Signage on the door is the entire disclosure
mechanism for retail, and the mandatory wording is:

> "Facial recognition in operation. To protect our employees, customers and
> stock. Our legal process for processing your data is our legitimate interest
> and the substantial public interest of preventing and detecting crime."

## Conflation traps

Four things widely reported as London facial recognition that are not:

- **Iceland** — the 1,000+ store 2026 rollout is SAI behaviour-detection. Its
  Facewatch LFR is a handful of stores. Merging them overstates Iceland's LFR
  footprint by ~1,000 sites.
- **Westfield Stratford** — a facial-image exclusion scheme: humans circulating
  photographs between retailers, not automated matching. The FR people remember
  there was a Met van outside the station in 2018.
- **Willesden Green (TfL)** — 11 object/behaviour algorithms with faces blurred
  by default. TfL says it was not a facial recognition tool; FOI-derived
  analysis indicates blurring was relaxed for the fare-evasion case. Left
  flagged uncertain rather than resolved.
- **Airport e-gates** — 1:1 verification against a presented passport chip, not
  watchlist matching. Excluded entirely.

Also: Asda is FaiceTech, not Facewatch, and its live FR trial was five Greater
Manchester stores for two months in 2025; Tesco's Auror use is retrospective
matching at a Daventry hub. Veesion (gesture) and Everseen (checkout) are
non-biometric. **Auror is the genuinely hard case** — Auror Core is not FR,
Auror *Subject Recognition* is, and it went live in UK stores in July 2026
naming neither retailers nor locations.

## Legal position, and why it matters to a fixed-camera map

*R (Thompson and Carlo) v Commissioner of Police of the Metropolis* [2026] EWHC
915 (Admin), 21 April 2026 — the Divisional Court **upheld** the Met's LFR
policy. Claimants have signalled an appeal.

But the court **expressly declined, as "speculation," to decide whether that
policy works for permanent installations** — while the Met rolls static LFR
across the West End. The legal footing for exactly the cameras this map is
about is assumed, not tested. No PSED challenge was brought, so the
racial-disparity argument remains undecided since Bridges.

Deployment siting is confined to three Use Cases, with hotspots set by a
hexagonal grid scoring three years of crime data, top 25% only. **Footfall is
not a criterion.**

Context: the Home Office consultation closed 12 Feb 2026 with no response and
no bill; the ICO published five-force audits on 18 Aug 2026 with 107
recommendations and took no enforcement action; the Biometrics and Surveillance
Camera Commissioner post has been **vacant since Aug 2024**; and retail LFR sits
outside the proposed reform entirely — UK GDPR only, no location constraint.

## What would move the numbers

1. **The 2026 Met deployment record** is listed on the Met's site but its link
   carries no file extension; every retrieval hit Cloudflare or 404 and the
   Wayback Machine has no copy. 2026 per-deployment locations are unknown.
2. **Frasers Group** — Sports Direct, Flannels, House of Fraser are reliably
   named Facewatch users, but in 3.5 years **not one source names a store**. The
   "27 stores" figure is from March 2023, never updated, never regionalised.
3. **Southern Co-op ceased to exist on 26 July 2026**, transferring to a Co-op
   Group subsidiary — and Co-op Group is on record against live FR. The largest
   convenience-sector Facewatch estate just passed to an owner opposed to it.
4. **A targeted FOI to City of London Police** would convert a strong inference
   ("operates no LFR") into a documented denial.
