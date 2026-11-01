import { pauseShift, type CatRole, type GameState } from "./game.js";

export interface PlayerProfile { token: string; name: string; role: CatRole; fur: string; accessory: string }
const roles = ["Tabby", "Siamese", "Maine Coon", "Black Cat", "Calico"];
const accessories = ["Bow tie", "Wizard hat", "Pirate patch", "Flower crown"];

export function validProfile(input: unknown): input is PlayerProfile {
  if (!input || typeof input !== "object") return false;
  const p = input as PlayerProfile;
  return typeof p.token === "string" && /^[a-zA-Z0-9_.-]{1,100}$/.test(p.token) &&
    !["__proto__", "constructor", "prototype"].includes(p.token) &&
    typeof p.name === "string" && p.name.length <= 100 && roles.includes(p.role) &&
    typeof p.fur === "string" && /^#[0-9a-f]{6}$/i.test(p.fur) && accessories.includes(p.accessory);
}

export function resetPreparationGesture(state: GameState, playerId: string) {
  const session = state.mixing[playerId];
  if (!session) return;
  session.toolStartedAt = undefined;
  session.rhythmHits = 0;
  session.rhythmLastHitAt = undefined;
  session.rhythmQualityPoints = 0;
  session.feedback = "Connection restored. Restart this preparation step; your ingredients are kept.";
}

export function disconnectPlayer(state: GameState, playerId: string, now = Date.now()) {
  const player = state.players[playerId];
  if (!player) return;
  player.connected = false; player.moving = false; player.ready = false;
  resetPreparationGesture(state, playerId);
  const connected = Object.values(state.players).filter(cat => cat.connected);
  if (state.hostId === playerId && connected.length) state.hostId = connected[0].id;
  if (!connected.length) pauseShift(state, playerId, now);
  state.message = connected.length ? `${player.name} disconnected. Their cat is waiting to reconnect.` :
    "Everyone is offline. The shift is paused safely; reconnect and choose Resume.";
}
