# M1 — Instrumentation + journal

**State:** NEXT
**Read:** spec §6 (the log schema), §4.5 (journal + undo), §4.1 (layout)
**Do not read:** anything about the agent server, the model, Discord, or the card.

---

## Why this is milestone 1

It is not the fun part and it is first on purpose.

You have already, accidentally, built a perfect label source: **your own clicks.**

| Event | Label | `gm_action` |
|---|---|---|
| Accepted the card as-is | Positive | `accept` |
| Edited, then used | Positive, plus a quality signal (the diff) | `edit` |
| Rerolled | Weak negative | `reroll` |
| Opened, then dismissed | Weak negative | `skip` |
| Card expired unopened | Negative | `expired` |

Canonical form: `contracts/log-entry.schema.json`. `skip` was missing from both this
table and spec §6 until 2026-08-10, even though §5.4's card has always had a `[Skip]`
button — one of five outcomes was unlabelled, which is a hole in §9's denominator.

Log this on **every** card, from the first commit. After four sessions you have a real
labeled dataset from your actual table with zero annotation effort — and you can pick
your model and tune thresholds empirically instead of arguing about benchmarks forever.

Build it before you build anything clever. If you build it later, the first four sessions
are unrecoverable.

---

## Build

### 1. The log (`scripts/journal.js` or a sibling — your call, keep it small)

One append-only record per card, matching §6 exactly:

```json
{
  "ts": 1752300000,
  "subsystem": "random_encounters",
  "trigger": { "type": "gm_command", "text": "three days through the Thornwood" },
  "foundry_state": { "scene": "...", "combat": false, "selected": null },
  "entity_link": null,
  "provenance": { "tableId": "...", "roll": 14, "result": "Wolf Pack", "dice": "2d4=5" },
  "model": "qwen3.5-9b-q4km",
  "latency_ms": { "total": 1840, "model": 1200, "tools": 640 },
  "card_text": "...",
  "gm_action": "edit",
  "gm_edit_diff": "..."
}
```

Fields you cannot fill yet (`model`, `latency_ms`, `provenance`, `card_text`) get `null`.
**Write the full schema now anyway.** The point is that M6 and M7 have a slot to write
into, not that M1 fills every slot.

### 2. The transaction journal

Stored in a hidden world `JournalEntry`, or a world setting. **Append-only** — entries are
never mutated, only marked `reverted`.

```js
export async function beginTransaction(intent) {
  const touched = predictTouchedDocuments(intent);   // ← from the executor's declaration
  const snapshot = {};
  for (const uuid of touched) {
    const doc = await fromUuid(uuid);
    snapshot[uuid] = doc?.toObject() ?? null;        // null = didn't exist
  }
  return { id: intent.id, intent, snapshot, ts: Date.now(),
           chatMessageIds: [], rollback: () => restore(snapshot) };
}

export async function undoLast(n = 1) { /* §4.5 */ }
```

### 3. Undo, two layers

**Layer A — Foundry's native undo. Free, for placeables.**

```js
canvas.tokens.storeHistory("create", createdTokenDocs.map(d => d.toObject()));
await canvas.tokens.undoHistory();
```

Verified present v10–v14 on `PlaceablesLayer`. Covers tokens, tiles, walls, lights,
templates, drawings, regions. **Does not cover Actor data.**

**Layer B — your snapshot journal, for everything else** (i.e. actor data).

---

## Done when

- [ ] A record with the full §6 schema is appended for a simulated card, and survives a
      Foundry reload.
- [ ] `undoLast(1)` reverts a token placement via `storeHistory` / `undoHistory`.
- [ ] `undoLast(1)` reverts an actor-data change via snapshot restore.
- [ ] `undoLast(3)` works. **Undo is a stack, not a single step** — you will not notice a
      bad auto-action for thirty seconds.
- [ ] Reverted entries are *marked*, not deleted.

---

## Traps

**You have nothing to undo yet.** The token-placement executor is M7. Do not build it
early to satisfy this milestone. Either exercise undo against tokens you placed by hand
on the canvas, or write a throwaway test executor and delete it in M7. Say which you did
in `STATUS.md`.

**Resolve the spec's import inconsistency now.** §4.4 imports `{ beginTransaction, commit }`
as named exports but also calls `Journal.note(...)` as a namespace. Pick one — named
exports are simpler — and add `note()` to the module. Do not carry the ambiguity into M2.

**`predictTouchedDocuments` depends on a declaration that does not exist yet.** Each
executor must export `touches(args)`. In M1 there are no executors, so this function is
just the plumbing. Make it **throw loudly** if an executor has no `touches` export —
otherwise M7 will add one, forget the declaration, and undo will silently do nothing.

---

## Out of scope

The Interceptor (M2). The Panel (M3). Anything on the network. Anything involving a
model. Do not import midi-qol.

**Undo repairs state. It does not unsay words.** In v1 that is nearly free, because
nothing is published without the GM speaking it. Do not let a future session forget why.
