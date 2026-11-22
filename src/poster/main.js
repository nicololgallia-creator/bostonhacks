// The poster's train comes from its own address, and its QR code sends a phone to that train:
//   poster.html?line=Green-B&dir=1&at=place-bucen&car=2&base=https://<site>
// The code holds <base>/?line=..&dir=..&at=..&car=.. With no base it uses this page's own origin.
// A missing value falls back to the same train the stage falls back to.
import { create as createQr } from "qrcode";
import { BUTTER, lineOf } from "../app/lines.js";

const params = new URLSearchParams(location.search);
const train = {
  line: params.get("line") || "Green-B",
  dir: params.get("dir") || "1",
  at: params.get("at") || "place-bucen",
  car: params.get("car") || "2",
};

// Where the code points. A base that is not a web address is refused with the reason, and the page's own origin is used.
function target() {
  const query = new URLSearchParams(train).toString();
  const base = params.get("base");
  if (!base) return { href: `${location.origin}/?${query}`, problem: null };
  try {
    const url = new URL(base);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("not a web address");
    return { href: `${url.origin}${url.pathname.replace(/\/$/, "")}/?${query}`, problem: null };
  } catch {
    return {
      href: `${location.origin}/?${query}`,
      problem: `The base "${base}" is not a web address, so the code points at this page's own site. Use base=https://your-site.`,
    };
  }
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
document.title = `Platform Piano poster: ${line.name}, car ${train.car}`;

const { href, problem } = target();
const qr = document.getElementById("qr");
qr.innerHTML = qrSvg(href);
qr.dataset.href = href; // the address in the code, for checks
if (problem) {
  const note = document.getElementById("problem");
  note.textContent = problem;
  note.hidden = false;
}
