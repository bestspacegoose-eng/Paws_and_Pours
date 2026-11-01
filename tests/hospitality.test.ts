import test from "node:test";
import assert from "node:assert/strict";
import { createMixingSession, gridCellCenter, initialState, makeOrder, mulberry32, RECIPES, transferCounterItem, type Order, type Player } from "../shared/game.js";
import { chooseChoppingIngredient, finishChopping, openChoppingBoard, takeChoppedIngredient } from "../shared/chopping.js";
import { drinkContributors } from "../shared/contributions.js";
import { consumeRecipeIngredients } from "../shared/keepsakes.js";
import { captureSoloSnapshot, restoreSoloSnapshot } from "../shared/solo-save.js";
import { CELEBRATION_BONUS, designateHouseSpecial, finishHospitalityShift, hospitalityFor, recordServedDrink, recordWork, shiftAdvice, specialReward, startHospitalityShift } from "../shared/hospitality.js";
const cat = (id="a", carrying:string[]=[]):Player => ({id,name:id,role:"Tabby",fur:"#e5a265",accessory:"Bow tie",...gridCellCenter(2,5),direction:"down",moving:false,moveSequence:0,carrying,connected:true,score:0});
const special:Order={id:"special",recipeId:"tuna",customer:"Juniper",patience:80,maxPatience:100,tableId:"table-1",houseSpecial:true};

test("House Specials arrive every third guest, use unlocked chopping recipes, and add preparation time",()=>{
  for(let round=1;round<=4;round++)for(const elapsed of [0,60,90,170])for(let sequence=1;sequence<=12;sequence++){
    const ordinary=makeOrder("order",mulberry32(sequence),round,elapsed),order=designateHouseSpecial(ordinary,sequence,round,elapsed);
    assert.equal(Boolean(order.houseSpecial),sequence%3===0);
    if(order.houseSpecial){assert.equal(order.maxPatience,ordinary.maxPatience+20);assert.equal(order.patience,ordinary.patience+20);assert.ok(RECIPES.find(r=>r.id===order.recipeId)!.ingredients.some(i=>i.startsWith("chopped-")));}
    else assert.deepEqual(order,ordinary);
  }
});
test("ingredient provenance survives handoff, chopping, mixing and finished-drink handoff without inventing work",()=>{
  const state=initialState("TEST","a",42),a=cat("a",["tuna"]),b=cat("b",["tonic","kelp"]);
  a.ingredientContributors={tuna:["a"]};b.ingredientContributors={tonic:["b"],kelp:["b"]};
  state.players={a,b};const counter=state.tavern.stations.find(s=>s.kind==="counter")!,board=state.tavern.stations.find(s=>s.kind==="chop")!;
  transferCounterItem(a,counter);assert.deepEqual(counter.counterIngredient?.contributors,["a"]);
  transferCounterItem(b,counter);assert.deepEqual(b.ingredientContributors.tuna,["a"]);
  openChoppingBoard(state,b,board,1000);assert.equal(chooseChoppingIngredient(state,b,board,"chop-tuna",1000),true);Object.assign(state.mixing.b,{stepIndex:2,qualityPoints:2});
  assert.equal(finishChopping(state,b,state.mixing.b),true);assert.deepEqual(board.preparedContributors,["a","b"]);
  takeChoppedIngredient(b,board);assert.deepEqual(b.ingredientContributors["chopped-tuna"],["a","b"]);
  b.drink="tuna";b.drinkQuality=1;b.drinkContributors=drinkContributors(b,["chopped-tuna","tonic","kelp"]);
  consumeRecipeIngredients(b,{ingredients:["chopped-tuna","tonic","kelp"]});assert.deepEqual(b.ingredientContributors,{});
  transferCounterItem(b,counter);assert.deepEqual(counter.drink?.contributors,["a","b"]);
  transferCounterItem(a,counter);assert.deepEqual(a.drinkContributors,["a","b"]);
  assert.equal(specialReward(special,{recipeId:"tuna",quality:1,contributors:a.drinkContributors},"a",false).bonus,4);
});
test("counter ping-pong does not create contributors; a separate bartender serving counts as real work",()=>{
  const state=initialState("TEST","a",42),a=cat("a",["lime"]),b=cat("b");a.ingredientContributors={lime:["a"]};
  const counter=state.tavern.stations.find(s=>s.kind==="counter")!;
  transferCounterItem(a,counter);transferCounterItem(b,counter);transferCounterItem(b,counter);transferCounterItem(a,counter);
  assert.deepEqual(a.ingredientContributors.lime,["a"]);
  const drink={recipeId:"tuna",quality:.8,contributors:["a"]};
  assert.equal(specialReward(special,drink,"a",false).bonus,0);
  assert.equal(specialReward(special,drink,"b",false).bonus,4);
});
test("solo uses actual preparation accuracy, never saved foreign identities, and ordinary orders get no special bonus",()=>{
  assert.equal(specialReward(special,{recipeId:"tuna",quality:.879,contributors:["a","b"]},"a",true).bonus,0);
  assert.deepEqual(specialReward(special,{recipeId:"tuna",quality:.88},"a",true),{bonus:4,method:"accuracy"});
  assert.equal(specialReward({...special,houseSpecial:false},{recipeId:"tuna",quality:1,contributors:["a","b"]},"a",false).bonus,0);
});
test("three rewarded specials create exactly one shared toast; ordinary service and misses do not fake warmth",()=>{
  const state=initialState("TEST","a",42),a=cat();state.players.a=a;
  for(let i=0;i<3;i++){
    const reward=recordServedDrink(state,a,{...special,id:`special-${i}`},{recipeId:"tuna",quality:1},10,true,1000+i);
    assert.equal(reward.total,14+(i===2?CELEBRATION_BONUS:0));assert.equal(reward.celebration,i===2);
  }
  const h=hospitalityFor(state);assert.equal(h.warmth,0);assert.equal(h.celebrationCount,1);assert.equal(state.coins,48);assert.equal(a.score,48);
  assert.equal(h.stats.soloSpecials,3);assert.equal(h.stats.perfect,3);assert.equal(h.stats.qualityTotal,3);assert.equal(h.stats.coinsEarned,48);
  recordServedDrink(state,a,{...special,houseSpecial:false},{recipeId:"tuna",quality:.8},8,true);
  assert.equal(h.warmth,0);assert.equal(h.celebrationCount,1);
});
test("shift reports are frozen before the next shift and record every bartender's actual contributions",()=>{
  const state=initialState("TEST","a",42),a=cat(),b=cat("b");state.players={a,b};
  recordWork(state,a,"gathered");recordWork(state,b,"chopped");recordWork(state,b,"mixed");
  recordServedDrink(state,a,special,{recipeId:"tuna",quality:1,contributors:["a","b"]},10,false);
  finishHospitalityShift(state,true);const report=structuredClone(state.hospitality!.lastShift);
  startHospitalityShift(state);assert.deepEqual(state.hospitality!.lastShift,report);assert.equal(state.hospitality!.stats.served,0);
  assert.equal(report!.stats.bartenders.a.gathered,1);assert.equal(report!.stats.bartenders.b.mixed,1);assert.equal(report!.stats.teamwork,1);
  assert.ok(shiftAdvice(report!.stats).length>0);
});
test("House Specials, warmth, and solo work survive save/resume with remapped identities and validated counts",()=>{
  const state=initialState("OLD","old",42),a=cat("old",["chopped-lime"]);state.players.old=a;
  state.orders=[{...special,seatId:"table-1-seat"}];a.ingredientContributors={"chopped-lime":["old","forged-friend"]};
  recordWork(state,a,"chopped");recordServedDrink(state,a,special,{recipeId:"tuna",quality:1},10,true);
  finishHospitalityShift(state,true);
  const snapshot=captureSoloSnapshot(state,"old");const restored=restoreSoloSnapshot(snapshot,"NEW",cat("new"))!;
  assert.equal(restored.orders[0].houseSpecial,true);assert.equal(restored.hospitality!.warmth,1);
  assert.deepEqual(Object.keys(restored.hospitality!.stats.bartenders),["new"]);
  assert.deepEqual(restored.players.new.ingredientContributors,{"chopped-lime":["new"]});
  snapshot.state.hospitality!.stats.perfect=99;assert.equal(restoreSoloSnapshot(snapshot,"NEW",cat("new")),undefined);
});
