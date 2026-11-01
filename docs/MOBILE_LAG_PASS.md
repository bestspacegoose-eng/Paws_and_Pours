# Mobile walking responsiveness

## Changes

- Cache stationary counters, tables, chairs, and seated guests in bounded strips by depth row. The player, nearby-station highlight, bar gate, and hazards continue to draw live so depth and gameplay state remain current. Item or guest updates repaint only the row they affect.
- Clip the cached scene to the phone camera and skip rows outside the current view. The Map overview still draws every row.
- Cap mobile scene drawing at 60 frames per second. Movement still uses elapsed time, so walking distance does not depend on the device refresh rate; desktop rendering remains uncapped.
- Limit the mobile canvas backing buffer to at most 1.5 device pixels per CSS pixel and roughly 480,000 pixels total. At 390×486 CSS pixels and a device pixel ratio of 3, this uses 585×729 backing pixels instead of 1170×1458, cutting that buffer's pixel work by about 75% while keeping text at native DOM resolution.
- Keep the touch joystick engaged through browser viewport resizes caused by the address bar. It resets on release and on actual control-layout changes.
- Avoid repeated DOM lookups and unchanged HUD writes during the 20 Hz state updates.

## Join Game menu sizing

The room-code field now takes the remaining width and the Join Game button gets its width from its label, with a 112 px minimum. The label stays on one line on narrow screens.

## Verification

- `node --import tsx --test tests/*.test.ts`: 114 tests pass. The mobile-specific cases check the canvas budget, 30–144 Hz walking distance, 60 Hz pacing, depth ordering, row invalidation, guest updates, and full-map rendering.
- `tsc --noEmit`, client production build, and server TypeScript build pass.
- The 120-frame browser scene benchmark found roughly 3.5–4.2× faster cached station-scene drawing in its latest run, with zero station repaints during repeated movement frames. Item updates repainted their affected row. This is a scene-render comparison, not a claim about total FPS on every phone.
- Full-scene pixel comparison recorded two pixels above the 12-channel threshold out of 774,656 pixels for each of the Cozy and Haunted themes (maximum channel difference 23); the benchmark permits up to four such pixels and 24 channel levels for alpha-compositing differences. Pirate showed none.

Movement speed, order timers, and multiplayer snapshot cadence are unchanged. Changes are local and have not been deployed.
