import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import { gridCellCenter, initialState, type GameState, type Player } from "../shared/game.js";
import { hospitalityFor } from "../shared/hospitality.js";
import { captureSoloSnapshot } from "../shared/solo-save.js";
const url=process.env.SMOKE_SERVER_URL??"http://localhost:3001";
const profile=(token:string)=>({token,name:"Hospitality QA",role:"Tabby" as const,fur:"#e5a265",accessory:"Bow tie"});
function next(socket:Socket,send:()=>void,predicate:(state:GameState)=>boolean){return new Promise<GameState>((resolve,reject)=>{
  const timer=setTimeout(()=>{socket.off("state",listener);reject(new Error("Hospitality check timed out"));},6000);
  const listener=(state:GameState)=>{if(predicate(state)){clearTimeout(timer);socket.off("state",listener);resolve(state);}};socket.on("state",listener);send();
});}
async function main(){const checks:string[]=[];
  for(const quality of [.879,.88]){
    const socket=io(url,{forceNew:true,reconnection:false});
    try{
      await new Promise<void>((resolve,reject)=>{socket.once("connect",resolve);socket.once("connect_error",reject);});
      const token=`hospitality-${Date.now()}`,state=initialState("OLD",token,42);state.phase="shift";state.shiftSeconds=2;
      const cat:Player={...profile(token),id:token,...gridCellCenter(11,3),direction:"up",moving:false,moveSequence:0,carrying:[],drink:"tuna",drinkQuality:quality,drinkContributors:["foreign-saved-player"],connected:true,score:28};state.players[token]=cat;
      state.orders=[{id:"house",recipeId:"tuna",customer:"Juniper",patience:90,maxPatience:100,tableId:"table-1",seatId:"table-1-seat",houseSpecial:true}];
      state.coins=28;const h=hospitalityFor(state);h.warmth=2;Object.assign(h.stats,{served:2,perfect:2,specials:2,soloSpecials:2,coinsEarned:28,qualityTotal:2});
      let observed=await next(socket,()=>socket.emit("create-room",{...profile(token),solo:true,snapshot:captureSoloSnapshot(state,token)}),s=>Boolean(s.players[token]));
      assert.deepEqual(observed.players[token].drinkContributors,[token]);
      await next(socket,()=>socket.emit("set-pause",false),s=>s.pausedAt===null);
      observed=await next(socket,()=>socket.emit("interact"),s=>!s.orders.length&&!s.players[token].drink);
      assert.equal(observed.hospitality?.stats.served,3);
      if(quality<.88){assert.equal(observed.hospitality?.warmth,2);assert.equal(observed.hospitality?.celebrationCount,0);checks.push("solo below 88% serves normally without a bonus");}
      else{assert.equal(observed.hospitality?.warmth,0);assert.equal(observed.hospitality?.celebrationCount,1);assert.match(observed.message,/perfect preparation/);checks.push("solo accuracy earns the special bonus and third-warmth celebration");}
      const completed=await next(socket,()=>{},s=>s.phase==="upgrades");
      assert.equal(completed.hospitality?.lastShift?.stats.served,3);assert.equal(completed.hospitality?.lastShift?.stats.coinsEarned,completed.coins);
      const chosen=completed.upgrades[0].id;
      observed=await next(socket,()=>socket.emit("choose-upgrade",chosen),s=>s.phase==="shift"&&s.round===2);
      assert.equal(observed.activeKeepsake,chosen);assert.equal(observed.hospitality?.stats.served,0);assert.equal(observed.hospitality?.lastShift?.round,1);
      assert.notEqual(observed.tavern.theme,completed.tavern.theme);checks.push("shift closes with a report; keepsake starts a new themed shift and preserves the prior report");
    }finally{socket.disconnect();}
  }
  console.log(JSON.stringify({ok:true,checks},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
