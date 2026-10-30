import type { CatRole, Vec } from "./game.js";

// World pixels per second, independent of the display refresh rate.
export function playerMoveSpeed(role: CatRole, multiplier = 1) { return (role === "Siamese" ? 272 : 224) * multiplier; }

export function movementTarget(position: Vec, input: Vec, role: CatRole, elapsedMs: number, multiplier = 1): Vec {
  const length = Math.hypot(input.x, input.y);
  if (!length) return { x: position.x, y: position.y };
  // Discard background-tab time so returning to a shift cannot teleport the cat.
  const distance = playerMoveSpeed(role, multiplier) * Math.max(0, Math.min(50, elapsedMs)) / 1000;
  return { x: position.x + input.x / length * distance, y: position.y + input.y / length * distance };
}
