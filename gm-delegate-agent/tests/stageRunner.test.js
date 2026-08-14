// stageRunner.js (spec §5.5/§5.2, M6). Drives runStage() against a small
// self-contained fixture workspace (not the real gm-session/ — that's this
// project's content, not this test's concern) and a fake ModelClient/
// Orchestrator, same "expose only what's actually called" minimalism the
// module side's tests/setup.js and this package's orchestrator.test.js use.
//
// The fake ModelClient returns pi-ai's AssistantMessage shape directly
// (content: (text|thinking|toolCall)[]) — matching the real ModelClient
// since the 2026-08-13 pi-ai swap (STATUS.md) — not raw OpenAI JSON.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Orchestrator } from "../src/orchestrator.js";
import { runStage, resolveDomainTools, sceneDomainTools } from "../src/stageRunner.js";

let workspace;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), "gm-delegate-stagerunner-"));
  writeFileSync(join(workspace, "IDENTITY.md"), "# IDENTITY\nprompter, never a voice.");
  writeFileSync(join(workspace, "CONTEXT.md"), "# CONTEXT\nworkspace map.");
  mkdirSync(join(workspace, "20_resolve"));
  writeFileSync(join(workspace, "20_resolve", "CONTEXT.md"), "# 20_resolve\ncall a tool, never compute.");
  mkdirSync(join(workspace, "30_scene"));
  writeFileSync(join(workspace, "30_scene", "CONTEXT.md"), "# 30_scene\ncall propose_encounter, never write prose.");
  mkdirSync(join(workspace, "_world"));
  writeFileSync(join(workspace, "_world", "secret.md"), "GM-only content the model must not need pre-loaded.");
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

function fakeModelClient(responses) {
  let i = 0;
  return { chatComplete: vi.fn(async () => responses[Math.min(i++, responses.length - 1)]) };
}

function toolCallResponse(name, args) {
  return { role: "assistant", content: [{ type: "toolCall", id: "tc1", name, arguments: args }] };
}
function finalResponse(text, thinking = "") {
  const content = [];
  if (thinking) content.push({ type: "thinking", thinking });
  content.push({ type: "text", text });
  return { role: "assistant", content };
}

// Auto-replies to any INTENT sent over a real Orchestrator, simulating the
// module side, so sendIntent()'s promise actually resolves.
function attachAutoReplyingConn(orchestrator, resultFor) {
  const conn = {
    send(data) {
      const frame = JSON.parse(data);
      if (frame.type !== "INTENT") return;
      const payload = resultFor(frame.payload);
      queueMicrotask(() => orchestrator.handleFrame({ type: "RESULT", id: frame.id, payload }));
    },
  };
  orchestrator.attach(conn);
  return conn;
}

describe("runStage — the I/O contract (§5.5, the M5a-fixed harness gap)", () => {
  it("hands the model IDENTITY + root CONTEXT + the stage's own CONTEXT via systemPrompt, nothing else pre-loaded", async () => {
    const modelClient = fakeModelClient([finalResponse("done")]);
    await runStage({ stage: "20_resolve", workspace, modelClient, subagentKey: "encounter", userContent: "go" });

    const [, { systemPrompt }] = modelClient.chatComplete.mock.calls[0];
    expect(systemPrompt).toContain("prompter, never a voice");
    expect(systemPrompt).toContain("workspace map");
    expect(systemPrompt).toContain("call a tool, never compute");
    expect(systemPrompt).not.toContain("GM-only content"); // never pre-loaded
  });

  it("returns the final content once the model stops calling tools", async () => {
    const modelClient = fakeModelClient([finalResponse("the answer")]);
    const result = await runStage({ stage: "20_resolve", workspace, modelClient, subagentKey: "encounter", userContent: "go" });
    expect(result).toMatchObject({ stage: "20_resolve", content: "the answer", iterations: 1 });
  });

  it("lets the model read a catalog file via read_file without it being pre-loaded", async () => {
    const modelClient = fakeModelClient([
      toolCallResponse("read_file", { path: "_world/secret.md" }),
      finalResponse("saw it"),
    ]);
    const result = await runStage({ stage: "20_resolve", workspace, modelClient, subagentKey: "encounter", userContent: "go" });
    expect(result.toolLog[0]).toMatchObject({ name: "read_file", args: { path: "_world/secret.md" } });
    expect(result.toolLog[0].result).toContain("GM-only content");
  });

  it("blocks a read_file path that tries to escape the workspace", async () => {
    const modelClient = fakeModelClient([
      toolCallResponse("read_file", { path: "../../etc/passwd" }),
      finalResponse("done"),
    ]);
    const result = await runStage({ stage: "20_resolve", workspace, modelClient, subagentKey: "encounter", userContent: "go" });
    expect(JSON.parse(result.toolLog[0].result).error).toMatch(/escapes workspace/);
  });

  it("times out cleanly after MAX_TOOL_ITERATIONS instead of looping forever", async () => {
    const modelClient = fakeModelClient([toolCallResponse("list_files", {})]); // always calls a tool, never finishes
    const result = await runStage({ stage: "20_resolve", workspace, modelClient, subagentKey: "encounter", userContent: "go" });
    expect(result.timedOut).toBe(true);
    expect(result.content).toBeNull();
  });

  it("respects a caller-supplied maxIterations instead of the module default", async () => {
    const modelClient = fakeModelClient([toolCallResponse("list_files", {})]); // never finishes
    const result = await runStage({
      stage: "20_resolve",
      workspace,
      modelClient,
      subagentKey: "encounter",
      userContent: "go",
      maxIterations: 2,
    });
    expect(result.timedOut).toBe(true);
    expect(result.iterations).toBe(2);
    expect(modelClient.chatComplete).toHaveBeenCalledTimes(2);
  });

  it("useFsTools: false drops list_files/read_file from the tool surface entirely", async () => {
    const modelClient = fakeModelClient([
      toolCallResponse("read_file", { path: "_world/secret.md" }),
      finalResponse("done"),
    ]);
    const result = await runStage({
      stage: "20_resolve",
      workspace,
      modelClient,
      subagentKey: "encounter",
      userContent: "go",
      useFsTools: false,
    });
    expect(JSON.parse(result.toolLog[0].result)).toEqual({ error: "unknown tool: read_file" });

    const [, { tools }] = modelClient.chatComplete.mock.calls[0];
    expect(tools).toHaveLength(0);
  });

  it("terminalTool short-circuits the loop on a successful call instead of spending an extra completion on final text", async () => {
    const modelClient = fakeModelClient([
      toolCallResponse("propose_encounter", { creatures: [] }),
      finalResponse("this should never be requested"),
    ]);
    const result = await runStage({
      stage: "30_scene",
      workspace,
      modelClient,
      subagentKey: "encounter",
      userContent: "go",
      domainTools: { tools: [], call: async () => JSON.stringify({ status: "QUEUED" }), names: new Set(["propose_encounter"]) },
      terminalTool: "propose_encounter",
    });
    expect(result.iterations).toBe(1);
    expect(result.content).toBeNull();
    expect(modelClient.chatComplete).toHaveBeenCalledTimes(1); // never asked for a 2nd completion
  });

  it("terminalTool does NOT short-circuit on an errored call — the model still gets a chance to react", async () => {
    const modelClient = fakeModelClient([
      toolCallResponse("propose_encounter", { creatures: [] }),
      finalResponse("could not propose"),
    ]);
    const result = await runStage({
      stage: "30_scene",
      workspace,
      modelClient,
      subagentKey: "encounter",
      userContent: "go",
      domainTools: {
        tools: [],
        call: async () => JSON.stringify({ error: "POLICY_OFF" }),
        names: new Set(["propose_encounter"]),
      },
      terminalTool: "propose_encounter",
    });
    expect(result.iterations).toBe(2);
    expect(result.content).toBe("could not propose");
  });
});

describe("resolveDomainTools — 20_resolve's tools go over the real wire (M6 Done-when)", () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new Orchestrator();
  });

  it("does NOT expose list_roll_tables — session 10 moved it to a code-side pre-resolve (index.js's fetchRollTables)", () => {
    const { tools, names } = resolveDomainTools(orchestrator);
    expect(names.has("list_roll_tables")).toBe(false);
    expect(tools.map((t) => t.name)).toEqual(["roll_on_table"]);
  });

  it("sends roll_on_table as a real INTENT, stage 'prompt', and unwraps the executor's nested result", async () => {
    attachAutoReplyingConn(orchestrator, (payload) => ({
      status: "EXECUTED",
      result: {
        // matches encounter.js's actual return shape: { result: {...}, created: [] }
        result: { drawn: ["[[2d4]] Wolf Pack"], tableDice: "1d20", tableTotal: 5, quantity: 8, quantityDice: "2d4=8" },
        created: [],
      },
    }));
    const modelClient = fakeModelClient([
      toolCallResponse("roll_on_table", { tableId: "RollTable.abc" }),
      finalResponse("tool: roll_on_table\nresult: reported"),
    ]);

    const result = await runStage({
      stage: "20_resolve",
      workspace,
      modelClient,
      subagentKey: "encounter",
      userContent: "go",
      domainTools: resolveDomainTools(orchestrator),
    });

    expect(result.toolLog[0].name).toBe("roll_on_table");
    const reported = JSON.parse(result.toolLog[0].result);
    expect(reported).toEqual({ drawn: ["[[2d4]] Wolf Pack"], tableDice: "1d20", tableTotal: 5, quantity: 8, quantityDice: "2d4=8" });
  });

  it("caps roll_on_table at one real roll per run — a second call returns the cached result, not a second INTENT (STATUS.md 2026-08-13)", async () => {
    let sendIntentCalls = 0;
    const conn = {
      send(data) {
        const frame = JSON.parse(data);
        if (frame.type !== "INTENT") return;
        sendIntentCalls++;
        const payload = {
          status: "EXECUTED",
          result: { result: { drawn: ["[[2d4]] Wolf Pack"], tableDice: "1d20", tableTotal: 5, quantity: 8, quantityDice: "2d4=8" }, created: [] },
        };
        queueMicrotask(() => orchestrator.handleFrame({ type: "RESULT", id: frame.id, payload }));
      },
    };
    orchestrator.attach(conn);

    // Reproduces the observed failure mode: the model calls roll_on_table
    // again even after a successful result.
    const modelClient = fakeModelClient([
      toolCallResponse("roll_on_table", { tableId: "RollTable.abc" }),
      toolCallResponse("roll_on_table", { tableId: "RollTable.abc" }),
      finalResponse("tool: roll_on_table\nresult: reported"),
    ]);

    const result = await runStage({
      stage: "20_resolve",
      workspace,
      modelClient,
      subagentKey: "encounter",
      userContent: "go",
      domainTools: resolveDomainTools(orchestrator),
    });

    expect(sendIntentCalls).toBe(1); // only the first call reached the wire
    expect(result.toolLog).toHaveLength(2);
    const secondCallResult = JSON.parse(result.toolLog[1].result);
    expect(secondCallResult.note).toMatch(/already rolled/);
    expect(secondCallResult.drawn).toEqual(["[[2d4]] Wolf Pack"]); // same cached result, not a fresh roll
  });

  it("never fabricates: a REJECTED intent is reported as an error, not a plausible number", async () => {
    attachAutoReplyingConn(orchestrator, () => ({ status: "REJECTED", reason: "POLICY_OFF" }));
    const modelClient = fakeModelClient([
      toolCallResponse("roll_on_table", { tableId: "RollTable.abc" }),
      finalResponse("could not resolve"),
    ]);

    const result = await runStage({
      stage: "20_resolve",
      workspace,
      modelClient,
      subagentKey: "encounter",
      userContent: "go",
      domainTools: resolveDomainTools(orchestrator),
    });

    expect(JSON.parse(result.toolLog[0].result)).toEqual({ error: "POLICY_OFF" });
  });
});

describe("sceneDomainTools — 30_scene's propose_encounter goes over the real wire (M7)", () => {
  let orchestrator;
  const creature = { name: "Wolf Pack", quantity: 5, descriptor: "lean, winter-starved", packId: "dnd5e.monsters", actorId: "wolf1" };
  const proposalArgs = {
    creatures: [creature],
    beats: ["Sound first.", "They circle.", "Leader hangs back."],
    hook: "Something worse drove them out of the deep wood.",
    provenance: { tableId: "RollTable.abc", roll: 14, tableDice: "1d20", result: "Wolf Pack", quantity: 5, quantityDice: "2d4=5" },
  };

  beforeEach(() => {
    orchestrator = new Orchestrator();
  });

  it("sends propose_encounter as a real INTENT, stage 'decide', and treats QUEUED as success", async () => {
    let sentPayload;
    attachAutoReplyingConn(orchestrator, (payload) => {
      sentPayload = payload;
      return { status: "QUEUED" };
    });
    const modelClient = fakeModelClient([
      toolCallResponse("propose_encounter", proposalArgs),
      finalResponse("proposed"),
    ]);

    const result = await runStage({
      stage: "30_scene",
      workspace,
      modelClient,
      subagentKey: "encounter",
      userContent: "go",
      domainTools: sceneDomainTools(orchestrator),
    });

    expect(sentPayload).toMatchObject({ subsystem: "random_encounters", stage: "decide", action: "propose_encounter", args: proposalArgs });
    expect(JSON.parse(result.toolLog[0].result)).toEqual({ status: "QUEUED" });
  });

  it("reports a REJECTED intent as an error, same discipline as roll_on_table", async () => {
    attachAutoReplyingConn(orchestrator, () => ({ status: "REJECTED", reason: "POLICY_OFF" }));
    const modelClient = fakeModelClient([
      toolCallResponse("propose_encounter", proposalArgs),
      finalResponse("could not propose"),
    ]);

    const result = await runStage({
      stage: "30_scene",
      workspace,
      modelClient,
      subagentKey: "encounter",
      userContent: "go",
      domainTools: sceneDomainTools(orchestrator),
    });

    expect(JSON.parse(result.toolLog[0].result)).toEqual({ error: "POLICY_OFF" });
  });
});
