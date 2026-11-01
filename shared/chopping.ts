import { CHOPPING_RECIPES, createMixingSession, mixingQuality, type GameState, type MixingSession, type Player, type Station } from "./game.js";
import { consumeRecipeIngredients, keepsakeEffects } from "./keepsakes.js";

export function choppingBoardBusy(state:GameState, stationId:string) {
  return Object.values(state.mixing).some(session=>session.kind === "chop" && session.stationId === stationId);
}
export function createChoppingSession(playerId:string, ingredient:string, stationId:string, now=Date.now()):MixingSession {
  const recipe=CHOPPING_RECIPES.find(recipe=>recipe.ingredients[0] === ingredient);
  if(!recipe)throw new Error("Ingredient cannot be chopped");
  return {...createMixingSession(playerId,recipe.id,now),kind:"chop",ingredient,stationId,stepIndex:1,
    usedIngredients:[ingredient],qualityPoints:1,feedback:`Chop ${ingredient} to the beat. Tap once, then follow the green window.`};
}
export function takeChoppedIngredient(player:Player,station:Station,capacity=3) {
  if(!station.preparedIngredient)return "empty";
  if(player.drink||player.carrying.length>=capacity||player.carrying.includes(station.preparedIngredient))return "full";
  player.carrying.push(station.preparedIngredient);
  player.ingredientQualities ??= {};
  player.ingredientQualities[station.preparedIngredient]=station.preparedQuality ?? 1;
  delete station.preparedIngredient;delete station.preparedQuality;
  return "picked-up";
}
export function openChoppingBoard(state:GameState,player:Player,station:Station,now=Date.now()) {
  if(station.kind!=="chop")return;
  if(choppingBoardBusy(state,station.id)){state.message="The chopping board is in use. Wait for the other bartender.";return;}
  if(station.preparedIngredient){
    const ingredient=station.preparedIngredient.replaceAll("-"," ");
    const result=takeChoppedIngredient(player,station,keepsakeEffects(state.activeKeepsake).carryCapacity);
    state.message=result==="picked-up"?`Picked up ${ingredient}. Ready for mixing.`:"Your paws are full. Make space before picking up the chopped ingredient.";return;
  }
  if(player.drink){state.message="Set down or serve your drink before chopping.";return;}
  const choices=CHOPPING_RECIPES.filter(recipe=>player.carrying.includes(recipe.ingredients[0]));
  if(!choices.length){state.message="Bring a cleaver-marked ingredient to the chopping board. Chop to the beat, then pick up the pieces.";return;}
  if(choices.length>1){state.mixingChoices ??={};state.mixingChoices[player.id]=choices.map(recipe=>recipe.id);state.message="Choose an ingredient to chop. The others stay in your paws.";}
  else {state.mixing[player.id]=createChoppingSession(player.id,choices[0].ingredients[0],station.id,now);state.message=`${player.name} is chopping ${choices[0].ingredients[0]}.`;}
  player.moving=false;
}
export function chooseChoppingIngredient(state:GameState,player:Player,station:Station,recipeId:string,now=Date.now()) {
  const recipe=CHOPPING_RECIPES.find(recipe=>recipe.id===recipeId);
  if(station.kind!=="chop"||station.preparedIngredient||choppingBoardBusy(state,station.id)||!recipe||!player.carrying.includes(recipe.ingredients[0])||!state.mixingChoices?.[player.id]?.includes(recipeId))return false;
  state.mixing[player.id]=createChoppingSession(player.id,recipe.ingredients[0],station.id,now);
  delete state.mixingChoices[player.id];player.moving=false;state.message=`${player.name} is chopping ${recipe.ingredients[0]}.`;return true;
}
export function finishChopping(state:GameState,player:Player,session:MixingSession) {
  const station=state.tavern.stations.find(station=>station.id===session.stationId&&station.kind==="chop");
  if(!station||station.preparedIngredient||!session.ingredient||!player.carrying.includes(session.ingredient))return false;
  station.preparedIngredient=`chopped-${session.ingredient}`;station.preparedQuality=mixingQuality(session);
  consumeRecipeIngredients(player,{ingredients:[session.ingredient]});delete state.mixing[player.id];player.moving=false;
  state.message=`${session.ingredient[0].toUpperCase()+session.ingredient.slice(1)} chopped! Interact at the board to pick up the pieces.`;return true;
}
