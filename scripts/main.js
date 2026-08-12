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

Hooks.once("init", () => {
  registerJournalSettings();
  registerPolicySettings();
});

Hooks.once("ready", () => {
  // Console access for M1/M2 testing; the socket (M5) becomes the real
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
  };
  console.log("gm-delegate | ready");
});
