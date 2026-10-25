import { spoonMixFrame } from "./mixing-animation";

// Keep the vessel on the counter. Only the spoon and liquid highlights move.
export function drawStirringBowl(context: CanvasRenderingContext2D, color: string, elapsed: number, active: boolean, reducedMotion: boolean) {
  const pose = spoonMixFrame(elapsed, active, reducedMotion);
  context.fillStyle = "#24182e55"; context.fillRect(342, 346, 116, 7);
  context.fillStyle = "#35243a";
  context.fillRect(351, 278, 98, 7); context.fillRect(339, 285, 122, 27);
  context.fillRect(347, 312, 106, 20); context.fillRect(359, 332, 82, 14);
  context.fillStyle = "#b98263";
  context.fillRect(345, 287, 110, 21); context.fillRect(353, 308, 94, 19); context.fillRect(365, 327, 70, 13);
  context.fillStyle = "#e1ac78"; context.fillRect(350, 285, 100, 6);
  context.fillStyle = "#4b3448"; context.fillRect(352, 291, 96, 21);
  context.fillStyle = color; context.fillRect(357, 294, 86, 16);
  context.fillStyle = "#fff2cf77";
  context.fillRect(375 + pose.rippleX, 297, 17, 2); context.fillRect(409 - pose.rippleX, 304, 12, 2);
  context.save();
  context.beginPath(); context.rect(335, 220, 130, 90); context.clip();
  context.translate(400 + pose.spoonX, 301 + pose.spoonY);
  context.rotate(pose.angle);
  context.fillStyle = "#493046"; context.fillRect(-5, -64, 10, 63); context.fillRect(-9, -3, 18, 14);
  context.fillStyle = "#c39872"; context.fillRect(-3, -62, 6, 61); context.fillRect(-7, -1, 14, 10);
  context.fillStyle = "#f0d2a1"; context.fillRect(-2, -60, 2, 54); context.fillRect(-5, 0, 3, 7);
  context.restore();
  // Foreground rim occludes the spoon tip at the front of its circular path.
  context.fillStyle = "#e1ac78"; context.fillRect(350, 310, 100, 4);
  context.fillStyle = "#99664f"; context.fillRect(355, 314, 90, 4);
}
