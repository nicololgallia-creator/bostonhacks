// Settings on the phone: layout, volume, lag, calibrate; a seat that disappears; settings open when a song starts.
import path from "node:path";
import { start, sleep, waitFor, text, joinAndSit } from "./lib.mjs";

const t = await start();
const S = () => t.spy.state;
const view = async (p) => (await text(p)).replace("Platform Piano ", "").slice(0, 260);
const snap = (p, n) => p.screenshot({ path: path.resolve("shots", `tester-1-${n}.png`) });
try {
  const stage = await t.stage();
  const p1 = await t.phone("p1"), p2 = await t.phone("p2");
  await joinAndSit(p1, "Ann", 3); await joinAndSit(p2, "Bob", 2);
  await p1.click(".gear"); await sleep(500);
  console.log("settings:", await view(p1));
  await snap(p1, "e1-32-settings");
  // 1 seat while Ann sits in 3 and Bob in 2
  await p1.click("[data-seats='1']"); await sleep(600);
  console.log("after 1 seat:", S().layout.spots.length, S().players.map((p) => `${p.name}@${p.spotId}`).join(","), "| p1:", (await view(p1)).slice(0, 120), "| p2:", (await view(p2)).slice(0, 140));
  await p1.click("[data-seats='4']"); await p1.click("[data-posture='standing']"); await sleep(600);
  console.log("standing 4:", S().layout.posture, S().layout.lanes, S().layout.spots.length);
  // volume and lag steps
  for (let i = 0; i < 3; i++) await p1.click("[data-step='volume'][data-by='1']");
  for (let i = 0; i < 3; i++) await p1.click("[data-step='lag'][data-by='-1']");
  await sleep(500);
  console.log("volume/lag:", JSON.stringify(S().settings), "| shown:", await p1.$eval("[data-value=volume]", (e) => e.textContent), await p1.$eval("[data-value=lag]", (e) => e.textContent));
  // press volume + 30 times fast: clamps?
  for (let i = 0; i < 30; i++) await p1.click("[data-step='volume'][data-by='1']", { delay: 0 });
  await sleep(500);
  console.log("volume after 30 more:", S().settings.volume, await p1.$eval("[data-value=volume]", (e) => e.textContent));
  await p1.click("[data-calibrate]"); await sleep(500);
  console.log("calibrate hint:", await p1.$eval("[data-camera]", (e) => e.textContent), "| stage open:", await stage.evaluate(() => !!document.querySelector(".setup")));
  await stage.keyboard.press("Escape"); // does Esc close setup? (not a documented key)
  // someone else starts a song while p1 is in settings
  await p2.click(".pad[data-seat='2']"); await sleep(500);
  await p2.click("[data-act=music]").catch(() => {});
  await p2.waitForSelector("[data-songs]"); await p2.click("[data-songs]"); await p2.waitForSelector("[data-song]"); await p2.click("[data-song='0']"); await p2.click("[data-start]");
  await waitFor(() => S()?.status === "countdown", 4000, "countdown");
  await sleep(800);
  console.log("p1 in settings when song starts:", await view(p1));
  await snap(p1, "e1-33-settings-song-started");
  // 12 seconds into song, settings sliders change lag mid-song via raw message
  await sleep(2000);
  t.spy.send({ type: "set", offsetMs: 400 });
  t.spy.send({ type: "set", volume: 5 });
  t.spy.send({ type: "set", volume: "loud" });
  t.spy.send({ type: "layout", posture: "seated", seats: 2 });
  await sleep(600);
  console.log("mid-song raw set/layout:", JSON.stringify(S().settings), S().layout.spots.length, "notice:", S().notice);
  console.log("errors:", t.errors);
} catch (e) { console.log("FAILED", e.message, S()?.status); console.log("errors:", t.errors); }
finally { await t.close(); }
