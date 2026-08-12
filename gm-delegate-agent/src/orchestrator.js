// orchestrator.js — the agent side of the wire protocol (spec §5.6/§3:
// "receives events, decides whether to wake a subagent"). For M5 there is no
// subagent to wake yet (M6); this is the plumbing: one Foundry module
// connection, INTENT/RESULT correlation by envelope id, and the inbound
// handling POLICY_REVOKED/UNDONE require.
//
// §5.6 rule 4: on reconnect, in-flight intents are dead — do not replay
// them. detach() rejects every pending sendIntent() promise instead of
// queueing for a future connection.

import { buildEnvelope } from "./envelope.js";

// The spec's whole-card budget is <5s (§9); an INTENT that outlives that has
// already blown the budget, so timing it out here rather than hanging
// forever is what actually surfaces the miss instead of masking it.
const INTENT_TIMEOUT_MS = 5000;
const EVENT_BUFFER_LIMIT = 128; // matches eventbus.js's buffer, contracts/envelope.schema.json's "event" def

export class Orchestrator {
  #conn = null;
  #pending = new Map(); // envelope id -> { resolve, reject, timer }
  #revoked = false;
  #events = [];

  attach(conn) {
    this.#conn = conn;
  }

  detach(conn) {
    if (this.#conn !== conn) return;
    this.#conn = null;
    for (const { reject, timer } of this.#pending.values()) {
      clearTimeout(timer);
      reject(new Error("module disconnected before RESULT arrived"));
    }
    this.#pending.clear();
  }

  get connected() {
    return this.#conn !== null;
  }

  get revoked() {
    return this.#revoked;
  }

  // §5.6 rule 5: a HELLO round-trip clears POLICY_REVOKED. server.js calls
  // this whenever a new connection sends its HELLO.
  clearRevoked() {
    this.#revoked = false;
  }

  getEvents() {
    return this.#events.slice();
  }

  // Returns a Promise resolving to the RESULT payload ({status, result?,
  // reason?}), or rejecting on timeout/disconnect. The agent "must handle
  // rejection, not route around it" (M5 Traps) — callers see status:
  // "REJECTED" as a normal resolved value, not a thrown error; only
  // transport failures (no connection, timeout, disconnect mid-flight) are
  // rejections.
  sendIntent({ subsystem, stage, action, args, provenance }) {
    if (this.#revoked) {
      return Promise.reject(new Error("POLICY_REVOKED: agent must not emit until the next HELLO round-trip"));
    }
    if (!this.#conn) {
      return Promise.reject(new Error("no module connected"));
    }
    const payload = { subsystem, stage, action, args };
    if (provenance) payload.provenance = provenance;
    const frame = buildEnvelope("INTENT", payload);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(frame.id);
        reject(new Error(`INTENT ${frame.id} timed out after ${INTENT_TIMEOUT_MS}ms waiting for RESULT`));
      }, INTENT_TIMEOUT_MS);
      this.#pending.set(frame.id, { resolve, reject, timer });
      this.#conn.send(JSON.stringify(frame));
    });
  }

  // Every validated inbound frame from the module goes through here.
  handleFrame(frame) {
    switch (frame.type) {
      case "HELLO":
        return; // server.js already sent this connection's own HELLO
      case "RESULT":
        return this.#onResult(frame);
      case "EVENT":
        this.#events.push(frame.payload);
        if (this.#events.length > EVENT_BUFFER_LIMIT) this.#events.shift();
        return;
      case "POLICY_REVOKED":
        this.#revoked = true;
        console.log("gm-delegate-agent | POLICY_REVOKED — stopping intent emission", frame.payload);
        return;
      case "UNDONE":
        // Must not re-narrate undone material (§4.5). Nothing narrates yet
        // (M6+); logging is the whole obligation at this milestone.
        console.log("gm-delegate-agent | UNDONE", frame.payload.ids);
        return;
      default:
        // Only RESULT/EVENT/POLICY_REVOKED/UNDONE/HELLO flow module -> agent
        // (§5.6's type table). An INTENT arriving here would be the wrong
        // direction, not a case to handle.
        console.error(`gm-delegate-agent | unexpected inbound type from module: ${frame.type}`);
    }
  }

  #onResult(frame) {
    const pending = this.#pending.get(frame.id);
    if (!pending) {
      // Late arrival after a timeout already rejected it, or a RESULT for an
      // id this process never sent (protocol error on the module's side).
      console.error(`gm-delegate-agent | RESULT for unknown or already-settled intent ${frame.id}`);
      return;
    }
    clearTimeout(pending.timer);
    this.#pending.delete(frame.id);
    pending.resolve(frame.payload);
  }
}
