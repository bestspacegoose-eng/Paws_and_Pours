import { io, type Socket } from "socket.io-client";
import { RECIPES, recipeById, type CatRole, type GameState, type Player, type Station } from "../shared/game";
import tabbyCutoutUrl from "./assets/cats/tabby-cutout.png";
import tabbyUrl from "./assets/cats/tabby.png";
import siameseUrl from "./assets/cats/siamese.png";
import maineCoonUrl from "./assets/cats/maine-coon.png";
import blackCatUrl from "./assets/cats/black-cat.png";
import calicoUrl from "./assets/cats/calico.png";
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
const catSprites = Object.fromEntries(Object.entries(catPhotos).map(([role, source]) => {
  const image = new Image(); image.src = source; return [role, image];
})) as Record<CatRole, HTMLImageElement>;

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

type Point = { x: number; y: number };
const ingredientColors: Record<string, string> = { catnip: "#91dd7d", lime: "#c7e65b", fizz: "#a4e9f3", moonmilk: "#e2dcff", cream: "#fff4d5", stardust: "#f0bdff", tuna: "#ec9b8e", tonic: "#86d2ce", kelp: "#4daf74" };
const tavernPalettes: Record<string, { wall: string; floor: string; tile: string; trim: string }> = {
  "Cozy Village Pub": { wall: "#5a3640", floor: "#b86f50", tile: "#d8916a", trim: "#f2c779" },
  "Haunted Moonlit Inn": { wall: "#302c58", floor: "#55507d", tile: "#7772a7", trim: "#bcb7ff" },
  "Pirate Cat Tavern": { wall: "#174b5c", floor: "#447f82", tile: "#61a69f", trim: "#f5c16b" }
};

function iso(x: number, y: number, z = 0): Point { return { x: 400 + (x - y) * 0.54, y: 48 + (x + y) * 0.29 - z }; }
function polygon(points: Point[], fill: string, stroke?: string) {
  context.beginPath(); context.moveTo(points[0].x, points[0].y); points.slice(1).forEach((point) => context.lineTo(point.x, point.y)); context.closePath();
  context.fillStyle = fill; context.fill(); if (stroke) { context.strokeStyle = stroke; context.lineWidth = 1; context.stroke(); }
}
function prism(x: number, y: number, width: number, depth: number, height: number, top: string, left: string, right: string, baseZ = 0) {
  const northwest = iso(x - width / 2, y - depth / 2, baseZ), northeast = iso(x + width / 2, y - depth / 2, baseZ);
  const southeast = iso(x + width / 2, y + depth / 2, baseZ), southwest = iso(x - width / 2, y + depth / 2, baseZ);
  const topNorthwest = iso(x - width / 2, y - depth / 2, baseZ + height), topNortheast = iso(x + width / 2, y - depth / 2, baseZ + height);
  const topSoutheast = iso(x + width / 2, y + depth / 2, baseZ + height), topSouthwest = iso(x - width / 2, y + depth / 2, baseZ + height);
  polygon([topSouthwest, topSoutheast, southeast, southwest], left, "rgba(31,20,36,.55)");
  polygon([topNortheast, topSoutheast, southeast, northeast], right, "rgba(31,20,36,.55)");
  polygon([topNorthwest, topNortheast, topSoutheast, topSouthwest], top, "rgba(31,20,36,.55)");
}
function drawFloor(theme: string) {
  const palette = tavernPalettes[theme];
  context.fillStyle = palette.wall; context.fillRect(0, 0, 800, 480);
  context.fillStyle = "rgba(255,255,255,.06)"; context.fillRect(0, 0, 800, 106);
  context.fillStyle = palette.trim; context.fillRect(0, 100, 800, 7);
  for (let x = 0; x < 800; x += 100) for (let y = 0; y < 500; y += 100) {
    const a = iso(x, y), b = iso(x + 100, y), c = iso(x + 100, y + 100), d = iso(x, y + 100);
    polygon([a, b, c, d], (Math.floor(x / 100) + Math.floor(y / 100)) % 2 ? palette.floor : palette.tile, "rgba(61,33,46,.21)");
  }
  const sign = iso(404, 14); context.fillStyle = "rgba(33,20,43,.76)"; context.fillRect(sign.x - 138, 22, 276, 44);
  context.fillStyle = "#fff2d0"; context.font = "bold 16px system-ui"; context.textAlign = "center"; context.fillText("PAWS & POURS • NIGHT SHIFT", sign.x, 50);
}
function drawIngredientTable(items: Station[]) {
  if (!items.length) return;
  const minX = Math.min(...items.map((station) => station.x)), maxX = Math.max(...items.map((station) => station.x));
  const minY = Math.min(...items.map((station) => station.y)), maxY = Math.max(...items.map((station) => station.y));
  const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
  prism(centerX, centerY, maxX - minX + 85, maxY - minY + 82, 30, "#c77b4c", "#7a4134", "#9b573d");
  const label = iso(centerX, minY - 47, 40); context.fillStyle = "#fff0cf"; context.font = "bold 11px system-ui"; context.textAlign = "center"; context.fillText("SELECT INGREDIENTS", label.x, label.y);
}
function drawStation(station: Station) {
  if (station.ingredient) {
    const color = ingredientColors[station.ingredient];
    prism(station.x, station.y, 38, 34, 13, color, "#684747", "#5c3c3d", 30);
    const label = iso(station.x, station.y, 51); context.fillStyle = "#251a2b"; context.font = "bold 8px system-ui"; context.textAlign = "center"; context.fillText(station.ingredient.toUpperCase(), label.x, label.y + 7); return;
  }
  const colors = { mix: ["#b29aef", "#6e529b", "#8a6cc1"], serve: ["#7ad1be", "#397967", "#559c87"], mop: ["#74a9ed", "#3d629f", "#5680bd"], pantry: ["#db9b47", "#8e5d31", "#b8783b"] } as const;
  const [top, left, right] = colors[station.kind]; prism(station.x, station.y, 115, 80, 48, top, left, right);
  const icon = station.kind === "mix" ? "🍹" : station.kind === "serve" ? "🔔" : "🪣";
  const label = iso(station.x, station.y, 68); context.font = "25px sans-serif"; context.textAlign = "center"; context.fillText(icon, label.x, label.y + 6);
  context.fillStyle = "#2b2033"; context.font = "bold 10px system-ui"; context.fillText(station.label.toUpperCase(), label.x, label.y - 16);
}
function drawPlayer(player: Player) {
  const point = iso(player.x, player.y); const sprite = catSprites[player.role];
  context.save(); context.fillStyle = "rgba(25,15,30,.34)"; context.beginPath(); context.ellipse(point.x, point.y + 6, 23, 8, 0, 0, Math.PI * 2); context.fill();
  context.beginPath(); context.ellipse(point.x, point.y - 23, 21, 25, 0, 0, Math.PI * 2); context.clip();
  if (sprite.complete) context.drawImage(sprite, point.x - 29, point.y - 51, 58, 58); else { context.fillStyle = player.fur; context.fillRect(point.x - 21, point.y - 48, 42, 50); }
  context.restore(); context.strokeStyle = player.id === token ? "#ffd26d" : "#fff3d2"; context.lineWidth = 2; context.beginPath(); context.ellipse(point.x, point.y - 23, 21, 25, 0, 0, Math.PI * 2); context.stroke();
  context.fillStyle = "#fff7e9"; context.font = "bold 11px system-ui"; context.textAlign = "center"; context.fillText(player.name, point.x, point.y + 25);
  if (!player.connected) { context.fillStyle = "#f07777"; context.font = "10px system-ui"; context.fillText("reconnecting…", point.x, point.y + 38); }
  if (player.drink) { context.font = "16px sans-serif"; context.fillText("🍸", point.x + 24, point.y - 41); }
}
function renderBoard() {
  requestAnimationFrame(renderBoard); movePlayer(); context.imageSmoothingEnabled = false;
  const theme = state?.tavern.theme ?? "Cozy Village Pub"; drawFloor(theme); if (!state) return;
  const ingredients = state.tavern.stations.filter((station) => station.ingredient); drawIngredientTable(ingredients);
  const objects = [
    ...state.tavern.stations.map((station) => ({ depth: station.x + station.y, draw: () => drawStation(station) })),
    ...Object.values(state.players).map((player) => ({ depth: player.x + player.y + 16, draw: () => drawPlayer(player) }))
  ].sort((left, right) => left.depth - right.depth);
  objects.forEach((object) => object.draw());
  if (state.hazard) { context.fillStyle = "rgba(119,38,47,.93)"; context.fillRect(175, 433, 450, 31); context.fillStyle = "white"; context.font = "bold 13px system-ui"; context.textAlign = "center"; context.fillText(`⚠ ${state.hazard}`, 400, 454); }
}
renderBoard();
