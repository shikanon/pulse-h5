import test from "node:test";
import assert from "node:assert/strict";
import { finishGesture, moveGesture } from "../src/shared/feedGesture.ts";
const start = () => ({
  id: 1,
  x: 100,
  y: 300,
  started: 0,
  distance: 0,
  cancelled: false,
});
test("small finger jitter is a tap; vertical swipes page in both directions", () => {
  assert.equal(finishGesture(start(), 105, 304, 180), "tap");
  assert.equal(finishGesture(start(), 108, 180, 250), "next");
  assert.equal(finishGesture(start(), 95, 420, 250), "previous");
});
test("short drag, horizontal drag, long press and cancellation never launch a game", () => {
  for (const [x, y, t] of [
    [100, 275, 100],
    [210, 290, 100],
    [100, 300, 700],
  ])
    assert.equal(finishGesture(start(), x, y, t), "none");
  assert.equal(
    finishGesture({ ...start(), cancelled: true }, 100, 180, 200),
    "none",
  );
});
test("a finger that moves away then returns is not a tap", () => {
  const g = start();
  moveGesture(g, 100, 190);
  assert.equal(finishGesture(g, 100, 301, 200), "none");
});
