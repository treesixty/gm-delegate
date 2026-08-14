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
import { runStage, resolveDomainTools } from "../src/stageRunner.js";

let workspace;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), "gm-delegate-stagerunner-"));
  writeFileSync(join(workspace, "IDENTITY.md"), "# IDENTITY\nprompter, never a voice.");
  writeFileSync(join(workspace, "CONTEXT.md"), "# CONTEXT\nworkspace map.");
  mkdirSync(join(workspace, "20_resolve"));
  writeFileSync(join(workspace, "20_resolve", "CONTEXT.md"), "# 20_resolve\ncall a tool, never compute.");
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
});

describe("resolveDomainTools — 20_resolve's tools go over the real wire (M6 Done-when)", () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new Orchestrator();
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
