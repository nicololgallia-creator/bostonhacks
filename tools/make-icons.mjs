// Makes the app icons, the tab icon and the manifest from the real conductor file.
//   node tools/make-icons.mjs
// Writes public/icons/*.png, public/favicon.svg and public/manifest.webmanifest. The conductor is
// never redrawn: his own SVG is drawn onto the half-way green, and the tab icon reuses his own
// head, face and cap shapes cropped with a viewBox. Run it again after the app name changes.
import fs from "node:fs";
import { launch } from "./browser.mjs";

const GREEN = "#4FAF79"; // HERO.green in src/app/lines.js
const PAPER = "#FFFFFF"; // the app page's own background (--paper in src/app/app.css)
const SAFE = 0.7;        // the conductor stays inside the middle 70%: a circle mask cuts at 80%
const ROUND = 0.22;      // corner radius of the plain icons, as a share of the side

const mascot = fs.readFileSync("public/mascot/conductor.svg", "utf8");
const appName = /APP_NAME = "([^"]+)"/.exec(fs.readFileSync("src/app/after.js", "utf8"))?.[1];
if (!appName) throw new Error("APP_NAME not found in src/app/after.js");

// favicon.svg: the head, face and cap groups copied out of the real file, on the green.
const part = (re) => { const m = re.exec(mascot); if (!m) throw new Error(`conductor.svg has no ${re}`); return m[0]; };
const head = [part(/<path id="body"[^>]*\/>/), part(/<g id="face">[\s\S]*?<\/g>/), part(/<g id="cap">[\s\S]*?<\/g>/)].join("\n  ");
const FAV = { x: 40, y: 6, side: 240 };
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${FAV.x} ${FAV.y} ${FAV.side} ${FAV.side}">
  <rect x="${FAV.x}" y="${FAV.y}" width="${FAV.side}" height="${FAV.side}" rx="${FAV.side * ROUND}" fill="${GREEN}"/>
  ${head}
</svg>
`;
fs.mkdirSync("public/icons", { recursive: true });
fs.writeFileSync("public/favicon.svg", favicon);

const browser = await launch();
try {
  const page = await browser.newPage();
  const draw = async (html, size, file) => {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${html}`);
    await page.screenshot({ path: file, omitBackground: true });
  };

  // Where the conductor really sits in his 320 x 380 box, strokes included, measured from his pixels.
  await page.setViewport({ width: 1280, height: 1520, deviceScaleFactor: 1 });
  const box = await page.evaluate(async (svg) => {
    const img = new Image();
    img.src = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
    await img.decode();
    const k = 4, c = Object.assign(document.createElement("canvas"), { width: 320 * k, height: 380 * k });
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0, c.width, c.height);
    const { data } = g.getImageData(0, 0, c.width, c.height);
    let x0 = c.width, x1 = 0, y0 = c.height, y1 = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    }
    return { x0: x0 / k, x1: (x1 + 1) / k, y0: y0 / k, y1: (y1 + 1) / k };
  }, mascot);
  const bw = box.x1 - box.x0, bh = box.y1 - box.y0;

  const conductor = (size) => {
    const s = (SAFE * size) / Math.max(bw, bh);
    const left = size / 2 - ((box.x0 + box.x1) / 2) * s, top = size / 2 - ((box.y0 + box.y1) / 2) * s;
    return `<div style="position:absolute;left:${left}px;top:${top}px;width:${320 * s}px;height:${380 * s}px">${mascot.replace("<svg ", '<svg width="100%" height="100%" ')}</div>`;
  };
  const tile = (size, radius) =>
    `<div style="position:relative;width:${size}px;height:${size}px;overflow:hidden;background:${GREEN};border-radius:${radius}px">${conductor(size)}</div>`;

  await draw(tile(192, 192 * ROUND), 192, "public/icons/icon-192.png");
  await draw(tile(512, 512 * ROUND), 512, "public/icons/icon-512.png");
  await draw(tile(512, 0), 512, "public/icons/icon-maskable-512.png");
  await draw(tile(180, 0), 180, "public/icons/apple-touch-icon.png");
  await draw(`<img src="data:image/svg+xml;utf8,${encodeURIComponent(favicon)}" width="32" height="32" style="display:block">`, 32, "public/icons/favicon-32.png");
} finally {
  await browser.close();
}

const icon = (src, size, purpose) => ({ src, sizes: `${size}x${size}`, type: "image/png", purpose });
fs.writeFileSync("public/manifest.webmanifest", JSON.stringify({
  name: appName,
  short_name: appName,
  description: "Play a song on the floor of a train car, with your feet, together.",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: PAPER,
  theme_color: GREEN,
  icons: [
    icon("/icons/icon-192.png", 192, "any"),
    icon("/icons/icon-512.png", 512, "any"),
    icon("/icons/icon-maskable-512.png", 512, "maskable"),
  ],
}, null, 2) + "\n");
console.log(`icons, favicon.svg and manifest written for "${appName}"`);
