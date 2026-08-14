// scripts/socket.js (spec §5.6, module = WS client per the corrected rule
// 3). Drives the real onMessage/reconnect logic against a fake WebSocket —
// no real network socket, matching AGENTS.md's "outside Foundry: vitest
// against mocked globals" split. The fake only implements what socket.js
// actually calls (addEventListener/send/close/readyState), not a full DOM
// WebSocket, same minimalism tests/setup.js already applies to game/canvas.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetFoundry } from "./setup.js";
import { registerJournalSettings, getCardLog } from "../scripts/journal.js";
import { registerPolicySettings } from "../scripts/policy.js";
import { registerPolicyRevokedSender, registerTriggerSender, reclaim, sendTrigger } from "../scripts/panel.js";
import { _resetForTests as resetEventBus } from "../scripts/eventbus.js";
import { connect, disconnect } from "../scripts/socket.js";

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;
    this.sent = [];
    this.listeners = {};
    FakeWebSocket.instances.push(this);
  }
  addEventListener(name, fn) {
    (this.listeners[name] ??= []).push(fn);
  }
  send(data) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this._fire("close");
  }
  _fire(name, evt = {}) {
    for (const fn of this.listeners[name] ?? []) fn(evt);
  }
  _open() {
    this.readyState = FakeWebSocket.OPEN;
    this._fire("open");
  }
  _message(frame) {
    this._fire("message", { data: JSON.stringify(frame) });
  }
}
FakeWebSocket.instances = [];

const latest = () => FakeWebSocket.instances.at(-1);

beforeEach(() => {
  resetFoundry();
  resetEventBus();
  registerJournalSettings();
  registerPolicySettings();
  registerPolicyRevokedSender(null);
  registerTriggerSender(null);
  disconnect(); // stop any timer/socket left running by the previous test
  FakeWebSocket.instances.length = 0;
  globalThis.WebSocket = FakeWebSocket;
});

describe("socket.js — connect/HELLO/reconnect (§5.6)", () => {
  it("dials out (does not wait to be dialed into) and sends HELLO on open", () => {
    connect("ws://127.0.0.1:8765");
    expect(FakeWebSocket.instances).toHaveLength(1);
    latest()._open();
    expect(latest().sent).toHaveLength(1);
    expect(latest().sent[0]).toMatchObject({ v: 1, type: "HELLO", payload: { v: 1, role: "module" } });
  });

  it("reconnects with backoff after a close, and disconnect() stops it", () => {
    vi.useFakeTimers();
    connect("ws://127.0.0.1:8765");
    latest().close();
    expect(FakeWebSocket.instances).toHaveLength(1); // not yet, backoff pending
    vi.advanceTimersByTime(250);
    expect(FakeWebSocket.instances).toHaveLength(2);

    disconnect();
    vi.advanceTimersByTime(10_000);
    expect(FakeWebSocket.instances).toHaveLength(2); // no further reconnect after disconnect()
    vi.useRealTimers();
  });
});

describe("socket.js — INTENT -> RESULT (§5.6 Done when)", () => {
  // get_compendium_actor: a real, still-existing auto-mode action other than
  // roll_on_table (M6/M7's own real tool surface — test-m1.js's synthetic
  // test.actor.rename is gone, deleted M7 per STATUS.md).
  const intentFrame = (over = {}) => ({
    v: 1,
    type: "INTENT",
    id: "01J9ZQK8Y7M3N4P5R6S7T8V9WX",
    ts: 1,
    payload: {
      subsystem: "random_encounters",
      stage: "prompt", // DEFAULT_POLICY: random_encounters.prompt = auto
      action: "get_compendium_actor",
      args: { packId: "dnd5e.monsters", actorId: "abc123" },
      ...over,
    },
  });

  it("round-trips a hardcoded intent end to end and echoes the INTENT's id on the RESULT", async () => {
    fromUuid.mockResolvedValue({
      draw: vi.fn(async () => ({ roll: { formula: "1d20", total: 5 }, results: [{ name: "Wolf Pack" }] })),
    });
    connect("ws://127.0.0.1:8765");
    latest()._open();
    latest().sent.length = 0; // clear the HELLO

    latest()._message(intentFrame({ action: "roll_on_table", args: { tableId: "RollTable.abc" } }));
    await new Promise((r) => setTimeout(r, 0));

    expect(latest().sent).toHaveLength(1);
    const reply = latest().sent[0];
    expect(reply).toMatchObject({ v: 1, type: "RESULT", id: "01J9ZQK8Y7M3N4P5R6S7T8V9WX" });
    expect(reply.payload.status).toBe("EXECUTED");
    expect(reply.payload.result.result).toMatchObject({ drawn: ["Wolf Pack"], tableTotal: 5 });

    const card = getCardLog().at(-1);
    expect(card).toMatchObject({
      intent_id: "01J9ZQK8Y7M3N4P5R6S7T8V9WX",
      subsystem: "random_encounters",
      rejected: null,
    });
    expect(typeof card.latency_ms).toBe("number");
  });

  it("round-trips a rejected intent too, with the structured reason", async () => {
    connect("ws://127.0.0.1:8765");
    latest()._open();
    latest().sent.length = 0;

    latest()._message(intentFrame({ action: "actor.hp.write" })); // hard ban
    await new Promise((r) => setTimeout(r, 0));

    const reply = latest().sent[0];
    expect(reply.payload).toEqual({ status: "REJECTED", reason: "HARD_BAN" });

    const card = getCardLog().at(-1);
    expect(card.rejected).toBe("HARD_BAN");
  });

  it("logs provenance for an executed roll_on_table intent (M6 Done-when)", async () => {
    fromUuid.mockResolvedValue({
      draw: vi.fn(async () => ({
        roll: { formula: "1d20", total: 5 },
        results: [{ name: "[[2d4]] Wolf Pack" }],
      })),
    });
    connect("ws://127.0.0.1:8765");
    latest()._open();
    latest().sent.length = 0;

    latest()._message(intentFrame({ action: "roll_on_table", args: { tableId: "RollTable.abc" } }));
    await new Promise((r) => setTimeout(r, 0));

    const card = getCardLog().at(-1);
    expect(card.provenance).toEqual({
      tableId: "RollTable.abc",
      roll: 5,
      tableDice: "1d20",
      result: "[[2d4]] Wolf Pack",
      quantity: 8, // RollMock's deterministic 2d4 -> 2*4
      quantityDice: "2d4=8",
    });
  });

  it("logs null provenance for actions other than roll_on_table", async () => {
    game.packs.get.mockReturnValue({ getDocument: vi.fn(async () => ({ toObject: () => ({ name: "Wolf" }) })) });
    connect("ws://127.0.0.1:8765");
    latest()._open();
    latest().sent.length = 0;

    latest()._message(intentFrame()); // get_compendium_actor, from the shared fixture
    await new Promise((r) => setTimeout(r, 0));

    expect(getCardLog().at(-1).provenance).toBeNull();
  });

  it("drops a frame with an invalid envelope and never calls handleIntent", async () => {
    connect("ws://127.0.0.1:8765");
    latest()._open();
    latest().sent.length = 0;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    latest()._message({ v: 2, type: "INTENT", id: "bad", ts: 1, payload: {} });
    await new Promise((r) => setTimeout(r, 0));

    expect(latest().sent).toHaveLength(0);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("drops an unexpected inbound type (only INTENT flows agent -> module)", async () => {
    connect("ws://127.0.0.1:8765");
    latest()._open();
    latest().sent.length = 0;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    latest()._message({
      v: 1,
      type: "RESULT",
      id: "01J9ZQK8Y7M3N4P5R6S7T8V9WX",
      ts: 1,
      payload: { status: "EXECUTED" },
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(latest().sent).toHaveLength(0);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("socket.js — POLICY_REVOKED (§5.6, RECLAIM)", () => {
  it("registers itself as panel.js's POLICY_REVOKED sender at connect(), and RECLAIM reaches the wire", async () => {
    connect("ws://127.0.0.1:8765");
    latest()._open();
    latest().sent.length = 0;

    await reclaim(); // real panel.js RECLAIM path (spec §4.7)

    const revoked = latest().sent.find((f) => f.type === "POLICY_REVOKED");
    expect(revoked).toMatchObject({ type: "POLICY_REVOKED", payload: { scope: "all_off" } });
  });

  it("does not throw if RECLAIM fires with no agent connected", async () => {
    // beforeEach already reset the sender to null and never called connect().
    await expect(reclaim()).resolves.toBeTruthy();
  });
});

describe("socket.js — TRIGGER (§4.7 GM command, M7)", () => {
  it("registers itself as panel.js's TRIGGER sender at connect(), and the trigger reaches the wire", () => {
    connect("ws://127.0.0.1:8765");
    latest()._open();
    latest().sent.length = 0;

    sendTrigger("three days through the Thornwood");

    const trigger = latest().sent.find((f) => f.type === "TRIGGER");
    expect(trigger).toMatchObject({ type: "TRIGGER", payload: { text: "three days through the Thornwood" } });
  });

  it("does not throw if the trigger fires with no agent connected", () => {
    // beforeEach already reset the sender to null and never called connect().
    expect(() => sendTrigger("three days through the Thornwood")).not.toThrow();
  });
});
