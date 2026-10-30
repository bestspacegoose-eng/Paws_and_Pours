import type { Theme } from "../shared/game";
import type { FrameRect } from "./sprite-frames";

export interface ThemeTilesLayout {
  kitchen: FrameRect; floor: FrameRect; wall: FrameRect; window: FrameRect;
  counters: [FrameRect, FrameRect, FrameRect]; topHeights: [number, number, number];
  table: FrameRect; chair: FrameRect; stool: FrameRect; prop: FrameRect; rug: FrameRect;
  cabinet: FrameRect; lantern: FrameRect; barrel: FrameRect; notice: FrameRect;
  chairSeat: number; stoolSeat: number;
}
const frame = (x:number,y:number,width:number,height:number):FrameRect => ({x,y,width,height});
// Painted bounds measured independently; these atlases do not use equal cells.
// Floors crop inside their outer silhouette so adjacent tiles have no alpha gaps.
export const THEME_TILES: Partial<Record<Theme,ThemeTilesLayout>> = {
  "Cozy Village Pub": {
    kitchen:frame(55,56,235,230), floor:frame(361,57,227,228), wall:frame(636,29,278,280), window:frame(970,38,234,251),
    counters:[frame(23,358,344,240),frame(382,358,228,240),frame(626,358,225,241)],topHeights:[93,93,93],
    table:frame(856,383,385,225),chair:frame(75,636,191,293),stool:frame(389,664,172,266),
    prop:frame(647,668,203,253),rug:frame(872,701,370,208),cabinet:frame(39,966,306,242),
    lantern:frame(437,963,127,236),barrel:frame(663,966,199,251),notice:frame(946,955,252,244),
    chairSeat:.63,stoolSeat:.21
  },
  "Pirate Cat Tavern": {
    kitchen:frame(49,81,237,232),floor:frame(363,82,229,230),wall:frame(655,68,257,258),window:frame(966,68,260,258),
    counters:[frame(15,399,321,224),frame(358,399,258,224),frame(638,399,212,224)],topHeights:[86,86,86],
    table:frame(858,418,383,205),chair:frame(67,654,219,314),stool:frame(394,685,170,290),
    prop:frame(644,728,215,188),rug:frame(915,714,326,207),cabinet:frame(36,998,290,204),
    lantern:frame(417,970,141,232),barrel:frame(668,989,192,227),notice:frame(947,991,267,209),
    chairSeat:.64,stoolSeat:.20
  }
};
