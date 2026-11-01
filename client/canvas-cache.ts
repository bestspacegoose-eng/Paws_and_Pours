import type { Tavern } from "../shared/game";

export function tavernLayoutKey(tavern: Tavern) {
  return JSON.stringify([tavern.seed,tavern.theme,tavern.stations.map(s=>[s.id,s.kind,s.x,s.y,s.gridX,s.gridY,s.widthCells,s.serviceStyle])]);
}

// One offscreen surface, not an ever-growing map of rooms and themes.
export class CanvasLayerCache {
  private surface?: HTMLCanvasElement;
  private context?: CanvasRenderingContext2D;
  private key?: string;
  rebuilds=0;
  constructor(private readonly width:number,private readonly height:number,
    private readonly create=()=>document.createElement("canvas")) {}
  draw(target:CanvasRenderingContext2D,key:string,paint:(context:CanvasRenderingContext2D)=>void) {
    if(!this.surface) {
      this.surface=this.create();this.surface.width=this.width;this.surface.height=this.height;
      this.context=this.surface.getContext("2d")??undefined;
    }
    if(!this.context){paint(target);return;}
    if(this.key!==key){
      this.context.clearRect(0,0,this.width,this.height);this.context.imageSmoothingEnabled=false;
      paint(this.context);this.key=key;this.rebuilds++;
    }
    target.drawImage(this.surface,0,0);
    // Retain the painter's drawing state too. Existing foreground painters use
    // the floor's text alignment and stroke baseline as their starting state.
    target.fillStyle=this.context.fillStyle;target.strokeStyle=this.context.strokeStyle;
    target.font=this.context.font;target.textAlign=this.context.textAlign;target.lineWidth=this.context.lineWidth;
  }
}
