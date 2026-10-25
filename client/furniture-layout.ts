import type { Theme } from "../shared/game";
import type { FrameRect } from "./sprite-frames";

export interface FurnitureLayout {
  counters: [FrameRect, FrameRect, FrameRect];
  topHeights: [number, number, number];
  table: FrameRect; chair: FrameRect; stool: FrameRect;
}
// Measured painted bounds, not equal divisions of the generated image.
export const FURNITURE_LAYOUT: Record<Theme, FurnitureLayout> = {
  "Cozy Village Pub": {
    counters: [{x:36,y:108,width:501,height:319},{x:582,y:99,width:429,height:328},{x:1064,y:99,width:429,height:328}],
    topHeights: [122,131,131], table:{x:65,y:586,width:450,height:371},
    chair:{x:626,y:506,width:286,height:454}, stool:{x:1173,y:526,width:249,height:432}
  },
  "Haunted Moonlit Inn": {
    counters: [{x:23,y:198,width:411,height:314},{x:465,y:198,width:361,height:314},{x:849,y:198,width:371,height:314}],
    topHeights: [129,129,129], table:{x:39,y:667,width:433,height:427},
    chair:{x:564,y:610,width:266,height:488}, stool:{x:961,y:699,width:217,height:394}
  },
  "Pirate Cat Tavern": {
    counters: [{x:34,y:158,width:432,height:387},{x:500,y:158,width:320,height:387},{x:886,y:158,width:331,height:387}],
    topHeights: [157,157,157], table:{x:54,y:689,width:433,height:411},
    chair:{x:544,y:639,width:270,height:473}, stool:{x:945,y:634,width:250,height:469}
  }
};
