import type { FrameRect } from "./sprite-frames";

// Tight silhouette bounds preserve the varied glass shapes and exclude neighboring cells.
export const DRINK_SPRITES: Record<string, FrameRect> = {
  catnip: { x: 60, y: 14, width: 290, height: 480 },
  moonmilk: { x: 420, y: 120, width: 374, height: 338 },
  tuna: { x: 815, y: 29, width: 306, height: 464 },
  "lunar-fizz": { x: 1238, y: 15, width: 248, height: 476 },
  "kelp-swirl": { x: 68, y: 511, width: 288, height: 492 },
  "star-spritz": { x: 447, y: 499, width: 257, height: 504 },
  "seafoam-shake": { x: 795, y: 588, width: 376, height: 393 }
};
