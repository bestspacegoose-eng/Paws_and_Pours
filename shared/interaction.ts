import type { Player, Station } from "./game.js";

export function usesDrinkHandoff(player: Pick<Player, "drink">, station: Station) {
  return ["counter", "pantry", "mix"].includes(station.kind) &&
    (station.kind === "counter" || Boolean(station.drink || player.drink));
}

export function interactionLabel(player: Pick<Player, "drink">, station?: Station) {
  if (!station) return "Interact";
  if (usesDrinkHandoff(player, station)) return station.drink ? "Pick up drink" : player.drink ? "Place drink" : "Interact";
  switch (station.kind) {
    case "pantry": return `Take ${station.label}`;
    case "mix": return "Mix drink";
    case "chop": return station.preparedIngredient ? "Pick up tuna" : "Chop tuna";
    case "serve": case "seat": return "Serve drink";
    case "mop": return "Clean";
    case "trash": return "Discard";
    default: return "Interact";
  }
}
