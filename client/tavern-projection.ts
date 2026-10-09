import type { Vec } from "../shared/game";

export const TAVERN_VIEW = { width: 1088, height: 712, left: 80, top: 112, depth: .82 };
export function boardPoint(x: number, y: number): Vec {
  return { x: TAVERN_VIEW.left + x, y: TAVERN_VIEW.top + y * TAVERN_VIEW.depth };
}
