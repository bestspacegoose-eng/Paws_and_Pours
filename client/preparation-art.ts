import preparationUrl from "./assets/tilemap/tuna-preparation.png";

const atlas = new Image();
const listeners = new Set<() => void>();
atlas.onload = () => listeners.forEach((listener) => listener());
atlas.src = preparationUrl;
export function onPreparationArtReady(listener: () => void) { listeners.add(listener); if (atlas.complete) listener(); }
const frames = [[40, 70, 745, 560], [875, 175, 575, 430], [1535, 72, 590, 570]];
export function drawPreparationArt(context: CanvasRenderingContext2D, index: number, x: number, y: number, size: number) {
  if (!atlas.complete || !atlas.naturalWidth) return;
  const [sx, sy, width, height] = frames[index], scale = size / Math.max(width, height);
  context.drawImage(atlas, sx, sy, width, height, Math.round(x - width * scale / 2), Math.round(y - height * scale / 2), Math.round(width * scale), Math.round(height * scale));
}
export function drawChopBadge(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
  context.fillStyle = "#f4e4c8"; context.fillRect(x - size / 2, y - size / 2, size, size);
  context.strokeStyle = "#78617f"; context.lineWidth = 1; context.strokeRect(x - size / 2, y - size / 2, size, size);
  drawPreparationArt(context, 2, x, y, size - 3);
}
