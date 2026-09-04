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

/* One colour per kind of camera, matching --t-* in style.css. Colour
   always means what a thing IS. Whether it works now is said by the
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
