import { ingredientLabel, rawIngredient, type Player, type Station } from "./game.js";

export function usesCounterHandoff(player: Pick<Player, "drink">, station: Station) {
  return ["counter", "pantry", "mix"].includes(station.kind) &&
    (station.kind === "counter" || Boolean(station.drink || player.drink));
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
