// executors/index.js — the allowlist. If an action has no entry here, it does
// not exist. This is why the hard bans are cheap: nobody ever writes an
// executor for actor.hp.write, document.delete, macro.execute, or
// compendium.searchAll. Never build them.

import * as testM1 from "./test-m1.js";

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

export const EXECUTORS = Object.freeze(registry);
