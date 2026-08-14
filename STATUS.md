# Status

**Updated:** 2026-08-14 (session 11)

## Where we are

| | |
|---|---|
| Current milestone | **M7 — the card, with Edit. Live-verified this session (v0.7.1).** All 9 Done-when items from `docs/milestones/07-card.md` confirmed against a real Foundry v14 pod: card renders, Accept & Place creates real tokens and `undoLast(1)` removes them, Edit logs `gm_edit_diff`, Reroll logs `reroll`, Skip logs `skip`, an unopened card expires and logs `expired`, provenance matches the tool-call trace, `touches()`/undo work. **Two real findings, not swept under the rug:** a load-bearing bug (`place_encounter` hung forever — fixed, see decision log) and a latency miss (median 6562ms across 5 samples, all above the 5s kill criterion — session 9 confirmed this is architectural, not network/hardware; session 10 got a corrected root cause (spec assumed 40 generated tokens, actual is ~380) from an Opus planning pass and shipped 6 fixes total (v0.7.2, no module.json bump), each live-verified individually — 4 latency wins (stageRunner.js bundle, maxIterations 4→6 correction, code-side pre-resolve of list_roll_tables) took the median 7800ms → 6018ms (~23%); a 5th (CATALOG.md split) is correctness-positive but showed no measurable latency win (~6436ms steady-state) — read honestly rather than spun as a 6th win; see decision log). |
| Code written | Session 7 built M7 end to end (see that entry below for the full file list). Session 8 (this one) added: `scripts/executors/encounter.js`'s `placeEncounter()` fix (interactive `placeTokens()` → programmatic `createEmbeddedDocuments()`), `tests/setup.js`'s matching mock update, `module.json` → **0.7.1**. |
| Test harness | Module: `npm install && npm test` — **156/156 passing**. Agent: `cd gm-delegate-agent && npm install && npm test` — **28/28 passing**. (node v24.14.1, npm 11.11.0.) |
| Foundry version tested against | **v14.365** (Node build), self-hosted on a RunPod pod. M1, M3, M4, M5, M6, and now M7 are live-verified. Only M2 remains vitest-only (by design — no DOM involved). |
| Dev Foundry host | RunPod pod `d90mhv7i5kvqyg` (US-NC-1), secure cloud, RTX 4090, `ghcr.io/felddy/foundryvtt:14`, 15GB persistent mount at `/data`. Connect: `https://d90mhv7i5kvqyg-30000.proxy.runpod.net`. **Started this session** after 9 consecutive `start-pod` "not enough free GPUs" failures (same recurring error logged in prior sessions; cleared on the 10th attempt, no recreate needed this time). `module.json` on the pod is now **v0.7.1**. World: `delegate-test`, Gamemaster login password `waterisgood` (world-level auth, distinct from the admin key). **Playwright MCP browser tools were available this session** — the whole live pass was driven directly (navigate/click/type/evaluate) rather than relaying console output through the user, a first for this project. Pod left running at end of session — user did not ask to stop it. |
| Model in use | **Qwen3.5 9B Q4_K_M, serving locally, reasoning OFF.** `llama-server` (llama.cpp `b10375`, Vulkan GPU backend) on this machine's RTX 3080 Ti (12GB VRAM), bound to `127.0.0.1:8080` per `config.yaml`. GGUF from `unsloth/Qwen3.5-9B-GGUF` (5.68GB). Running with Qwen's own documented non-thinking sampler settings — `--temp 0.7 --top-p 0.8 --top-k 20 --min-p 0.0 --presence-penalty 1.5 --reasoning off --no-reasoning-preserve` — since 2026-08-13. **Embeddings (`nomic-embed-text` via Ollama) still not set up** — unchanged this session. |

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
| 7 | The card, with Edit | **DONE — live-Foundry Done-when checklist passed 2026-08-14 (session 8, v0.7.1), all 9 items.** One real bug found and fixed (`place_encounter` used Foundry's interactive `placeTokens()`, which hangs forever headlessly). Median latency **6562ms, misses the <5s kill criterion** — flagged, not hidden. `propose_encounter` tool-call reliability is real but intermittent (one 8-call catastrophic loop with leaked tool-syntax text in ~10 live samples, rest clean) — see decision log. |
| 8–10 | Contingent. Do not plan them yet. **Per 07-card.md: this was the last milestone of the prototype — run four more sessions, then read §9 before deciding what any of it means.** | — |

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

- **2026-08-13 (continued, session 6)** — **Root-caused and fixed the "doesn't know when to stop"
  finding above. It was a misconfigured harness, not (as far as this session's evidence goes) a
  model-quality problem.** User asked for a deep-reasoning pass (delegated to an Opus subagent)
  plus a leaderboard comparison of alternative models, explicitly overriding the spec's own
  "decide from real logs, not a leaderboard" STOP (§10) — a deliberate, informed override, not an
  oversight, and worth recording as such.
  - **The Opus agent's root-cause analysis, code-verified against the actual `pi-ai` source
    (not just its README), found four real bugs, all in the harness:**
    1. **pi-ai was NOT retrying** — ruled out the task-ID-inflation hypothesis from the previous
       entry. `maxRetries: 0` by default, confirmed in `pi-ai`'s own source; `ModelClient` never
       overrides it.
    2. **No sampling parameters were ever sent to `llama-server`**, so it ran on its own defaults
       (`temp 0.8, top_k 40, presence_penalty 0`) instead of Qwen3.5's own documented settings.
       Qwen's model card names `presence_penalty` **specifically as the control that mitigates
       endless loops**, and it was at `0`.
    3. **Spec §2's "reasoning off" mandate was never actually in effect.** `modelClient.js` set
       `thinkingFormat: "qwen"`, which makes `pi-ai` emit a vLLM-shaped top-level `enable_thinking`
       field — `llama-server` doesn't understand that; it only honors `chat_template_kwargs` (or,
       we found live below, the `--reasoning` CLI flag). Reasoning had been silently on this whole
       time, including through the M5a walk test.
    4. **Prior-turn thinking content was being replayed into every subsequent request**, directly
       against Qwen's own documented guidance ("exclude thinking content from multi-turn
       conversation history").
    Also cited two papers on agentic tool-loop failures (arXiv 2605.00334, arXiv 2607.01641)
    naming "doesn't know when to stop calling a tool" as a real, common failure class independent
    of model size, and a `llama.cpp` issue (#20164) tying Qwen3.5 tool-call looping specifically to
    **optional** tool parameters — our surface had two (`list_roll_tables.filter`,
    `list_files.dir`).
  - **The leaderboard comparison landed on: fix the harness first, because no benchmark measures
    "fails to terminate," so no leaderboard could have predicted or validated a fix for this
    specific bug anyway.** Full table (Qwen3.5 27B/35B-A3B, Qwen3.6-35B-A3B, Granite 4.1 8B, Gemma
    4 12B/26B-A4B, others) preserved in this session's transcript, not reproduced here — the
    actionable output was the priority-0 fix list below, not the table itself.
  - **Implemented all of the agent's priority-0 fixes:**
    - `llama-server` restarted with `--temp 0.7 --top-p 0.8 --top-k 20 --min-p 0.0
      --presence-penalty 1.5 --reasoning off --no-reasoning-preserve` — Qwen's own documented
      non-thinking sampler settings, reasoning genuinely disabled this time. **Verified live**: a
      raw completion request came back with no `reasoning_content` at all. One correction to the
      agent's own suggested flag: `--chat-template-kwargs enable_thinking` is deprecated in this
      `llama.cpp` build (confirmed via its own `--help` and a live deprecation warning on startup)
      in favor of the dedicated `--reasoning on|off|auto` flag — used that instead.
    - `gm-delegate-agent/src/modelClient.js`: `reasoning: false` (was `true`), `thinkingFormat`
      removed (dead config now that the server enforces reasoning-off itself regardless of what
      the client requests).
    - `gm-delegate-agent/src/stageRunner.js`: strips `thinking` content blocks before pushing an
      assistant message back into `messages` (defensive — normally a no-op now, but protects
      against a future model swap that has thinking on by default). `list_roll_tables.filter` and
      `list_files.dir` are now **required** parameters, not optional (per the cited `llama.cpp`
      issue). **`roll_on_table` is now capped at one real roll per stage run** — a second call in
      the same run returns the cached first result annotated "already rolled — report this and
      stop" instead of hitting the wire again. Framed as a correctness property in the code
      comment, not just a loop workaround: the stage contract is exactly one roll, so a second
      real roll would itself be a kind of fabrication. New test:
      `tests/stageRunner.test.js` — "caps roll_on_table at one real roll per run," asserts the
      wire only sees one `sendIntent` call even when the model calls the tool twice.
    - `gm-session/20_resolve/CONTEXT.md`: added a "When to stop" section — one roll is the whole
      job, call `list_roll_tables` at most once, call `roll_on_table` exactly once, don't re-roll
      to confirm, report errors rather than retrying.
  - **First re-test looked like the fix had failed — it hadn't; the test harness was lying.**
    Reran `resolve 20` the same way as the original finding (a PowerShell-driven child process,
    stdin commands sent via `.StandardInput.WriteLine()`, output captured via
    `.NET`'s `OutputDataReceived` events) and got the same symptom: only "RESOLVE 1/20" ever
    printed, cut off mid-string, across a 5-minute window. **Diagnosed rather than accepted at face
    value**, same discipline as the original finding:
    - A throwaway diagnostic reproducing the tool loop **inline** (not calling the real
      `runStage()`) completed cleanly in ~5 seconds, 3 iterations, no looping — contradicting the
      "still broken" read.
    - That diagnostic turned out to be **not equivalent** to production: it only offered the 2
      domain tools, not the full 4-tool surface (`list_files`/`read_file` too) `runStage()` actually
      sends. Rebuilt it to call the **real** `runStage()` directly — also clean, ~3.5 seconds, 3
      iterations, correct result. So the real function works when called directly.
    - Isolated it to the stdin-command layer specifically by adding a temporary debug log at the
      exact moment `process.stdin`'s `'data'` event fires. **The input arrived in ~5ms of being
      sent** — instant, not delayed. But output didn't appear in the PowerShell capture until the
      process was killed, ~20+ seconds later, as a burst of individually-timestamped-identical
      lines. **Conclusion: Node's stdout, redirected through `.NET`'s `Process` I/O plumbing, was
      buffering internally and not flushing until the process died** — a testing-harness artifact
      from this specific IPC method, not a reintroduction of the original bug. Removed the debug
      log after confirming this.
  - **Clean re-measurement, bypassing the flawed IPC entirely**: a throwaway script called the real
    `runStage()` directly in a loop, 20 times, output redirected straight to a file via the Bash
    tool's own backgrounding (no PowerShell `.NET` pipe involved). **Result: 20/20 runs completed,
    0 timeouts, 0 runs with more than one `roll_on_table` call, 20/20 valid tool-call arguments
    (100%, up from the earlier 75%), average 3.4s per run (max 4.2s) — down from up to 3 minutes.**
    The one-roll-per-run cap never even had to trigger in this clean run; the sampler/reasoning
    fixes alone eliminated the looping behavior the cap exists to guard against.
  - **Conclusion**: on the evidence gathered this session, Qwen3.5 9B Q4_K_M's tool-calling
    reliability on this exact stage is now solid once run inside its documented operating envelope
    — the earlier 75%-validity and repeated-tool-call findings were real, but were measuring a
    misconfigured harness, not the model's actual ceiling. Model-swap discussion (§10) is not
    closed off by this — the leaderboard research and root-cause reasoning both remain valid and
    available if a real GM session surfaces problems this synthetic scenario doesn't — but there is
    no longer an open, active reliability bug driving that discussion.
  - All three throwaway diagnostic scripts (`debug-resolve.mjs`, `debug-resolve2.mjs`,
    `debug-resolve3.mjs`) and the final measurement script (`measure-resolve.mjs`) were deleted
    after use, per the project's "build nothing past the test" discipline for this kind of
    diagnostic work.
  - 126/126 module tests, 24/24 agent tests (the new one-roll-per-run test included) passing
    throughout.

- **2026-08-14 (session 7)** — **M7 (the card, with Edit) built end to end: `propose_encounter`'s
  wire path, `place_encounter`'s real executor, `proposals.js`, the card UI, and the trigger →
  two-stage-agent → card round trip.** Deliberately **not** live-verified — the pod was stopped at
  the user's explicit request before any M7 code was written, and building the module-side card
  logic doesn't need it (same split M2/M3 established: vitest against mocked globals for logic,
  live Foundry only for what actually needs a DOM). 156/156 module tests, 28/28 agent tests
  (184 total, up from 150 at the start of the session).
  - **Three real architectural forks surfaced while building this, all resolved with the user
    before writing code that would have had to be thrown away:**
    1. **The GM trigger needed a real wire path it never had.** `panel.js`'s `sendTrigger()` had
       been a stub since M3 (STATUS.md, 2026-08-11: "What ships over the socket at M5 is
       deliberately NOT decided here"). M7's own Done-when list needs it twice over — rendering a
       card from a real GM prompt, and Reroll ("re-runs the agent") — so it couldn't stay
       deferred. `contracts/envelope.schema.json`'s `EVENT` type was the obvious reuse candidate
       but its `event` field is a closed enum tied to `eventbus.js`'s `HOOKS` table, so it would
       have needed the identical schema edit as adding a new type. **Chosen: a 7th envelope type,
       `TRIGGER`** (module → agent, `{ text }`, fire-and-forget, no reply in v1), over extending
       `EVENT`'s enum — keeps a GM-authored command semantically distinct from passive hook
       telemetry, at the cost of one more `$defs` entry. `contracts/envelope.schema.json`,
       `scripts/envelope.js`'s `ENVELOPE_TYPES`, and spec §5.6's type table all updated together;
       `gm-delegate-agent/src/envelope.js` needed no code change since it loads the schema JSON
       directly through ajv.
    2. **Two runStage() calls, chained in-process, not one and not a file-based ICM chain.**
       `gm-session/20_resolve/CONTEXT.md`'s own contract ends at reporting a mechanical result;
       `30_scene/CONTEXT.md` owns the card. But M6 only ever wired one `runStage()` call
       (`20_resolve`), and nothing chains it to a second. Three options were on the table: fold
       everything into 20_resolve's already-proven single stage (deviates from the two-stage
       ICM split M5a validated); chain two `runStage()` calls in one process with no files (keeps
       the tool-surface separation §5.5 explicitly wants, costs a second model round-trip);
       or the fully literal ICM design — `out/` files, a `validate.py` gate per stage. Rejected
       the third outright: no `validate.py` exists anywhere in this all-JS project, and `.py` in
       a Node/Foundry codebase would be new infrastructure, not a missing file. **Chosen: two
       in-memory stages** — `gm-delegate-agent/src/index.js`'s `runEncounterFlow(text)` calls
       `runStage("20_resolve", ...)`, then feeds its `content` directly into
       `runStage("30_scene", ...)` as `userContent`, no file I/O. Both the live `TRIGGER` handler
       (`orchestrator.onTrigger`) and the manual `resolve`/`resolve N` stdin driver now share this
       one function — previously `resolve` called `runStage("20_resolve", ...)` directly, which
       stops one stage short of ever producing a card.
    3. **`propose_encounter`'s `creatures[]` needs `packId`/`actorId`, and nothing produced them.**
       The Thornwood table's actual rows are plain text (STATUS.md, 2026-08-12); `roll_on_table`'s
       executor never extracted a compendium link at all. Fetched v14's real `TableResult` schema
       (not recalled) rather than guess: it exposes a single `documentUuid` field, not the older
       `documentCollection`/`documentId` pair. `encounter.js`'s `rollOnTable` now resolves
       `documentUuid` via `fromUuid()` and reads `doc.compendium.collection` (packId) /
       `doc.id` (actorId) off the result — both field names independently verified live against
       `foundryvtt.com/api` this session (new §0 rows), not assumed from the `game.packs.get()`
       convention alone. Defensive: a plain-text row has no `documentUuid` and resolves to nulls,
       not a throw. **This means the live Thornwood table still has no real input for this path**
       — it needs re-authoring as pack-linked before a live session can exercise it end to end.
       Flagged, not fixed this session (needs the pod).
  - **A real import cycle, found and fixed before it shipped, not worked around.**
    `encounter.js`'s new `place_encounter` needed `proposals.js` (to consume a proposal on
    success); `proposals.js`'s `sweepExpired()` needed `journal.js`'s `logCard` (to log the
    `expired` label); `journal.js` already imports `executors/index.js` (for
    `predictTouchedDocuments`), which imports `encounter.js` — closing
    `encounter.js → proposals.js → journal.js → executors/index.js → encounter.js`. First attempt
    at running the new tests threw `"roll_on_table" registered without a touches() declaration`
    at import time — the cycle, not a logic bug. Fixed the same way this codebase already breaks
    every other such edge (`journal.js`'s `notifyAgent`, `panel.js`'s
    `registerPolicyRevokedSender`): `proposals.js` exports `registerCardLogger(fn)`, called from
    `main.js`'s `ready` hook, instead of importing `journal.js` directly. `panel.js` similarly
    can't import `execute` from `interceptor.js` directly (`interceptor.js` already imports
    `Panel`) — `registerExecute(fn)`, same pattern, also wired from `main.js`.
  - **`journal.js`'s `created[]` undo layer, specified since 2026-08-10 but never actually built,
    implemented this session** — `place_encounter`'s imported world Actor is exactly the case
    §4.5 added `created[]` for ("a snapshot cannot cover a document that does not exist yet"), and
    it was the first real executor to need it. `commit(tx, executorReturn)` now also stores
    `executorReturn.created`; `undoLast()` deletes those docs (reverse order, before restoring
    snapshots) via a new `deleteCreated()` that skips the delete if
    `doc.getDependentTokens({concreteOnly: true})` finds anything — the dedupe-reuse case (§4.5
    limit 3): undoing one encounter must not delete an Actor a *different*, still-standing
    encounter is now using. Extends the existing signatures rather than replacing them with the
    spec's own illustrative `commit(tx, result, created)`/`restore(tx)` snippet verbatim — that
    snippet predates the idempotent Layer-A duplicate-history guard already in this file's
    `commit()`, and changing `beginTransaction`'s/`undoLast`'s tested call shape wasn't needed to
    get `created[]` working.
  - **Placed tokens go through Layer A (`result.placeables`), not `created[]`, despite the spec's
    own §5.2 worked example putting them in `created[]` too.** Layer A (`storeHistory`/
    `undoHistory`) already exists and is idempotent-guarded specifically for this; duplicating
    token UUIDs into `created[]` as well would double-cover them across two undo layers with no
    correctness benefit. Only the imported Actor (a genuine non-placeable create) goes in
    `created[]`. Recorded as a deliberate deviation from the illustrative code, not a spec change.
  - **`test-m1.js` deleted, per the 2026-07-12/2026-08-10 standing decision** ("delete test-m1.js
    in M7") and 07-card.md's own Traps section. This removed the *only* executor anywhere in the
    codebase that mutated a pre-existing document — every real v1 tool is either read-only
    (`list_roll_tables`, `get_compendium_actor`) or create-only (`roll_on_table`'s draw,
    `place_encounter`'s import+place); v1's tool surface genuinely never calls `journal.js`'s
    snapshot-restore (`doc.update(...)`) branch. That branch isn't dead — Midi-QOL actions (v2)
    will need it — but no *test* exercises it anymore either. Rewrote the three tests that relied
    on `test.actor.rename` (`tests/interceptor.test.js`, `tests/panel.test.js`,
    `tests/socket.test.js`) to use real v1 actions instead (`roll_on_table`/`get_compendium_actor`
    for the generic auto-mode cases, two real `place_encounter` calls for the undo-N test) rather
    than inventing a new synthetic executor to keep the old assertion shape. The snapshot-restore
    branch itself is untested by anything now — flagged here rather than silently accepted.
  - **`propose_encounter`'s wire round trip: QUEUED, not EXECUTED, is success.** No executor is
    registered for `propose_encounter` (by design — `DEFAULT_POLICY`'s `propose` mode routes it to
    `Panel.queue()` before `EXECUTORS` is ever consulted, confirmed in the M6 entry above), so if a
    subsystem's mode were ever flipped to `auto`, this action would REJECT with `UNKNOWN_ACTION`,
    not execute. `stageRunner.js`'s new `sceneDomainTools()` treats exactly `QUEUED` as success and
    everything else — `REJECTED`, or that hypothetical `UNKNOWN_ACTION` — as an error reported back
    to the model, per `20_resolve/CONTEXT.md`'s own rule: a tool surface that can't do the moment's
    job escalates, it doesn't get quietly worked around.
  - **Card-log context (trigger text, `foundry_state`, latency) is captured once, at proposal
    creation, and frozen into the proposal's stored record** — not reconstructed later at
    accept/edit/reroll/skip time, when the GM's own think-time would corrupt the "GM prompt → card
    on screen" latency measurement 07-card.md's Done-when actually asks for.
    `panel.js`'s `Panel.queue()` captures `Date.now() - lastTrigger.ts` and `captureFoundryState()`
    (a new small helper: `scene`/`combat`/`selected` off `canvas`/`game`, same shape
    `log-entry.schema.json`'s `foundry_state` already declares) the moment a `propose_encounter`
    intent arrives, and every terminal `gm_action` write reuses that frozen context.
  - **`model` stays `null` in every card-log entry this session writes, a known, pre-existing gap
    left open rather than expanded.** `contracts/envelope.schema.json`'s `INTENT` payload has no
    `model` field, so the module has no way to learn which model produced a proposal without
    another schema change. Every *other* `logCard()` call site in the codebase (`socket.js`'s
    generic per-intent write) already has this exact gap; not fixing it here keeps this session's
    contracts diff to the one change that was actually load-bearing (`TRIGGER`).
  - **`Edit` places on confirm, not on a separate later click.** §6's label table has one row,
    "Edit, then use," not two — an edited card the GM never placed isn't the positive-plus-quality
    signal `gm_edit_diff` is supposed to represent. `startEdit()`/`cancelEdit()` just toggle which
    card shows a textarea (UI-only, unlogged); `confirmEdit(proposalId, editedText)` is the one
    action that computes the diff, logs `gm_action: "edit"`, and calls `place_encounter` — same
    single combined step, not a two-button flow the mockup's four buttons don't have room for
    anyway.
  - **`markOpened()` fires on render, not on click.** The panel is docked and GM-only (§4.7) — a
    card actually rendering into `_prepareContext()`'s output is the closest v1 proxy for "the GM
    saw this," which is exactly what `opened` needs to mean to keep `skip` (opened, refused)
    distinct from `expired` (never seen) at §5.7. Every explicit action (accept/edit/reroll/skip)
    also calls `markOpened()` defensively, but by the time any of them fire, a render has already
    happened.
  - **Reroll re-sends the GM's original trigger text, verbatim**, via the same `sendTrigger()` path
    the panel's own input uses — not a new "re-run" mechanism. Simplest thing that satisfies
    07-card.md's "re-runs the agent," and means Reroll gets exercised by the exact same live path
    (`TRIGGER` → `runEncounterFlow`) a fresh GM prompt does, nothing bespoke to separately verify.
  - **`gm_edit_diff` is a plain `- original\n+ edited` string, not a real diff algorithm.** Beats +
    hook together are a handful of short lines, not code; a diff library would be solving a
    problem this doesn't have. `null` when the GM didn't actually change anything.
  - **Console API gained `Proposals: { get, getEntry }`** (`main.js`), same "manual/console-driven
    testing" role `EventBus`'s console exposure already plays, for whenever a live session needs to
    inspect a queued proposal by hand.
  - **What a live pod session still needs to confirm, none of it exercised this session:**
    the card actually renders as `ApplicationV2`/Handlebars (same class of risk M3's first session
    got wrong five different ways — `_prepareContext`'s new `cards`/`queued`/`anyQueued` shape and
    `card-encounter.hbs`'s `{{> card-encounter}}` partial registration via `loadTemplates()` are
    unexercised by anything under vitest); a real GM trigger actually reaches
    `gm-delegate-agent` and comes back as a rendered card; Accept & Place creates real tokens and
    `undoLast(1)` removes them; the provenance line matches a real tool-call trace; median
    GM-prompt-to-card latency, the §9 kill criterion; and the Thornwood table re-authored as
    pack-linked rows so `packId`/`actorId` resolve to something real instead of nulls. **Next
    session, first move:** get sign-off to start the pod, reinstall at whatever version this gets
    bumped to when committed, then work `docs/milestones/07-card.md`'s Done-when list start to
    finish — this entry's own list above is that Done-when list's live-verification half.

- **2026-08-14 (session 8)** — **M7's live-verify pass run to completion. All 9 Done-when items
  from `docs/milestones/07-card.md` confirmed against the real pod, one real bug found and fixed,
  one real kill-criterion miss measured and left visible rather than smoothed over.**
  - **Pod start: 9 consecutive `start-pod` failures** ("not enough free GPUs on the host machine",
    the same recurring error logged in three prior sessions), cleared on attempt 10 with no
    terminate+recreate needed this time — the fastest full recovery of this failure mode so far.
  - **Playwright MCP browser tools were available this session, a first for this project.**
    Every prior live-Foundry pass (M1, M3, M4, M6) was driven by the user pasting console output
    back by hand (2026-08-12 session entry: "No browser-automation tool was available… noted as a
    gap, not a blocker"). This session drove the whole thing directly — navigate, click, type,
    `evaluate()` — end to end, no manual relay. Worth naming as a real capability change, not
    just a detail of how this session happened to go.
  - **Deployment mechanics, two real gotchas hit and resolved:**
    1. **A locally-built zip with backslash-separated entry paths silently breaks the Foundry
       install.** PowerShell's `Compress-Archive` and even .NET's `[System.IO.Compression.ZipFile]::CreateFromDirectory`
       both write Windows path separators (`scripts\main.js`) into zip entry names on this
       platform — the felddy Docker image's Linux-side unzip doesn't treat that as a directory
       separator, so files would land as literally-named `scripts\main.js` at the zip root
       instead of inside `scripts/`. Fixed by building the archive entry-by-entry with
       `ZipArchiveMode.Create` and explicit `-replace '\\','/'` on each relative path. Verified
       with `unzip -l` before uploading, not assumed.
    2. **`raw.githubusercontent.com` caches the manifest independently of the actual git ref.**
       After pushing the `module.json` version bump, Foundry's "Perform Update" check kept
       reporting the old version for several minutes — confirmed via the GitHub Contents API
       that `master` already had the new content, so this was a CDN cache lag (~5 min), not a
       push failure. Waited it out with a polling loop rather than assuming the push was broken.
    Both are now known costs of this project's "cut a release, point the manifest at it" deploy
    path (2026-08-11 decision) — worth remembering before assuming a future deploy issue is a
    code bug.
  - **Real bug found and fixed: `place_encounter` hung forever on every Accept & Place.**
    `scripts/executors/encounter.js`'s `placeEncounter()` called `canvas.tokens.placeTokens(tokenData, {})`.
    Read live (not assumed): that method is Foundry's **interactive** click-to-place workflow —
    it registers `pointerdown`/`pointermove` listeners on `canvas.stage` and returns a
    `Promise.withResolvers()` promise that only resolves when a human clicks the canvas once per
    token. Called headlessly (an automated Accept & Place, or any real GM who just clicks the
    button once and expects it to be done), it never resolves — `acceptProposal()` in `panel.js`
    awaits it forever, so no journal entry, no dequeue, no tokens, no visible error. 100%
    reproducible, not intermittent — worse than the tool-call reliability finding below because
    it broke every single Accept & Place, not a fraction of them.
    - **Fix**: `canvas.scene.createEmbeddedDocuments("Token", tokenData)`, a real programmatic
      bulk create, with tokens scattered in a small grid around the scene center (`getTokenDocument()`
      defaults x/y to 0,0, which would have stacked every token exactly on top of the last).
      This is also the creation path `journal.js`'s `commit()` was actually built to expect — its
      duplicate-history guard (2026-08-10 decision, this file) exists specifically because
      "v14 core may already record history on a programmatic `createEmbeddedDocuments`," which
      only makes sense if that's the intended call. `placeTokens()`'s interactive workflow was
      never what the rest of the system was designed around.
    - `tests/setup.js`'s mock updated to match (`canvas.scene.createEmbeddedDocuments` now
      returns objects with a working `toObject()`, `canvas.grid`/`canvas.scene.dimensions`
      added). 156/156 module tests still pass.
    - Shipped as **v0.7.1**. Required the user's explicit sign-off twice — once to cut the
      GitHub release (blocked by the auto-mode classifier as a public/visible action) and once
      to commit+push the version bump to `master` (needed for the manifest to actually point at
      the new release) — both asked for and granted before proceeding, not assumed.
  - **Live-confirmed all 9 Done-when items**, via direct browser automation against
    `game.modules.get("gm-delegate").api` and the real DOM:
    - `propose` mode renders the card: `card-encounter.hbs` compiled cleanly as a Handlebars
      partial (console-confirmed), the panel and its chips/RECLAIM/undo/trigger-input all mount
      correctly — the exact class of risk M3's first session got wrong five different ways
      (2026-08-12 entry) did not recur here.
    - Accept & Place: real Bandit tokens created via the fixed `createEmbeddedDocuments` path,
      `undoLast(1)` removed all of them, journal entry flipped to `reverted: true`.
    - Edit: opened the textarea, edited text, `gm_action: "edit"` logged with a correct
      `- original\n+ edited` `gm_edit_diff`, `place_encounter` fired with the edited text.
    - Reroll: `gm_action: "reroll"` logged against the discarded proposal's id, a fresh
      trigger→card cycle followed automatically.
    - Skip: `gm_action: "skip"` logged, card dismissed, queue emptied.
    - Expire: **confirmed the panel's own `_prepareContext()` marks every rendered proposal
      "opened" immediately** (`markProposalOpened()` at the point cards are built for display) —
      meaning a proposal can only ever go truly unopened if the GM's panel isn't currently
      mounted. Closed the panel via `foundry.applications.instances`, fired a trigger through a
      dynamic `import()` of `panel.js` (to reach the unexported `sendTrigger()`), confirmed
      `opened: false` on the resulting proposal, then let the real 15-minute TTL and the real
      60-second `sweepExpired()` interval (both already wired, `main.js`) run to completion.
      **`gm_action: "expired"` logged correctly** — not simulated, not sped up.
    - Provenance line: checked by hand against the actual queued intent — table id, roll, and
      result matched exactly (`RollTable.wrPvaOz83tmEmodd · roll 9 → [1d4] Bandits`, quantity
      line `Foundry rolled 1d4=3 → 3 Bandits`, both traced back to the real `roll_on_table` call).
    - `touches()`/undo: covered by the Accept & Place check above — `placeEncounterTouches()`
      declares correctly, `undoLast(1)` worked.
  - **Median latency: 6562ms across 5 samples (6854, 6107, 5572, 6723, 6562), every single one
    above the 5000ms kill criterion in both 07-card.md's Done-when list and §9's own table.**
    Measured via the real `latency_ms.total` the module itself computes
    (`Date.now() - lastTrigger.ts` at proposal-queue time, `panel.js`), not estimated. §9's own
    remedy for a latency miss is explicit: "cut an orchestration hop. It is not the hardware" —
    pointing at the two-stage `runEncounterFlow()` (`20_resolve` then `30_scene`, two full model
    round trips) the M7 session's own decision log already flagged as a latency cost when it was
    chosen over folding everything into one stage. **Not fixed this session** — this is a §9
    finding to weigh across the four-session evaluation window the spec calls for, not a bug to
    silently patch mid-measurement.
  - **`propose_encounter` tool-call reliability: real, but intermittent, not the median case.**
    Across roughly 10 live trigger fires this session (before and after the Thornwood
    pack-linking fix below), one produced a genuinely broken card: **8 `propose_encounter` calls
    in a single run** (hitting `MAX_TOOL_ITERATIONS` exactly), `creatures: []` on all 8, and
    literal Hermes-style `<parameter=X>...</parameter>` tool-call syntax leaked into the `beats`/
    `hook` text — diagnosed live by adding temporary `console.error` instrumentation to
    `stageRunner.js`'s loop (removed after use, same throwaway-diagnostic discipline as the M6
    session's `debug-resolve*.mjs` scripts), which showed the raw `assistantMessage` per
    iteration. The remaining ~9 samples were clean single-call runs, though a couple of the
    "clean" ones still carried a wrong `packId`/`actorId` (e.g. `packId: "RollTable.wrPvaOz83tmEmodd"` —
    the table's own id, not a compendium collection). Given the small sample and the qualitative
    clarity (this is real, not zero-rate, but nowhere near the every-run failure roll_on_table's
    "doesn't know when to stop" bug was before its 2026-08-13 harness fix), **not chased to a
    precise statistic this session** — same call the M6 session made about `roll_on_table`'s
    validity numbers before the harness fix was found. Left as an open, real finding for whoever
    picks up the §9 model-tier discussion.
  - **Thornwood table re-authored as pack-linked, closing the gap the M7 build session left
    open.** `game.tables`'s "Thornwood Road Encounters" table had 5 plain-text rows (`[[2d4]] Wolf
    Pack`, `[[1d4]] Bandits`, `[[1d6]] Wild Boars`, `[[1]] Wounded Traveller`, `Nothing of note`)
    with no `documentUuid` on any result — confirmed live via `table.results.contents.map(r =>
    r.toObject())` before touching anything. Linked the four creature/NPC rows to real dnd5e
    core-compendium Actors (`Wolf`, `Bandit`, `Boar`, `Commoner`) via
    `table.updateEmbeddedDocuments("TableResult", [{ _id, type: "document", documentUuid }])` —
    `CONST.TABLE_RESULT_TYPES` in this v14 build is `{ TEXT: "text", DOCUMENT: "document" }`, no
    `"pack"` variant, confirming `encounter.js`'s own comment that the older
    `documentCollection`/`documentId` split no longer exists. "Nothing of note" left as plain
    text — correctly, it has no creature to link. **This directly fixed the `packId`/`actorId`
    hallucination this session's own diagnostic run first surfaced**: before the fix, every
    `propose_encounter` call had either an empty `creatures[]` or a fabricated `actorId` (e.g.
    `"1d6"`, a dice formula, not an id); after, `packId`/`actorId` correctly matched the real
    compendium (`dnd5e.actors24` / `mmBandit00000000`) in every inspected sample bar the one
    still-wrong case noted above.
  - **Local infra**: `gm-delegate-agent`'s WS server (port 8765) was not running at session
    start — started via `npm start`, backgrounded. `llama-server` (port 8080) was already up and
    healthy from a prior session, unchanged this session.
  - **After the Done-when checklist passed, ran a short simulated GM session (user's own request:
    "can you run a short session as a GM using playwright?") — five trigger→card cycles with
    realistic mixed GM judgment, not just mechanical clicking. Found a second real bug.**
    - Round 1: card claimed "1 Bandit" but its own beats said "two figures emerge" — a real GM
      would catch that inconsistency. Edited to fix it rather than accepting blindly.
    - Round 2 ("the party makes camp for the night in the Thornwood"): produced no card at all.
      `20_resolve` called `list_roll_tables` twice (once with a bad filter, self-corrected to an
      empty one) and then stopped without ever calling `roll_on_table` or `propose_encounter`.
      Confirmed this was a clean completion, not a hang — `llama-server`'s `/slots` endpoint
      showed `is_processing: false`. Read as the model correctly declining to force an encounter
      for a trigger that isn't really a travel/road moment, not a bug — but worth another look if
      it turns out the GM *did* want a check here and the model is being too conservative.
    - Round 3 ("continues down the Thornwood road at dusk"): rolled "Nothing of note" —
      `creatures: []` correctly, decent atmospheric beats, no hallucinated monster. Accepted.
      Confirmed **Accept & Place with zero creatures doesn't crash** (`createEmbeddedDocuments`
      with an empty array is a clean no-op) — a real edge case the Done-when checklist's own
      samples hadn't happened to hit.
    - Round 4: another `packId`/`actorId` hallucination (`packId: "wrPvaOz83tmEmodd"`, `actorId:
      "[[1d4]] Bandits"` — the row's own display text, not an id). Clicked Accept & Place
      deliberately to see how the failure path behaves for a real GM, not just to get a working
      card. **Found it: `interceptor.js`'s `execute()` correctly returned `{status: "REJECTED",
      reason: "EXEC_FAILED: place_encounter: no pack wrPvaOz83tmEmodd"}` — but `panel.js`'s
      `acceptProposal()` never checked `outcome.status` before logging `gm_action: "accept"` and
      dequeuing the card.** Net effect: the card silently vanishes from the panel, no tokens are
      placed, the GM gets zero feedback that anything went wrong, and the §6 card log — the
      dataset §9's kill criteria are computed from — records a **false positive accept** for
      content that was never actually used. This is worse than a cosmetic bug: it directly
      corrupts the training signal 07-card.md calls "the most valuable thing this entire
      prototype produces."
      - **Fixed, with the user's explicit sign-off** ("fix it now"): `acceptProposal()` and
        `confirmEdit()` (`scripts/panel.js`) now check `outcome.status !== "EXECUTED"` before
        logging. On failure: `ui.notifications.error(...)` tells the GM directly (this project's
        first use of that API — nothing before M7 needed to surface an error to the GM mid-flow),
        the log entry still honestly records `gm_action: "accept"`/`"edit"` (that *was* the GM's
        real action) but now also carries `rejected: { reason, action: "place_encounter" }` —
        reusing `log-entry.schema.json`'s existing `rejected` field (documented as "present when
        the Interceptor refused," here extended to cover "the executor failed after acceptance"
        rather than adding a new schema field or `gm_action` enum value, which would need
        proposing per `AGENTS.md`/§10, not just applying) — and the card is **not** dequeued, so
        the GM can Reroll or Skip it explicitly instead of it disappearing.
      - Two new tests (`tests/panel.test.js`): accept-failure and edit-failure paths, both
        asserting the card stays queued, the proposal isn't consumed, `ui.notifications.error`
        fires, and `rejected` is populated correctly. `tests/setup.js` gained a minimal
        `globalThis.ui.notifications` mock (`error`/`warn`/`info` spies) — nothing before this
        needed `ui` to exist under vitest. **158/158 module tests pass.**
      - Shipped as **v0.7.2**, live-verified: re-triggered until another bad-packId card
        appeared, clicked Accept & Place, confirmed the error notification fired, `rejected` was
        populated in the card log, and the card stayed queued instead of vanishing.
    - Round 5 was folded into the v0.7.2 fix verification above rather than run separately.
    - **Tentative accept-without-edit tally from this simulated session** (not a real §9
      measurement — five rounds from one session, deliberately including adversarial clicks on
      known-bad cards, not a blind sample): round 1 edit, round 3 accept, round 4 a caught
      failure (not a content judgment at all). Too small and too deliberately stress-tested to
      read as a §9 data point — flagged so a future session doesn't mistake it for one.
  - **After v0.7.2 shipped, extended the simulated session further** (user's own follow-up
    request, mobile at the time and unable to test locally): "how close to a human GM session
    can we get?" Answer given before proceeding: mechanically close (create PCs, populate a
    scene, drive combat, exercise every wired feature), but Accept/Edit/Reroll/Skip judgment
    calls are still this session's pattern-matching, not real GM taste — flagged explicitly so
    the resulting numbers are never mistaken for a §9 measurement.
    - **Correction made before spending pod time**: `combat_tactics` and `npc_voice` have no
      backing AI content generator in this build — confirmed via `policy.js` (both default
      `off/off`) and `stageRunner.js` (`sceneDomainTools()` only exists for `random_encounters`).
      Their panel chips are UI-only plumbing from M3. Toggling them would have tested nothing.
      Redirected to what's actually real: a small party, more `random_encounters` cycles, a live
      Combat encounter, and M3's actually-implemented "I'll voice this one" TokenHUD feature.
    - Created 3 PC Actors (`Actor.create`, `type: "character"`) and placed them as tokens.
    - **Found a third distinct `propose_encounter` failure mode**: the exact trigger phrase that
      had produced a valid card ~8 times already ("three days through the Thornwood") twice this
      extended session produced **no card at all** — `roll_on_table` executed successfully
      (confirmed in the journal), but `30_scene` never called `propose_encounter` and the run
      completed cleanly (`llama-server`'s `/slots` showed `is_processing: false`, not hung).
      Different from the earlier "ambiguous trigger" read (round 2, "makes camp for the night")
      — this is the *same* proven-good trigger silently producing nothing. Alongside the
      catastrophic-loop and bad-packId modes already logged, this is now three separate ways
      `propose_encounter` can misbehave. Not chased further this session — flagged for the
      larger-sample pass already recommended above.
    - Started a real Combat encounter (3 PCs + placed monsters), rolled initiative, advanced a
      turn. **Confirmed `foundry_state.combat: true` is captured correctly** when a trigger fires
      mid-combat — every sample earlier this session had `combat: false`, so this was the first
      live exercise of that branch of `captureFoundryState()`.
    - **Confirmed M3's "I'll voice this one" TokenHUD feature still works in v0.7.2**, first live
      exercise since 2026-08-12. Bound `canvas.hud.token` to a placed Boar, clicked the control,
      confirmed `getPolicy().actorOverrides["mmBoar0000000000"].npc_voice` became
      `{decide: "off", prompt: "off"}` — correct behavior, not a bug: "I'll voice this one" means
      the GM is taking over, so the AI's npc_voice suggestions for that specific actor turn off,
      per `voiceNpc()`'s own comment. Read the code before assuming `off/off` looked wrong.
  - **Next session:** M7 is done. Per 07-card.md's own instruction, this was the last milestone
    of the prototype — the next four sessions should be spent using it, not building on it, then
    §9's three thresholds (accept-without-edit rate >50%, median latency <5s, tool-call validity
    >95%) get read honestly. Latency is already known to be failing; watch whether it's a hard
    architectural cost (two model round trips) or something a smaller prompt/context fixes.
    `propose_encounter`'s reliability is worth a larger-sample pass if it keeps surfacing during
    real use, same as `roll_on_table`'s did — now three known failure modes (catastrophic loop,
    bad packId/actorId, silent no-card), not one. Round 2's "no card produced" behavior is worth
    watching too — confirm it's genuinely correct restraint for ambiguous triggers and not the
    model quietly giving up on triggers that should work.

- **2026-08-14 (session 9)** — **Investigated the M7 latency miss and `propose_encounter`
  reliability, both flagged open in session 8. No code changed — this is diagnosis, per
  the user's ask.** Used a throwaway diagnostic script
  (`gm-delegate-agent/debug-latency.mjs`, same disposal convention as M6's
  `debug-resolve*.mjs` — written, run, deleted, not committed) that calls `stageRunner.js`'s
  real `runStage()` twice, exactly as `index.js`'s `runEncounterFlow()` does, but against a
  **fake orchestrator whose `sendIntent()` rejects instantly** ("no module connected"),
  bypassing Foundry and the RunPod pod entirely. `llama-server` (port 8080) was already up
  locally from a prior session; no pod was started for this.
  - **Latency: confirmed architectural, not hardware/network.** 11 local runs, zero real
    Foundry round trips in any of them, **median total flow ~6.3–6.7s** — matching session
    8's live 6562ms median almost exactly, with no dice roll, no RunPod hop, no real tool
    execution anywhere in the loop. This directly confirms §9's own remedy ("cut an
    orchestration hop. It is not the hardware") rather than leaving it a guess: the cost is
    the sequential LLM completion count (up to `MAX_TOOL_ITERATIONS=8` per stage, two
    stages), not network/hardware latency to the pod. **Not fixed this session** — diagnosis
    only, per the ask.
    - Secondary, unconfirmed observation: individual completion latency (400–4100ms) did
      not shrink as a stage's message history grew, which prefix-cache reuse would predict.
      `llama-server`'s `/slots` showed 2 parallel slots — alternating slots would evict the
      cache between calls. Flagged as a hypothesis for whoever chases this further, not
      verified.
  - **Found a 4th distinct failure mode, upstream of `propose_encounter` itself.** One run
    hit `20_resolve`'s `MAX_TOOL_ITERATIONS=8` (`timedOut: true`). Its tool log shows the
    model did **not** retry `roll_on_table`/`list_roll_tables` — it honored "do not retry"
    on those specific tools. Instead, after the tool error, it spent all 8 iterations on
    `list_files`/`read_file` (`10_watch/out/`, `_world/locations/`,
    `_world/never-delegate.md`, the not-yet-wired `10_watch/out/window.md`), chasing
    grounding that `10_watch` doesn't produce yet (§7.3 is v2 — session 8's own
    `runEncounterFlow` comment already says so), and never produced final text. In
    production this is `index.js`'s `"20_resolve did not produce a result"` console error —
    a silent no-card, same visible symptom as the 3 modes session 8 logged, but a different
    mechanism (fs-tool wandering after a domain-tool error, not a `propose_encounter`
    malfunction, and it happens in `20_resolve` before `30_scene` is ever reached). Did not
    reproduce on 13 further local attempts — intermittent, consistent with session 8's own
    "not the median case" read on the other three modes. Not chased to a fix this session.
  - **Caveat on the diagnostic script's own numbers, for whoever reruns this**: the script
    always ran both stages back to back regardless of `20_resolve`'s outcome, unlike the
    real `runEncounterFlow()`, which returns early and never calls `30_scene` when
    `20_resolve` times out or produces no content (`index.js`, the
    `resolveResult.timedOut || !resolveResult.content` check). The one run that hit the
    4th failure mode above therefore shows a `30_scene` total, but a real trigger hitting
    the same 20_resolve failure would stop at ~5.1s, not the 13s the script printed.
  - **Next session, if this gets picked up:** the latency fix session 8's §9 pointed at
    (folding `20_resolve`/`30_scene` into one round trip, or capping iterations lower than
    8) hasn't been attempted — this session only confirmed where the cost lives. The new
    4th failure mode is worth a larger local sample (no pod needed — this whole
    investigation ran off `llama-server` alone) before deciding whether it's worth a prompt
    fix in `20_resolve/CONTEXT.md` telling the model to stop and report on any domain-tool
    error rather than explore the workspace.

- **2026-08-14 (session 10)** — **Got a real-Foundry tool-call-validity number, and got a
  corrected root cause for the latency miss via an Opus-backed planning agent.** No code
  shipped this session — one infra recovery, one live measurement, one piece of
  architectural analysis.
  - **RunPod GPU-unavailability recovery, a new finding beyond "retry or terminate+recreate":**
    `start-pod` on `d90mhv7i5kvqyg` failed **34 consecutive times** ("not enough free GPUs on
    the host machine," retried across three ~12-attempt windows). The RunPod **web dashboard**
    (not available via the MCP tools — confirmed by checking the v2 OpenAPI spec directly, no
    migration/compute-type-change endpoint exists there) surfaces a dedicated "Your Pod's GPUs
    are no longer available" dialog with three options: automatic migration to an identical-GPU
    pod, **"Start Pod using CPUs,"** or wait. Chose the CPU option — Foundry needs no GPU at
    all. **It worked**: same pod ID, same `/data` mount, `gpu.count: 0`, cost dropped from
    $0.74/hr to $0.37/hr. This contradicts nothing from the 2026-08-11 finding that *creating a
    new* CPU pod can't get persistent storage through the tools available then — this is
    *resuming an existing* pod (storage already attached) on different compute, a different
    code path. **Worth trying this dashboard option before terminate+recreate next time a pod
    gets stuck on GPU availability**, since it's non-destructive and free of the license/admin-
    key re-entry cost. One side effect: the host swap re-triggered Foundry's license
    verification (EULA re-accept, admin-key re-entry) even though `/data` never moved — matches
    the already-logged 2026-08-11 pattern of a host change tripping license re-verification.
  - **rsync-between-pods, investigated and ruled out for this situation, not because it doesn't
    exist.** User pointed at `docs.runpod.io/storage/network-volumes`'s rsync-over-SSH section,
    which is real (`runpodctl send/receive` or manual SSH+rsync) — but it requires **both pods
    running** with shell access inside each. Moot while the source pod won't start at all, and
    separately: this pod's image (`ghcr.io/felddy/foundryvtt:14`) was never given `sshPublicKey`
    at creation, so the `PUBLIC_KEY`→sshd convention `create-pod`'s own docs describe likely
    never applied here (matches the already-logged 2026-08-11 finding that the web terminal
    fails on this image's custom entrypoint). Untested, not confirmed broken — worth trying if a
    future stuck-pod session gets the pod running again.
  - **`resolve 12` against real live Foundry (not the session-9 fake-orchestrator version):
    12/12 completed, zero timeouts, 12/12 valid `roll_on_table` calls, 12/12 valid
    `propose_encounter` calls — 100% tool-call validity**, clearing §9's >95% target outright.
    Sharp contrast with M6's 75%-on-8-calls and session 8's "~10% catastrophic-loop rate."
    Most likely explanation: session 8's Thornwood pack-linking fix already killed the dominant
    failure mode (bad `packId`/`actorId`), and the two rarer modes (catastrophic loop, silent
    no-card) just didn't land in 12 samples — **treat as encouraging, not conclusive**, same
    caution the project has applied to every validity number so far. Median latency **~7800ms**
    (sorted: 6771–15733ms across 12 runs), still failing the <5s criterion. Ran via a throwaway
    script (`gm-delegate-agent/resolve-n-live.mjs`, real `Orchestrator`/`startServer`, no fake —
    written, run, deleted, same disposal convention as every prior diagnostic here) after
    killing session 9's orphaned agent process (no stdin access to a process from a prior
    session) and letting the module's own exponential-backoff reconnect pick up the fresh one.
  - **Latency root cause, corrected.** Dispatched an Opus-model planning agent (isolated
    worktree, read-only — no code changes) to read the actual architecture and query the live
    `llama-server` directly (`/props`, `/slots`, `/apply-template`, `/tokenize` — real token
    counts, not estimates) rather than continue reasoning from session 9's local-only timing
    alone. Its findings:
    - **The spec's own latency budget was wrong at the premise.**
      `docs/gm-delegate-build-spec-v1.md:1046` assumes "a 9B generating **40 tokens** ... should
      be trivial." **A typical successful run generates ~380 tokens across 5 sequential model
      completions** (2 in `20_resolve`, up to 3 in `30_scene` including a wasted final call —
      see below) — 9.5× the spec's assumption. At the measured ~78 tok/s Vulkan decode rate,
      that's ~4.2–4.9s of pure generation, before any Foundry round trip.
    - **Two session-9 open questions closed.** Reasoning-off is genuinely in effect
      (`/props`'s `generation_prompt` shows an empty prefilled think block — no leftover
      overhead). Session 9's prompt-caching-broken hypothesis is **probably wrong**: a 400ms
      call is arithmetically impossible for a ~2280-token cold prefill at any plausible rate for
      this hardware, so within-stage caching is working; the `n_prompt_tokens_cache: 0` session
      9 saw on `/slots` was idle slots holding unrelated stale tasks, not the encounter flow.
      **Do not spend time on `--parallel 1` as a cache fix** — the agent's explicit
      recommendation against session 9's own speculation.
    - **Two new findings.** `config.yaml`'s `max_tokens: 2048` (with a comment explaining why
      it's needed) is **never actually sent to the server** — `modelClient.js:71`'s
      `complete()` call has no options argument, `/slots` confirms `n_predict: -1`
      (unbounded). Latency-neutral for the median, but it's exactly the shape of session 6's
      3-minute runaway — a real tail-risk gap, not just a stale comment. Separately,
      `30_scene`'s loop (`stageRunner.js`'s exit-only-on-no-tool-calls shape) runs a **5th
      completion purely to obtain `sceneResult.content`**, which nothing downstream reads
      (`index.js` only uses `toolLog`) — `30_scene/CONTEXT.md` already says "calling
      `propose_encounter` **is** producing your output," the code just doesn't act on that.
    - **Ranked recommendation, reversing what the previous entry pointed at.** The Opus
      agent's explicit advice: do **not** merge `20_resolve`/`30_scene` first, despite that
      being what this file's own 2026-08-14 (session 9) entry flagged as the next thing to try
      — merging is the option that trades away the per-stage tool-pruning design principle and
      opens a new fabrication surface (proposing before rolling), so it should be the **last**
      lever, not the first. Priority order instead: (1) swap the Vulkan llama.cpp build for a
      CUDA build (~30 min, zero code/prompt risk, biggest single projected saving —
      ~2000–2800ms, unverified for this specific box); (2) one small `stageRunner.js` PR
      bundling four cheap fixes together — skip the wasted 5th `30_scene` call, drop
      `list_files`/`read_file` from these two stages entirely (neither stage's `CONTEXT.md`
      asks for them, and this also **kills the session-9 4th failure mode outright**, not just
      trims latency), lower `MAX_TOOL_ITERATIONS`, and actually pass `max_tokens` through.
      Projected combined: ~6.5s → ~3.0–3.8s local / ~4.3–5.1s live-Foundry, plausibly enough to
      clear <5s without ever touching stage-merging. Full ranked table (10 options total, with
      per-option latency/risk/design-tension breakdown) is in the agent's report, not
      reproduced here in full — re-run the same investigation if this file's summary is ever in
      doubt, the agent's methodology (query `llama-server` directly) is cheap to repeat.
  - **Same session, continued: implemented step 1 and step 2, both from live measurement, not
    projection.** `stageRunner.js` now logs per-completion wall time + `usage.input`/`output`/
    `cacheRead` (STATUS.md's own instrumentation ask, ~5 lines).
    - **Step 1 (CUDA build swap): tested, and rejected — the agent's #1-ranked, "zero risk"
      recommendation turned out to be a regression on this specific machine.** First pass (CUDA
      `b10424` vs the running Vulkan `b10375`) looked promising but was confounded: a 49-build
      version gap, and `/props` showed a different `chat_format` (`peg-native` → `Content-only`)
      and empty `generation_prompt`, i.e. more than just the backend changed. Re-ran with the
      *matching* `b10375` CUDA build (same binary, same flags, same script) to isolate the
      variable properly: **Vulkan median 3967ms vs CUDA median 7111ms, n=6 each** — CUDA is
      *slower* here, not faster. Reverted to the Vulkan `b10375` build (winget install,
      unchanged). This is exactly why the agent flagged the projection "unverified for this
      specific box" — verified, and the answer was no. Do not re-attempt this swap without a
      new reason to suspect the hardware/driver situation changed.
    - **Along the way, the new `cacheRead` instrumentation settled the agent's own remaining
      open question for free**: a same-build CUDA sanity-check run showed call 2's
      `cacheRead=2171` against call 1's `input=2143` — confirms within-stage prompt-prefix
      caching is genuinely working, and that it also persists *across separate process
      invocations* against the same running `llama-server` (unrelated runs showed an elevated
      baseline `cacheRead` on their very first call, not just later ones) — a stronger form of
      caching than the agent's report established.
    - **Step 2: the bundled `stageRunner.js`/`index.js`/`modelClient.js` PR, all four fixes
      together.** `runStage()` gained three new optional params: `useFsTools` (default `true`,
      preserves the existing generic contract — `index.js` passes `false` for both `20_resolve`
      and `30_scene`, since neither stage's `CONTEXT.md` asks for catalog lookups, and this also
      deletes the session-9 4th failure mode outright), `terminalTool` (short-circuits the loop
      the moment a named tool call succeeds — `index.js` passes `"propose_encounter"` for
      `30_scene`, skipping the wasted 5th completion whose text nothing reads), and
      `maxIterations` (default still `MAX_TOOL_ITERATIONS`/8 — `index.js` passes `4` for
      `20_resolve`, `3` for `30_scene`, a tail guard, not a median fix). **Correctness bug
      caught and fixed before landing**: the first `terminalTool` cut only checked the
      transport-level `isError` flag, which does NOT cover a domain-level rejection (`sendIntent`
      returning `REJECTED` comes back as a normally-resolved `{"error":"POLICY_OFF"}` string, same
      convention `index.js`'s own `validCalls()` already uses) — a rejected `propose_encounter`
      would have wrongly short-circuited the loop as if it had succeeded. Added a
      `resultHasError()` check (parses the JSON, looks for an `error` field) alongside `isError`.
      Caught by writing the negative-case test *before* trusting the feature, not by manual
      review. `modelClient.js`'s `chatComplete()` now passes `{ maxTokens: model.maxTokens }` as
      `complete()`'s third argument — confirmed live via `/slots` mid-request: `n_predict: 2048`,
      was `-1` before the fix.
    - **4 new tests** in `tests/stageRunner.test.js` (32/32 total, up from 28): `maxIterations`
      override, `useFsTools: false` actually removes the tools from the surface, `terminalTool`
      short-circuits on success, `terminalTool` does NOT short-circuit on a domain-level error
      (the one that caught the bug above). No `modelClient.test.js` added — this project verifies
      that kind of thin wrapper against the real service, not by mocking pi-ai's internals; the
      `/slots` check above is that verification.
    - **Result, measured (not projected), local-only (no Foundry, same throwaway-script
      methodology as session 9's baseline): median 6.5s → ~4055ms, n=10** (sorted:
      1803–5835ms). Bigger drop than the agent's own ~0.9s projection for step 2 alone — most of
      the extra gain is likely the elimination of the 4th-failure-mode timeouts, which were
      dragging the tail up in every prior local sample, not a pure per-call speedup.
    - **Done, same session: live-Foundry `resolve 12` re-check, and it found a real tradeoff the
      vitest suite couldn't see.** Pod `d90mhv7i5kvqyg` started clean on the first try this time
      (still pinned to CPU compute from the earlier dashboard migration — no GPU-availability
      retry needed). Same host-swap license re-verification as before (EULA re-accept, admin-key
      re-entry), same as every prior host change this project has hit.
      - **Tool-call argument validity: still 100%** (15/15 `roll_on_table`, 10/10
        `propose_encounter`, 0 invalid args) — confirms dropping `list_files`/`read_file` and
        adding the `terminalTool` short-circuit didn't corrupt anything, and the
        `terminalTool`/`resultHasError()` fix works correctly against real Foundry data: every
        successful run shows exactly **one** `30_scene` completion now, not two.
      - **But completion rate dropped: 10/12 (83.3%), was 12/12 before this session's fixes.**
        2 runs hit `20_resolve`'s new `maxIterations: 4` cap and produced no card at all — where
        the pre-fix 8-iteration budget would very likely have let them finish (median iteration
        count for a real success is 3; these two didn't recover in 4). This is the flip side of
        the "tail guard, not a median fix" framing this file used when the cap was set: it *is*
        still just a tail guard, but a guard set too tight also starts eating genuine successes.
        Median latency on the 10 completed runs: **~6647ms** (sorted 5169–7617ms) — better than
        the pre-fix ~7800ms, but the honest comparison is completion-adjusted: 10/12 fast cards
        vs. 12/12 slower ones is not a strict win, it's a different point on the same tradeoff
        curve. **Not resolved this session** — flagged for the next session rather than
        unilaterally re-tuning the cap and re-spending pod time without checking in first.
      - Pod stopped at end of session (billing halted, `/data` untouched).
  - **Same session, continued: `20_resolve`'s `maxIterations` set to 6** (user's own call, split
    between the too-tight 4 and the original unbounded-tail 8; not re-derived from more data),
    then **live-re-verified the same session** (pod started clean on the first try again, still
    CPU-pinned, same host-swap license re-verification as every prior restart). **This resolved
    the tradeoff cleanly**: `resolve 12` against real Foundry came back **12/12 completed, 0
    timed out, 12/12 valid `roll_on_table`, 12/12 valid `propose_encounter`, 0 invalid args** —
    full completion rate restored to the pre-fix baseline, with none of the regression `4` caused.
    **Median latency: ~6528ms** (sorted 6132–8028ms) — still above the <5s kill criterion, but a
    real ~1270ms improvement over the pre-fix live median (~7800ms) with zero downside this time.
    6 is confirmed as the value to keep; not re-opened without new evidence.
  - **Next session:** the live median (~6528ms) is still short of <5s. Option 4 from the Opus
    agent's report (pre-resolve the roll table in code — `index.js` calls `list_roll_tables`
    itself and injects the result into `20_resolve`'s `userContent`, dropping that tool from the
    surface entirely) is the next-cheapest lever per the agent's own ranking, not stage-merging.
    It should also further shrink `20_resolve`'s completion count, which may make revisiting
    `maxIterations` worthwhile again once it's landed — re-verify live, don't assume.
  - **Same session, continued: implemented and live-verified option 4.** `index.js`'s new
    `fetchRollTables()` calls `list_roll_tables` directly via `sendIntent`, injects the raw
    result into `20_resolve`'s board state; `resolveDomainTools` no longer exposes the tool to
    the model at all (`gm-session/20_resolve/CONTEXT.md` updated to match — the table list is
    now given, not fetched). Typical successful run: 3 completions → 2 in `20_resolve`. 33/33
    tests pass (1 new: confirms the tool is actually gone from the surface). `maxIterations`
    left at 6 rather than re-tightened for the now-shorter typical flow — changing two variables
    in the same live check would have made the result ambiguous.
    - **Live-verified same session** (pod started clean, CPU-pinned, same host-swap license
      re-verification as every prior restart): `resolve 12` came back **12/12 completed, 0 timed
      out, 15/15 valid `roll_on_table`, 11/11 valid `propose_encounter`, 0 invalid args**. The
      one run with fewer `propose_encounter` calls than completed runs (11 vs 12) is a legitimate
      correct-restraint case — `30_scene` declined to propose rather than fabricate, same pattern
      session 8's "Round 2" already established as expected behavior, not a bug.
    - **Median latency: ~6018ms** (sorted 3550–7330ms), down from ~6528.5ms with
      `list_roll_tables` still in the model-facing surface — a real further ~510ms win, smaller
      than the Opus agent's own ~1.4s projection for this specific change (plausibly because a
      successful `list_roll_tables` call was already benefiting from prefix-cache reuse, so its
      *incremental* cost was smaller than a from-scratch estimate would suggest). **Cumulative
      improvement from the pre-session-10 baseline: ~7800ms → ~6018ms, roughly 23%.** Still short
      of the <5s kill criterion.
  - **Next session:** three fixes in, latency has moved from confirmed-failing (~7800ms) to
    confirmed-better-but-still-short (~6018ms) with zero known regressions at each step — all
    three changes (`stageRunner.js` bundle, `maxIterations: 6`, `list_roll_tables` pre-resolve)
    live-verified individually, not just vitest-passed. Remaining levers from the Opus agent's
    ranked table, cheapest first: shrinking the root `CONTEXT.md`'s workspace map (646 tokens,
    mostly describing folders these two stages don't use — option 6, flagged as the
    highest-risk-per-ms option in that table, so weigh carefully), then stage-merging as the
    last resort, not the next default move.
  - **Same session, continued: implemented option 6 as per-stage composition** (user's explicit
    choice over a blanket edit) rather than trimming the shared file in place — the catalog
    table (`_world`/`_characters`/`_npcs`/`_srd` reference, confirmed 220 tokens via
    `/tokenize` against the live server) moved to a new `gm-session/CATALOG.md`, included only
    when a new `useCatalog` param is true (default, same generic-contract shape as
    `useFsTools`). `20_resolve`/`30_scene` pass `useCatalog: false`, paired with the
    `useFsTools: false` they already had — the catalog was already unreachable for both stages
    without the read tools, so this trades away nothing either stage could act on. `10_watch`/
    `00_dm` (unwired today, but real future stages) keep full access via the untouched default.
    Caught and fixed one accuracy bug in the same table while restructuring it: root
    `CONTEXT.md`'s Stages table claimed `30_scene` reads "catalog + upstream out/," which hasn't
    been true since M7 (`30_scene/CONTEXT.md` has said "ground in trigger text + `20_resolve`'s
    result alone" for a while). 33/33 → 35/35 `gm-delegate-agent` tests pass (2 new), 158/158
    module tests unaffected.
    - **Live-verified same session, and the result is more honest than a clean win.** `resolve
      12` against real Foundry: **12/12 completed, 0 timed out, 14/14 valid `roll_on_table`,
      12/12 valid `propose_encounter`, 0 invalid args** — no regression, same as every prior
      check. But the first 2 of 12 runs hit a cold prefix cache (13987ms, 12121ms) because the
      prompt content itself changed (`cacheRead: 0` on both, confirmed in the per-completion
      log), invalidating whatever the server had cached from before this edit — a one-time
      cost per agent-process lifetime, not a per-trigger one, so excluded from the steady-state
      read. **Median on the remaining 10 (steady-state) runs: ~6436ms** — genuinely *not*
      better than the ~6018ms measured for the same scenario just before this change, within
      this sample's noise. **Read honestly, not spun**: dropping ~220 tokens from an
      *already-cached* prefix has a much smaller marginal cost than dropping a whole model
      completion did (the `list_roll_tables`/`terminalTool` fixes, which removed entire
      prefill+decode rounds regardless of caching) — this result is consistent with, not a
      contradiction of, session 10's own finding that prefix caching is doing most of the work
      here. The change is kept: it's still correct (no stage loses real capability), still
      cheaper in absolute token/VRAM terms, and still closes a real "prompt claims access the
      code doesn't grant" accuracy gap. It's just not the latency lever it was expected to be.
  - **Next session:** the "cut tokens within a cached prompt" lever is now empirically
    exhausted for this system — don't reach for more of it (e.g. further shrinking
    `IDENTITY.md` or stage `CONTEXT.md` files) expecting a repeat win; the evidence says it
    won't move the median. The remaining real levers are the ones that remove a whole
    completion, which is a shorter list now: stage-merging (last resort, trades away the
    per-stage tool-pruning design) is what's left from the Opus agent's ranked table. Current
    live median stands at **~6018–6436ms**, still short of <5s — worth deciding whether that
    gap is worth stage-merging's cost, or worth accepting and moving to the real four-session
    usage evaluation §9 has been waiting on since M7.

- **2026-08-14 (session 11)** — **Not one of the §9 four real sessions** (those need actual
  players; this was an AI-driven simulated walkthrough against live Foundry, explicitly
  scoped as sanity-checking, not evaluation data). Found and fixed a real bug that would
  have silently zeroed out the accept rate on any of the four real sessions.
  - Pod `d90mhv7i5kvqyg` started clean (no GPU-availability retry), same host-swap license
    re-verification as every prior restart (EULA re-accept, admin-key re-entry via the pod's
    `FOUNDRY_ADMIN_KEY` env var, unchanged value). Module confirmed at **v0.7.2** (matches
    `master`, no drift). Agent server started locally (`gm-delegate-agent`, `npm start`)
    against the already-running local `llama-server`.
  - Drove the panel's trigger input directly (not the `resolve N` stdin shortcut) to
    exercise the real path: GM types trigger → `TRIGGER` frame → `runEncounterFlow` →
    card renders in the panel → GM clicks a card button. First trigger ("three days
    through the Thornwood, dusk is falling") produced a Wolf Pack card, 7698ms latency (in
    range of prior sessions' variance, still over the 5s kill criterion).
  - **Bug found: Accept & Place (and Edit → Use edited & Place) failed 100% of the time**,
    `EXEC_FAILED: place_encounter: no pack RollTable.wrPvaOz83tmEmodd`. Root-caused live,
    not guessed:
    - First hypothesis (table rows aren't pack-linked — matches a stale comment in
      `encounter.js`) was **wrong**, disproven live: the Thornwood table's rows genuinely
      are pack-linked (`documentUuid: Compendium.dnd5e.actors24.Actor.mmWolf0000000000`),
      and `fromUuid()` resolves it to a real SRD Wolf actor in a 441-entry pack. Said so
      to the user rather than proceeding on the wrong fix once this surfaced — the user's
      first pick ("re-author the table") would have been a no-op.
    - **Actual cause: a cross-stage prompt contract gap in `gm-session/`.**
      `20_resolve/CONTEXT.md`'s own output template only ever showed `{roll, drawn, dice}`
      — it never told the model to include `packId`/`actorId` in its written result, even
      though `roll_on_table`'s real tool result carries them. `30_scene/CONTEXT.md`
      correctly instructs the model to copy `packId`/`actorId` **verbatim** from
      `20_resolve`'s result — but `20_resolve`'s result, per `stageRunner.js`, is the
      model's own free-text summary (`assistantMessage.content`, not the raw tool JSON),
      so if the summary omitted them there was nothing to copy. `30_scene`'s contract
      *does* anticipate an unlinked table ("say so... instead of calling `propose_encounter`
      with invented values") but the model didn't take that path — it fabricated a value
      (reused the table's own `tableId`) instead of declining. Two distinct findings: the
      prompt-contract gap (fixable), and a 9B reliability gap on the decline-gracefully
      instruction (not fixed this session, worth watching).
  - **Fix: `gm-session/20_resolve/CONTEXT.md`'s output template now shows every field
    `roll_on_table` actually returns**, including `packId`/`actorId`, with an explicit
    instruction to include them even as `null` (an unlinked row is a real, valid outcome,
    not a reason to drop the field). Workspace-only edit, not a `contracts/*` schema
    change, so no STOP per `AGENTS.md`. `gm-delegate-agent`'s 35/35 tests still pass
    (unaffected — `CONTEXT.md` content isn't asserted there). No restart needed:
    `runStage()` calls `readFileSync` on the stage `CONTEXT.md` fresh per invocation.
  - **Live-reverified same session, on the same running pod, no restart**: fired a second
    trigger ("a pack of bandits blocks the road ahead"). Resulting proposal carried real
    values — `packId: "dnd5e.actors24", actorId: "mmBandit00000000"` — no fabrication.
    Clicked Accept & Place: world Actor "Bandit" imported, 3 tokens placed on canvas
    (`quantity: 3` matched the card). Full path confirmed working end to end for the first
    time this session.
  - **Separate, smaller finding, not yet fixed:** the first card's `beats` array had
    malformed entries — a literal `> ` markdown blockquote marker embedded in the text, and
    one beat's sentence split mid-thought across two array elements
    (`"...ears swiveled toward "` / `"the road"`). Confirmed via the raw proposal object,
    not a render artifact. The second card's beats were clean. One sample each way — not
    enough to call a pattern, but worth watching across the real four sessions since it
    directly affects the "GM has to Edit" rate `beats` quality drives.
  - Pod left running at end of session (Foundry + agent server both still up); the stale
    first-card proposal (Wolf Pack, from before the fix) was clicked Skip to leave the
    panel queue clean rather than left to expire.
  - Committed this session's fix + this entry (`ad06d55`), not pushed.

- **2026-08-14 (session 11, continued)** — **More walkthrough rounds on the same running
  pod, still explicitly not one of the §9 four real sessions.** Fired 5 more triggers
  through the actual panel (not `resolve N`), varying GM response across all four card
  buttons. 6 cards total this round (1 superseded by its own reroll): 3 accept, 1 reroll
  (→ accepted its result), 1 skip, 1 already covered above. Beats stayed clean on all 5
  post-fix cards — the one malformed sample was pre-fix and hasn't repeated, though N is
  too small to call it a resolved pattern. All 3 accepted cards placed the exact right
  token count (Bandit×3, Wolf×3, Boar×5), confirming the packId/actorId fix holds across
  Wolf, Bandit, *and* Boar rows, not just the one row tested during the fix itself.
  - **New finding: the full live path is slower than the number STATUS.md has been
    tracking.** These 6 samples went trigger → `TRIGGER` frame → WS → agent →
    `runEncounterFlow` → `INTENT` back → Foundry writes the card → panel re-renders —
    the actual GM-facing path. Median **9816ms** (sorted 7698, 7992, 9762, 9870, 10732,
    12332). Every prior latency number in this file (session 9/10's ~6018–7800ms figures)
    came from the agent's local `resolve N` stdin driver, which calls `runEncounterFlow`
    directly and never touches the WebSocket, the RunPod network tunnel, or Foundry's own
    document-write path. **The two numbers are not measuring the same thing** — `resolve
    N` was always a lower bound on model-side latency, not an estimate of what a GM
    actually experiences. This session's number is the first one that is. Not directly
    comparable to the <5s kill criterion threshold either way without deciding which path
    the criterion is meant to measure — flagging rather than concluding.
  - Small sample (n=6, one AI's own judgment standing in for a GM's), one host (RunPod
    tunnel adds latency a GM running Foundry locally wouldn't pay) — do not treat 9816ms
    as the real-session number, treat it as evidence the local-only figure was
    optimistic and that the next session should measure latency through this same full
    path, on whatever host the real four sessions actually run on.
  - Pod left running, agent server left running. Card log for this round is in
    `getCardLog()` on the live pod, not reproduced here — this file records the summary,
    not the raw log.
  - **Next session:** the real four §9 sessions can now actually measure accept rate —
    this was the blocker. Latency measurement approach needs a decision: keep using
    `resolve N` for fast dev-loop iteration (fine for that) but stop reporting it as *the*
    latency number — the full-path number is what the kill criterion should be judged
    against. Session 10's stage-merging-vs-accept-and-move-on decision is still open and
    now arguably more urgent given the full-path number is further from <5s than the
    local-only one suggested.

## Known forward references in the spec

The spec's code snippets reference things built in later milestones. This is expected;
stub them, do not build them early. Tracked per-milestone in the briefings.

| Snippet in | References | Built in |
|---|---|---|
| `interceptor.js` (§4.4) | `Panel.queue()` | M3 |
| `interceptor.js` (§4.4) | `EXECUTORS` map | M7 (stub in M2) |
| `journal.js` (§4.5) | forwarding `notifyAgent()` over the socket | M5 |
| `eventbus.js` (§4.6) | a real sender behind `registerEventSender()` (currently unregistered; frames sit in the buffer) | M5 |
