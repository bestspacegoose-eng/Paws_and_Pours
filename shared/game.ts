export type Theme = "Cozy Village Pub" | "Haunted Moonlit Inn" | "Pirate Cat Tavern";
export type CatRole = "Tabby" | "Siamese" | "Maine Coon" | "Black Cat" | "Calico";
export type FacingDirection = "down" | "left" | "right" | "up";
export type StationKind = "pantry" | "mix" | "serve" | "mop";
export type Phase = "lobby" | "shift" | "upgrades" | "complete";

export interface Vec { x: number; y: number }
export interface Station extends Vec { id: string; kind: StationKind; label: string; ingredient?: string }
export interface Recipe { id: string; name: string; ingredients: string[]; color: string; glass: string }
export interface Order { id: string; recipeId: string; customer: string; patience: number; maxPatience: number }
export interface Player {
  id: string; name: string; role: CatRole; fur: string; accessory: string;
  x: number; y: number; direction: FacingDirection; moving: boolean; moveSequence: number;
  carrying: string[]; drink?: string; connected: boolean; score: number
}
export interface Tavern { seed: number; theme: Theme; stations: Station[]; decoration: string[] }
export interface Upgrade { id: string; title: string; body: string }
export interface GameState {
  code: string; hostId: string; phase: Phase; players: Record<string, Player>; tavern: Tavern;
  orders: Order[]; shiftSeconds: number; coins: number; reputation: number; health: number;
  round: number; hazard: string | null; upgrades: Upgrade[]; message: string
}

export const RECIPES: Recipe[] = [
  { id: "catnip", name: "Catnip Cooler", ingredients: ["catnip", "lime", "fizz"], color: "#8ee17a", glass: "tall" },
  { id: "moonmilk", name: "Moonmilk Latte", ingredients: ["moonmilk", "cream", "stardust"], color: "#ddd5ff", glass: "mug" },
  { id: "tuna", name: "Tuna Tonic", ingredients: ["tuna", "tonic", "kelp"], color: "#7bd8d1", glass: "goblet" }
];
export const INGREDIENTS = ["catnip", "lime", "fizz", "moonmilk", "cream", "stardust", "tuna", "tonic", "kelp"];
export const UPGRADES: Upgrade[] = [
  { id: "swift-paws", title: "Swift Paws", body: "+20% movement speed next shift" },
  { id: "patient-patrons", title: "Patient Patrons", body: "+12 patience on all orders" },
  { id: "lucky-whiskers", title: "Lucky Whiskers", body: "+2 bonus coins per perfect pour" },
  { id: "bottomless-bag", title: "Bottomless Bag", body: "Carry four ingredients at once" }
];

export function mulberry32(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeTavern(seed: number, round = 1): Tavern {
  const random = mulberry32(seed + round * 997);
  const themes: Theme[] = ["Cozy Village Pub", "Haunted Moonlit Inn", "Pirate Cat Tavern"];
  const theme = themes[Math.floor(random() * themes.length)];
  const y = 255 + Math.floor(random() * 55);
  const ingredientTable = INGREDIENTS.map((ingredient, index): Station => ({
    id: `ingredient-${ingredient}`,
    kind: "pantry",
    label: ingredient,
    ingredient,
    x: 85 + (index % 3) * 58,
    y: y - 62 + Math.floor(index / 3) * 48
  }));
  const stations: Station[] = [
    ...ingredientTable,
    { id: "mix", kind: "mix", label: "Shaker & Brewer", x: 385, y: y - 80 },
    { id: "serve", kind: "serve", label: "Service Bell", x: 665, y },
    { id: "mop", kind: "mop", label: "Mop Bucket", x: 725, y: y - 145 }
  ];
  const decorations = theme === "Cozy Village Pub" ? ["🍞", "🕯️", "🌿"] :
    theme === "Haunted Moonlit Inn" ? ["👻", "🌙", "🕸️"] : ["⚓", "🏴‍☠️", "🐟"];
  return { seed, theme, stations, decoration: decorations };
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
    code, hostId, phase: "lobby", players: {}, tavern: makeTavern(seed), orders: [],
    shiftSeconds: 90, coins: 0, reputation: 0, health: 3, round: 1, hazard: null,
    upgrades: [], message: "Pick your cat, then the host can begin the shift."
  };
}

export function makeOrder(id: string, random: () => number): Order {
  const recipe = RECIPES[Math.floor(random() * RECIPES.length)];
  const customers = ["Sir Whiskerton", "Mothra the Bard", "Captain Claw", "Glimmer Gnome", "Mewsli the Mage"];
  const maxPatience = 28 + Math.floor(random() * 15);
  return { id, recipeId: recipe.id, customer: customers[Math.floor(random() * customers.length)], patience: maxPatience, maxPatience };
}

export const recipeById = (id: string) => RECIPES.find((recipe) => recipe.id === id)!;
