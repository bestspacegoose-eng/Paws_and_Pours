import type { GameState } from "./game.js";

export const EMPTY_ROOM_RETENTION_MS = 2 * 60 * 60 * 1000;
export function roomExpired(state: GameState, emptySince: number | undefined, now: number) {
  return emptySince !== undefined && now - emptySince >= EMPTY_ROOM_RETENTION_MS &&
    !Object.values(state.players).some(player=>player.connected);
}
