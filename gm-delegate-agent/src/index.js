// index.js — entrypoint. `npm start` from gm-delegate-agent/.
//
// Also doubles as the manual driver for M5's Done-when checklist, the same
// role test-m1.js plays for M1: no EncounterAgent exists yet (M6), so a
// hardcoded intent typed at this process's stdin is what proves the
// round trip. Type one of: rename <actorUuid>, reject, events, revoked.

import { loadConfig } from "./config.js";
import { Orchestrator } from "./orchestrator.js";
import { startServer } from "./server.js";
import { ModelClient } from "./modelClient.js";

const config = loadConfig();
const orchestrator = new Orchestrator();
const modelClient = new ModelClient(config); // built per spec §5 Build; not called by anything yet (M6 does)
void modelClient;

startServer(config.ws, orchestrator);
console.log(`gm-delegate-agent | listening on ws://${config.ws.host}:${config.ws.port}`);
console.log('gm-delegate-agent | stdin commands: "rename <actorUuid>", "reject", "events", "revoked"');

process.stdin.setEncoding("utf8");
process.stdin.on("data", async (line) => {
  const [cmd, ...rest] = line.trim().split(/\s+/);
  if (!cmd) return;
  try {
    if (cmd === "rename") {
      const actorUuid = rest[0];
      if (!actorUuid) {
        console.log('usage: rename <actorUuid>  (e.g. from fromUuid()-resolvable console output in Foundry)');
        return;
      }
      const result = await orchestrator.sendIntent({
        subsystem: "random_encounters",
        stage: "prompt", // DEFAULT_POLICY: random_encounters.prompt = auto
        action: "test.actor.rename",
        args: { actorUuid, name: "Renamed by gm-delegate-agent" },
      });
      console.log("RESULT:", result);
    } else if (cmd === "reject") {
      const result = await orchestrator.sendIntent({
        subsystem: "random_encounters",
        stage: "prompt",
        action: "actor.hp.write", // hard-banned — always REJECTED
        args: {},
      });
      console.log("RESULT:", result);
    } else if (cmd === "events") {
      console.log("EVENTS:", orchestrator.getEvents());
    } else if (cmd === "revoked") {
      console.log("REVOKED:", orchestrator.revoked);
    } else {
      console.log('unknown command. Try: "rename <actorUuid>", "reject", "events", "revoked"');
    }
  } catch (err) {
    console.error("command failed:", err.message);
  }
});
