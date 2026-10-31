import express from "express";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { restoreSoloSnapshot } from "../shared/solo-save.js";
import { applyKeepsake, keepsakeEffects, keepsakeSummary, consumeRecipeIngredients, servingReward } from "../shared/keepsakes.js";
import { openChoppingBoard, chooseChoppingIngredient, finishChopping } from "../shared/chopping.js";
import { usesDrinkHandoff } from "../shared/interaction.js";
import {
  applyMissedOrderPenalty, createMixingSession, expectedMixingStep, type CatRole, type FacingDirection, type GameState,
  initialState, makeOrder, makeTavern, MIXING_MAX_MISTAKES, mixingQuality,
  moveWithCounterCollisions, mulberry32, pauseShift, recipeById, recipesForCarriedIngredients, resumeShift, seededUpgrades,
  nearbyStation, transferCounterDrink, RECIPES, PLAYER_SPAWNS, addMixingIngredient, rawIngredient, nextCustomerSeat, servingOrderIndex,
  rhythmTimingAccepted, rhythmTimingQuality, shiftDurationForRound, toolTimingAccepted, toolTimingQuality,
  TAVERN_THEMES, type KeepsakeId, type Hazard, type MixingSession, type MixingTool, type Player, type RhythmAction, type Station
} from "../shared/game.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" } });
const rooms = new Map<string, GameState>();
const soloRooms = new Set<string>();
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
  const result = transferCounterDrink(player, station, keepsakeEffects(state.activeKeepsake).carryCapacity);
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
  if (next.kind === "ingredient") return "Add your ingredients in any order.";
  if (next.kind === "rhythm") return next.style === "chop"
    ? `Chop ${next.ingredient} ${next.hits} times to the beat.`
    : `Mix by alternating left and right paws ${next.hits} times to the beat.`;
  return `Hold the ${next.tool} for about ${(next.targetMs / 1000).toFixed(1)} seconds.`;
}

function failMixing(state: GameState, player: Player, message: string) {
  const session = state.mixing[player.id];
  if(session)consumeRecipeIngredients(player,recipeById(session.recipeId));
  delete state.mixing[player.id];
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
    failMixing(state, player, `${player.name}'s mixture failed after three mistakes. The preparation ingredients were spoiled.`);
    return;
  }
  session.feedback = `${message} ${MIXING_MAX_MISTAKES - session.mistakes} chances left. ${nextMixingInstruction(session)}`;
  setMessage(state, `${player.name} made a mixing mistake.`);
}

function completeMixing(state: GameState, player: Player, session: MixingSession) {
  if(session.kind === "chop") { finishChopping(state,player,session); return; }
  const recipe = recipeById(session.recipeId);
  const quality = mixingQuality(session, recipe);
  player.drink = recipe.id;
  player.drinkQuality = quality;
  consumeRecipeIngredients(player,recipe);
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
  state.mixingChoices = {};
  state.shiftSeconds = shiftDurationForRound(state.round);
  state.orders = [];
  state.hazard = null;
  Object.values(state.players).forEach((player, index) => {
    Object.assign(player, PLAYER_SPAWNS[index % PLAYER_SPAWNS.length]);
    player.carrying = []; player.ingredientQualities = {}; player.drink = undefined; player.drinkQuality = undefined; player.moving = false;
  });
  state.message = `${state.tavern.theme}: shift ${state.round} is on!`;
  spawnOrder(state);
}
function spawnOrder(state: GameState) {
  const counter = (orderCounters.get(state.code) ?? 0) + 1;
  const seat = nextCustomerSeat(state.tavern, state.orders, counter - 1);
  if (!seat) return;
  orderCounters.set(state.code, counter);
  const elapsed = shiftDurationForRound(state.round) - state.shiftSeconds;
  state.orders.push({ ...makeOrder(`order-${counter}`, mulberry32((seeds.get(state.code) ?? 1) + counter * 31),
    state.round, elapsed, state.orderPatienceBonus), tableId: seat.tableId, seatId: seat.id });
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
  state.mixingChoices = {};
  state.phase = "upgrades";
  state.upgrades = seededUpgrades(seeds.get(state.code) ?? 1, state.round, state.health);
  state.message = "Shift complete! The crew chooses one keepsake for the next tavern.";
}
function failRun(state: GameState) {
  state.mixing = {};
  state.mixingChoices = {};
  state.phase = "complete";
  state.message = "The tavern cat-astrophe got the better of the crew. Start a fresh run!";
}
function resetForRound(state: GameState, upgradeId: KeepsakeId) {
  const seed = seeds.get(state.code) ?? 1, previousTheme = state.tavern.theme;
  state.round += 1;
  state.tavern = makeTavern(seed, state.round);
  // Legacy saves may have a theme chosen by the old random sequence.
  if (state.tavern.theme === previousTheme) state.tavern.theme = TAVERN_THEMES[(TAVERN_THEMES.indexOf(previousTheme) + 1) % TAVERN_THEMES.length];
  applyKeepsake(state, upgradeId);
  startShift(state);
  state.message = `${state.tavern.theme}: shift ${state.round}. ${keepsakeSummary(upgradeId)}.`;
}

io.on("connection", (socket) => {
  socket.on("create-room", (payload: { token: string; name: string; role: CatRole; fur: string; accessory: string; solo?: boolean; snapshot?: unknown }) => {
    const code = roomCode();
    const seed = Math.floor(Math.random() * 2 ** 31);
    const state = initialState(code, payload.token, seed);
    rooms.set(code, state); seeds.set(code, seed); orderCounters.set(code, 0); hazardCounters.set(code, 0);
    joinRoom(socket.id, state, payload, true, false);
    if (payload.solo) {
      soloRooms.add(code);
      if (payload.snapshot) {
        const restored = restoreSoloSnapshot(payload.snapshot, code, state.players[payload.token]);
        if (!restored) {
          rooms.delete(code); soloRooms.delete(code); seeds.delete(code); orderCounters.delete(code); hazardCounters.delete(code);
          socket.leave(code); socket.data.code = undefined;
          socket.emit("error-message", "This save could not be restored. Your stored save has not been changed."); return;
        }
        rooms.set(code, restored); seeds.set(code, restored.tavern.seed);
      } else startShift(state);
    }
    socket.emit("joined", { code, token: payload.token });
    broadcast(rooms.get(code)!);
  });

  socket.on("join-room", (payload: { code: string; token: string; name: string; role: CatRole; fur: string; accessory: string }) => {
    const state = rooms.get(payload.code.toUpperCase());
    if (!state) return socket.emit("error-message", "That room code does not exist.");
    if (soloRooms.has(state.code) && payload.token !== state.hostId) return socket.emit("error-message", "Local solo saves cannot be joined as multiplayer rooms.");
    if (state.phase === "complete") return socket.emit("error-message", "This run is over—please create a fresh room.");
    if (!state.players[payload.token] && Object.keys(state.players).length >= 4) return socket.emit("error-message", "This tavern is full (4 cats maximum).");
    joinRoom(socket.id, state, payload, false);
  });

  socket.on("start-shift", () => {
    const state = findState(socket.id); const player = state && playerFor(socket.id, state);
    if (!state || !player || state.hostId !== player.id || state.phase !== "lobby") return;
    const crew = Object.values(state.players);
    if (crew.length < 2 || crew.some((cat) => !cat.connected || !cat.ready))
      return socket.emit("error-message", "At least two bartenders must be connected and ready to start.");
    startShift(state); broadcast(state);
  });

  socket.on("lobby-profile", (payload: { name?: string; role?: CatRole; fur?: string; accessory?: string }) => {
    const state = findState(socket.id); const player = state && playerFor(socket.id, state);
    if (!state || !player || state.phase !== "lobby" || !payload) return;
    if (typeof payload.name === "string") player.name = payload.name.trim().slice(0, 16) || "Mittens";
    if (["Tabby", "Siamese", "Maine Coon", "Black Cat", "Calico"].includes(payload.role ?? "")) player.role = payload.role!;
    if (typeof payload.fur === "string" && /^#[0-9a-f]{6}$/i.test(payload.fur)) player.fur = payload.fur;
    if (["Bow tie", "Wizard hat", "Pirate patch", "Flower crown"].includes(payload.accessory ?? "")) player.accessory = payload.accessory!;
    player.ready = false; broadcast(state);
  });

  socket.on("lobby-ready", (ready: boolean) => {
    const state = findState(socket.id); const player = state && playerFor(socket.id, state);
    if (!state || !player || state.phase !== "lobby" || typeof ready !== "boolean") return;
    player.ready = ready; broadcast(state);
  });

  socket.on("leave-lobby", () => {
    const state = findState(socket.id); const player = state && playerFor(socket.id, state);
    if (!state || !player || state.phase !== "lobby") return;
    delete state.players[player.id]; socket.leave(state.code); socket.data.code = undefined; socket.data.token = undefined;
    if (state.hostId === player.id) state.hostId = Object.values(state.players).find((cat) => cat.connected)?.id ?? Object.keys(state.players)[0] ?? "";
    if (!Object.keys(state.players).length) {
      rooms.delete(state.code); seeds.delete(state.code); orderCounters.delete(state.code); hazardCounters.delete(state.code);
    } else broadcast(state);
    socket.emit("left-lobby");
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
    if (state.mixing[player.id] || state.mixingChoices?.[player.id]) {
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
    if (state.mixing[player.id] || state.mixingChoices?.[player.id]) return;
    const nearby = nearbyStation(state.tavern, player);
    if (!nearby) return setMessage(state, "Walk up to a brightly colored station, then press E.");
    if (usesDrinkHandoff(player, nearby)) {
      counterHandoff(state, player, nearby); broadcast(state); return;
    }
    if (nearby.kind === "pantry") {
      if (player.drink) setMessage(state, "Set your finished drink on a counter with Q, or serve it first.");
      else if (player.carrying.length >= keepsakeEffects(state.activeKeepsake).carryCapacity) setMessage(state, `${player.name}'s paws are full—mix those ingredients first.`);
      else {
        const ingredient = nearby.ingredient;
        if (!ingredient) return setMessage(state, "Choose an ingredient from the prep table.");
        if (player.carrying.includes(ingredient)) setMessage(state, `${player.name} already has ${ingredient}. Choose another ingredient.`);
        else { player.carrying.push(ingredient); setMessage(state, `${player.name} selected ${ingredient}.`); }
      }
    }
    if (nearby.kind === "mix") {
      const recipes = recipesForCarriedIngredients(player.carrying);
      const recipe = recipes[0];
      // Check raw equivalents without discarding ingredients that only need prep.
      const unpreparedMatch = !recipe && RECIPES.some(candidate=>candidate.ingredients.every(ingredient=>player.carrying.some(item=>rawIngredient(item)===rawIngredient(ingredient))));
      if(unpreparedMatch){setMessage(state,"Chop the marked ingredients at the chopping board, then bring the prepared recipe here.");broadcast(state);return;}
      if (!recipe) {
        if (player.carrying.length >= 3) {
          player.carrying = [];
          setMessage(state, "That combination is not on tonight's menu, so it was discarded. Gather a fresh recipe.");
        } else setMessage(state, "Gather all three recipe ingredients before opening the workbench.");
      }
      else if (player.drink) setMessage(state, `${player.name} is already carrying a finished drink.`);
      else if (recipes.length > 1) {
        state.mixingChoices ??= {};
        state.mixingChoices[player.id] = recipes.map(recipe => recipe.id);
        player.moving = false;
        setMessage(state, "Choose a drink to prepare. Spare ingredients stay in your bag.");
      } else {
        state.mixing[player.id] = createMixingSession(player.id, recipe.id);
        player.moving = false;
        setMessage(state, `${player.name} opened the workbench for ${recipe.name}.`);
      }
    }
    if (nearby.kind === "chop") {
      openChoppingBoard(state,player,nearby);
    }
    if (nearby.kind === "serve" || nearby.kind === "seat") {
      if (!player.drink) setMessage(state, "No drink in paw. Mix something first!");
      else {
        const index = servingOrderIndex(state.tavern, state.orders, nearby, player.drink);
        if (index < 0) setMessage(state, "This table did not order that drink. Check the table or bar number on the ticket.");
        else {
          const [order] = state.orders.splice(index, 1);
          const patienceQuality = order.patience / order.maxPatience;
          const preparationQuality = player.drinkQuality ?? 1;
          const { tip, reputation, bonus } = servingReward(patienceQuality, preparationQuality, state.activeKeepsake);
          state.coins += tip; state.reputation += reputation; player.score += tip;
          player.drink = undefined; player.drinkQuality = undefined;
          setMessage(state, `${order.customer} purrs with delight! +${tip} coins.${bonus ? ` Includes +${bonus} from Lucky Whiskers.` : ""}`);
        }
      }
    }
    if (nearby.kind === "trash") {
      if (player.drink) {
        const drink = recipeById(player.drink).name;
        player.drink = undefined; player.drinkQuality = undefined;
        setMessage(state, `${player.name} discarded the ${drink}.`);
      } else if (player.carrying.length) {
        const discarded = player.carrying.join(", ");
        player.carrying = []; player.ingredientQualities = {};
        setMessage(state, `${player.name} tossed ${discarded} into the scrap bin.`);
      } else setMessage(state, "Nothing to toss out. Your paws are clear.");
    }
    if (nearby.kind === "mop" && state.hazard) { state.hazard = null; setMessage(state, `${player.name} cleaned up the hazard. Good kitty!`); }
    broadcast(state);
  });

  socket.on("counter-drink", () => {
    const state = findState(socket.id); const player = state && playerFor(socket.id, state);
    if (!state || !player || state.phase !== "shift" || state.pausedAt !== null || state.mixing[player.id] || state.mixingChoices?.[player.id]) return;
    const station = nearbyStation(state.tavern, player);
    if (station) counterHandoff(state, player, station);
    else setMessage(state, "Move beside a counter to place or pick up a drink.");
    broadcast(state);
  });

  socket.on("mix-recipe-select", (recipeId: string) => {
    const state = findState(socket.id); const player = state && playerFor(socket.id, state);
    if (!state || !player || state.phase !== "shift" || state.pausedAt !== null || player.drink || !state.mixingChoices?.[player.id]?.includes(recipeId)) return;
    const station=nearbyStation(state.tavern,player);
    if(!station)return;
    if(station.kind === "chop") {if(chooseChoppingIngredient(state,player,station,recipeId))broadcast(state);return;}
    if(station.kind!=="mix")return;
    const recipe = recipesForCarriedIngredients(player.carrying).find(recipe => recipe.id === recipeId);
    if (!recipe) return;
    delete state.mixingChoices[player.id];
    state.mixing[player.id] = createMixingSession(player.id, recipe.id);
    player.moving = false;
    setMessage(state, `${player.name} opened the workbench for ${recipe.name}.`);
    broadcast(state);
  });

  socket.on("mix-ingredient", (ingredient: string) => {
    const state = findState(socket.id); const player = state && playerFor(socket.id, state);
    if (!state || !player || state.phase !== "shift" || state.pausedAt !== null || typeof ingredient !== "string") return;
    const session = state.mixing[player.id];
    if (!session) return;
    if (!addMixingIngredient(session, player.carrying, ingredient, player.ingredientQualities)) {
      mixingMistake(state, player, session, "That ingredient is not needed or has already been added.");
    } else {
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
    if (!state || !player || state.phase !== "shift" || state.pausedAt !== null || (!state.mixing[player.id] && !state.mixingChoices?.[player.id])) return;
    delete state.mixing[player.id];
    if (state.mixingChoices) delete state.mixingChoices[player.id];
    player.moving = false;
    setMessage(state, `${player.name} stepped away from the workbench. Ingredients were kept.`);
    broadcast(state);
  });

  socket.on("choose-upgrade", (upgradeId: string) => {
    const state = findState(socket.id); const player = state && playerFor(socket.id, state);
    if (!state || !player || state.hostId !== player.id || state.phase !== "upgrades") return;
    const offered = state.upgrades.find((upgrade) => upgrade.id === upgradeId);
    if (!offered || (offered.id === "nine-lives" && state.health >= 3)) return;
    resetForRound(state, offered.id); broadcast(state);
  });

  socket.on("disconnect", () => {
    const state = findState(socket.id); const player = state && playerFor(socket.id, state);
    if (!state || !player) return;
    player.connected = false; player.moving = false; player.ready = false;
    setMessage(state, `${player.name} disconnected. Their cat will wait for a reconnection.`);
    broadcast(state);
  });
});

function joinRoom(socketId: string, state: GameState, payload: { token: string; name: string; role: CatRole; fur: string; accessory: string }, isHost: boolean, notify = true) {
  const socket = io.sockets.sockets.get(socketId)!;
  const existing = state.players[payload.token];
  state.players[payload.token] = existing ?? {
    id: payload.token, name: payload.name.slice(0, 16) || "Mittens", role: payload.role, fur: payload.fur,
    accessory: payload.accessory, ...PLAYER_SPAWNS[Object.keys(state.players).length % PLAYER_SPAWNS.length],
    direction: "down", moving: false, moveSequence: 0, carrying: [], connected: true, score: 0
  } as Player;
  Object.assign(state.players[payload.token], { name: payload.name.slice(0, 16) || "Mittens", role: payload.role, fur: payload.fur, accessory: payload.accessory, connected: true });
  if (state.phase === "lobby") state.players[payload.token].ready = false;
  socket.data.code = state.code; socket.data.token = payload.token; socket.join(state.code);
  if (!isHost) setMessage(state, existing ? `${payload.name} rejoined the tavern.` : `${payload.name} padded into the tavern.`);
  if (notify) { socket.emit("joined", { code: state.code, token: payload.token }); broadcast(state); }
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
httpServer.listen(port, process.env.HOST ?? "0.0.0.0", () => console.log(`Paws & Pours server listening on http://localhost:${port}`));
