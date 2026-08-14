// index.js — entrypoint. `npm start` from gm-delegate-agent/.
//
// Also doubles as a manual stdin driver for testing without a live Panel:
// "reject" (hard-ban round trip), "events"/"revoked" (wire state), "resolve
// [N]" (the real two-stage encounter flow, same code path a live TRIGGER
// fires — see runEncounterFlow below).

import { loadConfig } from "./config.js";
import { Orchestrator } from "./orchestrator.js";
import { startServer } from "./server.js";
import { ModelClient } from "./modelClient.js";
import { runStage, resolveDomainTools, sceneDomainTools, resolveWorkspace } from "./stageRunner.js";

const config = loadConfig();
const orchestrator = new Orchestrator();
const modelClient = new ModelClient(config);
const workspace = resolveWorkspace(config.workspace);

startServer(config.ws, orchestrator);
console.log(`gm-delegate-agent | listening on ws://${config.ws.host}:${config.ws.port}`);
console.log('gm-delegate-agent | stdin commands: "reject", "events", "revoked", "resolve [N]"');

const RESOLVE_SCENARIO = "three days through the Thornwood Road at dusk";

// M7: chains 20_resolve -> 30_scene in one process, no file I/O between them
// (STATUS.md: "two in-memory stages", chosen over the fuller file-based ICM
// design for latency and because no validate.py infra exists here). This is
// the one real path from a GM's trigger text to a rendered card — both the
// live TRIGGER frame (orchestrator.onTrigger, below) and the manual "resolve"
// stdin command run through it, so there is exactly one place this logic
// lives.
//
// 20_resolve's own contract (gm-session/20_resolve/CONTEXT.md) ends at
// reporting a mechanical result; it does not call propose_encounter — that
// tool is deliberately not in resolveDomainTools' surface (§5.2's pruning
// argument applies per stage, not just per subsystem). 30_scene turns that
// result into the card, with propose_encounter as its only domain tool.
//
// list_roll_tables is resolved here in code, not by the model (STATUS.md
// 2026-08-14 session 10, Opus agent's option 4): it's a deterministic
// Foundry query with no judgment call in it, so spending a full model
// completion just to ask "what tables exist" was pure latency cost. The
// model still picks which table fits the trigger — it reads the list from
// board state instead of calling a tool for it.
async function fetchRollTables() {
  try {
    const outcome = await orchestrator.sendIntent({
      subsystem: "random_encounters",
      stage: "prompt", // §4.3: mechanical/drafting work — auto under DEFAULT_POLICY
      action: "list_roll_tables",
      args: { filter: "" },
    });
    if (outcome.status !== "EXECUTED") return { error: outcome.reason ?? outcome.status };
    // executor wraps its data as { result: {...}, created: [] } (spec §5.2's
    // own code sample) — unwrap one level, same as resolveDomainTools does.
    return outcome.result?.result ?? outcome.result;
  } catch (err) {
    return { error: err.message };
  }
}

async function runEncounterFlow(text) {
  const tables = await fetchRollTables();
  const resolveContent = [
    `GM trigger: ${text}`,
    "Board state:",
    "  scene: (not yet threaded from foundry_state — v1 has no live entity linking, §7.3 is v2)",
    "  combat: false",
    `  roll tables: ${JSON.stringify(tables)}`,
  ].join("\n");

  const resolveResult = await runStage({
    stage: "20_resolve",
    workspace,
    modelClient,
    subagentKey: "encounter",
    userContent: resolveContent,
    domainTools: resolveDomainTools(orchestrator),
    // Neither 20_resolve's CONTEXT.md nor 30_scene's asks for catalog
    // lookups (30_scene's is explicit: "ground the scene in [trigger text
    // and 20_resolve's result] alone") — dropping fsTools here also deletes
    // the session-9 4th failure mode (fs-tool wandering after a
    // domain-tool error) outright, not just latency (STATUS.md 2026-08-14
    // session 10). useCatalog:false pairs with it: CATALOG.md is only
    // actionable via the tools just dropped, so it's dead weight in the
    // prompt for both of these stages either way.
    useFsTools: false,
    useCatalog: false,
    // Typical successful run is now 2 iterations (roll_on_table, final text)
    // — one fewer than when this cap was tuned, since list_roll_tables no
    // longer costs a model round trip (see fetchRollTables above). 4
    // (session 10) was too tight for the 3-iteration flow that existed
    // then; 6 (chosen by the user) restored full completion rate at that
    // length. Left at 6 rather than re-tightened now that the typical count
    // dropped again — re-verify live before changing it, don't assume.
    maxIterations: 6,
  });

  if (resolveResult.timedOut || !resolveResult.content) {
    console.error("gm-delegate-agent | runEncounterFlow | 20_resolve did not produce a result", resolveResult);
    return { resolveResult, sceneResult: null };
  }

  const sceneContent = [`GM trigger: ${text}`, "20_resolve's result:", resolveResult.content].join("\n\n");

  const sceneResult = await runStage({
    stage: "30_scene",
    workspace,
    modelClient,
    subagentKey: "encounter",
    userContent: sceneContent,
    domainTools: sceneDomainTools(orchestrator),
    useFsTools: false,
    useCatalog: false,
    // propose_encounter succeeding IS this stage's output (30_scene/CONTEXT.md);
    // stop immediately instead of spending a completion on final text nobody
    // reads (index.js/panel only ever consume sceneResult.toolLog).
    terminalTool: "propose_encounter",
    maxIterations: 3,
  });

  return { resolveResult, sceneResult };
}

// The live path: a GM types into the panel's trigger input (§4.7), the
// module sends TRIGGER (M7, no reply in v1 — fire-and-forget, same as
// EVENT), this fires the two-stage flow above. Errors are logged, not
// thrown into the WS message handler — a bad trigger must not take down the
// connection.
orchestrator.onTrigger((payload) => {
  runEncounterFlow(payload.text).catch((err) =>
    console.error("gm-delegate-agent | runEncounterFlow (from TRIGGER) failed", err)
  );
});

process.stdin.setEncoding("utf8");
process.stdin.on("data", async (line) => {
  const [cmd, ...rest] = line.trim().split(/\s+/);
  if (!cmd) return;
  try {
    if (cmd === "reject") {
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
      // Manual driver for the same runEncounterFlow() a live TRIGGER fires —
      // same role "reject" plays for the hard-ban path: hand-fire the real
      // thing over the real wire without needing a live Panel click.
      //
      // Optional "resolve N": runs N times in a loop and prints a tool-call
      // validity summary across both stages (STATUS.md 2026-08-13's
      // 75%-on-8-calls finding was too small a sample to trust; this reruns
      // it larger, same model, same scenario — not a model comparison, just
      // a bigger N).
      const n = Math.max(1, parseInt(rest[0], 10) || 1);
      const runs = [];
      for (let i = 0; i < n; i++) {
        const flow = await runEncounterFlow(RESOLVE_SCENARIO);
        runs.push(flow);
        if (n === 1) {
          console.log("RESOLVE:", JSON.stringify(flow, null, 2));
        } else {
          const proposed = flow.sceneResult?.toolLog.some((t) => t.name === "propose_encounter");
          console.log(`RESOLVE ${i + 1}/${n}:`, flow.resolveResult.timedOut || flow.sceneResult?.timedOut ? "TIMED OUT" : proposed ? "PROPOSED" : "NO PROPOSAL");
        }
      }
      if (n > 1) {
        const allCalls = runs.flatMap((r) => [...r.resolveResult.toolLog, ...(r.sceneResult?.toolLog ?? [])]);
        const rollCalls = allCalls.filter((t) => t.name === "roll_on_table");
        const proposeCalls = allCalls.filter((t) => t.name === "propose_encounter");
        const validCalls = (calls) =>
          calls.filter((t) => {
            try {
              return !JSON.parse(t.result).error;
            } catch {
              return true; // not JSON with an error field => a real result object
            }
          });
        const validRolls = validCalls(rollCalls);
        const validProposals = validCalls(proposeCalls);
        const completedRuns = runs.filter((r) => !r.resolveResult.timedOut && r.sceneResult && !r.sceneResult.timedOut);
        console.log("RESOLVE SUMMARY:", {
          runs: n,
          completedRuns: completedRuns.length,
          rollOnTableCalls: rollCalls.length,
          validRollCalls: validRolls.length,
          proposeEncounterCalls: proposeCalls.length,
          validProposeCalls: validProposals.length,
          invalidArgs: [...rollCalls, ...proposeCalls]
            .filter((t) => !validRolls.includes(t) && !validProposals.includes(t))
            .map((t) => ({ name: t.name, args: t.args })),
        });
      }
    } else {
      console.log('unknown command. Try: "reject", "events", "revoked", "resolve [N]"');
    }
  } catch (err) {
    console.error("command failed:", err.message);
  }
});
