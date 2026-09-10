/* ------------------------------------------------------------------
   cammap - registering the service worker, and the one line under
   the page

   This is a file, loaded by every page, rather than three lines of
   script in each page's head, because the Content-Security-Policy on
   every page says script-src 'self' and means it: an inline <script>
   does not run here, whoever wrote it. So the registration lives in
   frontend/ beside the other scripts, is stamped by tools/stamp.py
   like them, and is the last tag on every page - nothing waits on it
   and nothing here is needed to draw anything.

   It does two things. It registers sw.js, which is what keeps a copy
   of the site for a street with no signal (the header of sw.js says
   what is kept and what never is). And it shows one line at the foot
   of the window, in two cases and no others:

     "Working from a saved copy."           the page is being answered
                                            from the worker's cache and
                                            the network is not there
     "A newer version is ready.  [Reload]"  a new sw.js has installed
                                            and is waiting for this
                                            page to let it take over

   The second is the important one. A new version of the site waits
   until it is asked for rather than taking over pages that are open
   - the reasoning is in sw.js - and this line is the asking. Reload
   posts {type: "skip"} to the waiting worker; when it takes over, the
   controllerchange event fires here and the page that asked reloads
   itself. Any other tab open on the old version is shown the same
   line on the same event and left to choose, because that tab may be
   halfway through a report.

   Where there is no service worker - file://, an old browser, a
   private window in some browsers - or where registering one fails,
   nothing is shown and nothing else changes: the site is the same
   site it was before this file existed. Everything below is behind
   that test and inside try/catch, and no storage is used at all.

   Where the worker is registered from. The worker's scope is the
   folder it is served from, and the site lives under /cammap/ on
   GitHub Pages and at / on a local server, so the path is worked out
   from this script's own address rather than written down: this file
   is frontend/offline.js, and the site's root is one folder up from
   it. That holds on index.html at the root, on the pages in pages/,
   and on 404.html, which is served for every missing address and
   carries a <base href="/cammap/"> for exactly that reason - the
   script's resolved src is under the base, and so is the root.

   On a local server - localhost or 127.0.0.1 - the worker is
   registered only when the page's address carries ?offline, and a
   page opened there without it removes the worker and its caches.
   The reason is the ordinary way this site is checked: edit a file,
   reload, look. A worker answering from a cache that only changes
   when stamp.py is run would make that reload show the old file, and
   would do it silently. So locally the worker exists only while it
   is being tested, and the address says so. On the deployed site the
   flag means nothing and the worker is always registered.
   ------------------------------------------------------------------ */

(function () {
  "use strict";

  if (!("serviceWorker" in navigator) || !document.currentScript || !document.currentScript.src) {
    return;
  }

  var root;
  try {
    root = new URL("../", document.currentScript.src).href;
  } catch (e) {
    return;
  }

  var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
  var testing = /[?&]offline(=|&|$)/.test(window.location.search);

  if (local && !testing) {
    forget();
    return;
  }

  /* Whether this page was loaded under a worker. A page that was not
     - the very first visit - is claimed by the new worker when it
     activates, and that first controllerchange is not an update. */
  var hadController = !!navigator.serviceWorker.controller;
  var asked = false;

  navigator.serviceWorker.register(root + "sw.js", { updateViaCache: "none" }).then(watch, function () {
    /* refused or failed: the site works as it did without a worker */
  });

  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (!hadController) {
      hadController = true;
      return;
    }
    if (asked) {
      asked = false;
      window.location.reload();
      return;
    }
    offer(null);
  });

  navigator.serviceWorker.addEventListener("message", function (event) {
    if (event.data && event.data.type === "network") {
      networkSaid(event.data.ok);
    }
  });
  /* A message the worker posts before this page is listening - and
     the first one usually is: the map asks for its style before this
     file, the last script, has run - is held in a queue that adding
     a listener does not, by the specification, open. startMessages()
     opens it and delivers what was held. Without this line the map
     page never hears that its style came from the cache. */
  if (navigator.serviceWorker.startMessages) {
    navigator.serviceWorker.startMessages();
  }

  window.addEventListener("online", function () { pageSaid(true); });
  window.addEventListener("offline", function () { pageSaid(false); });
  if (navigator.serviceWorker.controller && navigator.onLine === false) {
    pageSaid(false);
  }


  /* ---- the update ---- */

  function watch(registration) {
    /* A worker already waiting - this page was opened while one was
       installed by another tab, or after a visit that did not reload. */
    if (registration.waiting && navigator.serviceWorker.controller) {
      offer(registration.waiting);
    }
    registration.addEventListener("updatefound", function () {
      var installing = registration.installing;
      if (!installing) {
        return;
      }
      installing.addEventListener("statechange", function () {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          offer(installing);
        }
      });
    });
  }

  /* worker is the waiting worker to ask, or null when the change has
     already happened (another tab asked) and a reload is all that is
     left to do. */
  function offer(worker) {
    show("A newer version is ready.", "Reload", function () {
      if (worker) {
        asked = true;
        worker.postMessage({ type: "skip" });
      } else {
        window.location.reload();
      }
    });
  }


  /* ---- the saved copy ----

     Two witnesses: the page's own navigator.onLine, which every page
     has, and the worker, which on the map page is the one that sees
     a tile request fail. Either saying offline shows the line; both
     saying otherwise clears it. Only while a worker controls the
     page - otherwise the page came from the network, whatever the
     connection did afterwards, and "saved copy" would be untrue. */

  var pageOffline = false;
  var workerOffline = false;

  function pageSaid(online) {
    pageOffline = !online;
    saidSomething();
  }

  function networkSaid(ok) {
    workerOffline = !ok;
    saidSomething();
  }

  function saidSomething() {
    if (!navigator.serviceWorker.controller) {
      return;
    }
    if (pageOffline || workerOffline) {
      show("Working from a saved copy.", null, null);
    } else {
      hide("Working from a saved copy.");
    }
  }


  /* ---- the line ----

     One element, made when first needed and reused, at the foot of
     the window. role="status" so a screen reader hears it without it
     stealing focus. The update line, once shown, is not replaced by
     the saved-copy line: a Reload that is offered stays offered. */

  var line = null;
  var lineText = null;
  var lineButton = null;
  var saying = "";

  function show(text, label, onPress) {
    try {
      if (!line) {
        line = document.createElement("p");
        line.className = "offline-line";
        line.setAttribute("role", "status");
        lineText = document.createElement("span");
        line.appendChild(lineText);
        document.body.appendChild(line);
      }
      if (saying === "A newer version is ready." && text !== saying) {
        return;
      }
      saying = text;
      lineText.textContent = text;
      if (lineButton) {
        line.removeChild(lineButton);
        lineButton = null;
      }
      if (label) {
        lineButton = document.createElement("button");
        lineButton.type = "button";
        lineButton.className = "quiet";
        lineButton.textContent = label;
        lineButton.addEventListener("click", onPress);
        line.appendChild(lineButton);
      }
      line.style.display = "";
    } catch (e) {
      /* a page with no body yet, or a document that will not take it */
    }
  }

  function hide(text) {
    if (line && saying === text) {
      saying = "";
      line.style.display = "none";
    }
  }


  /* ---- a local server without the flag ----

     Whatever a test left behind - the registration and every cache
     of ours - goes, so that the next reload is the file on disk. */

  function forget() {
    try {
      navigator.serviceWorker.getRegistration(root).then(function (registration) {
        if (registration) {
          registration.unregister();
        }
      }, function () {});
      if (window.caches) {
        window.caches.keys().then(function (names) {
          names.forEach(function (name) {
            if (name.indexOf("cammap-") === 0) {
              window.caches.delete(name);
            }
          });
        }, function () {});
      }
    } catch (e) {
      /* nothing to forget, or a browser that will not say */
    }
  }
})();
