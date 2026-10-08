import { GRID_CELL_SIZE, GRID_COLUMNS, GRID_ROWS, stationBounds, recipeById, type Station, type Tavern, type Vec } from "../shared/game";
import { INGREDIENT_FRAMES } from "./sprite-frames";
import { drawRecipeDrink } from "./drink-art";

export const TAVERN_VIEW = { width: 1088, height: 680, left: 80, top: 84, depth: .82 };
export function boardPoint(x: number, y: number): Vec {
  return { x: TAVERN_VIEW.left + x, y: TAVERN_VIEW.top + y * TAVERN_VIEW.depth };
}
const palettes = {
  "Cozy Village Pub": { floor: ["#b98563", "#bf906c"], seam: "#95684f", top: "#746183", light: "#a88faf", front: "#49354e", wall: "#473047" },
  "Haunted Moonlit Inn": { floor: ["#77718c", "#817a96"], seam: "#60566f", top: "#597c80", light: "#85aba8", front: "#303c51", wall: "#323048" },
  "Pirate Cat Tavern": { floor: ["#a38162", "#ae8c69"], seam: "#826044", top: "#4d7c7c", light: "#88aaa0", front: "#324753", wall: "#293e4e" }
};

export function drawTavernFloor(context: CanvasRenderingContext2D, tavern: Tavern) {
  const p = palettes[tavern.theme], cell = GRID_CELL_SIZE;
  const width = GRID_COLUMNS * cell, height = GRID_ROWS * cell * TAVERN_VIEW.depth;
  const { left, top } = TAVERN_VIEW;
  context.fillStyle = "#201828"; context.fillRect(0, 0, TAVERN_VIEW.width, TAVERN_VIEW.height);
  context.fillStyle = "#17131d"; context.fillRect(left - 17, top - 47, width + 34, height + 69);
  context.fillStyle = p.wall; context.fillRect(left - 12, top - 43, width + 24, height + 60);
  for (let x = 0; x < GRID_COLUMNS; x++) for (let y = 0; y < GRID_ROWS; y++) {
    const a = boardPoint(x * cell, y * cell), b = boardPoint((x + 1) * cell, (y + 1) * cell);
    context.fillStyle = p.seam; context.fillRect(a.x, a.y, cell, b.y - a.y);
    context.fillStyle = p.floor[(x + y) % 2]; context.fillRect(a.x + 1, a.y + 1, cell - 2, b.y - a.y - 2);
    context.fillStyle = "#ffffff0a"; context.fillRect(a.x + 3, a.y + 3, cell - 6, 2);
    context.fillStyle = "#35263c13"; context.fillRect(a.x + 10 + (y % 2) * 9, a.y + 17, 24, 1);
  }
  // Inlaid lanes decorate the same grid; they never add collision.
  context.strokeStyle = "#ead19b60"; context.lineWidth = 2;
  context.strokeRect(left + cell + 9, top + cell * TAVERN_VIEW.depth + 9, width - cell * 2 - 18, height - cell * 2 * TAVERN_VIEW.depth - 18);
  context.fillStyle = "#e2bf78"; context.fillRect(left - 12, top - 43, width + 24, 4);
  context.fillStyle = "#76506c"; context.fillRect(left - 12, top - 5, width + 24, 5);
  for (const x of [left + 100, left + width / 2, left + width - 100]) {
    context.fillStyle = "#211c35"; context.fillRect(x - 35, top - 36, 70, 28);
    context.fillStyle = "#776994"; context.fillRect(x - 31, top - 33, 62, 21);
    context.fillStyle = "#d2bdd7"; context.fillRect(x - 1, top - 33, 2, 21);
    context.fillRect(x - 31, top - 23, 62, 2);
  }
  for (const x of [left + 220, left + width - 220]) {
    context.fillStyle = "#332335"; context.fillRect(x - 7, top - 35, 14, 23);
    context.fillStyle = "#e4b467"; context.fillRect(x - 5, top - 32, 10, 15);
    context.fillStyle = "#ffe0a0"; context.fillRect(x - 2, top - 30, 4, 11);
  }
  context.fillStyle = "#e4ca9a"; context.textAlign = "center"; context.font = "bold 10px monospace";
  context.fillText("PAWS & POURS  /  " + tavern.theme.toUpperCase(), TAVERN_VIEW.width / 2, top + height + 35);
}

export function drawIngredientIcon(context: CanvasRenderingContext2D, image: HTMLImageElement, ingredient: string,
  x: number, y: number, size: number) {
  const frame = INGREDIENT_FRAMES[ingredient];
  if (!frame || !image.complete || !image.naturalWidth) return;
  const scale = Math.min(size / frame.width, size / frame.height);
  const width = Math.round(frame.width * scale), height = Math.round(frame.height * scale);
  context.drawImage(image, frame.x, frame.y, frame.width, frame.height, Math.round(x - width / 2), Math.round(y - height / 2), width, height);
}

export function drawTavernCounter(context: CanvasRenderingContext2D, tavern: Tavern, station: Station,
  ingredients: HTMLImageElement, scrapBin: HTMLImageElement, highlighted: boolean) {
  const p = palettes[tavern.theme], bounds = stationBounds(station);
  const a = boardPoint(bounds.left, bounds.top), b = boardPoint(bounds.right, bounds.bottom);
  const center = boardPoint(station.x, station.y);
  const neighbor = (dx: number, dy: number) => tavern.stations.some((other) => other.gridX === station.gridX + dx && other.gridY === station.gridY + dy);
  const front = neighbor(0, 1) ? 0 : 10;
  context.fillStyle = p.top; context.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
  context.fillStyle = "#ffffff0c"; context.fillRect(a.x + 3, a.y + 3, 52, 2);
  context.fillStyle = p.front; context.fillRect(a.x, b.y - front, 58, front);
  if (front) {
    context.fillStyle = "#c69c60"; context.fillRect(a.x, b.y - front, 58, 2);
    context.fillRect(center.x - 5, b.y - 6, 10, 2);
    context.fillStyle = "#1d1829"; context.fillRect(a.x, b.y - 2, 58, 2);
  }
  context.fillStyle = p.light;
  if (!neighbor(0, -1)) context.fillRect(a.x, a.y, 58, 3);
  if (!neighbor(-1, 0)) context.fillRect(a.x, a.y, 3, b.y - a.y - front);
  if (!neighbor(1, 0)) context.fillRect(b.x - 3, a.y, 3, b.y - a.y - front);
  context.strokeStyle = "#231c3525"; context.lineWidth = 1; context.strokeRect(a.x + .5, a.y + .5, 57, b.y - a.y - front - 1);
  const x = center.x, y = center.y - 5;
  if (station.ingredient) {
    context.fillStyle = "#f1ddaf"; context.beginPath(); context.ellipse(x, y, 18, 13, 0, 0, Math.PI * 2); context.fill();
    drawIngredientIcon(context, ingredients, station.ingredient, x, y - 2, 30);
  } else if (station.kind === "mix") {
    context.fillStyle = "#352d45"; context.fillRect(x - 15, y - 13, 30, 26);
    context.fillStyle = "#d4c3dc"; context.fillRect(x - 7, y - 8, 14, 21);
    context.fillStyle = "#8d7eaa"; context.fillRect(x + 3, y - 7, 4, 18);
    context.fillStyle = "#e5bf70"; context.fillRect(x - 6, y - 15, 12, 8); context.fillRect(x - 9, y - 4, 18, 3);
  } else if (station.kind === "serve") {
    context.fillStyle = "#352437"; context.fillRect(x - 18, y + 4, 36, 6);
    context.fillStyle = "#d2a350"; context.fillRect(x - 12, y - 4, 24, 9); context.fillRect(x - 7, y - 10, 14, 8);
    context.fillStyle = "#ffe1a3"; context.fillRect(x - 3, y - 13, 6, 5);
  } else if (station.kind === "mop") {
    context.fillStyle = "#242d3d"; context.fillRect(x - 16, y - 12, 32, 23);
    context.fillStyle = "#729ba6"; context.fillRect(x - 12, y - 8, 24, 14);
    context.fillStyle = "#e9d3a0"; context.fillRect(x + 10, y - 15, 3, 29);
  } else if (station.kind === "trash" && scrapBin.complete && scrapBin.naturalWidth) {
    context.drawImage(scrapBin, x - 15, y - 18, 30, 29);
  } else {
    context.strokeStyle = "#d9c5a442"; context.lineWidth = 1;
    context.strokeRect(x - 9, y - 8, 18, 15);
  }
  if (station.kind !== "counter") {
    context.font = "bold 7px monospace"; context.textAlign = "center";
    context.fillStyle = "#211a32d9"; context.fillRect(x - 27, b.y - 13, 54, 10);
    context.fillStyle = "#ffedc9"; context.fillText(station.label.toUpperCase(), x, b.y - 6);
  }
  if (station.drink) {
    context.fillStyle = "#251d39df"; context.fillRect(x - 19, y - 20, 38, 36);
    drawRecipeDrink(context, recipeById(station.drink.recipeId), x, y - 2, 36);
  }
  if (highlighted) {
    context.strokeStyle = "#ffe7a2"; context.lineWidth = 2;
    context.strokeRect(a.x + 2, a.y + 2, 54, b.y - a.y - 4);
  }
}
