// Spec §1.4. These bans are not policy settings and no mode can lift them.
// This file exists so the bans are enforced by CI instead of by whether an
// agent read section 1 of 11 before writing an executor.
//
// If you are here because this test failed: the fix is to delete the executor,
// not to edit the ban list.
//
// Shape note: executors/index.js registers each executor as a FUNCTION with a
// `touches` property attached at registration time. EXECUTORS[name] is that
// function, not a { run, touches } object. Assertions below match that.
//
// policy.js does not exist until M2, so its assertions live in
// tests/policy.test.js and are skipped until then. This file passes today.

import { describe, it, expect } from "vitest";
import { EXECUTORS } from "../scripts/executors/index.js";

const BANNED = [
  "actor.hp.write",        // the model never does arithmetic on hit points
  "document.delete",       // no destructive writes, ever
  "macro.execute",         // Foundry AI policy §5, and basic sanity
  "compendium.searchAll"   // Foundry AI policy §1.1
];

describe("hard bans (§1.4)", () => {
  it("registers no executor for any banned action", () => {
    const registered = Object.keys(EXECUTORS);
    for (const banned of BANNED) {
      expect(registered).not.toContain(banned);
    }
  });

  it("has no executor name that hints at a banned capability", () => {
    // The ban is on the capability, not on one spelling of it. Catches
    // actor.hp.set, document.destroy, eval.js, searchAllPacks, and friends.
    //
    // Deliberately NOT matched: test.actor.rename. It writes actor data, which
    // is fine there and only there, because the ban governs the agent's tool
    // surface and test-m1.js is never exposed to the agent (see its header).
    const forbidden =
      /(\bhp\b.*\b(write|set|apply|damage)\b)|delete|destroy|\beval\b|searchall|search_all/i;
    for (const name of Object.keys(EXECUTORS)) {
      expect(name, `executor "${name}" looks like a banned capability`).not.toMatch(forbidden);
    }
  });

  it("keeps the ban list identical to the one in the spec and the schema", async () => {
    // Three copies of a safety list will drift. This is what stops that.
    const fs = await import("node:fs/promises");
    const schema = JSON.parse(
      await fs.readFile(new URL("../contracts/envelope.schema.json", import.meta.url), "utf8")
    );
    const fromSchema = schema.$defs.intent.properties.action.not.enum;
    expect([...fromSchema].sort()).toEqual([...BANNED].sort());
  });
});

describe("executor contract (§4.5)", () => {
  it("exposes every executor as a callable", () => {
    const names = Object.keys(EXECUTORS);
    expect(names.length, "no executors registered at all").toBeGreaterThan(0);
    for (const name of names) {
      expect(typeof EXECUTORS[name], `executor "${name}" must be a function`).toBe("function");
    }
  });

  it("declares touches() on every executor", () => {
    // Forget this and undo silently does nothing. executors/index.js already
    // throws at registration; this is the regression guard for that guard.
    for (const name of Object.keys(EXECUTORS)) {
      expect(
        typeof EXECUTORS[name].touches,
        `executor "${name}" must have a touches() declaration`
      ).toBe("function");
    }
  });

  it("returns an array from touches()", () => {
    // beginTransaction() iterates the return value. A non-array silently
    // snapshots nothing, which is the same failure as omitting the declaration.
    for (const name of Object.keys(EXECUTORS)) {
      const out = EXECUTORS[name].touches({ actorUuid: "Actor.test", actorId: "test" });
      expect(Array.isArray(out), `${name}.touches() must return an array`).toBe(true);
    }
  });

  it("keeps the EXECUTORS map frozen", () => {
    // The allowlist is the enforcement surface. Nothing should be able to add
    // to it at runtime.
    expect(Object.isFrozen(EXECUTORS)).toBe(true);
  });
});
