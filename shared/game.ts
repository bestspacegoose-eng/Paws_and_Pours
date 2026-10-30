export type Theme = "Cozy Village Pub" | "Haunted Moonlit Inn" | "Pirate Cat Tavern";
export const TAVERN_THEMES: readonly Theme[] = ["Cozy Village Pub", "Haunted Moonlit Inn", "Pirate Cat Tavern"];
export type KeepsakeId = "swift-paws" | "patient-patrons" | "lucky-whiskers" | "bottomless-bag" | "nine-lives";
export type CatRole = "Tabby" | "Siamese" | "Maine Coon" | "Black Cat" | "Calico";
export type FacingDirection = "down" | "left" | "right" | "up";
export type StationKind = "pantry" | "mix" | "chop" | "serve" | "seat" | "mop" | "trash" | "counter";
export type Phase = "lobby" | "shift" | "upgrades" | "complete";
export type CounterVariant = "standard" | "end-cap" | "corner" | "ingredient" | "mixing" | "decorative" | "damaged";
export type MixingTool = "shaker" | "spoon" | "pourer";
export type HazardKind = "napkins" | "ectoplasm" | "fire";

export interface Vec { x: number; y: number }
export interface GridCell { gridX: number; gridY: number }
export interface PreparedDrink { recipeId: string; quality: number }
export interface Station extends Vec, GridCell {
  id: string; kind: StationKind; label: string; counterVariant: CounterVariant; ingredient?: string; drink?: PreparedDrink; preparedIngredient?: string;
  tableId?: string; seatNumber?: number; facing?: FacingDirection; widthCells?: number; serviceStyle?: "bar"
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
export interface Order { id: string; recipeId: string; customer: string; patience: number; maxPatience: number; tableId?: string; seatId?: string }
export interface Hazard extends Vec { id: string; kind: HazardKind; message: string }
export interface Player {
  id: string; name: string; role: CatRole; fur: string; accessory: string;
  x: number; y: number; direction: FacingDirection; moving: boolean; moveSequence: number;
  carrying: string[]; drink?: string; drinkQuality?: number; connected: boolean; score: number
  ready?: boolean;
}
export interface Tavern { seed: number; theme: Theme; stations: Station[]; decoration: string[] }
export interface Upgrade { id: KeepsakeId; title: string; body: string }
export interface GameState {
  code: string; hostId: string; phase: Phase; players: Record<string, Player>; tavern: Tavern;
  orders: Order[]; mixing: Record<string, MixingSession>; shiftSeconds: number; coins: number;
  reputation: number; health: number; round: number; hazard: Hazard | null;
  upgrades: Upgrade[]; orderPatienceBonus: number; message: string;
  activeKeepsake?: KeepsakeId; mixingChoices?: Record<string, string[]>;
  pausedAt: number | null; pausedBy: string | null
}

export const GRID_ORIGIN = { x: 0, y: 0 } as const;
export const GRID_CELL_SIZE = 58;
export const GRID_COLUMNS = 16;
export const GRID_ROWS = 11;
// A cat's contact point is its paws, not the full width of its animated sprite.
export const PLAYER_COLLISION_RADIUS = 10;
export const BOARD_BOUNDS = { minX: 10, maxX: GRID_COLUMNS * GRID_CELL_SIZE - 10,
  minY: 10, maxY: GRID_ROWS * GRID_CELL_SIZE - 10 } as const;
export const PLAYER_SPAWNS = [gridCellCenter(3, 8), gridCellCenter(4, 8), gridCellCenter(5, 8), gridCellCenter(6, 8)];
export const INTERACTION_REACH = 74;
export const MIXING_DURATION_MS = 45_000;
export const MIXING_MAX_MISTAKES = 3;
export const PANTRY_FLOOR_PLAN: Record<string, GridCell> = {
  catnip: { gridX: 1, gridY: 0 }, stardust: { gridX: 3, gridY: 0 },
  kelp: { gridX: 5, gridY: 0 }, moonmilk: { gridX: 6, gridY: 0 }, lime: { gridX: 0, gridY: 2 },
  tuna: { gridX: 0, gridY: 3 }, fizz: { gridX: 0, gridY: 7 },
  tonic: { gridX: 0, gridY: 8 }, cream: { gridX: 0, gridY: 5 }
};

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
    id: "tuna", name: "Tuna Tonic", ingredients: ["chopped-tuna", "tonic", "kelp"],
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
    id: "seafoam-shake", name: "Seafoam Shake", ingredients: ["chopped-tuna", "kelp", "cream"],
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
  { id: "patient-patrons", title: "Patient Patrons", body: "+12 seconds of patience on every order next shift" },
  { id: "lucky-whiskers", title: "Lucky Whiskers", body: "+2 bonus coins when serving a perfect drink next shift" },
  { id: "bottomless-bag", title: "Bottomless Bag", body: "Carry four ingredients next shift; mixing keeps the spare" },
  { id: "nine-lives", title: "Nine Lives", body: "Restore one team heart now (up to three)" }
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
  const start = Math.floor(mulberry32(seed)() * TAVERN_THEMES.length);
  const theme = TAVERN_THEMES[(start + Math.max(0, round - 1)) % TAVERN_THEMES.length];
  const ingredientTable = INGREDIENTS.map((ingredient, index): Station => ({
    id: `ingredient-${ingredient}`,
    kind: "pantry",
    label: ingredient,
    ingredient,
    counterVariant: counterVariantForPantry(index),
    ...PANTRY_FLOOR_PLAN[ingredient],
    ...gridCellCenter(PANTRY_FLOOR_PLAN[ingredient].gridX, PANTRY_FLOOR_PLAN[ingredient].gridY)
  }));
  const stationAt = (cell: GridCell, station: Omit<Station, keyof Vec | keyof GridCell>): Station => ({
    ...station, ...cell, ...gridCellCenter(cell.gridX, cell.gridY)
  });
  const stations: Station[] = [
    ...ingredientTable,
    stationAt({ gridX: 3, gridY: 3 }, { id: "mix", kind: "mix", label: "Mixing", counterVariant: "mixing" }),
    stationAt({ gridX: 4, gridY: 5 }, { id: "mix-east", kind: "mix", label: "Mixing", counterVariant: "mixing" }),
    stationAt({ gridX: 3, gridY: 5 }, { id: "chop", kind: "chop", label: "Chop tuna", counterVariant: "ingredient" }),
    stationAt({ gridX: 1, gridY: 10 }, { id: "mop", kind: "mop", label: "Clean", counterVariant: "damaged" }),
    stationAt({ gridX: 3, gridY: 10 }, { id: "trash", kind: "trash", label: "Discard", counterVariant: "damaged" })
  ];
  // Each long table has two independent guest seats, both facing its surface.
  [[11, 2], [14, 2], [11, 7], [14, 7]].forEach(([gridX, gridY], index) => {
    const id = `table-${index + 1}`;
    stations.push(stationAt({ gridX, gridY }, { id, kind: "serve", label: `Table ${index + 1}`, widthCells: 2, counterVariant: "decorative" }));
    for (let seat = 0; seat < 2; seat++) stations.push(stationAt({ gridX: gridX + seat, gridY: gridY - 1 }, {
      id: `${id}-seat${seat ? "-2" : ""}`, kind: "seat", tableId: id, seatNumber: seat + 1, facing: "down",
      label: `${index < 2 ? "Booth" : "Chair"} ${index + 1}${seat ? "B" : "A"}`, counterVariant: "decorative"
    }));
  });
  // Guest stools face the bar; rows 6–8 remain the wide kitchen/dining passage.
  for (const [index, gridY] of [1, 3, 5, 9].entries()) {
    const tableId = `bar-${index + 1}`;
    stations.push(stationAt({ gridX: 8, gridY }, {
      id: tableId, kind: "serve", serviceStyle: "bar", label: `Bar ${index + 1}`, counterVariant: "standard"
    }));
    stations.push(stationAt({ gridX: 9, gridY }, {
      id: `bar-stool-${gridY}`, kind: "seat", tableId, seatNumber: 1, facing: "left", label: "Bar stool", counterVariant: "decorative"
    }));
  }
  const occupied = new Set(stations.map((station) => `${station.gridX}:${station.gridY}`));
  for (let y = 0; y < GRID_ROWS; y++) for (let x = 0; x < GRID_COLUMNS; x++) {
    if (x === 0 && (y === 0 || y === 10)) continue;
    const perimeter = x <= 8 && (y === 0 || y === 10 || x === 0 || (x === 8 && (y <= 5 || y >= 9)));
    const island = y >= 3 && y <= 5 && (x === 3 || x === 4);
    if ((!perimeter && !island) || occupied.has(`${x}:${y}`)) continue;
    stations.push(stationAt({ gridX: x, gridY: y }, {
      id: `counter-${x}-${y}`, kind: "counter", label: "Counter", counterVariant: "standard"
    }));
  }
  const decorations = theme === "Cozy Village Pub" ? ["🍞", "🕯️", "🌿"] :
    theme === "Haunted Moonlit Inn" ? ["👻", "🌙", "🕸️"] : ["⚓", "🏴‍☠️", "🐟"];
  return { seed, theme, stations, decoration: decorations };
}

export function stationBounds(station: Station) {
  const half = GRID_CELL_SIZE / 2;
  // Chair and stool silhouettes are narrower than a countertop. Keep their feet
  // solid without an invisible full-cell barrier extending into the dining aisle.
  const halfWidth = station.kind === "seat" ? 16 : half;
  return { left: station.x - halfWidth, right: station.x + halfWidth + ((station.widthCells ?? 1) - 1) * GRID_CELL_SIZE,
    top: station.y - half, bottom: station.y + half };
}

export function seatForOrder(tavern: Tavern, order: Order): Station | undefined {
  return tavern.stations.find(station => station.kind === "seat" && station.tableId === order.tableId &&
    (order.seatId ? station.id === order.seatId : station.seatNumber === 1));
}

// Interleave table pairs with the bar so both kinds of guest appear early in a shift.
export function nextCustomerSeat(tavern: Tavern, orders: Order[], arrivalIndex = 0): Station | undefined {
  const seats = tavern.stations.filter(station => station.kind === "seat" && station.tableId);
  const bars = seats.filter(station => station.label === "Bar stool");
  const tables = tavern.stations.filter(station => station.kind === "serve" && station.serviceStyle !== "bar");
  const rotation = tables.flatMap((table, index) => {
    const pair = seats.filter(seat => seat.tableId === table.id);
    return [pair[0], bars[index], ...pair.slice(1)].filter((seat): seat is Station => Boolean(seat));
  });
  const occupied = new Set(orders.map(order => seatForOrder(tavern, order)?.id));
  for (let offset = 0; offset < rotation.length; offset++) {
    const seat = rotation[(arrivalIndex + offset) % rotation.length];
    if (!occupied.has(seat.id)) return seat;
  }
}

export function orderDestinationLabel(order: Order) {
  if (!order.tableId) return "Guest";
  if (order.tableId.startsWith("bar-")) return order.tableId.replace("bar-", "Bar ");
  const table = order.tableId.replace("table-", "Table ");
  return order.seatId ? `${table} · ${order.seatId.endsWith("-2") ? "B" : "A"}` : table;
}

export function servingOrderIndex(tavern: Tavern, orders: Order[], station: Station, recipeId: string) {
  const tableId = station.kind === "seat" ? station.tableId : station.kind === "serve" ? station.id : undefined;
  if (!tableId) return -1;
  let result = -1;
  orders.forEach((order, index) => {
    if (order.tableId === tableId && order.recipeId === recipeId &&
        (station.kind !== "seat" || seatForOrder(tavern, order)?.id === station.id) &&
        (result < 0 || order.patience < orders[result].patience)) result = index;
  });
  return result;
}

export function pointCollidesWithCounters(tavern: Tavern, point: Vec, radius = PLAYER_COLLISION_RADIUS) {
  return tavern.stations.some((station) => {
    const bounds = stationBounds(station);
    const nearestX = Math.max(bounds.left, Math.min(bounds.right, point.x));
    const nearestY = Math.max(bounds.top, Math.min(bounds.bottom, point.y));
    return Math.hypot(point.x - nearestX, point.y - nearestY) < radius;
  });
}

export function floorBoundsAtY(_y: number) {
  return { minX: BOARD_BOUNDS.minX, maxX: BOARD_BOUNDS.maxX };
}

export function nearbyStation(tavern: Tavern, player: Vec): Station | undefined {
  const target = (station: Station) => ({ x: Math.max(station.x,
    Math.min(station.x + ((station.widthCells ?? 1) - 1) * GRID_CELL_SIZE, player.x)), y: station.y });
  const distance = (station: Station) => { const point = target(station); return Math.hypot(point.x - player.x, point.y - player.y); };
  return tavern.stations.filter((station) => distance(station) < INTERACTION_REACH)
    .sort((a, b) => {
      const delta = distance(a) - distance(b);
      // Movement produces fractional coordinates. A subpixel tie should not
      // flicker from an ingredient station to the adjacent empty countertop.
      if (Math.abs(delta) > .5) return delta;
      return Number(a.kind === "counter") - Number(b.kind === "counter") || a.id.localeCompare(b.id);
    })
    .find((station) => {
      const point = target(station);
      // A surface behind another counter cannot be reached through its neighbor.
      for (let t = .1; t < 1; t += .1) {
        const x = player.x + (point.x - player.x) * t, y = player.y + (point.y - player.y) * t;
        if (tavern.stations.some((other) => {
          if (other === station) return false;
          const b = stationBounds(other);
          return x > b.left && x < b.right && y > b.top && y < b.bottom;
        })) return false;
      }
      return true;
    });
}

export function transferCounterDrink(player: Player, station: Station, carryCapacity = 3): "placed" | "picked-up" | "occupied" | "empty" | "unavailable" {
  if (!["counter", "pantry", "mix"].includes(station.kind)) return "unavailable";
  if (station.drink) {
    if (player.drink || (player.carrying.length && carryCapacity <= 3)) return "occupied";
    player.drink = station.drink.recipeId;
    player.drinkQuality = station.drink.quality;
    delete station.drink;
    return "picked-up";
  }
  if (!player.drink) return "empty";
  station.drink = { recipeId: player.drink, quality: player.drinkQuality ?? 1 };
  delete player.drink;
  delete player.drinkQuality;
  return "placed";
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

export function addMixingIngredient(session: MixingSession, carried: string[], ingredient: string): boolean {
  const recipe = recipeById(session.recipeId);
  if (expectedMixingStep(session)?.kind !== "ingredient") return false;
  const used = session.usedIngredients.filter((item) => item === ingredient).length;
  if (used >= recipe.ingredients.filter((item) => item === ingredient).length ||
      used >= carried.filter((item) => item === ingredient).length) return false;
  session.usedIngredients.push(ingredient);
  session.stepIndex += 1;
  session.qualityPoints += 1;
  return true;
}

export function chopTuna(player: Player, station: Station, carryCapacity = 3): "chopped" | "picked-up" | "full" | "needs-tuna" {
  if (station.kind !== "chop") return "needs-tuna";
  if (station.preparedIngredient) {
    if (player.drink || player.carrying.length >= carryCapacity || player.carrying.includes("chopped-tuna")) return "full";
    player.carrying.push(station.preparedIngredient);
    delete station.preparedIngredient;
    return "picked-up";
  }
  const index = player.carrying.indexOf("tuna");
  if (index < 0) return "needs-tuna";
  player.carrying.splice(index, 1);
  station.preparedIngredient = "chopped-tuna";
  return "chopped";
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
    feedback: "Add your ingredients in any order."
  };
}

export function seededUpgrades(seed: number, round: number, health = 2): Upgrade[] {
  const random = mulberry32(seed * 19 + round);
  const available = UPGRADES.filter(upgrade => upgrade.id !== "nine-lives" || health < 3);
  for (let index = available.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [available[index], available[other]] = [available[other], available[index]];
  }
  return available.slice(0, 3);
}

export function recipesForCarriedIngredients(ingredients: string[]): Recipe[] {
  return RECIPES.filter(recipe => recipe.ingredients.every(ingredient =>
    ingredients.filter(item => item === ingredient).length >= recipe.ingredients.filter(item => item === ingredient).length));
}

export function recipeForIngredients(ingredients: string[]): Recipe | undefined {
  const normalized = [...ingredients].sort().join("|");
  return RECIPES.find((recipe) => [...recipe.ingredients].sort().join("|") === normalized);
}

export function initialState(code: string, hostId: string, seed: number): GameState {
  return {
    code, hostId, phase: "lobby", players: {}, tavern: makeTavern(seed), orders: [], mixing: {},
    shiftSeconds: shiftDurationForRound(1), coins: 0, reputation: 0, health: 3, round: 1, hazard: null,
    upgrades: [], orderPatienceBonus: 0, mixingChoices: {}, message: "Pick your cat, then the host can begin the shift.",
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
