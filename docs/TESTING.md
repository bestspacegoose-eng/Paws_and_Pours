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
- unique in-bounds counter cells;
- exact square counter footprints;
- swept collision that cannot tunnel through a counter;
- recipe-derived preparation steps;
- timed-tool acceptance and quality;
- customer patience calibrated for gathering plus mixing;
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

The script creates a host and guest against the actual Socket.IO server. It gathers the first live order's recipe, opens the host's workspace, proves the guest still moves while observing the host's mixing session, submits ingredients in recipe order, holds the recipe tool for the server target duration, verifies high drink quality, and serves the matching customer.

Expected output includes `"ok": true`, the completed recipe, awarded coins, and two multiplayer assertions.

## Manual two-browser flow

1. Start the game with `npm run dev` and open `http://localhost:5173` in two separate browser tabs or windows.
2. Create a room in the first client, join its code from the second, then start the shift.
3. Walk the host to the three counters named by one recipe. Verify the cat stops at each visible square edge and never overlaps the block.
4. Walk to the Shaker & Brewer and press `E`.
5. Verify only the host transitions to the first-person workspace. The guest must remain in the tavern, show the host as “mixing a drink,” and continue moving/interacting.
6. Select a wrong ingredient once. Verify the mistake counter and feedback update without the client deciding the result locally.
7. Select the required ingredients in recipe order.
8. Press and hold the highlighted tool, then release near the displayed target duration.
9. Verify the workspace shows its success transition, closes, and the HUD says the host is carrying the completed drink.
10. Walk to the Service Bell and serve the matching order. Verify coins/reputation update on both clients and drink quality affects the tip.

## Failure and recovery cases

- **Cancel:** open a valid recipe, click Cancel, and verify the player returns to the tavern with all ingredients.
- **Three mistakes:** submit the wrong action three times and verify the workspace fails, closes, and consumes the ingredients.
- **Timeout:** leave the workspace idle for 45 seconds and verify it fails authoritatively.
- **Extreme tool timing:** release much too early or late and verify a mistake is recorded.
- **Duplicate pickup:** interact with the same ingredient twice and verify the second item is refused.
- **Invalid full set:** take three ingredients that do not make a recipe, use the mixer, and verify the set is discarded so the player cannot become softlocked.
- **Reconnect:** disconnect during a session, rejoin with the same browser session, and verify the server-owned session is restored if it has not timed out.
- **Collision:** approach all four sides and a corner of standard, end-cap, corner, ingredient, mixing, service, and damaged blocks. Visible base and collision footprint must remain one cell.

## Completed in this phase

- Server-authoritative individual mixing sessions with reconnect-safe serialized state.
- Ordered ingredient actions derived from existing recipe data.
- Three data-authored timed tools (shaker, spoon, pourer), quality, cancel, mistakes, failure, timeout, and serving integration.
- First-person 2D workspace with accessible DOM controls over a pixel-art canvas.
- Six new runtime raster assets plus reuse of all nine existing ingredient drawings.
- Deterministic square-grid stations, shared collision, square item placement, and seven counter variants across all three themes.
- Multiplayer state indicators and two-client smoke coverage.
- Recorded high-level game roadmap, asset inventory, risks, and UI redesign plan.

## Intentionally deferred

- Additional action types such as chopping, heating, freeform stirring, garnishing, and manual serving. The preparation-action union is the extension point.
- Theme-specific workspace backgrounds; the first slice uses one neutral workspace with runtime theme tinting.
- A full pause/settings UI. Online sessions cannot truly pause; the planned menu is local UI state and is documented in `EXPANSION_PLAN.md`.
- Controller/touch mappings, remapping UI, audio, persistence, host migration, spectators, and production rate limiting.
