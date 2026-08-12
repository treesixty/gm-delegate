// envelope.js — wire envelope helpers for socket.js (spec §5.6).
//
// Hand-rolled, not ajv: this file runs in the browser with no bundler
// (module.json declares only esmodules, no build step), so the npm `ajv`
// package gm-delegate-agent uses (a real Node package, real bundler-free
// `require`/`import` resolution) is not importable here. Same
// hand-written-plus-parity-tested shape journal.js's CARD_SCHEMA_KEYS already
// uses for the identical reason — tests/envelope.test.js keeps this in sync
// with contracts/envelope.schema.json rather than trusting either by hand.
//
// Scope: this validates the envelope (v/type/id/ts/payload), not the deep
// per-type payload shape. The module already defends itself against a
// malformed INTENT payload at the point that matters (interceptor.js's
// UNKNOWN_ACTION / policy.js's default-deny), so duplicating full JSON
// Schema validation here would be re-implementing ajv by hand for no added
// safety. The agent side validates inbound RESULT/EVENT/POLICY_REVOKED/
// UNDONE payload shape with real ajv (gm-delegate-agent/src/envelope.js).

import { ulid } from "./ulid.js";

export const ENVELOPE_TYPES = ["HELLO", "INTENT", "RESULT", "EVENT", "POLICY_REVOKED", "UNDONE"];

const ID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

// New outbound frame — generates a fresh id. Used for HELLO, INTENT, EVENT,
// POLICY_REVOKED, UNDONE (every type except a RESULT replying to an INTENT).
export function buildEnvelope(type, payload) {
  return { v: 1, type, id: ulid(), ts: Date.now(), payload };
}

// A RESULT must echo the id of the INTENT it answers (§5.6's only
// correlation mechanism) rather than generate a new one.
export function buildReply(type, id, payload) {
  return { v: 1, type, id, ts: Date.now(), payload };
}

export function validateEnvelope(frame) {
  const errors = [];
  if (frame?.v !== 1) errors.push("v must be 1");
  if (!ENVELOPE_TYPES.includes(frame?.type)) errors.push(`unknown type: ${frame?.type}`);
  if (typeof frame?.id !== "string" || !ID_RE.test(frame.id)) errors.push("invalid id");
  if (typeof frame?.ts !== "number") errors.push("invalid ts");
  if (typeof frame?.payload !== "object" || frame.payload === null || Array.isArray(frame.payload)) {
    errors.push("invalid payload");
  }
  return { valid: errors.length === 0, errors };
}
