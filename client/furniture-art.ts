import { gameImage } from "./game-assets";
import type { Theme } from "../shared/game";
import { themeArt } from "./theme-tiles";
import hauntedUrl from "./assets/tilemap/furniture-haunted-v1.png";

import { FURNITURE_LAYOUT } from "./furniture-layout";

const load = gameImage;
const haunted = load(hauntedUrl);
export function furnitureArt(theme: Theme) {
  const image = theme === "Haunted Moonlit Inn" ? haunted : themeArt(theme)?.image;
  return image?.complete && image.naturalWidth ? { image, layout: FURNITURE_LAYOUT[theme] } : undefined;
}
