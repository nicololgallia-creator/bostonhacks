// (6, part 2) Setup seats step while a song plays, then the lag test with mouse clicks.
import { start, sleep, waitFor, joinAndSit } from "./lib.mjs";

const t = await start();
const S = () => t.spy.state;
const info = (page) => page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  return { count: q(".setup-count")?.textContent, say: q(".setup-instruction")?.textContent, meta: q(".setup-meta")?.textContent, err: q(".setup-error")?.textContent, buttons: [...document.querySelectorAll(".setup-btn")].filter((b) => !b.hidden).map((b) => b.textContent + (b.disabled ? "(off)" : "")).join("|"), open: !!q(".setup") };
});
const btn = (page, label) => page.evaluate((l) => { const b = [...document.querySelectorAll(".setup-btn")].find((x) => x.textContent === l && !x.hidden); if (!b) return false; if (b.disabled) return "disabled"; b.click(); return true; }, label);
try {
  const stage = await t.stage();
  await stage.setViewport({ width: 1280, height: 720 });
  const p1 = await t.phone("p1");
  await joinAndSit(p1, "Ann", 1);
  await p1.click("[data-act=music]"); await p1.waitForSelector("[data-songs]"); await p1.click("[data-songs]");
  await p1.waitForSelector("[data-song]"); await p1.click("[data-song='1']"); await p1.click("[data-start]");
  await waitFor(() => S()?.status === "countdown", 4000, "countdown");
  await sleep(2000);
  await stage.keyboard.press("KeyC"); await sleep(500);
  await stage.mouse.move(28, 28); await stage.mouse.down(); await stage.mouse.move(40, 40, { steps: 3 }); await stage.mouse.up();
  await btn(stage, "Next"); await sleep(400);
  console.log("mid-song, choose Standing:", await btn(stage, "Standing (4 lanes)")); await sleep(500);
  console.log("after:", JSON.stringify(await info(stage)));
  console.log("state layout:", S().layout.posture, S().layout.spots.length, "| localStorage layout:", await stage.evaluate(() => JSON.parse(localStorage.getItem("pp:layout")).posture));
  await btn(stage, "4"); await sleep(400);
  console.log("choose 4 seats mid-song:", JSON.stringify(await info(stage)), "state spots:", S().layout.spots.length);
  // phone shows what?
  await waitFor(() => S()?.status === "lobby" || S()?.status === "results", 40000, "end");
  await waitFor(() => S()?.status === "lobby", 12000, "lobby");
  console.log("after song, setup:", JSON.stringify(await info(stage)));
  // lag test: Next x2, then Start the clicks and click the square
  await btn(stage, "Standing (4 lanes)"); await sleep(300);
  console.log("lobby choose Standing:", S().layout.posture, S().layout.lanes, "players:", S().players.map((p) => `${p.name}@${p.spotId}`));
  await btn(stage, "Next"); await sleep(300); await btn(stage, "Next"); await sleep(400);
  console.log("lag step:", JSON.stringify(await info(stage)));
  console.log("start clicks:", await btn(stage, "Start the clicks"));
  await sleep(1700);
  for (let i = 0; i < 10; i++) { await stage.mouse.click(640, 520); await sleep(600); }
  await sleep(800);
  console.log("lag result:", JSON.stringify(await info(stage)), "| offset in state:", S().settings.offsetMs);
  console.log("errors:", t.errors);
} catch (e) { console.log("FAILED", e.message); console.log("errors:", t.errors); }
finally { await t.close(); }
