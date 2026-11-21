// (Sizes) Every phone screen at 360, 390, 768 and 1440 wide: sideways overflow, whether it fits the height,
// and screenshots at 390 and 1440. Raw players fill the other seats so results show four names.
import path from "node:path";
import { start, sleep, waitFor, text, joinAndSit } from "./lib.mjs";

const t = await start();
const S = () => t.spy.state;
const SIZES = [[360, 640], [390, 844], [768, 1024], [1440, 900]];
const small = (name) => path.resolve("shots", `tester-1-${name}.png`);
async function check(p1, label) {
  const row = [];
  for (const [w, h] of SIZES) {
    await p1.setViewport({ width: w, height: h });
    await sleep(250);
    const m = await p1.evaluate(() => {
      const vw = innerWidth, vh = innerHeight;
      const bad = [...document.body.querySelectorAll("*")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > vw + 1 && getComputedStyle(e).display !== "none"; }).length;
      // buttons whose bottom is below the fold, and tap targets under 44px
      const btns = [...document.querySelectorAll("button, input, a")].filter((e) => e.offsetParent !== null || e.getClientRects().length);
      const below = btns.filter((e) => e.getBoundingClientRect().bottom > vh + 1).map((e) => (e.textContent || e.placeholder || e.className).trim().slice(0, 18));
      const small = btns.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 44 || r.width < 44); }).map((e) => `${(e.textContent || e.getAttribute("aria-label") || e.className).trim().slice(0, 12)}:${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
      const inputs = [...document.querySelectorAll("input")].map((e) => parseFloat(getComputedStyle(e).fontSize));
      return { sw: document.documentElement.scrollWidth, vw, bad, below, small, inputs, scrollsY: document.documentElement.scrollHeight > vh + 1 };
    });
    row.push(`${w}: ${m.sw > m.vw ? "SIDEWAYS sw=" + m.sw : "ok"}${m.bad ? ` (${m.bad} out)` : ""}${m.scrollsY ? " scrolls" : ""}${m.below.length ? " below-fold[" + m.below.join(",") + "]" : ""}${m.small.length ? " small[" + m.small.join(",") + "]" : ""}${m.inputs.some((f) => f < 16) ? " INPUT<16px" : ""}`);
    if (w === 390) await p1.screenshot({ path: small(`s-${label}-390`) });
    if (w === 1440) await p1.screenshot({ path: small(`s-${label}-1440`), clip: { x: 0, y: 0, width: 1440, height: 900, scale: 0.6 } });
  }
  console.log(`## ${label}\n  ` + row.join("\n  "));
  await p1.setViewport({ width: 390, height: 844 });
}
try {
  const stage = await t.stage();
  const p1 = await t.phone("p1");
  await p1.setViewport({ width: 390, height: 844 }); await sleep(800); // not isMobile: switching that reloads the page
  await check(p1, "01-name");
  await joinAndSit(p1, "Ann", 1);
  await check(p1, "02-seated");
  t.spy.send({ type: "layout", clientId: "x", posture: "standing", seats: 4 }); await sleep(400);
  for (const [i, n] of [[2, "Wolfgang A."], [3, "ðŸ˜€ðŸ˜€ðŸ˜€ðŸ˜€ðŸ˜€"], [4, "Mmmmmmmmmm"]]) { t.spy.send({ type: "join", clientId: `raw${i}`, name: n }); t.spy.send({ type: "claim", clientId: `raw${i}`, spotId: i }); }
  await sleep(700);
  console.log("players:", S().players.map((p) => `${p.name}@${p.spotId}`).join(", "));
  await check(p1, "03-seated-4");
  await p1.click("[data-act=music]"); await p1.waitForSelector("input.field");
  await check(p1, "04-ride-stop");
  await p1.type("input.field", "ke"); await p1.waitForSelector("[data-stop]", { timeout: 8000 });
  await check(p1, "05-ride-stop-results");
  await p1.click("[data-stop]"); await p1.waitForSelector("[data-mode]");
  await check(p1, "06-ride-mode");
  await p1.click("[data-mode=platform]"); await p1.waitForSelector("[data-train]", { timeout: 8000 });
  await check(p1, "07-ride-trains");
  await p1.click("[data-train]"); await sleep(500);
  await check(p1, "08-ride-set");
  await p1.click("[data-back]"); await p1.click("[data-back]"); await p1.click("[data-back]"); await sleep(300);
  await p1.waitForSelector("[data-songs]"); await p1.click("[data-songs]"); await p1.waitForSelector("[data-song]");
  await p1.click("[data-song='0']"); await p1.click("[data-song='3']");
  await check(p1, "09-ride-songs");
  await p1.click("[data-start]");
  await waitFor(() => S()?.status === "countdown", 4000, "countdown");
  await sleep(5500);
  await check(p1, "10-playing");
  await p1.click("[data-stop]");
  await check(p1, "11-stop-armed");
  await p1.click("[data-pause]"); await sleep(400);
  await check(p1, "12-paused");
  await p1.click("[data-pause]");
  await waitFor(() => S()?.status === "results", 70000, "results");
  await sleep(1200);
  await check(p1, "13-results");
  await waitFor(() => S()?.status === "results" && S().queue.length === 0 ? true : S()?.status !== "results", 12000, "after results");
  await waitFor(() => S()?.status === "lobby", 30000, "lobby");
  await sleep(500);
  await p1.click(".gear");
  await sleep(500);
  await check(p1, "14-settings");
  console.log("errors:", t.errors);
} catch (e) { console.log("FAILED", e.message, S()?.status); console.log("errors:", t.errors); }
finally { await t.close(); }

