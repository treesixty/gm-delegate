# M6 — EncounterAgent, five tools

**Read:** spec §5.2 (tool surface), §5.3 (system prompt), §1.4 (hard bans)
**Depends on:** M5 (ModelClient, socket)

---

## Why five tools

**Five tools is the entire surface. This is not tidiness.**

Tool-selection error grows with surface size. A 9B choosing among five is a fundamentally
easier problem than a 9B choosing among seventy-one. **The pruned surface is what makes
local viable at all.** Every tool you add taxes every call.

Tool-call validity has a **>95% kill criterion.** If you miss it, the spec's remedy list is:
prune the surface *further*, move up a model tier, or route this subagent to Claude. Note
that "add a tool to make it easier" is not on the list.

---

## Build

```json
[
  { "name": "list_roll_tables",
    "description": "List roll tables in the world. Filter by name substring.",
    "parameters": { "filter": "string?" } },

  { "name": "roll_on_table",
    "description": "Roll on a table. Foundry performs the roll. Returns the drawn result and the dice that produced it. Does NOT display to chat.",
    "parameters": { "tableId": "string" } },

  { "name": "get_compendium_actor",
    "description": "Fetch one statblock by explicit ID from a named pack. Single lookup only.",
    "parameters": { "packId": "string", "actorId": "string" } },

  { "name": "propose_encounter",
    "description": "Emit an encounter proposal card for the GM. Does not place anything.",
    "parameters": { "creatures": "array", "beats": "array", "hook": "string", "provenance": "object" } },

  { "name": "place_encounter",
    "description": "Place tokens on the active scene. Only callable after GM accepts a proposal.",
    "parameters": { "proposalId": "string" } }
]
```

**Deliberately absent, and staying absent:** `send_chat_message` (there is nothing to send —
the GM speaks), anything that writes to an actor, `search_all_compendiums`.

`get_compendium_actor` takes an **explicit pack and ID. It cannot sweep.** That is Foundry
AI policy §1.1 discipline. It costs nothing now and it preserves the option to list this
module publicly later without a rewrite.

---

## The system prompt (§5.3, verbatim — do not "improve" it)

```
You prepare material for a human Game Master who is speaking aloud to players
over voice. You never speak to the players. Everything you produce is read,
silently, by the GM, who then improvises in their own voice.

Therefore: never write prose. Never write a paragraph. Never write a sentence
the GM is meant to read aloud verbatim. Write BEATS: short fragments the GM
can perform from.

You do not decide what happens. Foundry decides. You call roll_on_table and
report what it rolled. If you find yourself computing a number, stop: that is
a bug.

Output shape, always:
  - creatures: what Foundry actually rolled, verbatim, with the dice shown
  - beats: 3 to 5 fragments. A sound. A posture. A tactic. A detail.
  - hook: one line. Why is this here? What does it imply about the world?

Length target: under 60 words total. If you are over, you are writing prose.
```

**Correct output:**

```
WOLVES x5  — lean, winter-starved
• Sound first: whining. Then silence.
• They circle. Pack tactics. No charge.
• Leader hangs back. Scarred muzzle.
Hook: something worse drove them out of the deep wood.
```

**Incorrect output:**

```
The wolves emerge from the treeline, their eyes glinting in the last of the
daylight, lean and hungry after a long winter, moving with the terrible
patience of a pack that has done this many times before...
```

The second is 5× the tokens, 5× the latency, and it is **useless to a person who is about
to open their mouth.**

---

## Done when

- [ ] `roll_on_table` returns **Foundry's real roll**, with the dice shown, and the model
      reports it verbatim.
- [ ] **The model never computes a number.** Verify by reading the tool-call trace, not by
      trusting the output. If the card says "5 wolves" the trace must show Foundry rolling
      `2d4 → 5`.
- [ ] Tool-call validity > 95% over a realistic sample. Measure it. Log it.
- [ ] Output is under 60 words and contains no paragraph.
- [ ] The model has **no** path to chat, to actor writes, or to a compendium sweep — not
      because it declines, but because the tools do not exist.
- [ ] Provenance (`tableId`, `roll`, `result`, `dice`) is populated into M1's log.

---

## Traps

**The model will want to write prose.** Every model wants to write prose. If it does,
that is not a prompt-tuning problem to solve with more adjectives in the system prompt —
it is signal about the model. Log it and check it against the accept-without-edit rate.

**Do not add a sixth tool to fix a failure.** Prune, tier up, or route to Claude. Adding
surface to fix a surface-size problem is the wrong direction, and it is the direction that
feels productive.

**`place_encounter` is only callable after the GM accepts.** Enforce that in the
Interceptor, not in the prompt. A prompt is a suggestion; the Interceptor is a gate.

---

## Out of scope

The card UI (M7) — M6 emits the *proposal*, M7 *renders* it. Any subsystem other than
`random_encounters`. Combat tactics (that is v2, and it is gated on Midi-QOL v14, which is
HIGH volatility and unresolved).
