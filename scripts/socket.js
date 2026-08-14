// socket.js — the Foundry side of the wire protocol (spec §5.6).
//
// §5.6 rule 3 corrected 2026-08-12 (see spec §0 and STATUS.md): the module is
// the WS CLIENT, the agent is the WS SERVER. Browsers cannot listen for
// incoming connections; only the agent (a real Node process) can bind a
// listening socket. Everything else in §5.6 is unchanged: HELLO on connect,
// exponential-backoff reconnect to a 10 s ceiling, one RESULT per INTENT,
// EVENT is fire-and-forget and droppable, POLICY_REVOKED is not advisory,
// bind/connect to 127.0.0.1 only.
//
// module.json keeps "socket": false — that flag is Foundry's own
// cross-client relay, unrelated to this module-owned localhost WS.
//
// On reconnect, in-flight intents are dead (§5.6 rule 4): this file does not
// track or replay anything across a reconnect. A dropped INTENT just never
// gets a RESULT; the agent's own pending-intent timeout (gm-delegate-agent's
// orchestrator.js) is what notices, not this side.

import { handleIntent } from "./interceptor.js";
import { registerEventSender } from "./eventbus.js";
import { registerPolicyRevokedSender, registerTriggerSender } from "./panel.js";
import { logCard } from "./journal.js";
import { buildEnvelope, buildReply, validateEnvelope } from "./envelope.js";

const MODULE_ID = "gm-delegate";
const URL_KEY = "agentUrl";
const RECONNECT_CEILING_MS = 10_000;
const RECONNECT_FLOOR_MS = 250;

export function registerSocketSettings() {
  game.settings.register(MODULE_ID, URL_KEY, {
    scope: "world",
    config: true,
    type: String,
    default: "ws://127.0.0.1:8765",
    name: "GM Delegate: agent server URL",
    hint: "The local gm-delegate-agent WebSocket server this client dials out to (spec §5.6). Localhost only.",
  });
}

let ws = null;
let reconnectDelay = RECONNECT_FLOOR_MS;
let reconnectTimer = null;
let url = null;
let manuallyDisconnected = false;

export function connect(wsUrl = game.settings.get(MODULE_ID, URL_KEY)) {
  url = wsUrl;
  manuallyDisconnected = false;
  registerPolicyRevokedSender(sendPolicyRevoked);
  registerTriggerSender(sendTriggerFrame);
  open();
}

export function disconnect() {
  manuallyDisconnected = true;
  clearTimeout(reconnectTimer);
  ws?.close();
  ws = null;
}

function open() {
  ws = new WebSocket(url);
  ws.addEventListener("open", () => {
    reconnectDelay = RECONNECT_FLOOR_MS;
    send(buildEnvelope("HELLO", { v: 1, role: "module", moduleVersion: game.modules.get(MODULE_ID).version }));
    registerEventSender(sendEvent);
  });
  ws.addEventListener("message", (event) => {
    onMessage(event.data).catch((err) => console.error(`${MODULE_ID} | socket | message handler threw`, err));
  });
  ws.addEventListener("close", scheduleReconnect);
  // A socket error is always followed by a close event; let close() own
  // reconnect scheduling rather than doing it twice.
  ws.addEventListener("error", () => console.error(`${MODULE_ID} | socket | connection error`));
}

function scheduleReconnect() {
  if (manuallyDisconnected) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(open, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_CEILING_MS);
}

function send(frame) {
  if (ws?.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(frame));
  return true;
}

// Registered with eventbus.js's registerEventSender. EVENT is fire-and-forget
// and droppable (§5.6 rule 2) — a closed socket just means the frame is
// lost, never a throw into Foundry's hook loop (registerHooks()'s per-handler
// try/catch would catch it anyway, but send() already no-ops when not open).
function sendEvent(frame) {
  send(buildEnvelope("EVENT", frame));
}

// Registered with panel.js's registerPolicyRevokedSender. Not advisory on
// the agent's side, but if there is no agent connected there is nothing to
// notify — the actual enforcement is policy.js's sceneOverride, unaffected by
// socket state.
function sendPolicyRevoked(payload) {
  send(buildEnvelope("POLICY_REVOKED", payload));
}

// Registered with panel.js's registerTriggerSender (§4.7's v1 trigger, M7).
// Fire-and-forget, same as EVENT/POLICY_REVOKED — send() already no-ops when
// the socket isn't open, and there is no reply to wait for in v1 (the
// eventual card arrives later as its own agent-initiated propose_encounter
// INTENT).
function sendTriggerFrame(payload) {
  send(buildEnvelope("TRIGGER", payload));
}

async function onMessage(raw) {
  let frame;
  try {
    frame = JSON.parse(raw);
  } catch {
    console.error(`${MODULE_ID} | socket | non-JSON frame, dropped`);
    return;
  }
  const { valid, errors } = validateEnvelope(frame);
  if (!valid) {
    // "v mismatch → log, drop, surface once in the panel. Never guess."
    // (§5.6). The panel surface is a future nicety; logging loudly is the
    // part that must not be skipped.
    console.error(`${MODULE_ID} | socket | invalid envelope, dropped`, errors, frame);
    return;
  }
  if (frame.type === "HELLO") return; // this side already sent its own on open
  if (frame.type !== "INTENT") {
    // §5.6's type table has exactly one agent -> module type: INTENT.
    // Anything else arriving here is a protocol error, not a case to handle.
    console.error(`${MODULE_ID} | socket | unexpected inbound type, dropped`, frame.type);
    return;
  }

  const receivedAt = Date.now();
  const intent = { id: frame.id, ...frame.payload };
  const outcome = await handleIntent(intent);
  const { status, result, reason } = outcome;
  const payload = { status };
  if (result !== undefined) payload.result = result;
  if (reason !== undefined) payload.reason = reason;
  send(buildReply("RESULT", frame.id, payload));

  // M1's latency_ms instrumentation, per M5's Done-when. This measures the
  // module-side hop (INTENT received -> RESULT sent: policy + interceptor +
  // executor + Foundry write), not full network round trip as seen by the
  // agent — the wire schema's RESULT payload has no field for the agent to
  // report its own send/receive timestamps back (adding one is a
  // contracts/* change, proposed not applied per AGENTS.md), and this is the
  // piece actually inside the module's control.
  await logCard({
    intent_id: frame.id,
    subsystem: intent.subsystem,
    latency_ms: Date.now() - receivedAt,
    rejected: status === "REJECTED" ? reason : null,
    provenance: extractProvenance(intent, result),
  }).catch((err) => console.error(`${MODULE_ID} | socket | logCard failed`, err));
}

// M6 (§5.2, Done-when): roll_on_table's result carries the mechanical
// resolution — the thing the §6 card log's `provenance` column exists to
// hold. Not every action's result maps to this shape (most don't), so this
// stays defensive rather than assuming intent.action === "roll_on_table".
function extractProvenance(intent, result) {
  // roll_on_table's executor returns { result: {drawn, tableDice, ...}, created: [] }
  // (spec §5.2's own code sample) — the mechanical fields sit one level under
  // the executor's own `result` key, not at its top.
  const mechanical = result?.result;
  if (intent.action !== "roll_on_table" || !mechanical) return null;
  return {
    tableId: intent.args.tableId,
    roll: mechanical.tableTotal,
    tableDice: mechanical.tableDice,
    result: mechanical.drawn?.[0] ?? null,
    quantity: mechanical.quantity,
    quantityDice: mechanical.quantityDice,
  };
}
