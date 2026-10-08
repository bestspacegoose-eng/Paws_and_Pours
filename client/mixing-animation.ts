export interface HandMixFrame {
  bowlX: number;
  bowlY: number;
  liquidX: number;
  leftPawX: number;
  rightPawX: number;
}

// Pixel-snapped offsets keep the existing block shading crisp while a hit
// briefly gives the bowl and paws more energy.
export function handMixFrame(now: number, lastHitAt?: number, reducedMotion = false): HandMixFrame {
  if (reducedMotion) return { bowlX: 0, bowlY: 0, liquidX: 0, leftPawX: 0, rightPawX: 0 };
  const hitAge = lastHitAt === undefined ? Infinity : Math.max(0, now - lastHitAt);
  const impulse = Math.exp(-hitAge / 340);
  const phase = now / 115;
  const snap = (value: number) => Math.round(value / 2) * 2;
  return {
    bowlX: snap(Math.sin(phase) * (6 + 11 * impulse)),
    bowlY: snap(Math.cos(phase * 1.4) * (2 + 3 * impulse)),
    liquidX: snap(Math.sin(phase + 1.3) * (5 + 10 * impulse)),
    leftPawX: snap(Math.max(0, Math.sin(phase + .6)) * (5 + 14 * impulse)),
    rightPawX: snap(Math.max(0, -Math.sin(phase + .6)) * (5 + 14 * impulse))
  };
}
