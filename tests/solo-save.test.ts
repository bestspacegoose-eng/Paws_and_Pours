import test from "node:test";
import assert from "node:assert/strict";
import { initialState, PLAYER_SPAWNS, createMixingSession, type Player } from "../shared/game.js";
import { captureSoloSnapshot, restoreSoloSnapshot } from "../shared/solo-save.js";
import { loadSoloSlots, saveSoloSlot } from "../client/preferences.js";

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
