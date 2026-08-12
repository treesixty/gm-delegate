// server.js — binds the listening WebSocket (spec §5.6, corrected: the agent
// is the server, the module dials in — see spec §0/STATUS.md 2026-08-12).
// 127.0.0.1 only (§5.6 rule 6); there is no auth in v1 because it never
// listens on a routable interface — do not widen the bind host for
// convenience.

import { WebSocketServer } from "ws";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateEnvelope, buildEnvelope } from "./envelope.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version: AGENT_VERSION } = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));

export function startServer({ host, port }, orchestrator) {
  const wss = new WebSocketServer({ host, port });

  wss.on("connection", (conn) => {
    // Only one Foundry module is ever expected; a second connection replaces
    // the tracked one rather than being refused — there is no auth to refuse
    // it with, and refusing silently would be worse than just taking over.
    orchestrator.attach(conn);
    orchestrator.clearRevoked(); // §5.6 rule 5: a HELLO round-trip clears POLICY_REVOKED

    conn.send(JSON.stringify(buildEnvelope("HELLO", { v: 1, role: "agent", agentVersion: AGENT_VERSION })));

    conn.on("message", (raw) => {
      let frame;
      try {
        frame = JSON.parse(raw.toString());
      } catch {
        console.error("gm-delegate-agent | non-JSON frame, dropped");
        return;
      }
      const { valid, errors } = validateEnvelope(frame);
      if (!valid) {
        console.error("gm-delegate-agent | invalid envelope, dropped", errors);
        return;
      }
      orchestrator.handleFrame(frame);
    });

    conn.on("close", () => orchestrator.detach(conn));
    conn.on("error", (err) => console.error("gm-delegate-agent | connection error", err));
  });

  wss.on("error", (err) => console.error("gm-delegate-agent | server error", err));

  return wss;
}
