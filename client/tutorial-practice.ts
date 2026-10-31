import { openChoppingBoard, chooseChoppingIngredient, finishChopping } from "../shared/chopping";
import {
  addMixingIngredient, createMixingSession, expectedMixingStep, mixingQuality,
  nearbyStation, pauseShift, recipeById, recipesForCarriedIngredients, resumeShift,
  rhythmTimingAccepted, rhythmTimingQuality, servingOrderIndex, toolTimingAccepted,
  toolTimingQuality, transferCounterDrink, type GameState, type MixingSession
} from "../shared/game";
import { applyKeepsake, isKeepsakeId, keepsakeEffects, keepsakeSummary, consumeRecipeIngredients, servingReward } from "../shared/keepsakes";
import { usesDrinkHandoff } from "../shared/interaction";

// Isolated rehearsal: the real recipes and timing rules, no socket, save writes,
// shift clock, guest expiry, or automatic tutorial advancement.
export class TutorialPractice {
  private walked = 0;
  constructor(readonly state: GameState, readonly playerId: string) {}
  noteMovement(distance: number) {
    const before = this.walked; this.walked += distance;
    return before < 28 && this.walked >= 28 ? "Nice footwork. Explore, then choose Next when ready." : undefined;
  }
  dispatch(action: string, payload?: unknown, now = Date.now()) {
    const state = this.state, player = state.players[this.playerId];
    if (!player || state.code !== "TUTORIAL") return;
    if (action === "set-pause") {
      if (payload === true) pauseShift(state, player.id, now); else resumeShift(state, now);
      state.message = payload ? "Practice paused. Resume whenever you’re ready." : "Back to practice. The shift clock stays frozen.";
      return;
    }
    if (action === "choose-upgrade" && isKeepsakeId(payload) && state.upgrades.some(upgrade => upgrade.id === payload)) {
      applyKeepsake(state, payload); state.message = `${keepsakeSummary(payload)}. This is your practice choice.`; return;
    }
    if (state.pausedAt !== null) return;
    if (action === "cancel-mixing") {
      delete state.mixing[player.id]; if (state.mixingChoices) delete state.mixingChoices[player.id];
      state.message = "Ingredients kept. You can return to the workbench."; return;
    }
    if (action === "mix-recipe-select" && typeof payload === "string" && state.mixingChoices?.[player.id]?.includes(payload)) {
      const station=nearbyStation(state.tavern,player);
      if(station?.kind === "chop"){chooseChoppingIngredient(state,player,station,payload,now);return;}
      state.mixing[player.id] = createMixingSession(player.id, payload, now); delete state.mixingChoices[player.id]; return;
    }
    const session = state.mixing[player.id];
    if (session) {
      const expected = expectedMixingStep(session);
      if (action === "mix-ingredient" && typeof payload === "string") {
        if (addMixingIngredient(session, player.carrying, payload, player.ingredientQualities)) {
          session.feedback = expectedMixingStep(session)?.kind === "ingredient" ? "Good. Add the other ingredients in any order." : "All ingredients added. Try the highlighted preparation button.";
          state.message = "That’s it. Your ingredients are going into the drink.";
        } else this.retry(session, "That ingredient is already added or isn’t needed.");
      } else if (action === "mix-tool-start" && expected?.kind === "timed-tool" && expected.tool === payload) {
        session.toolStartedAt ??= now; session.feedback = "Hold until the green window, then release.";
        state.message = session.feedback;
      } else if (action === "mix-tool-finish" && expected?.kind === "timed-tool" && expected.tool === payload && session.toolStartedAt !== undefined) {
        const elapsed = now - session.toolStartedAt; session.toolStartedAt = undefined;
        if (toolTimingAccepted(elapsed, expected)) { session.qualityPoints += toolTimingQuality(elapsed, expected); session.stepIndex++; this.advance(session); }
        else this.retry(session, elapsed < expected.targetMs ? "A little soon. Try holding until the green window." : "A little long. Release near the target line.");
      } else if (action === "mix-rhythm-hit" && expected?.kind === "rhythm") {
        const hit = payload as { style?: string; hand?: string } | undefined;
        const elapsed = session.rhythmLastHitAt === undefined ? undefined : now - session.rhythmLastHitAt;
        if (hit?.style !== expected.style || (expected.style === "hand-mix" && hit.hand !== (session.rhythmHits % 2 === 0 ? "left" : "right"))) {
          this.retry(session, "Follow the highlighted paw, alternating left and right.");
        } else if (elapsed !== undefined && !rhythmTimingAccepted(elapsed, expected)) {
          this.retry(session, "Wait for the green beat window. You can try again.");
        } else {
          session.rhythmHits++; session.rhythmLastHitAt = now;
          if (elapsed !== undefined) session.rhythmQualityPoints += rhythmTimingQuality(elapsed, expected);
          if (session.rhythmHits >= expected.hits) {
            session.qualityPoints += (1 + session.rhythmQualityPoints) / expected.hits;
            session.stepIndex++; session.rhythmHits = 0; session.rhythmLastHitAt = undefined; session.rhythmQualityPoints = 0;
            this.advance(session);
          } else { session.feedback = `Good beat · ${session.rhythmHits}/${expected.hits}. Follow the next green window.`; state.message = "Good beat. Keep following the highlighted button."; }
        }
      }
      return;
    }
    if (action !== "interact" && action !== "counter-drink") return;
    const station = nearbyStation(state.tavern, player);
    if (!station) { state.message = "Walk closer to a station, then interact."; return; }
    const capacity = keepsakeEffects(state.activeKeepsake).carryCapacity;
    if (action === "counter-drink" || usesDrinkHandoff(player, station)) {
      const result = transferCounterDrink(player, station, capacity);
      state.message = result === "placed" ? "Drink placed. Interact again to pick it up." : result === "picked-up" ? "Drink picked up, with its quality preserved." : "Find an empty preparation surface for your drink.";
    } else if (station.kind === "pantry" && station.ingredient) {
      if (player.carrying.includes(station.ingredient)) state.message = "You already have that ingredient. Try another shelf.";
      else if (player.carrying.length >= capacity) state.message = "Your paws are full. Bring the ingredients to a mixing counter.";
      else { player.carrying.push(station.ingredient); state.message = `${station.ingredient} collected. You can see it in your paws.`; }
    } else if (station.kind === "chop") {
      openChoppingBoard(state,player,station,now);
    } else if (station.kind === "mix") {
      const recipes = recipesForCarriedIngredients(player.carrying);
      if (recipes.length === 1) { state.mixing[player.id] = createMixingSession(player.id, recipes[0].id, now); state.message = "Workbench open. Try adding your ingredients."; }
      else if (recipes.length > 1) state.mixingChoices = { [player.id]: recipes.map(recipe => recipe.id) };
      else state.message = "Gather a recipe’s three ingredients before mixing. Reset can restock this practice step.";
    } else if (station.kind === "serve" || station.kind === "seat") {
      const index = player.drink ? servingOrderIndex(state.tavern, state.orders, station, player.drink) : -1;
      if (index >= 0) {
        const [order] = state.orders.splice(index, 1), reward = servingReward(1, player.drinkQuality ?? 1, state.activeKeepsake);
        state.coins += reward.tip; state.reputation += reward.reputation; player.score += reward.tip;
        player.drink = undefined; player.drinkQuality = undefined;
        state.message = `${order.customer} loves it! +${reward.tip} practice coins.`;
      } else state.message = "Match the drink and guest on the ticket. Your drink stays in your paws.";
    } else if (station.kind === "mop") {
      state.hazard = null; state.message = "All clean! You can clear a spill from the cleaning sink.";
    } else if (station.kind === "trash") {
      player.carrying = []; player.drink = undefined; player.drinkQuality = undefined;
      state.message = "Paws empty. The guest’s order stays on the board.";
    }
    player.moving = false;
  }
  private retry(session: MixingSession, message: string) {
    session.toolStartedAt = undefined; session.rhythmHits = 0; session.rhythmLastHitAt = undefined; session.rhythmQualityPoints = 0;
    session.feedback = message; this.state.message = `${message} Practice has unlimited retries.`;
  }
  private advance(session: MixingSession) {
    if (expectedMixingStep(session)) { session.feedback = "Nicely done. Try the next highlighted preparation step."; this.state.message = session.feedback; return; }
    const player = this.state.players[this.playerId], recipe = recipeById(session.recipeId);
    if(session.kind === "chop"){finishChopping(this.state,player,session);return;}
    player.drink = recipe.id; player.drinkQuality = mixingQuality(session);
    consumeRecipeIngredients(player,recipe); delete this.state.mixing[this.playerId];
    this.state.message = `${recipe.name} ready! Choose Next whenever you’re ready.`;
  }
}
