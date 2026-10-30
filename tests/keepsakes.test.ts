import assert from "node:assert/strict";
import test from "node:test";
import { applyKeepsake, isKeepsakeId, keepsakeEffects, remainingIngredients, servingReward } from "../shared/keepsakes.js";
import { initialState, gridCellCenter, makeTavern, makeOrder, mulberry32, RECIPES, recipesForCarriedIngredients, seededUpgrades, chopTuna, transferCounterDrink, PLAYER_SPAWNS, TAVERN_THEMES, type KeepsakeId, type Player } from "../shared/game.js";
import { playerMoveSpeed, movementTarget } from "../shared/movement.js";
import { captureSoloSnapshot, restoreSoloSnapshot } from "../shared/solo-save.js";
import { THEME_TILES } from "../client/theme-tiles-layout.js";

const player:Player={id:"saved",name:"Test cat",role:"Tabby",fur:"#e5a265",accessory:"Bow tie",...PLAYER_SPAWNS[0],direction:"down",moving:false,moveSequence:0,carrying:[],connected:true,score:0};

test("Swift Paws increases every breed's movement by 20%, independent of refresh rate",()=>{
  const multiplier=keepsakeEffects("swift-paws").movementMultiplier;
  for(const role of ["Tabby","Siamese","Maine Coon","Black Cat","Calico"] as const){
    assert.equal(playerMoveSpeed(role,multiplier),playerMoveSpeed(role)*1.2);
    for(const hz of [30,60,144]){let p={x:0,y:0};for(let i=0;i<hz;i++)p=movementTarget(p,{x:1,y:0},role,1000/hz,multiplier);assert.ok(Math.abs(p.x-playerMoveSpeed(role)*1.2)<1e-8);}
  }
});
test("each next-shift keepsake replaces the previous bonus, while Nine Lives heals only when applied",()=>{
  const state=initialState("TEST","cat",42);state.health=1;
  applyKeepsake(state,"patient-patrons");assert.equal(state.orderPatienceBonus,12);
  for(const elapsed of [0,24,72]){
    const regular=makeOrder("x",mulberry32(5),2,elapsed,0),patient=makeOrder("x",mulberry32(5),2,elapsed,state.orderPatienceBonus);
    assert.equal(patient.maxPatience,regular.maxPatience+12);assert.equal(patient.patience,regular.patience+12);
  }
  applyKeepsake(state,"bottomless-bag");assert.equal(state.orderPatienceBonus,0);assert.equal(keepsakeEffects(state.activeKeepsake).carryCapacity,4);
  applyKeepsake(state,"nine-lives");assert.equal(state.health,2);assert.equal(keepsakeEffects(state.activeKeepsake).carryCapacity,3);
  applyKeepsake(state,"nine-lives");applyKeepsake(state,"nine-lives");assert.equal(state.health,3);
  for(let seed=0;seed<50;seed++){assert.ok(seededUpgrades(seed,2,3).every(item=>item.id!=="nine-lives"));assert.equal(new Set(seededUpgrades(seed,2,2).map(item=>item.id)).size,3);}
});
test("Lucky Whiskers rewards any perfect drink at serving, without rewarding lower-quality drinks",()=>{
  for(const patience of [.1,.6,.61,1])for(const preparation of [0,.44,.6,.879,.88,1]){
    const regular=servingReward(patience,preparation),lucky=servingReward(patience,preparation,"lucky-whiskers");
    assert.equal(lucky.tip-regular.tip,preparation>=.88?2:0);assert.equal(lucky.reputation,regular.reputation);
    assert.equal(servingReward(patience,preparation,"swift-paws").tip,regular.tip);
  }
});
test("Bottomless Bag identifies every valid recipe in four ingredients and consumes only its recipe",()=>{
  for(const recipe of RECIPES){const spare=recipe.ingredients.includes("fizz")?"cream":"fizz",carried=[spare,...recipe.ingredients].reverse();
    assert.ok(recipesForCarriedIngredients(carried).some(match=>match.id===recipe.id));
    assert.deepEqual(remainingIngredients(carried,recipe),[spare]);assert.equal(carried.length,4);
  }
  assert.deepEqual(recipesForCarriedIngredients(["catnip","moonmilk","lime","fizz"]).map(recipe=>recipe.id),["catnip","lunar-fizz"]);
  assert.deepEqual(recipesForCarriedIngredients(["catnip","lime","lime","cream"]),[]);
});
test("Bag capacity applies to prepared tuna and carries spare ingredients through drink handoffs",()=>{
  const tavern=makeTavern(42),chop=tavern.stations.find(station=>station.kind==="chop")!,counter=tavern.stations.find(station=>station.kind==="counter")!;
  const cat={...player,carrying:["kelp","tonic","cream"]};chop.preparedIngredient="chopped-tuna";
  assert.equal(chopTuna(cat,chop),"full");assert.equal(chopTuna(cat,chop,4),"picked-up");assert.equal(cat.carrying.length,4);
  cat.carrying=["cream"];counter.drink={recipeId:"tuna",quality:.93};
  assert.equal(transferCounterDrink(cat,counter),"occupied");assert.equal(transferCounterDrink(cat,counter,4),"picked-up");assert.deepEqual(cat.carrying,["cream"]);
  assert.equal(transferCounterDrink(cat,counter,4),"placed");assert.equal(counter.drink?.quality,.93);
});
test("active keepsakes and four-ingredient bags survive fresh-identity solo restore without healing twice",()=>{
  for(const id of ["swift-paws","patient-patrons","lucky-whiskers","bottomless-bag","nine-lives"] as KeepsakeId[]){
    const state=initialState("OLD",player.id,42);state.players[player.id]={...player,carrying:id==="bottomless-bag"?["catnip","moonmilk","lime","fizz"]:[]};state.health=1;applyKeepsake(state,id);
    state.tavern.theme="Haunted Moonlit Inn";
    const restored=restoreSoloSnapshot(captureSoloSnapshot(state,player.id),"NEW",{...player,id:"new"})!;
    assert.equal(restored.activeKeepsake,id);assert.equal(restored.health,state.health);assert.deepEqual(restored.players.new.carrying,state.players[player.id].carrying);assert.equal(restored.tavern.theme,state.tavern.theme);
  }
  const state=initialState("OLD",player.id,42);state.players[player.id]={...player,carrying:[]};state.orderPatienceBonus=12;
  assert.equal(restoreSoloSnapshot(captureSoloSnapshot(state,player.id),"NEW",player)?.activeKeepsake,"patient-patrons");
  state.orderPatienceBonus=99;assert.equal(restoreSoloSnapshot(captureSoloSnapshot(state,player.id),"NEW",player)?.orderPatienceBonus,0);
  state.players[player.id].carrying=["catnip","moonmilk","lime","fizz"];assert.equal(restoreSoloSnapshot(captureSoloSnapshot(state,player.id),"NEW",player),undefined);
  assert.equal(isKeepsakeId("infinite-coins"),false);
});
test("a saved recipe choice is recomputed from the bag under the new player identity",()=>{
  const state=initialState("OLD",player.id,42);
  applyKeepsake(state,"bottomless-bag");state.phase="shift";
  state.players[player.id]={...player,...gridCellCenter(2,3),carrying:["catnip","moonmilk","lime","fizz"]};
  state.mixingChoices={[player.id]:["tuna","catnip"]};
  const restored=restoreSoloSnapshot(captureSoloSnapshot(state,player.id),"NEW",{...player,id:"new"})!;
  assert.deepEqual(restored.mixingChoices,{new:["catnip","lunar-fizz"]});
  assert.ok(restored.pausedAt!==null);
  const corrupt=JSON.parse(JSON.stringify(captureSoloSnapshot(state,player.id)));
  corrupt.state.activeKeepsake="infinite-coins";
  assert.equal(restoreSoloSnapshot(corrupt,"NEW",player),undefined);
});
test("seeded taverns visit all three themes and keep identical reachable floorplans",()=>{
  for(let seed=0;seed<20;seed++){
    const rooms=[1,2,3].map(round=>makeTavern(seed,round));assert.equal(new Set(rooms.map(room=>room.theme)).size,TAVERN_THEMES.length);
    assert.deepEqual(rooms[0].stations,rooms[1].stations);assert.deepEqual(rooms[1].stations,rooms[2].stations);
  }
});
test("the new full-room atlases have independent measured, bounded frames and correct chair contact",()=>{
  for(const layout of Object.values(THEME_TILES)){
    for(const frame of [layout.kitchen,layout.floor,layout.wall,layout.window,...layout.counters,layout.table,layout.chair,layout.stool,layout.prop,layout.rug,layout.cabinet,layout.lantern,layout.barrel,layout.notice]){
      assert.ok(frame.x>=0&&frame.y>=0&&frame.width>0&&frame.height>0&&frame.x+frame.width<=1254&&frame.y+frame.height<=1254);
    }
    assert.ok(layout.chairSeat>.5&&layout.chairSeat<.75);assert.ok(layout.stoolSeat>.15&&layout.stoolSeat<.3);
  }
});
