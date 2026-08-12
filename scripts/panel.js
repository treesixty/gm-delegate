// panel.js — the Panel (spec §4.7). Docked, GM-only. "You should never have
// to fight this thing" (docs/milestones/03-panel.md) — every choice below
// follows from that, especially RECLAIM.
//
// Split in two, like journal.js/policy.js: pure logic (queue, cycleChip,
// reclaim, undo, context-menu writes) that vitest can exercise against the
// mocked globals in tests/setup.js, and the ApplicationV2 shell around it,
// which needs a real Foundry client to render. AGENTS.md's testing section
// calls that split out explicitly.
//
// Verified against foundryvtt.com/api (2026-08-11, added to spec §0):
// namespace foundry.applications.api.{ApplicationV2, HandlebarsApplicationMixin},
// the DEFAULT_OPTIONS/PARTS/actions shape, _prepareContext, render(true)/close(),
// and bringToFront (bringToTop was removed in v14). The mixin's exact PARTS
// wiring and window.frame/positioned flags were not shown by TypeDoc's terse
// output; those follow the AppV2 convention used since v12 and unchanged per
// the existing bringToTop-only-removal row in §0. Flagged there as the basis.

import { getPolicy, setSubsystemDecide, setSceneOverride, setActorOverride, nextMode } from "./policy.js";
import { note, undoLast } from "./journal.js";

const MODULE_ID = "gm-delegate";

const CHIPS = [
  { key: "random_encounters", label: "ENC" },
  { key: "loot", label: "LOOT" },
  { key: "npc_voice", label: "NPC" },
  { key: "combat_tactics", label: "CMB" },
];

const queued = [];

// The one mounted instance, if any, so logic functions can trigger a
// re-render without the ApplicationV2 class knowing about every call site.
let activeInstance = null;

export const Panel = {
  // Called by interceptor.js for `propose` mode (§4.4). Signature and the
  // `queued` array are the M2 stub's public shape — interceptor.js's call
  // site does not change.
  queue(intent) {
    queued.push(intent);
    console.log(`${MODULE_ID} | Panel.queue |`, intent);
    activeInstance?.render();
  },
  queued,
};

export function shouldShowPanel() {
  return game.user?.isGM === true;
}

export async function cycleSubsystemMode(subsystem) {
  const p = getPolicy();
  const current = p.subsystems[subsystem]?.decide ?? "off";
  const next = await setSubsystemDecide(subsystem, nextMode(current));
  activeInstance?.render();
  return next;
}

// RECLAIM (§4.7). Order matters: override first (so a re-render mid-purge
// never shows a stale "still delegated" state), then purge, then notify,
// then log. All four steps are local; only the notify step depends on the
// socket (M5), and that step is stubbed.
export async function reclaim() {
  await setSceneOverride("all_off");
  queued.length = 0;
  sendPolicyRevoked();
  const entry = await note({ status: "RECLAIMED" });
  activeInstance?.render();
  return entry;
}

export async function performUndo(n) {
  const ids = await undoLast(n);
  activeInstance?.render();
  return ids;
}

// "I'll take this one" (§4.7, right-click a combatant). §4.3's PolicyStore
// has no per-scene axis — only a global sceneOverride flag and per-actor
// overrides — so this writes the global combat_tactics.decide off rather
// than a scene-scoped one. Simplification, not the literal spec wording;
// recorded in STATUS.md. Add a scene-keyed policy dimension first if this
// needs to be per-scene later.
export async function takeCombatant() {
  const next = await setSubsystemDecide("combat_tactics", "off");
  activeInstance?.render();
  return next;
}

// "I'll voice this one" (§4.7, right-click an NPC token). Logic only — no
// UI wires into it yet. See STATUS.md: the TokenHUD's DOM structure is not
// in the fetched v14 docs, and a guessed `.control-icon` selector that
// silently no-ops is worse than an honest gap.
export async function voiceNpc(actorId) {
  const next = await setActorOverride(actorId, "npc_voice", { decide: "off", prompt: "off" });
  activeInstance?.render();
  return next;
}

// Stub — the socket is M5 (spec §5.6). Schema-valid: matches
// envelope.schema.json's $defs.policyRevoked exactly.
function sendPolicyRevoked() {
  const payload = { scope: "all_off", ts: Date.now() };
  console.log(`${MODULE_ID} | POLICY_REVOKED (stub, socket is M5) |`, payload);
  return payload;
}

// Stub for the v1 trigger (§4.7's "the only trigger v1 has"). What ships
// over the socket at M5 is deliberately NOT decided here: envelope.schema.json
// defines INTENT as agent -> module only (§5.6), so wrapping raw GM text as
// an outbound "INTENT" would contradict the schema, and contracts/* changes
// get proposed, not applied (AGENTS.md). Logs in the §6 `trigger` shape
// instead (log-entry.schema.json: { type: "gm_command", text }), which is
// schema-valid today and is what M5 will need to carry either way.
function sendTrigger(text) {
  const trigger = { type: "gm_command", text };
  console.log(`${MODULE_ID} | trigger (stub, no wire format yet) |`, trigger);
  return trigger;
}

// Guarded: tests/setup.js mocks only `foundry.utils` (deliberately minimal,
// per AGENTS.md — "not a Foundry emulator"), so `foundry.applications` does
// not exist under vitest. Referencing ApplicationV2 at module-load time would
// break every test that imports Panel/the logic functions above, including
// M2's tests/interceptor.test.js. Falling back to a throwing placeholder
// keeps this file importable outside Foundry; the real class is only ever
// constructed from main.js's `ready` hook, which runs inside a real client.
const AppV2Api = foundry.applications?.api;

class GMDelegatePanelUnavailable {
  constructor() {
    throw new Error(
      "gm-delegate | GMDelegatePanel requires a Foundry client (foundry.applications.api not present)"
    );
  }
}

export const GMDelegatePanel = AppV2Api
  ? class GMDelegatePanel extends AppV2Api.HandlebarsApplicationMixin(AppV2Api.ApplicationV2) {
      static DEFAULT_OPTIONS = {
        id: "gm-delegate-panel",
        tag: "div",
        classes: ["gm-delegate-panel"],
        window: { frame: false, positioned: false },
        position: { top: 0, left: 0 },
        actions: {
          cycleChip: GMDelegatePanel._onCycleChip,
          reclaim: GMDelegatePanel._onReclaim,
          ask: GMDelegatePanel._onAsk,
          undo: GMDelegatePanel._onUndo,
        },
      };

      static PARTS = {
        panel: { template: "modules/gm-delegate/templates/panel.hbs" },
      };

      async _prepareContext(_options) {
        const policy = getPolicy();
        return {
          chips: CHIPS.map(({ key, label }) => {
            const mode = policy.subsystems[key]?.decide ?? "off";
            return { key, label, mode, active: mode !== "off" };
          }),
          reclaimed: policy.sceneOverride === "all_off",
          queued: queued.map((intent) => JSON.stringify(intent, null, 2)),
        };
      }

      _onFirstRender(context, options) {
        super._onFirstRender?.(context, options);
        activeInstance = this;
      }

      async close(options) {
        if (activeInstance === this) activeInstance = null;
        return super.close(options);
      }

      static async _onCycleChip(_event, target) {
        await cycleSubsystemMode(target.dataset.subsystem);
      }

      static async _onReclaim() {
        await reclaim();
      }

      static async _onAsk() {
        const input = this.element.querySelector('input[name="triggerText"]');
        const text = input?.value?.trim();
        if (!text) return;
        sendTrigger(text);
        input.value = "";
      }

      static async _onUndo() {
        const input = this.element.querySelector('input[name="undoN"]');
        const n = Math.max(1, parseInt(input?.value, 10) || 1);
        await performUndo(n);
      }
    }
  : GMDelegatePanelUnavailable;
