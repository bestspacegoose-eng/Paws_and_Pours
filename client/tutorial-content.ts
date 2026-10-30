import { createMixingSession, gridCellCenter, initialState, recipeById, UPGRADES,
  type CatRole, type GameState, type Player, type Vec } from "../shared/game";

export type TutorialScene = "welcome" | "selection" | "title" | "move" | "action" | "orders" | "stats" | "pantry" |
  "carry" | "chop" | "mixer" | "ingredients" | "timed" | "chop-beat" | "paw-beat" | "serve" | "handoff" | "tidy" |
  "pause" | "book" | "settings" | "upgrades" | "ready";
export interface TutorialStep {
  id: string; scene: TutorialScene; title: string; body: string; target?: string[];
  tip?: string; touchTip?: string;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id:"welcome", scene:"welcome", title:"Your first tavern awaits.",
    body:"Congratulations! You've opened your first tavern. Aunt Juniper has left you the keys, a well-loved recipe book, and one piece of advice: a good drink makes a guest feel at home.",
    tip:"Let's look around before opening time. No clocks run during this tour." },
  { id:"bartender", scene:"selection", title:"Meet the keeper of the keys.", target:["#fur"],
    body:"That's you! Choose your cat type, name, fur color, and accessory here. The arrows cycle through your options; the cat cards are quick presets.",
    tip:"Your chosen color and accessory follow you into the tavern." },
  { id:"saves", scene:"title", title:"Keep your adventure safe.", target:["#save-menu"],
    body:"Choose Load / create local save for three slots saved in this browser. Saved shifts reopen paused; Start solo game opens a quick, unsaved shift." },
  { id:"crew", scene:"title", title:"Invite the crew.", target:[".join"],
    body:"Create game opens a room; Join game uses a four-character code. Two to four bartenders can play together. Everyone chooses a cat and presses Ready before the host starts." },
  { id:"movement", scene:"move", title:"Find your paws.", target:["movement"],
    body:"The kitchen is on the left and the guest tables are on the right. Use WASD or the arrow keys to walk around counters and chairs.",
    touchTip:"Drag the movement pad to walk. Map shows the whole tavern; Follow brings the camera back to your cat.",
    tip:"This is a guided preview. You can try the controls after the tour." },
  { id:"action", scene:"action", title:"One action, many helpful paws.", target:["action"],
    body:"Walk close to a station, then press E. The same action gathers ingredients, prepares and serves drinks, cleans, or places and retrieves a finished drink.",
    touchTip:"Walk close to a station and tap this one button. Its label changes to match the action: Take, Mix, Serve, Place drink, or Pick up drink.",
    tip:"Q is an optional keyboard shortcut for placing and retrieving drinks." },
  { id:"orders", scene:"orders", title:"Your first guest has arrived.", target:[".order-ticket:first-child"],
    body:"Tickets name the drink, three ingredients, and the guest's seat. A and B share a table; Bar 1 means a bar stool. The strip below the pictures shows patience.",
    touchTip:"Swipe the ticket row sideways to see every order." },
  { id:"stats", scene:"stats", title:"A shift at a glance.", target:[".stats"],
    body:"Coins are your earnings; stars are your reputation. Hearts belong to the whole team. Each missed order costs a heart. The clock counts down a three-minute shift.",
    tip:"Your opening tour is frozen at 3:00. Take your time." },
  { id:"pantry", scene:"pantry", title:"Juniper stocked the shelves.", target:["station:ingredient-lime"],
    body:"Match the three ingredient pictures on a ticket. Take them from the kitchen's left and back counters, in any order, using the action button." },
  { id:"carrying", scene:"carry", title:"Know what's in your paws.", target:["carry"],
    body:"This readout shows your ingredients or finished drink. You can carry three ingredients at a time. Once you have a recipe's full set, head to either mixing counter.",
    tip:"You cannot pick up another finished drink while your paws are full." },
  { id:"chop", scene:"chop", title:"A little prep goes a long way.", target:["station:chop"],
    body:"Tuna recipes need chopped tuna. Bring raw tuna to this board, interact once to chop it, then again to pick up the pieces. The little cleaver badge on a ticket means 'chop first'." },
  { id:"mixer", scene:"mixer", title:"Make a little tavern magic.", target:["station:mix"],
    body:"Bring a recipe's three ingredients here and interact to open your workbench. In multiplayer, the other bartenders keep working while you prepare the drink." },
  { id:"ingredients", scene:"ingredients", title:"First, add your ingredients.", target:[".mixing-actions"],
    body:"Use the three Add buttons in any order. The preparation clock gives you 45 seconds; three mistakes spoil the mixture. Cancel keeps the ingredients in your paws so you can return later.",
    tip:"Menu · Pause also freezes preparation time for everyone." },
  { id:"timing", scene:"timed", title:"Find the sweet spot.", target:[".tool-timing"],
    body:"The green window is the sweet spot. The target line and seconds show when to release. The bar fills while you hold a shaker, spoon, or pourer." },
  { id:"hold", scene:"timed", title:"Hold, then release.", target:[".tool-action"],
    body:"Hold the tool button until the moving fill reaches the green sweet spot, then release it to finish the action. A spoon stirs, a shaker shakes, and a pourer fills the glass.",
    tip:"Better timing makes a better drink and can earn a better tip." },
  { id:"chop-beat", scene:"chop-beat", title:"Chop to the beat.", target:[".tool-timing"],
    body:"Tap Chop once to begin. Then wait for the green beat window before each next tap. The counter tracks your successful chops." },
  { id:"paw-beat", scene:"paw-beat", title:"Left paw, right paw.", target:[".mixing-actions"],
    body:"Paw-mixing recipes use the same beat window, but alternate Left paw and Right paw. Follow the highlighted button. Some drinks combine two preparation steps before they are finished." },
  { id:"serve", scene:"serve", title:"Make your guest feel at home.", target:["station:table-1"],
    body:"Bring your finished drink to the matching table, chair, or bar counter and interact. A and B are separate guests. Serving one leaves the other's order; a wrong delivery keeps your drink." },
  { id:"handoff", scene:"handoff", title:"A counter can lend a paw.", target:["station:counter-4-3"],
    body:"Use Place drink to leave a finished drink on a free work surface. Use Pick up drink to collect it. Crewmates can collect it too, with its quality preserved." },
  { id:"tidy", scene:"tidy", title:"A tidy tavern is a happy tavern.", target:["station:mop", "station:trash"],
    body:"When a hazard appears, interact at the cleaning sink to clear it. You do not need to stand on the spill. The nearby scrap bin discards ingredients or a drink when you need a fresh start.",
    tip:"Discarding something does not cancel a guest's order." },
  { id:"pause", scene:"pause", title:"Take a breath.", target:["#resume-shift"],
    body:"Menu · Pause, or Escape on a keyboard, stops the shift, guest patience, and preparation timers. Resume continues where you left off. In a party, pausing or resuming affects everyone." },
  { id:"book", scene:"book", title:"Juniper's recipe book.", target:[".recipe-book-controls"],
    body:"Open Recipe book in the pause menu to see ingredients and preparation instructions. Previous and Next turn pages. The back button returns to the pause menu." },
  { id:"settings", scene:"settings", title:"Make yourself comfortable.", target:["#open-pause-settings"],
    body:"Settings has brightness, display scale, pixel rendering, reduced motion, fullscreen, and audio controls. Your preferences stay on this device. Replay tutorial in the solo pause menu brings this tour back.",
    tip:"You can also find Settings and How to play on the title screen." },
  { id:"upgrades", scene:"upgrades", title:"After the last call.", target:[".upgrade:first-child"],
    body:"Survive the shift and you'll choose a keepsake before opening the next tavern. In multiplayer the host chooses for the crew. Look after those shared hearts—running out ends the adventure." },
  { id:"ready", scene:"ready", title:"The first chapter is yours.",
    body:"Juniper turns the sign to OPEN. 'One order at a time,' she says. Gather three ingredients, prepare the drink, and bring it to the right guest. Your first tavern is ready for you.",
    tip:"You can replay this tour from How to play on the title screen." }
];

export function tutorialCameraFocus(scene: TutorialScene): Vec {
  const cells: Partial<Record<TutorialScene, [number, number]>> = {
    pantry:[1,2], action:[1,2], carry:[3,2], chop:[2,5], mixer:[3,2], handoff:[5,3], tidy:[2,9], serve:[12,3]
  };
  const [x,y] = cells[scene] ?? [3,8];
  return gridCellCenter(x,y);
}

export function tutorialState(playerId: string, profile: { name:string; role:CatRole; fur:string; accessory:string }, scene: TutorialScene): GameState {
  const state = initialState("TUTORIAL", playerId, 42);
  state.phase = "shift"; state.tavern.theme = "Cozy Village Pub"; state.message = "";
  const player: Player = { id:playerId, ...profile, ...tutorialCameraFocus(scene), direction:"down", moving:false,
    moveSequence:0, carrying:[], connected:true, score:0 };
  state.players[playerId] = player;
  state.orders = [{ id:"tutorial-order", tableId:"table-1", seatId:"table-1-seat", recipeId:"catnip",
    customer:"Aunt Juniper", patience:80, maxPatience:80 }];
  if (["carry","mixer"].includes(scene)) player.carrying = ["catnip","lime","fizz"];
  if (scene === "chop") player.carrying = ["tuna"];
  if (["serve","handoff"].includes(scene)) player.drink = "catnip";
  const recipeId = scene === "chop-beat" ? "lunar-fizz" : scene === "paw-beat" ? "kelp-swirl" : "catnip";
  if (["ingredients","timed","chop-beat","paw-beat"].includes(scene)) {
    const recipe = recipeById(recipeId), session = createMixingSession(playerId, recipeId);
    player.carrying = [...recipe.ingredients];
    if (scene !== "ingredients") { session.stepIndex = 3; session.usedIngredients = [...recipe.ingredients]; }
    session.feedback = scene === "ingredients" ? "Add your three ingredients in any order." : scene === "timed"
      ? "Hold, then release in the green sweet spot." : "Follow the highlighted beat button.";
    state.mixing[playerId] = session;
  }
  if (["pause","book","settings"].includes(scene)) { state.pausedAt = Date.now(); state.pausedBy = playerId; }
  if (scene === "tidy") state.hazard = { id:"tutorial-spill", kind:"napkins", message:"A mouse has scattered napkins.", ...gridCellCenter(5,8) };
  if (scene === "upgrades") { state.phase = "upgrades"; state.upgrades = [UPGRADES[1], UPGRADES[4], UPGRADES[0]]; }
  return state;
}

const progressKey = "paws-pours-tutorial-v1";
export function tutorialSeen() {
  try { const value = localStorage.getItem(progressKey); return value === "complete" || value === "skipped"; } catch { return false; }
}
export function rememberTutorial(result: "complete" | "skipped") {
  try { localStorage.setItem(progressKey, result); } catch { /* The tour works without browser storage. */ }
}
