import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMissedOrderPenalty, BOARD_BOUNDS, createMixingSession, expectedMixingStep, floorBoundsAtY,
  GRID_CELL_SIZE, GRID_COLUMNS, GRID_ROWS, gridCellCenter, initialState, makeOrder, makeTavern,
  mixingStepsForRecipe, moveWithCounterCollisions, pauseShift, PLAYER_COLLISION_RADIUS, pointCollidesWithCounters,
  recipeForIngredients, resumeShift, rhythmTimingAccepted, rhythmTimingQuality, seededUpgrades, shiftDurationForRound, stationBounds,
  toolTimingAccepted, toolTimingQuality, RECIPES
} from "../shared/game.js";
import { handMixFrame } from "../client/mixing-animation.js";

test("a recipe is identified irrespective of ingredient pickup order", () => {
  const recipe = RECIPES[0];
  assert.equal(recipeForIngredients([...recipe.ingredients].reverse())?.id, recipe.id);
  assert.equal(recipeForIngredients(["catnip", "tuna", "fizz"]), undefined);
});

test("expanded recipes use unique three-ingredient sets from the existing pantry", () => {
  const pantry = new Set(makeTavern(123).stations.flatMap((station) => station.ingredient ? [station.ingredient] : []));
  const combinations = RECIPES.map((recipe) => [...recipe.ingredients].sort().join("|"));
  assert.equal(new Set(combinations).size, RECIPES.length);
  assert.ok(RECIPES.length >= 7);
  for (const recipe of RECIPES) {
    assert.equal(recipe.ingredients.length, 3);
    assert.ok(recipe.ingredients.every((ingredient) => pantry.has(ingredient)));
    assert.equal(recipeForIngredients([...recipe.ingredients].reverse())?.id, recipe.id);
  }
});

test("a tavern seed produces a stable, readable layout", () => {
  const first = makeTavern(123456, 2);
  const second = makeTavern(123456, 2);
  assert.deepEqual(first, second);
  assert.equal(first.stations.length, 13);
  assert.deepEqual(first.stations.slice(0, 9).map((station) => station.ingredient), [
    "catnip", "lime", "fizz", "moonmilk", "cream", "stardust", "tuna", "tonic", "kelp"
  ]);
  assert.deepEqual(first.stations.slice(-4).map((station) => station.kind), ["mix", "serve", "mop", "trash"]);
});

test("every generated counter owns one unique square grid cell", () => {
  const tavern = makeTavern(913, 4);
  const occupied = new Set<string>();
  for (const station of tavern.stations) {
    assert.ok(station.gridX >= 0 && station.gridX < GRID_COLUMNS);
    assert.ok(station.gridY >= 0 && station.gridY < GRID_ROWS);
    const key = `${station.gridX}:${station.gridY}`;
    assert.equal(occupied.has(key), false, `duplicate station cell ${key}`);
    occupied.add(key);
    assert.deepEqual({ x: station.x, y: station.y }, gridCellCenter(station.gridX, station.gridY));
    const bounds = stationBounds(station);
    assert.equal(bounds.right - bounds.left, GRID_CELL_SIZE);
    assert.equal(bounds.bottom - bounds.top, GRID_CELL_SIZE);
  }
  assert.deepEqual(new Set(tavern.stations.map((station) => station.counterVariant)), new Set([
    "standard", "end-cap", "corner", "ingredient", "mixing", "decorative", "damaged"
  ]));
});

test("counter collision prevents tunnelling through a square footprint", () => {
  const tavern = makeTavern(4321, 1);
  const station = tavern.stations.find((candidate) => candidate.id === "mix")!;
  const bounds = stationBounds(station);
  const start = { x: bounds.left - PLAYER_COLLISION_RADIUS - 2, y: station.y };
  const resolved = moveWithCounterCollisions(tavern, start, { x: bounds.right + 100, y: station.y });
  assert.ok(resolved.x <= bounds.left - PLAYER_COLLISION_RADIUS);
  assert.equal(resolved.y, start.y);
});

test("cat paws can pass clear counter corners without entering the square footprint", () => {
  const tavern = makeTavern(4321, 1);
  const bounds = stationBounds(tavern.stations.find((station) => station.id === "mix")!);
  assert.equal(pointCollidesWithCounters(tavern, { x: bounds.right + 8, y: bounds.bottom + 8 }), false);
  assert.equal(pointCollidesWithCounters(tavern, { x: bounds.right + 5, y: bounds.bottom + 5 }), true);
});

test("trapezoid floor bounds reject upper-wall traversal and constrain diagonal movement", () => {
  const tavern = makeTavern(4321, 1);
  const start = { x: 400, y: BOARD_BOUNDS.minY + 20 };
  const resolved = moveWithCounterCollisions(tavern, start, { x: 900, y: 0 });
  const floor = floorBoundsAtY(resolved.y);
  assert.ok(Math.abs(resolved.y - BOARD_BOUNDS.minY) < .001);
  assert.ok(resolved.x >= floor.minX && resolved.x <= floor.maxX);
  assert.ok(floor.minX > BOARD_BOUNDS.minX, "upper floor must be narrower than the lower board");
});

test("mixing steps derive ingredient order from the recipe and append preparation actions", () => {
  const recipe = RECIPES[0];
  const steps = mixingStepsForRecipe(recipe);
  assert.deepEqual(steps.slice(0, recipe.ingredients.length), recipe.ingredients.map((ingredient) => ({ kind: "ingredient", ingredient })));
  assert.deepEqual(steps.slice(recipe.ingredients.length), recipe.preparation.actions);
  const session = createMixingSession("player-1", recipe.id, 10_000);
  assert.deepEqual(expectedMixingStep(session), { kind: "ingredient", ingredient: recipe.ingredients[0] });
  assert.equal(session.deadlineAt - session.startedAt, 45_000);
});

test("every round lasts three minutes and pausing preserves preparation time", () => {
  assert.equal(shiftDurationForRound(1), 180);
  assert.equal(shiftDurationForRound(4), 180);
  const state = initialState("TEST", "host", 1);
  state.phase = "shift";
  state.mixing.host = createMixingSession("host", "catnip", 1000);
  state.mixing.host.toolStartedAt = 1500;
  const deadline = state.mixing.host.deadlineAt;
  assert.equal(pauseShift(state, "host", 2000), true);
  assert.equal(state.mixing.host.toolStartedAt, undefined);
  assert.equal(resumeShift(state, 7000), true);
  assert.equal(state.mixing.host.deadlineAt, deadline + 5000);
  assert.equal(state.pausedAt, null);
  assert.equal(state.shiftSeconds, 180);
});

test("hand-mixing frame animates crisply and honors reduced motion", () => {
  const still = handMixFrame(1000, 1000, true);
  assert.deepEqual(still, { bowlX: 0, bowlY: 0, liquidX: 0, leftPawX: 0, rightPawX: 0 });
  const frames = [1000, 1040, 1080, 1120, 1160].map((time) => handMixFrame(time, 1000));
  assert.ok(new Set(frames.map((frame) => `${frame.bowlX}:${frame.bowlY}:${frame.liquidX}`)).size > 2);
  assert.ok(frames.every((frame) => Object.values(frame).every((offset) => offset % 2 === 0 && Math.abs(offset) <= 20)));
});

test("timed preparation evaluates accuracy and rejects extreme timing", () => {
  const action = RECIPES[0].preparation.actions[0];
  assert.equal(action.kind, "timed-tool");
  if (action.kind !== "timed-tool") return;
  assert.equal(toolTimingQuality(action.targetMs, action), 1);
  assert.equal(toolTimingAccepted(action.targetMs, action), true);
  assert.equal(toolTimingAccepted(100, action), false);
  assert.equal(toolTimingQuality(action.targetMs + action.toleranceMs * 2, action), 0);
});

test("rhythm preparation supports chopping and alternating-paw mixing", () => {
  const styles = new Set(RECIPES.flatMap((recipe) => recipe.preparation.actions
    .filter((action) => action.kind === "rhythm").map((action) => action.style)));
  assert.deepEqual(styles, new Set(["chop", "hand-mix"]));
  const action = RECIPES.flatMap((recipe) => recipe.preparation.actions).find((step) => step.kind === "rhythm");
  assert.ok(action && action.kind === "rhythm");
  assert.equal(rhythmTimingAccepted(action.intervalMs, action), true);
  assert.equal(rhythmTimingAccepted(action.intervalMs - action.toleranceMs - 1, action), false);
  assert.equal(rhythmTimingQuality(action.intervalMs, action), 1);
  assert.ok(rhythmTimingQuality(action.intervalMs + action.toleranceMs, action) < 1);
});

test("later orders unlock harder recipes and lose patience without becoming impossible", () => {
  const quickest = makeOrder("quick", () => 0);
  const longest = makeOrder("long", () => 0.999);
  const late = makeOrder("late", () => .999, 3, shiftDurationForRound(3) / 2);
  assert.equal(quickest.maxPatience, 68);
  assert.equal(longest.maxPatience, 85);
  assert.ok(late.maxPatience < longest.maxPatience);
  assert.equal(RECIPES.find((recipe) => recipe.id === late.recipeId)?.tier, 2);
  assert.ok(makeOrder("bonus", () => .999, 3, shiftDurationForRound(3) / 2, 12).maxPatience > late.maxPatience);
});

test("each missed order costs a team heart and reputation, including shift-end misses", () => {
  const state = initialState("TEST", "host", 1);
  state.reputation = 2;
  applyMissedOrderPenalty(state, 1);
  assert.equal(state.health, 2);
  assert.equal(state.reputation, 1);
  applyMissedOrderPenalty(state, 3);
  assert.equal(state.health, 0);
  assert.equal(state.reputation, 0);
});

test("upgrade choices are deterministic and offer three distinct options", () => {
  const choices = seededUpgrades(48, 3);
  assert.equal(choices.length, 3);
  assert.equal(new Set(choices.map((choice) => choice.id)).size, 3);
  assert.deepEqual(choices, seededUpgrades(48, 3));
});
