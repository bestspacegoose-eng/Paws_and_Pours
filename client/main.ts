import { io, type Socket } from "socket.io-client";
import {
  moveWithCounterCollisions, nearbyStation, stationBounds, RECIPES, recipeById, type CatRole,
  type GameState, type Player, type Recipe
} from "../shared/game";
import tabbyPortraitUrl from "./assets/characters/tabby.png";
import siamesePortraitUrl from "./assets/characters/siamese.png";
import maineCoonPortraitUrl from "./assets/characters/maine-coon.png";
import blackCatPortraitUrl from "./assets/characters/black-cat.png";
import calicoPortraitUrl from "./assets/characters/calico.png";
import scrapBinUrl from "./assets/props/scrap-bin.png";
import catBartenderSpritesheetUrl from "./assets/tilemap/cat-bartender-spritesheet.png";
import ingredientsSpritesheetUrl from "./assets/tilemap/ingredients-spritesheet.png";
import { MixingWorkspace } from "./mixing-workspace";
import { drawRecipeDrink, onDrinkArtReady } from "./drink-art";
import { INGREDIENT_FRAMES, PLAYER_FRAMES } from "./sprite-frames";
import { boardPoint, drawTavernFloor, drawTavernCounter, drawIngredientIcon, ornament, TAVERN_VIEW } from "./tavern-renderer";
import { OrderHud } from "./order-hud";
import { PLAYER_ANCHORS, transformAnchors } from "./character-anchors";
import { drawCatAccessory } from "./accessory-art";
import { clearSoloSave, defaultSettings, loadSettings, loadSoloSave, saveSettings, saveSoloSave, type DisplayAudioSettings } from "./preferences";
import { drawTitlePortrait, TITLE_ACCESSORIES, type TitleAccessory } from "./title-portrait";
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
let selectedRole: CatRole = "Tabby";
let selectedAccessory: TitleAccessory = "Bow tie";
let sessionMode: "single" | "multiplayer" = sessionStorage.getItem("paws-pours-mode") === "single" ? "single" : "multiplayer";
let settings: DisplayAudioSettings = loadSettings();
let move = { x: 0, y: 0 };
let lastMove = 0;
let lastStateMessage = "";
type LocalPrediction = Pick<Player, "x" | "y" | "direction" | "moving" | "moveSequence">;
let localPrediction: LocalPrediction | null = null;
let lastSentMoveSequence = 0;
let recipeBookOpen = false;
let recipeBookPage = 0;
let pausePanel: "main" | "settings" = "main";

const catPortraits: Record<CatRole, string> = {
  "Tabby": tabbyPortraitUrl, "Siamese": siamesePortraitUrl, "Maine Coon": maineCoonPortraitUrl,
  "Black Cat": blackCatPortraitUrl, "Calico": calicoPortraitUrl
};
const titlePortraitImages = Object.fromEntries(Object.entries(catPortraits).map(([role, source]) => {
  const image = new Image(); image.addEventListener("load", renderTitlePreviews); image.src = source;
  return [role, image];
})) as Record<CatRole, HTMLImageElement>;
const scrapBin = new Image(); scrapBin.src = scrapBinUrl;
const catBartenderSpritesheet = new Image(); catBartenderSpritesheet.src = catBartenderSpritesheetUrl;
const ingredientsSpritesheet = new Image(); ingredientsSpritesheet.src = ingredientsSpritesheetUrl;
const refreshOpenRecipeBook = () => {
  if (recipeBookOpen) drawRecipeBookPage(RECIPES[recipeBookPage], recipeBookPage);
};
ingredientsSpritesheet.addEventListener("load", refreshOpenRecipeBook);
onDrinkArtReady(refreshOpenRecipeBook);

const roles: { role: CatRole; perk: string }[] = [
  { role: "Tabby", perk: "Balanced" }, { role: "Siamese", perk: "Quick paws" },
  { role: "Maine Coon", perk: "Heavy lifter" }, { role: "Black Cat", perk: "Lucky tips" },
  { role: "Calico", perk: "Team spirit" }
];

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <main class="shell">
    <header class="topbar"><a class="brand" href="/"><span>🐾</span> Paws <i>&</i> Pours</a><span class="tag">Co-op roguelike bartending</span></header>
    <section id="menu" class="menu card title-menu">
      <div class="title-scene">
        <canvas id="title-decor" width="1000" height="350" aria-hidden="true"></canvas>
        <div class="title-heading"><p class="title-overline">✦ A CO-OP FANTASY TAVERN ✦</p><h1>PAWS <span>&amp;</span> POURS</h1><p class="title-tagline">Shake, serve, survive the night.</p></div>
        <div class="title-hero"><canvas id="hero-character" width="192" height="192" role="img" aria-label="Pixel-art Tabby bartender"></canvas><span class="title-hero-plaque">YOUR BARTENDER</span></div>
      </div>
      <div class="title-console">
        <section class="customizer-card"><div class="title-section-heading"><span>01</span><div><p class="eyebrow">The crew</p><h2>Choose your cat</h2></div></div><div class="setup-grid"><label>Cat name<input id="name" maxlength="16" value="Mittens" /></label><label>Fur color<input id="fur" type="color" value="#e5a265" /></label><div class="accessory-picker" role="group" aria-label="Accessory"><span>Accessory</span><div class="accessory-controls"><button type="button" id="accessory-prev" aria-label="Previous accessory">&#x276E;</button><output id="accessory-name" aria-live="polite">Bow tie</output><button type="button" id="accessory-next" aria-label="Next accessory">&#x276F;</button></div></div></div><div class="roles" id="roles"></div></section>
        <section class="title-actions" aria-label="Main menu"><div class="title-section-heading"><span>02</span><div><p class="eyebrow">The adventure</p><h2>Begin a shift</h2></div></div><div class="actions"><button class="primary" id="solo">Start solo shift</button><button id="create">Create party</button><div class="join"><input id="room-input" maxlength="4" placeholder="ROOM CODE" value="${roomCode}"/><button id="join">Join party</button></div></div><div class="menu-utilities"><button id="continue" class="secondary">Continue solo</button><button id="settings" class="secondary">Settings</button><button id="delete-save" class="secondary danger">Delete solo save</button></div></section>
      </div>
      <section id="settings-panel" class="settings-panel hidden" aria-label="Game settings">
        <div class="settings-title"><b>Settings</b><button id="close-settings" class="secondary">Close</button></div>
        <label>Display scale<select id="setting-scale"><option value="1">100%</option><option value="0.85">85%</option><option value="1.15">115%</option></select></label>
        <label class="toggle"><input id="setting-pixel" type="checkbox" /> Pixel-perfect rendering</label><label class="toggle"><input id="setting-motion" type="checkbox" /> Reduced motion</label>
        <button id="fullscreen" class="secondary">Toggle fullscreen</button>
        <label>Master volume<input id="setting-master" type="range" min="0" max="100" /></label><label>Music volume<input id="setting-music" type="range" min="0" max="100" /></label><label>Effects volume<input id="setting-effects" type="range" min="0" max="100" /></label><label class="toggle"><input id="setting-muted" type="checkbox" /> Mute audio</label>
        <button id="reset-settings" class="secondary">Reset settings</button>
      </section>
      <p class="fineprint">Solo saves stay on this device. Parties use shared server state only · Press <kbd>E</kbd> near a station to interact</p>
    </section>
    <section id="game" class="game hidden">
      <div class="game-header"><div><span class="eyebrow" id="theme">THE TAVERN</span><strong id="room-display">ROOM ----</strong></div><div class="stats"><span>🪙 <b id="coins">0</b></span><span>★ <b id="rep">0</b></span><span class="heart-status" id="heart-status" aria-label="3 team hearts"><span id="heart-icons" aria-hidden="true">♥♥♥</span><b id="health">3</b></span><span class="timer" id="timer">3:00</span></div><button class="leave" id="game-menu" type="button">Menu · Pause</button></div>
      <section id="order-hud" class="order-hud" aria-label="Current orders and required ingredients"></section>
      <div class="canvas-card"><canvas id="board" width="1088" height="680" aria-label="Paws and Pours game board"></canvas><div id="toast" class="toast"></div></div>
      <p class="controls"><kbd>WASD</kbd> move · <kbd>E</kbd> interact · <kbd>Q</kbd> place / pick up drink · <span id="interaction"></span> · <span id="carry">Paws empty</span></p>
    </section>
    <section id="overlay" class="overlay hidden"></section>
  </main>`;

const menu = document.querySelector<HTMLElement>("#menu")!;
const game = document.querySelector<HTMLElement>("#game")!;
const overlay = document.querySelector<HTMLElement>("#overlay")!;
const canvas = document.querySelector<HTMLCanvasElement>("#board")!;
const context = canvas.getContext("2d")!;
canvas.width = TAVERN_VIEW.width; canvas.height = TAVERN_VIEW.height;
const orderHud = new OrderHud(document.querySelector<HTMLElement>("#order-hud")!, ingredientsSpritesheet);
const mixingWorkspace = new MixingWorkspace(game, {
  addIngredient: (ingredient) => socket.emit("mix-ingredient", ingredient),
  startTool: (tool) => socket.emit("mix-tool-start", tool),
  finishTool: (tool) => socket.emit("mix-tool-finish", tool),
  rhythmHit: (style, hand) => socket.emit("mix-rhythm-hit", { style, hand }),
  pause: () => socket.emit("set-pause", true),
  cancel: () => socket.emit("cancel-mixing")
});

function profile() {
  return {
    token, name: (document.querySelector<HTMLInputElement>("#name")!).value.trim() || "Mittens",
    role: selectedRole, fur: (document.querySelector<HTMLInputElement>("#fur")!).value,
    accessory: selectedAccessory
  };
}
function applySettings() {
  document.documentElement.style.setProperty("--game-scale", String(settings.scale));
  document.body.dataset.pixelPerfect = String(settings.pixelPerfect);
  document.body.dataset.reducedMotion = String(settings.reducedMotion);
  saveSettings(settings);
}
function syncSettingsForm() {
  document.querySelector<HTMLSelectElement>("#setting-scale")!.value = String(settings.scale);
  document.querySelector<HTMLInputElement>("#setting-pixel")!.checked = settings.pixelPerfect;
  document.querySelector<HTMLInputElement>("#setting-motion")!.checked = settings.reducedMotion;
  document.querySelector<HTMLInputElement>("#setting-master")!.value = String(settings.masterVolume);
  document.querySelector<HTMLInputElement>("#setting-music")!.value = String(settings.musicVolume);
  document.querySelector<HTMLInputElement>("#setting-effects")!.value = String(settings.effectsVolume);
  document.querySelector<HTMLInputElement>("#setting-muted")!.checked = settings.muted;
}
function refreshSoloActions() {
  const save = loadSoloSave();
  document.querySelector<HTMLButtonElement>("#continue")!.disabled = !save;
  document.querySelector<HTMLButtonElement>("#delete-save")!.disabled = !save;
}
applySettings();
function renderTitlePreviews() {
  const fur = document.querySelector<HTMLInputElement>("#fur")?.value;
  if (!fur) return;
  const heroCharacter = document.querySelector<HTMLCanvasElement>("#hero-character");
  if (heroCharacter) {
    drawTitlePortrait(heroCharacter, titlePortraitImages[selectedRole], selectedRole, fur, selectedAccessory);
    heroCharacter.setAttribute("aria-label", `Pixel-art ${selectedRole} bartender wearing ${selectedAccessory}`);
  }
  document.querySelectorAll<HTMLCanvasElement>(".role-photo").forEach((canvas) => {
    const role = canvas.closest<HTMLButtonElement>(".role")?.dataset.role as CatRole | undefined;
    if (role) drawTitlePortrait(canvas, titlePortraitImages[role], role, fur, selectedAccessory);
  });
}
function renderRoles() {
  document.querySelector("#roles")!.innerHTML = roles.map(({ role, perk }) => `<button class="role ${role === selectedRole ? "selected" : ""}" data-role="${role}" aria-pressed="${role === selectedRole}"><span class="role-portrait"><canvas class="role-photo" width="192" height="192" aria-hidden="true"></canvas></span><b>${role}</b><small>${perk}</small></button>`).join("");
  renderTitlePreviews();
  document.querySelectorAll<HTMLButtonElement>(".role").forEach((button) => button.onclick = () => { selectedRole = button.dataset.role as CatRole; renderRoles(); });
}
function renderAccessoryChoice() {
  document.querySelector<HTMLOutputElement>("#accessory-name")!.value = selectedAccessory;
  renderTitlePreviews();
}
renderRoles();
document.querySelector<HTMLInputElement>("#fur")!.addEventListener("input", renderTitlePreviews);
document.querySelector<HTMLInputElement>("#fur")!.addEventListener("change", renderTitlePreviews);
(["prev", "next"] as const).forEach((direction) => document.querySelector<HTMLButtonElement>(`#accessory-${direction}`)!.onclick = () => {
  const offset = direction === "next" ? 1 : -1;
  selectedAccessory = TITLE_ACCESSORIES[(TITLE_ACCESSORIES.indexOf(selectedAccessory) + offset + TITLE_ACCESSORIES.length) % TITLE_ACCESSORIES.length];
  renderAccessoryChoice();
});

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
document.querySelector<HTMLButtonElement>("#solo")!.onclick = () => { sessionMode = "single"; sessionStorage.setItem("paws-pours-mode", sessionMode); connect("create"); };
document.querySelector<HTMLButtonElement>("#create")!.onclick = () => { sessionMode = "multiplayer"; sessionStorage.setItem("paws-pours-mode", sessionMode); connect("create"); };
document.querySelector<HTMLButtonElement>("#join")!.onclick = () => { sessionMode = "multiplayer"; sessionStorage.setItem("paws-pours-mode", sessionMode); connect("join"); };
document.querySelector<HTMLButtonElement>("#game-menu")!.onclick = () => {
  if (state?.phase === "shift" && state.pausedAt === null) socket.emit("set-pause", true);
};
document.querySelector<HTMLButtonElement>("#settings")!.onclick = () => { syncSettingsForm(); document.querySelector("#settings-panel")!.classList.remove("hidden"); };
document.querySelector<HTMLButtonElement>("#close-settings")!.onclick = () => document.querySelector("#settings-panel")!.classList.add("hidden");
document.querySelector<HTMLButtonElement>("#fullscreen")!.onclick = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); };
document.querySelector<HTMLButtonElement>("#reset-settings")!.onclick = () => { settings = { ...defaultSettings }; applySettings(); syncSettingsForm(); };
(["scale", "pixel", "motion", "master", "music", "effects", "muted"] as const).forEach((key) => document.querySelector(`#setting-${key}`)!.addEventListener("input", () => {
  settings = {
    scale: Number(document.querySelector<HTMLSelectElement>("#setting-scale")!.value) as DisplayAudioSettings["scale"],
    pixelPerfect: document.querySelector<HTMLInputElement>("#setting-pixel")!.checked,
    reducedMotion: document.querySelector<HTMLInputElement>("#setting-motion")!.checked,
    masterVolume: Number(document.querySelector<HTMLInputElement>("#setting-master")!.value),
    musicVolume: Number(document.querySelector<HTMLInputElement>("#setting-music")!.value),
    effectsVolume: Number(document.querySelector<HTMLInputElement>("#setting-effects")!.value),
    muted: document.querySelector<HTMLInputElement>("#setting-muted")!.checked
  };
  applySettings();
}));
document.querySelector<HTMLButtonElement>("#continue")!.onclick = () => {
  const save = loadSoloSave(); if (!save) return;
  document.querySelector<HTMLInputElement>("#name")!.value = save.profile.name;
  document.querySelector<HTMLInputElement>("#fur")!.value = save.profile.fur;
  selectedAccessory = TITLE_ACCESSORIES.includes(save.profile.accessory as TitleAccessory) ? save.profile.accessory as TitleAccessory : "Bow tie";
  renderAccessoryChoice();
  selectedRole = save.profile.role as CatRole; renderRoles();
  sessionMode = "single"; sessionStorage.setItem("paws-pours-mode", sessionMode); connect("create");
};
document.querySelector<HTMLButtonElement>("#delete-save")!.onclick = () => { if (window.confirm("Delete the local solo profile and progress summary?")) { clearSoloSave(); refreshSoloActions(); } };
refreshSoloActions();

socket.on("joined", ({ code }: { code: string }) => { roomCode = code; sessionStorage.setItem("paws-pours-room", code); menu.classList.add("hidden"); game.classList.remove("hidden"); setToast(`Joined room ${code}.`); });
socket.on("state", (next: GameState) => {
  const authoritativePlayer = next.players[token];
  if (authoritativePlayer) {
    if (next.pausedAt !== null) {
      move = { x: 0, y: 0 };
      localPrediction = null;
      authoritativePlayer.moving = false;
    } else if (next.mixing[token]) {
      move = { x: 0, y: 0 };
      localPrediction = null;
      authoritativePlayer.moving = false;
    } else {
      const acknowledgedSequence = authoritativePlayer.moveSequence ?? 0;
      lastSentMoveSequence = Math.max(lastSentMoveSequence, acknowledgedSequence);
      if (localPrediction) {
        const inputActive = Boolean(move.x || move.y);
        const awaitingAcknowledgement = acknowledgedSequence < localPrediction.moveSequence;
        if (inputActive || localPrediction.moving || awaitingAcknowledgement) Object.assign(authoritativePlayer, localPrediction);
        else localPrediction = null;
      }
    }
  }
  state = next; renderUi();
  if (sessionMode === "single") {
    const player = next.players[token];
    if (player) saveSoloSave({ version: 1, profile: profile(), savedAt: Date.now(), summary: { coins: next.coins, reputation: next.reputation, round: next.round, phase: next.phase } });
  }
});
socket.on("error-message", (message: string) => setToast(message));
socket.on("connect", () => { if (roomCode && state) socket.emit("join-room", { ...profile(), code: roomCode }); });
socket.on("disconnect", () => setToast("Reconnecting to the tavern…"));

function setToast(message: string) { const element = document.querySelector("#toast")!; element.textContent = message; element.classList.add("show"); window.setTimeout(() => element.classList.remove("show"), 2800); }
function localPlayer() { return state?.players[token]; }
function time(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
function renderUi() {
  if (!state) return;
  orderHud.render(state.orders);
  document.querySelector("#theme")!.textContent = state.tavern.theme.toUpperCase();
  document.querySelector("#room-display")!.textContent = sessionMode === "single" ? "SOLO SHIFT" : `ROOM ${state.code}`;
  document.querySelector("#coins")!.textContent = String(state.coins);
  document.querySelector("#rep")!.textContent = String(state.reputation);
  const hearts = Math.max(0, Math.min(3, state.health));
  document.querySelector("#health")!.textContent = String(hearts);
  document.querySelector("#heart-icons")!.textContent = "♥".repeat(hearts) + "♡".repeat(3 - hearts);
  const heartStatus = document.querySelector<HTMLElement>("#heart-status")!;
  heartStatus.setAttribute("aria-label", `${hearts} team heart${hearts === 1 ? "" : "s"}`);
  heartStatus.classList.toggle("critical", hearts <= 1);
  document.querySelector("#timer")!.textContent = state.phase === "shift" ? `${state.pausedAt !== null ? "Ⅱ " : ""}${time(state.shiftSeconds)}` : state.phase.toUpperCase();
  document.querySelector<HTMLButtonElement>("#game-menu")!.disabled = state.phase !== "shift" || state.pausedAt !== null;
  const player = localPlayer();
  document.querySelector("#carry")!.textContent = state.mixing[token] ? `Preparing: ${recipeById(state.mixing[token].recipeId).name}` : player?.drink ? `Carrying: ${recipeById(player.drink).name}` : player?.carrying.length ? `Carrying: ${player.carrying.join(", ")}` : "Paws empty";
  if (state.message !== lastStateMessage) {
    lastStateMessage = state.message;
    setToast(state.message);
  }
  renderOverlay();
  mixingWorkspace.render(state, token);
}
function renderOverlay() {
  if (!state) return;
  overlay.classList.toggle("pause-overlay", state.phase === "shift" && state.pausedAt !== null);
  if (state.phase === "shift" && state.pausedAt !== null && recipeBookOpen) {
    overlay.classList.remove("hidden");
    const recipe = RECIPES[recipeBookPage];
    overlay.innerHTML = `<section class="recipe-book" aria-label="Bartender's recipe book"><canvas id="recipe-book-art" class="recipe-book-art" width="1000" height="590" aria-label="Illustrated recipe page for ${recipe.name}"></canvas><div class="recipe-book-controls"><button class="recipe-book-page" id="previous-recipe" ${recipeBookPage === 0 ? "disabled" : ""}>← Previous</button><span aria-live="polite">Recipe ${recipeBookPage + 1} of ${RECIPES.length}</span><button class="recipe-book-page" id="next-recipe" ${recipeBookPage === RECIPES.length - 1 ? "disabled" : ""}>Next →</button></div><button class="recipe-book-close" id="close-book">← Pause menu</button></section>`;
    document.querySelector<HTMLButtonElement>("#previous-recipe")!.onclick = () => { recipeBookPage -= 1; renderOverlay(); };
    document.querySelector<HTMLButtonElement>("#next-recipe")!.onclick = () => { recipeBookPage += 1; renderOverlay(); };
    document.querySelector<HTMLButtonElement>("#close-book")!.onclick = () => { recipeBookOpen = false; renderOverlay(); };
    window.requestAnimationFrame(() => drawRecipeBookPage(recipe, recipeBookPage));
  } else if (state.phase === "shift" && state.pausedAt !== null) {
    overlay.classList.remove("hidden");
    const pauser = state.players[state.pausedBy ?? ""]?.name ?? "A player";
    if (pausePanel === "settings") {
      overlay.innerHTML = `<div class="modal card pause-menu"><p class="eyebrow">SHIFT PAUSED FOR EVERYONE</p><h2>Settings</h2><div class="pause-settings settings-panel">
        <label>Display scale<select id="pause-scale"><option value="1">100%</option><option value="0.85">85%</option><option value="1.15">115%</option></select></label>
        <label class="toggle"><input id="pause-pixel" type="checkbox" /> Pixel-perfect rendering</label><label class="toggle"><input id="pause-motion" type="checkbox" /> Reduced motion</label>
        <button id="pause-fullscreen" class="secondary" type="button">Toggle fullscreen</button>
        <label>Master volume<input id="pause-master" type="range" min="0" max="100" /></label><label>Music volume<input id="pause-music" type="range" min="0" max="100" /></label><label>Effects volume<input id="pause-effects" type="range" min="0" max="100" /></label><label class="toggle"><input id="pause-muted" type="checkbox" /> Mute audio</label>
        <button id="pause-reset" class="secondary" type="button">Reset settings</button></div><button class="recipe-book-close" id="pause-back" type="button">← Pause menu</button></div>`;
      syncPauseSettingsForm();
      for (const key of ["scale", "pixel", "motion", "master", "music", "effects", "muted"]) document.querySelector(`#pause-${key}`)!.addEventListener("input", readPauseSettingsForm);
      document.querySelector<HTMLButtonElement>("#pause-fullscreen")!.onclick = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); };
      document.querySelector<HTMLButtonElement>("#pause-reset")!.onclick = () => { settings = { ...defaultSettings }; applySettings(); syncPauseSettingsForm(); syncSettingsForm(); };
      document.querySelector<HTMLButtonElement>("#pause-back")!.onclick = () => { pausePanel = "main"; renderOverlay(); };
    } else {
      overlay.innerHTML = `<div class="modal card pause-menu" role="dialog" aria-modal="true" aria-label="Paused game menu"><p class="eyebrow">SHIFT PAUSED FOR EVERYONE</p><h2>Pause menu</h2><p><span id="pause-by-name"></span> paused the tavern. The shift, orders, and preparation timers are frozen for all cats.</p><div class="pause-actions"><button class="primary" id="resume-shift" type="button">Resume for everyone</button><button id="open-pause-book" type="button">Recipe book</button><button id="open-pause-settings" type="button">Settings</button><button id="leave-game" type="button">Leave game</button></div></div>`;
      document.querySelector("#pause-by-name")!.textContent = pauser;
      document.querySelector<HTMLButtonElement>("#resume-shift")!.onclick = () => socket.emit("set-pause", false);
      document.querySelector<HTMLButtonElement>("#open-pause-book")!.onclick = () => { recipeBookPage = 0; recipeBookOpen = true; renderOverlay(); };
      document.querySelector<HTMLButtonElement>("#open-pause-settings")!.onclick = () => { pausePanel = "settings"; renderOverlay(); };
      document.querySelector<HTMLButtonElement>("#leave-game")!.onclick = () => { sessionStorage.removeItem("paws-pours-room"); location.reload(); };
    }
  } else if (state.phase === "lobby") {
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
  } else {
    recipeBookOpen = false;
    pausePanel = "main";
    overlay.classList.add("hidden");
  }
}

function syncPauseSettingsForm() {
  document.querySelector<HTMLSelectElement>("#pause-scale")!.value = String(settings.scale);
  for (const [key, value] of [["pixel", settings.pixelPerfect], ["motion", settings.reducedMotion], ["muted", settings.muted]] as const)
    document.querySelector<HTMLInputElement>(`#pause-${key}`)!.checked = value;
  for (const [key, value] of [["master", settings.masterVolume], ["music", settings.musicVolume], ["effects", settings.effectsVolume]] as const)
    document.querySelector<HTMLInputElement>(`#pause-${key}`)!.value = String(value);
}

function readPauseSettingsForm() {
  settings = {
    scale: Number(document.querySelector<HTMLSelectElement>("#pause-scale")!.value) as DisplayAudioSettings["scale"],
    pixelPerfect: document.querySelector<HTMLInputElement>("#pause-pixel")!.checked,
    reducedMotion: document.querySelector<HTMLInputElement>("#pause-motion")!.checked,
    masterVolume: Number(document.querySelector<HTMLInputElement>("#pause-master")!.value),
    musicVolume: Number(document.querySelector<HTMLInputElement>("#pause-music")!.value),
    effectsVolume: Number(document.querySelector<HTMLInputElement>("#pause-effects")!.value),
    muted: document.querySelector<HTMLInputElement>("#pause-muted")!.checked
  };
  applySettings();
  syncSettingsForm();
}

function rememberLocalPrediction(player: Player) {
  localPrediction = {
    x: player.x, y: player.y, direction: player.direction ?? "down",
    moving: player.moving, moveSequence: player.moveSequence ?? lastSentMoveSequence
  };
}
function emitMovement(player: Player, moving: boolean) {
  lastSentMoveSequence += 1; player.moveSequence = lastSentMoveSequence; player.moving = moving;
  rememberLocalPrediction(player);
  socket.emit("move", {
    x: player.x, y: player.y, direction: player.direction ?? "down",
    moving, sequence: lastSentMoveSequence
  });
}
function movePlayer() {
  const player = localPlayer();
  if (!state || !player || state.phase !== "shift" || state.pausedAt !== null || state.mixing[token]) return;
  if (!move.x && !move.y) {
    if (player.moving) emitMovement(player, false);
    return;
  }
  const length = Math.hypot(move.x, move.y); const speed = player.role === "Siamese" ? 3.3 : 2.7;
  player.direction = Math.abs(move.x) > Math.abs(move.y) ? (move.x < 0 ? "left" : "right") : (move.y < 0 ? "up" : "down");
  player.moving = true;
  const resolved = moveWithCounterCollisions(state.tavern, player, {
    x: player.x + move.x / length * speed,
    y: player.y + move.y / length * speed
  });
  player.x = resolved.x;
  player.y = resolved.y;
  rememberLocalPrediction(player);
  if (performance.now() - lastMove > 50) {
    emitMovement(player, true);
    lastMove = performance.now();
  }
}
const movementKeys: Record<string, keyof typeof move> = { w: "y", ArrowUp: "y", s: "y", ArrowDown: "y", a: "x", ArrowLeft: "x", d: "x", ArrowRight: "x" };
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state?.phase === "shift") {
    event.preventDefault();
    if (state.pausedAt === null) socket.emit("set-pause", true);
    else if (recipeBookOpen || pausePanel === "settings") { recipeBookOpen = false; pausePanel = "main"; renderOverlay(); }
    else socket.emit("set-pause", false);
    return;
  }
  if (state?.pausedAt !== null || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
  if (!event.repeat && event.key.toLowerCase() === "e" && state?.phase === "shift" && !state.mixing[token]) { event.preventDefault(); socket.emit("interact"); }
  if (!event.repeat && event.key.toLowerCase() === "q" && state?.phase === "shift" && !state.mixing[token]) { event.preventDefault(); socket.emit("counter-drink"); }
  const axis = movementKeys[event.key]; if (!axis) return;
  if (state?.mixing[token]) return;
  event.preventDefault(); move[axis] = event.key === "w" || event.key === "ArrowUp" || event.key === "a" || event.key === "ArrowLeft" ? -1 : 1;
});
window.addEventListener("keyup", (event) => { const axis = movementKeys[event.key]; if (axis) move[axis] = 0; });
window.addEventListener("blur", () => { move = { x: 0, y: 0 }; });

type Point = { x: number; y: number };
const characterTintCache = new Map<string, HTMLCanvasElement>();

function drawText(text: string, x: number, y: number, font: string, color: string) {
  context.font = font; context.fillStyle = color; context.textAlign = "center"; context.fillText(text, x, y);
}
function tintedCharacter(fur: string) {
  const cached = characterTintCache.get(fur);
  if (cached) return cached;
  const result = document.createElement("canvas");
  result.width = catBartenderSpritesheet.naturalWidth || 1319; result.height = catBartenderSpritesheet.naturalHeight || 1193;
  const layer = result.getContext("2d")!;
  layer.imageSmoothingEnabled = false; layer.drawImage(catBartenderSpritesheet, 0, 0);
  layer.globalCompositeOperation = "source-atop"; layer.globalAlpha = .38; layer.fillStyle = fur; layer.fillRect(0, 0, result.width, result.height);
  layer.globalCompositeOperation = "source-over"; layer.globalAlpha = .35; layer.drawImage(catBartenderSpritesheet, 0, 0);
  layer.globalAlpha = 1; characterTintCache.set(fur, result); return result;
}
function drawPlayer(player: Player) {
  const foot = boardPoint(player.x, player.y);
  const point = { x: Math.round(foot.x), y: Math.round(foot.y - 19) };
  context.strokeStyle = player.id === token ? "#ffd26d" : "#fff3d2"; context.lineWidth = 2;
  context.beginPath(); context.ellipse(point.x, point.y + 17, 23, 7, 0, 0, Math.PI * 2); context.stroke();
  context.fillStyle = "rgba(25,15,30,.36)"; context.beginPath(); context.ellipse(point.x, point.y + 16, 20, 7, 0, 0, Math.PI * 2); context.fill();
  const direction = player.direction ?? "down";
  if (catBartenderSpritesheet.complete && catBartenderSpritesheet.naturalWidth) {
    const frameIndex = player.moving ? Math.floor(performance.now() / 135) % 4 : 0;
    const frame = PLAYER_FRAMES[direction][frameIndex]; const scale = 72 / 298;
    const anchors = PLAYER_ANCHORS[direction][frameIndex];
    const width = frame.width * scale; const height = frame.height * scale;
    const left = Math.round(foot.x - (anchors.feetX - frame.x) * scale);
    const top = Math.round(foot.y - height);
    context.drawImage(tintedCharacter(player.fur), frame.x, frame.y, frame.width, frame.height, left, top, width, height);
    drawCatAccessory(context, player.accessory, transformAnchors(anchors, left - frame.x * scale, top - frame.y * scale, scale), direction);
  }
  else { context.fillStyle = player.fur; context.fillRect(point.x - 17, point.y - 40, 34, 52); }
  drawText(player.name, point.x, point.y + 36, "bold 10px system-ui", "#fff7e9");
  if (!player.connected) drawText("reconnecting…", point.x, point.y + 48, "9px system-ui", "#f07777");
  if (player.drink) {
    const handX = point.x + (direction === "left" ? -17 : 17);
    drawRecipeDrink(context, recipeById(player.drink), handX, point.y - 2, 22);
  } else if (player.carrying.length) {
    drawIngredientIcon(context, ingredientsSpritesheet, player.carrying[player.carrying.length - 1],
      point.x + (direction === "left" ? -17 : 17), point.y - 2, 22);
  }
}
function drawRecipeBookPage(recipe: Recipe, page: number) {
  const bookCanvas = document.querySelector<HTMLCanvasElement>("#recipe-book-art");
  const bookContext = bookCanvas?.getContext("2d");
  if (!bookCanvas || !bookContext) return;
  const { width, height } = bookCanvas;
  bookContext.clearRect(0, 0, width, height);

  // A drawn open book keeps the recipe UI in the same hand-crafted world as the tavern.
  bookContext.fillStyle = "rgba(10, 6, 14, .5)";
  bookContext.fillRect(28, 34, width - 56, height - 46);
  const leftPage = bookContext.createLinearGradient(48, 0, 490, height);
  leftPage.addColorStop(0, "#f3dba8"); leftPage.addColorStop(1, "#d6a96f");
  const rightPage = bookContext.createLinearGradient(510, 0, 952, height);
  rightPage.addColorStop(0, "#d8ae73"); rightPage.addColorStop(1, "#f4dca8");
  bookContext.fillStyle = leftPage; bookContext.fillRect(48, 20, 448, 530);
  bookContext.fillStyle = rightPage; bookContext.fillRect(504, 20, 448, 530);
  bookContext.fillStyle = "#5a3342"; bookContext.fillRect(490, 20, 20, 530);
  bookContext.fillStyle = "#2a182a";
  [496, 501, 506].forEach((x) => bookContext.fillRect(x, 27, 2, 516));
  bookContext.strokeStyle = "rgba(91, 52, 53, .24)";
  bookContext.lineWidth = 2;
  for (let y = 92; y < 524; y += 29) {
    bookContext.beginPath(); bookContext.moveTo(75, y); bookContext.lineTo(469, y); bookContext.stroke();
    bookContext.beginPath(); bookContext.moveTo(536, y); bookContext.lineTo(925, y); bookContext.stroke();
  }
  bookContext.strokeStyle = "#734348"; bookContext.lineWidth = 6;
  bookContext.strokeRect(55, 27, 434, 516); bookContext.strokeRect(511, 27, 434, 516);
  bookContext.fillStyle = "#543247";
  bookContext.font = "700 20px 'DM Mono', monospace";
  bookContext.fillText("PAWS & POURS", 83, 72);
  bookContext.font = "600 15px 'DM Mono', monospace";
  bookContext.fillText(`RECIPE ${String(page + 1).padStart(2, "0")}  /  ${String(RECIPES.length).padStart(2, "0")}`, 83, 112);
  bookContext.fillStyle = "#39223a";
  bookContext.font = "700 46px Fraunces, Georgia, serif";
  bookContext.fillText(recipe.name, 82, 178);
  bookContext.fillStyle = recipe.color;
  bookContext.fillRect(84, 198, 305, 9);
  bookContext.fillStyle = "#543247";
  bookContext.font = "700 19px 'DM Mono', monospace";
  bookContext.fillText("MIX THESE THREE", 84, 254);
  bookContext.font = "600 14px 'DM Mono', monospace";
  const actionSummary = recipe.preparation.actions.map((action) => action.kind === "rhythm"
    ? action.style === "chop" ? "chop" : "paw mix" : action.tool).join(" · ");
  bookContext.fillText(`Add in order · ${actionSummary} · serve`, 84, 287, 358);
  bookContext.fillText("Illustrated ingredient notes", 84, 315);
  bookContext.fillStyle = "rgba(92, 54, 53, .28)";
  bookContext.fillRect(84, 347, 300, 4);
  bookContext.fillText("A house special for thirsty patrons.", 84, 382);

  bookContext.fillStyle = "#543247";
  bookContext.font = "700 19px 'DM Mono', monospace";
  bookContext.fillText("FINISHED DRINK", 548, 70);
  bookContext.fillStyle = recipe.color;
  bookContext.beginPath(); bookContext.arc(736, 222, 126, 0, Math.PI * 2); bookContext.fill();
  bookContext.fillStyle = "rgba(255, 248, 223, .6)";
  bookContext.beginPath(); bookContext.arc(736, 222, 112, 0, Math.PI * 2); bookContext.fill();
  drawRecipeDrink(bookContext, recipe, 736, 222, 230);
  bookContext.fillStyle = "#543247";
  bookContext.font = "700 17px 'DM Mono', monospace";
  bookContext.fillText("INGREDIENTS", 548, 379);
  recipe.ingredients.forEach((ingredient, index) => {
    const x = 598 + index * 145;
    const frame = INGREDIENT_FRAMES[ingredient];
    bookContext.fillStyle = "rgba(255, 248, 223, .5)";
    bookContext.beginPath(); bookContext.arc(x, 456, 57, 0, Math.PI * 2); bookContext.fill();
    bookContext.fillStyle = "#543247";
    bookContext.font = "700 18px 'DM Mono', monospace";
    bookContext.fillText(String(index + 1), x - 5, 529);
    if (!frame || !ingredientsSpritesheet.complete || !ingredientsSpritesheet.naturalWidth) return;
    const scale = Math.min(96 / frame.width, 104 / frame.height);
    const imageWidth = frame.width * scale; const imageHeight = frame.height * scale;
    bookContext.drawImage(ingredientsSpritesheet, frame.x, frame.y, frame.width, frame.height, x - imageWidth / 2, 454 - imageHeight / 2, imageWidth, imageHeight);
  });
}
function drawHazard() {
  const hazard = state?.hazard;
  if (!hazard) return;
  const point = boardPoint(hazard.x, hazard.y);
  const pulse = Math.floor(performance.now() / 250) % 2;
  context.save();
  if (hazard.kind === "napkins") {
    context.fillStyle = "#eee2c7";
    [[-9, 2, 8, 5], [2, -2, 9, 6], [10, 7, 7, 4]].forEach(([x, y, width, height]) => context.fillRect(point.x + x, point.y + y, width, height));
    context.fillStyle = "#a75d66"; context.fillRect(point.x - 5, point.y + 4, 8, 1);
  } else if (hazard.kind === "ectoplasm") {
    context.fillStyle = pulse ? "#79d8bc" : "#59aa9a"; context.beginPath(); context.ellipse(point.x, point.y + 7, 17, 6, 0, 0, Math.PI * 2); context.fill();
    context.fillRect(point.x - 4, point.y - 4, 4, 10); context.fillRect(point.x + 6, point.y - 8, 3, 14);
  } else {
    context.fillStyle = "#f0b34e"; context.fillRect(point.x - 7, point.y - 12 - pulse * 2, 14, 20);
    context.fillStyle = "#f17b54"; context.fillRect(point.x - 4, point.y - 7, 8, 15);
    context.fillStyle = "#fff1b5"; context.fillRect(point.x - 2, point.y - 3, 4, 8);
  }
  context.restore(); drawText("MOP!", point.x, point.y + 28, "bold 7px system-ui", "#fff3cf");
}
function renderBoard() {
  requestAnimationFrame(renderBoard); movePlayer(); context.imageSmoothingEnabled = false;
  if (!state || state.phase === "lobby") {
    const titleCanvas = document.querySelector<HTMLCanvasElement>("#title-decor")!;
    const art = titleCanvas.getContext("2d")!;
    art.clearRect(0, 0, 1000, 350); art.imageSmoothingEnabled = false;
    ornament(art, 0, 140, 282, 130, 110);
    ornament(art, 5, 340, 302, 106, 85);
    ornament(art, 4, 505, 297, 57, 82);
    ornament(art, 2, 935, 82, 92, 102);
    for (const [x, y] of [[390, 245], [555, 230], [665, 82], [938, 214], [44, 72]]) {
      art.fillStyle = "#dfcaaa"; art.fillRect(x - 2, y - 6, 4, 12); art.fillRect(x - 6, y - 2, 12, 4);
    }
  }
  if (!state) return;
  drawTavernFloor(context, state.tavern);
  const player = localPlayer();
  const nearby = player && nearbyStation(state.tavern, player);
  document.querySelector("#interaction")!.textContent = nearby
    ? nearby.drink ? `E · Pick up ${recipeById(nearby.drink.recipeId).name}` : nearby.kind === "counter"
      ? "E · Set down drink" : `E · ${nearby.label}` : "Approach a counter";
  const objects = [
    ...state.tavern.stations.map((station) => ({ depth: stationBounds(station).bottom, draw: () =>
      drawTavernCounter(context, state!.tavern, station, ingredientsSpritesheet, scrapBin, station === nearby, state!.orders, catBartenderSpritesheet) })),
    ...Object.values(state.players).map((player) => ({ depth: player.y, draw: () => drawPlayer(player) }))
  ].sort((left, right) => left.depth - right.depth);
  objects.forEach((object) => object.draw());
  drawHazard();
  if (state.hazard) { context.fillStyle = "rgba(119,38,47,.93)"; context.fillRect(300, 678, 488, 26); drawText(`⚠ ${state.hazard.message}`, 544, 695, "bold 12px system-ui", "white"); }
}
renderBoard();
