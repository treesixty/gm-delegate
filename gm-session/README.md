# gm-session, the ICM runtime workspace

**This folder is data, not code.** It is the plain-text workspace the *finished agent*
reads during a live session. It has nothing to do with the module's `scripts/` source
tree, and the two must never be merged. See spec §5.5 for the full rationale and the
scope boundary against the earlier ICM rejection (which was about the software build, not
this runtime workspace).

## What this is

An [ICM](https://github.com/RinDig/Interpretable-Context-Methodology-ICM-) workspace:
folder structure as agent architecture. The agent orients from `IDENTITY.md` +
`CONTEXT.md`, then runs one numbered stage by reading that stage's `CONTEXT.md` contract,
pulling the catalog files it names, and writing a draft to the stage's `out/`.

## Structure

```
IDENTITY.md who the agent is (prompter, never a voice)
CONTEXT.md the map, read this to orient

_world/ CATALOG (stable): setting, locations/, factions, never-delegate
_characters/ CATALOG: one file per PC (+ what each player enjoys)
_npcs/ CATALOG: one file per NPC (bio, voice, GM-only, delegable?)
_srd/ CATALOG: your own CC-BY SRD rules corpus

00_dm/ STAGE contract: what may be decided vs must escalate
10_watch/ STAGE: entity-link the moment to one catalog doc (auto, no gate)
20_resolve/ STAGE: mechanical resolution via tool call (Foundry decides)
30_scene/ STAGE: the prompter card the GM speaks from (GM's mouth = gate)
_journal/ append-only session log for the recap stage
```

Files prefixed `_` are catalog (read-often, write-rarely). Numbered folders are stages
that run per game moment, in order.

## The walk test

The design gate for adopting this (spec M5a): an agent with **no memory** must orient,
act, and report from these files alone. If the chosen local model can be pointed at
`10_watch/` and produce a valid linked output using only `IDENTITY.md`, the root
`CONTEXT.md`, and the stage contract, with nothing passed in code, the workspace
replaces the orchestrator. If it cannot, the workspace is used only for non-real-time
stages (recap, prep) and explicit context assembly stays in code.

## Setup

The `_TEMPLATE.md` files show the shape of each catalog entry. The example files
(`innkeeper.md`, `bruni.md`, `thornwood-road.md`) are illustrative, replace or delete
them and point `_srd/` at your licensed SRD text.

Runtime artifacts under `*/out/` and `_journal/` are gitignored; the folders persist via
their `README.md`.
