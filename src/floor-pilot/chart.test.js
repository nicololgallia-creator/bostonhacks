import test from "node:test";
import assert from "node:assert/strict";
import { buildChart, standing, lanesPerPad, SONG, TARGET } from "./chart.js";

for (const players of [1, 2, 3, 4]) {
  const chart = buildChart(players);

  test(`${players} player(s): every seat has enough notes, on lanes that exist, never two within 0.75 s`, () => {
    for (let seat = 0; seat < players; seat++) {
      assert.ok(chart.notes.filter((n) => n.seat === seat).length >= 8, `seat ${seat} is thin`);
      for (let lane = 0; lane < lanesPerPad(players); lane++) {
        const ns = chart.notes.filter((n) => n.seat === seat && n.lane === lane);
        for (let i = 1; i < ns.length; i++) assert.ok(ns[i].t >= ns[i - 1].t + ns[i - 1].dur + 0.75 - 1e-9);
      }
    }
    assert.ok(chart.notes.every((n) => n.seat < players && n.lane < lanesPerPad(players)));
  });

  test(`${players} player(s): the loop shows a hold and a miss, and a combo builds`, () => {
    assert.ok(chart.notes.some((n) => n.dur > 0));
    assert.ok(chart.notes.some((n) => n.grade === "miss"), "no miss in the loop");
    const best = Math.max(...[...Array(SONG * 4).keys()].map((i) => Math.max(...standing(chart, i / 4).map((p) => p.combo))));
    assert.ok(best >= 6, `best combo ${best}`);
  });

  test(`${players} player(s): scores end exactly on the whiteboard numbers`, () => {
    assert.deepEqual(standing(chart, SONG + 1).map((p) => p.score), TARGET.slice(0, players));
  });
}
