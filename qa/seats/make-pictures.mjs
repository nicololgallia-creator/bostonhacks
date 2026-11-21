// Makes two.png, three.png and four.png in this folder: qa/person.jpg placed 2, 3 and 4 times
// side by side, so each person is one equal slice of a wide picture. No camera needed.
//   node qa/seats/make-pictures.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const person = jpeg.decode(fs.readFileSync(path.join(here, "..", "person.jpg")), { useTArray: true });

for (const [name, n] of [["two", 2], ["three", 3], ["four", 4]]) {
  const out = new PNG({ width: person.width * n, height: person.height });
  for (let k = 0; k < n; k++) {
    for (let y = 0; y < person.height; y++) {
      const from = y * person.width * 4;
      Buffer.from(person.data.buffer, from, person.width * 4).copy(out.data, (y * out.width + k * person.width) * 4);
    }
  }
  fs.writeFileSync(path.join(here, `${name}.png`), PNG.sync.write(out));
  console.log(`${name}.png ${out.width}x${out.height}`);
}
