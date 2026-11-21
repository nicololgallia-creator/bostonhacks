// (6) Setup on the stage with the mouse source (press C): every step, Back, Close, and setup while a song plays.
import { start, sleep, waitFor, text, joinAndSit } from "./lib.mjs";
import path from "node:path";

const t = await start();
const S = () => t.spy.state;
const clip = { x: 0, y: 0, width: 1280, height: 720, scale: 0.68 };
const snap = (page, n) => page.screenshot({ path: path.resolve("shots", `tester-1-${n}.png`), clip });
const info = (page) => page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const next = [...document.querySelectorAll(".setup-btn")].find((b) => /^(Next|Done)$/.test(b.textContent));
  return { count: q(".setup-count")?.textContent, say: q(".setup-instruction")?.textContent, meta: q(".setup-meta")?.textContent, err: q(".setup-error")?.textContent, next: next ? `${next.textContent}${next.disabled ? " (disabled)" : ""}` : "none", buttons: [...document.querySelectorAll(".setup-btn")].map((b) => b.textContent).join("|"), open: !!q(".setup") };
});
const btn = (page, label) => page.evaluate((l) => { const b = [...document.querySelectorAll(".setup-btn")].find((x) => x.textContent === l); if (!b || b.hidden) return false; if (b.disabled) return "disabled"; b.click(); return true; }, label);
try {
  const stage = await t.stage();
  await stage.setViewport({ width: 1280, height: 720 });
  await sleep(500);
  const p1 = await t.phone("p1");
  await joinAndSit(p1, "Ann", 1);

  await stage.keyboard.press("KeyC"); await sleep(600);
  let i = await info(stage);
  console.log("open:", JSON.stringify(i));
  await snap(stage, "e1-25-setup-step1");
  // drag corner 1 so the step has "worked"
  await stage.mouse.move(28, 28); await stage.mouse.down(); await stage.mouse.move(50, 45, { steps: 5 }); await stage.mouse.up(); await sleep(300);
  console.log("after drag:", JSON.stringify(await info(stage)));
  console.log("saved calibration:", await stage.evaluate(() => localStorage.getItem("pp:calibration")));
  // walk forward through every step
  for (let n = 2; n <= 6; n++) {
    const r = await btn(stage, "Next");
    if (r !== true) { console.log(`Next on step ${n - 1}:`, r); break; }
    await sleep(500);
    i = await info(stage);
    console.log(`step ${n}:`, JSON.stringify(i));
    await snap(stage, `e1-26-setup-step${n}`);
    if (!i.open) break;
  }
  // Back all the way, then Close
  for (let n = 0; n < 5; n++) { const r = await btn(stage, "Back"); if (r !== true) break; await sleep(200); }
  i = await info(stage);
  console.log("after Back x:", i.count);
  console.log("Close:", await btn(stage, "Close setup")); await sleep(400);
  console.log("after close open?", (await info(stage)).open);

  // phone "Line up the camera" -> calibrate
  t.spy.send({ type: "calibrate" }); await sleep(800);
  console.log("after calibrate message open?", (await info(stage)).open);
  await btn(stage, "Close setup"); await sleep(300);

  // setup opened mid-song
  await p1.click("[data-act=music]"); await p1.waitForSelector("[data-songs]"); await p1.click("[data-songs]");
  await p1.waitForSelector("[data-song]"); await p1.click("[data-song='1']"); await p1.click("[data-start]");
  await waitFor(() => S()?.status === "countdown", 4000, "countdown");
  await sleep(4500);
  await stage.keyboard.press("KeyC"); await sleep(600);
  console.log("mid-song setup:", JSON.stringify(await info(stage)));
  await snap(stage, "e1-27-setup-mid-song");
  // seats step: try to change seat count mid song
  await stage.mouse.move(28, 28); await stage.mouse.down(); await stage.mouse.move(40, 40, { steps: 3 }); await stage.mouse.up();
  await btn(stage, "Next"); await sleep(400);
  console.log("seats step mid-song:", JSON.stringify(await info(stage)));
  await snap(stage, "e1-28-setup-seats-mid-song");
  const keysBefore = S().status;
  await stage.keyboard.press("KeyP"); await sleep(300);
  console.log("P inside setup changed status?", keysBefore, "->", S().status);
  await stage.keyboard.press("Escape"); await sleep(300);
  console.log("Esc inside setup stops the song?", S().status, "| setup still open:", (await info(stage)).open);
  // song carries on under the setup panel and ends
  await waitFor(() => S()?.status === "results", 40000, "results under setup");
  console.log("results reached with setup open:", S().status, "| setup open:", (await info(stage)).open);
  await sleep(9500);
  console.log("lobby after:", S().status, "| setup open:", (await info(stage)).open);
  await btn(stage, "Close setup");
  console.log("errors:", t.errors);
} catch (e) { console.log("FAILED", e.message); console.log("errors:", t.errors); }
finally { await t.close(); }

