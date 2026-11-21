// (1) The demo path: platform set from live Kenmore data, then songs by hand through to results.
import { start, sleep, waitFor, text, shot, joinAndSit } from "./lib.mjs";

const t = await start();
const states = () => `${t.spy.state?.status} left=${t.spy.state?.secondsLeft} song=${t.spy.state?.song?.title} q=${t.spy.state?.queue?.length} transit=${JSON.stringify(t.spy.state?.transit)}`;
try {
  const stage = await t.stage();
  const p1 = await t.phone("p1");
  await joinAndSit(p1, "Nico", 1);

  // --- A. platform set from live Kenmore data
  await p1.click("[data-act=music]");
  await p1.waitForSelector("input.field");
  await p1.type("input.field", "kenm");
  await p1.waitForSelector("[data-stop]", { timeout: 8000 });
  await shot(p1, "e1-04-stop-search");
  await p1.click("[data-stop]");
  await p1.waitForSelector("[data-mode=platform]");
  await p1.click("[data-mode=platform]");
  await p1.waitForSelector("[data-train]", { timeout: 8000 });
  await shot(p1, "e1-05-trains");
  console.log("trains:", (await text(p1)).slice(0, 300));
  await p1.click("[data-train]");
  await sleep(500);
  await shot(p1, "e1-06-set");
  console.log("set:", (await text(p1)).slice(0, 300));
  if (await p1.$("[data-start]")) {
    await p1.click("[data-start]");
    await waitFor(() => t.spy.state?.status === "countdown", 4000, "countdown");
    console.log("after start:", states());
    await sleep(6000);
    await shot(p1, "e1-07-playing");
    await shot(stage, "e1-stage-playing");
    console.log("phone playing:", (await text(p1)).slice(0, 300));
    console.log("state:", states());
    // stop with two taps
    await p1.click("[data-stop]");
    await sleep(300);
    console.log("after 1 tap:", t.spy.state?.status, "|", await p1.$eval("[data-stop]", (e) => e.textContent));
    await p1.click("[data-stop]");
    await waitFor(() => t.spy.state?.status === "lobby", 3000, "lobby");
    console.log("after 2 taps:", states());
  } else console.log("no start button (train too close?)");

  // --- B. songs by hand, to results
  await sleep(500);
  await p1.waitForSelector("[data-act=music]");
  await p1.click("[data-act=music]");
  await p1.waitForSelector("[data-songs]");
  await p1.click("[data-songs]");
  await p1.waitForSelector("[data-song]");
  await p1.click("[data-song='0']");
  await shot(p1, "e1-08-songs");
  console.log("by hand:", (await text(p1)).slice(0, 200));
  await p1.click("[data-start]");
  await waitFor(() => t.spy.state?.status === "countdown", 4000, "countdown 2");
  console.log("started:", states());
  // click some tiles on the stage as a foot (seat 1 pad)
  for (let i = 0; i < 12; i++) { await stage.mouse.click(120 + (i % 3) * 120, 560); await sleep(900); }
  await shot(stage, "e1-stage-mid");
  console.log("score mid:", JSON.stringify(t.spy.state?.players));
  await waitFor(() => t.spy.state?.status === "results", 60000, "results");
  await sleep(1000);
  await shot(p1, "e1-09-results");
  await shot(stage, "e1-stage-results");
  console.log("results phone:", (await text(p1)).slice(0, 400));
  await waitFor(() => t.spy.state?.status === "lobby", 12000, "back to lobby");
  await sleep(600);
  console.log("after results:", states(), "|", (await text(p1)).slice(0, 120));
  console.log("errors:", t.errors);
} catch (e) { console.log("FAILED", e.message); console.log("errors:", t.errors); await shot(p1ShotTarget(), "fail").catch(() => {}); }
finally { await t.close(); }
function p1ShotTarget() { return null; }
