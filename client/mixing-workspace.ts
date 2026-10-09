import {
  expectedMixingStep, mixingStepsForRecipe, recipeById, type GameState,
  type MixingSession, type MixingTool, type Recipe, type RhythmAction, type Theme
} from "../shared/game";
import workspaceUrl from "./assets/tilemap/mixing-workspace.png";
import ingredientsUrl from "./assets/tilemap/ingredients-spritesheet.png";
import toolsUrl from "./assets/tilemap/mixing-tools-spritesheet.png";
import effectsUrl from "./assets/tilemap/mixing-effects-spritesheet.png";
import {
  atlasFrame, GLASS_FRAME_INDEX, INGREDIENT_FRAMES, MIXING_EFFECT_FRAME_INDEX,
  MIXING_TOOL_FRAME_INDEX, type FrameRect
} from "./sprite-frames";
import { drawRecipeDrink, onDrinkArtReady } from "./drink-art";
import { handMixFrame } from "./mixing-animation";
import "./mixing-workspace.css";

export interface MixingWorkspaceEvents {
  addIngredient: (ingredient: string) => void;
  startTool: (tool: MixingTool) => void;
  finishTool: (tool: MixingTool) => void;
  rhythmHit: (style: RhythmAction["style"], hand?: "left" | "right") => void;
  pause: () => void;
  cancel: () => void;
}

function image(source: string, onLoad: () => void) {
  const result = new Image();
  result.addEventListener("load", onLoad);
  result.src = source;
  return result;
}

export class MixingWorkspace {
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly title: HTMLElement;
  private readonly instruction: HTMLElement;
  private readonly timer: HTMLElement;
  private readonly mistakes: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly toolTiming: HTMLElement;
  private readonly toolTimingFill: HTMLElement;
  private readonly toolTimingTrack: HTMLElement;
  private readonly toolTimingLabel: HTMLElement;
  private readonly actions: HTMLElement;
  private readonly workspaceImage: HTMLImageElement;
  private readonly ingredientsImage: HTMLImageElement;
  private readonly toolsImage: HTMLImageElement;
  private readonly effectsImage: HTMLImageElement;
  private session?: MixingSession;
  private recipe?: Recipe;
  private playerIngredients: string[] = [];
  private theme: Theme = "Cozy Village Pub";
  private controlsKey = "";
  private toolHolding = false;
  private activeTool?: MixingTool;
  private toolHoldStartedAt?: number;
  private toolTimingFrame?: number;
  private rhythmTimingFrame?: number;
  private visualFrame?: number;
  private rhythmServerHitAt?: number;
  private rhythmLocalHitAt?: number;
  private pendingRhythmHitAt?: number;
  private cancelRequested = false;
  private paused = false;
  private outcome?: "success" | "failure";
  private outcomeRecipeId?: string;
  private outcomeTimer?: number;

  constructor(mount: HTMLElement, private readonly events: MixingWorkspaceEvents) {
    this.root = document.createElement("section");
    this.root.className = "mixing-workspace hidden";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-labelledby", "mixing-title");
    this.root.innerHTML = `
      <div class="mixing-shell">
        <header class="mixing-header">
          <div><p class="eyebrow">YOUR PRIVATE WORKBENCH · SHIFT CONTINUES</p><h2 id="mixing-title">Prepare the drink</h2></div>
          <div class="mixing-metrics"><span id="mixing-time">0:30</span><span id="mixing-mistakes">0 / 3 mistakes</span><button class="mixing-pause" type="button">Menu · Pause</button><button class="mixing-cancel" type="button">Cancel</button></div>
        </header>
        <div class="mixing-stage">
          <canvas width="800" height="480" aria-label="First-person drink mixing workbench"></canvas>
          <div class="mixing-status">
            <p id="mixing-instruction" aria-live="polite">Choose the first ingredient.</p>
            <div class="mixing-progress" aria-hidden="true"><i></i></div>
            <div class="tool-timing hidden" aria-live="polite">
              <div class="tool-timing-heading"><span>Hold timing</span><output>Ready</output></div>
              <div class="tool-timing-track" role="progressbar" aria-label="Tool hold timing" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i><b aria-hidden="true"></b></div>
            </div>
          </div>
        </div>
        <div class="mixing-actions" aria-label="Mixing actions"></div>
        <p class="mixing-help">Add ingredients in recipe order. Hold tools near the target time; for chopping or paw mixing, tap along with the beat.</p>
      </div>`;
    mount.append(this.root);
    this.canvas = this.root.querySelector("canvas")!;
    this.context = this.canvas.getContext("2d")!;
    this.context.imageSmoothingEnabled = false;
    this.title = this.root.querySelector("#mixing-title")!;
    this.instruction = this.root.querySelector("#mixing-instruction")!;
    this.timer = this.root.querySelector("#mixing-time")!;
    this.mistakes = this.root.querySelector("#mixing-mistakes")!;
    this.progress = this.root.querySelector(".mixing-progress i")!;
    this.toolTiming = this.root.querySelector(".tool-timing")!;
    this.toolTimingFill = this.root.querySelector(".tool-timing-track i")!;
    this.toolTimingTrack = this.root.querySelector(".tool-timing-track")!;
    this.toolTimingLabel = this.root.querySelector(".tool-timing output")!;
    this.actions = this.root.querySelector(".mixing-actions")!;
    this.root.querySelector<HTMLButtonElement>(".mixing-pause")!.onclick = () => this.events.pause();
    this.root.querySelector<HTMLButtonElement>(".mixing-cancel")!.onclick = () => {
      this.cancelRequested = true;
      this.stopToolTiming();
      this.events.cancel();
    };
    const redraw = () => this.draw();
    this.workspaceImage = image(workspaceUrl, redraw);
    this.ingredientsImage = image(ingredientsUrl, redraw);
    this.toolsImage = image(toolsUrl, redraw);
    this.effectsImage = image(effectsUrl, redraw);
    onDrinkArtReady(redraw);
    window.addEventListener("pointerup", () => this.finishTool());
  }

  isOpen() { return !this.root.classList.contains("hidden"); }

  render(state: GameState, playerId: string) {
    if (state.pausedAt !== null && !this.paused) {
      this.paused = true;
      this.toolHolding = false;
      this.activeTool = undefined;
      this.stopToolTiming();
      this.stopRhythmTiming();
      this.stopVisualAnimation();
      this.rhythmServerHitAt = undefined;
      this.rhythmLocalHitAt = undefined;
      this.pendingRhythmHitAt = undefined;
      this.root.classList.remove("tool-holding");
    } else if (state.pausedAt === null) this.paused = false;
    const session = state.mixing[playerId];
    const player = state.players[playerId];
    if (!session) {
      this.stopVisualAnimation();
      if (this.session) {
        const cancelled = this.cancelRequested;
        this.outcome = player?.drink ? "success" : "failure";
        this.outcomeRecipeId = player?.drink ?? this.recipe?.id;
        this.session = undefined;
        this.recipe = undefined;
        this.toolHolding = false;
        this.activeTool = undefined;
        this.stopToolTiming();
        this.stopRhythmTiming();
        this.rhythmServerHitAt = undefined;
        this.rhythmLocalHitAt = undefined;
        this.pendingRhythmHitAt = undefined;
        this.actions.innerHTML = "";
        this.controlsKey = "";
        this.cancelRequested = false;
        if (cancelled) {
          this.outcome = undefined;
          this.root.classList.add("hidden");
        } else {
          this.instruction.textContent = this.outcome === "success" ? "Drink complete — back to the tavern!" : "Mixing failed — back to the tavern.";
          this.draw();
          window.clearTimeout(this.outcomeTimer);
          this.outcomeTimer = window.setTimeout(() => {
            this.outcome = undefined;
            this.outcomeRecipeId = undefined;
            this.root.classList.add("hidden");
          }, 850);
        }
      } else if (!this.outcome) this.root.classList.add("hidden");
      return;
    }

    const justOpened = !this.session;
    window.clearTimeout(this.outcomeTimer);
    this.outcome = undefined;
    this.session = session;
    this.recipe = recipeById(session.recipeId);
    this.playerIngredients = player?.carrying ?? [];
    this.theme = state.tavern.theme;
    this.root.dataset.theme = state.tavern.theme;
    this.root.classList.remove("hidden");
    this.title.textContent = `Prepare ${this.recipe.name}`;
    this.instruction.textContent = session.feedback;
    this.timer.textContent = `0:${String(Math.max(0, Math.ceil((session.deadlineAt - Date.now()) / 1000))).padStart(2, "0")}`;
    this.mistakes.textContent = `${session.mistakes} / 3 mistakes`;
    const steps = mixingStepsForRecipe(this.recipe);
    this.progress.style.width = `${Math.min(100, session.stepIndex / steps.length * 100)}%`;
    this.configureToolTiming(expectedMixingStep(session));
    this.renderControls(justOpened);
    this.draw();
    this.syncVisualAnimation();
  }

  private syncVisualAnimation() {
    const action = this.session && expectedMixingStep(this.session);
    const animate = !this.paused && action?.kind === "rhythm" && action.style === "hand-mix" &&
      document.body.dataset.reducedMotion !== "true" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animate) { this.stopVisualAnimation(); return; }
    if (this.visualFrame !== undefined) return;
    const frame = () => {
      this.visualFrame = undefined;
      const next = this.session && expectedMixingStep(this.session);
      if (this.paused || !next || next.kind !== "rhythm" || next.style !== "hand-mix" || this.root.classList.contains("hidden")) return;
      this.draw();
      this.visualFrame = window.requestAnimationFrame(frame);
    };
    this.visualFrame = window.requestAnimationFrame(frame);
  }

  private stopVisualAnimation() {
    if (this.visualFrame !== undefined) window.cancelAnimationFrame(this.visualFrame);
    this.visualFrame = undefined;
  }

  private renderControls(focusFirst: boolean) {
    if (!this.session || !this.recipe) return;
    const expected = expectedMixingStep(this.session);
    const key = `${this.session.recipeId}:${this.session.stepIndex}:${this.playerIngredients.join("|")}`;
    if (key === this.controlsKey) { this.updateRhythmControls(expected); return; }
    this.controlsKey = key;
    this.actions.innerHTML = "";
    if (expected?.kind === "ingredient") {
      const used = [...this.session.usedIngredients];
      this.playerIngredients.forEach((ingredient) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "mixing-action ingredient-action";
        button.textContent = `Add ${ingredient}`;
        const usedIndex = used.indexOf(ingredient);
        if (usedIndex >= 0) {
          button.disabled = true;
          button.textContent = `${ingredient} added`;
          used.splice(usedIndex, 1);
        } else button.onclick = () => this.events.addIngredient(ingredient);
        this.actions.append(button);
      });
    } else if (expected?.kind === "timed-tool") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mixing-action tool-action";
      button.textContent = `Hold ${expected.tool} · ${(expected.targetMs / 1000).toFixed(1)} sec`;
      const start = (event: Event) => { event.preventDefault(); this.startTool(expected.tool); };
      const finish = (event: Event) => { event.preventDefault(); this.finishTool(); };
      button.addEventListener("pointerdown", start);
      button.addEventListener("pointerup", finish);
      button.addEventListener("pointercancel", finish);
      button.addEventListener("keydown", (event) => {
        if (event.key === " " || event.key === "Enter") start(event);
      });
      button.addEventListener("keyup", (event) => {
        if (event.key === " " || event.key === "Enter") finish(event);
      });
      this.actions.append(button);
    } else if (expected?.kind === "rhythm") {
      if (expected.style === "chop") {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "mixing-action rhythm-action";
        button.dataset.hand = "chop";
        button.onclick = () => this.sendRhythmHit("chop");
        this.actions.append(button);
      } else for (const hand of ["left", "right"] as const) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "mixing-action rhythm-action";
        button.dataset.hand = hand;
        button.onclick = () => this.sendRhythmHit("hand-mix", hand);
        this.actions.append(button);
      }
      this.updateRhythmControls(expected);
    }
    if (focusFirst) window.setTimeout(() => this.actions.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus(), 0);
  }

  private sendRhythmHit(style: RhythmAction["style"], hand?: "left" | "right") {
    if (this.paused) return;
    this.pendingRhythmHitAt = performance.now();
    this.events.rhythmHit(style, hand);
  }

  private updateRhythmControls(expected: ReturnType<typeof expectedMixingStep>) {
    if (!this.session || !expected || expected.kind !== "rhythm") return;
    this.actions.querySelectorAll<HTMLButtonElement>(".rhythm-action").forEach((button) => {
      const nextHand = this.session!.rhythmHits % 2 === 0 ? "left" : "right";
      const selected = expected.style === "chop" || button.dataset.hand === nextHand;
      button.classList.toggle("rhythm-next", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.textContent = expected.style === "chop"
        ? `Chop ${expected.ingredient} · ${this.session!.rhythmHits}/${expected.hits}`
        : `${button.dataset.hand === "left" ? "Left" : "Right"} paw · ${this.session!.rhythmHits}/${expected.hits}`;
    });
  }

  private startTool(tool: MixingTool) {
    if (this.paused) return;
    const expected = this.session && expectedMixingStep(this.session);
    if (this.toolHolding || !expected || expected.kind !== "timed-tool" || expected.tool !== tool) return;
    this.toolHolding = true;
    this.activeTool = tool;
    this.toolHoldStartedAt = performance.now();
    this.root.classList.add("tool-holding");
    this.updateToolTiming(expected);
    this.events.startTool(tool);
    this.draw();
  }

  private finishTool() {
    if (this.paused) return;
    if (!this.toolHolding || !this.activeTool) return;
    const tool = this.activeTool;
    this.toolHolding = false;
    this.activeTool = undefined;
    this.stopToolTiming();
    this.root.classList.remove("tool-holding");
    this.events.finishTool(tool);
    this.draw();
  }

  private configureToolTiming(expected: ReturnType<typeof expectedMixingStep>) {
    this.stopRhythmTiming();
    if (!expected || (expected.kind !== "timed-tool" && expected.kind !== "rhythm")) {
      this.toolTiming.classList.add("hidden");
      return;
    }
    this.toolTiming.classList.remove("hidden");
    const target = expected.kind === "timed-tool" ? expected.targetMs : expected.intervalMs;
    const maximum = target + expected.toleranceMs * 1.5;
    const toPercent = (milliseconds: number) => Math.max(0, Math.min(100, milliseconds / maximum * 100));
    this.toolTimingTrack.style.setProperty("--target", `${toPercent(target)}%`);
    this.toolTimingTrack.style.setProperty("--sweet-start", `${toPercent(target - expected.toleranceMs)}%`);
    this.toolTimingTrack.style.setProperty("--sweet-end", `${toPercent(target + expected.toleranceMs)}%`);
    this.toolTimingTrack.setAttribute("aria-label", expected.kind === "rhythm" ? "Preparation beat timing" : "Tool hold timing");
    this.root.querySelector(".tool-timing-heading span")!.textContent = expected.kind === "rhythm" ? "Next beat" : "Hold timing";
    if (expected.kind === "rhythm") {
      if (this.session?.rhythmHits && this.session.rhythmLastHitAt) {
        if (this.rhythmServerHitAt !== this.session.rhythmLastHitAt) {
          this.rhythmServerHitAt = this.session.rhythmLastHitAt;
          this.rhythmLocalHitAt = this.pendingRhythmHitAt ?? performance.now();
          this.pendingRhythmHitAt = undefined;
        }
        this.updateRhythmTiming(expected);
      }
      else {
        this.rhythmServerHitAt = undefined;
        this.rhythmLocalHitAt = undefined;
        this.pendingRhythmHitAt = undefined;
        this.toolTimingFill.style.width = "0%";
        this.toolTimingFill.dataset.phase = "ready";
        this.toolTimingTrack.setAttribute("aria-valuenow", "0");
        this.toolTimingLabel.textContent = `Tap once to start · ${(target / 1000).toFixed(2)} sec beat`;
      }
      return;
    }
    if (!this.toolHolding) {
      this.toolTimingFill.style.width = "0%";
      this.toolTimingFill.dataset.phase = "ready";
      this.toolTimingTrack.setAttribute("aria-valuenow", "0");
      this.toolTimingLabel.textContent = `Aim for ${(expected.targetMs / 1000).toFixed(1)} sec`;
    }
  }

  private updateRhythmTiming(action: RhythmAction) {
    if (!this.session?.rhythmLastHitAt || this.rhythmLocalHitAt === undefined || expectedMixingStep(this.session) !== action) return;
    const elapsed = performance.now() - this.rhythmLocalHitAt;
    const maximum = action.intervalMs + action.toleranceMs * 1.5;
    const percent = Math.max(0, Math.min(100, elapsed / maximum * 100));
    const phase = Math.abs(elapsed - action.intervalMs) <= action.toleranceMs ? "sweet" : elapsed < action.intervalMs ? "early" : "late";
    this.toolTimingFill.style.width = `${percent}%`;
    this.toolTimingFill.dataset.phase = phase;
    this.toolTimingTrack.setAttribute("aria-valuenow", String(Math.round(percent)));
    this.toolTimingLabel.textContent = `${this.session.rhythmHits}/${action.hits} · ${phase === "sweet" ? "tap now!" : phase === "early" ? "wait for the beat" : "beat missed"}`;
    if (action.style !== "hand-mix") this.draw();
    this.rhythmTimingFrame = window.requestAnimationFrame(() => this.updateRhythmTiming(action));
  }

  private stopRhythmTiming() {
    if (this.rhythmTimingFrame !== undefined) window.cancelAnimationFrame(this.rhythmTimingFrame);
    this.rhythmTimingFrame = undefined;
  }

  private updateToolTiming(action: Extract<ReturnType<typeof expectedMixingStep>, { kind: "timed-tool" }>) {
    if (!this.toolHolding || !this.toolHoldStartedAt) return;
    const elapsed = performance.now() - this.toolHoldStartedAt;
    const maximum = action.targetMs + action.toleranceMs * 2;
    const percent = Math.max(0, Math.min(100, elapsed / maximum * 100));
    const accuracy = Math.abs(elapsed - action.targetMs);
    const phase = accuracy <= action.toleranceMs ? "sweet" : elapsed < action.targetMs ? "early" : "late";
    this.toolTimingFill.style.width = `${percent}%`;
    this.toolTimingFill.dataset.phase = phase;
    this.toolTimingTrack.setAttribute("aria-valuenow", String(Math.round(percent)));
    this.toolTimingLabel.textContent = `${(elapsed / 1000).toFixed(1)} sec · ${phase === "sweet" ? "sweet spot" : phase === "early" ? "keep holding" : "release now"}`;
    if (action.tool === "shaker") this.draw();
    this.toolTimingFrame = window.requestAnimationFrame(() => this.updateToolTiming(action));
  }

  private stopToolTiming() {
    if (this.toolTimingFrame !== undefined) window.cancelAnimationFrame(this.toolTimingFrame);
    this.toolTimingFrame = undefined;
    this.toolHoldStartedAt = undefined;
  }

  private draw() {
    const context = this.context;
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.workspaceImage.complete && this.workspaceImage.naturalWidth) {
      context.drawImage(this.workspaceImage, 0, 0, this.canvas.width, this.canvas.height);
    } else {
      context.fillStyle = "#5a3342";
      context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    const tint = this.theme === "Haunted Moonlit Inn" ? "rgba(90,68,170,.22)" :
      this.theme === "Pirate Cat Tavern" ? "rgba(0,110,125,.16)" : "rgba(238,142,66,.06)";
    context.fillStyle = tint;
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.outcome) {
      this.drawAtlasContained(this.effectsImage, 3, 2, MIXING_EFFECT_FRAME_INDEX[this.outcome], 400, 280, 260, 230);
      if (this.outcome === "success" && this.outcomeRecipeId) this.drawFinishedDrink(this.outcomeRecipeId, 400, 280);
      return;
    }
    if (!this.session || !this.recipe) return;

    const steps = mixingStepsForRecipe(this.recipe);
    const expected = expectedMixingStep(this.session);
    this.drawAtlasContained(this.effectsImage, 3, 2, MIXING_EFFECT_FRAME_INDEX.multiplayer, 64, 70, 88, 78, 0.82);
    this.drawAtlasContained(this.toolsImage, 3, 2, GLASS_FRAME_INDEX[this.recipe.glass] ?? 3, 400, 214, 126, 150, 0.92);

    const positions = this.playerIngredients.length === 1 ? [400] : this.playerIngredients.length === 2 ? [300, 500] : [210, 400, 590];
    this.playerIngredients.forEach((ingredient, index) => {
      const used = this.session!.usedIngredients.filter((item) => item === ingredient).length;
      const occurrences = this.playerIngredients.slice(0, index + 1).filter((item) => item === ingredient).length;
      this.drawIngredient(ingredient, positions[index] ?? 400, 335, used >= occurrences ? 0.32 : 1);
    });

    if (expected?.kind === "timed-tool") {
      if (this.toolHolding && expected.tool === "shaker") {
        const shake = performance.now() / 52;
        context.save();
        context.translate(400 + Math.sin(shake * 2.7) * 7, 310 + Math.cos(shake * 4.1) * 3);
        context.rotate(Math.sin(shake * 3.3) * .16);
        this.drawAtlasContained(this.toolsImage, 3, 2, MIXING_TOOL_FRAME_INDEX[expected.tool], 0, 0, 190, 172);
        context.restore();
      } else {
        this.drawAtlasContained(this.toolsImage, 3, 2, MIXING_TOOL_FRAME_INDEX[expected.tool], 400, 310, 190, 172);
      }
    } else if (expected?.kind === "rhythm") {
      this.drawRhythmAction(expected);
    }
    this.drawAtlasContained(
      this.effectsImage, 3, 2,
      this.toolHolding ? MIXING_EFFECT_FRAME_INDEX.activePaws : MIXING_EFFECT_FRAME_INDEX.paws,
      400, 432, 300, 154
    );
    this.drawAtlasContained(this.effectsImage, 3, 2, MIXING_EFFECT_FRAME_INDEX.progress, 720, 78, 62, 62, 0.9);

    context.fillStyle = "rgba(31,17,38,.8)";
    context.fillRect(640, 105, 120, 8);
    context.fillStyle = this.recipe.color;
    context.fillRect(640, 105, 120 * Math.min(1, this.session.stepIndex / steps.length), 8);
  }

  private drawRhythmAction(action: RhythmAction) {
    const context = this.context;
    context.save();
    if (action.style === "chop") {
      context.fillStyle = "#3b2332"; context.fillRect(318, 280, 164, 83);
      context.fillStyle = "#b57953"; context.fillRect(324, 284, 152, 73);
      context.fillStyle = "#d79b65"; context.fillRect(331, 290, 138, 57);
      const pieces = Math.max(1, this.session?.rhythmHits ?? 0);
      for (let index = 0; index < pieces; index++) {
        context.fillStyle = this.recipe?.color ?? "#8ee17a";
        context.fillRect(352 + index * 28, 314 + (index % 2) * 9, 19, 12);
        context.fillStyle = "#f6dda9"; context.fillRect(354 + index * 28, 315 + (index % 2) * 9, 5, 4);
      }
      const bounce = this.rhythmLocalHitAt !== undefined && performance.now() - this.rhythmLocalHitAt < 150 ? 8 : 0;
      context.fillStyle = "#34233c"; context.fillRect(399, 273 - bounce, 72, 12);
      context.fillStyle = "#f2c57d"; context.fillRect(402, 276 - bounce, 55, 6);
      context.fillStyle = "#454c66"; context.fillRect(356, 285 - bounce, 51, 12);
      context.fillStyle = "#d8e5e7"; context.fillRect(356, 286 - bounce, 47, 7);
      context.fillStyle = "#fff8d9"; context.fillRect(359, 287 - bounce, 39, 2);
    } else {
      const lastHitAt = this.pendingRhythmHitAt ?? this.rhythmLocalHitAt;
      const reducedMotion = document.body.dataset.reducedMotion === "true" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const pose = handMixFrame(performance.now(), lastHitAt, reducedMotion);
      context.translate(pose.bowlX, pose.bowlY);
      context.fillStyle = "rgba(28,16,38,.35)"; context.fillRect(342 - pose.bowlX, 346 - pose.bowlY, 116, 7);
      context.fillStyle = "#35243a";
      context.fillRect(351, 278, 98, 7); context.fillRect(339, 285, 122, 27);
      context.fillRect(347, 312, 106, 20); context.fillRect(359, 332, 82, 14);
      context.fillStyle = "#b98263";
      context.fillRect(345, 287, 110, 21); context.fillRect(353, 308, 94, 19); context.fillRect(365, 327, 70, 13);
      context.fillStyle = "#e1ac78"; context.fillRect(350, 289, 100, 5);
      context.fillStyle = "#4b3448"; context.fillRect(352, 294, 96, 17);
      context.fillStyle = this.recipe?.color ?? "#a9dbc4";
      context.fillRect(357 + pose.liquidX, 296, 86, 13); context.fillRect(364 - pose.liquidX, 309, 72, 5);
      const left = (this.session?.rhythmHits ?? 0) % 2 === 0;
      context.fillStyle = "#f6d09c";
      context.fillRect(302 + pose.leftPawX, 290, 26, 29);
      context.fillRect(467 - pose.rightPawX, 290, 26, 29);
      context.fillStyle = "#d98f93";
      context.fillRect(310 + pose.leftPawX, 296, 11, 10);
      context.fillRect(475 - pose.rightPawX, 296, 11, 10);
      context.fillStyle = "#fff0cd";
      context.fillRect((left ? 308 + pose.leftPawX : 473 - pose.rightPawX), 311, 15, 5);
      context.fillStyle = "#fff2cf"; context.fillRect(386 + pose.liquidX, 301, 26, 3); context.fillRect(407 - pose.liquidX, 304, 3, 9);
    }
    context.restore();
  }

  private drawIngredient(ingredient: string, x: number, y: number, alpha: number) {
    const frame = INGREDIENT_FRAMES[ingredient];
    if (!frame || !this.ingredientsImage.complete || !this.ingredientsImage.naturalWidth) return;
    this.drawFrameContained(this.ingredientsImage, frame, x, y, 118, 112, alpha);
  }

  private drawAtlasContained(image: HTMLImageElement, columns: number, rows: number, index: number, x: number, y: number, width: number, height: number, alpha = 1) {
    if (!image.complete || !image.naturalWidth) return;
    this.drawFrameContained(image, atlasFrame(image, columns, rows, index), x, y, width, height, alpha);
  }

  private drawFinishedDrink(recipeId: string, x: number, y: number) {
    drawRecipeDrink(this.context, recipeById(recipeId), x, y, 150);
  }

  private drawFrameContained(image: HTMLImageElement, frame: FrameRect, x: number, y: number, width: number, height: number, alpha = 1) {
    const scale = Math.min(width / frame.width, height / frame.height);
    const drawWidth = frame.width * scale;
    const drawHeight = frame.height * scale;
    this.context.save();
    this.context.globalAlpha = alpha;
    this.context.drawImage(image, frame.x, frame.y, frame.width, frame.height, x - drawWidth / 2, y - drawHeight / 2, drawWidth, drawHeight);
    this.context.restore();
  }
}
