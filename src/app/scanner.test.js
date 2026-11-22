// What can be tested without a camera: which part of the picture the yellow frame covers, which part each look reads, and
// what the screen says as the wait goes on.
import test from "node:test";
import assert from "node:assert/strict";
import { frameCrop, lookPlan, waitingHelp, debugLine, FRAME_INSET, HINT_AFTER_MS, DEBUG_AFTER_MS } from "./scanner.js";

test("a wide picture in a tall box: the box shows the middle, and the frame is inset from its edges", () => {
  // 1280x720 in a 5:6 box: the box shows 600 pixels across and all 720 down, from x = 340
  const r = frameCrop(1280, 720, 390, 468);
  assert.equal(r.w, Math.round(600 * (1 - 2 * FRAME_INSET)));
  assert.equal(r.h, Math.round(720 * (1 - 2 * FRAME_INSET)));
  assert.equal(r.x, Math.round(340 + 600 * FRAME_INSET));
  assert.equal(r.y, Math.round(720 * FRAME_INSET));
});

test("a tall picture in a tall box: the frame is centred", () => {
  const r = frameCrop(720, 1280, 390, 468);
  assert.equal(r.x + r.w / 2, 360);
  assert.equal(r.y + r.h / 2, 640);
  assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 720 && r.y + r.h <= 1280);
});

test("a picture shown in a box of its own shape: the frame is the same share on every side", () => {
  const r = frameCrop(1000, 500, 200, 100, 0.1);
  assert.deepEqual(r, { x: 100, y: 50, w: 800, h: 400 });
});

test("the crop stays inside the picture for every shape of picture and box", () => {
  for (const [vw, vh] of [[1920, 1080], [1280, 720], [640, 480], [1080, 1920], [720, 1280], [480, 640]]) {
    for (const [bw, bh] of [[390, 468], [360, 432], [300, 360], [1000, 468]]) {
      for (const inset of [FRAME_INSET, 0.07]) {
        const r = frameCrop(vw, vh, bw, bh, inset);
        assert.ok(r.x >= 0 && r.y >= 0 && r.w > 0 && r.h > 0 && r.x + r.w <= vw && r.y + r.h <= vh, `${vw}x${vh} in ${bw}x${bh}`);
      }
    }
  }
});

test("looks alternate: the whole picture, then the framed part, then the whole picture again", () => {
  assert.equal(lookPlan(0, 1280, 720, 390, 468), null);
  assert.ok(lookPlan(1, 1280, 720, 390, 468));
  assert.equal(lookPlan(2, 1280, 720, 390, 468), null);
  assert.ok(lookPlan(3, 1280, 720, 390, 468));
});

test("a look at the framed part is enlarged, but never beyond the cap, and keeps its shape", () => {
  const small = lookPlan(1, 640, 480, 390, 468);
  assert.ok(small.dw > small.sw && small.dh > small.sh);
  assert.ok(Math.abs(small.dw / small.dh - small.sw / small.sh) < 0.01);
  const big = lookPlan(1, 1920, 1080, 390, 468);
  assert.ok(Math.max(big.dw, big.dh) <= 1000);
  assert.ok(Math.abs(big.dw / big.dh - big.sw / big.sh) < 0.01);
});

test("the line under the viewfinder follows how long nothing has been read", () => {
  assert.equal(waitingHelp(0).say, "Point the camera at the code.");
  assert.equal(waitingHelp(HINT_AFTER_MS - 1).say, "Point the camera at the code.");
  assert.equal(waitingHelp(HINT_AFTER_MS).say, "Move closer until the code fills the frame.");
  assert.equal(waitingHelp(DEBUG_AFTER_MS - 1).debug, false);
  assert.deepEqual(waitingHelp(DEBUG_AFTER_MS), { say: "Move closer until the code fills the frame.", debug: true });
  assert.equal(waitingHelp(60000).debug, true);
});

test("the grey line names the picture size, the reader and the looks", () => {
  assert.equal(debugLine(1280, 720, "our reader", 61), "1280x720, our reader, 61 looks");
  assert.equal(debugLine(640, 480, "our reader", 1), "640x480, our reader, 1 look");
});
