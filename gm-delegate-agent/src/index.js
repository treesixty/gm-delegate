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
import { runStage, resolveDomainTools, resolveWorkspace } from "./stageRunner.js";

const config = loadConfig();
const orchestrator = new Orchestrator();
const modelClient = new ModelClient(config);
const workspace = resolveWorkspace(config.workspace);

startServer(config.ws, orchestrator);
console.log(`gm-delegate-agent | listening on ws://${config.ws.host}:${config.ws.port}`);
console.log(
  'gm-delegate-agent | stdin commands: "rename <actorUuid>", "reject", "events", "revoked", "resolve"'
);

const RESOLVE_SCENARIO = [
  "Linked catalog doc: _world/locations/thornwood-road.md",
  "Context: the party is travelling the Thornwood Road at dusk. Time for a random encounter check.",
  "Board state:",
  "  scene: Thornwood Road",
  "  combat: false",
  "  (call list_roll_tables if you need to find the right table id)",
].join("\n");

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
    } else if (cmd === "resolve") {
      // M6 (§5.2) manual driver — same role "rename"/"reject" play for M5:
      // no live EventBus-driven trigger exists yet (that's M7/recap
      // territory), so this hand-fires a 20_resolve stage run against a
      // travel-encounter scenario, over the real wire, against the real
      // Thornwood Road Encounters table.
      //
      // Optional "resolve N": runs N times in a loop and prints a tool-call
      // validity summary (STATUS.md 2026-08-13's 75%-on-8-calls finding was
      // too small a sample to trust; this reruns it larger, same model, same
      // scenario — not a model comparison, just a bigger N).
      const n = Math.max(1, parseInt(rest[0], 10) || 1);
      const userContent = RESOLVE_SCENARIO;
      const runs = [];
      for (let i = 0; i < n; i++) {
        const result = await runStage({
          stage: "20_resolve",
          workspace,
          modelClient,
          subagentKey: "encounter",
          userContent,
          domainTools: resolveDomainTools(orchestrator),
        });
        runs.push(result);
        if (n === 1) {
          console.log("RESOLVE:", JSON.stringify(result, null, 2));
        } else {
          console.log(`RESOLVE ${i + 1}/${n}:`, result.timedOut ? "TIMED OUT" : (result.content ?? "").slice(0, 80));
        }
      }
      if (n > 1) {
        const rollCalls = runs.flatMap((r) => r.toolLog.filter((t) => t.name === "roll_on_table"));
        const validCalls = rollCalls.filter((t) => {
          try {
            return !JSON.parse(t.result).error;
          } catch {
            return true; // not JSON with an error field => a real result object
          }
        });
        const completedRuns = runs.filter((r) => !r.timedOut && r.content);
        console.log("RESOLVE SUMMARY:", {
          runs: n,
          completedRuns: completedRuns.length,
          rollOnTableCalls: rollCalls.length,
          validCalls: validCalls.length,
          validityRate: rollCalls.length ? `${((validCalls.length / rollCalls.length) * 100).toFixed(1)}%` : "n/a",
          invalidArgs: rollCalls.filter((t) => !validCalls.includes(t)).map((t) => t.args),
        });
      }
    } else {
      console.log('unknown command. Try: "rename <actorUuid>", "reject", "events", "revoked"');
    }
  } catch (err) {
    console.error("command failed:", err.message);
  }
});
