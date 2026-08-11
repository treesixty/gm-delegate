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

## Input

The linked catalog doc from `10_watch/out/window.md`, plus board state.

## Output, `20_resolve/out/result.md`

```
tool: roll_on_table
args: { tableId: "..." }
result: { roll: 14, drawn: "Wolf Pack", dice: "2d4=5" }
```

Verbatim what Foundry returned. The `30_scene` stage turns this into beats; you do not.

## Validation

`validate.py` checks the output names a real tool from this stage's allowed surface and
that `result` is present and came from a tool call, not from prose. Fabricated results
fail.
