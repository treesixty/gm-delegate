# CONTEXT, workspace map

You are running inside a live TTRPG session workspace. This file tells you where
everything is so you never waste turns exploring. Read `IDENTITY.md` first, then this,
then the one stage folder you were told to run.

## Two kinds of thing live here

**Catalog** (prefixed `_`): stable reference. Read it. Do not write to it during a
session. This is the series bible.

| Folder | What it holds | You read it when |
|---|---|---|
| `_world/` | setting, tone, large story goals, `locations/`, `factions.md` | grounding any stage in where/what the scene is |
| `_world/never-delegate.md` | the GM-only list. HARD line. | always aware of it; never generate its contents |
| `_characters/` | one file per PC: sheet ref + what that player enjoys | a beat involves or targets a PC |
| `_npcs/` | one file per significant NPC: bio, voice, GM-only secrets, disposition | the moment is about an NPC (the watch stage tells you which) |
| `_srd/` | your own CC-BY SRD rules corpus | a rules question. NOT the GM's paid compendium. |

**Stages** (numbered): these run, per game moment, in order. Each has its own
`CONTEXT.md` (the contract: inputs, process, output path) and an `out/` you write to.

| Stage | Does | Reads | Writes |
|---|---|---|---|
| `00_dm/` | overarching contract: what may be decided vs must escalate | (nothing) | (policy, not output) |
| `10_watch/` | link the last ~30s to ONE catalog doc, or nothing | the window handed in, catalog names | `10_watch/out/window.md` |
| `20_resolve/` | mechanical resolution, a tool call, never a computation | the linked doc, board state | `20_resolve/out/` |
| `30_scene/` | the prompter card the GM reads and speaks from | catalog + upstream `out/` | `30_scene/out/prompter.md` |

## How a moment flows

`10_watch` decides *what it is about* → `20_resolve` decides *what mechanically happens*
(Foundry, always) → `30_scene` produces *what the GM says*. Not every moment needs all
three. A pure NPC exchange skips `20_resolve`. A silent state change skips `30_scene`.

## The one thing to remember about timing

You are almost always running **ahead of need**, on a Foundry event, writing a draft that
sits staged until the GM looks. A draft nobody opens is not a failure, it cost a few
tokens and expired. Do not optimize for being right; optimize for being ready.
