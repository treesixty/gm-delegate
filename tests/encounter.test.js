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
} from "../scripts/executors/encounter.js";

beforeEach(() => resetFoundry());

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
