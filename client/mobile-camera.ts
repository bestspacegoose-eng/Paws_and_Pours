import type { Vec } from "../shared/game";
import { TAVERN_VIEW } from "./tavern-projection";

export function mobileCamera(focus: Vec, width: number, height: number) {
  const aspect = Math.max(.1, width / Math.max(1, height));
  let viewWidth = Math.min(TAVERN_VIEW.width, Math.max(420, aspect * (aspect > 1.5 ? 340 : 440)));
  let viewHeight = viewWidth / aspect;
  if (viewHeight > TAVERN_VIEW.height) { viewHeight = TAVERN_VIEW.height; viewWidth = viewHeight * aspect; }
  return { x: Math.max(0, Math.min(TAVERN_VIEW.width - viewWidth, focus.x - viewWidth / 2)),
    y: Math.max(0, Math.min(TAVERN_VIEW.height - viewHeight, focus.y - viewHeight / 2)), width: viewWidth, height: viewHeight };
}
