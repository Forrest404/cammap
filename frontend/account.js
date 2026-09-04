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
var currentRole = "user"; /* from profiles, once signed in; the server re-checks */
var currentXp = 0;        /* likewise, and shown on the account page */
var savedCameras = [];    /* rows from saved_cameras, kept in step with the server */

/* ------------------------------------------------------------------
   When the network gives out

   Every call below hands its work to a promise and puts the page back
   in order when it comes back. If it never comes back - a dropped
   connection, a request that times out - the button it disabled on
   the way in stays disabled, still reading "Sending…", and there is
   no way out of it but a reload.

   So every chain ends in one of these. It is deliberately vague about
   what went wrong: from here the difference between no signal and a
   server that fell over is not knowable, and not useful.
   ------------------------------------------------------------------ */

function recover(button, note, message) {
  return function () {
    if (button) {
      button.disabled = false;
    }
    if (note) {
      note.textContent = message || "That did not go through. Try again in a moment.";
    }
  };
}

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

/* The map is at the root, because that is the page a web server hands
   out for the site's address; everything else lives in pages/. This
   file runs on both, so a link to another page has to be written from
   wherever it is being written. */
var IN_PAGES = window.location.pathname.indexOf("/pages/") !== -1;

function pageHref(name) {
  if (name === "index.html") {
    return IN_PAGES ? "../index.html" : "index.html";
  }
  return IN_PAGES ? name : "pages/" + name;
}

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

  /* The leaderboard is public: anyone can look. */
  navAccount.appendChild(navSeparator());
  navAccount.appendChild(navLink(pageHref("leaderboard.html"), "Leaderboard", PAGE === "leaderboard.html"));

  if (!currentUser) {
    navAccount.appendChild(navSeparator());
    navAccount.appendChild(navLink(pageHref("account.html"), "Account", PAGE === "account.html"));
    return;
  }

  navAccount.appendChild(navSeparator());
  navAccount.appendChild(navLink(pageHref("report.html"), "Report a camera", PAGE === "report.html"));

  if (isModerator()) {
    navAccount.appendChild(navSeparator());
    navAccount.appendChild(navLink(pageHref("moderate.html"), "Moderate", PAGE === "moderate.html"));
  }

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

/* The role decides whether the nav offers moderation. The client
   only uses it to show or hide the link; every moderating call is
   gated again on the server, so a wrong value here can show a page
   that then refuses to do anything. */
function loadRole(onDone) {
  if (!currentUser) {
    currentRole = "user";
    onDone();
    return;
  }
  sb.from("profiles").select("role,xp_total").eq("id", currentUser.id).single()
    .then(function (result) {
      currentRole = result.error ? "user" : (result.data.role || "user");
      currentXp = result.error ? 0 : (result.data.xp_total || 0);
      onDone();
    })
    .catch(function () {
      /* No role means no moderation link, which is the safe way to be
         wrong. The page still works; the server checks again anyway. */
      currentRole = "user";
      currentXp = 0;
      onDone();
    });
}

function isModerator() {
  return currentRole === "moderator" || currentRole === "admin";
}

function finishSignIn(user) {
  currentUser = user;
  loadRole(function () {
    renderNav();
    loadSaved();
    if (PAGE === "account.html") {
      showAccountPage();
    }
  });
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
    })
    .catch(function () {
      onDone("Could not reach the server. Check your connection and try again.");
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
  }).catch(function () {
    onDone("Could not reach the server. Check your connection and try again.", username);
  });
}

function signOut() {
  sb.auth.signOut().then(function () {
    currentUser = null;
    currentRole = "user";
    currentXp = 0;
    savedCameras = [];
    renderNav();

    /* The report page is no use signed out, and neither is the signed
       in half of the account page, so leave for the map. Everywhere
       else can stay where it is and just redraw. */
    if (PAGE === "report.html" || PAGE === "moderate.html") {
      window.location.href = pageHref("index.html");
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
    loadRole(onDone);
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

/* The type is part of the answer, not an afterthought. North End in
   Croydon is on the map twice at exactly the same coordinates - once
   as the fixed install, once as the van site it also is - and so is
   London Road. Comparing only name and position makes those two rows
   one row: starring either would light both stars, and saving the
   second would collide with the first. The database has said so since
   saved_cameras version 2, whose unique key is five columns wide; this
   is the client finally agreeing with it. */
function samePlace(row, point) {
  return row.camera_name === point.name &&
         (row.camera_type || "vancam") === point.type &&
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

/* Two pages have something to show for this - the stars beside the
   map's list, and the list on the account page - so everywhere else
   it fetches nothing and stays out of the way. */
function loadSaved() {
  if ((PAGE !== "index.html" && PAGE !== "account.html") || !currentUser) {
    return;
  }

  sb.from("saved_cameras").select("*").order("created_at", { ascending: false })
    .then(function (result) {
      if (result.error) {
        return;
      }

      savedCameras = result.data || [];
      redrawSaved();
    })
    .catch(function () {
      /* No saved list this time round. The stars simply do not fill;
         nothing else on the page depends on it. */
    });
}

/* ---------------- the saved list on the account page ----------------

   The star on the map page saves a camera and had nowhere to show
   what it saved, which made it a button whose effect you had to
   remember. This is where it went.

   Each row links to the map at the camera's own coordinates, which
   the map reads out of the address (see the hash handler at the foot
   of map.js), so a saved camera is one click from being looked at. */

function showSavedList() {
  var box   = document.getElementById("saved-box");
  var list  = document.getElementById("saved-list");
  var empty = document.getElementById("saved-empty");
  var i;

  if (!box || !list) {
    return;
  }

  box.style.display = currentUser ? "block" : "none";

  if (!currentUser) {
    return;
  }

  list.innerHTML = "";

  for (i = 0; i < savedCameras.length; i++) {
    list.appendChild(savedRow(savedCameras[i]));
  }

  empty.style.display = savedCameras.length === 0 ? "block" : "none";
}

function savedRow(saved) {
  var row = document.createElement("li");
  var go = document.createElement("a");
  var swatch = document.createElement("span");
  var name = document.createElement("span");
  var coords = document.createElement("span");
  var drop = document.createElement("button");

  go.className = "goto saved-goto";
  go.href = pageHref("index.html") + "#" +
            Number(saved.lat).toFixed(5) + "," + Number(saved.lon).toFixed(5);
  go.title = "Show on the map";

  swatch.className = "swatch";
  swatch.style.background = colourOf(saved.camera_type);
  swatch.title = typeLabel(saved.camera_type);
  go.appendChild(swatch);

  name.className = "name";
  name.textContent = saved.camera_name;
  go.appendChild(name);

  coords.className = "coords";
  coords.textContent = typeLabel(saved.camera_type) + " · " +
    Number(saved.lat).toFixed(4) + ", " + Number(saved.lon).toFixed(4);
  go.appendChild(coords);

  row.appendChild(go);

  drop.className = "remove";
  drop.textContent = "×";
  drop.title = "Remove from saved";
  drop.onclick = function () {
    drop.disabled = true;
    removeSaved(saved, function () {
      drop.disabled = false;
    });
  };
  row.appendChild(drop);

  return row;
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
    camera_type: point.type,
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
  }).catch(function () {
    button.disabled = false;
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
    redrawSaved();
  }).catch(function () {
    if (done) {
      done();
    }
  });
}

/* Both places a saved camera shows: the list on the map page, and the
   list on the account page. Whichever is on this page redraws. */
function redrawSaved() {
  if (typeof render === "function") {
    render();
  }
  if (PAGE === "account.html") {
    showSavedList();
  }
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
    var standing = document.getElementById("account-standing");
    if (standing) {
      standing.textContent = currentXp + " XP" + (isModerator() ? " \u00b7 " + currentRole : "");
    }
  }

  showSavedList();
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
    })
    .catch(function () {
      onDone("The file could not be uploaded.");
    });
}

/* ---------------- the report page ----------------

   Two forms on one page. ?camera=<id> in the address means "report
   the state of this camera", otherwise it is "report a camera the map
   does not have". Both go into the reports table; the database
   decides whether enough people agree for it to count on its own. */

/* The London box is inLondon() in frontend/shared.js, shared with the
   map so the two cannot come to disagree about where London ends.

   What the database would say back, in plain words. */
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
  }).catch(function () {
    /* The form is built in here, so it has to run either way. Without
       the rules it simply does not say what a report is worth. */
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

/* The cameras already on the map, for drawing behind the picker's
   pin. map.js keeps the same rows under this key for five minutes
   after it fetches them, so someone who came here from the map is
   answered out of their own browser. The key and the shape are map.js's;
   this only ever reads it, and falls back to asking the table. A
   failure here loses the context dots and nothing else, so it is
   quiet about it. */
var CONTEXT_KEY = "cammap.cameras";
var CONTEXT_TTL = 5 * 60 * 1000;

function contextCameras(onDone) {
  var raw;
  var saved;

  try {
    raw = window.localStorage.getItem(CONTEXT_KEY);
    saved = raw ? JSON.parse(raw) : null;
    if (saved && saved.at && Date.now() - saved.at < CONTEXT_TTL && Array.isArray(saved.rows)) {
      onDone(saved.rows);
      return;
    }
  } catch (err) {
    /* nothing usable in storage - ask the table instead */
  }

  if (!configured || !sb) {
    return;
  }

  sb.from("cameras")
    .select("lat,lon,type,status")
    .eq("visible", true)
    .limit(5000)
    .then(function (result) {
      if (!result.error && Array.isArray(result.data)) {
        onDone(result.data);
      }
    })
    .catch(function () {
      /* no context dots this time; the pin still works */
    });
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

  fillTypeSelect(typeSel, "fixedcam");

  function showXp() {
    xpNote.textContent = xpLine("new_" + typeSel.value);
  }
  typeSel.onchange = showXp;
  showXp();

  /* ---------------- the map and the two boxes ----------------

     Both say the same thing, and either may be used. Dragging the pin
     writes the numbers; typing numbers moves the pin. The guard below
     stops the two from talking each other in circles - without it,
     writing the boxes from a drag fires the input handler, which
     moves the pin, which fires drag again. */
  var syncing = false;

  var picker = typeof makePicker === "function" ? makePicker({
    container: "pick-map",
    lat: null,
    lon: null,
    draggable: true,
    onMove: function (lat, lon) {
      syncing = true;
      latIn.value = lat.toFixed(6);
      lonIn.value = lon.toFixed(6);
      syncing = false;
      note.textContent = "";
    }
  }) : null;

  function pinFromBoxes(fly) {
    var lat = parseFloat(latIn.value);
    var lon = parseFloat(lonIn.value);

    if (picker && !syncing && !isNaN(lat) && !isNaN(lon)) {
      picker.setPoint(lat, lon, fly);
    }
  }

  /* While the digits are still going in, move the pin but leave the
     map where it is: flying on every keystroke, through every partial
     number on the way, is unreadable. On the way out of the box -
     blur, or Enter - fly to it, because by then the number is meant,
     and a pin sitting somewhere off the edge of the map is worse than
     no pin at all. */
  latIn.oninput = function () { pinFromBoxes(false); };
  lonIn.oninput = function () { pinFromBoxes(false); };
  latIn.onchange = function () { pinFromBoxes(true); };
  lonIn.onchange = function () { pinFromBoxes(true); };

  /* The cameras already on the map, drawn behind the pin so a person
     can see whether theirs is one of them before sending it in. The
     map page leaves the same rows in storage for a few minutes, so
     arriving here from the map usually costs nothing; otherwise this
     is one small read of a table anyone may read. */
  if (picker) {
    contextCameras(function (rows) {
      picker.cameras(rows);
    });
  }

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

      /* Fly, unlike a keystroke: this is a deliberate jump to
         somewhere the map is probably not looking. */
      pinFromBoxes(true);
      locNote.textContent = "Filled in. Now drag the pin onto the camera - it is where you are standing, not where it is.";
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
    if (!inLondon(lat, lon)) {
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
      }).catch(recover(button, note));
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

  /* The name, so the person can see they are on the right one - and
     its position, which the report has to carry too. */
  var camera = null;

  sb.from("cameras").select("name,type,status,lat,lon").eq("id", cameraId).single()
    .then(function (result) {
      if (!result.error) {
        camera = result.data;
      }
      nameEl.textContent = camera ? camera.name : "camera #" + cameraId;

      /* Read-only: there is nothing to place here, only something to
         recognise. Saying "it is gone" about the wrong camera takes
         one off the map that is still there, so it is worth a look
         before you say it. */
      if (camera && typeof makePicker === "function") {
        makePicker({
          container: "status-map",
          lat: Number(camera.lat),
          lon: Number(camera.lon),
          draggable: false
        });
      }
    })
    .catch(function () {
      nameEl.textContent = "camera #" + cameraId;
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

      if (!camera) {
        button.disabled = false;
        note.textContent = "That camera could not be found.";
        return;
      }

      sb.from("reports").insert({
        user_id: currentUser.id,
        kind: "status",
        camera_id: cameraId,
        status_claim: claimSel.value,
        note: noteIn.value.trim(),
        lat: camera.lat,
        lon: camera.lon
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
      }).catch(recover(button, note));
    });
  };
}

/* ------------------------------------------------------------------
   The moderation page

   A queue of pending reports, newest first, with the proof attached
   to each. Approve and reject go through moderate_report, which
   checks the role again on the server: this page hiding itself from
   a non-moderator is a courtesy, not the lock.
   ------------------------------------------------------------------ */

var QUEUE_PAGE = 30;

function setUpModeratePage() {
  var locked = document.getElementById("moderate-locked");
  var panel  = document.getElementById("moderate-panel");

  if (!locked || !panel) {
    return;
  }

  if (!currentUser || !isModerator()) {
    locked.style.display = "block";
    panel.style.display = "none";
    return;
  }

  locked.style.display = "none";
  panel.style.display = "block";

  var tabs = document.querySelectorAll("#mod-tabs button");
  var i;

  for (i = 0; i < tabs.length; i++) {
    tabs[i].onclick = (function (button) {
      return function () {
        var j;
        var which = button.getAttribute("data-tab");
        for (j = 0; j < tabs.length; j++) {
          tabs[j].className = tabs[j] === button ? "toggle on" : "toggle";
        }
        document.getElementById("mod-queue").style.display = which === "queue" ? "block" : "none";
        document.getElementById("mod-history").style.display = which === "history" ? "block" : "none";
        document.getElementById("mod-cameras").style.display = which === "cameras" ? "block" : "none";
        if (which === "history") {
          loadHistory();
        } else if (which === "cameras") {
          setUpCamerasTab();
        } else {
          loadQueue();
        }
      };
    })(tabs[i]);
  }

  loadQueue();
}

/* ---------------- cameras: any camera, on or off the map ----------------

   The full list, seed and reported alike, with the search done in the
   browser: a few hundred rows is nothing to hold, and a moderator
   looking for "Croydon" should not wait on a round trip per letter.
   Adding a camera goes through moderate_add_camera, gated on the
   server like everything else here. */

var allCameras = [];
var camerasLoaded = false;
var showHiddenCameras = false;

function setUpCamerasTab() {
  var search = document.getElementById("c-search");
  var hiddenToggle = document.getElementById("c-hidden-toggle");
  var addButton = document.getElementById("c-add-button");

  fillTypeSelect(document.getElementById("c-type"), "fixedcam");

  if (!camerasLoaded) {
    search.oninput = function () { renderCameras(); };
    hiddenToggle.onclick = function () {
      showHiddenCameras = !showHiddenCameras;
      hiddenToggle.className = showHiddenCameras ? "toggle on" : "toggle";
      hiddenToggle.setAttribute("aria-pressed", showHiddenCameras ? "true" : "false");
      renderCameras();
    };
    addButton.onclick = addCameraByHand;
  }

  loadAllCameras();
}

function loadAllCameras() {
  var note = document.getElementById("cameras-note");

  note.textContent = "Loading…";

  /* A moderator's select on cameras returns hidden ones too, by the
     read policy. Ordered by name so the list reads like the map's. */
  sb.from("cameras")
    .select("id,name,note,lat,lon,type,status,source,visible")
    .order("name")
    .limit(5000)
    .then(function (result) {
      note.textContent = "";
      if (result.error) {
        note.textContent = "Could not load the cameras.";
        return;
      }
      allCameras = result.data;
      camerasLoaded = true;
      renderCameras();
    })
    .catch(function () {
      note.textContent = "Could not load the cameras.";
    });
}

function renderCameras() {
  var list  = document.getElementById("cameras-list");
  var empty = document.getElementById("cameras-empty");
  var q = document.getElementById("c-search").value.trim().toLowerCase();
  var shown = 0;
  var i;
  var c;

  list.innerHTML = "";

  for (i = 0; i < allCameras.length; i++) {
    c = allCameras[i];
    if (!c.visible && !showHiddenCameras) { continue; }
    if (q && c.name.toLowerCase().indexOf(q) === -1) { continue; }
    list.appendChild(cameraRow(c));
    shown++;
  }

  empty.style.display = shown === 0 ? "block" : "none";
}

function cameraRow(c) {
  var row = document.createElement("li");
  var head = document.createElement("div");
  var body = document.createElement("div");
  var actions = document.createElement("div");

  head.className = "queue-head";
  body.className = "queue-body";
  actions.className = "row";
  if (!c.visible) { row.className = "done"; }

  var what = document.createElement("strong");
  what.textContent = c.name;
  head.appendChild(what);

  var meta = document.createElement("span");
  meta.className = "coords";
  meta.textContent = typeLabel(c.type) + " · " + c.status + " · " +
    (c.visible ? "on the map" : "hidden") + " · " +
    { seed: "from the published record", report: "from a report", admin: "added by hand" }[c.source] +
    " · " + Number(c.lat).toFixed(5) + ", " + Number(c.lon).toFixed(5);
  head.appendChild(meta);

  if (c.note) {
    body.textContent = c.note;
    body.appendChild(document.createElement("br"));
  }
  var onMap = document.createElement("a");
  onMap.href = pageHref("index.html") + "#" + Number(c.lat).toFixed(5) + "," + Number(c.lon).toFixed(5);
  onMap.target = "_blank";
  onMap.rel = "noopener noreferrer";
  onMap.textContent = "See on the map →";
  body.appendChild(onMap);

  var outcome = document.createElement("span");
  outcome.className = "note";

  var b = document.createElement("button");
  b.textContent = c.visible ? "Remove from map" : "Put back on map";
  if (c.visible) { b.className = "quiet"; }
  b.onclick = function () {
    var why = null;
    if (c.visible) {
      why = window.prompt("Why is this camera coming off the map?", "");
      if (why === null) { return; }
    }
    b.disabled = true;
    outcome.textContent = "…";
    undo(c.id, c.visible ? "hide_camera" : "unhide_camera", why, function (problem) {
      if (problem) {
        b.disabled = false;
        outcome.textContent = problem;
        return;
      }
      c.visible = !c.visible;
      renderCameras();
    });
  };

  actions.appendChild(b);
  actions.appendChild(outcome);
  row.appendChild(head);
  row.appendChild(body);
  row.appendChild(actions);
  return row;
}

function addCameraByHand() {
  var typeSel = document.getElementById("c-type");
  var statusSel = document.getElementById("c-status");
  var latIn = document.getElementById("c-lat");
  var lonIn = document.getElementById("c-lon");
  var nameIn = document.getElementById("c-name");
  var noteIn = document.getElementById("c-note");
  var button = document.getElementById("c-add-button");
  var note = document.getElementById("c-add-note");
  var lat = parseFloat(latIn.value);
  var lon = parseFloat(lonIn.value);

  note.textContent = "";

  if (nameIn.value.trim() === "") {
    note.textContent = "Give it a name.";
    nameIn.focus();
    return;
  }
  if (isNaN(lat) || isNaN(lon)) {
    note.textContent = "Both coordinates need to be numbers.";
    latIn.focus();
    return;
  }
  if (!inLondon(lat, lon)) {
    note.textContent = "That is outside London. This map covers Greater London only.";
    latIn.focus();
    return;
  }

  button.disabled = true;
  note.textContent = "Adding…";

  sb.rpc("moderate_add_camera", {
    cam_name: nameIn.value.trim(),
    cam_note: noteIn.value.trim(),
    cam_lat: lat,
    cam_lon: lon,
    cam_type: typeSel.value,
    cam_status: statusSel.value
  }).then(function (result) {
    button.disabled = false;
    if (result.error) {
      note.textContent = result.error.message || "That did not go through.";
      return;
    }
    try { window.localStorage.removeItem("cammap.cameras"); } catch (e) {}
    latIn.value = ""; lonIn.value = ""; nameIn.value = ""; noteIn.value = "";
    note.textContent = "On the map as camera #" + result.data + ".";
    loadAllCameras();
  }).catch(recover(button, note));
}

/* ---------------- history: undoing decisions ----------------

   Approved and rejected reports, newest first, each with the one
   action that reverses it, and every camera that came from a report
   with a way to take it off the map or put it back. All four actions
   go through moderate_undo, gated on the server like the rest. */

function loadHistory() {
  var list  = document.getElementById("history-list");
  var empty = document.getElementById("history-empty");
  var note  = document.getElementById("history-note");

  note.textContent = "Loading…";

  sb.from("reports")
    .select("id,kind,camera_id,type,status_claim,name,note,lat,lon,state,resolved_at,resolution_note,profiles!reports_user_id_fkey(username),cameras(id,name,visible,status)")
    .in("state", ["approved", "rejected", "merged"])
    .order("resolved_at", { ascending: false, nullsFirst: false })
    .limit(QUEUE_PAGE)
    .then(function (result) {
      var i;

      list.innerHTML = "";
      note.textContent = "";

      if (result.error) {
        note.textContent = "Could not load the history.";
        return;
      }

      empty.style.display = result.data.length === 0 ? "block" : "none";

      for (i = 0; i < result.data.length; i++) {
        list.appendChild(historyRow(result.data[i]));
      }
    })
    .catch(function () {
      note.textContent = "Could not load the history.";
    });
}

function undo(target, action, noteText, onDone) {
  sb.rpc("moderate_undo", { target: target, action: action, note: noteText || null })
    .then(function (result) {
      if (!result.error) {
        try { window.localStorage.removeItem("cammap.cameras"); } catch (e) {}
      }
      onDone(result.error ? (result.error.message || "That did not go through.") : null);
    })
    .catch(function () {
      onDone("That did not go through. Try again in a moment.");
    });
}

function stateLabel(state) {
  return { approved: "Approved", rejected: "Rejected", merged: "Merged into an existing camera" }[state] || state;
}

function historyRow(r) {
  var row = document.createElement("li");
  var head = document.createElement("div");
  var body = document.createElement("div");
  var actions = document.createElement("div");
  var cam = r.cameras;

  head.className = "queue-head";
  body.className = "queue-body";
  actions.className = "row";

  var what = document.createElement("strong");
  what.textContent = (r.kind === "new"
    ? typeLabel(r.type) + " — " + (r.name || "")
    : "State: " + (cam ? cam.name : "camera #" + r.camera_id) + " is " + claimLabel(r.status_claim));
  head.appendChild(what);

  var meta = document.createElement("span");
  meta.className = "coords";
  meta.textContent = stateLabel(r.state) +
    " · " + (r.profiles && r.profiles.username ? r.profiles.username : "?") +
    (r.resolved_at ? " · " + new Date(r.resolved_at).toLocaleString() : "") +
    (r.resolution_note ? " · " + r.resolution_note : "");
  head.appendChild(meta);

  if (cam) {
    var camLine = document.createElement("span");
    camLine.className = "coords";
    camLine.textContent = "Camera #" + cam.id + " · " + (cam.visible ? "on the map" : "hidden") + " · " + cam.status;
    body.appendChild(camLine);
    body.appendChild(document.createElement("br"));
  }

  var onMap = document.createElement("a");
  onMap.href = pageHref("index.html") + "#" + Number(r.lat).toFixed(5) + "," + Number(r.lon).toFixed(5);
  onMap.target = "_blank";
  onMap.rel = "noopener noreferrer";
  onMap.textContent = "See on the map →";
  body.appendChild(onMap);

  var outcome = document.createElement("span");
  outcome.className = "note";

  function button(text, quiet, target, action, confirmText) {
    var b = document.createElement("button");
    b.textContent = text;
    if (quiet) { b.className = "quiet"; }
    b.onclick = function () {
      var why = confirmText ? window.prompt(confirmText, "") : null;
      if (confirmText && why === null) { return; }
      b.disabled = true;
      outcome.textContent = "…";
      undo(target, action, why, function (problem) {
        if (problem) {
          b.disabled = false;
          outcome.textContent = problem;
          return;
        }
        outcome.textContent = "Done.";
        loadHistory();
      });
    };
    return b;
  }

  /* Which undo fits: an approval can be retracted; a rejection can be
     reconsidered; a camera on the map can be hidden, a hidden one put
     back. Merged reports have nothing to undo - the camera they merged
     into has its own row. */
  if (r.state === "approved") {
    actions.appendChild(button("Retract approval", true, r.id, "retract",
      "Why is this approval being taken back? (the reporter loses the XP)"));
  }
  if (r.state === "rejected") {
    actions.appendChild(button("Approve after all", false, r.id, "reapprove", null));
  }
  if (cam && cam.visible) {
    actions.appendChild(button("Remove from map", true, cam.id, "hide_camera",
      "Why is this camera coming off the map?"));
  }
  if (cam && !cam.visible) {
    actions.appendChild(button("Put back on map", false, cam.id, "unhide_camera", null));
  }

  actions.appendChild(outcome);

  row.appendChild(head);
  row.appendChild(body);
  row.appendChild(actions);
  return row;
}

function loadQueue() {
  var list  = document.getElementById("queue-list");
  var empty = document.getElementById("queue-empty");
  var note  = document.getElementById("queue-note");

  note.textContent = "Loading…";

  sb.from("reports")
    .select("id,user_id,kind,camera_id,type,status_claim,name,note,lat,lon,created_at,profiles!reports_user_id_fkey(username),report_proof(id,storage_path,mime)")
    .eq("state", "pending")
    .order("created_at", { ascending: false })
    .limit(QUEUE_PAGE)
    .then(function (result) {
      var i;

      list.innerHTML = "";
      note.textContent = "";

      if (result.error) {
        note.textContent = "Could not load the queue.";
        return;
      }

      empty.style.display = result.data.length === 0 ? "block" : "none";

      for (i = 0; i < result.data.length; i++) {
        list.appendChild(queueRow(result.data[i]));
      }
    })
    .catch(function () {
      note.textContent = "Could not load the queue.";
    });
}

/* typeLabel() is in frontend/shared.js, so the queue names a kind of
   camera exactly as the map's legend and the report form do. */

function claimLabel(claim) {
  var names = { nonfunctional: "not working", removed: "gone", active: "back in use" };
  return names[claim] || claim || "";
}

function queueRow(r) {
  var row = document.createElement("li");
  var head = document.createElement("div");
  var body = document.createElement("div");
  var proof = document.createElement("div");
  var actions = document.createElement("div");
  var i;

  head.className = "queue-head";
  body.className = "queue-body";
  proof.className = "queue-proof";
  actions.className = "row";

  var what = document.createElement("strong");
  what.textContent = r.kind === "new"
    ? "New: " + typeLabel(r.type) + " — " + (r.name || "")
    : "State: camera #" + r.camera_id + " is " + claimLabel(r.status_claim);
  head.appendChild(what);

  var meta = document.createElement("span");
  meta.className = "coords";
  meta.textContent = (r.profiles && r.profiles.username ? r.profiles.username : "?") +
    " · " + new Date(r.created_at).toLocaleString() +
    " · " + Number(r.lat).toFixed(5) + ", " + Number(r.lon).toFixed(5);
  head.appendChild(meta);

  if (r.note) {
    body.textContent = r.note;
  }

  var onMap = document.createElement("a");
  onMap.href = pageHref("index.html") + "#" + Number(r.lat).toFixed(5) + "," + Number(r.lon).toFixed(5);
  onMap.target = "_blank";
  onMap.rel = "noopener noreferrer";
  onMap.textContent = "See on the map →";
  body.appendChild(document.createElement("br"));
  body.appendChild(onMap);

  /* Proof is in a private bucket: each file needs a short-lived
     signed address, made only when a moderator is looking. */
  if (r.report_proof && r.report_proof.length) {
    for (i = 0; i < r.report_proof.length; i++) {
      proof.appendChild(proofThumb(r.report_proof[i]));
    }
  }

  var approve = document.createElement("button");
  approve.textContent = "Approve";
  var reject = document.createElement("button");
  reject.className = "quiet";
  reject.textContent = "Reject";
  var outcome = document.createElement("span");
  outcome.className = "note";

  function act(action) {
    approve.disabled = true;
    reject.disabled = true;
    outcome.textContent = "…";

    sb.rpc("moderate_report", { report_id: r.id, action: action, note: null })
      .then(function (result) {
        if (result.error) {
          approve.disabled = false;
          reject.disabled = false;
          outcome.textContent = result.error.message || "That did not go through.";
          return;
        }
        row.className = "done";
        outcome.textContent = action === "approve" ? "Approved." : "Rejected.";
        /* the map cache is five minutes old at most; a moderator who
           just approved something should see it on their next look */
        try { window.localStorage.removeItem("cammap.cameras"); } catch (e) {}
      })
      .catch(function () {
        approve.disabled = false;
        reject.disabled = false;
        outcome.textContent = "That did not go through. Try again in a moment.";
      });
  }

  approve.onclick = function () { act("approve"); };
  reject.onclick = function () { act("reject"); };

  actions.appendChild(approve);
  actions.appendChild(reject);
  actions.appendChild(outcome);

  row.appendChild(head);
  row.appendChild(body);
  row.appendChild(proof);
  row.appendChild(actions);
  return row;
}

function proofThumb(p) {
  var holder = document.createElement("a");
  holder.className = "proof";
  holder.target = "_blank";
  holder.textContent = "…";

  sb.storage.from("proof").createSignedUrl(p.storage_path, 600).then(function (result) {
    holder.textContent = "";
    if (result.error) {
      holder.textContent = "(proof unavailable)";
      return;
    }
    holder.href = result.data.signedUrl;
    if (/^image\//.test(p.mime)) {
      var img = document.createElement("img");
      img.src = result.data.signedUrl;
      img.alt = "proof";
      holder.appendChild(img);
    } else {
      holder.textContent = "video →";
    }
  }).catch(function () {
    holder.textContent = "(proof unavailable)";
  });

  return holder;
}

/* ------------------------------------------------------------------
   The leaderboard

   Three tables the database refreshes on a timer, so a busy day
   costs it nothing per visitor. Only a username and a number are in
   them - the views hold no more than that.
   ------------------------------------------------------------------ */

function setUpLeaderboardPage() {
  var tabs = document.querySelectorAll("#board-tabs button");
  var i;

  if (!tabs.length) {
    return;
  }

  for (i = 0; i < tabs.length; i++) {
    tabs[i].onclick = (function (button) {
      return function () {
        var j;
        for (j = 0; j < tabs.length; j++) {
          tabs[j].className = tabs[j] === button ? "toggle on" : "toggle";
        }
        loadBoard(button.getAttribute("data-view"));
      };
    })(tabs[i]);
  }

  tabs[0].className = "toggle on";
  loadBoard(tabs[0].getAttribute("data-view"));
}

function loadBoard(view) {
  var body  = document.getElementById("board-body");
  var note  = document.getElementById("board-note");
  var empty = document.getElementById("board-empty");

  if (!configured) {
    note.textContent = "The leaderboard is not available on this copy of the site.";
    return;
  }

  note.textContent = "Loading…";
  body.innerHTML = "";

  sb.from(view).select("username,xp_total,reports_approved").limit(100)
    .then(function (result) {
      var i;
      var me = usernameOf(currentUser);

      note.textContent = "";

      if (result.error) {
        note.textContent = "Could not load the leaderboard.";
        return;
      }

      empty.style.display = result.data.length === 0 ? "block" : "none";

      for (i = 0; i < result.data.length; i++) {
        body.appendChild(boardRow(i + 1, result.data[i], result.data[i].username === me));
      }
    })
    .catch(function () {
      note.textContent = "Could not load the leaderboard.";
    });
}

function boardRow(rank, r, mine) {
  var tr = document.createElement("tr");
  var cells = [rank, r.username, r.xp_total, r.reports_approved];
  var i;
  var td;

  if (mine) {
    tr.className = "me";
  }

  for (i = 0; i < cells.length; i++) {
    td = document.createElement("td");
    td.textContent = cells[i];
    tr.appendChild(td);
  }

  return tr;
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
    loadSaved();
  } else if (PAGE === "report.html") {
    setUpReportPage();
  } else if (PAGE === "moderate.html") {
    setUpModeratePage();
  } else if (PAGE === "leaderboard.html") {
    setUpLeaderboardPage();
  } else {
    loadSaved();
  }
}

if (configured) {
  restoreSession(start);
} else {
  start();
}
