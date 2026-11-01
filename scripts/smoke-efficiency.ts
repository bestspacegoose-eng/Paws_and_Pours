import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import type { GameState } from "../shared/game.js";
const url=process.env.SMOKE_SERVER_URL??"http://localhost:3001";
const profile=(token:string)=>({token,name:"Network QA",role:"Tabby" as const,fur:"#e5a265",accessory:"Bow tie"});
const after=(socket:Socket,action:()=>void,predicate:(state:GameState)=>boolean)=>new Promise<GameState>((resolve,reject)=>{
  const timer=setTimeout(()=>{socket.off("state",listener);reject(new Error("Efficiency check timed out"));},6000);
  const listener=(state:GameState)=>{if(predicate(state)){clearTimeout(timer);socket.off("state",listener);resolve(state);}};socket.on("state",listener);action();
});
async function main(){const sockets:Socket[]=[];
  try{
    for(let i=0;i<4;i++){const socket=io(url,{forceNew:true,reconnection:false});sockets.push(socket);await new Promise<void>((resolve,reject)=>{socket.once("connect",resolve);socket.once("connect_error",reject);});}
    const tokens=sockets.map((_,i)=>`efficiency-${Date.now()}-${i}`),host=sockets[0];
    let state=await after(host,()=>host.emit("create-room",profile(tokens[0])),s=>Boolean(s.players[tokens[0]]));
    for(let i=1;i<4;i++)await after(host,()=>sockets[i].emit("join-room",{...profile(tokens[i]),code:state.code}),s=>Boolean(s.players[tokens[i]]));
    for(let i=0;i<4;i++)await after(host,()=>sockets[i].emit("lobby-ready",true),s=>Boolean(s.players[tokens[i]].ready));
    state=await after(host,()=>host.emit("start-shift"),s=>s.phase==="shift");
    const starts=tokens.map(id=>({...state.players[id]}));
    let snapshots=0,bytes=0;const measure=(s:GameState)=>{snapshots++;bytes+=Buffer.byteLength(JSON.stringify(s));};host.on("state",measure);
    const send=(sequence:number)=>sockets.forEach((socket,i)=>socket.emit("move",{x:starts[i].x+(sequence%2?2:0),y:starts[i].y,direction:"right",moving:true,sequence}));
    for(let sequence=1;sequence<10;sequence++){send(sequence);await new Promise(resolve=>setTimeout(resolve,50));}
    state=await after(host,()=>send(10),s=>tokens.every(id=>s.players[id].moveSequence===10));
    host.off("state",measure);
    assert.ok(snapshots<=15,`Expected room-level coalescing; received ${snapshots} snapshots for 40 movement packets`);
    assert.ok(snapshots>=1);tokens.forEach((id,i)=>assert.equal(state.players[id].x,starts[i].x));
    // Actions bypass the movement queue and expose the latest authoritative positions.
    state=await after(host,()=>host.emit("interact"),s=>s.message.includes("Walk up to"));
    assert.deepEqual(state.players[tokens[0]].carrying,[]);
    state=await after(host,()=>host.emit("set-pause",true),s=>s.pausedAt!==null);
    assert.equal(state.players[tokens[0]].moving,false);
    console.log(JSON.stringify({ok:true,clients:4,movementPackets:40,roomSnapshots:snapshots,serializedBytes:bytes,allFinalPositionsAcknowledged:true,immediateInteractionAndPause:true},null,2));
  }finally{sockets.forEach(socket=>socket.disconnect());}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
