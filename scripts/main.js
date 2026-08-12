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
});

Hooks.once("ready", () => {
  // "I'll take this one" (§4.7, right-click a combatant in the tracker).
  // Live-verified 2026-08-12 (RunPod pod, v14.365, dnd5e): v14's
  // ApplicationV2 CombatTracker dropped the getCombatTrackerEntryContext
  // hook entirely — core _getEntryContextOptions() returns a hardcoded
  // array literal, no Hooks.call/callAll anywhere in it. The old
  // Hooks.on(...) registration here was dead code and also used the wrong
  // option shape (name/condition/callback instead of the real
  // label/icon/visible/onClick). Only real extension point is patching the
  // method itself. Patched via ui.combat's own prototype chain, not a
  // guessed import path, since dnd5e's CombatTracker subclass calls
  // super._getEntryContextOptions() and prototype patches are picked up
  // live through that chain.
  const CombatTrackerBase = Object.getPrototypeOf(Object.getPrototypeOf(ui.combat)).constructor;
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
