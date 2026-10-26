import assert from "node:assert/strict";
import test from "node:test";
import { gridCellCenter, makeTavern, moveWithCounterCollisions, pointCollidesWithCounters, type Player } from "../shared/game.js";
import { movementTarget, playerMoveSpeed } from "../shared/movement.js";
import { advanceWalkAnimation } from "../client/walk-animation.js";
import { handMixFrame, spoonMixFrame } from "../client/mixing-animation.js";
import { FURNITURE_LAYOUT } from "../client/furniture-layout.js";

test("walking covers the same distance at 30, 60, and 144Hz", () => {
  for (const fps of [30, 60, 144]) {
    let position = { x: 0, y: 0 };
    for (let frame = 0; frame < fps; frame++) position = movementTarget(position, { x: 1, y: 0 }, "Tabby", 1000 / fps);
    assert.ok(Math.abs(position.x - 224) < .0001);
    assert.equal(position.y, 0);
  }
});

test("diagonal walking is normalized, Siamese retains its bonus, and tab gaps cannot teleport", () => {
  const diagonal = movementTarget({ x: 0, y: 0 }, { x: 1, y: 1 }, "Tabby", 50);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 11.2) < .0001);
  assert.equal(playerMoveSpeed("Siamese"), 272);
  assert.deepEqual(movementTarget({ x: 0, y: 0 }, { x: 1, y: 0 }, "Tabby", 5000), { x: 11.2, y: 0 });
});

test("walk frames follow travelled distance and hold between remote snapshots", () => {
  const player = { x: 0, y: 0, moving: true, direction: "right" } as Player;
  let cycle = advanceWalkAnimation(undefined, player, 0);
  player.x = 14; cycle = advanceWalkAnimation(cycle, player, 125);
  assert.equal(cycle.frame, 1);
  cycle = advanceWalkAnimation(cycle, player, 150); assert.equal(cycle.frame, 1);
  player.x = 28; cycle = advanceWalkAnimation(cycle, player, 250); assert.equal(cycle.frame, 2);
  cycle = advanceWalkAnimation(cycle, player, 420); assert.equal(cycle.frame, 0);
  player.moving = false; assert.equal(advanceWalkAnimation(cycle, player, 430).frame, 0);
});

test("pausing and teleporting reset the walking pose", () => {
  const player = { x: 0, y: 0, moving: true, direction: "right" } as Player;
  let cycle = advanceWalkAnimation(undefined, player, 0);
  player.x = 20; cycle = advanceWalkAnimation(cycle, player, 100);
  assert.equal(advanceWalkAnimation(cycle, player, 110, true).frame, 0);
  player.x = 500; assert.equal(advanceWalkAnimation(cycle, player, 200).frame, 0);
});

test("spoon and hand mixing keep the bowl stationary while the spoon moves", () => {
  const poses = [0, 150, 300, 450, 600].map(time => spoonMixFrame(time));
  assert.ok(new Set(poses.map(pose => `${pose.spoonX}:${pose.spoonY}:${pose.angle}`)).size > 3);
  for (const pose of poses) assert.deepEqual([pose.bowlX, pose.bowlY], [0, 0]);
  for (const time of [1000, 1100, 1200]) {
    const pose = handMixFrame(time, 1000);
    assert.deepEqual([pose.bowlX, pose.bowlY], [0, 0]);
  }
  assert.deepEqual(spoonMixFrame(0, false), spoonMixFrame(500, false));
  assert.deepEqual(spoonMixFrame(0, true, true), spoonMixFrame(500, true, true));
});

test("bar stools have solid cells and preserve the bar entrance and dining aisle", () => {
  const tavern = makeTavern(913);
  const stools = tavern.stations.filter(station => station.label === "Bar stool");
  assert.equal(stools.length, 4);
  assert.deepEqual(stools.map(stool => stool.gridY), [1, 3, 5, 9]);
  assert.ok(stools.every(stool => stool.gridX === 9 && stool.kind === "seat"));
  const stool = stools[0];
  assert.equal(pointCollidesWithCounters(tavern, stool), true);
  // Clear space beside the narrow stool should not retain a full-cell hitbox.
  assert.equal(pointCollidesWithCounters(tavern, { x: stool.x + 28, y: stool.y }), false);
  for (const row of [6, 7, 8]) {
    const start = gridCellCenter(7, row), end = gridCellCenter(10, row);
    const resolved = moveWithCounterCollisions(tavern, start, end);
    assert.ok(Math.hypot(resolved.x - end.x, resolved.y - end.y) < .001);
  }
  const start = gridCellCenter(10, 0), end = gridCellCenter(10, 10);
  const resolved = moveWithCounterCollisions(tavern, start, end);
  assert.ok(Math.hypot(resolved.x - end.x, resolved.y - end.y) < .001);
});

test("every theme has separate furniture crops within its actual sheet bounds", () => {
  for (const [theme, layout] of Object.entries(FURNITURE_LAYOUT)) {
    const [width, height] = theme === "Cozy Village Pub" ? [1536, 1024] : [1254, 1254];
    for (const frame of [...layout.counters, layout.table, layout.chair, layout.stool]) {
      assert.ok(frame.x >= 0 && frame.y >= 0 && frame.width > 0 && frame.height > 0);
      assert.ok(frame.x + frame.width <= width && frame.y + frame.height <= height);
    }
    layout.counters.forEach((frame, index) => assert.ok(layout.topHeights[index] > 0 && layout.topHeights[index] < frame.height));
  }
});
