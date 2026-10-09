import { GRID_CELL_SIZE, GRID_COLUMNS, GRID_ROWS, stationBounds, recipeById, type Order, type Player, type Station, type Tavern } from "../shared/game";
import { INGREDIENT_FRAMES, PLAYER_FRAMES } from "./sprite-frames";
import { drawRecipeDrink } from "./drink-art";
import decorUrl from "./assets/tilemap/cozy-decor-atlas.png";
import toolsUrl from "./assets/tilemap/mixing-tools-spritesheet.png";
import surfacesUrl from "./assets/tilemap/handdrawn-surfaces.png";
import { drawPreparationArt } from "./preparation-art";
import { boardPoint, TAVERN_VIEW } from "./tavern-projection";
export { boardPoint, TAVERN_VIEW } from "./tavern-projection";

let gateAmount = 0;
let gateFrameAt = 0;
export function drawBarGate(context: CanvasRenderingContext2D, players: Player[], paused: boolean) {
  const now = performance.now(), dt = Math.min(50, now - gateFrameAt); gateFrameAt = now;
  const target = players.some((player) => Math.abs(player.x - 8.5 * GRID_CELL_SIZE) < 110 && player.y > 5.5 * GRID_CELL_SIZE && player.y < 9.5 * GRID_CELL_SIZE) ? 1 : 0;
  if (!paused) gateAmount += (target - gateAmount) * Math.min(1, dt / 130);
  const reducedMotion = document.body.dataset.reducedMotion === "true" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const openness = reducedMotion ? target : gateAmount;
  const top = boardPoint(8.5 * GRID_CELL_SIZE, 6 * GRID_CELL_SIZE);
  const bottom = boardPoint(8.5 * GRID_CELL_SIZE, 9 * GRID_CELL_SIZE);
  const length = (bottom.y - top.y) / 2 - 3;
  // Automatic saloon leaves are visual, not a second hidden collision barrier.
  for (const [point, sign] of [[top, 1], [bottom, -1]] as const) {
    context.save(); context.translate(point.x, point.y); context.rotate(sign * openness * 1.28);
    context.fillStyle = "#65506e"; context.fillRect(-9, sign > 0 ? 0 : -length, 18, length);
    context.fillStyle = "#bc9fa9"; context.fillRect(-6, sign > 0 ? 3 : -length + 3, 12, length - 6);
    context.fillStyle = "#e1c6a5";
    for (let y = 9; y < length - 4; y += 10) context.fillRect(-5, sign * y, 10, 3);
    context.fillStyle = "#f0d7a8"; context.fillRect(-3, sign * (length - 12), 6, 6);
    context.restore();
    context.fillStyle = "#66516b"; context.fillRect(point.x - 11, point.y - 5, 22, 10);
    context.fillStyle = "#ddc19c"; context.fillRect(point.x - 7, point.y - 4, 14, 4);
  }
}

const decor = new Image(); decor.src = decorUrl;
const tools = new Image(); tools.src = toolsUrl;
const surfaces = new Image(); surfaces.src = surfacesUrl;
const decorFrames = [
  { x: 46, y: 72, width: 468, height: 462 }, { x: 559, y: 47, width: 421, height: 485 },
  { x: 1025, y: 112, width: 472, height: 498 }, { x: 107, y: 599, width: 344, height: 376 },
  { x: 601, y: 553, width: 337, height: 422 }, { x: 1022, y: 602, width: 475, height: 374 }
];
export function ornament(context: CanvasRenderingContext2D, index: number, x: number, y: number, width: number, height: number) {
  if (!decor.complete || !decor.naturalWidth) return;
  const frame = decorFrames[index], scale = Math.min(width / frame.width, height / frame.height);
  const w = Math.round(frame.width * scale), h = Math.round(frame.height * scale);
  context.drawImage(decor, frame.x, frame.y, frame.width, frame.height, Math.round(x - w / 2), Math.round(y - h / 2), w, h);
}
const palettes = {
  "Cozy Village Pub": { floor: ["#c9b5b4", "#d0beb9"], seam: "#b19da6", top: "#a69ab6", light: "#d4c7df", front: "#75647e", wall: "#6d5c7c" },
  "Haunted Moonlit Inn": { floor: ["#b0adc7", "#bcb6cf"], seam: "#9692ad", top: "#91b3b5", light: "#c2d8d0", front: "#66768c", wall: "#655b7c" },
  "Pirate Cat Tavern": { floor: ["#c5b7a9", "#d0c2af"], seam: "#ab9d98", top: "#96b5ac", light: "#c9d7bf", front: "#677f82", wall: "#63747e" }
};

export function drawTavernFloor(context: CanvasRenderingContext2D, tavern: Tavern) {
  const p = palettes[tavern.theme], cell = GRID_CELL_SIZE;
  const width = GRID_COLUMNS * cell, height = GRID_ROWS * cell * TAVERN_VIEW.depth;
  const { left, top } = TAVERN_VIEW;
  context.fillStyle = "#201828"; context.fillRect(0, 0, TAVERN_VIEW.width, TAVERN_VIEW.height);
  context.fillStyle = "#17131d"; context.fillRect(left - 19, top - 100, width + 38, height + 126);
  context.fillStyle = p.wall; context.fillRect(left - 12, top - 96, width + 24, height + 113);
  for (let row = 0; row < 4; row++) for (let x = left - 10; x < left + width; x += 44) {
    context.fillStyle = row % 2 ? "#ab829317" : "#1b13272e";
    context.fillRect(x + (row % 2) * 11, top - 94 + row * 22, 40, 19);
  }
  for (let x = 0; x < GRID_COLUMNS; x++) for (let y = 0; y < GRID_ROWS; y++) {
    const a = boardPoint(x * cell, y * cell), b = boardPoint((x + 1) * cell, (y + 1) * cell);
    context.fillStyle = p.seam; context.fillRect(a.x, a.y, cell, b.y - a.y);
    context.fillStyle = x < 9 ? p.floor[(x + y) % 2] : ["#c5a6ac", "#cbb0b3"][(x + y) % 2]; context.fillRect(a.x + 1, a.y + 1, cell - 2, b.y - a.y - 2);
    context.fillStyle = "#ffffff0a"; context.fillRect(a.x + 3, a.y + 3, cell - 6, 2);
    context.fillStyle = "#35263c13"; context.fillRect(a.x + 10 + (y % 2) * 9, a.y + 17, 24, 1);
    if (surfaces.complete && surfaces.naturalWidth) {
      const half = surfaces.naturalWidth / 2;
      // One painted ceramic tile per world cell; wood uses contiguous atlas sections.
      const sx = x < 9 ? half + half / 3 : (x % 3) * half / 3;
      const sy = x < 9 ? half / 3 : (y % 3) * half / 3;
      context.drawImage(surfaces, sx, sy, half / 3, half / 3, a.x + 1, a.y + 1, cell - 2, b.y - a.y - 2);
      context.fillStyle = "#d3c4d02a"; context.fillRect(a.x + 1, a.y + 1, cell - 2, b.y - a.y - 2);
    }
  }
  // Flat, low-contrast woven rugs do not change the walkable grid.
  for (const row of [1, 6]) {
    const rug = boardPoint(10 * cell, row * cell);
    context.fillStyle = "#978ca8"; context.fillRect(rug.x - 9, rug.y - 8, cell * 5 + 18, cell * 2 * TAVERN_VIEW.depth + 16);
    context.strokeStyle = "#d8c8c0"; context.lineWidth = 3;
    context.strokeRect(rug.x - 3, rug.y - 2, cell * 5 + 6, cell * 2 * TAVERN_VIEW.depth + 4);
  }
  // Inlaid lanes decorate the same grid; they never add collision.
  context.strokeStyle = "#ead19b60"; context.lineWidth = 2;
  context.strokeRect(left + cell + 9, top + cell * TAVERN_VIEW.depth + 9, width - cell * 2 - 18, height - cell * 2 * TAVERN_VIEW.depth - 18);
  context.fillStyle = "#e2bf78"; context.fillRect(left - 12, top - 96, width + 24, 3);
  context.fillStyle = "#76506c"; context.fillRect(left - 12, top - 5, width + 24, 5);
  for (const x of [left + 65, left + width / 2, left + width - 65]) ornament(context, 1, x, top - 49, 63, 89);
  for (const x of [left + 240, left + width - 240]) ornament(context, 0, x, top - 47, 150, 88);
  for (const x of [left + 140, left + width - 140]) {
    const glow = context.createRadialGradient(x, top - 27, 2, x, top - 27, 47);
    glow.addColorStop(0, "#ffd77b25"); glow.addColorStop(1, "#ffd77b00");
    context.fillStyle = glow; context.fillRect(x - 47, top - 74, 94, 94);
    ornament(context, 4, x, top - 28, 38, 51);
  }
  for (const x of [left - 42, left + width + 42]) {
    ornament(context, 2, x, top + 62, 68, 68);
    ornament(context, 3, x, top + height - 50, 56, 67);
  }
  context.fillStyle = "#e4ca9a"; context.textAlign = "center"; context.font = "bold 10px monospace";
  context.fillText("PAWS & POURS  /  " + tavern.theme.toUpperCase(), TAVERN_VIEW.width / 2, top + height + 35);
}

export function drawIngredientIcon(context: CanvasRenderingContext2D, image: HTMLImageElement, ingredient: string,
  x: number, y: number, size: number) {
  if (ingredient === "chopped-tuna") { drawPreparationArt(context, 1, x, y, size); return; }
  const frame = INGREDIENT_FRAMES[ingredient];
  if (!frame || !image.complete || !image.naturalWidth) return;
  const scale = Math.min(size / frame.width, size / frame.height);
  const width = Math.round(frame.width * scale), height = Math.round(frame.height * scale);
  context.drawImage(image, frame.x, frame.y, frame.width, frame.height, Math.round(x - width / 2), Math.round(y - height / 2), width, height);
}

function drawDiningFurniture(context: CanvasRenderingContext2D, station: Station, orders: Order[], cats: HTMLImageElement | undefined, highlighted: boolean) {
  const bounds = stationBounds(station), a = boardPoint(bounds.left, bounds.top), b = boardPoint(bounds.right, bounds.bottom);
  const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
  const tableId = station.id.replace("-seat", ""), order = orders.find((candidate) => candidate.tableId === tableId);
  const seat = station.kind === "seat";
  // Every opaque furniture edge stays inside its authoritative square collision cell.
  context.fillStyle = "#746477"; context.fillRect(a.x, a.y, 58, b.y - a.y);
  context.fillStyle = seat ? "#b08fa9" : "#d1b6aa"; context.fillRect(a.x + 3, a.y + 3, 52, b.y - a.y - 8);
  context.fillStyle = seat ? "#ddbac9" : "#ecd5bd"; context.fillRect(a.x + 4, a.y + 3, 50, 4);
  if (seat) {
    context.fillStyle = "#967a9b"; context.fillRect(a.x + 6, a.y + 11, 46, 7);
    context.fillStyle = "#c7a4b9"; context.fillRect(a.x + 6, a.y + 21, 46, 18);
    if (station.label === "Chair") {
      context.fillStyle = "#a48a91";
      context.fillRect(a.x + 3, a.y + 10, 6, b.y - a.y - 14);
      context.fillRect(b.x - 9, a.y + 10, 6, b.y - a.y - 14);
      context.fillRect(a.x + 12, a.y + 8, 4, 12); context.fillRect(b.x - 16, a.y + 8, 4, 12);
    } else {
      context.fillStyle = "#ddbac9";
      for (const dx of [-14, 0, 14]) context.fillRect(x + dx - 1, a.y + 13, 3, 3);
    }
    if (order && cats?.complete && cats.naturalWidth) {
      const frame = PLAYER_FRAMES.down[0];
      const height = 48, width = Math.round(height * frame.width / frame.height);
      context.drawImage(cats, frame.x, frame.y, frame.width, frame.height, x - width / 2, b.y - height - 2, width, height);
      context.fillStyle = "#ece0c8"; context.fillRect(x - 12, a.y + 4, 24, 3);
      context.fillStyle = "#927ba0"; context.fillRect(x - 9, a.y + 7, 18, 2);
      context.fillStyle = "#f1e4d6"; context.fillRect(x + 22, a.y - 4, 29, 29);
      context.fillRect(x + 18, a.y + 15, 7, 5);
      context.strokeStyle = "#9b86a6"; context.lineWidth = 2; context.strokeRect(x + 22, a.y - 4, 29, 29);
      drawRecipeDrink(context, recipeById(order.recipeId), x + 36, a.y + 10, 23);
    }
  } else {
    context.fillStyle = "#e9dad2"; context.fillRect(x - 17, a.y + 5, 34, 27);
    context.fillStyle = "#ac96ac"; context.fillRect(x - 15, a.y + 7, 30, 2);
    ornament(context, 4, x + 18, y - 7, 13, 20);
    context.fillStyle = "#b6c7af"; context.fillRect(x - 7, y - 8, 11, 11);
    context.fillStyle = "#f5ead9"; context.fillRect(x - 7, y - 8, 11, 3);
    context.font = "bold 8px monospace"; context.textAlign = "center"; context.fillStyle = "#493c54";
    context.fillText(station.label.toUpperCase(), x, b.y - 4);
    if (order) {
      context.fillStyle = "#746477"; context.fillRect(a.x + 4, b.y + 2, 50, 4);
      context.fillStyle = order.patience / order.maxPatience < .3 ? "#d98e9b" : "#b3d2b5";
      context.fillRect(a.x + 4, b.y + 2, 50 * Math.max(0, order.patience / order.maxPatience), 4);
    }
  }
  if (highlighted) { context.strokeStyle = "#fff0c7"; context.lineWidth = 2; context.strokeRect(a.x + 1, a.y + 1, 56, b.y - a.y - 2); }
}

export function drawTavernCounter(context: CanvasRenderingContext2D, tavern: Tavern, station: Station,
  ingredients: HTMLImageElement, scrapBin: HTMLImageElement, highlighted: boolean, orders: Order[] = [], cats?: HTMLImageElement) {
  const p = palettes[tavern.theme], bounds = stationBounds(station);
  const a = boardPoint(bounds.left, bounds.top), b = boardPoint(bounds.right, bounds.bottom);
  const center = boardPoint(station.x, station.y);
  if (station.kind === "serve" || station.kind === "seat") {
    drawDiningFurniture(context, station, orders, cats, highlighted);
    return;
  }
  const neighbor = (dx: number, dy: number) => tavern.stations.some((other) => other.gridX === station.gridX + dx && other.gridY === station.gridY + dy);
  const front = neighbor(0, 1) ? 0 : 10;
  context.fillStyle = p.top; context.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
  if (surfaces.complete && surfaces.naturalWidth) {
    const half = surfaces.naturalWidth / 2, piece = half / 3;
    const base = station.gridX === 8 || tavern.theme !== "Pirate Cat Tavern" ? 0 : half;
    context.drawImage(surfaces, base + (station.gridX % 3) * piece, half + (station.gridY % 3) * piece, piece, piece,
      a.x + 2, a.y + 2, 54, b.y - a.y - front - 3);
  }
  context.fillStyle = "#ffffff12"; context.fillRect(a.x + 6, a.y + 10, 22, 2);
  context.fillStyle = "#62546b18"; context.fillRect(a.x + 30, a.y + 25, 18, 2);
  context.fillStyle = "#ffffff0c"; context.fillRect(a.x + 3, a.y + 3, 52, 2);
  context.fillStyle = p.front; context.fillRect(a.x, b.y - front, 58, front);
  if (front) {
    context.strokeStyle = "#8e697547"; context.lineWidth = 1;
    context.strokeRect(a.x + 5, b.y - 8, 48, 5);
    context.fillStyle = "#c69c60"; context.fillRect(a.x, b.y - front, 58, 2);
    context.fillRect(center.x - 5, b.y - 6, 10, 2);
    context.fillStyle = "#1d1829"; context.fillRect(a.x, b.y - 2, 58, 2);
  }
  context.fillStyle = p.light;
  if (!neighbor(0, -1)) context.fillRect(a.x, a.y, 58, 3);
  if (!neighbor(-1, 0)) context.fillRect(a.x, a.y, 3, b.y - a.y - front);
  if (!neighbor(1, 0)) context.fillRect(b.x - 3, a.y, 3, b.y - a.y - front);
  context.strokeStyle = "#231c3525"; context.lineWidth = 1; context.strokeRect(a.x + .5, a.y + .5, 57, b.y - a.y - front - 1);
  context.fillStyle = "#d6b56b";
  if (!neighbor(-1, 0) && !neighbor(0, -1)) context.fillRect(a.x + 2, a.y + 2, 5, 5);
  if (!neighbor(1, 0) && !neighbor(0, -1)) context.fillRect(b.x - 7, a.y + 2, 5, 5);
  const x = center.x, y = center.y - 5;
  if (station.gridX === 8) {
    // A continuous carved bar fascia and brass foot rail face the dining room.
    context.fillStyle = "#69506e"; context.fillRect(b.x - 14, a.y, 14, b.y - a.y);
    context.fillStyle = "#ac889b"; context.fillRect(b.x - 11, a.y + 5, 6, b.y - a.y - 10);
    context.fillStyle = "#e0c69d"; context.fillRect(b.x - 3, a.y, 3, b.y - a.y);
    context.fillStyle = "#ddc0a8"; context.fillRect(b.x - 10, center.y - 3, 4, 6);
  }
  if (station.kind === "chop") {
    drawPreparationArt(context, 0, x, y - 2, 43);
    if (station.preparedIngredient) {
      context.fillStyle = "#ecd7b6"; context.fillRect(x - 15, y - 14, 30, 22);
      drawPreparationArt(context, 1, x, y - 2, 29);
    }
  } else if (station.drink) {
    context.fillStyle = "#e1be7f66"; context.beginPath(); context.ellipse(x, y + 10, 14, 5, 0, 0, Math.PI * 2); context.fill();
    drawRecipeDrink(context, recipeById(station.drink.recipeId), x, y - 4, 38);
  } else if (station.ingredient) {
    context.fillStyle = "#f1ddaf"; context.beginPath(); context.ellipse(x, y, 18, 13, 0, 0, Math.PI * 2); context.fill();
    drawIngredientIcon(context, ingredients, station.ingredient, x, y - 2, 30);
  } else if (station.kind === "mix") {
    if (tools.complete && tools.naturalWidth) {
      if (station.id === "mix") context.drawImage(tools, 196, 50, 254, 450, x - 10, y - 20, 20, 36);
      else context.drawImage(tools, 578, 105, 420, 392, x - 18, y - 18, 36, 34);
    }
  } else if (station.kind === "mop") {
    context.fillStyle = "#242d3d"; context.fillRect(x - 16, y - 12, 32, 23);
    context.fillStyle = "#729ba6"; context.fillRect(x - 12, y - 8, 24, 14);
    context.fillStyle = "#e9d3a0"; context.fillRect(x + 10, y - 15, 3, 29);
  } else if (station.kind === "trash" && scrapBin.complete && scrapBin.naturalWidth) {
    context.drawImage(scrapBin, x - 15, y - 18, 30, 29);
  } else {
    context.strokeStyle = "#d9c5a442"; context.lineWidth = 1;
    context.strokeRect(x - 9, y - 8, 18, 15);
    // Small ornaments stay within the counter cell and clear when a drink is placed.
    if (!station.drink && station.gridY === 0 && station.gridX % 4 === 1) ornament(context, 5, x, y, 30, 24);
    if (!station.drink && station.gridY === 10 && station.gridX % 5 === 0) ornament(context, 4, x, y - 5, 23, 32);
  }
  if (station.kind !== "counter") {
    context.font = "bold 7px monospace"; context.textAlign = "center";
    context.fillStyle = "#211a32d9"; context.fillRect(x - 27, b.y - 13, 54, 10);
    context.fillStyle = "#ffedc9"; context.fillText(station.label.toUpperCase(), x, b.y - 6);
  }
  if (highlighted) {
    context.strokeStyle = "#ffe7a2"; context.lineWidth = 2;
    context.strokeRect(a.x + 2, a.y + 2, 54, b.y - a.y - 4);
  }
}
