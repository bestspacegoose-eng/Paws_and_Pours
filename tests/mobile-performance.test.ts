import test from "node:test";
import assert from "node:assert/strict";
import { FramePacer, mobileBackingSize } from "../client/mobile-performance.js";
import { StationScene } from "../client/station-scene.js";
import { gridCellCenter, makeTavern, type Player } from "../shared/game.js";
import { movementTarget } from "../shared/movement.js";

test("mobile backing buffers avoid redundant retina upscaling without dropping below CSS resolution",()=>{
  assert.deepEqual(mobileBackingSize(390,486,3),{width:585,height:729});
  for(const [width,height] of [[320,394],[430,576],[844,222],[1024,800]]){
    const size=mobileBackingSize(width,height,3);
    assert.ok(size.width>=width&&size.height>=height);
    if(width*height<480_000)assert.ok(size.width*size.height<482_000);
    assert.ok(size.width*size.height<width*height*4);
  }
  assert.deepEqual(mobileBackingSize(390,486,1),{width:390,height:486});
});
test("mobile frame pacing caps 90/120/144Hz work while preserving walking speed",()=>{
  for(const hz of [30,60,90,120,144]){
    const pacer=new FramePacer();let frames=0,last=0,position={x:0,y:0};
    for(let i=0;i<=hz;i++){
      const now=i*1000/hz;
      if(pacer.shouldRender(now,60)){frames++;position=movementTarget(position,{x:1,y:0},"Tabby",now-last);last=now;}
    }
    assert.ok(frames<=62&&frames>=Math.min(hz,60),`${hz}Hz rendered ${frames} frames`);
    assert.ok(Math.abs(position.x-224)<.01,`${hz}Hz walking distance was ${position.x}`);
  }
});
test("a frame gap never produces catch-up paint bursts and desktop remains native",()=>{
  const pacer=new FramePacer();assert.equal(pacer.shouldRender(0,60),true);
  assert.equal(pacer.shouldRender(1,60),false);assert.equal(pacer.shouldRender(5000,60),true);
  assert.equal(pacer.shouldRender(5000,60),false);
  pacer.reset();for(let i=0;i<100;i++)assert.equal(pacer.shouldRender(i,Infinity),true);
});
test("station rows merge with moving cats in the original depth order",()=>{
  const tavern=makeTavern(42),scene=new StationScene(),events:string[]=[];
  // Two isolated rows make depth boundaries and ties explicit.
  tavern.stations=[tavern.stations.find(s=>s.kind==="mix")!,tavern.stations.find(s=>s.kind==="chop")!];
  scene.prepare(tavern,[],1,1);
  const players=[{id:"front",y:400},{id:"back",y:100},{id:"tie",y:232}] as Player[];
  const layer={save(){},restore(){},translate(){},drawImage(){},clearRect(){},imageSmoothingEnabled:false} as unknown as CanvasRenderingContext2D;
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,"document");
  Object.defineProperty(globalThis,"document",{configurable:true,value:{createElement:()=>({getContext:()=>layer})}});
  try{
    const target={...layer,drawImage(){events.push("row");}} as unknown as CanvasRenderingContext2D;
    scene.draw(target,players,()=>{},p=>events.push(p.id),undefined,()=>{},{x:0,y:0,width:1088,height:712});
    assert.deepEqual(events,["back","row","tie","row","front"]);
    assert.ok(scene.surfacePixels<3_000_000,"the strip cache stays bounded");
  }finally{if(descriptor)Object.defineProperty(globalThis,"document",descriptor);else Reflect.deleteProperty(globalThis,"document");}
});
test("moving snapshots reuse station artwork and an item update repaints only its row",()=>{
  const tavern=makeTavern(42),scene=new StationScene();
  const layer={save(){},restore(){},translate(){},drawImage(){},clearRect(){},imageSmoothingEnabled:false} as unknown as CanvasRenderingContext2D;
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,"document");
  Object.defineProperty(globalThis,"document",{configurable:true,value:{createElement:()=>({getContext:()=>layer})}});
  const draw=()=>scene.draw(layer,[],()=>{},()=>{},undefined,()=>{},{x:0,y:0,width:1088,height:712});
  try{
    scene.prepare(tavern,[],1,1);draw();const initial=scene.repaintCount;
    for(let i=0;i<30;i++){scene.prepare(structuredClone(tavern),[],1,i+2);draw();}
    assert.equal(scene.repaintCount,initial);
    tavern.stations.find(s=>s.kind==="counter")!.counterIngredient={ingredient:"lime",quality:1};
    scene.prepare(tavern,[],1,100);draw();assert.equal(scene.repaintCount,initial+1);
    scene.prepare(tavern,[],2,101);draw();assert.equal(scene.repaintCount,initial*2+1);
  }finally{if(descriptor)Object.defineProperty(globalThis,"document",descriptor);else Reflect.deleteProperty(globalThis,"document");}
});

test("guest patience and departure repaint their seat row, and Map fills previously culled rows",()=>{
  const tavern=makeTavern(42),scene=new StationScene();
  const order={id:"guest",recipeId:"catnip",customer:"Guest",tableId:"table-1",seatId:"table-1-seat",patience:60,maxPatience:80};
  const layer={save(){},restore(){},translate(){},drawImage(){},clearRect(){},imageSmoothingEnabled:false} as unknown as CanvasRenderingContext2D;
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,"document");
  Object.defineProperty(globalThis,"document",{configurable:true,value:{createElement:()=>({getContext:()=>layer})}});
  const draw=(view={x:0,y:0,width:1088,height:712})=>scene.draw(layer,[],()=>{},()=>{},undefined,()=>{},view);
  try{
    scene.prepare(tavern,[order],1,1);draw({x:0,y:300,width:400,height:80});const partial=scene.repaintCount;
    draw();const complete=scene.repaintCount;assert.ok(complete>partial);
    scene.prepare(tavern,[{...order,patience:59}],1,2);draw();assert.equal(scene.repaintCount,complete+1);
    scene.prepare(tavern,[],1,3);draw();assert.equal(scene.repaintCount,complete+2);
  }finally{if(descriptor)Object.defineProperty(globalThis,"document",descriptor);else Reflect.deleteProperty(globalThis,"document");}
});
