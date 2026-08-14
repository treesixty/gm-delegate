// executors/index.js — the allowlist. If an action has no entry here, it does
// not exist. This is why the hard bans are cheap: nobody ever writes an
// executor for actor.hp.write, document.delete, macro.execute, or
// compendium.searchAll. Never build them.

import * as testM1 from "./test-m1.js";
import * as encounter from "./encounter.js";

const registry = {};

function register(name, run, touches) {
  if (typeof touches !== "function") {
    throw new Error(
      `gm-delegate | executor "${name}" registered without a touches() ` +
        `declaration — undo would silently do nothing. Declare it.`
    );
  }
  run.touches = touches;
  registry[name] = run;
}

// THROWAWAY (M1): exercises undo before any real executor exists.
// Delete these two lines and test-m1.js in M7, when encounter.js lands.
register("test.actor.rename", testM1.renameActor, testM1.renameActorTouches);
register("test.token.place", testM1.placeToken, testM1.placeTokenTouches);

// M6 (§5.2): random_encounters' mechanical-resolution tools. propose_encounter
// and place_encounter are NOT registered here — propose_encounter needs no
// executor (default policy routes it to Panel.queue() before EXECUTORS is
// ever consulted) and place_encounter's real dedupe/import/place logic is
// M7 scope (build-order §8 row 7), not M6's.
register("roll_on_table", encounter.rollOnTable, encounter.rollOnTableTouches);
register("list_roll_tables", encounter.listRollTables, encounter.listRollTablesTouches);
register("get_compendium_actor", encounter.getCompendiumActor, encounter.getCompendiumActorTouches);

export const EXECUTORS = Object.freeze(registry);
