# AGENTS.md

`gm-delegate` is a Foundry VTT v14 module plus a local agent server. It prepares
material a **human GM reads silently and then performs aloud**. The AI is never
a voice at the table.

Design: `docs/gm-delegate-build-spec-v1.md`. Build state and decisions:
`STATUS.md`. Per-milestone entry points: `docs/milestones/`. This file is routing
only and deliberately does not restate any of them.

## Priorities, in order

When these conflict, lower numbers win. Do not silently trade 1 for 3.

1. **Never violate a hard ban.** §1.4. Enforced by `tests/hardbans.test.js`.
2. **Never add a TTS or auto-narrate path.** §1.1. There is no `narrate` stage.
3. **Verify before you write.** §0 is the verification log. If you need a Foundry
   API that is not in it, check the live v14 docs and add a row with a URL and a
   date. Do not write the call from memory.
4. **Do not silently overturn a decision in `STATUS.md`.** If you think one is
   wrong, say so and wait. Three of them were overridden without discussion on
   2026-08-10 and had to be reverted.
5. **Tests pass.** `npm test`.
6. **Finish the current milestone.** One milestone, one commit.
7. **Speed.** Last.

## Where truth lives

| Question | Answer |
|---|---|
| What am I building next? | `STATUS.md`, then `docs/milestones/NN-*.md` |
| Which spec sections apply? | The briefing's `**Read:**` line, or §8's index |
| Is this Foundry API real in v14? | §0. If absent, verify and add a row |
| Wire format | `contracts/envelope.schema.json` |
| Tool definitions | `contracts/tools.json` — load verbatim, do not retype |
| Instrumentation record | `contracts/log-entry.schema.json` |
| Proposal record | `contracts/proposal.schema.json` |

`contracts/*` are normative. Anything that disagrees with a schema is the thing
to fix, including code. `tests/contracts.test.js` enforces this.

## Commands

```
npm install
npm test              # vitest: hard bans, contracts, docs cross-references
npm run test:watch
```

No build step. The module is plain ESM that Foundry loads directly.

## Testing

**Quench is not an option.** Verified only to Foundry v13 and fifteen months
stale (§0). Do not add it.

- **Outside Foundry:** vitest against mocked `game` / `canvas` globals in
  `tests/setup.js`. Keep that file minimal; it is not a Foundry emulator. If a
  test starts needing real document lifecycle, it is an integration check.
- **Inside Foundry:** `game.modules.get("gm-delegate").api` (wired in
  `main.js`), driving the throwaway executors in `scripts/executors/test-m1.js`.

If a change cannot be tested either way, say so rather than skipping silently.

## Code blocks in the spec

Every fenced block is tagged. Respect the tag.

- `NORMATIVE` — copy exactly.
- `CONTRACT` — signature fixed, body yours.
- `SHAPE` — illustrative. Do not copy stubs as if they were real.

## Boundaries

- **Do not** edit §0 rows without a source URL and a date.
- **Do not** write `StageRunner` (§5.5). M5a decides whether it exists. Build
  `ContextAssembler` instead. Writing both is how this stops shipping.
- **Do not** add a sixth tool to §5.2. The five-tool ceiling is what makes a
  local 9B viable. Solve it in the executor.
- **Do not** make `journal.js` import `socket.js`. Keep `notifyAgent()` internal
  and route it through a callback set at init, or you create an import cycle.
- **Do not** bind the socket to anything but `127.0.0.1`.
- **Do not** persist raw voice transcripts, ever (§7.5).
- **Delete** `scripts/executors/test-m1.js` at M7, and its two `register()`
  lines in `executors/index.js`.

## STOP and ask

Do not choose for me on these. Stop, state the options, wait.

1. **M5a's outcome.** If you are about to write orchestration and M5a has not
   run, stop.
2. **Anything marked STOP in §10.**
3. **Any §0 row marked HIGH volatility** that gates what you are building.
4. **A schema change.** `contracts/*` is depended on by two processes. Propose
   the diff; do not apply it.
5. **A settled decision in `STATUS.md`** you believe is wrong.
6. **A missing spec answer.** If the spec does not say, it is underspecified.
   Ask. Do not infer a default and continue, and do not leave a `TODO` in place
   of the question.

## Session handoff

Append to `STATUS.md` before finishing: what you built, what you verified and
against which source, what surprised you, and what the next session should do
first. Match the file's existing format. Context is lost between sessions and
`STATUS.md` is the only thing that survives.
