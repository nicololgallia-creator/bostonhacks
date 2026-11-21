// (3) The link dropping for five seconds. A TCP proxy on :5199 sits in front of the dev server so the
// connection can be cut without restarting (or disturbing) the real one. Stage and phone both go through it.
import net from "node:net";
import { start, sleep, waitFor, text, shot, joinAndSit } from "./lib.mjs";
import * as lib from "./lib.mjs";

const PORT = 5199;
// Only the /link WebSocket is cut. Vite's own reload socket and the page files keep working, because
// Vite reloads a page by itself when its own socket comes back, which would hide what the link does.
const links = new Set();
let down = false;
let server;
const listen = () => new Promise((res) => {
  server = net.createServer((c) => {
    const up = net.connect(5173, "localhost");
    up.on("error", () => {}); c.on("error", () => {});
    let first = true;
    c.on("data", (d) => {
      if (first) {
        first = false;
        if (d.toString("latin1", 0, 12).startsWith("GET /link")) {
          if (down) { c.destroy(); up.destroy(); return; }
          links.add(c); links.add(up);
        }
      }
      if (!up.destroyed) up.write(d);
    });
    up.on("data", (d) => { if (!c.destroyed) c.write(d); });
    c.on("close", () => up.destroy()); up.on("close", () => c.destroy());
  });
  server.listen(PORT, res);
});
const cut = () => { down = true; for (const s of links) s.destroy(); links.clear(); };
const restore = () => { down = false; };
await listen();
const t = await start();
const S = () => t.spy.state;
const view = async (p) => `[banner ${await p.$eval("#status", (e) => e.hasAttribute("data-show") ? "SHOWN: " + e.textContent.trim() : "hidden")}] ` + (await text(p)).replace("Platform Piano ", "").slice(0, 100);
try {
  const ctx = await t.browser.createBrowserContext();
  const stage = await ctx.newPage();
  await stage.setViewport({ width: 880, height: 495 });
  stage.on("pageerror", (e) => t.errors.push("stage PAGEERROR " + e.message));
  stage.on("console", (m) => { if (m.type() === "error") t.errors.push("stage: " + m.text()); });
  await stage.goto(`http://localhost:${PORT}/stage.html?feet=mouse`, { waitUntil: "load" });
  const pctx = await t.browser.createBrowserContext();
  const p1 = await pctx.newPage();
  await p1.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  p1.on("pageerror", (e) => t.errors.push("p1 PAGEERROR " + e.message));
  p1.on("console", (m) => { if (m.type() === "error") t.errors.push("p1: " + m.text()); });
  await p1.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
  await sleep(600);
  await joinAndSit(p1, "Ann", 2);
  console.log("0:", S()?.players?.map((p) => `${p.name}@${p.spotId}`));

  // A. cut for 5 s in the lobby
  cut();
  await sleep(2500);
  console.log("A phone at 2.5 s down:", await view(p1));
  await shot(p1, "e1-24-link-down");
  await sleep(2500);
  restore();
  await sleep(3500);
  console.log("A after recovery:", await view(p1), "| players:", S()?.players?.map((p) => `${p.name}@${p.spotId}`));

  // B. cut for 5 s in a song
  await p1.click("[data-act=music]"); await p1.waitForSelector("[data-songs]"); await p1.click("[data-songs]");
  await p1.waitForSelector("[data-song]"); await p1.click("[data-song='1']"); await p1.click("[data-start]");
  await waitFor(() => S()?.status === "countdown", 4000, "countdown");
  await sleep(4500);
  cut();
  await sleep(5000);
  console.log("B phone while down:", await view(p1));
  restore();
  await sleep(3500);
  console.log("B after recovery:", S()?.status, S()?.secondsLeft, "| phone:", await view(p1));
  await waitFor(() => S()?.status === "results", 40000, "results");
  console.log("B results ok; players:", S()?.players?.map((p) => `${p.name}@${p.spotId}:${p.score}`));
  console.log("errors:", t.errors);
} catch (e) { console.log("FAILED", e.message); console.log("errors:", t.errors); }
finally { await t.close(); server.close(); }


