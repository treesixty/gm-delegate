// executors/encounter.js — random_encounters mechanical tools (spec §5.2).
// roll_on_table, list_roll_tables, get_compendium_actor. All read/roll-only:
// none of these mutates a document the transaction journal needs to snapshot
// for undo, so each touches() returns [].

// Table rows carry their own count formula, e.g. "[[2d4]] Wolf Pack" (v14's
// TableResult uses `name`, not the older `text` field — confirmed live
// against a real table this session, spec §0). Evaluated HERE,
// deterministically, in code — the model never sees a formula (§5.2).
async function resolveInlineFormulas(results) {
  const match = results[0]?.name?.match(/\[\[(.+?)\]\]/);
  if (!match) return { qty: 1, dice: null };
  const roll = new Roll(match[1]);
  await roll.evaluate();
  return { qty: roll.total, dice: `${match[1]}=${roll.total}` };
}

export function rollOnTableTouches() {
  return []; // a draw touches no document; nothing to snapshot for undo
}

export async function rollOnTable({ tableId }) {
  const table = await fromUuid(tableId);
  if (!table) throw new Error(`roll_on_table: no table at ${tableId}`);
  const { roll, results } = await table.draw({ displayChat: false });
  const { qty, dice } = await resolveInlineFormulas(results);
  return {
    result: {
      drawn: results.map((r) => r.name),
      tableDice: roll.formula,
      tableTotal: roll.total,
      quantity: qty,
      quantityDice: dice,
    },
    created: [],
  };
}

export function listRollTablesTouches() {
  return [];
}

export function listRollTables({ filter } = {}) {
  const tables = game.tables.contents.filter(
    (t) => !filter || t.name.toLowerCase().includes(filter.toLowerCase())
  );
  return { result: { tables: tables.map((t) => ({ tableId: t.uuid, name: t.name })) }, created: [] };
}

export function getCompendiumActorTouches() {
  return [];
}

export async function getCompendiumActor({ packId, actorId }) {
  const pack = game.packs.get(packId);
  if (!pack) throw new Error(`get_compendium_actor: no pack ${packId}`);
  const actor = await pack.getDocument(actorId);
  if (!actor) throw new Error(`get_compendium_actor: no actor ${actorId} in ${packId}`);
  return { result: { actor: actor.toObject() }, created: [] };
}
