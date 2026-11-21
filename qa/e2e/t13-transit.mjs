// The transit flow: a train that is too close for a song (live times rewritten so the first train is 12 s away),
// then "Use the next train", then the riding path Kenmore to Park Street. Few live MBTA calls.
import { start, sleep, waitFor, text, shot, joinAndSit } from "./lib.mjs";

const t = await start();
const S = () => t.spy.state;
const view = async (p) => (await text(p)).replace("Platform Piano ", "").slice(0, 260);
try {
  const stage = await t.stage();
  const p1 = await t.phone("p1");
  await joinAndSit(p1, "Ann", 1);
  await p1.setRequestInterception(true);
  let shiftMs = null;
  p1.on("request", async (req) => {
    if (!req.url().includes("/predictions") || !req.url().includes("api-v3.mbta.com") || req.isInterceptResolutionHandled()) return req.continue().catch(() => {});
    if (req.method() === "OPTIONS") return req.respond({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET, OPTIONS" } });
    try {
      const r = await fetch(req.url());
      const j = await r.json();
      const times = j.data.map((d) => Date.parse(d.attributes.arrival_time ?? d.attributes.departure_time)).filter(Boolean);
      if (shiftMs === null && times.length) shiftMs = Date.now() + 12000 - Math.min(...times);
      for (const d of j.data) for (const k of ["arrival_time", "departure_time"]) if (d.attributes[k]) d.attributes[k] = new Date(Date.parse(d.attributes[k]) + shiftMs).toISOString();
      req.respond({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(j) });
    } catch { req.continue().catch(() => {}); }
  });
  await p1.click("[data-act=music]"); await p1.waitForSelector("input.field");
  await p1.type("input.field", "kenmore"); await p1.waitForSelector("[data-stop]", { timeout: 8000 });
  await p1.click("[data-stop]"); await p1.waitForSelector("[data-mode]");
  await p1.click("[data-mode=platform]"); await p1.waitForSelector("[data-train]", { timeout: 8000 });
  console.log("trains:", await view(p1));
  await p1.click("[data-train]"); await sleep(600);
  console.log("too close:", await view(p1));
  await shot(p1, "e1-34-too-close");
  const next = await p1.$("[data-next]");
  if (next) { await next.click(); await sleep(600); console.log("next train:", await view(p1)); await shot(p1, "e1-35-next-train"); }
  // wait: does the set screen cope with the train passing while the screen is open?
  await sleep(14000);
  console.log("14 s later:", await view(p1));
  // Back, then riding: Kenmore to Park Street
  await p1.setRequestInterception(false);
  for (let i = 0; i < 3; i++) { const b = await p1.$("[data-back]"); if (b) { await b.click(); await sleep(250); } }
  await sleep(400);
  console.log("after back x3:", await view(p1));
} catch (e) { console.log("FAILED", e.message, "|", await view(t.browser.pages ? (await t.browser.pages())[2] : null).catch(() => "")); console.log("errors:", t.errors); }
finally { await t.close(); }
