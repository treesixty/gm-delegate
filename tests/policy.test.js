// Spec §4.3. policy.js exists as of M2 — these are the assertions
// tests/hardbans.test.js said would live here once it did.

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
import { resetFoundry } from "./setup.js";
import {
  SUBSYSTEMS,
  STAGES,
  MODES,
  DEFAULT_POLICY,
  registerPolicySettings,
  getPolicy,
  modeFor,
} from "../scripts/policy.js";

const readSchema = () =>
  fs
    .readFile(new URL("../contracts/envelope.schema.json", import.meta.url), "utf8")
    .then(JSON.parse);

beforeEach(() => {
  resetFoundry();
  registerPolicySettings();
});

describe("policy constants (§4.3) do not drift from the wire schema", () => {
  it("keeps SUBSYSTEMS identical to envelope.schema.json's enum", async () => {
    const schema = await readSchema();
    expect(SUBSYSTEMS).toEqual(schema.$defs.intent.properties.subsystem.enum);
  });

  it("keeps STAGES identical to the schema's enum, and excludes narrate (§1.1)", async () => {
    const schema = await readSchema();
    expect(STAGES).toEqual(schema.$defs.intent.properties.stage.enum);
    expect(STAGES).not.toContain("narrate");
  });

  it("keeps hardBans identical to the schema's banned-action list", async () => {
    const schema = await readSchema();
    const fromSchema = schema.$defs.intent.properties.action.not.enum;
    expect([...DEFAULT_POLICY.hardBans].sort()).toEqual([...fromSchema].sort());
  });

  it("has exactly three modes: off, propose, auto", () => {
    expect(MODES).toEqual(["off", "propose", "auto"]);
  });

  it("gives every subsystem in SUBSYSTEMS a default policy entry, and no others", () => {
    expect(Object.keys(DEFAULT_POLICY.subsystems).sort()).toEqual([...SUBSYSTEMS].sort());
  });
});

describe("modeFor (§4.3)", () => {
  it("default-denies an unknown subsystem", () => {
    expect(modeFor("nonexistent_subsystem", "decide")).toBe("off");
  });

  it("returns the configured mode for a known subsystem/stage", () => {
    expect(modeFor("random_encounters", "decide")).toBe("propose");
    expect(modeFor("random_encounters", "prompt")).toBe("auto");
  });

  it("returns off for a subsystem/stage explicitly set to off", () => {
    expect(modeFor("loot", "decide")).toBe("off");
  });

  it("sceneOverride 'all_off' forces off regardless of subsystem policy", async () => {
    const p = getPolicy();
    await game.settings.set("gm-delegate", "policy", { ...p, sceneOverride: "all_off" });
    expect(modeFor("random_encounters", "prompt")).toBe("off");
  });

  it("an actorOverride wins over the subsystem default", async () => {
    const p = getPolicy();
    await game.settings.set("gm-delegate", "policy", {
      ...p,
      actorOverrides: { "Actor.abc": { random_encounters: { prompt: "off" } } },
    });
    expect(modeFor("random_encounters", "prompt", "Actor.abc")).toBe("off");
    expect(modeFor("random_encounters", "prompt", "Actor.xyz")).toBe("auto");
  });
});
