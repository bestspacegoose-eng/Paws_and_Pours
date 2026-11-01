import { stationBounds, seatForOrder, type Order, type Player, type Station, type Tavern } from "../shared/game";
import { boardPoint, TAVERN_VIEW } from "./tavern-projection";
import { CanvasLayerCache, tavernLayoutKey } from "./canvas-cache";

export interface ViewRect {x:number;y:number;width:number;height:number}
interface StationBand {
  depth:number;top:number;height:number;key:string;stations:Station[];cache:CanvasLayerCache;
}

// A bounded strip per occupied map row retains depth ordering with moving cats.
// Item/guest changes invalidate only their row; movement doesn't repaint art.
export class StationScene {
  private bands:StationBand[]=[];
  private tavern?:Tavern;
  private orders?:Order[];
  private revision=-1;
  private update=-1;
  private layout="";
  private layoutRevision=0;
  get repaintCount(){return this.bands.reduce((sum,band)=>sum+band.cache.rebuilds,0);}
  get surfacePixels(){return this.bands.reduce((sum,band)=>sum+TAVERN_VIEW.width*band.height,0);}

  prepare(tavern:Tavern,orders:Order[],artRevision:number,update:number){
    if(tavern===this.tavern&&orders===this.orders&&artRevision===this.revision&&update===this.update)return;
    this.tavern=tavern;this.orders=orders;this.revision=artRevision;this.update=update;
    const rows=new Map<number,Station[]>(),previous=new Map(this.bands.map(b=>[b.depth,b]));
    for(const station of tavern.stations){const depth=stationBounds(station).bottom;const row=rows.get(depth)??[];row.push(station);rows.set(depth,row);}
    const occupied=new Map<string,Order>();
    const layout=tavernLayoutKey(tavern);
    if(layout!==this.layout){this.layout=layout;this.layoutRevision++;}
    for(const order of orders){const seat=seatForOrder(tavern,order);if(seat)occupied.set(seat.id,order);}
    this.bands=[...rows].sort(([a],[b])=>a-b).map(([depth,stations])=>{
      const bounds=stations.map(stationBounds);
      // Seated heads/bubbles extend less than 40px above their tile. Keep an
      // 80px margin while avoiding a full-room texture for every depth row.
      const top=Math.max(0,Math.floor(boardPoint(0,Math.min(...bounds.map(b=>b.top))).y-80));
      const bottom=Math.min(TAVERN_VIEW.height,Math.ceil(boardPoint(0,depth).y+24));
      const height=bottom-top;
      const old=previous.get(depth);
      const band=old&&old.top===top&&old.height===height?old:{depth,top,height,key:"",stations:[],cache:new CanvasLayerCache(TAVERN_VIEW.width,height)};
      band.stations=stations;
      const guests=stations.flatMap(s=>occupied.has(s.id)?[occupied.get(s.id)!]:[]);
      band.key=JSON.stringify([this.layoutRevision,artRevision,stations,guests]);
      return band;
    });
  }

  draw(context:CanvasRenderingContext2D,players:Player[],paintStation:(layer:CanvasRenderingContext2D,station:Station)=>void,
    paintPlayer:(player:Player)=>void,highlight:Station|undefined,paintHighlight:(station:Station)=>void,view:ViewRect){
    const actors=[...players].sort((a,b)=>a.y-b.y);let index=0;
    for(const band of this.bands){
      while(index<actors.length&&actors[index].y<band.depth)paintPlayer(actors[index++]);
      if(band.top<view.y+view.height+2&&band.top+band.height>view.y-2){
        context.save();context.translate(0,band.top);
        band.cache.draw(context,band.key,layer=>{
          layer.save();layer.translate(0,-band.top);
          for(const station of band.stations)paintStation(layer,station);
          layer.restore();
        });
        context.restore();
        if(highlight&&stationBounds(highlight).bottom===band.depth)paintHighlight(highlight);
      }
    }
    while(index<actors.length)paintPlayer(actors[index++]);
  }
}
