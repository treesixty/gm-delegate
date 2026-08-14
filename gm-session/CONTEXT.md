# CONTEXT, workspace map

You are running inside a live TTRPG session workspace. This file tells you where
everything is so you never waste turns exploring. Read `IDENTITY.md` first, then this,
then the one stage folder you were told to run.

## Stages (numbered)

These run, per game moment, in order. Each has its own `CONTEXT.md` (the contract:
inputs, process, output path) and an `out/` you write to.

| Stage | Does | Reads | Writes |
|---|---|---|---|
| `00_dm/` | overarching contract: what may be decided vs must escalate | (nothing) | (policy, not output) |
| `10_watch/` | link the last ~30s to ONE catalog doc, or nothing | the window handed in, catalog names | `10_watch/out/window.md` |
| `20_resolve/` | mechanical resolution, a tool call, never a computation | the linked doc, board state | `20_resolve/out/` |
| `30_scene/` | the prompter card the GM reads and speaks from | trigger text + upstream `out/` (not catalog — v1 has no live entity linking yet) | `30_scene/out/prompter.md` |

Stable reference material — the "catalog" (prefixed `_`: `_world/`, `_characters/`,
`_npcs/`, `_srd/`) — is described in `CATALOG.md`, included only for stages that can act
on it (the ones with a `read_file`/`list_files` tool in their surface). If your prompt
doesn't include that block, you don't have those tools either; ground yourself in the
trigger text and board state instead of assuming catalog access.

## How a moment flows

`10_watch` decides *what it is about* → `20_resolve` decides *what mechanically happens*
(Foundry, always) → `30_scene` produces *what the GM says*. Not every moment needs all
three. A pure NPC exchange skips `20_resolve`. A silent state change skips `30_scene`.

## The one thing to remember about timing

You are almost always running **ahead of need**, on a Foundry event, writing a draft that
sits staged until the GM looks. A draft nobody opens is not a failure, it cost a few
tokens and expired. Do not optimize for being right; optimize for being ready.
