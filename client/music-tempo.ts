import type { Phase } from "../shared/game";

// A clear closing-time rush, with eased changes and the original musical key.
export function shiftMusicRate(phase: Phase, seconds: number) {
  if (phase !== "shift" || !Number.isFinite(seconds)) return 1;
  const progress = Math.max(0, Math.min(1, (30 - seconds) / 25));
  const eased = 1 - (1 - progress) ** 2;
  return 1 + .4 * eased;
}

export function approachMusicRate(current: number, target: number, elapsedMs: number) {
  const step = .14 * Math.max(0, Math.min(100, elapsedMs)) / 1000;
  return current + Math.sign(target - current) * Math.min(Math.abs(target - current), step);
}
