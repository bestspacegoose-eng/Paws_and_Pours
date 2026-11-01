import { ingredientLabel, rawIngredient, type Player, type Station } from "./game.js";

export function usesCounterHandoff(player: Pick<Player, "drink">, station: Station) {
  return ["counter", "pantry", "mix"].includes(station.kind) &&
    (station.kind === "counter" || Boolean(station.drink || player.drink));
}

export function counterBlockReason(player: Player, station: Station, capacity = 3): string | undefined {
  if (station.counterIngredient) {
    if (player.drink) return "Counter occupied by an ingredient. Serve or set down your drink before picking it up.";
    if (player.carrying.includes(station.counterIngredient.ingredient)) return `Already carrying ${ingredientLabel(station.counterIngredient.ingredient)}. This ingredient stays on the counter.`;
    if (player.carrying.length >= capacity) return `Paws full (${capacity}/${capacity}). Leave an ingredient on a free counter first.`;
  }
  if (station.drink) {
    if (player.drink) return "Counter occupied by a drink. Use a free counter for yours.";
    if (player.carrying.length && capacity <= 3) return "Paws full for a drink. Set down your ingredients before picking it up.";
  }
}

export function interactionLabel(player: Pick<Player, "drink"> & Partial<Pick<Player,"carrying">>, station?: Station) {
  if (!station) return "Interact";
  if (usesCounterHandoff(player, station)) {
    if (station.counterIngredient) return `Pick up ${ingredientLabel(station.counterIngredient.ingredient)}`;
    if (station.drink) return "Pick up drink";
    if (player.drink) return "Place drink";
    const ingredient = player.carrying?.at(-1);
    return station.kind === "counter" && ingredient ? `Place ${ingredientLabel(ingredient)}` : "Interact";
  }
  switch (station.kind) {
    case "pantry": return `Take ${station.label}`;
    case "mix": return "Mix drink";
    case "chop": return station.preparedIngredient ? `Pick up ${rawIngredient(station.preparedIngredient)}` : "Chop ingredient";
    case "serve": case "seat": return "Serve drink";
    case "mop": return "Clean";
    case "trash": return "Discard";
    default: return "Interact";
  }
}
