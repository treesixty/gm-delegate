// journal.js's created[] undo layer (spec §4.5, M7). Layer B for
// non-placeable creates — place_encounter's imported world Actor is the
// motivating case (§4.5: "a snapshot cannot cover a document that does not
// exist yet"). Exercised through the real execute()/undoLast() path (not the
// executor in isolation, encounter.test.js already covers that) so the
// journal's own bookkeeping — created[] stored on commit, deleted-then-
// restored ordering on undo, the dependent-token skip — is what's under
// test.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetFoundry } from "./setup.js";
import { registerJournalSettings, getJournal, undoLast } from "../scripts/journal.js";
import { execute } from "../scripts/interceptor.js";
import { put as putProposal, get as getProposal, _resetForTests as resetProposals } from "../scripts/proposals.js";

beforeEach(() => {
  resetFoundry();
  registerJournalSettings();
  resetProposals();
  game.actors.find.mockReset().mockReturnValue(null);
  game.actors.importFromCompendium.mockReset();
  game.packs.get.mockReset().mockReturnValue(null);
});

const proposalFor = (creatures) =>
  putProposal({
    subsystem: "random_encounters",
    creatures,
    beats: ["a", "b", "c"],
    hook: "h",
    provenance: { tableId: "RollTable.abc", roll: 5, result: "Wolf Pack" },
  });

describe("created[] undo (§4.5, M7 — place_encounter's imported Actor)", () => {
  it("undoLast deletes the imported Actor and the placed tokens together", async () => {
    const record = proposalFor([{ name: "Wolf", quantity: 2, packId: "dnd5e.monsters", actorId: "wolf1" }]);
    game.packs.get.mockReturnValue({ getDocument: vi.fn(async () => ({ uuid: "Compendium.dnd5e.monsters.Actor.wolf1" })) });
    const deleteActor = vi.fn();
    const importedActor = {
      uuid: "Actor.imported1",
      getTokenDocument: vi.fn(async () => ({ toObject: () => ({ name: "token" }) })),
      getDependentTokens: vi.fn(() => []),
      delete: deleteActor,
    };
    game.actors.importFromCompendium.mockResolvedValue(importedActor);
    fromUuid.mockImplementation(async (uuid) => (uuid === "Actor.imported1" ? importedActor : null));

    const outcome = await execute({
      id: "intent1",
      action: "place_encounter",
      args: { proposalId: record.id },
    });
    expect(outcome.status).toBe("EXECUTED");

    const entry = getJournal().find((e) => e.id === "intent1");
    expect(entry.created).toEqual(["Actor.imported1"]);
    expect(entry.placeables).toEqual({ layer: "tokens" });

    await undoLast(1);

    expect(deleteActor).toHaveBeenCalled(); // Layer B: the imported Actor is gone
    expect(canvas.tokens.undoHistory).toHaveBeenCalled(); // Layer A: the tokens are gone
    expect(getJournal().find((e) => e.id === "intent1").reverted).toBe(true);
  });

  it("does NOT delete a created Actor still referenced by another encounter's tokens (§4.5 limit 3, dedupe)", async () => {
    const record = proposalFor([{ name: "Wolf", quantity: 1, packId: "dnd5e.monsters", actorId: "wolf1" }]);
    game.packs.get.mockReturnValue({ getDocument: vi.fn(async () => ({ uuid: "Compendium.dnd5e.monsters.Actor.wolf1" })) });
    const deleteActor = vi.fn();
    const importedActor = {
      uuid: "Actor.imported1",
      getTokenDocument: vi.fn(async () => ({ toObject: () => ({ name: "token" }) })),
      // A later, still-standing encounter reused this Actor via dedupe —
      // it has a dependent token elsewhere, so undo must leave it alone.
      getDependentTokens: vi.fn(() => [{ id: "still-standing-token" }]),
      delete: deleteActor,
    };
    game.actors.importFromCompendium.mockResolvedValue(importedActor);
    fromUuid.mockImplementation(async (uuid) => (uuid === "Actor.imported1" ? importedActor : null));

    await execute({ id: "intent2", action: "place_encounter", args: { proposalId: record.id } });
    await undoLast(1);

    expect(deleteActor).not.toHaveBeenCalled();
  });

  it("place_encounter's proposal is consumed even if the caller never undoes", async () => {
    const record = proposalFor([{ name: "Wolf", quantity: 1, packId: "dnd5e.monsters", actorId: "wolf1" }]);
    game.packs.get.mockReturnValue({ getDocument: vi.fn(async () => ({ uuid: "Compendium.dnd5e.monsters.Actor.wolf1" })) });
    game.actors.importFromCompendium.mockResolvedValue({
      uuid: "Actor.imported1",
      getTokenDocument: vi.fn(async () => ({ toObject: () => ({ name: "token" }) })),
    });

    await execute({ id: "intent3", action: "place_encounter", args: { proposalId: record.id } });
    expect(getProposal(record.id)).toBeNull();
  });

  it("a rejected place_encounter (bad proposalId) leaves no created[] and the journal shows EXEC_FAILED", async () => {
    const outcome = await execute({ id: "intent4", action: "place_encounter", args: { proposalId: "nonexistent" } });
    expect(outcome.status).toBe("REJECTED");
    expect(outcome.reason).toMatch(/^EXEC_FAILED: /);
  });
});
