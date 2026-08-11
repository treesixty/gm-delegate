# M7 — The card, with Edit

**Read:** spec §5.4 (the card), §6 (the log — you close the loop here), §4.5 (undo)
**Depends on:** M6 (the proposal), M3 (the panel frame), M2 (propose mode), M1 (the log)

**This is the last milestone of the prototype.** After this, run four sessions and read §9
before deciding what any of it means.

---

## Build

`templates/card-encounter.hbs`, `scripts/executors/encounter.js`

```
┌─ WANDERING ENCOUNTER ─────────────────────── GM only ─┐
│ Thornwood table · d20 → 14 → Wolf Pack                │  ← provenance:
│ Foundry rolled 2d4 → 5 wolves                         │    Foundry decided,
│                                                       │    not the model
│ WOLVES ×5 — lean, winter-starved                      │
│ • Sound first: whining. Then silence.                 │  ← beats
│ • They circle. Pack tactics. No charge.               │
│ • Leader hangs back. Scarred muzzle.                  │
│ Hook: something worse drove them out of the deep wood.│
│                                                       │
│ [Accept & Place]  [Edit]  [Reroll]  [Skip]            │
└───────────────────────────────────────────────────────┘
```

**Show the provenance line.** It is not decoration. It is the visible proof that Foundry
decided and the model only reported — which is the claim the whole architecture rests on,
and the GM should be able to see it is true at a glance.

### The encounter executor

First real entry in the `EXECUTORS` allowlist. It **must** export `touches(args)` — the
declaration M1's `predictTouchedDocuments` depends on. If you forget it, undo silently does
nothing. M1 was built to throw loudly here; let it.

After creating tokens:

```js
canvas.tokens.storeHistory("create", createdTokenDocs.map(d => d.toObject()));
```

---

## `Edit` is mandatory and it is load-bearing

Read this before you decide to ship without it, because you will be tempted.

**Accept/Reroll alone is a slot machine.** Reroll gives a *different* thing, never the
*intended* thing. The GM has a reroll button and no steering wheel. After the third reroll
the GM writes it themselves and stops opening the panel — and then you have built a thing
that gets used twice and abandoned, and you will conclude the model was not good enough,
and you will be wrong.

`Edit` is the only option where **the GM's fingerprint lands in the output.** It is what
makes this augmentation rather than replacement-with-a-veto.

And it generates your best training signal: **the diff between what the model wrote and
what you kept is exactly the distance between its register and yours.** That diff is the
most valuable thing this entire prototype produces. Log it.

---

## Close the instrumentation loop

M1 built the schema. M7 is where it finally gets filled. Every card logs:

| GM click | `gm_action` | Label |
|---|---|---|
| Accept & Place | `accept` | Positive |
| Edit, then use | `edit` + `gm_edit_diff` | Positive, plus a quality signal |
| Reroll | `reroll` | Weak negative |
| Card expired unopened | `expire` | Negative |

**`expire` is a real event and it is easy to forget.** A card nobody opened is a negative
label, and it is silent. Wire the timeout.

---

## Done when

- [ ] `propose` mode renders the card in the panel.
- [ ] **Accept & Place** creates tokens on the active scene, and `undoLast(1)` removes them.
- [ ] **Edit** opens an editor, and the diff between model output and GM-kept text is
      logged to `gm_edit_diff`.
- [ ] **Reroll** re-runs the agent and logs a `reroll` on the discarded card.
- [ ] **Skip** logs and dismisses.
- [ ] An unopened card **expires** and logs `expire`.
- [ ] The provenance line matches the actual tool-call trace. Check one by hand.
- [ ] Median latency, GM prompt → card on screen, is **< 5 s.** Measure it. It is a kill
      criterion.
- [ ] The encounter executor exports `touches()`, and undo actually works.

---

## Traps

**`place_encounter` must be callable only after acceptance.** Enforce in the Interceptor,
not the prompt.

**Delete M1's throwaway test executor** if you wrote one. Check `STATUS.md`.

**Undo repairs state; it does not unsay words.** Here that is nearly free — nothing was
published unless the GM spoke it. That is a property of the design, not luck. Do not build
anything that publishes without the GM's mouth in the loop, and this stays true.

---

## After M7 — stop and read §9

Four sessions. Then check, honestly:

| Measure | Threshold | If you miss it |
|---|---|---|
| Accept-without-edit rate | **> 50%** | **Stop.** A wandering encounter is the lowest-stakes, most procedural, most recoverable thing in the whole taxonomy. If you will not trust the model with *that*, you will never trust it with a monster's turn, and the toggle matrix is a solution to a problem nobody has. |
| Median latency | **< 5 s** | Cut an orchestration hop. It is not the hardware. |
| Tool-call validity | **> 95%** | Prune the surface, tier up, or route to Claude. |

You wrote these down before you were emotionally invested. Honour them.
