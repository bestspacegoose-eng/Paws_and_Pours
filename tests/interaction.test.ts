import assert from "node:assert/strict";
import test from "node:test";
import { CHOPPING_RECIPES, INGREDIENTS, TAVERN_THEMES, ingredientLabel, makeTavern, transferCounterItem, type Player } from "../shared/game.js";
import { counterBlockReason, interactionLabel, usesCounterHandoff } from "../shared/interaction.js";

test("one interaction places and retrieves finished drinks on all handoff surfaces", () => {
  for (const kind of ["counter", "pantry", "mix"]) {
    const station = makeTavern(42).stations.find(station => station.kind === kind)!;
    const player = { drink:"catnip", drinkQuality:.93, carrying:[] } as unknown as Player;
    const ingredient = station.ingredient;
    assert.equal(usesCounterHandoff(player, station), true);
    assert.equal(interactionLabel(player, station), "Place drink");
    assert.equal(transferCounterItem(player, station), "placed");
    assert.equal(usesCounterHandoff(player, station), true);
    assert.equal(interactionLabel(player, station), "Pick up drink");
    assert.equal(transferCounterItem(player, station), "picked-up");
    assert.equal(player.drinkQuality, .93);
    assert.equal(station.ingredient, ingredient, "placing a drink must not remove the pantry ingredient");
    assert.equal(station.drink, undefined);
  }
});

test("station actions resume after a handoff without overriding gathering, mixing, or serving", () => {
  const tavern = makeTavern(42), player = { carrying:[] } as unknown as Player;
  for (const kind of ["pantry", "mix", "serve", "seat", "chop", "mop", "trash"]) {
    const station = tavern.stations.find(station => station.kind === kind)!;
    assert.equal(usesCounterHandoff(player, station), false);
    if (!["pantry", "mix"].includes(kind)) assert.equal(usesCounterHandoff({ drink:"catnip" }, station), false);
  }
});

test("the unified action never overwrites a surface drink or takes it into full paws", () => {
  const station = makeTavern(42).stations.find(station => station.kind === "pantry")!;
  station.drink = { recipeId:"moonmilk", quality:.84 };
  const player = { drink:"catnip", drinkQuality:.91, carrying:[] } as unknown as Player;
  assert.equal(usesCounterHandoff(player, station), true);
  assert.equal(transferCounterItem(player, station), "occupied");
  assert.equal(player.drink, "catnip"); assert.equal(station.drink.recipeId, "moonmilk");
  delete player.drink; player.carrying = ["lime"];
  assert.equal(usesCounterHandoff(player, station), true);
  assert.equal(transferCounterItem(player, station), "occupied");
  assert.deepEqual(player.carrying, ["lime"]); assert.equal(station.drink.quality, .84);
});

const allIngredients = [...INGREDIENTS, ...CHOPPING_RECIPES.map(recipe => `chopped-${recipe.ingredients[0]}`)];
const carryingPlayer = (carrying: string[] = []): Player => ({ carrying, ingredientQualities: {} } as Player);

test("counter feedback identifies the exact inventory or surface problem",()=>{
  const counter=makeTavern(42).stations.find(station=>station.kind==="counter")!;
  counter.counterIngredient={ingredient:"lime",quality:1};
  assert.match(counterBlockReason(carryingPlayer(["lime"]),counter)!,/Already carrying lime/);
  assert.match(counterBlockReason(carryingPlayer(["cream","tonic","kelp"]),counter)!,/3\/3/);
  assert.equal(counterBlockReason(carryingPlayer(["cream","tonic","kelp"]),counter,4),undefined);
  const cat=carryingPlayer();cat.drink="tuna";
  assert.match(counterBlockReason(cat,counter)!,/occupied by an ingredient/);
  delete counter.counterIngredient;counter.drink={recipeId:"catnip",quality:1};
  assert.match(counterBlockReason(cat,counter)!,/occupied by a drink/);
});

test("every raw and chopped ingredient fits one slot on every empty counter in every theme", () => {
  for (let round = 1; round <= TAVERN_THEMES.length; round++) {
    const tavern = makeTavern(42, round);
    for (const station of tavern.stations.filter(station => station.kind === "counter")) {
      for (const ingredient of allIngredients) {
        const player = carryingPlayer([ingredient]);
        player.ingredientQualities = { [ingredient]: .83 };
        assert.equal(interactionLabel(player, station), `Place ${ingredientLabel(ingredient)}`);
        assert.equal(transferCounterItem(player, station), "placed");
        assert.deepEqual(player.carrying, []);
        assert.equal(player.ingredientQualities[ingredient], undefined);
        assert.deepEqual(station.counterIngredient, { ingredient, quality: .83 });
        assert.equal(station.drink, undefined);
        assert.equal(interactionLabel(player, station), `Pick up ${ingredientLabel(ingredient)}`);
        const guest = carryingPlayer();
        assert.equal(transferCounterItem(guest, station), "picked-up");
        assert.deepEqual(guest.carrying, [ingredient]);
        if (ingredient.startsWith("chopped-")) assert.equal(guest.ingredientQualities?.[ingredient], .83);
        assert.equal(station.counterIngredient, undefined);
      }
    }
  }
});

test("placing from a full bag leaves all other ingredients and their quality alone", () => {
  const station = makeTavern(42).stations.find(station => station.kind === "counter")!;
  const player = carryingPlayer(["chopped-tuna", "cream", "chopped-lime"]);
  player.ingredientQualities = { "chopped-tuna": .72, "chopped-lime": .94 };
  assert.equal(transferCounterItem(player, station), "placed");
  assert.deepEqual(player.carrying, ["chopped-tuna", "cream"]);
  assert.deepEqual({ ...player.ingredientQualities }, { "chopped-tuna": .72 });
  assert.deepEqual(station.counterIngredient, { ingredient: "chopped-lime", quality: .94 });
  assert.equal(transferCounterItem(player, station), "picked-up");
  assert.deepEqual(player.carrying, ["chopped-tuna", "cream", "chopped-lime"]);
  assert.equal(player.ingredientQualities["chopped-lime"], .94);
});

test("occupied counters never stack ingredients, overwrite items, or overlap ingredients with drinks", () => {
  const station = makeTavern(42).stations.find(station => station.kind === "counter")!;
  const first = carryingPlayer(["lime"]), second = carryingPlayer(["lime"]);
  assert.equal(transferCounterItem(first, station), "placed");
  const occupied = structuredClone(station);
  assert.equal(transferCounterItem(second, station), "occupied");
  assert.deepEqual(station, occupied);
  assert.deepEqual(second.carrying, ["lime"]);
  second.drink = "catnip"; second.drinkQuality = .9;
  assert.equal(transferCounterItem(second, station), "occupied");
  assert.deepEqual(station, occupied);
  assert.equal(second.drink, "catnip");
  assert.equal(transferCounterItem(first, station), "picked-up");
  assert.equal(transferCounterItem(second, station), "placed");
  const drinkOccupied = structuredClone(station);
  assert.equal(transferCounterItem(first, station), "occupied");
  assert.deepEqual(station, drinkOccupied);
  assert.equal(station.counterIngredient, undefined);
});

test("rapid different-ingredient interactions only pick up the existing item and never swap or duplicate it", () => {
  const station = makeTavern(42).stations.find(station => station.kind === "counter")!;
  const first = carryingPlayer(["lime"]), second = carryingPlayer(["cream"]);
  assert.equal(transferCounterItem(first, station), "placed");
  assert.equal(transferCounterItem(second, station), "picked-up");
  assert.deepEqual(first.carrying, []);
  assert.deepEqual(second.carrying, ["cream", "lime"]);
  assert.equal(station.counterIngredient, undefined);
  assert.equal(station.drink, undefined);
  assert.equal(transferCounterItem(first, station), "empty");
});

test("ingredient pickup respects normal and keepsake capacity, duplicates, and finished drinks", () => {
  const station = makeTavern(42).stations.find(station => station.kind === "counter")!;
  station.counterIngredient = { ingredient: "chopped-lime", quality: .81 };
  const player = carryingPlayer(["cream", "tonic", "fizz"]);
  assert.equal(transferCounterItem(player, station), "occupied");
  assert.equal(transferCounterItem(player, station, 4), "picked-up");
  assert.equal(player.ingredientQualities?.["chopped-lime"], .81);
  station.counterIngredient = { ingredient: "kelp", quality: 1 };
  assert.equal(transferCounterItem(player, station, 4), "occupied");
  assert.deepEqual(station.counterIngredient, { ingredient: "kelp", quality: 1 });
  player.carrying = ["kelp"];
  assert.equal(transferCounterItem(player, station), "occupied");
  player.carrying = []; player.drink = "catnip";
  assert.equal(transferCounterItem(player, station), "occupied");
  assert.equal(station.drink, undefined);
});

test("ingredients can only be set on free counters, leaving dedicated stations unchanged", () => {
  const tavern = makeTavern(42);
  for (const station of tavern.stations.filter(station => station.kind !== "counter")) {
    const player = carryingPlayer(["chopped-lime"]), before = structuredClone(station);
    assert.ok(["empty", "unavailable"].includes(transferCounterItem(player, station)));
    assert.deepEqual(station, before);
    assert.deepEqual(player.carrying, ["chopped-lime"]);
  }
});
