/* ------------------------------------------------------------------
   cammap - the service worker

   This site is meant to be opened on a street with bad signal, by
   someone standing in front of a van. A page that needs the network
   to draw itself is no use there. So the browser keeps a copy: this
   worker sits between every page of the site and the network, and
   what it keeps, what it never keeps, and how a new version reaches
   a browser that already has the old one, are the whole of what it
   does. Plain browser JavaScript like everything else here - var and
   named functions, no import, no dependency - served by Pages as a
   file beside index.html, because a worker's scope is the folder it
   is served from and the site lives under /cammap/.

   Two caches, kept apart because they answer to different rules.

   THE SHELL: everything a page needs to render without the network.
   The pages themselves; the site's own scripts and stylesheet; the
   published record (data/points.js - the map's fallback when the
   database cannot be reached, so the 182 cameras are on the map
   offline); MapLibre and supabase-js from lib/; the fonts; the icons
   and the manifest. Fetched in full when the worker installs, into a
   cache named for the version it holds, and answered from there ever
   after: a same-origin GET is looked up in the shell first and goes
   to the network only if it is not there. The shell is never updated
   in place. That is not a shortcut; it is the point. tools/stamp.py
   puts a content hash on every page's own script and stylesheet
   tags (the ?v= you see in index.html) so a returning visitor never
   pairs new HTML with old JavaScript, and the same script writes
   that stamp, a second hash over every file listed below, and the
   list itself, into the three marked lines under this comment. A
   deploy that changes any of those files changes this file byte for
   byte, the browser sees a different sw.js, and a NEW worker
   installs with a NEW shell cache; the old one is deleted when the
   new one takes over. Two versions of the site never share a cache,
   and no file in a cache is ever newer or older than the page that
   asked for it. The files are looked up ignoring the query, so the
   page's request for frontend/map.js?v=b9e113b3 finds the entry;
   and the entries carry their hash in the query so that a fetch at
   install can never be answered by a ten-minute-old copy at the
   edge of GitHub Pages' cache - the same reason the pages carry it.

   THE TILES: the last tiles seen. The base map comes from OpenFreeMap
   (the style, the sprite, the glyphs and the vector tiles) and the
   satellite view from Esri, and neither can be precached - the tiles
   for London at every zoom are gigabytes. What can be kept is what
   the map has already drawn. Every response from those two hosts is
   put in a second cache, bounded to the newest TILE_LIMIT entries
   with the oldest evicted, and answered from there first: a tile the
   map has shown before is drawn without a request, online or off.
   The two documents that name where the tiles are - the style JSON
   and the TileJSON it points at - go the other way, network first
   with the cache as the fallback, because OpenFreeMap rotates its
   tileset under a dated path and a client that kept the old index
   for ever would ask for tiles that had been withdrawn. Online, the
   map is always drawn from the current tileset and the old tiles
   age out of the cache; offline, the cached index still names the
   tiles the cache holds. The cache is not versioned with the shell,
   because a deploy of this site has nothing to do with what London
   looks like, and throwing the tiles away on every deploy would be
   the one thing that made the site slower.

   WHAT IS NEVER CACHED, AND WHY. Supabase - *.supabase.co - is never
   touched by this worker: not the database, not auth, not the proof
   bucket. A request to it passes through as if there were no worker
   at all. The database's answers have to be live or absent - the map
   already says "Showing the published record; live updates
   unavailable" when they are absent, and a cached answer would be a
   third state, stale and silent, that the page could not tell from
   live. And an auth response carries a session token, which has no
   business sitting in a cache that outlives the session; Log out
   ends a session, and a cache would not know. Nominatim, the place
   search, is never cached either: what is typed into that box is a
   person's place, and the site keeps no record of it anywhere - see
   "Anonymity" in NOTES.md. Anything else off-site goes to the
   network untouched. Nothing here is fetched that the page did not
   ask for, and nothing is sent anywhere.

   One honest limit, stated rather than hidden. The tile cache is a
   record, on the device and nowhere else, of which parts of London
   the map has shown - and after Near me that is where the person
   was. Nothing reads it but this worker and nothing sends it, but it
   is there, in the browser's site data, until the browser clears it
   or it is evicted. NOTES.md, "Anonymity", says the same about the
   tile hosts themselves seeing the request; this is the copy that
   stays behind.

   HOW AN UPDATE REACHES A CLIENT. The browser fetches this file
   afresh on every navigation (the page registers it with
   updateViaCache none, so the ten-minute HTTP cache never hides a
   deploy) and compares it byte for byte with the one it has. If it
   differs, the new worker INSTALLS - fills its own shell cache,
   copying any file whose URL, hash and all, the old cache already
   holds, and fetching the rest - and then WAITS. It does not take
   over the pages that are open. A page that has loaded under one
   version and is suddenly answered by another mid-session is the
   failure this waiting prevents: the old tabs keep the old worker
   and the old cache, whole, until the last of them is closed. The
   page, meanwhile, is told (frontend/offline.js listens for the
   install) and shows one line - "A newer version is ready", with a
   Reload button. Pressing it posts {type: "skip"} here, the waiting
   worker calls skipWaiting(), takes over, deletes every shell cache
   but its own, and the page that asked reloads itself under the new
   version; any other open tab is shown the same line and left to
   choose. So a person is never stranded on a stale shell: the
   update is offered on the next visit and taken on the next reload,
   and until then the old version keeps working, offline included.

   The pages are not versioned separately from the scripts: SHELL is
   a hash over everything in PRECACHE, pages included, so a change to
   a page alone - a blog post, a sentence on About - still changes
   this file and still installs a new worker. STAMP alone would miss
   it, because STAMP is a hash over the scripts and the stylesheet.
   Both are written by tools/stamp.py; the script's --check fails if
   either is not what the tree computes, the way it fails on a page
   whose ?v= is stale, so a deploy that forgot to run it is caught in
   CI rather than in a browser.

   Nothing below logs. A worker that prints is a worker that is
   debugged in production by everyone who opens the console.
   ------------------------------------------------------------------ */

/* ---- written by tools/stamp.py: do not edit these three by hand ----

   STAMP is the ?v= on every page's own script and stylesheet tags.
   SHELL is a hash over every file in PRECACHE as committed. PRECACHE
   is every file of the shell, relative to this worker, each carrying
   the hash that names its version in the query - STAMP on the files
   STAMP covers, SHELL on the pages and the rest - except lib/ and
   fonts/, which are pinned by their own version numbers and carry
   none, so the browser's HTTP cache can revalidate them cheaply
   across deploys instead of downloading MapLibre again. */
var STAMP = "c7f24583";
var SHELL = "3b46ca21";
var PRECACHE = [
  "404.html?v=3b46ca21",
  "index.html?v=3b46ca21",
  "pages/about.html?v=3b46ca21",
  "pages/account.html?v=3b46ca21",
  "pages/blog.html?v=3b46ca21",
  "pages/data.html?v=3b46ca21",
  "pages/leaderboard.html?v=3b46ca21",
  "pages/moderate.html?v=3b46ca21",
  "pages/press.html?v=3b46ca21",
  "pages/report.html?v=3b46ca21",
  "pages/rights.html?v=3b46ca21",
  "frontend/shared.js?v=c7f24583",
  "frontend/map.js?v=c7f24583",
  "frontend/account.js?v=c7f24583",
  "frontend/picker.js?v=c7f24583",
  "frontend/press.js?v=c7f24583",
  "frontend/style.css?v=c7f24583",
  "frontend/offline.js?v=c7f24583",
  "data/points.js?v=c7f24583",
  "supabase-config.js?v=c7f24583",
  "lib/maplibre-gl.js",
  "lib/maplibre-gl.css",
  "lib/supabase.js",
  "fonts/fonts.css",
  "fonts/ibm-plex-mono-400.woff2",
  "fonts/ibm-plex-mono-500.woff2",
  "fonts/ibm-plex-mono-600.woff2",
  "img/favicon.svg?v=3b46ca21",
  "img/favicon.ico?v=3b46ca21",
  "img/apple-touch-icon.png?v=3b46ca21",
  "img/icon-192.png?v=3b46ca21",
  "img/icon-512.png?v=3b46ca21",
  "manifest.json?v=3b46ca21"
];
/* ---- end written by tools/stamp.py ---- */

var SHELL_CACHE = "cammap-shell-" + STAMP + "-" + SHELL;
var SHELL_PREFIX = "cammap-shell-";
var TILE_CACHE = "cammap-tiles";
var TILE_LIMIT = 300;

/* The two hosts whose responses are kept. Named in full rather than
   matched by pattern so that a third host can never be caught by
   accident; adding one here means adding it to the CSP on every page
   too, or its requests never leave the page in the first place. */
var TILE_HOSTS = {
  "tiles.openfreemap.org": true,
  "server.arcgisonline.com": true
};

/* Matching ignores the query on both caches - the ?v= on a shell
   file, and anything a tile server might one day add - and ignores
   Vary, because the stored request never carried the Accept-Encoding
   header the network layer adds and a strict comparison would miss
   on it. */
var MATCH = { ignoreSearch: true, ignoreVary: true };


/* ---- install: fill the shell ----

   Every entry in PRECACHE, into this version's cache, before the
   worker is allowed to install at all: a partial shell would be a
   page whose stylesheet is missing offline, which is worse than no
   worker. One failed fetch fails the install and the browser tries
   again on the next navigation. A file is copied from any older shell
   cache that already holds the exact same URL - the hash in the query
   makes an equal URL an equal file - so that a deploy which changes
   one page costs a returning visitor that page and not MapLibre. */

function absolute(path) {
  return new URL(path, self.location.href).href;
}

function isShellCache(name) {
  return name.indexOf(SHELL_PREFIX) === 0;
}

function openOtherShells() {
  return caches.keys().then(function (names) {
    var others = names.filter(function (name) {
      return isShellCache(name) && name !== SHELL_CACHE;
    });
    return Promise.all(others.map(function (name) { return caches.open(name); }));
  });
}

/* The first older cache that has this exact URL, or null. Sequential
   rather than parallel: there is almost always one older cache, and
   the second is there only because an install was interrupted. */
function findInShells(shells, url, i) {
  i = i || 0;
  if (i >= shells.length) {
    return Promise.resolve(null);
  }
  return shells[i].match(url).then(function (hit) {
    return hit || findInShells(shells, url, i + 1);
  });
}

function fillShell() {
  return Promise.all([caches.open(SHELL_CACHE), openOtherShells()]).then(function (opened) {
    var shell = opened[0];
    var others = opened[1];
    return Promise.all(PRECACHE.map(function (path) {
      var url = absolute(path);
      return shell.match(url).then(function (already) {
        /* left by an install that was interrupted after this file */
        if (already) {
          return null;
        }
        return findInShells(others, url).then(function (copy) {
          if (copy) {
            return shell.put(url, copy);
          }
          return fetch(url).then(function (response) {
            if (!response.ok) {
              throw new Error("precache: " + url + " answered " + response.status);
            }
            return shell.put(url, response);
          });
        });
      });
    }));
  });
}

self.addEventListener("install", function (event) {
  /* No skipWaiting() here. The worker waits for the page to ask, or
     for the old version's last tab to close - the header says why. */
  event.waitUntil(fillShell());
});


/* ---- activate: one shell, and take the open pages ----

   Every shell cache that is not this version's goes. The tile cache
   is not versioned and is left alone. Then the open pages are
   claimed, so that a page loaded before the worker existed (the very
   first visit) is answered by it from now on - which is what lets
   the tiles that visit fetches be kept, rather than waiting for a
   second visit to start keeping anything. */

function dropOtherShells() {
  return caches.keys().then(function (names) {
    return Promise.all(names.map(function (name) {
      if (isShellCache(name) && name !== SHELL_CACHE) {
        return caches.delete(name);
      }
      return null;
    }));
  });
}

self.addEventListener("activate", function (event) {
  event.waitUntil(dropOtherShells().then(function () {
    return self.clients.claim();
  }));
});


/* ---- the page asks ----

   {type: "skip"}: the page's Reload button. The waiting worker takes
   over now rather than when the last old tab closes; the page that
   sent it reloads on controllerchange. Nothing else is listened for,
   and nothing a page could send changes what is cached. */

self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "skip") {
    self.skipWaiting();
  }
});


/* ---- fetch ----

   Three kinds of request, decided by origin, and a fourth that is
   not answered at all:

     same origin       the shell, then the network
     a tile host       the tile cache, the network, the tile cache
     anything else     not ours: no respondWith, so the browser
                       fetches it exactly as it would with no worker.
                       This is the line that keeps Supabase and
                       Nominatim out of every cache, and it is a line
                       that does nothing rather than one that does
                       something carefully.

   Only GET. Anything else - and there is nothing else on this site
   that is not to Supabase - passes through. */

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") {
    return;
  }
  var url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(fromShell(request, url));
  } else if (TILE_HOSTS[url.hostname]) {
    event.respondWith(fromTiles(request, url, event));
  }
});


/* ---- same origin: the shell, then the network ----

   A navigation to the site's address, or to any folder, asks for a
   path ending in "/"; the shell holds index.html, so the lookup adds
   it. Nothing else is rewritten. A miss - a download the shell does
   not hold, the feed, a page that did not exist when the worker was
   written - goes to the network, and nothing fetched that way is put
   in the shell: it was filled at install and stays as installed. */

function fromShell(request, url) {
  var key = url.href;
  if (url.pathname.charAt(url.pathname.length - 1) === "/") {
    key = new URL("index.html", url.href).href;
  }
  return caches.open(SHELL_CACHE).then(function (shell) {
    return shell.match(key, MATCH);
  }).then(function (hit) {
    return hit || fetch(request);
  });
}


/* ---- the tile hosts: cache first, or network first ----

   On OpenFreeMap the two index documents - the style at /styles/dark
   and /styles/bright, and the TileJSON at /planet - are the paths
   with no file extension; everything with one (.pbf tiles and
   glyphs, .png sprites and low-zoom raster, the sprite's .json) is
   immutable under its versioned path and is served from the cache
   whenever it is there. Esri serves nothing but tiles. Only a 200 is
   kept: an opaque response has no status to trust and a padded size
   in the cache, and an error is not a tile.

   What a failed fetch means. A network error on a tile request is
   the one moment this worker knows the page is offline, and it tells
   the page so, once per change, so that the page can say "Working
   from a saved copy". An AbortError is not that: MapLibre cancels
   the tiles it no longer needs as the map moves, and a cancelled
   request says nothing about the network.

   A request that fails and has no cached answer is answered with
   Response.error() - a network error, which is what the page's fetch
   sees as "Failed to fetch", exactly as it would with no worker -
   rather than by letting the failure reject respondWith, which comes
   to the same thing for the page but is logged by the browser as an
   uncaught error inside the worker on every missing tile. */

var TILES_CACHE_FIRST = /\.[a-z0-9]+$/i;

function networkFirst(url) {
  return url.hostname === "tiles.openfreemap.org" && !TILES_CACHE_FIRST.test(url.pathname);
}

function fromTiles(request, url, event) {
  return caches.open(TILE_CACHE).then(function (tiles) {
    if (networkFirst(url)) {
      return fetch(request).then(function (response) {
        if (response.ok) {
          keep(tiles, url.href, response.clone(), event);
        }
        heard(event, true);
        return response;
      }, function (problem) {
        heard(event, problem.name !== "AbortError" ? false : null);
        return tiles.match(url.href, MATCH).then(function (hit) {
          return hit || Response.error();
        });
      });
    }
    return tiles.match(url.href, MATCH).then(function (hit) {
      if (hit) {
        touched(url.href);
        return hit;
      }
      return fetch(request).then(function (response) {
        if (response.ok) {
          keep(tiles, url.href, response.clone(), event);
        }
        heard(event, true);
        return response;
      }, function (problem) {
        heard(event, problem.name !== "AbortError" ? false : null);
        return Response.error();
      });
    });
  });
}


/* ---- the bound on the tile cache ----

   The newest TILE_LIMIT entries, the oldest evicted. "Newest" is by
   last use, not by first fetch: a tile the map drew a minute ago
   from the cache is newer than one it fetched an hour ago and never
   looked at again, so the tiles of the streets someone keeps coming
   back to survive a wander across the rest of London. The Cache API
   keeps no dates, so the order is kept here, in memory, for as long
   as this worker instance lives - the browser stops an idle worker
   and starts it again, and an entry this instance has not seen yet
   ranks by its position in cache.keys(), which is insertion order.
   That is an approximation, and it errs the safe way: a tile not
   seen since the worker last started is exactly the kind of tile to
   let go first.

   Moving an entry on a hit would cost rewriting the tile; a counter
   costs nothing, which is why the order is not kept in the cache.
   One trim runs at a time. Several tiles arrive together on every
   pan, each would trim, and the second trim of the same keys would
   only redo the first. */

var seen = {};
var tick = 0;
var trimming = null;

function touched(href) {
  seen[href] = ++tick;
}

function keep(tiles, href, response, event) {
  touched(href);
  event.waitUntil(tiles.put(href, response).then(function () {
    return trim(tiles);
  }));
}

function trim(tiles) {
  if (trimming) {
    return trimming;
  }
  trimming = tiles.keys().then(function (keys) {
    var over = keys.length - TILE_LIMIT;
    if (over <= 0) {
      return null;
    }
    var ranked = keys.map(function (key, i) {
      return { key: key, at: seen[key.url] || 0, i: i };
    });
    ranked.sort(function (a, b) {
      return (a.at - b.at) || (a.i - b.i);
    });
    return Promise.all(ranked.slice(0, over).map(function (entry) {
      delete seen[entry.key.url];
      return tiles.delete(entry.key);
    }));
  }).then(function () {
    trimming = null;
  }, function () {
    trimming = null;
  });
  return trimming;
}


/* ---- telling the page about the network ----

   Once per change of state per page, so that a hundred tiles failing
   together on a dead connection are one message and not a hundred.
   ok is true after a fetch succeeded, false after one failed for any
   reason but cancellation, and null for a cancellation, which says
   nothing and sends nothing. The page that made the request is the
   one told; event.clientId is the page's id and is absent for a
   navigation, which is fine - a navigation is answered from the
   shell and never comes this way. */

var told = {};

function heard(event, ok) {
  if (ok === null || !event.clientId || told[event.clientId] === ok) {
    return;
  }
  told[event.clientId] = ok;
  event.waitUntil(self.clients.get(event.clientId).then(function (client) {
    if (client) {
      client.postMessage({ type: "network", ok: ok });
    }
  }));
}
