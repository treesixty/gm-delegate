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

// "I'll take this one" (§4.7, right-click a combatant in the tracker). Hook
// name confirmed only indirectly: TypeDoc shows CombatTracker's protected
// `_getEntryContextOptions()` (foundryvtt.com/api, 2026-08-11) but not the
// Hooks.callAll it makes internally. `getCombatTrackerEntryContext` is the
// established name for that call across recent Foundry versions and nothing
// in §0's v14 changelog rows says it moved — recorded as HIGH volatility
// in spec §0. Re-verify live if this silently never fires.
Hooks.on("getCombatTrackerEntryContext", (_html, options) => {
  options.push({
    name: "gm-delegate.takeThisOne",
    icon: '<i class="fas fa-microphone"></i>',
    condition: () => game.user.isGM,
    callback: () => takeCombatant(),
  });
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
