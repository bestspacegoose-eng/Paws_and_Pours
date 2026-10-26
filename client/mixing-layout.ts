import type { FrameRect } from "./sprite-frames";
import { MINIGAME_FRAMES, POURING_BOTTLE } from "./minigame-art-layout";

// Serving glasses retain their illustrated sheet; tools use the new props atlas.
export const GLASS_CROPS = {
  tall: { x:222, y:554, width:201, height:391 },
  mug: { x:592, y:609, width:378, height:339 },
  goblet: { x:1083, y:565, width:273, height:380 }
} satisfies Record<string, FrameRect>;

export function glassLayout(glass: string, centerX = 400, bottom = 366) {
  const frame = GLASS_CROPS[glass as "tall" | "mug" | "goblet"] ?? GLASS_CROPS.tall;
  const scale = Math.min(128 / frame.width, 150 / frame.height);
  const width = frame.width * scale, height = frame.height * scale;
  // The mug's handle extends to the right, so the mouth is left of its bounds' center.
  const mouthFraction = glass === "mug" ? .38 : .5;
  const left = centerX - width * mouthFraction, top = bottom - height;
  return { frame, left, top, width, height, mouth: { x: centerX, y: top + height * .07 },
    innerLeft: left + width * .14, innerRight: left + width * (glass === "mug" ? .65 : .86) };
}

export function pouringLayout(glass: string, elapsed: number, active: boolean, reducedMotion = false) {
  const cup = glassLayout(glass);
  const progress = active ? reducedMotion ? 1 : Math.min(1, Math.max(0, elapsed / 350)) : 0;
  const angle = -1.05 * progress;
  // Rotate about the painted spout tip. The stream always starts at that same anchor.
  const spout = { x: cup.mouth.x + (1 - progress) * 110, y: cup.mouth.y - 96 - (1 - progress) * 28 };
  const bottleScale = POURING_BOTTLE.height / MINIGAME_FRAMES.pourer.height;
  const tipInFrame = POURING_BOTTLE.tip;
  return { cup, angle, spout, bottleScale, tipInFrame, bottleFrame: MINIGAME_FRAMES.pourer,
    stream: active && progress >= .99 ? 1 : 0, streamEnd: { x: cup.mouth.x, y: cup.mouth.y + 10 } };
}
