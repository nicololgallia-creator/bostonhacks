// (4) Hammer: fast taps, browser Back, reload halfway, slow network, offline during the stop search.
import { start, sleep, waitFor, text, shot, joinAndSit } from "./lib.mjs";

const t = await start();
const S = () => t.spy.state;
const players = () => (S()?.players ?? []).map((p) => `${p.name}@${p.spotId ?? "-"}`).join(", ");
const view = async (p) => (await text(p)).replace("Platform Piano ", "").slice(0, 200);
try {
  const stage = await t.stage();
  const p1 = await t.phone("p1");

  // A. Join tapped three times fast, seat double-tapped, change-seat spam
  await p1.type("#name", "Ann");
  await p1.click("form.name button[type=submit]", { count: 3, delay: 5 });
  await sleep(600);
  console.log("A join x3:", players());
  console.log("A phone shows:", await view(p1));
  await shot(p1, "e1-31-join-triple-tap");
  for (let i = 0; i < 6; i++) {
    await p1.click("[data-act=change]").catch(() => {});
    await p1.click(`.pad[data-seat='${(i % 3) + 1}']`).catch(() => {});
    await sleep(450);
  }
  await p1.click("[data-act=stay]").catch(() => {});
  await sleep(700);
  console.log("A change-seat spam:", players());

  // B. browser Back inside the ride flow, reload halfway
  await p1.click("[data-act=music]").catch((e) => console.log("music btn:", e.message));
  await p1.waitForSelector("input.field");
  console.log("B history length:", await p1.evaluate(() => history.length));
  await p1.type("input.field", "park");
  await p1.waitForSelector("[data-stop]", { timeout: 8000 });
  await p1.click("[data-stop]");
  await p1.waitForSelector("[data-mode]");
  await p1.goBack().catch((e) => console.log("goBack:", e.message));
  await sleep(800);
  console.log("B after browser Back:", p1.url(), "|", await view(p1));
  await p1.goto("http://localhost:5173/", { waitUntil: "load" }); await sleep(1200);
  console.log("B reopened:", players(), "|", await view(p1));
  await p1.click("[data-act=music]");
  await p1.waitForSelector("input.field");
  console.log("B ride after reload, last stop offered:", await view(p1));
  await p1.reload({ waitUntil: "load" }); await sleep(1000);
  console.log("B reload halfway:", await view(p1));

  // C. slow network: Slow 3G on the phone, open stop search
  const cdp = await p1.createCDPSession();
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 800, downloadThroughput: 50 * 1024, uploadThroughput: 20 * 1024 });
  await p1.click("[data-act=music]");
  await p1.waitForSelector("input.field");
  await p1.type("input.field", "ken");
  let t0 = Date.now();
  await sleep(1500);
  console.log("C slow net at 1.5 s:", await view(p1));
  await shot(p1, "e1-29-slow-net");
  await p1.waitForSelector("[data-stop]", { timeout: 30000 });
  console.log("C stops appeared after", Date.now() - t0, "ms");
  // D. offline while picking a train
  await p1.click("[data-stop]"); await p1.waitForSelector("[data-mode]");
  await cdp.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await p1.click("[data-mode=platform]");
  await sleep(2500);
  console.log("D offline trains:", await view(p1));
  await shot(p1, "e1-30-offline-trains");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  const retry = await p1.$("[data-retry]");
  if (retry) { await retry.click(); await sleep(3000); console.log("D after Try again:", await view(p1)); }
  else { await sleep(22000); console.log("D after 22 s auto refresh:", await view(p1)); }
  console.log("errors:", t.errors.filter((e) => !/Failed to load resource|ERR_/.test(e)));
} catch (e) { console.log("FAILED", e.message); console.log("errors:", t.errors); }
finally { await t.close(); }


