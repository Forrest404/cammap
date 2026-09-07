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

/* ---------------- a passphrase, made here ----------------

   Lockout is the predictable cost of the anonymity choice: with no
   email there is no reset, so the password is the whole of the way
   back in, and a password a person makes up on the spot is either
   weak or forgotten. So the sign-up form offers to make one: five
   words from the same two lists the username is drawn from, the
   first capitalised, hyphens between, and a number on the end -
   "Copper-heron-tidal-marsh-glen-42". That passes the dashboard's
   rule (a capital, lower case, a digit, and the hyphens are the
   symbols) and it is the kind of thing a person can read off a card
   and type.

   How random it is, so nobody has to take it on trust. The two lists
   together hold 274 distinct words (one, birch, is in both, and is
   counted once), so five draws are 5 x log2(274) = 40.5 bits, and the
   number, 0 to 99, adds log2(100) = 6.6: about 47 bits in all, every
   one of them from crypto.getRandomValues. Which word is capitalised
   is fixed and adds nothing. For scale, a ten-character password of
   the shape the rule asks for, chosen by a person, is usually
   reckoned at 30 bits or fewer. A guess against the sign-in form is
   rate-limited by Supabase; 47 bits is well beyond an offline
   attack's patience for a hash bcrypt made, which is what Supabase
   stores.

   randomBelow() takes a 32-bit value and throws away the top of the
   range that does not divide evenly, so no word is more likely than
   another - pickFrom() uses a plain modulo, which for a username is
   fine and for a password is a bias worth the three extra lines.
   Without crypto.getRandomValues nothing is made: Math.random is not
   a source for a password, and the person is told to choose their
   own rather than handed a weak one that looks strong. */
var PASSPHRASE_WORDS = 5;

function randomBelow(n) {
  var buf = new Uint32Array(1);
  var limit = Math.floor(4294967296 / n) * n;

  do {
    window.crypto.getRandomValues(buf);
  } while (buf[0] >= limit);

  return buf[0] % n;
}

/* The two lists as one, each word once. Built on first use. */
var passphraseWords = null;

function passphraseList() {
  var seen = {};
  var all = WORDS_A.concat(WORDS_B);
  var i;

  if (passphraseWords) {
    return passphraseWords;
  }
  passphraseWords = [];
  for (i = 0; i < all.length; i++) {
    if (!seen[all[i]]) {
      seen[all[i]] = true;
      passphraseWords.push(all[i]);
    }
  }
  return passphraseWords;
}

/* A passphrase, or null where the browser has no safe randomness. */
function makePassphrase() {
  var words;
  var picked = [];
  var i;

  if (!(window.crypto && window.crypto.getRandomValues)) {
    return null;
  }

  words = passphraseList();
  for (i = 0; i < PASSPHRASE_WORDS; i++) {
    picked.push(words[randomBelow(words.length)]);
  }
  picked[0] = picked[0].charAt(0).toUpperCase() + picked[0].slice(1);

  return picked.join("-") + "-" + randomBelow(100);
}

var NO_PASSPHRASE = "This browser cannot make a safe one; choose a password of your own.";

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

  /* The report form is everyone's too, since the account is asked
     for at the moment of sending and not before (see "The report
     page", below). The link used to appear only once someone was
     signed in, which meant the people the form is for - someone who
     has just seen a van and has no account - never saw the way to
     it. */
  navAccount.appendChild(navSeparator());
  navAccount.appendChild(navLink(pageHref("report.html"), "Report a camera", PAGE === "report.html"));

  if (!currentUser) {
    navAccount.appendChild(navSeparator());
    navAccount.appendChild(navLink(pageHref("account.html"), "Account", PAGE === "account.html"));
    return;
  }

  if (isModerator()) {
    navAccount.appendChild(navSeparator());
    navModerate = navLink(pageHref("moderate.html"), "Moderate", PAGE === "moderate.html");
    navAccount.appendChild(navModerate);

    /* The count comes a moment after the link, in its own request,
       so the nav is drawn once and the number is filled in when it
       is known rather than the whole nav waiting on it. */
    refreshBacklog();
  }

  navAccount.appendChild(navSeparator());

  var out = navLink("#", "Log out", false);
  out.onclick = function (event) {
    event.preventDefault();
    signOut();
  };
  navAccount.appendChild(out);
}

/* ---------------- what is waiting ----------------

   A queue nobody can see the length of is a queue nobody can plan
   around. Before this, the only way to know whether anything was
   waiting was to open the moderation page and look, which meant a
   moderator who was not already looking never knew - and the reports
   sat. Now the Moderate link carries the count, "Moderate (12)", on
   every page, and the top of the queue says how long the oldest one
   has been waiting, which is the number that says whether the queue
   is being kept up with.

   The count is a head request - count only, no rows - so on every
   page load a moderator pays for one small answer and not for the
   queue itself. It runs only when the person is a moderator, and not
   only because the number means nothing to anyone else: the reports
   read policy lets a person see their own reports, so the same query
   from a plain account would come back with a count of theirs and
   the nav would show it as the site's. isModerator() is the guard,
   and the server's policy is what makes the count a moderator's. */

var navModerate = null;    /* the Moderate link, once the nav has drawn it */
var pendingCount = null;   /* the last count, or null while unknown */

function countPending(onDone) {
  sb.from("reports")
    .select("id", { count: "exact", head: true })
    .eq("state", "pending")
    .then(function (result) {
      onDone(result.error ? null : result.count);
    })
    .catch(function () {
      onDone(null);
    });
}

/* When the oldest pending report was sent, or null. One row, sorted
   the other way from the queue. */
function oldestPending(onDone) {
  sb.from("reports")
    .select("created_at")
    .eq("state", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .then(function (result) {
      onDone(!result.error && result.data && result.data[0] ? result.data[0].created_at : null);
    })
    .catch(function () {
      onDone(null);
    });
}

/* "3 minutes", "5 hours", "2 days", "3 weeks": how long ago an ISO
   time was, in the one unit a person would say. Never more precise
   than that - the age of the oldest report is a measure of whether
   the queue is being kept up with, and minutes past two days are
   not part of that answer. */
function ageOf(iso) {
  var seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  var n;
  var unit;

  if (seconds < 3600) {
    n = Math.max(1, Math.round(seconds / 60));
    unit = "minute";
  } else if (seconds < 48 * 3600) {
    n = Math.round(seconds / 3600);
    unit = "hour";
  } else if (seconds < 14 * 86400) {
    n = Math.round(seconds / 86400);
    unit = "day";
  } else {
    n = Math.round(seconds / (7 * 86400));
    unit = "week";
  }

  return n + " " + unit + (n === 1 ? "" : "s");
}

/* Redraws the count wherever it shows: on the nav link, and - on the
   moderation page - the line above the queue with the oldest's age.
   Called when the nav is drawn and after anything that changes what
   is pending: a decision, a bulk run, an approval taken back. A
   failed count leaves the link reading "Moderate" with no number,
   which is the honest state rather than a stale one. */
function refreshBacklog() {
  var line = document.getElementById("queue-backlog");

  if (!configured || !isModerator()) {
    return;
  }

  countPending(function (n) {
    pendingCount = n;

    if (navModerate) {
      navModerate.textContent = "Moderate" + (n ? " (" + n + ")" : "");
    }

    if (!line) {
      return;
    }
    if (n === null) {
      line.textContent = "";
      return;
    }
    if (n === 0) {
      line.textContent = "Nothing waiting.";
      return;
    }

    oldestPending(function (since) {
      line.textContent = n + " waiting" +
        (since ? " · the oldest has waited " + ageOf(since) : "") + ".";
    });
  });
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

/* What this page forgets when a session ends, whichever way it ended:
   the nav's Log out, "sign out everywhere" on the account page, or
   the account being deleted. The server side of each differs; what
   the page does afterwards does not. */
function forgetSession() {
  var message = document.getElementById("account-message");

  currentUser = null;
  currentRole = "user";
  currentXp = 0;
  savedCameras = [];
  renderNav();

  /* A sentence left from an earlier sign-out would otherwise be read
     twice; whoever ends this session writes its own afterwards. */
  if (message) {
    message.textContent = "";
  }

  /* The moderation page is no use signed out, so leave it for the
     map. The report page used to go the same way and no longer does:
     the form is everyone's now, and a person who signs out while
     filling it in keeps what they have filled in. Everywhere else
     can stay where it is and just redraw. */
  if (PAGE === "moderate.html") {
    window.location.href = pageHref("index.html");
    return;
  }

  if (PAGE === "account.html") {
    showAccountPage();
    return;
  }

  if (PAGE === "report.html") {
    reportSignedOut();
    return;
  }

  if (typeof render === "function") {
    render();
  }
}

function signOut() {
  sb.auth.signOut().then(forgetSession);
}

/* ---------------- sign out everywhere ----------------

   The nav's Log out ends this browser's session and no other. A
   person who signed in on a borrowed phone, or a library machine,
   and walked away had no way to close that session from anywhere
   else - and on a site whose users may be exactly the people with a
   reason to worry about who is holding their phone, that is the
   session that matters most.

   Supabase's global scope revokes every refresh token the account
   holds, so no session anywhere can renew itself, this one included.
   What it cannot do is reach into a device and take back the access
   token it already has: that stays good until it runs out, which is
   the JWT expiry set in the dashboard - an hour by default - and the
   page says so rather than promising "at once". Nothing about the
   account is sent or asked: the call carries this session's own
   token and acts on the account it belongs to.

   Unlike signOut(), a failure here leaves the page signed in and
   says so. Clearing the page while the server still holds every
   session would tell the person the opposite of the truth. */
function signOutEverywhere(onDone) {
  sb.auth.signOut({ scope: "global" }).then(function (result) {
    if (result && result.error) {
      onDone(authProblem(result.error));
      return;
    }
    forgetSession();
    onDone(null);
  }).catch(function () {
    onDone("Could not reach the server. Check your connection and try again.");
  });
}

/* ---------------- changing the password ----------------

   There was no way to. A password typed on a shared machine was that
   account's password for good, and with no email on the account
   there is no reset to fall back on - so a change has to be possible
   from inside a session, and it has to be safe from a session that
   was left open.

   Supabase's updateUser({ password }) does not ask for the old one:
   any session that holds a token may set a new password. So the old
   one is asked for here and checked first, by signing in with it -
   signInWithPassword against this account's own hidden email - and
   only when that succeeds is the new one set. That is the existing
   sign-in surface, rate-limited by Supabase like every sign-in, and
   nothing is added to it: no new endpoint, no new question the
   server will answer. The username is the caller's own, read off
   their session, never typed, so a stranger with a list of names
   learns nothing here they could not already learn from the sign-in
   form - which is to say nothing, at the sign-in form's rate.

   The refusal is worded for the person it is addressed to. "Wrong
   username or password" is the sign-in form's line, where the
   ambiguity is the point; here the username is known and the only
   thing that can be wrong is the current password, so that is what
   is said. Success says "Password changed." and nothing more. */
function changePassword(current, next, onDone) {
  sb.auth.signInWithPassword({ email: emailFor(usernameOf(currentUser)), password: current })
    .then(function (result) {
      var code = result.error && (result.error.code || "");
      var msg = result.error && result.error.message ? result.error.message : "";

      if (result.error) {
        onDone(code === "invalid_credentials" || /invalid login/i.test(msg)
          ? "That is not the current password."
          : authProblem(result.error));
        return null;
      }

      return sb.auth.updateUser({ password: next }).then(function (updated) {
        onDone(updated.error ? authProblem(updated.error) : null);
      });
    })
    .catch(function () {
      onDone("Could not reach the server. Check your connection and try again.");
    });
}

/* ---------------- deleting the account ----------------

   There was no way out but abandonment. A site built on collecting
   nothing should let a person take back the little it holds, and be
   honest about what it cannot take back - which the box on the
   account page says in full before it asks for anything.

   One call, delete_my_account(), which takes nothing, answers
   nothing, and deletes the account whose token made the call: the
   caller and nobody else. The cascade is the tables' own (see
   schema.sql, version 2.10): the profile, every report, the proof
   rows and files, the XP and the saved list go; a camera that a
   report of theirs put on the map stays, with the date it was
   approved and nothing about them. What a stranger learns by calling
   it repeatedly: nothing.

   Afterwards the browser still holds a token for an account that
   does not exist, so it signs out locally - whatever the server says
   to that, since the account it would be signing out of is gone -
   and the page says one sentence. */
function deleteAccount(onDone) {
  sb.rpc("delete_my_account").then(function (result) {
    if (result.error) {
      onDone(result.error.code === "42883"
        ? "Deleting is not in the database yet: run backend/migrations/008_delete_account.sql in the SQL editor."
        : (result.error.message || "That did not go through."));
      return null;
    }

    function gone() {
      forgetSession();
      onDone(null);
    }

    return sb.auth.signOut().then(gone, gone);
  }).catch(function () {
    onDone("Could not reach the server. Check your connection and try again.");
  });
}

/* The "Delete this account" box. The typed confirmation is the
   person's own username, compared the way sign-in compares it -
   trimmed, lower-cased - and the button is disabled until it
   matches, so it cannot be pressed by accident and cannot be pressed
   for the wrong account. */
function setUpDeleteAccount() {
  var input  = document.getElementById("delete-confirm");
  var button = document.getElementById("delete-button");
  var note   = document.getElementById("delete-note");

  if (!input || !button) {
    return;
  }

  function matches() {
    return !!currentUser && input.value.trim().toLowerCase() === usernameOf(currentUser);
  }

  input.oninput = function () {
    button.disabled = !matches();
    note.textContent = "";
  };

  button.onclick = function () {
    var name = usernameOf(currentUser);

    if (!matches()) {
      button.disabled = true;
      return;
    }

    button.disabled = true;
    input.disabled = true;
    note.textContent = "Deleting…";

    deleteAccount(function (problem) {
      input.disabled = false;

      if (problem) {
        button.disabled = !matches();
        note.textContent = problem;
        return;
      }

      /* forgetSession() has shown the signed-out half; leave the
         box ready for whoever signs in next, and say what happened
         where the person is now looking. */
      input.value = "";
      note.textContent = "";
      sayOnSignedOut("The account " + name + " is deleted, and with it its reports, " +
        "XP and saved cameras. Cameras it put on the map are still there.");
    });
  };
}

/* One sentence for the signed-out half of the account page, after
   something has ended the session from that page: the person is
   looking at the sign-in form again and should be told why. It takes
   focus so a screen reader hears it rather than finding itself at
   the top of a page that has changed under it. */
function sayOnSignedOut(text) {
  var message = document.getElementById("account-message");

  if (!message) {
    return;
  }
  message.textContent = text;
  message.setAttribute("tabindex", "-1");
  message.focus();
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

  /* The state lines need the map's cameras, which arrive after the
     list is first drawn; the list is drawn again when they do, and
     never asked for twice. */
  if (savedCameras.length && !liveCameras && !liveCamerasAsked && configured) {
    liveCamerasAsked = true;
    contextCameras(function (rows) {
      liveCameras = rows;
      showSavedList();
    });
  }
}

/* ---------------- what a saved camera has since become ----------------

   A saved camera is a copy - name, kind, position - taken the moment
   the star was pressed, and the table deliberately holds no camera
   id. That is the right call: an id would be a row saying "this
   person is interested in this camera", and the list is meant to be
   the one thing on the site that says nothing about anyone. But a
   copy is a snapshot, and the map moves on: a camera is marked
   non-functional, a shop pauses, a moderator takes a pin off the
   map, and the saved list went on showing what was true the day it
   was saved.

   So each row is matched, here in the browser, against the cameras
   the browser already holds for the map - the same rows the map
   page keeps in storage for five minutes, or the same whole-table
   read of visible cameras that the report form's picker makes - by
   kind and position, and the row says what the match says. The
   database gains nothing: no id, no join, and no query that carries
   a saved position to the server, because the fetch is the map's
   own and asks for everything.

   Kind as well as position, for the reason samePlace() gives: North
   End in Croydon is on the map twice at one set of coordinates, as
   the fixed install and as the van site, and a shop and a van site
   are not each other's state. Not the name: a moderator may have
   corrected a typo, and a rename is not a removal.

   What the line can honestly say. "Since marked non-functional" and
   "no longer in use" come off the row's status. A van site is legacy
   by definition (NOTES.md, "What active means"), so legacy says
   nothing for one. A camera not found at that position and kind is
   "no longer on the map at this spot" - which is what is known, and
   deliberately not "removed": a moderator's Move takes a pin to a
   corrected position, and from here that is the same as a pin taken
   off. Guessing which would be estimating. The row still links to the
   map at the saved position, where a person can look. */

var liveCameras = null;        /* the map's visible cameras, once fetched */
var liveCamerasAsked = false;  /* so the fetch is made at most once a visit */

function savedState(saved) {
  var wantType = saved.camera_type || "vancam";
  var lat = Number(saved.lat).toFixed(6);
  var lon = Number(saved.lon).toFixed(6);
  var i;
  var c;

  if (!liveCameras) {
    return "";
  }

  for (i = 0; i < liveCameras.length; i++) {
    c = liveCameras[i];
    if (c.type !== wantType ||
        Number(c.lat).toFixed(6) !== lat ||
        Number(c.lon).toFixed(6) !== lon) {
      continue;
    }
    if (c.status === "nonfunctional" && c.type !== NONFUNCTIONAL_TYPE) {
      return "Since marked non-functional.";
    }
    if (c.status === "legacy" && c.type !== "vancam") {
      return "Since marked no longer in use.";
    }
    return "";
  }

  return "No longer on the map at this spot.";
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

  /* What the map says about it now, if that is anything; inside the
     link, so a screen reader hears it with the name it is about. */
  var state = savedState(saved);
  if (state) {
    var line = document.createElement("span");
    line.className = "state";
    line.textContent = state;
    go.appendChild(line);
  }

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
   The recovery card

   Sign-up used to show the username and warn, in a hint, that it was
   the only way back in and nothing could be reset. True, and not
   enough: lockout is the predictable cost of an account with no
   email, and a cost that is predictable should be designed for, not
   disclosed. So the sign-up box carries a card - the username and
   the password, as typed or as made - with a button that prints it
   alone on one side of paper, and a tick, "I have saved my username
   and password somewhere", without which the account is not made.
   The card is a thing to hold before the account exists, because
   after sign-up the password is never shown again.

   It is shown once more straight after sign-up, and after a password
   change, in a box at the top of the signed-in half with the same
   tick, in case it was not kept a moment ago; the tick puts it away
   and the password is forgotten with it. It is one element, #recovery,
   moved between the two homes, so there is one card to keep right.
   Nothing on it leaves the browser: the values are read off the form
   and written into the page, and the site's own address on it is
   worked out from the page's location rather than typed, so it is
   not one more copy of the address to keep in step.

   On screen the password on the card is masked until Show is
   pressed, as the fields are, because a card is read over a shoulder
   more easily than a field. On paper it is always plain - a masked
   card is no card - which the ACCOUNTS print rules see to.

   Printing: "Print this card" puts printing-card on <body> and calls
   window.print(); the print rules hide everything else while the
   class is there, and afterprint takes it off. Scoped to the class
   rather than to the page, so Ctrl-P on the account page still
   prints the page as prose, as every other page does, and the Wave 1
   print view of the map is untouched.
   ------------------------------------------------------------------ */

var CARD_MASK = "••••••••••••";

/* Where the card is and what its tick means: "signup" - in the
   sign-up box, the tick gates Make the account; "after" - in the
   signed-in half, the tick puts it away. */
var cardMode = "signup";

function fillCard(username, password) {
  var user = document.getElementById("card-username");
  var plain = document.getElementById("card-password");
  var masked = document.getElementById("card-password-masked");
  var site = document.getElementById("card-site");

  if (!user || !plain || !masked) {
    return;
  }
  user.textContent = username || "";
  plain.textContent = password || "";
  masked.textContent = password ? CARD_MASK : "";
  if (site) {
    site.textContent = siteAddress();
  }
}

/* The map's address, from where this page is: "https://.../cammap/"
   on Pages, the server's own address when served locally. Not typed,
   so a move of the site does not leave a wrong address on a card. */
function siteAddress() {
  var a = document.createElement("a");

  a.href = pageHref("index.html");
  return a.href.replace(/index\.html$/, "");
}

/* Masked or plain, on the card and - while it is in the sign-up box -
   in the two password fields, which say the same thing. */
function setCardMasked(on) {
  var wrap = document.getElementById("recovery");
  var show = document.getElementById("show-password-button");
  var newPw = document.getElementById("new-password");
  var newPw2 = document.getElementById("new-password-again");

  if (!wrap) {
    return;
  }
  wrap.className = on ? "recovery masked" : "recovery";
  if (show) {
    show.textContent = on ? "Show" : "Hide";
    show.setAttribute("aria-pressed", on ? "false" : "true");
  }
  if (cardMode === "signup" && newPw && newPw2) {
    newPw.type = on ? "password" : "text";
    newPw2.type = on ? "password" : "text";
  }
}

function cardMasked() {
  var wrap = document.getElementById("recovery");
  return !wrap || wrap.className.indexOf("masked") !== -1;
}

/* The card in the sign-up box follows the form: the username shown,
   the password as it stands. Print is offered only for a password
   the server would accept and that both fields agree on, because a
   printed card with a password the account will not have is worse
   than none. */
function refreshSignupCard() {
  var shown = document.getElementById("new-username");
  var newPw = document.getElementById("new-password");
  var newPw2 = document.getElementById("new-password-again");
  var print = document.getElementById("print-card-button");
  var usable;

  if (cardMode !== "signup" || !shown || !newPw || !newPw2) {
    return;
  }
  fillCard(shown.textContent, newPw.value);
  usable = passwordProblem(newPw.value) === "" && newPw.value === newPw2.value;
  if (print) {
    print.disabled = !usable;
  }
}

/* The card into the signed-in half, filled with the account as it
   now is. Called after sign-up and after a password change, with a
   sentence for each. */
function offerCard(username, password, hint) {
  var wrap = document.getElementById("recovery");
  var box = document.getElementById("recovery-after");
  var home = document.getElementById("recovery-after-home");
  var line = document.getElementById("recovery-after-hint");
  var tick = document.getElementById("saved-tick");
  var print = document.getElementById("print-card-button");

  if (!wrap || !box || !home) {
    return;
  }
  cardMode = "after";
  home.appendChild(wrap);
  fillCard(username, password);
  setCardMasked(cardMasked());
  if (tick) {
    tick.checked = false;
  }
  if (print) {
    print.disabled = false;
  }
  if (line) {
    line.textContent = hint;
  }
  box.style.display = "block";
}

/* Back to the sign-up box, emptied. The password is forgotten here:
   this runs when the tick is made in the signed-in half, and when a
   session ends with the card still out, so a password is never left
   on the screen of a machine someone has walked away from. */
function putCardAway() {
  var wrap = document.getElementById("recovery");
  var box = document.getElementById("recovery-after");
  var signupBtn = document.getElementById("signup-button");
  var tick = document.getElementById("saved-tick");

  if (!wrap || !signupBtn) {
    return;
  }
  cardMode = "signup";
  signupBtn.parentNode.insertBefore(wrap, signupBtn);
  fillCard("", "");
  if (tick) {
    tick.checked = false;
  }
  signupBtn.disabled = true;
  setCardMasked(true);
  if (box) {
    box.style.display = "none";
  }
  refreshSignupCard();
}

function printCard() {
  if (document.body.className.indexOf("printing-card") === -1) {
    document.body.className += " printing-card";
  }
  window.print();
}

/* Wired once, whichever home the card is in: the buttons and the
   tick travel with it. */
function setUpRecoveryCard() {
  var tick = document.getElementById("saved-tick");
  var print = document.getElementById("print-card-button");
  var show = document.getElementById("show-password-button");
  var signupBtn = document.getElementById("signup-button");

  if (!tick || !print || !show || !signupBtn) {
    return;
  }

  tick.onchange = function () {
    if (cardMode === "signup") {
      signupBtn.disabled = !tick.checked;
      return;
    }
    if (tick.checked) {
      putCardAway();
    }
  };

  show.onclick = function () {
    setCardMasked(!cardMasked());
  };

  print.onclick = printCard;

  window.addEventListener("afterprint", function () {
    document.body.className = document.body.className.replace(/\s*\bprinting-card\b/, "");
  });

  fillCard("", "");
  setCardMasked(true);
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

  /* A session that ended with the recovery card still out - a sign
     out, everywhere or here - must not leave a password on the
     screen. */
  if (!currentUser && cardMode === "after") {
    putCardAway();
  }

  if (currentUser && who) {
    who.textContent = usernameOf(currentUser);
    var standing = document.getElementById("account-standing");
    if (standing) {
      standing.textContent = currentXp + " XP" + (isModerator() ? " \u00b7 " + currentRole : "");
    }
    /* The confirmation under "Sign out everywhere" names the account
       it is about, so nobody confirms it for the wrong one. */
    var everywhereWho = document.getElementById("everywhere-who");
    if (everywhereWho) {
      everywhereWho.textContent = usernameOf(currentUser);
    }
    /* Likewise the delete box names the account to be typed, and
       starts empty and disabled for every new sign-in. */
    var deleteWho = document.getElementById("delete-who");
    var deleteConfirm = document.getElementById("delete-confirm");
    var deleteButton = document.getElementById("delete-button");
    if (deleteWho) {
      deleteWho.textContent = usernameOf(currentUser);
    }
    if (deleteConfirm && deleteButton) {
      deleteConfirm.value = "";
      deleteButton.disabled = true;
    }
    loadLeaderboardSwitch();
  }

  showSavedList();
}

/* ---------------- the leaderboard switch ----------------

   The leaderboard is public: a username, a total and a count, a
   hundred rows to anyone at all, signed in or not. The names carry
   nothing personal, but what someone has reported, and how much, is
   itself a pattern, and on this site that can be enough. So a person
   can keep their row off it.

   The switch is enforced on the server, in the definitions of the
   three leaderboard views: a profile with show_on_leaderboard false
   never enters the table the page reads (why the view and not a
   policy is in schema.sql, version 2.9). The page only reports the
   value and asks to change it, through set_leaderboard_visibility(),
   which takes a boolean and acts on the caller's own row - the one
   thing on a profile a person may change, and the only way to. The
   views are rebuilt every five minutes, and the note says so rather
   than promising "now".

   The value is fetched on its own and not with the role: PostgREST
   refuses a whole select for one column it does not know, so asking
   for it alongside role and xp_total would, on a database that has
   not had migration 007 run, cost a moderator their Moderate link.
   Here the same refusal is caught by code - 42703, undefined column -
   and the box says which migration to run. */
function loadLeaderboardSwitch() {
  var box  = document.getElementById("leaderboard-switch");
  var note = document.getElementById("leaderboard-note");

  if (!box || !currentUser) {
    return;
  }

  box.disabled = true;
  note.textContent = "";

  sb.from("profiles").select("show_on_leaderboard").eq("id", currentUser.id).single()
    .then(function (result) {
      if (result.error) {
        if (result.error.code === "42703") {
          note.textContent = "The switch is not in the database yet: run backend/migrations/007_leaderboard_opt_out.sql in the SQL editor.";
        } else {
          note.textContent = "Could not read the setting.";
        }
        return;
      }
      box.checked = result.data.show_on_leaderboard !== false;
      box.disabled = false;
    })
    .catch(function () {
      note.textContent = "Could not read the setting.";
    });
}

/* Wired once. A change is sent as it is made - there is nothing else
   to fill in - and a refusal puts the box back the way it was, so it
   never shows a state the server did not accept. */
function setUpLeaderboardSwitch() {
  var box  = document.getElementById("leaderboard-switch");
  var note = document.getElementById("leaderboard-note");

  if (!box) {
    return;
  }

  box.onchange = function () {
    var shown = box.checked;

    box.disabled = true;
    note.textContent = "Saving…";

    sb.rpc("set_leaderboard_visibility", { shown: shown }).then(function (result) {
      box.disabled = false;
      if (result.error) {
        box.checked = !shown;
        note.textContent = result.error.code === "42883"
          ? "The switch is not in the database yet: run backend/migrations/007_leaderboard_opt_out.sql in the SQL editor."
          : (result.error.message || "That did not go through.");
        return;
      }
      note.textContent = (shown ? "Saved: you will be on the list. " : "Saved: you are off the list. ") +
        "The leaderboard is rebuilt every five minutes, so the change shows within that.";
    }).catch(function () {
      box.disabled = false;
      box.checked = !shown;
      note.textContent = "That did not go through. Try again in a moment.";
    });
  };
}

/* The "Change your password" box. The checks a person can be told
   about without a round trip come first - the new password's shape,
   the two copies agreeing, the new one not being the old one - and
   the current password is only sent once those pass, so a slip does
   not cost a sign-in attempt against the rate limit. */
function setUpChangePassword() {
  var current = document.getElementById("pw-current");
  var next    = document.getElementById("pw-new");
  var again   = document.getElementById("pw-new-again");
  var button  = document.getElementById("pw-button");
  var note    = document.getElementById("pw-note");
  var passphrase = document.getElementById("pw-passphrase-button");

  if (!current || !next || !again || !button) {
    return;
  }

  /* The same passphrase the sign-up form offers, into both new
     fields, shown so it can be read. There is no Hide here: the
     fields are emptied once the change goes through. */
  if (passphrase) {
    passphrase.onclick = function () {
      var made = makePassphrase();

      note.textContent = "";
      if (!made) {
        note.textContent = NO_PASSPHRASE;
        return;
      }
      next.value = made;
      again.value = made;
      next.type = "text";
      again.type = "text";
      next.focus();
    };
  }

  button.onclick = function () {
    var problem;

    note.textContent = "";

    if (current.value === "") {
      note.textContent = "The current password is needed first.";
      current.focus();
      return;
    }

    problem = passwordProblem(next.value);
    if (problem) {
      note.textContent = problem;
      next.focus();
      return;
    }

    if (next.value !== again.value) {
      note.textContent = "The two new passwords do not match.";
      again.focus();
      return;
    }

    if (next.value === current.value) {
      note.textContent = "That is the password you already have.";
      next.focus();
      return;
    }

    button.disabled = true;
    note.textContent = "Checking the current password…";

    changePassword(current.value, next.value, function (error) {
      var changed = next.value;

      button.disabled = false;

      if (error) {
        note.textContent = error;
        current.focus();
        return;
      }

      current.value = "";
      next.value = "";
      again.value = "";
      next.type = "password";
      again.type = "password";
      note.textContent = "Password changed.";

      /* The old card is wrong now. Offer the new one, at the top of
         the page, with the same tick to put it away. */
      offerCard(usernameOf(currentUser), changed,
        "The password is changed, and this is the only time the new one is shown. " +
        "A card printed before now is out of date.");
      window.scrollTo(0, 0);
      var box = document.getElementById("recovery-after");
      if (box) {
        box.setAttribute("tabindex", "-1");
        box.focus();
      }
    });
  };

  again.onkeydown = function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      button.onclick();
    }
  };
}

/* The "Sign out everywhere" box. The first button only reveals the
   sentence and the second; nothing is sent until the second is
   pressed. Focus follows the reveal so a keyboard user lands on the
   question and not somewhere below it, and goes back to the first
   button on Cancel. */
function setUpEverywhere() {
  var button  = document.getElementById("everywhere-button");
  var confirm = document.getElementById("everywhere-confirm");
  var yes     = document.getElementById("everywhere-yes");
  var cancel  = document.getElementById("everywhere-cancel");
  var note    = document.getElementById("everywhere-note");

  if (!button || !confirm || !yes || !cancel) {
    return;
  }

  button.onclick = function () {
    note.textContent = "";
    confirm.style.display = "block";
    button.style.display = "none";
    yes.focus();
  };

  cancel.onclick = function () {
    confirm.style.display = "none";
    button.style.display = "";
    button.focus();
  };

  yes.onclick = function () {
    var name = usernameOf(currentUser);

    yes.disabled = true;
    cancel.disabled = true;
    note.textContent = "Signing out everywhere\u2026";

    signOutEverywhere(function (problem) {
      yes.disabled = false;
      cancel.disabled = false;

      if (problem) {
        note.textContent = problem + " You are still signed in.";
        return;
      }

      /* forgetSession() has shown the signed-out half by now; put the
         box back the way it was for the next sign-in, and say what
         happened where the person is now looking. */
      note.textContent = "";
      confirm.style.display = "none";
      button.style.display = "";
      sayOnSignedOut("Signed out everywhere. Every device that was signed in as " + name +
        " has been signed out, or will be within the hour.");
    });
  };
}

function setUpAccountPage() {
  setUpLeaderboardSwitch();
  setUpRecoveryCard();
  showAccountPage();
  setUpChangePassword();
  setUpEverywhere();
  setUpDeleteAccount();

  setUpAccountForms({
    signedUp: function (finalName, password) {
      offerCard(finalName, password,
        "The account is made. This is the last time the password is shown: " +
        "it cannot be reset, and after this page it is never shown again. " +
        "If you did not keep the card a moment ago, keep it now.");
      showAccountPage();
    },
    signedIn: function () {
      showAccountPage();
    }
  });
}

/* ---------------- the two boxes: make an account, sign back in ----------------

   Wired once here for both pages that carry them. They were the
   account page's alone until the report form opened to everyone and
   needed the same two boxes at the moment of sending - the same
   generated username, the same passphrase button, the same card and
   the same tick - and two copies of this wiring would be two places
   for the sign-up rule to drift apart. The markup is written out on
   each page with the same ids, the way the nav is, so this finds it
   wherever it is.

   `hooks.signedUp(finalName, password)` is called once an account is
   made, with the name actually claimed (the shown one may have been
   taken in the moment between being shown and being sent) and the
   password, which is the caller's to put on the card and then
   forget; `hooks.signedIn()` after a sign-in. Neither page does the
   same thing next, which is the whole of the difference between
   them. */
function setUpAccountForms(hooks) {
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

  var passphrase = document.getElementById("passphrase-button");
  var tick       = document.getElementById("saved-tick");

  if (!signupBtn || !signinBtn) {
    return;
  }

  /* -------- making an account -------- */

  shown.textContent = generateUsername();
  refreshSignupCard();

  reroll.onclick = function () {
    shown.textContent = generateUsername();
    signupNote.textContent = "";
    refreshSignupCard();
  };

  /* Both fields at once, and shown rather than masked while it is
     being read: a passphrase the person cannot see is one they
     cannot copy down. They may keep it or type over it. */
  passphrase.onclick = function () {
    var made = makePassphrase();

    signupNote.textContent = "";
    if (!made) {
      signupNote.textContent = NO_PASSPHRASE;
      return;
    }
    newPw.value = made;
    newPw2.value = made;
    setCardMasked(false);
    refreshSignupCard();
    newPw.focus();
  };

  newPw.oninput = refreshSignupCard;
  newPw2.oninput = refreshSignupCard;

  signupBtn.onclick = function () {
    var username = shown.textContent;
    var password = newPw.value;
    var problem = passwordProblem(password);

    signupNote.textContent = "";

    /* The button is disabled until the tick is made; this is for a
       press that reached it another way. */
    if (!tick.checked) {
      signupNote.textContent = "Tick the box once you have saved your username and password.";
      tick.focus();
      return;
    }

    if (problem) {
      signupNote.textContent = problem;
      newPw.focus();
      return;
    }

    if (password !== newPw2.value) {
      signupNote.textContent = "The two passwords do not match.";
      newPw2.focus();
      return;
    }

    signupBtn.disabled = true;
    reroll.disabled = true;
    signupNote.textContent = "Making the account…";

    signUp(username, password, function (error, finalName) {
      signupBtn.disabled = false;
      reroll.disabled = false;

      if (error) {
        signupNote.textContent = error;
        return;
      }

      /* If the shown name was taken and a fresh one used instead,
         the person must see the one they actually got - on the card,
         which is where it now matters. The fields are emptied, and
         the card carries the password until the tick puts it away. */
      shown.textContent = finalName;
      newPw.value = "";
      newPw2.value = "";
      signupNote.textContent = "";
      hooks.signedUp(finalName, password);
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
      hooks.signedIn();
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

/* ---------------- up to three photos ----------------

   One file per report was the rule, and a moderator deciding whether
   a pole on a street corner is a camera often needs two pictures: a
   close one that shows the thing, and a wide one that shows where it
   is. report_proof was always a separate table with a report_id, so
   the schema expected more than one; this is the form catching up.

   Each photo is prepared the moment it is chosen - re-saved through
   the canvas, which is what strips the position and the device out
   of it - and shown as a thumbnail with a way to take it out. Chosen
   rather than sent time, for three reasons: a person can see what
   they are about to send, and that it is the right three; a file
   that cannot be sent (too big, not a photo) is refused beside the
   picker and not after Send; and what is held is the re-saved copy,
   never the original - the file input is emptied after each choice,
   so the bytes with the location in them are not sitting in the form
   waiting to be sent by mistake. The originals' names are kept for
   the list, and go nowhere.

   The 20 MB cap is per file, because it is the bucket's per-object
   limit and the check on report_proof.bytes is per row; the hint
   says "each". It is checked on the original, before re-saving - a
   file over the cap is refused rather than shrunk, because a phone
   photo that large is not a photo but a mistake, and the re-saved
   copy is far smaller anyway.

   Sending is one file at a time, in order, each its own upload and
   its own report_proof row. If the second of three fails the report
   is in and the first is attached, and neither is undone: the report
   is the person's own and still pending, so report_proof's insert
   policy admits the rest whenever they are sent, and the form offers
   "Try the photos again" for exactly the ones that did not go,
   without choosing them again. A partial failure is therefore a
   report with fewer pictures than meant, said plainly, and never a
   report lost. */

var PROOF_MAX_FILES = 3;

/* The picker: the file input, the <ul> the thumbnails go in, the
   line refusals and progress are written to, and a function called
   whenever the set changes. items() is what Send uploads; each item
   is {blob, mime, ext, name, url, sent}. */
function makeProofPicker(input, list, line, onChange) {
  var items = [];
  var preparing = 0;

  function changed() {
    if (onChange) {
      onChange();
    }
  }

  function say(text) {
    if (line) {
      line.textContent = text;
    }
  }

  function bytesWords(n) {
    return n >= 1024 * 1024 ? (n / (1024 * 1024)).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
  }

  function redraw() {
    var i;

    if (!list) {
      return;
    }
    list.innerHTML = "";
    for (i = 0; i < items.length; i++) {
      list.appendChild(thumb(items[i], i));
    }
  }

  function thumb(item, index) {
    var li = document.createElement("li");
    var img = document.createElement("img");
    var name = document.createElement("span");
    var drop = document.createElement("button");
    var label = "Photo " + (index + 1) + " of " + items.length + ", " + item.name;

    img.src = item.url;
    img.alt = label;
    li.appendChild(img);

    name.className = "proof-name";
    name.textContent = item.name + " · " + bytesWords(item.blob.size) +
      (item.sent ? " · sent" : "");
    li.appendChild(name);

    /* A real button, with the photo named in its label, so a screen
       reader hears which one it removes and not three times "×". */
    drop.type = "button";
    drop.className = "remove";
    drop.textContent = "×";
    drop.title = "Remove this photo";
    drop.setAttribute("aria-label", "Remove " + label);
    drop.onclick = function () {
      remove(item);
    };
    li.appendChild(drop);

    return li;
  }

  function remove(item) {
    var kept = [];
    var i;

    for (i = 0; i < items.length; i++) {
      if (items[i] !== item) {
        kept.push(items[i]);
      }
    }
    items = kept;
    URL.revokeObjectURL(item.url);
    say("");
    redraw();
    changed();
  }

  /* The chosen files, one after another: prepareProof() is
     asynchronous, and preparing three at once would be three
     canvases the size of a phone photo at the same moment. Refusals
     are collected and said together at the end. */
  function add(files) {
    var queue = [];
    var refused = [];
    var i;

    for (i = 0; i < files.length; i++) {
      queue.push(files[i]);
    }

    function next() {
      var file = queue.shift();

      if (!file) {
        preparing--;
        say(refused.length ? refused.join(" ") : "");
        redraw();
        changed();
        return;
      }
      if (items.length >= PROOF_MAX_FILES) {
        refused.push("Three at most: " + file.name + " was left out.");
        next();
        return;
      }
      prepareProof(file, function (problem, blob, mime, ext) {
        if (problem) {
          refused.push(file.name + ": " + problem.charAt(0).toLowerCase() + problem.slice(1));
        } else if (blob) {
          items.push({
            blob: blob, mime: mime, ext: ext, name: file.name,
            url: URL.createObjectURL(blob), sent: false
          });
        }
        next();
      });
    }

    preparing++;
    say("Preparing…");
    next();
  }

  if (input) {
    input.onchange = function () {
      if (input.files && input.files.length) {
        add(input.files);
      }
      /* The originals are not kept: what is held is the re-saved
         copy in items. Emptying the input also lets the same file
         be chosen again after it was removed. */
      input.value = "";
    };
  }

  return {
    items: function () {
      return items;
    },
    busy: function () {
      return preparing > 0;
    },
    /* How many are still to go, after a send that did not finish. */
    unsent: function () {
      var n = 0;
      var i;

      for (i = 0; i < items.length; i++) {
        if (!items[i].sent) {
          n++;
        }
      }
      return n;
    },
    redraw: redraw,
    clear: function () {
      var i;

      for (i = 0; i < items.length; i++) {
        URL.revokeObjectURL(items[i].url);
      }
      items = [];
      say("");
      redraw();
    }
  };
}

/* Every item not yet sent, in order, one upload and one row each.
   Stops at the first failure. Calls back with (problem, sent, total):
   problem null when everything went, otherwise the upload's own
   sentence, with `sent` how many are attached now and `total` how
   many there are. An item that went is marked, so a second call
   sends only the rest. */
function uploadProofs(reportId, items, onDone) {
  var i = 0;

  function count() {
    var n = 0;
    var k;

    for (k = 0; k < items.length; k++) {
      if (items[k].sent) {
        n++;
      }
    }
    return n;
  }

  function next() {
    var item;

    while (i < items.length && items[i].sent) {
      i++;
    }
    if (i >= items.length) {
      onDone(null, count(), items.length);
      return;
    }
    item = items[i];
    uploadProof(reportId, item.blob, item.mime, item.ext, function (problem) {
      if (problem) {
        onDone(problem, count(), items.length);
        return;
      }
      item.sent = true;
      i++;
      next();
    });
  }

  next();
}

/* "Sent for review", with the photos accounted for: all of them, or
   how many, and which did not go. The receipt for the report itself
   is the caller's to add. */
function sentWords(problem, sent, total) {
  var ordinals = ["first", "second", "third"];
  var why = problem === UPLOAD_FAILED ? "" : " (" + problem.charAt(0).toLowerCase() + problem.slice(1, -1) + ")";

  if (!problem) {
    return "";
  }
  return (sent ? sent + " of " + total + " photos attached; the " : "The ") +
    (ordinals[sent] || "next") + " could not be uploaded" + why + ". " +
    "Try the photos again: the report is in, and the rest can still be attached.";
}

/* uploadProof()'s plain refusal, named so sentWords() can tell it
   from the rarer "uploaded but not recorded" and not say it twice. */
var UPLOAD_FAILED = "The file could not be uploaded.";

/* What both forms do once a report is in: attach its photos and say
   how that went, and hold the report's id while any are still to
   go. `ui` is the parts that differ between the two forms - the
   note, the Send button, the Try-again button and the picker. Send
   is disabled while photos are outstanding, because a second press
   would be a second report; it comes back when they have gone, or
   when the person takes the unsent ones out, which settles the
   report as sent with what it has. */
function makeAttacher(ui) {
  var attachTo = null;   /* the report whose photos are still to go */

  function showRetry(on) {
    if (ui.retry) {
      ui.retry.style.display = on ? "" : "none";
    }
  }

  function settle(reportId, problem, sent, total) {
    if (problem) {
      attachTo = reportId;
      ui.proofs.redraw();
      showRetry(true);
      ui.button.disabled = true;
      ui.note.textContent = "Sent for review. " + sentWords(problem, sent, total);
      return;
    }
    attachTo = null;
    showRetry(false);
    ui.button.disabled = false;
    ui.proofs.clear();
    ui.note.textContent = "Sent for review. Thank you.";
    if (ui.done) {
      ui.done(reportId);
    }
  }

  if (ui.retry) {
    ui.retry.onclick = function () {
      if (attachTo === null || !currentUser) {
        return;
      }
      ui.retry.disabled = true;
      ui.note.textContent = "Sending the photos…";
      uploadProofs(attachTo, ui.proofs.items(), function (problem, sent, total) {
        ui.retry.disabled = false;
        settle(attachTo, problem, sent, total);
      });
    };
  }

  return {
    /* The report is in; now the photos, if there are any. */
    start: function (reportId) {
      var items = ui.proofs.items();

      if (items.length) {
        ui.note.textContent = "Sent. Attaching the photos…";
        uploadProofs(reportId, items, function (problem, sent, total) {
          settle(reportId, problem, sent, total);
        });
      } else {
        settle(reportId, null, 0, 0);
      }
    },
    /* The picker changed: if the ones that would not go have been
       taken out, there is nothing left to try. */
    changed: function () {
      if (attachTo !== null && ui.proofs.unsent() === 0) {
        settle(attachTo, null, 0, 0);
      }
    },
    waiting: function () {
      return attachTo !== null;
    }
  };
}

/* Uploads under the user's own prefix - which is the only place the
   storage policy lets them write - then records the file against the
   report. */
function uploadProof(reportId, blob, mime, ext, onDone) {
  var path = currentUser.id + "/" + reportId + "/" + randomName() + "." + ext;

  sb.storage.from("proof").upload(path, blob, { contentType: mime, upsert: false })
    .then(function (result) {
      if (result.error) {
        onDone(UPLOAD_FAILED);
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
      onDone(UPLOAD_FAILED);
    });
}

/* ---------------- the report page ----------------

   Two forms on one page. ?camera=<id> in the address means "report
   the state of this camera", otherwise it is "report a camera the map
   does not have". Both go into the reports table; the database
   decides whether enough people agree for it to count on its own.

   For everyone, signed in or not. The page used to put a wall in
   front of the form: signed out it showed one sentence and a link to
   the account page, and hid the map, the crosshair and the photo
   picker behind it. That order lost the people the form is for. Most
   people who have just seen a van will never make an account first -
   they do not yet know what is being asked, or that it is only two
   words and a password - and by the time the account page had
   explained it they had left. So the whole form is shown to anyone,
   and the account is asked for at the one moment it is needed, when
   Send is pressed, in the account page's own two boxes brought onto
   this page under the form. What was filled in stays filled in; the
   report goes the instant an account exists, with nothing retyped.

   The lock did not move. The reports insert policy needs
   auth.uid() = user_id, so nothing here could send a report from
   nobody however the page were arranged; showing the form was only
   ever a courtesy withheld. */

/* ---------------- the draft, and the account asked for at the end ----------------

   Where the draft lives, and why in two places.

   In memory first. When Send is pressed by someone signed out, the
   values are read off the form as they would be for a send, the
   photo is prepared as it would be for a send, and the function that
   would have sent them is kept in pendingSend - to be called the
   moment an account exists. So the report goes exactly as it stood,
   and the person types nothing twice. This path is whole on its own;
   nothing below depends on storage.

   And in sessionStorage as well: the pin, the kind, the name and the
   note, so that a reload in the middle of signing up - a phone that
   reloads a tab it put in the background, a mis-tap on the address
   bar - does not lose them. Session storage rather than local,
   because a draft is for this visit: a report half-written on a
   shared machine should not greet the next person to open the page.
   A photo cannot survive a reload - a blob is not something storage
   holds at that size, and a file input cannot be refilled by script -
   so the line that puts a draft back says the photo needs choosing
   again. Storage may be refused outright, and every touch of it is
   wrapped; refused, the in-memory path is all there is, and it is
   enough.

   The key is written here rather than in STORAGE in shared.js, which
   is where it belongs beside the others; this wave does not edit
   that file, and the orchestrator moves it. */
var REPORT_DRAFT_KEY = "cammap.report-draft";

var pendingSend = null;   /* what Send would have done, waiting for an account */

function keepDraft(draft) {
  try {
    window.sessionStorage.setItem(REPORT_DRAFT_KEY, JSON.stringify(draft));
  } catch (err) {
    /* storage refused; the draft is still held in memory */
  }
}

function readDraft() {
  var raw;

  try {
    raw = window.sessionStorage.getItem(REPORT_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function forgetDraft() {
  try {
    window.sessionStorage.removeItem(REPORT_DRAFT_KEY);
  } catch (err) {
    /* nothing to forget */
  }
}

/* Send was pressed by someone signed out: hold what it would have
   done and show the two account boxes under the form. Focus goes to
   the block so a keyboard or screen-reader user lands on the question
   rather than on a form that appears not to have answered. The
   block's top is scrolled into view first and the focus asked not to
   scroll: on a phone the block is taller than the screen, and a bare
   focus() lands the view partway down it, with the heading that says
   what has happened above the top edge. Older browsers ignore the
   option and scroll as they always did, which is the same place near
   enough. */
function askForAccount(send) {
  var block = document.getElementById("report-account");

  pendingSend = send;
  if (!block) {
    return;
  }
  block.style.display = "block";
  if (block.scrollIntoView) {
    block.scrollIntoView(true);
  }
  block.focus({ preventScroll: true });
}

/* An account arrived - made or signed into, in the boxes on this
   page - so the held send goes now. The boxes are put away first:
   they were there for one reason and it is answered. */
function accountArrived() {
  var block = document.getElementById("report-account");
  var go = pendingSend;

  pendingSend = null;
  if (block) {
    block.style.display = "none";
  }
  if (go) {
    go();
  }
}

/* The session ended on this page - Log out in the nav. The form
   keeps what is in it; a send that was waiting for an account is
   forgotten, since the account it was waiting for has gone; and the
   recovery card, if it is still out, is put away so a password is
   not left on the screen. */
function reportSignedOut() {
  var block = document.getElementById("report-account");

  pendingSend = null;
  if (cardMode === "after") {
    putCardAway();
  }
  if (block) {
    block.style.display = "none";
  }
}

/* The London box is inLondon() in frontend/shared.js, shared with the
   map so the two cannot come to disagree about where London ends.

   What the database would say back, in plain words. */
function reportProblem(error) {
  var code = error && error.code;
  var msg = (error && error.message) || "";

  if (code === "23514") {
    return "That is outside London. This map covers Greater London only.";
  }
  /* Two unique indexes can refuse a report, and they mean different
     things to the person: one pending new-camera report per person
     per corner, and one state report per person per camera, ever.
     The index is named in the message, so each gets its own
     sentence rather than the one that used to cover both. */
  if (code === "23505") {
    if (/reports_one_new_per_cell_idx/.test(msg)) {
      return "You already have a report waiting at this spot. One pending report per person per corner; " +
        "once it is decided you can send another.";
    }
    if (/reports_one_status_per_camera_idx/.test(msg)) {
      return "You have already reported this camera's state: one report per person per camera.";
    }
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

/* ---------------- a report already waiting here? ----------------

   The database refuses a person's second pending report in the same
   cell, and a camera approves itself once enough different people
   have reported it; neither told the reporter anything until Send,
   after the typing and the photograph. So as the pin lands - the
   picker's move event, settled for half a second so that a drag
   across the map is one question and not sixty - the form asks
   pending_near(lat, lon) whether a new-camera report is already
   waiting within the auto-approve radius of that spot, and how many
   days ago the newest was sent. The answer is those two fields and
   nothing else: schema.sql (version 2.11) says what a stranger
   learns from it and why the count is withheld. A plain select on
   reports could not answer this and must not: the read policy shows
   a person their own rows and a moderator everyone's, which is what
   keeps who-reported-what from anyone else, and the function is the
   one narrow window through it.

   What the sentence does with the answer: it says a report is
   waiting, and invites this one, because the auto-approve threshold
   is what turns strangers agreeing into a camera on the map without
   a moderator - and the threshold is public (settings: read), so it
   is quoted rather than left as "enough". The kind is the catch: the
   function does not take one, on purpose (asking per kind would be a
   finer probe for nothing the sentence needs), so the sentence says
   "the same kind of camera" and leaves the kind to the person. A
   refused call - the migration not yet run, the network gone - shows
   nothing, which is what the page showed before there was a
   sentence; a courtesy that cannot be given is not an error. */
var DUP_CHECK_DELAY = 500;

/* settings.auto_approve_users, fetched once for the sentence; null
   until it is known, and the sentence says "enough people" then. */
var autoApproveUsers = null;

function loadThreshold() {
  sb.from("settings").select("auto_approve_users").eq("id", 1).single()
    .then(function (result) {
      if (!result.error && result.data && typeof result.data.auto_approve_users === "number") {
        autoApproveUsers = result.data.auto_approve_users;
      }
    })
    .catch(function () {
      /* the sentence goes on saying "enough people" */
    });
}

function daysAgoWords(days) {
  if (days === 0) {
    return "today";
  }
  if (days === 1) {
    return "yesterday";
  }
  return days + " days ago";
}

function duplicateSentence(daysAgo) {
  var people = autoApproveUsers === null ? "enough people" : autoApproveUsers + " people";

  return "Someone reported this corner " + daysAgoWords(daysAgo) + " and it is waiting to be checked. " +
    "Adding yours helps it through: " + people + " reporting the same kind of camera here " +
    "puts it on the map without a moderator.";
}

/* The check, with its debounce and its live line. at(lat, lon) is
   called on every move; only the position that stands after
   DUP_CHECK_DELAY of quiet is asked about, and an answer to an
   earlier question that arrives after a later one was asked is
   dropped, so the line never describes a spot the pin has left. */
function makeDuplicateCheck(line) {
  var timer = null;
  var asked = 0;

  function say(text) {
    if (line) {
      line.textContent = text;
    }
  }

  function ask(lat, lon) {
    var mine = ++asked;

    sb.rpc("pending_near", { lat: lat, lon: lon }).then(function (result) {
      var row = result.data && result.data[0];

      if (mine !== asked) {
        return;
      }
      if (result.error || !row || !row.found) {
        say("");
        return;
      }
      say(duplicateSentence(typeof row.days_ago === "number" ? row.days_ago : 0));
    }).catch(function () {
      if (mine === asked) {
        say("");
      }
    });
  }

  return {
    at: function (lat, lon) {
      window.clearTimeout(timer);
      if (typeof lat !== "number" || typeof lon !== "number" ||
          isNaN(lat) || isNaN(lon) || !inLondon(lat, lon)) {
        asked++;
        say("");
        return;
      }
      timer = window.setTimeout(function () {
        ask(lat, lon);
      }, DUP_CHECK_DELAY);
    },
    clear: function () {
      window.clearTimeout(timer);
      asked++;
      say("");
    }
  };
}

/* A position in the address: report.html?lat=51.5&lon=-0.1, which is
   what "Report a camera here" on the map page links to. Six decimals
   is what the map writes; anything that parses and is in London is
   taken, anything else is ignored and the form opens as usual. */
function startAtFromQuery() {
  var mLat = /[?&]lat=(-?\d+(?:\.\d+)?)/.exec(window.location.search);
  var mLon = /[?&]lon=(-?\d+(?:\.\d+)?)/.exec(window.location.search);
  var lat;
  var lon;

  if (!mLat || !mLon) {
    return null;
  }
  lat = parseFloat(mLat[1]);
  lon = parseFloat(mLon[1]);
  if (isNaN(lat) || isNaN(lon) || !inLondon(lat, lon)) {
    return null;
  }
  return { lat: lat, lon: lon };
}

function setUpReportPage() {
  var form        = document.getElementById("report-form");
  var unavailable = document.getElementById("report-unavailable");
  var newBox      = document.getElementById("report-new");
  var stBox       = document.getElementById("report-status");
  var title       = document.getElementById("report-title");
  var account     = document.getElementById("report-account");
  var cardBox     = document.getElementById("recovery-after");
  var main;

  var cameraId = (function () {
    var m = /[?&]camera=(\d+)/.exec(window.location.search);
    return m ? Number(m[1]) : null;
  })();

  if (!form) {
    return;
  }

  /* No Supabase behind this copy of the site: the form would take a
     report with nowhere to send it, so it stays hidden and the line
     above says why. */
  if (!configured) {
    if (unavailable) {
      unavailable.style.display = "block";
    }
    return;
  }

  form.style.display   = "block";
  newBox.style.display = cameraId ? "none" : "block";
  stBox.style.display  = cameraId ? "block" : "none";

  /* The account boxes and the card box are written once, in the
     new-camera form's column; a state report is the other form, so
     they are moved under that one instead. Under the form, not
     above it: they answer a Send that was just pressed, and that is
     where the person is looking. */
  if (cameraId && account && cardBox) {
    main = stBox.querySelector(".report-main");
    if (main) {
      main.appendChild(cardBox);
      main.appendChild(account);
    }
  }

  /* The account page's own two boxes, wired the same way. After a
     sign-up the recovery card is offered as it is there, and then
     the held report goes; after a sign-in it just goes. */
  setUpRecoveryCard();
  setUpAccountForms({
    signedUp: function (finalName, password) {
      offerCard(finalName, password,
        "The account is made" + (pendingSend ? " and your report is being sent" : "") +
        ". This is the last time the password is shown: it cannot be reset, and after " +
        "this page it is never shown again. Keep the card now, then tick the box.");
      if (cardBox) {
        cardBox.setAttribute("tabindex", "-1");
        cardBox.focus();
      }
      accountArrived();
    },
    signedIn: accountArrived
  });

  loadXpRules(function () {
    if (cameraId) {
      setUpStatusReport(cameraId);
    } else {
      setUpNewReport(startAtFromQuery());
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
var CONTEXT_TTL = 5 * 60 * 1000;

function contextCameras(onDone) {
  var raw;
  var saved;

  try {
    raw = window.localStorage.getItem(STORAGE.cameras);
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

function setUpNewReport(startAt) {
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
  var draftNote = document.getElementById("draft-note");
  var draft     = readDraft();
  var opening   = null;   /* where the pin starts, if anywhere */
  var dup       = makeDuplicateCheck(document.getElementById("pick-dup"));

  fillTypeSelect(typeSel, "fixedcam");
  loadThreshold();

  function showXp() {
    xpNote.textContent = xpLine("new_" + typeSel.value);
  }
  typeSel.onchange = showXp;
  showXp();

  /* What was in the form before a reload, put back. Only a draft of
     this form: one left by a state report is that form's. The line
     says so, and says the photo needs choosing again, which is the
     one thing storage could not keep. */
  if (draft && draft.kind === "new") {
    if (typeOf(draft.type)) {
      typeSel.value = draft.type;
      showXp();
    }
    if (typeof draft.lat === "number" && typeof draft.lon === "number") {
      opening = { lat: draft.lat, lon: draft.lon };
    }
    nameIn.value = draft.name || "";
    noteIn.value = draft.note || "";
    draftNote.textContent = "What you filled in before is back in the form" +
      (draft.photos ? ", except the photo, which needs choosing again" : "") + ".";
  }

  /* A position in the address - "Report a camera here" on the map -
     is where the person just pointed, and wins over a remembered
     pin. */
  if (startAt) {
    opening = startAt;
  }
  if (opening) {
    latIn.value = opening.lat.toFixed(6);
    lonIn.value = opening.lon.toFixed(6);
    dup.at(opening.lat, opening.lon);
  }

  /* ---------------- the map and the two boxes ----------------

     Both say the same thing, and either may be used. Dragging the pin
     writes the numbers; typing numbers moves the pin. The guard below
     stops the two from talking each other in circles - without it,
     writing the boxes from a drag fires the input handler, which
     moves the pin, which fires drag again. Either way the pin moves,
     the duplicate check is told where it is now. */
  var syncing = false;

  var picker = typeof makePicker === "function" ? makePicker({
    container: "pick-map",
    lat: opening ? opening.lat : null,
    lon: opening ? opening.lon : null,
    draggable: true,
    onMove: function (lat, lon) {
      syncing = true;
      latIn.value = lat.toFixed(6);
      lonIn.value = lon.toFixed(6);
      syncing = false;
      note.textContent = "";
      dup.at(lat, lon);
    }
  }) : null;

  function pinFromBoxes(fly) {
    var lat = parseFloat(latIn.value);
    var lon = parseFloat(lonIn.value);

    if (picker && !syncing && !isNaN(lat) && !isNaN(lon)) {
      picker.setPoint(lat, lon, fly);
    }
    if (!syncing) {
      dup.at(lat, lon);
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

  /* The photos: prepared as they are chosen, held as re-saved
     copies, attached after the report is in. The picker tells the
     attacher when the set changes, and the attacher is made after
     the picker because it needs it; the guard on the hook is for
     the moment in between. */
  var attacher = null;
  var proofs = makeProofPicker(proofIn,
    document.getElementById("s-proof-list"),
    document.getElementById("s-proof-note"),
    function () {
      if (attacher) {
        attacher.changed();
      }
    });

  attacher = makeAttacher({
    note: note,
    button: button,
    retry: document.getElementById("proof-retry"),
    proofs: proofs
  });

  button.onclick = function () {
    var lat  = parseFloat(latIn.value);
    var lon  = parseFloat(lonIn.value);
    var name = nameIn.value.trim();
    var report;

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
    if (proofs.busy()) {
      note.textContent = "The photos are still being prepared - a moment, then press again.";
      return;
    }
    if (attacher.waiting()) {
      note.textContent = "The last report's photos are still to go: try them again, or take them out.";
      return;
    }

    /* Read off the form now, once, whether it goes this moment or
       after an account is made: the send is the same either way,
       and it must carry what was filled in when Send was pressed.
       The photos are read at the moment of sending instead, so one
       taken out while the account boxes were open is not sent. */
    report = {
      kind: "new",
      type: typeSel.value,
      name: name,
      note: noteIn.value.trim(),
      lat: lat,
      lon: lon
    };

    function send() {
      button.disabled = true;
      note.textContent = "Sending…";

      sb.from("reports").insert({
        user_id: currentUser.id,
        kind: report.kind,
        type: report.type,
        name: report.name,
        note: report.note,
        lat: report.lat,
        lon: report.lon
      }).select("id").single().then(function (result) {
        if (result.error) {
          button.disabled = false;
          note.textContent = reportProblem(result.error);
          return;
        }

        /* The report is in, whatever happens to the photos next:
           the form is cleared of it and the draft forgotten. */
        latIn.value = ""; lonIn.value = ""; nameIn.value = ""; noteIn.value = "";
        locNote.textContent = ""; draftNote.textContent = "";
        dup.clear();
        forgetDraft();

        attacher.start(result.data.id);
      }).catch(recover(button, note));
    }

    if (currentUser) {
      send();
      return;
    }

    /* Nobody is signed in. Keep what was typed - here, and in
       storage against a reload - and ask for the account under
       the form. The button comes back so a person who decides
       against an account is not left with a dead form. */
    keepDraft({
      kind: "new", type: report.type, lat: report.lat, lon: report.lon,
      name: report.name, note: report.note, photos: proofs.items().length
    });
    note.textContent = "Almost there: an account is needed to send it. Make one below, or sign in, " +
      "and the report goes as it stands.";
    askForAccount(send);
  };
}

function setUpStatusReport(cameraId) {
  var nameEl    = document.getElementById("status-camera-name");
  var claimSel  = document.getElementById("s-claim");
  var xpNote    = document.getElementById("s-claim-xp");
  var noteIn    = document.getElementById("s-status-note");
  var proofIn   = document.getElementById("s-status-proof");
  var button    = document.getElementById("submit-status-button");
  var note      = document.getElementById("submit-status-note");
  var draftNote = document.getElementById("status-draft-note");
  var draft     = readDraft();

  function showXp() {
    xpNote.textContent = xpLine("status_" + claimSel.value);
  }
  claimSel.onchange = showXp;
  showXp();

  /* A draft of this form, about this camera, put back; one about
     another camera is left for that camera's page. */
  if (draft && draft.kind === "status" && draft.cameraId === cameraId) {
    if (draft.claim) {
      claimSel.value = draft.claim;
      showXp();
    }
    noteIn.value = draft.note || "";
    draftNote.textContent = "What you filled in before is back in the form" +
      (draft.photos ? ", except the photo, which needs choosing again" : "") + ".";
  }

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

  /* The same picker and attacher as the new-camera form. */
  var attacher = null;
  var proofs = makeProofPicker(proofIn,
    document.getElementById("s-status-proof-list"),
    document.getElementById("s-status-proof-note"),
    function () {
      if (attacher) {
        attacher.changed();
      }
    });

  attacher = makeAttacher({
    note: note,
    button: button,
    retry: document.getElementById("status-proof-retry"),
    proofs: proofs
  });

  button.onclick = function () {
    var report;

    note.textContent = "";

    if (!camera) {
      note.textContent = "That camera could not be found.";
      return;
    }
    if (proofs.busy()) {
      note.textContent = "The photos are still being prepared - a moment, then press again.";
      return;
    }
    if (attacher.waiting()) {
      note.textContent = "The last report's photos are still to go: try them again, or take them out.";
      return;
    }

    /* Read once, whether it goes now or after an account is made;
       see setUpNewReport() for why. */
    report = {
      kind: "status",
      cameraId: cameraId,
      claim: claimSel.value,
      note: noteIn.value.trim()
    };

    function send() {
      button.disabled = true;
      note.textContent = "Sending…";

      sb.from("reports").insert({
        user_id: currentUser.id,
        kind: report.kind,
        camera_id: report.cameraId,
        status_claim: report.claim,
        note: report.note,
        lat: camera.lat,
        lon: camera.lon
      }).select("id").single().then(function (result) {
        if (result.error) {
          button.disabled = false;
          note.textContent = reportProblem(result.error);
          return;
        }

        noteIn.value = ""; draftNote.textContent = "";
        forgetDraft();

        attacher.start(result.data.id);
      }).catch(recover(button, note));
    }

    if (currentUser) {
      send();
      return;
    }

    keepDraft({
      kind: "status", cameraId: cameraId, claim: report.claim,
      note: report.note, photos: proofs.items().length
    });
    note.textContent = "Almost there: an account is needed to send it. Make one below, or sign in, " +
      "and the report goes as it stands.";
    askForAccount(send);
  };
}

/* ------------------------------------------------------------------
   The moderation page

   A queue of pending reports, newest first, with the proof attached
   to each. Approve and reject go through moderate_report, which
   checks the role again on the server: this page hiding itself from
   a non-moderator is a courtesy, not the lock.
   ------------------------------------------------------------------ */

/* ---------------- a page at a time ----------------

   Every list on this page grows with the site, and for a long time
   each of them asked for thirty rows and stopped. Report thirty-one
   was simply unreachable from the interface - not hidden, not
   collapsed, just never fetched - and nobody noticed because nobody
   had sent thirty-one reports yet. It is the failure that arrives
   precisely when the project succeeds, which is the worst time for
   it.

   So a list here is a pager: it fetches one page, appends the rows,
   and offers "Load more" until a page comes back short. Thirty is
   still the page, because a moderator reads a queue a screen at a
   time and a page that fits a screen is the one they can act on
   without scrolling back up to find the button they meant.

   loadPage() is the request; makePager() is the list around it. The
   two are separate so that a list can fetch its page however it
   likes - straight from a table with .range(), or by id from a set
   it sorted itself - and the button, the empty message and the
   "Loading…" note behave the same either way.

   Wave 4's "Your reports" list on the account page should be built
   with makePager() too, with a fetch that does
     loadPage(sb.from("reports").select(...).eq("user_id", currentUser.id)
                .order("created_at", { ascending: false }), offset, onDone)
   - the .eq() on user_id is the one thing that list must not leave
   out (see the reports read policy in schema.sql for why). */

var QUEUE_PAGE = 30;

/* One page of a query. `query` is a supabase-js builder with its
   filters and order already on it; this puts the window on the end
   and runs it. Calls back with (error, rows, more): error is the
   supabase error or null, rows is what came back, and more says
   whether another page is worth asking for - true only when this
   one came back full. A total that is an exact multiple of the page
   size therefore costs one extra request that returns nothing, which
   is cheaper than a count query on every page to avoid it. */
function loadPage(query, offset, onDone) {
  query.range(offset, offset + QUEUE_PAGE - 1)
    .then(function (result) {
      var rows;

      if (result.error) {
        onDone(result.error, [], false);
        return;
      }
      rows = result.data || [];
      onDone(null, rows, rows.length === QUEUE_PAGE);
    })
    .catch(function () {
      onDone({ message: "Could not reach the server." }, [], false);
    });
}

/* A list that loads a page at a time.

     list    the <ul> rows are appended to
     empty   the "nothing here" line, shown when the first page is empty
     note    where "Loading…" and a failure go
     more    the Load more button; hidden when the last page is in
     fetch   function (offset, onDone) - asks for the rows from
             `offset`; onDone(problem, rows, more) as loadPage gives it,
             where problem may also be a plain string to show as it is
     row     function (r) - builds the <li> for one row
     failed  what to say when fetch fails and gives no string
     onPage  optional; called after each page lands, with the rows

   reset() empties the list and loads the first page; load() loads the
   next. One load at a time - a second click on the button while the
   first is still out would append the same page twice - and a reset
   while a page is out throws that page away when it lands: the list
   it was fetched for has been emptied, and the rows would otherwise
   arrive in a list that now means something else (a filter changed
   twice in a second showed the first filter's rows under the second
   filter's count, which is how this was found). */
function makePager(opts) {
  var offset = 0;
  var loading = false;
  var generation = 0;
  var pager = {};

  function show(el, on) {
    if (el) {
      el.style.display = on ? "" : "none";
    }
  }

  function load() {
    var mine = generation;

    if (loading) {
      return;
    }
    loading = true;
    opts.note.textContent = "Loading…";
    if (opts.more) {
      opts.more.disabled = true;
    }

    opts.fetch(offset, function (problem, rows, more) {
      var i;

      /* A reset happened while this page was out: it belongs to a
         list that is gone. The reset's own load is what the note and
         the button now answer to. */
      if (mine !== generation) {
        return;
      }

      loading = false;
      if (opts.more) {
        opts.more.disabled = false;
      }

      if (problem) {
        opts.note.textContent = typeof problem === "string"
          ? problem
          : (opts.failed || "Could not load this list.");
        show(opts.more, false);
        return;
      }

      opts.note.textContent = "";
      for (i = 0; i < rows.length; i++) {
        opts.list.appendChild(opts.row(rows[i]));
      }
      offset += rows.length;
      show(opts.empty, offset === 0);
      show(opts.more, more);

      if (opts.onPage) {
        opts.onPage(rows, offset);
      }
    });
  }

  pager.reset = function () {
    generation++;
    loading = false;
    offset = 0;
    opts.list.innerHTML = "";
    show(opts.empty, false);
    show(opts.more, false);
    load();
  };

  pager.load = load;

  /* How many rows are in the list, which is also the offset the next
     page starts from. */
  pager.loaded = function () {
    return offset;
  };

  if (opts.more) {
    opts.more.onclick = load;
  }

  return pager;
}

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

        /* Leaving the Cameras tab only hides it, so an open move
           panel would sit there off screen with a live map behind
           it. Coming back the other way is covered - that reloads
           the list, which rebuilds every row. */
        closeMove();
        closeEdit();
        closeMerge();

        for (j = 0; j < tabs.length; j++) {
          tabs[j].className = tabs[j] === button ? "toggle on" : "toggle";
        }
        document.getElementById("mod-queue").style.display = which === "queue" ? "block" : "none";
        document.getElementById("mod-history").style.display = which === "history" ? "block" : "none";
        document.getElementById("mod-cameras").style.display = which === "cameras" ? "block" : "none";
        document.getElementById("mod-activity").style.display = which === "activity" ? "block" : "none";
        if (which === "history") {
          loadHistory();
        } else if (which === "cameras") {
          setUpCamerasTab();
        } else if (which === "activity") {
          loadActivity();
        } else {
          loadQueue();
        }
      };
    })(tabs[i]);
  }

  setUpBulk();
  setUpQueueTools();
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
var camerasTabWired = false;
var showHiddenCameras = false;

/* The one camera whose position is open for correcting, and the map
   that is open for it. One at a time: two draggable pins on a page
   is two chances to save the wrong one, and each map is a WebGL
   context a browser only has so many of. */
var movingCamera = null;
var movePicker = null;

/* Likewise the one camera whose name, note, kind or state is open
   for correcting, and the one being merged into another. One panel
   of any kind at a time, across Move, Edit and Merge: opening any
   closes the others, because one thing being changed is one thing
   to save wrong, and a panel left open off screen is a panel a
   moderator forgets they opened. */
var editingCamera = null;
var mergingCamera = null;

function setUpCamerasTab() {
  var search = document.getElementById("c-search");
  var hiddenToggle = document.getElementById("c-hidden-toggle");
  var addButton = document.getElementById("c-add-button");

  fillTypeSelect(document.getElementById("c-type"), "fixedcam");

  /* Wired once, on the tab's own flag: the cameras may already be
     loaded by the time the tab is first opened, because the queue
     fetches them for its distances, and "loaded" used to be the
     flag this leaned on - which left the search box, the hidden
     toggle and the Add button doing nothing on a page that had
     opened on the queue. */
  if (!camerasTabWired) {
    camerasTabWired = true;
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

/* The fetch on its own, for the two tabs that want the cameras: the
   Cameras tab, which lists them, and the queue, which measures each
   report's distance to the nearest one (see "sorting the whole
   queue", below). Calls back with an error or null once allCameras
   is filled.

   A moderator's select on cameras returns hidden ones too, by the
   read policy. Ordered by name so the list reads like the map's.
   The 5000 is a ceiling, not a page: the list is meant to bring
   everything, and 182 cameras plus whatever is reported will not
   reach it for a long time - and if it ever does, the search box
   and the distance sort will both be quietly short of the rest,
   which is the moment to make this a pager too. */
function fetchCameras(onDone) {
  sb.from("cameras")
    .select("id,name,note,lat,lon,type,status,source,visible")
    .order("name")
    .limit(5000)
    .then(function (result) {
      if (result.error) {
        onDone(result.error);
        return;
      }
      allCameras = result.data;
      camerasLoaded = true;
      onDone(null);
    })
    .catch(function () {
      onDone({ message: "Could not reach the server." });
    });
}

/* The cameras, if they are not already here. The Cameras tab
   reloads on every visit so a change made elsewhere shows; the queue
   only needs them once, for the distances. */
function ensureCameras(onDone) {
  if (camerasLoaded) {
    onDone(null);
    return;
  }
  fetchCameras(onDone);
}

function loadAllCameras() {
  var note = document.getElementById("cameras-note");

  note.textContent = "Loading…";

  fetchCameras(function (problem) {
    note.textContent = problem ? "Could not load the cameras." : "";
    if (!problem) {
      renderCameras();
    }
  });
}

function renderCameras() {
  var list  = document.getElementById("cameras-list");
  var empty = document.getElementById("cameras-empty");
  var q = document.getElementById("c-search").value.trim().toLowerCase();
  var shown = 0;
  var i;
  var c;

  /* Every row is built afresh below, so an open move panel is about
     to be thrown out of the document with the row it sits in. Take
     its map down properly first, or the discarded element keeps a
     live WebGL context and a set of tile workers behind it. */
  closeMove();
  closeEdit();
  closeMerge();

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
  meta.textContent = cameraMeta(c);
  head.appendChild(meta);

  /* The note has an element of its own so an edit can rewrite it in
     place, the way a move rewrites the coordinates line, without
     rebuilding the row under the panel. Empty when there is none;
     the <br> is left out then so the link sits where the note would. */
  var noteEl = document.createElement("span");
  noteEl.className = "cam-note";
  noteEl.textContent = c.note || "";
  body.appendChild(noteEl);
  if (c.note) {
    body.appendChild(document.createElement("br"));
  }
  var onMap = document.createElement("a");
  onMap.className = "on-map";
  onMap.href = cameraMapHref(c);
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

  /* Correcting where it is, which is a different kind of act from
     taking it off the map: the camera is right, the pin is not.
     Opening the panel is what makes the map, so a moderator who
     never moves anything never pays for MapLibre drawing London. */
  var move = document.createElement("button");
  move.className = "quiet";
  move.textContent = "Move";
  move.onclick = function () {
    if (movingCamera === c.id) {
      closeMove();
      return;
    }
    openMove(c, row);
  };

  /* Correcting what it says, which is the other half of "the camera
     is right, the record of it is not": a typo in the name, a note
     that says the wrong road, a shop entered as a fixed install, a
     reported van site that came through as active. Until this the
     only edit path for any of those was the seed, which cannot reach
     a camera that came from a report. */
  var edit = document.createElement("button");
  edit.className = "quiet";
  edit.textContent = "Edit";
  edit.onclick = function () {
    if (editingCamera === c.id) {
      closeEdit();
      return;
    }
    openEdit(c, row);
  };

  /* Two rows that are one camera. Hiding one would lose its reports
     to a hidden row; merging moves them to the row that stays, and
     then hides this one with a note saying where it went. Only for
     a camera on the map: the server refuses a hidden loser, and the
     row says why in openMerge(). */
  var merge = document.createElement("button");
  merge.className = "quiet";
  merge.textContent = "Merge into…";
  merge.onclick = function () {
    if (mergingCamera === c.id) {
      closeMerge();
      return;
    }
    openMerge(c, row);
  };

  actions.appendChild(edit);
  actions.appendChild(move);
  if (c.visible) {
    actions.appendChild(merge);
  }
  actions.appendChild(b);
  actions.appendChild(outcome);
  row.appendChild(head);
  row.appendChild(body);
  row.appendChild(actions);
  return row;
}

/* The line under a camera's name, and where "See on the map" points.
   Both are written twice - once when the row is built, once when a
   move rewrites them in place - so they are here rather than inline. */

function cameraMeta(c) {
  return typeLabel(c.type) + " · " + c.status + " · " +
    (c.visible ? "on the map" : "hidden") + " · " +
    { seed: "from the published record", report: "from a report", admin: "added by hand" }[c.source] +
    " · " + Number(c.lat).toFixed(5) + ", " + Number(c.lon).toFixed(5);
}

function cameraMapHref(c) {
  return pageHref("index.html") + "#" + Number(c.lat).toFixed(5) + "," + Number(c.lon).toFixed(5);
}

/* ---------------- moving a camera ----------------

   A pin in the wrong place is the commonest thing wrong with a camera
   that is otherwise right: the published record gives a van site as a
   borough rather than a street, and a reporter drops the pin where
   they were standing rather than on the pole opposite. Everything
   else about a camera could already be corrected - its state through
   the reports, its presence through Remove from map - and its
   position could not.

   It is the report form's own picker, on purpose. A moderator moving
   a camera and a visitor placing one are answering the same question,
   so they should be looking at the same map: same dark style, same
   crosshair, same Satellite toggle, and the same pair of coordinate
   boxes beside it for anyone who already has the numbers.

   A moved seed camera diverges from data/points.js, which still
   carries the position the published record gave. That is the right
   way round - the database is what the map reads and points.js is
   the fallback if it cannot be reached - and the correction survives
   a re-run of seed.sql, because move_camera leaves seed_key alone
   and the seed's on-conflict never writes coordinates. The comment
   above move_camera in backend/schema.sql is the long version. */

function closeMove() {
  var panel = document.getElementById("c-move-panel");

  if (movePicker) {
    movePicker.remove();
    movePicker = null;
  }
  if (panel) {
    panel.parentNode.removeChild(panel);
  }
  movingCamera = null;
}

/* A labelled number box. The panel wants two, and they differ only
   in their name. */
function moveField(id, label, value) {
  var wrap = document.createElement("div");
  var tag = document.createElement("label");
  var input = document.createElement("input");

  tag.setAttribute("for", id);
  tag.textContent = label;

  input.type = "number";
  input.id = id;
  input.step = "any";
  input.setAttribute("inputmode", "decimal");
  input.value = Number(value).toFixed(6);

  wrap.appendChild(tag);
  wrap.appendChild(input);
  return wrap;
}

function openMove(c, row) {
  var panel   = document.createElement("div");
  var holder  = document.createElement("div");
  var hint    = document.createElement("p");
  var pair    = document.createElement("div");
  var latBox  = moveField("c-move-lat", "Latitude", c.lat);
  var lonBox  = moveField("c-move-lon", "Longitude", c.lon);
  var buttons = document.createElement("div");
  var save    = document.createElement("button");
  var cancel  = document.createElement("button");
  var note    = document.createElement("p");
  var latIn   = latBox.querySelector("input");
  var lonIn   = lonBox.querySelector("input");

  closeMove();
  closeEdit();
  closeMerge();
  movingCamera = c.id;

  panel.className = "move-panel";
  panel.id = "c-move-panel";

  /* makePicker takes an element id, so the map needs one. Nothing
     else in here does, because only one panel is ever open. */
  holder.id = "c-move-map";
  holder.className = "pick-map";
  panel.appendChild(holder);

  hint.className = "hint";
  hint.textContent = "Drag the crosshair onto the camera, or click where it should be. " +
    "The dimmed dots are the other cameras on the map. Nothing moves until you save.";
  panel.appendChild(hint);

  pair.className = "pair";
  pair.appendChild(latBox);
  pair.appendChild(lonBox);
  panel.appendChild(pair);

  buttons.className = "row";
  save.textContent = "Save the new position";
  cancel.className = "quiet";
  cancel.textContent = "Cancel";
  buttons.appendChild(save);
  buttons.appendChild(cancel);
  panel.appendChild(buttons);

  note.className = "note";
  panel.appendChild(note);

  row.appendChild(panel);

  /* The map and the boxes are the same answer written twice, and the
     guard is the one the report form needs for the same reason:
     writing the boxes from a drag fires their input handler, which
     moves the pin, which fires drag again. */
  var syncing = false;

  movePicker = typeof makePicker === "function" ? makePicker({
    container: "c-move-map",
    lat: Number(c.lat),
    lon: Number(c.lon),
    draggable: true,
    onMove: function (lat, lon) {
      syncing = true;
      latIn.value = lat.toFixed(6);
      lonIn.value = lon.toFixed(6);
      syncing = false;
      note.textContent = "";
    }
  }) : null;

  /* The other cameras behind the pin, so a moderator can see what the
     corrected spot sits among - and whether what is in front of them
     is one of a pair that wants merging rather than moving. This one
     is left out: the crosshair is already where it is, and a dot
     under the pin would only argue with it. The list is loaded for
     the page anyway, so this costs no request. */
  if (movePicker) {
    movePicker.cameras(allCameras.filter(function (other) {
      return other.visible && other.id !== c.id;
    }));
  }

  function pinFromBoxes(fly) {
    var lat = parseFloat(latIn.value);
    var lon = parseFloat(lonIn.value);

    if (movePicker && !syncing && !isNaN(lat) && !isNaN(lon)) {
      movePicker.setPoint(lat, lon, fly);
    }
  }

  /* The same split the report form makes: move the pin on every
     keystroke, but only fly to it once the number is finished, or
     the map runs off through every partial number on the way. */
  latIn.oninput  = function () { pinFromBoxes(false); };
  lonIn.oninput  = function () { pinFromBoxes(false); };
  latIn.onchange = function () { pinFromBoxes(true); };
  lonIn.onchange = function () { pinFromBoxes(true); };

  cancel.onclick = function () {
    closeMove();
  };

  save.onclick = function () {
    var lat = parseFloat(latIn.value);
    var lon = parseFloat(lonIn.value);

    if (isNaN(lat) || isNaN(lon)) {
      note.textContent = "Both coordinates need to be numbers.";
      return;
    }

    /* The same box the cameras table is held to by its check
       constraint. Asking here only makes the answer readable; the
       constraint is what actually refuses the row. */
    if (!inLondon(lat, lon)) {
      note.textContent = "That is outside London. This map covers Greater London only.";
      return;
    }

    if (lat === Number(c.lat) && lon === Number(c.lon)) {
      note.textContent = "That is where it already is.";
      return;
    }

    save.disabled = true;
    note.textContent = "Moving…";

    sb.rpc("moderate_move_camera", {
      cam_id: c.id,
      cam_lat: lat,
      cam_lon: lon
    }).then(function (result) {
      if (result.error) {
        save.disabled = false;
        note.textContent = result.error.message || "That did not go through.";
        return;
      }
      forgetCameraCache();
      c.lat = lat;
      c.lon = lon;
      save.disabled = false;

      /* The row above the panel is rewritten rather than the whole
         list rebuilt. Re-rendering would take this map down and
         build another one - a second download of every tile, and a
         flicker - for a change to two numbers in one line of text,
         and it would close the panel under a moderator who may well
         want to nudge the pin again. */
      row.querySelector(".coords").textContent = cameraMeta(c);
      row.querySelector("a.on-map").href = cameraMapHref(c);
      note.textContent = "Moved. It is at " + lat.toFixed(5) + ", " + lon.toFixed(5) + " now.";
    }).catch(function () {
      save.disabled = false;
      note.textContent = "That did not go through. Try again in a moment.";
    });
  };
}

/* ---------------- editing a camera ----------------

   The sibling of Move, for the rest of the row: the name, the note,
   the kind and the state. A pin in the wrong place was the commonest
   thing wrong with a camera that is otherwise right, and a name
   spelt wrong is the next - and until this a typo was permanent,
   because the only path that rewrote a name was the seed, which
   cannot reach a camera that came from a report at all.

   It saves through moderate_edit_camera, which checks the role again
   and refuses the one thing this panel will not offer: a van site
   marked active. Every van site is legacy - a van parks for a shift
   and drives away - and the panel greys the option out and says why
   rather than letting a moderator find out from the server.

   The same panel shape as Move: opened inside the row, one at a
   time, saved with a button, the row's own lines rewritten in place
   so the panel stays open for a second correction. The server
   records which fields changed and what they said before, so an
   edit can be read back and, by hand, reversed.

   One consequence is worth a line in the panel itself. A camera
   from the published record keeps its seed_key (see move_camera in
   schema.sql for why), and the seed's on-conflict update rewrites
   the name, note and state from data/cameras.csv - so for a seed
   camera an edit here holds only until the next re-run of the seed.
   The correction is made in the CSV as well, or it will be undone;
   the panel says so above Save for exactly those cameras. */

function closeEdit() {
  var panel = document.getElementById("c-edit-panel");

  if (panel) {
    panel.parentNode.removeChild(panel);
  }
  editingCamera = null;
}

/* A label over a field, for a text box, a textarea or a select
   alike. moveField() is the number-box version of this; the two are
   separate because a number box carries a step and an inputmode
   that none of these want. */
function labelled(id, label, input) {
  var wrap = document.createElement("div");
  var tag = document.createElement("label");

  tag.setAttribute("for", id);
  tag.textContent = label;
  input.id = id;

  wrap.appendChild(tag);
  wrap.appendChild(input);
  return wrap;
}

/* The three states a camera can be in, as the Add form offers them.
   Written here once for the panel rather than read off the Add
   form's <select>, which is on the page only because this tab is. */
var CAMERA_STATES = [
  { value: "active",        label: "Active" },
  { value: "legacy",        label: "Legacy - no longer in use" },
  { value: "nonfunctional", label: "Non-functional" }
];

function openEdit(c, row) {
  var panel    = document.createElement("div");
  var nameIn   = document.createElement("input");
  var noteIn   = document.createElement("textarea");
  var typeSel  = document.createElement("select");
  var stateSel = document.createElement("select");
  var pair     = document.createElement("div");
  var vanHint  = document.createElement("p");
  var seedHint = document.createElement("p");
  var buttons  = document.createElement("div");
  var save     = document.createElement("button");
  var cancel   = document.createElement("button");
  var note     = document.createElement("p");
  var option;
  var i;

  closeMove();
  closeEdit();
  closeMerge();
  editingCamera = c.id;

  panel.className = "edit-panel";
  panel.id = "c-edit-panel";

  nameIn.type = "text";
  nameIn.value = c.name;
  panel.appendChild(labelled("c-edit-name", "Name", nameIn));

  noteIn.value = c.note || "";
  noteIn.placeholder = "optional - shown in the popup";
  panel.appendChild(labelled("c-edit-note", "Note", noteIn));

  /* The kinds from CAMERA_TYPES, like every other drop-down. A row
     can also carry the one type that is not a kind - nonfunccam,
     from the older report rows - and fillTypeSelect() does not list
     it, so it is added for that row alone; otherwise the select
     would open on the first kind and a Save would quietly make a
     fixed camera of it. */
  fillTypeSelect(typeSel, c.type);
  if (!typeOf(c.type)) {
    option = document.createElement("option");
    option.value = c.type;
    option.textContent = typeLabel(c.type);
    option.selected = true;
    typeSel.appendChild(option);
  }

  for (i = 0; i < CAMERA_STATES.length; i++) {
    option = document.createElement("option");
    option.value = CAMERA_STATES[i].value;
    option.textContent = CAMERA_STATES[i].label;
    option.selected = CAMERA_STATES[i].value === c.status;
    stateSel.appendChild(option);
  }

  pair.className = "pair";
  pair.appendChild(labelled("c-edit-type", "What kind", typeSel));
  pair.appendChild(labelled("c-edit-status", "State", stateSel));
  panel.appendChild(pair);

  /* Every van site is legacy. The Active option is greyed out while
     the kind is a van site, and this line says why; the server
     refuses the pair as well, so the greying is a courtesy and the
     refusal is the lock. A van site that already reads active - a
     reported one, on a database seeded before the change - shows
     as it is, so the moderator can see it and set it right. */
  vanHint.className = "hint";
  vanHint.textContent = "A van site cannot be active: a van parks for a shift and drives away, " +
    "so no van site claims to be there today. Set it to Legacy.";
  panel.appendChild(vanHint);

  function vanRule() {
    var isVan = typeSel.value === "vancam";
    stateSel.options[0].disabled = isVan;
    vanHint.style.display = isVan ? "" : "none";
  }
  typeSel.onchange = vanRule;
  vanRule();

  if (c.source === "seed") {
    seedHint.className = "hint";
    seedHint.textContent = "This camera is from the published record. Its name, note and state are " +
      "rewritten from data/cameras.csv every time the seed is run, so a correction made here " +
      "holds only until then: make it in the CSV as well, or it will be undone.";
    panel.appendChild(seedHint);
  }

  buttons.className = "row";
  save.textContent = "Save";
  cancel.className = "quiet";
  cancel.textContent = "Cancel";
  buttons.appendChild(save);
  buttons.appendChild(cancel);
  panel.appendChild(buttons);

  note.className = "note";
  panel.appendChild(note);

  row.appendChild(panel);
  nameIn.focus();

  cancel.onclick = function () {
    closeEdit();
  };

  save.onclick = function () {
    var name = nameIn.value.trim();
    var text = noteIn.value.trim();
    var type = typeSel.value;
    var status = stateSel.value;

    note.textContent = "";

    if (name === "") {
      note.textContent = "A camera needs a name.";
      nameIn.focus();
      return;
    }
    if (type === "vancam" && status === "active") {
      note.textContent = "A van site cannot be active. Set it to Legacy.";
      stateSel.focus();
      return;
    }
    if (name === c.name && text === (c.note || "") && type === c.type && status === c.status) {
      note.textContent = "Nothing changed.";
      return;
    }

    save.disabled = true;
    note.textContent = "Saving…";

    sb.rpc("moderate_edit_camera", {
      cam_id: c.id,
      cam_name: name,
      cam_note: text,
      cam_type: type,
      cam_status: status
    }).then(function (result) {
      save.disabled = false;
      if (result.error) {
        note.textContent = result.error.message || "That did not go through.";
        return;
      }
      forgetCameraCache();
      c.name = name;
      c.note = text;
      c.type = type;
      c.status = status;

      /* The row above the panel is rewritten rather than the list
         rebuilt, for Move's reason: rebuilding would close the panel
         under a moderator who may have a second correction to make. */
      row.querySelector(".queue-head strong").textContent = c.name;
      row.querySelector(".coords").textContent = cameraMeta(c);
      row.querySelector(".cam-note").textContent = c.note;
      note.textContent = "Saved.";
    }).catch(function () {
      save.disabled = false;
      note.textContent = "That did not go through. Try again in a moment.";
    });
  };
}

/* ---------------- merging two cameras ----------------

   approve_report clusters and merges incoming reports, so two people
   reporting one van site make one camera. Two rows already on the
   map - a seed entry and a reported one at the same spot, or two
   reports approved a month apart at 150 m - had no way to become
   one. A moderator could hide one, and lose its reports to a hidden
   row nobody would look at again.

   Merge repoints the loser's reports at the survivor, then hides the
   loser with a note naming the survivor. Nothing is deleted: the
   loser is still in the table, off the map, and the moderation_log
   says where its reports went. moderate_merge_cameras does it in one
   call, gated on the server like everything else here, and refuses
   a loser or a survivor that is already off the map - the comment
   on merge_cameras in schema.sql says why.

   The panel opens under the row that will go. It asks for the
   survivor by name, offering the nearest cameras first because the
   nearest one is the likeliest duplicate, and before anything is
   sent it says in one sentence which row survives, which is hidden,
   and how many reports move - and waits for a press on a button
   that says the same thing. A merge is the one action here that a
   moderator cannot undo with a button (the loser can be put back on
   the map, but its reports have moved), so the statement is the
   confirmation, and the button is not pressed by accident. */

var MERGE_MATCHES = 8;

function closeMerge() {
  var panel = document.getElementById("c-merge-panel");

  if (panel) {
    panel.parentNode.removeChild(panel);
  }
  mergingCamera = null;
}

/* How many reports point at a camera, for the statement. The queue
   and the history hold reports, not the camera list, so it is one
   small count request - a head request, like the backlog's - made
   only when a panel opens. */
function countReportsOn(cameraId, onDone) {
  sb.from("reports")
    .select("id", { count: "exact", head: true })
    .eq("camera_id", cameraId)
    .then(function (result) {
      onDone(result.error ? null : result.count);
    })
    .catch(function () {
      onDone(null);
    });
}

function openMerge(c, row) {
  var panel    = document.createElement("div");
  var hint     = document.createElement("p");
  var search   = document.createElement("input");
  var results  = document.createElement("ul");
  var chosen   = document.createElement("p");
  var buttons  = document.createElement("div");
  var go       = document.createElement("button");
  var cancel   = document.createElement("button");
  var note     = document.createElement("p");
  var survivor = null;
  var reportsOnLoser = null;

  closeMove();
  closeEdit();
  closeMerge();
  mergingCamera = c.id;

  panel.className = "merge-panel";
  panel.id = "c-merge-panel";

  hint.className = "hint";
  hint.textContent = "For two rows that are one camera. Pick the row that survives: this one " +
    "is taken off the map and every report that pointed at it moves to the survivor. " +
    "Nothing is deleted, and the log records where its reports went. " +
    "The nearest cameras are offered first, because the nearest is the likeliest duplicate.";
  panel.appendChild(hint);

  search.type = "text";
  search.id = "c-merge-search";
  search.placeholder = "The camera that survives, by name";
  search.setAttribute("aria-label", "The camera that survives, by name");
  panel.appendChild(search);

  results.className = "results";
  results.id = "c-merge-results";
  panel.appendChild(results);

  chosen.className = "statement";
  chosen.id = "c-merge-statement";
  panel.appendChild(chosen);

  buttons.className = "row";
  go.id = "c-merge-go";
  go.style.display = "none";
  cancel.className = "quiet";
  cancel.textContent = "Cancel";
  buttons.appendChild(go);
  buttons.appendChild(cancel);
  panel.appendChild(buttons);

  note.className = "note";
  panel.appendChild(note);

  row.appendChild(panel);
  search.focus();

  countReportsOn(c.id, function (n) {
    reportsOnLoser = n;
    if (survivor) {
      state();
    }
  });

  /* The candidates: every other camera on the map whose name has the
     typed text in it, nearest first, MERGE_MATCHES of them. Hidden
     cameras are left out because the server would refuse them as a
     survivor, and this camera itself because a merge into itself is
     nothing. */
  function candidates() {
    var q = search.value.trim().toLowerCase();
    var found = [];
    var i;
    var other;

    for (i = 0; i < allCameras.length; i++) {
      other = allCameras[i];
      if (!other.visible || other.id === c.id) {
        continue;
      }
      if (q && other.name.toLowerCase().indexOf(q) === -1) {
        continue;
      }
      found.push({
        camera: other,
        metres: metresBetween(Number(c.lat), Number(c.lon), Number(other.lat), Number(other.lon))
      });
    }
    found.sort(function (a, b) { return a.metres - b.metres; });
    return found.slice(0, MERGE_MATCHES);
  }

  function showCandidates() {
    var list = candidates();
    var i;

    results.innerHTML = "";
    for (i = 0; i < list.length; i++) {
      results.appendChild(candidateRow(list[i]));
    }
  }

  function candidateRow(cand) {
    var li = document.createElement("li");
    var b = document.createElement("button");

    b.className = "pick";
    b.textContent = "#" + cand.camera.id + " " + cand.camera.name + " · " +
      typeLabel(cand.camera.type) + " · " + cand.camera.status + " · " +
      Math.round(cand.metres) + " m away";
    b.onclick = function () {
      survivor = cand;
      state();
    };
    li.appendChild(b);
    return li;
  }

  /* The sentence the moderator confirms. Which row goes, which
     stays, and how many reports move - or "its reports", until the
     count is back. */
  function state() {
    var n = reportsOnLoser;
    var reports = n === null ? "its reports" : (n === 1 ? "its 1 report" : "its " + n + " reports");

    chosen.textContent = "#" + c.id + " " + c.name + " (" + typeLabel(c.type) + ") will be taken off the map and " +
      reports + " moved to #" + survivor.camera.id + " " + survivor.camera.name +
      " (" + typeLabel(survivor.camera.type) + "), which survives as it is.";
    go.textContent = "Merge #" + c.id + " into #" + survivor.camera.id;
    go.style.display = "";
    note.textContent = "";
  }

  search.oninput = showCandidates;
  showCandidates();

  cancel.onclick = function () {
    closeMerge();
  };

  go.onclick = function () {
    if (!survivor) {
      return;
    }
    go.disabled = true;
    note.textContent = "Merging…";

    sb.rpc("moderate_merge_cameras", {
      loser: c.id,
      survivor: survivor.camera.id
    }).then(function (result) {
      var r = result.data || {};
      var rowButtons;
      var i;

      if (result.error) {
        go.disabled = false;
        note.textContent = result.error.message || "That did not go through.";
        return;
      }
      forgetCameraCache();
      c.visible = false;

      /* The row stays, at full strength so the result can be read,
         with its own buttons switched off: it is a hidden camera now
         and Edit, Move and Remove on it would be edits to a row that
         is off the map. The next render draws it as hidden, or drops
         it unless hidden cameras are shown. The survivor's row is
         untouched, because nothing about it changed. */
      row.querySelector(".coords").textContent = cameraMeta(c);
      rowButtons = row.querySelector(".row").querySelectorAll("button");
      for (i = 0; i < rowButtons.length; i++) {
        rowButtons[i].disabled = true;
      }
      results.innerHTML = "";
      go.style.display = "none";
      chosen.textContent = "";
      note.textContent = "Merged into #" + r.survivor + ". " +
        r.moved + (r.moved === 1 ? " report" : " reports") + " moved" +
        (r.kept ? ", " + r.kept + " kept with this row (the same person had already reported the survivor)" : "") +
        ". This camera is now off the map.";
    }).catch(function () {
      go.disabled = false;
      note.textContent = "That did not go through. Try again in a moment.";
    });
  };
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
    forgetCameraCache();
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

var historyPager = null;

function loadHistory() {
  if (!historyPager) {
    historyPager = makePager({
      list:   document.getElementById("history-list"),
      empty:  document.getElementById("history-empty"),
      note:   document.getElementById("history-note"),
      more:   document.getElementById("history-more"),
      failed: "Could not load the history.",
      row:    historyRow,
      fetch:  function (offset, onDone) {
        loadPage(
          sb.from("reports")
            .select("id,kind,camera_id,type,status_claim,name,note,lat,lon,state,resolved_at,resolution_note,profiles!reports_user_id_fkey(username),cameras(id,name,visible,status)")
            .in("state", ["approved", "rejected", "merged"])
            .order("resolved_at", { ascending: false, nullsFirst: false }),
          offset, onDone);
      }
    });
  }
  historyPager.reset();
}

function undo(target, action, noteText, onDone) {
  sb.rpc("moderate_undo", { target: target, action: action, note: noteText || null })
    .then(function (result) {
      if (!result.error) {
        forgetCameraCache();
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
        /* a retracted approval is pending again, and so counts */
        refreshBacklog();
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

/* ---------------- sorting and filtering the whole queue ----------------

   Newest first, everything mixed, was the only order the queue had.
   The order a moderator actually wants is "the likely duplicates
   first": a report dropped on top of a camera the map already has
   is the quickest decision on the page and the commonest, and it
   should not be found by reading down thirty rows. And a moderator
   who knows the shops, or the stations, wants to see only those.

   The sort has to see the whole queue, not the loaded page: sorting
   thirty rows by distance and then loading thirty more that are
   nearer is worse than no sort at all. So the queue is now two
   fetches. The first is the index: every pending report's small
   columns - id, kind, type, position, time - in one request under
   the same 5000 ceiling fetchCameras() uses, and for the same
   reason. Those rows are a few dozen bytes each; five thousand of
   them are smaller than one proof photograph, and a queue that long
   is a problem this page will have earned by then. The index is
   measured, filtered and sorted here, in the browser, and the pager
   then fetches each page's full rows - the note, the reporter, the
   proof - by id from the order it settled on.

   The distance is worked out here and not by a new server function
   on purpose. An endpoint that answered "how far is this report from
   the nearest camera" would say nothing about accounts, so it would
   pass the anonymity test; but it would be a new surface, with a
   grant to get right and a policy to keep in step, for a number the
   browser can already produce from two lists it already holds. The
   arithmetic is metresBetween(), the twin of metres_between in
   schema.sql, written once here.

   Paging by id has a second benefit the offset paging did not have:
   a Load more pressed after rows have left this page - approved,
   rejected, in a batch - does not skip the rows that shifted up
   to fill the gap, because the page is a slice of a list of ids
   the browser holds, not a window on a table that moved. An id that
   was decided since the index was taken simply comes back empty and
   is not shown twice. */

/* Everything a queue row shows. The proof rows and the reporter's
   username ride along in the same request, so a page of thirty is
   one round trip and not sixty-one. */
var QUEUE_COLUMNS = "id,user_id,kind,camera_id,type,status_claim,name,note,lat,lon,created_at," +
  "profiles!reports_user_id_fkey(username),report_proof(id,storage_path,mime)";

/* The same ceiling as fetchCameras(), for the same reason. */
var QUEUE_CEILING = 5000;

var queuePager = null;
var queueIndex = [];     /* every pending report's light row, measured */
var queueOrder = [];     /* the ids of the ones that pass the filter, in the sort order */
var queueView = { kind: "all", type: "all", sort: "newest" };

/* Haversine, in metres. The twin of metres_between in schema.sql -
   the same formula and the same 6371000 m radius, so a distance the
   queue shows is the one approve_report would measure. */
function metresBetween(lat1, lon1, lat2, lon2) {
  var toRad = Math.PI / 180;
  var dLat = (lat2 - lat1) * toRad;
  var dLon = (lon2 - lon1) * toRad;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/* The nearest camera on the map to a point, of any kind, and how
   far. Any kind, not the report's kind: a fixed camera reported on
   top of a van site is worth seeing beside the van site, whichever
   of the two it turns out to be. Over allCameras, which the
   moderation page holds whole. */
function nearestCamera(lat, lon) {
  var best = null;
  var bestMetres = Infinity;
  var m;
  var i;

  for (i = 0; i < allCameras.length; i++) {
    if (!allCameras[i].visible) {
      continue;
    }
    m = metresBetween(lat, lon, Number(allCameras[i].lat), Number(allCameras[i].lon));
    if (m < bestMetres) {
      bestMetres = m;
      best = allCameras[i];
    }
  }

  return best ? { camera: best, metres: bestMetres } : null;
}

function cameraById(id) {
  var i;

  for (i = 0; i < allCameras.length; i++) {
    if (allCameras[i].id === id) {
      return allCameras[i];
    }
  }
  return null;
}

/* Every pending report's light row, measured. A new-camera report
   gets its nearest camera; a state report is about a camera and sits
   on its coordinates, so "nearest" would always be that camera at
   zero and says nothing - it gets none, and sorts after the new
   ones. A state report's kind is its camera's, which is why the
   cameras are loaded first. */
function loadQueueIndex(onDone) {
  sb.from("reports")
    .select("id,kind,type,camera_id,lat,lon,created_at")
    .eq("state", "pending")
    .order("created_at", { ascending: false })
    .limit(QUEUE_CEILING)
    .then(function (result) {
      var rows;
      var near;
      var cam;
      var i;

      if (result.error) {
        onDone(result.error);
        return;
      }

      rows = result.data || [];
      for (i = 0; i < rows.length; i++) {
        rows[i].nearest = null;
        if (rows[i].kind === "new") {
          near = nearestCamera(Number(rows[i].lat), Number(rows[i].lon));
          if (near) {
            rows[i].nearest = near;
          }
        } else {
          cam = cameraById(rows[i].camera_id);
          rows[i].type = cam ? cam.type : null;
        }
      }
      queueIndex = rows;
      onDone(null);
    })
    .catch(function () {
      onDone({ message: "Could not reach the server." });
    });
}

/* The filter and the sort, over the index, into queueOrder. Newest
   and oldest are by the time the report was sent. Nearest puts the
   new-camera reports in order of distance to a camera already on the
   map - the likeliest duplicates first - and the state reports after
   them, newest first, since the distance means nothing for those. */
function applyQueueView() {
  var kept = [];
  var i;
  var r;

  for (i = 0; i < queueIndex.length; i++) {
    r = queueIndex[i];
    if (queueView.kind !== "all" && r.kind !== queueView.kind) {
      continue;
    }
    if (queueView.type !== "all" && r.type !== queueView.type) {
      continue;
    }
    kept.push(r);
  }

  function byTime(a, b) {
    return a.created_at < b.created_at ? 1 : (a.created_at > b.created_at ? -1 : 0);
  }

  if (queueView.sort === "oldest") {
    kept.sort(function (a, b) { return -byTime(a, b); });
  } else if (queueView.sort === "nearest") {
    kept.sort(function (a, b) {
      var da = a.nearest ? a.nearest.metres : Infinity;
      var db = b.nearest ? b.nearest.metres : Infinity;

      if (da !== db) {
        return da < db ? -1 : 1;
      }
      return byTime(a, b);
    });
  } else {
    kept.sort(byTime);
  }

  queueOrder = [];
  for (i = 0; i < kept.length; i++) {
    queueOrder.push(kept[i].id);
  }

  showQueueCount();
}

/* "12 of 60 match" while a filter is on; nothing while it is not,
   because the backlog line above already says how many are waiting. */
function showQueueCount() {
  var line = document.getElementById("queue-count");

  if (!line) {
    return;
  }
  line.textContent = (queueView.kind === "all" && queueView.type === "all")
    ? ""
    : queueOrder.length + " of " + queueIndex.length + " match.";
}

function indexRow(id) {
  var i;

  for (i = 0; i < queueIndex.length; i++) {
    if (queueIndex[i].id === id) {
      return queueIndex[i];
    }
  }
  return null;
}

/* One page of the queue: the next QUEUE_PAGE ids from queueOrder,
   fetched whole. Still pending only, so an id decided since the
   index was taken comes back empty rather than as a decided row
   with live buttons. The rows come back in the table's order and
   are put back into the sort's. "More" is known exactly here - it
   is whether the order has ids past this page - rather than guessed
   from a full page as loadPage() has to. */
function fetchQueuePage(offset, onDone) {
  var ids = queueOrder.slice(offset, offset + QUEUE_PAGE);
  var more = offset + ids.length < queueOrder.length;

  if (ids.length === 0) {
    onDone(null, [], false);
    return;
  }

  sb.from("reports")
    .select(QUEUE_COLUMNS)
    .in("id", ids)
    .eq("state", "pending")
    .then(function (result) {
      var byId = {};
      var rows = [];
      var light;
      var i;

      if (result.error) {
        onDone(result.error, [], false);
        return;
      }
      for (i = 0; i < result.data.length; i++) {
        byId[result.data[i].id] = result.data[i];
      }
      for (i = 0; i < ids.length; i++) {
        if (byId[ids[i]]) {
          light = indexRow(ids[i]);
          byId[ids[i]].nearest = light ? light.nearest : null;
          rows.push(byId[ids[i]]);
        }
      }
      onDone(null, rows, more);
    })
    .catch(function () {
      onDone({ message: "Could not reach the server." }, [], false);
    });
}

function setUpQueueTools() {
  var kindSel = document.getElementById("queue-kind");
  var typeSel = document.getElementById("queue-type");
  var sortSel = document.getElementById("queue-sort");
  var any;

  if (!kindSel || !typeSel || !sortSel) {
    return;
  }

  /* The kinds from CAMERA_TYPES like every other drop-down, with
     "any" put in front of them. */
  fillTypeSelect(typeSel, null);
  any = document.createElement("option");
  any.value = "all";
  any.textContent = "Any kind";
  any.selected = true;
  typeSel.insertBefore(any, typeSel.firstChild);

  /* A change re-sorts the index the browser already holds and
     fetches the first page of the new order; the index is not
     fetched again, because nothing about it changed. */
  kindSel.onchange = function () {
    queueView.kind = kindSel.value;
    applyQueueView();
    queuePager.reset();
  };
  typeSel.onchange = function () {
    queueView.type = typeSel.value;
    applyQueueView();
    queuePager.reset();
  };
  sortSel.onchange = function () {
    queueView.sort = sortSel.value;
    applyQueueView();
    queuePager.reset();
  };
}

function loadQueue() {
  var note = document.getElementById("queue-note");

  if (!queuePager) {
    queuePager = makePager({
      list:   document.getElementById("queue-list"),
      empty:  document.getElementById("queue-empty"),
      note:   note,
      more:   document.getElementById("queue-more"),
      failed: "Could not load the queue.",
      row:    queueRow,
      fetch:  fetchQueuePage
    });
  }

  note.textContent = "Loading…";

  /* Cameras first, for the distances and for a state report's kind;
     then the index; then the first page. A failure to get the
     cameras is not a failure to get the queue - the distances are
     simply not shown - so it is not stopped on. */
  ensureCameras(function () {
    loadQueueIndex(function (problem) {
      if (problem) {
        note.textContent = "Could not load the queue.";
        return;
      }
      applyQueueView();
      queuePager.reset();
    });
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
  var pick = document.createElement("label");
  var box = document.createElement("input");
  var pickText = document.createElement("span");
  var main = document.createElement("div");
  var head = document.createElement("div");
  var body = document.createElement("div");
  var proof = document.createElement("div");
  var actions = document.createElement("div");
  var i;

  /* The row is a tick box beside everything else, so that twenty
     decisions can be one press (bulkDecide, below). A real checkbox
     in a real label: the label's text is for a screen reader and is
     hidden from sight, because "Select this report" written out
     thirty times down a page says nothing the box does not. The id
     rides on both the row and the box so either can be found from
     the other. */
  row.className = "pickable";
  row.setAttribute("data-id", r.id);

  pick.className = "pick";
  box.type = "checkbox";
  box.className = "pick-box";
  box.setAttribute("data-id", r.id);
  pickText.className = "pick-text";
  pickText.textContent = "Select this report";
  pick.appendChild(box);
  pick.appendChild(pickText);

  main.className = "queue-main";
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

  /* How far this is from a camera the map already has, for a
     new-camera report. This is the line the "nearest" sort orders
     by, so it is shown whatever the order: a report 15 m from a
     camera of the same kind is very likely that camera, and the
     moderator should not have to open the map to learn it. Measured
     by loadQueueIndex(), which is why it is on the row rather than
     fetched with it. */
  if (r.nearest) {
    var near = document.createElement("span");
    near.className = "coords nearest";
    near.textContent = "Nearest camera on the map: " + r.nearest.camera.name +
      " (" + typeLabel(r.nearest.camera.type) + "), " + Math.round(r.nearest.metres) + " m";
    head.appendChild(near);
    row.setAttribute("data-nearest", Math.round(r.nearest.metres));
  }

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

  /* The one way a decision leaves this row. The row's own buttons
     call it and so does the bulk path, with a callback: same call,
     same function on the server, same gate. The outcome lands
     beside the buttons either way, so a report that fails in a batch
     of twenty says why on its own row rather than in a summary that
     names a number. Without a callback it is the single case, and
     the row stays where it is, marked done, so the moderator can
     see what they just did; the bulk path takes the done rows away
     itself once the batch is in. */
  function act(action, noteText, onDone) {
    approve.disabled = true;
    reject.disabled = true;
    box.disabled = true;
    outcome.textContent = "…";

    function failed(message) {
      approve.disabled = false;
      reject.disabled = false;
      box.disabled = false;
      outcome.textContent = message;
      if (onDone) {
        onDone(message);
      }
    }

    sb.rpc("moderate_report", { report_id: r.id, action: action, note: noteText || null })
      .then(function (result) {
        if (result.error) {
          failed(result.error.message || "That did not go through.");
          return;
        }
        row.className = "pickable done";
        box.checked = false;
        outcome.textContent = action === "approve" ? "Approved." : "Rejected.";
        /* the map cache is five minutes old at most; a moderator who
           just approved something should see it on their next look */
        forgetCameraCache();
        if (onDone) {
          onDone(null);
        } else {
          refreshBacklog();
        }
      })
      .catch(function () {
        failed("That did not go through. Try again in a moment.");
      });
  }

  approve.onclick = function () { act("approve", null, null); };
  reject.onclick = function () { act("reject", null, null); };

  /* How bulkDecide() reaches this row's act(): a method on the
     element, so the batch needs nothing but the rows it found. */
  row.decide = act;

  actions.appendChild(approve);
  actions.appendChild(reject);
  actions.appendChild(outcome);

  main.appendChild(head);
  main.appendChild(body);
  main.appendChild(proof);
  main.appendChild(actions);

  row.appendChild(pick);
  row.appendChild(main);
  return row;
}

/* ---------------- deciding many at once ----------------

   Twenty approvals were twenty clicks and twenty round trips, each
   with a "…" to wait through. Moderation is volunteer time, and it is
   the scarcest thing the project has, so the queue is now a list of
   tick boxes with two buttons over it: Approve selected, Reject
   selected, with one note for the whole batch of rejections.

   What it must not become is a second way in. The bulk path calls
   moderate_report once per report - the same function the buttons
   on a row call, with the same role check on the server - through
   the row's own act(). There is no server function that takes a
   list, on purpose: one that did would be a second door to keep
   locked, and the per-report function already does the clustering,
   the merging and the XP that an approval means. The cost is one
   request per report, which is what a moderator was paying by hand;
   BULK_PARALLEL of them go at once so twenty take about as long as
   five.

   And it must not fail quietly. Each row reports its own outcome:
   a row that went through leaves the list when the batch is in, a
   row that did not stays where it was with the server's reason
   beside it, and the line under the buttons says how many of each.
   A batch of twenty with one failure is nineteen decisions made and
   one plainly still to make, never "something went wrong". */

var BULK_PARALLEL = 4;
var bulkRunning = false;

/* The <li> an element sits in. Walks up rather than using closest(),
   which is a newer DOM call than the rest of this file leans on. */
function rowOf(el) {
  while (el && el.tagName !== "LI") {
    el = el.parentNode;
  }
  return el;
}

/* The rows whose box is ticked and that are still undecided. A row
   marked done keeps its box unticked and its buttons off, so it
   cannot be sent twice from here. */
function selectedQueueRows() {
  var boxes = document.querySelectorAll("#queue-list li.pickable:not(.done) .pick-box");
  var rows = [];
  var i;

  for (i = 0; i < boxes.length; i++) {
    if (boxes[i].checked && !boxes[i].disabled) {
      rows.push(rowOf(boxes[i]));
    }
  }
  return rows;
}

function setUpBulk() {
  var all = document.getElementById("queue-select-all");
  var approveAll = document.getElementById("queue-approve-selected");
  var rejectAll = document.getElementById("queue-reject-selected");

  if (!all || !approveAll || !rejectAll) {
    return;
  }

  /* "All on this page" is exactly that: the rows that are loaded.
     It never reaches into pages not yet fetched, because a moderator
     should not be able to approve what they have not seen. */
  all.onchange = function () {
    var boxes = document.querySelectorAll("#queue-list li.pickable:not(.done) .pick-box");
    var i;

    for (i = 0; i < boxes.length; i++) {
      if (!boxes[i].disabled) {
        boxes[i].checked = all.checked;
      }
    }
  };

  approveAll.onclick = function () { bulkDecide("approve"); };
  rejectAll.onclick = function () { bulkDecide("reject"); };
}

function bulkDecide(action) {
  var rows = selectedQueueRows();
  var note = document.getElementById("queue-bulk-note");
  var all = document.getElementById("queue-select-all");
  var approveAll = document.getElementById("queue-approve-selected");
  var rejectAll = document.getElementById("queue-reject-selected");
  var list = document.getElementById("queue-list");
  var empty = document.getElementById("queue-empty");
  var more = document.getElementById("queue-more");
  var why = null;
  var next = 0;
  var active = 0;
  var done = 0;
  var failed = 0;

  if (bulkRunning) {
    return;
  }
  if (rows.length === 0) {
    note.textContent = "Nothing selected.";
    return;
  }

  /* One note for the batch, on rejection only - approve_report has
     no note to carry, and a rejection is the one the reporter reads.
     Cancelling the prompt cancels the batch; an empty note is no
     note, as the row's own Reject sends. */
  if (action === "reject") {
    why = window.prompt("A note for the reporters of these " + rows.length +
      " reports - they can read it. Leave it blank for none.", "");
    if (why === null) {
      return;
    }
    why = why.trim() || null;
  }

  bulkRunning = true;
  approveAll.disabled = true;
  rejectAll.disabled = true;
  all.disabled = true;
  note.textContent = (action === "approve" ? "Approving " : "Rejecting ") + rows.length + "…";

  function finish() {
    var i;

    bulkRunning = false;
    approveAll.disabled = false;
    rejectAll.disabled = false;
    all.disabled = false;
    all.checked = false;

    /* The decided rows go; the failed ones stay, marked, with their
       reason where act() put it. */
    for (i = 0; i < rows.length; i++) {
      if (rows[i].className.indexOf("done") !== -1 && rows[i].parentNode) {
        rows[i].parentNode.removeChild(rows[i]);
      }
    }

    note.textContent = (action === "approve" ? "Approved " : "Rejected ") +
      done + " of " + rows.length + "." +
      (failed ? " " + failed + " did not go through - the reason is beside each." : "");

    /* A page emptied by the batch with nothing more to load is an
       empty queue; the pager only knows to say so on a first page. */
    if (!list.children.length && more.style.display === "none") {
      empty.style.display = "";
    }

    forgetCameraCache();
    refreshBacklog();
  }

  /* Keep BULK_PARALLEL requests out at a time until the rows run
     out, then finish once the last one is back. */
  function launch() {
    while (active < BULK_PARALLEL && next < rows.length) {
      (function (row) {
        active++;
        row.className = row.className.replace(" failed", "");
        row.decide(action, why, function (problem) {
          active--;
          if (problem) {
            failed++;
            row.className = "pickable failed";
          } else {
            done++;
          }
          if (next >= rows.length && active === 0) {
            finish();
          } else {
            launch();
          }
        });
      })(rows[next++]);
    }
  }

  launch();
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

/* ---------------- activity: who did what ----------------

   On a project that publishes accusations about surveillance, being
   able to audit its own moderators is not optional. The columns were
   always there - every decided report carries resolved_by,
   resolved_at and resolution_note - and nothing showed them: the
   history tab shows the reporter and the outcome, not the moderator.
   This tab is the other reading of the same rows, newest decision
   first: who decided, when, what they said, and about what. A report
   that approved itself - enough people agreed - says so, since it
   has no moderator to name.

   Under it, the other half: what has been done to a camera by hand.
   Adding, editing, moving, hiding, unhiding and merging each write a
   row to moderation_log (see schema.sql, version 2.6), with the
   moderator, the camera, the time, and a note that keeps what the
   row no longer has - where a pin was, what a name said before.

   Two lists rather than one stream, because they are two tables with
   two clocks, and a single stream in time order would need both
   fetched whole to page it honestly. Each is a pager of its own.
   Both are moderators' reading only, and the server says so: the
   reports policy, the profiles policy and the log's own policy all
   ask is_moderator(); the tab hiding itself is the courtesy.

   The log table arrives by migration and the live database may not
   have it yet. That is not a broken tab: the lower list says which
   migration to run, and the upper list is unaffected. */

var activityPager = null;
var activityLogPager = null;

/* Everything the decision row shows. Two joins on profiles, told
   apart by the foreign key each goes through: the reporter is not
   shown here (the history tab has them), the moderator is. The
   camera join is for its name. */
var ACTIVITY_COLUMNS = "id,kind,type,status_claim,name,camera_id,lat,lon,state,resolved_at,resolution_note," +
  "resolver:profiles!reports_resolved_by_fkey(username),cameras(id,name)";

var LOG_COLUMNS = "id,action,camera_id,note,created_at,profiles(username),cameras(id,name,lat,lon)";

function loadActivity() {
  if (!activityPager) {
    activityPager = makePager({
      list:   document.getElementById("activity-list"),
      empty:  document.getElementById("activity-empty"),
      note:   document.getElementById("activity-note"),
      more:   document.getElementById("activity-more"),
      failed: "Could not load the decisions.",
      row:    activityRow,
      fetch:  function (offset, onDone) {
        loadPage(
          sb.from("reports")
            .select(ACTIVITY_COLUMNS)
            .in("state", ["approved", "rejected", "merged"])
            .order("resolved_at", { ascending: false, nullsFirst: false }),
          offset, onDone);
      }
    });
    activityLogPager = makePager({
      list:   document.getElementById("activity-log-list"),
      empty:  document.getElementById("activity-log-empty"),
      note:   document.getElementById("activity-log-note"),
      more:   document.getElementById("activity-log-more"),
      failed: "Could not load the camera log.",
      row:    activityLogRow,
      fetch:  function (offset, onDone) {
        loadPage(
          sb.from("moderation_log")
            .select(LOG_COLUMNS)
            .order("created_at", { ascending: false }),
          offset, function (problem, rows, more) {
            /* 42P01 is "no such table": the migration has not been
               run against this database. Say which, rather than
               "could not load". */
            if (problem && problem.code === "42P01") {
              onDone("The camera log is not in the database yet: run backend/migrations/004_moderation_log.sql in the SQL editor.", [], false);
              return;
            }
            onDone(problem, rows, more);
          });
      }
    });
  }
  activityPager.reset();
  activityLogPager.reset();
}

/* What a report was about, in the words the queue uses. */
function reportSubject(r) {
  var cam = r.cameras;

  return r.kind === "new"
    ? "New: " + typeLabel(r.type) + " — " + (r.name || "")
    : "State: " + (cam ? cam.name : "camera #" + r.camera_id) + " is " + claimLabel(r.status_claim);
}

/* "See on the map →", the same link the queue and the history give. */
function mapLink(lat, lon) {
  var a = document.createElement("a");

  a.href = pageHref("index.html") + "#" + Number(lat).toFixed(5) + "," + Number(lon).toFixed(5);
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = "See on the map →";
  return a;
}

function activityRow(r) {
  var row = document.createElement("li");
  var head = document.createElement("div");
  var body = document.createElement("div");
  var what = document.createElement("strong");
  var meta = document.createElement("span");
  var who;

  head.className = "queue-head";
  body.className = "queue-body";

  what.textContent = stateLabel(r.state) + " · " + reportSubject(r);
  head.appendChild(what);

  /* No moderator named. For an approval or a merge that is usually
     the auto-approve trigger - enough separate people agreed, and
     nobody decided it - which is worth saying in as many words,
     because it is the one kind of approval nobody made and an audit
     should be able to tell. But the column is also null when the
     moderator's account is gone (on delete set null), and a
     rejection is never automatic, so the row says what the data can
     honestly say and no more. */
  if (r.resolver && r.resolver.username) {
    who = "by " + r.resolver.username;
  } else if (r.state === "rejected") {
    who = "no moderator named - the service role, or an account since deleted";
  } else {
    who = "no moderator named - approved itself when enough people agreed, or the account is since deleted";
  }

  meta.className = "coords";
  meta.textContent = who +
    (r.resolved_at ? " · " + new Date(r.resolved_at).toLocaleString() : "") +
    (r.resolution_note ? " · “" + r.resolution_note + "”" : "");
  head.appendChild(meta);

  if (r.cameras) {
    var camLine = document.createElement("span");
    camLine.className = "coords";
    camLine.textContent = "Camera #" + r.cameras.id + " · " + r.cameras.name;
    body.appendChild(camLine);
    body.appendChild(document.createElement("br"));
  }
  body.appendChild(mapLink(r.lat, r.lon));

  row.appendChild(head);
  row.appendChild(body);
  return row;
}

/* The log's action names, in words. The same six the table's check
   constraint allows; an action it does not know is shown as it is
   rather than hidden, because a row in the log is a row in the log. */
function actionLabel(action) {
  return {
    add_camera:    "Added by hand",
    edit_camera:   "Edited",
    move_camera:   "Moved",
    hide_camera:   "Taken off the map",
    unhide_camera: "Put back on the map",
    merge_cameras: "Merged"
  }[action] || action;
}

function activityLogRow(l) {
  var row = document.createElement("li");
  var head = document.createElement("div");
  var body = document.createElement("div");
  var what = document.createElement("strong");
  var meta = document.createElement("span");
  var cam = l.cameras;

  head.className = "queue-head";
  body.className = "queue-body";

  what.textContent = actionLabel(l.action) + " · " +
    (cam ? cam.name : "camera #" + l.camera_id) + " (#" + l.camera_id + ")";
  head.appendChild(what);

  /* No actor means the service role did it - a script, the
     maintainer in the SQL editor - or the moderator's account is
     gone. Either way there is no name to give, and the row says so
     rather than showing a blank. */
  meta.className = "coords";
  meta.textContent = (l.profiles && l.profiles.username ? "by " + l.profiles.username : "no moderator - the service role, or an account since deleted") +
    " · " + new Date(l.created_at).toLocaleString() +
    (l.note ? " · " + l.note : "");
  head.appendChild(meta);

  if (cam && cam.lat !== undefined && cam.lat !== null) {
    body.appendChild(mapLink(cam.lat, cam.lon));
  }

  row.appendChild(head);
  row.appendChild(body);
  return row;
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
