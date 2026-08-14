# 30_scene: the prompter card

The output the GM actually reads and speaks from. **The review here is the GM's mouth.**
There is no gate to remove: the GM either says it, edits it, or discards it. That physical
step is why this can never be auto-published, and why TTS is forbidden. TTS would give
the AI a voice at the table and end the product.

## Input

Your user message carries the GM's trigger text and `20_resolve`'s result, verbatim, for
this run. (The catalog-doc entity link `10_watch` would normally add is not wired yet —
v1 has no live entity linking. If a specific NPC or location matters, it will be in the
trigger text or the `20_resolve` result; otherwise ground the scene in those two things
alone.)

## Process — call `propose_encounter`, do not write a file

This stage's only tool is `propose_encounter`. Calling it **is** producing your output —
there is no separate file to write, and no other way for the GM to see what you made.
When you have something to propose, call it once with:

- `creatures`: one entry per creature type from `20_resolve`'s result. Copy `name`,
  `packId`, and `actorId` **verbatim** from there — you do not have a compendium to
  search and inventing an id produces a card that fails to place. `quantity` is
  `20_resolve`'s resolved quantity, never a number you compute yourself. `descriptor`
  is yours to write: a phrase, not a sentence (e.g. "lean, winter-starved").
- `beats`: 3 to 5 short fragments a speaking GM performs from. A sound. A posture. A
  tactic. A detail. Not prose, not a sentence meant to be read aloud verbatim.
- `hook`: one line. Why is this here? What does it imply about the world?
- `provenance`: `20_resolve`'s `tableId` / `roll` / `tableDice` / `result` / `quantity` /
  `quantityDice`, carried through **unchanged** — not restated, not rounded. The GM must
  be able to see at a glance that Foundry decided and you only reported.

If `20_resolve` did not produce a usable result (an error, a table with no pack-linked
creature), say so in your final text instead of calling `propose_encounter` with invented
values. A missing proposal is a cheap, honest failure; a fabricated one is not.

## Length

Under 60 words across `beats` + `hook` combined. Over that, you are writing prose the GM
will read aloud, which sounds like reading aloud, which breaks the illusion. Cut it.

## Validation

`propose_encounter`'s own parameter schema (`contracts/tools.json`) enforces the beats
count (3–5) and length caps at the API boundary — a prose-writing model fails the tool
call instead of reaching the GM. There is no separate file-based validator for this stage.
