import { createMixingSession, initialState, makeTavern, mixingStepsForRecipe, PLAYER_SPAWNS, pointCollidesWithCounters, RECIPES, UPGRADES, type GameState, type Player } from "./game.js";

export interface SoloSnapshot {
  version: 1;
  savedAt: number;
  state: GameState;
  playerId: string;
}

export function captureSoloSnapshot(state: GameState, playerId: string, now = Date.now()): SoloSnapshot {
  return { version: 1, savedAt: now, playerId, state: structuredClone(state) };
}

// Import only known gameplay fields into a fresh, private room. Stored room/player
// identities and arbitrary station geometry must never become network authority.
export function restoreSoloSnapshot(input: unknown, code: string, player: Player, now = Date.now()): GameState | undefined {
  try {
    const snapshot = input as SoloSnapshot, saved = snapshot?.state;
    if (snapshot.version !== 1 || !saved || !Number.isFinite(snapshot.savedAt)) return;
    const finite = (value: unknown, min: number, max: number): value is number => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
    if (!finite(saved.round, 1, 100) || !Number.isInteger(saved.round) || !finite(saved.tavern?.seed, 0, 2 ** 31) ||
        !finite(saved.coins, 0, 1e7) || !finite(saved.reputation, 0, 1e7) || !finite(saved.health, 0, 3) ||
        !finite(saved.shiftSeconds, 0, 180) || !["lobby", "shift", "upgrades", "complete"].includes(saved.phase) ||
        !finite(saved.orderPatienceBonus, 0, 1200) || !Array.isArray(saved.orders) || saved.orders.length > 4) return;
    const source = saved.players?.[snapshot.playerId];
    const ingredients = new Set(RECIPES.flatMap((recipe) => recipe.ingredients).concat("tuna"));
    const validRecipe = (id: unknown) => typeof id === "string" && RECIPES.some((recipe) => recipe.id === id);
    if (!source || !Array.isArray(source.carrying) || source.carrying.length > 3 || source.carrying.some((item) => !ingredients.has(item)) ||
        (source.drink !== undefined && !validRecipe(source.drink))) return;
    const state = initialState(code, player.id, saved.tavern.seed);
    state.tavern = makeTavern(saved.tavern.seed, saved.round);
    Object.assign(state, { round: saved.round, phase: saved.phase, coins: saved.coins, reputation: saved.reputation,
      health: saved.health, shiftSeconds: saved.shiftSeconds, orderPatienceBonus: saved.orderPatienceBonus });
    state.upgrades = UPGRADES.filter((upgrade) => saved.upgrades?.some((entry) => entry.id === upgrade.id));
    const assigned = new Set<string>();
    for (const order of saved.orders) {
      if (!validRecipe(order.recipeId) || !finite(order.patience, 0, 2000) || !finite(order.maxPatience, 1, 2000) ||
          typeof order.customer !== "string" || !state.tavern.stations.some((station) => station.id === order.tableId && station.kind === "serve") || assigned.has(order.tableId!)) return;
      assigned.add(order.tableId!);
      state.orders.push({ id: `restored-${state.orders.length}`, tableId: order.tableId, recipeId: order.recipeId,
        customer: order.customer.slice(0, 60), patience: order.patience, maxPatience: order.maxPatience });
    }
    for (const station of state.tavern.stations) {
      const old = saved.tavern.stations?.find((candidate) => candidate.id === station.id);
      if (old?.drink && ["counter", "mix", "pantry"].includes(station.kind) && validRecipe(old.drink.recipeId) && finite(old.drink.quality, 0, 1)) station.drink = { ...old.drink };
      if (station.kind === "chop" && old?.preparedIngredient === "chopped-tuna") station.preparedIngredient = "chopped-tuna";
    }
    const position = finite(source.x, 10, 918) && finite(source.y, 10, 628) && !pointCollidesWithCounters(state.tavern, source) ? { x: source.x, y: source.y } : PLAYER_SPAWNS[0];
    state.players[player.id] = { ...player, ...position, carrying: [...source.carrying], drink: source.drink,
      drinkQuality: finite(source.drinkQuality, 0, 1) ? source.drinkQuality : undefined, score: finite(source.score, 0, 1e7) ? source.score : 0, moving: false };
    const oldMix = saved.mixing?.[snapshot.playerId];
    if (oldMix && validRecipe(oldMix.recipeId)) {
      const recipe = RECIPES.find((entry) => entry.id === oldMix.recipeId)!;
      const remaining = oldMix.deadlineAt - (saved.pausedAt ?? snapshot.savedAt);
      if (finite(remaining, 1, 45000) && finite(oldMix.stepIndex, 0, mixingStepsForRecipe(recipe).length - 1) && Number.isInteger(oldMix.stepIndex) &&
          Array.isArray(oldMix.usedIngredients) && oldMix.usedIngredients.length <= 3 && oldMix.usedIngredients.every((item) => recipe.ingredients.includes(item))) {
        const mixing = createMixingSession(player.id, recipe.id, now);
        Object.assign(mixing, { stepIndex: oldMix.stepIndex, usedIngredients: [...oldMix.usedIngredients],
          deadlineAt: now + remaining, mistakes: finite(oldMix.mistakes, 0, 2) ? oldMix.mistakes : 0,
          qualityPoints: finite(oldMix.qualityPoints, 0, 10) ? oldMix.qualityPoints : 0,
          feedback: "Save loaded. Continue preparing; restart any interrupted tool action." });
        state.mixing[player.id] = mixing;
      }
    }
    if (saved.hazard && ["napkins", "fire", "ectoplasm"].includes(saved.hazard.kind) && finite(saved.hazard.x, 10, 918) && finite(saved.hazard.y, 10, 628))
      state.hazard = { id: "restored-hazard", kind: saved.hazard.kind, x: saved.hazard.x, y: saved.hazard.y, message: String(saved.hazard.message).slice(0, 100) };
    if (state.phase === "shift") { state.pausedAt = now; state.pausedBy = player.id; }
    state.message = "Local save loaded. Resume when you are ready.";
    return state;
  } catch { return undefined; }
}
