// main.js — init and hook registration.

import {
  registerJournalSettings,
  logCard,
  getCardLog,
  beginTransaction,
  commit,
  note,
  undoLast,
  getJournal,
} from "./journal.js";
import { registerPolicySettings, getPolicy, modeFor } from "./policy.js";
import { handleIntent, execute } from "./interceptor.js";
import { EXECUTORS } from "./executors/index.js";
import { GMDelegatePanel, Panel, shouldShowPanel, takeCombatant, voiceNpc, isNpcActor, registerExecute } from "./panel.js";
import { registerHooks as registerEventBusHooks, getBuffer, registerEventSender, extractRoll } from "./eventbus.js";
import { registerSocketSettings, connect as connectSocket } from "./socket.js";
import {
  registerCardLogger,
  sweepExpired as sweepExpiredProposals,
  get as getProposal,
  getEntry as getProposalEntry,
} from "./proposals.js";

Hooks.once("init", () => {
  registerJournalSettings();
  registerPolicySettings();
  registerSocketSettings();

  // The card partial (templates/card-encounter.hbs, M7). loadTemplates()
  // registers a loaded template as a Handlebars partial keyed by the given
  // name (verified live against foundryvtt.com/api, spec §0) — panel.hbs's
  // {{> card-encounter}} depends on this having already run by the time the
  // panel first renders, so it happens at init, before ready.
  foundry.applications.handlebars.loadTemplates({ "card-encounter": "modules/gm-delegate/templates/card-encounter.hbs" });

  // "I'll take this one" (§4.7, right-click a combatant in the tracker).
  // Live-verified 2026-08-12 (RunPod pod, v14.365, dnd5e): v14's
  // ApplicationV2 CombatTracker dropped the getCombatTrackerEntryContext
  // hook entirely — core _getEntryContextOptions() returns a hardcoded
  // array literal, no Hooks.call/callAll anywhere in it. The old
  // Hooks.on(...) registration was dead code and also used the wrong
  // option shape (name/condition/callback instead of the real
  // label/icon/visible/onClick).
  //
  // Must patch here, in `init`, not `ready`: Foundry's ContextMenu binds to
  // the combat tracker's DOM in _onFirstRender, which runs before any
  // module's `ready` hook fires — a patch applied in `ready` (tried first,
  // live-confirmed not to work) is too late, the menu has already captured
  // the original unpatched method reference. Patching the global class
  // directly (confirmed live: `foundry.applications.sidebar.tabs.CombatTracker.prototype
  // === Object.getPrototypeOf(Object.getPrototypeOf(ui.combat))`) rather than
  // deriving it from `ui.combat`, which doesn't exist yet at `init`. dnd5e's
  // CombatTracker subclass calls super._getEntryContextOptions(), so the
  // patch is picked up through that chain regardless of system.
  const CombatTrackerBase = foundry.applications.sidebar.tabs.CombatTracker;
  const baseGetEntryContextOptions = CombatTrackerBase.prototype._getEntryContextOptions;
  CombatTrackerBase.prototype._getEntryContextOptions = function () {
    const options = baseGetEntryContextOptions.call(this);
    options.push({
      label: "I'll take this one",
      icon: '<i class="fas fa-microphone"></i>',
      visible: () => game.user.isGM,
      onClick: () => takeCombatant(),
    });
    return options;
  };
});

Hooks.once("ready", () => {
  connectSocket(); // spec §5.6, corrected: the module dials out, the agent listens.

  // proposals.js can't import journal.js directly (would close an import
  // cycle through executors/index.js -> encounter.js -> proposals.js — see
  // proposals.js's own header comment). Registered here instead, same
  // pattern as every other init-time callback in this file.
  registerCardLogger(logCard);
  // §5.7: expiry is a labelling event, not just cleanup. 60s granularity is
  // plenty against a 15-minute TTL.
  setInterval(() => sweepExpiredProposals(), 60_000);

  // panel.js's Accept/Edit buttons call place_encounter locally (not routed
  // through handleIntent()/mode — see panel.js's acceptProposal comment).
  // Registered here rather than imported in panel.js: interceptor.js already
  // imports Panel, so the reverse import would close a cycle.
  registerExecute(execute);

  // Console access for M1/M2/M3 testing; the socket (M5) is the real caller
  // of handleIntent now, this stays for manual/console-driven testing.
  game.modules.get("gm-delegate").api = {
    logCard,
    getCardLog,
    beginTransaction,
    commit,
    note,
    undoLast,
    getJournal,
    getPolicy,
    modeFor,
    handleIntent,
    execute,
    EXECUTORS,
    Panel,
    EventBus: { getBuffer, registerEventSender, extractRoll },
    Proposals: { get: getProposal, getEntry: getProposalEntry },
  };

  registerEventBusHooks();

  // "I'll voice this one" (§4.7, right-click an NPC token). Unlike the
  // combat-tracker context menu, renderTokenHUD is a real, live-firing hook
  // (confirmed 2026-08-12: canvas.hud.token.bind() dispatches it with a raw
  // HTMLFormElement, not jQuery) — no prototype patch needed, a plain
  // Hooks.on at ready time is enough since the HUD only renders on demand.
  Hooks.on("renderTokenHUD", (hud, html) => {
    const actor = hud.object?.actor;
    if (!isNpcActor(actor)) return;
    const rightCol = html.querySelector(".col.right");
    if (!rightCol) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "control-icon";
    button.dataset.action = "gmDelegateVoiceNpc";
    button.setAttribute("aria-label", "I'll voice this one");
    button.dataset.tooltip = "I'll voice this one";
    button.innerHTML = '<i class="fas fa-comment-dots"></i>';
    button.addEventListener("click", () => voiceNpc(actor.id));
    rightCol.appendChild(button);
  });

  if (shouldShowPanel()) {
    const panel = new GMDelegatePanel();
    panel.render(true);
    game.modules.get("gm-delegate").panel = panel;
  }

  console.log("gm-delegate | ready");
});
