// The poster's train comes from its own address, and its QR code sends a phone to that train:
//   poster.html?room=GREENB22&line=Green-B&dir=1&at=place-bucen&car=2
// The code holds https://ttiles.us/?room=..&line=..&dir=..&at=..&car=.. (base= points it elsewhere).
// A missing value falls back to the same train the stage falls back to.
import { create as createQr } from "qrcode";
import { BUTTER, lineOf } from "../app/lines.js";
import { isRoom } from "../link-relay.js";

const params = new URLSearchParams(location.search);
const train = {
  line: params.get("line") || "Green-B",
  dir: params.get("dir") || "1",
  at: params.get("at") || "place-bucen",
  car: params.get("car") || "2",
};

// The phone page on the web. A printed code must never point at a laptop, so this is where it goes unless base= says otherwise.
const LIVE = "https://ttiles.us";
// The room is how a phone on the web reaches this car's floor (the relay, see src/link.js). A printed poster cannot hold a
// random one, so each car has a fixed code: the poster gets &room=XXXXXXXX and the stage is opened with the same ?room=.
const room = params.get("room")?.toUpperCase();

// Where the code points: the room first, then the train. Each thing wrong is said on the page (on screen only, not in print).
function target() {
  const query = new URLSearchParams(isRoom(room) ? { room, ...train } : train).toString();
  const problems = [];
  if (!isRoom(room)) problems.push("This poster has no room code, so a phone that scans it cannot reach the floor. Add &room= and 8 characters (A to Z and 2 to 9, without I, O, 0 or 1), for example &room=GREENB22, and open the stage with the same ?room=.");
  let site = LIVE;
  const base = params.get("base");
  if (base) {
    try {
      const url = new URL(base);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("not a web address");
      site = `${url.origin}${url.pathname.replace(/\/$/, "")}`;
    } catch {
      problems.push(`The base "${base}" is not a web address, so the code points at ${LIVE}. Use base=https://your-site.`);
    }
  }
  return { href: `${site}/?${query}`, problem: problems.join(" ") || null };
}

// The code as one SVG path, so it prints sharp at any size.
function qrSvg(text) {
  const { size, data } = createQr(text, { errorCorrectionLevel: "M" }).modules;
  let d = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) if (data[y * size + x]) d += `M${x} ${y}h1v1h-1z`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" aria-hidden="true"><path d="${d}" fill="#141413"/></svg>`;
}

const line = lineOf(train.line);
const root = document.documentElement.style;
root.setProperty("--c", line.hero);
root.setProperty("--butter", BUTTER);
root.setProperty("--badge", line.badge);
root.setProperty("--badge-ink", line.badgeInk);

document.getElementById("badge").textContent = line.letter;
document.getElementById("line").textContent = line.name;
document.getElementById("car").textContent = `Car ${train.car}`;
document.title = `TTiles poster: ${line.name}, car ${train.car}`;

const { href, problem } = target();
const qr = document.getElementById("qr");
qr.innerHTML = qrSvg(href);
qr.dataset.href = href; // the address in the code, for checks
if (problem) {
  const note = document.getElementById("problem");
  note.textContent = problem;
  note.hidden = false;
}
