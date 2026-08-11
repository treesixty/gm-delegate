# 30_scene: the prompter card

The output the GM actually reads and speaks from. **The review here is the GM's mouth.**
There is no gate to remove: the GM either says it, edits it, or discards it. That physical
step is why this can never be auto-published, and why TTS is forbidden. TTS would give
the AI a voice at the table and end the product.

## Input

- The linked catalog doc (`_npcs/…` or `_world/locations/…`) from `10_watch/out/`.
- The resolved mechanic from `20_resolve/out/`, when there was one.

## Process

Turn the resolved outcome into beats a speaking GM performs from. Not prose. Fragments.

## Output: `30_scene/out/prompter.md`

Exactly this shape:

```
CREATURES / SUBJECT: one-line tag
• beat
• beat
• beat (3 to 5 beats: a sound, a posture, a tactic, a detail)
Hook: one line. Why is this here, what does it imply.
```

For an NPC exchange with no mechanic, `CREATURES` becomes the NPC's name and the beats
are voice and disposition cues, not combat tactics.

## Length

Under 60 words. Over that, you are writing prose the GM will read aloud, which sounds like
reading aloud, which breaks the illusion. Cut it.

## Provenance

When there was a `20_resolve` result, carry its `roll / drawn / dice` through unchanged so
the card can show the provenance line. The GM must be able to see at a glance that Foundry
decided and you only reported.

## Validation

`validate.py` checks: word count under 60, the shape above is present, and if a
`20_resolve` result exists its provenance fields are carried verbatim (not restated,
not rounded). Prose blocks and missing provenance fail.
