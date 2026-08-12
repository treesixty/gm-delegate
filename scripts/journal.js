// journal.js — the §6 card log and the transaction journal + undo (spec §4.5).
//
// Both stores are append-only world settings. Entries are never mutated after
// append, with one exception: reverted transactions are *marked* reverted,
// never deleted.
//
// Named exports only. §4.4's `Journal.note(...)` namespace call is resolved
// here as the named export `note()` (decision recorded in STATUS.md).

import { EXECUTORS } from "./executors/index.js";

const MODULE_ID = "gm-delegate";
const TX_KEY = "transactionJournal";
const CARD_KEY = "cardLog";

export function registerJournalSettings() {
  game.settings.register(MODULE_ID, TX_KEY, {
    scope: "world",
    config: false,
    type: Array,
    default: [],
  });
  game.settings.register(MODULE_ID, CARD_KEY, {
    scope: "world",
    config: false,
    type: Array,
    default: [],
  });
}

/* -------------------------------------------- */
/*  The §6 card log                             */
/* -------------------------------------------- */

// The full schema from day one. Fields M1 cannot fill yet (model, latency_ms,
// provenance, card_text) stay null — the point is that M6/M7 have a slot to
// write into. Timestamps are Date.now() milliseconds throughout.
//
// MUST stay identical to Object.keys(contracts/log-entry.schema.json.properties).
// logCard() throws on unknown fields, so a key missing here is not a silent gap:
// it is M7 crashing the first time it writes intent_id. Guarded by
// tests/contracts.test.js ("card log keys match the schema").
const CARD_SCHEMA_KEYS = [
  "ts",
  "intent_id",     // ULID from the §5.6 envelope; joins log to wire trace
  "proposal_id",   // §5.7; present whenever a card was rendered
  "subsystem",
  "mode",          // off | propose | auto — an accept under auto is a different signal
  "trigger",
  "foundry_state",
  "entity_link",
  "provenance",
  "model",
  "latency_ms",
  "tool_calls",    // §9's >95% tool-call validity cannot be computed without this
  "card_text",
  "gm_action",
  "gm_edit_diff",
  "rejected",      // §4.4 refusals; M2 is proved by finding these in the log
];

export async function logCard(record) {
  const unknown = Object.keys(record).filter((k) => !CARD_SCHEMA_KEYS.includes(k));
  if (unknown.length) {
    throw new Error(`logCard: fields not in the §6 schema: ${unknown.join(", ")}`);
  }
  const entry = {};
  for (const k of CARD_SCHEMA_KEYS) entry[k] = record[k] ?? null;
  entry.ts ??= Date.now();
  const log = foundry.utils.deepClone(getCardLog());
  log.push(entry);
  await game.settings.set(MODULE_ID, CARD_KEY, log);
  return entry;
}

export function getCardLog() {
  return game.settings.get(MODULE_ID, CARD_KEY);
}

/* -------------------------------------------- */
/*  The transaction journal                     */
/* -------------------------------------------- */

export function getJournal() {
  return game.settings.get(MODULE_ID, TX_KEY);
}

async function persistJournal(journal) {
  await game.settings.set(MODULE_ID, TX_KEY, journal);
}

async function appendJournal(entry) {
  const journal = foundry.utils.deepClone(getJournal());
  journal.push(entry);
  await persistJournal(journal);
  return entry;
}

// Each executor must export touches(args). No declaration, no transaction —
// a missing declaration would make undo silently do nothing.
export function predictTouchedDocuments(intent) {
  const executor = EXECUTORS[intent.action];
  if (!executor) {
    throw new Error(`predictTouchedDocuments: no executor for action "${intent.action}"`);
  }
  if (typeof executor.touches !== "function") {
    throw new Error(
      `Executor "${intent.action}" has no touches() declaration. ` +
        `Undo would silently do nothing. Declare it.`
    );
  }
  return executor.touches(intent.args);
}

// intent = { id, subsystem, stage, action, args, provenance }
export async function beginTransaction(intent) {
  const touched = predictTouchedDocuments(intent);
  const snapshot = {};
  for (const uuid of touched) {
    const doc = await fromUuid(uuid);
    snapshot[uuid] = doc?.toObject() ?? null; // null = didn't exist
  }
  return {
    id: intent.id,
    intent,
    snapshot,
    ts: Date.now(),
    chatMessageIds: [],
    rollback: () => restore(snapshot),
  };
}

// result.placeables = { layer, docs } when the executor created placeables.
// Those get Foundry's native layer history (Layer A); everything else relies
// on the snapshot (Layer B).
export async function commit(tx, result) {
  let placeables = null;
  if (result?.placeables) {
    const { layer, docs } = result.placeables;
    // v14 core may already record history on a programmatic
    // createEmbeddedDocuments; if it does, a second entry here means one
    // undoHistory() pop leaves half the placement behind. So only record if
    // the top of the stack is not already this exact create. Field names
    // type/data confirmed against CanvasHistoryEvent, spec §0 2026-08-11.
    const hist = canvas[layer].history;
    const top = hist?.at(-1);
    const ids = docs.map((d) => d._id).sort();
    const already =
      top?.type === "create" &&
      Array.isArray(top.data) &&
      top.data.length === docs.length &&
      JSON.stringify(top.data.map((d) => d._id).sort()) === JSON.stringify(ids);
    if (!already) canvas[layer].storeHistory("create", docs, {}); // 3-arg in v14
    placeables = { layer };
  }
  return appendJournal({
    id: tx.id,
    ts: tx.ts,
    intent: tx.intent,
    snapshot: tx.snapshot,
    placeables,
    chatMessageIds: tx.chatMessageIds,
    status: "EXECUTED",
    reverted: false,
    revertedAt: null,
  });
}

// Append-only note for non-executed outcomes (rejections, etc. — spec §4.4).
export async function note(entry) {
  return appendJournal({ ts: Date.now(), reverted: false, revertedAt: null, ...entry });
}

/* -------------------------------------------- */
/*  Undo                                        */
/* -------------------------------------------- */

async function restore(snapshot) {
  for (const [uuid, data] of Object.entries(snapshot)) {
    const doc = await fromUuid(uuid);
    if (data === null) {
      // Didn't exist before the transaction — remove it if it does now.
      if (doc) await doc.delete();
      continue;
    }
    if (!doc) {
      // Nothing in v1 deletes documents, so a vanished doc means something
      // outside the module removed it. Re-creation is not implemented.
      throw new Error(`restore: ${uuid} no longer exists; cannot restore its snapshot.`);
    }
    await doc.update(data, { diff: false, recursive: false });
  }
}

// Undo is a stack, not a single step — you will not notice a bad auto-action
// for thirty seconds.
export async function undoLast(n = 1) {
  const journal = foundry.utils.deepClone(getJournal());
  const targets = journal
    .filter((e) => e.status === "EXECUTED" && !e.reverted)
    .slice(-n)
    .reverse();
  for (const e of targets) {
    // Layer A: placeables created by this transaction sit on top of the
    // layer's history stack. Manual canvas edits made since would be popped
    // instead — accepted v1 limitation, same class as §4.5 limit 3.
    if (e.placeables) await canvas[e.placeables.layer].undoHistory();
    await restore(e.snapshot);
    if (e.chatMessageIds?.length) await ChatMessage.deleteDocuments(e.chatMessageIds);
    e.reverted = true;
    e.revertedAt = Date.now();
  }
  await persistJournal(journal);
  notifyAgent({ type: "UNDONE", ids: targets.map((e) => e.id) });
  return targets.map((e) => e.id);
}

// TODO(M5): forward over the socket as Agent.notify — the agent must not
// re-narrate undone actions. Console-only until the agent server exists.
function notifyAgent(payload) {
  console.log(`${MODULE_ID} |`, payload);
}
