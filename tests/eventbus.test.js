// Spec §4.6. The M4 Done-when checklist, against eventbus.js's hook wiring
// and buffer, driven through the dispatching Hooks mock in tests/setup.js
// (Hooks.callAll invokes whatever registerHooks() registered via Hooks.on).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetFoundry } from "./setup.js";
import { registerHooks, registerEventSender, getBuffer, extractRoll, _resetForTests } from "../scripts/eventbus.js";

beforeEach(() => {
  resetFoundry();
  _resetForTests();
});

describe("EventBus (§4.6) — Done when", () => {
  it("controlToken, createChatMessage, and updateCombat reach the buffer", () => {
    registerHooks();

    Hooks.callAll("controlToken", { actor: { id: "Actor.innkeeper" } }, true);
    Hooks.callAll("createChatMessage", { isRoll: false });
    Hooks.callAll("updateCombat", { round: 2, turn: 1 }, {});

    const events = getBuffer().map((f) => f.event);
    expect(events).toEqual(["token.selected", "chat.message", "combat.turn"]);
    expect(getBuffer()[0].data).toEqual({ actorId: "Actor.innkeeper" });
    expect(getBuffer()[2].data).toEqual({ round: 2, turn: 1 });
  });

  it("canvasReady and updateToken (position change only) also emit", () => {
    registerHooks();

    globalThis.canvas.scene = { id: "Scene.thornwood" };
    Hooks.callAll("canvasReady");
    Hooks.callAll("updateToken", { id: "Token.wolf" }, { x: 100 });
    Hooks.callAll("updateToken", { id: "Token.wolf" }, { name: "renamed" }); // not a move, no emit

    const events = getBuffer().map((f) => f.event);
    expect(events).toEqual(["scene.active", "token.moved"]);
  });

  it("controlToken only emits on selection, not deselection", () => {
    registerHooks();
    Hooks.callAll("controlToken", { actor: { id: "Actor.a" } }, false);
    expect(getBuffer()).toEqual([]);
  });

  it("extractRoll pulls the dice result, not the rendered HTML, and no-ops for non-roll messages", () => {
    expect(extractRoll({ isRoll: false, content: "<div>hi</div>" })).toEqual({ rolls: [] });

    const rollObj = { formula: "2d4", total: 5 };
    expect(extractRoll({ isRoll: true, rolls: [rollObj] })).toEqual({ rolls: [{ formula: "2d4", total: 5 }] });

    // Defensive path: a stored roll that is still a JSON string, per the §0
    // gap this file's header comment documents.
    const asJson = JSON.stringify({ formula: "1d20", total: 17 });
    expect(extractRoll({ isRoll: true, rolls: [asJson] })).toEqual({ rolls: [{ formula: "1d20", total: 17 }] });
  });

  it("emits synchronously — a hook handler must not await anything before returning", () => {
    registerHooks();
    Hooks.callAll("createChatMessage", { isRoll: false });
    // If emit() were async this would still be empty here; it is not.
    expect(getBuffer().length).toBe(1);
  });

  it("buffers events until a sender is registered, then flushes and sends live", () => {
    registerHooks();
    Hooks.callAll("createChatMessage", { isRoll: false });
    Hooks.callAll("createChatMessage", { isRoll: false });
    expect(getBuffer().length).toBe(2);

    const sent = [];
    registerEventSender((frame) => sent.push(frame));
    expect(sent.length).toBe(2);
    expect(getBuffer().length).toBe(0);

    Hooks.callAll("createChatMessage", { isRoll: false });
    expect(sent.length).toBe(3);
    expect(getBuffer().length).toBe(0);
  });

  it("drops the oldest event once the buffer exceeds 128", () => {
    registerHooks();
    for (let i = 0; i < 130; i++) {
      Hooks.callAll("controlToken", { actor: { id: `Actor.${i}` } }, true);
    }
    const buf = getBuffer();
    expect(buf.length).toBe(128);
    expect(buf[0].data.actorId).toBe("Actor.2"); // 0 and 1 dropped
    expect(buf.at(-1).data.actorId).toBe("Actor.129");
  });

  it("a throwing hook handler does not propagate into Foundry's hook loop, and is logged loudly", () => {
    registerHooks();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    // createChatMessage's handler calls extractRoll(msg), which throws on
    // this malformed payload (a roll entry that is neither a JSON string
    // nor a Roll-shaped object).
    expect(() => Hooks.callAll("createChatMessage", { isRoll: true, rolls: [null] })).not.toThrow();
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});
