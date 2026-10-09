import type { Recipe } from "../shared/game";
import drinksUrl from "./assets/tilemap/drinks-complete-atlas.png";
import { DRINK_SPRITES } from "./drink-sprites";

const drinks = new Image();
drinks.src = drinksUrl;
export function onDrinkArtReady(listener: () => void) { drinks.addEventListener("load", listener); }

export function drawRecipeDrink(context: CanvasRenderingContext2D, recipe: Recipe, x: number, y: number, size: number) {
  const frame = DRINK_SPRITES[recipe.id];
  if (frame && drinks.complete && drinks.naturalWidth) {
    const scale = Math.min(size / frame.width, size / frame.height);
    const width = Math.round(frame.width * scale), height = Math.round(frame.height * scale);
    context.save(); context.imageSmoothingEnabled = false;
    context.drawImage(drinks, frame.x, frame.y, frame.width, frame.height, Math.round(x - width / 2), Math.round(y - height / 2), width, height);
    context.restore(); return;
  }
  context.save();
  context.translate(Math.round(x - size / 2), Math.round(y - size / 2));
  context.scale(size / 64, size / 64);
  context.imageSmoothingEnabled = false;
  const block = (left: number, top: number, width: number, height: number, color: string) => {
    context.fillStyle = color; context.fillRect(left, top, width, height);
  };
  const ink = "#34253f", glass = "#d9eef0", shine = "#fff8dd";
  if (recipe.glass === "mug") {
    block(12, 16, 40, 39, ink); block(48, 22, 10, 25, ink); block(51, 26, 4, 15, glass);
    block(16, 19, 31, 31, recipe.color); block(14, 16, 36, 5, glass);
    block(18, 22, 4, 23, shine); block(24, 48, 20, 3, "#a8abb9");
  } else if (recipe.glass === "goblet") {
    block(10, 11, 44, 27, ink); block(13, 14, 38, 20, recipe.color);
    block(12, 10, 40, 4, glass); block(18, 15, 4, 14, shine);
    block(29, 38, 6, 14, ink); block(23, 52, 18, 4, ink); block(20, 56, 24, 3, glass);
  } else {
    block(17, 9, 31, 48, ink); block(20, 13, 25, 39, recipe.color);
    block(17, 9, 31, 5, glass); block(22, 16, 4, 31, shine);
    block(19, 53, 27, 4, glass);
  }
  block(35, 23, 3, 3, "#fff4d1"); block(39, 29, 2, 2, "#fff4d1");
  block(30, 41, 3, 3, "#fff4d1");
  context.restore();
}
