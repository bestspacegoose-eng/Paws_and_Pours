# Menu loading and one mobile action

The mobile HUD now has one contextual action button beside the movement pad. It gathers ingredients, opens mixing, chops, serves, cleans, discards, and places or retrieves finished drinks. Map/Follow remains a navigation control. The landscape camera gains the space previously reserved for the second action button.

`shared/interaction.ts` defines when a work surface should transfer a drink. Both the server's Interact event and the client label use it, so a finished drink can be placed at pantry and mixing counters as well as ordinary counters. Retrieving it preserves quality. Full paws and occupied surfaces reject overwrites. Desktop E has the same behavior; Q remains an optional shortcut.

## Loading changes

- Menu PNGs are retained as source art; full-resolution WebP copies are used at runtime. The intro image shrank from 2,131,969 to 243,010 bytes, and the bartender background from 1,873,274 to 201,926 bytes—approximately 89% smaller. The existing scene composition, palette, and button geometry are retained.
- The title image is preloaded at high priority in the HTML. `client/menu-scene.ts` decodes each background before applying it to the screen, preventing partially painted rows. Controls remain usable while the image arrives.
- `client/game-assets.ts` registers game images without starting their downloads over the title screen. After entering bartender selection, its background finishes first, then game art warms while the player chooses a cat. Shift entry waits for outstanding image loads and decodes; failed downloads can be retried.
- Cat portraits load when selection is entered. Hidden preset images use lazy loading.
- Audio uses `preload="none"`; tracks and effects download when played rather than competing with the title background.
- Existing DM Mono, Fraunces, and Nunito fonts are bundled as local WOFF2 files with their licenses. Pixelify Sans is preloaded locally. The blocking external font stylesheet has been removed.
- Art and mixing preview pages explicitly load their assets before declaring readiness.

## Measured result

A fresh Chromium mobile context at 390 × 844 used a disabled cache, 100ms latency, and 500,000 bytes/second download throughput (4 Mbit/s), against the Vite production preview. These are individual local measurements, not guaranteed device load times. Raw results and asset sizes are in [menu-loading-metrics.json](menu-loading-metrics.json).

| Measurement | Before | After |
| --- | ---: | ---: |
| Menu controls visible | 0.57s | 0.60s |
| Intro background download complete | 37.28s | 1.11s |
| Media requests before background capture | 44 | 1 |
| Response-body data received before capture | 18.66 MB | 0.58 MB |

The optimized title screen requests neither game art nor audio before interaction. A deliberately delayed image remained absent until fully decoded, then appeared in one paint. Both phone and desktop tests retained the menu's geometry; at 1440 × 960 the panel is still 380px wide and starts at y=277.6px.

## Verification

- All 53 unit tests pass, plus client/server TypeScript checks, the production build, and `git diff --check`.
- The two-client multiplayer smoke test now places and retrieves a drink through Interact at each of the three surface types, in addition to gathering, mixing, serving, pause, rhythm actions, and counter handoffs.
- Nine real touch scenarios covered ordinary, pantry, and mixing counters at 320 × 740, 390 × 844, and 844 × 390. Each used exactly one action button, preserved drink quality, stayed within the viewport, and disabled interaction while paused.
- Moonmilk Latte, Tuna Tonic, and Kelp Swirl completed through touch events, followed by placement and pickup with the same button.
- A held-decode check confirmed shift entry waits even after image dimensions become available. A failed-download check confirmed the start button recovers and a second attempt succeeds.
- Browser checks used Chromium mobile emulation; physical phones and Safari were not tested.

## Review captures

- [Desktop menu](menu-optimized-1440.png), [phone menu](menu-optimized-390.png)
- [Small phone action](mobile-one-action-320.png), [portrait action](mobile-one-action-390.png), [landscape action](mobile-one-action-844.png)
