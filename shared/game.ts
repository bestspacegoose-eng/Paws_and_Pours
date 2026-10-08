export type Theme = "Cozy Village Pub" | "Haunted Moonlit Inn" | "Pirate Cat Tavern";
export type CatRole = "Tabby" | "Siamese" | "Maine Coon" | "Black Cat" | "Calico";
export type FacingDirection = "down" | "left" | "right" | "up";
export type StationKind = "pantry" | "mix" | "serve" | "mop" | "trash";
export type Phase = "lobby" | "shift" | "upgrades" | "complete";
export type CounterVariant = "standard" | "end-cap" | "corner" | "ingredient" | "mixing" | "decorative" | "damaged";
export type MixingTool = "shaker" | "spoon" | "pourer";
export type HazardKind = "napkins" | "ectoplasm" | "fire";

export interface Vec { x: number; y: number }
export interface GridCell { gridX: number; gridY: number }
export interface Station extends Vec, GridCell {
  id: string; kind: StationKind; label: string; counterVariant: CounterVariant; ingredient?: string
}
export interface TimedToolAction {
  kind: "timed-tool"; tool: MixingTool; targetMs: number; toleranceMs: number
}
export interface RhythmAction {
  kind: "rhythm"; style: "chop" | "hand-mix"; hits: number; intervalMs: number; toleranceMs: number; ingredient?: string
}
export type PreparationAction = TimedToolAction | RhythmAction;
export type MixingStep = { kind: "ingredient"; ingredient: string } | PreparationAction;
export interface Recipe {
  id: string; name: string; ingredients: string[]; color: string; glass: string;
  tier: 0 | 1 | 2; preparation: { actions: PreparationAction[] }
}
export interface MixingSession {
  playerId: string; recipeId: string; stepIndex: number; mistakes: number;
  startedAt: number; deadlineAt: number; qualityPoints: number;
  usedIngredients: string[]; toolStartedAt?: number; rhythmHits: number;
  rhythmLastHitAt?: number; rhythmQualityPoints: number; feedback: string
}
export interface Order { id: string; recipeId: string; customer: string; patience: number; maxPatience: number }
export interface Hazard extends Vec { id: string; kind: HazardKind; message: string }
export interface Player {
  id: string; name: string; role: CatRole; fur: string; accessory: string;
  x: number; y: number; direction: FacingDirection; moving: boolean; moveSequence: number;
  carrying: string[]; drink?: string; drinkQuality?: number; connected: boolean; score: number
}
export interface Tavern { seed: number; theme: Theme; stations: Station[]; decoration: string[] }
export interface Upgrade { id: string; title: string; body: string }
export interface GameState {
  code: string; hostId: string; phase: Phase; players: Record<string, Player>; tavern: Tavern;
  orders: Order[]; mixing: Record<string, MixingSession>; shiftSeconds: number; coins: number;
  reputation: number; health: number; round: number; hazard: Hazard | null;
  upgrades: Upgrade[]; orderPatienceBonus: number; message: string;
  pausedAt: number | null; pausedBy: string | null
}

// The playable floor is a trapezoid in the 2.5D scene. The previous rectangular
// bound started above the floor, which let cats travel through the rear wall.
export const BOARD_BOUNDS = { minX: 32, maxX: 768, minY: 155, maxY: 442 } as const;
// This origin lands counter centres on the first visible row of floor tiles.
// The prior origin started the top station row on the rear wall artwork.
export const GRID_ORIGIN = { x: 48, y: 110 } as const;
export const GRID_CELL_SIZE = 58;
export const GRID_COLUMNS = 12;
export const GRID_ROWS = 5;
// A cat's contact point is its paws, not the full width of its animated sprite.
export const PLAYER_COLLISION_RADIUS = 10;
export const MIXING_DURATION_MS = 45_000;
export const MIXING_MAX_MISTAKES = 3;

export const RECIPES: Recipe[] = [
  {
    id: "catnip", name: "Catnip Cooler", ingredients: ["catnip", "lime", "fizz"],
    color: "#8ee17a", glass: "tall", tier: 0,
    preparation: { actions: [{ kind: "timed-tool", tool: "shaker", targetMs: 1_800, toleranceMs: 500 }] }
  },
  {
    id: "moonmilk", name: "Moonmilk Latte", ingredients: ["moonmilk", "cream", "stardust"],
    color: "#ddd5ff", glass: "mug", tier: 0,
    preparation: { actions: [{ kind: "timed-tool", tool: "spoon", targetMs: 2_200, toleranceMs: 550 }] }
  },
  {
    id: "tuna", name: "Tuna Tonic", ingredients: ["tuna", "tonic", "kelp"],
    color: "#7bd8d1", glass: "goblet", tier: 0,
    preparation: { actions: [{ kind: "timed-tool", tool: "pourer", targetMs: 1_500, toleranceMs: 450 }] }
  },
  {
    id: "lunar-fizz", name: "Lunar Fizz", ingredients: ["moonmilk", "lime", "fizz"],
    color: "#bcb2ed", glass: "tall", tier: 1,
    preparation: { actions: [
      { kind: "rhythm", style: "chop", ingredient: "lime", hits: 3, intervalMs: 650, toleranceMs: 270 },
      { kind: "timed-tool", tool: "shaker", targetMs: 1_600, toleranceMs: 430 }
    ] }
  },
  {
    id: "kelp-swirl", name: "Kelp Swirl", ingredients: ["kelp", "cream", "tonic"],
    color: "#a9dbc4", glass: "goblet", tier: 1,
    preparation: { actions: [
      { kind: "rhythm", style: "hand-mix", hits: 4, intervalMs: 700, toleranceMs: 290 }
    ] }
  },
  {
    id: "star-spritz", name: "Star Spritz", ingredients: ["stardust", "lime", "tonic"],
    color: "#dbc1f2", glass: "tall", tier: 2,
    preparation: { actions: [
      { kind: "rhythm", style: "chop", ingredient: "lime", hits: 4, intervalMs: 570, toleranceMs: 220 },
      { kind: "timed-tool", tool: "pourer", targetMs: 1_750, toleranceMs: 380 }
    ] }
  },
  {
    id: "seafoam-shake", name: "Seafoam Shake", ingredients: ["tuna", "kelp", "cream"],
    color: "#86c9be", glass: "mug", tier: 2,
    preparation: { actions: [
      { kind: "rhythm", style: "chop", ingredient: "kelp", hits: 3, intervalMs: 560, toleranceMs: 210 },
      { kind: "rhythm", style: "hand-mix", hits: 4, intervalMs: 610, toleranceMs: 230 }
    ] }
  }
];
export const INGREDIENTS = ["catnip", "lime", "fizz", "moonmilk", "cream", "stardust", "tuna", "tonic", "kelp"];
export const UPGRADES: Upgrade[] = [
  { id: "swift-paws", title: "Swift Paws", body: "+20% movement speed next shift" },
  { id: "patient-patrons", title: "Patient Patrons", body: "+12 patience on all orders" },
  { id: "lucky-whiskers", title: "Lucky Whiskers", body: "+2 bonus coins per perfect pour" },
  { id: "bottomless-bag", title: "Bottomless Bag", body: "Carry four ingredients at once" },
  { id: "nine-lives", title: "Nine Lives", body: "Restore one team heart (up to three)" }
];

export function mulberry32(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function gridCellCenter(gridX: number, gridY: number): Vec {
  return {
    x: GRID_ORIGIN.x + gridX * GRID_CELL_SIZE + GRID_CELL_SIZE / 2,
    y: GRID_ORIGIN.y + gridY * GRID_CELL_SIZE + GRID_CELL_SIZE / 2
  };
}

function counterVariantForPantry(index: number): CounterVariant {
  if (index === 0 || index === 4 || index === 5 || index === 8) return "corner";
  if (index === 1 || index === 3 || index === 6) return "end-cap";
  if (index === 7) return "standard";
  return "ingredient";
}

export function makeTavern(seed: number, round = 1): Tavern {
  const random = mulberry32(seed + round * 997);
  const themes: Theme[] = ["Cozy Village Pub", "Haunted Moonlit Inn", "Pirate Cat Tavern"];
  const theme = themes[Math.floor(random() * themes.length)];
  const leftOffset = random() > 0.5 ? 1 : 0;
  const pantryCells = INGREDIENTS.map((_ingredient, index): GridCell => index < 5
    ? { gridX: leftOffset + index, gridY: 1 }
    : { gridX: leftOffset + index - 5, gridY: 3 });
  const ingredientTable = INGREDIENTS.map((ingredient, index): Station => ({
    id: `ingredient-${ingredient}`,
    kind: "pantry",
    label: ingredient,
    ingredient,
    counterVariant: counterVariantForPantry(index),
    ...pantryCells[index],
    ...gridCellCenter(pantryCells[index].gridX, pantryCells[index].gridY)
  }));
  const utilityRow = random() > 0.5 ? 1 : 4;
  const stationAt = (cell: GridCell, station: Omit<Station, keyof Vec | keyof GridCell>): Station => ({
    ...station, ...cell, ...gridCellCenter(cell.gridX, cell.gridY)
  });
  const stations: Station[] = [
    ...ingredientTable,
    stationAt({ gridX: 6, gridY: 2 }, { id: "mix", kind: "mix", label: "Shaker & Brewer", counterVariant: "mixing" }),
    stationAt({ gridX: 10, gridY: 2 }, { id: "serve", kind: "serve", label: "Service Bell", counterVariant: "decorative" }),
    stationAt({ gridX: 11, gridY: utilityRow }, { id: "mop", kind: "mop", label: "Mop Bucket", counterVariant: "damaged" }),
    stationAt({ gridX: 9, gridY: utilityRow === 1 ? 4 : 1 }, { id: "trash", kind: "trash", label: "Scrap Bin", counterVariant: "damaged" })
  ];
  const decorations = theme === "Cozy Village Pub" ? ["🍞", "🕯️", "🌿"] :
    theme === "Haunted Moonlit Inn" ? ["👻", "🌙", "🕸️"] : ["⚓", "🏴‍☠️", "🐟"];
  return { seed, theme, stations, decoration: decorations };
}

export function stationBounds(station: Station) {
  const half = GRID_CELL_SIZE / 2;
  return { left: station.x - half, right: station.x + half, top: station.y - half, bottom: station.y + half };
}

export function pointCollidesWithCounters(tavern: Tavern, point: Vec, radius = PLAYER_COLLISION_RADIUS) {
  return tavern.stations.some((station) => {
    const bounds = stationBounds(station);
    const nearestX = Math.max(bounds.left, Math.min(bounds.right, point.x));
    const nearestY = Math.max(bounds.top, Math.min(bounds.bottom, point.y));
    return Math.hypot(point.x - nearestX, point.y - nearestY) < radius;
  });
}

export function floorBoundsAtY(y: number) {
  const depth = Math.max(0, Math.min(1, (y - BOARD_BOUNDS.minY) / (BOARD_BOUNDS.maxY - BOARD_BOUNDS.minY)));
  return { minX: 60 - 28 * depth, maxX: 740 + 28 * depth };
}

function clampToBoard(point: Vec): Vec {
  const y = Math.max(BOARD_BOUNDS.minY, Math.min(BOARD_BOUNDS.maxY, point.y));
  const floor = floorBoundsAtY(y);
  return {
    x: Math.max(floor.minX, Math.min(floor.maxX, point.x)), y
  };
}

function collisionStep(tavern: Tavern, current: Vec, target: Vec): Vec {
  let result = current;
  const xCandidate = clampToBoard({ x: target.x, y: current.y });
  if (!pointCollidesWithCounters(tavern, xCandidate)) result = xCandidate;
  const yCandidate = clampToBoard({ x: result.x, y: target.y });
  if (!pointCollidesWithCounters(tavern, yCandidate)) result = yCandidate;
  return result;
}

export function moveWithCounterCollisions(tavern: Tavern, current: Vec, desired: Vec): Vec {
  const clamped = clampToBoard(desired);
  const distance = Math.hypot(clamped.x - current.x, clamped.y - current.y);
  const steps = Math.max(1, Math.ceil(distance / (PLAYER_COLLISION_RADIUS / 2)));
  const stepX = (clamped.x - current.x) / steps;
  const stepY = (clamped.y - current.y) / steps;
  let result = clampToBoard(current);
  for (let index = 0; index < steps; index += 1) {
    const target = { x: result.x + stepX, y: result.y + stepY };
    result = collisionStep(tavern, result, target);
  }
  return result;
}

export function mixingStepsForRecipe(recipe: Recipe): MixingStep[] {
  return [
    ...recipe.ingredients.map((ingredient): MixingStep => ({ kind: "ingredient", ingredient })),
    ...recipe.preparation.actions
  ];
}

export function expectedMixingStep(session: MixingSession): MixingStep | undefined {
  return mixingStepsForRecipe(recipeById(session.recipeId))[session.stepIndex];
}

export function toolTimingQuality(elapsedMs: number, action: TimedToolAction): number {
  const distance = Math.abs(elapsedMs - action.targetMs);
  return Math.max(0, Math.min(1, 1 - distance / (action.toleranceMs * 2)));
}

export function toolTimingAccepted(elapsedMs: number, action: TimedToolAction): boolean {
  const window = action.toleranceMs * 2;
  return elapsedMs >= Math.max(250, action.targetMs - window) && elapsedMs <= action.targetMs + window;
}

export function rhythmTimingQuality(elapsedMs: number, action: RhythmAction): number {
  return Math.max(0, Math.min(1, 1 - Math.abs(elapsedMs - action.intervalMs) / (action.toleranceMs * 2)));
}

export function rhythmTimingAccepted(elapsedMs: number, action: RhythmAction): boolean {
  return Math.abs(elapsedMs - action.intervalMs) <= action.toleranceMs;
}

export function applyMissedOrderPenalty(state: Pick<GameState, "health" | "reputation">, count: number): void {
  state.health = Math.max(0, state.health - count);
  state.reputation = Math.max(0, state.reputation - count);
}

export function mixingQuality(session: MixingSession, recipe = recipeById(session.recipeId)): number {
  const stepCount = Math.max(1, mixingStepsForRecipe(recipe).length);
  return Math.max(0, Math.min(1, session.qualityPoints / stepCount - session.mistakes * 0.12));
}

export function createMixingSession(playerId: string, recipeId: string, now = Date.now()): MixingSession {
  return {
    playerId, recipeId, stepIndex: 0, mistakes: 0, startedAt: now,
    deadlineAt: now + MIXING_DURATION_MS, qualityPoints: 0, usedIngredients: [],
    rhythmHits: 0, rhythmQualityPoints: 0,
    feedback: "Choose the first recipe ingredient."
  };
}

export function seededUpgrades(seed: number, round: number): Upgrade[] {
  const random = mulberry32(seed * 19 + round);
  return [...UPGRADES].sort(() => random() - 0.5).slice(0, 3);
}

export function recipeForIngredients(ingredients: string[]): Recipe | undefined {
  const normalized = [...ingredients].sort().join("|");
  return RECIPES.find((recipe) => [...recipe.ingredients].sort().join("|") === normalized);
}

export function initialState(code: string, hostId: string, seed: number): GameState {
  return {
    code, hostId, phase: "lobby", players: {}, tavern: makeTavern(seed), orders: [], mixing: {},
    shiftSeconds: shiftDurationForRound(1), coins: 0, reputation: 0, health: 3, round: 1, hazard: null,
    upgrades: [], orderPatienceBonus: 0, message: "Pick your cat, then the host can begin the shift.",
    pausedAt: null, pausedBy: null
  };
}

export function shiftDurationForRound(_round: number): number {
  return 180;
}

export function pauseShift(state: GameState, playerId: string, now = Date.now()): boolean {
  if (state.phase !== "shift" || state.pausedAt !== null) return false;
  state.pausedAt = now;
  state.pausedBy = playerId;
  Object.values(state.players).forEach((player) => { player.moving = false; });
  // An in-progress gesture restarts after resume without consuming a mistake.
  for (const session of Object.values(state.mixing)) {
    session.toolStartedAt = undefined;
    session.rhythmHits = 0;
    session.rhythmLastHitAt = undefined;
    session.rhythmQualityPoints = 0;
    session.feedback = "Paused. Resume to restart this preparation step.";
  }
  return true;
}

export function resumeShift(state: GameState, now = Date.now()): boolean {
  if (state.phase !== "shift" || state.pausedAt === null) return false;
  const pausedMs = Math.max(0, now - state.pausedAt);
  for (const session of Object.values(state.mixing)) {
    session.deadlineAt += pausedMs;
    session.feedback = "Shift resumed. Restart this preparation step.";
  }
  state.pausedAt = null;
  state.pausedBy = null;
  return true;
}

export function makeOrder(id: string, random: () => number, round = 1, elapsedSeconds = 0, patienceBonus = 0): Order {
  const progress = Math.min(1, Math.max(0, elapsedSeconds / shiftDurationForRound(round)));
  const tier = Math.min(2, Math.max(0, round - 1) + Math.floor(progress * 2));
  const available = RECIPES.filter((recipe) => recipe.tier <= tier);
  const recipe = available[Math.floor(random() * available.length)];
  const customers = ["Sir Whiskerton", "Mothra the Bard", "Captain Claw", "Glimmer Gnome", "Mewsli the Mage"];
  const pressure = Math.min(20, (round - 1) * 5 + Math.floor(progress * 12));
  const maxPatience = Math.max(40, 68 + Math.floor(random() * 18) - pressure + patienceBonus);
  return { id, recipeId: recipe.id, customer: customers[Math.floor(random() * customers.length)], patience: maxPatience, maxPatience };
}

export const recipeById = (id: string) => RECIPES.find((recipe) => recipe.id === id)!;
