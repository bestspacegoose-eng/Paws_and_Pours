import { gameImage } from "./game-assets";
import type { Theme } from "../shared/game";
import type { FrameRect } from "./sprite-frames";
import villageUrl from "./assets/tilemap/theme-village-v2.webp";
import pirateUrl from "./assets/tilemap/theme-pirate-v2.webp";
import { THEME_TILES } from "./theme-tiles-layout";

const sheets = { "Cozy Village Pub":gameImage(villageUrl), "Pirate Cat Tavern":gameImage(pirateUrl) };
export function themeArt(theme:Theme) {
  if (theme === "Haunted Moonlit Inn") return;
  const image = sheets[theme], layout = THEME_TILES[theme]!;
  return image.complete && image.naturalWidth ? { image, layout } : undefined;
}
export function drawThemeFrame(context:CanvasRenderingContext2D, image:HTMLImageElement, frame:FrameRect,
  x:number,y:number,width:number,height:number) {
  const scale = Math.min(width/frame.width,height/frame.height), w=Math.round(frame.width*scale),h=Math.round(frame.height*scale);
  context.drawImage(image,frame.x,frame.y,frame.width,frame.height,Math.round(x-w/2),Math.round(y-h/2),w,h);
}

export function drawThemedWorkbench(context:CanvasRenderingContext2D, theme:Theme) {
  const art=themeArt(theme); if(!art)return false;
  const {image,layout}=art, counter=layout.counters[0], top=layout.topHeights[0];
  context.fillStyle=theme==="Cozy Village Pub"?"#5b382a":"#263842";context.fillRect(0,0,800,480);
  for(let x=0;x<800;x+=160)context.drawImage(image,layout.wall.x,layout.wall.y,layout.wall.width,layout.wall.height,x,0,160,240);
  drawThemeFrame(context,image,layout.window,400,107,132,158);
  drawThemeFrame(context,image,layout.cabinet,177,117,151,115);
  drawThemeFrame(context,image,layout.notice,623,117,146,112);
  for(const x of [64,736])drawThemeFrame(context,image,layout.lantern,x,95,45,74);
  // Repeat the quiet interior of the countertop, with its original front fascia.
  for(let x=0;x<800;x+=200){
    context.drawImage(image,counter.x+counter.width*.1,counter.y+top*.1,counter.width*.8,top*.55,x,222,200,207);
    context.drawImage(image,counter.x,counter.y+top,counter.width,counter.height-top,x,429,200,51);
  }
  context.fillStyle=theme==="Cozy Village Pub"?"#af786b":"#56727a";
  context.fillRect(172,253,456,165);
  context.strokeStyle=theme==="Cozy Village Pub"?"#e2bba0":"#b6ae91";context.lineWidth=2;context.strokeRect(181,262,438,147);
  return true;
}
