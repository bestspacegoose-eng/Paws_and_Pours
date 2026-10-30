export interface TutorialRect { x:number; y:number; width:number; height:number }
export interface TutorialViewport { width:number; height:number; insets?:{top:number;right:number;bottom:number;left:number} }
const clamp = (n:number, low:number, high:number) => Math.max(low, Math.min(high,n));
export function clipTutorialTarget(rect: TutorialRect, viewport: { width:number; height:number }): TutorialRect | undefined {
  const x=Math.max(6,rect.x), y=Math.max(6,rect.y);
  const right=Math.min(viewport.width-6,rect.x+rect.width), bottom=Math.min(viewport.height-6,rect.y+rect.height);
  return right-x>8 && bottom-y>8 ? {x,y,width:right-x,height:bottom-y} : undefined;
}
export function tutorialCardPosition(viewport: TutorialViewport, card: { width:number; height:number }, targets: TutorialRect[]) {
  const left=12+(viewport.insets?.left??0),top=12+(viewport.insets?.top??0);
  const maxX=Math.max(left,viewport.width-card.width-12-(viewport.insets?.right??0)),maxY=Math.max(top,viewport.height-card.height-12-(viewport.insets?.bottom??0));
  if (!targets.length) return {x:clamp((viewport.width-card.width)/2,left,maxX), y:clamp((viewport.height-card.height)/2,top,maxY)};
  const candidates = [
    {x:maxX,y:maxY}, {x:left,y:maxY}, {x:maxX,y:top}, {x:left,y:top},
    ...targets.flatMap(r=>[
      {x:r.x+(r.width-card.width)/2,y:r.y+r.height+14}, {x:r.x+(r.width-card.width)/2,y:r.y-card.height-14},
      {x:r.x+r.width+14,y:r.y}, {x:r.x-card.width-14,y:r.y}
    ])
  ].map(p=>({x:clamp(p.x,left,maxX),y:clamp(p.y,top,maxY)}));
  const overlap=(p:{x:number;y:number})=>targets.reduce((area,r)=>area+
    Math.max(0,Math.min(p.x+card.width+8,r.x+r.width)-Math.max(p.x-8,r.x))*
    Math.max(0,Math.min(p.y+card.height+8,r.y+r.height)-Math.max(p.y-8,r.y)),0);
  return candidates.reduce((best,p)=>overlap(p)<overlap(best)?p:best,candidates[0]);
}
