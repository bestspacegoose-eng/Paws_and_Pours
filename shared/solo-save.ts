import { keepsakeEffects, isKeepsakeId } from "./keepsakes.js";
import { createChoppingSession } from "./chopping.js";
import { CHOPPING_RECIPES, INGREDIENTS, isChoppedIngredient, recipeById, TAVERN_THEMES, recipesForCarriedIngredients, nearbyStation, createMixingSession, initialState, makeTavern, mixingStepsForRecipe, PLAYER_SPAWNS, pointCollidesWithCounters, RECIPES, UPGRADES, type GameState, type Player } from "./game.js";

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
    if (saved.activeKeepsake !== undefined && !isKeepsakeId(saved.activeKeepsake)) return;
    const activeKeepsake = saved.activeKeepsake ?? (saved.orderPatienceBonus === 12 ? "patient-patrons" : undefined);
    const source = saved.players?.[snapshot.playerId];
    const ingredients = new Set(RECIPES.flatMap((recipe) => recipe.ingredients).concat(INGREDIENTS));
    const validRecipe = (id: unknown) => typeof id === "string" && RECIPES.some((recipe) => recipe.id === id);
    if (!source || !Array.isArray(source.carrying) || source.carrying.length > keepsakeEffects(activeKeepsake).carryCapacity || source.carrying.some((item) => !ingredients.has(item)) ||
        (source.drink !== undefined && !validRecipe(source.drink))) return;
    const state = initialState(code, player.id, saved.tavern.seed);
    state.tavern = makeTavern(saved.tavern.seed, saved.round);
    if (TAVERN_THEMES.includes(saved.tavern.theme)) state.tavern.theme = saved.tavern.theme;
    Object.assign(state, { round: saved.round, phase: saved.phase, coins: saved.coins, reputation: saved.reputation,
      health: saved.health, shiftSeconds: saved.shiftSeconds, activeKeepsake, orderPatienceBonus: keepsakeEffects(activeKeepsake).patienceBonus });
    state.upgrades = UPGRADES.filter((upgrade) => saved.upgrades?.some((entry) => entry.id === upgrade.id));
    const assigned = new Set<string>();
    for (const order of saved.orders) {
      if (!validRecipe(order.recipeId) || !finite(order.patience, 0, 2000) || !finite(order.maxPatience, 1, 2000) ||
          typeof order.customer !== "string" || !state.tavern.stations.some((station) => station.id === order.tableId && station.kind === "serve")) return;
      // Old saves had one order per table and no seat ID. Assign a real free seat.
      const seat = state.tavern.stations.find(station => station.kind === "seat" && station.tableId === order.tableId &&
        (order.seatId === undefined || station.id === order.seatId) && !assigned.has(station.id));
      if (!seat) return;
      assigned.add(seat.id);
      state.orders.push({ id: `restored-${state.orders.length}`, tableId: order.tableId, seatId: seat.id, recipeId: order.recipeId,
        customer: order.customer.slice(0, 60), patience: order.patience, maxPatience: order.maxPatience });
    }
    for (const station of state.tavern.stations) {
      const old = saved.tavern.stations?.find((candidate) => candidate.id === station.id);
      if (old?.drink && ["counter", "mix", "pantry"].includes(station.kind) && validRecipe(old.drink.recipeId) && finite(old.drink.quality, 0, 1)) station.drink = { ...old.drink };
      if (station.kind === "chop" && old?.preparedIngredient && isChoppedIngredient(old.preparedIngredient)) {
        station.preparedIngredient = old.preparedIngredient;
        station.preparedQuality = finite(old.preparedQuality,0,1)?old.preparedQuality:1;
      }
    }
    const position = finite(source.x, 10, 918) && finite(source.y, 10, 628) && !pointCollidesWithCounters(state.tavern, source) ? { x: source.x, y: source.y } : PLAYER_SPAWNS[0];
    state.players[player.id] = { ...player, ...position, carrying: [...source.carrying], ingredientQualities:Object.fromEntries(Object.entries(source.ingredientQualities??{}).filter(([ingredient,quality])=>source.carrying.includes(ingredient)&&isChoppedIngredient(ingredient)&&finite(quality,0,1))), drink: source.drink,
      drinkQuality: finite(source.drinkQuality, 0, 1) ? source.drinkQuality : undefined, score: finite(source.score, 0, 1e7) ? source.score : 0, moving: false };
    const oldMix = saved.mixing?.[snapshot.playerId];
    const board = state.tavern.stations.find(station=>station.kind === "chop")!;
    const validChop = oldMix?.kind === "chop" && oldMix.stationId === board.id && !board.preparedIngredient &&
      nearbyStation(state.tavern,state.players[player.id])?.id === board.id &&
      CHOPPING_RECIPES.some(recipe=>recipe.id===oldMix.recipeId&&recipe.ingredients[0]===oldMix.ingredient);
    if (oldMix && (validRecipe(oldMix.recipeId) || validChop)) {
      const recipe = recipeById(oldMix.recipeId);
      const remaining = oldMix.deadlineAt - (saved.pausedAt ?? snapshot.savedAt);
      if (recipe.ingredients.every(ingredient=>source.carrying.includes(ingredient)) && finite(remaining, 1, 45000) && finite(oldMix.stepIndex, 0, mixingStepsForRecipe(recipe).length - 1) && Number.isInteger(oldMix.stepIndex) &&
          Array.isArray(oldMix.usedIngredients) && oldMix.usedIngredients.length <= 3 && oldMix.usedIngredients.every((item) => recipe.ingredients.includes(item))) {
        const mixing = validChop?createChoppingSession(player.id,oldMix.ingredient!,board.id,now):createMixingSession(player.id, recipe.id, now);
        Object.assign(mixing, { stepIndex: oldMix.stepIndex, usedIngredients: [...oldMix.usedIngredients],
          deadlineAt: now + remaining, mistakes: finite(oldMix.mistakes, 0, 2) ? oldMix.mistakes : 0,
          qualityPoints: finite(oldMix.qualityPoints, 0, 10) ? oldMix.qualityPoints : 0,
          feedback: "Save loaded. Continue preparing; restart any interrupted tool action." });
        state.mixing[player.id] = mixing;
      }
    }
    if (!state.mixing[player.id] && saved.mixingChoices?.[snapshot.playerId]) {
      const station=nearbyStation(state.tavern,state.players[player.id]);
      const choices=station?.kind === "mix"?recipesForCarriedIngredients(source.carrying):station?.kind === "chop"&&!station.preparedIngredient?CHOPPING_RECIPES.filter(recipe=>source.carrying.includes(recipe.ingredients[0])):[];
      if(choices.length>1)state.mixingChoices = { [player.id]:choices.map(recipe=>recipe.id) };
    }
    if (saved.hazard && ["napkins", "fire", "ectoplasm"].includes(saved.hazard.kind) && finite(saved.hazard.x, 10, 918) && finite(saved.hazard.y, 10, 628))
      state.hazard = { id: "restored-hazard", kind: saved.hazard.kind, x: saved.hazard.x, y: saved.hazard.y, message: String(saved.hazard.message).slice(0, 100) };
    if (state.phase === "shift") { state.pausedAt = now; state.pausedBy = player.id; }
    state.message = "Local save loaded. Resume when you are ready.";
    return state;
  } catch { return undefined; }
}
