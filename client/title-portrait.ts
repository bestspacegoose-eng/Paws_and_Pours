import type { CatRole } from "../shared/game";

export const TITLE_ACCESSORIES = ["Bow tie", "Wizard hat", "Pirate patch", "Flower crown"] as const;
export type TitleAccessory = typeof TITLE_ACCESSORIES[number];

const SIZE = 192;
const HEAD_X: Record<CatRole, number> = {
  "Tabby": 73, "Siamese": 72, "Maine Coon": 70, "Black Cat": 72, "Calico": 72
};
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

function drawAccessory(context: CanvasRenderingContext2D, accessory: TitleAccessory) {
  const block = (x: number, y: number, width: number, height: number, color: string) => {
    context.fillStyle = color; context.fillRect(x, y, width, height);
  };
  if (accessory === "Bow tie") {
    block(81, 115, 13, 12, "#25162d"); block(98, 115, 13, 12, "#25162d");
    block(84, 117, 8, 8, "#a84276"); block(100, 117, 8, 8, "#a84276");
    block(86, 118, 5, 4, "#e8789a"); block(101, 118, 5, 4, "#e8789a");
    block(93, 117, 6, 8, "#f2c979"); block(95, 118, 2, 3, "#fff0b3");
  } else if (accessory === "Wizard hat") {
    block(83, 0, 13, 7, "#251630"); block(78, 7, 25, 9, "#251630"); block(73, 16, 35, 10, "#251630");
    block(68, 26, 45, 11, "#251630"); block(58, 37, 68, 8, "#251630");
    block(84, 6, 10, 8, "#635393"); block(80, 16, 20, 9, "#635393"); block(75, 26, 31, 8, "#635393");
    block(65, 37, 54, 4, "#9874bc"); block(79, 29, 27, 4, "#e9b96b");
    block(89, 13, 5, 5, "#fff1b4"); block(105, 29, 4, 4, "#f9d68a");
  } else if (accessory === "Pirate patch") {
    block(55, 70, 65, 4, "#211629"); block(65, 73, 16, 3, "#211629");
    block(104, 70, 23, 7, "#211629"); block(105, 76, 21, 16, "#211629"); block(109, 89, 13, 3, "#211629");
    block(109, 78, 13, 10, "#483552"); block(111, 79, 5, 4, "#9c76b4");
  } else {
    block(65, 35, 61, 5, "#25412d"); block(70, 31, 51, 5, "#4c8149");
    for (const [x, color] of [[69, "#ee91ae"], [86, "#f2c975"], [104, "#bca3e9"], [119, "#ee91ae"]] as const) {
      block(x, 26, 10, 12, "#34253e"); block(x + 2, 24, 6, 14, color); block(x, 28, 10, 6, color);
      block(x + 4, 29, 3, 3, "#fff0b6");
    }
  }
}

export function drawTitlePortrait(canvas: HTMLCanvasElement, image: HTMLImageElement, role: CatRole, fur: string, accessory: TitleAccessory) {
  if (!image.complete || !image.naturalWidth) return;
  canvas.width = SIZE; canvas.height = SIZE;
  const context = canvas.getContext("2d")!;
  context.imageSmoothingEnabled = false;
  const { bounds } = sourceData(image);
  const scale = Math.min(166 / (bounds.bottom - bounds.top), 1);
  const left = Math.round(SIZE / 2 - HEAD_X[role] * scale);
  const top = Math.round(184 - bounds.bottom * scale);
  context.drawImage(tintedPortrait(image, role, fur), left, top, image.naturalWidth * scale, image.naturalHeight * scale);
  drawAccessory(context, accessory);
}
