import express from "express";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import {
  applyMissedOrderPenalty, createMixingSession, expectedMixingStep, type CatRole, type FacingDirection, type GameState,
  initialState, makeOrder, makeTavern, MIXING_MAX_MISTAKES, mixingQuality,
  moveWithCounterCollisions, mulberry32, pauseShift, recipeById, recipeForIngredients, resumeShift, seededUpgrades,
  nearbyStation, transferCounterDrink, PLAYER_SPAWNS,
  rhythmTimingAccepted, rhythmTimingQuality, shiftDurationForRound, toolTimingAccepted, toolTimingQuality,
  type Hazard, type MixingSession, type MixingTool, type Player, type RhythmAction, type Station
} from "../shared/game.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" } });
const rooms = new Map<string, GameState>();
const seeds = new Map<string, number>();
const orderCounters = new Map<string, number>();
const hazardCounters = new Map<string, number>();
const random = () => Math.random();

app.get("/health", (_request, response) => response.json({ ok: true, rooms: rooms.size }));

function roomCode() {
  let code = "";
  while (!code || rooms.has(code)) code = Math.random().toString(36).slice(2, 6).toUpperCase();
  return code;
}
function broadcast(state: GameState) { io.to(state.code).emit("state", state); }
function findState(socketId: string) {
  const socket = io.sockets.sockets.get(socketId);
  const code = socket?.data.code as string | undefined;
  return code ? rooms.get(code) : undefined;
}
function playerFor(socketId: string, state: GameState) {
  const token = io.sockets.sockets.get(socketId)?.data.token as string | undefined;
  return token ? state.players[token] : undefined;
}
function setMessage(state: GameState, message: string) { state.message = message; }
function counterHandoff(state: GameState, player: Player, station: Station) {
  const result = transferCounterDrink(player, station);
  const messages = {
    placed: `${player.name} left a drink on the counter for the crew.`,
    "picked-up": `${player.name} picked up the prepared drink.`,
    occupied: "That surface or your paws are full. Use an empty counter first.",
    empty: "Finish mixing a drink, then set it here for another bartender.",
    unavailable: "Use a preparation counter to set down a drink."
  };
  setMessage(state, messages[result]);
}

function nextMixingInstruction(session: MixingSession) {
  const next = expectedMixingStep(session);
  if (!next) return "Drink complete.";
  if (next.kind === "ingredient") return `Add ${next.ingredient}.`;
  if (next.kind === "rhythm") return next.style === "chop"
    ? `Chop ${next.ingredient} ${next.hits} times to the beat.`
    : `Mix by alternating left and right paws ${next.hits} times to the beat.`;
  return `Hold the ${next.tool} for about ${(next.targetMs / 1000).toFixed(1)} seconds.`;
}

function failMixing(state: GameState, player: Player, message: string) {
  delete state.mixing[player.id];
  player.carrying = [];
  player.moving = false;
  setMessage(state, message);
}

function mixingMistake(state: GameState, player: Player, session: MixingSession, message: string) {
  session.mistakes += 1;
  session.toolStartedAt = undefined;
  session.rhythmHits = 0;
  session.rhythmLastHitAt = undefined;
  session.rhythmQualityPoints = 0;
  if (session.mistakes >= MIXING_MAX_MISTAKES) {
    failMixing(state, player, `${player.name}'s mixture failed after three mistakes. The ingredients were spoiled.`);
    return;
  }
  session.feedback = `${message} ${MIXING_MAX_MISTAKES - session.mistakes} chances left. ${nextMixingInstruction(session)}`;
  setMessage(state, `${player.name} made a mixing mistake.`);
}

function completeMixing(state: GameState, player: Player, session: MixingSession) {
  const recipe = recipeById(session.recipeId);
  const quality = mixingQuality(session, recipe);
  player.drink = recipe.id;
  player.drinkQuality = quality;
  player.carrying = [];
  player.moving = false;
  delete state.mixing[player.id];
  const qualityLabel = quality >= 0.88 ? "perfect" : quality >= 0.6 ? "tasty" : "rustic";
  setMessage(state, `${player.name} made a ${qualityLabel} ${recipe.name}!`);
}

function startShift(state: GameState) {
  state.phase = "shift";
  state.pausedAt = null;
  state.pausedBy = null;
  state.mixing = {};
  state.shiftSeconds = shiftDurationForRound(state.round);
  state.orders = [];
  state.hazard = null;
  Object.values(state.players).forEach((player, index) => {
    Object.assign(player, PLAYER_SPAWNS[index % PLAYER_SPAWNS.length]);
    player.carrying = []; player.drink = undefined; player.drinkQuality = undefined; player.moving = false;
  });
  state.message = `${state.tavern.theme}: shift ${state.round} is on!`;
  spawnOrder(state);
}
function spawnOrder(state: GameState) {
  const table = state.tavern.stations.find((station) => station.kind === "serve" && !state.orders.some((order) => order.tableId === station.id));
  if (!table) return;
  const counter = (orderCounters.get(state.code) ?? 0) + 1;
  orderCounters.set(state.code, counter);
  const elapsed = shiftDurationForRound(state.round) - state.shiftSeconds;
  state.orders.push({ ...makeOrder(`order-${counter}`, mulberry32((seeds.get(state.code) ?? 1) + counter * 31),
    state.round, elapsed, state.orderPatienceBonus), tableId: table.id });
}
function loseOrders(state: GameState, count: number, reason: string) {
  if (!count) return;
  applyMissedOrderPenalty(state, count);
  setMessage(state, `${reason} ${count} team heart${count === 1 ? "" : "s"} lost — ${state.health} left.`);
}
function spawnHazard(state: GameState): Hazard {
  const counter = (hazardCounters.get(state.code) ?? 0) + 1;
  hazardCounters.set(state.code, counter);
  const definitions: Omit<Hazard, "id">[] = [
    { kind: "napkins", message: "A mischievous mouse scatters napkins!", x: 493, y: 319 },
    { kind: "ectoplasm", message: "The spectral tap is leaking ectoplasm!", x: 783, y: 377 },
    { kind: "fire", message: "A tiny kitchen fire is sizzling!", x: 203, y: 377 }
  ];
  const hazard = { id: `hazard-${counter}`, ...definitions[Math.floor(random() * definitions.length)] };
  state.hazard = hazard;
  return hazard;
}
function endShift(state: GameState) {
  state.mixing = {};
  state.phase = "upgrades";
  state.upgrades = seededUpgrades(seeds.get(state.code) ?? 1, state.round);
  state.message = "Shift complete! The crew chooses one keepsake for the next tavern.";
}
function failRun(state: GameState) {
  state.mixing = {};
  state.phase = "complete";
  state.message = "The tavern cat-astrophe got the better of the crew. Start a fresh run!";
}
function resetForRound(state: GameState, upgradeId: string) {
  const seed = seeds.get(state.code) ?? 1;
  state.round += 1;
  state.tavern = makeTavern(seed, state.round);
  state.orderPatienceBonus = upgradeId === "patient-patrons" ? 12 : 0;
  if (upgradeId === "nine-lives") state.health = Math.min(3, state.health + 1);
  startShift(state);
  if (upgradeId === "nine-lives") state.message = `Nine Lives restored a heart. ${state.health} team hearts remain.`;
  else if (upgradeId === "patient-patrons") state.message = "Patient Patrons gives each order 12 extra seconds this shift.";
  else if (upgradeId === "swift-paws") state.message = "Swift Paws acquired: the cats feel zoomy.";
}

io.on("connection", (socket) => {
  socket.on("create-room", (payload: { token: string; name: string; role: CatRole; fur: string; accessory: string }) => {
    const code = roomCode();
    const seed = Math.floor(Math.random() * 2 ** 31);
    const state = initialState(code, payload.token, seed);
    rooms.set(code, state); seeds.set(code, seed); orderCounters.set(code, 0); hazardCounters.set(code, 0);
    joinRoom(socket.id, state, payload, true);
  });

  socket.on("join-room", (payload: { code: string; token: string; name: string; role: CatRole; fur: string; accessory: string }) => {
    const state = rooms.get(payload.code.toUpperCase());
    if (!state) return socket.emit("error-message", "That room code does not exist.");
    if (state.phase === "complete") return socket.emit("error-message", "This run is over—please create a fresh room.");
    if (!state.players[payload.token] && Object.keys(state.players).length >= 4) return socket.emit("error-message", "This tavern is full (4 cats maximum).");
    joinRoom(socket.id, state, payload, false);
  });

  socket.on("start-shift", () => {
    const state = findState(socket.id); const player = state && playerFor(socket.id, state);
    if (!state || !player || state.hostId !== player.id || state.phase !== "lobby") return;
    startShift(state); broadcast(state);
  });

  socket.on("set-pause", (paused: boolean) => {
    const state = findState(socket.id); const player = state && playerFor(socket.id, state);
    if (!state || !player || !player.connected || state.phase !== "shift" || typeof paused !== "boolean") return;
    const changed = paused ? pauseShift(state, player.id) : resumeShift(state);
    if (!changed) return;
    setMessage(state, paused ? `${player.name} paused the shift for everyone.` : `${player.name} resumed the shift.`);
    broadcast(state);
  });

  socket.on("move", (position: { x: number; y: number; direction?: FacingDirection; moving?: boolean; sequence?: number }) => {
    const state = findState(socket.id); const player = state && playerFor(socket.id, state);
    if (!state || !player || state.phase !== "shift" || state.pausedAt !== null) return;
    if (state.mixing[player.id]) {
      if (player.moving) { player.moving = false; broadcast(state); }
      return;
    }
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return;
    const lastSequence = player.moveSequence ?? 0;
    const sequence = Number.isSafeInteger(position.sequence) && position.sequence! >= 0 ? position.sequence! : lastSequence + 1;
    if (sequence <= lastSequence) return;
    const resolved = moveWithCounterCollisions(state.tavern, player, position);
    player.x = resolved.x;
    player.y = resolved.y;
    if (["down", "left", "right", "up"].includes(position.direction ?? "")) player.direction = position.direction!;
    player.moving = Boolean(position.moving); player.moveSequence = sequence;
    broadcast(state);
  });

  socket.on("interact", () => {
    const state = findState(socket.id); const player = state && playerFor(socket.id, state);
    if (!state || !player || state.phase !== "shift" || state.pausedAt !== null) return;
    if (state.mixing[player.id]) return;
    const nearby = nearbyStation(state.tavern, player);
    if (!nearby) return setMessage(state, "Walk up to a brightly colored station, then press E.");
    if (nearby.kind === "counter" || nearby.drink) {
      counterHandoff(state, player, nearby); broadcast(state); return;
    }
    if (nearby.kind === "pantry") {
      if (player.drink) setMessage(state, "Set your finished drink on a counter with Q, or serve it first.");
      else if (player.carrying.length >= 3) setMessage(state, `${player.name}'s paws are full—mix those ingredients first.`);
      else {
        const ingredient = nearby.ingredient;
        if (!ingredient) return setMessage(state, "Choose an ingredient from the prep table.");
        if (player.carrying.includes(ingredient)) setMessage(state, `${player.name} already has ${ingredient}. Choose another ingredient.`);
        else { player.carrying.push(ingredient); setMessage(state, `${player.name} selected ${ingredient}.`); }
      }
    }
    if (nearby.kind === "mix") {
      const recipe = recipeForIngredients(player.carrying);
      if (!recipe) {
        if (player.carrying.length >= 3) {
          player.carrying = [];
          setMessage(state, "That combination is not on tonight's menu, so it was discarded. Gather a fresh recipe.");
        } else setMessage(state, "Gather all three recipe ingredients before opening the workbench.");
      }
      else if (player.drink) setMessage(state, `${player.name} is already carrying a finished drink.`);
      else {
        state.mixing[player.id] = createMixingSession(player.id, recipe.id);
        player.moving = false;
        setMessage(state, `${player.name} opened the workbench for ${recipe.name}.`);
      }
    }
    if (nearby.kind === "serve") {
      if (!player.drink) setMessage(state, "No drink in paw. Mix something first!");
      else {
        const index = state.orders.findIndex((order) => order.tableId === nearby.id && order.recipeId === player.drink);
        if (index < 0) setMessage(state, "This table did not order that drink. Check the table number on the ticket.");
        else {
          const [order] = state.orders.splice(index, 1);
          const patienceQuality = order.patience / order.maxPatience;
          const preparationQuality = player.drinkQuality ?? 1;
          const combinedQuality = patienceQuality * 0.6 + preparationQuality * 0.4;
          const tip = Math.max(3, (patienceQuality > 0.6 ? 8 : 5) + (preparationQuality >= 0.88 ? 2 : preparationQuality < 0.45 ? -2 : 0));
          state.coins += tip; state.reputation += combinedQuality > 0.6 ? 2 : 1; player.score += tip;
          player.drink = undefined; player.drinkQuality = undefined;
          setMessage(state, `${order.customer} purrs with delight! +${tip} coins.`);
        }
      }
    }
    if (nearby.kind === "seat") setMessage(state, "Walk around to the front or side of the table to serve this guest.");
    if (nearby.kind === "trash") {
      if (player.drink) {
        const drink = recipeById(player.drink).name;
        player.drink = undefined; player.drinkQuality = undefined;
        setMessage(state, `${player.name} discarded the ${drink}.`);
      } else if (player.carrying.length) {
        const discarded = player.carrying.join(", ");
        player.carrying = [];
        setMessage(state, `${player.name} tossed ${discarded} into the scrap bin.`);
      } else setMessage(state, "Nothing to toss out. Your paws are clear.");
    }
    if (nearby.kind === "mop" && state.hazard) { state.hazard = null; setMessage(state, `${player.name} cleaned up the hazard. Good kitty!`); }
    broadcast(state);
  });

  socket.on("counter-drink", () => {
    const state = findState(socket.id); const player = state && playerFor(socket.id, state);
    if (!state || !player || state.phase !== "shift" || state.pausedAt !== null || state.mixing[player.id]) return;
    const station = nearbyStation(state.tavern, player);
    if (station) counterHandoff(state, player, station);
    else setMessage(state, "Move beside a counter to place or pick up a drink.");
    broadcast(state);
  });

  socket.on("mix-ingredient", (ingredient: string) => {
    const state = findState(socket.id); const player = state && playerFor(socket.id, state);
    if (!state || !player || state.phase !== "shift" || state.pausedAt !== null || typeof ingredient !== "string") return;
    const session = state.mixing[player.id];
    if (!session) return;
    const expected = expectedMixingStep(session);
    const availableCount = player.carrying.filter((item) => item === ingredient).length;
    const usedCount = session.usedIngredients.filter((item) => item === ingredient).length;
    if (!expected || expected.kind !== "ingredient" || expected.ingredient !== ingredient || usedCount >= availableCount) {
      mixingMistake(state, player, session, `That ingredient is out of sequence.`);
    } else {
      session.usedIngredients.push(ingredient);
      session.stepIndex += 1;
      session.qualityPoints += 1;
      session.feedback = nextMixingInstruction(session);
      setMessage(state, `${player.name} added ${ingredient}.`);
    }
    broadcast(state);
  });

  socket.on("mix-tool-start", (tool: MixingTool) => {
    const state = findState(socket.id); const player = state && playerFor(socket.id, state);
    if (!state || !player || state.phase !== "shift" || state.pausedAt !== null) return;
    const session = state.mixing[player.id];
    if (!session) return;
    const expected = expectedMixingStep(session);
    if (!expected || expected.kind !== "timed-tool" || expected.tool !== tool) {
      mixingMistake(state, player, session, `That is not the next tool.`);
    } else if (session.toolStartedAt === undefined) {
      session.toolStartedAt = Date.now();
      session.feedback = `Keep holding the ${tool}…`;
    }
    broadcast(state);
  });

  socket.on("mix-tool-finish", (tool: MixingTool) => {
    const state = findState(socket.id); const player = state && playerFor(socket.id, state);
    if (!state || !player || state.phase !== "shift" || state.pausedAt !== null) return;
    const session = state.mixing[player.id];
    if (!session) return;
    const expected = expectedMixingStep(session);
    if (!expected || expected.kind !== "timed-tool" || expected.tool !== tool || session.toolStartedAt === undefined) {
      mixingMistake(state, player, session, `Start and finish the highlighted tool.`);
    } else {
      const elapsedMs = Date.now() - session.toolStartedAt;
      session.toolStartedAt = undefined;
      if (!toolTimingAccepted(elapsedMs, expected)) {
        mixingMistake(state, player, session, elapsedMs < expected.targetMs ? "Released too soon." : "Held too long.");
      } else {
        session.qualityPoints += toolTimingQuality(elapsedMs, expected);
        session.stepIndex += 1;
        if (expectedMixingStep(session)) session.feedback = nextMixingInstruction(session);
        else completeMixing(state, player, session);
      }
    }
    broadcast(state);
  });

  socket.on("mix-rhythm-hit", (payload: { style: RhythmAction["style"]; hand?: "left" | "right" }) => {
    const state = findState(socket.id); const player = state && playerFor(socket.id, state);
    if (!state || !player || state.phase !== "shift" || state.pausedAt !== null || !payload || typeof payload !== "object") return;
    const session = state.mixing[player.id];
    if (!session) return;
    const expected = expectedMixingStep(session);
    if (!expected || expected.kind !== "rhythm" || expected.style !== payload.style ||
      (expected.style === "hand-mix" && payload.hand !== (session.rhythmHits % 2 === 0 ? "left" : "right"))) {
      mixingMistake(state, player, session, "That was the wrong preparation move.");
    } else {
      const now = Date.now();
      const elapsed = session.rhythmLastHitAt === undefined ? undefined : now - session.rhythmLastHitAt;
      if (elapsed !== undefined && !rhythmTimingAccepted(elapsed, expected)) {
        mixingMistake(state, player, session, elapsed < expected.intervalMs ? "Too soon for the beat." : "Missed the beat.");
      } else {
        session.rhythmHits += 1;
        session.rhythmLastHitAt = now;
        if (elapsed !== undefined) session.rhythmQualityPoints += rhythmTimingQuality(elapsed, expected);
        if (session.rhythmHits >= expected.hits) {
          session.qualityPoints += (1 + session.rhythmQualityPoints) / expected.hits;
          session.rhythmHits = 0;
          session.rhythmLastHitAt = undefined;
          session.rhythmQualityPoints = 0;
          session.stepIndex += 1;
          if (expectedMixingStep(session)) session.feedback = nextMixingInstruction(session);
          else completeMixing(state, player, session);
        } else {
          session.feedback = `${expected.style === "chop" ? "Chop" : "Hand mix"} ${session.rhythmHits}/${expected.hits} · follow the beat.`;
        }
      }
    }
    broadcast(state);
  });

  socket.on("cancel-mixing", () => {
    const state = findState(socket.id); const player = state && playerFor(socket.id, state);
    if (!state || !player || state.pausedAt !== null || !state.mixing[player.id]) return;
    delete state.mixing[player.id];
    player.moving = false;
    setMessage(state, `${player.name} stepped away from the workbench. Ingredients were kept.`);
    broadcast(state);
  });

  socket.on("choose-upgrade", (upgradeId: string) => {
    const state = findState(socket.id); const player = state && playerFor(socket.id, state);
    if (!state || !player || state.hostId !== player.id || state.phase !== "upgrades") return;
    if (!state.upgrades.some((upgrade) => upgrade.id === upgradeId)) return;
    resetForRound(state, upgradeId); broadcast(state);
  });

  socket.on("disconnect", () => {
    const state = findState(socket.id); const player = state && playerFor(socket.id, state);
    if (!state || !player) return;
    player.connected = false; player.moving = false;
    setMessage(state, `${player.name} disconnected. Their cat will wait for a reconnection.`);
    broadcast(state);
  });
});

function joinRoom(socketId: string, state: GameState, payload: { token: string; name: string; role: CatRole; fur: string; accessory: string }, isHost: boolean) {
  const socket = io.sockets.sockets.get(socketId)!;
  const existing = state.players[payload.token];
  state.players[payload.token] = existing ?? {
    id: payload.token, name: payload.name.slice(0, 16) || "Mittens", role: payload.role, fur: payload.fur,
    accessory: payload.accessory, ...PLAYER_SPAWNS[Object.keys(state.players).length % PLAYER_SPAWNS.length],
    direction: "down", moving: false, moveSequence: 0, carrying: [], connected: true, score: 0
  } as Player;
  Object.assign(state.players[payload.token], { name: payload.name.slice(0, 16) || "Mittens", role: payload.role, fur: payload.fur, accessory: payload.accessory, connected: true });
  socket.data.code = state.code; socket.data.token = payload.token; socket.join(state.code);
  if (!isHost) setMessage(state, existing ? `${payload.name} rejoined the tavern.` : `${payload.name} padded into the tavern.`);
  socket.emit("joined", { code: state.code, token: payload.token });
  broadcast(state);
}

setInterval(() => {
  for (const state of rooms.values()) {
    if (state.phase !== "shift" || state.pausedAt !== null) continue;
    const now = Date.now();
    for (const [playerId, session] of Object.entries(state.mixing)) {
      if (now < session.deadlineAt) continue;
      const player = state.players[playerId];
      if (player) failMixing(state, player, `${player.name} ran out of preparation time. The ingredients were spoiled.`);
      else delete state.mixing[playerId];
    }
    state.shiftSeconds -= 1;
    state.orders.forEach((order) => order.patience -= 1);
    const lost = state.orders.filter((order) => order.patience <= 0);
    if (lost.length) {
      state.orders = state.orders.filter((order) => order.patience > 0);
      loseOrders(state, lost.length, "Customers stormed out!");
    }
    const elapsed = shiftDurationForRound(state.round) - state.shiftSeconds;
    const spawnInterval = Math.max(9, 12 - (state.round - 1));
    const activeCrew = Object.values(state.players).filter((player) => player.connected).length;
    const maxPendingOrders = activeCrew > 1 ? 3 : 2;
    if (state.shiftSeconds >= 35 && elapsed > 0 && elapsed % spawnInterval === 0 && state.orders.length < maxPendingOrders) spawnOrder(state);
    if (state.shiftSeconds > 0 && state.shiftSeconds % 18 === 0) {
      const hazard = spawnHazard(state);
      setMessage(state, `Hazard: ${hazard.message} Use the mop bucket!`);
    }
    const closingMisses = state.shiftSeconds <= 0 ? state.orders.length : 0;
    if (closingMisses) {
      loseOrders(state, closingMisses, "Unserved orders closed with the shift!");
      state.orders = [];
    }
    if (state.health <= 0) failRun(state);
    else if (state.shiftSeconds <= 0) {
      endShift(state);
      if (closingMisses) setMessage(state, `Shift complete, but ${closingMisses} unserved order${closingMisses === 1 ? "" : "s"} cost team hearts. ${state.health} remain.`);
    }
    broadcast(state);
  }
}, 1000);

// In production, this turns the game into one deployable service: the Node process
// serves both the Vite-built client and its authoritative Socket.IO game server.
const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const clientDirectory = join(moduleDirectory, "../../dist");
if (existsSync(clientDirectory)) {
  app.use(express.static(clientDirectory));
  app.get("/{*splat}", (_request, response) => response.sendFile(join(clientDirectory, "index.html")));
}

const port = Number(process.env.PORT ?? 3001);
httpServer.listen(port, () => console.log(`Paws & Pours server listening on http://localhost:${port}`));
