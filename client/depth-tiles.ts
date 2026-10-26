import { GRID_CELL_SIZE, GRID_COLUMNS, stationBounds, type Station, type Tavern } from "../shared/game";
import { boardPoint, TAVERN_VIEW } from "./tavern-projection";
import floorUrl from "./assets/tilemap/floors-depth-v1.png";
import wallUrl from "./assets/tilemap/walls-depth-v1.png";
import { furnitureArt } from "./furniture-art";

const floors = new Image(); floors.src = floorUrl;
const walls = new Image(); walls.src = wallUrl;
const ready = (image: HTMLImageElement) => image.complete && image.naturalWidth > 0;
export const COUNTER_RISE = 22;

// These supplied sheets are 1254px, with painted gutters rather than a uniform atlas grid.
const floorColumns = [0, 316, 629, 943];
export function drawDepthFloor(context: CanvasRenderingContext2D, tavern: Tavern, x: number, y: number) {
  if (!ready(floors)) return false;
  const point = boardPoint(x * GRID_CELL_SIZE, y * GRID_CELL_SIZE);
  const variant = (x * 3 + y * 5) % 4;
  const stone = tavern.theme === "Haunted Moonlit Inn";
  const kitchen = x < 9;
  const sy = stone ? (kitchen ? 631 : 933) : kitchen ? 631 : tavern.theme === "Pirate Cat Tavern" ? 314 : 0;
  const sh = sy === 631 ? 295 : sy === 933 ? 321 : 309;
  // Save patterned/chipped tiles for occasional accents; most kitchen tiles stay quiet.
  const column = kitchen && !stone ? ((x + y * 7) % 13 === 0 ? 2 : 0) : variant;
  context.drawImage(floors, floorColumns[column], sy, column === 3 ? 311 : 309, sh,
    point.x, point.y, GRID_CELL_SIZE, GRID_CELL_SIZE * TAVERN_VIEW.depth);
  return true;
}

export function drawDepthWalls(context: CanvasRenderingContext2D, tavern: Tavern) {
  if (!ready(walls)) return;
  const { left, top } = TAVERN_VIEW;
  const stone = tavern.theme === "Haunted Moonlit Inn";
  const width = GRID_COLUMNS * GRID_CELL_SIZE, panels = 10, panelWidth = width / panels;
  for (let i = 0; i < panels; i++) {
    const column = stone ? (i === 2 || i === 7 ? 3 : i % 2) : (i % 4 === 2 ? 2 : i % 2);
    context.drawImage(walls, [32, 343, 646, 950][column], stone ? 39 : 333, 271, stone ? 260 : 278,
      left + i * panelWidth, top - 96, panelWidth, 96);
  }
  // Contact shade at the wall/floor junction makes the room read as a recessed space.
  const shade = context.createLinearGradient(0, top, 0, top + 22);
  shade.addColorStop(0, "#26162e66"); shade.addColorStop(1, "#26162e00");
  context.fillStyle = shade; context.fillRect(left, top, width, 22);
}

export function drawDepthShadows(context: CanvasRenderingContext2D, tavern: Tavern) {
  context.save();
  for (const station of tavern.stations) {
    const bounds = stationBounds(station), a = boardPoint(bounds.left, bounds.top), b = boardPoint(bounds.right, bounds.bottom);
    const shade = context.createLinearGradient(0, b.y - 2, 0, b.y + 12);
    shade.addColorStop(0, "#25172f66"); shade.addColorStop(1, "#25172f00");
    context.fillStyle = shade; context.fillRect(a.x + 2, b.y - 2, b.x - a.x + 5, 14);
  }
  context.restore();
}

export function drawDepthCounter(context: CanvasRenderingContext2D, tavern: Tavern, station: Station) {
  const art = furnitureArt(tavern.theme);
  if (!art) return false;
  const counters = art.image;
  const bounds = stationBounds(station), a = boardPoint(bounds.left, bounds.top), b = boardPoint(bounds.right, bounds.bottom);
  const neighbor = (dx: number, dy: number) => tavern.stations.some(other =>
    (other.kind !== "serve" || other.serviceStyle === "bar") && other.kind !== "seat" && other.gridX === station.gridX + dx && other.gridY === station.gridY + dy);
  const column = !neighbor(-1, 0) && neighbor(1, 0) ? 1 : !neighbor(1, 0) && neighbor(-1, 0) ? 2 : 0;
  const frame = art.layout.counters[column], topHeight = art.layout.topHeights[column];
  const { x: sx, y: sy, width: sw, height: sh } = frame;
  const w = b.x - a.x, h = b.y - a.y;
  // Split the painted top and fascia: the surface retains the full collision footprint,
  // while the raised face ends exactly at the authoritative southern edge.
  if (neighbor(0, 1) || neighbor(0, -1)) {
    // Use the quiet interior for north/south joins: no repeated rounded caps or
    // front bevels inside a continuous slab, including the preparation islands.
    context.drawImage(counters, sx + sw * .08, sy + 8, sw * .84, topHeight - 56,
      a.x, a.y - COUNTER_RISE, w, h);
  } else context.drawImage(counters, sx, sy, sw, topHeight, a.x, a.y - COUNTER_RISE, w, h);
  if (!neighbor(0, 1)) {
    context.drawImage(counters, sx, sy + topHeight, sw, sh - topHeight, a.x, b.y - COUNTER_RISE, w, COUNTER_RISE);
    context.fillStyle = "#e8d2b9"; context.fillRect(a.x, b.y - COUNTER_RISE, w, 2);
  }
  if (station.gridX === 8 && !neighbor(1, 0)) {
    // The long bar faces the dining room as well as the southern aisle.
    context.drawImage(counters, sx, sy + topHeight, sw, sh - topHeight, b.x - 10, a.y - COUNTER_RISE, 10, h + COUNTER_RISE);
    context.fillStyle = "#e8d2b9"; context.fillRect(b.x - 10, a.y - COUNTER_RISE, 2, h);
  }
  context.fillStyle = "#f3d5a775";
  if (!neighbor(0, -1)) context.fillRect(a.x, a.y - COUNTER_RISE, w, 2);
  context.fillStyle = "#291b3740";
  if (!neighbor(-1, 0)) context.fillRect(a.x, a.y - COUNTER_RISE + 2, 2, h - 2);
  if (!neighbor(1, 0)) context.fillRect(b.x - 2, a.y - COUNTER_RISE + 2, 2, h - 2);
  return true;
}
