export interface HandMixFrame {
  bowlX: number;
  bowlY: number;
  liquidX: number;
  leftPawX: number;
  rightPawX: number;
}

export function toolAnimationFrame(tool: "shaker" | "spoon" | "pourer", elapsed: number, reducedMotion = false) {
  if (reducedMotion) return { x: 0, y: 0, angle: 0, stream: 0 };
  const phase = elapsed / 160;
  if (tool === "shaker") return { x: Math.round(Math.sin(phase * 2) * 12), y: Math.round(Math.cos(phase * 2) * 5), angle: Math.sin(phase * 2) * .16, stream: 0 };
  if (tool === "spoon") return { x: Math.round(Math.cos(phase) * 7), y: Math.round(Math.sin(phase) * 3), angle: Math.sin(phase) * .06, stream: 0 };
  return { x: 12, y: Math.round(Math.sin(phase) * 2), angle: -.55 * Math.min(1, elapsed / 250), stream: Math.min(1, elapsed / 250) };
}

// Pixel-snapped paw impulses acknowledge each beat without moving the vessel.
export function handMixFrame(now: number, lastHitAt?: number, reducedMotion = false): HandMixFrame {
  if (reducedMotion) return { bowlX: 0, bowlY: 0, liquidX: 0, leftPawX: 0, rightPawX: 0 };
  const hitAge = lastHitAt === undefined ? Infinity : Math.max(0, now - lastHitAt);
  const impulse = Math.exp(-hitAge / 340);
  const phase = now / 115;
  const snap = (value: number) => Math.round(value / 2) * 2;
  return {
    bowlX: 0,
    bowlY: 0,
    liquidX: snap(Math.sin(phase + 1.3) * (5 + 10 * impulse)),
    leftPawX: snap(Math.max(0, Math.sin(phase + .6)) * (5 + 14 * impulse)),
    rightPawX: snap(Math.max(0, -Math.sin(phase + .6)) * (5 + 14 * impulse))
  };
}

export function spoonMixFrame(elapsed: number, active = true, reducedMotion = false) {
  if (!active || reducedMotion) return { bowlX: 0, bowlY: 0, spoonX: 12, spoonY: 0, angle: .35, rippleX: 0 };
  const phase = elapsed / 180;
  return { bowlX: 0, bowlY: 0, spoonX: Math.round(Math.cos(phase) * 25),
    spoonY: Math.round(Math.sin(phase) * 6), angle: .35 + Math.sin(phase) * .22,
    rippleX: Math.round(Math.cos(phase + 1) * 8) };
}
