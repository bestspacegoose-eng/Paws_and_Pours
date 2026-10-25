import type { FacingDirection, Player } from "../shared/game";

export interface WalkAnimation { x: number; y: number; distance: number; lastMovedAt: number; frame: number; direction: FacingDirection }
export function advanceWalkAnimation(previous: WalkAnimation | undefined,
  player: Pick<Player, "x" | "y" | "moving" | "direction">, now: number, paused = false): WalkAnimation {
  const result = { x: player.x, y: player.y, distance: previous?.distance ?? 0,
    lastMovedAt: previous?.lastMovedAt ?? now, frame: previous?.frame ?? 0, direction: player.direction };
  const travelled = previous ? Math.hypot(player.x - previous.x, player.y - previous.y) : 0;
  if (!previous || paused || !player.moving || travelled > 116) {
    result.distance = 0; result.frame = 0;
  } else if (travelled > .01) {
    result.distance += travelled; result.lastMovedAt = now;
    result.frame = Math.floor(result.distance / 14) % 4;
  } else if (now - result.lastMovedAt > 160) {
    // Remote snapshots arrive at 20Hz; hold between packets, stop if position stalls.
    result.frame = 0; result.distance = 0;
  }
  return result;
}
