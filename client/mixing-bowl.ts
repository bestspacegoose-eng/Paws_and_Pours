import { spoonMixFrame } from "./mixing-animation";
import { drawMinigameBand, drawMinigameSprite } from "./minigame-art";
import { MIXING_BOWL as bowl } from "./minigame-art-layout";

// The vessel is stationary; the independent spoon passes behind its painted rim.
export function drawStirringBowl(context: CanvasRenderingContext2D, color: string, elapsed: number, active: boolean, reducedMotion: boolean) {
  const pose = spoonMixFrame(elapsed, active, reducedMotion);
  drawMinigameBand(context, "bowl", bowl.left, bowl.top, bowl.width, bowl.height);
  context.save();
  context.beginPath();
  context.ellipse(bowl.mouthX, bowl.mouthY, bowl.liquidRadiusX, bowl.liquidRadiusY, 0, 0, Math.PI * 2);
  context.clip();
  context.globalAlpha = .92;
  context.fillStyle = color; context.fill();
  context.globalAlpha = .55;
  context.strokeStyle = "#fff2cf"; context.lineWidth = 2;
  context.beginPath();
  context.ellipse(bowl.mouthX + pose.rippleX, bowl.mouthY, 26, 7, 0, Math.PI * 1.05, Math.PI * 1.8);
  context.stroke();
  context.restore();
  context.save();
  context.translate(bowl.mouthX + pose.spoonX, bowl.spoonPivotY + pose.spoonY);
  context.rotate(pose.angle);
  drawMinigameSprite(context, "spoon", 0, -36, 25, 96);
  context.restore();
  drawMinigameBand(context, "bowl", bowl.left, bowl.top, bowl.width, bowl.height, (bowl.frontY - bowl.top) / bowl.height);
}
