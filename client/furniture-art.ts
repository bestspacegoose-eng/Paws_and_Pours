import { gameImage } from "./game-assets";
import type { Theme } from "../shared/game";
import cozyUrl from "./assets/tilemap/furniture-cozy-v1.png";
import hauntedUrl from "./assets/tilemap/furniture-haunted-v1.png";
import pirateUrl from "./assets/tilemap/furniture-pirate-v1.png";
import { FURNITURE_LAYOUT } from "./furniture-layout";

const load = gameImage;
const sheets: Record<Theme, HTMLImageElement> = {
  "Cozy Village Pub": load(cozyUrl), "Haunted Moonlit Inn": load(hauntedUrl), "Pirate Cat Tavern": load(pirateUrl)
};
export function furnitureArt(theme: Theme) {
  const image = sheets[theme];
  return image.complete && image.naturalWidth ? { image, layout: FURNITURE_LAYOUT[theme] } : undefined;
}
