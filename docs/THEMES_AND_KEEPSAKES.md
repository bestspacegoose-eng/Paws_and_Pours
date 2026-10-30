# Tavern themes and working keepsakes

Each room now has a full material and furniture treatment in the moon tavern's painted pixel-art style.

| Tavern | Floors and walls | Counters, furniture, and details |
| --- | --- | --- |
| Cozy Village Pub | Cream stone kitchen, honey-oak dining planks, warm plaster and timber | Cream stone counters, inset oak cabinets, linen seats, warm arched windows, terracotta rug, brass lanterns and planters |
| Haunted Moonlit Inn | Original lavender tiles, worn stone dining floor, purple stone walls | Original moon cabinets, mint counters, lavender seating and rugs, moon windows and hanging plants |
| Pirate Cat Tavern | Slate kitchen, dark teak dining planks, whitewashed ship walls | Weathered teak counters, navy slatted cabinets, iron fittings, teal seats and rug, sea portholes, rope coils and ship lanterns |

The village and pirate workbenches also use their room's walls, windows, cabinets and countertops. Rugs remain plain with a single restrained border. Maps cycle through all three themes from a seeded starting point; the next shift always has a different theme.

## Tile mapping and scaling

- Sources: `client/assets/tilemap/theme-village-v2.png` and `theme-pirate-v2.png`, each 1254 × 1254 with transparent backgrounds and sixteen separate assets.
- Runtime images: `theme-village-v2.webp` (1,115,590 bytes) and `theme-pirate-v2.webp` (1,224,164 bytes), lossless WebP with preserved alpha. Source PNGs remain available for editing.
- Art was created using **builtin imagegen**, referencing `furniture-haunted-v1.png`. The complete generation prompts are preserved in [theme-art-prompts.json](theme-art-prompts.json). Original generated files remain in the generated-images directory.
- `client/theme-tiles-layout.ts` contains measured painted bounds for every asset, countertop split heights, and chair/stool cushion contact points. Frames are not inferred from equal atlas cells.
- Floors use opaque interior crops; counters use joined surface pieces and separate raised fascias. Two-seat tables use their own natural proportions rather than doubling a one-seat crop. All chairs retain a 46 px maximum height, tables 43 px, and counters the existing 22 px rise.
- The authoritative 58 px grid, 0.82 vertical projection, aisles, station locations, service destinations and collisions remain shared across themes. Customer bodies align with each theme's actual cushion height.
- New images load through the existing deferred game-asset loader. The title screen downloads neither atlas. The old village/pirate furniture sheets and generic fallback surfaces are no longer included in the runtime build.

Review captures: [village map](theme-village-v2.png), [moon map](theme-moon-v2.png), [pirate map](theme-pirate-v2.png), [village workbench](theme-village-workbench.png), [pirate workbench](theme-pirate-workbench.png).

## Keepsake behavior

One keepsake applies to the whole crew for the next shift, replacing the prior shift's bonus. The active effect appears beneath the shift/room label and is preserved by solo saves. Healing happens only at selection.

| Keepsake | Actual effect |
| --- | --- |
| Swift Paws | Movement speed × 1.2 for every breed, including Siamese. Animation still follows distance travelled. |
| Patient Patrons | Every new order receives twelve additional seconds, including the first order of the shift. |
| Lucky Whiskers | Serving a drink with preparation quality ≥ 0.88 awards two extra coins and player score. Applies to every recipe and preparation tool. Counter handoffs preserve quality and do not award coins. |
| Bottomless Bag | Four ingredient slots for pantry and prepared-tuna pickups. All matching recipes are detected. If two drinks match, a compact picker lets the player choose. Only the selected recipe's ingredients are consumed; the spare stays through success, failure, cancellation and drink handoffs. |
| Nine Lives | Restore one shared heart, capped at three. It is not offered when hearts are already full; repeated selection messages and save loading cannot heal again. |

The server validates recipe choices against the player's own bag and station. Movement and interactions stop while choosing. An unused ingredient is clearly marked “kept in bag” in the workbench and cannot be accidentally added as a wrong ingredient.

Existing saves retain their current room theme. Older Patient Patrons saves are migrated from their patience field. Four-ingredient saves require an active Bottomless Bag; saved recipe choices are recomputed for the new player identity.

## Verification

- 66 unit tests: movement multipliers at 30/60/144 Hz, all five effects, bonus expiry, reward thresholds, carry capacity, recipe subsets, spare retention, save migration, pending choices, full-heart offers, tile bounds and unchanged floorplans.
- `npm run test:keepsakes`: all five actual server selections and save/resume, duplicate-selection protection, fourth/fifth pickup limits, multi-recipe choice, spoof rejection, successful mixing, spare retention, handoffs, prepared-tuna capacity, failure preserves the spare, and perfect/ordinary service rewards.
- `npm run test:multiplayer`: shared state, pause, independent mixing, rhythm preparation, quality, serving and counter handoffs.
- `npm run test:seating`: paired table guests, individual chair service, bar orders, wrong-guest rejection and natural shared-table/bar arrivals.
- Browser checks at 320 × 740, 390 × 844, 844 × 390 and 1440 × 960: recipe picker bounds, spare button disabled, actual drink preparation, mobile place/pickup, no horizontal overflow or JavaScript errors. Title background still paints atomically, fonts stay local and game images remain deferred.
- Desktop keyboard movement confirms Swift Paws increases actual travel speed. The keepsake tutorial highlight stays clear of its explanation card at all four phone/desktop sizes.
- TypeScript client/server checks and production builds pass.

Mobile review: [recipe picker](keepsake-recipe-choice-390.png), [landscape picker](keepsake-recipe-choice-844.png), [bag workbench](keepsake-bag-workbench-390.png).
