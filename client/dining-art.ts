import { themeArt } from "./theme-tiles";
import { gameImage } from "./game-assets";
import { furnitureArt } from "./furniture-art";
import type { Station, Theme } from "../shared/game";
import atlasUrl from "./assets/tilemap/dining-furniture-v2.png";

const atlas = gameImage(atlasUrl);
// Keep the moon tavern's quiet lavender rug; the other rooms have their own woven rugs.
const rugFrame = { x: 50, y: 888, width: 358, height: 146 };
const ready = () => atlas.complete && atlas.naturalWidth > 0;

export function drawDiningTile(context: CanvasRenderingContext2D, station: Station, x: number, bottom: number, theme: Theme, from = 0) {
  const seat = station.kind === "seat";
  const art = furnitureArt(theme);
  if (!art) {
    if (from) return;
    context.fillStyle = seat ? "#b08fa9" : "#d1b6aa";
    context.fillRect(x - 25, bottom - 43, 50, 40);
    context.fillStyle = seat ? "#ddbac9" : "#ecd5bd";
    context.fillRect(x - 25, bottom - 43, 50, 3);
    return;
  }
  const frame = art.layout[seat ? station.label === "Bar stool" ? "stool" : "chair" : "table"];
  const scale = Math.min((seat ? 54 : 54 * (art.layout.tableSpan ?? 1)) / frame.width, (seat ? 46 : 43) / frame.height);
  const width = Math.round(frame.width * scale) * ((station.widthCells ?? 1) / (seat ? 1 : art.layout.tableSpan ?? 1)), height = Math.round(frame.height * scale);
  context.drawImage(art.image, frame.x, frame.y + frame.height * from, frame.width, frame.height * (1 - from),
    Math.round(x - width / 2), Math.round(bottom - height) + height * from, width, height * (1 - from));
}

export function drawDiningRug(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, theme:Theme = "Haunted Moonlit Inn") {
  const art=themeArt(theme);
  if(art){const frame=art.layout.rug;context.drawImage(art.image,frame.x,frame.y,frame.width,frame.height,x,y,width,height);return;}
  if (!ready()) {
    context.fillStyle = "#978ca8"; context.fillRect(x, y, width, height);
    context.strokeStyle = "#d8c8c0"; context.lineWidth = 2;
    context.strokeRect(x + 7, y + 7, width - 14, height - 14);
    return;
  }
  const frame = rugFrame;
  context.drawImage(atlas, frame.x, frame.y, frame.width, frame.height, x, y, width, height);
}
