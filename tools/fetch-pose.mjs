// Puts the pose model and its runtime in public/mediapipe so tracking works with no internet (the T has none).
// Runs after every npm install. Safe to run again: it skips what is already there.
import fs from "node:fs";
import path from "node:path";

const out = path.resolve("public/mediapipe");
const wasmFrom = path.resolve("node_modules/@mediapipe/tasks-vision/wasm");
fs.mkdirSync(out, { recursive: true });
if (fs.existsSync(wasmFrom)) fs.cpSync(wasmFrom, path.join(out, "wasm"), { recursive: true });

const models = ["pose_landmarker_lite", "pose_landmarker_full"];
for (const name of models) {
  const file = path.join(out, name + ".task");
  if (fs.existsSync(file) && fs.statSync(file).size > 1e6) continue;
  const url = `https://storage.googleapis.com/mediapipe-models/pose_landmarker/${name}/float16/latest/${name}.task`;
  const res = await fetch(url);
  if (!res.ok) { console.error(`Could not download ${name}: HTTP ${res.status}. Run "npm.cmd install" again on Wi-Fi.`); process.exitCode = 1; continue; }
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log(`saved ${name}.task`);
}
