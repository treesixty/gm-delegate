// Spec §4.4. The M2 Done-when checklist, one behavior per test. Uses the
// same mocked game/canvas globals as the rest of the suite (tests/setup.js)
// and M6's real roll_on_table executor as a stand-in auto-mode action — no
// live Foundry needed, matching AGENTS.md's "outside Foundry: vitest against
// mocked globals" guidance. M1's test-m1.js executors (test.actor.rename/
// test.token.place) served this role through M6; deleted in M7 per the
// 2026-07-12 decision recorded in STATUS.md ("delete test-m1.js in M7").

import { describe, it, expect, beforeEach } from "vitest";
import { resetFoundry } from "./setup.js";
import { registerJournalSettings, getJournal } from "../scripts/journal.js";
import { registerPolicySettings } from "../scripts/policy.js";
import { handleIntent } from "../scripts/interceptor.js";
import { Panel } from "../scripts/panel.js";

// note() inside interceptor.js's reject() is fire-and-forget by design (spec
// §4.4 NORMATIVE block — rejection replies must not wait on a journal
// write), so journal assertions need a tick for that write to land.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const baseIntent = (over = {}) => ({
  id: "test-id",
  subsystem: "random_encounters",
  stage: "prompt", // DEFAULT_POLICY: random_encounters.prompt = "auto"
  action: "roll_on_table",
  args: { tableId: "RollTable.abc" },
  ...over,
});

beforeEach(() => {
  resetFoundry();
  registerJournalSettings();
  registerPolicySettings();
  Panel.queued.length = 0;
});

describe("Interceptor (§4.4) — Done when", () => {
  it("rejects an intent for a subsystem set to off, and never reaches Foundry", async () => {
    const intent = baseIntent({ subsystem: "loot", stage: "decide" }); // default: off
    const res = await handleIntent(intent);
    expect(res).toEqual({ status: "REJECTED", id: intent.id, reason: "POLICY_OFF" });
    expect(canvas.tokens.storeHistory).not.toHaveBeenCalled();
  });

  it("rejects a hard-banned action even when its subsystem is set to auto", async () => {
    const intent = baseIntent({ action: "actor.hp.write" }); // subsystem/stage default to auto
    const res = await handleIntent(intent);
    expect(res).toEqual({ status: "REJECTED", id: intent.id, reason: "HARD_BAN" });
  });

  it("rejects an action not in EXECUTORS with UNKNOWN_ACTION", async () => {
    const intent = baseIntent({ action: "no.such.action" });
    const res = await handleIntent(intent);
    expect(res).toEqual({ status: "REJECTED", id: intent.id, reason: "UNKNOWN_ACTION" });
  });

  it("propose mode queues the intent and executes nothing", async () => {
    const intent = baseIntent({ stage: "decide" }); // default: random_encounters.decide = propose
    const res = await handleIntent(intent);
    expect(res).toEqual({ status: "QUEUED", id: intent.id });
    expect(Panel.queued).toEqual([intent]);
    expect(canvas.tokens.storeHistory).not.toHaveBeenCalled();
    await flush();
    expect(getJournal().some((e) => e.status === "EXECUTED")).toBe(false);
  });

  it("writes a rejection to the journal with its reason", async () => {
    const intent = baseIntent({ action: "actor.hp.write" });
    await handleIntent(intent);
    await flush();
    const entry = getJournal().find((e) => e.id === intent.id);
    expect(entry).toMatchObject({ status: "REJECTED", reason: "HARD_BAN" });
  });

  it("leaves state unchanged when an executor throws (transaction rolls back)", async () => {
    // fromUuid mock always resolves null (tests/setup.js default), so
    // roll_on_table's "no table at" guard throws — exercising the rollback
    // path without a live Foundry doc.
    const intent = baseIntent();
    const res = await handleIntent(intent);
    expect(res.status).toBe("REJECTED");
    expect(res.reason).toMatch(/^EXEC_FAILED: /);
    await flush();
    expect(getJournal().some((e) => e.status === "EXECUTED")).toBe(false);
  });
});
