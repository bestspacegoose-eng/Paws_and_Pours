# Mobile gameplay, fur color, and mixing alignment

## Pouring and preparation scenes

`client/mixing-layout.ts` records the painted cup bounds and pouring geometry; `client/minigame-art-layout.ts` supplies the new tool atlas's measured bounds and spout anchor. Each glass has a mouth anchor rather than sharing the center of an atlas cell. The mug's handle padding is accounted for. The pourer rotates about its spout, stays above or beside the glass throughout the tilt, and starts its stream after lining up with the opening. The stream ends inside the opening; the foreground of the cup is drawn over it so it cannot show through the wall.

The other scenes use the same measured art bounds. Shakers sit clear of the receiving glass; spoon and rhythm bowls keep their separate serving glass to one side. Ingredients are shown during ingredient selection, and chopped pieces stay inside the chopping board. Spoon movement remains independent of the stationary bowl. Pause and reduced-motion behavior are retained.

`scripts/mixing-preview.html` now exposes every recipe and every preparation action, plus reduced motion, for repeatable inspection.

## Chosen fur color

`client/fur-color.ts` recolors the walking sheet's fur using a mask based on the per-frame head, tail, and paw anchors. It preserves alpha, shading, clothing, eyes, and outlines. `client/main.ts` caches a recolored sheet for each chosen color and uses each player's own color when drawing them. The old faint overlay followed by another draw of the source art has been removed.

## Touch gameplay and layout

- Drag the movement pad to walk; release, cancel, pause, or background the page to stop.
- Use **Interact** at stations and **Handoff** to place or pick up a finished drink.
- **Map** shows the entire tavern; **Follow** returns to the following camera.
- The HUD and horizontally scrollable order tickets stay above the scene. Portrait controls reserve their measured height below it. Landscape controls sit in side gutters, clear of the playable viewport.
- Phone/tablet layouts account for viewport changes and safe-area insets. Name fields use 16px text. Character selection, local saves, settings, pause, upgrades, and the recipe book remain scrollable. The recipe book uses readable text pages on small screens instead of shrinking a full illustrated canvas.
- Mixing tool buttons capture touch pointers, with large hold/tap targets. Timing/status content sits outside the art on small screens. Landscape workbenches use separate scene/action columns.
- Desktop keyboard controls and the full-board view remain available. Keyboard and touch walking now advance at 224 world pixels per second for ordinary cats, doubled from 112; Siamese advances at 272.

The client uses the current origin for Socket.IO. Vite proxies `/socket.io` to the game server in development, so a phone can use the development server's network address. Production continues to use the single Node service origin.

## Menu position

The “Enter the tavern” panel is 28px lower on desktop and 20px lower in the narrow phone layout. Its width and internal button geometry are retained. At 1440 × 960, the panel remains 380px wide and begins at y=277.6px.

## Verification

42 automated tests pass, covering pouring geometry through the entire tilt for all three glasses, stream alignment, chosen-color pixels and protected clothing, touch dead zone/normalization, camera bounds, movement, collisions, saves, recipes, and preparation timing. Production build, client and server TypeScript checks, and `git diff --check` pass.

Chromium mobile emulation covered 320 × 740, 390 × 844, 844 × 390, and 1024 × 768. These checks confirmed actual touch movement and release, the chosen blue color in both server state and rendered fur pixels, overview/follow, pause, settings, recipe navigation, and no horizontal document overflow or page errors. Physical-device and Safari testing were not performed.

All ten preparation actions across seven recipes were exercised at desktop, phone portrait, and phone landscape sizes. Three real drinks—Moonmilk Latte, Tuna Tonic, and Kelp Swirl—were completed through touch events against the server in isolated local-save sessions; each completed drink was placed on and picked up from a counter. Desktop keyboard walking measured approximately 111 pixels per second and returned to an idle frame at a blocking counter. The existing two-client smoke test passed, including shared pause, independent movement during mixing, counter handoffs, rhythm actions, and delivery to the correct table.

## Review captures

- `docs/alignment-tuna-0-canvas.png`: spout, stream, and cup alignment.
- `docs/live-touch-tuna-844.png`: a live landscape touch pour.
- `docs/live-touch-moonmilk-390.png`: a live portrait spoon hold.
- `docs/alignment-lunar-fizz-0-canvas.png`: chopping geometry.
- `docs/alignment-kelp-swirl-0-canvas.png`: rhythm spoon/bowl geometry.
- `docs/mobile-game-390.png` and `docs/mobile-game-844.png`: touch controls, camera, and chosen blue fur.
- `docs/mobile-recipes-390.png`, `docs/mobile-settings-320.png`, and `docs/mobile-selection-390.png`: supporting mobile screens.
- `docs/menu-panel-lowered.png`: unchanged menu sizing with the lower position.
