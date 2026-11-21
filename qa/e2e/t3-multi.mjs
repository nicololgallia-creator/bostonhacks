// (2) Two and three phones: same seat at the same moment, changing seat, closing a tab mid-song, a late phone.
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
try {
  const stage = await t.stage();
  const p1 = await t.phone("p1"), p2 = await t.phone("p2"), p3 = await t.phone("p3");

  // A. same seat at the same moment
  for (const [p, n] of [[p1, "Ann"], [p2, "Bob"]]) {
    await p.type("#name", n);
    await p.click("form.name button[type=submit]");
  }
  await p1.waitForSelector(".pad[data-state=open]"); await p2.waitForSelector(".pad[data-state=open]");
  await Promise.all([p1.click(".pad[data-seat='2']"), p2.click(".pad[data-seat='2']")]);
  await sleep(1200);
  console.log("A same seat:", players());
  console.log("A p1:", (await text(p1)).slice(0, 160));
  console.log("A p2:", (await text(p2)).slice(0, 160));
  await shot(p2, "e1-10-seat-race");

  // B. change seat
  const loser = (t.spy.state.players.find((p) => p.name === "Ann").spotId === 2) ? p2 : p1;
  await loser.click(".pad[data-seat='3']"); await sleep(500);
  console.log("B after loser picks 3:", players());
  const winner = loser === p1 ? p2 : p1;
  await winner.click("[data-act=change]"); await sleep(300);
  await winner.click(".pad[data-seat='1']"); await sleep(500);
  console.log("B after winner moves to 1:", players());
  await winner.click("[data-act=change]"); await sleep(300);
  await winner.click(".pad[data-seat='3']"); await sleep(500);
  console.log("B winner tries taken seat 3 (pad disabled?):", players(), "|", (await text(winner)).slice(0, 140));

  // C. third phone joins, sits, then song starts; close a tab mid-song; late phone during song
  await joinAndSit(p3, "Cy", 2);
  console.log("C three seated:", players());
  await startByHand(p3, 1);
  await waitFor(() => t.spy.state?.status === "countdown", 4000, "countdown");
  await sleep(4500);
  console.log("C playing:", t.spy.state.status);
  await p2.close();
  await sleep(1500);
  console.log("C after p2 tab closed:", players(), t.spy.state.status);
  const late = await t.phone("late");
  await late.type("#name", "Late"); await late.click("form.name button[type=submit]"); await sleep(800);
  console.log("C late phone during song:", (await text(late)).slice(0, 200));
  await shot(late, "e1-11-late-join");
  await late.reload({ waitUntil: "load" }); await sleep(800);
  console.log("C late reload:", (await text(late)).slice(0, 160));
  // late tries to claim a seat during song by sending raw message
  t.spy.send({ type: "claim", clientId: "late-raw", spotId: 1 });
  await waitFor(() => t.spy.state?.status === "results", 60000, "results");
  console.log("C results players:", JSON.stringify(t.spy.state.players.map((p) => [p.name, p.spotId, p.score])));
  await sleep(1000);
  await shot(p1, "e1-12-results-p1");
  console.log("C results p1:", (await text(p1)).slice(0, 300));
  await waitFor(() => t.spy.state?.status === "lobby", 12000, "lobby");
  await sleep(800);
  console.log("C lobby after:", players());
  console.log("C late sees:", (await text(late)).slice(0, 200));

  // D. ghost seats: a new phone arrives, seats free?
  const fresh = await t.phone("fresh");
  await fresh.type("#name", "Fresh"); await fresh.click("form.name button[type=submit]");
  await sleep(800);
  console.log("D fresh sees seats:", await fresh.$$eval(".pad", (els) => els.map((e) => `${e.dataset.seat}:${e.dataset.state}:${e.querySelector(".who").textContent}`).join(" ")));
  await shot(fresh, "e1-13-ghost-seat");
  console.log("errors:", t.errors);
} catch (e) { console.log("FAILED", e.message); console.log("state:", players(), t.spy.state?.status); console.log("errors:", t.errors); }
finally { await t.close(); }
