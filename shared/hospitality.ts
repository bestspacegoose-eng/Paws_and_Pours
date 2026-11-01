import { isChoppedIngredient, RECIPES, type GameState, type Order, type Player, type PreparedDrink } from "./game.js";
import { contributors } from "./contributions.js";

export interface BartenderWork { name: string; gathered: number; chopped: number; mixed: number; served: number }
export interface ShiftStats {
  served: number; perfect: number; specials: number; teamwork: number; soloSpecials: number;
  coinsEarned: number; missed: number; hazardsCleaned: number; qualityTotal: number;
  bartenders: Record<string, BartenderWork>;
}
export interface ShiftReport { round: number; theme: string; stats: ShiftStats; celebrationCount: number; health: number; completed: boolean }
export interface HospitalityState {
  warmth: number; celebrationCount: number; celebrationUntil?: number;
  stats: ShiftStats; lastShift?: ShiftReport;
}
export const WARMTH_TARGET = 3;
export const HOUSE_SPECIAL_BONUS = 4;
export const CELEBRATION_BONUS = 6;
export function freshShiftStats(): ShiftStats {
  return { served:0,perfect:0,specials:0,teamwork:0,soloSpecials:0,coinsEarned:0,missed:0,hazardsCleaned:0,qualityTotal:0,bartenders:{} };
}
export function hospitalityFor(state: GameState): HospitalityState {
  return state.hospitality ??= { warmth:0,celebrationCount:0,stats:freshShiftStats() };
}
export function startHospitalityShift(state: GameState) {
  const previous = state.hospitality?.lastShift;
  state.hospitality = { warmth:0,celebrationCount:0,stats:freshShiftStats(),lastShift:previous };
}
export function recordWork(state: GameState, player: Player, action: "gathered" | "chopped" | "mixed" | "served") {
  const stats = hospitalityFor(state).stats;
  const work = stats.bartenders[player.id] ??= {name:player.name,gathered:0,chopped:0,mixed:0,served:0};
  work.name = player.name; work[action]++;
}
export function designateHouseSpecial(order: Order, sequence: number, round: number, elapsed: number): Order {
  if (sequence % 3 !== 0) return order;
  const tier = Math.min(2, Math.max(0, round - 1) + Math.floor(Math.max(0, elapsed) / 90));
  const choices = RECIPES.filter(recipe => recipe.tier <= tier && recipe.ingredients.some(isChoppedIngredient));
  const recipe = choices[Math.floor(sequence / 3 - 1) % choices.length];
  return { ...order, recipeId:recipe.id, houseSpecial:true, patience:order.patience+20, maxPatience:order.maxPatience+20 };
}
export function specialReward(order: Order, drink: PreparedDrink, serverId: string, solo: boolean) {
  if (!order.houseSpecial) return {bonus:0,method:undefined};
  const team = contributors(drink.contributors, [serverId]);
  const method = solo ? (drink.quality >= .88 ? "accuracy" as const : undefined) :
    (team.length >= 2 ? "teamwork" as const : undefined);
  return { bonus:method ? HOUSE_SPECIAL_BONUS : 0, method };
}
export function recordServedDrink(state: GameState, player: Player, order: Order, drink: PreparedDrink, coins: number, solo: boolean, now = Date.now()) {
  const hospitality = hospitalityFor(state), stats = hospitality.stats;
  const reward = specialReward(order, drink, player.id, solo);
  stats.served++; stats.qualityTotal += drink.quality;
  if (drink.quality >= .88) stats.perfect++;
  if (order.houseSpecial) stats.specials++;
  if (reward.method === "teamwork") stats.teamwork++;
  if (reward.method === "accuracy") stats.soloSpecials++;
  recordWork(state,player,"served");
  let celebration = false;
  if (reward.bonus) {
    hospitality.warmth++;
    if (hospitality.warmth >= WARMTH_TARGET) {
      hospitality.warmth = 0; hospitality.celebrationCount++;
      hospitality.celebrationUntil = now + 4200; celebration = true;
    }
  }
  const total = coins + reward.bonus + (celebration ? CELEBRATION_BONUS : 0);
  stats.coinsEarned += total;
  state.coins += total; player.score += total;
  return { ...reward, total, celebration };
}
export function finishHospitalityShift(state: GameState, completed: boolean) {
  const hospitality = hospitalityFor(state);
  hospitality.lastShift = {round:state.round,theme:state.tavern.theme,stats:structuredClone(hospitality.stats),
    celebrationCount:hospitality.celebrationCount,health:state.health,completed};
}
export function shiftAdvice(stats: ShiftStats) {
  if (stats.missed) return "Serve the shortest patience bar first. Leave prepared ingredients on counters to share the work.";
  if (!stats.served) return "Start with one ticket: gather its ingredients, prepare the marked ones, then mix and serve.";
  if (stats.perfect < stats.served) return "Release tools near the target line and follow the beat to earn more perfect-drink tips.";
  if (!stats.teamwork && !stats.soloSpecials) return "Try a House Special next shift: share the preparation, or aim for perfect accuracy in solo.";
  return "Keep that rhythm: divide gathering, preparation, and service as the next tavern gets busier.";
}

// Solo saves import counters and counts, never other players' authority or
// contributor identities. A resumed solo drink still earns its accuracy bonus.
export function restoreHospitality(input: unknown, oldId: string, player: Player): HospitalityState | undefined {
  if (!input || typeof input !== "object") return;
  const value = input as HospitalityState;
  const count = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= 1e6;
  const stats = (source: ShiftStats | undefined): ShiftStats | undefined => {
    if (!source || ![source.served,source.perfect,source.specials,source.teamwork,source.soloSpecials,source.coinsEarned,source.missed,source.hazardsCleaned].every(count) ||
        source.perfect > source.served || source.specials > source.served || source.teamwork + source.soloSpecials > source.specials ||
        !Number.isFinite(source.qualityTotal) || source.qualityTotal < 0 || source.qualityTotal > source.served) return;
    const result = freshShiftStats();
    for (const key of ["served","perfect","specials","teamwork","soloSpecials","coinsEarned","missed","hazardsCleaned","qualityTotal"] as const) result[key] = source[key];
    const old = source.bartenders?.[oldId];
    if (old && [old.gathered,old.chopped,old.mixed,old.served].every(count)) result.bartenders[player.id] = {name:player.name,gathered:old.gathered,chopped:old.chopped,mixed:old.mixed,served:old.served};
    return result;
  };
  const current = stats(value.stats);
  if (!current || !count(value.warmth) || value.warmth >= WARMTH_TARGET || !count(value.celebrationCount)) return;
  const result: HospitalityState = {warmth:value.warmth,celebrationCount:value.celebrationCount,stats:current};
  if (value.lastShift) {
    const last = value.lastShift, previous = stats(last.stats);
    if (!previous || !count(last.round) || last.round < 1 || typeof last.theme !== "string" || last.theme.length > 60 ||
        !count(last.celebrationCount) || !count(last.health) || last.health > 3 || typeof last.completed !== "boolean") return;
    result.lastShift = {round:last.round,theme:last.theme,stats:previous,celebrationCount:last.celebrationCount,health:last.health,completed:last.completed};
  }
  return result;
}
