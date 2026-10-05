import assert from "node:assert/strict";
import test from "node:test";
import {
  createMixingSession, expectedMixingStep, GRID_CELL_SIZE, GRID_COLUMNS, GRID_ROWS,
  gridCellCenter, makeOrder, makeTavern, mixingStepsForRecipe, moveWithCounterCollisions,
  PLAYER_COLLISION_RADIUS, recipeForIngredients, seededUpgrades, stationBounds,
  toolTimingAccepted, toolTimingQuality, RECIPES
} from "../shared/game.js";

test("a recipe is identified irrespective of ingredient pickup order", () => {
  const recipe = RECIPES[0];
  assert.equal(recipeForIngredients([...recipe.ingredients].reverse())?.id, recipe.id);
  assert.equal(recipeForIngredients(["catnip", "tuna", "fizz"]), undefined);
});

test("a tavern seed produces a stable, readable layout", () => {
  const first = makeTavern(123456, 2);
  const second = makeTavern(123456, 2);
  assert.deepEqual(first, second);
  assert.equal(first.stations.length, 12);
  assert.deepEqual(first.stations.slice(0, 9).map((station) => station.ingredient), [
    "catnip", "lime", "fizz", "moonmilk", "cream", "stardust", "tuna", "tonic", "kelp"
  ]);
  assert.deepEqual(first.stations.slice(-3).map((station) => station.kind), ["mix", "serve", "mop"]);
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

test("mixing steps derive ingredient order from the recipe and append preparation actions", () => {
  const recipe = RECIPES[0];
  const steps = mixingStepsForRecipe(recipe);
  assert.deepEqual(steps.slice(0, recipe.ingredients.length), recipe.ingredients.map((ingredient) => ({ kind: "ingredient", ingredient })));
  assert.deepEqual(steps.slice(recipe.ingredients.length), recipe.preparation.actions);
  const session = createMixingSession("player-1", recipe.id, 10_000);
  assert.deepEqual(expectedMixingStep(session), { kind: "ingredient", ingredient: recipe.ingredients[0] });
  assert.equal(session.deadlineAt - session.startedAt, 45_000);
});

test("timed preparation evaluates accuracy and rejects extreme timing", () => {
  const action = RECIPES[0].preparation.actions[0];
  assert.equal(toolTimingQuality(action.targetMs, action), 1);
  assert.equal(toolTimingAccepted(action.targetMs, action), true);
  assert.equal(toolTimingAccepted(100, action), false);
  assert.equal(toolTimingQuality(action.targetMs + action.toleranceMs * 2, action), 0);
});

test("customer patience includes time for gathering and the mixing workspace", () => {
  const quickest = makeOrder("quick", () => 0);
  const longest = makeOrder("long", () => 0.999);
  assert.equal(quickest.maxPatience, 60);
  assert.equal(longest.maxPatience, 80);
});

test("upgrade choices are deterministic and offer three distinct options", () => {
  const choices = seededUpgrades(48, 3);
  assert.equal(choices.length, 3);
  assert.equal(new Set(choices.map((choice) => choice.id)).size, 3);
  assert.deepEqual(choices, seededUpgrades(48, 3));
});
