# Local solo data

`paws-pours-settings-v1` stores browser-local display and audio preferences. `paws-pours-solo-v1` stores a versioned solo profile and the latest run summary: coins, reputation, round, and phase.

The save is written only while the client has started a **solo shift**. Joining or creating a party sets multiplayer mode, which never reads or writes this key. The room server never receives local storage contents.

Malformed JSON, an unknown version, or a missing profile/summary is ignored safely. Future migrations must add a new explicit version reader; never reinterpret unknown structures as a current save. Deleting a save uses a browser confirmation and removes only `paws-pours-solo-v1`.

The current server-authoritative prototype preserves the solo bartender profile and progress summary, then starts a fresh local room when continuing. Mid-shift world snapshots are intentionally not restored because a server-owned live room cannot safely be recreated from untrusted browser state.
