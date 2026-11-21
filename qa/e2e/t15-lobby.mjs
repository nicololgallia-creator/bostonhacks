// The projected lobby at 1280x720 with three and four seats: does the QR code touch the pads?
import path from "node:path";
import { start, sleep } from "./lib.mjs";

const t = await start();
try {
  const stage = await t.stage();
  await stage.setViewport({ width: 1280, height: 720 });
  await sleep(600);
  const clip = { x: 0, y: 0, width: 1280, height: 720, scale: 0.68 };
  await stage.screenshot({ path: path.resolve("shots", "tester-1-e1-37-lobby-3-1280.png"), clip });
  t.spy.send({ type: "layout", posture: "standing", seats: 4 });
  for (const i of [1, 2, 3, 4]) { t.spy.send({ type: "join", clientId: `raw${i}`, name: `Player ${i}` }); t.spy.send({ type: "claim", clientId: `raw${i}`, spotId: i }); }
  await sleep(800);
  await stage.screenshot({ path: path.resolve("shots", "tester-1-e1-38-lobby-4-1280.png"), clip });
  console.log("errors:", t.errors);
} finally { await t.close(); }
