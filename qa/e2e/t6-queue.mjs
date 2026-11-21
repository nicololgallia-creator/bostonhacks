// (4) The queue: two songs back to back, skip, pause then resume, stop, Start tapped five times fast.
import { start, sleep, waitFor, text, shot, joinAndSit } from "./lib.mjs";

const t = await start();
const S = () => t.spy.state;
const pages = [];
const brief = () => `${S()?.status} song=${S()?.song?.title} q=${(S()?.queue ?? []).map((q) => q.title).join("+")} left=${S()?.secondsLeft} notice=${S()?.notice}`;
const view = async (p) => (await text(p)).replace("Platform Piano ", "").slice(0, 150);
const pickSongs = async (page, idxs) => {
  await page.click("[data-act=music]");
  await page.waitForSelector("[data-songs]");
  await page.click("[data-songs]");
  await page.waitForSelector("[data-song]");
  for (const i of idxs) await page.click(`[data-song='${i}']`);
};
try {
  const stage = await t.stage();
  const p1 = await t.phone("p1"), p2 = await t.phone("p2");
  pages.push(p1, p2);
  await joinAndSit(p1, "Ann", 1); await joinAndSit(p2, "Bob", 2);

  // A. two songs back to back, five fast taps on Start
  await pickSongs(p1, [0, 1]);
  await p1.click("[data-start]", { count: 5, delay: 10 });
  await sleep(700);
  console.log("A after 5 fast taps:", brief());
  for (let i = 0; i < 5; i++) t.spy.send({ type: "start", songIds: ["twinkle"], transit: null });
  await sleep(500);
  console.log("A after 5 raw starts while running:", brief());
  await waitFor(() => S()?.status === "results", 60000, "results 1");
  console.log("A results 1:", brief(), "| p2:", await view(p2));
  await waitFor(() => S()?.status === "countdown", 12000, "countdown 2");
  console.log("A song 2:", brief(), "| p2:", await view(p2));

  // B. pause then resume: tiles where they were
  await sleep(6500);
  await shot(stage, "e1-20-before-pause");
  const before = S().secondsLeft;
  await p2.click("[data-pause]"); await sleep(400);
  const paused = S().status;
  await shot(stage, "e1-21-paused-a");
  await sleep(3000);
  await shot(stage, "e1-22-paused-b");
  console.log("B paused:", paused, "left before", before, "after 3.4s paused", S().secondsLeft, "| p1:", await view(p1));
  await p2.click("[data-pause]"); await sleep(300);
  await shot(stage, "e1-23-resumed");
  console.log("B resumed:", brief());

  // C. skip in the last song goes to the lobby; skip, stop, pause in the lobby
  await p1.click("[data-skip]"); await sleep(600);
  console.log("C skip on last song:", brief(), "| p1:", await view(p1));
  t.spy.send({ type: "skip" }); t.spy.send({ type: "pause" }); t.spy.send({ type: "resume" }); t.spy.send({ type: "stop" });
  await sleep(500);
  console.log("C skip/pause/resume/stop in lobby:", brief());

  // D. skip during countdown of song 1 of 2, pause in countdown, stop during pause
  await pickSongs(p1, [0, 1]); await p1.click("[data-start]");
  await waitFor(() => S()?.status === "countdown", 3000, "countdown D");
  await p2.click("[data-pause]"); await sleep(1500);
  console.log("D pause in countdown:", brief());
  await p2.click("[data-pause]"); await sleep(500);
  console.log("D resume:", brief());
  await p1.click("[data-skip]"); await sleep(500);
  console.log("D skip in countdown:", brief());
  await p1.click("[data-stop]"); await p1.click("[data-stop]"); await sleep(600);
  console.log("D stop (2 taps):", brief(), "| p1:", await view(p1));

  // E. skip from results and stop from results
  await pickSongs(p1, [0, 1]); await p1.click("[data-start]");
  await waitFor(() => S()?.status === "results", 60000, "results E");
  t.spy.send({ type: "skip" }); await sleep(500);
  console.log("E skip during results 1:", brief());
  t.spy.send({ type: "stop" }); await sleep(500);
  console.log("E stop:", brief());
  console.log("foreign messages:", (await t.foreign(pages)).join(" "));
  console.log("errors:", t.errors);
} catch (e) { console.log("FAILED", e.message, brief()); console.log("foreign messages:", (await t.foreign(pages)).join(" ")); console.log("foreign messages:", (await t.foreign(pages)).join(" "));
  console.log("errors:", t.errors); }
finally { await t.close(); }

