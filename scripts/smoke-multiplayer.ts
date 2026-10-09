import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import { recipeById, type CatRole, type GameState, type Station } from "../shared/game.js";
import { GRID_CELL_SIZE, GRID_COLUMNS, GRID_ROWS, gridCellCenter, nearbyStation, pointCollidesWithCounters } from "../shared/game.js";

const serverUrl = process.env.SMOKE_SERVER_URL ?? "http://localhost:3001";
const hostToken = `smoke-host-${Date.now()}`;
const guestToken = `smoke-guest-${Date.now()}`;
let smokeStage = "connect";
const profile = (token: string, name: string, role: CatRole = "Tabby") => ({
  token, name, role, fur: "#e5a265", accessory: "Bow tie"
});

function connectedSocket() {
  return new Promise<Socket>((resolve, reject) => {
    const socket = io(serverUrl, { forceNew: true, reconnection: false, timeout: 5_000 });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

function waitForState(socket: Socket, current: () => GameState | undefined, predicate: (state: GameState) => boolean, timeoutMs = 5_000) {
  const existing = current();
  if (existing && predicate(existing)) return Promise.resolve(existing);
  return new Promise<GameState>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("state", onState);
      reject(new Error("Timed out waiting for an authoritative game state."));
    }, timeoutMs);
    const onState = (state: GameState) => {
      if (!predicate(state)) return;
      clearTimeout(timeout);
      socket.off("state", onState);
      resolve(state);
    };
    socket.on("state", onState);
  });
}

async function main() {
  smokeStage = "connect host";
  const host = await connectedSocket();
  smokeStage = "connect guest";
  const guest = await connectedSocket();
  let hostState: GameState | undefined;
  let guestState: GameState | undefined;
  host.on("state", (state: GameState) => { hostState = state; });
  guest.on("state", (state: GameState) => { guestState = state; });

  try {
    smokeStage = "create room";
    const joinedHost = new Promise<{ code: string }>((resolve) => host.once("joined", resolve));
    host.emit("create-room", profile(hostToken, "Smoke Host"));
    const { code } = await joinedHost;
    await waitForState(host, () => hostState, (state) => state.code === code && Boolean(state.players[hostToken]));

    smokeStage = "join guest";
    guest.emit("join-room", { ...profile(guestToken, "Smoke Guest"), code });
    await waitForState(host, () => hostState, (state) => Boolean(state.players[guestToken]));
    await waitForState(guest, () => guestState, (state) => state.code === code && Boolean(state.players[guestToken]));
    smokeStage = "start shift";
    host.emit("start-shift");
    await waitForState(host, () => hostState, (state) => state.phase === "shift" && state.orders.length > 0);
    assert.equal(hostState!.shiftSeconds, 180, "each shift should start at three minutes");

    smokeStage = "shared pause";
    guest.emit("set-pause", true);
    await waitForState(host, () => hostState, (state) => state.pausedAt !== null);
    await waitForState(guest, () => guestState, (state) => state.pausedAt !== null);
    const frozenSeconds = hostState!.shiftSeconds;
    const frozenPatience = hostState!.orders[0].patience;
    const frozenX = hostState!.players[hostToken].x;
    host.emit("move", { x: frozenX + 20, y: hostState!.players[hostToken].y, sequence: 1 });
    await new Promise((resolve) => setTimeout(resolve, 1250));
    assert.equal(hostState!.shiftSeconds, frozenSeconds, "the shift clock should stop for both players");
    assert.equal(hostState!.orders[0].patience, frozenPatience, "orders should not age while paused");
    assert.equal(hostState!.players[hostToken].x, frozenX, "movement should be rejected while paused");
    guest.emit("set-pause", false);
    await waitForState(host, () => hostState, (state) => state.pausedAt === null);
    await waitForState(guest, () => guestState, (state) => state.pausedAt === null);

    const recipe = recipeById(hostState!.orders[0].recipeId);
    const approachStation = async (station: Station, client = host, playerId = hostToken) => {
      const state = hostState!;
      const player = state.players[playerId];
      const start = { gridX: Math.floor(player.x / GRID_CELL_SIZE), gridY: Math.floor(player.y / GRID_CELL_SIZE) };
      const queue = [{ ...start, path: [] as { x: number; y: number }[] }];
      const visited = new Set([`${start.gridX}:${start.gridY}`]);
      let path: { x: number; y: number }[] | undefined;
      for (let index = 0; index < queue.length; index++) {
        const cell = queue[index];
        const point = gridCellCenter(cell.gridX, cell.gridY);
        if (nearbyStation(state.tavern, point)?.id === station.id) { path = cell.path.concat(point); break; }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const gridX = cell.gridX + dx, gridY = cell.gridY + dy;
          const key = `${gridX}:${gridY}`;
          if (gridX < 0 || gridY < 0 || gridX >= GRID_COLUMNS || gridY >= GRID_ROWS || visited.has(key) ||
            pointCollidesWithCounters(state.tavern, gridCellCenter(gridX, gridY))) continue;
          visited.add(key); queue.push({ gridX, gridY, path: cell.path.concat(point) });
        }
      }
      assert.ok(path, `route to ${station.id} must exist`);
      for (const point of path) {
        const sequence = hostState!.players[playerId].moveSequence + 1;
        client.emit("move", { ...point, direction: "down", moving: true, sequence });
        await waitForState(host, () => hostState, (state) => state.players[playerId].moveSequence >= sequence);
        assert.ok(Math.hypot(hostState!.players[playerId].x - point.x, hostState!.players[playerId].y - point.y) < 1);
      }
      assert.equal(nearbyStation(hostState!.tavern, hostState!.players[playerId])?.id, station.id);
    };
    const collectRecipe = async (recipeId: string) => {
      const selected = recipeById(recipeId);
      for (const ingredient of selected.ingredients) {
        smokeStage = `collect ${ingredient}`;
        const rawIngredient = ingredient === "chopped-tuna" ? "tuna" : ingredient;
        const station = hostState!.tavern.stations.find((candidate) => candidate.ingredient === rawIngredient);
        assert.ok(station, `missing station for ${ingredient}`);
        await approachStation(station);
        host.emit("interact");
        await waitForState(host, () => hostState, (state) => state.players[hostToken].carrying.includes(rawIngredient));
        if (ingredient === "chopped-tuna") {
          const board = hostState!.tavern.stations.find((candidate) => candidate.kind === "chop")!;
          await approachStation(board);
          host.emit("interact");
          await waitForState(host, () => hostState, (state) => state.tavern.stations.find((candidate) => candidate.id === board.id)?.preparedIngredient === ingredient);
          await waitForState(guest, () => guestState, (state) => state.tavern.stations.find((candidate) => candidate.id === board.id)?.preparedIngredient === ingredient);
          host.emit("interact");
          await waitForState(host, () => hostState, (state) => state.players[hostToken].carrying.includes(ingredient));
        }
      }
      await approachStation(hostState!.tavern.stations.find((station) => station.kind === "mix")!);
      host.emit("interact");
      await waitForState(host, () => hostState, (state) => state.mixing[hostToken]?.recipeId === selected.id);
    };
    const prepareRecipe = async (recipeId: string) => {
      const selected = recipeById(recipeId);
      for (const ingredient of [...selected.ingredients].reverse()) {
        smokeStage = `mix ${ingredient}`;
        host.emit("mix-ingredient", ingredient);
        await waitForState(host, () => hostState, (state) => state.mixing[hostToken]?.usedIngredients.includes(ingredient) ?? false);
      }
      for (const action of selected.preparation.actions) {
        const previousStep = hostState!.mixing[hostToken].stepIndex;
        if (action.kind === "timed-tool") {
          smokeStage = `time ${action.tool}`;
          host.emit("mix-tool-start", action.tool);
          await waitForState(host, () => hostState, (state) => Boolean(state.mixing[hostToken]?.toolStartedAt));
          await new Promise((resolve) => setTimeout(resolve, action.targetMs));
          host.emit("mix-tool-finish", action.tool);
        } else {
          smokeStage = `${action.style} rhythm`;
          for (let hit = 0; hit < action.hits; hit++) {
            if (hit) await new Promise((resolve) => setTimeout(resolve, action.intervalMs));
            host.emit("mix-rhythm-hit", { style: action.style, hand: action.style === "hand-mix" ? hit % 2 ? "right" : "left" : undefined });
            if (hit < action.hits - 1) await waitForState(host, () => hostState,
              (state) => state.mixing[hostToken]?.rhythmHits === hit + 1);
          }
        }
        await waitForState(host, () => hostState, (state) =>
          (state.mixing[hostToken]?.stepIndex ?? Number.MAX_SAFE_INTEGER) > previousStep);
      }
      await waitForState(host, () => hostState, (state) => state.players[hostToken].drink === selected.id && !state.mixing[hostToken]);
    };

    await collectRecipe(recipe.id);
    assert.deepEqual([...hostState!.players[hostToken].carrying].sort(), [...recipe.ingredients].sort());

    smokeStage = "open mixer";
    await waitForState(guest, () => guestState, (state) => state.mixing[hostToken]?.recipeId === recipe.id);

    const guestBefore = guestState!.players[guestToken];
    const guestSequence = guestBefore.moveSequence + 1;
    guest.emit("move", { x: guestBefore.x + 20, y: guestBefore.y, direction: "right", moving: true, sequence: guestSequence });
    await waitForState(guest, () => guestState, (state) => state.players[guestToken].moveSequence >= guestSequence);
    assert.notEqual(guestState!.players[guestToken].x, guestBefore.x, "the non-mixing client should remain mobile");

    await prepareRecipe(recipe.id);
    assert.ok((hostState!.players[hostToken].drinkQuality ?? 0) > 0.9, "on-target timing should create a high-quality drink");

    smokeStage = "shared counter handoff";
    const counter = hostState!.tavern.stations.find((station) => station.id === "counter-4-3")!;
    const quality = hostState!.players[hostToken].drinkQuality;
    await approachStation(counter);
    host.emit("counter-drink");
    await waitForState(guest, () => guestState, (state) => state.tavern.stations.find((station) => station.id === counter.id)?.drink?.recipeId === recipe.id);
    assert.equal(guestState!.players[hostToken].drink, undefined);
    await approachStation(counter, guest, guestToken);
    guest.emit("interact");
    await waitForState(host, () => hostState, (state) => state.players[guestToken].drink === recipe.id);
    assert.equal(hostState!.players[guestToken].drinkQuality, quality);
    assert.equal(hostState!.tavern.stations.find((station) => station.id === counter.id)?.drink, undefined);
    guest.emit("counter-drink");
    await waitForState(host, () => hostState, (state) => Boolean(state.tavern.stations.find((station) => station.id === counter.id)?.drink));
    host.emit("interact");
    await waitForState(host, () => hostState, (state) => state.players[hostToken].drink === recipe.id);
    assert.equal(hostState!.players[hostToken].drinkQuality, quality);

    smokeStage = "serve drink";
    const targetOrder = hostState!.orders.find((order) => order.recipeId === recipe.id)!;
    const wrongTable = hostState!.tavern.stations.find((station) => station.kind === "serve" && station.id !== targetOrder.tableId)!;
    await approachStation(wrongTable);
    host.emit("interact");
    await waitForState(host, () => hostState, (state) => state.message.includes("This table did not order"));
    assert.equal(hostState!.players[hostToken].drink, recipe.id);
    const service = hostState!.tavern.stations.find((station) => station.id === targetOrder.tableId)!;
    await approachStation(service);
    const coinsBefore = hostState!.coins;
    host.emit("interact");
    await waitForState(host, () => hostState, (state) => state.coins > coinsBefore && !state.players[hostToken].drink);
    assert.equal(hostState!.orders.some((order) => order.recipeId === recipe.id), false);

    // The advanced drink exercises both new actions while the second client
    // stays in the same authoritative room and keeps its own movement state.
    smokeStage = "advanced chop and hand mix";
    await collectRecipe("seafoam-shake");
    await prepareRecipe("seafoam-shake");
    assert.ok((hostState!.players[hostToken].drinkQuality ?? 0) > .85);
    await waitForState(guest, () => guestState, (state) => state.players[hostToken].drink === "seafoam-shake");
    assert.equal(guestState!.players[hostToken].drink, "seafoam-shake");

    console.log(JSON.stringify({
      ok: true,
      room: code,
      recipe: recipe.name,
      coinsAwarded: hostState!.coins - coinsBefore,
      twoClientMixingObserved: true,
      wrongTableRejectedWithoutLosingDrink: true,
      tableSpecificDeliveryVerified: true,
      secondClientMovedDuringMixing: true,
      advancedRhythmActionsCompleted: true,
      sharedPauseVerified: true,
      counterHandoffVerified: true
    }, null, 2));
  } finally {
    host.disconnect();
    guest.disconnect();
  }
}

main().catch((error) => {
  console.error(`Smoke stage: ${smokeStage}`);
  console.error(error);
  process.exitCode = 1;
});
