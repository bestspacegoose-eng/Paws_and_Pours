# Bug and efficiency pass

This pass follows the House Specials work and retains its existing game rules, artwork, colors, and mobile control layout.

## Bugs fixed

- Local movement prediction could overwrite a new round's spawn, a resumed position, or a reconnected server position. Reconciliation now drops predictions at room, round, phase, pause, and reconnect boundaries. A released cat also stops overriding an acknowledged collision correction.
- A blur event after disconnection could queue a stale movement packet for reconnection. Offline movement emission is now blocked as well as offline input/prediction.
- Every incoming movement snapshot rebuilt recipe-choice and other modal contents. Focused or pressed controls could disappear mid-interaction. Modal rendering now depends only on the fields it displays; movement and patience updates leave its controls intact.
- A valid chopping choice became a dead end if another bartender started using the board before selection. That stale choice now closes with an explanation, preserving ingredients and the other bartender's session.
- Interacting away from a station changed only server-side message text without broadcasting it. The feedback is now delivered immediately.
- Leaving tutorial practice could show its old opening/loading message. Practice feedback and its dismissal timer are cleared on exit, and the original tavern's floor cache key is restored.
- Disconnected rooms and associated bookkeeping were retained indefinitely. Completely empty rooms now expire after **two hours**, with timers and inventory preserved throughout that reconnection grace period. Connected rooms are never expired by this cleanup. Device-local solo saves remain available independently.

## Efficiency changes

- Coalesce movement snapshots per room at 20 Hz. Four bartenders can still send their own movement input at 20 Hz each; the room publishes one combined authoritative snapshot instead of one for each cat. Inventory, tool actions, service, pause, and interaction feedback still publish immediately.
- Cache the static backdrop (floor, walls, rugs, decorations, and contact shadows) in one bounded 1088×712 canvas. Actors, counters/items, highlights, guests, hazards, and the gate continue to render live. The cache invalidates on layout, theme, or artwork-readiness changes.
- Preserve the floor painter's drawing state so existing foreground artwork renders consistently.
- Avoid repeated mobile-control DOM lookups and unchanged text writes. Ticket patience labels and progress bars only update when their values change.
- Reuse unchanged modal DOM, including recipe choosers and keepsake/results screens.

## Measurements

The four-client network check sent **40 movement packets** and observed **10 room snapshots**, a **75% reduction** against one snapshot per packet. All final positions were acknowledged, and immediate interaction/pause behavior passed. The observed serialized payload total was 92,514 bytes for that run.

The browser benchmark draws 120 backdrops directly and through the cache. This measures the scenery pass, **not total game FPS**:

| Theme | Direct | Cached |
| --- | ---: | ---: |
| Cozy | 96.7 ms | 5.8 ms |
| Haunted | 87.3 ms | 8.7 ms |
| Pirate | 99.8 ms | 11.4 ms |

The cache repainted its floor once per theme rather than 120 times. The comparison uses equivalent readback boundaries before foreground drawing to avoid GPU batching differences; both backdrop-only and complete-scene pixel comparisons found **zero different pixels** in all three themes. Results vary by device and browser.

[Measured JSON](efficiency-render-results.json) · [Rendering comparison](efficiency-render-comparison.jpg)

## Verification

- 108 unit tests pass, including seven new checks covering reconciliation, modal invalidation, floor invalidation, bounded caching, and room-retention boundaries.
- TypeScript checking and client/server production builds pass.
- All seven real-server suites pass: efficiency, multiplayer, recovery, hospitality, chopping, keepsakes, and seating. The multiplayer suite additionally exercises a real two-bartender chopping-choice race.
- The timing-sensitive chopping suite was run in isolation after a quality-threshold failure while the synthetic rendering benchmark was competing for resources; the isolated run passed without changing gameplay timing or weakening assertions.
- Browser checks covered live movement and pause, desktop/mobile rendering, tutorial entry/exit across different themes, and browser console errors. The checked game session produced no console errors.

To repeat: `npm test`, `npm run build`, `npm run test:efficiency`, and the existing smoke suites against a local production server. The visual benchmark is available through Vite at `/scripts/efficiency-preview.html`.

Changes remain local until deployed.
