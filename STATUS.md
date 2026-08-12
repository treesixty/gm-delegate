# Status

**Updated:** 2026-08-12

## Where we are

| | |
|---|---|
| Current milestone | **M3 — Panel. DONE, fully live-verified** (2026-08-12 — all items confirmed, including the 2 that were outstanding at end of previous session). M4 (EventBus) is next. |
| Code written | `module.json`, `scripts/main.js`, `scripts/journal.js`, `scripts/policy.js`, `scripts/interceptor.js`, `scripts/panel.js` (real `ApplicationV2` panel + pure logic layer), `templates/panel.hbs`, `styles/gm-delegate.css`, `scripts/executors/{index,test-m1}.js` (test-m1 is throwaway, delete in M7). |
| Test harness | **M0 landed 2026-08-10, executed 2026-08-10.** `npm install && npm test` — **79/79 passing** as of `v0.2.5` (node v24.14.1, npm 11.11.0). |
| Foundry version tested against | **v14.365** (Node build), self-hosted on a RunPod pod. **M1 Done-when checklist passed 2026-08-11. M3's live-Foundry pass ran 2026-08-12 across two sessions** — see decision log, found and fixed 6 real bugs vitest-only verification could not have caught, then confirmed all fixes live. M2 still vitest-only (no live-Foundry pass needed — nothing in it touches the DOM). |
| Dev Foundry host | RunPod pod `d90mhv7i5kvqyg` (US-NC-1), secure cloud, RTX 4090, `ghcr.io/felddy/foundryvtt:14`, 15GB persistent mount at `/data`. Connect: `https://d90mhv7i5kvqyg-30000.proxy.runpod.net`. **Stopped 2026-08-12** at end of session (disk persists, GPU billing paused). Replaces `1xxjyfays1a666` (also US-NC-1), which hit the same recurring GPU-availability `start-pod` failure and was terminated + recreated — see decision log. `module.json` v0.2.5 / GitHub release `v0.2.5` are installed and live-verified on this pod. |
| Model in use | None yet. Planned: Qwen3.5 9B @ Q4_K_M. |

## Milestones

| # | Milestone | State |
|---|---|---|
| 1 | Instrumentation + journal | **DONE — Done-when checklist passed 2026-08-11** |
| 2 | PolicyStore + Interceptor | **DONE — Done-when checklist passed 2026-08-11 (vitest only, no DOM involved)** |
| 3 | Panel | **DONE — live-Foundry Done-when checklist run 2026-08-12 across two sessions; 6 bugs found and fixed (v0.2.1–v0.2.5), all fixes live-confirmed.** |
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

## Known forward references in the spec

The spec's code snippets reference things built in later milestones. This is expected;
stub them, do not build them early. Tracked per-milestone in the briefings.

| Snippet in | References | Built in |
|---|---|---|
| `interceptor.js` (§4.4) | `Panel.queue()` | M3 |
| `interceptor.js` (§4.4) | `EXECUTORS` map | M7 (stub in M2) |
| `journal.js` (§4.5) | forwarding `notifyAgent()` over the socket | M5 |
