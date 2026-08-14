// stageRunner.js — ICM stage execution (spec §5.5), validated by the M5a walk
// test (STATUS.md, 2026-08-13). Runs one stage: hands the model exactly
// IDENTITY.md + root CONTEXT.md + that stage's own CONTEXT.md — no
// pre-loaded catalog content, per the M5a briefing's "do not defeat the
// test" rule — and lets it find catalog files itself via read_file/list_files
// scoped to the workspace.
//
// M6 scope: only 20_resolve's domain tools (list_roll_tables, roll_on_table)
// go over the real wire here (orchestrator.sendIntent). 10_watch/30_scene
// were validated by the M5a walk test using synthetic tool results; wiring
// THEM for real — propose_encounter's wire path, the live EventBus trigger
// chain that would drive 10_watch automatically — is M7/recap territory
// (build-order §8 row 7), not M6's. See STATUS.md.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, relative, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAX_TOOL_ITERATIONS = 8;

// config.yaml's `workspace` is relative to the config FILE (gm-delegate-agent/),
// matching config.js's own __dirname-based resolution — not to process.cwd(),
// which depends on how the process was launched.
export function resolveWorkspace(configWorkspace) {
  return resolve(__dirname, "..", configWorkspace);
}

function safeResolve(workspace, relPath) {
  const abs = resolve(workspace, relPath);
  const rel = relative(workspace, abs);
  if (rel.startsWith("..") || rel.split(sep).includes("..")) {
    throw new Error(`path escapes workspace: ${relPath}`);
  }
  return abs;
}

function fsTools(workspace) {
  const definitions = [
    {
      type: "function",
      function: {
        name: "list_files",
        description: "List files/directories in the gm-session workspace.",
        parameters: { type: "object", properties: { dir: { type: "string", description: "Path relative to workspace root. Default '.'." } } },
      },
    },
    {
      type: "function",
      function: {
        name: "read_file",
        description: "Read a file's content from the gm-session workspace.",
        parameters: {
          type: "object",
          required: ["path"],
          properties: { path: { type: "string", description: "Path relative to workspace root, e.g. _npcs/innkeeper.md" } },
        },
      },
    },
  ];
  function call(name, args) {
    if (name === "list_files") {
      const dir = safeResolve(workspace, args.dir ?? ".");
      return JSON.stringify(readdirSync(dir).map((n) => (statSync(join(dir, n)).isDirectory() ? `${n}/` : n)));
    }
    if (name === "read_file") return readFileSync(safeResolve(workspace, args.path), "utf8");
    return undefined;
  }
  return { definitions, call, names: new Set(definitions.map((d) => d.function.name)) };
}

// 20_resolve's domain tools, sent as real INTENTs over the wire — this is
// the thing M6's Done-when actually tests (Foundry's real roll, the model
// never computing a number).
export function resolveDomainTools(orchestrator) {
  const definitions = [
    {
      type: "function",
      function: {
        name: "list_roll_tables",
        description: "List roll tables in the world. Filter by name substring.",
        parameters: { type: "object", properties: { filter: { type: "string" } } },
      },
    },
    {
      type: "function",
      function: {
        name: "roll_on_table",
        description:
          "Roll on a table. Foundry performs the roll. Returns the drawn result, the dice that produced it, and the resolved quantity. Does NOT display to chat.",
        parameters: { type: "object", required: ["tableId"], properties: { tableId: { type: "string" } } },
      },
    },
  ];
  async function call(name, args) {
    const outcome = await orchestrator.sendIntent({
      subsystem: "random_encounters",
      stage: "prompt", // §4.3: mechanical/drafting work — auto under DEFAULT_POLICY
      action: name,
      args,
    });
    if (outcome.status !== "EXECUTED") return JSON.stringify({ error: outcome.reason ?? outcome.status });
    // roll_on_table's executor wraps its data as { result: {...}, created: [] }
    // (spec §5.2's own code sample) — unwrap one level for the model.
    return JSON.stringify(outcome.result?.result ?? outcome.result);
  }
  return { definitions, call, names: new Set(definitions.map((d) => d.function.name)) };
}

export async function runStage({ stage, workspace, modelClient, subagentKey, userContent, domainTools }) {
  const IDENTITY = readFileSync(safeResolve(workspace, "IDENTITY.md"), "utf8");
  const ROOT_CONTEXT = readFileSync(safeResolve(workspace, "CONTEXT.md"), "utf8");
  const STAGE_CONTEXT = readFileSync(safeResolve(workspace, `${stage}/CONTEXT.md`), "utf8");

  const fs_ = fsTools(workspace);
  const tools = [...fs_.definitions, ...(domainTools?.definitions ?? [])];

  const preamble =
    "You are running in this workspace; here are the files. " +
    "Your final chat response — once you are done calling tools — is taken verbatim as this stage's output. " +
    "You have no write tool and do not need one.";
  const messages = [
    { role: "system", content: [preamble, IDENTITY, ROOT_CONTEXT, STAGE_CONTEXT].join("\n\n---\n\n") },
    { role: "user", content: userContent },
  ];

  const toolLog = [];
  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const res = await modelClient.chatComplete(subagentKey, { messages, tools });
    const msg = res.choices[0].message;
    if (msg.tool_calls?.length) {
      messages.push(msg);
      for (const tc of msg.tool_calls) {
        const args = JSON.parse(tc.function.arguments || "{}");
        let result;
        try {
          if (fs_.names.has(tc.function.name)) result = fs_.call(tc.function.name, args);
          else if (domainTools?.names.has(tc.function.name)) result = await domainTools.call(tc.function.name, args);
          else result = JSON.stringify({ error: `unknown tool: ${tc.function.name}` });
        } catch (err) {
          result = JSON.stringify({ error: err.message });
        }
        toolLog.push({ name: tc.function.name, args, result });
        messages.push({ role: "tool", tool_call_id: tc.id, content: result });
      }
      continue;
    }
    return { stage, content: msg.content ?? "", reasoning: msg.reasoning_content ?? "", toolLog, iterations: i + 1 };
  }
  return { stage, content: null, reasoning: "", toolLog, iterations: MAX_TOOL_ITERATIONS, timedOut: true };
}
