# Tavern tiles and presentation

The existing floor and wall art retain the established muted palette. Each tavern now has a separate furniture atlas used for every counter, dining chair, table, and bar stool:

| Theme | Atlas | Materials |
| --- | --- | --- |
| Cozy Village Pub | `client/assets/tilemap/furniture-cozy-v1.png` | Lavender stone, rose wood, dusty rose-beige tables, mauve cushions |
| Haunted Moonlit Inn | `client/assets/tilemap/furniture-haunted-v1.png` | Sage stone, plum framing, subtle crescent panels, lavender seats |
| Pirate Cat Tavern | `client/assets/tilemap/furniture-pirate-v1.png` | Sea-sage tops and cushions, weathered cocoa wood, restrained brass |

These are original transparent sprites generated with the built-in imagegen tool. The final prompts are in `docs/THEME_FURNITURE_PROMPTS.txt`. The Cozy sheet is 1536 × 1024; the Haunted and Pirate sheets are 1254 × 1254. `client/furniture-layout.ts` records measured painted bounds, and `client/furniture-art.ts` loads the sheets by theme. Gutters are never drawn as part of a tile.

`client/depth-tiles.ts` splits counter tops and front panels, chooses horizontal end caps, and uses the interior texture for continuous north/south runs and preparation islands. Tops rise 22 screen pixels; exposed southern and eastern faces end at their collision boundaries. Station props and interaction highlights follow the raised surface. `client/dining-art.ts` fits tables within 54 × 43 screen pixels and seats within 54 × 46, aligned by their feet. The narrow chair and stool silhouettes use 32-world-pixel-wide collision bounds; countertops and dining tables retain their 58 × 58 world footprints.

Four solid bar stools at column 9, rows 1, 3, 5, and 9 face the service bar. The entrance at rows 6–8 and the column-10 dining aisle remain clear. Seats share the authoritative client/server collision rules and deterministic save restoration. Table numbers, customer cats, order bubbles, and patience indicators remain visible. The original plain lavender rugs and their single pale border are retained.

Windows share a centerline 61 screen pixels above the floor, at 10%, 50%, and 90% of the back wall. Shelves sit between them at 30% and 70%; candle decorations clear the raised counter line.

## Menus and movement

`client/menu-polish.css` uses the bundled Pixelify Sans font for menu controls, with quiet panels, consistent focus states, and mode-specific actions. The font and its SIL OFL license are included under `client/assets/fonts/`; menus do not need a network request to load that font. Solo shows solo/save actions; multiplayer shows create/join actions.

`shared/movement.ts` expresses speed in world pixels per second: 112 for ordinary cats and 136 for Siamese, versus the previous 2.7/3.3 pixels per render frame (162/198 at 60Hz). Input is normalized diagonally, and frame time is capped at 50ms to discard background-tab gaps. `client/walk-animation.ts` advances a four-frame gait every 14 travelled pixels. Idle, paused, blocked, and teleported cats return to the idle pose; remote snapshots retain their pose between packets.

## Mixing

`client/mixing-bowl.ts` draws a stationary wooden vessel and an independently moving spoon for timed spoon tools and rhythm bowl recipes. The spoon traces an elliptical stirring path, and its tip is clipped behind the foreground rim. Hand-mixing paw beats remain visible. Pause and reduced-motion mode suppress the motion. Shaker and pourer behavior is retained.

## Verification

- 35 automated tests pass, including equal travel distance at 30/60/144Hz, diagonal normalization, idle/blocked poses, fixed bowl positions, atlas bounds, stool collision, station reachability, saves, and preparation rules.
- Production Vite build, client TypeScript check, server TypeScript compilation, and `git diff --check` pass.
- The real two-client Socket.IO smoke test verifies shared pause, counter handoff, independent movement during mixing, rhythm preparation, and delivery to the correct table.
- Chrome checks cover all three maps, occupied tables, desktop/mobile menus, character selection, a playable shift, and pause. No page errors or mobile horizontal overflow were observed. The bundled menu font was confirmed as loaded.
- Live browser movement measured approximately 114 world pixels per second; all four walk frames appeared, and the sprite returned to one idle frame at a blocking counter.
- Successive timed-spoon and hand-mixing captures have identical bowl-body pixels while the spoon region changes. Reduced-motion captures keep the entire bowl/spoon region identical.

Run Vite and open `http://localhost:5173/scripts/depth-preview.html` for all themes and the customer/order toggle. `scripts/mixing-preview.html` exercises spoon, hand-mix, shaker, pourer, and chopping actions. Updated screenshots are saved under `docs/` with `depth-`, `menu-`, `bartender-polish`, `shift-polish`, `pause-polish`, `spoon-stir`, and `hand-stir` names.
