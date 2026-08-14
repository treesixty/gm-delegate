// stageRunner.js — ICM stage execution (spec §5.5), validated by the M5a walk
// test (STATUS.md, 2026-08-13). Runs one stage: hands the model exactly
// IDENTITY.md + root CONTEXT.md + that stage's own CONTEXT.md — no
// pre-loaded catalog content, per the M5a briefing's "do not defeat the
// test" rule — and lets it find catalog files itself via read_file/list_files
// scoped to the workspace.
//
// M6 wired 20_resolve's domain tools over the real wire (roll_on_table;
// list_roll_tables moved out of the model-facing surface in session 10, see
// resolveDomainTools' own header). M7 adds 30_scene's one real tool (propose_encounter,
// sceneDomainTools below) — the two stages run as two separate runStage()
// calls chained in one process by gm-delegate-agent/src/index.js's
// runEncounterFlow(), no file I/O between them (STATUS.md: "two in-memory
// stages" over the fuller file-based ICM chain, chosen for latency and
// because no validate.py infra exists in this all-JS project). 10_watch
// (linking a live trigger to a catalog doc) is still not wired for real —
// M7's TRIGGER carries only GM text, no entity link — left for whenever the
// live EventBus trigger chain (v2, §7) lands.
//
// Tool calling and message shapes are pi-ai's (2026-08-13 decision,
// STATUS.md): Context.messages are UserMessage/AssistantMessage/
// ToolResultMessage, tool parameters are TypeBox schemas, and a ToolCall's
// `arguments` arrive already parsed — no more hand-rolled JSON.parse().

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, relative, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "@earendil-works/pi-ai";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAX_TOOL_ITERATIONS = 8;

// config.yaml's `workspace` is relative to the config FILE (gm-delegate-agent/),
// matching config.js's own __dirname-based resolution — not to process.cwd(),
// which depends on how the process was launched.
export function resolveWorkspace(configWorkspace) {
  return resolve(__dirname, "..", configWorkspace);
}

function resultHasError(resultText) {
  try {
    return Boolean(JSON.parse(resultText).error);
  } catch {
    return false; // not JSON with an error field => a real result
  }
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
  const tools = [
    {
      name: "list_files",
      // required, not optional (see resolveDomainTools' comment on why —
      // llama.cpp #20164 ties Qwen3.5 tool-call looping to optional params)
      description: "List files/directories in the gm-session workspace. Pass '.' for the workspace root.",
      parameters: Type.Object({
        dir: Type.String({ description: "Path relative to workspace root. Use '.' for the root." }),
      }),
    },
    {
      name: "read_file",
      description: "Read a file's content from the gm-session workspace.",
      parameters: Type.Object({
        path: Type.String({ description: "Path relative to workspace root, e.g. _npcs/innkeeper.md" }),
      }),
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
  return { tools, call, names: new Set(tools.map((t) => t.name)) };
}

// 20_resolve's domain tools, sent as real INTENTs over the wire — this is
// the thing M6's Done-when actually tests (Foundry's real roll, the model
// never computing a number).
//
// `list_roll_tables` is NOT exposed here (STATUS.md 2026-08-14 session 10,
// Opus agent's option 4) — it's a deterministic Foundry query with no
// judgment call in it, so spending a full model completion just to ask for
// it was pure latency cost, not a decision worth delegating. index.js now
// calls it directly in code and injects the result into 20_resolve's
// userContent as board state; the model still picks which table fits the
// trigger, it just reads the list instead of calling a tool for it.
//
// Hardening change, 2026-08-13 (STATUS.md), after finding the model would
// repeatedly call roll_on_table instead of stopping once it had a real
// result — a documented agentic-loop failure class, not something to rely
// on prompting alone to fix ("developers should not rely on the model to
// eventually stop producing tool calls," arXiv 2607.01641): roll_on_table
// is capped at one real roll per stage run. A second call in the same run
// returns the cached first result instead of rolling again — this is also
// a correctness property, not just a loop workaround: the stage contract
// is exactly one roll, so a second real roll would itself be a kind of
// fabrication (the GM never asked for two encounters).
export function resolveDomainTools(orchestrator) {
  let cachedRoll = null;
  const tools = [
    {
      name: "roll_on_table",
      description:
        "Roll on a table. Foundry performs the roll. Returns the drawn result, the dice that produced it, and the resolved quantity. Does NOT display to chat. Callable at most once per encounter — a second call returns the same result, it does not roll again.",
      parameters: Type.Object({ tableId: Type.String() }),
    },
  ];
  async function call(name, args) {
    if (name === "roll_on_table" && cachedRoll) {
      return JSON.stringify({ ...cachedRoll, note: "already rolled this encounter — report this result and stop" });
    }
    const outcome = await orchestrator.sendIntent({
      subsystem: "random_encounters",
      stage: "prompt", // §4.3: mechanical/drafting work — auto under DEFAULT_POLICY
      action: name,
      args,
    });
    if (outcome.status !== "EXECUTED") return JSON.stringify({ error: outcome.reason ?? outcome.status });
    // roll_on_table's executor wraps its data as { result: {...}, created: [] }
    // (spec §5.2's own code sample) — unwrap one level for the model.
    const result = outcome.result?.result ?? outcome.result;
    if (name === "roll_on_table") cachedRoll = result;
    return JSON.stringify(result);
  }
  return { tools, call, names: new Set(tools.map((t) => t.name)) };
}

// 30_scene's one real tool (§5.2/§5.4, M7): propose_encounter. Mirrors
// contracts/tools.json's schema in TypeBox, same "hand-written, not loaded
// from the JSON file" convention resolveDomainTools already established for
// 20_resolve's tools.
//
// Unlike roll_on_table, QUEUED (not EXECUTED) is success: DEFAULT_POLICY
// routes propose_encounter straight to the module's Panel.queue() in
// "propose" mode without ever reaching an executor (M6 finding, STATUS.md —
// there is deliberately no executor registered for this action). Anything
// else — REJECTED (policy off), or the UNKNOWN_ACTION a flipped-to-"auto"
// policy would produce, since no executor exists for this action even then
// — is reported back to the model as an error, per 20_resolve/CONTEXT.md's
// own rule: a tool surface that can't do what the moment needs escalates,
// it doesn't get worked around.
export function sceneDomainTools(orchestrator) {
  const tools = [
    {
      name: "propose_encounter",
      description:
        "Emit an encounter proposal card for the GM. Does not place anything. Write BEATS the GM can perform from, never prose.",
      parameters: Type.Object({
        creatures: Type.Array(
          Type.Object({
            name: Type.String({ description: "e.g. 'Wolf Pack'." }),
            quantity: Type.Integer({
              minimum: 1,
              description: "Comes from roll_on_table's resolved quantity. If you computed this yourself, that is a bug.",
            }),
            descriptor: Type.String({ description: "e.g. 'lean, winter-starved'. A phrase, not a sentence." }),
            packId: Type.String({ description: "From roll_on_table's result. Do not invent one." }),
            actorId: Type.String({ description: "From roll_on_table's result. Do not invent one." }),
          })
        ),
        beats: Type.Array(Type.String({ minLength: 3, maxLength: 90 }), {
          minItems: 3,
          maxItems: 5,
          description: "3 to 5 short fragments the GM performs from. Never prose, never a full sentence to read verbatim.",
        }),
        hook: Type.String({ minLength: 3, maxLength: 120, description: "One line. Why is this here? What does it imply?" }),
        provenance: Type.Object({
          tableId: Type.String(),
          roll: Type.Integer(),
          tableDice: Type.String({ description: "e.g. '1d20'." }),
          result: Type.String({ description: "The drawn row, verbatim." }),
          quantity: Type.Integer({ minimum: 1 }),
          quantityDice: Type.String({ description: "e.g. '2d4=5'. From roll_on_table, never computed here." }),
        }),
      }),
    },
  ];
  async function call(name, args) {
    const outcome = await orchestrator.sendIntent({
      subsystem: "random_encounters",
      stage: "decide", // §4.3: propose_encounter is the decide-stage action
      action: name,
      args,
    });
    if (outcome.status !== "QUEUED") return JSON.stringify({ error: outcome.reason ?? outcome.status });
    return JSON.stringify({ status: "QUEUED" });
  }
  return { tools, call, names: new Set(tools.map((t) => t.name)) };
}

export async function runStage({
  stage,
  workspace,
  modelClient,
  subagentKey,
  userContent,
  domainTools,
  // Not every stage needs workspace exploration — 20_resolve/30_scene don't
  // (index.js opts them out, STATUS.md 2026-08-14 session 10: this also
  // deletes the session-9 4th failure mode, fs-tool wandering after a
  // domain-tool error). Left on by default so any future stage that DOES
  // want catalog lookups (per this file's original M5a design) still gets
  // it without passing anything.
  useFsTools = true,
  // Name of a tool whose successful (non-error) call means this stage is
  // done — skips the extra completion the loop would otherwise spend just
  // to produce a final text response nobody reads (index.js's 30_scene
  // call: propose_encounter succeeding IS the output, per
  // gm-session/30_scene/CONTEXT.md).
  terminalTool,
  maxIterations = MAX_TOOL_ITERATIONS,
}) {
  const IDENTITY = readFileSync(safeResolve(workspace, "IDENTITY.md"), "utf8");
  const ROOT_CONTEXT = readFileSync(safeResolve(workspace, "CONTEXT.md"), "utf8");
  const STAGE_CONTEXT = readFileSync(safeResolve(workspace, `${stage}/CONTEXT.md`), "utf8");

  const fs_ = useFsTools ? fsTools(workspace) : { tools: [], call: () => undefined, names: new Set() };
  const tools = [...fs_.tools, ...(domainTools?.tools ?? [])];

  const systemPrompt = [
    "You are running in this workspace; here are the files.",
    "Your final chat response — once you are done calling tools — is taken verbatim as this stage's output.",
    "You have no write tool and do not need one.",
    IDENTITY,
    ROOT_CONTEXT,
    STAGE_CONTEXT,
  ].join("\n\n---\n\n");
  const messages = [{ role: "user", content: userContent, timestamp: Date.now() }];

  const toolLog = [];
  for (let i = 0; i < maxIterations; i++) {
    const callStart = Date.now();
    const assistantMessage = await modelClient.chatComplete(subagentKey, { systemPrompt, messages, tools });
    // Perf instrumentation for the §9 latency investigation (STATUS.md,
    // 2026-08-14 session 10) — cacheRead tells us whether llama-server is
    // actually reusing the cached system-prompt prefix across calls.
    const u = assistantMessage.usage;
    console.log(
      `stageRunner | ${stage} call ${i + 1}: ${Date.now() - callStart}ms, input=${u?.input} output=${u?.output} cacheRead=${u?.cacheRead}`
    );
    // Reasoning is off server-side (see modelClient.js), so this is normally
    // a no-op — but Qwen's own model card says prior-turn thinking must not
    // be replayed into history ("exclude thinking content from multi-turn
    // conversation history"), so strip it defensively rather than assume
    // reasoning stays off forever if a model gets swapped later.
    messages.push({ ...assistantMessage, content: assistantMessage.content.filter((b) => b.type !== "thinking") });

    const toolCalls = assistantMessage.content.filter((b) => b.type === "toolCall");
    if (toolCalls.length) {
      let hitTerminalTool = false;
      for (const tc of toolCalls) {
        let resultText;
        let isError = false;
        try {
          if (fs_.names.has(tc.name)) resultText = fs_.call(tc.name, tc.arguments);
          else if (domainTools?.names.has(tc.name)) resultText = await domainTools.call(tc.name, tc.arguments);
          else {
            resultText = JSON.stringify({ error: `unknown tool: ${tc.name}` });
            isError = true;
          }
        } catch (err) {
          resultText = JSON.stringify({ error: err.message });
          isError = true;
        }
        toolLog.push({ name: tc.name, args: tc.arguments, result: resultText });
        messages.push({
          role: "toolResult",
          toolCallId: tc.id,
          toolName: tc.name,
          content: [{ type: "text", text: resultText }],
          isError,
          timestamp: Date.now(),
        });
        // Not just !isError — that flag only covers transport-level failures
        // (unknown tool, a thrown exception). domainTools.call() reports a
        // domain-level failure (e.g. REJECTED) as a normal resolved string
        // like {"error":"POLICY_OFF"}, same convention index.js's own
        // validCalls() checks — so a terminal tool must be judged the same
        // way, or a rejected propose_encounter would wrongly short-circuit
        // the loop as if it had succeeded.
        if (tc.name === terminalTool && !isError && !resultHasError(resultText)) hitTerminalTool = true;
      }
      if (hitTerminalTool) return { stage, content: null, reasoning: "", toolLog, iterations: i + 1 };
      continue;
    }

    const content = assistantMessage.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    const reasoning = assistantMessage.content
      .filter((b) => b.type === "thinking")
      .map((b) => b.thinking)
      .join("");
    return { stage, content, reasoning, toolLog, iterations: i + 1 };
  }
  return { stage, content: null, reasoning: "", toolLog, iterations: maxIterations, timedOut: true };
}
