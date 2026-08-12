// scripts/envelope.js (spec §5.6). Covers the hand-rolled build/validate
// helpers socket.js uses, plus a drift check against
// contracts/envelope.schema.json — the same "keep code and contract in sync
// via a test" shape tests/contracts.test.js already uses for
// CARD_SCHEMA_KEYS, since this file cannot use ajv directly (see its header
// comment: no bundler for the browser side).

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { buildEnvelope, buildReply, validateEnvelope, ENVELOPE_TYPES } from "../scripts/envelope.js";

const schema = JSON.parse(fs.readFileSync(new URL("../contracts/envelope.schema.json", import.meta.url), "utf8"));

describe("envelope.js — no drift against contracts/envelope.schema.json", () => {
  it("keeps ENVELOPE_TYPES identical to the schema's type enum", () => {
    expect([...ENVELOPE_TYPES].sort()).toEqual([...schema.properties.type.enum].sort());
  });
});

describe("buildEnvelope / buildReply", () => {
  it("buildEnvelope stamps v:1, a fresh ULID, ts, and the given type/payload", () => {
    const frame = buildEnvelope("EVENT", { event: "token.selected", data: {} });
    expect(frame.v).toBe(1);
    expect(frame.type).toBe("EVENT");
    expect(frame.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(typeof frame.ts).toBe("number");
    expect(frame.payload).toEqual({ event: "token.selected", data: {} });
  });

  it("two calls generate different ids", () => {
    const a = buildEnvelope("EVENT", {});
    const b = buildEnvelope("EVENT", {});
    expect(a.id).not.toBe(b.id);
  });

  it("buildReply echoes the given id rather than generating one (§5.6 correlation)", () => {
    const id = "01J9ZQK8Y7M3N4P5R6S7T8V9WX";
    const frame = buildReply("RESULT", id, { status: "EXECUTED" });
    expect(frame.id).toBe(id);
    expect(frame.type).toBe("RESULT");
  });
});

describe("validateEnvelope", () => {
  const valid = () => buildEnvelope("HELLO", { v: 1, role: "module" });

  it("accepts a well-formed frame", () => {
    expect(validateEnvelope(valid())).toEqual({ valid: true, errors: [] });
  });

  it("rejects a version other than 1", () => {
    expect(validateEnvelope({ ...valid(), v: 2 }).valid).toBe(false);
  });

  it("rejects an unknown type", () => {
    expect(validateEnvelope({ ...valid(), type: "NARRATE" }).valid).toBe(false);
  });

  it("rejects a malformed id", () => {
    expect(validateEnvelope({ ...valid(), id: "not-a-ulid" }).valid).toBe(false);
  });

  it("rejects a non-numeric ts", () => {
    expect(validateEnvelope({ ...valid(), ts: "123" }).valid).toBe(false);
  });

  it("rejects a missing or non-object payload", () => {
    expect(validateEnvelope({ ...valid(), payload: null }).valid).toBe(false);
    expect(validateEnvelope({ ...valid(), payload: [] }).valid).toBe(false);
    const { payload, ...noPayload } = valid();
    expect(validateEnvelope(noPayload).valid).toBe(false);
  });
});
