# Rubric improvement pass

Implemented in order: execution, creativity, value, then polish. Existing pixel art, tavern colors, three-minute shifts, and the single mobile action button are retained.

## 1. Execution

- Fix the disconnect handler: Socket.IO has already removed the socket from its namespace when `disconnect` fires. Read its retained room/token data and check ownership instead.
- Transfer host authority to a connected bartender. Disconnected reserved seats do not prevent two ready connected bartenders from starting.
- Pause the entire shift if everyone disconnects. Rejoining restores state and waits for an explicit Resume. A room with connected players continues normally.
- Reset interrupted tool holds and rhythm gestures without inventing mistakes. Retain recipe progress and inventory.
- Stop client movement prediction and gameplay actions while offline or waiting for authoritative rejoin. Show a persistent connection screen with Retry and Return to title.
- Validate initial profiles, room codes, and missing movement payloads. A replacement connection cannot leave the old socket in control of the same cat.
- Keep unmatched recipe ingredients. Players can change their set using counters or choose to discard it.
- Show illustration-loading progress and a separate connection status.

Checks: recovery unit tests; `npm run test:recovery` exercises malformed events, disconnected host migration, disconnected reserved seats, inventory preservation, empty-room pause, rejoin, and disconnect during a tool hold on the real server.

## 2. Creativity

Every third arrival is a **House Special**, introduced after two ordinary orders. Its recipe uses the chopping board, respects recipe-tier progression, and gets 20 extra seconds of patience.

- Multiplayer: at least two bartenders contribute through gathering, chopping, mixing, or final service to earn **4 bonus coins** and one warmth.
- Solo: preparation quality of **88% or better** earns the same bonus and warmth. Lower-quality specials remain valid ordinary deliveries.
- Three warmth earns a brief **tavern toast**, **6 shared coins**, and resets warmth to zero.
- Ingredient and drink provenance follows actual work through chopping and countertop transfers. Repeated passing creates no new contributors. Final service pays only once because its server-owned order is removed.
- Warmth, special orders, and metrics survive solo saves; contributor IDs are remapped to the new solo player identity. Invalid counts are rejected. A save cannot manufacture a multiplayer bonus in solo.

Checks: hospitality and handoff unit tests; the multiplayer smoke test now gathers an ingredient with the guest, hands it to the host, prepares a real special, serves it, verifies synchronized rewards, and checks repeated service does not pay twice. `npm run test:hospitality` verifies the solo quality boundary, third-warmth celebration, closing reports, keepsakes, and the next themed shift.

## 3. Value

Successful and unsuccessful shifts produce a report of guests served, perfect drinks, specials, shift earnings, missed orders, cleanup, and toasts. Contributions name each bartender's gathering, chopping, mixing, and serving work. A short suggestion responds to missed orders, accuracy, or unused special bonuses.

The next shift resets its live counters and retains the prior report. Keepsake choices explain exact effects, including the before/after heart count for Nine Lives. The active keepsake remains visible during play.

Checks: shift-report content tests, saved-report validation, and actual shift-close/keepsake progression in the hospitality smoke test.

## 4. Polish and thoughtfulness

- Tickets show patience seconds and an urgent exclamation/underline in addition to color. The last 30 seconds have an explicit LAST marker alongside the existing pitch-preserved music acceleration.
- A ticket opens its matching recipe and pauses the room. A small star marks a special; its full explanation is available from the warmth readout or the pause menu.
- Counter feedback distinguishes occupied drinks, occupied ingredients, duplicate ingredients, and inventory capacity. Chopping-board duplicate pickups are also explicit.
- Toasts wrap, use a readable duration, and cancel old dismissal timers. A warmth celebration is short and never blocks input.
- Dialogs contain keyboard focus. Disconnection immediately disables gameplay and focuses recovery actions.
- Cat descriptions no longer promise unimplemented carrying, luck, or team bonuses.
- Mobile reports use two metric columns and vertical keepsake choices. Short landscape dialogs compact their spacing and remain scrollable.
- The tutorial retains its existing 25-step structure with updated concise wording.

## Release verification

Run `npm test`, `npm run build`, and the multiplayer, recovery, hospitality, chopping, keepsake, and seating smoke scripts against a local production server. Check desktop, 320px and 390px portrait, and short landscape viewports.

These changes are local until deployed. Automated checks and browser verification do not replace uncoached human playtests or establish a particular judging score.

Verified in this pass: **101 unit tests**, TypeScript checking, client/server production builds, and all six real-server smoke suites passed. Browser checks covered 1280×800 desktop, 320×740 and 390×844 portrait, and 844×390 landscape. The narrow-phone game retained one action button and a 394px-high board viewport. Order-tap recipe opening, shared pause, keyboard focus containment, offline recovery, missing-room recovery, and mobile tutorial order/keepsake steps were exercised. No console errors appeared in the checked final-build browser session.

HUD spacing now follows the measured header height, allowing the active keepsake label to expand without overlapping tickets. Portrait and landscape dialogs remain within the viewport; compact landscape special help fits its primary action without scrolling.

Visual records: [phone game](rubric-mobile-320.jpg), [desktop special](rubric-desktop-special.jpg), [phone tutorial](rubric-tutorial-mobile.jpg).
