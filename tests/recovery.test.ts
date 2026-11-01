import test from "node:test";
import assert from "node:assert/strict";
import { initialState, createMixingSession, PLAYER_SPAWNS, resumeShift, type Player } from "../shared/game.js";
import { disconnectPlayer, resetPreparationGesture, validProfile } from "../shared/recovery.js";
const cat = (id: string): Player => ({ id, name:id, role:"Tabby", fur:"#e5a265", accessory:"Bow tie", ...PLAYER_SPAWNS[0], direction:"down", moving:true, moveSequence:0, carrying:["catnip","lime","fizz"], connected:true, score:0 });

test("host disconnection transfers authority to a connected crewmate without losing inventory or preparation", () => {
  const state = initialState("TEST","host",42); state.phase = "shift";
  state.players = { host:cat("host"), guest:cat("guest") };
  state.mixing.host = createMixingSession("host","catnip",1000);
  Object.assign(state.mixing.host,{stepIndex:3,usedIngredients:["catnip","lime","fizz"],qualityPoints:3,toolStartedAt:1200});
  disconnectPlayer(state,"host",2000);
  assert.equal(state.hostId,"guest"); assert.equal(state.pausedAt,null);
  assert.equal(state.players.host.moving,false); assert.equal(state.players.host.connected,false);
  assert.equal(state.mixing.host.toolStartedAt,undefined); assert.equal(state.mixing.host.stepIndex,3);
  assert.deepEqual(state.players.host.carrying,["catnip","lime","fizz"]);
});
test("an empty room freezes all clocks and restarts gestures safely after reconnect", () => {
  const state = initialState("TEST","host",42); state.phase="shift"; state.players.host=cat("host");
  state.mixing.host=createMixingSession("host","catnip",1000);
  Object.assign(state.mixing.host,{rhythmHits:2,rhythmLastHitAt:1500,rhythmQualityPoints:.8});
  disconnectPlayer(state,"host",2000);
  assert.equal(state.pausedAt,2000); assert.equal(state.mixing.host.rhythmHits,0);
  state.players.host.connected=true; resetPreparationGesture(state,"host");resumeShift(state,12000);
  assert.equal(state.mixing.host.deadlineAt,56000); assert.equal(state.mixing.host.mistakes,0);
});
test("invalid network profiles are rejected without accepting malformed or reserved identities", () => {
  const p={token:"host-123",name:"Mittens",role:"Tabby",fur:"#e5a265",accessory:"Bow tie"};
  assert.equal(validProfile(p),true);
  for(const bad of [null,undefined,[],{}, {...p,token:"__proto__"},{...p,name:3},{...p,fur:"red"},{...p,role:"Dragon"},{...p,accessory:"fake"}])assert.equal(validProfile(bad),false);
});
