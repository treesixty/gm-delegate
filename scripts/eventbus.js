// eventbus.js — the EventBus (spec §4.6). Foundry hooks are the trigger
// channel; the voice transcript (v2) is context only, never a trigger — do
// not add a transcript hook here (AGENTS.md, docs/milestones/04-eventbus.md).
//
// M4 needs M5's socket to deliver anything, and M5 does not exist yet. Per
// the M4 briefing's Traps section, chosen path: emit to a bounded local
// buffer and flush through a sender registered later at init
// (registerEventSender), same "callback set at init" shape AGENTS.md
// prescribes for journal.js's notifyAgent. Buffering (not the full wire
// envelope) is this module's job — `id`/`v`/`ts` are envelope-level fields
// added by socket.js (M5) at send time, per contracts/envelope.schema.json's
// "event" payload being just `{ event, data }`.
//
// Hook names are dynamic substitutions Foundry's TypeDoc output does not
// enumerate literally (e.g. "controlToken" from the documented
// "control<PlaceableObjectName>" pattern on controlObject). Verified against
// the substitution note on each base hook's own doc page — see spec §0,
// 2026-08-12 rows.

const BUFFER_LIMIT = 128; // contracts/envelope.schema.json's "event" def: buffer the last 128, drop the oldest.

const buffer = [];
let sender = null;

function emit(event, data) {
  const frame = { event, data };
  if (sender) {
    sender(frame);
    return;
  }
  buffer.push(frame);
  if (buffer.length > BUFFER_LIMIT) buffer.shift();
}

// Called once the socket (M5) exists. Flushes anything buffered so far, then
// every future emit() goes straight through.
export function registerEventSender(fn) {
  sender = fn;
  while (buffer.length) sender(buffer.shift());
}

export function getBuffer() {
  return buffer.slice();
}

// Test-only: buffer/sender are module-level singletons, unlike the rest of
// the module's state which lives in game.settings and resets via
// tests/setup.js's resetFoundry().
export function _resetForTests() {
  buffer.length = 0;
  sender = null;
}

// Roll#total/#formula and the static Roll.fromJSON(json) are confirmed v14
// API (spec §0, 2026-08-12). ChatMessage#rolls is a confirmed schema field
// (ArrayField<JSONField>) but TypeDoc does not show whether the live
// instance getter returns parsed Roll objects or raw JSON strings — same
// class of gap as M3's TokenHUD/getCombatTrackerEntryContext findings, so
// this parses defensively rather than assuming either shape.
export function extractRoll(msg) {
  if (!msg?.isRoll || !msg.rolls?.length) return { rolls: [] };
  const rolls = msg.rolls.map((r) => {
    const roll = typeof r === "string" ? Roll.fromJSON(r) : r;
    return { formula: roll.formula, total: roll.total };
  });
  return { rolls };
}

const HOOKS = [
  ["controlToken", (token, ctrl) => ctrl && emit("token.selected", { actorId: token.actor?.id ?? null })],
  ["createChatMessage", (msg) => emit("chat.message", extractRoll(msg))],
  ["updateCombat", (c) => emit("combat.turn", { round: c.round, turn: c.turn })],
  ["canvasReady", () => emit("scene.active", { sceneId: canvas.scene?.id ?? null })],
  ["updateToken", (t, chg) => ("x" in chg || "y" in chg) && emit("token.moved", { tokenId: t.id, x: chg.x, y: chg.y })],
];

// Do not throw inside a Foundry hook (docs/milestones/04-eventbus.md Traps):
// an exception here breaks token selection, chat, or combat tracking for the
// GM mid-session with no visible cause. Catch at this boundary and log
// loudly — never swallow silently.
export function registerHooks() {
  for (const [name, handler] of HOOKS) {
    Hooks.on(name, (...args) => {
      try {
        handler(...args);
      } catch (err) {
        console.error(`gm-delegate | eventbus | "${name}" handler threw`, err);
      }
    });
  }
}
