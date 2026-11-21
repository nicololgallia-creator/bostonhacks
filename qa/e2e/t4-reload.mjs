// (3) Reloads: stage in the lobby, during a song and during results; a phone mid-song.
import { start, sleep, waitFor, text, shot, joinAndSit } from "./lib.mjs";

const t = await start();
const players = () => (t.spy.state?.players ?? []).map((p) => `${p.name}@${p.spotId ?? "-"}`).join(", ");
const startByHand = async (page, idx = 0) => {
  await page.click("[data-act=music]");
  await page.waitForSelector("[data-songs]");
  await page.click("[data-songs]");
  await page.waitForSelector("[data-song]");
  await page.click(`[data-song='${idx}']`);
  await page.click("[data-start]");
};
const view = async (p) => (await text(p)).replace("Platform Piano ", "").slice(0, 170);
try {
  const stage = await t.stage();
  const p1 = await t.phone("p1"), p2 = await t.phone("p2");
  await joinAndSit(p1, "Ann", 1); await joinAndSit(p2, "Bob", 3);
  console.log("0 seated:", players());

  // A. stage reload in lobby
  await stage.reload({ waitUntil: "load" }); await sleep(3500);
  console.log("A lobby reload players:", players(), "|", t.spy.state?.status);
  console.log("A p1:", await view(p1)); console.log("A p2:", await view(p2));
  await shot(p1, "e1-14-after-stage-reload");
  await p1.click(".pad[data-seat='1']").catch(() => {}); await p2.click(".pad[data-seat='3']").catch(() => {});
  await sleep(600);
  console.log("A after re-sit:", players());

  // B. stage reload during a song
  await startByHand(p1, 1);
  await waitFor(() => t.spy.state?.status === "countdown", 4000, "countdown");
  await sleep(5000);
  console.log("B before reload:", t.spy.state?.status, players());
  await stage.reload({ waitUntil: "load" }); await sleep(3500);
  console.log("B after stage reload:", t.spy.state?.status, players());
  console.log("B p1:", await view(p1));
  console.log("B p2:", await view(p2));
  await shot(p2, "e1-15-mid-song-stage-reload");

  // C. phone reload mid-song (seat first again, then start)
  await p1.click(".pad[data-seat='1']").catch(() => {}); await p2.click(".pad[data-seat='3']").catch(() => {});
  await sleep(500);
  console.log("C seats:", players());
  await startByHand(p1, 1);
  await waitFor(() => t.spy.state?.status === "countdown", 4000, "countdown C");
  await sleep(5000);
  await p2.reload({ waitUntil: "load" }); await sleep(1500);
  console.log("C p2 after own reload mid-song:", await view(p2));
  console.log("C players:", players(), t.spy.state?.status);
  // D. stage reload during results
  await waitFor(() => t.spy.state?.status === "results", 60000, "results");
  await sleep(1500);
  await stage.reload({ waitUntil: "load" }); await sleep(3500);
  console.log("D after results reload:", t.spy.state?.status, players());
  console.log("D p1:", await view(p1)); console.log("D p2:", await view(p2));
  console.log("errors:", t.errors);
} catch (e) { console.log("FAILED", e.message); console.log("errors:", t.errors); }
finally { await t.close(); }
