// envelope.js — wire envelope helpers, agent side (spec §5.6).
//
// Unlike the module's scripts/envelope.js (hand-rolled — no bundler for the
// browser), this is a real Node package with normal `node_modules`
// resolution, so it validates against contracts/envelope.schema.json with
// actual ajv rather than a hand-written parity-tested subset. Import from
// "ajv/dist/2020.js", not the bare "ajv" package export — that's ajv v8's
// draft-07 validator and throws "no schema with key or ref" against this
// schema's `"$schema": ".../2020-12/schema"` (same pitfall
// tests/contracts.test.js on the module side already hit and documented,
// STATUS.md 2026-08-10).

import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ulid } from "./ulid.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, "..", "..", "contracts", "envelope.schema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));

const ajv = new Ajv2020({ strict: false, allErrors: true });
const validateFrame = ajv.compile(schema);

export function validateEnvelope(frame) {
  const valid = validateFrame(frame);
  return { valid, errors: valid ? [] : validateFrame.errors };
}

// New outbound frame — generates a fresh id. Used for HELLO and INTENT (the
// only two types the agent originates in v1's type table, §5.6).
export function buildEnvelope(type, payload) {
  return { v: 1, type, id: ulid(), ts: Date.now(), payload };
}
