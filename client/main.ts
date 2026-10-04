import { io, type Socket } from "socket.io-client";
import { RECIPES, recipeById, type CatRole, type GameState, type Player, type Station } from "../shared/game";
import tabbyCutoutUrl from "./assets/cats/tabby-cutout.png";
import tabbyUrl from "./assets/cats/tabby.png";
import siameseUrl from "./assets/cats/siamese.png";
import maineCoonUrl from "./assets/cats/maine-coon.png";
import blackCatUrl from "./assets/cats/black-cat.png";
import calicoUrl from "./assets/cats/calico.png";
import counterTileUrl from "./assets/tilemap/purple-counter.png";
import catBaseUrl from "./assets/tilemap/cat-base.png";
import catEyesUrl from "./assets/tilemap/cat-eyes.png";
import "./style.css";

// Dev uses Vite on 5173 and the game server on 3001. A deployed build uses the
// same public origin for both the page and WebSocket connection.
const SERVER_URL = import.meta.env.VITE_SERVER_URL ??
  (location.hostname === "localhost" && location.port === "5173" ? "http://localhost:3001" : location.origin);
const tokenKey = "paws-pours-player-token";
const token = sessionStorage.getItem(tokenKey) ?? crypto.randomUUID();
sessionStorage.setItem(tokenKey, token);
const socket: Socket = io(SERVER_URL, { autoConnect: false, reconnection: true });
let state: GameState | null = null;
let roomCode = sessionStorage.getItem("paws-pours-room") ?? "";
let toast = "Welcome, bartender. Invite a friend with a room code!";
let selectedRole: CatRole = "Tabby";
let move = { x: 0, y: 0 };
let lastMove = 0;
let lastStateMessage = "";

const catPhotos: Record<CatRole, string> = {
  "Tabby": tabbyUrl, "Siamese": siameseUrl, "Maine Coon": maineCoonUrl,
  "Black Cat": blackCatUrl, "Calico": calicoUrl
};
const counterTile = new Image(); counterTile.src = counterTileUrl;
const catBase = new Image(); catBase.src = catBaseUrl;
const catEyes = new Image(); catEyes.src = catEyesUrl;

const roles: { role: CatRole; perk: string }[] = [
  { role: "Tabby", perk: "Balanced" }, { role: "Siamese", perk: "Quick paws" },
  { role: "Maine Coon", perk: "Heavy lifter" }, { role: "Black Cat", perk: "Lucky tips" },
  { role: "Calico", perk: "Team spirit" }
];

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <main class="shell">
    <header class="topbar"><a class="brand" href="/"><span>🐾</span> Paws <i>&</i> Pours</a><span class="tag">Co-op roguelike bartending</span></header>
    <section id="menu" class="menu card">
      <div class="hero"><div><p class="eyebrow">A traveling tavern awaits</p><h1>Shake, serve, survive.</h1><p>Team up as charming cat bartenders in a procedurally generated fantasy tavern.</p></div><div class="hero-cat"><img src="${tabbyCutoutUrl}" alt="Pixelated orange tabby bartender" /><span>🍸</span></div></div>
      <div class="setup-grid"><label>Cat name<input id="name" maxlength="16" value="Mittens" /></label><label>Fur color<input id="fur" type="color" value="#e5a265" /></label><label>Accessory<select id="accessory"><option>Bow tie</option><option>Wizard hat</option><option>Pirate patch</option><option>Flower crown</option></select></label></div>
      <p class="label">Choose your bartender</p><div class="roles" id="roles"></div>
      <div class="actions"><button class="primary" id="create">Create game</button><div class="join"><input id="room-input" maxlength="4" placeholder="ROOM CODE" value="${roomCode}"/><button id="join">Join game</button></div></div>
      <p class="fineprint">Two to four players · Share your room code · Press <kbd>E</kbd> near a station to interact</p>
    </section>
    <section id="game" class="game hidden">
      <div class="game-header"><div><span class="eyebrow" id="theme">THE TAVERN</span><strong id="room-display">ROOM ----</strong></div><div class="stats"><span>🪙 <b id="coins">0</b></span><span>★ <b id="rep">0</b></span><span>♥ <b id="health">3</b></span><span class="timer" id="timer">1:30</span></div><button class="leave" id="leave">Leave</button></div>
      <div class="canvas-card"><canvas id="board" width="800" height="480" aria-label="Paws and Pours game board"></canvas><div id="toast" class="toast"></div></div>
      <div class="hud"><section class="panel orders"><h2>Orders</h2><div id="orders"></div></section><section class="panel recipe"><h2>Tonight's recipes</h2><div id="recipes"></div></section><section class="panel crew"><h2>Crew</h2><div id="crew"></div></section></div>
      <p class="controls"><kbd>WASD</kbd> or <kbd>← ↑ ↓ →</kbd> move · <kbd>E</kbd> interact · Ingredient table → Mixer → Service Bell · <span id="carry">Paws empty</span></p>
    </section>
    <section id="overlay" class="overlay hidden"></section>
  </main>`;

const menu = document.querySelector<HTMLElement>("#menu")!;
const game = document.querySelector<HTMLElement>("#game")!;
const overlay = document.querySelector<HTMLElement>("#overlay")!;
const canvas = document.querySelector<HTMLCanvasElement>("#board")!;
const context = canvas.getContext("2d")!;

function profile() {
  return {
    token, name: (document.querySelector<HTMLInputElement>("#name")!).value.trim() || "Mittens",
    role: selectedRole, fur: (document.querySelector<HTMLInputElement>("#fur")!).value,
    accessory: (document.querySelector<HTMLSelectElement>("#accessory")!).value
  };
}
function renderRoles() {
  document.querySelector("#roles")!.innerHTML = roles.map(({ role, perk }) => `<button class="role ${role === selectedRole ? "selected" : ""}" data-role="${role}"><img class="role-photo" src="${catPhotos[role]}" alt="${role} cat" /><b>${role}</b><small>${perk}</small></button>`).join("");
  document.querySelectorAll<HTMLButtonElement>(".role").forEach((button) => button.onclick = () => { selectedRole = button.dataset.role as CatRole; renderRoles(); });
}
renderRoles();

function connect(action: "create" | "join") {
  socket.connect();
  const send = () => {
    if (action === "create") socket.emit("create-room", profile());
    else {
      const code = (document.querySelector<HTMLInputElement>("#room-input")!).value.toUpperCase().trim();
      if (code.length !== 4) return setToast("Enter the four-letter room code first.");
      socket.emit("join-room", { ...profile(), code });
    }
  };
  socket.connected ? send() : socket.once("connect", send);
}
document.querySelector<HTMLButtonElement>("#create")!.onclick = () => connect("create");
document.querySelector<HTMLButtonElement>("#join")!.onclick = () => connect("join");
document.querySelector<HTMLButtonElement>("#leave")!.onclick = () => { sessionStorage.removeItem("paws-pours-room"); location.reload(); };

socket.on("joined", ({ code }: { code: string }) => { roomCode = code; sessionStorage.setItem("paws-pours-room", code); menu.classList.add("hidden"); game.classList.remove("hidden"); setToast(`Joined room ${code}.`); });
socket.on("state", (next: GameState) => { state = next; renderUi(); });
socket.on("error-message", (message: string) => setToast(message));
socket.on("connect", () => { if (roomCode && state) socket.emit("join-room", { ...profile(), code: roomCode }); });
socket.on("disconnect", () => setToast("Reconnecting to the tavern…"));

function setToast(message: string) { toast = message; const element = document.querySelector("#toast")!; element.textContent = message; element.classList.add("show"); window.setTimeout(() => element.classList.remove("show"), 2800); }
function localPlayer() { return state?.players[token]; }
function time(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
function ingredientMarkup(ingredient: string) { return `<span class="ingredient">${ingredient}</span>`; }
function renderUi() {
  if (!state) return;
  document.querySelector("#theme")!.textContent = state.tavern.theme.toUpperCase();
  document.querySelector("#room-display")!.textContent = `ROOM ${state.code}`;
  document.querySelector("#coins")!.textContent = String(state.coins);
  document.querySelector("#rep")!.textContent = String(state.reputation);
  document.querySelector("#health")!.textContent = String(Math.max(0, state.health));
  document.querySelector("#timer")!.textContent = state.phase === "shift" ? time(state.shiftSeconds) : state.phase.toUpperCase();
  document.querySelector("#orders")!.innerHTML = state.orders.length ? state.orders.map((order) => { const recipe = recipeById(order.recipeId); const pct = Math.max(0, order.patience / order.maxPatience * 100); return `<article class="order"><div><b>${recipe.name}</b><small>${order.customer}</small></div><div class="patience"><i style="width:${pct}%"></i></div></article>`; }).join("") : `<p class="empty">No orders yet—enjoy the calm.</p>`;
  document.querySelector("#recipes")!.innerHTML = RECIPES.map((recipe) => `<article class="recipe-line"><i style="background:${recipe.color}"></i><div><b>${recipe.name}</b><small>${recipe.ingredients.map(ingredientMarkup).join("")}</small></div></article>`).join("");
  const hostId = state.hostId;
  document.querySelector("#crew")!.innerHTML = Object.values(state.players).map((player) => `<article class="crew-line"><span style="color:${player.fur}">🐱</span><div><b>${player.name}${player.id === hostId ? " · host" : ""}</b><small>${player.role} · ${player.connected ? "ready" : "reconnecting…"}</small></div><em>${player.score}🪙</em></article>`).join("");
  const player = localPlayer();
  document.querySelector("#carry")!.textContent = player?.drink ? `Carrying: ${recipeById(player.drink).name}` : player?.carrying.length ? `Carrying: ${player.carrying.join(", ")}` : "Paws empty";
  if (state.message !== lastStateMessage) {
    lastStateMessage = state.message;
    setToast(state.message);
  }
  renderOverlay();
}
function renderOverlay() {
  if (!state) return;
  if (state.phase === "lobby") {
    overlay.classList.remove("hidden");
    const isHost = state.hostId === token;
    overlay.innerHTML = `<div class="modal card"><p class="eyebrow">ROOM ${state.code}</p><h2>Gather your crew</h2><p>Share this code with up to three friends. Everyone appears in this lobby instantly.</p><div class="big-code">${state.code}</div><p>${Object.keys(state.players).length}/4 cat bartenders in the tavern.</p>${isHost ? `<button class="primary" id="start">Start shift</button>` : `<p class="waiting">Waiting for the host to ring the bell…</p>`}</div>`;
    document.querySelector<HTMLButtonElement>("#start")?.addEventListener("click", () => socket.emit("start-shift"));
  } else if (state.phase === "upgrades") {
    overlay.classList.remove("hidden"); const host = state.hostId === token;
    overlay.innerHTML = `<div class="modal card"><p class="eyebrow">SHIFT ${state.round} COMPLETE</p><h2>Choose a keepsake</h2><p>The host's choice carries the crew to a new seeded tavern.</p><div class="upgrade-grid">${state.upgrades.map((upgrade) => `<button class="upgrade" data-upgrade="${upgrade.id}" ${host ? "" : "disabled"}><b>${upgrade.title}</b><small>${upgrade.body}</small></button>`).join("")}</div>${host ? "" : "<p class=waiting>The host is choosing…</p>"}</div>`;
    document.querySelectorAll<HTMLButtonElement>("[data-upgrade]").forEach((button) => button.onclick = () => socket.emit("choose-upgrade", button.dataset.upgrade));
  } else if (state.phase === "complete") {
    overlay.classList.remove("hidden"); overlay.innerHTML = `<div class="modal card"><p class="eyebrow">RUN OVER</p><h2>A furry good effort.</h2><p>You earned ${state.coins} coins and ${state.reputation} reputation across ${state.round} tavern${state.round > 1 ? "s" : ""}.</p><button class="primary" onclick="location.reload()">Return to menu</button></div>`;
  } else overlay.classList.add("hidden");
}

function movePlayer() {
  const player = localPlayer();
  if (!state || !player || state.phase !== "shift" || (!move.x && !move.y)) return;
  const length = Math.hypot(move.x, move.y); const speed = player.role === "Siamese" ? 3.3 : 2.7;
  player.x = Math.max(32, Math.min(768, player.x + move.x / length * speed));
  player.y = Math.max(80, Math.min(442, player.y + move.y / length * speed));
  if (performance.now() - lastMove > 50) { socket.emit("move", { x: player.x, y: player.y }); lastMove = performance.now(); }
}
const movementKeys: Record<string, keyof typeof move> = { w: "y", ArrowUp: "y", s: "y", ArrowDown: "y", a: "x", ArrowLeft: "x", d: "x", ArrowRight: "x" };
window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "e" && state?.phase === "shift") { event.preventDefault(); socket.emit("interact"); }
  const axis = movementKeys[event.key]; if (!axis) return;
  event.preventDefault(); move[axis] = event.key === "w" || event.key === "ArrowUp" || event.key === "a" || event.key === "ArrowLeft" ? -1 : 1;
});
window.addEventListener("keyup", (event) => { const axis = movementKeys[event.key]; if (axis) move[axis] = 0; });

const ingredientColors: Record<string, string> = { catnip: "#91dd7d", lime: "#c7e65b", fizz: "#a4e9f3", moonmilk: "#e2dcff", cream: "#fff4d5", stardust: "#f0bdff", tuna: "#ec9b8e", tonic: "#86d2ce", kelp: "#4daf74" };
const tavernPalettes: Record<string, { grass: string; wall: string; floor: string; tile: string; trim: string }> = {
  "Cozy Village Pub": { grass: "#55704b", wall: "#603947", floor: "#a95d47", tile: "#c97858", trim: "#f1bd76" },
  "Haunted Moonlit Inn": { grass: "#30384f", wall: "#38305d", floor: "#4f4a75", tile: "#66608f", trim: "#b9a9e8" },
  "Pirate Cat Tavern": { grass: "#315d62", wall: "#174b5c", floor: "#3e7b78", tile: "#559b91", trim: "#f5c16b" }
};
type Point = { x: number; y: number };
const catTintCache = new Map<string, HTMLCanvasElement>();

function boardPoint(x: number, y: number): Point {
  return { x: 40 + x * 0.94, y: 52 + (y - 70) * 0.94 };
}
function drawText(text: string, x: number, y: number, font: string, color: string) {
  context.font = font; context.fillStyle = color; context.textAlign = "center"; context.fillText(text, x, y);
}
function drawFloor(theme: string) {
  const palette = tavernPalettes[theme];
  context.fillStyle = palette.grass; context.fillRect(0, 0, 800, 480);
  context.fillStyle = "rgba(255,255,255,.09)";
  for (let x = 12; x < 800; x += 29) for (let y = 28; y < 480; y += 33) context.fillRect(x + (y % 3), y, 1, 6);
  context.fillStyle = "rgba(21,15,29,.38)"; context.fillRect(23, 42, 754, 414);
  context.fillStyle = palette.wall; context.fillRect(29, 48, 742, 400);
  context.fillStyle = palette.trim; context.fillRect(34, 54, 732, 8);
  context.fillStyle = palette.floor; context.fillRect(40, 67, 720, 370);
  for (let x = 40; x < 760; x += 40) for (let y = 67; y < 437; y += 40) {
    context.fillStyle = (Math.floor(x / 40) + Math.floor(y / 40)) % 2 ? palette.floor : palette.tile;
    context.fillRect(x + 1, y + 1, 38, 38);
  }
  context.fillStyle = "rgba(33,20,43,.76)"; context.fillRect(256, 10, 288, 33);
  drawText("PAWS & POURS  •  NIGHT SHIFT", 400, 32, "bold 14px system-ui", "#fff2d0");
  context.fillStyle = "rgba(43,25,48,.52)"; context.fillRect(48, 75, 242, 352);
  context.fillStyle = "rgba(30,25,43,.45)"; context.fillRect(507, 75, 242, 352);
  drawText("PATRON NOOK", 168, 94, "bold 10px system-ui", "#ffe6bc");
  drawText("BARTENDER'S BAR", 628, 94, "bold 10px system-ui", "#ffe6bc");
}
function drawCounter(point: Point, width = 102, height = 92) {
  context.save(); context.shadowColor = "rgba(29,14,35,.4)"; context.shadowBlur = 7; context.shadowOffsetY = 5;
  if (counterTile.complete && counterTile.naturalWidth) context.drawImage(counterTile, point.x - width / 2, point.y - height / 2, width, height);
  else { context.fillStyle = "#a98aa5"; context.fillRect(point.x - width / 2, point.y - height / 2, width, height); }
  context.restore();
}
function drawIngredientTable(items: Station[]) {
  if (!items.length) return;
  const minX = Math.min(...items.map((station) => station.x)), maxX = Math.max(...items.map((station) => station.x));
  const minY = Math.min(...items.map((station) => station.y)), maxY = Math.max(...items.map((station) => station.y));
  const center = boardPoint((minX + maxX) / 2, (minY + maxY) / 2);
  drawCounter(center, 188, 142);
  drawText("INGREDIENTS", center.x, center.y - 58, "bold 10px system-ui", "#fff5df");
}
function drawStation(station: Station) {
  const point = boardPoint(station.x, station.y);
  if (station.ingredient) {
    const color = ingredientColors[station.ingredient];
    context.fillStyle = "rgba(29,15,35,.35)"; context.beginPath(); context.ellipse(point.x, point.y + 8, 15, 5, 0, 0, Math.PI * 2); context.fill();
    context.fillStyle = color; context.beginPath(); context.arc(point.x, point.y - 2, 11, 0, Math.PI * 2); context.fill();
    context.strokeStyle = "rgba(49,27,53,.78)"; context.lineWidth = 2; context.stroke();
    drawText(station.ingredient.toUpperCase(), point.x, point.y + 22, "bold 7px system-ui", "#2b2033"); return;
  }
  drawCounter(point);
  const icon = station.kind === "mix" ? "🍹" : station.kind === "serve" ? "🔔" : "🪣";
  drawText(icon, point.x, point.y + 4, "28px sans-serif", "#ffffff");
  drawText(station.label.toUpperCase(), point.x, point.y + 55, "bold 8px system-ui", "#2b2033");
  if (station.kind === "mix") { context.fillStyle = "#d9c7ff"; context.fillRect(point.x - 17, point.y - 27, 34, 7); }
  if (station.kind === "serve") { context.fillStyle = "#7ad1be"; context.fillRect(point.x - 17, point.y - 27, 34, 7); }
}
function tintedCat(fur: string) {
  const cached = catTintCache.get(fur);
  if (cached) return cached;
  const result = document.createElement("canvas"); result.width = catBase.naturalWidth || 305; result.height = catBase.naturalHeight || 460;
  const layer = result.getContext("2d")!;
  layer.imageSmoothingEnabled = false; layer.drawImage(catBase, 0, 0);
  layer.globalCompositeOperation = "source-atop"; layer.globalAlpha = .83; layer.fillStyle = fur; layer.fillRect(0, 0, result.width, result.height);
  layer.globalAlpha = 1; layer.globalCompositeOperation = "source-over"; layer.drawImage(catEyes, 0, 0);
  catTintCache.set(fur, result); return result;
}
function drawPlayer(player: Player) {
  const point = boardPoint(player.x, player.y);
  context.fillStyle = "rgba(25,15,30,.36)"; context.beginPath(); context.ellipse(point.x, point.y + 16, 20, 7, 0, 0, Math.PI * 2); context.fill();
  if (catBase.complete && catBase.naturalWidth) context.drawImage(tintedCat(player.fur), point.x - 23, point.y - 48, 46, 69);
  else { context.fillStyle = player.fur; context.fillRect(point.x - 17, point.y - 40, 34, 52); }
  context.strokeStyle = player.id === token ? "#ffd26d" : "#fff3d2"; context.lineWidth = 2; context.beginPath(); context.ellipse(point.x, point.y + 3, 25, 29, 0, 0, Math.PI * 2); context.stroke();
  drawText(player.name, point.x, point.y + 36, "bold 10px system-ui", "#fff7e9");
  if (!player.connected) drawText("reconnecting…", point.x, point.y + 48, "9px system-ui", "#f07777");
  if (player.drink) drawText("🍸", point.x + 24, point.y - 35, "16px sans-serif", "#ffffff");
}
function drawPatronNook() {
  const seats = [[100, 143], [216, 143], [100, 341], [216, 341]];
  seats.forEach(([x, y], index) => {
    context.fillStyle = "rgba(43,25,48,.38)"; context.beginPath(); context.ellipse(x, y + 19, 31, 10, 0, 0, Math.PI * 2); context.fill();
    context.fillStyle = index % 2 ? "#e4a743" : "#d38b4a"; context.beginPath(); context.arc(x, y, 18, 0, Math.PI * 2); context.fill();
    context.fillStyle = "#754b3c"; context.fillRect(x - 26, y + 20, 52, 12);
  });
  context.fillStyle = "#f1bd76"; context.fillRect(48, 397, 225, 6); drawText("ORDER WINDOW", 160, 418, "bold 9px system-ui", "#fff2d0");
}
function renderBoard() {
  requestAnimationFrame(renderBoard); movePlayer(); context.imageSmoothingEnabled = false;
  const theme = state?.tavern.theme ?? "Cozy Village Pub"; drawFloor(theme); drawPatronNook(); if (!state) return;
  const ingredients = state.tavern.stations.filter((station) => station.ingredient); drawIngredientTable(ingredients);
  const objects = [
    ...state.tavern.stations.map((station) => ({ depth: station.y + (station.ingredient ? 1 : 10), draw: () => drawStation(station) })),
    ...Object.values(state.players).map((player) => ({ depth: player.y + 18, draw: () => drawPlayer(player) }))
  ].sort((left, right) => left.depth - right.depth);
  objects.forEach((object) => object.draw());
  if (state.hazard) { context.fillStyle = "rgba(119,38,47,.93)"; context.fillRect(175, 441, 450, 27); drawText(`⚠ ${state.hazard}`, 400, 459, "bold 12px system-ui", "white"); }
}
renderBoard();
