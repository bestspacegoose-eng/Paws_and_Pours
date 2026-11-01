import type { GameState, Player } from "../shared/game";

export type LocalPrediction = Pick<Player,"x"|"y"|"direction"|"moving"|"moveSequence">;

export function reconcilePrediction(previous: GameState | null, next: GameState, playerId: string,
  prediction: LocalPrediction | null, inputActive: boolean, reconnecting = false): LocalPrediction | null {
  const player = next.players[playerId];
  if (!previous || !player || reconnecting || previous.code !== next.code || previous.round !== next.round ||
      previous.phase !== next.phase || previous.pausedAt !== next.pausedAt || next.phase !== "shift" ||
      next.pausedAt !== null || next.mixing[playerId] || next.mixingChoices?.[playerId]) return null;
  if (!prediction) return null;
  const acknowledged = player.moveSequence ?? 0;
  // Only unacknowledged movement may override server coordinates. Once a stop
  // is acknowledged, keep the resolved server position, including collisions.
  return inputActive || acknowledged < prediction.moveSequence ? prediction : null;
}
