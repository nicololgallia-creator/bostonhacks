// The landing screen, shown when the app is opened with no room and no train in its address: the name, a live camera view with a
// scan frame, and a quiet way to type the code. A code that is ours moves the app to its own address with the room and the
// train (the scanned link itself is never opened). The camera stops when the screen is left or the tab is hidden, and
// starts again when the tab is back.
import "./scan.css";
import { h, svg, button, mascotMount } from "../parts.js";
import { APP_NAME } from "../after.js";
import { lineOf } from "../lines.js";
import { parseCode, ownAddress, codeProblem } from "../scan.js";
import { cameraPossible, cameraProblem, openCamera, makeReader } from "../scanner.js";

const LOOK_MS = 200;      // how often a frame is read
const NOT_OURS_MS = 3000; // "That is not a TTiles code." stays this long after the last such code
const HIT_MS = 600;       // how long the line and car show before the app moves on
const GO ='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1.5v13l11-6.5z" fill="currentColor"/></svg>';

export default {
  id: "scan",
  step: 0,
  mount() {
    const wantCamera = cameraPossible() && new URLSearchParams(location.search).get("camera") !== "0";
    const video = h("video", "cam");
    video.setAttribute("aria-label", "Camera view");
    const note = h("p", "cam-note", "Starting the camera...");
    const view = h("div", "viewfinder", video, h("div", "frame", h("i"), h("i"), h("i"), h("i")), h("i", "sweep"), note);
    const hit = h("div", "hit");
    view.append(hit);
    const msg = h("p", "scan-msg");
    msg.setAttribute("role", "status");
    const typedOpen = h("button", "done", "No camera? Type the code");
    typedOpen.type = "button";
    const input = h("input", "code-input");
    Object.assign(input, { type: "text", id: "room-code", maxLength: 14, autocomplete: "off", spellcheck: false });
    input.setAttribute("autocapitalize", "characters");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("aria-describedby", "code-msg");
    const label = h("label", "code-label", "Room code");
    label.htmlFor = "room-code";
    const problem = h("p", "scan-msg");
    problem.id = "code-msg";
    problem.setAttribute("role", "alert");
    const join = button("btn", null, "Join", h("span", "go", svg(GO)));
    join.type = "submit";
    const form = h("form", "code-form", label, input, problem, join);
    form.noValidate = true;
    form.hidden = true;
    const el = h("div", "flow scan",
      h("div", "top", h("div", "", h("h1", "ask", "Welcome to ", h("span", "hl", APP_NAME)), h("p", "sub", `Scan a ${APP_NAME} code near you`)), mascotMount("scan")),
      wantCamera ? view : "", msg, form, wantCamera ? h("div", "actions", typedOpen) : "");

    function showForm(say = "") {
      form.hidden = false;
      typedOpen.hidden = true;
      msg.textContent = say; // why there is no camera, above the field; a wrong code is told under it
      input.focus({ preventScroll: true });
    }
    typedOpen.onclick = () => showForm();
    form.onsubmit = (e) => {
      e.preventDefault();
      const why = codeProblem(input.value);
      if (why) { problem.textContent = why; return; }
      location.assign(ownAddress(parseCode(input.value.replace(/[\s-]/g, ""))));
    };
    input.oninput = () => { problem.textContent = ""; };

    // ---- the camera ----
    let stop = null;      // stops the camera that is running
    let timer = 0;
    let gen = 0;          // a start that is overtaken (left, hidden) must not leave a camera on
    let notOurs = 0;
    let reading = false;
    let read = null;

    async function start() {
      if (stop || !wantCamera) return;
      const mine = ++gen;
      view.dataset.on = "starting";
      note.textContent = "Starting the camera...";
      try {
        const [off, reader] = await Promise.all([openCamera(video), read ?? makeReader()]);
        read = reader;
        if (mine !== gen || document.hidden) return off(); // left or hidden while it was starting
        stop = off;
        view.dataset.on = "live";
        timer = setInterval(look, LOOK_MS);
      } catch (e) {
        if (mine !== gen) return;
        view.dataset.on = "off";
        view.hidden = true;
        showForm(cameraProblem(e));
      }
    }
    function halt() {
      gen++;
      clearInterval(timer);
      timer = 0;
      stop?.();
      stop = null;
      if (view.dataset.on === "live") { view.dataset.on = "paused"; note.textContent = "Camera paused. It starts again when you come back."; }
    }
    // A good code: the frame turns the scanned line's colour and names the line and the car for a moment, then the app moves on.
    function celebrate(parts) {
      const line = parts.line ? lineOf(parts.line) : null;
      view.dataset.on = "hit";
      if (line) {
        view.style.setProperty("--hit", line.hero);
        const badge = h("span", "roundel", line.letter);
        badge.style.cssText = `background:${line.badge};color:${line.badgeInk}`;
        hit.replaceChildren(badge, h("div", "", h("b", "", line.name), parts.car ? h("small", "", `Car ${parts.car}`) : ""));
      } else hit.replaceChildren(h("div", "", h("b", "", "Got it")));
      msg.textContent = line ? `Found ${line.name}.` : "Found your room.";
      setTimeout(() => location.assign(ownAddress(parts)), HIT_MS);
    }
    async function look() {
      if (reading || !stop) return;
      reading = true;
      try {
        const text = await read(video);
        if (!text || !stop) return;
        const parts = parseCode(text);
        if (parts) { clearInterval(timer); timer = 0; msg.textContent = ""; clearTimeout(notOurs); celebrate(parts); return; }
        msg.textContent = "That is not a TTiles code.";
        clearTimeout(notOurs);
        notOurs = setTimeout(() => { msg.textContent = ""; }, NOT_OURS_MS);
      } catch { /* a frame that could not be read: the next one is tried */ } finally { reading = false; }
    }
    const onVisible = () => (document.hidden ? halt() : start());
    document.addEventListener("visibilitychange", onVisible);
    if (!wantCamera) showForm(); else if (!document.hidden) start();

    return {
      el,
      destroy() { document.removeEventListener("visibilitychange", onVisible); clearTimeout(notOurs); halt(); },
    };
  },
};
