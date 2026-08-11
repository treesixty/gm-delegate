# M4 — EventBus

**Read:** spec §4.6 (EventBus), §10 (the open question below — read it *before* you build)
**Depends on:** M5's socket for delivery — see Traps. Build order here is soft.

---

## Why this matters

Foundry hooks are the **trigger channel**. This is how the agent knows anything is
happening at all. (The voice transcript, in v2, will only ever be *context* — never a
trigger. Do not invert that.)

---

## Confirm this before you build

**OPEN (§10): does the table type in Foundry chat at all?**

If all dialogue is voice but rolls still happen in Foundry, then `createChatMessage` still
carries rolls and targets — which is most of the trigger signal, and M4 is worth building.

If nothing happens in Foundry chat, `createChatMessage` is near-worthless and this
milestone shrinks to `controlToken` + `updateCombat`.

**Answer this by looking at a real session's chat log before writing code.** Record the
answer in `STATUS.md`. It changes what M4 is.

---

## Build

`scripts/eventbus.js`

```js
const HOOKS = [
  ["controlToken",      (token, ctrl) => ctrl && emit("token.selected", { actorId: token.actor?.id })],
  ["createChatMessage", (msg)         => emit("chat.message", extractRoll(msg))],
  ["updateCombat",      (c, chg)      => emit("combat.turn", { round: c.round, turn: c.turn })],
  ["canvasReady",       ()            => emit("scene.active", { sceneId: canvas.scene?.id })],
  ["updateToken",       (t, chg)      => "x" in chg || "y" in chg ? emit("token.moved", {...}) : null]
];
```

### `controlToken` is the single highest-signal event in the system

The GM selecting the innkeeper's token predicts *"I am about to need this NPC"* better
than any amount of transcript classification. It is free, and it fires **before** the need
rather than after.

If you build only one hook, build this one. If the others turn out noisy, cut them. Do not
cut this one.

---

## Done when

- [ ] `controlToken`, `createChatMessage`, and `updateCombat` reach the agent server and
      are visible in its log.
- [ ] `extractRoll` pulls the actual dice result out of a `ChatMessage`, not the rendered
      HTML.
- [ ] Events are emitted, not awaited. A slow or dead agent must not stall the GM's canvas.
- [ ] The bus is silent when the agent socket is down. No exceptions thrown into Foundry's
      hook loop.

---

## Traps

**M4 needs M5's socket to deliver anything.** Either build M5 first and come back, or emit
to a local buffer and flush when the socket appears. Both are fine — say which in
`STATUS.md`. The spec's build order lists M4 before M5; that ordering is soft and you
should not contort the code to honour it.

**Do not throw inside a Foundry hook.** An exception in `controlToken` breaks token
selection for the GM, mid-session, and they will not know why. Catch at the bus boundary
and log — but log *loudly*, do not swallow silently.

**Do not add a transcript hook.** Not even a stub. That is v2, it is gated on the offline
harness clearing 80% recall, and a stub here is how it becomes load-bearing before it is
validated.

---

## Out of scope

The Discord bot. Whisper. Any voice input at all. Entity linking. The agent's *reaction*
to events (that's M6) — M4 only has to deliver them.
