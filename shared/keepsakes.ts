import type { GameState, KeepsakeId, Recipe } from "./game.js";

const ids = ["swift-paws", "patient-patrons", "lucky-whiskers", "bottomless-bag", "nine-lives"] as const;
export const isKeepsakeId = (value: unknown): value is KeepsakeId =>
  typeof value === "string" && (ids as readonly string[]).includes(value);

export function keepsakeEffects(id?: KeepsakeId) {
  return {
    movementMultiplier: id === "swift-paws" ? 1.2 : 1,
    carryCapacity: id === "bottomless-bag" ? 4 : 3,
    patienceBonus: id === "patient-patrons" ? 12 : 0,
    perfectDrinkBonus: id === "lucky-whiskers" ? 2 : 0
  };
}

// A selection replaces the prior shift's effect. Healing happens only here,
// never when reading an effect or restoring a saved game.
export function applyKeepsake(state: GameState, id: KeepsakeId) {
  state.activeKeepsake = id;
  state.orderPatienceBonus = keepsakeEffects(id).patienceBonus;
  if (id === "nine-lives") state.health = Math.min(3, state.health + 1);
}

export function keepsakeSummary(id: KeepsakeId) {
  return {
    "swift-paws": "Swift Paws · Speed +20%",
    "patient-patrons": "Patient Patrons · Patience +12s",
    "lucky-whiskers": "Lucky Whiskers · Perfect drinks +2",
    "bottomless-bag": "Bottomless Bag · 4 ingredient slots",
    "nine-lives": "Nine Lives · Heart recovered"
  }[id];
}

export function servingReward(patienceQuality: number, preparationQuality: number, id?: KeepsakeId) {
  const bonus = preparationQuality >= .88 ? keepsakeEffects(id).perfectDrinkBonus : 0;
  const tip = Math.max(3, (patienceQuality > .6 ? 8 : 5) + (preparationQuality >= .88 ? 2 : preparationQuality < .45 ? -2 : 0));
  return { tip: tip + bonus, bonus, reputation: patienceQuality * .6 + preparationQuality * .4 > .6 ? 2 : 1 };
}

export function remainingIngredients(carried: string[], recipe: Pick<Recipe, "ingredients">) {
  const remaining = [...carried];
  for (const ingredient of recipe.ingredients) {
    const index = remaining.indexOf(ingredient);
    if (index >= 0) remaining.splice(index, 1);
  }
  return remaining;
}
