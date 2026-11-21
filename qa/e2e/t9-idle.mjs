// (7) The stage alone in the lobby for two minutes, with one phone seated: errors, heap, DOM nodes, frames a second.
import { start, sleep, joinAndSit } from "./lib.mjs";

const t = await start();
try {
  const stage = await t.stage();
  const p1 = await t.phone("p1");
  await joinAndSit(p1, "Ann", 1);
  const cdp = await stage.createCDPSession();
  await cdp.send("Performance.enable");
  await stage.evaluate(() => { window.__f = 0; const loop = () => { window.__f++; requestAnimationFrame(loop); }; loop(); });
  const sample = async () => {
    const m = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]));
    const f0 = await stage.evaluate(() => window.__f); await sleep(1000); const f1 = await stage.evaluate(() => window.__f);
    return `heap ${(m.JSHeapUsedSize / 1e6).toFixed(1)} MB, nodes ${m.Nodes}, listeners ${m.JSEventListeners}, fps ${f1 - f0}`;
  };
  await cdp.send("HeapProfiler.collectGarbage");
  console.log("t=0s   ", await sample());
  const states0 = t.spy.states;
  for (let s = 20; s <= 120; s += 20) {
    await sleep(19000);
    await cdp.send("HeapProfiler.collectGarbage");
    console.log(`t=${s}s`.padEnd(7), await sample());
  }
  console.log("states received by spy in 2 min:", t.spy.states - states0, "(expect about 240)");
  console.log("phone still fine:", await p1.$eval("#status", (e) => e.hasAttribute("data-show") ? e.textContent.trim() : "no banner"));
  console.log("errors:", t.errors);
} catch (e) { console.log("FAILED", e.message); console.log("errors:", t.errors); }
finally { await t.close(); }
