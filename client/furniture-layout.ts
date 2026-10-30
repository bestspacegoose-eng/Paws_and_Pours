import { THEME_TILES } from "./theme-tiles-layout";
import type { Theme } from "../shared/game";
import type { FrameRect } from "./sprite-frames";

export interface FurnitureLayout {
  counters: [FrameRect, FrameRect, FrameRect];
  topHeights: [number, number, number];
  table: FrameRect; chair: FrameRect; stool: FrameRect; tableSpan?: number;
}
// Measured painted bounds, not equal divisions of the generated image.
export const FURNITURE_LAYOUT: Record<Theme, FurnitureLayout> = {
  "Cozy Village Pub": { ...THEME_TILES["Cozy Village Pub"]!, tableSpan:2 },
  "Haunted Moonlit Inn": {
    counters: [{x:23,y:198,width:411,height:314},{x:465,y:198,width:361,height:314},{x:849,y:198,width:371,height:314}],
    topHeights: [129,129,129], table:{x:39,y:667,width:433,height:427},
    chair:{x:564,y:610,width:266,height:488}, stool:{x:961,y:699,width:217,height:394}
  },
  "Pirate Cat Tavern": { ...THEME_TILES["Pirate Cat Tavern"]!, tableSpan:2 }
};
