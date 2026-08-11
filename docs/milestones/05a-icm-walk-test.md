# M5a, ICM walk test

**State:** not started (gated on M5)
**Read:** spec §5.5 (the runtime workspace), §3 (architecture, the StageRunner box)
**Depends on:** M5 (ModelClient, socket), a chosen model to test
**Do not read:** the card, the panel, anything player-facing. This is an orientation test.

---

## Why this is a milestone and not a footnote

The runtime workspace (`gm-session/`, §5.5) proposes to **replace the Orchestrator** with
folder structure: no coordination code, just an agent reading the right stage file at the
right moment. That works on a frontier model (ICM was validated on Opus 4.6). It is
**unproven on a quantized local 9B**, which is your target tier.

This milestone answers one empirical question before any orchestrator code is written:

> Can the chosen model, pointed at a stage folder, orient and emit a valid scoped intent
> **from the files alone**, no context passed in code?

The answer decides M6's shape. Build nothing past the test.

---

## The walk test, concretely

An agent with **no memory** and **nothing injected by code** must orient, act, and report
using only what is on disk. Run it three times, once per executing stage.

### Setup

- Point the ModelClient at `gm-session/`.
- Hand the model exactly: `IDENTITY.md`, the root `CONTEXT.md`, and the one stage's
 `CONTEXT.md`. Nothing else. No system-prompt scaffolding beyond "you are running in this
 workspace; here are the files."
- For `10_watch`, also hand it a sample window (30s of transcript-shaped text) and a
 Foundry-state line. Use a window that clearly maps to `_npcs/innkeeper.md` and, in a
 second run, one that maps to nothing (table chatter).

### Pass criteria per stage

| Stage | Passes when |
|---|---|
| `10_watch` | Links the innkeeper window to `_npcs/innkeeper.md`; links the chatter window to `none`. Output matches the shape in `10_watch/CONTEXT.md`. |
| `20_resolve` | Given a linked encounter, emits a **tool call** (`roll_on_table`), not a computed result. Never fabricates a roll. |
| `30_scene` | Given a resolved result, produces the prompter shape: under 60 words, beats not prose, provenance carried verbatim. |

### The thing you are really measuring

Not whether the output is *good*. Whether the model **oriented from the files**, did it
read the right catalog file, follow the contract, and write to the right place, without a
human or code holding its hand. That is the ICM claim. If it holds on your 9B, you delete
the Orchestrator. If it doesn't, you keep explicit context assembly.

---

## Done when

- The three stages each pass their criterion, on the model chosen in M5, **or**
- You have a clear negative result documented in `STATUS.md`, in which case:
 - the StageRunner does **not** replace the Orchestrator,
 - the workspace is used only for **recap and prep** (non-real-time, where a frontier
 model or a relaxed latency budget applies),
 - and M6 assembles the encounter agent's context in code as originally specced.

Either outcome is a pass for *this milestone*, the point is to know, before building M6
around an assumption that might be false.

---

## Traps

- **Do not "help" the model by pre-loading catalog files in code.** That defeats the test.
 The whole question is whether the folder structure alone is sufficient orientation.
- **A frontier model passing does not mean your 9B passes.** Test the model you will
 actually run. If you test on Claude and ship on Qwen, you have measured nothing.
- **`20_resolve` fabricating a plausible roll is a FAIL, not a near-pass.** The one thing
 that stage must never do is invent a number. If the model produces `result: {roll: 14}`
 without a tool call, the walk test failed on the criterion that matters most.
