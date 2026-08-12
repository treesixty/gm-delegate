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
import { GMDelegatePanel, Panel, shouldShowPanel, takeCombatant } from "./panel.js";
import { registerHooks as registerEventBusHooks, getBuffer, registerEventSender, extractRoll } from "./eventbus.js";

Hooks.once("init", () => {
  registerJournalSettings();
  registerPolicySettings();

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
  // Console access for M1/M2/M3 testing; the socket (M5) becomes the real
  // caller of handleIntent.
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
  };

  registerEventBusHooks();

  if (shouldShowPanel()) {
    const panel = new GMDelegatePanel();
    panel.render(true);
    game.modules.get("gm-delegate").panel = panel;
  }

  console.log("gm-delegate | ready");
});
