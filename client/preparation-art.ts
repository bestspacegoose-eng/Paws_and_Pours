import { gameImage } from "./game-assets";
import { drawMinigameSprite } from "./minigame-art";
import preparationUrl from "./assets/tilemap/tuna-preparation.png";

const atlas = gameImage(preparationUrl);
const listeners = new Set<() => void>();
atlas.onload = () => listeners.forEach((listener) => listener());

export function onPreparationArtReady(listener: () => void) { listeners.add(listener); if (atlas.complete && atlas.naturalWidth) listener(); }
const frames = [[40, 70, 745, 560], [875, 175, 575, 430], [1535, 72, 590, 570]];
// The shared station is an empty board. Food appears only after actual preparation.
export function drawChoppingBoard(context: CanvasRenderingContext2D, x:number, y:number, size:number, occupied=false) {
  drawMinigameSprite(context,"board",x,y,size,size*.5);
  if(!occupied)drawMinigameSprite(context,"cleaver",x+size*.08,y-size*.08,size*.66,size*.26);
}
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
