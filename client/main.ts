import { io, type Socket } from "socket.io-client";
import { RECIPES, recipeById, type CatRole, type GameState, type Player, type Station } from "../shared/game";
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

const roles: { role: CatRole; perk: string; emoji: string }[] = [
  { role: "Tabby", perk: "Balanced", emoji: "🐱" }, { role: "Siamese", perk: "Quick paws", emoji: "🐈" },
  { role: "Maine Coon", perk: "Heavy lifter", emoji: "🦁" }, { role: "Black Cat", perk: "Lucky tips", emoji: "🐈‍⬛" },
  { role: "Calico", perk: "Team spirit", emoji: "🐱" }
];

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <main class="shell">
    <header class="topbar"><a class="brand" href="/"><span>🐾</span> Paws <i>&</i> Pours</a><span class="tag">Co-op roguelike bartending</span></header>
    <section id="menu" class="menu card">
      <div class="hero"><div><p class="eyebrow">A traveling tavern awaits</p><h1>Shake, serve, survive.</h1><p>Team up as charming cat bartenders in a procedurally generated fantasy tavern.</p></div><div class="hero-cat">🐈<span>🍸</span></div></div>
      <div class="setup-grid"><label>Cat name<input id="name" maxlength="16" value="Mittens" /></label><label>Fur color<input id="fur" type="color" value="#e5a265" /></label><label>Accessory<select id="accessory"><option>Bow tie</option><option>Wizard hat</option><option>Pirate patch</option><option>Flower crown</option></select></label></div>
      <p class="label">Choose your bartender</p><div class="roles" id="roles"></div>
      <div class="actions"><button class="primary" id="create">Create game</button><div class="join"><input id="room-input" maxlength="4" placeholder="ROOM CODE" value="${roomCode}"/><button id="join">Join game</button></div></div>
      <p class="fineprint">Two to four players · Share your room code · Press <kbd>E</kbd> near a station to interact</p>
    </section>
    <section id="game" class="game hidden">
      <div class="game-header"><div><span class="eyebrow" id="theme">THE TAVERN</span><strong id="room-display">ROOM ----</strong></div><div class="stats"><span>🪙 <b id="coins">0</b></span><span>★ <b id="rep">0</b></span><span>♥ <b id="health">3</b></span><span class="timer" id="timer">1:30</span></div><button class="leave" id="leave">Leave</button></div>
      <div class="canvas-card"><canvas id="board" width="800" height="480" aria-label="Paws and Pours game board"></canvas><div id="toast" class="toast"></div></div>
      <div class="hud"><section class="panel orders"><h2>Orders</h2><div id="orders"></div></section><section class="panel recipe"><h2>Tonight's recipes</h2><div id="recipes"></div></section><section class="panel crew"><h2>Crew</h2><div id="crew"></div></section></div>
      <p class="controls"><kbd>WASD</kbd> or <kbd>← ↑ ↓ →</kbd> move · <kbd>E</kbd> interact · Pantry → Mixer → Service Bell · <span id="carry">Paws empty</span></p>
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
  document.querySelector("#roles")!.innerHTML = roles.map(({ role, perk, emoji }) => `<button class="role ${role === selectedRole ? "selected" : ""}" data-role="${role}"><span>${emoji}</span><b>${role}</b><small>${perk}</small></button>`).join("");
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
  setToast(state.message);
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

function drawStation(station: Station) {
  const colors = { pantry: "#db9b47", mix: "#a48ee8", serve: "#68c7b3", mop: "#70a4ed" };
  context.save(); context.translate(station.x, station.y);
  context.fillStyle = "#251a2b"; context.fillRect(-48, -26, 96, 52);
  context.fillStyle = colors[station.kind]; context.fillRect(-45, -23, 90, 46);
  context.fillStyle = "#fff4d6"; context.font = "22px sans-serif"; context.textAlign = "center";
  context.fillText(station.kind === "pantry" ? "🥫" : station.kind === "mix" ? "🍹" : station.kind === "serve" ? "🔔" : "🪣", 0, 8);
  context.fillStyle = "#33223e"; context.font = "bold 11px system-ui"; context.fillText(station.label.toUpperCase(), 0, 44); context.restore();
}
function drawPlayer(player: Player) {
  context.save(); context.translate(player.x, player.y); context.fillStyle = player.fur; context.beginPath(); context.arc(0, 0, 22, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#322437"; context.beginPath(); context.moveTo(-17, -14); context.lineTo(-12, -33); context.lineTo(-1, -18); context.moveTo(1, -18); context.lineTo(12, -33); context.lineTo(17, -14); context.fill();
  context.fillStyle = "#fff7e9"; context.font = "19px sans-serif"; context.textAlign = "center"; context.fillText("🐱", 0, 8);
  context.fillStyle = "#fff7e9"; context.font = "bold 11px system-ui"; context.fillText(player.name, 0, 43); if (!player.connected) { context.fillStyle = "#f07777"; context.fillText("reconnecting…", 0, 57); }
  if (player.drink) { context.font = "16px sans-serif"; context.fillText("🍸", 28, -15); } context.restore();
}
function renderBoard() {
  requestAnimationFrame(renderBoard); movePlayer();
  const theme = state?.tavern.theme ?? "Cozy Village Pub";
  const backgrounds: Record<string, string> = { "Cozy Village Pub": "#c66c45", "Haunted Moonlit Inn": "#38305c", "Pirate Cat Tavern": "#298b96" };
  context.fillStyle = backgrounds[theme]; context.fillRect(0, 0, 800, 480);
  context.fillStyle = "rgba(255,238,196,.26)"; for (let x = 0; x < 800; x += 60) for (let y = 80; y < 480; y += 60) context.fillRect(x + 2, y + 2, 56, 56);
  if (!state) return;
  context.fillStyle = "rgba(35,18,38,.65)"; context.fillRect(0, 0, 800, 64); context.fillStyle = "#fff4d6"; context.font = "28px sans-serif"; context.textAlign = "center"; context.fillText(state.tavern.decoration.join("     "), 400, 41);
  state.tavern.stations.forEach(drawStation); Object.values(state.players).forEach(drawPlayer);
  if (state.hazard) { context.fillStyle = "rgba(236,91,78,.92)"; context.fillRect(210, 445, 380, 28); context.fillStyle = "white"; context.font = "bold 13px system-ui"; context.fillText(`⚠ ${state.hazard}`, 400, 464); }
}
renderBoard();
