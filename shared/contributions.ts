import type { Player } from "./game.js";

// Ownership follows actual work. Passing an item back and forth does not
// create contributors, so a counter cannot be used to farm teamwork.
export function contributors(...groups: (string[] | undefined)[]): string[] {
  return [...new Set(groups.flatMap(group => group ?? []))].filter(id => typeof id === "string" && id.length > 0).slice(0, 4);
}
export function ingredientContributors(player: Player, ingredient: string) {
  return player.ingredientContributors?.[ingredient] ?? [player.id];
}
export function drinkContributors(player: Player, ingredients: string[]) {
  return contributors(...ingredients.map(ingredient => ingredientContributors(player, ingredient)), [player.id]);
}
