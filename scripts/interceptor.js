// interceptor.js — the Interceptor (spec §4.4). This is the product. Every
// intent from the agent passes through here; the agent cannot bypass it,
// cannot see around it, and cannot argue with it.
//
// Order is NORMATIVE: hard bans, then policy, then propose-vs-auto. Do not
// reorder, do not add an early return.

import { modeFor, DEFAULT_POLICY } from "./policy.js";
import { beginTransaction, commit, note } from "./journal.js"; // named exports
import { EXECUTORS } from "./executors/index.js";
import { Panel } from "./panel.js"; // M3. Stubbed in M2; see panel.js.

// intent = { id, subsystem, stage, action, args, provenance }
export async function handleIntent(intent) {
  const { subsystem, stage, action, args } = intent;

  // 1. hard bans first, unconditionally
  if (isBanned(action)) {
    return reject(intent, "HARD_BAN");
  }

  // 2. policy
  const mode = modeFor(subsystem, stage, args.actorId);
  if (mode === "off") return reject(intent, "POLICY_OFF");

  // 3. propose → queue, do not execute
  if (mode === "propose") {
    Panel.queue(intent); // renders a card. Nothing happens yet.
    return { status: "QUEUED", id: intent.id };
  }

  // 4. auto → execute inside a transaction
  return await execute(intent);
}

export async function execute(intent) {
  const executor = EXECUTORS[intent.action];
  if (!executor) return reject(intent, "UNKNOWN_ACTION");

  const tx = await beginTransaction(intent); // snapshots pre-state
  try {
    const result = await executor(intent.args);
    await commit(tx, result);
    return { status: "EXECUTED", id: intent.id, result };
  } catch (err) {
    await tx.rollback();
    return reject(intent, `EXEC_FAILED: ${err.message}`);
  }
}

// Not a policy check: §1.4's bans are not a mode any policy can lift, so this
// checks the literal ban list, never the mutable world-settings policy copy.
function isBanned(action) {
  return DEFAULT_POLICY.hardBans.includes(action);
}

function reject(intent, reason) {
  note({ ...intent, status: "REJECTED", reason });
  return { status: "REJECTED", id: intent.id, reason };
}
