# Mixing and square-counter verification

## Automated checks

Run from the repository root:

```bash
npm test
npm run build
```

The shared test suite validates:

- recipe matching independent of pickup order;
- deterministic tavern generation;
- complete illustration coverage for all seven drinks and stable ingredient selection at counter junctions;
- shared counter transfers that preserve drink quality and reject occupied hands/surfaces;
- authored pantry wings that spread every recipe across the floor, safe spawns, and reachable interaction points;
- unique in-bounds counter cells;
- exact square counter footprints;
- swept collision that cannot tunnel through a counter;
- circular paw collision that leaves visually open counter corners traversable;
- three-minute rounds and preparation-deadline adjustment after pausing;
- pixel-snapped hand-mixer motion and reduced-motion fallback;
- recipe-derived preparation steps;
- timed-tool acceptance and quality;
- rhythmic chopping and hand-mixing timing;
- progressive recipe unlocks and shorter later-order patience;
- heart and reputation penalties for missed orders;
- deterministic upgrade selection.

## Real server multiplayer smoke test

Build and start the game in one terminal:

```bash
npm run build
npm start
```

In another terminal:

```bash
npm run test:multiplayer
```

The script creates a host and guest against the actual Socket.IO server. It verifies a guest-triggered pause freezes both clients' shift clock, order patience, and movement, then resumes and gathers and serves the first live order. It also prepares Seafoam Shake to verify rhythmic chopping and alternating-paw hand mixing are evaluated on the server and synchronized to the guest.

Expected output includes `"ok": true`, the completed recipe, awarded coins, and two multiplayer assertions.

## Manual two-browser flow

1. Start the game with `npm run dev` and open `http://localhost:5173` in two separate browser tabs or windows.
2. Create a room in the first client, join its code from the second, then start the shift.
3. Walk the host to the three counters named by one recipe. Verify the cat stops at each visible square edge and never overlaps the block.
4. Walk to the Shaker & Brewer and press `E`.
5. Verify only the host transitions to the first-person workspace. The guest must remain in the tavern, show the host as “mixing a drink,” and continue moving/interacting.
6. Select a wrong ingredient once. Verify the mistake counter and feedback update without the client deciding the result locally.
7. Select the required ingredients in recipe order.
8. Press and hold the highlighted tool. Verify the loading bar fills live, the green band marks the forgiving sweet-spot, and the fine marker shows the exact target before releasing near it.
9. Verify the workspace shows its success transition, closes, and the HUD says the host is carrying the completed drink.
10. Walk to the Service Bell and serve the matching order. Verify coins/reputation update on both clients and drink quality affects the tip.
11. Open Lunar Fizz, Kelp Swirl, or Seafoam Shake. Verify the chopping or paw-mixing control and beat bar appear, accepted taps advance the visible counter, and early/late or wrong-paw taps count as mistakes.
12. Let an order expire, then leave an order unserved when a shift ends. Verify each costs one shared heart and reputation; the run ends at zero hearts. On the next shift, verify the order pool and patience become harder.
13. Check the shift starts at 3:00. Pause from either client (including the mixer header), verify both see the same pause menu and no time or patience passes. Open Settings and the illustrated Recipe Book, then resume from the other client.
14. During Kelp Swirl or Seafoam Shake, verify the mixing bowl, liquid, and paws sway continuously and react more strongly to each hit. Turn on Reduced motion and verify that movement stops while timing controls remain usable.
15. Start shifts in all three tavern themes. Verify the rear edge of each themed floor is visible, upper counters rest on floor tiles instead of the wall, and the pantry wings, central aisle, mixer, and service bell remain readable at both desktop and narrow widths. Walk between the left and right ingredients of each recipe without entering a hidden blocked area.
16. Finish mixing, approach an empty work surface and press Q. Verify both clients see the drink on the counter. Have the other player pick it up with E, set it down again, and serve it. Test occupied hands, an already occupied surface, and the shared pause.
17. With Vite running, open `/scripts/art-preview.html`. Inspect all 20 portrait/accessory combinations, all 64 direction/frame/accessory combinations, and seven drink illustrations. Hats and crowns follow the head; patches cover the selected eye; bow ties follow the neck and hide on back-facing frames.

## Failure and recovery cases

- **Cancel:** open a valid recipe, click Cancel, and verify the player returns to the tavern with all ingredients.
- **Three mistakes:** submit the wrong action three times and verify the workspace fails, closes, and consumes the ingredients.
- **Timeout:** leave the workspace idle for 45 seconds and verify it fails authoritatively.
- **Extreme tool timing:** release much too early or late and verify a mistake is recorded.
- **Duplicate pickup:** interact with the same ingredient twice and verify the second item is refused.
- **Discarding ingredients:** collect one or more ingredients, use the Scrap Bin, and verify only the carried ingredients are cleared; a finished drink must remain in paw.
- **Invalid full set:** take three ingredients that do not make a recipe, use the mixer, and verify the set is discarded so the player cannot become softlocked.
- **Reconnect:** disconnect during a session, rejoin with the same browser session, and verify the server-owned session is restored if it has not timed out.
- **Collision:** approach all four sides and a corner of standard, end-cap, corner, ingredient, mixing, service, and damaged blocks. Visible base and collision footprint must remain one cell.
- **Pause during preparation:** begin a tool hold or rhythm sequence, pause, wait more than the action's normal timing, then resume. The current gesture should restart without a mistake or deadline loss.

## Completed in this phase

- Server-authoritative individual mixing sessions with reconnect-safe serialized state.
- Ordered ingredient actions derived from existing recipe data.
- Three data-authored timed tools (shaker, spoon, pourer), rhythmic chopping and alternating-paw hand mixing, quality, cancel, mistakes, failure, timeout, and serving integration.
- Four additional recipes using existing ingredients, progressive order pressure, shared-heart penalties for expired and unserved orders, and the Nine Lives recovery keepsake.
- First-person 2D workspace with accessible DOM controls over a pixel-art canvas.
- Six new runtime raster assets plus reuse of all nine existing ingredient drawings.
- Deterministic square-grid stations, shared collision, floor-aligned counter placement, square item placement, and seven counter variants across all three themes.
- A synchronized Scrap Bin station for clearing carried ingredients plus a live, accessible tool-hold timing bar in the mixing workspace.
- Multiplayer state indicators and two-client smoke coverage.
- A shared server-authoritative pause menu containing settings and the illustrated recipe book, three-minute shifts, traversable paw-sized counter corners, and hand-mixing animation.
- Three matching themed floor-plan backgrounds and one authored pantry layout with accessible cross-room routes.
- Recorded high-level game roadmap, asset inventory, risks, and UI redesign plan.

## Intentionally deferred

- Further action types such as heating, freeform stirring, garnishing, and manual serving. The preparation-action union is the extension point.
- Theme-specific workspace backgrounds; the first slice uses one neutral workspace with runtime theme tinting.
- Controller/touch mappings, remapping UI, playable audio, persistence, host migration, spectators, and production rate limiting.
