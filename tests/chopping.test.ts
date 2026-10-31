import test from "node:test";
import assert from "node:assert/strict";
import { CHOPPING_RECIPES, RECIPES, addMixingIngredient, createMixingSession, expectedMixingStep, gridCellCenter, initialState, isChoppedIngredient, rawIngredient, recipesForCarriedIngredients, type Player } from "../shared/game.js";
import { chooseChoppingIngredient, createChoppingSession, finishChopping, openChoppingBoard, takeChoppedIngredient } from "../shared/chopping.js";
import { captureSoloSnapshot, restoreSoloSnapshot } from "../shared/solo-save.js";
import { mobileTutorialLesson } from "../client/tutorial-mobile.js";
import { TUTORIAL_STEPS } from "../client/tutorial-content.js";
const player=(id="cat",carrying:string[]=[]):Player=>({id,name:id,role:"Tabby",fur:"#e5a265",accessory:"Bow tie",...gridCellCenter(2,5),direction:"down",moving:false,moveSequence:0,carrying,connected:true,score:0});

test("only ingredients that require board preparation get the cleaver badge",()=>{
  const badges=Object.fromEntries(RECIPES.map(recipe=>[recipe.id,recipe.ingredients.filter(isChoppedIngredient).map(rawIngredient)]));
  assert.deepEqual(badges,{catnip:[],moonmilk:[],tuna:["tuna"],"lunar-fizz":["lime"],"kelp-swirl":[],"star-spritz":["lime"],"seafoam-shake":["tuna","kelp"]});
  assert.ok(RECIPES.every(recipe=>recipe.preparation.actions.every(action=>action.kind!=="rhythm"||action.style!=="chop")));
  assert.ok(CHOPPING_RECIPES.every(recipe=>recipe.preparation.actions[0].kind==="rhythm"&&recipe.preparation.actions[0].style==="chop"));
  assert.deepEqual(recipesForCarriedIngredients(["moonmilk","lime","fizz"]),[]);
  assert.equal(recipesForCarriedIngredients(["moonmilk","chopped-lime","fizz"])[0]?.id,"lunar-fizz");
  assert.equal(recipesForCarriedIngredients(["catnip","lime","fizz"])[0]?.id,"catnip");
});
test("all three raw ingredients open a real chopping session and retain other ingredients",()=>{
  for(const recipe of CHOPPING_RECIPES){
    const raw=recipe.ingredients[0],state=initialState("TEST","cat",42),cat=player("cat",[raw,"cream"]);state.players.cat=cat;
    const board=state.tavern.stations.find(station=>station.kind==="chop")!;
    openChoppingBoard(state,cat,board,1000);assert.equal(state.mixing.cat.kind,"chop");assert.equal(expectedMixingStep(state.mixing.cat)?.kind,"rhythm");assert.equal(board.preparedIngredient,undefined);
    assert.deepEqual(cat.carrying,[raw,"cream"]);Object.assign(state.mixing.cat,{stepIndex:2,qualityPoints:1.8});
    assert.ok(finishChopping(state,cat,state.mixing.cat));assert.deepEqual(cat.carrying,["cream"]);assert.equal(board.preparedIngredient,`chopped-${raw}`);assert.equal(board.preparedQuality,.9);
    assert.equal(takeChoppedIngredient(cat,board),"picked-up");assert.equal(cat.ingredientQualities?.[`chopped-${raw}`],.9);assert.equal(takeChoppedIngredient(cat,board),"empty");
  }
});
test("the shared board is reserved while chopping and never overwrites an existing pickup",()=>{
  const state=initialState("TEST","cat",42),a=player("cat",["tuna"]),b=player("guest",["lime"]),board=state.tavern.stations.find(station=>station.kind==="chop")!;
  state.players={cat:a,guest:b};openChoppingBoard(state,a,board);openChoppingBoard(state,b,board);
  assert.equal(state.mixing.guest,undefined);assert.deepEqual(b.carrying,["lime"]);assert.match(state.message,/in use/);
  Object.assign(state.mixing.cat,{stepIndex:2,qualityPoints:2});finishChopping(state,a,state.mixing.cat);
  b.carrying=["lime","cream","tonic"];openChoppingBoard(state,b,board);assert.equal(board.preparedIngredient,"chopped-tuna");assert.equal(state.mixing.guest,undefined);
});
test("multiple ingredients offer a choice and reject unavailable or forged choices",()=>{
  const state=initialState("TEST","cat",42),cat=player("cat",["tuna","kelp","cream"]),board=state.tavern.stations.find(station=>station.kind==="chop")!;state.players.cat=cat;
  openChoppingBoard(state,cat,board);assert.deepEqual(state.mixingChoices?.cat,["chop-tuna","chop-kelp"]);
  assert.equal(chooseChoppingIngredient(state,cat,board,"chop-lime"),false);assert.equal(chooseChoppingIngredient(state,cat,board,"catnip"),false);
  assert.equal(chooseChoppingIngredient(state,cat,board,"chop-kelp"),true);assert.equal(state.mixing.cat.ingredient,"kelp");assert.equal(state.mixingChoices?.cat,undefined);
});
test("chopping accuracy remains part of the drink's preparation quality",()=>{
  const recipe=RECIPES.find(recipe=>recipe.id==="lunar-fizz")!,session=createMixingSession("cat",recipe.id);
  for(const ingredient of recipe.ingredients)addMixingIngredient(session,recipe.ingredients,ingredient,{"chopped-lime":.5});
  assert.equal(session.qualityPoints,2.5);
});
test("chopping sessions, shared pickups, and carried quality survive solo save/resume",()=>{
  const state=initialState("OLD","old",42),cat=player("old",["lime","cream"]);state.phase="shift";state.players.old=cat;
  state.mixing.old=createChoppingSession("old","lime","chop",1000);
  let restored=restoreSoloSnapshot(captureSoloSnapshot(state,"old",2000),"NEW",player("new"),5000)!;
  assert.equal(restored.mixing.new.kind,"chop");assert.equal(restored.mixing.new.stationId,"chop");assert.equal(restored.mixing.new.deadlineAt,49000);assert.equal(restored.pausedAt,5000);
  delete state.mixing.old;const board=state.tavern.stations.find(station=>station.kind==="chop")!;board.preparedIngredient="chopped-kelp";board.preparedQuality=.83;
  cat.carrying=["chopped-lime"];cat.ingredientQualities={"chopped-lime":.9};
  restored=restoreSoloSnapshot(captureSoloSnapshot(state,"old"),"NEW",player("new"))!;
  assert.equal(restored.tavern.stations.find(station=>station.kind==="chop")?.preparedQuality,.83);assert.deepEqual(restored.players.new.ingredientQualities,{"chopped-lime":.9});
});
test("phone lessons are concise without changing the laptop narration",()=>{
  for(const step of TUTORIAL_STEPS){const mobile=mobileTutorialLesson(step);assert.ok(mobile.body.length<=125,step.id);assert.ok(mobile.title.length<=25,step.id);assert.ok(step.body.length>0);}
});
