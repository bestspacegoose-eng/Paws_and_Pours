// Recolor fur pixels only. Purple outlines, eyes, apron, shirt, and bell retain
// their source colors; alpha and the original light/shadow pattern are preserved.
export function recolorFurPixels(source: Uint8ClampedArray, color: string, mask?: Uint8Array): Uint8ClampedArray {
  const result = new Uint8ClampedArray(source);
  const hex = /^#[0-9a-f]{6}$/i.test(color) ? color : "#e5a265";
  const target = [1,3,5].map(index => Number.parseInt(hex.slice(index, index + 2), 16));
  for (let offset = 0; offset < result.length; offset += 4) {
    if (mask && !mask[offset / 4]) continue;
    const r = source[offset], g = source[offset + 1], b = source[offset + 2];
    // Warm peach/tan pixels identify this walking sheet's fur. The shirt and
    // apron are neutral/purple; the gold bell is more saturated than the fur.
    if (source[offset + 3] < 16 || r < 115 || g < 75 || b < 65 || r - g < 10 || r - g > 85 || g - b < -8 || g - b > 65) continue;
    const light = (.2126 * r + .7152 * g + .0722 * b) / 200;
    for (let channel = 0; channel < 3; channel++) {
      const base = target[channel];
      result[offset + channel] = light <= 1 ? base * (.35 + .65 * light) : base + (255 - base) * Math.min(.45, (light - 1) * .65);
    }
  }
  return result;
}
import { PLAYER_FRAMES } from "./sprite-frames";
import { PLAYER_ANCHORS } from "./character-anchors";
import type { FacingDirection } from "../shared/game";

export function walkingFurMask(width: number, height: number): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (const direction of ["down", "left", "right", "up"] as FacingDirection[]) {
    PLAYER_FRAMES[direction].forEach((frame, index) => {
      const neck = PLAYER_ANCHORS[direction][index].neck;
      for (let y = frame.y; y < Math.min(height, frame.y + frame.height); y++) {
        for (let x = frame.x; x < Math.min(width, frame.x + frame.width); x++) {
          const face = y < neck.y - 8;
          const tail = direction === "right" || direction === "up" ? x < neck.x - 48 : x > neck.x + 55;
          const paws = y > neck.y + 25 && y < neck.y + 85 && Math.abs(x - neck.x) > 48;
          if (face || tail || paws) mask[y * width + x] = 1;
        }
      }
    });
  }
  return mask;
}

