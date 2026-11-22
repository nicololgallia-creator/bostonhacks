// Refreshes the pinned Normal charts (src/game/chart-normal.fixture.json) for the named songs, after a song file changed on purpose.
// The pins exist to catch chart code changing Normal by accident, so only run this for the songs you edited:
//
//   node tools/repin-charts.mjs <song id> [<song id> ...]
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
const { songs } = await import("../src/songs/index.js");
const { splitParts } = await import("../src/game/parts.js");
const file = new URL("../src/game/chart-normal.fixture.json", import.meta.url);
const pins = JSON.parse(readFileSync(file, "utf8"));
const print = (x) => createHash("sha1").update(JSON.stringify(x)).digest("hex").slice(0, 16);
for (const id of process.argv.slice(2)) {
  const song = songs.find((s) => s.id === id);
  for (const mode of ["team", "versus"]) for (let seats = mode === "team" ? 1 : 2; seats <= 4; seats++) pins[id][`${mode}${seats}`] = print(splitParts(song, seats, { mode }).map((p) => p.notes));
  console.log("re-pinned", id);
}
writeFileSync(file, JSON.stringify(pins, null, 1) + "\n");
