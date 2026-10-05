import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import { recipeById, type CatRole, type GameState, type Station } from "../shared/game.js";

const serverUrl = process.env.SMOKE_SERVER_URL ?? "http://localhost:3001";
const hostToken = `smoke-host-${Date.now()}`;
const guestToken = `smoke-guest-${Date.now()}`;
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
  const host = await connectedSocket();
  const guest = await connectedSocket();
  let hostState: GameState | undefined;
  let guestState: GameState | undefined;
  host.on("state", (state: GameState) => { hostState = state; });
  guest.on("state", (state: GameState) => { guestState = state; });

  try {
    const joinedHost = new Promise<{ code: string }>((resolve) => host.once("joined", resolve));
    host.emit("create-room", profile(hostToken, "Smoke Host"));
    const { code } = await joinedHost;
    await waitForState(host, () => hostState, (state) => state.code === code && Boolean(state.players[hostToken]));

    guest.emit("join-room", { ...profile(guestToken, "Smoke Guest"), code });
    await waitForState(host, () => hostState, (state) => Boolean(state.players[guestToken]));
    await waitForState(guest, () => guestState, (state) => state.code === code && Boolean(state.players[guestToken]));
    host.emit("start-shift");
    await waitForState(host, () => hostState, (state) => state.phase === "shift" && state.orders.length > 0);

    const recipe = recipeById(hostState!.orders[0].recipeId);
    let moveSequence = hostState!.players[hostToken].moveSequence;
    const moveHost = async (x: number, y: number) => {
      moveSequence += 1;
      host.emit("move", { x, y, direction: "down", moving: true, sequence: moveSequence });
      await waitForState(host, () => hostState, (state) => state.players[hostToken].moveSequence >= moveSequence);
    };
    const laneX = 370;
    const approachStation = async (station: Station) => {
      const player = hostState!.players[hostToken];
      if (player.y < 300) await moveHost(laneX, 212);
      await moveHost(laneX, 350);
      const approachY = station.gridY === 1 ? 212 : 329;
      await moveHost(laneX, approachY);
      await moveHost(station.x, approachY);
    };

    for (const ingredient of recipe.ingredients) {
      const station = hostState!.tavern.stations.find((candidate) => candidate.ingredient === ingredient);
      assert.ok(station, `missing station for ${ingredient}`);
      await approachStation(station);
      host.emit("interact");
      await waitForState(host, () => hostState, (state) => state.players[hostToken].carrying.includes(ingredient));
    }
    assert.deepEqual([...hostState!.players[hostToken].carrying].sort(), [...recipe.ingredients].sort());

    const mixer = hostState!.tavern.stations.find((station) => station.kind === "mix")!;
    await moveHost(laneX, 350);
    await moveHost(mixer.x, 350);
    await moveHost(mixer.x, mixer.y + 45);
    host.emit("interact");
    await waitForState(host, () => hostState, (state) => state.mixing[hostToken]?.recipeId === recipe.id);
    await waitForState(guest, () => guestState, (state) => state.mixing[hostToken]?.recipeId === recipe.id);

    const guestBefore = guestState!.players[guestToken];
    const guestSequence = guestBefore.moveSequence + 1;
    guest.emit("move", { x: guestBefore.x + 20, y: guestBefore.y, direction: "right", moving: true, sequence: guestSequence });
    await waitForState(guest, () => guestState, (state) => state.players[guestToken].moveSequence >= guestSequence);
    assert.notEqual(guestState!.players[guestToken].x, guestBefore.x, "the non-mixing client should remain mobile");

    for (const ingredient of recipe.ingredients) {
      host.emit("mix-ingredient", ingredient);
      await waitForState(host, () => hostState, (state) => state.mixing[hostToken]?.usedIngredients.includes(ingredient) ?? false);
    }
    const tool = recipe.preparation.actions[0];
    host.emit("mix-tool-start", tool.tool);
    await waitForState(host, () => hostState, (state) => Boolean(state.mixing[hostToken]?.toolStartedAt));
    await new Promise((resolve) => setTimeout(resolve, tool.targetMs));
    host.emit("mix-tool-finish", tool.tool);
    await waitForState(host, () => hostState, (state) => state.players[hostToken].drink === recipe.id && !state.mixing[hostToken]);
    assert.ok((hostState!.players[hostToken].drinkQuality ?? 0) > 0.9, "on-target timing should create a high-quality drink");

    const service = hostState!.tavern.stations.find((station) => station.kind === "serve")!;
    await moveHost(mixer.x, mixer.y + 45);
    await moveHost(service.x, service.y + 45);
    const coinsBefore = hostState!.coins;
    host.emit("interact");
    await waitForState(host, () => hostState, (state) => state.coins > coinsBefore && !state.players[hostToken].drink);
    assert.equal(hostState!.orders.some((order) => order.recipeId === recipe.id), false);

    console.log(JSON.stringify({
      ok: true,
      room: code,
      recipe: recipe.name,
      coinsAwarded: hostState!.coins - coinsBefore,
      twoClientMixingObserved: true,
      secondClientMovedDuringMixing: true
    }, null, 2));
  } finally {
    host.disconnect();
    guest.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
