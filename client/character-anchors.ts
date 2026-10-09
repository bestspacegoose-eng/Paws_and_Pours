import type { CatRole, FacingDirection, Vec } from "../shared/game";

export interface CatAnchors { crown: Vec; eye: Vec; neck: Vec; headWidth: number }
export interface PlayerAnchors extends CatAnchors { feetX: number }
const anchor = (x: number, crownY: number, eyeX: number, eyeY: number, neckX: number, neckY: number, feetX: number): PlayerAnchors =>
  ({ crown: { x, y: crownY }, eye: { x: eyeX, y: eyeY }, neck: { x: neckX, y: neckY }, feetX, headWidth: 164 });

// Source-pixel landmarks, independent of the transparent padding and animated tail.
export const PLAYER_ANCHORS: Record<FacingDirection, PlayerAnchors[]> = {
  down: [anchor(228, 65, 260, 124, 228, 177, 228), anchor(513, 67, 545, 126, 513, 179, 513),
    anchor(804, 68, 836, 126, 804, 180, 804), anchor(1093, 64, 1125, 124, 1093, 177, 1093)],
  left: [anchor(215, 353, 190, 404, 196, 460, 223), anchor(508, 355, 483, 406, 489, 462, 516),
    anchor(800, 355, 775, 406, 781, 462, 808), anchor(1099, 355, 1074, 406, 1080, 462, 1107)],
  right: [anchor(248, 640, 277, 693, 270, 750, 263), anchor(538, 640, 567, 693, 560, 750, 553),
    anchor(825, 639, 854, 692, 847, 749, 840), anchor(1118, 639, 1147, 692, 1140, 749, 1133)],
  up: [anchor(233, 929, 233, 978, 243, 1030, 245), anchor(524, 930, 524, 979, 524, 1031, 524),
    anchor(807, 930, 807, 979, 807, 1031, 808), anchor(1098, 930, 1098, 979, 1098, 1031, 1100)]
};

export const PORTRAIT_ANCHORS: Record<CatRole, CatAnchors & { top: number; bottom: number }> = {
  "Tabby": { crown: { x: 61, y: 72 }, eye: { x: 82, y: 113 }, neck: { x: 61, y: 151 }, headWidth: 106, top: 50, bottom: 237 },
  "Siamese": { crown: { x: 67, y: 64 }, eye: { x: 84, y: 103 }, neck: { x: 67, y: 137 }, headWidth: 94, top: 46, bottom: 213 },
  "Maine Coon": { crown: { x: 60, y: 61 }, eye: { x: 77, y: 101 }, neck: { x: 60, y: 145 }, headWidth: 106, top: 36, bottom: 207 },
  "Black Cat": { crown: { x: 64, y: 64 }, eye: { x: 82, y: 104 }, neck: { x: 64, y: 134 }, headWidth: 99, top: 48, bottom: 207 },
  "Calico": { crown: { x: 73, y: 43 }, eye: { x: 95, y: 91 }, neck: { x: 73, y: 135 }, headWidth: 124, top: 16, bottom: 236 }
};

export function transformAnchors(anchors: CatAnchors, left: number, top: number, scale: number): CatAnchors {
  const map = (point: Vec) => ({ x: Math.round(left + point.x * scale), y: Math.round(top + point.y * scale) });
  return { crown: map(anchors.crown), eye: map(anchors.eye), neck: map(anchors.neck), headWidth: anchors.headWidth * scale };
}
