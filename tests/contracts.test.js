// Validates contracts/*.json as schemas, checks they enforce what the spec
// claims, and proves the enums have not drifted apart across files.
//
// The drift checks matter more than they look. The ban list, the subsystem
// list, and the tool names each exist in more than one place by necessity
// (schema + code + spec). Nothing keeps them equal except this file.

import { describe, it, expect, beforeAll } from "vitest";
import Ajv from "ajv/dist/2020.js";
import fs from "node:fs";

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), "utf8"));

const envelope = read("../contracts/envelope.schema.json");
const logEntry = read("../contracts/log-entry.schema.json");
const proposal = read("../contracts/proposal.schema.json");
const tools = read("../contracts/tools.json");

const ULID = "01J9ZQK8Y7M3N4P5R6S7T8V9WX";
let ajv, vEnvelope, vLog, vProposal, vPropose;

beforeAll(() => {
  ajv = new Ajv({ strict: false, allErrors: true });
  vEnvelope = ajv.compile(envelope);
  vLog = ajv.compile(logEntry);
  vProposal = ajv.compile(proposal);
  const pe = tools.find((t) => t.function.name === "propose_encounter");
  vPropose = ajv.compile(pe.function.parameters);
});

const intent = (over = {}) => ({
  v: 1,
  type: "INTENT",
  id: ULID,
  ts: 1752300000123,
  payload: {
    subsystem: "random_encounters",
    stage: "prompt",
    action: "encounter.propose",
    args: {},
    ...over
  }
});

describe("envelope (§5.6)", () => {
  it("accepts a well-formed INTENT", () => {
    expect(vEnvelope(intent()), JSON.stringify(vEnvelope.errors)).toBe(true);
  });

  it("refuses a banned action at the wire, before any code runs", () => {
    expect(vEnvelope(intent({ action: "actor.hp.write" }))).toBe(false);
  });

  it("refuses a narrate stage (§1.1 — it cannot exist)", () => {
    expect(vEnvelope(intent({ stage: "narrate" }))).toBe(false);
  });

  it("refuses a REJECTED result with no reason (§4.4 — a rejection is a reply)", () => {
    const frame = { v: 1, type: "RESULT", id: ULID, ts: 1, payload: { status: "REJECTED" } };
    expect(vEnvelope(frame)).toBe(false);
    frame.payload.reason = "POLICY_OFF";
    expect(vEnvelope(frame), JSON.stringify(vEnvelope.errors)).toBe(true);
  });

  it("refuses an unknown message type", () => {
    expect(vEnvelope({ v: 1, type: "NARRATE", id: ULID, ts: 1, payload: {} })).toBe(false);
  });

  it("refuses a version it does not speak", () => {
    expect(vEnvelope({ ...intent(), v: 2 })).toBe(false);
  });
});

describe("propose_encounter (§5.2 / §5.3)", () => {
  const base = {
    creatures: [{ name: "Wolves", quantity: 5, packId: "p", actorId: "a" }],
    beats: ["Sound first: whining.", "They circle. Pack tactics.", "Leader hangs back."],
    hook: "Something worse drove them out of the deep wood.",
    provenance: { tableId: "t", roll: 14, result: "Wolf Pack" }
  };

  it("accepts three beats", () => {
    expect(vPropose(base), JSON.stringify(vPropose.errors)).toBe(true);
  });

  it("refuses two beats and refuses six (§5.3 says 3 to 5)", () => {
    expect(vPropose({ ...base, beats: base.beats.slice(0, 2) })).toBe(false);
    expect(vPropose({ ...base, beats: [...base.beats, "a", "b", "c"] })).toBe(false);
  });

  it("refuses a paragraph as a hook", () => {
    expect(vPropose({ ...base, hook: "x".repeat(400) })).toBe(false);
  });

  it("refuses a creature with no pack or actor id (place_encounter could not import it)", () => {
    expect(vPropose({ ...base, creatures: [{ name: "Wolves", quantity: 5 }] })).toBe(false);
  });
});

describe("log entry (§6)", () => {
  it("accepts a minimal record", () => {
    const rec = {
      ts: 1752300000123,
      intent_id: ULID,
      subsystem: "random_encounters",
      trigger: { type: "gm_command", text: "three days through the Thornwood" },
      foundry_state: { scene: "abc", combat: false, selected: null },
      model: "qwen3.5-9b-q4km",
      latency_ms: { total: 1840 },
      gm_action: "edit"
    };
    expect(vLog(rec), JSON.stringify(vLog.errors)).toBe(true);
  });

  it("covers every card button plus expiry", () => {
    // §5.4 has four buttons; expiry is the fifth outcome. A missing label is a
    // hole in the §9 accept-rate denominator.
    expect(logEntry.properties.gm_action.enum.sort()).toEqual(
      ["accept", "edit", "expired", "reroll", "skip"]
    );
  });

  it("refuses an unknown gm_action", () => {
    expect(
      vLog({
        ts: 1,
        intent_id: ULID,
        subsystem: "loot",
        trigger: { type: "hook" },
        foundry_state: { scene: null, combat: false },
        model: "m",
        latency_ms: { total: 1 },
        gm_action: "narrated"
      })
    ).toBe(false);
  });
});

describe("proposal (§5.7)", () => {
  it("requires everything place_encounter needs, since it takes only an id", () => {
    const p = {
      id: ULID,
      created_ts: 1,
      expires_ts: 2,
      opened: false,
      subsystem: "random_encounters",
      creatures: [{ name: "Wolves", quantity: 5, packId: "p", actorId: "a" }],
      beats: ["a beat", "another beat", "a third beat"],
      hook: "a hook",
      provenance: { tableId: "t", roll: 14, result: "Wolf Pack" }
    };
    expect(vProposal(p), JSON.stringify(vProposal.errors)).toBe(true);
    const { opened, ...withoutOpened } = p;
    expect(vProposal(withoutOpened)).toBe(false); // skip vs expired needs it
  });
});

describe("no drift across files", () => {
  it("keeps journal.js card log keys identical to the log-entry schema", async () => {
    // logCard() throws on unknown fields. A key in the schema but not in
    // CARD_SCHEMA_KEYS is M7 crashing the first time it writes it.
    const src = fs.readFileSync(new URL("../scripts/journal.js", import.meta.url), "utf8");
    const block = src.match(/const CARD_SCHEMA_KEYS = \[([\s\S]*?)\];/)[1];
    const inCode = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const inSchema = Object.keys(logEntry.properties);
    expect([...inCode].sort()).toEqual([...inSchema].sort());
  });

  it("keeps exactly five tools (§5.2's ceiling)", () => {
    expect(tools).toHaveLength(5);
    expect(tools.map((t) => t.function.name)).toEqual([
      "list_roll_tables",
      "roll_on_table",
      "get_compendium_actor",
      "propose_encounter",
      "place_encounter"
    ]);
  });

  it("keeps every tool in OpenAI-compatible shape so it loads verbatim (§1.5)", () => {
    for (const t of tools) {
      expect(t.type).toBe("function");
      expect(t.function).toHaveProperty("name");
      expect(t.function).toHaveProperty("description");
      expect(t.function.parameters.type).toBe("object");
    }
  });

  it("keeps the subsystem enum identical in all three schemas", () => {
    const a = envelope.$defs.intent.properties.subsystem.enum;
    const b = logEntry.properties.subsystem.enum;
    const c = proposal.properties.subsystem.enum;
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });
});
