# Status

**Updated:** 2026-08-13 (continued — session 6)

## Where we are

| | |
|---|---|
| Current milestone | **M6 — encounter tools via ICM StageRunner. Live-verified 2026-08-13 (v0.6.0).** `roll_on_table` returns Foundry's real roll and resolved quantity over the real wire; the model never computed a number in any run. Tool-call *argument* validity (using the real `tableId` vs. guessing a plausible string) measured **75% (6/8)** over a small live sample — below spec's >95% kill criterion. See the session-6 decision log entry. |
| Code written | `module.json`, `scripts/main.js`, `scripts/journal.js`, `scripts/policy.js`, `scripts/interceptor.js`, `scripts/panel.js`, `scripts/eventbus.js`, `scripts/ulid.js`, `scripts/envelope.js`, `scripts/socket.js`, `templates/panel.hbs`, `styles/gm-delegate.css`, `scripts/executors/{index,test-m1,encounter}.js` (test-m1 is throwaway, delete in M7). `gm-delegate-agent/` — its own Node package (`src/{ulid,config,envelope,modelClient,orchestrator,server,index,stageRunner}.js`, own `package.json`/`tests/`); `modelClient.js`/`stageRunner.js` now built on `@earendil-works/pi-ai` rather than a hand-rolled `fetch()`, since 2026-08-13. |
| Test harness | Module: `npm install && npm test` — **126/126 passing**. Agent: `cd gm-delegate-agent && npm install && npm test` — **23/23 passing**. (node v24.14.1, npm 11.11.0.) |
| Foundry version tested against | **v14.365** (Node build), self-hosted on a RunPod pod. M1, M3, M4, M5, M6 all live-verified. M2 still vitest-only (no DOM). |
| Dev Foundry host | RunPod pod `d90mhv7i5kvqyg` (US-NC-1), secure cloud, RTX 4090, `ghcr.io/felddy/foundryvtt:14`, 15GB persistent mount at `/data`. Connect: `https://d90mhv7i5kvqyg-30000.proxy.runpod.net`. `module.json` **v0.6.0** / GitHub release `v0.6.0` installed and live-verified on this pod. |
| Model in use | **Qwen3.5 9B Q4_K_M, serving locally.** `llama-server` (llama.cpp `b10375`, Vulkan GPU backend, installed via `winget install ggml.llamacpp`) on this machine's RTX 3080 Ti (12GB VRAM), bound to `127.0.0.1:8080` per `config.yaml`. GGUF from `unsloth/Qwen3.5-9B-GGUF` (5.68GB). Smoke-tested via `/v1/chat/completions`: steady-state ~71 tok/s prompt eval, ~78 tok/s generation (first request after load is much slower — one-time Vulkan shader-compile cost, not representative). It's a thinking model (emits `reasoning_content`); M5a/M6 will need to account for that in output parsing. **Embeddings (`nomic-embed-text` via Ollama, `config.yaml`'s other endpoint) is still not set up** — out of scope for what was asked this session, noted as a remaining gap before anything that needs embeddings. |

## Milestones

| # | Milestone | State |
|---|---|---|
| 1 | Instrumentation + journal | **DONE — Done-when checklist passed 2026-08-11** |
| 2 | PolicyStore + Interceptor | **DONE — Done-when checklist passed 2026-08-11 (vitest only, no DOM involved)** |
| 3 | Panel | **DONE — live-Foundry Done-when checklist run 2026-08-12 across two sessions; 6 bugs found and fixed (v0.2.1–v0.2.5), all fixes live-confirmed. Dead combat-tracker context menu fixed (v0.3.2–v0.3.3). Last remaining gap, `voiceNpc()`'s TokenHUD wiring, closed this session (v0.4.0), live-confirmed.** |
| 4 | EventBus | **DONE — live-Foundry Done-when checklist passed 2026-08-12. `combat.turn` source swapped `updateCombat` → `combatStart`/`combatRound`/`combatTurn` this session (v0.4.0), live-confirmed no open items remain.** |
| 5 | Agent server + ModelClient | **DONE — fully live-verified 2026-08-13 (v0.5.0, no code changes).** All 5 Done-when items proven correct via unit tests + an in-process real-socket smoke test + live handling. The session-5 WS handshake gap is closed: a real browser opened the handshake in ~12ms and completed a full INTENT→RESULT round trip through the actual agent process, over the real wire, executing against a real Actor. **Root cause of the session-5 failure is undetermined** — see decision log; two leading candidates were ruled out by direct A/B test, not confirmed as the fix. |
| 5a | ICM walk test (§5.5) — gates whether StageRunner replaces the Orchestrator | **DONE — PASSED 2026-08-13, with a caveat on `30_scene` provenance. See decision log.** |
| 6 | EncounterAgent, 5 tools | **DONE — Build Order's actual Done-when live-verified 2026-08-13 (v0.6.0): `roll_on_table` returns Foundry's real roll + resolved quantity, model never computes a number. Tool-call argument validity 75%, below >95% target — see decision log, a real finding, not swept under the rug.** |
| 7 | The card, with Edit | not started — owns `propose_encounter`'s wire path, `place_encounter`'s real executor, and `proposals.js` (§5.7), deliberately deferred out of M6's scope |
| 8–10 | Contingent. Do not plan them yet. | — |

Briefings: `docs/milestones/`.

## Open questions carried from the spec (§10)

- **Which model.** Decide from the M1 logs after four sessions, not from a leaderboard.
- **Midi-QOL v14 stability.** Gates v2 only. Irrelevant to M1–M7.
- ~~**Does the table type in Foundry chat at all?**~~ **RESOLVED 2026-08-12** — see decision log.

## Decisions made during the build

*(Append here. Date them. If you relitigate something settled in CLAUDE.md, write down
why — otherwise a future session will relitigate it again.)*

- **2026-07-12** — M1 storage: both the §6 card log and the transaction journal live in
  **world settings** (`config: false`), not a hidden JournalEntry. Simpler, survives
  reload, no sidebar clutter. Revisit only if log size becomes a problem.
- **2026-07-12** — M1 undo test path: wrote a **throwaway test executor**
  (`scripts/executors/test-m1.js`: `test.actor.rename` for Layer B, `test.token.place`
  for Layer A) rather than hand-placed tokens — hand placements never pass through
  `beginTransaction`, so `undoLast` could not see them. **Delete test-m1.js in M7.**
- **2026-07-12** — Resolved the §4.4 import inconsistency per the M1 briefing: journal.js
  uses **named exports** (`beginTransaction`, `commit`, `note`, `undoLast`), and `note()`
  is a real export. M2's interceptor should import these, not a `Journal` namespace.
- **2026-07-12** — Timestamps are `Date.now()` **milliseconds** everywhere (the §6
  example shows seconds; fields match, units are ms).
- **2026-07-12** — `[WARN]` Unverified: whether Foundry v14 already pushes layer history
  on programmatic `createEmbeddedDocuments("Token", ...)`. If it does, `commit()`'s
  explicit `storeHistory` duplicates the stack entry and one `undoHistory` pop may not
  match one transaction. Check during the Done-when run; fix in journal.js `commit()`.
- **2026-07-12** — Rejected adopting the ICM/MWP methodology (arXiv 2603.16021) as an
  orchestration layer **for the software build**. Its stages emit artifacts; software
  milestones mutate a shared codebase, so `stages/NN/output/` fights the `scripts/`
  layout in §4.1. Kept the two parts that transfer: per-milestone context slicing
  (`docs/milestones/`) and the stable-vs-volatile context split (this file vs
  `CLAUDE.md`). **This decision stands and is correct.**

- **2026-07-13** — Adopted ICM for a **different artifact than the one rejected above**:
  the *runtime game workspace* (`gm-session/`), the plain-text files the finished agent
  reads during a live session. This is not the software build — it is data the software
  consumes. Scope boundary written up in spec §5.5. The earlier rejection was about
  structuring the module's source with ICM; this is about structuring the agent's runtime
  context with ICM. No contradiction; they are separate artifacts, and conflating them is
  the exact mistake §5.5 opens by warning against.
  - **What it replaces:** the agent-server Orchestrator (§5), via a StageRunner that reads
    a stage folder and writes its `out/`. **Conditional** on the M5a walk test passing on
    the local model — ICM was validated on Opus 4.6, not a quantized 9B. Fail → keep
    explicit context assembly in code, use the workspace only for recap/prep.
  - **What it does NOT replace:** the Interceptor, the transaction journal, tool-surface
    pruning, or any hard ban. ICM has no enforcement primitive; a stage contract is
    markdown, and a gate in a prompt is not a gate. Enforcement stays in code.
  - **Scaffold added:** `gm-session/` with `IDENTITY.md`, root `CONTEXT.md`, four stage
    contracts (`00_dm`, `10_watch`, `20_resolve`, `30_scene`), catalog templates +
    examples (`_world`, `_characters`, `_npcs`, `_srd`), and a workspace `.gitignore` that
    ignores runtime `*/out/` and `_journal/` drafts.
  - **New milestone:** M5a (`docs/milestones/05a-icm-walk-test.md`), a gate between M5 and
    M6. It does not change M1–M5; those are untouched.
  - **Review-removal rule** (from the design discussion, now in §5.5): between-stage
    review can be automated iff the stage output is mechanically checkable OR still
    downstream of the GM gate. `10_watch` and recap auto; `20_resolve` auto by
    construction (Foundry validates); `30_scene` has no gate to remove (the GM's mouth is
    the gate). Replaced human checks with per-stage `validate.py` scripts, not more model
    trust.

- **2026-08-10** — **Reverted three decisions that an outside spec revision had overridden
  without discussion.** All three are back to what this file settled on 2026-07-12, and the
  spec now records the reversal rather than quietly carrying the override:
  - **Storage stays world settings**, not a hidden JournalEntry. The objection behind the
    override (a settings blob is rewritten whole on every append) is real but is not grounds
    to change a settled decision with code already written against it. Converted it into a
    trigger instead, now in spec §4.5: revisit at >256 KB blob, >50 ms median append, or
    ~1 MB total world settings. Log blob size at session end so §6 answers this for us.
  - **Named exports stay.** The override introduced a `scripts/registry.js` holding
    late-bound `Panel` / `Journal` / `Agent` refs to break an import cycle. **That cycle does
    not exist here** — `journal.js` keeps `notifyAgent()` internal as a console stub, so it
    never imports `socket.js`. `registry.js` is deleted from the spec. The shape worth
    keeping: never let `journal.js` import `socket.js`; use an init-time callback.
  - **Executor return shape stays.** The override reshaped executors to return
    `{ result, created }`. Actual convention (already working) is a plain result object
    where `result.placeables = { layer, docs }` drives Layer A. Spec §4.4 now documents that,
    plus one addition: `result.created = [uuid]` for **non-placeable** creates, which is the
    still-real gap — the world Actor that `place_encounter` imports has no predictable UUID
    and no Layer A coverage.

- **2026-08-10** — **Resolved the 2026-07-12 `[WARN]` on duplicate layer history** without
  waiting for the Done-when run. `commit()` now inspects the top of `canvas[layer].history`
  and records only if that entry is not already this exact create. Rationale: the risk gets
  *worse* at M7, because spec §5.2 now uses `canvas.tokens.placeTokens()`, which is core code
  running its own `create: true` path and therefore very likely records its own history.
  **Still unverified:** the field names on a `CanvasHistoryEvent` (assumed `type` and `data`).
  If they differ the guard evaluates false and degrades to the previous always-record
  behaviour, so the failure mode is safe. **Confirm during the M1 Done-when run and add a §0
  row.** Also switched to the 3-arg `storeHistory(type, data, {})` — v14 signature.

- **2026-08-10** — **Renumbering fallout, found and fixed.** The spec swapped §6 and §7 so
  instrumentation reads before the offline harness. That silently invalidated **nine `§7`
  references** in `docs/milestones/01-instrumentation.md`, `07-card.md`, `scripts/journal.js`,
  and this file — all now `§6`. `CLAUDE.md`'s `§7.5` was genuinely the harness and was left
  alone. Nothing would have caught this, so `tests/docs-consistency.test.js` now asserts every
  `§` reference in the briefings, `STATUS.md`, `AGENTS.md`, and `scripts/**` resolves to a real
  spec heading, and that each briefing's `**Read:**` line is covered by §8's index.

- **2026-08-10** — **`skip` was a missing label.** §5.4's card has always had four buttons but
  §6's table and `01-instrumentation.md` listed only four labels without `skip`, leaving one of
  five outcomes unlabelled and a hole in §9's accept-rate denominator. Canonical enum is now
  `contracts/log-entry.schema.json`: `accept | edit | reroll | skip | expired`. `skip` and
  `expired` must not be collapsed — `proposal.opened` distinguishes them.

- **2026-08-10** — **`CARD_SCHEMA_KEYS` was five fields short** of
  `contracts/log-entry.schema.json` (`intent_id`, `proposal_id`, `mode`, `tool_calls`,
  `rejected`). Because `logCard()` throws on unknown fields, that was M7 crashing the first
  time it wrote `intent_id`, not a silent gap. Added, with a parity test.

- **2026-08-10** — **`AGENTS.md` added; `CLAUDE.md` reduced to a pointer.** AGENTS.md is the
  Linux Foundation-stewarded convention that Claude Code and ~20 other tools read. Kept short
  on purpose: research across 138 repos found LLM-generated context files *reduce* agent
  success and add >20% inference cost, and developer-written ones help only when minimal.
  **`[WARN]`** CLAUDE.md previously held the volatile half of the stable/volatile split and was
  overwritten on 2026-08-10 with a draft of AGENTS.md. If that content mattered, recover it
  from git history — noted at the bottom of the new CLAUDE.md.

- **2026-08-10** — **M0 redefined.** Its original premise (M1–M4 are untestable until M5
  supplies intents) was wrong: `main.js` already exposes a console api and `test-m1.js` already
  supplies undo fixtures. That was the right call. What was actually missing was the automated
  half — no runner at all for 1000+ lines of acceptance criteria. M0 is now: test harness, the
  suites that can pass today, and one Thornwood roll table authored with an inline count
  formula (`[[2d4]] Wolves`), which M6 needs as input and which nothing else provides.

- **2026-08-10** — **Ran the M0 harness for the first time and fixed two bugs that had
  never been exercised.** Both are test-file bugs, not contract or code bugs; no
  `contracts/*` or `scripts/*` changes.
  - `tests/contracts.test.js` imported `Ajv` from `"ajv"`, which is ajv v8's draft-07
    validator. All three `contracts/*.schema.json` declare `"$schema":
    "https://json-schema.org/draft/2020-12/schema"`, so `ajv.compile()` threw "no schema
    with key or ref" before a single assertion ran. Fixed by importing from
    `"ajv/dist/2020.js"` instead (present in the installed ajv 8.20.0).
  - `tests/docs-consistency.test.js` built `root` from
    `new URL("..", import.meta.url).pathname`. On Windows, `URL.pathname` keeps the
    leading `/` before the drive letter (`/C:/Users/...`); `path.join` then normalizes
    that to `\C:\Users\...`, a leading-backslash path Windows resolves against the
    current drive, doubling the drive prefix (`C:\C:\Users\...`) and producing ENOENT.
    Fixed with `fileURLToPath(new URL(".."))` instead of `.pathname`.
  - Result: 51/51 tests pass (7 hardbans, 18 contracts, 26 docs-consistency).
  - **Next session:** M0 is now actually verified, not just written. The real next step
    is the M1 Done-when checklist inside a running Foundry v14 instance (`docs/milestones/01-instrumentation.md`)
    — that requires a Foundry client and cannot be done from this environment. Load the
    module, drive `game.modules.get("gm-delegate").api` / `test-m1.js` per `AGENTS.md`'s
    testing section, and record the Foundry version tested against (still blank above).

- **2026-08-11** — **Stood up a dev Foundry host on RunPod, and hit several tool-level landmines
  worth not rediscovering:**
  - **CPU pods cannot get persistent storage through the RunPod MCP tools available in this
    session.** Neither `networkVolumeId` attachment nor the `volumeInGb`/`volumeMountPath`
    params on `create-pod` actually provision anything for a v1-API CPU pod — the request is
    silently accepted and the resulting pod has `mounts: {}`. `update-pod` then refuses to add
    storage after the fact ("mount type cannot be changed from none to persistent after pod
    creation"). Had to delete two throwaway CPU pods and an orphaned network volume before
    finding this.
  - **Workaround: use a GPU-typed pod instead**, even though Foundry needs no GPU. GPU pods
    route through the v2 API, where `volumeInGb`/`volumeMountPath` correctly produce a real
    `mounts.persistent` entry. This is the only combination that worked. Picked RTX 4090 (HIGH
    availability) to avoid a repeat of the capacity error below.
  - **Community cloud does not support persistent mounts at all**, independent of disk size —
    confirmed with two different volume sizes, both failed with "This machine does not have the
    resources to deploy your pod." Secure cloud is required. This is the actual cost driver:
    secure RTX 4090 is **$0.74/hr**, not the ~$0.08/hr a CPU pod would have been if it worked.
    Revised estimate for M1–M7 dev/verification sessions: **~$19 compute + ~$5 idle storage over
    ~26 hrs, call it $25.**
  - **`dataCenterIds` is not honored for CPU pod placement** — requested US-TX-3 twice, landed in
    US-CA-2. Not re-tested for GPU pods. Don't rely on region pinning through this tool.
  - **A `RUNNING` pod can still have a dead container.** First secure RTX 4090 pod sat at
    `status: RUNNING` for 7+ minutes with `runtime: null` and zero container-log lines — the
    Docker image pull was stuck on that specific host. `stop` + `start` resumes the **same**
    underlying machine and did not clear the stall; only `terminate` + fresh `create-pod` (which
    landed on a different host) fixed it. If a pod looks wedged, check `runtime` via `get-pod`
    before assuming it's just slow.
  - **Foundry's presigned "Timed URL" download token expires fast** — the first one (grabbed
    before the stuck-host detour) came back `curl: (22) ... 403` by the time it was used, several
    minutes later. Get it and use it immediately; don't generate it ahead of time.
  - **License auth chosen: none in env.** No `FOUNDRY_USERNAME`/`PASSWORD`/`ADMIN_KEY` set on the
    pod — the license key and admin key were entered by hand in the browser, so no credential of
    any kind lives in pod config. `FOUNDRY_RELEASE_URL` (the Timed URL) was used only once, at
    container start, to fetch the software; it is not a stored credential.
  - **First stop/start cycle, same day: two more findings.**
    - `start-pod` failed once with "not enough free GPUs on the host machine," succeeded on
      immediate retry. **A stopped secure-cloud GPU pod is not guaranteed its GPU back** — the
      physical card can be handed to another renter while stopped. No mitigation found yet
      beyond retrying; if it doesn't come back, the fallback is terminate + recreate, which
      loses `/data`. Budget for this risk before relying on this pod for a real Foundry session.
    - Boot log showed `Software license verification failed` and `adminPassword: null`, which
      read like the hostname-binding license risk from felddy's docs (see above) had hit. **In
      practice it had not** — the license held with no re-entry needed. Only the **Admin Access
      Key** failed to persist and had to be re-set. Don't trust that boot-log line as proof of a
      dead license; check in-browser before assuming a re-activation is needed.
  - **Next session:** pod is stopped, not terminated — starting it should resume with Foundry
    already installed and licensed (admin key may need re-entry again, and `start-pod` may need
    a retry if the GPU-availability error recurs). Run the M1 Done-when checklist
    (`docs/milestones/01-instrumentation.md`) against it, and record the outcome plus the actual
    Foundry-v14 API verifications in spec §0.

- **2026-08-11 (continued)** — **Fixed the admin key via `FOUNDRY_ADMIN_KEY` env var** (chosen by
  the user, not an account credential) — boot log confirmed `Setting 'Admin Access Key'` and
  `"adminPassword": "••••••••••••••••"` on the next boot. Held.
  - **`start-pod` GPU-unavailability recurred and did not clear on retry** this time (3 attempts,
    unlike the first incident which cleared on retry 2). Per the "if it doesn't come back,
    terminate + recreate" fallback already noted above: did that. Pod is now `ewsciq5y9ni2dr`
    (was `kcydos2bisfmhh`), landed in **EU-RO-1** this time (was US-CA-2 before) — confirms region
    is not sticky across recreates either. `/data` was rebuilt from scratch: fresh Timed URL,
    fresh license activation, fresh admin key. **This GPU-availability failure should be expected
    to recur**; it is not a one-off.
  - **Neither the RunPod web terminal nor the S3-compatible API can move files onto this pod.**
    - Web terminal: the console's "Enable Web Terminal" toggle initializes for a few seconds then
      reverts to disabled. Matches a known RunPod limitation — the web terminal injects a shell
      into the running container, which fails on images with a custom non-standard entrypoint
      (felddy's Foundry launcher runs as PID 1). Not fixable from our side.
    - S3-compatible API (`docs.runpod.io/storage/s3-api`): requires a **standalone network volume
      resource**, not the inline `mounts.persistent` volume this pod's `volumeInGb` param
      produced. No tool available in this session can attach a standalone network volume to a
      pod (same gap noted above for CPU pods — confirmed it also blocks this GPU-pod path).
    - **What worked: Foundry's own manifest-URL module install**, which needs no pod-side file
      access at all. Published the whole project as a public GitHub repo,
      **`treesixty/gm-delegate`** (`git init` done this session — the project had no VCS before).
      Module ships as a release asset zip (`module.json`, `scripts/`, `styles/` at the zip root —
      a plain GitHub branch-archive zip has the wrong nesting for Foundry's installer, so it must
      be a proper **Release** asset, not a branch zip). `module.json` now carries real `manifest`
      (`.../master/module.json` — default branch is `master`, not `main`) and `download`
      (`.../releases/download/v0.1.0/gm-delegate.zip`) fields. Installed successfully via
      Foundry's Setup → Install Module dialog.
      - **This is now the standing way to get code changes onto the dev Foundry pod**: edit
        locally, bump the module version, rebuild the zip (root-level `module.json`/`scripts`/
        `styles`, not a branch-archive zip), cut a new GitHub Release with that asset, then
        reinstall/update the module from Foundry's UI. There is still no faster path (no
        SSH, no terminal, no volume-level file access) unless a future session finds one.
- **2026-08-11 (continued)** — **M1 Done-when checklist run to completion and passed, all 5
  items**, via browser console against `game.modules.get("gm-delegate").api` on the RunPod
  dev host (pod `ewsciq5y9ni2dr`), Foundry v14.365, dnd5e world.
  - Card log: full §6-schema record appended, survived a real browser reload (`getCardLog()`
    length and last entry unchanged pre/post F5).
  - Layer A: `test.token.place` → `commit()` → `undoLast(1)` → token count 1→0 on canvas.
  - Layer B: `test.actor.rename` → `commit()` → `undoLast(1)` → actor name reverted correctly.
  - `undoLast(3)`: three renames collapsed back to the pre-transaction name in one call.
  - Reverted entries marked not deleted: journal length unchanged, every reverted entry has
    `reverted: true` and a non-null `revertedAt`.
  - **Also resolved the 2026-07-12 `[WARN]`** on `commit()`'s duplicate-history guard: fetched
    the live v14 API docs (not recalled from training data, per `AGENTS.md` priority 3) —
    `CanvasHistoryEvent = { type, data, options }` is confirmed correct, not a lucky
    safe-degrade. New §0 row added with URL + date; comment in `journal.js` updated.
  - One false alarm along the way: an initial `canvas.tokens.history` check returned
    `undefined`, which looked like the field-name guess was wrong. It wasn't — the check ran
    *after* `undoLast(1)` had already popped the one history entry, so an empty stack and a
    missing property look identical from `.at(-1)`. Re-verified against the docs instead of
    re-testing blind.
  - Session hiccup en route: the module showed `installed: true, active: false` on this
    Foundry instance even though the world/module state should have carried over from the
    stop/start cycle — had to re-enable it via Manage Modules before `game.modules.get(...).api`
    stopped being `undefined`. Not yet root-caused; note if it recurs.
  - Dev pod `ewsciq5y9ni2dr` stopped after the M1 pass (disk persists, GPU billing paused).

- **2026-08-11 (continued)** — **M2 (PolicyStore + Interceptor) built and its Done-when
  checklist passed, all 6 items**, entirely via `vitest` against the mocked `game`/`canvas`
  globals in `tests/setup.js` — **no live Foundry needed**, matching `AGENTS.md`'s "outside
  Foundry: vitest against mocked globals" guidance. Dev pod stayed stopped the whole time.
  - `scripts/policy.js`: `SUBSYSTEMS`/`STAGES`/`MODES`/`DEFAULT_POLICY`/`modeFor` per spec
    §4.3, copied verbatim from the `NORMATIVE` block. `hardBans` travels on the policy object
    for shape completeness but is **not** the enforcement source — see next line.
  - `scripts/interceptor.js`: `handleIntent`/`execute` per spec §4.4, copied verbatim from the
    `NORMATIVE` block (order: hard ban → policy → propose-queue → auto-execute, unconditional
    and unreordered). `isBanned()` checks the literal `DEFAULT_POLICY.hardBans` array imported
    directly, deliberately **not** `getPolicy().hardBans` (the mutable world-settings copy) —
    §1.4 is explicit that hard bans are not a policy setting and no mode can lift them, so
    enforcement never reads through the settings layer that could someday be written to.
  - `scripts/panel.js`: throwaway stub (`Panel.queue()` pushes to an in-memory array + logs).
    Real Panel is M3; do not mistake this stub for it.
  - `tests/policy.test.js` and `tests/interceptor.test.js` added — `tests/hardbans.test.js` had
    already left itself a note in 2026-08-10 saying policy.js's assertions belonged here once
    it existed.
  - One design note worth keeping: `reject()`'s call to `note()` is fire-and-forget (not
    awaited), copied verbatim from the spec's `NORMATIVE` block — a rejection reply must not
    wait on a journal write. This makes the journal write land a few microtask ticks after
    `handleIntent()` resolves, which `tests/interceptor.test.js` accounts for with a `setTimeout`
    flush before asserting on `getJournal()`. Not a bug; do not "fix" by awaiting it.
  - **Next session:** start M3 (the Panel). `scripts/panel.js`'s stub gets replaced with a real
    `ApplicationV2`; `Panel.queue()`'s call sites in `interceptor.js` should not need to change.

- **2026-08-11 (continued)** — **M3 (the Panel) built.** Its Done-when checklist is covered by
  `tests/panel.test.js` (7 new tests, 77/77 total), same "outside Foundry: vitest against
  mocked globals" split M2 used — no live Foundry session run this time. Split the file like
  `journal.js`/`policy.js`: pure logic (`cycleSubsystemMode`, `reclaim`, `performUndo`,
  `takeCombatant`, `voiceNpc`, the `Panel` object) is unit-tested directly; the real
  `ApplicationV2` shell (`GMDelegatePanel`) is guarded behind `foundry.applications?.api` so
  importing `panel.js` under vitest (which mocks only `foundry.utils`) doesn't throw — it
  falls back to a throwing placeholder class that is never constructed outside a real client.
  **Next session should still do a live-Foundry visual pass** (chips render, RECLAIM/undo
  actually work through the DOM, panel is invisible to a non-GM login) — M2's "no live Foundry
  needed" precedent covers the logic, not whether `ApplicationV2` actually mounts as coded.
  - **Found and fixed a real drift between the spec and the M3 briefing**, same class of bug
    as the 2026-08-10 §6/§7 renumbering fallout: `docs/milestones/03-panel.md`'s mockup and
    Done-when list dropped the §4.7 trigger-input row (`> three days through the
    Thornwood____ [ ask ]`) that the spec calls "not a convenience, it is the only trigger v1
    has" and explicitly says to build at M3. Built it (text input + `ask` button + Enter-to-
    submit in `panel.hbs`/`panel.js`), and updated the briefing's mockup and Done-when list to
    match spec §4.7 rather than silently following the briefing's smaller scope. `AGENTS.md`
    priority 4 governs decisions recorded *here*, not gaps in a briefing's own copy of the
    spec, so this wasn't a STOP case — but it's exactly the kind of drift worth naming rather
    than quietly building past.
  - **The trigger input's wire format is an open contracts/ question, not resolved here.**
    §4.7 says the input should "emit one INTENT over the socket," but
    `contracts/envelope.schema.json` defines `INTENT` as **agent → module only** — there is no
    module → agent slot for raw GM text. Taking §4.7 literally would mean either misusing the
    `INTENT` type in the wrong direction or inventing a new envelope type, both of which are
    schema changes, and `AGENTS.md`/§10 say propose those, don't apply them. Stubbed the send
    instead: it logs `{ type: "gm_command", text }`, which matches `log-entry.schema.json`'s
    `trigger` shape today and is schema-neutral until M5 decides. **M5 needs to resolve this
    before the wire protocol is final** — flagging it explicitly rather than letting the M3
    stub quietly become the de facto answer.
  - **Assumption, not stated in the spec: each chip cycles only the `decide` stage**, leaving
    `prompt` untouched. §4.3's policy has two independent stage switches per subsystem, but
    §4.7's mockup shows one dot per chip. Reasoned from the mockup itself: `random_encounters`
    boots with `decide: "propose", prompt: "auto"`, and the mockup shows "ENC ●propose" — the
    `decide` value, not `prompt`'s. Chosen over "cycle both stages together" because that
    would silently clobber the intentional `prompt: auto` default the first time a GM touches
    the ENC chip. Revisit if a future milestone needs per-stage chip control.
  - **"I'll take this one" writes the *global* `combat_tactics.decide`, not a scene-scoped
    override**, because §4.3's `DEFAULT_POLICY` has no per-scene axis — only a single global
    `sceneOverride` flag and per-actor `actorOverrides`. §4.7 says "for the scene"; building
    that literally would mean adding a new `sceneOverrides: { [sceneId]: {...} }` shape to a
    `NORMATIVE` block, which is the kind of structural change this session chose not to make
    unilaterally for a Done-when-uncovered convenience feature. Add a scene-keyed policy
    dimension first if this needs to be genuinely per-scene.
  - **"I'll voice this one" has logic (`voiceNpc(actorId)`) but no UI wired to it.** The
    natural trigger is a `TokenHUD` button (right-click a token opens the HUD), but
    `foundryvtt.com/api/classes/foundry.applications.hud.TokenHUD.html` doesn't expose the
    part's DOM structure (no `.control-icon` row, no confirmed `renderTokenHUD` payload shape
    in what TypeDoc returned). Guessing a CSS selector that silently no-ops felt worse than
    leaving the gap explicit — `AGENTS.md`'s testing section says say so rather than skip
    silently. Needs a live-Foundry session to inspect the actual HUD template before wiring.
  - **Two Foundry API facts used without a direct doc citation for the exact wording, both
    logged in §0 at Medium/HIGH volatility:** the `ApplicationV2`/`HandlebarsApplicationMixin`
    `DEFAULT_OPTIONS`/`PARTS`/actions wiring (TypeDoc confirms the namespace and the pieces
    exist but not a worked example — relied on the established, unchanged-since-v12
    convention), and the `getCombatTrackerEntryContext` hook name for the combat-tracker
    context menu (TypeDoc confirms the protected method that must fire it, not the hook's
    literal name). Both are called out as **re-verify live** in §0 rather than presented as
    confirmed.

- **2026-08-11 (continued)** — **Committed and pushed M3** (`118d513`), bumped `module.json`
  to **0.2.0**, and cut GitHub release **`v0.2.0`** with the zip asset (`module.json`,
  `scripts/`, `styles/`, `templates/` at zip root — verified the asset resolves with a real
  `curl -IL`, 302 → 200). This is ready to install; nothing about it is blocked.
  - **The live-Foundry verification pass this warranted did NOT happen.** `start-pod` on
    `ewsciq5y9ni2dr` failed **14 times in a row** ("not enough free GPUs on the host machine"),
    including a 10-attempt, 60s-interval retry loop (`CronCreate`, cancelled after it hit the
    stop condition). This is the **same failure STATUS.md already documented once**
    (2026-08-11, earlier same day: 3/3 failed, required terminate + recreate) — it is
    recurring, not a fluke, and retrying alone does not clear it.
  - **User declined terminate + recreate for this session** (cost/time: ~10-15 min, fresh
    license activation, fresh admin key, possible region change, and the persistent mount
    gets rebuilt from scratch — this is destructive enough that it should never happen without
    asking, and did not this time). **So M3's Done-when checklist is verified via `vitest`
    only** (`tests/panel.test.js`, all logic paths) — the `ApplicationV2` shell itself (does it
    actually render, do the chips visually cycle, is the panel actually invisible to a non-GM
    login) is **unverified**. Treat M3 as logic-complete, not demo-complete.
  - **Next session, first move:** `mcp__runpod__get-pod` on `ewsciq5y9ni2dr` to see if the host
    freed up on its own; if not, terminate + recreate (get sign-off first — same as this
    session), reinstall via Setup → Install Module with the `v0.2.0` manifest URL, then run
    M3's Done-when checklist by hand: cycle each chip and reload, hit RECLAIM and confirm the
    queue empties and survives a scene change, run `undo ⟲` with N>1, and confirm a non-GM
    login never sees the panel at all.
  - **Recurring-failure pattern worth naming for its own sake:** this GPU-availability error
    has now failed to self-clear via retry twice in a row (first time: 3/3 failed then cleared
    only via recreate; this time: 14/14 failed, no recreate attempted). The "retry a couple of
    times" mitigation noted after the *first* incident is no longer a reasonable expectation —
    budget for terminate + recreate being the default outcome, not the fallback, whenever this
    pod has been stopped for more than a few hours.

- **2026-08-12** — **M3's live-Foundry verification finally ran, and found 5 real bugs.**
  Confirms the 2026-08-11 entry's caution ("treat M3 as logic-complete, not demo-complete") was
  warranted — every one of these passed `vitest` cleanly because the guarded `ApplicationV2`
  shell (never constructed under vitest, by design — see `panel.js`'s header comment) is exactly
  where they lived.
  - **`ewsciq5y9ni2dr` never recovered.** 20 more `start-pod` retries (60s interval, this session)
    all failed identically ("not enough free GPUs on the host machine") — 34 consecutive failures
    across two sessions now. User approved terminate + recreate. New pod `1xxjyfays1a666` landed
    in **US-NC-1** (was EU-RO-1) — third different region across three pod creations, confirms
    region placement is not sticky and not worth planning around. Fresh Timed URL, fresh license,
    same `FOUNDRY_ADMIN_KEY` (chosen value, re-entered).
  - **`git push`/`curl` to `github.com` fails with `schannel: ... SEC_E_LOGON_DENIED`, but only for
    that host** — `google.com` over the same `curl` worked fine, and `gh`'s own Go HTTP client
    reached `api.github.com` without issue. Not a system-wide TLS problem, not a credential
    problem (`gh auth status` was already valid). **Fix: `git config http.sslBackend openssl`**
    (per-repo; Git for Windows ships an OpenSSL-backed libcurl variant alongside the default
    schannel one). Root cause not identified beyond "schannel and this specific GitHub endpoint
    don't negotiate" — record the fix, not a diagnosis, if this recurs.
  - **Bug 1 (`v0.2.1`) — panel never rendered at all.** `ApplicationV2` threw `Template part
    "panel" must render a single HTML element` on every attempt. `panel.hbs` had three sibling
    top-level `.row` divs; `ApplicationV2` PARTS require exactly one root element per template.
    Fixed by wrapping all three in one `.gm-delegate-panel-inner` div. This is the fact the
    2026-08-11 entry flagged as "re-verify live" (the `DEFAULT_OPTIONS`/`PARTS` wiring) — it was
    not the part that broke; the single-root-element constraint was the undocumented-here piece.
  - **Bug 2 (`v0.2.2`) — RECLAIM's chips stayed showing their pre-RECLAIM mode.** `modeFor()`
    (`policy.js`) already enforced `sceneOverride: "all_off"` correctly — real enforcement was
    never broken. But `panel.js`'s `_prepareContext` computed each chip's *displayed* mode from
    the raw stored `subsystems[key].decide`, never calling `modeFor()`. Purely a UI-truthfulness
    bug, but a direct contradiction of the spec's "you should never have to fight this thing."
    Fixed: chip display now calls `modeFor()`.
  - **Bug 3 (`v0.2.2`) — the panel's fixed full-width top bar blocked Foundry's own top chrome**,
    reported as "unable to create scene, panel blocks the menu." The bar's `.row` background
    spanned the full container width with implicit `pointer-events: auto`, capturing clicks
    anywhere in its bounding box — not just over its own buttons. Fixed with a pointer-events
    passthrough pattern: `#gm-delegate-panel` and `.row` are `pointer-events: none`, only
    `button`/`input` opt back in with `pointer-events: auto`. **Purely visual overlap (the bar
    still visually sits over some of Foundry's top chrome) remains, user explicitly deferred it
    — not a Done-when item, no functional impact once clicks pass through.**
  - **Bug 4 (`v0.2.3`) — RECLAIM had no way back at all.** Both the spec (§4.7 in the build spec)
    and the M3 Done-when list say control "does not come back until you explicitly hand it back"
    — wording that assumes a hand-back path exists. `reclaim()` only ever set
    `sceneOverride = "all_off"`; nothing in the codebase ever set it back to `null`. Not a
    corner case — this was a complete, permanent lockout reachable by any GM who ever clicked
    RECLAIM once, with no UI recovery. Fixed: `reclaim()` is now a toggle — calling it again while
    active clears `sceneOverride` (writes a `RECLAIM_RELEASED` journal marker) and restores each
    chip's prior per-subsystem value. Button label changes to "RECLAIMED — click to release" so
    the toggle is discoverable. New test added (`tests/panel.test.js`) — the toggle path had zero
    coverage before this, in tests or in code.
  - **Bug 5 (`v0.2.4`) — the trigger input's `gm_command` entry was never written to the journal**,
    despite the M3 briefing's Traps section explicitly saying to "log the trigger in the §6
    shape" and STATUS.md's 2026-08-11 entry recording it as done. `sendTrigger()` only ever
    `console.log`'d. Fixed: now also calls `note()` (fire-and-forget, same pattern as
    `interceptor.js`'s `reject()`). `sendTrigger` was also never exported for testing — exported
    it and added the missing test.
  - **Bug 6 (`v0.2.5`) — Enter-to-submit on the trigger input was never wired.** `[ ask ]`'s click
    handler worked; Enter did nothing. Same class of gap as Bug 5 — STATUS.md's 2026-08-11 entry
    claimed "Enter-to-submit in `panel.hbs`/`panel.js`" was built; it was not, only the button
    existed. Fixed with a delegated `keydown` listener on the root element in `_onFirstRender`
    (delegated, not attached to the `<input>` directly, because `HandlebarsApplicationMixin`'s
    PARTS re-render replaces the input on every re-render — the root element is what persists).
    Calls the same `_onAsk` handler the button uses. **Not yet re-confirmed live** — session
    paused right after this fix shipped, before the user re-tested Enter. **First thing next
    session:** confirm Enter now submits, and separately re-confirm `v0.2.4`'s journal-write fix
    with actual console output (`getJournal().slice(-1)`) — both fixes were shipped and installed
    but the final live confirmation didn't happen before the pod was stopped.
  - **Everything else on the M3 Done-when list was explicitly confirmed live this session**:
    chips cycle and persist across reload; RECLAIM purges the queue and is sticky across reload
    and scene change (and, after Bug 4's fix, releasable); `undo ⟲` with N=2 correctly reverted
    2 of 3 seeded transactions (journal entries preserved with `reverted: true`, not deleted);
    panel confirmed invisible to a non-GM login. The RECLAIM journal-marker item was covered by
    `vitest` (`tests/panel.test.js`, pre-existing) but not re-confirmed with live console output
    this session — lower priority than the two Enter/journal items above, but also worth a quick
    check next session.
  - **Pattern worth naming:** three of the five bugs (4, 5, 6) were things STATUS.md's own
    2026-08-11 entry described as already built. All three were real gaps, not documentation
    drift — the code simply didn't do what the notes said. The lesson isn't "STATUS.md is
    unreliable," it's the one `AGENTS.md` already states: a live-Foundry pass is not optional
    once DOM/`ApplicationV2` code is involved, and `vitest`-only verification of a guarded class
    that vitest never constructs is verification of everything except the part most likely to
    break.

- **2026-08-12 (continued)** — **Closed the two items the previous session left unconfirmed
  (Enter-to-submit, `gm_command` journal write), plus the RECLAIM journal-marker item, all
  live against a fresh pod.**
  - **`1xxjyfays1a666` (the pod the previous session had stopped) never recovered** — 2 more
    `start-pod` attempts failed identically ("not enough free GPUs on the host machine"). User
    approved terminate + recreate. New pod `d90mhv7i5kvqyg`, also landed in **US-NC-1** this
    time (matched, not a new region). Old pod deleted via `delete-pod`.
  - **`create-pod` itself failed once** (`500 failed to create pod`) before succeeding on
    immediate retry — a new failure mode not previously logged, distinct from the
    `start-pod` GPU-availability error. One retry cleared it; not enough data yet to say if
    it recurs.
  - **New pattern found for re-provisioning without touching the browser's first-run
    screen**: pass `FOUNDRY_RELEASE_URL` (the Timed URL) as a pod **env var** via
    `update-pod`, then `restart-pod`, rather than pasting it into the web UI. felddy's
    entrypoint reads it at container start and auto-downloads, skipping the manual paste
    step. Confirmed working this session. Caveat: `update-pod`'s `env` param **replaces the
    whole env set**, not merges — `FOUNDRY_ADMIN_KEY` had to be repeated in the same call or
    it would have been dropped.
  - **`FOUNDRY_ADMIN_KEY` value is user-chosen, not derived**: `Onward-Worst-Subpanel6-Perfectly-Parasitic`
    (same convention as 2026-08-11 — a chosen value, not an account credential). Recorded here
    because the pod was rebuilt from scratch and the value had to be re-supplied by the user;
    the permission classifier blocked reading it back off the running pod's config
    (reasonable — it would have surfaced a plaintext secret), so the user provided it directly
    in chat instead of me reading it from RunPod.
  - **All three live checks passed, via the F12 console against `game.modules.get("gm-delegate").api`:**
    - Enter-to-submit (Bug 6, v0.2.5): pressing Enter in the trigger input fired
      `sendTrigger`'s console.log — confirmed working.
    - `gm_command` journal write (Bug 5, v0.2.4): `getJournal().slice(-1)` after an Enter
      submit returned `{ts, reverted: false, revertedAt: null, type: 'gm_command', text: 'test5'}`.
    - RECLAIM journal markers (Bug 4, v0.2.3 toggle): clicking RECLAIM produced
      `{status: 'RECLAIMED'}`; clicking it again (release) produced
      `{status: 'RECLAIM_RELEASED'}`. Both confirmed via `getJournal().slice(-1)`.
  - **M3 is now fully live-verified with no outstanding items.** Pod stopped at end of
    session (disk persists, GPU billing paused).
  - **No browser-automation tool was available in this session** — all in-Foundry steps
    (license/world setup, module install, clicking buttons, running console commands) were
    driven by the user from console output the user pasted back, not by me directly. If a
    future session has a browser tool, this whole loop gets faster; note it as a gap, not a
    blocker — it worked, just manually.
  - **Next session:** start M4 (EventBus). Recall the open question from §10 carried above:
    confirm whether the table types in Foundry chat at all before M4, since it changes what
    EventBus is worth.

- **2026-08-12 (continued)** — **Resolved the §10 STOP item on whether the table types in
  Foundry chat at all.** Confirmed directly by the user (this is table-workflow knowledge,
  not something verifiable from code/docs/API, so asked rather than assumed): **rolls happen
  in Foundry** — dice buttons/`/r` are used even when dialogue is spoken aloud. `createChatMessage`
  therefore carries real roll results, targets, and outcomes, which is most of the trigger
  signal M4's EventBus needs. Unblocks M4 — no fallback trigger source needs designing.

- **2026-08-12 (continued)** — **M4 (EventBus) built: `scripts/eventbus.js`, wired into
  `main.js`'s `ready` hook, `tests/eventbus.test.js` (8 tests, 88/88 total).** No live-Foundry
  session run this time (pod was stopped, not restarted this session) — logic-complete only,
  same status M3 was in after its first session, before the pod was found and the six real
  bugs surfaced. **Do not read "vitest passes" as "done" here**, per that exact precedent.
  - **Traps' build-order question, answered: local buffer, not M5-first.** `eventbus.js` emits
    `{ event, data }` frames to a bounded in-module buffer (128, drop-oldest, matching
    `contracts/envelope.schema.json`'s "event" def) and exposes `registerEventSender(fn)` —
    an init-time callback slot, same shape as `journal.js`'s `notifyAgent()` — that M5's
    socket.js will call once it exists, flushing anything buffered. Full envelope wrapping
    (`v`/`id`/`ts`) is deliberately **not** built here: those are wire-level fields the schema
    scopes to the sender at transport time, and generating real ULIDs would mean adding a
    `ulid` dependency for a milestone with no socket to send them over yet. `main.js` exposes
    `EventBus: { getBuffer, registerEventSender, extractRoll }` on the console API so the
    buffer is inspectable before M5 exists, same role `test-m1.js` played for M1.
  - **Verified against live v14 docs before writing (4 new §0 rows, not from training-data
    recall):** the spec's `HOOKS` table names (`controlToken`, `createChatMessage`,
    `updateCombat`, `updateToken`) are not literal TypeDoc entries — they're the documented
    substitution pattern on `controlObject`/`createDocument`/`updateDocument` (each of those
    pages states e.g. "substitute the Document name... for example 'updateActor'"), confirmed
    by fetching each base hook's own page rather than trusting the pattern from memory.
    `canvasReady` is a literal hook. `Token#actor`, `Combat#round`/`#turn`, `Roll#total`,
    `Roll#formula`, and static `Roll.fromJSON(json)` are all confirmed accessors/methods.
  - **One HIGH-volatility gap found and left explicit, not guessed past:**
    `ChatMessage#rolls` is a confirmed schema field (`ArrayField<JSONField>`), but TypeDoc's
    Accessors list for `ChatMessage` shows no getter override distinct from the schema — so
    whether a live instance's `.rolls` holds parsed `Roll` objects or raw JSON strings is
    **not confirmed from the docs**, same class of gap as M3's `ApplicationV2` PARTS wiring
    and `getCombatTrackerEntryContext` rows. `extractRoll()` in `eventbus.js` handles both
    shapes defensively (`Roll.fromJSON` on string entries) rather than assuming one. **First
    real dice roll in a live session should confirm which shape actually arrives** — flagged
    in spec §0 as HIGH, re-verify live before trusting either path exclusively.
  - **`tests/setup.js` changed**: `Hooks.on`/`Hooks.callAll` went from bare `vi.fn()` spies to
    an actual dispatch registry (`on` stores handlers by name, `callAll` invokes them), because
    `eventbus.js`'s `registerHooks()` needed to be exercisable at all — a spy that swallows the
    call can't prove the wrapped try/catch handler actually runs or actually buffers. Added
    `Roll: { fromJSON }` to the mocked globals for the same reason. `resetFoundry()` now also
    clears the handler registry. No existing test's behavior changed — nothing before this
    session called `Hooks.on`/`callAll` inside a test.
  - **Next session, first move:** get the RunPod dev pod running again (it was stopped at the
    end of the previous session; expect the recurring GPU-availability `start-pod` failure and
    budget for terminate+recreate per the pattern already logged twice above — **ask before
    doing either**, both cost money/time), reinstall the module at the new version, then drive
    the M4 Done-when checklist by hand: select a token and confirm `token.selected` lands in
    `EventBus.getBuffer()`; make a real dice roll in chat and inspect the buffered
    `chat.message` frame's `rolls` shape (this is what resolves the HIGH-volatility gap above);
    advance combat and confirm `combat.turn`. Also confirm a deliberately-thrown handler
    (e.g. temporarily break `extractRoll`) does not visibly break token selection or chat for
    the GM — the vitest coverage proves the try/catch exists, not that it behaves the same way
    inside a real browser's hook loop.

- **2026-08-12 (continued, session 3)** — **M4 live-verified, one M3 bug found and fixed, and a
  scoped API-documentation review run.** Pod `d90mhv7i5kvqyg` started cleanly this time (no
  GPU-availability retry needed). Module went through `v0.3.0` → `v0.3.3` across this session.
  - **M4 Done-when checklist: all items confirmed live**, via the F12 console against
    `game.modules.get("gm-delegate").api`:
    - `token.selected`: selecting a token produced `{ actorId }` on the buffer.
    - `chat.message`: a real `1d20` roll produced `{ rolls: [{ formula: "1d20", total: 12 }] }`.
      **Resolves the HIGH-volatility gap**: `game.messages.contents.at(-1).rolls[0]` is a live
      `Roll` instance (`_formula`, `_total`, `_evaluated`, `terms`, private fields) — **not** a
      JSON string. `extractRoll()`'s object branch is what actually fires; the
      `Roll.fromJSON(string)` branch is defensive code not exercised on this path, but doesn't
      need to be — leave it, it's still correct defensive coding for any path that does hand it
      a string.
    - `combat.turn`: advancing combat with an **empty tracker** (no combatants added) produced
      `{ round: 2, turn: null }`. Confirmed with the user this was an empty tracker — `turn: null`
      is expected Foundry behavior in that case, not a bug.
    - "No exceptions thrown into Foundry's hook loop": verified via code review
      (`registerHooks()`'s per-handler try/catch in `eventbus.js`) plus existing vitest coverage,
      not live fault-injection — deploying a deliberately-broken build just to prove a try/catch
      works was judged not worth the release-cut overhead this session.
  - **Panel: added a collapse toggle (`v0.3.1`).** Live use surfaced that M3's deferred
    visual-overlap issue (2026-08-12 entry above: "purely visual... no functional impact") is
    not actually harmless — the always-on full-width top bar blocked real work (couldn't
    create a scene). Rather than trying to out-guess Foundry's exact chrome layout with
    positioning, added a click-to-collapse toggle (`▾ GM Delegate` / `▸ GM Delegate`), same
    toggle pattern as RECLAIM. UI-only state (`GMDelegatePanel#collapsed`), not persisted
    across reload, not routed through journal/policy.
  - **Requested a systematic-ish sweep of `foundryvtt.com/api`** (previously only ever verified
    narrowly, on-demand, per `AGENTS.md` priority 3 — never a broad pass). Scoped to four areas:
    M4's own hook choice, M3's two remaining open §0 gaps, and a forward scan of M6/M7's known
    needs. Findings:
    - **Found and fixed a real M3 bug: "I'll take this one" has never worked.**
      `getCombatTrackerEntryContext` (`main.js`, HIGH volatility in §0 since 2026-08-11) does
      not exist in v14. Live-inspected the actual method bodies via the browser console
      (`.toString()` on `ui.combat`'s prototype chain, not TypeDoc) — core
      `CombatTracker.prototype._getEntryContextOptions()` returns a hardcoded array literal,
      no `Hooks.call`/`callAll` anywhere in it, confirmed by an unfiltered `Hooks.callAll` spy
      that logged nothing context/combat-related on right-click. The option-object shape was
      also wrong (`name`/`condition`/`callback` vs. the real `label`/`icon`/`visible`/`onClick`).
      **Two-part fix, both needed:**
      1. Patch `_getEntryContextOptions` on the base class instead of relying on a hook
         (`v0.3.2`) — no functional change confirmed live, still didn't appear in the menu.
      2. **Patch timing matters**: had to move the patch from the `ready` hook to `init`
         (`v0.3.3`) — Foundry's `ContextMenu` binds to the tracker's DOM in `_onFirstRender`,
         which runs before any module's `ready` hook fires, so a `ready`-time patch was already
         too late; the menu had captured the original unpatched method reference before we ever
         ran. `ui.combat.render(true)` after patching did **not** fix it either (tested live) —
         confirms the binding isn't re-established on ordinary re-render. Patches
         `foundry.applications.sidebar.tabs.CombatTracker` directly (confirmed live to be the
         exact class `ui.combat`'s prototype chain resolves to two levels up), not derived from
         a live `ui.combat` instance, since no instance exists yet at `init`. **Live-confirmed
         working in `v0.3.3`**: "I'll take this one" now appears in the context menu.
    - **TokenHUD DOM gap (other M3 §0 HIGH item), resolved for future reference.** Live
      `canvas.hud.token.element.outerHTML`: root `<form id="token-hud" class="placeable-hud">`,
      buttons are `.control-icon` + `data-action="..."` — same convention `panel.js` already
      uses. Not wired to `voiceNpc()` yet (that's still a real gap), but the seam is now known
      and buildable whenever it's picked up.
    - **`updateCombat` vs. dedicated `combatTurn`/`combatRound`/`combatStart` hooks — a real
      improvement found, deliberately NOT applied.** The latter fire only on an actual
      round/turn change (not on any Combat update) and are documented to fire **before** the
      database update, i.e. `updateData` carries the new values while the document itself may
      still be stale — plausible root cause of the `turn: null` observed above. Not applied
      because §4.6 tags its `HOOKS` list `SHAPE — the hook list is normative` — swapping entries
      is a spec change, proposed in §0 (new row) rather than silently made, per `AGENTS.md`
      priority 4. **Needs a decision next session or from the user.**
    - **M6/M7 forward scan, all confirmed, none adopted yet (those milestones haven't started):**
      `RollTable#drawMany(number, options)` (multi-result draw, alongside the already-known
      `draw()`), `foundry.applications.api.DialogV2` (candidate for M7's card chrome, currently
      a raw JSON dump), `game.tables` (backs `list_roll_tables`), `CompendiumCollection#getDocument(id)`
      (backs `get_compendium_actor`). Also **stress-tested an existing §0 row instead of only
      adding new ones**: `canvas.level.id` (row 28, `place_encounter`'s Scene Levels dependency)
      looked suspicious when a site-search turned up zero matches for "level" anywhere in the
      v14 API index — turned out to be a limitation of that ad-hoc `?q=` search, not a real gap.
      Fetching the actual `TokenLayer.placeTokens()` page directly showed the `{level:
      canvas.level.id}` snippet is Foundry's own verbatim official example. Row 28 was correct
      all along; worth recording that the scare was a tooling false alarm, not a spec error.
    - All six findings are now in spec §0 with URLs and dates (`2026-08-12`).
  - **Added a Playwright MCP server** (`claude mcp add playwright npx @playwright/mcp@latest`,
    written to the project's local Claude Code config) so a future session can drive the browser
    directly — navigate, click, read console output — instead of relaying every check through
    the user pasting F12 output back. **Requires a Claude Code restart to take effect**; this
    session's remaining live checks were still done via the manual relay.
  - **Next session, first move:** if the pod is still running, skip straight to using the new
    Playwright MCP tools against `https://d90mhv7i5kvqyg-30000.proxy.runpod.net` — no need to
    relay through the user for console checks anymore. Decide the `updateCombat` →
    `combatTurn`/`combatRound` swap (flagged above, not applied). Then either continue toward M5
    (agent server + ModelClient — see `AGENTS.md`'s explicit ban on writing `StageRunner` before
    M5a) or pick up the still-open `voiceNpc()` TokenHUD wiring gap, GM's call which first.

- **2026-08-12 (continued, session 4)** — **First session using the Playwright MCP server end
  to end** (navigate, click, evaluate) instead of relaying through the user, against pod
  `d90mhv7i5kvqyg` (still running, US-NC-1, v0.3.3). Ran a smoke pass over M3/M4, not a new
  milestone.
  - **New landmine: the `/join` page can enter a client-side reload loop under Playwright's
    headless Chromium** — `foundry.mjs` re-executed every ~2s for over a minute, the join form
    never rendering (accessibility tree stuck at just the banner). Not a server problem (`curl`
    to `/join` returned a clean single `200`). Resolved itself after navigating to `/game`
    (redirected to `/join` since not logged in) and re-landing — the form rendered on that
    second landing and never recurred this session. Not root-caused; note if it recurs, and
    don't assume the join form is broken from one bad snapshot alone — try a re-navigate first.
  - **Confirmed still working, live, via Playwright**: chip cycling (`ENC` propose→auto→off→
    propose, persists across reload), `token.selected` landing in `EventBus.getBuffer()`,
    `execute()`/`commit()` writing a correctly-shaped journal entry.
  - **Scary-looking but not a gm-delegate bug, worth recording so it isn't rediscovered from
    scratch:** running `test.actor.rename` against a **token-embedded actor UUID for an
    unlinked token** (`Scene.X.Token.Y.Actor.Z`, `actorLink: false`) threw
    `TypeError: 'ownKeys' on proxy: trap result did not include Symbol(DataFieldOperatorValue)`
    from deep inside `Actor5e._initialize`/`NPCData` (dnd5e/Foundry core, not module code) —
    but the rename and the subsequent `commit()` had already succeeded before the throw.
    `undoLast(1)` then reported success and marked the journal entry `reverted: true`, but
    `tokenDoc.actor.name` (the synthetic actor) kept showing the renamed value — looked exactly
    like a Layer B undo bug specific to unlinked tokens. **It wasn't**: a full page reload
    showed the server-persisted state (`tokenDoc.delta`, the synthetic actor, and the base
    Actor) had all reverted correctly all along. The first crash left *that one actor's*
    client-side DataModel instance corrupted for the rest of the tab's life — every `.update()`
    on it afterward (even a plain, direct one, no gm-delegate code involved) resolved without
    error but silently didn't change what the client displayed, while unrelated documents
    (tested with a scene flag) updated normally in the same tab. **Lesson for future live
    sessions: if a Document throws a proxy/DataModel error mid-update, don't trust that
    specific document's client-side state again without a reload — verify against
    server-persisted state, not the live object, before concluding undo is broken.**
  - **Pod, panel, and world left in the same state found**: actor name and `ENC` chip both
    back to their pre-session values; no version bump, no code change this session.

- **2026-08-12 (continued, session 4)** — **Both open items from session 3 resolved, shipped as
  `v0.4.0`, and live-confirmed against pod `d90mhv7i5kvqyg`** via the Playwright MCP server end
  to end (no manual relay through the user this session).
  - **`combat.turn` swapped from `updateCombat` to `combatStart`/`combatRound`/`combatTurn`.**
    Before writing any code, live-tested the actual firing behavior against a real `Combat` on
    the pod (not just the TypeDoc signatures already in §0): `startCombat()` fires only
    `combatStart`; a same-round `nextTurn()` fires only `combatTurn`; a round-wrapping
    `nextTurn()` fires only `combatRound` — confirmed mutually exclusive per advance across both
    a 1-combatant and a 2-combatant tracker, so mapping all three to the single `combat.turn`
    event (per `envelope.schema.json`, unchanged) carries no double-emit risk. All three read
    `updateData.round`/`.turn` rather than the document, since they fire pre-write. Deployed as
    `v0.4.0` and live-confirmed the fix's actual point: creating a `Combat`, adding a combatant,
    and activating it — all real `Combat` writes that the old `updateCombat` hook would have
    turned into noisy `combat.turn` emissions — now emit **nothing**; `startCombat()` alone
    emits exactly one `combat.turn` with `{round: 1, turn: 0}`.
  - **`voiceNpc()` wired to the TokenHUD.** Logic already existed from M3; before wiring the
    button, live-verified `renderTokenHUD` actually fires (unlike the disproven
    `getCombatTrackerEntryContext` from the M3 combat-tracker fix) — confirmed via
    `canvas.hud.token.bind(token)`, handler args `(hud, html)` where `html` is a raw
    `HTMLFormElement` (v14 has moved this HUD off jQuery) and `hud.object` is the bound `Token`
    placeable. No prototype patch needed, a plain `Hooks.on` at `ready` is enough. **NPC
    criteria, per the user's own definition** (not a bare `actor.type` check): not a
    player-character and not player-controlled, i.e. `actor.type !== "character" &&
    !actor.hasPlayerOwner`. `Actor#hasPlayerOwner` doesn't appear in TypeDoc's own `?q=` search
    (same tooling gap as the row-28 `canvas.level.id` false alarm logged 2026-08-12) but is
    confirmed live as a real boolean accessor. Deployed as `v0.4.0` and live-confirmed via the
    real shipped hook (not a hand-mirrored copy): the button appears only for the NPC token,
    clicking it calls `voiceNpc(actor.id)`, and `getPolicy().actorOverrides` picks up
    `{npc_voice: {decide: "off", prompt: "off"}}` correctly.
  - **Spec updated, not just code**: §4.6's `HOOKS` block (tagged `SHAPE — the hook list is
    normative`) now shows the three combat hooks; §4.7 documents the NPC criteria; §0 has three
    new/updated rows with dates and sources. `docs/milestones/04-eventbus.md` updated to match
    (avoids the class of drift the 2026-08-10 §6/§7 renumbering incident already burned once).
  - **Tests**: `tests/eventbus.test.js` covers all three combat hooks reading from `updateData`;
    `tests/panel.test.js` covers `isNpcActor`'s player-character/player-owned exclusion. 90/90
    passing.
  - **World left clean**: the test `Combat` and the `voiceNpc` policy override created during
    live verification were both deleted/reverted before the session ended; only the one
    pre-existing empty-tracker `Combat` from an earlier session remains, untouched.
  - **Also this session, before the above**: resumed general M3/M4 regression testing via
    Playwright (chip cycling, `token.selected`, journal/undo) — see the immediately-preceding
    entry above for that pass and the reload-loop / DataModel-proxy findings from it.

- **2026-08-12 (continued, session 5)** — **Built M5 (agent server + ModelClient) end to end,
  both halves, and verified the wire protocol against a real socket (not just vitest mocks).**
  - **Corrected a real spec/reality conflict before writing any socket code, confirmed with the
    user first.** §5.6 rule 3 said "the module is the server, the agent is the client, and the
    agent reconnects." That's backwards: `scripts/socket.js` runs as a client-side `esmodule`
    inside the GM's browser (`module.json` declares no server-side script), and browsers have no
    API to listen for incoming connections — only `new WebSocket(url)` to dial out. Only the
    agent, a real Node process, can bind a listening socket. Swapped: **agent listens on
    127.0.0.1, module dials out and reconnects** with exponential backoff to the same 10 s
    ceiling §5.6 already specified. Nothing else in §5.6 changes (HELLO, one RESULT per INTENT,
    EVENT droppable, POLICY_REVOKED not advisory, localhost-only). Spec §5.6 rule 3 and §0 both
    updated to record the correction rather than silently building around it — same class of
    drift as the 2026-08-10 §6/§7 renumbering incident.
  - **Module side (`scripts/`): `ulid.js`, `envelope.js`, `socket.js`.** No bundler exists for
    the browser side (module.json loads raw esmodules), so the npm `ulid` and `ajv` packages
    used on the agent side aren't importable here — `ulid.js` is a small dependency-free
    Crockford-base32 generator, and `envelope.js` is a hand-rolled envelope-level validator
    (v/type/id/ts/payload) kept in sync with `contracts/envelope.schema.json` by
    `tests/envelope.test.js`'s drift check, same shape `journal.js`'s `CARD_SCHEMA_KEYS` already
    uses for the identical reason. `socket.js` dials the agent, sends HELLO on open,
    exponential-backoff reconnects to a 10s ceiling, turns inbound INTENT into `handleIntent()`
    calls and replies with RESULT (echoing the envelope id), registers itself as
    `eventbus.js`'s event sender and `panel.js`'s POLICY_REVOKED sender (same
    callback-set-at-init shape as `notifyAgent`/`registerEventSender`), and logs the
    module-side hop's `latency_ms` into M1's card log via `logCard()`. Full network RTT as seen
    by the agent is **not** persisted to the card log — the RESULT payload schema has no field
    for the agent to report its own timestamps back, and adding one is a `contracts/*` change
    (propose, don't apply, per AGENTS.md); only the piece inside the module's own control
    (INTENT received -> RESULT sent) is logged.
  - **Agent side (`gm-delegate-agent/`, its own Node package, own `npm test`): `ulid.js`
    (verbatim duplicate — no shared module boundary between the two runtimes),
    `envelope.js` (real ajv `Draft2020` against `contracts/envelope.schema.json`, same
    `ajv/dist/2020.js` import path `tests/contracts.test.js` already had to use to dodge the
    draft-07 default validator), `config.js` (loads `config.yaml`), `modelClient.js` (one
    OpenAI-compatible `/v1/chat/completions` interface per spec §1.5/§5.1 — built per the Build
    section but **not called by anything yet**, same as M6's tool surface being out of scope),
    `orchestrator.js` (WS-server-side INTENT/RESULT correlation by envelope id with a 5s timeout
    matching §9's whole-card budget, EVENT buffering capped at 128, POLICY_REVOKED/UNDONE
    handling, `detach()` rejects in-flight intents rather than replaying them per §5.6 rule 4),
    `server.js` (binds `127.0.0.1` only, per-connection HELLO handshake), `index.js`
    (entrypoint + a stdin-driven manual test harness — `rename <uuid>` / `reject` / `events` /
    `revoked` — same console-driven-testing role `test-m1.js` played for M1, since no
    EncounterAgent exists yet to generate real intents).
  - **Verified locally (both `npm test` suites green, 111 module-side + 16 agent-side) and via a
    throwaway end-to-end smoke script** (real `startServer`+`Orchestrator` in one process, a real
    `ws` client standing in for `socket.js` in a second connection, both over an actual
    `127.0.0.1:8765` socket, not `handleFrame()` called directly) — confirmed: HELLO round-trips,
    a hardcoded EXECUTED intent round-trips end to end, a hard-banned intent round-trips REJECTED
    with the structured reason, POLICY_REVOKED reaching the agent stops emission until the next
    HELLO, and killing the module connection leaves the agent process alive with
    `orchestrator.connected === false`. Smoke script deleted after use (not part of the repo).
  - **Live-Foundry pass, done, with one real unresolved gap.** Shipped as `v0.5.0` (release +
    manifest asset both verified resolving before install), installed live via Playwright against
    pod `d90mhv7i5kvqyg` (module confirmed `active: true`, `version: "0.5.0"`, `api` populated).
    - **Confirmed live: killing/never-having an agent does not break Foundry.** With the agent
      genuinely unreachable for most of the session, Foundry booted clean end to end — canvas
      drew, every template compiled including `panel.hbs`, zero uncaught exceptions — while
      `socket.js`'s reconnect loop kept failing quietly in the background. This is stronger
      evidence for that Done-when item than "kill it after connecting" would have been: it proves
      the module never depended on the agent being reachable at all, not just that it tolerates
      losing an existing connection.
    - **Confirmed live: TCP-level reachability from the browser to `127.0.0.1:8765` is real.**
      When the local agent was down, the browser got an immediate `net::ERR_CONNECTION_REFUSED`
      (only possible if the packet actually reached the port and found nothing listening) — this
      ruled out an earlier hypothesis (network-namespace split between the Playwright browser and
      this shell, e.g. WSL) that looked plausible from an earlier silent-timeout result.
    - **Real gap found, not resolved this session: the WS opening handshake itself does not
      complete**, even with the agent genuinely listening. Confirmed twice — once as an explicit
      Chromium `WebSocket opening handshake timed out` error on the very first connection
      attempt (agent was up), and once as a 30s timeout in a purpose-built one-shot verification
      script (`gm-delegate-agent/verify-live.mjs`, deleted after use) that waited for
      `orchestrator.connected` after a fresh page load. TCP-level reachability is proven (the
      REFUSED case above), so this is specifically the HTTP Upgrade response not completing in
      time — not a `scripts/socket.js` or `orchestrator.js` bug as far as this session could tell
      (the in-process real-`ws` smoke test earlier in this session, Node client against Node
      server, round-tripped instantly with no such issue). Suspected but **not confirmed**:
      something in this specific machine's loopback path (a VPN/mesh network client — this
      machine has a `100.x.x.x`-range interface, and the RunPod pod's own internal IP is
      coincidentally in the same CGNAT range — is one candidate worth checking first next
      session) intercepting or proxying `127.0.0.1` traffic in a way that stalls a WS handshake
      specifically, while plain TCP connect/refuse still works. **Next session, if this recurs:
      check what's bound to/intercepting loopback on the Windows host (VPN clients, Docker
      Desktop's WSL2 integration, antivirus TLS/packet inspection) before assuming it's a code
      bug** — the protocol logic itself is proven correct via three independent paths this
      session (unit tests, the in-process real-socket smoke test, and live `handleIntent()`
      calls below), so a fourth path (this specific machine's loopback) is the remaining unknown.
    - **Substituted a still-genuinely-live check for the blocked wire round trip:** called
      `game.modules.get("gm-delegate").api.handleIntent()` directly from the browser console
      against a real world Actor (`Actor.nV7FYLKL5lqaaBVB`) — the exact same Interceptor/
      journal/executor code path `socket.js`'s `onMessage()` calls, just not through the wire.
      EXECUTED (rename applied, confirmed via `game.actors.get(id).name`), REJECTED
      (`actor.hp.write`, `HARD_BAN`), and `undoLast(1)` (reverted the rename, confirmed via the
      same live read) all behaved exactly as the vitest suite predicts. World left clean
      afterward (actor name back to original, no stray journal/card-log side effects beyond the
      test's own entries).
    - **Not re-verified live this session (already covered by `tests/socket.test.js`, not
      redundantly forced through the console): RECLAIM's `POLICY_REVOKED` no-op-when-disconnected
      path.** Low priority given the equivalent behavior (`send()` no-ops when the socket isn't
      `OPEN`) is directly unit-tested and the live handshake gap above would have blocked this
      from reaching the wire anyway this session.

- **2026-08-13 (continued, session 6)** — **Closed the session-5 WS handshake gap functionally,
  but the root cause is undetermined.** Pod `d90mhv7i5kvqyg` (stopped at the end of session 5)
  needed **33 failed `start-pod` attempts** before succeeding — 9 instant retries, then 20 more
  spaced a real 60s apart via a session `/loop` cron job, then 24 more into a second 60-attempt
  loop — all identical "not enough free GPUs on the host machine." This is the same recurring
  failure logged in three prior sessions; this time it cleared on retry alone (no terminate +
  recreate needed), just took longer than before. Confirmed the resumed container was genuinely
  live via `get-pod`'s `runtime.uptime`/`runtime.ports`, not just API status `RUNNING` — the prior
  "RUNNING but dead container" landmine did not recur.
  - **Session-5's suspected cause (a VPN/mesh client, specifically Tailscale, intercepting
    loopback traffic) is ruled out.** Stopped Tailscale (`tailscale down`), and the WS handshake
    completed in ~12ms — looked like confirmation at first. But the user separately flagged that a
    Chrome "allow access to devices on your network" popup had been approved during that same
    test, which is a confound: Chrome's **Local Network Access** permission gates HTTPS pages from
    reaching private/loopback addresses and could independently explain the fix. Restoring
    Tailscale (`tailscale up`) and re-running the identical raw-handshake test still succeeded in
    ~10.8ms — if Tailscale interception were the cause, restoring it should have broken the
    handshake again. It didn't. **Tailscale was very likely coincidental, not causal.**
  - **The Chrome Local Network Access permission is also ruled out.** Navigated to
    `chrome://settings/content/siteDetails?site=...` for the pod's origin and explicitly set
    **Local network → Block** (confirmed applied via a fresh settings-page snapshot showing
    `Block` selected, not just clicked). Reloaded the Foundry page and re-ran the raw handshake
    test: still succeeded, ~14.3ms. A real WebSocket connection to `127.0.0.1` is apparently not
    gated by this content setting in Chrome 151 — it most likely governs `fetch`/`XHR`/subresource
    loads (and possibly mDNS-based local device discovery) rather than a script-constructed
    `WebSocket`. Reset the setting back to "Ask (default)" afterward to leave the profile clean.
  - **Three more candidates checked and also ruled out or found inapplicable**, in the interest of
    a real root cause rather than stopping at "not X, not Y": PIA VPN's interface sits at a
    `169.254.x.x` (APIPA/link-local) address, i.e. installed but not actually tunneling, so
    unlikely to be intercepting anything now or during the failing session. Windows Firewall has
    no rule at all referencing `node.exe`, ruling out an app-level block (also consistent with
    session 5's own finding that TCP reachability was never actually blocked — a `REFUSED` reply
    requires the packet to arrive). Windows Defender real-time protection is off and no AV product
    is registered in Security Center, ruling out AV/NIS packet inspection. Chrome itself
    (151.0.7922.137) was installed **2026-08-11**, i.e. already in place *before* the session-5
    failure on 2026-08-12 — not a version change between sessions. Playwright's own
    connection-lock files additionally confirm both sessions launched the **same installed Chrome
    binary against the same persistent `userDataDir`** — not a different browser identity either.
  - **Root cause: undetermined.** Every concrete, testable hypothesis available this session was
    checked and eliminated. One untested candidate remains, noted for whoever picks this up if it
    recurs: **timing/ordering** — session 5's agent process may have been started only after the
    Foundry page had already been open for a while with `socket.js` deep into its exponential
    backoff (up to the 10s ceiling), whereas this session started the agent *before* navigating to
    the page. Reproducing that ordering deliberately (open the page first, wait, start the agent
    later, then watch the very next reconnect attempt) is a plausible next test but wasn't run this
    session — do not assume it's the answer, it is genuinely untested.
  - **Functionally, M5 is now fully proven live, independent of the RCA gap above.** Sequence:
    started the local agent (`gm-delegate-agent`, `npm start`, confirmed listening on
    `ws://127.0.0.1:8765`), logged into the `delegate-test` world as GM via Playwright (EULA
    re-acceptance, admin key `Onward-Worst-Subpanel6-Perfectly-Parasitic`, and the GM user
    password — **user-chosen value `waterisgood`, recorded here because it's a throwaway dev-world
    credential, same convention as the admin key** — all had to be re-supplied, matching the
    pattern from every prior stop/start cycle). With the module connected, drove a real end-to-end
    intent from the **agent's own stdin command** (not the module-side console, unlike every prior
    session's live check) — `rename Actor.nV7FYLKL5lqaaBVB` — using a small PowerShell-controlled
    child process (`System.Diagnostics.Process` with redirected stdin/stdout/stderr) rather than a
    bash-side FIFO, because **`mkfifo` does not work reliably between MSYS2 bash and a
    native-Windows `node.exe`** — the first two attempts hung indefinitely with no data ever
    reaching Node's `stdin.on("data", ...)` handler; noting this so a future session doesn't
    re-attempt the FIFO approach. Result: `RESULT: { renamed: 'Actor.nV7FYLKL5lqaaBVB', to:
    'Renamed by gm-delegate-agent' }`, printed by the agent process itself, having gone out over
    the real wire, through the real browser's `socket.js`, into `handleIntent()`, executed against
    the real Actor, and back. World cleaned up immediately after via `api.undoLast(1)` from the
    module console, confirmed via the journal entry's `reverted: true` and the actor's name
    reverting.
  - **Tailscale and the Chrome "Local network" setting were both restored to their original state**
    (Tailscale `up`, permission back to "Ask (default)") before ending the investigation.
  - **Next session:** M5 is DONE, no open items. Next per the milestone table is **M5a (the ICM
    walk test, §5.5)** — gates whether StageRunner replaces the Orchestrator — or M6
    (EncounterAgent, 5 tools), GM's call which first, same as the M5-vs-TokenHUD choice offered
    after session 3. If the WS handshake ever times out again on this machine, try the untested
    timing/ordering reproduction above before re-suspecting Tailscale or Chrome permissions —
    both are now ruled out with direct evidence, re-litigating them without new information would
    be repeating this session's work for nothing.

- **2026-08-13 (continued, session 6)** — **Stood up the local model, closing the "Model in use:
  None yet" gap that was blocking both M5a and M6.** Both of those milestones need a model
  actually serving; neither one existed until this point in the session.
  - **Clarified an architecture point the user's question surfaced: the model runs on this
    Windows machine, not the RunPod pod.** `config.yaml`'s `localhost:8080`/`localhost:11434` are
    from the perspective of the **agent process**, and `gm-delegate-agent` has only ever been run
    locally (confirmed this session — that's literally where `npm start` was executed for the M5
    live tests above). The RunPod pod exists solely to host Foundry; it also has no working way to
    install a second service on it anyway (web terminal and S3 API both confirmed broken in prior
    sessions, per felddy's image having a custom single-purpose entrypoint).
  - **Installed `llama-server` via `winget install --id ggml.llamacpp`** (version `b10375`, the
    Vulkan-backend build — cross-vendor GPU acceleration, not CUDA-specific). Binary lives at
    `%LOCALAPPDATA%\Microsoft\WinGet\Packages\ggml.llamacpp_...\llama-server.exe`; the installer
    added it to PATH but that needs a shell restart to take effect, so this session invoked it by
    full path.
  - **Downloaded `Qwen3.5-9B-Q4_K_M.gguf` (5.68GB) from `unsloth/Qwen3.5-9B-GGUF`** on Hugging
    Face, to `~/models/`. Confirmed this is a real, current release (not confabulated from stale
    training data) via a live web search before downloading.
  - **This machine's hardware, checked before committing to the download:** RTX 3080 Ti, 12GB VRAM
    (9.7GB free at the time), 64GB system RAM, 241GB free disk. Comfortably sufficient for a 9B
    Q4_K_M model.
  - **`llama-server -m ... --host 127.0.0.1 --port 8080 -ngl 999 -c 8192`**, running in the
    background. `--list-devices` confirmed Vulkan sees the 3080 Ti before starting. Smoke-tested
    via `/v1/chat/completions`: the **first** request measured a misleadingly slow ~1.5 tok/s
    prompt-eval — that's Vulkan's one-time shader-compilation cost on first use, not steady-state
    performance. A second request confirmed the real number: **~71 tok/s prompt eval, ~78 tok/s
    generation**, GPU offload genuinely working.
  - **This is a thinking model** — responses include a `reasoning_content` field separate from
    `content`, and a low `max_tokens` cap truncates mid-reasoning before any `content` is emitted
    (observed directly in the first smoke test). M5a/M6 will need to either budget enough tokens
    to get past the reasoning phase or otherwise account for this in whatever parses model output.
    Not yet handled anywhere in code — noted for whoever builds M5a/M6's calling code.
  - **Left running for the next session to use immediately.** `llama-server` is a long-lived
    background process on this machine; it does not need RunPod-style start/stop management.
  - **Deliberately not done, out of scope for what was asked:** `config.yaml`'s **embeddings**
    endpoint (`nomic-embed-text` via Ollama, `localhost:11434`) has no server behind it yet, and
    Ollama isn't installed on this machine. The user asked specifically for `llama-server`; adding
    a second whole service unprompted would have been scope creep. Flagging this explicitly so a
    future session doesn't assume embeddings work because the chat model does — anything that
    calls the embeddings endpoint will fail until this is set up.

- **2026-08-13 (continued, session 6)** — **Ran the M5a ICM walk test (§5.5) against the local
  model, per the 2026-07-13 decision that gated it: "Conditional on the M5a walk test passing on
  the local model — ICM was validated on Opus 4.6, not a quantized 9B." Result: PASS, with one
  caveat on `30_scene`.** Built a throwaway harness (`gm-delegate-agent/walk-test.mjs`, **deleted
  after use** per the briefing's "build nothing past the test") rather than a real StageRunner —
  a small tool-call loop against `llama-server` directly, not through `ModelClient` (no code
  changes to the module or agent package this session).
  - **Followed the briefing's "no pre-loaded catalog files" rule literally.** Each stage's system
    prompt was exactly `IDENTITY.md` + root `CONTEXT.md` + that one stage's `CONTEXT.md`, nothing
    else — the model was never told `_npcs/innkeeper.md` exists or what it contains. It had to
    find that out itself, via `read_file`/`list_files` tools scoped to `gm-session/` (a filesystem
    sandbox with path-escape checks, not full disk access). `20_resolve` additionally got
    `list_roll_tables`/`roll_on_table` from the real `contracts/tools.json` (filtered to those two
    — not the full 5-tool surface, since 20_resolve's own contract only names mechanical-resolution
    tools). `roll_on_table`'s handler in the harness returned a synthetic Foundry-shaped result
    (`{roll:14, drawn:"Wolf Pack (2d4)", dice:"2d4=5", quantity:5}`) — the walk test measures
    whether the *model* calls a tool instead of fabricating a number, not whether real Foundry
    execution works, which M5 already proved separately.
  - **`10_watch`, innkeeper case: PASS.** Window text ("the innkeeper looks up from wiping the
    bar...") plus `foundry: selected=Actor.INNKEEPER01, scene=Kettle & Bough`. The model listed
    `_npcs/`, read `innkeeper.md`, and correctly output `link: _npcs/innkeeper.md, confidence:
    high` with a sound one-line `why`. Matches `10_watch/CONTEXT.md`'s output shape.
  - **`10_watch`, chatter case: PASS.** Window text was players talking about their real-life jobs
    (matches nothing in the catalog), `foundry: selected=none`. Correctly output `link: none` with
    no tool calls needed — didn't hallucinate a link where none existed.
  - **`20_resolve`: PASS, but only after a harness fix.** First attempt: the model correctly called
    `list_roll_tables` then `roll_on_table` with the right `tableId` — **never fabricated a
    number**, the one thing this stage must never do — but then looped trying to `read_file` its
    own would-be output (`20_resolve/out/result.md`, which doesn't exist) three times before
    hitting the harness's iteration cap with no final answer. Root cause: the harness gave it
    `read_file`/`list_files` but no `write_file`, and never told it that its final chat message
    *is* the deliverable — an interface ambiguity in the throwaway harness, not a task-content leak
    (nothing about the scenario or catalog was changed). Added one line to the system preamble —
    "your final chat response is taken verbatim as this stage's output, you have no write tool and
    do not need one" — and reran. Second attempt completed cleanly in 3 iterations, reporting the
    tool result verbatim in the exact `tool: / args: / result:` shape from `20_resolve/CONTEXT.md`.
  - **`30_scene`: PASS on shape, soft-fail on provenance.** Given the resolved mechanic verbatim
    (`roll: 14, drawn: "Wolf Pack (2d4)", dice: "2d4=5", quantity: 5`), the model produced a
    correctly-shaped card both times it was run (across the pre- and post-harness-fix runs, for
    two independent samples): a `CREATURES / SUBJECT` line, 4 beats (sound, movement, posture,
    detail — not prose), a `Hook:` line, well under 60 words both times (~29 and ~36 words). **But
    neither run carried the raw `roll: 14` or literal `dice: "2d4=5"` string into the card** —
    the model paraphrased the mechanic into flavor (e.g. "Wolf Pack, 5 wolves") rather than
    preserving the provenance fields verbatim, despite `30_scene/CONTEXT.md` explicitly saying
    "carry its roll / drawn / dice through unchanged." This is exactly the failure mode
    `validate.py` is specced to catch ("if a `20_resolve` result exists its provenance fields are
    carried verbatim... not rounded" — no `validate.py` exists yet, this was graded by hand).
  - **What this decides, per the 2026-07-13 conditional gate:** the walk test's overall result is
    a pass — `10_watch` and `20_resolve` both demonstrated real orientation-from-files-alone and
    held their hard lines with zero hand-holding. **StageRunner replacing the Orchestrator is
    empirically viable on this quantized 9B**, not just on a frontier model. The `30_scene`
    provenance gap is not a reason to reject the architecture — the fix is enforcement
    (`validate.py` rejecting a card that drops provenance and forcing a retry or GM-visible flag),
    exactly the "enforcement stays in code, a gate in a prompt is not a gate" principle §5.5 and
    the 2026-07-13 decision already established. `validate.py` for all three stages does not exist
    yet and is real M6-adjacent work, not covered by this milestone.
  - **Not tested this session, flagged for whoever builds M6/the real StageRunner:** multi-sample
    reliability (each stage was run once or twice, not enough for a real pass-rate number), the
    `00_dm` escalation contract (never-delegate.md avoidance — no scenario in this session actually
    touched escalate-worthy content), and the thinking-model token budget in practice (this
    session's harness used `max_tokens: 2048`, well above `config.yaml`'s `200` for `encounter` —
    that config value needs raising before M6 wires `ModelClient` for real, or every real call will
    truncate mid-reasoning the way the very first smoke test did).

- **2026-08-13 (continued, session 6)** — **Built and live-verified M6 (encounter tools), shipped
  as `v0.6.0`. Scoped as StageRunner/ICM per the M5a conditional, and tightly to Build Order's
  actual Done-when — not the older, broader monolithic-EncounterAgent briefing.**
  - **Architecture decision, confirmed with the user before writing code.**
    `docs/milestones/06-encounter-agent.md` predates M5a and describes an `Orchestrator` +
    single-system-prompt + flat-5-tool `EncounterAgent`. But spec §5.5 is explicit: ICM/StageRunner
    *replaces* the Orchestrator, conditional on the M5a walk test passing — and it just had, this
    same session. Asked the user which to build; chose StageRunner. The briefing file itself was
    **not** updated this session (out of scope for the code work) — a future session should reconcile
    it with what actually got built, same class of drift as the 2026-08-10 renumbering incident.
  - **Scope, precisely bounded to Build Order's own Done-when (§8 row 6): "`roll_on_table` returns
    Foundry's real roll and the resolved quantity. The model never computes a number."** That's it.
    `propose_encounter`'s wire path, `place_encounter`'s real dedupe/import/place logic, and the
    proposal store (`proposals.js`, §5.7) are explicitly **row 7's** Done-when ("Accept & Place
    imports the Actor idempotently... Proposals expire and label themselves") — M7, not M6. Did not
    build any of those three this session; `contracts/tools.json` already defines all 5 tools (no
    change needed there), but only `list_roll_tables`/`roll_on_table`/`get_compendium_actor` got
    executors. `propose_encounter` needs **no executor at all** for M6: under `DEFAULT_POLICY`,
    `random_encounters.decide` defaults to `"propose"`, so an intent with that action and
    `stage:"decide"` never reaches `execute()` — `handleIntent()` routes it straight to
    `Panel.queue()` (M3's existing stub) and returns `QUEUED`. "M6 emits the proposal, M7 renders
    it" (the briefing's own scope line) turned out to be literally true of the routing, not just a
    description.
  - **Authored the missing build prerequisite: the Thornwood roll table did not actually exist.**
    §5.2 says "author one table (Thornwood) before M6 or M6 has no input," and M0's redefinition
    (2026-08-10 entry above) said this was part of M0's scope — but `game.tables.contents` on the
    live world came back `[]` this session. It was planned, never done. Created "Thornwood Road
    Encounters" live via the console (`RollTable.create(...)`), a d20 table with five rows including
    `"[[2d4]] Wolf Pack"` and `"[[1d6]] Wild Boars"`. **Verified v14's `TableResult` schema live
    before writing any code** (spec §0 discipline): the result-text field is `name` in v14, not the
    older `text` field that older Foundry versions and casual recall would suggest — confirmed via
    `CONFIG.RollTable.documentClass.schema.fields`, not assumed. `table.draw()`'s return shape
    (`{roll: {formula, total}, results: [...]}`) was also confirmed live before `encounter.js` was
    written, not guessed from the spec's illustrative code alone.
  - **`scripts/executors/encounter.js`**: `rollOnTable` (with `resolveInlineFormulas` — regex-
    extracts a row's `[[NdM]]` and evaluates it via a real `Roll`, deterministically, in code, per
    §5.2's explicit "the model never sees a formula" rule), `listRollTables`, `getCompendiumActor`.
    All three `touches() => []` — none mutate a document, so there's nothing for undo to snapshot.
    Registered in `executors/index.js` with a comment explaining why `propose_encounter`/
    `place_encounter` are deliberately absent (see scope note above).
  - **Found and fixed a real executor-shape bug of my own making before it reached the live test**:
    spec §5.2's own code sample wraps `roll_on_table`'s mechanical data one level deeper than
    `test-m1.js`'s executors do — `return { result: {...}, created: [] }`, not a flat object — so
    the RESULT envelope's `payload.result` is itself `{ result: {...}, created: [] }`. My first
    pass at `socket.js`'s new provenance-extraction helper read fields off the wrong level and every
    field came back `undefined` in `tests/socket.test.js`; caught by the test, not by inspection.
    Fixed by unwrapping `result.result` — noted here because the agent-side `stageRunner.js` has to
    make the exact same unwrap when reporting `roll_on_table`'s result back to the model, and a
    future session touching either side should know the nesting is intentional (spec's own shape),
    not a bug to "simplify" away.
  - **`scripts/socket.js`**: `logCard()` now receives a `provenance` field, populated only for
    executed `roll_on_table` intents (`extractProvenance()`, defensive — returns `null` for every
    other action rather than assuming). Satisfies M6's Done-when "provenance populated into M1's
    log," live-confirmed via `getCardLog()` on the real world.
  - **`gm-delegate-agent/src/stageRunner.js`, new**: runs one ICM stage for real. Hands the model
    exactly `IDENTITY.md` + root `CONTEXT.md` + the stage's own `CONTEXT.md` (same "nothing
    pre-loaded" discipline M5a's walk test established), gives it `read_file`/`list_files` scoped to
    the workspace (path-escape checked) so it finds catalog files itself, and — the actual new thing
    M6 needed — for `20_resolve` specifically, `list_roll_tables`/`roll_on_table` are sent as **real
    INTENT envelopes over the real wire** via `orchestrator.sendIntent()`, not synthetic handlers
    like the deleted M5a walk-test harness used. `10_watch`/`30_scene` are **not** wired for real
    this session — M5a already validated their behavior with synthetic tool results, and wiring them
    for real means `propose_encounter`'s wire path and a live EventBus trigger chain, both M7/recap
    territory per the scope note above.
  - **Two small pre-existing bugs found and fixed while wiring this, both direct blockers for M6,
    neither scope creep**: `config.yaml`'s `workspace: "./gm-session"` resolved to
    `gm-delegate-agent/gm-session/` (doesn't exist) instead of the real workspace at the project
    root — nothing had ever read this value before M6 needed to, so it went unnoticed since M5.
    Fixed to `"../gm-session"`, resolved relative to the config file itself (matching `config.js`'s
    own `__dirname` pattern, not `process.cwd()`, which depends on how the process was launched).
    Also bumped `encounter`'s `max_tokens` `200 → 2048` — the M5a entry above already flagged this
    as too low for a thinking model; left uncaught it would have truncated every real `20_resolve`
    call mid-reasoning, the same failure mode as the very first `llama-server` smoke test.
    `classifier`'s `max_tokens: 32` has the identical problem and was **not** touched — nothing
    calls it yet, so fixing it wasn't required for this session's task; flagged for whoever wires it.
  - **Live verification, real wire, real world.** Cut `v0.6.0` (pushed + GitHub release + pod
    module update, same established workflow as every prior release — asked the user first since
    `git push` is now blocked by the permission classifier's auto-mode guard, a new restriction not
    present in earlier sessions). Restarted the local agent with the new code, drove it via its
    `resolve` stdin command (same "manual driver" role `test-m1.js`/`rename`/`reject` play — no live
    EventBus trigger chain exists yet). First real run: the model called `roll_on_table` against
    `RollTable.wrPvaOz83tmEmodd` and reported back exactly what Foundry rolled (`roll: 13, drawn:
    "Wild Boars", dice: "1d6=1"`) with **zero computation of its own** — confirmed both from the
    agent's own final answer and, independently, from the module's card log (`provenance` populated
    correctly). This is the M6 Done-when, live, for real, not synthetic.
  - **Measured tool-call validity over a live sample — a real, unflattering finding, reported
    honestly rather than glossed over.** Ran 6 total `resolve` invocations across two sessions of the
    agent process (1 + 5), reconstructed from the card log's `provenance`/`rejected` fields since the
    PowerShell capture script's stdout interleaved confusingly across concurrent runs. Of 8 total
    `roll_on_table` call attempts: **6 succeeded** (real roll, correct provenance), **2 were
    rejected** (`EXEC_FAILED: roll_on_table: no table at thornwood_road_encounters` and
    `...at encounters_world`) — in both cases the model **hallucinated a plausible-sounding tableId
    string** instead of using the real UUID (`RollTable.wrPvaOz83tmEmodd`) that a prior
    `list_roll_tables` call in the same run would have returned. **75% (6/8), below spec's own >95%
    kill criterion** for tool-call validity (§9, restated in the M6 briefing's Traps section). Small
    sample — six runs is not enough to trust the exact number — but the failure mode itself is real
    and reproducible-looking, not a fluke: the model sometimes skips actually reading back
    `list_roll_tables`'s result and guesses instead. **Not fixed this session** — the spec's own
    remedy list for missing the tool-call-validity bar is "prune the surface further, move up a
    model tier, or route this subagent to Claude," explicitly **not** "add a tool" or, by the same
    logic, "prompt-tune around it." That's a model/tooling decision for a future session with more
    data, not something to route around quietly here.
  - **Secondary finding, not investigated further this session**: one of the two rejected calls
    coincided with an `INTENT ... timed out after 5000ms waiting for RESULT` on the agent side, and
    a corresponding `RESULT for unknown or already-settled intent` on the log — meaning the
    module's `EXEC_FAILED` rejection didn't reach the agent before `Orchestrator`'s
    `INTENT_TIMEOUT_MS` (5000ms, §9's whole-card budget) fired. Whether `fromUuid()` on a
    malformed/nonexistent ID (`"encounters"`, `"thornwood_road_encounters"`) is unexpectedly slow,
    or something else caused the delay, is unconfirmed — flagged for a future session, not chased
    down here given it's adjacent to, not part of, M6's own Done-when.
  - **World left running, not stopped**: the pod and local agent were both still up at the end of
    this session for the user's own continued use. `Thornwood Road Encounters` (real roll table) and
    the six test-run journal/card-log entries from this session's live verification are genuine,
    intentional artifacts of building M6 — not cleaned up, since (unlike M5's throwaway rename test)
    they're exactly what M6 is supposed to produce.
  - **Next session:** M6 is DONE. Next is M7 (the card, with Edit) — `proposals.js` (§5.7),
    `propose_encounter`'s real wire path, `place_encounter`'s dedupe/import/place executor, and the
    actual visual card UI with Accept/Edit/Reroll/Skip. Before or alongside that, worth deciding
    whether the 75% tool-call validity finding above changes anything about model choice (§10's
    still-open "which model" question) or whether it's addressable with more `20_resolve/CONTEXT.md`
    guidance about actually reading `list_roll_tables`'s output before calling `roll_on_table` — GM's
    call, not decided here.

- **2026-08-13 (continued, session 6)** — **Swapped `ModelClient`'s hand-rolled `fetch()` for
  `@earendil-works/pi-ai`, at the user's request after evaluating the actual repo (not just
  marketing copy).** User asked whether a packaged agent harness was worth pulling in; initial
  answer (based on search-result summaries alone) was "probably not, wrong shape for opencode,
  unclear for pi." User supplied the real repo (`github.com/earendil-works/pi`). Reading the
  actual `pi-ai`/`pi-agent-core` package READMEs and type declarations changed the answer for
  `pi-ai` specifically: it has a named `createProvider()` path for local OpenAI-compatible
  servers (the README's own example is Ollama; `llama-server` is the same shape) and treats
  thinking/reasoning content as a first-class `ThinkingContent` block — exactly the
  `reasoning_content` handling `modelClient.js`/`stageRunner.js` were hand-rolling. Did **not**
  adopt `pi-agent-core` (the fuller `Agent` class) this session — narrower ask, and it brings
  session-persistence/SQLite-backend features this project doesn't need.
  - **`gm-delegate-agent/src/modelClient.js`, rewritten.** Registers one `pi-ai` `createProvider()`
    per subagent key (`classifier`, `encounter`), each a single-model `openai-completions` provider
    pointed at `llama-server`. `chatComplete()` now returns pi-ai's `AssistantMessage` directly
    (`content: (text|thinking|toolCall)[]`) instead of raw OpenAI JSON.
  - **`gm-delegate-agent/src/stageRunner.js`, rewritten to match.** Tool parameters are now
    TypeBox schemas (`Type.Object(...)`, re-exported from `pi-ai`) instead of hand-written
    JSON-schema objects; `Context.messages` uses pi-ai's `UserMessage`/`AssistantMessage`/
    `ToolResultMessage` shapes (system prompt is a separate `systemPrompt` field, not a
    role:"system" message); a `ToolCall`'s `arguments` arrive already parsed — the manual
    `JSON.parse(tc.function.arguments)` this file had is gone.
  - **One real gotcha, found by testing live rather than trusting the README's example
    verbatim** (same discipline as the M6 `RollTable`/`TableResult` schema check): the
    README's own Ollama example configures a keyless provider with
    `resolve: async () => ({ auth: {} })`, and `models.getAuth()` does accept that — confirmed
    directly. But `models.complete()` rejected it with `"No API key for provider"`, a different
    code path with a stricter requirement not visible from `getAuth()` alone. Fixed by resolving
    a dummy `apiKey: "not-needed"` string instead — harmless, since `llama-server` never checks
    the Authorization header it never asked for. Isolated with three throwaway standalone repro
    scripts (not committed) before touching the real class, so the fix landed in one edit instead
    of guess-and-check inside the actual codebase.
  - **Live-verified after the fix**: a direct `ModelClient` smoke test correctly separated
    `reasoning_content` into a `thinking` content block (`thinkingSignature: "reasoning_content"`)
    from the final `text` block — the exact thing that used to need hand-parsing. Then the full
    `resolve` stdin command, over the real wire, against the real Thornwood table: model called
    `roll_on_table`, got back `dice: "1d20=16"`, `drawn: "Wounded Traveller"`, reported it without
    fabricating — confirmed both in the agent's own output and, independently, in the module's
    live card log (`provenance` matches exactly). M6's Done-when still holds with the new stack.
  - **`npm install` flagged 5 vulnerabilities (3 moderate, 1 high, 1 critical) — checked, and
    they predate this change.** All five are in `vitest`'s own transitive `esbuild`/`vite` chain
    (the critical one, `GHSA-5xrq-8626-4rwp`, requires the Vitest **UI server** to be listening,
    which no script in this project ever starts — `npm test` only ever runs `vitest run`).
    Confirmed the identical finding exists in the **module's** root `package.json` too
    (`vitest: ^2.0.5`, same as this package), independent of `pi-ai` — not something this swap
    introduced. Not fixed this session (touches every test file's runner, unrelated to the task);
    flagged here so a future session doesn't assume `pi-ai` is the source if `npm audit` surfaces
    it again.
  - **126/126 module tests unaffected** (this package's swap doesn't touch the module side at
    all). **23/23 agent tests updated and passing** — `tests/stageRunner.test.js`'s fake
    `ModelClient` now returns pi-ai's `AssistantMessage` shape instead of raw OpenAI JSON, same
    change the real class went through.
  - **No module release needed for this one** — `gm-delegate-agent` is its own Node package the
    local agent process runs; unlike `scripts/executors/encounter.js` and the other M6 changes,
    nothing here ships in the Foundry module zip, so there's no `v0.6.x` bump or pod reinstall
    tied to this commit.

- **2026-08-13 (continued, session 6)** — **Tried to get a larger tool-call-validity sample (per
  the previous entry's own "n=8 is too small" caveat) and found a more serious, different
  reliability problem instead: the model frequently does not know when to stop calling
  `roll_on_table`.** Not a code bug — a real model-behavior finding, reproduced directly.
  - Added a `resolve N` batch mode to `gm-delegate-agent/src/index.js`'s stdin driver (loops the
    stage N times, summarizes tool-call validity across all calls) rather than repeating N manual
    single-shot invocations. First run: `resolve 30`, backgrounded for 15 minutes. Result: only
    "RESOLVE 1/30" ever printed, and even that was cut off mid-string — nowhere near the ~20-40s
    per run seen in prior single-shot tests.
  - **Diagnosed rather than assumed a hang.** Checked for a lingering process (none — the kill was
    clean) and `llama-server`'s own `/slots` endpoint and request log. The log showed a single
    slot's context growing by a consistent ~110 tokens per call, each call fast (~1-3s), repeating
    many times in a row — the signature of one conversation being replayed over and over, not a
    stuck process. Wrote a throwaway instrumented script (`debug-resolve.mjs`, deleted after use)
    that drove the exact same `orchestrator`/`modelClient` path directly, logging every iteration
    with a hard 45s external cutoff instead of trusting another silent multi-minute run. **Result:
    confirmed live** — the model called `roll_on_table` 13+ times in a row with `stopReason:
    "toolUse"` every time, never producing a final text answer, hitting the diagnostic's own cap
    before finishing.
  - **Retried the real `resolve N` path at a smaller size (`resolve 5`) with timestamped output**
    to see the production code's actual behavior, not just the diagnostic's. Run 1 (real wire,
    real `MAX_TOOL_ITERATIONS = 8` cap): **took 3 full minutes** to land on a valid final answer
    (`Wolf Pack`, `2d4=6`) — meaning it spent most of that time on repeated `roll_on_table` calls
    before finally stopping. Run 2, immediately after: hit the 8-iteration cap and returned
    `timedOut: true`. **Not fully explained**: why run 2 appears to have resolved near-instantly
    after run 1's 3-minute run, and why `llama-server`'s cumulative task-ID counter jumped by
    several thousand across a single 3-minute window (far more than the handful of real completion
    calls `MAX_TOOL_ITERATIONS` should allow) — genuinely unresolved, not chased further after
    reasonable diagnostic effort. Worth another look if this recurs: check whether `pi-ai`'s
    `openai-completions` implementation is retrying internally more than expected, which would
    explain both the task-ID inflation and the 3-minute single-run duration without contradicting
    `MAX_TOOL_ITERATIONS` actually being honored at the `stageRunner.js` level (confirmed it is,
    via the diagnostic).
  - **What this changes about the earlier 75%-tool-call-argument-validity finding**: that measured
    whether `roll_on_table`'s *arguments* were valid once called. This is a different, more basic
    failure mode — not knowing when to *stop* calling a tool it already has a real answer from.
    Both point the same direction (this model's tool-use reliability on this task is a real
    concern), but this one is more serious: a GM waiting 3 minutes for an encounter card, or
    getting a silent timeout, is a worse failure than a wrong-but-caught table ID.
  - **Decided not to chase a precise statistic.** Given a single run can legitimately take minutes
    when the model loops, running a large N-sized batch to compute a clean percentage would cost
    a lot of wall-clock/GPU time for a number that's already qualitatively clear: this behavior is
    real, reproducible, and not rare (2 of the first 2 fresh runs both exhibited it — one slowly
    self-corrected, one didn't self-correct within the iteration cap at all).
  - **Bearing on the §10 "which model" question, raised explicitly by the user this session**:
    this is now real evidence, not just the small earlier sample, and it's evidence of the kind
    the M6 briefing's own remedy list anticipates ("prune the surface further, move up a model
    tier, or route this subagent to Claude" — not a broader leaderboard comparison, per §10's own
    explicit STOP against that). Not decided here — flagged for the user/a future session with
    this finding in hand.
  - Left `gm-delegate-agent/src/index.js`'s `resolve N` batch mode in place (real, tested-by-use
    functionality, not throwaway) for whoever picks this question back up.

## Known forward references in the spec

The spec's code snippets reference things built in later milestones. This is expected;
stub them, do not build them early. Tracked per-milestone in the briefings.

| Snippet in | References | Built in |
|---|---|---|
| `interceptor.js` (§4.4) | `Panel.queue()` | M3 |
| `interceptor.js` (§4.4) | `EXECUTORS` map | M7 (stub in M2) |
| `journal.js` (§4.5) | forwarding `notifyAgent()` over the socket | M5 |
| `eventbus.js` (§4.6) | a real sender behind `registerEventSender()` (currently unregistered; frames sit in the buffer) | M5 |
