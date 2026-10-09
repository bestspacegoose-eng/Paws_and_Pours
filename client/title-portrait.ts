import type { CatRole } from "../shared/game";
import { PORTRAIT_ANCHORS, transformAnchors } from "./character-anchors";
import { drawCatAccessory } from "./accessory-art";

export const TITLE_ACCESSORIES = ["Bow tie", "Wizard hat", "Pirate patch", "Flower crown"] as const;
export type TitleAccessory = typeof TITLE_ACCESSORIES[number];

const SIZE = 192;
type PortraitData = { pixels: ImageData; bounds: { top: number; bottom: number } };
const portraitData = new WeakMap<HTMLImageElement, PortraitData>();
const tintedPortraits = new WeakMap<HTMLImageElement, { color: string; canvas: HTMLCanvasElement }>();

function sourceData(image: HTMLImageElement): PortraitData {
  const cached = portraitData.get(image);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  let top = canvas.height, bottom = 0;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    if (pixels.data[(y * canvas.width + x) * 4 + 3] < 16) continue;
    top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
  }
  const result = { pixels, bounds: { top, bottom } };
  portraitData.set(image, result);
  return result;
}

function isFur(role: CatRole, x: number, y: number, r: number, g: number, b: number): boolean {
  if (role === "Black Cat") {
    const faceOrEar = y < 144;
    const pawOrTail = y > 207 || (y > 140 && (x < 42 || x > 107));
    return (faceOrEar || pawOrTail) && r < 145 && g < 110 && b < 155 && r + g + b > 55;
  }
  const warmFur = r > 83 && r > g * 1.1 && r - g > 13 && g > b * .76;
  const paleFur = r > 185 && g > 132 && b > 80 && r - g > 22;
  return warmFur || paleFur;
}

function tintedPortrait(image: HTMLImageElement, role: CatRole, color: string): HTMLCanvasElement {
  const cached = tintedPortraits.get(image);
  if (cached?.color === color) return cached.canvas;
  const { pixels } = sourceData(image);
  const result = document.createElement("canvas");
  result.width = pixels.width; result.height = pixels.height;
  const context = result.getContext("2d")!;
  const recolored = new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height);
  const target = [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16));
  for (let y = 0; y < pixels.height; y++) for (let x = 0; x < pixels.width; x++) {
    const offset = (y * pixels.width + x) * 4;
    const r = recolored.data[offset], g = recolored.data[offset + 1];
    const b = recolored.data[offset + 2], alpha = recolored.data[offset + 3];
    if (alpha < 16 || !isFur(role, x, y, r, g, b)) continue;
    const luminance = .2126 * r + .7152 * g + .0722 * b;
    const shade = role === "Black Cat" ? .43 + luminance / 370 : .5 + luminance / 300;
    for (let channel = 0; channel < 3; channel++) {
      const colored = target[channel] * shade + luminance * .08;
      recolored.data[offset + channel] = colored * .9 + recolored.data[offset + channel] * .1;
    }
  }
  context.putImageData(recolored, 0, 0);
  tintedPortraits.set(image, { color, canvas: result });
  return result;
}


export function drawTitlePortrait(canvas: HTMLCanvasElement, image: HTMLImageElement, role: CatRole, fur: string, accessory: TitleAccessory) {
  if (!image.complete || !image.naturalWidth) return;
  canvas.width = SIZE; canvas.height = SIZE;
  const context = canvas.getContext("2d")!;
  context.imageSmoothingEnabled = false;
  const anchors = PORTRAIT_ANCHORS[role];
  const height = anchors.bottom - anchors.top;
  const scale = 142 / height;
  const left = Math.round(SIZE / 2 - anchors.crown.x * scale);
  const top = Math.round(184 - anchors.bottom * scale);
  context.drawImage(tintedPortrait(image, role, fur), 0, anchors.top, image.naturalWidth, height,
    left, top + anchors.top * scale, image.naturalWidth * scale, height * scale);
  drawCatAccessory(context, accessory, transformAnchors(anchors, left, top, scale));
}
