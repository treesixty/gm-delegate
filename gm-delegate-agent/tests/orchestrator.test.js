// orchestrator.js — spec §5.6's agent-side correlation, POLICY_REVOKED,
// EVENT buffer, and UNDONE handling. Drives handleFrame() directly (the
// shape server.js hands it after envelope validation) against a fake
// connection object exposing only what orchestrator.js actually calls
// (send()), same minimalism the module side's tests/setup.js uses for
// game/canvas.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Orchestrator } from "../src/orchestrator.js";

function fakeConn() {
  return { sent: [], send(data) { this.sent.push(JSON.parse(data)); } };
}

let orchestrator;

beforeEach(() => {
  orchestrator = new Orchestrator();
});

describe("Orchestrator — INTENT/RESULT correlation (§5.6 Done when)", () => {
  it("rejects sendIntent when no module is connected", async () => {
    await expect(
      orchestrator.sendIntent({ subsystem: "random_encounters", stage: "prompt", action: "x", args: {} })
    ).rejects.toThrow(/no module connected/);
  });

  it("round-trips a hardcoded intent: sends an INTENT frame, resolves on the matching RESULT", async () => {
    const conn = fakeConn();
    orchestrator.attach(conn);

    const pending = orchestrator.sendIntent({
      subsystem: "random_encounters",
      stage: "prompt",
      action: "test.actor.rename",
      args: { actorUuid: "Actor.abc", name: "Renamed" },
    });

    expect(conn.sent).toHaveLength(1);
    const sentFrame = conn.sent[0];
    expect(sentFrame).toMatchObject({
      v: 1,
      type: "INTENT",
      payload: { subsystem: "random_encounters", stage: "prompt", action: "test.actor.rename" },
    });

    orchestrator.handleFrame({ v: 1, type: "RESULT", id: sentFrame.id, ts: Date.now(), payload: { status: "EXECUTED", result: { renamed: "Actor.abc" } } });

    await expect(pending).resolves.toEqual({ status: "EXECUTED", result: { renamed: "Actor.abc" } });
  });

  it("round-trips a rejected intent too — REJECTED resolves, it does not throw", async () => {
    const conn = fakeConn();
    orchestrator.attach(conn);
    const pending = orchestrator.sendIntent({ subsystem: "random_encounters", stage: "prompt", action: "actor.hp.write", args: {} });
    const sentFrame = conn.sent[0];

    orchestrator.handleFrame({ v: 1, type: "RESULT", id: sentFrame.id, ts: Date.now(), payload: { status: "REJECTED", reason: "HARD_BAN" } });

    await expect(pending).resolves.toEqual({ status: "REJECTED", reason: "HARD_BAN" });
  });

  it("times out a pending intent if no RESULT ever arrives", async () => {
    vi.useFakeTimers();
    const conn = fakeConn();
    orchestrator.attach(conn);
    const pending = orchestrator.sendIntent({ subsystem: "random_encounters", stage: "prompt", action: "x", args: {} });
    const assertion = expect(pending).rejects.toThrow(/timed out/);
    vi.advanceTimersByTime(5000);
    await assertion;
    vi.useRealTimers();
  });

  it("detach() rejects in-flight intents rather than replaying them on reconnect (§5.6 rule 4)", async () => {
    const conn = fakeConn();
    orchestrator.attach(conn);
    const pending = orchestrator.sendIntent({ subsystem: "random_encounters", stage: "prompt", action: "x", args: {} });

    orchestrator.detach(conn);

    await expect(pending).rejects.toThrow(/disconnected/);
    expect(orchestrator.connected).toBe(false);
  });

  it("a RESULT for an unknown/already-settled id is logged, not thrown", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      orchestrator.handleFrame({ v: 1, type: "RESULT", id: "01J9ZQK8Y7M3N4P5R6S7T8V9WX", ts: 1, payload: { status: "EXECUTED" } })
    ).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("Orchestrator — POLICY_REVOKED (§5.6 Done when, RECLAIM reaching the agent)", () => {
  it("stops emitting once POLICY_REVOKED arrives, and a HELLO round-trip (clearRevoked) restores it", async () => {
    const conn = fakeConn();
    orchestrator.attach(conn);

    orchestrator.handleFrame({ v: 1, type: "POLICY_REVOKED", id: "01J9ZQK8Y7M3N4P5R6S7T8V9WX", ts: 1, payload: { scope: "all_off", ts: 1 } });
    expect(orchestrator.revoked).toBe(true);

    await expect(
      orchestrator.sendIntent({ subsystem: "random_encounters", stage: "prompt", action: "x", args: {} })
    ).rejects.toThrow(/POLICY_REVOKED/);

    orchestrator.clearRevoked();
    expect(orchestrator.revoked).toBe(false);
    conn.sent.length = 0;
    const pending = orchestrator.sendIntent({ subsystem: "random_encounters", stage: "prompt", action: "x", args: {} });
    // Proceeding past the revoked check means the frame actually went out —
    // that's the observable proof clearRevoked() restored emission, without
    // waiting on the real 5s intent timeout.
    expect(conn.sent).toHaveLength(1);
    orchestrator.handleFrame({ v: 1, type: "RESULT", id: conn.sent[0].id, ts: 1, payload: { status: "EXECUTED" } });
    await expect(pending).resolves.toEqual({ status: "EXECUTED" });
  });
});

describe("Orchestrator — EVENT buffer and UNDONE", () => {
  it("buffers EVENT payloads, capped at 128, drop-oldest", () => {
    for (let i = 0; i < 130; i++) {
      orchestrator.handleFrame({ v: 1, type: "EVENT", id: "01J9ZQK8Y7M3N4P5R6S7T8V9WX", ts: 1, payload: { event: "token.selected", data: { i } } });
    }
    const events = orchestrator.getEvents();
    expect(events).toHaveLength(128);
    expect(events[0].data.i).toBe(2);
    expect(events.at(-1).data.i).toBe(129);
  });

  it("logs UNDONE without throwing (agent must not re-narrate, §4.5)", () => {
    expect(() =>
      orchestrator.handleFrame({ v: 1, type: "UNDONE", id: "01J9ZQK8Y7M3N4P5R6S7T8V9WX", ts: 1, payload: { ids: ["t1"] } })
    ).not.toThrow();
  });
});

describe("Orchestrator — TRIGGER (§4.7 GM command, M7)", () => {
  it("dispatches an inbound TRIGGER to the registered onTrigger handler", () => {
    const handler = vi.fn();
    orchestrator.onTrigger(handler);
    orchestrator.handleFrame({ v: 1, type: "TRIGGER", id: "01J9ZQK8Y7M3N4P5R6S7T8V9WX", ts: 1, payload: { text: "three days through the Thornwood" } });
    expect(handler).toHaveBeenCalledWith({ text: "three days through the Thornwood" });
  });

  it("logs, does not throw, if a TRIGGER arrives with no handler registered", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      orchestrator.handleFrame({ v: 1, type: "TRIGGER", id: "01J9ZQK8Y7M3N4P5R6S7T8V9WX", ts: 1, payload: { text: "x" } })
    ).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
