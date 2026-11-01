import type { GameState } from "../shared/game";

export interface OverlayView { panel:string; book:boolean; page:number; mode:string }

// Movement and patience ticks must not rebuild a private chooser or erase its
// focused/pressed button. Include only fields actually displayed by the modal.
export function overlayRenderKey(state: GameState, playerId: string, view: OverlayView) {
  const base=[state.code,state.round,state.phase];
  if(state.phase==="shift" && state.pausedAt!==null) {
    return JSON.stringify([...base,"paused",view.book,view.book?view.page:view.panel,view.mode,state.players[state.pausedBy??""]?.name??"A player"]);
  }
  if(state.phase==="shift" && state.mixingChoices?.[playerId]) return JSON.stringify([...base,"choice",state.mixingChoices[playerId]]);
  if(state.phase==="upgrades") return JSON.stringify([...base,state.hostId===playerId,state.health,state.upgrades.map(u=>u.id),state.hospitality?.lastShift]);
  if(state.phase==="complete") return JSON.stringify([...base,state.coins,state.reputation,state.hospitality?.lastShift]);
  return JSON.stringify([...base,"hidden"]);
}
