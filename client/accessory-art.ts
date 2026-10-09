import type { FacingDirection } from "../shared/game";
import type { CatAnchors } from "./character-anchors";

export function drawCatAccessory(context: CanvasRenderingContext2D, accessory: string, anchors: CatAnchors, direction: FacingDirection = "down") {
  const unit = anchors.headWidth / 36;
  const origin = accessory === "Bow tie" ? anchors.neck : accessory === "Pirate patch" ? anchors.eye : anchors.crown;
  const block = (x: number, y: number, width: number, height: number, color: string) => {
    context.fillStyle = color;
    context.fillRect(Math.round(origin.x + x * unit), Math.round(origin.y + y * unit), Math.max(1, Math.round(width * unit)), Math.max(1, Math.round(height * unit)));
  };
  context.save(); context.imageSmoothingEnabled = false;
  if (accessory === "Bow tie" && direction !== "up") {
    const wing = direction === "down" ? 1 : .75;
    block(-7 * wing, -3, 6 * wing, 7, "#2a1b34"); block(1, -3, 6 * wing, 7, "#2a1b34");
    block(-6 * wing, -2, 4 * wing, 5, "#a84276"); block(2, -2, 4 * wing, 5, "#a84276");
    block(-5 * wing, -1, 3 * wing, 2, "#e8789a"); block(2, -1, 3 * wing, 2, "#e8789a");
    block(-1, -2, 3, 5, "#e8bb6d"); block(0, -1, 1, 2, "#fff0b3");
  } else if (accessory === "Wizard hat") {
    block(-16, -1, 32, 4, "#251630"); block(-11, -7, 22, 7, "#251630");
    block(-7, -14, 14, 8, "#251630"); block(-3, -21, 7, 8, "#251630");
    block(-9, -5, 18, 5, "#635393"); block(-5, -12, 10, 7, "#635393"); block(-1, -18, 4, 7, "#635393");
    block(-14, 0, 28, 2, "#9574b4"); block(-9, -3, 18, 2, "#e9b96b"); block(0, -12, 2, 3, "#fff1b4");
  } else if (accessory === "Pirate patch") {
    if (direction !== "up") {
      context.strokeStyle = "#281b32"; context.lineWidth = Math.max(1, Math.round(unit));
      context.beginPath(); context.moveTo(anchors.crown.x - anchors.headWidth * .36, origin.y - unit * 6);
      context.lineTo(origin.x, origin.y - unit);
      context.lineTo(anchors.crown.x + anchors.headWidth * .36, origin.y - unit * 4); context.stroke();
      block(-4, -3, 8, 6, "#211629"); block(-3, 3, 6, 1, "#211629");
      block(-2, -2, 5, 4, "#483552"); block(-1, -1, 2, 1, "#aa83ba");
    }
  } else if (accessory === "Flower crown") {
    block(-14, -1, 28, 3, "#28452f"); block(-12, -2, 24, 2, "#65945a");
    for (const [x, color] of [[-10, "#ee91ae"], [0, "#edc575"], [10, "#bca3e9"]] as const) {
      block(x - 2, -5, 5, 6, "#34253e"); block(x - 3, -3, 7, 3, color);
      block(x - 1, -5, 3, 6, color); block(x, -3, 1, 2, "#fff0b6");
    }
  }
  context.restore();
}
