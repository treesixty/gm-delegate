# M3 — The Panel

**Read:** spec §4.7 (the Panel), §4.3 (PolicyStore — you write to it)
**Depends on:** M2 (`modeFor`, policy settings), M1 (`undoLast`)

---

## Why this matters

This is where the GM keeps control of their own game. **You should never have to fight
this thing.** Every design choice below follows from that.

---

## Build

`ApplicationV2` — Foundry v14. V1 `Application` is deprecated. **Verify the exact import
path against `foundryvtt.com/api` when you start**; it moved between versions and the
spec does not pin it.

Docked at the top of the GM screen. GM-only.

```
┌────────────────────────────────────────────────────────────────┐
│  ENC ●propose   LOOT ○off   NPC ○off   CMB ○off   [ RECLAIM ]  │
├────────────────────────────────────────────────────────────────┤
│  (queued cards render here)                          [undo ⟲]  │
└────────────────────────────────────────────────────────────────┘
```

Files: `scripts/panel.js`, `templates/panel.hbs`, `styles/gm-delegate.css`.

### Chips

Each chip cycles `off → propose → auto` on click, writing to PolicyStore.

### RECLAIM — the one that has to be right

One click, and it:

1. Sets `sceneOverride = "all_off"`
2. **Purges the queue** — every pending card, gone
3. Sends `POLICY_REVOKED` to the agent
4. Writes a marker to the journal

**It is sticky.** Control does not come back until the GM explicitly hands it back. There
is no timeout, no auto-restore, no "resume?" prompt. If the GM hit RECLAIM, something was
going wrong at their table and they should not have to argue with a UI about it.

### Context menus

- Right-click a combatant in the tracker → **"I'll take this one"** → sets
  `combat_tactics.decide = off` for the scene.
- Right-click an NPC token → **"I'll voice this one"** → writes `actorOverrides`.

### Undo

`undo ⟲` opens the journal and lets the GM revert the last N. Not the last 1 — **N.** You
will not notice a bad auto-action for thirty seconds. Show the log.

---

## Done when

- [ ] Chips cycle `off → propose → auto` and the change persists across a reload.
- [ ] RECLAIM purges the queue and is **sticky** — reload, change scene, nothing brings
      delegation back except an explicit re-enable.
- [ ] RECLAIM writes its marker to the journal.
- [ ] `undo ⟲` shows the journal and reverts the last N.
- [ ] The panel is invisible to non-GM users.

---

## Traps

**`POLICY_REVOKED` has nowhere to go yet** (the socket is M5). Stub the send. But wire the
*local* half of RECLAIM fully — the purge and the sticky flag are what protect the GM, and
they do not depend on the agent existing.

**Do not build the card renderer here.** M3 is the frame and the chips. The card is M7.
Queued cards can render as `JSON.stringify` for now — ugly is fine, ugly is honest.

---

## Out of scope

The encounter card and its Accept/Edit/Reroll/Skip buttons (M7). The WebSocket (M5).
Any subsystem other than the chips' policy state — LOOT, NPC, CMB chips write policy, but
nothing reads that policy yet, and that is correct.
