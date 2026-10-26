import type { Station, Theme } from "../shared/game";
import { PLAYER_FRAMES } from "./sprite-frames";
import { PLAYER_ANCHORS } from "./character-anchors";

// The source sprite is cropped at the hips. Walking feet must not hang below a seat.
export function seatedCustomerLayout(station: Station, x: number, chairBottom: number, theme: Theme) {
  const facing = station.facing ?? "down", frame = PLAYER_FRAMES[facing][0];
  const anchor = PLAYER_ANCHORS[facing][0];
  const sourceHeight = Math.round(frame.height * .84), height = 36, scale = height / sourceHeight;
  const stool = station.label === "Bar stool";
  const seatOffset = stool ? 39 : theme === "Cozy Village Pub" ? 16 : 17;
  const bottom = chairBottom - seatOffset;
  return { frame: { ...frame, height: sourceHeight },
    left: Math.round(x - (anchor.feetX - frame.x) * scale), top: Math.round(bottom - height),
    width: Math.round(frame.width * scale), height, bottom, frontFrom: stool ? .22 : .72 };
}
