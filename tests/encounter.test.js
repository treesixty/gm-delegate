// scripts/executors/encounter.js (spec §5.2, M6). Unit-level: the executors
// called directly, not routed through the Interceptor (socket.test.js covers
// the full wire path and the provenance logging that depends on it).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetFoundry } from "./setup.js";
import {
  rollOnTable,
  rollOnTableTouches,
  listRollTables,
  listRollTablesTouches,
  getCompendiumActor,
  getCompendiumActorTouches,
  placeEncounter,
  placeEncounterTouches,
} from "../scripts/executors/encounter.js";
import { put as putProposal, get as getProposal, _resetForTests as resetProposals } from "../scripts/proposals.js";

beforeEach(() => {
  resetFoundry();
  resetProposals();
  // resetFoundry() doesn't touch game.actors/game.packs (setup.js only
  // resets settings/canvas.tokens/hooks) — clear call history so
  // place_encounter's "was importFromCompendium called" assertions aren't
  // polluted by a mock configured in an earlier test in this file.
  game.actors.find.mockReset().mockReturnValue(null);
  game.actors.get.mockReset().mockReturnValue(null);
  game.actors.importFromCompendium.mockReset();
  game.packs.get.mockReset().mockReturnValue(null);
});

describe("roll_on_table (§5.2 — the model never sees a formula)", () => {
  it("resolves the inline count formula deterministically, in code", async () => {
    fromUuid.mockResolvedValue({
      draw: vi.fn(async () => ({
        roll: { formula: "1d20", total: 5 },
        results: [{ name: "[[2d4]] Wolf Pack" }],
      })),
    });

    const { result, created } = await rollOnTable({ tableId: "RollTable.abc" });

    expect(result).toEqual({
      drawn: ["[[2d4]] Wolf Pack"],
      tableDice: "1d20",
      tableTotal: 5,
      quantity: 8, // RollMock: 2d4 -> 2*4 deterministically
      quantityDice: "2d4=8",
      packId: null, // no documentUuid on this row — plain-text result, not pack-linked
      actorId: null,
    });
    expect(created).toEqual([]);
  });

  it("falls back to quantity 1 when a row has no inline formula", async () => {
    fromUuid.mockResolvedValue({
      draw: vi.fn(async () => ({
        roll: { formula: "1d20", total: 19 },
        results: [{ name: "Nothing of note" }],
      })),
    });

    const { result } = await rollOnTable({ tableId: "RollTable.abc" });
    expect(result.quantity).toBe(1);
    expect(result.quantityDice).toBeNull();
  });

  it("resolves packId/actorId from a pack-linked row's documentUuid (§0: TableResult#documentUuid, v14)", async () => {
    const compendiumActor = { compendium: { collection: "dnd5e.monsters" }, id: "wolf1" };
    fromUuid.mockImplementation(async (uuid) => {
      if (uuid === "RollTable.abc") {
        return {
          draw: vi.fn(async () => ({
            roll: { formula: "1d20", total: 5 },
            results: [{ name: "[[2d4]] Wolf Pack", documentUuid: "Compendium.dnd5e.monsters.Actor.wolf1" }],
          })),
        };
      }
      if (uuid === "Compendium.dnd5e.monsters.Actor.wolf1") return compendiumActor;
      return null;
    });

    const { result } = await rollOnTable({ tableId: "RollTable.abc" });
    expect(result.packId).toBe("dnd5e.monsters");
    expect(result.actorId).toBe("wolf1");
  });

  it("returns null packId/actorId when documentUuid does not resolve to anything", async () => {
    fromUuid.mockImplementation(async (uuid) => {
      if (uuid === "RollTable.abc") {
        return {
          draw: vi.fn(async () => ({
            roll: { formula: "1d20", total: 5 },
            results: [{ name: "Wolf Pack", documentUuid: "Compendium.dnd5e.monsters.Actor.gone" }],
          })),
        };
      }
      return null; // the linked document no longer exists
    });

    const { result } = await rollOnTable({ tableId: "RollTable.abc" });
    expect(result.packId).toBeNull();
    expect(result.actorId).toBeNull();
  });

  it("throws a descriptive error when the table does not exist", async () => {
    fromUuid.mockResolvedValue(null);
    await expect(rollOnTable({ tableId: "RollTable.missing" })).rejects.toThrow(/no table/);
  });

  it("passes displayChat: false to draw() (§5.2 — does NOT display to chat)", async () => {
    const draw = vi.fn(async () => ({ roll: { formula: "1d1", total: 1 }, results: [{ name: "x" }] }));
    fromUuid.mockResolvedValue({ draw });
    await rollOnTable({ tableId: "RollTable.abc" });
    expect(draw).toHaveBeenCalledWith({ displayChat: false });
  });

  it("touches() declares no documents — a draw has nothing for undo to restore", () => {
    expect(rollOnTableTouches()).toEqual([]);
  });
});

describe("list_roll_tables", () => {
  it("lists all tables when no filter is given", () => {
    game.tables.contents = [
      { uuid: "RollTable.a", name: "Thornwood Road Encounters" },
      { uuid: "RollTable.b", name: "City Encounters" },
    ];
    const { result } = listRollTables({});
    expect(result.tables).toEqual([
      { tableId: "RollTable.a", name: "Thornwood Road Encounters" },
      { tableId: "RollTable.b", name: "City Encounters" },
    ]);
  });

  it("filters by case-insensitive name substring", () => {
    game.tables.contents = [
      { uuid: "RollTable.a", name: "Thornwood Road Encounters" },
      { uuid: "RollTable.b", name: "City Encounters" },
    ];
    const { result } = listRollTables({ filter: "thornwood" });
    expect(result.tables).toEqual([{ tableId: "RollTable.a", name: "Thornwood Road Encounters" }]);
  });

  it("touches() declares no documents", () => {
    expect(listRollTablesTouches()).toEqual([]);
  });
});

describe("get_compendium_actor (§5.2 — explicit pack + id only, cannot sweep)", () => {
  it("fetches a single statblock by pack and id", async () => {
    const actor = { toObject: () => ({ name: "Wolf", type: "npc" }) };
    game.packs.get.mockReturnValue({ getDocument: vi.fn(async () => actor) });

    const { result } = await getCompendiumActor({ packId: "dnd5e.monsters", actorId: "abc123" });
    expect(result.actor).toEqual({ name: "Wolf", type: "npc" });
  });

  it("throws when the pack does not exist", async () => {
    game.packs.get.mockReturnValue(null);
    await expect(getCompendiumActor({ packId: "missing", actorId: "abc" })).rejects.toThrow(/no pack/);
  });

  it("throws when the actor does not exist in the pack", async () => {
    game.packs.get.mockReturnValue({ getDocument: vi.fn(async () => null) });
    await expect(getCompendiumActor({ packId: "dnd5e.monsters", actorId: "missing" })).rejects.toThrow(/no actor/);
  });

  it("touches() declares no documents", () => {
    expect(getCompendiumActorTouches()).toEqual([]);
  });
});

describe("place_encounter (§5.2 — dedupe, then import, then place; M7)", () => {
  const creature = (over = {}) => ({
    name: "Wolf Pack",
    quantity: 2,
    packId: "dnd5e.monsters",
    actorId: "wolf1",
    ...over,
  });
  const sourceDoc = { uuid: "Compendium.dnd5e.monsters.Actor.wolf1" };
  const tokenDoc = (n) => ({ toObject: () => ({ name: `token${n}` }) });

  it("touches() declares no documents — creates only, undo goes through created[] and placeables", () => {
    expect(placeEncounterTouches()).toEqual([]);
  });

  it("throws when the proposal is missing/expired (Traps: enforce in the Interceptor, not the prompt)", async () => {
    await expect(placeEncounter({ proposalId: "nonexistent" })).rejects.toThrow(/no proposal/);
  });

  it("imports a fresh Actor on first encounter, places tokens, and consumes the proposal", async () => {
    const record = putProposal({
      subsystem: "random_encounters",
      creatures: [creature()],
      beats: ["a", "b", "c"],
      hook: "h",
      provenance: { tableId: "RollTable.abc", roll: 5, result: "Wolf Pack" },
    });

    game.packs.get.mockReturnValue({ getDocument: vi.fn(async () => sourceDoc) });
    game.actors.find.mockReturnValue(null); // no existing import — dedupe finds nothing
    const importedActor = {
      uuid: "Actor.imported1",
      getTokenDocument: vi.fn(async () => tokenDoc(0)).mockResolvedValueOnce(tokenDoc(0)).mockResolvedValueOnce(tokenDoc(1)),
    };
    game.actors.importFromCompendium.mockResolvedValue(importedActor);

    const { result, created, placeables } = await placeEncounter({ proposalId: record.id });

    expect(game.actors.importFromCompendium).toHaveBeenCalledWith(
      { getDocument: expect.any(Function) },
      "wolf1",
      { "flags.gm-delegate.sourceUuid": "Compendium.dnd5e.monsters.Actor.wolf1" }
    );
    expect(created).toEqual(["Actor.imported1"]); // Layer B: the new Actor only
    expect(result.placed).toBe(2);
    expect(placeables.layer).toBe("tokens");
    expect(placeables.docs).toHaveLength(2); // Layer A: the tokens, not duplicated into created[]

    expect(getProposal(record.id)).toBeNull(); // single-use
  });

  it("dedupes: reuses an existing world Actor by sourceUuid instead of importing again", async () => {
    const record = putProposal({
      subsystem: "random_encounters",
      creatures: [creature({ quantity: 1 })],
      beats: ["a", "b", "c"],
      hook: "h",
      provenance: { tableId: "RollTable.abc", roll: 5, result: "Wolf Pack" },
    });

    game.packs.get.mockReturnValue({ getDocument: vi.fn(async () => sourceDoc) });
    const existingActor = { uuid: "Actor.existing1", getTokenDocument: vi.fn(async () => tokenDoc(0)) };
    game.actors.find.mockImplementation((predicate) =>
      predicate({ getFlag: () => "Compendium.dnd5e.monsters.Actor.wolf1" }) ? existingActor : null
    );

    const { created } = await placeEncounter({ proposalId: record.id });

    expect(game.actors.importFromCompendium).not.toHaveBeenCalled();
    expect(created).toEqual([]); // nothing new created — Layer B has nothing to cover
  });

  it("places quantity tokens per creature across multiple creature entries", async () => {
    const record = putProposal({
      subsystem: "random_encounters",
      creatures: [creature({ name: "Wolf", quantity: 2, actorId: "wolf1" }), creature({ name: "Boar", quantity: 1, actorId: "boar1" })],
      beats: ["a", "b", "c"],
      hook: "h",
      provenance: { tableId: "RollTable.abc", roll: 5, result: "Wolf Pack" },
    });

    game.packs.get.mockReturnValue({ getDocument: vi.fn(async (id) => ({ uuid: `Compendium.dnd5e.monsters.Actor.${id}` })) });
    game.actors.find.mockReturnValue(null);
    game.actors.importFromCompendium.mockImplementation(async (_pack, actorId) => ({
      uuid: `Actor.${actorId}`,
      getTokenDocument: vi.fn(async () => tokenDoc(actorId)),
    }));

    const { result, created } = await placeEncounter({ proposalId: record.id });

    expect(result.placed).toBe(3); // 2 wolves + 1 boar
    expect(created).toEqual(["Actor.wolf1", "Actor.boar1"]);
  });
});
