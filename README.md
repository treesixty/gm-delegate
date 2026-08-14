# GM Delegate

A Foundry VTT v14 module + a local agent server that drafts table content for
a human GM to read silently and perform aloud. **The AI is never a voice at
the table** — it prompts the GM, the GM speaks.

Status: prototype, milestone 7 of 7 complete (v0.7.2). Not yet run through
real sessions. See `STATUS.md` for exact build state and open tradeoffs.

## What it does today

Right now the only wired subsystem is **random encounters**. While you run a
session, you type a trigger ("three days through the Thornwood") into the
panel, and the agent rolls on a real Foundry roll table, drafts a short card,
and puts it in your queue for a decision — never on the table by itself.

```
┌─ WANDERING ENCOUNTER ─────────────────────── GM only ─┐
│ Thornwood table · d20 → 14 → Wolf Pack                │  ← Foundry rolled
│ Foundry rolled 2d4 → 5 wolves                         │    this, not the model
│                                                        │
│ WOLVES ×5 — lean, winter-starved                      │
│ • Sound first: whining. Then silence.                 │
│ • They circle. Pack tactics. No charge.               │
│ • Leader hangs back. Scarred muzzle.                  │
│ Hook: something worse drove them out of the deep wood.│
│                                                        │
│ [Accept & Place]  [Edit]  [Reroll]  [Skip]            │
└────────────────────────────────────────────────────────┘
```

- **Accept & Place** imports the statblock and drops tokens at your cursor.
- **Edit** opens the card text for you to rewrite before placing — this is
  the important button, not a fallback. A reroll gives you *a* different
  thing; an edit gives you *your* thing.
- **Reroll** discards and drafts again.
- **Skip** dismisses it. Nothing is placed until you click Accept or Use
  edited & Place.

Every card, edit, reroll, skip, and undo is logged (`contracts/log-entry.schema.json`)
so the accept-without-edit rate can actually be measured later, not guessed at.

## Architecture

```
Foundry VTT (your browser)                    Your machine, localhost only
┌───────────────────────────┐                 ┌──────────────────────────┐
│ gm-delegate (the module)   │  WebSocket      │ gm-delegate-agent        │
│ Panel · Interceptor ·      │◄───────────────►│ reads gm-session/,       │
│ Journal (undo) · PolicyStore│  127.0.0.1:8765 │ calls the model,         │
└───────────────────────────┘                 │ emits intents             │
                                               └─────────────┬────────────┘
                                                              │
                                                   llama-server, :8080
```

The agent never touches Foundry directly — it emits an *intent*, and the
module's Interceptor decides whether that intent is allowed to become an
action, based on per-subsystem policy you control from the panel. Nothing
listens on a non-localhost interface; there is no auth because there is
nothing to authenticate against.

## Setup

You need three things running: Foundry with the module installed, the agent
server, and a local model server. All on one machine, localhost only.

### 1. Install the module in Foundry

In Foundry's Setup → Add-on Modules → Install Module, paste the manifest URL:

```
https://raw.githubusercontent.com/treesixty/gm-delegate/master/module.json
```

Enable it for a world running the **dnd5e** system (5.3.0+) on **Foundry
v14**. Requires at least one roll table authored with inline count formulas
in the row text, e.g. `[[2d4]] Wolves` — plain `Wolf Pack` rows won't
resolve a quantity, because the executor evaluates the formula in code and
the model never sees or computes it (§5.2 of the spec).

### 2. Run a local model

```
llama-server -m <Qwen3.5-9B-GGUF file> --port 8080 -c 8192 --no-warmup off \
  --temp 0.7 --top-p 0.8 --top-k 20 --min-p 0.0 --presence-penalty 1.5 \
  --reasoning off --no-reasoning-preserve
```

`-c 8192` and keeping weights resident are load-bearing on a 12 GB card —
see `docs/gm-delegate-build-spec-v1.md` §2 for why. This project has only
ever been run against Qwen3.5 9B Q4_K_M served by `llama-server`; Ollama
doesn't have a working GGUF for it (embeddings only, via `nomic-embed-text`
on Ollama's default port).

### 3. Run the agent server

```
cd gm-delegate-agent
npm install
npm start
```

Reads `gm-delegate-agent/config.yaml` for model endpoints, the workspace
path (`../gm-session`), and its own WebSocket port (`127.0.0.1:8765`). The
module dials into the agent, not the other way around — the agent is the
one process that can bind a listening socket.

Start the agent server before or after Foundry; the module reconnects with
backoff either way.

## Using it at the table

The panel docks at the top of your GM screen and is invisible to players.

```
┌────────────────────────────────────────────────────────────────┐
│  ENC ●propose   LOOT ○off   NPC ○off   CMB ○off   [ RECLAIM ]  │
├────────────────────────────────────────────────────────────────┤
│  > three days through the Thornwood________________  [ ask ]   │
├────────────────────────────────────────────────────────────────┤
│  (queued cards render here)                          [undo ⟲]  │
└────────────────────────────────────────────────────────────────┘
```

- **Chips** cycle `off → propose → auto` per subsystem, click to advance.
  `propose` means it queues a card for you; `auto` means it acts without
  asking (only meaningful once a subsystem's `decide` stage is trustworthy —
  today that's still `propose` by default even for encounters). Only
  `random_encounters` is wired end-to-end right now; the other chips exist
  for the policy model but have no subsystem behind them yet.
- **The trigger line** is how you tell the agent something happened —
  type what you'd say out loud ("three days through the Thornwood") and hit
  `ask` or Enter. This is the only trigger in v1; there's no passive
  listener watching the table yet.
- **RECLAIM** is a panic button. One click revokes all delegated control,
  purges the queue, and stays revoked until you click it again — nothing
  auto-releases it.
- **undo ⟲** reverts the last N logged actions (token placements, actor
  edits), N from the number field next to it.
- Right-click a combatant → "I'll take this one" turns off tactics
  delegation for that scene. Right-click an NPC token → "I'll voice this
  one" claims that NPC's dialogue for yourself.

## Known limits, honestly

- **Latency**: median GM-prompt-to-card time is ~6–6.4s against a real
  Foundry instance, above the project's own <5s target. See `STATUS.md`
  for what's been tried.
- **Encounters only.** Loot, NPC voice, and combat tactics have policy chips
  but no executor behind them yet.
- **No passive watcher.** Everything is triggered by you typing into the
  panel; there's no live listener parsing table audio (that's the v2 idea,
  contingent on this prototype's 4-session evaluation).
- Full spec, decisions, and verification log: `docs/gm-delegate-build-spec-v1.md`
  and `STATUS.md`.
