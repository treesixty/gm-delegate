import { describe, it, expect } from "vitest";
import { buildEnvelope, validateEnvelope } from "../src/envelope.js";

describe("envelope.js (agent side, real ajv against contracts/envelope.schema.json)", () => {
  it("buildEnvelope produces a frame that validates", () => {
    const frame = buildEnvelope("INTENT", {
      subsystem: "random_encounters",
      stage: "prompt",
      action: "test.actor.rename",
      args: {},
    });
    expect(validateEnvelope(frame)).toEqual({ valid: true, errors: [] });
  });

  it("rejects a hard-banned action at the envelope level (§1.4, encoded in the schema's `not` clause)", () => {
    const frame = buildEnvelope("INTENT", {
      subsystem: "random_encounters",
      stage: "prompt",
      action: "actor.hp.write",
      args: {},
    });
    expect(validateEnvelope(frame).valid).toBe(false);
  });

  it("rejects a REJECTED result with no reason (§4.4 — a rejection is a reply, not a silence)", () => {
    const frame = { v: 1, type: "RESULT", id: buildEnvelope("HELLO", {}).id, ts: Date.now(), payload: { status: "REJECTED" } };
    expect(validateEnvelope(frame).valid).toBe(false);
  });

  it("rejects an unknown type and a version mismatch", () => {
    expect(validateEnvelope({ v: 1, type: "NARRATE", id: buildEnvelope("HELLO", {}).id, ts: 1, payload: {} }).valid).toBe(
      false
    );
    const frame = buildEnvelope("HELLO", { v: 1, role: "agent" });
    expect(validateEnvelope({ ...frame, v: 2 }).valid).toBe(false);
  });
});
