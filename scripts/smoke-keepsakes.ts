import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import { captureSoloSnapshot } from "../shared/solo-save.js";
import { applyKeepsake } from "../shared/keepsakes.js";
import { gridCellCenter, initialState, UPGRADES, makeOrder, mulberry32, type GameState, type KeepsakeId, type Player } from "../shared/game.js";

const url=process.env.SMOKE_SERVER_URL??"http://localhost:3001";
const checks:string[]=[];
const profile=(token:string)=>({token,name:"Keepsake QA",role:"Tabby" as const,fur:"#e5a265",accessory:"Bow tie"});
const wait=(socket:Socket,predicate:(state:GameState)=>boolean,timeoutMs=5000)=>new Promise<GameState>((resolve,reject)=>{
 const timer=setTimeout(()=>{socket.off("state",onState);reject(new Error(`Keepsake state timed out after ${timeoutMs}ms`));},timeoutMs);
 const onState=(state:GameState)=>{if(predicate(state)){clearTimeout(timer);socket.off("state",onState);resolve(state);}};socket.on("state",onState);
});
async function event(socket:Socket,name:string,payload:unknown,predicate:(state:GameState)=>boolean){const pending=wait(socket,predicate);socket.emit(name,payload);return pending;}
let sequence=0;
async function savedRoom(setup:(state:GameState,player:Player)=>void){
 const token=`keepsake-${Date.now()}-${sequence++}`,socket=io(url,{forceNew:true,reconnection:false});
 await new Promise<void>((resolve,reject)=>{socket.once("connect",resolve);socket.once("connect_error",reject);});
 const player:Player={id:token,...profile(token),...gridCellCenter(2,3),direction:"down",moving:false,moveSequence:0,carrying:[],connected:true,score:0};
 const state=initialState("SAVED",token,42);state.players[token]=player;state.phase="shift";setup(state,player);
 const restored=await event(socket,"create-room",{...profile(token),solo:true,snapshot:captureSoloSnapshot(state,token)},state=>Boolean(state.players[token]));
 return {socket,token,state:restored};
}
async function resume(socket:Socket){return event(socket,"set-pause",false,state=>state.pausedAt===null);}
async function main(){
 for(const upgrade of UPGRADES){
  const {socket,token,state:before}=await savedRoom(state=>{state.phase="upgrades";state.upgrades=UPGRADES;state.health=2;applyKeepsake(state,"patient-patrons");});
  try{
   const result=await event(socket,"choose-upgrade",upgrade.id,state=>state.phase==="shift"&&state.round===2);
   assert.equal(result.activeKeepsake,upgrade.id);assert.notEqual(result.tavern.theme,before.tavern.theme);assert.equal(result.health,upgrade.id==="nine-lives"?3:2);
   assert.equal(result.orderPatienceBonus,upgrade.id==="patient-patrons"?12:0);
   const regular=makeOrder("x",mulberry32(42+31),2,0,0);assert.equal(result.orders[0].maxPatience,regular.maxPatience+(upgrade.id==="patient-patrons"?12:0));
   assert.ok(result.message.includes(upgrade.title));socket.emit("choose-upgrade",upgrade.id);
   const paused=await event(socket,"set-pause",true,state=>state.pausedAt!==null);assert.equal(paused.round,2);assert.equal(paused.health,result.health);
   const reloaded=await savedRoom(state=>Object.assign(state,structuredClone(paused),{players:{[state.hostId]:{...paused.players[token],id:state.hostId}},hostId:state.hostId}));
   try{assert.equal(reloaded.state.activeKeepsake,upgrade.id);assert.equal(reloaded.state.health,result.health);}finally{reloaded.socket.disconnect();}
   checks.push(`${upgrade.title}: choice, actual shift state, repeat protection, save/resume`);
  }finally{socket.disconnect();}
 }
 {
  const {socket,token}=await savedRoom((state,player)=>{applyKeepsake(state,"bottomless-bag");player.carrying=["catnip","lime","fizz"];Object.assign(player,gridCellCenter(6,1));});
  try{
   await resume(socket);let state=await event(socket,"interact",undefined,state=>state.players[token].carrying.length===4);assert.ok(state.players[token].carrying.includes("moonmilk"));
   await event(socket,"move",{...gridCellCenter(5,1),sequence:1},state=>state.players[token].moveSequence===1);
   state=await event(socket,"interact",undefined,state=>state.message.includes("paws are full"));assert.equal(state.players[token].carrying.length,4);
   checks.push("Bottomless Bag: fourth pantry pickup allowed, fifth blocked");
  }finally{socket.disconnect();}
 }
 {
  const {socket,token}=await savedRoom((state,player)=>{applyKeepsake(state,"bottomless-bag");player.carrying=["catnip","moonmilk","lime","fizz"];});
  try{
   await resume(socket);let state=await event(socket,"interact",undefined,state=>Boolean(state.mixingChoices?.[token]));assert.deepEqual(state.mixingChoices?.[token],["catnip","lunar-fizz"]);
   socket.emit("mix-recipe-select","tuna");
   state=await event(socket,"mix-recipe-select","catnip",state=>Boolean(state.mixing[token]));assert.equal(state.mixing[token].recipeId,"catnip");
   for(const ingredient of ["fizz","lime","catnip"])state=await event(socket,"mix-ingredient",ingredient,state=>state.mixing[token]?.usedIngredients.includes(ingredient));
   await event(socket,"mix-tool-start","shaker",state=>Boolean(state.mixing[token]?.toolStartedAt));await new Promise(resolve=>setTimeout(resolve,1800));
   state=await event(socket,"mix-tool-finish","shaker",state=>state.players[token].drink==="catnip");assert.deepEqual(state.players[token].carrying,["moonmilk"]);assert.ok(state.players[token].drinkQuality!>=.88);
   state=await event(socket,"interact",undefined,state=>Boolean(state.tavern.stations.find(station=>station.id==="mix")?.drink));assert.deepEqual(state.players[token].carrying,["moonmilk"]);
   state=await event(socket,"interact",undefined,state=>state.players[token].drink==="catnip");assert.deepEqual(state.players[token].carrying,["moonmilk"]);
   checks.push("Bottomless Bag: choose valid recipe, reject spoofed choice, mix, retain spare, single-button handoffs");
  }finally{socket.disconnect();}
 }
 {
  const {socket,token}=await savedRoom((state,player)=>{applyKeepsake(state,"bottomless-bag");player.carrying=["moonmilk","cream","stardust","fizz"];});
  try{
   await resume(socket);await event(socket,"interact",undefined,state=>Boolean(state.mixing[token]));
   for(let mistake=1;mistake<=3;mistake++)await event(socket,"mix-ingredient","fizz",state=>mistake===3?!state.mixing[token]:state.mixing[token]?.mistakes===mistake);
   const state=await event(socket,"set-pause",true,state=>state.pausedAt!==null);
   assert.deepEqual(state.players[token].carrying,["fizz"]);assert.equal(state.players[token].drink,undefined);
   checks.push("Bottomless Bag: failed mixture spoils only the chosen recipe and preserves the spare");
  }finally{socket.disconnect();}
 }
 {
  const {socket,token}=await savedRoom((state,player)=>{applyKeepsake(state,"bottomless-bag");player.carrying=["kelp","tonic","cream"];Object.assign(player,gridCellCenter(2,5));state.tavern.stations.find(station=>station.kind==="chop")!.preparedIngredient="chopped-tuna";});
  try{
   await resume(socket);const state=await event(socket,"interact",undefined,state=>state.players[token].carrying.length===4);
   assert.ok(state.players[token].carrying.includes("chopped-tuna"));assert.equal(state.tavern.stations.find(station=>station.kind==="chop")?.preparedIngredient,undefined);
   checks.push("Bottomless Bag: a prepared tuna pickup uses the fourth slot");
  }finally{socket.disconnect();}
 }
 for(const quality of [1,.7]){
  const {socket,token}=await savedRoom((state,player)=>{applyKeepsake(state,"lucky-whiskers");Object.assign(player,gridCellCenter(12,3),{drink:"catnip",drinkQuality:quality});state.orders=[{id:"guest",tableId:"table-1",seatId:"table-1-seat",recipeId:"catnip",customer:"Guest",patience:150,maxPatience:160}];});
  try{await resume(socket);const result=await event(socket,"interact",undefined,state=>state.players[token].drink===undefined);assert.equal(result.coins,quality===1?12:8);assert.equal(result.players[token].score,result.coins);assert.equal(result.orders.length,0);checks.push(`Lucky Whiskers: ${quality===1?"perfect bonus":"no bonus on ordinary drink"} at actual service`);}finally{socket.disconnect();}
 }
 console.log(JSON.stringify({ok:true,checks},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
