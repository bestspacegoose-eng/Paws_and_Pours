import atlasUrl from "./assets/tilemap/minigame-props-v1.png";
import { MINIGAME_FRAMES, type MinigameSprite } from "./minigame-art-layout";

const atlas = new Image();
const listeners = new Set<() => void>();
atlas.onload = () => listeners.forEach(listener => listener());
atlas.src = atlasUrl;

export function onMinigameArtReady(listener: () => void) {
  listeners.add(listener);
  if (atlas.complete && atlas.naturalWidth) listener();
}

export function drawMinigameSprite(context: CanvasRenderingContext2D, name: MinigameSprite,
  x: number, y: number, width: number, height: number, alpha = 1) {
  if (!atlas.complete || !atlas.naturalWidth) return;
  const frame = MINIGAME_FRAMES[name];
  const scale = Math.min(width / frame.width, height / frame.height);
  const w = frame.width * scale, h = frame.height * scale;
  context.save();
  context.imageSmoothingEnabled = false;
  context.globalAlpha *= alpha;
  context.drawImage(atlas, frame.x, frame.y, frame.width, frame.height,
    Math.round(x - w / 2), Math.round(y - h / 2), Math.round(w), Math.round(h));
  context.restore();
}

// Draw a source band in place, so the painted front rim can hide submerged tools.
export function drawMinigameBand(context: CanvasRenderingContext2D, name: MinigameSprite,
  left: number, top: number, width: number, height: number, from = 0) {
  if (!atlas.complete || !atlas.naturalWidth) return;
  const frame = MINIGAME_FRAMES[name];
  context.drawImage(atlas, frame.x, frame.y + frame.height * from, frame.width, frame.height * (1 - from),
    left, top + height * from, width, height * (1 - from));
}
