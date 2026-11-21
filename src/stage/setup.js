// Setup: line the camera up with the projector, place the seats, measure the lag ("Setup" in docs/HOW-IT-WORKS.md).
// One step on screen at a time. Next stays off until the step has worked. The laptop and the projector show the
// same picture, so the person reads the laptop and watches the floor.
//
//   openSetup({ stage: { feet }, layout, offsetMs, section, setLayout, setOffset, setSection, isPlaying, onClose })
//
// `stage.feet` is the stage's feet source. A camera source (src/track/tracked.js) gets all six steps. Any other
// source, like the mouse, skips the two steps that need a camera and is read from the field itself, so a click is
// a foot arriving. Without a stage source, setup opens its own camera and closes it again.
// `layout` and `offsetMs` are what the stage has now. `setLayout(layout)` returns false when the session refuses
// it (a song is playing). `setOffset(ms)` saves the lag. `section` is the floor's place name, "Car 2, front", and
// `setSection(name)` returns false when the session refuses it. `isPlaying()` says whether a song is running, so a
// "song is playing" refusal goes away when it ends. onClose gets { camera, calibrated } for session.setReady.
// openSetup returns { close }, or nothing when setup is already open.
// After it, the stage should call applyKeystone on its canvas again, because the corners may have changed.
import "./setup.css";
import { apply, invert, solve } from "../track/homography.js";
import { mouseFeet } from "../track/mouse.js";
import { createTrackedFeet } from "../track/tracked.js";
import { applyKeystone, loadCalibration, matrix3dFor, saveCalibration } from "./keystone.js";
import { feetBySpot, asLayout, makeLayout, MAX_SEATS } from "./layout.js";
import { createArrivals, measureLag } from "./lag.js";

// Where the four marks sit on the field, so each is whole and clear of the window's edge. Order: the same four corners as the keystone.
const MARKS = [{ x: 0.08, y: 0.1 }, { x: 0.92, y: 0.1 }, { x: 0.92, y: 0.9 }, { x: 0.08, y: 0.9 }];
const CORNERS = ["top left", "top right", "bottom right", "bottom left"];
const HANDLE = 56;
const UNIT = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
const MIN_PAD = 0.1; // a pad is at least a tenth of the field across and down
const LOST_MS = 3000; // feet seen, none on the field for this long: the lineup is wrong
const BEATS = 8;
const BEAT_MS = 600;
const LEAD_MS = 1500; // before the first click, so the rings show the rhythm
const SQUARE = { u: 0.5, v: 0.55, size: 0.4 }; // the lag test's square: centre, and its height as a share of the field
const seatNumber = (id) => ((id - 1) % MAX_SEATS) + 1; // there are four seat colours

const el = (tag, className, text) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};
const button = (label, className, onClick) => {
  const b = el("button", `setup-btn ${className}`.trim(), label);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
};
const clamp01 = (n) => Math.min(1, Math.max(0, n));

let isOpen = false;

// Glowing dots at feet, in field coordinates, on a canvas that covers the field. A foot the camera puts outside the
// field is a hollow ring on the nearest edge, in another colour, with an arrow pointing the way it is off.
function drawFeet(g, list, color, offColor) {
  const { width: w, height: h } = g.canvas;
  g.clearRect(0, 0, w, h);
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  for (const f of list) {
    const off = f.u < 0 || f.u > 1 || f.v < 0 || f.v > 1;
    if (off) {
      const ring = h * 0.04, inset = ring * 2.2; // inset, so the whole ring and its arrow stay on the field
      const x = clamp(f.u * w, inset, w - inset), y = clamp(f.v * h, inset, h - inset);
      const way = Math.atan2((f.v - clamp(f.v, 0, 1)) * h, (f.u - clamp(f.u, 0, 1)) * w);
      const at = (d, side) => [x + Math.cos(way) * d - Math.sin(way) * side, y + Math.sin(way) * d + Math.cos(way) * side];
      g.lineWidth = h * 0.012;
      g.strokeStyle = g.fillStyle = offColor;
      g.beginPath();
      g.arc(x, y, ring, 0, 7);
      g.stroke();
      g.beginPath();
      g.moveTo(...at(ring * 1.25, -ring * 0.55));
      g.lineTo(...at(ring * 2.1, 0));
      g.lineTo(...at(ring * 1.25, ring * 0.55));
      g.fill();
      continue;
    }
    const x = f.u * w, y = f.v * h, r = h * 0.06;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "#fff");
    grad.addColorStop(0.3, color);
    grad.addColorStop(1, "transparent");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, 7);
    g.fill();
  }
}

// The field's four corners as the camera sees them: sent back through the saved map. Null when there is no map
// yet or it cannot be reversed. { map, outline: four camera points, 0 to 1 }.
function cameraMap() {
  const map = loadCalibration().cameraToField;
  if (!map) return null;
  try {
    const back = invert(map);
    const outline = UNIT.map((c) => apply(back, c));
    return outline.every(Boolean) ? { map, outline } : null;
  } catch { return null; }
}

// The field's outline on a camera picture: a closed four-sided shape, the players' edge (the bottom) thicker and named.
function drawOutline(g, outline, bright, edge) {
  const { width: w, height: h } = g.canvas;
  const pts = outline.map((p) => [p.x * w, p.y * h]);
  const line = (from, to, color, width) => {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(...pts[from]);
    g.lineTo(...pts[to]);
    g.stroke();
  };
  g.lineJoin = g.lineCap = "round";
  for (const [color, width] of [["#000", 8], [bright, 4]]) {
    for (let i = 0; i < 3; i++) line(i, i + 1, color, width);
    line(3, 0, color, width);
  }
  line(2, 3, "#000", 10);
  line(2, 3, edge, 6);
  g.font = `600 ${Math.max(11, Math.round(w * 0.016))}px sans-serif`;
  g.textAlign = "center";
  g.fillStyle = edge;
  g.strokeStyle = "#000";
  g.lineWidth = 3;
  const mx = (pts[2][0] + pts[3][0]) / 2, my = (pts[2][1] + pts[3][1]) / 2 - 10;
  g.strokeText("players' edge", mx, my);
  g.fillText("players' edge", mx, my);
}

export function openSetup({ stage, layout: startLayout, offsetMs, section, setLayout, setOffset, setSection, isPlaying, onClose }) {
  if (isOpen) return;
  isOpen = true;
  const camera = !stage?.feet || !!stage.feet.raw; // the mouse and other stand-ins have no camera to set up
  const feet = camera ? (stage?.feet ?? createTrackedFeet()) : null;
  const own = camera && feet !== stage?.feet;
  const starting = feet?.start();
  starting?.catch(() => {}); // the camera step shows why

  const root = el("div", "setup");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Setup");
  const layer = el("div");
  const count = el("p", "setup-count");
  const instruction = el("p", "setup-instruction");
  const mini = el("div", "setup-mini"); // the small camera picture, in the foot check and the seats
  const controls = el("div", "setup-row");
  const meta = el("p", "setup-meta");
  const error = el("p", "setup-error");
  error.setAttribute("role", "alert");
  const back = button("Back", "", () => go(index - 1));
  const next = button("Next", "is-primary", () => (index === STEPS.length - 1 ? close() : go(index + 1)));
  const head = el("div", "setup-head");
  // The panel sits in a corner while the field needs seeing. Move sends it to the next corner.
  const docks = ["tl", "tr", "br", "bl"];
  root.dataset.corner = "tl";
  const move = button("Move", "is-quiet", () => { root.dataset.corner = docks[(docks.indexOf(root.dataset.corner) + 1) % 4]; });
  move.setAttribute("aria-label", "Move this panel to another corner");
  head.append(count, move, button("Close setup", "is-quiet", close));
  const foot = el("div", "setup-foot");
  foot.append(back, next);
  const panel = el("div", "setup-panel");
  panel.append(head, instruction, mini, controls, meta, error, foot);
  root.append(layer, panel);
  document.body.append(root);

  const css = (name) => getComputedStyle(root).getPropertyValue(name).trim();
  let index = 0;
  let cleanup = null;
  let keyHandler = null;

  const ctx = {
    layer,
    controls,
    say: (t) => { instruction.textContent = t; },
    meta: (t) => { meta.textContent = t; },
    error: (t) => { error.textContent = t || ""; },
    next: (on) => { next.disabled = !on; },
    keys: (fn) => { keyHandler = fn; },
  };

  // Where the field's feet come from in a step: the stage's camera, or the mouse on that step's field layer.
  const source = (field) => {
    if (camera) return feet;
    const mouse = mouseFeet(field);
    mouse.start();
    return mouse;
  };

  // Keys belong to setup while it is open: the game's own keys (P, S, F, Esc) must not fire under it.
  const onKey = (e) => { e.stopPropagation(); keyHandler?.(e); };
  addEventListener("keydown", onKey, true);

  // The camera picture, or a plain dark box when a recording stands in for the camera, with a canvas for the dots.
  // `mini` is the small one that sits in the panel.
  function picture(mini) {
    const box = el("div", mini ? "setup-pic is-mini" : "setup-pic");
    const canvas = el("canvas");
    // A second video shows the same camera stream. The tracker's own video must never be moved:
    // taking it off the page pauses it, and the camera then hands out one stale frame.
    let preview = null;
    if (feet.video) {
      preview = el("video");
      preview.muted = true;
      preview.playsInline = true;
      preview.autoplay = true;
      preview.srcObject = feet.video.srcObject;
      box.append(preview);
    }
    box.append(canvas);
    const ratio = () => (feet.video?.videoWidth ? feet.video.videoWidth / feet.video.videoHeight : 16 / 9);
    return {
      box,
      // list: camera feet [{ x, y, off }], 0 to 1. A foot with `off` is outside the field. outline: the field's four corners.
      draw(list, outline) {
        if (preview && preview.srcObject !== feet.video.srcObject) preview.srcObject = feet.video.srcObject; // the camera was changed
        box.style.setProperty("--ar", ratio());
        const w = box.clientWidth, h = box.clientHeight;
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        const g = canvas.getContext("2d");
        g.clearRect(0, 0, w, h);
        if (outline) drawOutline(g, outline, css("--text"), css("--seat-1"));
        const r = Math.max(6, w * 0.012);
        g.lineWidth = 3;
        for (const p of list) {
          g.beginPath();
          g.arc(p.x * w, p.y * h, r, 0, 7);
          g.strokeStyle = "#000";
          if (p.off) { g.lineWidth = 7; g.stroke(); g.lineWidth = 4; g.strokeStyle = css("--seat-2"); g.stroke(); } // a hollow ring
          else { g.fillStyle = css("--seat-3"); g.fill(); g.lineWidth = 3; g.stroke(); }
        }
      },
    };
  }

  // The small camera picture for the foot check and the seats: a dot on every foot the camera finds, a pink ring
  // on one the map puts off the field, and the field's outline on top. If the outline does not sit on the projected
  // rectangle in the picture, the lineup is wrong.
  function miniCamera() {
    const pic = picture(true);
    mini.replaceChildren(pic.box);
    const where = cameraMap();
    return () => {
      const list = feet.raw().map((f) => {
        const p = where && apply(where.map, f);
        return { x: f.x, y: f.y, off: !!p && (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) };
      });
      pic.draw(list, where?.outline);
    };
  }

  function cameraStep() {
    const pic = picture();
    layer.append(pic.box);
    ctx.say("Pick the camera that looks at the floor. Stand in its view: a yellow dot should sit on each shoe.");
    const select = el("select", "setup-select");
    select.setAttribute("aria-label", "Camera");
    select.hidden = true;
    controls.append(select);
    let alive = true;
    let failed = false; // the camera did not start, and the error says why
    starting.then(async () => {
      if (!alive || !feet.video) return;
      const current = loadCalibration().cameraId;
      const cameras = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
      select.replaceChildren(...cameras.map((d, i) => new Option(d.label || `Camera ${i + 1}`, d.deviceId, false, d.deviceId === current)));
      select.hidden = false;
    }).catch((e) => { failed = true; if (alive) ctx.error(e.message); });
    select.addEventListener("change", async () => {
      saveCalibration({ cameraId: select.value, cameraToField: null }); // a map made for another camera does not fit this one
      ctx.error("");
      try { await feet.reload(); } catch (e) { ctx.error(e.message); }
    });

    let frame = 0;
    const tick = () => {
      feet.read(); // pulls the next camera frame when the stage is not doing it
      const seen = feet.raw();
      pic.draw(seen, null);
      const working = feet.ready().camera && feet.fps() > 0;
      ctx.meta(working ? `${feet.fps()} frames a second, ${seen.length} ${seen.length === 1 ? "foot" : "feet"} seen.` : failed ? "" : "Starting the camera...");
      ctx.next(working);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => { alive = false; cancelAnimationFrame(frame); };
  }

  function straightenStep() {
    const field = el("div", "setup-field is-grid");
    layer.append(field);
    applyKeystone(field);
    ctx.say("Look at the squares on the floor. If every one looks square, press Next.");
    ctx.meta("If they look stretched, drag a corner until they look square. The arrow keys nudge the last corner you touched.");
    ctx.next(true);

    let last = null;
    const handles = CORNERS.map((name, i) => {
      const h = el("button", "setup-handle", String(i + 1));
      h.type = "button";
      h.setAttribute("aria-label", `Corner ${i + 1}, ${name}`);
      return h;
    });
    layer.append(...handles);
    // A handle sits just inside its corner, so the whole square stays in the window.
    const place = () => loadCalibration().corners.forEach((c, i) => {
      handles[i].style.left = `${c.x * innerWidth - (i === 1 || i === 2 ? HANDLE : 0)}px`;
      handles[i].style.top = `${c.y * innerHeight - (i >= 2 ? HANDLE : 0)}px`;
    });
    place();

    function setCorner(i, x, y) {
      const corners = loadCalibration().corners;
      corners[i] = { x: clamp01(x), y: clamp01(y) };
      try { matrix3dFor(corners, innerWidth, innerHeight); } catch (e) { ctx.error(e.message); return; }
      ctx.error("");
      saveCalibration({ corners, cameraToField: null }); // the camera's map was made for the old shape
      feet?.reload();
      applyKeystone(field);
      place();
    }
    const touch = (i) => { last = i; handles.forEach((h, j) => h.classList.toggle("is-last", j === i)); };

    let grab = null;
    handles.forEach((h, i) => {
      h.addEventListener("pointerdown", (e) => {
        h.setPointerCapture(e.pointerId);
        touch(i);
        const c = loadCalibration().corners[i];
        grab = { x: e.clientX - c.x * innerWidth, y: e.clientY - c.y * innerHeight };
      });
      h.addEventListener("pointermove", (e) => {
        if (h.hasPointerCapture(e.pointerId)) setCorner(i, (e.clientX - grab.x) / innerWidth, (e.clientY - grab.y) / innerHeight);
      });
      h.addEventListener("focus", () => touch(i));
    });

    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    ctx.keys((e) => {
      const d = arrows[e.key];
      if (!d || last === null) return;
      e.preventDefault();
      const c = loadCalibration().corners[last];
      const px = e.shiftKey ? 10 : 1;
      setCorner(last, c.x + (d[0] * px) / innerWidth, c.y + (d[1] * px) / innerHeight);
    });
    addEventListener("resize", place);
    return () => removeEventListener("resize", place);
  }

  function fieldStep() {
    let clicks = [];
    const ORDER = "1 top left, 2 top right, 3 bottom right, 4 bottom left";

    function showMarks() {
      dock(false); // the panel stays top centre here, clear of the four marks
      clicks = [];
      layer.replaceChildren();
      controls.replaceChildren(button("Take a still", "is-primary", takeStill));
      ctx.meta(`Seen from the players' edge: ${ORDER}.`);
      ctx.error("");
      ctx.say("Four numbered marks should be on the floor. Check that the camera can see all four, then take a still.");
      ctx.next(!!loadCalibration().cameraToField);
      const field = el("div", "setup-field is-quiet");
      MARKS.forEach((m, i) => field.append(mark(i, m, CORNERS[i])));
      layer.append(field);
      applyKeystone(field);
    }

    // A numbered mark. On the floor it also names its corner, in the words the clicking step uses.
    function mark(i, at, corner) {
      const d = el("div", "setup-mark", String(i + 1));
      if (corner) {
        d.append(el("small", "", corner));
        d.classList.toggle("is-bottom", i >= 2);
      }
      d.style.left = `${at.x * 100}%`;
      d.style.top = `${at.y * 100}%`;
      d.style.background = `var(--seat-${i + 1})`;
      return d;
    }

    function takeStill() {
      const v = feet.video;
      const still = el("canvas");
      still.width = v?.videoWidth || 1280; // a recording has no picture, so the still is a plain box
      still.height = v?.videoHeight || 720;
      const g = still.getContext("2d");
      if (v?.videoWidth) g.drawImage(v, 0, 0);
      else { g.fillStyle = css("--surface-1"); g.fillRect(0, 0, still.width, still.height); }
      const over = el("canvas"); // the field's outline goes here, above the still and below the numbered clicks
      over.width = still.width;
      over.height = still.height;

      dock(true); // the still takes the room the panel leaves
      layer.replaceChildren();
      const box = el("div", "setup-pic is-clickable");
      box.style.setProperty("--ar", still.width / still.height);
      box.append(still, over);
      layer.append(box);
      const ask = () => ctx.meta(
        clicks.length === 4 ? "Four of 4 clicked." : `${clicks.length} of 4 clicked. Next is mark ${clicks.length + 1}, ${CORNERS[clicks.length]}. Order: ${ORDER}.`,
      );
      const reset = () => {
        clicks = [];
        box.querySelectorAll(".setup-mark").forEach((m) => m.remove());
        over.getContext("2d").clearRect(0, 0, over.width, over.height);
        ctx.say("Click the four marks in the order of their numbers, as you see them on the floor from the players' edge.");
        ctx.next(!!loadCalibration().cameraToField);
        ctx.error("");
        ask();
      };
      reset();
      controls.replaceChildren(button("Redo", "", reset), button("Take another still", "", showMarks));
      box.addEventListener("click", (e) => {
        if (clicks.length >= 4) return;
        const r = box.getBoundingClientRect();
        const p = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
        box.append(mark(clicks.length, { x: p.x, y: p.y }));
        clicks.push(p);
        ask();
        if (clicks.length === 4) finish(over);
      });
    }

    async function finish(over) {
      try {
        saveCalibration({ cameraToField: solve(clicks, MARKS) });
        await feet.reload();
      } catch (e) {
        ctx.error(e.message);
        return;
      }
      // The field as the camera now sees it. A wrong click shows here at once, as a twisted or lopsided shape.
      const where = cameraMap();
      if (where) drawOutline(over.getContext("2d"), where.outline, css("--text"), css("--seat-1"));
      ctx.say("Saved. Does the outline sit on the field in the picture? If it is twisted or off, press Redo. If it looks right, press Next.");
      ctx.next(true);
    }

    showMarks();
  }

  function footStep() {
    // The grid stays on here: a plain black field with dots that had landed off it looked like
    // a dead screen on the real projector (Nicolo, Sat 21 Nov).
    const field = el("div", "setup-field is-grid");
    const canvas = el("canvas");
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    field.append(canvas);
    layer.append(field);
    applyKeystone(field);
    ctx.say("Walk around. Each foot should get a yellow dot on the picture here and on the floor.");
    ctx.next(true);
    const g = canvas.getContext("2d");
    const glow = css("--seat-3"), offColor = css("--seat-2");
    const src = source(field);
    const drawCamera = camera ? miniCamera() : null;
    const fix = button("Back to the four marks", "is-primary", () => go(STEPS.findIndex((st) => st.run === fieldStep)));
    let lonely = null; // since when feet are seen and none is inside the field
    let frame = 0;
    const tick = (now) => {
      const list = src.read();
      drawFeet(g, list, glow, offColor);
      drawCamera?.();
      const inside = list.filter((f) => f.u >= 0 && f.u <= 1 && f.v >= 0 && f.v <= 1).length;
      lonely = list.length && !inside ? (lonely ?? now) : null;
      const lost = camera && lonely !== null && now - lonely >= LOST_MS;
      ctx.meta(`${list.length} ${list.length === 1 ? "foot" : "feet"} seen, ${inside} inside the field. Yellow dot: on the field. Pink ring and arrow: off the field.`);
      ctx.error(!camera || feet.ready().calibrated
        ? (lost ? "Feet are seen but none is on the field. Most likely the four marks were clicked in the wrong order, or the camera or projector moved. Go back to Show the camera the field and click them again." : "")
        : "The camera is not lined up with the field yet. Go back to the step where you click the four marks.");
      if (lost && !fix.isConnected) controls.append(fix);
      if (!lost && fix.isConnected) fix.remove();
      frame = requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }

  // Where a pointer is on the field, 0 to 1 each way, undoing the keystone exactly.
  function fieldAt(e) {
    const corners = loadCalibration().corners.map((c) => ({ x: c.x * innerWidth, y: c.y * innerHeight }));
    return apply(solve(corners, UNIT), { x: e.clientX, y: e.clientY });
  }

  function seatsStep() {
    let layout = asLayout(startLayout) ?? makeLayout({ seats: 3 });
    const field = el("div", "setup-field is-quiet");
    const pads = el("div", "setup-pads");
    const canvas = el("canvas");
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    field.append(pads, canvas);
    layer.append(field);
    applyKeystone(field);
    ctx.say("Drag each pad until it sits at the feet of its seat.");
    ctx.next(true);

    // Every change goes to the stage first. Only what the stage accepts is drawn. A refusal stays until the
    // choice changes or the song ends, whichever comes first.
    let refused = false;
    function commit(next) {
      if (!setLayout(next)) {
        refused = true;
        ctx.error("A song is playing, so the seats cannot change now. Stop the song, then try again.");
        return false;
      }
      refused = false;
      ctx.error("");
      layout = next;
      return true;
    }
    const withRect = (id, rect) => ({ ...layout, spots: layout.spots.map((s) => (s.id === id ? { ...s, rect } : s)) });
    // Keeps a pad inside the field and at least a tenth across and down.
    const fit = ({ u, v, w, h }) => {
      w = Math.min(1, Math.max(MIN_PAD, w));
      h = Math.min(1, Math.max(MIN_PAD, h));
      return { u: Math.min(1 - w, Math.max(0, u)), v: Math.min(1 - h, Math.max(0, v)), w, h };
    };
    const place = (pad, rect) => {
      pad.style.left = `${rect.u * 100}%`;
      pad.style.top = `${rect.v * 100}%`;
      pad.style.width = `${rect.w * 100}%`;
      pad.style.height = `${rect.h * 100}%`;
    };
    const rectOf = (id) => layout.spots.find((s) => s.id === id).rect;
    function drag(e, onMove) {
      e.preventDefault(); // no text selection while dragging
      const move = (ev) => { const p = fieldAt(ev); if (p) onMove(p); };
      const up = () => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); };
      addEventListener("pointermove", move);
      addEventListener("pointerup", up);
      addEventListener("pointercancel", up);
    }

    function build() {
      pads.replaceChildren(...layout.spots.map((spot) => {
        const pad = el("div", "setup-pad");
        pad.style.setProperty("--seat", `var(--seat-${seatNumber(spot.id)})`);
        pad.style.setProperty("--dim", `var(--seat-${seatNumber(spot.id)}-dim)`);
        pad.tabIndex = 0;
        pad.setAttribute("role", "group");
        pad.setAttribute("aria-label", `Seat ${spot.id} pad. Arrow keys move it.`);
        const lanes = el("div", "setup-lanes");
        lanes.append(...Array.from({ length: layout.lanes }, () => el("i", "setup-lane")));
        const grip = el("button", "setup-grip");
        grip.type = "button";
        grip.setAttribute("aria-label", `Resize seat ${spot.id}. Arrow keys change its size.`);
        pad.append(lanes, el("span", "setup-pad-num", String(spot.id)), grip);
        place(pad, spot.rect);

        pad.addEventListener("pointerdown", (e) => {
          if (e.target === grip) return;
          const start = fieldAt(e), r = rectOf(spot.id);
          drag(e, (p) => {
            const rect = fit({ ...r, u: r.u + p.x - start.x, v: r.v + p.y - start.y });
            if (commit(withRect(spot.id, rect))) place(pad, rect);
          });
        });
        grip.addEventListener("pointerdown", (e) => {
          const r = rectOf(spot.id);
          const start = fieldAt(e), at = { x: r.u + r.w - start.x, y: r.v + r.h - start.y }; // where in the corner it was grabbed
          drag(e, (p) => {
            const rect = fit({ ...r, w: p.x + at.x - r.u, h: p.y + at.y - r.v });
            if (commit(withRect(spot.id, rect))) place(pad, rect);
          });
        });
        pad.dataset.id = spot.id;
        return pad;
      }));
    }

    // Arrow keys: the focused pad moves, or with its grip focused it resizes. Shift is a bigger step.
    // Setup holds the keyboard (see onKey), so this goes through ctx.keys.
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    ctx.keys((e) => {
      const d = arrows[e.key];
      const pad = document.activeElement?.closest(".setup-pad");
      if (!d || !pad) return;
      e.preventDefault();
      const id = Number(pad.dataset.id), r = rectOf(id), step = e.shiftKey ? 0.05 : 0.01;
      const resize = document.activeElement.classList.contains("setup-grip");
      const rect = fit(resize ? { ...r, w: r.w + d[0] * step, h: r.h + d[1] * step } : { ...r, u: r.u + d[0] * step, v: r.v + d[1] * step });
      if (commit(withRect(id, rect))) place(pad, rect);
    });

    // A new seat count spaces the pads evenly again. The same count keeps the pads where they are.
    const choose = (seats) => {
      if (seats !== layout.spots.length && commit(makeLayout({ seats }))) { build(); mark(); }
    };
    const options = (label, items) => {
      const group = el("div", "setup-row");
      group.append(el("span", "setup-label", label), ...items);
      return group;
    };
    const countButtons = Array.from({ length: MAX_SEATS }, (_, i) => ({ n: i + 1, b: button(String(i + 1), "is-count", () => choose(i + 1)) }));
    const even = button("Space them evenly", "", () => { if (commit(makeLayout({ seats: layout.spots.length }))) build(); });
    // The button that matches the layout is lit.
    function mark() {
      countButtons.forEach(({ n, b }) => { b.classList.toggle("is-on", n === layout.spots.length); b.setAttribute("aria-pressed", n === layout.spots.length); });
    }
    // Where this floor is, so phones can show which part of the car it is. Saved as it is typed.
    const where = el("input", "setup-select");
    where.type = "text";
    where.value = section ?? "";
    where.maxLength = 30;
    where.setAttribute("aria-label", "Where is this?");
    where.addEventListener("input", () => ctx.error(setSection(where.value) ? "" : "Type where this is, in 30 letters or fewer."));
    controls.replaceChildren(
      options("Seats", [...countButtons.map((x) => x.b), even]),
      options("Where is this?", [where]),
    );
    build();
    mark();

    const g = canvas.getContext("2d");
    const glow = css("--seat-3"), offColor = css("--seat-2");
    const src = source(field);
    const drawCamera = camera ? miniCamera() : null;
    let frame = 0;
    const tick = () => {
      if (refused && !isPlaying?.()) { refused = false; ctx.error(""); } // the song has ended, so the refusal no longer holds
      const list = src.read();
      drawFeet(g, list, glow, offColor);
      drawCamera?.();
      const inside = Object.values(feetBySpot(layout, list)).flat().length;
      ctx.meta(`${list.length} ${list.length === 1 ? "foot" : "feet"} seen, ${inside} inside a pad.`);
      frame = requestAnimationFrame(tick);
    };
    if (camera && !feet.ready().calibrated) ctx.error("The camera is not lined up with the field yet, so no feet show. Go back to the step where you click the four marks.");
    tick();
    return () => cancelAnimationFrame(frame);
  }

  function lagStep() {
    const field = el("div", "setup-field is-quiet");
    const canvas = el("canvas");
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    field.append(canvas);
    layer.append(field);
    applyKeystone(field);
    const g = canvas.getContext("2d");
    const src = source(field);
    const arrived = createArrivals();
    const dim = css("--seat-4-dim"), lit = css("--seat-4"), ring = css("--text");
    const start = button("Start the clicks", "is-primary", run);
    controls.append(start, button("Skip", "is-quiet", close));
    const instruction = "Step onto the square each time you hear a click. There are eight clicks.";
    ctx.say(instruction);
    ctx.meta(offsetMs === undefined ? "" : `The game now waits ${offsetMs} ms for your feet. Skip keeps it.`);

    let beats = [];
    let arrivals = [];
    let flashAt = -Infinity;
    let audio = null;
    let frame = 0;

    // One short click, sounded at the moment of a beat (a performance.now() time).
    function click(beat) {
      const at = audio.currentTime + Math.max(0, beat - performance.now()) / 1000;
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.frequency.value = 1000;
      gain.gain.setValueAtTime(0.4, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.08);
      osc.connect(gain).connect(audio.destination);
      osc.start(at);
      osc.stop(at + 0.1);
    }

    function run() {
      audio ??= new AudioContext();
      audio.resume();
      const first = performance.now() + LEAD_MS;
      beats = Array.from({ length: BEATS }, (_, i) => first + i * BEAT_MS);
      arrivals = [];
      beats.forEach(click);
      start.disabled = true;
      ctx.next(false);
      ctx.say(instruction);
      ctx.error("");
    }

    function finish() {
      const { offsetMs: ms, used } = measureLag(beats, arrivals);
      beats = [];
      ctx.meta("");
      start.disabled = false;
      start.textContent = "Try again";
      if (ms === null) {
        ctx.error(`I only saw ${used} ${used === 1 ? "step" : "steps"}. Stand where the camera sees your feet and try again.`);
        return;
      }
      setOffset(ms);
      ctx.say(`You step about ${ms} ms after the click. Saved.`);
      ctx.meta("");
      ctx.next(true);
    }

    const tick = () => {
      const now = performance.now();
      const w = canvas.width, h = canvas.height;
      const half = (SQUARE.size * h) / 2, cx = SQUARE.u * w, cy = SQUARE.v * h;
      const inSquare = src.read().filter((f) => Math.abs(f.u * w - cx) <= half && Math.abs(f.v * h - cy) <= half).length;
      const stepped = arrived(now, inSquare);
      if (stepped) flashAt = now;
      if (stepped && beats.length) arrivals.push(now);
      if (beats.length && now > beats[BEATS - 1] + BEAT_MS) finish();

      g.clearRect(0, 0, w, h);
      g.lineWidth = h * 0.012;
      g.fillStyle = now - flashAt < 200 ? lit : dim;
      g.strokeStyle = lit;
      g.fillRect(cx - half, cy - half, half * 2, half * 2);
      g.strokeRect(cx - half, cy - half, half * 2, half * 2);
      const next = beats.find((b) => b > now);
      if (next && next - now <= BEAT_MS) { // the ring closes onto the square as the click sounds
        const p = (next - now) / BEAT_MS, r = half * (1 + 1.2 * p);
        g.globalAlpha = 1 - p * 0.6;
        g.strokeStyle = ring;
        g.strokeRect(cx - r, cy - r, r * 2, r * 2);
        g.globalAlpha = 1;
      }
      if (beats.length) ctx.meta(`Click ${Math.min(BEATS, beats.filter((b) => b <= now).length + 1)} of ${BEATS}.`);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(frame); audio?.close(); };
  }

  const STEPS = [
    { name: "Camera", run: cameraStep, camera: true },
    { name: "Straighten the picture", run: straightenStep, centre: true }, // its corner handles sit at the window's corners
    { name: "Show the camera the field", run: fieldStep, camera: true },
    { name: "Place the seats", run: seatsStep },
    { name: "Foot check", run: footStep },
    { name: "Lag test", run: lagStep },
  ].filter((step) => camera || !step.camera);

  const dock = (on) => { root.classList.toggle("is-dock", on); move.hidden = !on; }; // Move only means something while docked

  function go(i) {
    cleanup?.();
    keyHandler = null;
    index = i;
    dock(!STEPS[i].centre); // out of the centre steps, the panel stays small in a corner
    mini.replaceChildren();
    layer.replaceChildren();
    controls.replaceChildren();
    ctx.meta("");
    ctx.error("");
    ctx.next(false);
    count.textContent = `Step ${i + 1} of ${STEPS.length}: ${STEPS[i].name}`;
    back.hidden = i === 0;
    next.textContent = i === STEPS.length - 1 ? "Done" : "Next";
    cleanup = STEPS[i].run() ?? null;
  }

  function close() {
    cleanup?.();
    removeEventListener("keydown", onKey, true);
    root.remove();
    const ready = feet?.ready();
    if (own) { feet.stop(); feet.video?.remove(); } // setup made this camera, so setup takes its hidden video off the page too
    isOpen = false;
    onClose?.(ready);
  }

  go(0);
  return { close }; // so the stage can close setup when a song starts
}
