export function mobileBackingSize(width:number,height:number,devicePixelRatio:number) {
  const area=Math.max(1,width*height);
  // The world is pixel art at a fixed resolution. Extra retina upscaling adds
  // fill work without adding sprite detail; DOM text keeps its native density.
  const ratio=Math.max(1,Math.min(devicePixelRatio||1,1.5,Math.sqrt(480_000/area)));
  return {width:Math.max(1,Math.round(width*ratio)),height:Math.max(1,Math.round(height*ratio))};
}

export class FramePacer {
  private last?:number;
  private credit=0;
  reset(){this.last=undefined;this.credit=0;}
  shouldRender(now:number,maxFps:number){
    if(this.last===undefined||now<this.last){this.last=now;this.credit=0;return true;}
    const elapsed=now-this.last;this.last=now;
    if(!Number.isFinite(maxFps)){this.credit=0;return true;}
    const period=1000/maxFps;this.credit=Math.min(period*2,this.credit+elapsed);
    if(this.credit+.1<period)return false;
    this.credit=Math.max(0,this.credit-period);
    if(this.credit>=period)this.credit%=period;
    return true;
  }
}
