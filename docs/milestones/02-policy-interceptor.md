# M2 — PolicyStore + Interceptor

**Read:** spec §4.3 (PolicyStore), §4.4 (the Interceptor), §1.2, §1.4 (hard bans)
**Depends on:** M1 (`beginTransaction`, `commit`, `note`)

---

## Why this matters

**The Interceptor is the product.** Everything else is scaffolding around it.

The entire pitch of gm-delegate over a hosted bridge (§1.3) is that the permission gate
lives inside a module *you control*. A gate you don't own cannot enforce a policy the
model must not be able to talk its way past. So this file is the one that has to be right.

Every intent from the agent passes through it. The agent cannot bypass it, cannot see
around it, and cannot argue with it.

---

## Build

### 1. PolicyStore (`scripts/policy.js`)

Registered once, `scope: "world"`, `config: false` — edited via the Panel, not the
settings sheet.

```js
export const SUBSYSTEMS = ["random_encounters", "loot", "npc_voice",
                           "combat_tactics", "rules_lookup", "recap"];
export const STAGES = ["decide", "prompt"];   // NOT "narrate". See CLAUDE.md.
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

export function modeFor(subsystem, stage, actorId = null) {
  const p = game.settings.get("gm-delegate", "policy");
  if (p.sceneOverride === "all_off") return "off";
  const override = actorId && p.actorOverrides?.[actorId]?.[subsystem]?.[stage];
  return override ?? p.subsystems[subsystem]?.[stage] ?? "off";
}
```

Note the default-deny: `?? "off"`. An unknown subsystem is off, not on.

### 2. The Interceptor (`scripts/interceptor.js`)

Order is not negotiable. **Hard bans are checked first, unconditionally**, before policy
is even consulted.

```js
// intent = { id, subsystem, stage, action, args, provenance }
export async function handleIntent(intent) {
  const { subsystem, stage, action, args } = intent;

  if (isBanned(action, args)) return reject(intent, "HARD_BAN");   // 1. unconditional

  const mode = modeFor(subsystem, stage, args.actorId);            // 2. policy
  if (mode === "off") return reject(intent, "POLICY_OFF");

  if (mode === "propose") {                                        // 3. queue, don't run
    Panel.queue(intent);
    return { status: "QUEUED", id: intent.id };
  }

  return await execute(intent);                                    // 4. auto
}
```

`execute()` wraps the executor in an M1 transaction and rolls back on throw. See §4.4.

### 3. The executor allowlist (`scripts/executors/index.js`)

```js
export const EXECUTORS = {};   // empty in M2. Populated in M7.
```

**`EXECUTORS` is an explicit allowlist keyed by action name. If an action is not in the
map, it does not exist.** This is *why* the hard bans are cheap — you simply never write
an executor for `actor.hp.write`. The ban list is belt; the empty map is braces.

---

## Done when

- [ ] An intent for a subsystem set to `off` is **rejected with a structured error and
      never reaches Foundry.** Prove it by trying — write the test, run it, watch it fail
      closed.
- [ ] An intent whose action is on the hard-ban list is rejected **even when its subsystem
      is set to `auto`.** Policy cannot lift a ban.
- [ ] An intent with an action not in `EXECUTORS` is rejected `UNKNOWN_ACTION`.
- [ ] `propose` mode queues and executes **nothing**.
- [ ] A rejection is written to the journal with its reason.
- [ ] An executor that throws leaves state unchanged (transaction rolls back).

---

## Traps

**`Panel.queue()` does not exist yet** (M3). Stub it — `console.log` and an in-memory
array is fine. Do not build the Panel to satisfy this.

**`reject()` returns a structured error *to the agent*.** The agent must handle it. It
must **not** be able to retry its way around a policy. Do not add a retry, do not add a
"are you sure?", do not let a rejection become a negotiation.

**Do not add a bypass for testing.** Not a debug flag, not a `force: true` arg, not an
"admin" mode. The moment a bypass exists, it is the thing an agent finds. Test by setting
policy, not by evading it.

---

## Out of scope

The Panel UI (M3). The WebSocket (M5). Any real executor (M7). The model.
