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

import { getPolicy, modeFor, setSubsystemDecide, setSceneOverride, setActorOverride, nextMode } from "./policy.js";
import { note, undoLast, logCard } from "./journal.js";
import {
  put as putProposal,
  get as getProposal,
  getEntry as getProposalEntry,
  markOpened as markProposalOpened,
  remove as removeProposal,
} from "./proposals.js";

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

// proposalId of the card currently showing its edit textarea, or null. UI
// state, same class as GMDelegatePanel#collapsed — not persisted, not
// routed through journal/policy.
let editing = null;

// interceptor.js's execute() is registered here rather than imported
// directly: interceptor.js already imports Panel (for queue()), so a
// static `import { execute } from "./interceptor.js"` here would close that
// into a cycle. Same "callback set at init" shape as
// registerPolicyRevokedSender/registerTriggerSender below. Registered from
// main.js's ready hook.
let executeFn = null;

export function registerExecute(fn) {
  executeFn = fn;
}

async function runExecute(intent) {
  if (!executeFn) {
    console.error(`${MODULE_ID} | no execute() registered yet`, intent);
    return { status: "REJECTED", id: intent.id, reason: "NO_EXECUTOR_REGISTERED" };
  }
  return executeFn(intent);
}

// M7's "GM prompt -> card on screen" latency (§9's own phrasing, restated in
// 07-card.md's Done-when) is measured from the moment the trigger left this
// client, not from GM think-time on the card afterward — captured once here,
// frozen into the proposal's cardLogContext at queue() time, and carried
// unchanged into whichever gm_action eventually logs it.
let lastTrigger = null;

// §6's foundry_state column. Captured at proposal-creation time — "what was
// true when the GM prompt was answered" is the meaningful instant, not
// whatever is true later when the GM finally clicks a button.
function captureFoundryState() {
  return {
    scene: canvas?.scene?.id ?? null,
    combat: !!game.combat?.started,
    selected: canvas?.tokens?.controlled?.[0]?.actor?.id ?? null,
  };
}

function buildCardText(proposal) {
  return `${proposal.beats.map((b) => `• ${b}`).join("\n")}\nHook: ${proposal.hook}`;
}

// The card's view model (§5.4's mockup): the provenance line is the visible
// proof "Foundry decided, not the model" (07-card.md — "not decoration").
function buildCardViewModel(proposal, isEditing) {
  const totalQty = proposal.creatures.reduce((n, c) => n + c.quantity, 0);
  const creatureNames = proposal.creatures.map((c) => c.name).join(", ");
  return {
    proposalId: proposal.id,
    provenanceLine: `${proposal.provenance?.tableId ?? "?"} · roll ${proposal.provenance?.roll ?? "?"} → ${proposal.provenance?.result ?? "?"}`,
    quantityLine: proposal.provenance?.quantityDice
      ? `Foundry rolled ${proposal.provenance.quantityDice} → ${totalQty} ${creatureNames}`
      : null,
    creaturesLine: proposal.creatures
      .map((c) => `${c.name.toUpperCase()} ×${c.quantity}${c.descriptor ? ` — ${c.descriptor}` : ""}`)
      .join(", "),
    beats: proposal.beats,
    hook: proposal.hook,
    cardText: buildCardText(proposal),
    editing: isEditing,
  };
}

// The diff between what the model wrote and what the GM kept (§5.4's "best
// training signal in the system"). Beats/hook are short fragments, not code
// — a full diff library is more than this needs; null means unedited.
function computeEditDiff(original, finalText) {
  return original === finalText ? null : `- ${original}\n+ ${finalText}`;
}

async function logProposalOutcome(entry, gm_action, { card_text, gm_edit_diff = null } = {}) {
  const { proposal, cardLogContext } = entry;
  return logCard({
    intent_id: proposal.intent_id ?? null,
    proposal_id: proposal.id,
    subsystem: proposal.subsystem,
    mode: "propose",
    trigger: cardLogContext.trigger ?? null,
    foundry_state: cardLogContext.foundry_state ?? { scene: null, combat: false, selected: null },
    provenance: proposal.provenance ?? null,
    model: cardLogContext.model ?? null,
    latency_ms: cardLogContext.latency_ms ?? { total: 0 },
    card_text: card_text ?? buildCardText(proposal),
    gm_action,
    gm_edit_diff,
  });
}

function dequeue(proposalId) {
  const idx = queued.findIndex((q) => q.proposalId === proposalId);
  if (idx !== -1) queued.splice(idx, 1);
  if (editing === proposalId) editing = null;
}

export const Panel = {
  // Called by interceptor.js for `propose` mode (§4.4). Signature and the
  // `queued` array are the M2 stub's public shape — interceptor.js's call
  // site does not change. propose_encounter intents additionally get a real
  // proposal record (§5.7) so Accept/Edit/Reroll/Skip have something to act
  // on; every other propose-mode action (no subsystem builds one yet) keeps
  // the original raw-intent-dump behavior.
  queue(intent) {
    if (intent.action === "propose_encounter") {
      const record = putProposal(
        {
          subsystem: intent.subsystem,
          creatures: intent.args.creatures,
          beats: intent.args.beats,
          hook: intent.args.hook,
          provenance: intent.args.provenance,
          intent_id: intent.id,
        },
        {
          trigger: lastTrigger ? { type: "gm_command", text: lastTrigger.text } : null,
          foundry_state: captureFoundryState(),
          model: null, // TODO: not on the wire yet — INTENT's schema has no model field (§5.6)
          latency_ms: { total: lastTrigger ? Date.now() - lastTrigger.ts : 0 },
        }
      );
      queued.push({ ...intent, proposalId: record.id });
    } else {
      queued.push(intent);
    }
    console.log(`${MODULE_ID} | Panel.queue |`, intent);
    activeInstance?.render();
  },
  queued,
};

// Accept & Place (§5.4). place_encounter is triggered locally here, not
// routed through handleIntent()/mode — the GM's click IS the authorization;
// re-checking policy mode at accept time isn't in scope (the mode that
// mattered already ran when the card was proposed). See 07-card.md's Traps:
// "enforce in the Interceptor, not the prompt" — place_encounter's own
// executor (encounter.js) is what actually refuses a missing/expired/
// already-placed proposalId; this function is just the wire from the button.
export async function acceptProposal(proposalId) {
  const entry = getProposalEntry(proposalId);
  if (!entry) return null; // gone (expired, already actioned) between render and click
  markProposalOpened(proposalId);
  const outcome = await runExecute({ id: proposalId, action: "place_encounter", args: { proposalId } });
  await logProposalOutcome(entry, "accept");
  dequeue(proposalId);
  activeInstance?.render();
  return outcome;
}

export function startEdit(proposalId) {
  if (!getProposalEntry(proposalId)) return;
  markProposalOpened(proposalId);
  editing = proposalId;
  activeInstance?.render();
}

export function cancelEdit() {
  editing = null;
  activeInstance?.render();
}

// "Edit, then use" (§6's label table) is one combined action here, not two:
// the edited beats/hook text is what gets logged as card_text (the
// mechanical creatures/quantity/provenance are Foundry's, not the GM's to
// edit), and placement follows immediately — an edited card the GM never
// placed would be a positive label for a card that never actually got used,
// which is not what "edit" is supposed to mean.
export async function confirmEdit(proposalId, editedText) {
  const entry = getProposalEntry(proposalId);
  if (!entry) return null;
  const original = buildCardText(entry.proposal);
  const diff = computeEditDiff(original, editedText);
  markProposalOpened(proposalId);
  const outcome = await runExecute({ id: proposalId, action: "place_encounter", args: { proposalId } });
  await logProposalOutcome(entry, "edit", { card_text: editedText, gm_edit_diff: diff });
  dequeue(proposalId);
  activeInstance?.render();
  return outcome;
}

// Reroll (§5.4): logs a weak negative on the discarded card, then re-sends
// the SAME original trigger text so the agent runs again — "re-runs the
// agent," per 07-card.md's Done-when, over the one live trigger path this
// project has (§4.7).
export async function rerollProposal(proposalId) {
  const entry = getProposalEntry(proposalId);
  if (!entry) return;
  markProposalOpened(proposalId);
  await logProposalOutcome(entry, "reroll");
  removeProposal(proposalId);
  dequeue(proposalId);
  activeInstance?.render();
  const text = entry.cardLogContext.trigger?.text;
  if (text) sendTrigger(text);
}

export async function skipProposal(proposalId) {
  const entry = getProposalEntry(proposalId);
  if (!entry) return;
  markProposalOpened(proposalId);
  await logProposalOutcome(entry, "skip");
  removeProposal(proposalId);
  dequeue(proposalId);
  activeInstance?.render();
}

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
//
// Toggle, not one-way: the spec and the M3 Done-when list both say control
// "does not come back until you explicitly hand it back" — that phrasing
// requires a hand-back path to exist. Live-Foundry testing (2026-08-12)
// found none had been built; RECLAIM only ever set sceneOverride, nothing
// ever cleared it. Clicking RECLAIM again while active is that explicit
// hand-back — same button, same deliberateness, no new UI surface.
export async function reclaim() {
  const alreadyReclaimed = getPolicy().sceneOverride === "all_off";
  if (alreadyReclaimed) {
    await setSceneOverride(null);
    const entry = await note({ status: "RECLAIM_RELEASED" });
    activeInstance?.render();
    return entry;
  }
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

// "I'll voice this one" (§4.7, right-click an NPC token). Now wired to the
// TokenHUD in main.js — the DOM structure was confirmed live 2026-08-12
// (spec §0): <form id="token-hud">, buttons are .control-icon[data-action].
export async function voiceNpc(actorId) {
  const next = await setActorOverride(actorId, "npc_voice", { decide: "off", prompt: "off" });
  activeInstance?.render();
  return next;
}

// NPC = not a player-character and not player-controlled, per the user's
// own definition (2026-08-12) rather than a dnd5e-specific type check alone
// — an unlinked "npc"-type token a player has been handed ownership of
// (a mount, a hireling) should still count as theirs, not the GM's to voice.
// Actor#hasPlayerOwner confirmed live against v14.365 (spec §0): true iff any
// non-GM user holds OWNER permission on the actor.
export function isNpcActor(actor) {
  return !!actor && actor.type !== "character" && !actor.hasPlayerOwner;
}

// The socket (M5, spec §5.6) registers its sender here at connect time, same
// "callback set at init" shape eventbus.js's registerEventSender and
// journal.js's notifyAgent use — panel.js must not import socket.js directly
// (that would be the reverse of the one import-cycle rule AGENTS.md actually
// bans: journal.js -> socket.js. This one is socket.js -> panel.js, which is
// fine, but going the other way here would still couple this file to a
// module that doesn't exist outside a real client).
let policyRevokedSender = null;

export function registerPolicyRevokedSender(fn) {
  policyRevokedSender = fn;
}

// Schema-valid: matches envelope.schema.json's $defs.policyRevoked exactly.
function sendPolicyRevoked() {
  const payload = { scope: "all_off", ts: Date.now() };
  if (policyRevokedSender) policyRevokedSender(payload);
  else console.log(`${MODULE_ID} | POLICY_REVOKED (no agent connected yet) |`, payload);
  return payload;
}

// The v1 trigger (§4.7's "the only trigger v1 has"). Wire format resolved
// M7 (STATUS.md): a dedicated TRIGGER envelope type (module -> agent,
// { text }, fire-and-forget) rather than overloading EVENT, whose `event`
// field is a closed enum tied to eventbus.js's HOOKS table — a GM-authored
// command isn't hook telemetry. socket.js registers the real sender here at
// connect time, same "callback set at init" shape as
// registerPolicyRevokedSender just above.
//
// Fire-and-forget note() write, same pattern as interceptor.js's reject() —
// the input must clear immediately, not wait on a journal write. Live-Foundry
// testing (2026-08-12) found this was only ever console.log'd, never actually
// written to the journal, despite STATUS.md recording it as done.
let triggerSender = null;

export function registerTriggerSender(fn) {
  triggerSender = fn;
}

export function sendTrigger(text) {
  const trigger = { type: "gm_command", text };
  lastTrigger = { text, ts: Date.now() };
  if (triggerSender) triggerSender({ text });
  else console.log(`${MODULE_ID} | TRIGGER (no agent connected yet) |`, trigger);
  note(trigger);
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
          toggleCollapse: GMDelegatePanel._onToggleCollapse,
          cardAccept: GMDelegatePanel._onCardAccept,
          cardEditStart: GMDelegatePanel._onCardEditStart,
          cardEditCancel: GMDelegatePanel._onCardEditCancel,
          cardEditConfirm: GMDelegatePanel._onCardEditConfirm,
          cardReroll: GMDelegatePanel._onCardReroll,
          cardSkip: GMDelegatePanel._onCardSkip,
        },
      };

      // UI-only, not persisted (resets on reload) and not routed through
      // journal/policy — collapsing the bar has no game-state effect, unlike
      // every other action here.
      collapsed = false;

      static PARTS = {
        panel: { template: "modules/gm-delegate/templates/panel.hbs" },
      };

      async _prepareContext(_options) {
        const policy = getPolicy();
        const cards = [];
        const otherQueued = [];
        for (const q of queued) {
          if (q.action !== "propose_encounter" || !q.proposalId) {
            otherQueued.push(JSON.stringify(q, null, 2));
            continue;
          }
          const proposal = getProposal(q.proposalId);
          if (!proposal) continue; // expired between queue() and this render; sweepExpired() logs it
          // The panel is docked and GM-only (§4.7) — a render is the closest
          // proxy v1 has to "the GM saw this," which is exactly what
          // distinguishes skip (opened, then refused) from expired (never
          // seen) at §5.7.
          markProposalOpened(q.proposalId);
          cards.push(buildCardViewModel(proposal, editing === q.proposalId));
        }
        return {
          chips: CHIPS.map(({ key, label }) => {
            // Display the enforced mode (modeFor), not the raw stored
            // decide value — sceneOverride: "all_off" (RECLAIM) forces
            // every subsystem off at the interceptor without touching each
            // subsystem's stored decide, and the chip must show that or the
            // GM sees a stale "still delegated" state during a RECLAIM.
            const mode = modeFor(key, "decide");
            return { key, label, mode, active: mode !== "off" };
          }),
          reclaimed: policy.sceneOverride === "all_off",
          cards,
          queued: otherQueued,
          anyQueued: cards.length > 0 || otherQueued.length > 0,
          collapsed: this.collapsed,
        };
      }

      _onFirstRender(context, options) {
        super._onFirstRender?.(context, options);
        activeInstance = this;
        // Delegated on the root element (persists across PARTS re-renders,
        // unlike the <input> itself) so Enter submits the same way [ ask ]
        // does. Live-Foundry testing (2026-08-12) found this was never
        // wired despite the M3 Done-when list requiring it — only the
        // button's click handler existed.
        this.element.addEventListener("keydown", (event) => {
          if (event.key !== "Enter") return;
          if (!event.target.matches('input[name="triggerText"]')) return;
          event.preventDefault();
          GMDelegatePanel._onAsk.call(this);
        });
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

      static _onToggleCollapse() {
        this.collapsed = !this.collapsed;
        this.render();
      }

      static async _onCardAccept(_event, target) {
        await acceptProposal(target.dataset.proposalId);
      }

      static _onCardEditStart(_event, target) {
        startEdit(target.dataset.proposalId);
      }

      static _onCardEditCancel() {
        cancelEdit();
      }

      static async _onCardEditConfirm(_event, target) {
        const proposalId = target.dataset.proposalId;
        const textarea = this.element.querySelector(`textarea[data-proposal-id="${proposalId}"]`);
        await confirmEdit(proposalId, textarea?.value ?? "");
      }

      static async _onCardReroll(_event, target) {
        await rerollProposal(target.dataset.proposalId);
      }

      static async _onCardSkip(_event, target) {
        await skipProposal(target.dataset.proposalId);
      }
    }
  : GMDelegatePanelUnavailable;
