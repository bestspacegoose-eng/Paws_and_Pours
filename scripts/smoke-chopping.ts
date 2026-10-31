import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import { captureSoloSnapshot } from "../shared/solo-save.js";
import { CHOPPING_RECIPES, gridCellCenter, initialState, type GameState, type Player } from "../shared/game.js";
const url=process.env.SMOKE_SERVER_URL??"http://localhost:3001";
const profile=(token:string)=>({token,name:"Chopping QA",role:"Tabby" as const,fur:"#e5a265",accessory:"Bow tie"});
const wait=(socket:Socket,predicate:(state:GameState)=>boolean,timeout=5000)=>new Promise<GameState>((resolve,reject)=>{
 const timer=setTimeout(()=>{socket.off("state",onState);reject(new Error("Chopping state timeout"));},timeout);
 const onState=(state:GameState)=>{if(predicate(state)){clearTimeout(timer);socket.off("state",onState);resolve(state);}};socket.on("state",onState);
});
const event=async(socket:Socket,name:string,payload:unknown,predicate:(state:GameState)=>boolean)=>{const pending=wait(socket,predicate);socket.emit(name,payload);return pending;};
async function room(carrying:string[],cell:[number,number]=[2,5]){
 const token=`chop-${Date.now()}-${Math.random()}`,socket=io(url,{forceNew:true,reconnection:false});await new Promise<void>((resolve,reject)=>{socket.once("connect",resolve);socket.once("connect_error",reject);});
 const state=initialState("OLD",token,42);state.phase="shift";const player:Player={id:token,...profile(token),...gridCellCenter(...cell),direction:"down",moving:false,moveSequence:0,carrying,connected:true,score:0};state.players[token]=player;
 await event(socket,"create-room",{...profile(token),solo:true,snapshot:captureSoloSnapshot(state,token)},state=>Boolean(state.players[token]));await event(socket,"set-pause",false,state=>state.pausedAt===null);return{socket,token};
}
async function chop(socket:Socket,token:string,raw:string){
 const action=CHOPPING_RECIPES.find(recipe=>recipe.ingredients[0]===raw)!.preparation.actions[0];if(action.kind!=="rhythm")throw new Error("Missing chopping action");
 let result:GameState|undefined;
 for(let hit=0;hit<action.hits;hit++){
  if(hit)await new Promise(resolve=>setTimeout(resolve,action.intervalMs));
  result=await event(socket,"mix-rhythm-hit",{style:"chop"},state=>hit===action.hits-1?!state.mixing[token]:state.mixing[token]?.rhythmHits===hit+1);
 }
 return result!;
}
async function main(){const checks=[];
 for(const raw of ["tuna","lime","kelp"]){const{socket,token}=await room([raw,"cream"]);try{
  let state=await event(socket,"interact",undefined,state=>state.mixing[token]?.kind==="chop");assert.equal(state.mixing[token].ingredient,raw);assert.ok(state.players[token].carrying.includes(raw));assert.equal(state.tavern.stations.find(station=>station.kind==="chop")?.preparedIngredient,undefined);
  state=await chop(socket,token,raw);assert.deepEqual(state.players[token].carrying,["cream"]);const prepared=state.tavern.stations.find(station=>station.kind==="chop")!;assert.equal(prepared.preparedIngredient,`chopped-${raw}`);assert.ok(prepared.preparedQuality!>.95);
  state=await event(socket,"interact",undefined,state=>state.players[token].carrying.includes(`chopped-${raw}`));assert.equal(state.players[token].drink,undefined);assert.ok(state.players[token].ingredientQualities?.[`chopped-${raw}`]!>.95);checks.push(`${raw}: actual minigame, shared output and quality-preserving pickup`);
 }finally{socket.disconnect();}}
 {
 const{socket,token}=await room(["moonmilk","lime","fizz"],[2,3]);try{const state=await event(socket,"interact",undefined,state=>state.message.includes("Chop"));assert.deepEqual(state.players[token].carrying,["moonmilk","lime","fizz"]);assert.equal(state.mixing[token],undefined);checks.push("mixing counter rejects unchopped recipe without discarding ingredients");}finally{socket.disconnect();}}
 {
 const{socket,token}=await room(["tuna","kelp","cream"]);try{
  let state=await event(socket,"interact",undefined,state=>Boolean(state.mixingChoices?.[token]));assert.deepEqual(state.mixingChoices?.[token],["chop-tuna","chop-kelp"]);
  socket.emit("mix-recipe-select","chop-lime");state=await event(socket,"mix-recipe-select","chop-kelp",state=>state.mixing[token]?.ingredient==="kelp");
  await event(socket,"mix-rhythm-hit",{style:"chop"},state=>state.mixing[token]?.rhythmHits===1);
  await event(socket,"set-pause",true,state=>state.pausedAt!==null);state=await event(socket,"set-pause",false,state=>state.pausedAt===null);assert.equal(state.mixing[token].rhythmHits,0);
  state=await event(socket,"cancel-mixing",undefined,state=>!state.mixing[token]);assert.deepEqual(state.players[token].carrying,["tuna","kelp","cream"]);checks.push("board choice rejects forged ingredient; pause and cancel preserve the raw ingredients");
 }finally{socket.disconnect();}}
 {
 const{socket,token}=await room(["moonmilk","lime","fizz"]);try{
  await event(socket,"interact",undefined,state=>state.mixing[token]?.kind==="chop");await chop(socket,token,"lime");await event(socket,"interact",undefined,state=>state.players[token].carrying.includes("chopped-lime"));
  await event(socket,"move",{...gridCellCenter(2,3),sequence:1},state=>state.players[token].moveSequence===1);await event(socket,"interact",undefined,state=>state.mixing[token]?.recipeId==="lunar-fizz");
  for(const ingredient of ["fizz","chopped-lime","moonmilk"])await event(socket,"mix-ingredient",ingredient,state=>state.mixing[token]?.usedIngredients.includes(ingredient));
  await event(socket,"mix-tool-start","shaker",state=>Boolean(state.mixing[token]?.toolStartedAt));await new Promise(resolve=>setTimeout(resolve,1600));const state=await event(socket,"mix-tool-finish","shaker",state=>state.players[token].drink==="lunar-fizz");assert.ok(state.players[token].drinkQuality!>.95);checks.push("complete Lunar Fizz flow: chop at board, pick up, mix at counter, finished drink");
 }finally{socket.disconnect();}}
 console.log(JSON.stringify({ok:true,checks},null,2));}
main().catch(error=>{console.error(error);process.exitCode=1;});
