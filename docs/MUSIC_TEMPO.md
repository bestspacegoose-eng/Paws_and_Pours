# Closing-time music

Tavern music stays at its original tempo until 30 seconds remain. It then accelerates along a smooth curve to 140% during the final five seconds. The stronger ease-out ramp is most noticeable during the closing half-minute, and `HTMLAudioElement.preservesPitch` keeps each track in its original key. There are no added alarms, pitch shifts, volume boosts, or track restarts at urgency thresholds.

`client/music-tempo.ts` defines the curve and bounds how fast the playback rate can change. `client/audio.ts` applies those small changes every animation frame rather than jumping at each server update. The rate holds while the game is paused; returning to the menu, finishing a shift, or starting a new shift restores normal tempo. Hidden tabs stop the ramp and resume smoothly. Shaker, spoon, pouring and other sound effects retain their original rates.

Music crossfades retain their fade volume across frequent game-state updates. Interrupted transitions pause older tracks so rapid tutorial/menu transitions cannot leave an extra song playing underneath.

Verification covers monotonic tempo, the 140% cap, frame-independent smoothing, normal menu/completion tempo, pitch preservation on all three decoded tavern tracks in Chrome, no backward playback-position jumps during a ramp, and a stable rate while paused. Browser testing uses the actual bundled music files.
