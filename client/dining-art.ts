import type { Station } from "../shared/game";
import atlasUrl from "./assets/tilemap/dining-furniture-v2.png";

const atlas = new Image(); atlas.src = atlasUrl;
// Tight alpha bounds measured from the generated sheet; no atlas gutters in-game.
const frames = {
  table: { x: 34, y: 302, width: 398, height: 321 },
  chair: { x: 520, y: 212, width: 214, height: 411 },
  booth: { x: 837, y: 240, width: 386, height: 371 },
  rug: { x: 50, y: 888, width: 358, height: 146 }
};
const ready = () => atlas.complete && atlas.naturalWidth > 0;

export function drawDiningTile(context: CanvasRenderingContext2D, station: Station, x: number, bottom: number) {
  const seat = station.kind === "seat";
  if (!ready()) {
    context.fillStyle = seat ? "#b08fa9" : "#d1b6aa";
    context.fillRect(x - 25, bottom - 43, 50, 40);
    context.fillStyle = seat ? "#ddbac9" : "#ecd5bd";
    context.fillRect(x - 25, bottom - 43, 50, 3);
    return;
  }
  const frame = frames[seat ? station.label === "Chair" ? "chair" : "booth" : "table"];
  const scale = Math.min(54 / frame.width, (seat ? 52 : 43) / frame.height);
  const width = Math.round(frame.width * scale), height = Math.round(frame.height * scale);
  context.drawImage(atlas, frame.x, frame.y, frame.width, frame.height,
    Math.round(x - width / 2), Math.round(bottom - height), width, height);
}

export function drawDiningRug(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  if (!ready()) {
    context.fillStyle = "#978ca8"; context.fillRect(x, y, width, height);
    context.strokeStyle = "#d8c8c0"; context.lineWidth = 2;
    context.strokeRect(x + 7, y + 7, width - 14, height - 14);
    return;
  }
  const frame = frames.rug;
  context.drawImage(atlas, frame.x, frame.y, frame.width, frame.height, x, y, width, height);
}
