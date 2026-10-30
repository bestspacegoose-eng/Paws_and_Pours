# Opening tour

“Congratulations! You've opened your first tavern.” Aunt Juniper has left the player the keys, a recipe book, and a first guest. The 25-step tour follows that opening story through the real menu, game, workbench, recipe book, and keepsake interfaces.

## Entry and exit

- **How to play** on the title screen opens the tour without connecting to a server room.
- The first new solo shift opens it automatically before creating the real shift. Completion or skipping is remembered in `paws-pours-tutorial-v1`; existing saved shifts load directly.
- **Replay tutorial** in the solo pause menu returns to that same paused shift afterward, including any unfinished drink. Multiplayer guests use the title-screen tour before joining; replay does not pause or alter another player's room.
- **Back** and **Next** navigate the guide. **Skip tutorial** and **Escape** exit at any step. On an automatic first-run tour, either completion or skipping continues into the requested real shift. A manual title-screen tour returns to the title.

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

This is a guided preview rather than a timed task sequence. The game beneath the explanatory card is inert while the tour is open. Tutorial navigation stays available throughout; the player can try the actual controls after exiting.

## Implementation and presentation

- `client/tutorial-content.ts` contains the story, compact explanations, device-specific instructions, preview states, and a separate completion preference.
- `client/tutorial.ts` provides the modal, progress, keyboard focus loop, Back/Next/Skip, and highlight outlines. The background interface becomes inert; explanations are announced through a polite live region.
- `client/tutorial-layout.ts` chooses a visible card position with minimal overlap with its target. Landscape cards widen for broad controls; viewport padding includes device safe areas. Off-screen rectangles are clipped.
- World highlights use the same projection and camera transform as the displayed board, including mobile follow/overview and desktop letterboxing. Counter highlights follow the raised surface rather than the next ingredient's row.
- `client/main.ts` temporarily renders an isolated preview state. It suppresses movement and save writes, holds incoming real state separately, and restores the user's mode, camera, pause panel, and state on exit. No tutorial event is sent to Socket.IO.
- Workbench preview transitions reset local animation/timing UI without sending preparation events. Restoring a paused workbench does not steal focus from the pause menu.
- Explanations use muted plum panels, cream text, the existing pixel heading font, 15–16px body text, restrained outlines, and 44px navigation targets. The tour reuses existing game art and fonts; it adds no new image or audio assets.

## Verification

- All 57 automated tests pass. New cases cover valid isolated scenes, real recipe-step previews, safe starting positions, concise content, card positioning, safe areas, completion/skip persistence, and unavailable browser storage.
- Every step was inspected at 1440 × 960, 390 × 844, 320 × 740, 844 × 390, and 1024 × 768. Cards and navigation fit the viewport, body text remains at least 15px, and no explanation overlaps its highlighted control in those layouts.
- Manual walkthroughs created no server room and left solo-save storage unchanged. Keyboard Tab stays inside the guide; Escape exits.
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
