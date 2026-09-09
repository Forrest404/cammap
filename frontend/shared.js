/* ------------------------------------------------------------------
   cammap - the things both map.js and account.js need to agree on

   Plain browser JavaScript, same rules as the rest: no build step, no
   modules, var and named functions. Loaded before map.js and
   account.js on every page.

   What is in here is what was being written out more than once. The
   kinds of camera were in five places - the colour table in map.js,
   a label table in account.js, and a hand-typed <option> list in each
   of index.html, report.html and moderate.html - so adding a kind of
   camera meant five edits and any one of them could be forgotten. The
   type identifiers are what make this map carry over to another city,
   which is exactly the thing that should not be able to drift.

   The database keeps its own copies of both tables below, in the
   `cameras_type_check` constraint and the London `check` constraints
   in backend/schema.sql. That is deliberate: the server has to be
   able to refuse a bad row on its own, without trusting anything a
   browser sent. Change one and change the other.
   ------------------------------------------------------------------ */

/* One colour per kind of camera. This table is the only place the
   colours are written: style.css does NOT keep a copy, and the dots,
   the legend and the picker's context dots are all painted from here.
   Colour always means what a thing IS. Whether it works now is said by the
   fill instead: an active camera is a solid dot, a legacy one is a
   hollow ring in the same colour, and a non-functional one is filled
   in a colour of its own regardless of type.

   The order here is the order the legend and every drop-down show. */
var CAMERA_TYPES = [
  { type: "fixedcam",     colour: "#cf6a58", label: "Fixed LFR camera" },
  { type: "vancam",       colour: "#e0a458", label: "LFR van site" },
  { type: "transportcam", colour: "#6aa8d8", label: "Transport police" },
  { type: "facewatchcam", colour: "#7bbf7b", label: "Shop (Facewatch)" },
  { type: "privatecam",   colour: "#8a8a8a", label: "Private" }
];

var NONFUNCTIONAL_COLOUR = "#b58bd6";

/* Not a kind of camera anyone reports as such - it is a state, and
   the map draws it in the colour above whatever the type. It has a
   name here because saved_cameras and the older report rows can carry
   it, and a row with it should not show as a bare identifier. */
var NONFUNCTIONAL_TYPE = "nonfunccam";

/* South-west corner, then north-east: Heathrow across to Upminster,
   Coulsdon up to Enfield. All 32 boroughs and the City. Moving the
   map to another city is this, LONDON_CENTRE just below, the three
   check constraints in schema.sql, and the opening zoom in map.js. */
var LONDON_BOUNDS = [[51.28, -0.51], [51.70, 0.33]];

/* Where a map opens when it has no reason to look anywhere else.
   Both maps use it, so it is here rather than in either of them. */
var LONDON_CENTRE = [51.5074, -0.1278];

/* How far the record reaches, and when somebody last looked. These
   three are typed by hand when the record is refreshed, and nothing
   else dates the data: a visitor cannot tell a current map from an
   abandoned one without them, and it is the first thing a sceptical
   reader checks. The map page writes them under the map beside a
   count it works out from the record itself, so the count can never
   go stale silently; these can, which is why they are in one place
   with a comment on them and nowhere else.

     met      the last year of the Met's LFR deployment records the
              record holds. The Met has published a 2026 record; it
              refuses scripted download and has not been added (the
              TODO in NOTES.md), so this stays 2025 until it is.
     btp      the year of the British Transport Police register the
              nine station entries come from.
     checked  when the sources were last looked at for anything new,
              as a month, because a day would claim a precision the
              checking does not have.

   When the record is refreshed: update data/cameras.csv, run
   tools/build_points.py, change these, and make img/share.png again
   if the count moved - the card carries the count as a picture, and
   the two should move together. */
var RECORD_SOURCES = { met: 2025, btp: 2026, checked: "September 2026" };

function inLondon(lat, lon) {
  return lat >= LONDON_BOUNDS[0][0] && lat <= LONDON_BOUNDS[1][0] &&
         lon >= LONDON_BOUNDS[0][1] && lon <= LONDON_BOUNDS[1][1];
}

/* ---------------- the periods a record gives ----------------

   A camera's `periods` is counted by the period the source gives -
   {"2023-24": 1, "2025": 3} - and a key is YYYY, YYYY-YY or YYYY-YYYY,
   the whole of the vocabulary the sources use (NOTES.md, "Deployments
   by period"). The year scrubber on the map needs to know which years
   a key covers, and nothing else may guess at that: a span covers
   every year from its first to its last inclusive, and a two-digit
   tail takes the century of the start, so "2023-24" is 2023 and 2024
   and "2020-2025" is six years. That is all a period says. It does
   not say which of those years a deployment fell in, which is why the
   scrubber shows a site in every year its period covers and never
   picks one.

   periodSpan() is the twin of period_span() in tools/build_points.py
   - same rule, same century arithmetic - and tools/check.js holds the
   two together by running it over every key in the record. Change
   one, change the other. */
function periodSpan(key) {
  var start = parseInt(key.slice(0, 4), 10);
  var tail = key.slice(5);

  if (key.length === 4) {
    return [start, start];
  }

  return [start, tail.length === 4 ? parseInt(tail, 10) : parseInt(key.slice(0, 2) + tail, 10)];
}

/* Every year a periods object covers, each once, earliest first; null
   where the record names no period - which is the case for a shop, a
   fixed install and the King's Cross estate, and means "no year is
   claimed", not "no year". */
function periodYears(periods) {
  var years = [];
  var key;
  var span;
  var y;

  if (!periods || typeof periods !== "object") {
    return null;
  }

  for (key in periods) {
    if (periods.hasOwnProperty(key)) {
      span = periodSpan(key);
      for (y = span[0]; y <= span[1]; y++) {
        if (years.indexOf(y) === -1) {
          years.push(y);
        }
      }
    }
  }

  years.sort(function (a, b) { return a - b; });

  return years;
}

/* seed_key is how a database row says which seed entry it is. It is
   built the same way here as in the build script, so they agree. */
function seedKeyOf(point) {
  return point.name + "|" + point.lat.toFixed(6) + "|" + point.lon.toFixed(6) + "|" + point.type;
}

function typeOf(type) {
  var i;

  for (i = 0; i < CAMERA_TYPES.length; i++) {
    if (CAMERA_TYPES[i].type === type) {
      return CAMERA_TYPES[i];
    }
  }

  return null;
}

/* An unknown type draws as a van site: it is what the seed is almost
   entirely made of, and a dot in the wrong colour is better than no
   dot at all. */
function colourOf(type) {
  var found = typeOf(type);

  return found ? found.colour : CAMERA_TYPES[1].colour;
}

function typeLabel(type) {
  var found = typeOf(type);

  if (found) {
    return found.label;
  }
  if (type === NONFUNCTIONAL_TYPE) {
    return "Non-functional";
  }

  return type || "";
}

/* The paint expression for "what colour is this dot": non-functional
   overrides everything, otherwise the type decides. Built from the
   table above, so a dot can never be a colour the legend does not
   show. Used by the map and by the picker on the report page. */
function typeColourExpression() {
  var match = ["match", ["get", "type"]];
  var i;

  for (i = 0; i < CAMERA_TYPES.length; i++) {
    match.push(CAMERA_TYPES[i].type, CAMERA_TYPES[i].colour);
  }
  match.push(CAMERA_TYPES[1].colour);   /* fallback: the van colour */

  return ["case", ["==", ["get", "status"], "nonfunctional"], NONFUNCTIONAL_COLOUR, match];
}

/* What the record adds up to, for a page that states it in words -
   the press page - worked out from the entries and never typed, for
   the reason the count line under the map is: a number in prose goes
   stale without a sound. The total, the count per kind in
   CAMERA_TYPES order, how many pins the record marks approximate, how
   many entries carry a period, and the first and last year any period
   covers (null where none does). Pure, so tools/check.js can hold it
   against the record. */
function recordCounts(list) {
  var out = { total: 0, byType: {}, approximate: 0, dated: 0, from: null, to: null };
  var i;
  var years;

  for (i = 0; i < CAMERA_TYPES.length; i++) {
    out.byType[CAMERA_TYPES[i].type] = 0;
  }

  for (i = 0; i < list.length; i++) {
    out.total++;
    out.byType[list[i].type] = (out.byType[list[i].type] || 0) + 1;
    if (list[i].approximate === true) {
      out.approximate++;
    }
    years = periodYears(list[i].periods);
    if (years && years.length) {
      out.dated++;
      out.from = out.from === null ? years[0] : Math.min(out.from, years[0]);
      out.to = out.to === null ? years[years.length - 1] : Math.max(out.to, years[years.length - 1]);
    }
  }

  return out;
}

/* ---------------- the brightness rule, as arithmetic ----------------

   Nothing drawn under the cameras may be brighter than the dimmest
   camera dot - the fixed-camera red, 134 on the perceived scale
   0.299 R + 0.587 G + 0.114 B. The LIFT table below is tuned to it by
   eye and measured after; this is the same rule for a colour that has
   to be derived rather than typed. dimTo() scales a colour down, hue
   kept, until its brightness is at or under a ceiling: the halo under
   an approximate pin is the dot's own colour dimmed this way, because
   a translucent lighter colour over a pixel the glow has already
   lifted near the ceiling can only push it over, and a colour that is
   itself under the ceiling never can - over anything brighter than
   itself it darkens. A colour already under the ceiling comes back
   as it is. */
function brightnessOf(hex) {
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);

  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function dimTo(hex, ceiling) {
  var was = brightnessOf(hex);
  var by;
  var i;
  var part;
  var out = "#";

  if (was <= ceiling) {
    return hex;
  }

  by = ceiling / was;
  for (i = 1; i < 7; i += 2) {
    part = Math.floor(parseInt(hex.slice(i, i + 2), 16) * by);
    out += (part < 16 ? "0" : "") + part.toString(16);
  }

  return out;
}

/* Fills a <select> from the table above, so no page has to keep its
   own copy of the list. `selected` is which one starts chosen, since
   the sensible default differs by page: the map's own add form opens
   on a van site, which is what most entries are. */
function fillTypeSelect(el, selected) {
  var option;
  var i;

  if (!el) {
    return;
  }

  el.innerHTML = "";

  for (i = 0; i < CAMERA_TYPES.length; i++) {
    option = document.createElement("option");
    option.value = CAMERA_TYPES[i].type;
    option.textContent = CAMERA_TYPES[i].label;
    if (CAMERA_TYPES[i].type === selected) {
      option.selected = true;
    }
    el.appendChild(option);
  }
}

/* ------------------------------------------------------------------
   What the browser remembers

   Three keys, named here because more than one file touches them and
   a half-updated string is a bug nobody sees: the cache simply stops
   being found and every visit pays for a fetch.

     CAMERAS   the cameras table, held for a few minutes so a busy day
               is answered out of the visitor's own browser. map.js
               writes it; picker.js's context dots read it; every
               moderating action throws it away so the moderator sees
               their own change on the next look.
     VIEW      which base map, the legacy toggle, the kinds switched
               off in the legend, and the list's sort order.
     DRAFT     the ?edit working copy of points.js. Never written
               outside edit mode.
     EXPLAINED that "How to read this map" under the legend has been
               shown open once, so later visits open it closed. Set
               the first time it is shown and again when it is closed;
               where storage is refused it is open on every visit,
               which is the harmless way round.

   Storage may be refused outright - a private window, a browser set
   to block it - so every read and write of these is wrapped, and the
   site works without any of them.
   ------------------------------------------------------------------ */

var STORAGE = {
  cameras:   "cammap.cameras",
  view:      "cammap.view",
  draft:     "cammap.draft",
  explained: "cammap.explained",
  /* The two below are sessionStorage, not localStorage: a report half
     written and the receipt for the last one sent belong to this tab and
     this sitting, not to the browser. Named here all the same, because
     the rule is that every key the site writes is in this one table. */
  reportDraft:   "cammap.report-draft",
  reportReceipt: "cammap.report-receipt"
};

/* Throw the camera cache away. Called after anything that changes what
   is on the map, so the person who made the change sees it rather than
   up to five minutes of the old answer. */
function forgetCameraCache() {
  try {
    window.localStorage.removeItem(STORAGE.cameras);
  } catch (err) {
    /* storage refused; there was nothing cached to throw away either */
  }
}

/* ------------------------------------------------------------------
   The base map, and making the dark one readable

   Two pages draw a map now - the map itself, and the coordinate
   picker on the report form - so the styles and the correction the
   dark one needs live here rather than in map.js.

   MapLibre counts coordinates the other way round from the rest of
   this project: longitude first. lngLat() is the one place that is
   converted.
   ------------------------------------------------------------------ */

var MAP_STYLES = {
  dark:  "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/bright"
};

function lngLat(lat, lon) {
  return [lon, lat];
}

/* Layers a map of cameras in one city has no use for. Country
   borders, the names of countries and counties, ice shelves and
   glaciers, the taxiways at Heathrow - every one of them a line or a
   word competing with the thing the map is for. With vector tiles
   they can simply be taken off, which is cheaper than drawing them
   and then hiding them.

   Village and suburb names are kept: in London they are how anyone
   says where a camera is. */
var NOISY_LAYERS = [
  "road_oneway", "road_oneway_opposite",
  "boundary_country_z0-4", "boundary_country_z5-", "boundary_state",
  "place_country_major", "place_country_minor", "place_country_other", "place_state",
  "landcover_ice_shelf", "landcover_glacier",
  "aeroway-taxiway", "aeroway-runway", "aeroway-runway-casing", "aeroway-area"
];

/* How far to lift each kind of colour, and by how much to raise its
   floor. The dark style is drawn for a pure black page; against this
   one it needs help.

   The rule these numbers answer to: nothing on the base map may be
   brighter than the dimmest camera dot. The dots are what the map is
   for; the roads are the backdrop it draws them on. That was got
   badly wrong once - the casings were lifted to a brightness of 182
   where the dimmest dot is 134, so London came out as a white web
   with the cameras lost in it. Under these numbers the brightest
   thing the base map draws is 92.

   The floor matters as much as the factor. Multiplying alone leaves
   the dark end crushed - a near-black colour stays near-black however
   large the factor - and the dark end is where a map keeps its
   texture. Buildings start at rgb(10,10,10) and need their own entry
   or they stay invisible; they are meant to be quiet massing behind
   the streets, not a feature.

   Labels are lifted least of all. They were already the most legible
   thing on the map, and they are thin glyphs in a few places rather
   than a web over everything, so they can sit near the dots without
   competing with them. */
var LIFT = {
  line:       { by: 1.4,  floor: 8 },
  fill:       { by: 1.35, floor: 6 },
  background: { by: 1.6,  floor: 0 },
  text:       { by: 1.45, floor: 0 },
  halo:       { by: 0.55, floor: 0 },
  building:   { by: 2.4,  floor: 4 }
};

/* An off-screen scrap of the page, used to let the browser turn
   whatever notation the style happens to use - #abc, rgb(), hsl() -
   into numbers that can be scaled. */
var liftSwatch = document.createElement("div");
liftSwatch.style.cssText = "position:fixed;left:-9999px;top:0;";

/* Answers already worked out. Setting a colour on the swatch and then
   reading it back forces the browser to recalculate style there and
   then, and this runs for every coloured property of every layer in
   the style - several hundred times on each load of the dark map. A
   vector style reuses the same handful of colours across dozens of
   layers, so remembering them turns that into about a dozen real
   measurements. It outlives a style swap on purpose: the answer
   depends only on the colour and the lift asked for, not on which
   style asked, so a return to the dark map costs nothing - and with
   this table shared, the picker's map costs nothing after the main
   one has drawn. */
var liftCache = {};

function lift(colour, how) {
  var parts;
  var by = how.by;
  var floor = how.floor || 0;
  var key = colour + "|" + by + "|" + floor;
  var scale = function (v) {
    return Math.min(255, Math.round(v * by + floor));
  };

  if (liftCache.hasOwnProperty(key)) {
    return liftCache[key];
  }

  liftSwatch.style.color = "";
  liftSwatch.style.color = colour;
  parts = window.getComputedStyle(liftSwatch).color.match(/[\d.]+/g);

  liftCache[key] = parts
    ? "rgba(" + scale(parts[0]) + "," + scale(parts[1]) + "," +
      scale(parts[2]) + "," + (parts[3] === undefined ? 1 : parts[3]) + ")"
    : null;

  return liftCache[key];
}

/* Which paint property carries the colour, for each kind of layer. */
var COLOUR_OF = {
  line: ["line-color", "line"],
  fill: ["fill-color", "fill"],
  background: ["background-color", "background"]
};

function repaintLayer(m, layer) {
  var pair = COLOUR_OF[layer.type];
  var paint = layer.paint || {};
  var lifted;
  var how;

  if (pair && typeof paint[pair[0]] === "string") {
    how = layer.id === "building" ? LIFT.building : LIFT[pair[1]];
    lifted = lift(paint[pair[0]], how);
    if (lifted) {
      m.setPaintProperty(layer.id, pair[0], lifted);
    }
  }

  if (layer.type !== "symbol") {
    return;
  }

  if (typeof paint["text-color"] === "string") {
    lifted = lift(paint["text-color"], LIFT.text);
    if (lifted) {
      m.setPaintProperty(layer.id, "text-color", lifted);
    }
  }

  if (typeof paint["text-halo-color"] === "string") {
    lifted = lift(paint["text-halo-color"], LIFT.halo);
    if (lifted) {
      m.setPaintProperty(layer.id, "text-halo-color", lifted);
    }
  }
}

/* Take the clutter off, and lift what is left. `dark` says whether
   the lift is wanted: the light style needs no such help - it was
   drawn for a white page and brightening it would only wash it out -
   so it is left as its authors drew it. */
function tidyBaseStyle(m, dark) {
  var layers;
  var i;

  for (i = 0; i < NOISY_LAYERS.length; i++) {
    if (m.getLayer(NOISY_LAYERS[i])) {
      m.removeLayer(NOISY_LAYERS[i]);
    }
  }

  if (!dark) {
    return;
  }

  layers = m.getStyle().layers;
  document.body.appendChild(liftSwatch);
  for (i = 0; i < layers.length; i++) {
    repaintLayer(m, layers[i]);
  }
  liftSwatch.remove();
}

/* ------------------------------------------------------------------
   Aerial imagery

   Esri's World Imagery, as raster tiles slid in under the vector
   map's labels. No key: the open tile endpoint is free for
   non-commercial use with attribution, which this is. When it is on,
   the style's own fills and roads are hidden so the imagery shows
   through, and the labels stay on top so places can still be read.

   Both maps use it - the map page's Satellite view, and the report
   form's picker, where seeing the actual roof and pavement is the
   difference between a pin on the right pole and a pin on the right
   street. If the endpoint ever changes or goes away, this block is
   the whole of what needs touching, and the toggle simply stops
   showing imagery rather than breaking anything.
   ------------------------------------------------------------------ */

var SATELLITE = "satellite";
var SATELLITE_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
var SATELLITE_CREDIT = "Imagery &copy; Esri, Maxar, Earthstar Geographics";

/* Everything the style draws on the ground - which is everything that
   is not a label. These are what get hidden under imagery. */
function groundLayersOf(m) {
  var layers = m.getStyle().layers;
  var ids = [];
  var i;

  for (i = 0; i < layers.length; i++) {
    if (layers[i].type !== "symbol") {
      ids.push(layers[i].id);
    }
  }

  return ids;
}

/* The imagery sits directly above the style's background layer, so it
   is under every road and label but over the plain colour. Added
   hidden; showSatellite() is what turns it on. */
function addSatellite(m) {
  var layers = m.getStyle().layers;

  if (m.getSource(SATELLITE)) {
    return;
  }

  m.addSource(SATELLITE, {
    type: "raster",
    tiles: [SATELLITE_TILES],
    tileSize: 256,
    maxzoom: 19,
    attribution: SATELLITE_CREDIT
  });

  m.addLayer({
    id: SATELLITE,
    type: "raster",
    source: SATELLITE,
    layout: { visibility: "none" },
    paint: { "raster-opacity": 1 }
  }, layers.length > 1 ? layers[1].id : undefined);
}

/* Imagery on: show the raster and hide the style's ground, so it
   reads as a photograph with names on it. Off: put it all back. */
function showSatellite(m, on, ground) {
  var i;

  if (m.getLayer(SATELLITE)) {
    m.setLayoutProperty(SATELLITE, "visibility", on ? "visible" : "none");
  }

  for (i = 0; i < ground.length; i++) {
    if (m.getLayer(ground[i])) {
      m.setLayoutProperty(ground[i], "visibility", on ? "none" : "visible");
    }
  }
}
