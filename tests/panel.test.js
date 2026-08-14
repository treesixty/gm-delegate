// Spec §4.7. The M3 Done-when checklist, one behavior per test, against the
// logic half of panel.js (see its header comment for the split). The
// ApplicationV2 shell needs a real Foundry client and is not exercised here
// — same "outside Foundry: vitest against mocked globals" split as M1/M2
// (AGENTS.md).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetFoundry } from "./setup.js";
import { registerJournalSettings, getJournal, getCardLog } from "../scripts/journal.js";
import { registerPolicySettings, getPolicy, modeFor } from "../scripts/policy.js";
import { execute } from "../scripts/interceptor.js";
import { get as getProposal, put as putProposal, _resetForTests as resetProposals } from "../scripts/proposals.js";
import {
  Panel,
  shouldShowPanel,
  cycleSubsystemMode,
  reclaim,
  performUndo,
  takeCombatant,
  voiceNpc,
  isNpcActor,
  sendTrigger,
  registerExecute,
  acceptProposal,
  startEdit,
  cancelEdit,
  confirmEdit,
  rerollProposal,
  skipProposal,
} from "../scripts/panel.js";

// sendTrigger's note() write is fire-and-forget (spec §4.4 NORMATIVE pattern,
// same reason as interceptor.js's reject() — see tests/interceptor.test.js),
// so journal assertions need a tick for that write to land.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  resetFoundry();
  registerJournalSettings();
  registerPolicySettings();
  resetProposals();
  Panel.queued.length = 0;
  game.user.isGM = true;
  game.actors.find.mockReset().mockReturnValue(null);
  game.actors.importFromCompendium.mockReset();
  game.packs.get.mockReset().mockReturnValue(null);
  registerExecute(execute); // same wiring main.js does at ready time
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
    // Two separate encounters (each its own place_encounter transaction),
    // the real v1 tool surface (M7) — test-m1.js's synthetic test.actor.rename
    // is gone (deleted M7, STATUS.md). Each import gets its own delete spy so
    // performUndo(2) reverting both is independently verifiable.
    const deleteA = vi.fn();
    const deleteB = vi.fn();
    const actorA = { uuid: "Actor.a", getTokenDocument: vi.fn(async () => ({ toObject: () => ({ name: "tA" }) })), delete: deleteA };
    const actorB = { uuid: "Actor.b", getTokenDocument: vi.fn(async () => ({ toObject: () => ({ name: "tB" }) })), delete: deleteB };
    fromUuid.mockImplementation(async (uuid) => (uuid === "Actor.a" ? actorA : uuid === "Actor.b" ? actorB : null));
    game.packs.get.mockReturnValue({ getDocument: vi.fn(async (id) => ({ uuid: `Compendium.dnd5e.monsters.Actor.${id}` })) });
    game.actors.importFromCompendium.mockImplementation(async (_pack, actorId) => (actorId === "a" ? actorA : actorB));

    const proposalA = putProposal({
      subsystem: "random_encounters",
      creatures: [{ name: "A", quantity: 1, packId: "dnd5e.monsters", actorId: "a" }],
      beats: ["x", "y", "z"],
      hook: "h",
      provenance: { tableId: "RollTable.abc", roll: 1, result: "A" },
    });
    const proposalB = putProposal({
      subsystem: "random_encounters",
      creatures: [{ name: "B", quantity: 1, packId: "dnd5e.monsters", actorId: "b" }],
      beats: ["x", "y", "z"],
      hook: "h",
      provenance: { tableId: "RollTable.abc", roll: 2, result: "B" },
    });

    await execute({ id: "t1", action: "place_encounter", args: { proposalId: proposalA.id } });
    await execute({ id: "t2", action: "place_encounter", args: { proposalId: proposalB.id } });

    const ids = await performUndo(2);

    expect(ids.sort()).toEqual(["t1", "t2"]);
    expect(deleteA).toHaveBeenCalled();
    expect(deleteB).toHaveBeenCalled();
    const journal = getJournal();
    expect(journal.every((e) => e.reverted)).toBe(true);
  });

  it("is invisible to non-GM users", () => {
    game.user.isGM = true;
    expect(shouldShowPanel()).toBe(true);
    game.user.isGM = false;
    expect(shouldShowPanel()).toBe(false);
  });

  it("the trigger input writes a gm_command entry to the journal", async () => {
    sendTrigger("three days through the Thornwood");
    await flush();
    const entry = getJournal().find((e) => e.type === "gm_command");
    expect(entry).toMatchObject({ type: "gm_command", text: "three days through the Thornwood" });
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

  // NPC = not a player-character and not player-controlled (2026-08-12
  // decision) — a type check alone would wrongly let the GM "voice" a
  // player-owned hireling just because its actor type happens to be "npc".
  it("isNpcActor excludes player characters and player-owned actors, regardless of type", () => {
    expect(isNpcActor({ type: "npc", hasPlayerOwner: false })).toBe(true);
    expect(isNpcActor({ type: "character", hasPlayerOwner: false })).toBe(false);
    expect(isNpcActor({ type: "npc", hasPlayerOwner: true })).toBe(false);
    expect(isNpcActor(null)).toBe(false);
  });
});

describe("Panel — the card, Accept/Edit/Reroll/Skip (§5.4/§5.7, M7)", () => {
  const proposeIntent = (over = {}) => ({
    id: "intent1",
    subsystem: "random_encounters",
    stage: "decide",
    action: "propose_encounter",
    args: {
      creatures: [{ name: "Wolf Pack", quantity: 2, descriptor: "lean, winter-starved", packId: "dnd5e.monsters", actorId: "wolf1" }],
      beats: ["Sound first.", "They circle.", "Leader hangs back."],
      hook: "Something worse drove them out of the deep wood.",
      provenance: { tableId: "RollTable.abc", roll: 14, tableDice: "1d20", result: "Wolf Pack", quantity: 2, quantityDice: "2d4=2" },
    },
    ...over,
  });

  function stubPlacement() {
    game.packs.get.mockReturnValue({ getDocument: vi.fn(async () => ({ uuid: "Compendium.dnd5e.monsters.Actor.wolf1" })) });
    const actor = { uuid: "Actor.imported1", getTokenDocument: vi.fn(async () => ({ toObject: () => ({ name: "token" }) })) };
    game.actors.importFromCompendium.mockResolvedValue(actor);
    fromUuid.mockImplementation(async (uuid) => (uuid === "Actor.imported1" ? actor : null));
  }

  it("Panel.queue() creates a real proposal for propose_encounter and stamps its id onto the queued entry", () => {
    sendTrigger("three days through the Thornwood");
    Panel.queue(proposeIntent());

    expect(Panel.queued).toHaveLength(1);
    const proposalId = Panel.queued[0].proposalId;
    expect(proposalId).toBeTruthy();
    const proposal = getProposal(proposalId);
    expect(proposal).toMatchObject({ subsystem: "random_encounters", hook: "Something worse drove them out of the deep wood." });
  });

  it("Accept & Place: places tokens, logs gm_action accept, and clears the card", async () => {
    sendTrigger("three days through the Thornwood");
    Panel.queue(proposeIntent());
    const proposalId = Panel.queued[0].proposalId;
    stubPlacement();

    const outcome = await acceptProposal(proposalId);

    expect(outcome.status).toBe("EXECUTED");
    expect(Panel.queued).toHaveLength(0); // dequeued
    expect(getProposal(proposalId)).toBeNull(); // place_encounter's own single-use consumption
    const entry = getCardLog().at(-1);
    expect(entry).toMatchObject({
      proposal_id: proposalId,
      subsystem: "random_encounters",
      mode: "propose",
      gm_action: "accept",
      trigger: { type: "gm_command", text: "three days through the Thornwood" },
    });
    expect(entry.card_text).toContain("Sound first.");
  });

  it("Accept & Place failure: does not falsely log accept, notifies the GM, and leaves the card queued", async () => {
    // No stubPlacement() — beforeEach's game.packs.get returns null, so
    // place_encounter's resolveOrImportActor throws "no pack", same failure
    // shape a bad model-supplied packId produces live (STATUS.md session 8).
    sendTrigger("three days through the Thornwood");
    Panel.queue(proposeIntent());
    const proposalId = Panel.queued[0].proposalId;

    const outcome = await acceptProposal(proposalId);

    expect(outcome.status).toBe("REJECTED");
    expect(Panel.queued).toHaveLength(1); // not silently dequeued
    expect(getProposal(proposalId)).not.toBeNull(); // not consumed
    expect(ui.notifications.error).toHaveBeenCalledWith(expect.stringContaining(outcome.reason));
    const entry = getCardLog().at(-1);
    expect(entry.gm_action).toBe("accept"); // still the GM's real action
    expect(entry.rejected).toMatchObject({ reason: outcome.reason, action: "place_encounter" });
  });

  it("Edit: logs the diff between original and kept text, then places", async () => {
    sendTrigger("three days through the Thornwood");
    Panel.queue(proposeIntent());
    const proposalId = Panel.queued[0].proposalId;
    stubPlacement();

    startEdit(proposalId);
    const editedText = "• Sound first.\n• They circle, tighter than before.\n• Leader hangs back.\nHook: Something worse drove them out of the deep wood.";
    const outcome = await confirmEdit(proposalId, editedText);

    expect(outcome.status).toBe("EXECUTED");
    const entry = getCardLog().at(-1);
    expect(entry.gm_action).toBe("edit");
    expect(entry.card_text).toBe(editedText);
    expect(entry.gm_edit_diff).toContain("+ " + editedText);
    expect(getProposal(proposalId)).toBeNull();
  });

  it("Edit failure: does not falsely log a positive edit, notifies the GM, and leaves the card queued", async () => {
    sendTrigger("three days through the Thornwood");
    Panel.queue(proposeIntent());
    const proposalId = Panel.queued[0].proposalId;

    startEdit(proposalId);
    const editedText = "• Sound first.\nHook: edited.";
    const outcome = await confirmEdit(proposalId, editedText);

    expect(outcome.status).toBe("REJECTED");
    expect(Panel.queued).toHaveLength(1);
    expect(getProposal(proposalId)).not.toBeNull();
    expect(ui.notifications.error).toHaveBeenCalledWith(expect.stringContaining(outcome.reason));
    const entry = getCardLog().at(-1);
    expect(entry.gm_action).toBe("edit");
    expect(entry.card_text).toBe(editedText);
    expect(entry.rejected).toMatchObject({ reason: outcome.reason, action: "place_encounter" });
  });

  it("cancelEdit does not log or dequeue anything", () => {
    sendTrigger("three days through the Thornwood");
    Panel.queue(proposeIntent());
    const proposalId = Panel.queued[0].proposalId;

    startEdit(proposalId);
    expect(() => cancelEdit()).not.toThrow();

    expect(Panel.queued).toHaveLength(1);
    expect(getProposal(proposalId)).not.toBeNull();
  });

  it("Reroll: logs a weak negative on the discarded card, removes it, and re-sends the original trigger", async () => {
    sendTrigger("three days through the Thornwood");
    Panel.queue(proposeIntent());
    const proposalId = Panel.queued[0].proposalId;

    await rerollProposal(proposalId);

    expect(Panel.queued).toHaveLength(0);
    expect(getProposal(proposalId)).toBeNull();
    const entry = getCardLog().find((e) => e.proposal_id === proposalId);
    expect(entry.gm_action).toBe("reroll");
    // rerollProposal's sendTrigger() call is the observable "re-runs the
    // agent" — confirmed via the journal's gm_command trail (same fixture
    // sendTrigger's own test uses), not via a wire mock (none registered here).
    await flush();
    const triggers = getJournal().filter((e) => e.type === "gm_command" && e.text === "three days through the Thornwood");
    expect(triggers).toHaveLength(2); // original ask + reroll's re-ask
  });

  it("Skip: logs a weak negative and dismisses the card", async () => {
    sendTrigger("three days through the Thornwood");
    Panel.queue(proposeIntent());
    const proposalId = Panel.queued[0].proposalId;

    await skipProposal(proposalId);

    expect(Panel.queued).toHaveLength(0);
    expect(getProposal(proposalId)).toBeNull();
    const entry = getCardLog().find((e) => e.proposal_id === proposalId);
    expect(entry.gm_action).toBe("skip");
  });

  it("acting on a proposal that no longer exists (already actioned, or expired) is a safe no-op", async () => {
    await expect(acceptProposal("nonexistent")).resolves.toBeNull();
    await expect(skipProposal("nonexistent")).resolves.toBeUndefined();
    await expect(rerollProposal("nonexistent")).resolves.toBeUndefined();
    expect(() => startEdit("nonexistent")).not.toThrow();
  });
});
