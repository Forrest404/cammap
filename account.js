/* ------------------------------------------------------------------
   cammap - anonymous accounts

   Plain browser JavaScript, same rules as map.js: no build step, no
   modules, var and named functions throughout.

   This file runs on every page, because the account controls live in
   the nav bar at the top and the nav has to say the right thing
   wherever you are. What it does beyond that depends on which page
   it finds itself on:

     index.html    adds a star to each row of the camera list, once
                   someone is signed in
     account.html  the sign-in screen, and what it says afterwards
     report.html   the form for reporting a camera

   An account is a generated username - two words with a dot between,
   like copper.heron - and a password the user chooses. Nothing else.
   No email is asked for. Supabase wants an email string to hang a
   password on, so one is made up from the username and never shown,
   never mailed, and never treated as an address.

   The nav shows nothing about accounts until it knows the answer, so
   it never flickers from "Account" to "Log out" in front of you.

   Everything here is optional. supabase-config.js carries the project
   URL and the public key; if that file did not load, or lib/supabase.js
   failed, or any call errors, the account controls simply do not
   appear and the rest of the site behaves as it always did. The map is
   drawn by map.js straight from points.js and never touches any of
   this.
   ------------------------------------------------------------------ */

/* The hidden half of a login. The user's username goes in front of
   this to make the email string Supabase requires. It is not a real
   mailbox and nothing is ever sent to it. Supabase rejects reserved
   names like .invalid and .example, so it has to look real. If this
   ever changes, existing accounts stop matching - so it should not. */
var ACCOUNT_DOMAIN = "users.cammap.app";

/* A password must be at least this long and mix all four classes.
   The same rule is set in the Supabase dashboard, which is what
   actually enforces it; this copy is so the message is ours. */
var PASSWORD_MIN = 10;

/* Two plain words with a dot between, e.g. copper.heron. Chosen for
   the user, not by them: nothing identifying can be typed in, and
   nothing rude can come out. About 22,000 pairs; a collision is
   caught by the database and the client rerolls once. */
var WORDS_A = ["amber","ash","birch","bold","brass","brief","bright","broad",
  "calm","cedar","chalk","cinder","civil","clear","cloud","coal","cobalt",
  "cold","copper","coral","cream","crisp","damp","dark","dawn","deep","dry",
  "dusk","dusty","early","east","ember","even","fair","faint","fern","flat",
  "flint","fog","frost","gentle","glass","gold","grand","grey","hazel","heavy",
  "high","hollow","humble","idle","iron","ivory","jade","keen","kind","late",
  "lead","light","lime","linen","little","local","long","loud","low","lunar",
  "marble","mellow","mild","misty","moss","narrow","near","neat","north",
  "oak","olive","onyx","open","pale","paper","pearl","pine","plain","plum",
  "polar","proud","quick","quiet","rapid","raw","red","rich","ripe","river",
  "rose","rough","round","royal","ruby","rusty","sage","salt","sand","sharp",
  "silent","silver","slate","slow","small","smoke","snow","soft","solid",
  "south","spare","steel","still","stone","stormy","stout","swift","tall",
  "tidal","tidy","tin","torn","true","umber","upper","urban","vast","velvet",
  "vivid","warm","wax","west","wide","wild","wool","young","zinc"];

var WORDS_B = ["anchor","arch","arrow","badger","barge","basin","beacon",
  "bell","bench","birch","bloom","bridge","brook","bucket","cairn","canal",
  "candle","canyon","castle","cellar","chapel","cliff","clock","comet",
  "corner","crane","creek","crow","current","dock","drum","eagle","engine",
  "falcon","feather","ferry","field","finch","flame","fleet","forge","fox",
  "garden","gate","glade","glen","grove","harbour","hare","harp","hawk",
  "heron","hill","hound","island","jetty","kettle","kiln","kite","ladder",
  "lamp","lantern","lark","ledge","lens","lock","loom","magpie","mallet",
  "marsh","meadow","mill","mist","moor","moth","needle","nest","oar","orchard",
  "otter","owl","paddle","path","pebble","pillar","plough","pond","quarry",
  "quill","rail","raven","reed","ridge","robin","rook","rope","rudder",
  "saddle","sail","shed","shore","signal","sparrow","spire","spring","spruce",
  "stair","steeple","stream","summit","swan","thicket","thistle","tide",
  "timber","tower","trail","trout","tunnel","valley","vault","vine","wagon",
  "walnut","warren","weasel","wharf","wheel","willow","window","wren","yard"];

function pickFrom(list) {
  var n;

  /* crypto if the browser has it, so names are not guessable from a
     clock; Math.random otherwise, which is fine for a name. */
  if (window.crypto && window.crypto.getRandomValues) {
    n = new Uint32Array(1);
    window.crypto.getRandomValues(n);
    return list[n[0] % list.length];
  }
  return list[Math.floor(Math.random() * list.length)];
}

function generateUsername() {
  return pickFrom(WORDS_A) + "." + pickFrom(WORDS_B);
}

var USERNAME_SHAPE = /^[a-z]{3,12}\.[a-z]{3,12}$/;

/* The login email for a username. Lower-cased on the way in so that
   Copper.Heron and copper.heron are the same account. */
function emailFor(username) {
  return username.trim().toLowerCase() + "@" + ACCOUNT_DOMAIN;
}

/* Empty string means fine; otherwise the reason, in plain words. */
function passwordProblem(pw) {
  if (pw.length < PASSWORD_MIN) {
    return "At least " + PASSWORD_MIN + " characters.";
  }
  if (!/[a-z]/.test(pw)) { return "Add a lower-case letter."; }
  if (!/[A-Z]/.test(pw)) { return "Add a capital letter."; }
  if (!/[0-9]/.test(pw)) { return "Add a number."; }
  if (!/[^A-Za-z0-9]/.test(pw)) { return "Add a symbol."; }
  return "";
}

var sb = null;            /* the Supabase client, once created */
var configured = false;   /* true once sb exists and looks usable */
var currentUser = null;   /* the signed-in user, or null */
var savedCameras = [];    /* rows from saved_cameras, kept in step with the server */

/* ------------------------------------------------------------------
   Setting up the client

   Wrapped in its own try/catch because a malformed URL or key throws
   rather than failing quietly. SUPABASE_URL and SUPABASE_ANON_KEY come
   from supabase-config.js; if that file never loaded they are simply
   undefined here, which the checks below catch without an exception.
   ------------------------------------------------------------------ */

try {
  if (typeof supabase !== "undefined" &&
      typeof SUPABASE_URL === "string" && SUPABASE_URL.indexOf("https://") === 0 &&
      typeof SUPABASE_ANON_KEY === "string" && SUPABASE_ANON_KEY.length > 20) {
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    configured = true;
  }
} catch (err) {
  sb = null;
  configured = false;
}

/* Which page we are on, by file name. Works from a file:// path and
   from a web root serving index.html for "/". */
function pageName() {
  var path = window.location.pathname;
  var last = path.substring(path.lastIndexOf("/") + 1);
  return last === "" ? "index.html" : last;
}

var PAGE = pageName();

/* ------------------------------------------------------------------
   The nav

   Signed out it offers one thing, Account. Signed in it offers the
   report form and a way out. The separators are written here too, so
   that the dots always sit between things that are actually there.
   ------------------------------------------------------------------ */

var navAccount = document.getElementById("nav-account");

function navLink(href, text, current) {
  var a = document.createElement("a");
  a.href = href;
  a.textContent = text;
  if (current) {
    a.className = "current";
  }
  return a;
}

function navSeparator() {
  var span = document.createElement("span");
  span.className = "sep";
  span.innerHTML = "&middot;";
  return span;
}

function renderNav() {
  if (!navAccount) {
    return;
  }

  navAccount.innerHTML = "";

  /* Nothing at all if there is no Supabase to talk to. An Account tab
     that cannot work is worse than no Account tab. */
  if (!configured) {
    return;
  }

  if (!currentUser) {
    navAccount.appendChild(navSeparator());
    navAccount.appendChild(navLink("account.html", "Account", PAGE === "account.html"));
    return;
  }

  navAccount.appendChild(navSeparator());
  navAccount.appendChild(navLink("report.html", "Report a camera", PAGE === "report.html"));

  navAccount.appendChild(navSeparator());

  var out = navLink("#", "Log out", false);
  out.onclick = function (event) {
    event.preventDefault();
    signOut();
  };
  navAccount.appendChild(out);
}

/* ------------------------------------------------------------------
   Signing in and out
   ------------------------------------------------------------------ */

/* What a Supabase auth error should say to a person. The raw messages
   talk about emails, which the user never entered. */
function authProblem(error) {
  var code = error && (error.code || "");
  var msg = error && error.message ? error.message : "";

  if (code === "invalid_credentials" || /invalid login/i.test(msg)) {
    return "Wrong username or password.";
  }
  if (code === "weak_password" || /password/i.test(msg)) {
    return "That password is not strong enough.";
  }
  if (code === "over_request_rate_limit" || /rate limit/i.test(msg)) {
    return "Too many tries. Wait a minute and try again.";
  }
  if (code === "user_already_exists" || /already registered/i.test(msg)) {
    return "That username is taken.";
  }
  return "Something went wrong. Try again in a moment.";
}

function finishSignIn(user) {
  currentUser = user;
  renderNav();
  loadSaved();
}

function signIn(username, password, onDone) {
  if (!USERNAME_SHAPE.test(username.trim().toLowerCase())) {
    onDone("Wrong username or password.");
    return;
  }

  sb.auth.signInWithPassword({ email: emailFor(username), password: password })
    .then(function (result) {
      if (result.error) {
        onDone(authProblem(result.error));
        return;
      }
      finishSignIn(result.data.user);
      onDone(null);
    });
}

/* The username is only claimed here, on submit. If it was taken in
   the moment between being shown and being sent, a fresh one is
   tried once before giving up. */
function signUp(username, password, onDone, retried) {
  sb.auth.signUp({
    email: emailFor(username),
    password: password,
    options: { data: { username: username } }
  }).then(function (result) {
    var taken;

    if (result.error) {
      taken = result.error.code === "user_already_exists" ||
              /already registered/i.test(result.error.message || "");
      if (taken && !retried) {
        signUp(generateUsername(), password, onDone, true);
        return;
      }
      onDone(authProblem(result.error), username);
      return;
    }

    /* With email confirmation off, sign-up returns a session at
       once. If it did not, confirmation is on and the site cannot
       work - say so plainly rather than leave a spinner. */
    if (!result.data.session) {
      onDone("Sign-up needs email confirmation to be switched off in the " +
             "Supabase dashboard, and it is on.", username);
      return;
    }

    finishSignIn(result.data.user);
    onDone(null, username);
  });
}

function signOut() {
  sb.auth.signOut().then(function () {
    currentUser = null;
    savedCameras = [];
    renderNav();

    /* The report page is no use signed out, and neither is the signed
       in half of the account page, so leave for the map. Everywhere
       else can stay where it is and just redraw. */
    if (PAGE === "report.html") {
      window.location.href = "index.html";
      return;
    }

    if (PAGE === "account.html") {
      showAccountPage();
      return;
    }

    if (typeof render === "function") {
      render();
    }
  });
}

function restoreSession(onDone) {
  sb.auth.getSession().then(function (result) {
    var user = !result.error && result.data.session ? result.data.session.user : null;

    /* Accounts used to be one-press anonymous ones. Those are not
       carried over - they cannot be signed back into and have no
       name for a leaderboard - so one found here is signed out, and
       the next page load starts clean. */
    if (user && user.is_anonymous) {
      sb.auth.signOut().then(onDone, onDone);
      return;
    }

    currentUser = user;
    onDone();
  }).catch(function () {
    onDone();
  });
}

/* The signed-in user's username, from the metadata set at sign-up. */
function usernameOf(user) {
  return user && user.user_metadata && user.user_metadata.username
    ? user.user_metadata.username
    : "";
}

/* ------------------------------------------------------------------
   Saved cameras

   Matched by name and coordinates rather than by id: the points a
   visitor sees come straight from points.js and are given a fresh id
   every time the page loads (see nextId in map.js), so id is never
   something worth storing. Name and coordinates are what points.js
   itself is keyed on.
   ------------------------------------------------------------------ */

function samePlace(row, point) {
  return row.camera_name === point.name &&
         Number(row.lat).toFixed(6) === point.lat.toFixed(6) &&
         Number(row.lon).toFixed(6) === point.lon.toFixed(6);
}

function savedRowFor(point) {
  var i;

  for (i = 0; i < savedCameras.length; i++) {
    if (samePlace(savedCameras[i], point)) {
      return savedCameras[i];
    }
  }

  return null;
}

function withoutId(list, id) {
  var kept = [];
  var i;

  for (i = 0; i < list.length; i++) {
    if (list[i].id !== id) {
      kept.push(list[i]);
    }
  }

  return kept;
}

/* Only the map page has anything to show for this, so everywhere else
   it fetches nothing and stays out of the way. */
function loadSaved() {
  if (PAGE !== "index.html" || !currentUser) {
    return;
  }

  sb.from("saved_cameras").select("*").then(function (result) {
    if (result.error) {
      return;
    }

    savedCameras = result.data || [];
    if (typeof render === "function") {
      render();
    }
  });
}

/* Called by map.js's rowFor(), once per camera in the list. Returns
   nothing - not even an empty button - unless someone is actually
   signed in, so the row looks exactly as it always has otherwise. */
function accountStarButton(point) {
  var existing;
  var button;

  if (!configured || !currentUser) {
    return null;
  }

  existing = savedRowFor(point);

  button = document.createElement("button");
  button.className = existing ? "star saved" : "star";
  button.title = existing ? "Remove from saved" : "Save this camera";
  button.textContent = existing ? "★" : "☆";

  button.onclick = function () {
    toggleSaved(point, button);
  };

  return button;
}

function toggleSaved(point, button) {
  var existing = savedRowFor(point);

  button.disabled = true;

  if (existing) {
    removeSaved(existing, function () {
      button.disabled = false;
    });
    return;
  }

  sb.from("saved_cameras").insert({
    user_id: currentUser.id,
    camera_name: point.name,
    lat: point.lat,
    lon: point.lon,
    note: point.note || ""
  }).select().then(function (result) {
    button.disabled = false;

    if (result.error) {
      if (result.error.code === "23505") {
        /* another tab saved it a moment ago */
        loadSaved();
      }
      return;
    }

    savedCameras.push(result.data[0]);
    if (typeof render === "function") {
      render();
    }
  });
}

function removeSaved(saved, done) {
  sb.from("saved_cameras").delete().eq("id", saved.id).then(function (result) {
    if (done) {
      done();
    }

    if (result.error) {
      return;
    }

    savedCameras = withoutId(savedCameras, saved.id);
    if (typeof render === "function") {
      render();
    }
  });
}

/* ------------------------------------------------------------------
   The account page
   ------------------------------------------------------------------ */

function showAccountPage() {
  var outMsg = document.getElementById("account-signedout");
  var inMsg  = document.getElementById("account-signedin");
  var who    = document.getElementById("account-username");

  if (!outMsg || !inMsg) {
    return;
  }

  if (!configured) {
    outMsg.style.display = "none";
    inMsg.style.display = "none";
    document.getElementById("account-unavailable").style.display = "block";
    return;
  }

  outMsg.style.display = currentUser ? "none" : "block";
  inMsg.style.display  = currentUser ? "block" : "none";

  if (currentUser && who) {
    who.textContent = usernameOf(currentUser);
  }
}

function setUpAccountPage() {
  var shown      = document.getElementById("new-username");
  var reroll     = document.getElementById("reroll-button");
  var newPw      = document.getElementById("new-password");
  var newPw2     = document.getElementById("new-password-again");
  var signupBtn  = document.getElementById("signup-button");
  var signupNote = document.getElementById("signup-note");

  var inName     = document.getElementById("signin-username");
  var inPw       = document.getElementById("signin-password");
  var signinBtn  = document.getElementById("signin-button");
  var signinNote = document.getElementById("signin-note");

  showAccountPage();

  if (!signupBtn || !signinBtn) {
    return;
  }

  /* -------- making an account -------- */

  shown.textContent = generateUsername();

  reroll.onclick = function () {
    shown.textContent = generateUsername();
    signupNote.textContent = "";
  };

  signupBtn.onclick = function () {
    var username = shown.textContent;
    var problem = passwordProblem(newPw.value);

    signupNote.textContent = "";

    if (problem) {
      signupNote.textContent = problem;
      newPw.focus();
      return;
    }

    if (newPw.value !== newPw2.value) {
      signupNote.textContent = "The two passwords do not match.";
      newPw2.focus();
      return;
    }

    signupBtn.disabled = true;
    reroll.disabled = true;
    signupNote.textContent = "Making the account…";

    signUp(username, newPw.value, function (error, finalName) {
      signupBtn.disabled = false;
      reroll.disabled = false;

      if (error) {
        signupNote.textContent = error;
        return;
      }

      /* If the shown name was taken and a fresh one used instead,
         the person must see the one they actually got. */
      shown.textContent = finalName;
      newPw.value = "";
      newPw2.value = "";
      signupNote.textContent = "";
      showAccountPage();
    });
  };

  /* -------- signing back in -------- */

  signinBtn.onclick = function () {
    signinNote.textContent = "";

    if (inName.value.trim() === "" || inPw.value === "") {
      signinNote.textContent = "Both boxes are needed.";
      return;
    }

    signinBtn.disabled = true;
    signinNote.textContent = "Signing in…";

    signIn(inName.value, inPw.value, function (error) {
      signinBtn.disabled = false;

      if (error) {
        signinNote.textContent = error;
        return;
      }

      inName.value = "";
      inPw.value = "";
      signinNote.textContent = "";
      showAccountPage();
    });
  };

  inPw.onkeydown = function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      signinBtn.onclick();
    }
  };
}

/* ------------------------------------------------------------------
   The report page
   ------------------------------------------------------------------ */

/* ---------------- proof files ----------------

   A photo is drawn onto a canvas and read back out as a fresh JPEG.
   That throws away everything in the original file that was not the
   picture: the GPS position, the phone model, the time - all of the
   metadata a camera writes in. It also caps the size. A video cannot
   be rebuilt in the browser like that, so it is sent as it is and the
   page says so. */

var PROOF_MAX_BYTES = 20 * 1024 * 1024;
var PROOF_MAX_EDGE = 1600;

function stripImage(file, onDone) {
  var url = URL.createObjectURL(file);
  var img = new Image();

  img.onload = function () {
    var w = img.width;
    var h = img.height;
    var scale = Math.min(1, PROOF_MAX_EDGE / Math.max(w, h));
    var canvas = document.createElement("canvas");

    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);

    canvas.toBlob(function (blob) {
      onDone(blob ? null : "That image could not be read.", blob, "image/jpeg", "jpg");
    }, "image/jpeg", 0.85);
  };

  img.onerror = function () {
    URL.revokeObjectURL(url);
    onDone("That image could not be read.");
  };

  img.src = url;
}

/* Hands back a blob ready to upload, its mime and a file extension. */
function prepareProof(file, onDone) {
  if (!file) {
    onDone(null, null);
    return;
  }

  if (file.size > PROOF_MAX_BYTES) {
    onDone("That file is over 20 MB.");
    return;
  }

  /* Only the kinds the storage bucket will accept; anything else is
     refused here with a reason rather than by the upload without one. */
  if (file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp") {
    stripImage(file, onDone);
    return;
  }

  if (file.type === "video/mp4" || file.type === "video/webm") {
    onDone(null, file, file.type, file.type === "video/mp4" ? "mp4" : "webm");
    return;
  }

  onDone("Only JPEG, PNG, WebP, MP4 or WebM files can be sent.");
}

function randomName() {
  var n = new Uint32Array(2);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(n);
  } else {
    n[0] = Math.floor(Math.random() * 4294967296);
    n[1] = Math.floor(Math.random() * 4294967296);
  }
  return n[0].toString(16) + n[1].toString(16);
}

/* Uploads under the user's own prefix - which is the only place the
   storage policy lets them write - then records the file against the
   report. */
function uploadProof(reportId, blob, mime, ext, onDone) {
  var path = currentUser.id + "/" + reportId + "/" + randomName() + "." + ext;

  sb.storage.from("proof").upload(path, blob, { contentType: mime, upsert: false })
    .then(function (result) {
      if (result.error) {
        onDone("The file could not be uploaded.");
        return;
      }
      return sb.from("report_proof").insert({
        report_id: reportId,
        user_id: currentUser.id,
        storage_path: path,
        mime: mime,
        bytes: blob.size
      }).then(function (row) {
        onDone(row.error ? "The file was uploaded but could not be recorded." : null);
      });
    });
}

/* ---------------- the report page ----------------

   Two forms on one page. ?camera=<id> in the address means "report
   the state of this camera", otherwise it is "report a camera the map
   does not have". Both go into the reports table; the database
   decides whether enough people agree for it to count on its own. */

var LONDON_BOX = { s: 51.28, w: -0.51, n: 51.70, e: 0.33 };

function inLondonBox(lat, lon) {
  return lat >= LONDON_BOX.s && lat <= LONDON_BOX.n &&
         lon >= LONDON_BOX.w && lon <= LONDON_BOX.e;
}

/* What the database would say back, in plain words. */
function reportProblem(error) {
  var code = error && error.code;
  var msg = (error && error.message) || "";

  if (code === "23514") {
    return "That is outside London. This map covers Greater London only.";
  }
  if (code === "23505") {
    return "You have already reported this one.";
  }
  if (/rate/i.test(msg) || code === "P0001" && /rate/i.test(msg)) {
    return "Too many reports in a short time. Try again in a few minutes.";
  }
  if (code === "P0001") {
    return msg;   /* a raise from one of our own triggers, already plain */
  }
  return "Could not send that in. Try again in a moment.";
}

/* xp_rules is public: the form can say what a report is worth. */
var xpRules = {};

function loadXpRules(onDone) {
  sb.from("xp_rules").select("key,xp").then(function (result) {
    var i;
    if (!result.error && result.data) {
      for (i = 0; i < result.data.length; i++) {
        xpRules[result.data[i].key] = result.data[i].xp;
      }
    }
    onDone();
  });
}

function xpLine(key) {
  return typeof xpRules[key] === "number"
    ? "Worth " + xpRules[key] + " XP once it is confirmed."
    : "";
}

function setUpReportPage() {
  var form   = document.getElementById("report-form");
  var locked = document.getElementById("report-locked");
  var newBox = document.getElementById("report-new");
  var stBox  = document.getElementById("report-status");
  var title  = document.getElementById("report-title");

  var cameraId = (function () {
    var m = /[?&]camera=(\d+)/.exec(window.location.search);
    return m ? Number(m[1]) : null;
  })();

  if (!form || !locked) {
    return;
  }

  form.style.display   = currentUser ? "block" : "none";
  locked.style.display = currentUser ? "none" : "block";

  if (!currentUser) {
    return;
  }

  newBox.style.display = cameraId ? "none" : "block";
  stBox.style.display  = cameraId ? "block" : "none";

  loadXpRules(function () {
    if (cameraId) {
      setUpStatusReport(cameraId);
    } else {
      setUpNewReport();
    }
  });

  if (cameraId) {
    title.textContent = "Report a camera's state";
  }
}

function setUpNewReport() {
  var typeSel   = document.getElementById("s-type");
  var xpNote    = document.getElementById("s-xp");
  var latIn     = document.getElementById("s-lat");
  var lonIn     = document.getElementById("s-lon");
  var locate    = document.getElementById("locate-button");
  var locNote   = document.getElementById("locate-note");
  var nameIn    = document.getElementById("s-name");
  var noteIn    = document.getElementById("s-note");
  var proofIn   = document.getElementById("s-proof");
  var button    = document.getElementById("submit-button");
  var note      = document.getElementById("submit-note");

  function showXp() {
    xpNote.textContent = xpLine("new_" + typeSel.value);
  }
  typeSel.onchange = showXp;
  showXp();

  /* The phone's own position, if it will give it. Six decimals is
     about a tenth of a metre, more than any phone can actually do. */
  locate.onclick = function (event) {
    event.preventDefault();
    if (!navigator.geolocation) {
      locNote.textContent = "This browser will not share a location.";
      return;
    }
    locNote.textContent = "Asking…";
    navigator.geolocation.getCurrentPosition(function (pos) {
      latIn.value = pos.coords.latitude.toFixed(6);
      lonIn.value = pos.coords.longitude.toFixed(6);
      locNote.textContent = "Filled in. Move the numbers if the camera is not right where you stand.";
    }, function () {
      locNote.textContent = "Could not get a location.";
    }, { enableHighAccuracy: true, timeout: 10000 });
  };

  button.onclick = function () {
    var lat  = parseFloat(latIn.value);
    var lon  = parseFloat(lonIn.value);
    var name = nameIn.value.trim();
    var file = proofIn.files && proofIn.files[0];

    note.textContent = "";

    if (name === "") {
      note.textContent = "Say where it is.";
      nameIn.focus();
      return;
    }
    if (isNaN(lat) || isNaN(lon)) {
      note.textContent = "Both coordinates need to be numbers.";
      latIn.focus();
      return;
    }
    if (!inLondonBox(lat, lon)) {
      note.textContent = "That is outside London. This map covers Greater London only.";
      latIn.focus();
      return;
    }

    button.disabled = true;
    note.textContent = file ? "Preparing the file…" : "Sending…";

    prepareProof(file, function (problem, blob, mime, ext) {
      if (problem) {
        button.disabled = false;
        note.textContent = problem;
        return;
      }

      note.textContent = "Sending…";

      sb.from("reports").insert({
        user_id: currentUser.id,
        kind: "new",
        type: typeSel.value,
        name: name,
        note: noteIn.value.trim(),
        lat: lat,
        lon: lon
      }).select("id").single().then(function (result) {
        if (result.error) {
          button.disabled = false;
          note.textContent = reportProblem(result.error);
          return;
        }

        function finish(uploadProblem) {
          button.disabled = false;
          latIn.value = ""; lonIn.value = ""; nameIn.value = ""; noteIn.value = "";
          proofIn.value = ""; locNote.textContent = "";
          note.textContent = uploadProblem
            ? "Sent, but " + uploadProblem.charAt(0).toLowerCase() + uploadProblem.slice(1)
            : "Sent for review. Thank you.";
        }

        if (blob) {
          uploadProof(result.data.id, blob, mime, ext, finish);
        } else {
          finish(null);
        }
      });
    });
  };
}

function setUpStatusReport(cameraId) {
  var nameEl   = document.getElementById("status-camera-name");
  var claimSel = document.getElementById("s-claim");
  var xpNote   = document.getElementById("s-claim-xp");
  var noteIn   = document.getElementById("s-status-note");
  var proofIn  = document.getElementById("s-status-proof");
  var button   = document.getElementById("submit-status-button");
  var note     = document.getElementById("submit-status-note");

  function showXp() {
    xpNote.textContent = xpLine("status_" + claimSel.value);
  }
  claimSel.onchange = showXp;
  showXp();

  /* The name, so the person can see they are on the right one. */
  sb.from("cameras").select("name,type,status").eq("id", cameraId).single()
    .then(function (result) {
      nameEl.textContent = result.error ? "camera #" + cameraId : result.data.name;
    });

  button.onclick = function () {
    var file = proofIn.files && proofIn.files[0];

    note.textContent = "";
    button.disabled = true;
    note.textContent = file ? "Preparing the file…" : "Sending…";

    prepareProof(file, function (problem, blob, mime, ext) {
      if (problem) {
        button.disabled = false;
        note.textContent = problem;
        return;
      }

      note.textContent = "Sending…";

      sb.from("reports").insert({
        user_id: currentUser.id,
        kind: "status",
        camera_id: cameraId,
        status_claim: claimSel.value,
        note: noteIn.value.trim()
      }).select("id").single().then(function (result) {
        if (result.error) {
          button.disabled = false;
          note.textContent = reportProblem(result.error);
          return;
        }

        function finish(uploadProblem) {
          button.disabled = false;
          noteIn.value = ""; proofIn.value = "";
          note.textContent = uploadProblem
            ? "Sent, but " + uploadProblem.charAt(0).toLowerCase() + uploadProblem.slice(1)
            : "Sent for review. Thank you.";
        }

        if (blob) {
          uploadProof(result.data.id, blob, mime, ext, finish);
        } else {
          finish(null);
        }
      });
    });
  };
}

/* ------------------------------------------------------------------
   Start up

   Nothing is drawn until the session has been looked up, so the nav
   does not change under the reader a moment after the page settles.
   ------------------------------------------------------------------ */

function start() {
  renderNav();

  if (PAGE === "account.html") {
    setUpAccountPage();
  } else if (PAGE === "report.html") {
    setUpReportPage();
  } else {
    loadSaved();
  }
}

if (configured) {
  restoreSession(start);
} else {
  start();
}
