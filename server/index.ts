import express from "express";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import {
  type CatRole, type FacingDirection, type GameState, initialState, makeOrder, makeTavern,
  mulberry32, recipeById, recipeForIngredients, seededUpgrades, type Player
} from "../shared/game.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" } });
const rooms = new Map<string, GameState>();
const seeds = new Map<string, number>();
const orderCounters = new Map<string, number>();
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

function startShift(state: GameState) {
  state.phase = "shift";
  state.shiftSeconds = Math.max(56, 90 - (state.round - 1) * 8);
  state.orders = [];
  state.hazard = null;
  state.message = `${state.tavern.theme}: shift ${state.round} is on!`;
  spawnOrder(state);
}
function spawnOrder(state: GameState) {
  const counter = (orderCounters.get(state.code) ?? 0) + 1;
  orderCounters.set(state.code, counter);
  state.orders.push(makeOrder(`order-${counter}`, mulberry32((seeds.get(state.code) ?? 1) + counter * 31)));
}
function endShift(state: GameState) {
  state.phase = "upgrades";
  state.upgrades = seededUpgrades(seeds.get(state.code) ?? 1, state.round);
  state.message = "Shift complete! The crew chooses one keepsake for the next tavern.";
}
function failRun(state: GameState) {
  state.phase = "complete";
  state.message = "The tavern cat-astrophe got the better of the crew. Start a fresh run!";
}
function resetForRound(state: GameState, upgradeId: string) {
  const seed = seeds.get(state.code) ?? 1;
  state.round += 1;
  state.tavern = makeTavern(seed, state.round);
  if (upgradeId === "patient-patrons") state.message = "Patient Patrons acquired: every next order gets extra time.";
  if (upgradeId === "swift-paws") state.message = "Swift Paws acquired: the cats feel zoomy.";
  startShift(state);
}

io.on("connection", (socket) => {
  socket.on("create-room", (payload: { token: string; name: string; role: CatRole; fur: string; accessory: string }) => {
    const code = roomCode();
    const seed = Math.floor(Math.random() * 2 ** 31);
    const state = initialState(code, payload.token, seed);
    rooms.set(code, state); seeds.set(code, seed); orderCounters.set(code, 0);
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

  socket.on("move", (position: { x: number; y: number; direction?: FacingDirection; moving?: boolean; sequence?: number }) => {
    const state = findState(socket.id); const player = state && playerFor(socket.id, state);
    if (!state || !player || state.phase !== "shift") return;
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return;
    const lastSequence = player.moveSequence ?? 0;
    const sequence = Number.isSafeInteger(position.sequence) && position.sequence! >= 0 ? position.sequence! : lastSequence + 1;
    if (sequence <= lastSequence) return;
    player.x = Math.max(32, Math.min(768, position.x));
    player.y = Math.max(80, Math.min(442, position.y));
    if (["down", "left", "right", "up"].includes(position.direction ?? "")) player.direction = position.direction!;
    player.moving = Boolean(position.moving); player.moveSequence = sequence;
    broadcast(state);
  });

  socket.on("interact", () => {
    const state = findState(socket.id); const player = state && playerFor(socket.id, state);
    if (!state || !player || state.phase !== "shift") return;
    const nearby = state.tavern.stations
      .filter((station) => Math.hypot(station.x - player.x, station.y - player.y) < 74)
      .sort((left, right) => Math.hypot(left.x - player.x, left.y - player.y) - Math.hypot(right.x - player.x, right.y - player.y))[0];
    if (!nearby) return setMessage(state, "Walk up to a brightly colored station, then press E.");
    if (nearby.kind === "pantry") {
      if (player.carrying.length >= 3) setMessage(state, `${player.name}'s paws are full—mix those ingredients first.`);
      else {
        const ingredient = nearby.ingredient;
        if (!ingredient) return setMessage(state, "Choose an ingredient from the prep table.");
        player.carrying.push(ingredient); setMessage(state, `${player.name} selected ${ingredient}.`);
      }
    }
    if (nearby.kind === "mix") {
      const recipe = recipeForIngredients(player.carrying);
      if (!recipe) setMessage(state, "That combination is not on tonight's menu. Try three matching recipe ingredients.");
      else { player.drink = recipe.id; player.carrying = []; setMessage(state, `${player.name} made a ${recipe.name}!`); }
    }
    if (nearby.kind === "serve") {
      if (!player.drink) setMessage(state, "No drink in paw. Mix something first!");
      else {
        const index = state.orders.findIndex((order) => order.recipeId === player.drink);
        if (index < 0) setMessage(state, "Nobody ordered that drink—save it for the crew.");
        else {
          const [order] = state.orders.splice(index, 1); const quality = order.patience / order.maxPatience;
          const tip = quality > 0.6 ? 8 : 5;
          state.coins += tip; state.reputation += quality > 0.6 ? 2 : 1; player.score += tip; player.drink = undefined;
          setMessage(state, `${order.customer} purrs with delight! +${tip} coins.`);
        }
      }
    }
    if (nearby.kind === "mop" && state.hazard) { state.hazard = null; setMessage(state, `${player.name} cleaned up the hazard. Good kitty!`); }
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
    accessory: payload.accessory, x: 260 + Object.keys(state.players).length * 70, y: 390,
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
    if (state.phase !== "shift") continue;
    state.shiftSeconds -= 1;
    state.orders.forEach((order) => order.patience -= 1);
    const lost = state.orders.filter((order) => order.patience <= 0);
    if (lost.length) { state.orders = state.orders.filter((order) => order.patience > 0); state.health -= lost.length; setMessage(state, "A customer stormed out! Team hearts dropped."); }
    if (state.shiftSeconds > 0 && state.shiftSeconds % 12 === 0 && state.orders.length < 3) spawnOrder(state);
    if (state.shiftSeconds > 0 && state.shiftSeconds % 18 === 0) {
      state.hazard = ["A mischievous mouse scatters napkins!", "The spectral tap is leaking ectoplasm!", "A tiny kitchen fire is sizzling!"][Math.floor(random() * 3)];
      setMessage(state, `Hazard: ${state.hazard} Use the mop bucket!`);
    }
    if (state.health <= 0) failRun(state); else if (state.shiftSeconds <= 0) endShift(state);
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
