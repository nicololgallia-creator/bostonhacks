// The remote's second layer: tell it your stop, get songs that fit your wait, start.
// One step on screen at a time, each step one decision, Back on every step. It draws into the
// screen element main.js gives it, sends `start` (PLAN.md, "Seats and session") and closes
// itself when the stage leaves the lobby. Colours, sizes and motion come from tokens.css.
import "./ride.css";
import { listStops, nextTrains, rideSeconds, stopsOnRoute } from "../mbta/api.js";
import { songs } from "../songs/index.js";
import { pickSongs } from "../songs/pick.js";
import { songSeconds } from "../game/engine.js";

const REFRESH_MS = 20000; // the live trains are asked for no faster than this
const SHOW_STOPS = 5;     // matches shown while typing a station
const SHOW_TRAINS = 6;
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const CHEVRON = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const dur = (sec) => {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m ? (s ? `${m} min ${s} s` : `${m} min`) : `${s} s`;
};
const mins = (sec) => (sec < 45 ? "Now" : `${Math.round(sec / 60)} min`);
const secondsTo = (iso) => (Date.parse(iso) - Date.now()) / 1000;
const count = (n, one, many) => `${WORDS[n] ?? n} ${n === 1 ? one : many}`;

// "Green-B" is the Green Line B branch. The dot carries the branch letter, so it reads without colour.
const lineName = (id) => (id.startsWith("Green-") ? `Green Line ${id.slice(6)}` : `${id} Line`);
const lineKey = (id) => (id.startsWith("Green") ? "green" : id.toLowerCase());
const lineLetter = (id) => (id.startsWith("Green-") ? id.slice(6) : id[0]);
const dot = (id) => `<span class="dot" data-line="${lineKey(id)}" role="img" aria-label="${lineName(id)}">${lineLetter(id)}</span>`;

// A failed load: its own message and a way to try again, together.
const failure = (message) => `<p class="hint" data-error>${esc(message)}</p><button class="btn btn-quiet" type="button" data-retry>Try again</button>`;

const lastStop = {
  get() { try { const s = JSON.parse(localStorage.getItem("pp:lastStop")); return s?.id && s?.name ? s : null; } catch { return null; } },
  set(stop) { try { localStorage.setItem("pp:lastStop", JSON.stringify({ id: stop.id, name: stop.name })); } catch { /* the page still works, it only forgets */ } },
};

const row = ({ lead = "", title, sub = "", end = "", attrs = "", big = false }) => `
  <button class="row${big ? " big" : ""}" type="button" ${attrs}>
    ${lead}
    <span class="row-main"><span class="row-title">${esc(title)}</span>${sub ? `<span class="row-sub">${esc(sub)}</span>` : ""}</span>
    ${end ? `<span class="row-end">${end}</span>` : ""}
  </button>`;
const songRow = (s, lead = "") => `
  <div class="row" data-static>${lead}
    <span class="row-main"><span class="row-title">${esc(s.title)}</span><span class="row-sub">${esc(s.by)}</span></span>
    <span class="row-end">${dur(songSeconds(s))}</span>
  </div>`;

export function openRide({ screen, send, onClose }) {
  let seq = 0;          // goes up with every screen, so a late answer for an old screen is dropped
  let timers = [];
  let closed = false;
  const steps = [];     // the screens so far; Back runs the one before
  const pick = {};      // stop, mode, trains, train, line, dest, ride

  const stopTimers = () => { timers.forEach(clearInterval); timers = []; };
  const every = (ms, fn) => timers.push(setInterval(fn, ms));
  const close = () => { if (closed) return; closed = true; stopTimers(); onClose(); };
  const go = (step) => { steps.push(step); step(); };
  const swap = (step) => { steps[steps.length - 1] = step; step(); }; // replaces the screen Back would return to
  const back = () => { steps.pop(); if (steps.length) steps[steps.length - 1](); else close(); };

  // Draws one step. `live()` says whether this screen is still the one showing.
  function view({ title, sub = "", body = "", foot = "", onClick }) {
    stopTimers();
    const mine = ++seq;
    const el = document.createElement("section");
    el.className = "ride";
    el.innerHTML = `
      <button class="back" type="button" data-back>${CHEVRON}Back</button>
      <div><h1 class="title" tabindex="-1"></h1><p class="sub"></p></div>
      <div class="body">${body}</div>
      <div class="foot">${foot}</div>`;
    const heading = el.querySelector(".title");
    const subline = el.querySelector(".sub");
    heading.textContent = title;
    subline.textContent = sub;
    subline.hidden = !sub;
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-back]")) back();
      else onClick?.(e);
    });
    screen.replaceChildren(el);
    window.scrollTo(0, 0);
    return { el, heading, subline, body: el.querySelector(".body"), foot: el.querySelector(".foot"), live: () => mine === seq };
  }
  const pickedBy = (e, attr) => e.target.closest(`[${attr}]`)?.getAttribute(attr);

  // ---- 1. Where are you? ----

  function stepStop() {
    const v = view({
      title: "Where are you?",
      sub: "Type your station.",
      body: `<input class="field" type="text" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="off"
               autocorrect="off" spellcheck="false" placeholder="Search stations" aria-label="Station name">
             <div class="list"></div><p class="hint"></p>`,
      foot: `<button class="btn btn-quiet" type="button" data-songs>Just pick songs</button>`,
      onClick: (e) => {
        if (e.target.closest("[data-songs]")) return go(stepSongs);
        if (e.target.closest("[data-retry]")) { all = null; failed = ""; load(); return draw(); }
        const i = pickedBy(e, "data-stop");
        if (i == null) return;
        pick.stop = shown[Number(i)];
        lastStop.set(pick.stop);
        go(stepMode);
      },
    });
    const input = v.body.querySelector("input");
    const list = v.body.querySelector(".list");
    const hint = v.body.querySelector(".hint");
    let all = null, failed = "", shown = [];

    const draw = () => {
      hint.toggleAttribute("data-error", false);
      const q = input.value.toLowerCase().split(/\s+/).filter(Boolean);
      const last = lastStop.get();
      shown = [];
      let note = "";
      if (failed) {
        list.innerHTML = failure(failed);
        hint.textContent = "";
        return;
      }
      if (!all) note = "Loading the stations.";
      else if (!q.length) {
        const known = last && all.find((s) => s.id === last.id);
        if (known) shown = [known];
        else note = "Type the first letters of your station.";
      } else {
        const hits = all.filter((s) => q.every((w) => s.name.toLowerCase().includes(w)));
        hits.sort((a, b) => Number(!a.name.toLowerCase().startsWith(q[0])) - Number(!b.name.toLowerCase().startsWith(q[0])));
        shown = hits.slice(0, SHOW_STOPS);
        if (!hits.length) { hint.toggleAttribute("data-error", true); note = `No station matches "${input.value.trim()}". Check the spelling.`; }
        else if (hits.length > SHOW_STOPS) note = `Showing ${SHOW_STOPS} of ${hits.length}. Keep typing to narrow it.`;
      }
      list.innerHTML = shown.map((s, i) => row({
        title: s.name,
        sub: !q.length ? "Last time" : "",
        end: [...new Set(s.lines)].map(dot).join(""),
        attrs: `data-stop="${i}"`,
      })).join("");
      hint.textContent = note;
    };
    const load = () => listStops().then(
      (s) => { all = s; },
      (e) => { failed = e.message; },
    ).then(() => { if (v.live()) draw(); });

    input.addEventListener("input", draw);
    draw();
    load();
    if (!lastStop.get()) input.focus({ preventScroll: true });
  }

  // ---- 2. Platform or train? ----

  function stepMode() {
    const v = view({
      title: "Waiting or riding?",
      sub: `At ${pick.stop.name}.`,
      body: row({ title: "Waiting on the platform", sub: "The songs end when your train arrives.", attrs: `data-mode="platform"`, big: true })
        + row({ title: "Riding the train", sub: "The songs fill your ride.", attrs: `data-mode="train"`, big: true }),
      onClick: (e) => {
        const mode = pickedBy(e, "data-mode");
        if (!mode) return;
        pick.mode = mode;
        go(mode === "platform" ? stepTrains : stepLines);
      },
    });
    v.heading.focus({ preventScroll: true });
  }

  // ---- 3a. Platform: which train are you waiting for? ----

  function stepTrains() {
    const v = view({
      title: "Which train?",
      sub: `Live times at ${pick.stop.name}.`,
      body: `<p class="hint"></p><div class="list"></div>`,
      onClick: (e) => {
        if (e.target.closest("[data-retry]")) { failed = ""; load(); return drawAll(); }
        const i = pickedBy(e, "data-train");
        if (i == null) return;
        pick.train = trains[Number(i)];
        pick.trains = trains;
        go(stepSet);
      },
    });
    const list = v.body.querySelector(".list");
    const hint = v.body.querySelector(".hint");
    let trains = null, fetchedAt = 0, failed = "";

    // The rows are built when an answer arrives; the clock text is changed in place every
    // second, so a row is never replaced under a finger.
    const drawRows = () => {
      list.innerHTML = trains.map((t, i) => row({
        lead: dot(t.routeId),
        title: t.headsign || lineName(t.routeId),
        sub: lineName(t.routeId),
        end: `<span data-at="${esc(t.arrivesAt)}">${mins(secondsTo(t.arrivesAt))}</span>`,
        attrs: `data-train="${i}"`,
      })).join("");
    };
    const drawHint = () => {
      const age = trains ? Math.round((Date.now() - fetchedAt) / 1000) : 0;
      hint.toggleAttribute("data-error", Boolean(failed));
      if (failed) hint.textContent = trains ? `${failed} Showing the answer from ${dur(age)} ago.` : failed;
      else if (!trains) hint.textContent = "Loading the trains.";
      else if (!trains.length) hint.textContent = `No trains are listed at ${pick.stop.name} right now. This checks again every 20 seconds.`;
      else hint.textContent = age < 5 ? "Updated just now." : `Updated ${dur(age)} ago.`;
    };
    const drawAll = () => {
      if (trains) drawRows();
      else list.innerHTML = failed ? `<button class="btn btn-quiet" type="button" data-retry>Try again</button>` : "";
      drawHint();
    };
    const load = async () => {
      try { trains = (await nextTrains(pick.stop.id)).slice(0, SHOW_TRAINS); fetchedAt = Date.now(); failed = ""; }
      catch (e) { failed = e.message; } // a dropped network keeps the last answer
      if (v.live()) drawAll();
    };
    drawAll();
    load();
    every(REFRESH_MS, load);
    every(1000, () => {
      for (const t of list.querySelectorAll("[data-at]")) t.textContent = mins(secondsTo(t.dataset.at));
      drawHint();
    });
  }

  // ---- 3b. Train: which line and direction, then where you get off ----

  function stepLines() {
    const v = view({
      title: "Which way are you going?",
      sub: `Trains at ${pick.stop.name}.`,
      body: `<div class="list"></div><p class="hint">Loading the trains.</p>`,
      onClick: (e) => {
        if (e.target.closest("[data-retry]")) return stepLines();
        const i = pickedBy(e, "data-way");
        if (i == null) return;
        pick.line = lines[Number(i)];
        go(stepDest);
      },
    });
    const list = v.body.querySelector(".list");
    const hint = v.body.querySelector(".hint");
    let lines = [];
    nextTrains(pick.stop.id).then((trains) => {
      const seen = new Set();
      lines = trains.filter((t) => { const k = `${t.routeId}|${t.directionId}`; return !seen.has(k) && seen.add(k); });
      if (!v.live()) return;
      list.innerHTML = lines.map((t, i) => row({
        lead: dot(t.routeId),
        title: t.headsign || lineName(t.routeId),
        sub: lineName(t.routeId),
        end: mins(t.seconds),
        attrs: `data-way="${i}"`,
      })).join("");
      hint.textContent = lines.length ? "The time is the next train that way." : `No trains are listed at ${pick.stop.name} right now. Go back and try again in a minute.`;
    }, (e) => {
      if (!v.live()) return;
      hint.textContent = "";
      list.innerHTML = failure(e.message);
    });
  }

  function stepDest() {
    const { routeId, directionId, headsign } = pick.line;
    const v = view({
      title: "Where do you get off?",
      sub: `${lineName(routeId)}${headsign ? `, toward ${headsign}` : ""}.`,
      body: `<div class="list"></div><p class="hint">Loading the stops.</p>`,
      onClick: (e) => {
        if (e.target.closest("[data-retry]")) return stepDest();
        const i = pickedBy(e, "data-dest");
        if (i == null) return;
        pick.dest = after[Number(i)];
        go(stepRide);
      },
    });
    const list = v.body.querySelector(".list");
    const hint = v.body.querySelector(".hint");
    let after = [];
    stopsOnRoute(routeId, directionId).then((stops) => {
      const at = stops.findIndex((s) => s.id === pick.stop.id);
      after = at >= 0 ? stops.slice(at + 1) : stops; // only stops ahead of you on this train
      if (!v.live()) return;
      list.innerHTML = after.map((s, i) => row({ title: s.name, attrs: `data-dest="${i}"` })).join("");
      hint.textContent = after.length ? "" : `${pick.stop.name} is the last stop that way. Go back and pick the other direction.`;
    }, (e) => {
      if (!v.live()) return;
      hint.textContent = "";
      list.innerHTML = failure(e.message);
    });
  }

  function stepRide() {
    const v = view({
      title: "Working out your ride",
      sub: `${pick.stop.name} to ${pick.dest.name}. Checking the live times.`,
    });
    rideSeconds({ fromStopId: pick.stop.id, toStopId: pick.dest.id, routeId: pick.line.routeId, directionId: pick.line.directionId }).then(
      (ride) => { if (v.live()) { pick.ride = ride; swap(stepSet); } },
      (e) => {
        if (!v.live()) return;
        steps.pop(); // Back from the failure goes to the list of stops, not to this check again
        go(() => {
          const failed = view({
            title: "That ride did not work out.",
            sub: e.message,
            foot: `<button class="btn btn-primary" type="button" data-songs>Pick songs by hand</button>`,
            onClick: (ev) => { if (ev.target.closest("[data-songs]")) swap(stepSongs); },
          });
          failed.heading.focus({ preventScroll: true });
        });
      },
    );
  }

  // ---- 4. Your set ----

  // Sends start and waits for the stage to answer. A refusal arrives as the stage's own notice,
  // which main.js shows in the status line; the button comes back so it can be tried again.
  function begin(button, hint, songIds, transit) {
    button.disabled = true;
    button.textContent = "Starting";
    hint.textContent = "";
    if (!send({ type: "start", songIds, transit })) {
      button.disabled = false;
      button.textContent = "Start";
      hint.toggleAttribute("data-error", true);
      hint.textContent = "The remote is not connected to the floor. Wait a moment, then tap Start again.";
      return;
    }
    setTimeout(() => { if (!closed && button.isConnected) { button.disabled = false; button.textContent = "Start"; } }, 3000);
  }

  function stepSet() {
    const platform = pick.mode === "platform";
    // On the train the ride starts when Start is tapped, so the songs fit the ride's length.
    const left = () => (platform ? secondsTo(pick.train.arrivesAt) : pick.ride.seconds);
    const buffer = platform ? 20 : 30;
    let plan = pickSongs({ seconds: left(), buffer });
    const key = () => `${plan.fits}|${plan.songIds}`;

    const v = view({
      title: "",
      foot: `<p class="hint" data-error></p><button class="btn btn-primary" type="button" data-start>Start</button>`,
      onClick: (e) => {
        if (e.target.closest("[data-songs]")) return go(stepSongs);
        if (e.target.closest("[data-next]")) { pick.train = nextTrain(); return swap(stepSet); }
        const start = e.target.closest("[data-start]");
        if (!start) return;
        const transit = { stop: platform ? pick.stop.name : pick.dest.name, mode: pick.mode, endsAt: platform ? Date.parse(pick.train.arrivesAt) : Date.now() + pick.ride.seconds * 1000 };
        begin(start, v.foot.querySelector(".hint"), plan.songIds, transit);
      },
    });
    const nextTrain = () => (pick.trains ?? []).find((t) => t.seconds > pick.train.seconds);

    const draw = () => {
      const n = plan.songIds.length;
      const foot = v.foot.querySelector("[data-start], [data-next], [data-songs]");
      v.body.replaceChildren();
      if (plan.fits) {
        v.heading.textContent = platform ? `${dur(left())} until your train.` : `${dur(pick.ride.seconds)} ride to ${pick.dest.name}.`;
        v.subline.textContent = platform
          ? `${n === 1 ? "This song ends" : `These ${WORDS[n] ?? n} songs end`} as it arrives.`
          : `${n === 1 ? "This song fills" : `These ${WORDS[n] ?? n} songs fill`} your ride${pick.ride.source === "schedule" ? ". The time comes from the schedule, not live trains." : "."}`;
        v.body.innerHTML = plan.songIds.map((id) => songRow(songs.find((s) => s.id === id))).join("");
        foot.outerHTML = `<button class="btn btn-primary" type="button" data-start>Start</button>`;
      } else {
        const next = platform && nextTrain();
        v.heading.textContent = platform ? "Your train is too close for a song." : "Your ride is too short for a song.";
        v.subline.textContent = next ? `The next one is ${next.headsign || lineName(next.routeId)} in ${mins(secondsTo(next.arrivesAt))}.` : "You can still pick songs by hand.";
        foot.outerHTML = next
          ? `<button class="btn btn-primary" type="button" data-next>Use the next train</button>`
          : `<button class="btn btn-primary" type="button" data-songs>Pick songs by hand</button>`;
      }
      v.subline.hidden = false;
    };
    draw();
    v.heading.focus({ preventScroll: true });
    if (platform) {
      let shownKey = key();
      every(1000, () => {
        plan = pickSongs({ seconds: left(), buffer });
        if (key() !== shownKey) { shownKey = key(); draw(); } else if (plan.fits) v.heading.textContent = `${dur(left())} until your train.`;
      });
    }
  }

  // ---- By hand: the library, tap to add in order ----

  function stepSongs() {
    let chosen = [];
    const v = view({
      title: "Pick your songs",
      sub: "Tap to add them in order. Tap again to remove one.",
      body: songs.map((s, i) => row({
        lead: `<span class="order" aria-hidden="true"></span>`,
        title: s.title,
        sub: s.by,
        end: dur(songSeconds(s)),
        attrs: `data-song="${i}" aria-pressed="false"`,
      })).join(""),
      foot: `<p class="hint"></p><button class="btn btn-primary" type="button" data-start disabled>Start</button>`,
      onClick: (e) => {
        const i = pickedBy(e, "data-song");
        if (i != null) {
          const id = songs[Number(i)].id;
          chosen = chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id];
          sync();
        } else if (e.target.closest("[data-start]")) {
          begin(v.foot.querySelector("[data-start]"), hint, chosen, null);
        }
      },
    });
    const hint = v.foot.querySelector(".hint");
    const start = v.foot.querySelector("[data-start]");
    const sync = () => {
      v.body.querySelectorAll("[data-song]").forEach((b) => {
        const at = chosen.indexOf(songs[Number(b.dataset.song)].id);
        b.setAttribute("aria-pressed", String(at >= 0));
        b.querySelector(".order").textContent = at >= 0 ? at + 1 : "";
      });
      const total = chosen.reduce((sum, id) => sum + songSeconds(songs.find((s) => s.id === id)), 0);
      hint.removeAttribute("data-error");
      const words = count(chosen.length, "song", "songs");
      hint.textContent = chosen.length ? `${words[0].toUpperCase()}${words.slice(1)}, ${dur(total)} of music.` : "Nothing picked yet.";
      start.disabled = !chosen.length;
    };
    sync();
  }

  go(stepStop);
  return {
    // The stage is the only source of truth. Once it leaves the lobby the songs are going, so the remote steps aside.
    onState(state) { if (state?.status !== "lobby") close(); },
    close,
  };
}
