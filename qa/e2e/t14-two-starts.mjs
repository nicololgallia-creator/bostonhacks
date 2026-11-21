// Two players both tap Start at the same moment. The loser's refusal is the stage's one shared notice.
import { start, sleep, waitFor, text, shot, joinAndSit } from "./lib.mjs";

const t = await start();
const S = () => t.spy.state;
const banner = (p) => p.$eval("#status", (e) => (e.hasAttribute("data-show") ? "SHOWN: " + e.textContent.trim() : "hidden"));
const ready = async (p) => {
  await p.click("[data-act=music]"); await p.waitForSelector("[data-songs]"); await p.click("[data-songs]");
  await p.waitForSelector("[data-song]"); await p.click("[data-song='1']");
};
try {
  const stage = await t.stage();
  const p1 = await t.phone("p1"), p2 = await t.phone("p2");
  await joinAndSit(p1, "Ann", 1); await joinAndSit(p2, "Bob", 2);
  await ready(p1); await ready(p2);
  await Promise.all([p1.click("[data-start]"), p2.click("[data-start]")]);
  await waitFor(() => S()?.status === "countdown", 4000, "countdown");
  for (const s of [1, 6, 14, 22]) {
    await sleep(s === 1 ? 1000 : (s - [1, 6, 14, 22][[1, 6, 14, 22].indexOf(s) - 1]) * 1000);
    console.log(`t+${s}s status=${S().status} notice=${JSON.stringify(S().notice)} | p1 banner ${await banner(p1)} | p2 banner ${await banner(p2)}`);
    if (s === 6) await shot(p1, "e1-36-stale-notice");
  }
  console.log("errors:", t.errors);
} catch (e) { console.log("FAILED", e.message); }
finally { await t.close(); }
