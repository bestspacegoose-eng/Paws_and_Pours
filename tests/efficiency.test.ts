import test from "node:test";
import assert from "node:assert/strict";
import { initialState, PLAYER_SPAWNS, type Player } from "../shared/game.js";
import { reconcilePrediction, type LocalPrediction } from "../client/state-reconciliation.js";
import { overlayRenderKey } from "../client/overlay-state.js";
import { CanvasLayerCache, tavernLayoutKey } from "../client/canvas-cache.js";
import { EMPTY_ROOM_RETENTION_MS, roomExpired } from "../shared/room-lifecycle.js";
const cat:Player={id:"cat",name:"Cat",role:"Tabby",fur:"#e5a265",accessory:"Bow tie",...PLAYER_SPAWNS[0],direction:"down",moving:false,moveSequence:3,carrying:[],connected:true,score:0};
const state=()=>{const s=initialState("TEST","cat",42);s.phase="shift";s.players.cat=structuredClone(cat);return s;};
const prediction:LocalPrediction={x:600,y:400,direction:"right",moving:true,moveSequence:4};

test("unacknowledged prediction survives ordinary updates but never crosses reconnect, room, round or pause boundaries",()=>{
  const previous=state(),next=structuredClone(previous);
  assert.equal(reconcilePrediction(previous,next,"cat",prediction,false),prediction);
  assert.equal(reconcilePrediction(previous,next,"cat",prediction,true,true),null);
  for(const patch of [{code:"OTHER"},{round:2},{phase:"upgrades" as const},{pausedAt:1000}]){
    assert.equal(reconcilePrediction(previous,{...next,...patch},"cat",prediction,true),null);
  }
  next.mixingChoices={cat:["tuna","kelp-swirl"]};assert.equal(reconcilePrediction(previous,next,"cat",prediction,true),null);
});
test("acknowledged movement cannot keep a released cat walking or override server collision correction",()=>{
  const previous=state(),next=state();next.players.cat.moveSequence=4;next.players.cat.x=180;
  assert.equal(reconcilePrediction(previous,next,"cat",prediction,false),null);
  assert.equal(next.players.cat.x,180);
  assert.equal(reconcilePrediction(previous,next,"cat",prediction,true),prediction);
});
test("private recipe choices retain their DOM across other-player movement and patience updates",()=>{
  const s=state(),view={panel:"main",book:false,page:0,mode:"multiplayer"};s.mixingChoices={cat:["tuna","kelp-swirl"]};
  const key=overlayRenderKey(s,"cat",view);
  s.players.guest={...cat,id:"guest",x:450};s.shiftSeconds--;s.message="Guest moved";
  assert.equal(overlayRenderKey(s,"cat",view),key);
  s.mixingChoices.cat=["chop-tuna"];
  assert.notEqual(overlayRenderKey(s,"cat",view),key);
  s.mixingChoices={};assert.notEqual(overlayRenderKey(s,"cat",view),key);
});
test("modal cache invalidates for recipe pages, host changes, health and reports",()=>{
  const s=state(),view={panel:"main",book:true,page:0,mode:"single"};s.pausedAt=100;
  assert.notEqual(overlayRenderKey(s,"cat",view),overlayRenderKey(s,"cat",{...view,page:1}));
  s.phase="upgrades";const key=overlayRenderKey(s,"cat",view);
  s.hostId="guest";assert.notEqual(overlayRenderKey(s,"cat",view),key);
  s.hostId="cat";s.health=2;assert.notEqual(overlayRenderKey(s,"cat",view),key);
});
test("the cached floor ignores item transfers while themes and physical shadows invalidate it",()=>{
  const s=state(),t=s.tavern,key=tavernLayoutKey(t);t.stations[0].drink={recipeId:"catnip",quality:.8};
  t.stations[1].counterIngredient={ingredient:"lime",quality:1};assert.equal(tavernLayoutKey(t),key);
  t.stations[0].x++;assert.notEqual(tavernLayoutKey(t),key);t.stations[0].x--;
  t.theme="Pirate Cat Tavern";assert.notEqual(tavernLayoutKey(t),key);
});
test("the canvas cache repaints on layout or late-art changes and keeps only one bounded surface",()=>{
  let created=0,painted=0,blits=0;
  const layer={clearRect(){},imageSmoothingEnabled:true,fillStyle:"",strokeStyle:"",font:"",textAlign:"center",lineWidth:1} as unknown as CanvasRenderingContext2D;
  const cache=new CanvasLayerCache(1088,712,()=>{created++;return {getContext:()=>layer} as unknown as HTMLCanvasElement;});
  const target={drawImage(){blits++;}} as unknown as CanvasRenderingContext2D;
  const paint=(c:CanvasRenderingContext2D)=>{painted++;c.font="10px monospace";};
  for(let i=0;i<120;i++)cache.draw(target,"moon|art:1",paint);
  assert.equal(painted,1);assert.equal(blits,120);assert.equal(created,1);assert.equal(target.font,"10px monospace");
  cache.draw(target,"moon|art:2",paint);cache.draw(target,"pirate|art:2",paint);
  assert.equal(painted,3);assert.equal(created,1);
});
test("abandoned rooms expire only after two hours and never evict a connected crew",()=>{
  const s=state();s.players.cat.connected=false;
  assert.equal(roomExpired(s,1000,1000+EMPTY_ROOM_RETENTION_MS-1),false);
  assert.equal(roomExpired(s,1000,1000+EMPTY_ROOM_RETENTION_MS),true);
  s.players.cat.connected=true;assert.equal(roomExpired(s,1000,1000+EMPTY_ROOM_RETENTION_MS),false);
  s.players.cat.connected=false;assert.equal(roomExpired(s,undefined,1e10),false);
});
