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
import { boardPoint, drawTavernFloor, drawTavernCounter, drawIngredientIcon, drawBarGate, TAVERN_VIEW } from "./tavern-renderer";
import { OrderHud } from "./order-hud";
import { PLAYER_ANCHORS, transformAnchors } from "./character-anchors";
import { drawCatAccessory } from "./accessory-art";
import { defaultSettings, loadSettings, loadSoloSlots, saveSettings, saveSoloSlot, type DisplayAudioSettings, type SoloSave } from "./preferences";
import { captureSoloSnapshot } from "../shared/solo-save";
import { drawTitlePortrait, TITLE_ACCESSORIES, type TitleAccessory } from "./title-portrait";
import "./style.css";
import "./title-menu.css";
import "./menu-flow.css";
import { drawChopBadge, onPreparationArtReady } from "./preparation-art";

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
let sessionMode: "single" | "multiplayer" = sessionStorage.getItem("paws-pours-mode") === "multiplayer" ? "multiplayer" : "single";
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
let activeSaveSlot = Number(sessionStorage.getItem("paws-pours-save-slot") ?? -1);
let pendingSave: SoloSave | undefined;
let lastSaveAt = 0;
let saveStorageFailed = false;
let menuStep: "intro" | "selection" | "game" = "intro";
let connectionPending = false;
let sendPendingConnection: (() => void) | undefined;

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
onPreparationArtReady(refreshOpenRecipeBook);
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
    <section id="menu" class="menu card title-menu intro-menu" aria-label="Paws and Pours title menu">
      <div class="title-scene">
        <h1 class="visually-hidden">Paws and Pours</h1>
      </div>
      <div class="title-console">
        <section class="title-actions" aria-label="Main menu"><div class="title-section-heading"><h2>Enter the tavern</h2></div><div class="mode-switch" role="group" aria-label="Game mode"><button id="mode-solo" aria-pressed="true">Solo</button><button id="mode-party" aria-pressed="false">Multiplayer</button></div><div class="actions"><button class="primary" id="solo">Start solo game</button><button id="save-menu">Load / create local save</button><button id="create">Create game</button><div class="join"><input id="room-input" maxlength="4" placeholder="ROOM CODE" aria-label="Room code" value="${roomCode}"/><button id="join">Join game</button></div></div><div class="menu-utilities"><button id="settings" class="secondary">Settings · audio & display</button></div><p id="save-mode-note" class="menu-note">Three local save slots for solo adventures.</p><p id="menu-status" role="status" aria-live="polite"></p></section>
      </div>
      <section id="settings-panel" class="settings-panel hidden" aria-label="Game settings">
        <div class="settings-title"><b>Settings</b><button id="close-settings" class="secondary">Close</button></div>
        <label>Display scale<select id="setting-scale"><option value="1">100%</option><option value="0.85">85%</option><option value="1.15">115%</option></select></label>
        <label>Brightness<input id="setting-brightness" type="range" min="50" max="150" step="5" /><output id="brightness-value">100%</output></label>
        <label class="toggle"><input id="setting-pixel" type="checkbox" /> Pixel-perfect rendering</label><label class="toggle"><input id="setting-motion" type="checkbox" /> Reduced motion</label>
        <button id="fullscreen" class="secondary">Toggle fullscreen</button>
        <label>Master volume<input id="setting-master" type="range" min="0" max="100" /></label><label>Music volume<input id="setting-music" type="range" min="0" max="100" /></label><label>Effects volume<input id="setting-effects" type="range" min="0" max="100" /></label><label class="toggle"><input id="setting-muted" type="checkbox" /> Mute audio</label>
        <button id="reset-settings" class="secondary">Reset settings</button>
      </section>
      <p class="fineprint">Solo saves stay on this device. Parties use shared server state only · Press <kbd>E</kbd> near a station to interact</p>
    </section>
    <section id="bartender-selection" class="title-menu bartender-selection hidden" aria-labelledby="bartender-heading">
      <header class="selection-heading"><p>Paws <span>&amp;</span> Pours</p><h1 id="bartender-heading">Choose your bartender</h1><p id="selection-mode"></p><p id="selection-status" role="status" aria-live="polite"></p></header>
      <div id="player-slots" class="player-slots"></div>
      <div class="selection-tools">
        <section class="customizer-card"><div class="title-section-heading"><h2>Your bartender</h2></div><div class="setup-grid"><label>Cat name<input id="name" maxlength="16" value="Mittens" /></label><label>Fur color<input id="fur" type="color" value="#e5a265" /></label><div class="accessory-picker" role="group" aria-label="Cat type"><span>Cat type</span><div class="accessory-controls"><button type="button" id="role-prev" aria-label="Previous cat type">&#x276E;</button><output id="role-name" aria-live="polite">Tabby</output><button type="button" id="role-next" aria-label="Next cat type">&#x276F;</button></div></div><div class="accessory-picker" role="group" aria-label="Accessory"><span>Accessory</span><div class="accessory-controls"><button type="button" id="accessory-prev" aria-label="Previous accessory">&#x276E;</button><output id="accessory-name" aria-live="polite">Bow tie</output><button type="button" id="accessory-next" aria-label="Next accessory">&#x276F;</button></div></div></div></section>
        <div id="cat-presets" class="cat-presets" role="group" aria-label="Bartender cat presets"></div>
      </div>
      <footer class="selection-footer"><button id="selection-back">← Back</button><button id="ready-player" class="hidden">Ready</button><p id="crew-status" aria-live="polite"></p><button id="selection-start" class="primary">Start shift →</button></footer>
    </section>
    <section id="game" class="game hidden">
      <div class="game-header"><div><span class="eyebrow" id="theme">THE TAVERN</span><strong id="room-display">ROOM ----</strong></div><div class="stats"><span>🪙 <b id="coins">0</b></span><span>★ <b id="rep">0</b></span><span class="heart-status" id="heart-status" aria-label="3 team hearts"><span id="heart-icons" aria-hidden="true">♥♥♥</span><b id="health">3</b></span><span class="timer" id="timer">3:00</span></div><button class="leave" id="game-menu" type="button">Menu · Pause</button></div>
      <section id="order-hud" class="order-hud" aria-label="Current orders and required ingredients"></section>
      <div class="canvas-card"><canvas id="board" width="1088" height="680" aria-label="Paws and Pours game board"></canvas><div id="toast" class="toast"></div></div>
      <p class="controls"><kbd>WASD</kbd> move · <kbd>E</kbd> interact · <kbd>Q</kbd> place / pick up drink · <span id="interaction"></span> · <span id="carry">Paws empty</span></p>
    </section>
    <section id="overlay" class="overlay hidden"></section>
    <dialog id="save-dialog" class="save-dialog" aria-labelledby="save-title"><p class="eyebrow">LOCAL ADVENTURES</p><h2 id="save-title">Choose a save</h2><p>Your progress stays in this browser. Loaded shifts begin paused.</p><div id="save-slots" class="save-slots"></div><p id="save-error" role="status"></p><button id="close-saves" type="button">Back to title</button></dialog>
  </main>`;
const brightnessShade = document.createElement("div"); brightnessShade.id = "brightness-shade"; brightnessShade.setAttribute("aria-hidden", "true"); document.body.append(brightnessShade);

const menu = document.querySelector<HTMLElement>("#menu")!;
const selection = document.querySelector<HTMLElement>("#bartender-selection")!;
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
  brightnessShade.style.background = settings.brightness > 100 ? "white" : "black";
  brightnessShade.style.mixBlendMode = settings.brightness > 100 ? "screen" : "normal";
  brightnessShade.style.opacity = String(Math.abs(settings.brightness - 100) / 100);
  saveSettings(settings);
}
function syncSettingsForm() {
  document.querySelector<HTMLSelectElement>("#setting-scale")!.value = String(settings.scale);
  document.querySelector<HTMLInputElement>("#setting-pixel")!.checked = settings.pixelPerfect;
  document.querySelector<HTMLInputElement>("#setting-motion")!.checked = settings.reducedMotion;
  document.querySelector<HTMLInputElement>("#setting-brightness")!.value = String(settings.brightness);
  document.querySelector("#brightness-value")!.textContent = `${settings.brightness}%`;
  document.querySelector<HTMLInputElement>("#setting-master")!.value = String(settings.masterVolume);
  document.querySelector<HTMLInputElement>("#setting-music")!.value = String(settings.musicVolume);
  document.querySelector<HTMLInputElement>("#setting-effects")!.value = String(settings.effectsVolume);
  document.querySelector<HTMLInputElement>("#setting-muted")!.checked = settings.muted;
}
applySettings();
function setMenuMode(mode: "single" | "multiplayer") {
  sessionMode = mode; sessionStorage.setItem("paws-pours-mode", mode);
  document.querySelector<HTMLButtonElement>("#save-menu")!.disabled = mode === "multiplayer";
  document.querySelector<HTMLButtonElement>("#solo")!.disabled = mode === "multiplayer";
  document.querySelector<HTMLButtonElement>("#create")!.disabled = mode === "single";
  document.querySelector<HTMLInputElement>("#room-input")!.disabled = mode === "single";
  document.querySelector<HTMLButtonElement>("#join")!.disabled = mode === "single";
  document.querySelector("#mode-solo")!.setAttribute("aria-pressed", String(mode === "single"));
  document.querySelector("#mode-party")!.setAttribute("aria-pressed", String(mode === "multiplayer"));
  document.querySelector("#save-mode-note")!.textContent = mode === "single" ? "Three local save slots for solo adventures." : "Local saves are unavailable in multiplayer. Create a room or enter your friend's code.";
}
function setConnectionPending(pending: boolean) {
  connectionPending = pending;
  setMenuMode(sessionMode);
  for (const id of ["mode-solo", "mode-party", "selection-back"]) document.querySelector<HTMLButtonElement>(`#${id}`)!.disabled = pending;
  if (pending) for (const id of ["solo", "save-menu", "create", "join", "selection-start"]) document.querySelector<HTMLButtonElement>(`#${id}`)!.disabled = true;
  else if (menuStep === "selection") renderSelection();
}
function showIntro() {
  menuStep = "intro"; pendingSave = undefined;
  selection.classList.add("hidden"); menu.classList.remove("hidden"); game.classList.add("hidden"); overlay.classList.add("hidden");
  document.querySelector<HTMLButtonElement>(sessionMode === "single" ? "#solo" : "#create")!.focus();
}
function showSelection() {
  const entering = menuStep !== "selection";
  menuStep = "selection";
  menu.classList.add("hidden"); selection.classList.remove("hidden"); game.classList.add("hidden"); overlay.classList.add("hidden");
  renderSelection();
  if (entering) document.querySelector<HTMLInputElement>("#name")!.focus();
}
function syncLobbyProfile() {
  if (menuStep === "selection" && state?.phase === "lobby") socket.emit("lobby-profile", profile());
  document.querySelectorAll<HTMLElement>("[data-cat-preset]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.catPreset === selectedRole)));
}
function renderSelection() {
  const multiplayer = sessionMode === "multiplayer";
  const crew = state?.phase === "lobby" ? Object.values(state.players) : [];
  selection.classList.toggle("solo-selection", !multiplayer);
  document.querySelector("#selection-mode")!.textContent = multiplayer ? `MULTIPLAYER · ROOM ${state?.code ?? roomCode}` : pendingSave ? `SOLO · SAVE ${activeSaveSlot + 1} · Shift ${pendingSave.summary.round}` : activeSaveSlot >= 0 ? `SOLO · NEW SAVE ${activeSaveSlot + 1}` : "SOLO · QUICK SHIFT";
  const slots = document.querySelector<HTMLElement>("#player-slots")!;
  slots.replaceChildren();
  Array.from({ length: multiplayer ? 4 : 1 }, (_, index) => {
    const player = multiplayer ? crew[index] : undefined;
    const local = !multiplayer || player?.id === token;
    const card = document.createElement("article"); card.className = `player-slot${local ? " local-slot" : ""}${!player && multiplayer ? " empty-slot" : ""}`;
    card.innerHTML = `<h2>PLAYER ${index + 1}</h2><div class="slot-art"></div><strong class="slot-name"></strong><p class="slot-role"></p><p class="slot-state"></p>`;
    card.querySelector(".slot-name")!.textContent = local ? profile().name : player?.name ?? "Open seat";
    card.querySelector(".slot-role")!.textContent = local ? selectedRole : player?.role ?? "Share your room code";
    card.querySelector(".slot-state")!.textContent = !multiplayer ? "Your solo bartender" : player ? !player.connected ? "Reconnecting…" : player.ready ? "Ready ✓" : "Choosing" : "Waiting for a friend";
    card.classList.toggle("ready", Boolean(player?.ready));
    if (local || player) {
      const portrait = document.createElement("canvas"); portrait.className = "slot-portrait"; portrait.width = 192; portrait.height = 192; portrait.setAttribute("role", "img");
      portrait.dataset.player = player?.id ?? token; card.querySelector(".slot-art")!.append(portrait);
    } else card.querySelector(".slot-art")!.textContent = "+";
    slots.append(card);
  });
  const readyButton = document.querySelector<HTMLButtonElement>("#ready-player")!;
  readyButton.classList.toggle("hidden", !multiplayer); readyButton.textContent = localPlayer()?.ready ? "Change selection" : "Ready";
  const startButton = document.querySelector<HTMLButtonElement>("#selection-start")!;
  const isHost = state?.hostId === token;
  startButton.textContent = !multiplayer ? pendingSave?.snapshot ? "Load shift →" : "Start solo shift →" : isHost ? "Start shift →" : "Waiting for host";
  startButton.disabled = connectionPending || (multiplayer && (!isHost || crew.length < 2 || crew.some((cat) => !cat.connected || !cat.ready)));
  document.querySelector("#crew-status")!.textContent = !multiplayer ? "Choose your cat, then enter the tavern." : crew.length < 2 ? "Share your room code · waiting for players" : `${crew.filter((cat) => cat.connected && cat.ready).length}/${crew.length} bartenders ready`;
  renderTitlePreviews();
}
function renderTitlePreviews() {
  const fur = document.querySelector<HTMLInputElement>("#fur")?.value;
  if (!fur) return;
  selection.querySelectorAll<HTMLCanvasElement>(".slot-portrait").forEach((portrait) => {
    const player = state?.phase === "lobby" && portrait.dataset.player !== token ? state.players[portrait.dataset.player ?? ""] : undefined;
    const role = player?.role ?? selectedRole;
    const accessory = TITLE_ACCESSORIES.includes(player?.accessory as TitleAccessory) ? player!.accessory as TitleAccessory : selectedAccessory;
    drawTitlePortrait(portrait, titlePortraitImages[role], role, player?.fur ?? fur, accessory);
    portrait.setAttribute("aria-label", `${role} bartender wearing ${accessory}`);
  });
}
function renderRoles() {
  document.querySelector<HTMLOutputElement>("#role-name")!.value = selectedRole;
  renderTitlePreviews();
  syncLobbyProfile();
}
function renderAccessoryChoice() {
  document.querySelector<HTMLOutputElement>("#accessory-name")!.value = selectedAccessory;
  renderTitlePreviews();
  syncLobbyProfile();
}
renderRoles();
const presets = document.querySelector("#cat-presets")!;
roles.forEach(({ role, perk }) => {
  const button = document.createElement("button"); button.type = "button"; button.dataset.catPreset = role;
  button.setAttribute("aria-pressed", String(role === selectedRole));
  const image = document.createElement("img"); image.src = catPortraits[role]; image.alt = "";
  const name = document.createElement("b"); name.textContent = role;
  const bonus = document.createElement("small"); bonus.textContent = perk;
  button.append(image, name, bonus);
  button.onclick = () => { selectedRole = role; renderRoles(); renderSelection(); };
  presets.append(button);
});
(["prev", "next"] as const).forEach((direction) => document.querySelector<HTMLButtonElement>(`#role-${direction}`)!.onclick = () => {
  const index = roles.findIndex(({ role }) => role === selectedRole);
  selectedRole = roles[(index + (direction === "next" ? 1 : -1) + roles.length) % roles.length].role;
  renderRoles();
  renderSelection();
});
document.querySelector<HTMLInputElement>("#fur")!.addEventListener("input", () => { renderTitlePreviews(); syncLobbyProfile(); });
document.querySelector<HTMLInputElement>("#fur")!.addEventListener("change", renderTitlePreviews);
document.querySelector<HTMLInputElement>("#name")!.addEventListener("input", () => { syncLobbyProfile(); renderSelection(); });
(["prev", "next"] as const).forEach((direction) => document.querySelector<HTMLButtonElement>(`#accessory-${direction}`)!.onclick = () => {
  const offset = direction === "next" ? 1 : -1;
  selectedAccessory = TITLE_ACCESSORIES[(TITLE_ACCESSORIES.indexOf(selectedAccessory) + offset + TITLE_ACCESSORIES.length) % TITLE_ACCESSORIES.length];
  renderAccessoryChoice();
});

function connect(action: "create" | "join") {
  if (connectionPending) return;
  const code = document.querySelector<HTMLInputElement>("#room-input")!.value.toUpperCase().trim();
  if (action === "join" && !/^[A-Z0-9]{4}$/.test(code)) return setToast("Enter the four-character room code first.");
  const payload = { ...profile(), solo: sessionMode === "single", snapshot: sessionMode === "single" ? pendingSave?.snapshot : undefined };
  setConnectionPending(true);
  setToast(action === "join" ? "Joining the tavern…" : "Opening the tavern…");
  sendPendingConnection = () => {
    sendPendingConnection = undefined;
    socket.emit(action === "create" ? "create-room" : "join-room", action === "create" ? payload : { ...payload, code });
  };
  if (socket.connected) sendPendingConnection();
  else socket.connect();
}
document.querySelector<HTMLButtonElement>("#save-menu")!.onclick = openSaveMenu;
document.querySelector<HTMLButtonElement>("#solo")!.onclick = () => { setMenuMode("single"); pendingSave = undefined; activeSaveSlot = -1; sessionStorage.removeItem("paws-pours-save-slot"); showSelection(); };
document.querySelector<HTMLButtonElement>("#mode-solo")!.onclick = () => setMenuMode("single");
document.querySelector<HTMLButtonElement>("#mode-party")!.onclick = () => setMenuMode("multiplayer");
document.querySelector<HTMLButtonElement>("#create")!.onclick = () => { setMenuMode("multiplayer"); connect("create"); };
document.querySelector<HTMLButtonElement>("#join")!.onclick = () => { setMenuMode("multiplayer"); connect("join"); };
document.querySelector<HTMLButtonElement>("#selection-back")!.onclick = () => {
  if (state?.phase === "lobby") socket.emit("leave-lobby");
  else showIntro();
};
document.querySelector<HTMLButtonElement>("#ready-player")!.onclick = () => socket.emit("lobby-ready", !localPlayer()?.ready);
document.querySelector<HTMLButtonElement>("#selection-start")!.onclick = () => {
  if (sessionMode === "single") connect("create");
  else socket.emit("start-shift");
};
setMenuMode(sessionMode);
document.querySelector<HTMLButtonElement>("#game-menu")!.onclick = () => {
  if (state?.phase === "shift" && state.pausedAt === null) socket.emit("set-pause", true);
};
document.querySelector<HTMLButtonElement>("#settings")!.onclick = () => { syncSettingsForm(); const panel = document.querySelector<HTMLElement>("#settings-panel")!; panel.classList.remove("hidden"); panel.scrollIntoView({ block: "center", behavior: settings.reducedMotion ? "instant" : "smooth" }); document.querySelector<HTMLSelectElement>("#setting-scale")!.focus({ preventScroll: true }); };
document.querySelector<HTMLButtonElement>("#close-settings")!.onclick = () => document.querySelector("#settings-panel")!.classList.add("hidden");
document.querySelector<HTMLButtonElement>("#fullscreen")!.onclick = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); };
document.querySelector<HTMLButtonElement>("#reset-settings")!.onclick = () => { settings = { ...defaultSettings }; applySettings(); syncSettingsForm(); };
(["scale", "pixel", "motion", "brightness", "master", "music", "effects", "muted"] as const).forEach((key) => document.querySelector(`#setting-${key}`)!.addEventListener("input", () => {
  settings = {
    scale: Number(document.querySelector<HTMLSelectElement>("#setting-scale")!.value) as DisplayAudioSettings["scale"],
    pixelPerfect: document.querySelector<HTMLInputElement>("#setting-pixel")!.checked,
    reducedMotion: document.querySelector<HTMLInputElement>("#setting-motion")!.checked,
    brightness: Number(document.querySelector<HTMLInputElement>("#setting-brightness")!.value),
    masterVolume: Number(document.querySelector<HTMLInputElement>("#setting-master")!.value),
    musicVolume: Number(document.querySelector<HTMLInputElement>("#setting-music")!.value),
    effectsVolume: Number(document.querySelector<HTMLInputElement>("#setting-effects")!.value),
    muted: document.querySelector<HTMLInputElement>("#setting-muted")!.checked
  };
  applySettings();
  document.querySelector("#brightness-value")!.textContent = `${settings.brightness}%`;
}));
function startSaveSlot(index: number, save: SoloSave | null) {
  pendingSave = save ?? undefined;
  activeSaveSlot = index; sessionStorage.setItem("paws-pours-save-slot", String(index));
  if (save) {
  document.querySelector<HTMLInputElement>("#name")!.value = save.profile.name;
  document.querySelector<HTMLInputElement>("#fur")!.value = save.profile.fur;
  selectedAccessory = TITLE_ACCESSORIES.includes(save.profile.accessory as TitleAccessory) ? save.profile.accessory as TitleAccessory : "Bow tie";
  renderAccessoryChoice();
  selectedRole = roles.some(({ role }) => role === save.profile.role) ? save.profile.role as CatRole : "Tabby"; renderRoles();
  }
  setMenuMode("single");
  document.querySelector<HTMLDialogElement>("#save-dialog")!.close(); showSelection();
}
function openSaveMenu() {
  if (sessionMode !== "single") return;
  const dialog = document.querySelector<HTMLDialogElement>("#save-dialog")!;
  const slots = document.querySelector("#save-slots")!; slots.replaceChildren();
  document.querySelector("#save-error")!.textContent = "";
  loadSoloSlots().forEach((save, index) => {
    const button = document.createElement("button"); button.className = "save-slot";
    const title = document.createElement("strong"), description = document.createElement("span");
    title.textContent = save ? `Slot ${index + 1} · ${save.profile.name}` : `Slot ${index + 1} · Empty`;
    description.textContent = save ? `${save.snapshot ? `Shift ${save.summary.round} · ${save.summary.coins} coins · ${save.summary.phase}` : "Legacy profile · start a new adventure"}\n${new Date(save.savedAt).toLocaleString()}` : "＋ Create a new adventure";
    button.append(title, description); button.onclick = () => {
      slots.querySelectorAll("button").forEach((item) => item.disabled = true);
      startSaveSlot(index, save);
    }; slots.append(button);
  });
  dialog.showModal();
}
document.querySelector<HTMLButtonElement>("#close-saves")!.onclick = () => document.querySelector<HTMLDialogElement>("#save-dialog")!.close();

socket.on("joined", ({ code }: { code: string }) => { setConnectionPending(false); document.querySelector<HTMLDialogElement>("#save-dialog")!.close(); pendingSave = undefined; roomCode = code; sessionStorage.setItem("paws-pours-room", code); setToast(`Joined room ${code}.`); });
socket.on("left-lobby", () => {
  state = null; roomCode = ""; sessionStorage.removeItem("paws-pours-room");
  document.querySelector<HTMLInputElement>("#room-input")!.value = ""; showIntro();
});
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
  state = next;
  if (next.phase === "lobby") { showSelection(); }
  else { menuStep = "game"; menu.classList.add("hidden"); selection.classList.add("hidden"); game.classList.remove("hidden"); }
  renderUi();
  if (sessionMode === "single") {
    const player = next.players[token];
    if (player && activeSaveSlot >= 0 && (Date.now() - lastSaveAt > 1000 || next.pausedAt !== null || next.phase !== "shift")) persistSoloSave();
  }
});
socket.on("error-message", (message: string) => {
  setConnectionPending(false);
  setToast(message); document.querySelector("#save-error")!.textContent = message;
  document.querySelectorAll<HTMLButtonElement>(".save-slot").forEach((button) => button.disabled = false);
});
function persistSoloSave() {
  if (!state || sessionMode !== "single" || activeSaveSlot < 0 || !state.players[token]) return;
  lastSaveAt = Date.now();
  const success = saveSoloSlot(activeSaveSlot, { version: 1, profile: profile(), savedAt: lastSaveAt,
    summary: { coins: state.coins, reputation: state.reputation, round: state.round, phase: state.phase }, snapshot: captureSoloSnapshot(state, token) });
  if (!success && !saveStorageFailed) { saveStorageFailed = true; setToast("Local storage is unavailable or full. This run cannot be saved."); }
}
window.addEventListener("pagehide", persistSoloSave);
socket.on("connect", () => { if (sendPendingConnection) sendPendingConnection(); else if (roomCode && state) socket.emit("join-room", { ...profile(), code: roomCode }); });
socket.on("connect_error", () => { sendPendingConnection = undefined; setConnectionPending(false); setToast("The tavern server is unavailable. Please try again shortly."); });
socket.on("disconnect", () => setToast("Reconnecting to the tavern…"));

function setToast(message: string) {
  const status = document.querySelector(menuStep === "selection" ? "#selection-status" : "#menu-status")!;
  status.textContent = message;
  const element = document.querySelector("#toast")!; element.textContent = message; element.classList.add("show"); window.setTimeout(() => element.classList.remove("show"), 2800);
}
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
        <label>Brightness<input id="pause-brightness" type="range" min="50" max="150" step="5" /></label>
        <label class="toggle"><input id="pause-pixel" type="checkbox" /> Pixel-perfect rendering</label><label class="toggle"><input id="pause-motion" type="checkbox" /> Reduced motion</label>
        <button id="pause-fullscreen" class="secondary" type="button">Toggle fullscreen</button>
        <label>Master volume<input id="pause-master" type="range" min="0" max="100" /></label><label>Music volume<input id="pause-music" type="range" min="0" max="100" /></label><label>Effects volume<input id="pause-effects" type="range" min="0" max="100" /></label><label class="toggle"><input id="pause-muted" type="checkbox" /> Mute audio</label>
        <button id="pause-reset" class="secondary" type="button">Reset settings</button></div><button class="recipe-book-close" id="pause-back" type="button">← Pause menu</button></div>`;
      syncPauseSettingsForm();
      for (const key of ["scale", "pixel", "motion", "brightness", "master", "music", "effects", "muted"]) document.querySelector(`#pause-${key}`)!.addEventListener("input", readPauseSettingsForm);
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
    overlay.classList.add("hidden");
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
  for (const [key, value] of [["brightness", settings.brightness], ["master", settings.masterVolume], ["music", settings.musicVolume], ["effects", settings.effectsVolume]] as const)
    document.querySelector<HTMLInputElement>(`#pause-${key}`)!.value = String(value);
}

function readPauseSettingsForm() {
  settings = {
    scale: Number(document.querySelector<HTMLSelectElement>("#pause-scale")!.value) as DisplayAudioSettings["scale"],
    pixelPerfect: document.querySelector<HTMLInputElement>("#pause-pixel")!.checked,
    reducedMotion: document.querySelector<HTMLInputElement>("#pause-motion")!.checked,
    brightness: Number(document.querySelector<HTMLInputElement>("#pause-brightness")!.value),
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
  bookContext.fillText(`Any ingredient order · ${actionSummary} · serve`, 84, 287, 358);
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
    bookContext.fillStyle = "rgba(255, 248, 223, .5)";
    bookContext.beginPath(); bookContext.arc(x, 456, 57, 0, Math.PI * 2); bookContext.fill();
    bookContext.fillStyle = "#543247";
    bookContext.font = "700 18px 'DM Mono', monospace";
    drawIngredientIcon(bookContext, ingredientsSpritesheet, ingredient, x, 454, 96);
    if (ingredient === "chopped-tuna") {
      drawChopBadge(bookContext, x + 38, 491, 34);
      bookContext.fillStyle = "#543247";
      bookContext.font = "600 12px monospace"; bookContext.fillText("CHOP FIRST", x - 35, 531);
    }
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
  if (!state || state.phase === "lobby") return;
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
  drawBarGate(context, Object.values(state.players), state.pausedAt !== null);
  drawHazard();
  if (state.hazard) { context.fillStyle = "rgba(119,38,47,.93)"; context.fillRect(300, 678, 488, 26); drawText(`⚠ ${state.hazard.message}`, 544, 695, "bold 12px system-ui", "white"); }
}
renderBoard();
