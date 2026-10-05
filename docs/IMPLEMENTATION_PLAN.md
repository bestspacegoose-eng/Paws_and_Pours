# Current implementation plan

## Decisions

- **Solo mode:** a one-player local room uses the same authoritative server loop as a party. The browser saves only the solo profile and progress summary; party rooms never read or write local saves.
- **Wall collision:** the tavern floor is treated as a trapezoid, not a full canvas rectangle. The shared collision helper is used by both client prediction and the Socket.IO authority.
- **Hazards:** one serialized hazard entity drives the HUD warning and the in-world visual, preventing duplicated state.
- **Drink art:** recipe IDs map to atlas frames rather than to bespoke code paths. New drinks add a recipe and two atlas cells.

## Delivered phases

1. Audit existing rendering, input, shared simulation, mixing, assets, and room authority.
2. Replace the upper-wall rectangular traversal allowance with shared floor bounds; remove placeholder patron circles.
3. Add Scrap Bin disposal for ingredients and completed drinks, plus synchronized hazard world indicators.
4. Add a generated finished-drink atlas with idle/carry and completion-frame integration.
5. Add a title-menu foundation for solo/create/join, browser settings, and versioned solo-only local persistence.

## Follow-up milestones

1. Add genuinely resumable mid-shift snapshots only with a server-issued solo session token and validated restore endpoint.
2. Add controller navigation/rumble and real audio buses wired to the persisted volume settings.
3. Expand recipe action data with chopping, heating, garnishing, and station-side placement states.
4. Replace the three canvas-drawn hazard effects with a dedicated animated transparent raster atlas.

## Risks and safeguards

- Browser storage can be corrupted or unavailable, so saves are versioned, parsed defensively, and ignored when invalid.
- A browser-supplied multiplayer snapshot would violate server authority, so no party state is persisted/restored locally.
- The floor perspective varies by depth; edge bounds interpolate with player Y while counter collision remains exact one-cell shared geometry.
