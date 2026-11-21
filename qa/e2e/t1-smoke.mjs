// One stage, one phone: join, sit, pick songs by hand, start, and watch the State to results.
import { start, sleep, waitFor, text, shot, joinAndSit } from "./lib.mjs";

const t = await start();
try {
  const stage = await t.stage();
  const p1 = await t.phone("p1");
  await shot(p1, "e1-01-name");
  await joinAndSit(p1, "Nico", 2);
  await shot(p1, "e1-02-seated");
  console.log("seated text:", (await text(p1)).slice(0, 200));
  await p1.click("[data-act=music]");
  await sleep(600);
  await shot(p1, "e1-03-ride");
  console.log("ride text:", (await text(p1)).slice(0, 300));
  console.log("state:", t.spy.state?.status, t.spy.state?.players?.map((p) => `${p.name}@${p.spotId}`));
  console.log("errors:", t.errors);
} finally { await t.close(); }
