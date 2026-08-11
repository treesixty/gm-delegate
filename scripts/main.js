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
import { EXECUTORS } from "./executors/index.js";

Hooks.once("init", () => {
  registerJournalSettings();
});

Hooks.once("ready", () => {
  // Console access for M1 testing; the Interceptor (M2) becomes the real
  // caller of beginTransaction/commit.
  game.modules.get("gm-delegate").api = {
    logCard,
    getCardLog,
    beginTransaction,
    commit,
    note,
    undoLast,
    getJournal,
    EXECUTORS,
  };
  console.log("gm-delegate | ready");
});
