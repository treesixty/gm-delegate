// executors/index.js — the allowlist. If an action has no entry here, it does
// not exist. This is why the hard bans are cheap: nobody ever writes an
// executor for actor.hp.write, document.delete, macro.execute, or
// compendium.searchAll. Never build them.

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

// M6 (§5.2): random_encounters' mechanical-resolution tools. propose_encounter
// is NOT registered here — it needs no executor (default policy routes it to
// Panel.queue() before EXECUTORS is ever consulted).
register("roll_on_table", encounter.rollOnTable, encounter.rollOnTableTouches);
register("list_roll_tables", encounter.listRollTables, encounter.listRollTablesTouches);
register("get_compendium_actor", encounter.getCompendiumActor, encounter.getCompendiumActorTouches);
// M7 (§5.2): the real dedupe/import/place executor, triggered locally by the
// panel's Accept & Place button (interceptor.js's execute(), not routed
// through mode/handleIntent — see panel.js).
register("place_encounter", encounter.placeEncounter, encounter.placeEncounterTouches);

export const EXECUTORS = Object.freeze(registry);
