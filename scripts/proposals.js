// proposals.js — the proposal store (spec §5.7). place_encounter(proposalId)
// and [Accept & Place] both dereference this; §7.4's "let drafts rot" plus
// §6's "card expired unopened -> negative" both need the expiry this file
// owns.
//
// In-memory only, not world settings — a proposal is a live draft with a
// 15-minute TTL, not a durable record (the durable record is the §6 card log
// entry logCard() writes once the proposal resolves). Same "ephemeral local
// state" shape as panel.js's `queued` array.
//
// Signatures match the spec §5.7 CONTRACT exactly (put/get/markOpened);
// bodies are this file's own.

import { ulid } from "./ulid.js";

const TTL_MS = 15 * 60 * 1000; // one scene's worth (§5.7). Tune from §6 logs, not from taste.

// journal.js's logCard is registered here rather than imported directly:
// journal.js imports executors/index.js (predictTouchedDocuments), which
// imports encounter.js, which imports this file — a static import of
// journal.js here would close that into a cycle. Same "callback set at
// init" shape journal.js's own notifyAgent()/panel.js's
// registerPolicyRevokedSender already use to stay cycle-free. Registered
// from main.js's ready hook.
let cardLogger = null;

export function registerCardLogger(fn) {
  cardLogger = fn;
}

// id -> { proposal, ts, opened, cardLogContext }. `proposal` is the
// proposal.schema.json-shaped record; `cardLogContext` is sibling metadata
// (trigger text, foundry_state, model, the prompt->card latency) captured at
// creation time so whichever gm_action eventually fires (accept/edit/reroll/
// skip/expired, panel.js) can write a complete §6 card-log row without
// having to reconstruct "what was true when this card was queued" later.
const store = new Map();

// proposal: { subsystem, creatures, beats, hook, provenance, intent_id?, scene_id? }
// (everything proposal.schema.json needs except id/created_ts/expires_ts/opened,
// which this function fills in). Returns the complete stored record.
export function put(proposal, cardLogContext = {}) {
  const id = ulid();
  const created_ts = Date.now();
  const record = {
    id,
    created_ts,
    expires_ts: created_ts + TTL_MS,
    opened: false,
    ...proposal,
  };
  store.set(id, { proposal: record, ts: created_ts, opened: false, cardLogContext });
  return record;
}

// null if absent or expired (§5.7 CONTRACT). A lazy read never logs or
// deletes — that is sweepExpired()'s job, so "the card expired" stays a
// single, deliberate event rather than a side effect of whoever happens to
// read next.
export function get(id) {
  const entry = store.get(id);
  if (!entry) return null;
  if (Date.now() > entry.proposal.expires_ts) return null;
  return entry.proposal;
}

// Internal: panel.js's accept/edit/reroll/skip handlers need the sibling
// cardLogContext too, not just the schema-shaped proposal get() returns.
export function getEntry(id) {
  const entry = store.get(id);
  if (!entry) return null;
  if (Date.now() > entry.proposal.expires_ts) return null;
  return entry;
}

// Distinguishes "skip" (opened, then refused) from "expired" (never seen)
// (§5.7). No-op if the id is absent or already expired.
export function markOpened(id) {
  const entry = store.get(id);
  if (!entry || Date.now() > entry.proposal.expires_ts) return;
  entry.opened = true;
  entry.proposal.opened = true;
}

// place_encounter's single-use consumption: remove the proposal so a second
// place_encounter(proposalId) call (replay, double-click) finds nothing.
export function remove(id) {
  store.delete(id);
}

// Called on an interval from main.js. Expiry is a labelling event, not just
// cleanup (§5.7): an unopened proposal aging out is the cheapest negative
// training signal in the system, and silently deleting it throws that away.
export async function sweepExpired() {
  const now = Date.now();
  const expired = [...store.entries()].filter(([, e]) => now > e.proposal.expires_ts && !e.opened);
  for (const [id, entry] of expired) {
    const { proposal, cardLogContext } = entry;
    const record = {
      intent_id: proposal.intent_id ?? null,
      proposal_id: proposal.id,
      subsystem: proposal.subsystem,
      mode: "propose",
      trigger: cardLogContext.trigger ?? null,
      foundry_state: cardLogContext.foundry_state ?? { scene: null, combat: false, selected: null },
      provenance: proposal.provenance ?? null,
      model: cardLogContext.model ?? null,
      latency_ms: cardLogContext.latency_ms ?? { total: 0 },
      gm_action: "expired",
    };
    if (cardLogger) {
      await cardLogger(record).catch((err) => console.error("gm-delegate | proposals | expired logCard failed", err));
    } else {
      console.error("gm-delegate | proposals | no card logger registered, dropping expired label", record);
    }
    store.delete(id);
  }
  // Also drop opened-but-otherwise-expired entries (skip/accept/reroll
  // already logged their own gm_action via panel.js before this can run;
  // this just reclaims memory for the never-consumed remainder, e.g. an
  // opened card the GM walked away from without clicking anything).
  for (const [id, entry] of store) {
    if (now > entry.proposal.expires_ts) store.delete(id);
  }
  return expired.map(([id]) => id);
}

export function _resetForTests() {
  store.clear();
}
