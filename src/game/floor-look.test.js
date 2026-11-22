// The small rules the floor's screens share: what counts as a duel, what a duel is called, which lanes have a foot down.
import test from "node:test";
import assert from "node:assert/strict";
import { isDuel, matchup } from "./floor-look.js";
import { litLanes } from "./floor-screens.js";

test("a duel is a versus song with two or more seats", () => {
  assert.equal(isDuel({ mode: "versus", players: [{}, {}] }), true);
  assert.equal(isDuel({ mode: "versus", players: [{}] }), false); // one seat runs as team
  assert.equal(isDuel({ mode: "team", players: [{}, {}] }), false);
});

test("a duel is named by its players", () => {
  assert.equal(matchup(2), "1v1");
  assert.equal(matchup(3), "1v1v1");
  assert.equal(matchup(4), "1v1v1v1");
});

test("a lane is lit when a foot is in the square below the hit line", () => {
  assert.equal(litLanes([], 2), 0);
  assert.equal(litLanes([{ u: 0.2, v: 0.8 }], 2), 1);
  assert.equal(litLanes([{ u: 0.9, v: 0.8 }], 2), 2);
  assert.equal(litLanes([{ u: 0.9, v: 0.3 }], 2), 0); // above the square
  assert.equal(litLanes([{ u: 1, v: 0.8 }], 1), 1); // the right edge is still the last lane
});
