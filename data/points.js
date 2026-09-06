/* ------------------------------------------------------------------
   cammap - facial recognition in London

   Every entry comes from a published source: the Met's own LFR
   deployment records (2020-2025), the British Transport Police
   deployment register (2026), and named press reporting for the
   shops. Nothing here is estimated. Where a source gave only a
   borough, the note says the pin is approximate and `approximate`
   is true.

   Ten fields:
     name, note, lat, lon   as before
     type    fixedcam | vancam | transportcam | facewatchcam | privatecam
     status  active | legacy
     last    the last year the source records it (or null)
     deployments  how many times a source records it being used;
                  the map weighs its heat by this, so a spot used
                  twenty times reads hotter than one used once
     periods  those uses counted by the period the source gives
              them in - {"2023-24": 1}, {"2023-2025": 3},
              {"2026": 4} - or null where the source names no
              period, which is every shop and fixed install. The
              key is the period exactly as the record states it.
              The Met publishes "3 deployments 2023-2025", not
              which year each fell in, and a per-year breakdown
              of that would be an estimate dressed as a record.
              deployments is always the sum of the values.
     source_label  the record or report the entry rests on, named:
                   "Met Police LFR deployment record, 2025", "The
                   Register, 6 February 2026". null where none is
                   known, and the map then says nothing rather
                   than something vague.
     source_url    where that record or report is, or null. Only
                   ever the document itself or the page it is
                   published on; never a homepage, never a guess.
     approximate   true where the pin marks the surrounding area
                   rather than an exact spot - the record gave a
                   borough or a district, and the pin sits at the
                   middle of it. A field, so the map can draw the
                   difference without reading the note for it.

   Every van site is legacy, and that is not a statement about age.
   An LFR van parks for a shift and drives away, so there is no hour
   at which "a van is at this spot" is a thing this map can honestly
   say. What the record supports is that a van was deployed here, so
   many times, most recently in year Y - and `last` and `deployments`
   are where that lives. Marking the lot legacy puts them behind the
   toggle, which is the difference between a map that shows what was
   recorded and one that reads as a map of what is out there today.

   It used to split them: active if the newest Met record we held
   (2025) listed a deployment, legacy otherwise. That drew a line
   between two things that are equally uncertain in the only sense
   that matters to somebody looking at the map now.

   So `status` no longer varies across the van sites, and the
   recency that used to be folded into it is still in `last`. The
   default view is the 17 cameras that are actually fixed somewhere:
   the two Croydon installs, the station deployments and the shops.

   The only permanent police cameras in this list are the two Croydon
   fixedcam entries. Croydon appears twice on purpose: once as the
   fixed install and once as the van hotspot it also is.

   Written out by tools/build_points.py from data/cameras.csv, which
   is the record, and never edited by hand: edit the CSV, run the
   script, commit both. tools/stamp.py regenerates this file on every
   run and fails if it is not what the CSV produces. The script
   writes every van site legacy and refuses to build a record that
   says otherwise - the original build_points.py computed the split
   described above, and this one will not, whatever it is given. A
   hand-typed entry may leave out type, status and last - the map
   assumes vancam, and a vancam without a status is legacy.
   ------------------------------------------------------------------ */

var POINTS = [

  {
    name: "Acton",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.508140,
    lon: -0.273261,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Barking",
    note: "Met Police LFR van - 3 deployments 2023-2025",
    lat: 51.540268,
    lon: 0.079324,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 3,
    periods: {"2023-2025": 3},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "Barnet",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.653090,
    lon: -0.200226,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Belvedere Road, Waterloo",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.505018,
    lon: -0.116314,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Bethnal Green",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.530346,
    lon: -0.056163,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Bethnal Green Road",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.526447,
    lon: -0.064883,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Bexleyheath",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.456460,
    lon: 0.146094,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Bond Street Station",
    note: "Met Police LFR van - 4 deployments 2025",
    lat: 51.514256,
    lon: -0.149786,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 4,
    periods: {"2025": 4},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Brent",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.563996,
    lon: -0.275906,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Brigstock Road, Thornton",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.395055,
    lon: -0.109973,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Brixton Road",
    note: "Met Police LFR van - 2 deployments 2025",
    lat: 51.470254,
    lon: -0.112507,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 2,
    periods: {"2025": 2},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Brixton Road, Brixton",
    note: "Met Police LFR van - 2 deployments 2025",
    lat: 51.467895,
    lon: -0.112637,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 2,
    periods: {"2025": 2},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Broadway, Stratford",
    note: "Met Police LFR van - 2 deployments 2023-24",
    lat: 51.541736,
    lon: 0.003557,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 2,
    periods: {"2023-24": 2},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Bromley",
    note: "Met Police LFR van - 2 deployments 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.402805,
    lon: 0.014814,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 2,
    periods: {"2023-24": 2},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Bruce Grove, Tottenham",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.593711,
    lon: -0.070005,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Camberwell Green",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.474907,
    lon: -0.092601,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Camden",
    note: "Met Police LFR van - 4 deployments 2023-2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.542797,
    lon: -0.162480,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 4,
    periods: {"2023-2025": 4},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: true
  },

  {
    name: "Camden High Road",
    note: "Met Police LFR van - 2 deployments 2023-2025",
    lat: 51.534932,
    lon: -0.138995,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 2,
    periods: {"2023-2025": 2},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "Catford",
    note: "Met Police LFR van - 3 deployments 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.445321,
    lon: -0.019753,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 3,
    periods: {"2023-24": 3},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Church Street, Croydon",
    note: "Met Police LFR van - 6 deployments 2023-24",
    lat: 51.373648,
    lon: -0.104180,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 6,
    periods: {"2023-24": 6},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Clapham Common",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.461801,
    lon: -0.138304,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Clapham Junction",
    note: "Met Police LFR van - 2 deployments 2023-24",
    lat: 51.464459,
    lon: -0.170518,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 2,
    periods: {"2023-24": 2},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Clarence Street, Kingston",
    note: "Met Police LFR van - 4 deployments 2025",
    lat: 51.411443,
    lon: -0.300439,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 4,
    periods: {"2025": 4},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Covent Garden",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.512873,
    lon: -0.122564,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Coventry Street, Piccadilly",
    note: "Met Police LFR van - 3 deployments 2023-2025",
    lat: 51.510040,
    lon: -0.133936,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 3,
    periods: {"2023-2025": 3},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "Crisp Street, Poplar",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.514677,
    lon: -0.014725,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Croydon",
    note: "Met Police LFR van - 5 deployments 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.371305,
    lon: -0.101957,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 5,
    periods: {"2023-24": 5},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Dagenham",
    note: "Met Police LFR van - 3 deployments 2023-2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.541327,
    lon: 0.148114,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 3,
    periods: {"2023-2025": 3},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: true
  },

  {
    name: "Dagenham Heathway",
    note: "Met Police LFR van - 2 deployments 2025",
    lat: 51.541553,
    lon: 0.145638,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 2,
    periods: {"2025": 2},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Dalston",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.543212,
    lon: -0.076013,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Dalston Junction",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.545284,
    lon: -0.074968,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Dalston Kingsland",
    note: "Met Police LFR van - 4 deployments 2025",
    lat: 51.548191,
    lon: -0.076053,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 4,
    periods: {"2025": 4},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Deptford High Street",
    note: "Met Police LFR van - 2 deployments 2025",
    lat: 51.476412,
    lon: -0.025856,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 2,
    periods: {"2025": 2},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Ealing Broadway",
    note: "Met Police LFR van - 5 deployments 2023-2025",
    lat: 51.514980,
    lon: -0.300407,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 5,
    periods: {"2023-2025": 5},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "Ealing Broadway Station",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.515184,
    lon: -0.302214,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Earls Court",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.488797,
    lon: -0.198220,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Earls Court Road, Earls Court",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.494788,
    lon: -0.194750,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "East Ham",
    note: "Met Police LFR van - 2 deployments 2023-24",
    lat: 51.539400,
    lon: 0.052604,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 2,
    periods: {"2023-24": 2},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "East Ham, High Road",
    note: "Met Police LFR van - 6 deployments 2025",
    lat: 51.546269,
    lon: 0.048904,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 6,
    periods: {"2025": 6},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Edgware Road",
    note: "Met Police LFR van - 4 deployments 2023-2025",
    lat: 51.520193,
    lon: -0.166764,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 4,
    periods: {"2023-2025": 4},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "Edmonton Green",
    note: "Met Police LFR van - 3 deployments 2025",
    lat: 51.624500,
    lon: -0.061402,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 3,
    periods: {"2025": 3},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Enfield",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.652085,
    lon: -0.081018,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Euston station",
    note: "British Transport Police LFR - 4 deployments in the 2026 station trial",
    lat: 51.528853,
    lon: -0.134191,
    type: "transportcam",
    status: "active",
    last: 2026,
    deployments: 4,
    periods: {"2026": 4},
    source_label: "British Transport Police LFR deployment register, 2026",
    source_url: "https://www.btp.police.uk/SysSiteAssets/media/images/british-transport-police/live-facial-recognition/lfr-deployment-register.pdf",
    approximate: false
  },

  {
    name: "Finsbury Park",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.564835,
    lon: -0.106414,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "George Street, Croydon",
    note: "Met Police LFR van - 8 deployments 2023-2025",
    lat: 51.373900,
    lon: -0.098912,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 8,
    periods: {"2023-2025": 8},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "Green Street, Newham",
    note: "Met Police LFR van - 5 deployments 2025",
    lat: 51.546903,
    lon: 0.031186,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 5,
    periods: {"2025": 5},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Green Street, Upton Park",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.546553,
    lon: 0.031288,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Hackney",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.543240,
    lon: -0.049362,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Hammersmith",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.492038,
    lon: -0.223640,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Hammersmith Broadway",
    note: "Met Police LFR van - 3 deployments 2023-2025",
    lat: 51.493174,
    lon: -0.223804,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 3,
    periods: {"2023-2025": 3},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "Haringey",
    note: "Met Police LFR van - 3 deployments 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.587936,
    lon: -0.105438,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 3,
    periods: {"2023-24": 3},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Harlesden",
    note: "Met Police LFR van - 2 deployments 2023-2025",
    lat: 51.536357,
    lon: -0.257833,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 2,
    periods: {"2023-2025": 2},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "Hatton Garden",
    note: "Met Police LFR van - 1 deployment 2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.520049,
    lon: -0.108371,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: true
  },

  {
    name: "Heathway, Dagenham",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.536390,
    lon: 0.148201,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "High Road, Haringey",
    note: "Met Police LFR van - 3 deployments 2023-24",
    lat: 51.591166,
    lon: -0.104195,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 3,
    periods: {"2023-24": 3},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "High Street, Bexleyheath",
    note: "Met Police LFR van - 1 deployment 2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.440647,
    lon: 0.153083,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: true
  },

  {
    name: "High Street, Bromley",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.404694,
    lon: 0.015094,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "High Street, East Ham",
    note: "Met Police LFR van - 2 deployments 2023-24",
    lat: 51.539642,
    lon: -0.000115,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 2,
    periods: {"2023-24": 2},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "High Street, Harlesden",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.535102,
    lon: -0.243402,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "High Street, Hounslow",
    note: "Met Police LFR van - 3 deployments 2023-2025",
    lat: 51.470414,
    lon: -0.355498,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 3,
    periods: {"2023-2025": 3},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "High Street, Ilford",
    note: "Met Police LFR van - 6 deployments 2023-2025",
    lat: 51.580967,
    lon: 0.021934,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 6,
    periods: {"2023-2025": 6},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "High Street, Lewisham",
    note: "Met Police LFR van - 3 deployments 2023-2025",
    lat: 51.478673,
    lon: -0.026051,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 3,
    periods: {"2023-2025": 3},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "High Street, Sutton",
    note: "Met Police LFR van - 4 deployments 2023-2025",
    lat: 51.365440,
    lon: -0.194008,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 4,
    periods: {"2023-2025": 4},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "High Street, Uxbridge",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.546175,
    lon: -0.479465,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Holloway Road",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.552867,
    lon: -0.113009,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Hounslow",
    note: "Met Police LFR van - 4 deployments 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.468613,
    lon: -0.361347,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 4,
    periods: {"2023-24": 4},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Hounslow High Street",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.469580,
    lon: -0.357680,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Ilford",
    note: "Met Police LFR van - 3 deployments 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.558273,
    lon: 0.071167,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 3,
    periods: {"2023-24": 3},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Ilford High Street",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.569645,
    lon: 0.125724,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Islington",
    note: "Met Police LFR van - 2 deployments 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.538429,
    lon: -0.099905,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 2,
    periods: {"2023-24": 2},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Kilburn High Road",
    note: "Met Police LFR van - 5 deployments 2025",
    lat: 51.537748,
    lon: -0.191353,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 5,
    periods: {"2025": 5},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Kilburn Lane",
    note: "Met Police LFR van - 2 deployments 2025",
    lat: 51.528842,
    lon: -0.216062,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 2,
    periods: {"2025": 2},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "King Street, Hammersmith",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.492733,
    lon: -0.227664,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "King's Cross Central",
    note: "Private facial recognition by the site's developer 2016-2018, withdrawn 2019 after an ICO inquiry",
    lat: 51.535238,
    lon: -0.125401,
    type: "privatecam",
    status: "legacy",
    last: null,
    deployments: 1,
    periods: null,
    source_label: "The Register, 6 September 2019",
    source_url: "https://www.theregister.com/2019/09/06/metropolitan_police_facial/",
    approximate: false
  },

  {
    name: "King's Cross St Pancras",
    note: "British Transport Police LFR - 1 deployment in the 2026 station trial",
    lat: 51.530609,
    lon: -0.123949,
    type: "transportcam",
    status: "active",
    last: 2026,
    deployments: 1,
    periods: {"2026": 1},
    source_label: "British Transport Police LFR deployment register, 2026",
    source_url: "https://www.btp.police.uk/SysSiteAssets/media/images/british-transport-police/live-facial-recognition/lfr-deployment-register.pdf",
    approximate: false
  },

  {
    name: "King's Cross station",
    note: "British Transport Police LFR - 4 deployments in the 2026 station trial",
    lat: 51.530491,
    lon: -0.121655,
    type: "transportcam",
    status: "active",
    last: 2026,
    deployments: 4,
    periods: {"2026": 4},
    source_label: "British Transport Police LFR deployment register, 2026",
    source_url: "https://www.btp.police.uk/SysSiteAssets/media/images/british-transport-police/live-facial-recognition/lfr-deployment-register.pdf",
    approximate: false
  },

  {
    name: "Kings Cross",
    note: "Met Police LFR van - 3 deployments 2023-2025",
    lat: 51.532395,
    lon: -0.123022,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 3,
    periods: {"2023-2025": 3},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "Kings Street, Hammersmith",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.470192,
    lon: -0.210372,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Kingsland High Street",
    note: "Met Police LFR van - 2 deployments 2023-24",
    lat: 51.550198,
    lon: -0.075160,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 2,
    periods: {"2023-24": 2},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Kingston",
    note: "Met Police LFR van - 2 deployments 2023-24",
    lat: 51.412933,
    lon: -0.301820,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 2,
    periods: {"2023-24": 2},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Knightsbridge",
    note: "Met Police LFR van - 1 deployment 2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.500844,
    lon: -0.166965,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: true
  },

  {
    name: "Leicester",
    note: "Met Police LFR van - 1 deployment 2020-22",
    lat: 51.510777,
    lon: -0.130275,
    type: "vancam",
    status: "legacy",
    last: 2022,
    deployments: 1,
    periods: {"2020-22": 1},
    source_label: "Met Police LFR deployment record, 2020-22",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/new/lfr-deployment-grid-2020-2022.pdf",
    approximate: false
  },

  {
    name: "Leicester Square",
    note: "Met Police LFR van - 4 deployments 2025",
    lat: 51.509961,
    lon: -0.130394,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 4,
    periods: {"2025": 4},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Lewisham",
    note: "Met Police LFR van - 3 deployments 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.462429,
    lon: -0.010179,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 3,
    periods: {"2023-24": 3},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Lewisham High Street",
    note: "Met Police LFR van - 3 deployments 2025",
    lat: 51.462867,
    lon: -0.010360,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 3,
    periods: {"2025": 3},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Leyton",
    note: "Met Police LFR van - 1 deployment 2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.569673,
    lon: -0.015681,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: true
  },

  {
    name: "Liverpool Street station",
    note: "British Transport Police LFR - 2 deployments in the 2026 station trial",
    lat: 51.517264,
    lon: -0.080571,
    type: "transportcam",
    status: "active",
    last: 2026,
    deployments: 2,
    periods: {"2026": 2},
    source_label: "British Transport Police LFR deployment register, 2026",
    source_url: "https://www.btp.police.uk/SysSiteAssets/media/images/british-transport-police/live-facial-recognition/lfr-deployment-register.pdf",
    approximate: false
  },

  {
    name: "London Bridge",
    note: "Met Police LFR van - 3 deployments 2023-24",
    lat: 51.508049,
    lon: -0.087671,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 3,
    periods: {"2023-24": 3},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "London Bridge station",
    note: "British Transport Police LFR - 1 deployment in the 2026 station trial",
    lat: 51.504876,
    lon: -0.085147,
    type: "transportcam",
    status: "active",
    last: 2026,
    deployments: 1,
    periods: {"2026": 1},
    source_label: "British Transport Police LFR deployment register, 2026",
    source_url: "https://www.btp.police.uk/SysSiteAssets/media/images/british-transport-police/live-facial-recognition/lfr-deployment-register.pdf",
    approximate: false
  },

  {
    name: "London Road, Croydon",
    note: "Met Police - FIXED LFR cameras on street furniture, installed from Oct 2025",
    lat: 51.387128,
    lon: -0.111014,
    type: "fixedcam",
    status: "active",
    last: null,
    deployments: 1,
    periods: null,
    source_label: "Met Police press release, 13 May 2026",
    source_url: "https://news.met.police.uk/news/met-makes-one-arrest-every-35-minutes-during-live-facial-recognition-pilot-509256",
    approximate: false
  },

  {
    name: "London Road, Croydon",
    note: "Met Police LFR van - 2 deployments 2023-2025",
    lat: 51.387128,
    lon: -0.111014,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 2,
    periods: {"2023-2025": 2},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "London Road, Morden",
    note: "Met Police LFR van - 1 deployment 2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.395254,
    lon: -0.172116,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: true
  },

  {
    name: "Love Lane, Haringey",
    note: "Met Police LFR van - 2 deployments 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.604552,
    lon: -0.070489,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 2,
    periods: {"2023-24": 2},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Marble Arch",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.513184,
    lon: -0.158905,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Mare Street, Hackney",
    note: "Met Police LFR van - 3 deployments 2023-2025",
    lat: 51.541551,
    lon: -0.055248,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 3,
    periods: {"2023-2025": 3},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "North End Croydon",
    note: "Met Police LFR van - 7 deployments 2025",
    lat: 51.375660,
    lon: -0.101318,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 7,
    periods: {"2025": 7},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "North End, Croydon",
    note: "Met Police - FIXED LFR cameras on street furniture, installed from Oct 2025",
    lat: 51.377881,
    lon: -0.102542,
    type: "fixedcam",
    status: "active",
    last: null,
    deployments: 1,
    periods: null,
    source_label: "Met Police press release, 13 May 2026",
    source_url: "https://news.met.police.uk/news/met-makes-one-arrest-every-35-minutes-during-live-facial-recognition-pilot-509256",
    approximate: false
  },

  {
    name: "North End, Croydon",
    note: "Met Police LFR van - 21 deployments 2023-2025",
    lat: 51.377881,
    lon: -0.102542,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 21,
    periods: {"2023-2025": 21},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "Northumberland Park",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.601908,
    lon: -0.053865,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "O2 Arena",
    note: "Met Police LFR van - 2 deployments 2023-24",
    lat: 51.502937,
    lon: 0.003203,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 2,
    periods: {"2023-24": 2},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Oxford Circus",
    note: "Met Police LFR van - 16 deployments 2020-2025",
    lat: 51.515361,
    lon: -0.140779,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 16,
    periods: {"2020-2025": 16},
    source_label: "Met Police LFR deployment records, 2020-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "Oxford Street",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.515984,
    lon: -0.135174,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Paddington Station",
    note: "Met Police LFR van - 3 deployments 2025",
    lat: 51.515714,
    lon: -0.176603,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 3,
    periods: {"2025": 3},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Palace Exchange",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.651453,
    lon: -0.082013,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Peckham",
    note: "Met Police LFR van - 3 deployments 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.473412,
    lon: -0.069932,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 3,
    periods: {"2023-24": 3},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Peckham Rye",
    note: "Met Police LFR van - 2 deployments 2025",
    lat: 51.470006,
    lon: -0.069413,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 2,
    periods: {"2025": 2},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Piccadilly Circus",
    note: "Met Police LFR van - 3 deployments 2020-2025",
    lat: 51.510138,
    lon: -0.133936,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 3,
    periods: {"2020-2025": 3},
    source_label: "Met Police LFR deployment records, 2020-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "Piccadilly, Hard Rock",
    note: "Met Police LFR van - 2 deployments 2025",
    lat: 51.504078,
    lon: -0.148443,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 2,
    periods: {"2025": 2},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Poplar - Vesey Path",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.512129,
    lon: -0.014437,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Powis Street",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.492588,
    lon: 0.062603,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Powis Street, Woolwich",
    note: "Met Police LFR van - 9 deployments 2023-2025",
    lat: 51.492083,
    lon: 0.064301,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 9,
    periods: {"2023-2025": 9},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "Praed Street, Paddington",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.515479,
    lon: -0.175365,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Richmond",
    note: "Met Police LFR van - 1 deployment 2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.440553,
    lon: -0.307639,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: true
  },

  {
    name: "Richmond High Street",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.469623,
    lon: -0.263326,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Romford",
    note: "Met Police LFR van - 5 deployments 2023-2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.576046,
    lon: 0.182265,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 5,
    periods: {"2023-2025": 5},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: true
  },

  {
    name: "Rushey Green",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.447530,
    lon: -0.018176,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Rye Lane, Peckham",
    note: "Met Police LFR van - 5 deployments 2025",
    lat: 51.467074,
    lon: -0.065766,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 5,
    periods: {"2025": 5},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Sainsbury's Camden Town",
    note: "Sainsbury's - Facewatch store facial recognition, from early 2026",
    lat: 51.540516,
    lon: -0.140764,
    type: "facewatchcam",
    status: "active",
    last: null,
    deployments: 1,
    periods: null,
    source_label: "Retail Technology Innovation Hub, 1 July 2026",
    source_url: "https://retailtechinnovationhub.com/home/2026/7/1/sainsburys-expands-ai-powered-facial-recognition-technology-trial-in-partnership-with-facewatch",
    approximate: false
  },

  {
    name: "Sainsbury's Dalston",
    note: "Sainsbury's - Facewatch store facial recognition, from early 2026",
    lat: 51.547484,
    lon: -0.073206,
    type: "facewatchcam",
    status: "active",
    last: null,
    deployments: 1,
    periods: null,
    source_label: "Retail Technology Innovation Hub, 1 July 2026",
    source_url: "https://retailtechinnovationhub.com/home/2026/7/1/sainsburys-expands-ai-powered-facial-recognition-technology-trial-in-partnership-with-facewatch",
    approximate: false
  },

  {
    name: "Sainsbury's East Dulwich",
    note: "Sainsbury's - Facewatch store facial recognition, paused after a wrongful ejection",
    lat: 51.461793,
    lon: -0.084998,
    type: "facewatchcam",
    status: "legacy",
    last: null,
    deployments: 1,
    periods: null,
    source_label: "Retail Gazette, August 2026",
    source_url: "https://www.retailgazette.co.uk/blog/2026/08/sainsburys-pauses-ai-facial-recognition-cameras-after-shopper-wrongly-ejected/",
    approximate: false
  },

  {
    name: "Sainsbury's Elephant and Castle",
    note: "Sainsbury's - Facewatch store facial recognition, from early 2026",
    lat: 51.494570,
    lon: -0.097640,
    type: "facewatchcam",
    status: "active",
    last: null,
    deployments: 1,
    periods: null,
    source_label: "The Register, 6 February 2026",
    source_url: "https://www.theregister.com/2026/02/06/sainsburys_/",
    approximate: false
  },

  {
    name: "Sainsbury's Ladbroke Grove",
    note: "Sainsbury's - Facewatch store facial recognition, from early 2026",
    lat: 51.526296,
    lon: -0.217664,
    type: "facewatchcam",
    status: "active",
    last: null,
    deployments: 1,
    periods: null,
    source_label: "Retail Technology Innovation Hub, 1 July 2026",
    source_url: "https://retailtechinnovationhub.com/home/2026/7/1/sainsburys-expands-ai-powered-facial-recognition-technology-trial-in-partnership-with-facewatch",
    approximate: false
  },

  {
    name: "Sainsbury's Sydenham",
    note: "Sainsbury's - Facewatch store facial recognition, trial store from Sep 2025",
    lat: 51.430199,
    lon: -0.033317,
    type: "facewatchcam",
    status: "active",
    last: null,
    deployments: 1,
    periods: null,
    source_label: "The Grocer, July 2026",
    source_url: "https://www.thegrocer.co.uk/news/sainsburys-to-extend-facial-recognition-tech-to-200-stores-by-christmas/720799.article",
    approximate: false
  },

  {
    name: "Sainsbury's Whitechapel",
    note: "Sainsbury's - Facewatch store facial recognition, from early 2026",
    lat: 51.521013,
    lon: -0.058468,
    type: "facewatchcam",
    status: "active",
    last: null,
    deployments: 1,
    periods: null,
    source_label: "Retail Technology Innovation Hub, 1 July 2026",
    source_url: "https://retailtechinnovationhub.com/home/2026/7/1/sainsburys-expands-ai-powered-facial-recognition-technology-trial-in-partnership-with-facewatch",
    approximate: false
  },

  {
    name: "Selhurst Park, Holmesdale Road",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.398828,
    lon: -0.081188,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Selhurst Park, Norwood Junction",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.397090,
    lon: -0.074260,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Seven Sisters High Road",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.583201,
    lon: -0.072471,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Seven Sisters Road",
    note: "Met Police LFR van - 2 deployments 2025",
    lat: 51.562813,
    lon: -0.108782,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 2,
    periods: {"2025": 2},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Shepherds Bush",
    note: "Met Police LFR van - 2 deployments 2023-24",
    lat: 51.504054,
    lon: -0.224769,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 2,
    periods: {"2023-24": 2},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Shepherds Bush Green",
    note: "Met Police LFR van - 3 deployments 2025",
    lat: 51.504247,
    lon: -0.221755,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 3,
    periods: {"2025": 3},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Shoreditch High Street",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.523253,
    lon: -0.074467,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "South Bank",
    note: "Met Police LFR van - 1 deployment 2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.506532,
    lon: -0.113420,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: true
  },

  {
    name: "South Street, Romford",
    note: "Met Police LFR van - 6 deployments 2023-2025",
    lat: 51.572017,
    lon: 0.183993,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 6,
    periods: {"2023-2025": 6},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "Southall",
    note: "Met Police LFR van - 2 deployments 2023-2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.511146,
    lon: -0.375517,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 2,
    periods: {"2023-2025": 2},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: true
  },

  {
    name: "Southwark",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.505653,
    lon: -0.099565,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "St Ann's, Harrow",
    note: "Met Police LFR van - 2 deployments 2023-24",
    lat: 51.581937,
    lon: -0.333388,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 2,
    periods: {"2023-24": 2},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "St John's Hill, Clapham",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.463701,
    lon: -0.167961,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "St Pancras International",
    note: "British Transport Police LFR - 1 deployment in the 2026 station trial",
    lat: 51.532720,
    lon: -0.127003,
    type: "transportcam",
    status: "active",
    last: 2026,
    deployments: 1,
    periods: {"2026": 1},
    source_label: "British Transport Police LFR deployment register, 2026",
    source_url: "https://www.btp.police.uk/SysSiteAssets/media/images/british-transport-police/live-facial-recognition/lfr-deployment-register.pdf",
    approximate: false
  },

  {
    name: "Station Lane, Hornchurch",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.561243,
    lon: 0.221379,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Station Parade",
    note: "Met Police LFR van - 4 deployments 2025 (the record says only \"Station Parade\", and London has several - this pin is a guess)",
    lat: 51.548937,
    lon: 0.199284,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 4,
    periods: {"2025": 4},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Station Parade, Barking",
    note: "Met Police LFR van - 2 deployments 2023-24",
    lat: 51.538624,
    lon: 0.080492,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 2,
    periods: {"2023-24": 2},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Station Road, Hayes",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.502715,
    lon: -0.421300,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Stratford",
    note: "Met Police LFR van - 2 deployments 2020-24",
    lat: 51.541289,
    lon: -0.003547,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 2,
    periods: {"2020-24": 2},
    source_label: "Met Police LFR deployment records, 2020-24",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "Stratford Broadway",
    note: "Met Police LFR van - 7 deployments 2025",
    lat: 51.541374,
    lon: 0.002803,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 7,
    periods: {"2025": 7},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Stratford station",
    note: "British Transport Police LFR - 1 deployment in the 2026 station trial",
    lat: 51.541251,
    lon: -0.002268,
    type: "transportcam",
    status: "active",
    last: 2026,
    deployments: 1,
    periods: {"2026": 1},
    source_label: "British Transport Police LFR deployment register, 2026",
    source_url: "https://www.btp.police.uk/SysSiteAssets/media/images/british-transport-police/live-facial-recognition/lfr-deployment-register.pdf",
    approximate: false
  },

  {
    name: "Stratford Westfield",
    note: "Met Police LFR van - 6 deployments 2023-2025",
    lat: 51.543064,
    lon: -0.006417,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 6,
    periods: {"2023-2025": 6},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "Streatham High Road",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.417335,
    lon: -0.126424,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "T2 Heathrow Airport",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.469273,
    lon: -0.451799,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Thornton Heath",
    note: "Met Police LFR van - 2 deployments 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.399110,
    lon: -0.098606,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 2,
    periods: {"2023-24": 2},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Tooting",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.427821,
    lon: -0.167967,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Tooting Broadway",
    note: "Met Police LFR van - 9 deployments 2023-2025",
    lat: 51.427739,
    lon: -0.168291,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 9,
    periods: {"2023-2025": 9},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "Tottenham Court Road",
    note: "Met Police LFR van - 5 deployments 2023-2025",
    lat: 51.516134,
    lon: -0.132800,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 5,
    periods: {"2023-2025": 5},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "Tottenham Hale",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.588123,
    lon: -0.059944,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Town Square, Walthamstow",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.583780,
    lon: -0.021346,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Upton Park",
    note: "Met Police LFR van - 2 deployments 2025",
    lat: 51.535106,
    lon: 0.033984,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 2,
    periods: {"2025": 2},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Uxbridge",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.544951,
    lon: -0.481667,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Uxbridge Road, Shepherds",
    note: "Met Police LFR van - 2 deployments 2023-2025",
    lat: 51.506491,
    lon: -0.239410,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 2,
    periods: {"2023-2025": 2},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "Victoria station",
    note: "British Transport Police LFR - 5 deployments in the 2026 station trial",
    lat: 51.495052,
    lon: -0.144845,
    type: "transportcam",
    status: "active",
    last: 2026,
    deployments: 5,
    periods: {"2026": 5},
    source_label: "British Transport Police LFR deployment register, 2026",
    source_url: "https://www.btp.police.uk/SysSiteAssets/media/images/british-transport-police/live-facial-recognition/lfr-deployment-register.pdf",
    approximate: false
  },

  {
    name: "Victoria Street",
    note: "Met Police LFR van - 2 deployments 2025",
    lat: 51.497980,
    lon: -0.133591,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 2,
    periods: {"2025": 2},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Walthamstow",
    note: "Met Police LFR van - 3 deployments 2023-2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.584470,
    lon: -0.018819,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 3,
    periods: {"2023-2025": 3},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: true
  },

  {
    name: "Walthamstow Central",
    note: "Met Police LFR van - 6 deployments 2025",
    lat: 51.582893,
    lon: -0.019994,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 6,
    periods: {"2025": 6},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Walthamstow Market",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.582208,
    lon: -0.030573,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Walworth Road",
    note: "Met Police LFR van - 6 deployments 2023-2025",
    lat: 51.489848,
    lon: -0.096681,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 6,
    periods: {"2023-2025": 6},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "Walworth Road, Southwark",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.490318,
    lon: -0.096975,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Wardour Street, Westminster",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.510697,
    lon: -0.131629,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Waterloo station",
    note: "British Transport Police LFR - 3 deployments in the 2026 station trial",
    lat: 51.502678,
    lon: -0.112062,
    type: "transportcam",
    status: "active",
    last: 2026,
    deployments: 3,
    periods: {"2026": 3},
    source_label: "British Transport Police LFR deployment register, 2026",
    source_url: "https://www.btp.police.uk/SysSiteAssets/media/images/british-transport-police/live-facial-recognition/lfr-deployment-register.pdf",
    approximate: false
  },

  {
    name: "Wealdstone High Street",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.594309,
    lon: -0.335252,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Wembley",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.556069,
    lon: -0.279603,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Wembley Central",
    note: "Met Police LFR van - 6 deployments 2025",
    lat: 51.552328,
    lon: -0.296675,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 6,
    periods: {"2025": 6},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "West Croydon",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.378808,
    lon: -0.102039,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Westfield, Shepherds",
    note: "Met Police LFR van - 3 deployments 2023-2025",
    lat: 51.507848,
    lon: -0.221808,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 3,
    periods: {"2023-2025": 3},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: false
  },

  {
    name: "Westminster",
    note: "Met Police LFR van - 22 deployments 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.500444,
    lon: -0.126540,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 22,
    periods: {"2023-24": 22},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Westminster Bridge Street",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.501356,
    lon: -0.124930,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Westminster, Birdcage Walk",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.500825,
    lon: -0.134782,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Westminster, Piccadilly",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.509165,
    lon: -0.135700,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Westminster, Savoy Place",
    note: "Met Police LFR van - 1 deployment 2023-24 (pin marks the surrounding area, not an exact spot)",
    lat: 51.509162,
    lon: -0.121026,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: true
  },

  {
    name: "Westminster, The Mall",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.506082,
    lon: -0.130261,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Whitechapel",
    note: "Met Police LFR van - 3 deployments 2023-2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.517486,
    lon: -0.065968,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 3,
    periods: {"2023-2025": 3},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: true
  },

  {
    name: "Wimbledon Bridge",
    note: "Met Police LFR van - 1 deployment 2023-24",
    lat: 51.420942,
    lon: -0.206776,
    type: "vancam",
    status: "legacy",
    last: 2024,
    deployments: 1,
    periods: {"2023-24": 1},
    source_label: "Met Police LFR deployment record, 2023-24",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/lfr-deployment-grid-2023-to-2024.pdf",
    approximate: false
  },

  {
    name: "Wood Green",
    note: "Met Police LFR van - 3 deployments 2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.597205,
    lon: -0.109959,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 3,
    periods: {"2025": 3},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: true
  },

  {
    name: "Wood Green High Road",
    note: "Met Police LFR van - 1 deployment 2025",
    lat: 51.589876,
    lon: -0.105348,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 1,
    periods: {"2025": 1},
    source_label: "Met Police LFR deployment record, 2025",
    source_url: "https://www.met.police.uk/SysSiteAssets/media/downloads/force-content/met/advice/lfr/deployment-records/live-facial-recognition-deployment-record-2025.pdf",
    approximate: false
  },

  {
    name: "Woolwich",
    note: "Met Police LFR van - 8 deployments 2023-2025 (pin marks the surrounding area, not an exact spot)",
    lat: 51.482670,
    lon: 0.062334,
    type: "vancam",
    status: "legacy",
    last: 2025,
    deployments: 8,
    periods: {"2023-2025": 8},
    source_label: "Met Police LFR deployment records, 2023-2025",
    source_url: "https://www.met.police.uk/police-forces/metropolitan-police/areas/about-us/about-the-met/facial-recognition-technology/",
    approximate: true
  }

];
