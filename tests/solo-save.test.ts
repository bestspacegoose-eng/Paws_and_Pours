import test from "node:test";
import assert from "node:assert/strict";
import { INGREDIENTS, CHOPPING_RECIPES, initialState, PLAYER_SPAWNS, createMixingSession, transferCounterItem, type Player } from "../shared/game.js";
import { captureSoloSnapshot, restoreSoloSnapshot } from "../shared/solo-save.js";
import { loadSettings, saveSettings, defaultSettings, loadSoloSlots, saveSoloSlot } from "../client/preferences.js";

const player: Player = { id: "original", name: "Mittens", role: "Tabby", fur: "#e5a265", accessory: "Bow tie",
  ...PLAYER_SPAWNS[0], direction: "down", moving: false, moveSequence: 0, carrying: ["catnip", "lime", "fizz"], connected: true, score: 9 };

test("solo snapshots restore real gameplay in a fresh paused private identity", () => {
  const state = initialState("OLD", player.id, 12);
  state.players[player.id] = { ...player }; state.phase = "shift";
  state.shiftSeconds = 94; state.coins = 27; state.health = 2;
  state.orders = [{ id: "old-order", recipeId: "catnip", tableId: "table-1", customer: "Guest", patience: 43, maxPatience: 80 }];
  state.mixing[player.id] = createMixingSession(player.id, "catnip", 1000);
  state.mixing[player.id].stepIndex = 3; state.mixing[player.id].usedIngredients = ["fizz", "lime", "catnip"];
  state.mixing[player.id].toolStartedAt = 2000;
  state.tavern.stations.find((station) => station.kind === "chop")!.preparedIngredient = "chopped-tuna";
  const counter = state.tavern.stations.find((station) => station.kind === "counter")!;
  counter.drink = { recipeId: "catnip", quality: .83 };
  const snapshot = captureSoloSnapshot(state, player.id, 6000);
  const restored = restoreSoloSnapshot(snapshot, "NEW", { ...player, id: "new-player" }, 100000)!;
  assert.equal(restored.code, "NEW"); assert.equal(restored.hostId, "new-player");
  assert.equal(restored.shiftSeconds, 94); assert.equal(restored.coins, 27); assert.equal(restored.health, 2);
  assert.equal(restored.pausedAt, 100000); assert.equal(restored.orders[0].patience, 43);
  assert.deepEqual(Object.keys(restored.players), ["new-player"]);
  assert.equal(restored.mixing["new-player"].deadlineAt, 140000);
  assert.equal(restored.mixing["new-player"].toolStartedAt, undefined);
  assert.equal(restored.tavern.stations.find((station) => station.id === counter.id)!.drink!.quality, .83);
  assert.equal(restored.tavern.stations.find((station) => station.kind === "chop")!.preparedIngredient, "chopped-tuna");
  state.coins = 0; assert.equal(snapshot.state.coins, 27);
});

test("corrupt saves are rejected and stored furniture coordinates are not trusted", () => {
  assert.equal(restoreSoloSnapshot(null, "NEW", player), undefined);
  const state = initialState("OLD", player.id, 12); state.players[player.id] = player;
  const snapshot = captureSoloSnapshot(state, player.id);
  snapshot.state.tavern.stations[0].x = -9999;
  assert.notEqual(restoreSoloSnapshot(snapshot, "NEW", player)!.tavern.stations[0].x, -9999);
  snapshot.state.health = NaN;
  assert.equal(restoreSoloSnapshot(snapshot, "NEW", player), undefined);
});

test("all countertop ingredients survive save and resume with no overlap or lost chopping quality", () => {
  for (const ingredient of [...INGREDIENTS, ...CHOPPING_RECIPES.map(recipe => `chopped-${recipe.ingredients[0]}`)]) {
    const state = initialState("OLD", player.id, 12);
    state.players[player.id] = { ...player, carrying: [] };
    const counter = state.tavern.stations.find(station => station.kind === "counter")!;
    counter.counterIngredient = { ingredient, quality: .79 };
    const restored = restoreSoloSnapshot(captureSoloSnapshot(state, player.id), "NEW", { ...player, id: "new" })!;
    const stored = restored.tavern.stations.find(station => station.id === counter.id)!;
    assert.deepEqual(stored.counterIngredient, { ingredient, quality: .79 });
    assert.equal(stored.drink, undefined);
    assert.equal(transferCounterItem(restored.players.new, stored), "picked-up");
    assert.deepEqual(restored.players.new.carrying, [ingredient]);
    if (ingredient.startsWith("chopped-")) assert.equal(restored.players.new.ingredientQualities?.[ingredient], .79);
    assert.equal(stored.counterIngredient, undefined);
  }
});

test("save restoration cannot create overlapping drinks and ingredients or import invalid counter items", () => {
  const state = initialState("OLD", player.id, 12);
  state.players[player.id] = { ...player, carrying: [] };
  const counters = state.tavern.stations.filter(station => station.kind === "counter");
  counters[0].drink = { recipeId: "catnip", quality: .9 };
  counters[0].counterIngredient = { ingredient: "lime", quality: 1 };
  counters[1].counterIngredient = { ingredient: "fake-lime", quality: 1 };
  counters[2].counterIngredient = { ingredient: "chopped-lime", quality: NaN };
  const restored = restoreSoloSnapshot(captureSoloSnapshot(state, player.id), "NEW", player)!;
  for (const counter of counters.slice(0, 3)) {
    const stored = restored.tavern.stations.find(station => station.id === counter.id)!;
    assert.equal(stored.counterIngredient, undefined);
  }
  assert.deepEqual(restored.tavern.stations.find(station => station.id === counters[0].id)?.drink, { recipeId: "catnip", quality: .9 });
});

test("local slots preserve independent saves and migrate legacy profiles without overwriting them", () => {
  const storage = new Map<string, string>();
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
  try {
    assert.deepEqual(loadSoloSlots(), [null, null, null]);
    const save = { version: 1 as const, savedAt: 123, profile: player, summary: { coins: 4, reputation: 2, round: 1, phase: "shift" } };
    storage.set("paws-pours-solo-v1", JSON.stringify(save));
    assert.equal(loadSoloSlots()[0]?.profile.name, "Mittens");
    assert.equal(saveSoloSlot(1, { ...save, profile: { ...player, name: "Second" } }), true);
    assert.equal(loadSoloSlots()[0]?.profile.name, "Mittens");
    assert.equal(loadSoloSlots()[1]?.profile.name, "Second");
    assert.equal(saveSoloSlot(99, save), false);
    storage.set("paws-pours-solo-slots-v2", "not json");
    assert.equal(loadSoloSlots()[0]?.profile.name, "Mittens");
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("brightness persists, clamps safely, and defaults for older settings", () => {
  const storage = new Map<string, string>();
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
  try {
    assert.equal(loadSettings().brightness, 100);
    storage.set("paws-pours-settings-v1", JSON.stringify({ masterVolume: 42 }));
    assert.equal(loadSettings().brightness, 100, "existing audio/display preferences remain compatible");
    assert.equal(loadSettings().masterVolume, 42);
    saveSettings({ ...defaultSettings, brightness: 115 });
    assert.equal(loadSettings().brightness, 115);
    storage.set("paws-pours-settings-v1", JSON.stringify({ brightness: 999 }));
    assert.equal(loadSettings().brightness, 150);
    storage.set("paws-pours-settings-v1", JSON.stringify({ brightness: -9 }));
    assert.equal(loadSettings().brightness, 50);
    storage.set("paws-pours-settings-v1", JSON.stringify({ brightness: "invalid" }));
    assert.equal(loadSettings().brightness, 100);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
