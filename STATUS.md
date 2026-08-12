# Status

**Updated:** 2026-08-10

## Where we are

| | |
|---|---|
| Current milestone | **M1 — Instrumentation + journal. DONE.** Done-when checklist (all 5 items) passed 2026-08-11 in Foundry. M2 (PolicyStore + Interceptor) is next. |
| Code written | `module.json`, `scripts/main.js`, `scripts/journal.js`, `scripts/executors/{index,test-m1}.js` (test-m1 is throwaway, delete in M7). |
| Test harness | **M0 landed 2026-08-10, executed 2026-08-10.** `npm install && npm test` — **51/51 passing** (node v24.14.1, npm 11.11.0). |
| Foundry version tested against | **v14.365** (Node build), self-hosted on a RunPod pod. **M1 Done-when checklist run and passed 2026-08-11** — see decision log entry below for per-item results. |
| Dev Foundry host | RunPod pod `ewsciq5y9ni2dr` (EU-RO-1; replaced `kcydos2bisfmhh` 2026-08-11 after a stuck host), secure cloud, RTX 4090, `ghcr.io/felddy/foundryvtt:14`, 15GB persistent mount at `/data`. Connect: `https://ewsciq5y9ni2dr-30000.proxy.runpod.net`. Currently **stopped** (disk persists, billing paused). **Stop, never terminate, between sessions** — see note below. |
| Model in use | None yet. Planned: Qwen3.5 9B @ Q4_K_M. |

## Milestones

| # | Milestone | State |
|---|---|---|
| 1 | Instrumentation + journal | **DONE — Done-when checklist passed 2026-08-11** |
| 2 | PolicyStore + Interceptor | not started |
| 3 | Panel | not started |
| 4 | EventBus | not started |
| 5 | Agent server + ModelClient | not started |
| 5a | ICM walk test (§5.5) — gates whether StageRunner replaces the Orchestrator | not started |
| 6 | EncounterAgent, 5 tools | not started |
| 7 | The card, with Edit | not started |
| 8–10 | Contingent. Do not plan them yet. | — |

Briefings: `docs/milestones/`.

## Open questions carried from the spec (§10)

- **Which model.** Decide from the M1 logs after four sessions, not from a leaderboard.
- **Midi-QOL v14 stability.** Gates v2 only. Irrelevant to M1–M7.
- **Does the table type in Foundry chat at all?** If dialogue is all voice but rolls
  happen in Foundry, `createChatMessage` still carries rolls and targets — which is most
  of the trigger signal. **Confirm this before M4.** It changes what EventBus is worth.

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
  - **Next session:** start M2 (PolicyStore + Interceptor). Dev pod `ewsciq5y9ni2dr` was left
    running after this session at $0.74/hr — stop it if not immediately continuing.

## Known forward references in the spec

The spec's code snippets reference things built in later milestones. This is expected;
stub them, do not build them early. Tracked per-milestone in the briefings.

| Snippet in | References | Built in |
|---|---|---|
| `interceptor.js` (§4.4) | `Panel.queue()` | M3 |
| `interceptor.js` (§4.4) | `EXECUTORS` map | M7 (stub in M2) |
| `journal.js` (§4.5) | forwarding `notifyAgent()` over the socket | M5 |
