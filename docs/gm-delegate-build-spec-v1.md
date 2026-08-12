# GM-Delegate: Build Spec v1

**Working name:** `gm-delegate`
**Scope of this document:** everything needed to build and test the first prototype (wandering encounters, end to end) plus the offline harness for validating the voice watcher before committing to it.
**Status:** design frozen for v1. Anything marked OPEN is a decision deferred, not forgotten.
**Written:** 2026-07-12
**Revised:** 2026-07-13 — added §5.5 (the ICM runtime workspace) and milestone M5a. The runtime workspace is *data the agent reads*, kept strictly separate from the `scripts/` source tree (§4.1); it replaces the agent-server Orchestrator only if the M5a walk test passes on the local model. No M1–M5 code changes.
**Revised:** 2026-08-10 (a) — buildability pass against the live Foundry v14 API. Five verified breaking issues fixed in place (quantity rolls, compendium→world Actor import, Scene Levels on token creation, undo-of-create, deprecated Ollama endpoint), two absent contracts written (§5.6 wire protocol, §5.7 proposal store), the v1 trigger path added to §4.7, and §6/§7 swapped so reading order matches build order. Every claim re-verified against source; see §0. New milestone M0 makes M1–M4 testable on the day they are written.
**Revised:** 2026-08-10 (b) — structured for agentic development. Added the normative-sections index to §8, extracted four contracts to `contracts/*` as validating schemas, pinned the test tooling in §2 (Quench is not v14-viable), tagged every copyable code block `NORMATIVE` / `CONTRACT` / `SHAPE`, converted §10's `OPEN` labels to explicit `STOP` instructions, and fixed a missing `skip` label in §6. No design changes.

**If you are a coding agent, read `AGENTS.md` first, then `STATUS.md`, then only the §8 row for your milestone.** Reading this document front to back is the wrong move: it is organized by component and argued for a human who needs to remember *why*, while work is organized by milestone. §8's index maps one to the other. `contracts/*.json` is normative and outranks prose wherever the two disagree.

---

## 0. Verification log

Context is lost between sessions. Everything below was checked, with the source, on the date shown. Re-verify anything marked VOLATILE before relying on it.

| Claim | Verified | Source | Volatility |
|---|---|---|---|
| Foundry AI Content Policy permits runtime "improvised content" generated in response to end-user prompts; prepared content must be human-made; packages doing runtime generation must use the "AI Tools" category; policy applies **only** to packages distributed via the official listing/marketplace | 2026-07-12 | `foundryvtt.com/article/ai-policy`, revised 2026-03-18 | Low |
| Policy §1.1: authors may only supply an AI model with runtime context they hold rights to; packages must not auto-inject context from sources the author lacks rights to | 2026-07-12 | same | Low |
| Policy §5: runtime-generated **code** must be shown to the user and explicitly confirmed before execution | 2026-07-12 | same | Low |
| Personal rig is out of scope of the policy (self-publish right retained) | 2026-07-12 | same, §1.2 | Low |
| ~~`PlaceablesLayer#storeHistory(type, data)`~~ **CORRECTED 2026-08-10.** v14 signature is `storeHistory(type, data, options)` — three args. `TokenLayer` overrides it. The underlying `_storeHistory(type, data, options?)` is `Protected` and documented as *not overridable*. `#undoHistory()` returns `Promise<Document[]>`. Covers tokens, tiles, walls, lights, drawings, regions. **Does not cover Actor data.** | 2026-08-10 | `foundryvtt.com/api/classes/foundry.canvas.layers.TokenLayer.html` (v14.365 Stable) | Low |
| **Resolves the 2026-07-12 `[WARN]`.** `PlaceablesLayer#history: CanvasHistoryEvent[]` (default `[]`). `CanvasHistoryEvent = { type: "create"\|"update"\|"delete", data: object[], options: object }`. Field names `type`/`data` — the ones `journal.js`'s `commit()` duplicate-record guard assumes — are correct as written, not a lucky safe-degrade. | 2026-08-11 | `foundryvtt.com/api/classes/foundry.canvas.layers.PlaceablesLayer.html`; `foundryvtt.com/api/interfaces/foundry.canvas.layers.types.CanvasHistoryEvent.html` (v14.365 Stable) | Low |
| **CORRECTION:** undo no longer covers **templates**. V14 deleted the MeasuredTemplate Document type outright (replaced by Template Regions) — the first Document type Foundry has ever removed. The pre-2026-08-10 log row claiming template coverage was stale. Irrelevant to v1 (tokens only); matters if v2 ever places AoE. | 2026-08-10 | `foundryvtt.com/releases/14.359` | Low |
| `canvas.tokens.placeTokens(data, options)` exists in v14: places tokens one-at-a-time at the cursor, wheel-rotates, snaps, `create: true` by default, and exposes `preCommit` / `preConfirm` / `preSkip` hooks. **This replaces any custom placement code.** Official example threads a level: `actor.getTokenDocument({level: canvas.level.id}, {parent: canvas.scene})` | 2026-08-10 | same API page, `#placetokens` | Low |
| A TokenDocument needs a **world** Actor. Dragging a compendium actor to canvas creates a new world Actor *and* the token. API path: `game.actors.importFromCompendium(pack, id, updateData, options)` | 2026-08-10 | `foundryvtt.com/api/classes/foundry.documents.collections.Actors.html`; `github.com/foundryvtt/foundryvtt/issues/8410` | Low |
| `RollTable#draw({displayChat, messageMode, recursive, results, roll})` resolves to the executed roll plus produced results. **`rollMode` was renamed `messageMode`** since v11. `draw()` selects a row; it does **not** roll a quantity. | 2026-08-10 | `foundryvtt.com/api/classes/foundry.documents.RollTable.html` | Low |
| `ApplicationV2` is current in v14 and V1 `Application` is **not yet removed** (several FormApplication deprecations extended to V16). `ApplicationV2#bringToTop` was removed in v14 — use `#bringToFront`. | 2026-08-10 | `foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html`; `github.com/foundryvtt/foundryvtt/issues/13436` | Low |
| Foundry v14 is **stable** (14.365 at time of check). dnd5e **5.3** is specifically the release centred on v14 compatibility, so the 5.3.x pin is the correct one. | 2026-08-10 | `foundryvtt.com/releases/14.365`; `github.com/foundryvtt/dnd5e/releases` | Low |
| Foundry has **no** maintained speech-to-text path. Only STT module (Vox Ludorum) is verified to Foundry 0.8.5, ~3.5 years stale, Azure-dependent | 2026-07-12 | `foundryvtt.com/packages/voxludos` | Low |
| `discord-ext-voice-recv` exposes `AudioSink.write(user, data)` and `get_speaking(member)`. Per-user audio streams = free speaker diarization | 2026-07-12 | `github.com/imayhaveborkedit/discord-ext-voice-recv` | Medium |
| Midi-QOL **14.0.7** is marked v14-compatible; package page warns v14 support is new, be cautious. Corroborated by ddb-importer changelog noting midi "not yet ready" for v14 at time of writing | 2026-07-12 | `foundryvtt.com/packages/midi-qol` | **HIGH** |
| Tool-calling ability does not track parameter count. Docker eval, 21 models / 3,570 tests: GPT-4 = 0.974, **Qwen3 14B = 0.971**, Llama 3.3 70B = 0.607. Qwen BFCL V4: Qwen3.5 27B = 68.5%, **9B = 66.1%**, 4B = 50.3%, 2B = 43.6%. Capability cliff at ~7-9B | 2026-07-12 | xda-developers, 2026-06-10, citing Docker eval and Qwen's published BFCL V4 | **HIGH** |
| **Qwen3.5-9B exists and the pin is sound.** Dense 9B, released 2026-02, 262,144-token native context, function calling supported. Qwen3.5 family: 0.8B / 2B / 4B / 9B / 27B / 35B-A3B / 122B-A10B / 397B-A17B | 2026-08-10 | `huggingface.co/Qwen/Qwen3.5-9B`; `artificialanalysis.ai/articles/qwen3-5-small-models` | Medium |
| **No Qwen3.5 GGUF currently works in Ollama** (separate mmproj vision files). llama.cpp-compatible backends only. The §2 "or Ollama (simpler)" fallback is **closed for this model.** | 2026-08-10 | `unsloth.ai/docs/models/qwen3.5` | **HIGH** — re-check before assuming Ollama is unusable |
| Reasoning is **disabled by default** on Qwen3.5 0.8B–9B; it must be turned on deliberately via `--chat-template-kwargs '{"enable_thinking":true}'`. Leave it off: thinking tokens blow the 5 s latency budget and would truncate under `max_tokens: 32`. | 2026-08-10 | same | Medium |
| ~~Ollama `/api/embeddings`~~ **CORRECTED 2026-08-10.** That route is deprecated and returns an empty result. Current: `POST /api/embed` with `input` (not `prompt`), reading `.embeddings[0]` (not `.embedding`). Also: Ollama unloads after ~5 min idle, costing ~1.3 s cold start; `keep_alive: -1` pins it. | 2026-08-10 | `ollama.com/library/nomic-embed-text`; `github.com/openclaw/openclaw/issues/39983` | Low |
| ICM paper is real: arXiv 2603.16021, Jake Van Clief & David McDermott, submitted 2026-03-17 (v2 2026-03-18), 28 pp. Correct title ends "as **Agentic** Architecture"; the protocol it names is **MWP (Model Workspace Protocol)**. Abstract scopes it to *sequential workflows where a human reviews output at each step* — which §5.5's review-removal rule argues against by design. | 2026-08-10 | `arxiv.org/abs/2603.16021` | Low |
| Quench (in-Foundry Mocha test runner, `Ethaks/FVTT-Quench`) latest release is **0.10.0, Foundry 13.341+ (Verified 13), last updated ~15 months ago.** **Not v14-verified. Rejected for this build** — see §2 for what replaces it. (`schultzcole/FVTT-Quench` is an older archive, read-only since 2021.) | 2026-08-10 | `foundryvtt.com/packages/quench` | Medium |
| `AGENTS.md` is the current convention for repo-root agent instructions: stewarded by the Linux Foundation's Agentic AI Foundation, read natively by Claude Code and 20+ other tools, 60k+ repos. Research across 138 repos found **LLM-generated** context files *reduce* agent success and add >20% inference cost, while developer-written ones help only marginally and only when minimal. **So `AGENTS.md` is hand-written and short by design.** | 2026-08-10 | `agents.md`; Gloaguen et al. 2026 via `asdlc.io/practices/agents-md-spec` | Medium |
| Agents do **not** stop at underspecification on their own: ICLR 2026 (Ambig-SWE) found models almost never interact even on severely underspecified input, and that prompting them to interact improves performance up to ~74% on such tasks. **Hence the explicit STOP markers in §10 and AGENTS.md** — an `OPEN:` label alone reads as informational and gets built past. | 2026-08-10 | via `blakecrosley.com/blog/agents-md-patterns` | Medium |
| llama.cpp `-ncmoe` expert-pinning runs a 35B-A3B MoE on a 12GB card at 58-62 tok/s (measured on RTX 4070) | 2026-07-12 | Medium, "Complete Guide to Running LLMs Locally 2026", 2026-05-09 | **HIGH** |
| SRD 5.1 (Jan 2023) and SRD 5.2 / 5.2.1 (Apr 22 / May 1, 2025) are both CC-BY-4.0, irrevocable, commercially usable with attribution | 2026-07-12 | `dndbeyond.com/srd` | Low |
| Foundry API Bridge (alexivenkov / "Nitrmonoon"): 71 commands, but routes world data to the hosted `foundry-mcp.com` gateway and gates write access behind Patreon. **Rejected for this build.** See §1.3 | 2026-07-12 | `foundryvtt.com/packages/foundry-api-bridge` | Medium |
| `ApplicationV2`/`HandlebarsApplicationMixin` live at `foundry.applications.api.{ApplicationV2, HandlebarsApplicationMixin}` in v14. Confirmed: `DEFAULT_OPTIONS` (`window`, `position`, `actions`, `tag`), `static PARTS` template-part shape, `_prepareContext(options)`, `render(true)`/`close()`, and `bringToFront` (the row above already had `bringToTop`'s removal). TypeDoc's generated pages are terse and did **not** show the mixin's exact wiring code, `window.frame`/`window.positioned`, or a worked example — those are the established AppV2 convention unchanged since v12 per the same page's `bringToTop`-only-removal note, not read verbatim from a v14-specific example. `panel.js` uses this. | 2026-08-11 | `foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html`; `foundryvtt.com/api/interfaces/foundry.applications.types.ApplicationConfiguration.html` | Medium |
| `CombatTracker` (v14) has a protected `_getEntryContextOptions()` method ("Get context menu entries for Combatants in the tracker"), confirming the combatant right-click context menu still exists. TypeDoc does **not** show the `Hooks.callAll(...)` name that method fires internally. `getCombatTrackerEntryContext` is used in `main.js` on the strength of Foundry's long-standing `"get" + ApplicationClassName + "EntryContext"` naming convention, not a direct read of the hook name in the v14 docs. **Re-verify live before trusting it fires; if it doesn't, the callback silently never runs (safe failure, not a crash).** | 2026-08-11 | `foundryvtt.com/api/classes/foundry.applications.sidebar.tabs.CombatTracker.html` | **HIGH** |
| §4.6's `HOOKS` names (`controlToken`, `createChatMessage`, `updateCombat`, `updateToken`) are not literal entries in Foundry's hook-events TypeDoc page — they are dynamic substitutions. Each base hook's own doc page states the pattern explicitly: `createDocument`'s page says "Substitute the Document name in the hook event to target a specific type, for example 'createToken'"; `updateDocument`'s says the same with `updateActor`; `controlObject`'s says the same with `controlToken`. Confirmed signatures: `controlToken(token: PlaceableObject, controlled: boolean)`, `createChatMessage(document, options, userId)`, `updateCombat(document, changed, options, userId)`, `updateToken(document, changed, options, userId)`. `canvasReady(canvas)` is a literal, directly-listed hook (Events - Canvas), not a substitution. `eventbus.js` uses this. | 2026-08-12 | `foundryvtt.com/api/modules/hookEvents.html`; `foundryvtt.com/api/functions/hookEvents.createDocument.html`; `foundryvtt.com/api/functions/hookEvents.updateDocument.html`; `foundryvtt.com/api/functions/hookEvents.controlObject.html`; `foundryvtt.com/api/functions/hookEvents.canvasReady.html` | Low |
| `ChatMessage#rolls` is a confirmed schema field (`ArrayField<JSONField>`); `ChatMessage#isRoll` ("Does this message contain dice rolls?") is a confirmed accessor. **Not confirmed:** whether reading `message.rolls` on a live client-side instance yields parsed `Roll` objects or the raw JSON strings the schema stores — TypeDoc's Accessors list for `ChatMessage` does not show a getter override distinct from the schema field, same class of gap as this log's `ApplicationV2`/`CombatTracker` rows above. `Roll#total`, `Roll#formula`, and the static `Roll.fromJSON(json: string): Roll` are all confirmed. `eventbus.js`'s `extractRoll()` handles both shapes defensively (parses via `Roll.fromJSON` when an entry is a string) rather than assuming either. **Re-verify live** — first real chat roll should confirm which shape arrives. | 2026-08-12 | `foundryvtt.com/api/classes/foundry.documents.ChatMessage.html`; `foundryvtt.com/api/classes/foundry.dice.Roll.html` | **HIGH** |
| `Token#actor` ("A convenient reference to the Actor object associated with the Token embedded document") and `Combat#round`/`Combat#turn` (both `NumberField`s on the schema) are confirmed v14 API. `eventbus.js` uses both. | 2026-08-12 | `foundryvtt.com/api/classes/foundry.canvas.placeables.Token.html`; `foundryvtt.com/api/classes/foundry.documents.Combat.html` | Low |

**HIGH volatility items must be re-checked before they gate a milestone.** Midi-QOL v14 status gates v2 (combat). Local model rankings gate the model choice. The Qwen3.5-in-Ollama gap gates nothing in v1 (llama-server is the path anyway) but re-check it before assuming Ollama is permanently unusable for the model.

**Two lessons from the 2026-08-10 pass, recorded so the next session inherits them.** First, the API rows in this log had drifted in under a month: v14 removed a Document type and changed a signature. Re-verify API claims when they gate a milestone, not when they feel old. Second, and more expensive: several of the *code* blocks below described operations that no API in this log supports. A verification log that checks facts but not the code those facts are supposed to justify will still let you build something unbuildable. When you add a row here, grep the spec for the code that depends on it.

---

## 1. Decisions already made, with reasons

These are settled. Do not relitigate them mid-build without writing down why.

### 1.1 The AI is a prompter, never a voice

The table plays over Discord voice. Therefore:

- Every line the model produces reaches the players **only through the GM's mouth.** The publish button is physical.
- There is no `narrate: auto` mode. It cannot exist.
- **No TTS. Ever.** It is technically permitted and it would destroy the entire positioning. The human GM is the only voice at the table.
- Output is written **for a speaking human**, not for a reader. Beats, details, hooks, fragments. Never paragraphs. See §5.3.

### 1.2 Three sources of truth, kept separate

| Domain | Authority |
|---|---|
| Game state (HP, position, conditions, initiative) | **Foundry.** Never the model. |
| Story and fiction | **The GM.** The agent proposes. |
| Delegation policy | **The module's world settings.** Enforced below the model, in code. |

### 1.3 No third-party bridge. The module talks to its own agent server.

The original brief planned to build on the Foundry MCP / API bridges. Rejected, for three converging reasons:

1. The permission interceptor and the transaction journal **must** live inside a Foundry module you control. A bridge you don't own cannot enforce a policy the model must not be able to talk its way past.
2. The 71-command bridge is a hosted cloud gateway that mirrors your world to a third party and gates writes behind someone else's Patreon.
3. The bridge's published command reference has **no target-setting command**, which blocks combat delegation anyway. Inside your own module you have `Token#setTarget` and the full document API.

**So:** `gm-delegate` (Foundry module) ⟷ WebSocket ⟷ `gm-delegate-agent` (local Node/Python server) ⟷ OpenAI-compatible model endpoint. All on localhost. No accounts, no gateway, no Patreon.

### 1.4 Hard bans, enforced in code

These are not policy settings. No mode can lift them.

```
update actor HP by direct write        // the model never does arithmetic on hit points
delete Actor / Scene / JournalEntry     // no destructive writes, ever
execute macro / eval arbitrary JS       // Foundry AI policy §5, and basic sanity
search all compendiums at once          // Foundry AI policy §1.1; preserves the listing option later
```

The last two cost nothing to never build. Never build them.

**One create is permitted, and it must be named.** `place_encounter` (§5.2) cannot attach a token to a compendium actor: a TokenDocument needs a **world** Actor, so the executor calls `game.actors.importFromCompendium()` first (verified §0). That is an Actor **create**, and the ban list covers `document.delete`, not creates. So state the rule rather than leaving it implied:

```
document.create  → permitted ONLY via the encounter-import path, ONLY idempotently
                   (dedupe on flags["gm-delegate"].sourceUuid), ONLY for Actors
                   whose source is an explicit packId + actorId (§5.2).
```

The model still never writes to an actor. The *executor* creates one, as a side effect of placement, and the journal must record it (§4.5) or undo will leave orphans in your Actors directory.

### 1.5 Every model call goes through one interface

An OpenAI-compatible `/v1/chat/completions` endpoint, configured per subagent. This makes local-vs-Claude a config change instead of a rewrite. Decide the model empirically (§6), not now.

---

## 2. Hardware and version pins

**Rig:** RTX 3080 Ti, 12 GB GDDR6X.

**VRAM budget (12 GB, hard ceiling):**

| Consumer | Cost | Notes |
|---|---|---|
| Foundry client (browser + PIXI canvas) | 1.5 – 2.5 GB | **Move this off the box.** Foundry's *server* is Node and uses no GPU. Run it headless on the 3080 Ti machine; open the GM browser on a laptop. Free 2 GB, costs nothing. |
| Orchestrator + subagents (one 9B, Q4_K_M) | ~6 GB weights + 1-2 GB KV | Q4_K_M is the floor. Q3/Q2 degrade tool-calling before they degrade chat. |
| Embedding model (entity linking) | ~0.3 GB | `nomic-embed-text` or similar |
| faster-whisper (medium, int8) | ~1.5 GB | **v2 only.** Not needed for v1. |

You cannot run the Foundry client, the LLM, and Whisper on this card simultaneously. Move the client off, defer Whisper.

**Version pins. Record what you actually test against.**

```
Foundry VTT       v14.x        (stable; 14.365 verified 2026-08-10)
dnd5e system      5.3.x        (5.3 IS the v14-compat release — correct pin)
midi-qol          14.0.7+      // v2 ONLY. v1 has zero Midi dependency.
                               // Do not build combat delegation on beta Midi.
Node              22 LTS
llama.cpp server  llama-server ONLY. Not Ollama — no Qwen3.5 GGUF works there
                  (mmproj vision files, verified §0). Ollama stays in the stack
                  for embeddings only.
```

**Two llama-server flags are load-bearing on a 12 GB card:**

```
-c 8192            # HARD REQUIREMENT. Qwen3.5-9B's native context is 262,144
                   # tokens. Left unpinned, KV allocation alone will not fit on
                   # the 3080 Ti. A five-tool agent emitting 40 tokens needs
                   # nothing close to 262k. This is the difference between
                   # "works" and an OOM that looks like a mystery.
--no-warmup off    # keep weights resident; a cold reload costs seconds of
                   # dead air at the table, which is the one thing v1 must not do.
```

Leave reasoning **off** (it is off by default for this size class). Thinking tokens would blow the §9 latency threshold and truncate under the classifier's `max_tokens: 32`.

`-ncmoe` expert pinning is irrelevant to the primary path: Qwen3.5-9B is **dense**. That flag only matters if you fall back to the 35B-A3B MoE (§10).

**Test tooling. Decided, because the obvious answer is not available.** Quench is the established in-Foundry runner and it is **verified only to Foundry 13 and fifteen months stale** (§0). Do not adopt it. Instead:

```
vitest                 // pure logic, run outside Foundry against mocked
                       // `game` / `canvas` globals. Covers: policy.modeFor,
                       // the interceptor's decision ORDER (ban → policy →
                       // propose → execute), journal restore ordering,
                       // and every contracts/*.schema.json validation.
ajv                    // schema validation, used by tests AND at runtime on
                       // both sides of the socket (§5.6)
devapi.js  (M0)        // in-Foundry integration: testIntent() from the console
```

`journal.js`'s pure functions are the easy win here: `restore()` ordering and `predictTouchedDocuments()` are testable with a mocked `fromUuid` and no Foundry present. `interceptor.js` (M2) needs `Panel` stubbed, which is one line in the test setup and the reason §4.1 lists `Panel.queue()` as an expected forward reference rather than a problem.

**A spec with 952 lines of acceptance criteria and no test runner is a spec that gets hand-verified once and then trusted forever.** Wire `npm test` at M0, before the journal exists to be tested.

---

## 3. Architecture

```
┌─────────────────────────── GM's machine(s) ────────────────────────────┐
│                                                                        │
│  ┌── Foundry VTT (v14) ──────────────┐                                 │
│  │                                   │                                 │
│  │  gm-delegate  (the module)        │                                 │
│  │  ├─ PolicyStore    world settings │                                 │
│  │  ├─ Interceptor    ← THE PRODUCT  │                                 │
│  │  ├─ Journal        undo           │                                 │
│  │  ├─ EventBus       Foundry hooks  │                                 │
│  │  └─ Panel          GM-only UI     │                                 │
│  └────────────┬──────────────────────┘                                 │
│               │ WebSocket (localhost)                                  │
│  ┌────────────┴──────────────────────┐                                 │
│  │  gm-delegate-agent                │      ┌─ gm-session/ (ICM) ─┐    │
│  │  ├─ ContextAssembler  ← BUILD THIS│      │  IDENTITY / CONTEXT  │    │
│  │  │     explicit, in code (M5/M6)  │      │  _world _npcs _srd   │    │
│  │  ├┄ StageRunner ┄ CONTINGENT ┄┄┄┄┄│◄┄┄┄┄►│  10_watch 20_resolve │    │
│  │  │     swaps in ONLY if M5a passes│      │  30_scene  _journal  │    │
│  │  ├─ validate.py  per-stage schema │      └──────────────────────┘    │
│  │  └─ ModelClient  → /v1/chat/completions   §5.5 runtime workspace     │
│  └────────────┬──────────────────────┘                                 │
│               │                                                        │
│  ┌────────────┴──────────────────────┐                                 │
│  │  llama.cpp server / Ollama        │  localhost:8080 or :11434       │
│  └───────────────────────────────────┘                                 │
└────────────────────────────────────────────────────────────────────────┘
```

**Direction of control:** the agent never touches Foundry. It emits *intents*. The Interceptor decides whether an intent becomes an action. The runtime workspace (`gm-session/`, §5.5) is **data the agent reads**, kept entirely separate from the module's `scripts/` source tree (§4.1).

**Read this before writing M5.** §5.5 makes StageRunner *contingent on M5a*, so the diagram shows it dotted. Build M5 and M6 against `ContextAssembler`: explicit context marshaling in code, the M5a-fail branch. If M5a passes, StageRunner swaps in behind the same `ModelClient` boundary and `ContextAssembler` is deleted. **Do not write both.** Building to two possible shapes is the most reliable way for a prototype to stop shipping, and the earlier revision's diagram — which drew StageRunner as settled while §5.5 called it an open gate — was exactly that trap in schematic form.

---

## 4. Component 1: the Foundry module

### 4.1 Layout

```
gm-delegate/
├── module.json
├── lang/en.json
├── styles/gm-delegate.css
├── templates/
│   ├── panel.hbs
│   └── card-encounter.hbs
└── scripts/
    ├── main.js          // init, hook registration, console api
    ├── policy.js        // PolicyStore
    ├── interceptor.js   // the gate
    ├── journal.js       // transaction log + undo. NAMED exports only.
    ├── proposals.js     // ProposalStore + TTL (§5.7)
    ├── eventbus.js      // Foundry hooks -> agent
    ├── socket.js        // WS client to the agent server (§5.6)
    ├── panel.js         // ApplicationV2 GM panel
    └── executors/
        ├── index.js     // EXECUTORS allowlist. Rejects any executor
        │                // registered without a touches() declaration.
        ├── test-m1.js   // THROWAWAY undo fixtures. Delete in M7.
        └── encounter.js // the only real executor in v1 (M7)
```

**There is no `registry.js`, and a 2026-08-10 revision was wrong to add one.** It was proposed to break an import cycle (`interceptor -> journal -> socket -> interceptor`), but that cycle does not exist here: `journal.js` keeps `notifyAgent()` internal as a console stub until M5 wires the socket, so it never imports `socket.js`. The reasoning is worth keeping even though the file is not, because the *shape* is what matters: **keep the agent notification internal to `journal.js`.** The moment it imports `socket.js` directly the cycle becomes real. Route it through a callback set at init instead.

**Named exports are settled** (STATUS.md, 2026-07-12). `journal.js` exports `registerJournalSettings`, `logCard`, `getCardLog`, `beginTransaction`, `commit`, `note`, `undoLast`, `getJournal`. §4.4's original `Journal.note(...)` namespace call resolves to the named export `note()`.

**Forward references are expected. Stub them; do not build early.**

| Snippet in | References | Built in |
|---|---|---|
| `interceptor.js` (§4.4) | `Panel.queue()` | M3 |
| `interceptor.js` (§4.4) | real `EXECUTORS` entries | M7 (`test-m1.js` stands in) |
| `journal.js` (§4.5) | forwarding `notifyAgent` over the socket | M5 |

### 4.2 `module.json`

```json
{
  "id": "gm-delegate",
  "title": "GM Delegate",
  "version": "0.1.0",
  "compatibility": { "minimum": "14", "verified": "14" },
  "relationships": {
    "systems": [{ "id": "dnd5e", "compatibility": { "minimum": "5.3.0" } }]
  },
  "esmodules": ["scripts/main.js"],
  "styles": ["styles/gm-delegate.css"],
  "socket": false
}
```

`"socket": false` because everything runs on the GM client. No cross-client messaging in v1. This is a real simplification: take it.

### 4.3 PolicyStore

Registered once, `scope: "world"`, `config: false` (it's edited via the panel, not the settings sheet).

`NORMATIVE` — `SUBSYSTEMS`, `STAGES`, `MODES`, and `hardBans` are asserted by `tests/hardbans.test.js`.

```js
// policy.js
export const SUBSYSTEMS = ["random_encounters", "loot", "npc_voice",
                           "combat_tactics", "rules_lookup", "recap"];
export const STAGES = ["decide", "prompt"];   // NOT "narrate". See §1.1.
export const MODES  = ["off", "propose", "auto"];

export const DEFAULT_POLICY = {
  version: 1,
  subsystems: {
    random_encounters: { decide: "propose", prompt: "auto" },
    loot:              { decide: "off",     prompt: "off" },
    npc_voice:         { decide: "off",     prompt: "off" },
    combat_tactics:    { decide: "off",     prompt: "off" },
    rules_lookup:      { decide: "off",     prompt: "off" },
    recap:             { decide: "off",     prompt: "off" }
  },
  actorOverrides: {},        // "Actor.abc123": { npc_voice: {...} }
  sceneOverride: null,       // "all_off" when reclaimed
  hardBans: ["actor.hp.write", "document.delete", "macro.execute", "compendium.searchAll"]
};

Hooks.once("init", () => {
  game.settings.register("gm-delegate", "policy", {
    scope: "world", config: false, type: Object, default: DEFAULT_POLICY
  });
});

export function modeFor(subsystem, stage, actorId = null) {
  const p = game.settings.get("gm-delegate", "policy");
  if (p.sceneOverride === "all_off") return "off";
  const override = actorId && p.actorOverrides?.[actorId]?.[subsystem]?.[stage];
  return override ?? p.subsystems[subsystem]?.[stage] ?? "off";
}
```

Note `prompt` replaces `narrate` throughout. The stage produces a **prompter card for the GM to speak from**, and calling it `narrate` will quietly seduce you into building TTS six months from now.

### 4.4 The Interceptor

**This is the product.** Every intent from the agent passes through it. The agent cannot bypass it, cannot see around it, and cannot argue with it.

`NORMATIVE` — the ORDER of the four checks is the product. Do not reorder, do not add an early return.

```js
// interceptor.js
import { modeFor } from "./policy.js";
import { beginTransaction, commit, note } from "./journal.js";   // named exports
import { EXECUTORS } from "./executors/index.js";
import { Panel } from "./panel.js";       // M3. Stub it in M2; see §4.1.

// intent = { id, subsystem, stage, action, args, provenance }
export async function handleIntent(intent) {
  const { subsystem, stage, action, args } = intent;

  // 1. hard bans first, unconditionally
  if (isBanned(action, args)) {
    return reject(intent, "HARD_BAN");
  }

  // 2. policy
  const mode = modeFor(subsystem, stage, args.actorId);
  if (mode === "off") return reject(intent, "POLICY_OFF");

  // 3. propose → queue, do not execute
  if (mode === "propose") {
    Panel.queue(intent);            // renders a card. Nothing happens yet.
    return { status: "QUEUED", id: intent.id };
  }

  // 4. auto → execute inside a transaction
  return await execute(intent);
}

export async function execute(intent) {
  const executor = EXECUTORS[intent.action];
  if (!executor) return reject(intent, "UNKNOWN_ACTION");

  const tx = await beginTransaction(intent);   // snapshots pre-state
  try {
    // Executors are functions with a `touches` property (executors/index.js
    // attaches it at registration). They return a plain result object. Two
    // keys on that object are special and read by commit():
    //   result.placeables = { layer, docs }  → Layer A undo via storeHistory
    //   result.created    = [uuid, ...]      → Layer B undo for NON-placeable
    //                                          creates, e.g. the world Actor
    //                                          imported by place_encounter.
    const result = await executor(intent.args);
    await commit(tx, result);
    return { status: "EXECUTED", id: intent.id, result };
  } catch (err) {
    await tx.rollback();
    return reject(intent, `EXEC_FAILED: ${err.message}`);
  }
}

function reject(intent, reason) {
  note({ ...intent, status: "REJECTED", reason });
  return { status: "REJECTED", id: intent.id, reason };
}
```

**`reject` returns a structured error to the agent.** The agent must handle it. It must not be able to retry its way around a policy.

`EXECUTORS` is an explicit allowlist keyed by action name. If an action is not in the map, it does not exist. This is why the hard bans are cheap: you simply never write an executor for `actor.hp.write`.

### 4.5 The transaction journal and undo

Two layers.

**Layer A: Foundry's native undo, free, for placeables.**

```js
// after creating tokens — v14 signature is THREE args
canvas.tokens.storeHistory("create", createdTokenDocs.map(d => d.toObject()), {});
// undo
await canvas.tokens.undoHistory();   // → Promise<Document[]>
```
Verified on v14.365 (§0). Covers tokens, tiles, walls, lights, drawings, regions. **Does not cover Actor data**, and no longer covers templates: v14 removed the MeasuredTemplate Document type entirely. Note `_storeHistory` is `Protected` and explicitly not overridable, so call the public `storeHistory`.

**The open risk STATUS.md flagged on 2026-07-12, and why it gets worse at M7.** It is unverified whether v14 core already pushes a layer-history entry on a programmatic `createEmbeddedDocuments("Token", ...)`. If it does, `commit()`'s explicit `storeHistory` adds a *second* entry, and one `undoHistory()` pop then leaves half the placement behind. **§5.2's `placeTokens` makes this near-certain rather than merely possible**, because `placeTokens` is core code running its own create path with `create: true`, and core create paths are exactly what would record their own history.

Do not wait for M7 to find out. Make `commit()` idempotent about it:

`NORMATIVE` — this guard is cheap and it removes an entire class of half-undone placement.

```js
// journal.js, inside commit(), replacing the bare storeHistory call
if (result?.placeables) {
  const { layer, docs } = result.placeables;
  const hist = canvas[layer].history;
  const top  = hist.at(-1);
  const ids  = docs.map(d => d._id).sort();
  // Did core already record exactly this create? Then do not record it twice.
  const already =
    top?.type === "create" &&
    Array.isArray(top.data) &&
    top.data.length === docs.length &&
    JSON.stringify(top.data.map(d => d._id).sort()) === JSON.stringify(ids);
  if (!already) canvas[layer].storeHistory("create", docs, {});
  placeables = { layer };
}
```

Two notes on that snippet. The third argument to `storeHistory` is new in v14 and the current code passes only two, so `options` arrives as `undefined`; passing `{}` costs nothing and avoids a property read on undefined inside core. And the field names on a history entry (`type`, `data`) are **not yet verified** against `CanvasHistoryEvent` — confirm them in the M1 Done-when run and add a §0 row. If they turn out to differ, the guard degrades to "always record," which is the current behaviour, so the failure mode is safe.

**Layer B: your journal, for everything else.**

**Storage medium: world settings (`config: false`), for both the §6 card log and the transaction journal. Settled 2026-07-12; recorded in STATUS.md; `scripts/journal.js` is already written against it.** Simpler than a hidden JournalEntry, survives reload, no sidebar clutter.

**A 2026-08-10 revision proposed switching this to a hidden JournalEntry and was wrong to do so unilaterally.** The objection behind it stands and is worth writing down as a trigger rather than a reversal: a world setting is one JSON blob rewritten on every append, so append cost grows with the log, and the growth is per-card during live play. That is not a reason to change a settled decision with code behind it. It is a reason to give "revisit only if log size becomes a problem" an actual number:

```
REVISIT the storage medium when any of these trips:
  - journal blob > 256 KB, or
  - median append latency > 50 ms measured in-session, or
  - a single session's log pushes total world settings past ~1 MB
Until then, world settings is correct and journal.js needs no change.
```

Log the blob size on session end. That turns a vague "if it becomes a problem" into something the §6 instrumentation answers for you, which is the same move as §9's kill criteria.

`CONTRACT` — signatures are fixed; bodies are yours. `getJournal`, `persistJournal`, `appendJournal`, and `predictTouchedDocuments` are referenced here and **not defined anywhere in this spec**. Implement them; do not copy them as stubs.

```js
// journal.js
// Named exports only. Append-only. Never mutated, only marked reverted.
// notifyAgent() stays INTERNAL here: that is what keeps journal.js free of an
// import on socket.js, and therefore free of an import cycle.

export async function beginTransaction(intent) {
  const touched = predictTouchedDocuments(intent);   // per-executor declaration
  const snapshot = {};
  for (const uuid of touched) {
    const doc = await fromUuid(uuid);
    snapshot[uuid] = doc?.toObject() ?? null;        // null = didn't exist
  }
  const tx = { id: intent.id, intent, snapshot, created: [], ts: Date.now(),
               chatMessageIds: [] };
  tx.rollback = () => restore(tx);                   // NOTE: takes tx, not snapshot
  return tx;
}

// created[] is filled in by execute() AFTER the executor runs (§4.4).
export async function commit(tx, result, created = []) {
  tx.created = created;
  tx.result  = result;
  await appendJournal(tx);
}

// The inverse of a transaction is: delete what was created, THEN restore
// what was mutated. Order matters — a restore can re-point at a doc you
// are about to delete.
export async function restore(tx) {
  for (const uuid of [...(tx.created ?? [])].reverse()) {
    const doc = await fromUuid(uuid);
    if (doc) await doc.delete();
  }
  for (const [uuid, before] of Object.entries(tx.snapshot ?? {})) {
    if (before === null) continue;                   // didn't exist; nothing to restore
    const doc = await fromUuid(uuid);
    if (doc) await doc.update(before, { diff: false, recursive: false });
  }
}

export async function undoLast(n = 1) {
  const entries = getJournal().filter(e => !e.reverted).slice(-n).reverse();
  for (const e of entries) {
    await restore(e);
    await ChatMessage.deleteDocuments(e.chatMessageIds ?? []);
    e.reverted = true;
    e.revertedAt = Date.now();
  }
  await persistJournal();
  notifyAgent({ type: "UNDONE", ids: entries.map(e => e.id) });     // agent must not re-narrate
}
```

**Why `created[]` had to be added: a snapshot cannot cover a document that does not exist yet.** `predictTouchedDocuments(intent)` resolves UUIDs *before* execution, so for a create there is no UUID to snapshot and `snapshot[uuid] = null` is unreachable. The pre-2026-08-10 version of this section made M1's done-when ("undo reverts token placement **and** actor snapshots") literally unachievable: Layer A caught the tokens, and the world Actor imported by `place_encounter` (§1.4) had no inverse at all. Every encounter would have left a permanent Actor behind that undo could not touch.

**Each executor declares two things, and both are required exports.** `touches` (which UUIDs it may mutate, feeding the snapshot) and a `created` array in its return value (which UUIDs it brought into existence). Forget `touches` and undo silently does nothing. Forget `created` and undo leaves orphans. Make the executor registry in `executors/index.js` reject any executor missing either one, at load time, so the failure is loud on startup instead of quiet at the table.

**Four limits, accepted deliberately:**

1. **Undo repairs state. It does not unsay words.** In v1 this is nearly free, because nothing is published without the GM speaking it. Do not let a future you forget why.
2. **Undo is a stack, not a single step.** You will not notice a bad auto-action for thirty seconds. `undoLast(n)`, and the panel shows the log.
3. **Undoing an encounter deletes the imported Actor only if nothing else now references it.** Dedupe means the second wolf encounter reuses the first import, so a blind delete on undo would break the tokens still standing on another scene. Before deleting a created Actor, check `actor.getDependentTokens({concreteOnly: true})` and skip the delete if any remain. Leaving a stray statblock is the cheap failure; deleting one that is in play is not.
4. **Midi-QOL workflows are not atomic from outside.** Snapshot-and-restore is your only inverse, and it will clobber a concurrent player change. v1 does not touch Midi. When v2 does, either freeze the window or accept the race and log it.

### 4.6 EventBus

Foundry hooks are the trigger channel. The transcript (v2) will only ever be context.

`SHAPE` — the hook list is normative, the emit style is not. Event names must match `contracts/envelope.schema.json`.

```js
// eventbus.js
const HOOKS = [
  ["controlToken",     (token, ctrl) => ctrl && emit("token.selected", { actorId: token.actor?.id })],
  ["createChatMessage",(msg)          => emit("chat.message", extractRoll(msg))],
  ["updateCombat",     (c, chg)       => emit("combat.turn", { round: c.round, turn: c.turn })],
  ["canvasReady",      ()             => emit("scene.active", { sceneId: canvas.scene?.id })],
  ["updateToken",      (t, chg)       => "x" in chg || "y" in chg ? emit("token.moved", {...}) : null]
];
```

**`controlToken` is the single highest-signal event in the system.** The GM selecting the innkeeper's token predicts "I am about to need this NPC" better than any amount of transcript classification, it is free, and it fires *before* the need rather than after.

### 4.7 The Panel

`ApplicationV2` (v14; V1 `Application` is deprecated, verify the exact import path against `foundryvtt.com/api` when you start). Docked at the top of the GM screen, GM-only.

Contents:

```
┌────────────────────────────────────────────────────────────────┐
│  ENC ●propose   LOOT ○off   NPC ○off   CMB ○off   [ RECLAIM ]  │
├────────────────────────────────────────────────────────────────┤
│  > three days through the Thornwood________________  [ ask ]   │  ← the v1 trigger
├────────────────────────────────────────────────────────────────┤
│  (queued cards render here)                          [undo ⟲]  │
└────────────────────────────────────────────────────────────────┘
```

**That input line is not a convenience, it is the only trigger v1 has.** The live watcher is v2 (§7), so without it there is no path from GM to agent and milestones 6 and 7 cannot be demonstrated at all. §6's log schema already assumes it exists (`trigger: { type: "gm_command", text: "three days through the Thornwood" }`); the earlier version of this section simply never drew it. Roughly twenty lines: a text field, an `ask` button, `Enter` to submit, emit one `INTENT` over the socket (§5.6). A `/gmd <text>` chat command is an acceptable substitute if you prefer the keyboard, but pick one and build it at M3 rather than discovering the gap at M6.

- Each chip cycles `off → propose → auto` on click. Writes to PolicyStore.
- **RECLAIM** is one click and it: sets `sceneOverride = "all_off"`, purges the queue, sends `POLICY_REVOKED` to the agent, and writes a marker to the journal. **It is sticky.** Control does not come back until you explicitly hand it back. You should never have to fight this thing to keep control of your own game.
- Right-click a combatant in the tracker → "I'll take this one" (sets `combat_tactics.decide = off` for the scene).
- Right-click an NPC token → "I'll voice this one" (writes `actorOverrides`).
- `undo ⟲` opens the journal, lets you revert the last N.

---

## 5. Component 2: the agent server

### 5.1 ModelClient

One interface. Config per subagent.

`NORMATIVE` — the three embedding lines fail silently if changed. See §0.

```yaml
# config.yaml
workspace: "./gm-session"     # the ICM runtime workspace (§5.5). Stage folders live here.
models:
  classifier:  { endpoint: "http://localhost:8080/v1", model: "qwen3.5-9b-q4km", max_tokens: 32 }
  encounter:   { endpoint: "http://localhost:8080/v1", model: "qwen3.5-9b-q4km", max_tokens: 200 }
  # served by llama-server, NOT Ollama (no working Qwen3.5 GGUF there — §0/§2)
  # swap any of these to Anthropic behind a shim, per-subagent, without touching agent code
embeddings:
  endpoint: "http://localhost:11434/api/embed"   # NOT /api/embeddings — deprecated, returns empty
  model: "nomic-embed-text"
  request_key: "input"        # NOT "prompt"
  response_path: "embeddings[0]"   # NOT "embedding"
  keep_alive: -1              # pin in VRAM; otherwise ~1.3 s cold start after 5 min idle,
                              # which is a quarter of the §9 latency budget spent on nothing
```

The three embedding lines look pedantic and are not: the old route and the old field names fail *quietly*, returning an empty vector rather than an error, which surfaces as a watcher that never links anything and sends you hunting through your cosine threshold. Verified 2026-08-10 (§0).

**Context assembly has two possible shapes and M5a picks one (§5.5). Build the first.**

`ContextAssembler` (M5/M6, the default): the agent server marshals context explicitly in code — read the linked catalog file, read the last `out/`, build the message array, call the model. Boring, debuggable, no walk-test dependency.

`StageRunner` (contingent, swaps in only if M5a passes): loads a stage by folder. Reads `IDENTITY.md` + the root `CONTEXT.md` once for orientation, then the target stage's `CONTEXT.md` for the contract, resolves the catalog files that contract names, calls the model, writes the result to that stage's `out/`. A per-stage `validate.py` checks the `out/` against a schema before it flows downstream (§5.5, review-removal rule).

Both sit behind the same `ModelClient`. That boundary is what makes the swap a swap instead of a rewrite.

### 5.2 EncounterAgent: the tool surface

**Loadable form: `contracts/tools.json`,** in OpenAI-compatible shape so the agent server sends it verbatim to `/v1/chat/completions` (§1.5) with no translation step. It encodes §5.3's prose limits as validation: 3-5 beats, one-line hook. A model writing paragraphs fails the schema instead of reaching the GM.

**Five tools. That is the entire surface.** This is not tidiness. Tool-selection error grows with surface size, and a 9B choosing among five is a fundamentally easier problem than a 9B choosing among seventy-one. The pruned surface is what makes local viable.

```json
[
  { "name": "list_roll_tables",
    "description": "List roll tables in the world. Filter by name substring.",
    "parameters": { "filter": "string?" } },

  { "name": "roll_on_table",
    "description": "Roll on a table. Foundry performs the roll. Returns the drawn result, the dice that produced it, AND the resolved quantity. Does NOT display to chat.",
    "parameters": { "tableId": "string" } },

  { "name": "get_compendium_actor",
    "description": "Fetch one statblock by explicit ID from a named pack. Single lookup only.",
    "parameters": { "packId": "string", "actorId": "string" } },

  { "name": "propose_encounter",
    "description": "Emit an encounter proposal card for the GM. Does not place anything.",
    "parameters": { "creatures": "array", "beats": "array", "hook": "string", "provenance": "object" } },

  { "name": "place_encounter",
    "description": "Place tokens on the active scene at the GM's cursor. Only callable after GM accepts a proposal.",
    "parameters": { "proposalId": "string" } }
]
```

#### `roll_on_table` must resolve the quantity, or nothing does

`RollTable#draw()` selects a *row*. It does not roll "2d4 wolves" (verified §0). Yet §5.4's card shows `Foundry rolled 2d4 → 5 wolves`, and §5.3 forbids the model from computing a number. As originally specified, **no tool in the surface could produce that 5** — the card's own worked example was unbuildable.

The fix keeps the surface at five, because adding a `roll_formula` tool would hand the model a general-purpose calculator, which is precisely what §1.2 exists to prevent:

`SHAPE` — `resolveInlineFormulas` is yours to write. The rule it enforces is normative: the model never sees a formula.

```js
// executors/encounter.js — inside roll_on_table
const { roll, results } = await table.draw({ displayChat: false });
// Table rows carry their own count formula, e.g. "[[2d4]] Wolves".
// Evaluate it HERE, deterministically, in code. The model never sees a formula.
const quantity = await resolveInlineFormulas(results);   // → { qty: 5, dice: "2d4=5" }
return { result: { drawn: results, tableDice: roll.formula, tableTotal: roll.total,
                   quantity: quantity.qty, quantityDice: quantity.dice },
         created: [] };
```

**This makes your encounter tables a build prerequisite, not an afterthought.** Rows must be authored as `[[2d4]] Wolves` rather than plain `Wolf Pack`, or `quantity` comes back null and the card has nothing to show. Author one table (Thornwood) before M6 or M6 has no input. Also note `rollMode` was renamed `messageMode` in the draw options if you ever set visibility.

#### `place_encounter` must import before it places

`get_compendium_actor` returns a statblock from a pack. A TokenDocument needs a **world** Actor, so there is a missing step between those two tools (verified §0). And v14's Scene Levels mean a token also needs a level:

`SHAPE` — order is normative (dedupe, then import, then level, then place); the surrounding code is illustrative.

```js
// executors/encounter.js — inside place_encounter
const created = [];
let actor = game.actors.find(a =>
  a.getFlag("gm-delegate", "sourceUuid") === srcUuid);      // dedupe FIRST
if (!actor) {
  actor = await game.actors.importFromCompendium(pack, actorId, {
    "flags.gm-delegate.sourceUuid": srcUuid                 // so the next encounter reuses it
  });
  created.push(actor.uuid);                                 // → §4.5 undo
}

const data = [];
for (let i = 0; i < quantity; i++) {
  const t = await actor.getTokenDocument(
    { level: canvas.level.id },                             // v14 Scene Levels — required
    { parent: canvas.scene }
  );
  data.push(t.toObject());
}
const placed = await canvas.tokens.placeTokens(data, {
  preCommit: docs => { /* journal the placement that actually landed */ }
});
created.push(...placed.map(d => d.uuid));
return { result: { placed: placed.length }, created };
```

**Two things this buys you.** First, `placeTokens` answers a question the earlier spec never asked: *where do the five wolves go?* There was no placement algorithm and no coordinates anywhere in v1. Second, it answers it the right way for this product — the GM clicks each token down, so the final physical act stays in the human's hand. That is §1.1's thesis expressed in placement rather than in voice. Delete any plan for a placement algorithm.

**The dedupe is not optional.** Without the `sourceUuid` flag check, every wandering encounter imports a fresh Actor, and after four sessions your Actors directory holds eleven creatures named Wolf. That mess is invisible during M6 and infuriating during M8.

Deliberately absent: `send_chat_message` (there is nothing to send; the GM speaks), anything that writes to an actor, `search_all_compendiums`.

`get_compendium_actor` takes an **explicit pack and ID**. It cannot sweep. That is the §1.1 discipline, and it costs nothing now while preserving the option to list the module later.

### 5.3 EncounterAgent: system prompt

```
You prepare material for a human Game Master who is speaking aloud to players
over voice. You never speak to the players. Everything you produce is read,
silently, by the GM, who then improvises in their own voice.

Therefore: never write prose. Never write a paragraph. Never write a sentence
the GM is meant to read aloud verbatim. Write BEATS: short fragments the GM
can perform from.

You do not decide what happens. Foundry decides. You call roll_on_table and
report what it rolled. If you find yourself computing a number, stop: that is
a bug.

Output shape, always:
  - creatures: what Foundry actually rolled, verbatim, with the dice shown
  - beats: 3 to 5 fragments. A sound. A posture. A tactic. A detail.
  - hook: one line. Why is this here? What does it imply about the world?

Length target: under 60 words total. If you are over, you are writing prose.
```

**Example of correct output:**

```
WOLVES x5  — lean, winter-starved
• Sound first: whining. Then silence.
• They circle. Pack tactics. No charge.
• Leader hangs back. Scarred muzzle.
Hook: something worse drove them out of the deep wood.
```

**Example of incorrect output:**

```
The wolves emerge from the treeline, their eyes glinting in the last of the
daylight, lean and hungry after a long winter, moving with the terrible
patience of a pack that has done this many times before...
```

The second is 5x the tokens, 5x the latency, and it is useless to a person who is about to open their mouth.

### 5.4 The card

```
┌─ WANDERING ENCOUNTER ─────────────────────── GM only ─┐
│ Thornwood table · d20 → 14 → Wolf Pack                │  ← provenance:
│ Foundry rolled 2d4 → 5 wolves                         │    Foundry decided,
│                                                       │    not the model
│ WOLVES ×5 — lean, winter-starved                      │
│ • Sound first: whining. Then silence.                 │  ← beats
│ • They circle. Pack tactics. No charge.               │
│ • Leader hangs back. Scarred muzzle.                  │
│ Hook: something worse drove them out of the deep wood.│
│                                                       │
│ [Accept & Place]  [Edit]  [Reroll]  [Skip]            │
└───────────────────────────────────────────────────────┘
```

**`Edit` is mandatory and it is load-bearing.** Accept/Reroll alone is a slot machine: reroll gives a *different* thing, never the *intended* thing, and the GM has a reroll button with no steering wheel. After the third reroll the GM writes it themselves and stops opening the panel. `Edit` is the only option where the GM's fingerprint lands in the output, and it is what makes this augmentation rather than replacement-with-a-veto.

`Edit` also generates your best training signal. The diff between what the model wrote and what you kept is exactly the distance between its register and yours.

---

### 5.5 The runtime workspace (ICM)

**Scope boundary, read first.** A prior decision (STATUS.md, 2026-07-12) rejected ICM/MWP (arXiv 2603.16021) as an orchestration layer *for the software build*. That decision stands and is correct: numbered stage folders that emit artifacts fight a `scripts/` codebase that milestones mutate in place. **This section is about a different artifact.** ICM here structures the **runtime game workspace** — the plain-text files the *finished agent* reads during a live session — not the module's source tree. One is how you build the software; the other is data the software consumes at the table. Do not conflate them, and do not let this section touch §4.1's `scripts/` layout.

**What ICM is.** A method that replaces framework orchestration code with filesystem structure. Numbered folders are stages; markdown files carry each stage's contract (its inputs, process, and output location); a single agent reads the right file at the right moment; local scripts do the mechanical work that needs no model. The governing metaphor: the LLM is a compiler, not a chatbot. It reads sources, compiles a structured deliverable, writes it to a known path.

**What it replaces in this spec.** The **Orchestrator** in §5, and the ad-hoc context marshaling that would have fed each subagent. It does **not** replace the Interceptor (§4.4), the transaction journal (§4.5), the tool-surface pruning (§5.2), or any hard ban. Those are enforcement and state-safety; ICM is context and coordination. Different axes. The Interceptor stays in code, on the far side of the socket, because ICM has no enforcement primitive — a stage contract is a markdown instruction, and *a gate written in a prompt is not a gate* (§4.4).

**The two kinds of "stage," and why conflating them is the mistake.** The workspace has a *catalog* (stable reference, read-often, write-rarely) and *executing stages* (numbered, run per game moment). Your PCs, your NPCs, and the world are catalog **files**, not stages that run. This kills the coordination problem the subagent design had between them: the innkeeper lives in exactly one file, and every stage that needs him reads the same one.

```
gm-session/                       # the runtime workspace. NOT the module source.
├── IDENTITY.md                   # who the agent is: prompter, never a voice. Under 60 words. Beats, not prose.
├── CONTEXT.md                    # spatial orientation: what each folder is, where to read, where to write
│
├── _world/                       # CATALOG. Stable. The series bible.
│   ├── setting.md                #   tone, large story goals
│   ├── locations/                #   one file per location
│   ├── factions.md
│   └── never-delegate.md         #   villain plans, reveals, PC-facing consequences, safety. HARD-BANNED from Auto.
│
├── _characters/                  # CATALOG. One file per PC: sheet ref + what this player enjoys.
├── _npcs/                        # CATALOG. One file per significant NPC: bio, voice, GM-only secrets, disposition.
├── _srd/                         # CATALOG. Your own CC-BY SRD corpus. NOT the GM's paid compendium (§1.1).
│
├── 00_dm/                        # OVERARCHING contract: what the DM stage may decide vs must escalate.
│   └── CONTEXT.md
├── 10_watch/                     # STAGE: entity-link the last ~30s window to one catalog doc. Auto, no gate.
│   └── out/window.md
├── 20_resolve/                   # STAGE: mechanical resolution. Tool call only. Foundry decides. (v2 combat.)
│   └── out/
├── 30_scene/                     # STAGE: the prompter card. Reads catalog + upstream out/. Writes what the GM reads.
│   └── out/prompter.md
│
└── _journal/                     # append-only session log (mirrors the module's transaction journal)
```

**Executing stages: three, not one per subsystem.** `10_watch` → `20_resolve` → `30_scene`. Watch decides *what it's about*, resolve decides *what mechanically happens* (Foundry, always), scene produces *what the GM says*. Your "combat," "NPC," "encounter" subsystems are **modes within these stages**, selected by the catalog file the watch stage linked to — not separate pipelines. This is the same insight as the 5-tool pruning, expressed as folders: the `20_resolve` contract hands the agent only resolution tools; `30_scene` only proposal tools. ICM and the pruned tool surface agree; keep both.

**Efficiency during live play — the honest limit.** ICM's win is *context scoping* (the agent reads one stage's folder, not the whole world every call), which is a token-cost win, the structural equivalent of the prompt-cache lever. It does **almost nothing for latency on its own.** A naive synchronous `read 10 → read 20 → read 30` pass per game moment is three hops in series and reintroduces the dead-air problem. **The fix is the speculative prefetch already in the design** (§7.5 watcher): the pipeline runs *ahead of need*, triggered by Foundry events, writing drafts into `30_scene/out/` that sit staged until the GM looks. ICM's stages become the structure of the *prefetch* pipeline, not a blocking request path. The filesystem is the staging area. This composes; it does not conflict.

**Removing human review between stages — the rule.** A stage's *internal* review (ICM's between-stage gate, before anything reaches players) can be automated away iff the stage's output is (a) mechanically checkable, or (b) still downstream of the GM gate. This is distinct from the GM gate at the table boundary, which is *never* removable — the GM is the table boundary, and in the voice-only design the GM's mouth **is** the publish step, so §1.1's prompter framing already collapses the `30_scene` review into performance.

| Stage | Internal review | Why |
|---|---|---|
| `10_watch` | **Auto, none.** | Mechanically checkable (link resolves to a real UUID) and output is context-only, never player-facing. Wrong link costs ~40 tokens into a drawer. |
| `20_resolve` | **Auto by construction.** | Foundry's accept/reject *is* the validator. The model never computes the number. |
| `30_scene` | **No gate to remove.** | Output isn't mechanically checkable, but the review is the GM speaking it. Free, physical, and removing it means TTS — which ends the product. |
| recap | **Auto on session-end.** | Non-real-time, not player-facing at generation, journal-bounded. Batch API, GM skims later. |

What replaces the removed human check is **not more model trust — it's a local validation script** (ICM's own prescription: local scripts do the mechanical work). Each auto-stage writes its `out/`, a deterministic script validates it against a schema, pass flows downstream, fail bounces or escalates to the GM panel as an exception. The GM's attention is spent once per moment on the final artifact, plus rare validation-failure escalations, instead of at every seam. That is the maximum safe automation, and it is exception-triggered involvement, not "human out of the loop."

**The caveat that gates adoption.** ICM was validated on a frontier model (Opus 4.6) doing sequential, human-gated knowledge work. You are proposing a local 9B, in real time, with the gate collapsed to a glance. The **walk test** (an agent with no memory must orient, act, and report from the files alone) is harder for a 9B than for Opus. This is empirical and it is the gate: can a local model, pointed at `20_resolve/`, orient from the folder and emit a valid scoped tool call? If yes, ICM is your orchestration layer and deletes the Orchestrator. If no, you keep explicit context assembly in code and use ICM only for the non-real-time stages (recap, prep). **Milestone M5a tests exactly this before any orchestrator code is written.**

One correction to this section's citation, since §0 now records it: the paper's title ends "as **Agentic** Architecture," and the protocol it actually names is **MWP (Model Workspace Protocol)**, with ICM as the surrounding methodology. Worth knowing about the gate you set: the abstract scopes the method to sequential workflows *in which a human reviews output at each step*. The review-removal rule above is therefore arguing against the method's own stated premise. That is the correct thing to be nervous about, and it is what M5a measures.

---

### 5.6 The wire protocol

**This section exists because its absence was the largest single blocker in the v1 spec.** Two processes were specified in detail on either side of a WebSocket, with no envelope, no message types, no correlation, no versioning, and no reconnect rule. Both halves were buildable and they could not have talked to each other. Write this before M4.

**Machine-checkable form: `contracts/envelope.schema.json`.** That file is normative; validate outbound and inbound frames against it on both sides. What follows is the human-readable version of the same thing, and if the two ever disagree, the schema wins.

**Envelope. Every frame, both directions, no exceptions.**

```json
{ "v": 1, "type": "INTENT", "id": "01J9Z...", "ts": 1752300000123, "payload": {} }
```

- `v` — protocol version. Mismatch → log, drop, surface once in the panel. Never guess.
- `id` — ULID, generated by the sender. A `RESULT` **must** echo the `id` of the `INTENT` it answers. This is the only correlation mechanism; do not rely on ordering.
- Unknown `type` → log and drop. Never throw, and never attempt a partial parse.

**The complete type list for v1. Six types. If it is not here, it does not exist.**

| Type | Direction | Payload | Reply |
|---|---|---|---|
| `INTENT` | agent → module | `{ subsystem, stage, action, args, provenance }` | `RESULT`, always, even on reject |
| `RESULT` | module → agent | `{ status, result?, reason? }` where status ∈ `EXECUTED` \| `QUEUED` \| `REJECTED` | none |
| `EVENT` | module → agent | `{ event, data }` from the EventBus (§4.6) | none, fire-and-forget |
| `POLICY_REVOKED` | module → agent | `{ scope, ts }` | none. Agent must stop emitting immediately. |
| `UNDONE` | module → agent | `{ ids: [] }` | none. Agent must not re-narrate (§4.5). |
| `HELLO` | both, on connect | `{ v, role, moduleVersion? }` | `HELLO` |

**Rules that will otherwise cost you a debugging session each:**

1. **Every `INTENT` gets exactly one `RESULT`.** A rejection is a reply, not a silence. §4.4's whole design ("the agent must handle it, it must not retry its way around a policy") depends on the agent *receiving* the rejection, which only works if reject is on the wire and not just in the journal.
2. **`EVENT` is unacknowledged and droppable.** Hook traffic is high-volume and low-value individually; never let a slow agent apply backpressure to Foundry's hook loop. Buffer the last N (128 is plenty) and drop the oldest.
3. **The module is the server, the agent is the client, and the agent reconnects.** Foundry is the thing that must not be blocked by a missing peer, so it must not be the one dialing out. Agent reconnect: exponential backoff to a 10 s ceiling, and re-send `HELLO`.
4. **On reconnect, the agent's in-flight intents are dead.** Do not replay them. A retried intent after a gap is an intent whose game state has moved, and §1.2 gives Foundry authority over state. Drop them and let the GM ask again.
5. **`POLICY_REVOKED` is not advisory.** On receipt the agent clears its queue and stops emitting until a `HELLO` round-trip. RECLAIM (§4.7) is sticky, and the socket must not be a way around it.
6. **localhost only. Bind `127.0.0.1`.** There is no auth in v1 and there does not need to be, precisely because it never listens on a routable interface. Write that down so a future you does not "just" bind `0.0.0.0` for convenience.

---

### 5.7 The proposal store

`place_encounter(proposalId)` (§5.2) and `[Accept & Place]` (§5.4) both dereference a store that the v1 spec never defined, and §7.4's "let drafts rot" plus §6's "card expired unopened → negative" both require an expiry that nothing owned.

`CONTRACT` — three signatures, bodies yours. Validate records against `contracts/proposal.schema.json`.

```js
// proposals.js
const TTL_MS = 15 * 60 * 1000;   // one scene's worth. Tune from §6 logs, not from taste.

export function put(proposal) { /* id → { proposal, ts, opened: false } */ }
export function get(id)       { /* null if absent or expired */ }
export function markOpened(id) { /* distinguishes "rejected" from "never seen" */ }
```

**Expiry is a labelling event, not just a cleanup.** When a proposal ages out unopened, emit the negative label from §6's table before discarding it. That is the single cheapest training signal in the whole system, and a sweeper that silently deletes throws it away.

Three states, and they are genuinely three: never opened (negative), opened then skipped (weak negative), accepted or edited (positive). Only the middle one requires `markOpened`, which is why it exists.

---

## 6. The instrumentation, and why it is milestone one

You have already, accidentally, built a perfect label source: **your own clicks.**

| Event | Label | `gm_action` |
|---|---|---|
| Accepted the card as-is | Positive | `accept` |
| Edited, then used | Positive, plus a quality signal (the diff) | `edit` |
| Rerolled | Weak negative | `reroll` |
| Opened, then dismissed | Weak negative | `skip` |
| Card expired unopened | Negative | `expired` |

**`skip` was missing from this table until 2026-08-10**, even though §5.4's card has always had a `[Skip]` button. Four buttons and four labels that did not line up meant one of your five outcomes was silently unlabelled, which is a hole in the §9 accept-rate denominator. Note also that `skip` and `expired` are different signals and must not be collapsed: one means the GM looked and said no, the other means the GM never looked. `proposal.opened` (§5.7) is what distinguishes them.

Log this tuple on **every** card, from the first commit. Schema: `contracts/log-entry.schema.json`, which adds three fields this example omitted and §9 cannot be computed without — `intent_id` (joins to the wire trace), `mode` (an accept under `auto` is not the same signal as an accept under `propose`), and `tool_calls[]` (the only source for the >95% tool-call validity threshold):

```json
{
  "ts": 1752300000123,
  "subsystem": "random_encounters",
  "trigger": { "type": "gm_command", "text": "three days through the Thornwood" },
  "foundry_state": { "scene": "...", "combat": false, "selected": null },
  "entity_link": null,
  "provenance": { "tableId": "...", "roll": 14, "result": "Wolf Pack", "dice": "2d4=5" },
  "model": "qwen3.5-9b-q4km",
  "latency_ms": { "total": 1840, "model": 1200, "tools": 640 },
  "card_text": "...",
  "gm_action": "edit",
  "gm_edit_diff": "..."
}
```

Fifty lines of code. After four sessions you have a real labeled dataset from your actual table with **zero annotation effort**, and you can tune thresholds and pick your model empirically instead of arguing about benchmarks forever.

**This is the highest-leverage thing in v1.** Build it before you build anything clever.


---

## 7. Component 3: the offline harness (validate before you build)

**Do not build the live Discord bot yet.** Find out whether the watcher works first, with no latency pressure and no risk.

### 7.1 Collect

Record four normal sessions with **Craig** (Discord bot; records each participant to a **separate track**). Change nothing about how you play. Do not tell yourself to speak differently.

**Get explicit consent from every player first.** You are recording your friends' private conversation. Expect at least one person to be uncomfortable and take that seriously rather than engineering around it.

### 7.2 Transcribe

Offline, at leisure, big Whisper model, no real-time constraint. Per-track means speaker labels are free.

### 7.3 The thing you are actually testing: entity linking

Reframe the classification problem. You are **not** asking "is this relevant?", which is open-ended and hard. You are asking:

> **"Which Foundry document is this conversation about?"**

That is a **closed-set** problem. You have the complete list: every actor name and bio, every scene, every journal page, every roll table in your world.

```python
# harness/link.py
doc_embeddings = embed_all(world_documents)   # actors, scenes, journals

def link(window_text, foundry_state):
    v = embed(window_text)
    scores = cosine(v, doc_embeddings)
    best, score = argmax(scores)

    # Foundry state is the strong prior, not the transcript
    if foundry_state.selected_actor == best:
        score += SELECTION_BONUS

    return best if score > THRESHOLD else None    # None = chatter, drop it
```

No LLM. An embedding model, cosine similarity, and a threshold. Dave's boss is not in your compendium, so Dave's boss scores near zero and falls out for free.

**Window, not utterance.** 30-45 seconds, or "since the last Foundry state change." A single line is ambiguous by construction ("I don't trust him" is either the paladin about the innkeeper, or Marcus about fantasy football). Thirty seconds of context disambiguates for nothing.

### 7.4 Evaluate

Hand-mark, on your four recorded sessions, the ~30 moments where you *actually would have wanted* a card. Then:

| Metric | Target | Why |
|---|---|---|
| **Recall** on marked moments | **> 80%** | This is the one that matters. |
| Precision | **who cares** | A false positive costs ~40 tokens into a drawer nobody opens. Tune for recall. Fire liberally. Let drafts rot. |
| Firings per hour on pure chatter | < 30 | Only a cost ceiling, not a correctness target. |

**A cache miss is not a bug.** The watcher has no cost of being wrong, in either direction, precisely because the output surface is GM-only and the publish button is your mouth. If recall clears 80% on real recordings, build the live bot. If it doesn't, you saved yourself a month.

### 7.5 When you do go live

Reference architecture already exists: `C4se-K/Real-Time-Transcription-Discord-Bot` (Pycord + faster-whisper + VAD; intercepts raw Opus, decodes to PCM, VAD-gates, transcribes). Read it before writing your own.

Use `discord-ext-voice-recv`: `AudioSink.write(user, data)` gives per-user attribution, so speaker diarization is solved by the platform. That is the entire reason Discord makes this tractable.

**Never persist raw transcripts.** Rolling in-memory buffer, N minutes, discarded. Only classified, entity-linked, game-relevant extracts get written anywhere. This is the ethical call and it is also the correct technical call: raw table talk will bloat your context and poison the recap agent with noise.

---

## 8. Build order

**Normative-sections index. Read this row, then only those sections.** The rest of the document is organized by component; work is organized by milestone. Those axes are orthogonal, so without this table every task begins by hunting across 71KB. Sections not listed for your milestone are not needed for it.

<!-- INDEX:BEGIN -->

| # | Read these | Contracts | Do not read yet |
|---|---|---|---|
| 0 | §4.1, §2, §8 | all four | §5, §7 |
| 1 | §6, §4.5, §4.1, §0 | `log-entry.schema.json` | §5, §7 |
| 2 | §4.3, §4.4, §1.2, §1.4 | `envelope.schema.json` | §5.5, §7 |
| 3 | §4.7, §4.3 | — | §5.5, §7 |
| 4 | §4.6, §5.6, §10 | `envelope.schema.json` | §5.5, §7 |
| 5 | §3, §5.1, §1.5, §1.3, §5.6 | `envelope.schema.json` | §5.5 beyond its caveat, §7 |
| 5a | §5.5, §3 | — | — |
| 6 | §5.2, §5.3, §1.4, §1.2, §0 | `tools.json` | §7 |
| 7 | §5.4, §6, §4.5, §5.7, §5.2, §4.7 | `proposal.schema.json`, `log-entry.schema.json` | §7 |
| 8 | §6, §9 | `log-entry.schema.json` | §5.5 |
| 9 | §7, §9 | — | — |

<!-- INDEX:END -->

Each row is a **superset** of the matching briefing's `**Read:**` line in `docs/milestones/`. Two copies of that mapping exist on purpose: the briefing is the per-milestone entry point, this table is the spec-side canonical map. `tests/docs-consistency.test.js` asserts they agree, so the duplication cannot rot quietly. It already caught nine stale `§7` references that the 2026-08-10 renumber left behind in the briefings and in `journal.js`.

| # | Milestone | Done when |
|---|---|---|
| 0 | **Test harness + one roll table** | `npm test` runs. `package.json`, vitest, and `tests/setup.js` (mocked `game` / `canvas`) exist. `tests/hardbans.test.js` and `tests/contracts.test.js` pass. One Thornwood table authored with inline count formulas (`[[2d4]] Wolves`, §5.2). Half a day. |
| 1 | **Instrumentation + journal** | Every intent, mode, action, and GM click is logged with the schema in §6. Undo reverts token placement (via `storeHistory`), restores actor snapshots, **and deletes documents recorded in `created[]`** (§4.5). Test all three with `testIntent`. |
| 2 | **PolicyStore + Interceptor** | An intent for a subsystem set to `off` is rejected with a structured error and never reaches Foundry. Prove it by trying, with `testIntent`. |
| 3 | **Panel** | Chips cycle modes. RECLAIM purges the queue and is sticky. **The trigger input emits an INTENT** (§4.7). |
| 4 | **Wire protocol + EventBus** | §5.6 written down first, then `controlToken`, `createChatMessage`, `updateCombat` reach the agent server as `EVENT` frames. Unknown types drop cleanly. Kill the agent mid-session and confirm Foundry is unaffected. |
| 5 | **Agent server + ModelClient + ContextAssembler** | A hardcoded intent round-trips: agent → WS → interceptor → executor → Foundry → `RESULT` → agent. Context assembled **explicitly in code** (§5.1). Do not write StageRunner here. |
| 5a | **ICM walk test** (§5.5) | The chosen model, pointed at a stage folder with only `IDENTITY.md` + `CONTEXT.md` + catalog, orients and emits a valid scoped intent **from the files alone** — no context passed in code. Pass → StageRunner swaps in behind `ModelClient` and `ContextAssembler` is deleted. Fail → keep it; ICM used only for recap/prep. A gate, not a feature. |
| 6 | **EncounterAgent, 5 tools** | `roll_on_table` returns Foundry's real roll **and the resolved quantity** (§5.2). The model never computes a number. |
| 7 | **The card, with Edit** | `propose` mode renders it. `Accept & Place` imports the Actor idempotently and places tokens at the cursor via `placeTokens`. `Edit` opens an editor and logs the diff. Proposals expire and label themselves (§5.7). |
| 8 | **Run four sessions.** | Read §9 before you decide what it means. |
| 9 | **Offline harness** (§7) | Recall on marked moments measured against four Craig recordings. |
| 10 | v2: live watcher, or combat tactics, or stop. | Depends on 8 and 9. |

**Milestones 0-7 are the prototype. Everything else is contingent.**

**Why M0 exists, revised 2026-08-10 against the actual repo.** The original framing claimed M1 through M4 were untestable until M5 supplied intents. That is no longer accurate: `main.js` already exposes `game.modules.get("gm-delegate").api`, and `executors/test-m1.js` already supplies throwaway executors (`test.actor.rename` for Layer B, `test.token.place` for Layer A) precisely so `undoLast` has something to undo. That was the right call and it solved the in-Foundry half.

What is still missing is the **automated** half. There is no `package.json`, no runner, and no test directory, which means 1000+ lines of acceptance criteria are verified by hand once and then trusted forever. M0 is now that: wire the runner, land the two tests that can pass today, and author the one roll table M6 needs as input. The console API stays as the in-Foundry path.

**M1 is code-written and awaiting its in-Foundry Done-when run** (STATUS.md). Two items to fold into that run: confirm the `CanvasHistoryEvent` field names used by the §4.5 history guard, and record the Foundry build you tested against, which STATUS.md still lists as none.

---

## 9. Kill criteria

Write these down now, while you are not emotionally invested in the outcome.

| Measure | Threshold | If you miss it |
|---|---|---|
| **Accept-without-edit rate** on encounter cards, over 4 sessions | **> 50%** | **Stop.** A wandering encounter is the lowest-stakes, most procedural, most recoverable thing in the entire taxonomy. If you will not trust the model with that, you will never trust it with a monster's turn, and the toggle matrix is a solution to a problem nobody has. |
| **Median latency**, GM prompt → card on screen | **< 5 s** | On a 9B generating 40 tokens, this should be trivial. If you blow it, the problem is your orchestration hops, not your hardware. Cut a hop. |
| **Tool-call validity** (legal call, legal args) | **> 95%** | Prune the tool surface further, or move up a model tier, or move that subagent to Claude. |
| **Watcher recall** (§7.4) | **> 80%** | Do not build the live Discord bot. |

---

## 10. Open questions

**Every item below is a STOP.** An `OPEN:` label reads as informational and gets built past: agents almost never halt at underspecification on their own, and prompting them to interact instead is worth up to ~74% on underspecified tasks (§0). So each item states the halt explicitly. If you are an agent and you reach one of these, stop, state the options, and wait.

- **STOP — which model.** Decide from the §6 logs after four sessions, not from a leaderboard. Start with Qwen3.5 9B at Q4_K_M (above the ~7-9B tool-calling cliff, fits comfortably in 12 GB alongside the embedding model). **Serving is settled even though the choice is not:** llama-server only, `-c 8192` mandatory, reasoning off (§2, §0). If prose quality is the binding constraint, try a 35B-A3B MoE with llama.cpp `-ncmoe` — note `-ncmoe` does nothing for the 9B, which is dense — or route just the prompter stage to Claude. The tool surface is five commands; local should hold.
- **RESOLVED 2026-08-10:** where do the tokens go? `canvas.tokens.placeTokens()` places at the GM's cursor, one at a time (§5.2). No placement algorithm needed, and the GM's hand stays on the final act.
- **RESOLVED 2026-08-10:** what rolls the creature count? An inline formula in the table row, evaluated deterministically by the executor (§5.2). No sixth tool, no model arithmetic.
- **STOP — Midi-QOL v14 stability.** Gates v2. Re-check `foundryvtt.com/packages/midi-qol` before starting combat work. Do not build damage delegation on a beta automation stack: your hard rule ("adjudication is a tool call") depends on Midi being *correct*, and a beta Midi that mis-applies damage is worse than no Midi, because now the model isn't doing the math and the math is still wrong.
- **STOP — does the table type in Foundry chat at all?** If rolls happen in Foundry but all dialogue is voice, `createChatMessage` still gives you rolls and targets, which is most of the trigger signal. Confirm.
- **STOP — does a local 9B pass the ICM walk test (M5a, §5.5)?** ICM was validated on Opus 4.6, not a quantized 9B. If the local model cannot orient from a stage folder alone, the StageRunner is not viable at that tier and you either move the orchestration stages to Claude or keep explicit context assembly in code. Decide from M5a, not from assumption.
- **DEFERRED (not a STOP; no v1 work depends on it):** listing this module publicly. If you ever do, §1.4's hard bans and §5.2's explicit-ID compendium lookup are what make the transition cheap instead of a rewrite. Keep a real commit history; Foundry's AI policy asks for exactly that as evidence of authorship.

---

## 11. References

- Foundry AI Content Policy: `https://foundryvtt.com/article/ai-policy` (rev. 2026-03-18)
- Foundry API (v14): `https://foundryvtt.com/api`
- `PlaceablesLayer#storeHistory` / `#undoHistory`: `https://foundryvtt.com/api/classes/foundry.canvas.layers.TokenLayer.html`
- Midi-QOL: `https://foundryvtt.com/packages/midi-qol`
- discord-ext-voice-recv: `https://github.com/imayhaveborkedit/discord-ext-voice-recv`
- Real-time transcription reference: `https://github.com/C4se-K/Real-Time-Transcription-Discord-Bot`
- SRD 5.1 / 5.2.1, CC-BY-4.0: `https://www.dndbeyond.com/srd`
- Foundry v14 API pages that gate v1 (all verified 2026-08-10, v14.365 Stable):
  - `TokenLayer#placeTokens` / `#storeHistory`: `https://foundryvtt.com/api/classes/foundry.canvas.layers.TokenLayer.html`
  - `Actors#importFromCompendium`: `https://foundryvtt.com/api/classes/foundry.documents.collections.Actors.html`
  - `RollTable#draw`: `https://foundryvtt.com/api/classes/foundry.documents.RollTable.html`
  - `ApplicationV2`: `https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html`
  - v14 removal of MeasuredTemplate: `https://foundryvtt.com/releases/14.359`
  - v14 deprecation sweep (what V12 deprecations became breaking): `https://github.com/foundryvtt/foundryvtt/issues/13436`
- Model serving (verified 2026-08-10):
  - `https://huggingface.co/Qwen/Qwen3.5-9B`
  - Qwen3.5 local-run notes incl. the Ollama GGUF gap: `https://unsloth.ai/docs/models/qwen3.5`
  - Ollama embed endpoint: `https://ollama.com/library/nomic-embed-text`
- ICM (runtime workspace, §5.5):
  - Paper: "Interpretable Context Methodology: Folder Structure as **Agentic** Architecture", Jake Van Clief & David McDermott (Eduba / Univ. Edinburgh), arXiv 2603.16021 (v1 2026-03-17, v2 2026-03-18), 28 pp. Validated on Claude Opus 4.6. The protocol it names is **MWP (Model Workspace Protocol)**. Abstract scopes it to sequential workflows with human review at every step — see §5.5.
  - Reference repo: `https://github.com/RinDig/Interpretable-Context-Methodology-ICM-`
  - `icm-architect` (Claude skill that scaffolds/audits an ICM workspace): `https://github.com/RinDig/icm-architect`
  - Template: `https://github.com/ktnCodes/icm-template`
- Prior art, read before you duplicate:
  - Loremaster: `https://loremastervtt.com/` (has Publish/Iterate/Discard and per-actor AI roleplay marking. Your gap is narrower than it looks. Your differentiator is the mode-per-subsystem matrix plus the GM-as-only-voice constraint.)
  - RPGX AI Assistant: read-and-generate only, no game-state writes. Not a competitor on this axis.
  - ITMO ai-dungeon-master: read for agent-handoff mechanics. **Do not copy the taxonomy.** Its `player_proxy` and `director` agents exist to run a game with no humans in it. It is an automation decomposition, and yours must be a preference decomposition.
