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
   map to another city is this, the two check constraints in
   schema.sql, and the opening centre in map.js. */
var LONDON_BOUNDS = [[51.28, -0.51], [51.70, 0.33]];

/* Where a map opens when it has no reason to look anywhere else.
   Both maps use it, so it is here rather than in either of them. */
var LONDON_CENTRE = [51.5074, -0.1278];

function inLondon(lat, lon) {
  return lat >= LONDON_BOUNDS[0][0] && lat <= LONDON_BOUNDS[1][0] &&
         lon >= LONDON_BOUNDS[0][1] && lon <= LONDON_BOUNDS[1][1];
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

   Storage may be refused outright - a private window, a browser set
   to block it - so every read and write of these is wrapped, and the
   site works without any of them.
   ------------------------------------------------------------------ */

var STORAGE = {
  cameras: "cammap.cameras",
  view:    "cammap.view",
  draft:   "cammap.draft"
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
