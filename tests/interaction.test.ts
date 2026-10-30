import assert from "node:assert/strict";
import test from "node:test";
import { makeTavern, transferCounterDrink, type Player } from "../shared/game.js";
import { interactionLabel, usesDrinkHandoff } from "../shared/interaction.js";

test("one interaction places and retrieves finished drinks on all handoff surfaces", () => {
  for (const kind of ["counter", "pantry", "mix"]) {
    const station = makeTavern(42).stations.find(station => station.kind === kind)!;
    const player = { drink:"catnip", drinkQuality:.93, carrying:[] } as unknown as Player;
    const ingredient = station.ingredient;
    assert.equal(usesDrinkHandoff(player, station), true);
    assert.equal(interactionLabel(player, station), "Place drink");
    assert.equal(transferCounterDrink(player, station), "placed");
    assert.equal(usesDrinkHandoff(player, station), true);
    assert.equal(interactionLabel(player, station), "Pick up drink");
    assert.equal(transferCounterDrink(player, station), "picked-up");
    assert.equal(player.drinkQuality, .93);
    assert.equal(station.ingredient, ingredient, "placing a drink must not remove the pantry ingredient");
    assert.equal(station.drink, undefined);
  }
});

test("station actions resume after a handoff without overriding gathering, mixing, or serving", () => {
  const tavern = makeTavern(42), player = { carrying:[] } as unknown as Player;
  for (const kind of ["pantry", "mix", "serve", "seat", "chop", "mop", "trash"]) {
    const station = tavern.stations.find(station => station.kind === kind)!;
    assert.equal(usesDrinkHandoff(player, station), false);
    if (!["pantry", "mix"].includes(kind)) assert.equal(usesDrinkHandoff({ drink:"catnip" }, station), false);
  }
});

test("the unified action never overwrites a surface drink or takes it into full paws", () => {
  const station = makeTavern(42).stations.find(station => station.kind === "pantry")!;
  station.drink = { recipeId:"moonmilk", quality:.84 };
  const player = { drink:"catnip", drinkQuality:.91, carrying:[] } as unknown as Player;
  assert.equal(usesDrinkHandoff(player, station), true);
  assert.equal(transferCounterDrink(player, station), "occupied");
  assert.equal(player.drink, "catnip"); assert.equal(station.drink.recipeId, "moonmilk");
  delete player.drink; player.carrying = ["lime"];
  assert.equal(usesDrinkHandoff(player, station), true);
  assert.equal(transferCounterDrink(player, station), "occupied");
  assert.deepEqual(player.carrying, ["lime"]); assert.equal(station.drink.quality, .84);
});
