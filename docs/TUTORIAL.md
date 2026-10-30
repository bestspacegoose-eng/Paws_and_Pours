# Opening tour

“Congratulations! You've opened your first tavern.” Aunt Juniper has left the player the keys, a recipe book, and a first guest. The 25-step tour follows that opening story through the real menu, game, workbench, recipe book, and keepsake interfaces.

## Entry and exit

- **How to play** on the title screen opens the tour without connecting to a server room.
- The first new solo shift opens it automatically before creating the real shift. Completion or skipping is remembered in `paws-pours-tutorial-v1`; existing saved shifts load directly.
- **Replay tutorial** in the solo pause menu returns to that same paused shift afterward, including any unfinished drink. Multiplayer guests use the title-screen tour before joining; replay does not pause or alter another player's room.
- **Back** and **Next** keep the same 25-step pacing. **Try it** opens a compact practice view; **Reset** restarts that step and **Show instructions** restores its full explanation. **Skip tutorial** exits at any step. Escape exits introductory/menu steps; during gameplay practice it demonstrates pause/resume instead. On an automatic first-run tour, either completion or skipping continues into the requested real shift. A manual title-screen tour returns to the title.

## Interface coverage

| Part of the story | Controls and concepts |
| --- | --- |
| Receiving the keys | Cat type, name, color, accessory, presets, three local save slots, quick solo, room codes, Ready, and the multiplayer host |
| Finding your paws | WASD/arrows, touch movement pad, Map/Follow, and the single contextual action button |
| Welcoming guests | Order tickets, drink and ingredient pictures, patience, table A/B seats, bar numbers, coins, reputation, hearts, and shift time |
| Stocking and preparing | Pantry locations, inventory, three-ingredient capacity, raw/chopped tuna, both mixing counters, Add buttons, preparation deadline, mistakes, Cancel, and pause |
| Mixing | Timing window, target line, hold/release tools, chopping beats, alternating paws, and multi-step recipes |
| Looking after the tavern | Correct guest delivery, safe drink placement/pickup, preserved quality, shared handoffs, cleaning sink, and scrap bin |
| Preparing for tomorrow | Shared pause/resume, recipe pages, display/audio settings, reduced motion, replay, and keepsakes |

The tutorial is interactive and untimed. Players can use WASD/arrows, E/Q, the touch pad, the contextual action button, Add buttons, keyboard Space/Enter holds, timed tools and alternating-paw/chopping beats. Preparation uses the real recipe and timing rules, with unlimited retries. Coins, drinks and cleaning update immediately in an isolated rehearsal. No exercise is required to continue, and nothing advances automatically.

## Implementation and presentation

- `client/tutorial-content.ts` contains the story, compact explanations, device-specific instructions, preview states, and a separate completion preference.
- `client/tutorial.ts` provides the non-modal coach, progress, keyboard focus loop, Try it/Reset, Back/Next/Skip and highlight outlines. Only the relevant controls are interactive. Focus can reach those controls and the coach; action feedback uses a polite status region. Instructions collapse when practice starts, and the compact card avoids touch controls, preparation buttons and timing bars.
- `client/tutorial-layout.ts` chooses a visible card position with minimal overlap with its target. Landscape cards widen for broad controls; viewport padding includes device safe areas. Off-screen rectangles are clipped.
- World highlights use the same projection and camera transform as the displayed board, including mobile follow/overview and desktop letterboxing. Counter highlights follow the raised surface rather than the next ingredient's row.
- `client/main.ts` temporarily renders an isolated preview state. It routes gameplay intents to `client/tutorial-practice.ts`, holds incoming real state separately, suppresses save/settings writes, and restores the user's mode, camera, settings, pause panel and state on exit. Replay also restores the saved player profile. No tutorial action reaches Socket.IO. Real save slots and room creation are represented without loading or creating an adventure.
- Workbench transitions reset local animation/timing UI; practice gestures use the real tool animation and timing windows without a preparation deadline. Restoring a paused workbench does not steal focus from the pause menu.
- Explanations use muted plum panels, cream text, the existing pixel heading font, 15–16px body text, restrained outlines, and 44px navigation targets. The tour reuses existing game art and fonts; it adds no new image or audio assets.

## Verification

- All 71 automated tests pass. New cases cover valid isolated scenes, real recipe-step previews, safe starting positions, concise content, card positioning, safe areas, completion/skip persistence, and unavailable browser storage.
- Every step was inspected at 1440 × 960, 390 × 844, 320 × 740, 844 × 390, and 1024 × 768. Cards and navigation fit the viewport and explanatory body text remains at least 15px. The compact practice view additionally keeps the active controls clear.
- Manual walkthroughs created no server room and left solo-save storage unchanged. Keyboard Tab reaches the relevant practice controls and coach. Escape pauses/resumes gameplay practice, and Skip remains available.
- Automatic first-run completion and skipping both entered a real shift and were remembered on reload. A new saved run did not store preview state, including during a simulated page exit; skipping saved only the real shift.
- Paused replay preserved the clock, coins, reputation, hearts, save bytes, and a partially prepared drink. A manual tour preserved the selected Multiplayer mode.
- The optimized menu still defers game media, reveals its background after decoding, and retains its existing panel width and position.
- Client/server TypeScript checks, production build, and `git diff --check` pass. Browser verification used Chromium mobile emulation, not physical devices or Safari.

## Review captures

- [Opening story on phone](tutorial-welcome-390.png), [desktop](tutorial-welcome-1440.png)
- [Pantry highlight](tutorial-pantry-390.png), [order ticket](tutorial-orders-390.png)
- [Timing guide](tutorial-timing-390.png), [hold button](tutorial-hold-390.png)
- [Landscape cleanup](tutorial-tidy-844.png), [landscape customization](tutorial-bartender-844.png)
- [Recipe book](tutorial-book-390.png), [settings entry](tutorial-settings-390.png)

Interactive review captures: [desktop](tutorial-interactive-1440.png), [phone](tutorial-interactive-390.png).
