import type { TutorialStep } from "./tutorial-content";

// Phone copy teaches one action at a time. The longer laptop narration stays intact.
const lessons:Record<string,[string,string,string?]> = {
  welcome:["Your first tavern","Juniper left you the keys! Take a quick tour, then welcome your first guest."],
  bartender:["Meet your cat","Choose your name, cat, color and accessory. Try the arrows or presets."],
  saves:["Local saves","Use one of three browser save slots. Saved shifts reopen paused."],
  crew:["Invite friends","Create a room or enter a friend's code. Everyone chooses a cat and taps Ready."],
  movement:["Move your cat","Drag the pad to walk. Map shows the room; Follow returns to your cat.","Drag the pad to walk."],
  action:["One action button","Walk near a station and tap the action button. Its label shows what it will do.","Tap the action button."],
  orders:["Guest orders","Tickets show the drink, ingredients and seat. A/B share a table. Swipe for more orders."],
  stats:["Your shift","Coins are earnings; stars are reputation. Missed orders cost hearts. A shift lasts 3 minutes."],
  pantry:["Collect ingredients","Take the three ingredients pictured on the ticket, in any order.","Tap Take near a shelf."],
  carrying:["In your paws","This shows your ingredients or drink. Carry up to three ingredients, then head to Mixing."],
  chop:["Chop first","Cleaver badge? Bring that ingredient here, chop to the beat, then pick up the pieces.","Tap Chop to start."],
  mixer:["Mixing counters","Bring a recipe's three ingredients here. Tap Mix to open the workbench.","Tap Mix drink."],
  ingredients:["Add ingredients","Add in any order. Real shifts: 45s, 3 mistakes. Practice is untimed; Cancel keeps ingredients.","Add each ingredient."],
  timing:["The green window","Hold the tool. Release when the fill reaches the green window.","Release in the green window."],
  hold:["Hold, then release","Press and hold the tool button. Release at the target line.","Release at the target line."],
  "chop-beat":["Chop to the beat","Tap once to start. Tap again in each green window. Pick up the finished pieces.","Tap in the green window."],
  "paw-beat":["Alternate paws","Follow the highlighted paw: left, right, left, right. Tap in the green window.","Alternate left and right."],
  serve:["Serve the right guest","Bring the drink to its table, chair or bar number. Tap Serve.","Tap Serve by the guest."],
  handoff:["Place and pick up","Tap Place drink on a free counter. Tap again to pick it up. A friend can collect it too.","Tap Place, then Pick up."],
  tidy:["Clean up","Use the cleaning sink to clear spills. The scrap bin discards what's in your paws.","Tap Clean at the sink."],
  pause:["Take a breath","Menu · Pause freezes all clocks. Resume continues the shift for everyone.","Try Resume or Menu · Pause."],
  book:["Recipe book","Turn pages for ingredients and preparation. The back button returns to Pause."],
  settings:["Make it comfortable","Adjust brightness, display, motion and sound here. Replay this tour from Pause."],
  upgrades:["Choose a keepsake","After a shift, choose one bonus for the next tavern. In multiplayer, the host chooses."],
  ready:["Open for business","Gather, chop if marked, mix and serve. Juniper says: one order at a time. You're ready!"]
};
export function mobileTutorialLesson(step:TutorialStep) {
  const [title,body,hint]=lessons[step.id]??[step.title,step.body];
  return {title,body,hint:hint??"Try the highlighted control."};
}
export function mobileTutorialFeedback(message:string) {
  const first=message.match(/^.*?[.!?](?:\s|$)/)?.[0].trim()??message;
  return first.length<=85?first:`${first.slice(0,82).trimEnd()}…`;
}
