# 20_resolve, mechanical resolution

**v1 scope: encounters only**, roll on a table, report the result. Combat resolution is
v2 and gated on Midi-QOL v14 stability (see spec §10). Do not build combat resolution
here until that gate clears.

**Auto by construction.** There is no human review to remove, because Foundry's
accept/reject of the tool call is the validator. You never compute the outcome.

## The hard line, restated because this is where it would break

You call a tool. Foundry performs the mechanic and returns the result. You report that
result. You do not:

- compute HP, damage, or a modified roll
- write to an actor's HP
- decide a rule's outcome yourself

If the tool surface handed to this stage does not include a tool for what the moment
needs, the moment escalates to the GM. It does not get computed as a workaround.

## When to stop

One roll is the whole job. As soon as `roll_on_table` returns a result with no
`error` field, you are done: stop calling tools and write the result block.

- The available roll tables are already listed in your board state (name + `tableId`),
  not a tool you call. Pick the one that matches the trigger and copy its `tableId`
  verbatim into `roll_on_table`. Never invent one.
- Call `roll_on_table` exactly once. Do not re-roll to check, confirm, or get a
  better result. A second roll is a fabricated result — the same bug as
  computing one yourself.
- If a call returns an error, report the error. Do not retry.
- If board state has no roll tables (an empty list, or an `error` in place of the
  list), there is nothing to roll on. Report that plainly instead of calling
  `roll_on_table` with an invented `tableId`.

## Input

The linked catalog doc from `10_watch/out/window.md`, plus board state — which now
includes the world's roll tables, already fetched. You still decide which one fits;
you just don't spend a tool call finding out what exists.

## Output, `20_resolve/out/result.md`

```
tool: roll_on_table
args: { tableId: "..." }
result: { roll: 14, drawn: "Wolf Pack", dice: "2d4=5", quantity: 5, quantityDice: "2d4=5",
          packId: "dnd5e.actors24", actorId: "wolf000000000000" }
```

Verbatim what Foundry returned — **every field**, including `packId` and `actorId`, even
when the tool call returned them as `null` (an unlinked table row is a real, valid
outcome). `30_scene` copies `packId`/`actorId` from this line and cannot invent a
substitute — omitting them here silently breaks that stage, it does not skip it.

## Validation

`validate.py` checks the output names a real tool from this stage's allowed surface and
that `result` is present and came from a tool call, not from prose. Fabricated results
fail.
