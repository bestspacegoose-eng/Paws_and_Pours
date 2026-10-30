import type { Phase } from "../shared/game";

// Keep the original key and a restrained tempo: urgency, without a sped-up gag.
export function shiftMusicRate(phase: Phase, seconds: number) {
  if (phase !== "shift" || !Number.isFinite(seconds)) return 1;
  const progress = Math.max(0, Math.min(1, (45 - seconds) / 40));
  const eased = progress * progress * (3 - 2 * progress);
  return 1 + .18 * eased;
}

export function approachMusicRate(current: number, target: number, elapsedMs: number) {
  const step = .075 * Math.max(0, Math.min(100, elapsedMs)) / 1000;
  return current + Math.sign(target - current) * Math.min(Math.abs(target - current), step);
}
