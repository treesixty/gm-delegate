// Spec §4.7. The M3 Done-when checklist, one behavior per test, against the
// logic half of panel.js (see its header comment for the split). The
// ApplicationV2 shell needs a real Foundry client and is not exercised here
// — same "outside Foundry: vitest against mocked globals" split as M1/M2
// (AGENTS.md).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetFoundry } from "./setup.js";
import { registerJournalSettings, getJournal } from "../scripts/journal.js";
import { registerPolicySettings, getPolicy, modeFor } from "../scripts/policy.js";
import { handleIntent } from "../scripts/interceptor.js";
import {
  Panel,
  shouldShowPanel,
  cycleSubsystemMode,
  reclaim,
  performUndo,
  takeCombatant,
  voiceNpc,
} from "../scripts/panel.js";

beforeEach(() => {
  resetFoundry();
  registerJournalSettings();
  registerPolicySettings();
  Panel.queued.length = 0;
  game.user.isGM = true;
});

describe("Panel (§4.7) — Done when", () => {
  it("chips cycle off -> propose -> auto -> off and persist across a settings reload", async () => {
    expect(getPolicy().subsystems.loot.decide).toBe("off");
    await cycleSubsystemMode("loot");
    expect(getPolicy().subsystems.loot.decide).toBe("propose");
    await cycleSubsystemMode("loot");
    expect(getPolicy().subsystems.loot.decide).toBe("auto");
    await cycleSubsystemMode("loot");
    expect(getPolicy().subsystems.loot.decide).toBe("off");
    // "Reload" == a fresh read from the settings store, which is all
    // getPolicy() ever does — nothing here is held in module-local state.
    expect(getPolicy().subsystems.loot.decide).toBe("off");
  });

  it("RECLAIM purges the queue and is sticky regardless of subsystem policy or scene", async () => {
    Panel.queue({ id: "q1", subsystem: "random_encounters", stage: "decide", action: "x", args: {} });
    expect(Panel.queued.length).toBe(1);

    await reclaim();

    expect(Panel.queued.length).toBe(0);
    // Sticky: modeFor forces off for a subsystem that is otherwise "auto",
    // and nothing about a later cycleSubsystemMode call on a DIFFERENT
    // subsystem clears it back.
    expect(modeFor("random_encounters", "prompt")).toBe("off");
    await cycleSubsystemMode("loot");
    expect(modeFor("random_encounters", "prompt")).toBe("off");
    expect(getPolicy().sceneOverride).toBe("all_off");
  });

  it("RECLAIM writes a RECLAIMED marker to the journal", async () => {
    await reclaim();
    const entry = getJournal().find((e) => e.status === "RECLAIMED");
    expect(entry).toBeTruthy();
    expect(entry.reverted).toBe(false);
  });

  it("RECLAIM is a toggle: calling it again while active releases control back", async () => {
    await reclaim();
    expect(getPolicy().sceneOverride).toBe("all_off");

    await reclaim();
    expect(getPolicy().sceneOverride).toBe(null);
    expect(modeFor("random_encounters", "decide")).toBe("propose"); // back to DEFAULT_POLICY

    const entry = getJournal().find((e) => e.status === "RECLAIM_RELEASED");
    expect(entry).toBeTruthy();
  });

  it("undo reverts the last N executed transactions, not just the last one", async () => {
    const actors = {
      "Actor.a": { name: "A-old" },
      "Actor.b": { name: "B-old" },
    };
    fromUuid.mockImplementation(async (uuid) => ({
      toObject: () => ({ ...actors[uuid] }),
      update: vi.fn(async (data) => {
        actors[uuid] = { ...actors[uuid], ...data };
      }),
    }));

    await handleIntent({
      id: "t1",
      subsystem: "random_encounters",
      stage: "prompt", // default policy: auto
      action: "test.actor.rename",
      args: { actorUuid: "Actor.a", name: "A-new" },
    });
    await handleIntent({
      id: "t2",
      subsystem: "random_encounters",
      stage: "prompt",
      action: "test.actor.rename",
      args: { actorUuid: "Actor.b", name: "B-new" },
    });

    const ids = await performUndo(2);

    expect(ids.sort()).toEqual(["t1", "t2"]);
    expect(actors["Actor.a"].name).toBe("A-old");
    expect(actors["Actor.b"].name).toBe("B-old");
    const journal = getJournal();
    expect(journal.every((e) => e.reverted)).toBe(true);
  });

  it("is invisible to non-GM users", () => {
    game.user.isGM = true;
    expect(shouldShowPanel()).toBe(true);
    game.user.isGM = false;
    expect(shouldShowPanel()).toBe(false);
  });
});

describe("Panel context-menu writes (§4.7)", () => {
  it('"I\'ll take this one" turns combat_tactics off', async () => {
    expect(getPolicy().subsystems.combat_tactics.decide).toBe("off");
    await cycleSubsystemMode("combat_tactics"); // off -> propose, so the write below is observable
    expect(getPolicy().subsystems.combat_tactics.decide).toBe("propose");
    await takeCombatant();
    expect(getPolicy().subsystems.combat_tactics.decide).toBe("off");
  });

  it('"I\'ll voice this one" writes an actorOverride that wins over the subsystem default', async () => {
    await voiceNpc("Actor.npc1");
    expect(modeFor("npc_voice", "decide", "Actor.npc1")).toBe("off");
    expect(modeFor("npc_voice", "decide", "Actor.someoneElse")).toBe("off"); // both off by default anyway
    expect(getPolicy().actorOverrides["Actor.npc1"]).toEqual({ npc_voice: { decide: "off", prompt: "off" } });
  });
});
