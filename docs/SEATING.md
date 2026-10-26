# Customer seating and faster movement

Every dining table now spans two cells and has two chairs, identified as A and B on order tickets. The four bar stools each link to a numbered serving counter. Arrivals reserve individual seats; two customers can share a table without sharing an order. The arrival rotation visits a table, a bar stool, and the table's other chair. The existing active-order limits remain two in solo and three with multiple connected players.

The counter or either chair accepts service. A chair matches only its own guest; a table accepts a matching drink for either guest and prioritizes the more urgent order when both recipes match. Serving one guest leaves their neighbor's order and seat intact. Bar guests can be served from the kitchen side or at the stool. Wrong deliveries retain the drink.

Lime, cream, tonic, and tuna are on the kitchen's left side; catnip, stardust, kelp, and moonmilk are along the back. No pantry ingredients remain on the guest-facing bar or dining furniture. Both halves of a table have reachable interaction points, and the three-cell kitchen/dining passage stays open.

NPCs use a seated crop of the existing character art, centered using the body anchor rather than the sprite's transparent padding or tail. Their bodies meet the chair or stool cushion; the furniture's front edge draws over the lower body. Bar guests face the counter. Chairs and stool legs stay fixed across all three map themes.

Ordinary cats now move at **224 world pixels/second**, up from 112; Siamese moves at **272**, up from 136. Keyboard and touch use the same movement calculation. Walking animation continues to follow distance traveled, including the idle pose when blocked.

Solo saves preserve both customers at a table and bar customers. Older orders without a seat ID acquire a free seat at their existing table. Duplicate seats and seats linked to the wrong table are rejected; saved geometry is regenerated from the current map.

## Verification

- All 50 unit tests pass, including seat allocation/reuse, shared-table and bar service, multi-cell collision/reach, save migration, sprite positioning, and frame-rate-independent doubled speed.
- `npm run test:seating` passed five delivery scenarios and a live two-client arrival sequence that seated two customers at Table 1 and one at Bar 1.
- `npm run test:multiplayer` passed preparation, counter handoff, matching-table delivery, rhythm actions, and shared pause on the updated map.
- Chromium mobile emulation at 514 × 801, 390 × 844, and 844 × 390 showed both table tickets and the bar ticket, no horizontal document overflow, and successful touch delivery leaving the neighboring guest in place.
- Desktop keyboard measurement was approximately 223 world pixels/second, with changing walk frames and a single idle frame when blocked.
- Client/server TypeScript checks, production build, and `git diff --check` pass. Physical phones and Safari were not used.

## Captures

The theme previews deliberately fill all twelve seats to inspect alignment; normal gameplay retains its existing order limits.

- [Cozy](seating-cozy.png), [Haunted](seating-haunted.png), [Pirate](seating-pirate.png)
- [514px phone](seating-mobile-514.png), [390px phone](seating-mobile-390.png), [Landscape phone](seating-mobile-844.png)

Use `/scripts/depth-preview.html` and enable **Show customers and orders** to inspect the full seating layout. The server checks accept `SMOKE_SERVER_URL` to target an isolated local server.
