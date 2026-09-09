/* ------------------------------------------------------------------
   cammap - the press page's numbers

   Plain browser JavaScript, same rules as the rest: no build step,
   var and named functions. Loaded by pages/press.html after
   data/points.js and shared.js, and by nothing else.

   The press page states the record in words - how many cameras, of
   what kinds, how many marked approximate, which years - and none of
   those numbers is typed into the page. They are worked out here from
   POINTS, the published record, through recordCounts() in shared.js,
   the way the line under the map works out its own count: a number
   typed into prose goes stale without a sound the day the record is
   refreshed, and a press page with a stale count is worse than one
   with none. The dates come from RECORD_SOURCES beside them, which
   are the one place the reach of the sources is typed.

   Without JavaScript the paragraph keeps the sentence the markup
   carries, which points at the map's own line and at the CSV; with
   it, the sentence is replaced by the figures. Built as text nodes,
   never as HTML, so nothing in a label can be read as markup.
   ------------------------------------------------------------------ */

/* "163 LFR van sites, 9 Transport police, 7 Shops (Facewatch), 2 Fixed
   LFR cameras, 1 Private" - the kinds, largest count first, each with
   the legend's own label. A label whose noun is camera, site or shop
   takes an s when there are several, the noun and not the bracket
   after it; "Transport police" and "Private" are left as the legend
   writes them, since neither has a plural to take. */
function pressKindsSentence(counts) {
  var parts = [];
  var i;
  var t;
  var n;
  var label;

  for (i = 0; i < CAMERA_TYPES.length; i++) {
    t = CAMERA_TYPES[i];
    n = counts.byType[t.type] || 0;
    if (n === 0) {
      continue;
    }
    label = t.label;
    if (n !== 1) {
      label = label.replace(/^(.*?)(camera|site|shop)(\s*\(.*\))?$/i, "$1$2s$3");
    }
    parts.push(String(n) + " " + label);
  }

  parts.sort(function (a, b) {
    return parseInt(b, 10) - parseInt(a, 10);
  });

  return parts.join(", ");
}

function fillPressCounts() {
  var box = document.getElementById("press-counts");
  var counts;
  var text;

  if (!box || typeof POINTS === "undefined" || typeof recordCounts !== "function") {
    return;
  }

  counts = recordCounts(POINTS);

  text = String(counts.total) + " cameras in the record: " + pressKindsSentence(counts) + ". " +
    String(counts.approximate) + " of the van sites are approximate positions - the record gave a " +
    "borough or a district, not a street. " +
    String(counts.dated) + " entries carry a recorded period";
  if (counts.from !== null) {
    text += ", running from " + counts.from + " to " + counts.to;
  }
  text += "; the rest - the shops, the fixed cameras, the one private estate - are dated only by " +
    "their sources. Met records to " + RECORD_SOURCES.met + ", British Transport Police register " +
    RECORD_SOURCES.btp + "; last checked " + RECORD_SOURCES.checked + ".";

  box.textContent = text;
}

fillPressCounts();
