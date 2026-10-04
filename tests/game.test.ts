import assert from "node:assert/strict";
import test from "node:test";
import { makeTavern, recipeForIngredients, seededUpgrades, RECIPES } from "../shared/game.js";

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

test("upgrade choices are deterministic and offer three distinct options", () => {
  const choices = seededUpgrades(48, 3);
  assert.equal(choices.length, 3);
  assert.equal(new Set(choices.map((choice) => choice.id)).size, 3);
  assert.deepEqual(choices, seededUpgrades(48, 3));
});
