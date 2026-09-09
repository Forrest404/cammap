#!/usr/bin/env node
/* ------------------------------------------------------------------
   cammap - the checks that need no browser

   Run it as  node tools/check.js  from anywhere. Plain Node, nothing
   installed, no framework: it loads data/points.js and
   frontend/shared.js exactly as the browser would and asks them the
   questions that have already been answered wrong once. There is no
   build step here and this does not add one. It is a checker, not a
   compiler - what is in the repository is still what the browser
   runs, and this only reads it.

   Each check names its case, and where the case is a camera it names
   the camera: "assertion failed" in a record of two hundred entries
   is not a finding. On success it prints one line. On failure it
   prints every failing case and exits non-zero, which is what lets a
   workflow refuse the commit.

   What is guarded, and why each one is here:

   The type table. CAMERA_TYPES is the one copy of what kinds of
   camera there are: the legend, every drop-down and every dot are
   painted from it, and style.css once held a second copy that
   nothing read. Two functions fall back to CAMERA_TYPES[1] *by
   position*, meaning the van colour - reorder the table and an
   unknown type quietly turns another colour, and nothing would say
   so. So the table's shape, its uniqueness, its colours and what
   sits in its second row are all pinned here.

   The paint expression. The map and the report form's picker colour
   their dots through typeColourExpression(), and a dot can never be
   a colour the legend does not show only for as long as that
   expression is built from the table, stop for stop. Its shape is
   checked as MapLibre will read it.

   The bounds. LONDON_BOUNDS is south-west then north-east, and the
   database repeats the numbers in three check constraints. MapLibre
   wants longitude first and everything else here wants latitude
   first, so a point with its coordinates the wrong way round has to
   fail inLondon(), not pass it; the corners, the edges and the swap
   are all tried.

   seed_key. It is how a database row says which published entry it
   is, built in JavaScript for the map and in SQL for the seed. The
   two have to agree to the character: a key that differs is a second
   row on the next seed run, and a moderator's correction lost on the
   next page load. They are documented as agreeing and were checked
   nowhere, so every row of seed.sql is read and its key rebuilt with
   seedKeyOf(). Six decimals, because that is how the record is
   written and a key with more would match nothing.

   The record. Every entry carries every field the seed carries, with
   the right kind of value; every camera is inside London; every van
   site is legacy - the choice "What active means" in NOTES.md
   explains, and the one build_points.py would undo if it turned up
   unchanged; and no two entries share a key.

   The GeoJSON download. data/cameras.geojson is the same record for
   map tools, written by the build script beside points.js. stamp.py
   proves it is what the CSV produces; this proves its shape against
   points.js as a tool would read it - a FeatureCollection, one Point
   per entry with longitude first, the public fields as properties in
   one order, a bbox inside London - so a change to the generator
   that broke the file for QGIS would be named here, not found by the
   next journalist to open it.

   The brightness rule. The halo under an approximate pin is drawn in
   the dot's colour dimmed to a ceiling, and brightnessOf() and
   dimTo() in shared.js are what dim it; their arithmetic is pinned
   here because a halo that came out brighter than a dot would be the
   one thing the map's whole tuning exists to prevent.

   The count of cameras is not asserted. It changes, and a number in
   a check that is expected to change is a number nobody keeps
   honest.
   ------------------------------------------------------------------ */

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var ROOT = path.resolve(__dirname, "..");

/* The fields the published record carries, and the seed with it. An
   entry missing one is a row the seed cannot write; an entry with one
   more is a field the seed silently drops. Add here when a field is
   added to both - and only then. */
var FIELDS = ["name", "note", "lat", "lon", "type", "status", "last", "deployments", "periods",
  "source_label", "source_url", "approximate"];

/* How the record's prose has always said a pin is not exact. The map
   must never have to look for this - that is what the approximate
   field is for - but the two must not disagree: a note that says it
   while the field says false is a column somebody blanked. The other
   direction is allowed, because a pin can be approximate for a reason
   the phrase does not cover ("this pin is a guess"). */
var APPROXIMATE_PHRASE = "(pin marks the surrounding area, not an exact spot)";

/* A source URL is https and has no whitespace in it. http is not
   accepted: every source this record cites is served over https, and
   a plain-http link on a page about surveillance would be its own
   small irony. */
var SOURCE_URL = /^https:\/\/\S+$/;

/* What the record says about status. The database also knows
   "nonfunctional", but that is a state a moderator sets on a row,
   never something the published file asserts about a camera. */
var STATUSES = ["active", "legacy"];

/* A period as the sources write one: a year, or a span written either
   way the Met writes it - "2023-24", "2023-2025". The same expression
   is the check constraint in schema.sql and PERIOD_KEY in
   build_points.py; change one, change the three. The key is the period
   exactly as the record states it, never a year the record does not
   give, which is why a per-year shape is not accepted here. */
var PERIOD_KEY = /^\d{4}(-\d{2}|-\d{4})?$/;

var HEX_COLOUR = /^#[0-9a-f]{6}$/i;

/* Where seedKeyOf must not be: the files that load after shared.js.
   A second copy in any of them would shadow the shared one and could
   drift from it without a word. */
var LATER_FILES = ["frontend/map.js", "frontend/picker.js", "frontend/account.js"];

/* ------------------------------------------------------------------
   Loading the site's files outside a browser

   shared.js makes one scrap of the page as it loads - the swatch the
   dark-map lift measures colours with - so it will not run in bare
   Node. This is the least of a browser that gets it through load,
   and deliberately no more: if shared.js grows another touch of the
   page at load time this fails, and that is the right moment to ask
   whether the new thing belongs in a shared file at all.
   ------------------------------------------------------------------ */

function browserStub() {
  var sandbox = {
    document: {
      createElement: function () { return { style: {} }; },
      body: { appendChild: function () {} }
    }
  };
  sandbox.window = sandbox;
  return vm.createContext(sandbox);
}

function readFile(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function load(context, file) {
  try {
    vm.runInContext(readFile(file), context, { filename: file });
    return true;
  } catch (err) {
    check("load " + file, false, err && err.message ? err.message : String(err));
    return false;
  }
}

/* ------------------------------------------------------------------
   The smallest possible harness

   check() records a verdict. section() runs a group of them and turns
   an exception into a named failure rather than a dead checker, so
   one broken thing never hides the others.
   ------------------------------------------------------------------ */

var checks = 0;
var failures = [];

function check(name, ok, detail) {
  checks++;
  if (!ok) {
    failures.push(name + (detail ? " - " + detail : ""));
  }
}

function section(name, fn) {
  try {
    fn();
  } catch (err) {
    checks++;
    failures.push(name + " - threw: " + (err && err.message ? err.message : String(err)));
  }
}

function sameJSON(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* Offenders are listed by name, the first few of them; a hundred
   names on one line say less than eight and a count. */
function listOf(items) {
  var shown = items.slice(0, 8).join(", ");
  return items.length > 8 ? shown + " and " + (items.length - 8) + " more" : shown;
}

function nameOf(entry, i) {
  return entry && typeof entry.name === "string" && entry.name ? entry.name : "entry #" + i;
}

function duplicatesIn(values) {
  var seen = {};
  var dups = [];
  var i;

  for (i = 0; i < values.length; i++) {
    if (seen[values[i]] === 1) {
      dups.push(values[i]);
    }
    seen[values[i]] = (seen[values[i]] || 0) + 1;
  }

  return dups;
}

function isInteger(v) {
  return typeof v === "number" && isFinite(v) && Math.floor(v) === v;
}

/* True when the number is what a six-decimal literal parses to, so
   toFixed(6) gives it back unchanged and the key is lossless. */
function sixDecimals(v) {
  return typeof v === "number" && isFinite(v) && Number(v.toFixed(6)) === v;
}

/* One row of seed.sql's insert, as far as this needs to read it: the
   name, the two coordinates, the type, and the seed_key it ends with.
   The note in between may hold anything - brackets, and apostrophes
   doubled the SQL way - so it is skipped rather than parsed, and the
   key is found by the 'seed' source column that always sits just
   before it. Finding it from the right instead would let a doubled
   apostrophe in a name (King''s Cross) start the key one quote too
   late. A row that no longer fits this shape is itself reported: it
   means the insert changed. */
var SEED_ROW = /^\s*\('((?:[^']|'')*)',\s*'(?:[^']|'')*',\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*'([a-z]+)',.*'seed',\s*'((?:[^']|'')*)'\),?\s*$/gm;

function seedRows() {
  var sql = readFile("backend/seed.sql");
  var rows = [];
  var m;

  SEED_ROW.lastIndex = 0;
  while ((m = SEED_ROW.exec(sql)) !== null) {
    rows.push({
      name: m[1].replace(/''/g, "'"),
      lat: Number(m[2]),
      lon: Number(m[3]),
      type: m[4],
      key: m[5].replace(/''/g, "'")
    });
  }

  return rows;
}

/* ------------------------------------------------------------------
   Load, then ask
   ------------------------------------------------------------------ */

var site = browserStub();
var havePoints = load(site, "data/points.js");
var haveShared = load(site, "frontend/shared.js");

if (havePoints && haveShared) {

  section("the type table", function () {
    var T = site.CAMERA_TYPES;
    var types = [];
    var colours = [];
    var labels = [];
    var badRows = [];
    var badColours = [];
    var i;
    var t;

    check("CAMERA_TYPES is a non-empty array", Array.isArray(T) && T.length > 0);
    if (!Array.isArray(T)) {
      return;
    }

    for (i = 0; i < T.length; i++) {
      t = T[i];
      if (!t || typeof t.type !== "string" || !t.type ||
          typeof t.colour !== "string" || typeof t.label !== "string" || !t.label) {
        badRows.push("row " + i + " " + JSON.stringify(t));
        continue;
      }
      types.push(t.type);
      colours.push(t.colour.toLowerCase());
      labels.push(t.label);
      if (!HEX_COLOUR.test(t.colour)) {
        badColours.push(t.type + " has colour " + JSON.stringify(t.colour));
      }
    }

    check("every CAMERA_TYPES row is {type, colour, label} strings", badRows.length === 0, listOf(badRows));
    check("CAMERA_TYPES colours are #rrggbb", badColours.length === 0, listOf(badColours));
    check("CAMERA_TYPES types are unique", duplicatesIn(types).length === 0, listOf(duplicatesIn(types)));
    check("CAMERA_TYPES colours are unique", duplicatesIn(colours).length === 0, listOf(duplicatesIn(colours)));
    check("CAMERA_TYPES labels are unique", duplicatesIn(labels).length === 0, listOf(duplicatesIn(labels)));

    /* colourOf() and typeColourExpression() both reach for the van
       colour as CAMERA_TYPES[1]. That is only the van colour while
       the van sits in the second row. */
    check("CAMERA_TYPES[1] is vancam, the fallback colour taken by position",
      T[1] && T[1].type === "vancam", "row 1 is " + (T[1] ? T[1].type : "missing"));

    check("NONFUNCTIONAL_COLOUR is #rrggbb", HEX_COLOUR.test(site.NONFUNCTIONAL_COLOUR),
      JSON.stringify(site.NONFUNCTIONAL_COLOUR));
    check("NONFUNCTIONAL_COLOUR is not also a kind's colour",
      colours.indexOf(String(site.NONFUNCTIONAL_COLOUR).toLowerCase()) === -1,
      site.NONFUNCTIONAL_COLOUR);

    /* It is a state, not a kind. In the table it would get a legend
       swatch and a drop-down entry, and be reportable as a type. */
    check("NONFUNCTIONAL_TYPE is a state, not a row in CAMERA_TYPES",
      typeof site.NONFUNCTIONAL_TYPE === "string" && types.indexOf(site.NONFUNCTIONAL_TYPE) === -1,
      String(site.NONFUNCTIONAL_TYPE));
  });

  section("colourOf", function () {
    var T = site.CAMERA_TYPES;
    var van = site.typeOf("vancam").colour;
    var unknowns = ["unicorncam", site.NONFUNCTIONAL_TYPE, "", undefined, null];
    var wrong = [];
    var strays = [];
    var i;
    var got;

    for (i = 0; i < T.length; i++) {
      got = site.colourOf(T[i].type);
      if (got !== T[i].colour) {
        wrong.push(T[i].type + " gave " + JSON.stringify(got));
      }
    }
    check("colourOf gives every kind its own colour", wrong.length === 0, listOf(wrong));

    for (i = 0; i < unknowns.length; i++) {
      got = site.colourOf(unknowns[i]);
      if (got !== van) {
        strays.push(JSON.stringify(unknowns[i]) + " gave " + JSON.stringify(got));
      }
    }
    check("colourOf falls back to the van colour for anything unknown", strays.length === 0, listOf(strays));
  });

  section("typeLabel", function () {
    var T = site.CAMERA_TYPES;
    var wrong = [];
    var i;
    var got;

    for (i = 0; i < T.length; i++) {
      got = site.typeLabel(T[i].type);
      if (got !== T[i].label) {
        wrong.push(T[i].type + " gave " + JSON.stringify(got));
      }
    }
    check("typeLabel gives every kind its own label", wrong.length === 0, listOf(wrong));
    check("typeLabel names the non-functional state",
      site.typeLabel(site.NONFUNCTIONAL_TYPE) === "Non-functional",
      JSON.stringify(site.typeLabel(site.NONFUNCTIONAL_TYPE)));
    check("typeLabel hands back an unknown identifier and blanks a missing one",
      site.typeLabel("unicorncam") === "unicorncam" &&
      site.typeLabel(undefined) === "" && site.typeLabel(null) === "" && site.typeLabel("") === "",
      JSON.stringify([site.typeLabel("unicorncam"), site.typeLabel(undefined), site.typeLabel(null)]));
  });

  section("the London box", function () {
    var B = site.LONDON_BOUNDS;
    var C = site.LONDON_CENTRE;
    var e = 0.0001;
    var sw;
    var ne;
    var corners;
    var outside;
    var i;
    var bad;

    var shape = Array.isArray(B) && B.length === 2 &&
      Array.isArray(B[0]) && Array.isArray(B[1]) && B[0].length === 2 && B[1].length === 2 &&
      isFinite(B[0][0]) && isFinite(B[0][1]) && isFinite(B[1][0]) && isFinite(B[1][1]);
    check("LONDON_BOUNDS is two [lat, lon] pairs", shape, JSON.stringify(B));
    if (!shape) {
      return;
    }
    sw = B[0];
    ne = B[1];

    check("LONDON_BOUNDS south-west corner is south and west of the north-east one",
      sw[0] < ne[0] && sw[1] < ne[1], JSON.stringify(B));
    check("LONDON_CENTRE is a [lat, lon] pair inside LONDON_BOUNDS",
      Array.isArray(C) && C.length === 2 && site.inLondon(C[0], C[1]), JSON.stringify(C));

    corners = [[sw[0], sw[1]], [sw[0], ne[1]], [ne[0], sw[1]], [ne[0], ne[1]]];
    bad = [];
    for (i = 0; i < corners.length; i++) {
      if (!site.inLondon(corners[i][0], corners[i][1])) {
        bad.push(JSON.stringify(corners[i]));
      }
    }
    check("inLondon accepts all four corners of the box", bad.length === 0, listOf(bad));

    outside = [[sw[0] - e, C[1]], [ne[0] + e, C[1]], [C[0], sw[1] - e], [C[0], ne[1] + e]];
    bad = [];
    for (i = 0; i < outside.length; i++) {
      if (site.inLondon(outside[i][0], outside[i][1])) {
        bad.push(JSON.stringify(outside[i]));
      }
    }
    check("inLondon rejects a point just past each edge", bad.length === 0, listOf(bad));

    /* MapLibre is longitude-first; the rest of the project is not.
       A swap has to fail here, or it fails on the map instead. */
    check("inLondon rejects the centre with lat and lon swapped", !site.inLondon(C[1], C[0]));
  });

  section("typeColourExpression", function () {
    var T = site.CAMERA_TYPES;
    var before = JSON.stringify(T);
    var expr = site.typeColourExpression();
    var again = site.typeColourExpression();
    var match;
    var wrong = [];
    var i;

    check("typeColourExpression is a case on status nonfunctional first",
      Array.isArray(expr) && expr.length === 4 && expr[0] === "case" &&
      sameJSON(expr[1], ["==", ["get", "status"], "nonfunctional"]) &&
      expr[2] === site.NONFUNCTIONAL_COLOUR,
      JSON.stringify(expr && expr.slice(0, 3)));
    match = Array.isArray(expr) ? expr[3] : null;

    check("typeColourExpression then matches on type",
      Array.isArray(match) && match[0] === "match" && sameJSON(match[1], ["get", "type"]),
      JSON.stringify(match && match.slice(0, 2)));
    if (!Array.isArray(match)) {
      return;
    }

    check("typeColourExpression has one type and one colour per kind, then a fallback",
      match.length === 2 + 2 * T.length + 1,
      "length " + match.length + " for " + T.length + " kinds");
    for (i = 0; i < T.length; i++) {
      if (match[2 + 2 * i] !== T[i].type || match[3 + 2 * i] !== T[i].colour) {
        wrong.push(T[i].type + " at stop " + i + ": " + JSON.stringify([match[2 + 2 * i], match[3 + 2 * i]]));
      }
    }
    check("typeColourExpression lists every kind with its colour, in table order", wrong.length === 0, listOf(wrong));
    check("typeColourExpression falls back to the van colour",
      match[match.length - 1] === site.typeOf("vancam").colour,
      JSON.stringify(match[match.length - 1]));
    check("typeColourExpression is pure",
      sameJSON(expr, again) && JSON.stringify(T) === before);
  });

  section("periodSpan and periodYears", function () {
    var P = site.POINTS;
    var keys = {};
    var wrong = [];
    var i;
    var k;
    var span;
    var m;
    var years;

    check("periodSpan is a function in shared.js", typeof site.periodSpan === "function");
    check("periodYears is a function in shared.js", typeof site.periodYears === "function");
    if (typeof site.periodSpan !== "function" || typeof site.periodYears !== "function") {
      return;
    }

    /* The three shapes, with the century arithmetic period_span() in
       build_points.py does: a two-digit tail takes the start's century. */
    check("periodSpan reads YYYY, YYYY-YY and YYYY-YYYY",
      sameJSON(site.periodSpan("2025"), [2025, 2025]) &&
      sameJSON(site.periodSpan("2023-24"), [2023, 2024]) &&
      sameJSON(site.periodSpan("2020-2025"), [2020, 2025]) &&
      sameJSON(site.periodSpan("2020-22"), [2020, 2022]),
      JSON.stringify([site.periodSpan("2025"), site.periodSpan("2023-24"), site.periodSpan("2020-2025")]));
    check("periodSpan gives a two-digit tail the start's century, as period_span() does",
      sameJSON(site.periodSpan("1999-01"), [1999, 1901]));

    /* Every key in the record, against the same reading done by hand
       from the regular expression: the span starts at the first four
       digits and ends at the tail read the same way. */
    for (i = 0; i < P.length; i++) {
      if (P[i].periods) {
        for (k in P[i].periods) {
          if (Object.prototype.hasOwnProperty.call(P[i].periods, k)) {
            keys[k] = true;
          }
        }
      }
    }
    for (k in keys) {
      if (keys.hasOwnProperty(k)) {
        m = /^(\d{4})(?:-(\d{2}|\d{4}))?$/.exec(k);
        span = site.periodSpan(k);
        if (!m || span[0] !== Number(m[1]) ||
            span[1] !== (m[2] === undefined ? Number(m[1]) : (m[2].length === 4 ? Number(m[2]) : Number(m[1].slice(0, 2) + m[2]))) ||
            span[0] > span[1]) {
          wrong.push(k + " -> " + JSON.stringify(span));
        }
      }
    }
    check("periodSpan reads every key in the record, start no later than end", wrong.length === 0, listOf(wrong));

    years = site.periodYears({ "2020-22": 1, "2025": 3, "2023-24": 1 });
    check("periodYears lists each covered year once, earliest first",
      sameJSON(years, [2020, 2021, 2022, 2023, 2024, 2025]), JSON.stringify(years));
    check("periodYears of null is null, not an empty list",
      site.periodYears(null) === null && site.periodYears(undefined) === null);
  });

  section("the GeoJSON download", function () {
    var P = site.POINTS;
    var B = site.LONDON_BOUNDS;
    var PROPS = ["name", "note", "type", "status", "last", "deployments", "periods",
      "source_label", "source_url", "approximate", "seed_key"];
    var g;
    var f;
    var i;
    var k;
    var keys;
    var who;
    var off = { geometry: [], keys: [], values: [], key: [] };
    var bbox;

    try {
      g = JSON.parse(readFile("data/cameras.geojson"));
    } catch (err) {
      check("data/cameras.geojson is JSON", false, err && err.message);
      return;
    }

    check("cameras.geojson is a FeatureCollection", g && g.type === "FeatureCollection" && Array.isArray(g.features));
    if (!g || !Array.isArray(g.features)) {
      return;
    }
    check("one feature per camera, in the record's order", g.features.length === P.length,
      g.features.length + " features for " + P.length + " cameras");

    /* [west, south, east, north], and inside the London box: a tool
       that reads the bbox first should never be pointed off the map. */
    bbox = g.bbox;
    check("bbox is [west, south, east, north] inside LONDON_BOUNDS",
      Array.isArray(bbox) && bbox.length === 4 &&
      bbox[0] <= bbox[2] && bbox[1] <= bbox[3] &&
      site.inLondon(bbox[1], bbox[0]) && site.inLondon(bbox[3], bbox[2]),
      JSON.stringify(bbox));

    /* Longitude first in the geometry - GeoJSON's order, the reverse
       of the record's - and the position the same six-decimal number
       points.js has; the properties exactly the public fields, in one
       order, with the values points.js carries; and seed_key what
       seedKeyOf() writes for the entry, since it is the join. */
    for (i = 0; i < Math.min(g.features.length, P.length); i++) {
      f = g.features[i];
      who = nameOf(P[i], i);
      if (!f || f.type !== "Feature" || !f.geometry || f.geometry.type !== "Point" ||
          !Array.isArray(f.geometry.coordinates) || f.geometry.coordinates.length !== 2 ||
          f.geometry.coordinates[0] !== P[i].lon || f.geometry.coordinates[1] !== P[i].lat) {
        off.geometry.push(who + " " + JSON.stringify(f && f.geometry));
        continue;
      }
      keys = Object.keys(f.properties || {});
      if (!sameJSON(keys, PROPS)) {
        off.keys.push(who + " " + JSON.stringify(keys));
        continue;
      }
      for (k = 0; k < PROPS.length - 1; k++) {
        if (!sameJSON(f.properties[PROPS[k]], P[i][PROPS[k]])) {
          off.values.push(who + " " + PROPS[k] + ": " + JSON.stringify(f.properties[PROPS[k]]) + " for " + JSON.stringify(P[i][PROPS[k]]));
        }
      }
      if (typeof site.seedKeyOf === "function" && f.properties.seed_key !== site.seedKeyOf(P[i])) {
        off.key.push(who + " " + JSON.stringify(f.properties.seed_key));
      }
    }
    check("every feature is a Point at [lon, lat] of its entry", off.geometry.length === 0, listOf(off.geometry));
    check("every feature carries exactly the public fields, in order", off.keys.length === 0, listOf(off.keys));
    check("every property is the value points.js has", off.values.length === 0, listOf(off.values));
    check("every feature's seed_key is what seedKeyOf writes for its entry", off.key.length === 0, listOf(off.key));
  });

  section("the brightness rule", function () {
    var T = site.CAMERA_TYPES;
    var ceiling = 128;
    var over = [];
    var offHue = [];
    var i;
    var dimmed;
    var a;
    var b;

    check("brightnessOf is the perceived scale: white 255, black 0, the fixed red 134",
      typeof site.brightnessOf === "function" &&
      site.brightnessOf("#ffffff") === 255 && site.brightnessOf("#000000") === 0 &&
      Math.round(site.brightnessOf("#cf6a58")) === 134,
      typeof site.brightnessOf === "function" ? String(site.brightnessOf("#cf6a58")) : "missing");
    if (typeof site.dimTo !== "function") {
      check("dimTo is a function in shared.js", false);
      return;
    }

    /* The halo under an approximate pin is every kind's colour dimmed
       to the ceiling: at or under it afterwards, the hue kept (the
       channels scale together), and a colour already under it left
       exactly as it is. */
    for (i = 0; i < T.length; i++) {
      dimmed = site.dimTo(T[i].colour, ceiling);
      if (!HEX_COLOUR.test(dimmed) || site.brightnessOf(dimmed) > ceiling) {
        over.push(T[i].type + " -> " + dimmed + " (" + site.brightnessOf(dimmed) + ")");
      }
      a = [1, 3, 5].map(function (p) { return parseInt(T[i].colour.slice(p, p + 2), 16); });
      b = [1, 3, 5].map(function (p) { return parseInt(dimmed.slice(p, p + 2), 16); });
      /* the same factor on every channel, to within the rounding */
      if (Math.abs(b[0] * a[1] - b[1] * a[0]) > a[0] + a[1] || Math.abs(b[2] * a[1] - b[1] * a[2]) > a[2] + a[1]) {
        offHue.push(T[i].type + " " + T[i].colour + " -> " + dimmed);
      }
    }
    check("dimTo brings every kind's colour to the ceiling or under", over.length === 0, listOf(over));
    check("dimTo keeps the hue: every channel scaled by the same factor", offHue.length === 0, listOf(offHue));
    check("dimTo leaves a colour already under the ceiling alone",
      site.dimTo("#0d0d0d", ceiling) === "#0d0d0d" && site.dimTo("#5c5c5c", ceiling) === "#5c5c5c");
    check("dimTo of the non-functional colour is under the ceiling",
      site.brightnessOf(site.dimTo(site.NONFUNCTIONAL_COLOUR, ceiling)) <= ceiling);
  });

  section("seedKeyOf", function () {
    var rows;
    var wrong = [];
    var copies = [];
    var i;
    var k;

    check("seedKeyOf is a function in shared.js", typeof site.seedKeyOf === "function");
    if (typeof site.seedKeyOf !== "function") {
      return;
    }

    check("seedKeyOf writes name|lat|lon|type",
      site.seedKeyOf({ name: "Acton", lat: 51.508140, lon: -0.273261, type: "vancam" }) === "Acton|51.508140|-0.273261|vancam",
      site.seedKeyOf({ name: "Acton", lat: 51.508140, lon: -0.273261, type: "vancam" }));
    check("seedKeyOf pads and rounds to six decimals",
      site.seedKeyOf({ name: "X", lat: 51.5, lon: -0.1, type: "fixedcam" }) === "X|51.500000|-0.100000|fixedcam" &&
      site.seedKeyOf({ name: "X", lat: 51.12345678, lon: -0.98765432, type: "fixedcam" }) === "X|51.123457|-0.987654|fixedcam",
      site.seedKeyOf({ name: "X", lat: 51.5, lon: -0.1, type: "fixedcam" }) + " / " +
      site.seedKeyOf({ name: "X", lat: 51.12345678, lon: -0.98765432, type: "fixedcam" }));

    for (i = 0; i < LATER_FILES.length; i++) {
      if (/function\s+seedKeyOf\s*\(/.test(readFile(LATER_FILES[i]))) {
        copies.push(LATER_FILES[i]);
      }
    }
    check("seedKeyOf is defined once, in shared.js", copies.length === 0, "also in " + listOf(copies));

    rows = seedRows();
    check("seed.sql has rows this checker can read", rows.length > 0);
    for (i = 0; i < rows.length; i++) {
      k = site.seedKeyOf(rows[i]);
      if (k !== rows[i].key) {
        wrong.push(rows[i].name + ": js " + k + " / sql " + rows[i].key);
      }
    }
    check("every seed.sql key is what seedKeyOf writes for that row", wrong.length === 0, listOf(wrong));
  });

  section("the record", function () {
    var P = site.POINTS;
    var T = site.CAMERA_TYPES;
    var known = {};
    var keys = {};
    var off = {
      fields: [], name: [], note: [], coords: [], type: [], status: [],
      last: [], deployments: [], periods: [], periodsSum: [], sourceLabel: [], sourceUrl: [],
      approximate: [], approximateNote: [], london: [], van: [], dupKey: []
    };
    var i;
    var e;
    var who;
    var f;
    var missing;
    var extra;
    var k;
    var total;
    var keysSeen;
    var badPeriod;

    check("POINTS is a non-empty array", Array.isArray(P) && P.length > 0);
    if (!Array.isArray(P)) {
      return;
    }
    for (i = 0; i < T.length; i++) {
      known[T[i].type] = true;
    }

    for (i = 0; i < P.length; i++) {
      e = P[i];
      who = nameOf(e, i);

      if (!e || typeof e !== "object") {
        off.fields.push(who + " is not an object");
        continue;
      }

      missing = [];
      extra = [];
      for (f = 0; f < FIELDS.length; f++) {
        if (!Object.prototype.hasOwnProperty.call(e, FIELDS[f])) {
          missing.push(FIELDS[f]);
        }
      }
      for (f in e) {
        if (Object.prototype.hasOwnProperty.call(e, f) && FIELDS.indexOf(f) === -1) {
          extra.push(f);
        }
      }
      if (missing.length || extra.length) {
        off.fields.push(who + (missing.length ? " missing " + missing.join("/") : "") +
          (extra.length ? " extra " + extra.join("/") : ""));
      }

      if (typeof e.name !== "string" || e.name === "" || e.name !== e.name.trim()) {
        off.name.push(who + " " + JSON.stringify(e.name));
      }
      if (typeof e.note !== "string") {
        off.note.push(who);
      }
      if (!sixDecimals(e.lat) || !sixDecimals(e.lon)) {
        off.coords.push(who + " " + JSON.stringify([e.lat, e.lon]));
      }
      if (!known[e.type]) {
        off.type.push(who + " " + JSON.stringify(e.type));
      }
      if (STATUSES.indexOf(e.status) === -1) {
        off.status.push(who + " " + JSON.stringify(e.status));
      }
      if (!(e.last === null || (isInteger(e.last) && e.last >= 2000 && e.last <= 2100))) {
        off.last.push(who + " " + JSON.stringify(e.last));
      }
      if (!(isInteger(e.deployments) && e.deployments >= 1)) {
        off.deployments.push(who + " " + JSON.stringify(e.deployments));
      }

      /* periods is null, or a plain object of period keys to positive
         integers with at least one of them; and where it is given,
         deployments is its sum - the glow and "Most used" read the
         total, the popup will read the breakdown, and a record where
         the two disagreed would be showing two different histories
         for one camera. */
      if (e.periods !== null) {
        if (!e.periods || typeof e.periods !== "object" || Array.isArray(e.periods)) {
          off.periods.push(who + " " + JSON.stringify(e.periods));
        } else {
          total = 0;
          keysSeen = 0;
          badPeriod = false;
          for (k in e.periods) {
            if (Object.prototype.hasOwnProperty.call(e.periods, k)) {
              keysSeen++;
              if (!PERIOD_KEY.test(k) || !isInteger(e.periods[k]) || e.periods[k] < 1) {
                badPeriod = true;
              } else {
                total += e.periods[k];
              }
            }
          }
          if (keysSeen === 0 || badPeriod) {
            off.periods.push(who + " " + JSON.stringify(e.periods));
          } else if (total !== e.deployments) {
            off.periodsSum.push(who + " periods add up to " + total + " but deployments is " + JSON.stringify(e.deployments));
          }
        }
      }

      /* A source is null, or a label, or a label and a URL. A label is
         a non-empty string with no surrounding whitespace; a URL is
         https; a URL without a label is a link with no name, which is
         not a citation, and the popup would have nothing to show for
         it but the address. */
      if (!(e.source_label === null ||
            (typeof e.source_label === "string" && e.source_label !== "" && e.source_label === e.source_label.trim()))) {
        off.sourceLabel.push(who + " " + JSON.stringify(e.source_label));
      }
      if (!(e.source_url === null || (typeof e.source_url === "string" && SOURCE_URL.test(e.source_url)))) {
        off.sourceUrl.push(who + " " + JSON.stringify(e.source_url));
      } else if (e.source_url !== null && e.source_label === null) {
        off.sourceUrl.push(who + " has a source_url and no source_label");
      }

      if (typeof e.approximate !== "boolean") {
        off.approximate.push(who + " " + JSON.stringify(e.approximate));
      } else if (!e.approximate && typeof e.note === "string" && e.note.indexOf(APPROXIMATE_PHRASE) !== -1) {
        off.approximateNote.push(who);
      }

      if (typeof e.lat === "number" && typeof e.lon === "number" && !site.inLondon(e.lat, e.lon)) {
        off.london.push(who + " " + JSON.stringify([e.lat, e.lon]));
      }
      if (e.type === "vancam" && e.status !== "legacy") {
        off.van.push(who + " is vancam but " + JSON.stringify(e.status));
      }
      if (typeof e.name === "string" && typeof e.lat === "number" && typeof e.lon === "number" &&
          typeof site.seedKeyOf === "function") {
        k = site.seedKeyOf(e);
        if (keys[k]) {
          off.dupKey.push(k);
        }
        keys[k] = true;
      }
    }

    check("every entry has exactly the fields the seed carries", off.fields.length === 0, listOf(off.fields));
    check("every name is a non-empty string with no surrounding whitespace", off.name.length === 0, listOf(off.name));
    check("every note is a string", off.note.length === 0, listOf(off.note));
    check("every lat and lon is a finite number of at most six decimals", off.coords.length === 0, listOf(off.coords));
    check("every type is in CAMERA_TYPES", off.type.length === 0, listOf(off.type));
    check("every status is active or legacy", off.status.length === 0, listOf(off.status));
    check("every last is null or an integer year", off.last.length === 0, listOf(off.last));
    check("every deployments is an integer of at least 1", off.deployments.length === 0, listOf(off.deployments));
    check("every periods is null or an object of period keys to positive integers", off.periods.length === 0, listOf(off.periods));
    check("every deployments is the sum of its periods where periods is given", off.periodsSum.length === 0, listOf(off.periodsSum));
    check("every source_label is null or a trimmed non-empty string", off.sourceLabel.length === 0, listOf(off.sourceLabel));
    check("every source_url is null or https, and never without a label", off.sourceUrl.length === 0, listOf(off.sourceUrl));
    check("every approximate is a boolean", off.approximate.length === 0, listOf(off.approximate));
    check("every note that says the pin marks the surrounding area has approximate true", off.approximateNote.length === 0, listOf(off.approximateNote));
    check("every camera is in London", off.london.length === 0, listOf(off.london));
    check("every vancam is legacy", off.van.length === 0, listOf(off.van));
    check("seed keys are unique across the record", off.dupKey.length === 0, listOf(off.dupKey));
  });
}

/* ------------------------------------------------------------------
   The verdict. One line when everything holds; every failing case
   when it does not, and a non-zero exit so nothing downstream can
   mistake the second for the first.
   ------------------------------------------------------------------ */

var cameras = Array.isArray(site.POINTS) ? site.POINTS.length : 0;
var i;

if (failures.length) {
  for (i = 0; i < failures.length; i++) {
    console.log("FAIL " + failures[i]);
  }
  console.log("check: " + failures.length + " of " + checks + " checks failed");
  process.exitCode = 1;
} else {
  console.log("check: " + checks + " checks over " + cameras + " cameras, all pass");
}
