import type { CounterVariant, FacingDirection, MixingTool } from "../shared/game";

export type FrameRect = { x: number; y: number; width: number; height: number };

export const PLAYER_FRAMES: Record<FacingDirection, FrameRect[]> = {
  down: [
    { x: 137, y: 25, width: 213, height: 268 }, { x: 424, y: 28, width: 203, height: 267 },
    { x: 717, y: 30, width: 210, height: 265 }, { x: 999, y: 25, width: 210, height: 270 }
  ],
  left: [
    { x: 146, y: 313, width: 210, height: 266 }, { x: 439, y: 314, width: 210, height: 269 },
    { x: 730, y: 314, width: 203, height: 269 }, { x: 1026, y: 314, width: 208, height: 269 }
  ],
  right: [
    { x: 123, y: 598, width: 197, height: 297 }, { x: 398, y: 597, width: 213, height: 298 },
    { x: 688, y: 597, width: 211, height: 298 }, { x: 984, y: 597, width: 200, height: 298 }
  ],
  up: [
    { x: 128, y: 895, width: 204, height: 270 }, { x: 398, y: 895, width: 211, height: 267 },
    { x: 696, y: 895, width: 203, height: 265 }, { x: 991, y: 895, width: 198, height: 270 }
  ]
};

export const INGREDIENT_FRAMES: Record<string, FrameRect> = {
  catnip: { x: 112, y: 91, width: 341, height: 293 },
  lime: { x: 542, y: 139, width: 261, height: 224 },
  fizz: { x: 994, y: 57, width: 164, height: 339 },
  moonmilk: { x: 166, y: 414, width: 223, height: 355 },
  cream: { x: 542, y: 471, width: 286, height: 284 },
  stardust: { x: 969, y: 437, width: 195, height: 357 },
  tuna: { x: 81, y: 867, width: 363, height: 247 },
  tonic: { x: 567, y: 799, width: 183, height: 331 },
  kelp: { x: 883, y: 794, width: 367, height: 349 }
};

export const COUNTER_FRAME_INDEX: Record<CounterVariant, number> = {
  standard: 0,
  "end-cap": 1,
  corner: 2,
  ingredient: 3,
  mixing: 4,
  decorative: 5,
  damaged: 6
};

export const MIXING_TOOL_FRAME_INDEX: Record<MixingTool, number> = {
  shaker: 0,
  spoon: 1,
  pourer: 2
};

export const GLASS_FRAME_INDEX: Record<string, number> = {
  tall: 3,
  mug: 4,
  goblet: 5
};

export const MIXING_EFFECT_FRAME_INDEX = {
  paws: 0,
  activePaws: 1,
  success: 2,
  failure: 3,
  progress: 4,
  multiplayer: 5
} as const;

export function atlasFrame(image: HTMLImageElement, columns: number, rows: number, index: number): FrameRect {
  const width = image.naturalWidth / columns;
  const height = image.naturalHeight / rows;
  return { x: (index % columns) * width, y: Math.floor(index / columns) * height, width, height };
}
