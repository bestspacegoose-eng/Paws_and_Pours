import type { FrameRect } from "./sprite-frames";

// Painted bounds in the transparent 1536 × 1024 atlas, with a two-pixel gutter.
export const MINIGAME_FRAMES = {
  bowl: { x:31, y:80, width:353, height:254 },
  spoon: { x:532, y:14, width:86, height:331 },
  board: { x:751, y:120, width:396, height:178 },
  cleaver: { x:1184, y:147, width:336, height:124 },
  shaker: { x:118, y:370, width:177, height:319 },
  pourer: { x:520, y:355, width:110, height:334 },
  leftPaw: { x:854, y:383, width:191, height:306 },
  rightPaw: { x:1254, y:383, width:191, height:306 },
  tuna: { x:32, y:760, width:347, height:205 },
  lime: { x:440, y:754, width:304, height:211 },
  kelp: { x:798, y:755, width:333, height:223 },
  catnip: { x:1168, y:736, width:334, height:256 }
} satisfies Record<string, FrameRect>;

export type MinigameSprite = keyof typeof MINIGAME_FRAMES;

export const MIXING_BOWL = {
  left: 312, top: 230, width: 176, height: 127,
  mouthX: 400, mouthY: 269, liquidRadiusX: 68, liquidRadiusY: 21,
  frontY: 291, spoonPivotY: 276
};

// Source coordinates relative to the bottle crop, measured at its open tip.
export const POURING_BOTTLE = { tip: { x:60, y:4 }, height:118 };
