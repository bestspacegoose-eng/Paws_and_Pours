import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import { createMixingSession, gridCellCenter, initialState, type GameState, type Player } from "../shared/game.js";
import { captureSoloSnapshot } from "../shared/solo-save.js";
const url = process.env.SMOKE_SERVER_URL ?? "http://localhost:3001";
const profile = (token: string) => ({token,name:token,role:"Tabby" as const,fur:"#e5a265",accessory:"Bow tie"});
const stateAfter = (socket: Socket, action: () => void, predicate: (state: GameState) => boolean) => new Promise<GameState>((resolve,reject)=>{
  const timeout=setTimeout(()=>{socket.off("state",listener);reject(new Error("Recovery check timed out"));},5000);
  const listener=(state:GameState)=>{if(predicate(state)){clearTimeout(timeout);socket.off("state",listener);resolve(state);}};
  socket.on("state",listener);action();
});
async function client(){const s=io(url,{forceNew:true,reconnection:false});await new Promise<void>((resolve,reject)=>{s.once("connect",resolve);s.once("connect_error",reject);});return s;}
async function main(){const sockets:Socket[]=[];const checks:string[]=[];
  try {
    const host=await client(),guest=await client();sockets.push(host,guest);
    const h=`recovery-host-${Date.now()}`,g=`recovery-guest-${Date.now()}`;
    // Malformed events must leave the server available for valid clients.
    host.emit("create-room",null);host.emit("join-room",{});host.emit("move",null);
    let state=await stateAfter(host,()=>host.emit("create-room",profile(h)),state=>Boolean(state.players[h]));
    const code=state.code;
    await stateAfter(guest,()=>guest.emit("join-room",{...profile(g),code}),state=>Boolean(state.players[g]));
    state=await stateAfter(guest,()=>host.disconnect(),state=>state.hostId===g&&!state.players[h].connected);
    assert.equal(state.players[g].connected,true);checks.push("malformed events rejected; disconnected lobby host hands authority to guest");
    const third=await client();sockets.push(third);const t=`recovery-third-${Date.now()}`;
    await stateAfter(guest,()=>third.emit("join-room",{...profile(t),code}),state=>Boolean(state.players[t]));
    await stateAfter(guest,()=>guest.emit("lobby-ready",true),state=>Boolean(state.players[g].ready));
    await stateAfter(guest,()=>third.emit("lobby-ready",true),state=>Boolean(state.players[t].ready));
    state=await stateAfter(guest,()=>guest.emit("start-shift"),state=>state.phase==="shift");
    assert.equal(state.players[h].connected,false);checks.push("two ready connected bartenders can start while a disconnected seat remains reserved");
    const solo=await client();sockets.push(solo);const token=`recovery-solo-${Date.now()}`;
    const saved=initialState("OLD",token,42);saved.phase="shift";
    const cat:Player={id:token,...profile(token),...gridCellCenter(2,3),direction:"down",moving:false,moveSequence:0,carrying:["catnip","cream","tonic"],connected:true,score:0};saved.players[token]=cat;
    state=await stateAfter(solo,()=>solo.emit("create-room",{...profile(token),solo:true,snapshot:captureSoloSnapshot(saved,token)}),state=>Boolean(state.players[token]));
    const soloCode=state.code;
    await stateAfter(solo,()=>solo.emit("set-pause",false),state=>state.pausedAt===null);
    state=await stateAfter(solo,()=>solo.emit("interact"),state=>state.message.includes("Ingredients kept"));
    assert.deepEqual(state.players[token].carrying,["catnip","cream","tonic"]);checks.push("invalid full recipe keeps every ingredient");
    solo.disconnect();await new Promise(resolve=>setTimeout(resolve,1200));
    const returning=await client();sockets.push(returning);
    state=await stateAfter(returning,()=>returning.emit("join-room",{...profile(token),code:soloCode}),state=>state.players[token]?.connected===true);
    assert.ok(state.pausedAt);assert.deepEqual(state.players[token].carrying,["catnip","cream","tonic"]);
    const seconds=state.shiftSeconds;await new Promise(resolve=>setTimeout(resolve,1100));
    state=await stateAfter(returning,()=>returning.emit("set-pause",false),state=>state.pausedAt===null);
    assert.equal(state.shiftSeconds,seconds);checks.push("empty-room disconnect pauses the shift; reconnect restores inventory and resumes explicitly");
    const prep=await client();sockets.push(prep);const p=`recovery-prep-${Date.now()}`;
    const prepSave=initialState("OLD",p,42);prepSave.phase="shift";prepSave.players[p]={...cat,id:p,carrying:["catnip","lime","fizz"]};
    prepSave.mixing[p]=createMixingSession(p,"catnip");Object.assign(prepSave.mixing[p],{stepIndex:3,usedIngredients:["catnip","lime","fizz"],qualityPoints:3});
    state=await stateAfter(prep,()=>prep.emit("create-room",{...profile(p),solo:true,snapshot:captureSoloSnapshot(prepSave,p)}),state=>Boolean(state.mixing[p]));
    const prepCode=state.code;
    await stateAfter(prep,()=>prep.emit("set-pause",false),state=>state.pausedAt===null);
    await stateAfter(prep,()=>prep.emit("mix-tool-start","shaker"),state=>Boolean(state.mixing[p]?.toolStartedAt));
    prep.disconnect();await new Promise(resolve=>setTimeout(resolve,200));
    const prepReturn=await client();sockets.push(prepReturn);
    state=await stateAfter(prepReturn,()=>prepReturn.emit("join-room",{...profile(p),code:prepCode}),state=>Boolean(state.players[p]?.connected));
    assert.equal(state.mixing[p].toolStartedAt,undefined);assert.equal(state.mixing[p].mistakes,0);assert.equal(state.mixing[p].stepIndex,3);
    checks.push("disconnect during tool hold preserves recipe progress and resets the gesture without a mistake");
    console.log(JSON.stringify({ok:true,checks},null,2));
  }finally{sockets.forEach(socket=>socket.disconnect());}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
