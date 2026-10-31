import test from "node:test";
import assert from "node:assert/strict";
import { tutorialState, TUTORIAL_STEPS, tutorialControls, tutorialPlaysGame } from "../client/tutorial-content.js";
import { TutorialPractice } from "../client/tutorial-practice.js";
import { expectedMixingStep, gridCellCenter, createMixingSession, recipeById } from "../shared/game.js";
import { shiftMusicRate, approachMusicRate } from "../client/music-tempo.js";
const profile={name:"Practice cat",role:"Tabby" as const,fur:"#3366ee",accessory:"Bow tie"};
const setup=(scene:Parameters<typeof tutorialState>[2])=>{const state=tutorialState("cat",profile,scene);return {state,player:state.players.cat,practice:new TutorialPractice(state,"cat")};};

test("the music gently accelerates only during the last 30 seconds and caps at 40 percent",()=>{
  assert.equal(shiftMusicRate("shift",180),1);assert.equal(shiftMusicRate("shift",30),1);
  assert.ok(shiftMusicRate("shift",25)>1.14);assert.ok(shiftMusicRate("shift",15)>1.33);
  assert.equal(shiftMusicRate("shift",5),1.4);assert.equal(shiftMusicRate("shift",-10),1.4);
  for(const phase of ["lobby","upgrades","complete"] as const)assert.equal(shiftMusicRate(phase,0),1);
  assert.equal(shiftMusicRate("shift",NaN),1);
  let previous=1;for(let seconds=180;seconds>=0;seconds--){const rate=shiftMusicRate("shift",seconds);assert.ok(rate>=previous&&rate<=1.4);previous=rate;}
  for(const hz of [30,60,144]){let rate=1;for(let frame=0;frame<hz;frame++)rate=approachMusicRate(rate,1.4,1000/hz);assert.ok(Math.abs(rate-1.14)<1e-9);}
  assert.ok(Math.abs(approachMusicRate(1.4,1,100000)-1.386)<1e-10);
});
test("tutorial practice uses real gathering, chopping, mixing, handoffs and serving without a running shift clock",()=>{
  const pantry=setup("pantry");pantry.practice.dispatch("interact");assert.deepEqual(pantry.player.carrying,["lime"]);
  const chop=setup("chop");chop.practice.dispatch("interact",undefined,1000);assert.deepEqual(chop.player.carrying,["tuna"]);
  for(let i=0;i<3;i++)chop.practice.dispatch("mix-rhythm-hit",{style:"chop"},2000+i*650);
  assert.deepEqual(chop.player.carrying,[]);chop.practice.dispatch("interact");assert.deepEqual(chop.player.carrying,["chopped-tuna"]);
  const mixer=setup("mixer");mixer.practice.dispatch("interact",undefined,1000);assert.equal(mixer.state.mixing.cat.recipeId,"catnip");
  for(const ingredient of ["fizz","catnip","lime"])mixer.practice.dispatch("mix-ingredient",ingredient,1000);
  assert.equal(expectedMixingStep(mixer.state.mixing.cat)?.kind,"timed-tool");
  mixer.practice.dispatch("mix-tool-start","shaker",2000);mixer.practice.dispatch("mix-tool-finish","shaker",3800);
  assert.equal(mixer.player.drink,"catnip");assert.equal(mixer.player.drinkQuality,1);assert.equal(mixer.state.shiftSeconds,180);
  const handoff=setup("handoff");handoff.practice.dispatch("interact");assert.equal(handoff.player.drink,undefined);handoff.practice.dispatch("interact");assert.equal(handoff.player.drink,"catnip");
  const serve=setup("serve");serve.practice.dispatch("interact");assert.equal(serve.state.orders.length,0);assert.equal(serve.player.drink,undefined);assert.equal(serve.state.coins,10);assert.equal(serve.state.health,3);
  const clean=setup("tidy");Object.assign(clean.player,gridCellCenter(1,9));clean.practice.dispatch("interact");assert.equal(clean.state.hazard,null);
});
test("practice timed tools allow unlimited meaningful retries, and cancelled ingredients are kept",()=>{
  for(const recipeId of ["catnip","moonmilk","tuna"]){
    const {state,practice,player}=setup("timed"), recipe=recipeById(recipeId);
    state.mixing.cat=createMixingSession("cat",recipeId,0);Object.assign(state.mixing.cat,{stepIndex:3,usedIngredients:[...recipe.ingredients],qualityPoints:3});player.carrying=[...recipe.ingredients];
    const expected=expectedMixingStep(state.mixing.cat);if(expected?.kind!=="timed-tool")throw new Error("tool expected");
    for(let i=0;i<5;i++){practice.dispatch("mix-tool-start",expected.tool,1000);practice.dispatch("mix-tool-finish",expected.tool,1100);}
    assert.ok(state.mixing.cat);assert.equal(state.health,3);assert.equal(state.mixing.cat.mistakes,0);assert.equal(player.carrying.length,3);
    practice.dispatch("mix-tool-start",expected.tool,10000);practice.dispatch("mix-tool-finish",expected.tool,10000+expected.targetMs);assert.equal(player.drink,recipeId);assert.equal(player.drinkQuality,1);
  }
  const cancelled=setup("ingredients");cancelled.practice.dispatch("mix-ingredient","catnip");cancelled.practice.dispatch("cancel-mixing");assert.equal(cancelled.state.mixing.cat,undefined);assert.equal(cancelled.player.carrying.length,3);
});
test("practice rhythm uses the actual beat windows and alternate-paw rules",()=>{
  for(const scene of ["chop-beat","paw-beat"] as const){
    const {state,practice,player}=setup(scene);const expected=expectedMixingStep(state.mixing.cat);if(expected?.kind!=="rhythm")throw new Error("rhythm expected");
    for(let i=0;i<expected.hits;i++)practice.dispatch("mix-rhythm-hit",{style:expected.style,hand:i%2?"right":"left"},1000+i*expected.intervalMs);
    if(scene==="paw-beat"){assert.equal(player.drink,"kelp-swirl");assert.equal(player.drinkQuality,1);}else {assert.equal(state.mixing.cat,undefined);assert.equal(state.tavern.stations.find(station=>station.kind==="chop")?.preparedIngredient,"chopped-lime");}
  }
});
test("practice changes cannot mutate another scene or its saved real shift",()=>{
  const original=setup("ingredients"),before=structuredClone(original.state),separate=setup("ingredients");
  separate.practice.dispatch("mix-ingredient","catnip");assert.deepEqual(original.state,before);
  const pause=setup("move");pause.practice.dispatch("set-pause",true,1000);assert.equal(pause.state.pausedAt,1000);pause.practice.dispatch("set-pause",false,5000);assert.equal(pause.state.pausedAt,null);assert.equal(pause.state.shiftSeconds,180);
  assert.equal(pause.practice.noteMovement(14),undefined);assert.ok(pause.practice.noteMovement(14));assert.equal(pause.practice.noteMovement(30),undefined);
  for(const step of TUTORIAL_STEPS){assert.ok(!tutorialControls(step).includes("#leave-game"));if(tutorialPlaysGame(step))assert.ok(tutorialControls(step).includes(".touch-interact"));}
});
