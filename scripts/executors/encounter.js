// executors/encounter.js — random_encounters mechanical tools (spec §5.2).
// roll_on_table, list_roll_tables, get_compendium_actor, place_encounter.

import { get as getProposal, remove as removeProposal } from "../proposals.js";

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

// A pack-linked TableResult carries its target document as `documentUuid`
// (v14 schema — verified live, spec §0; older `documentCollection`/
// `documentId` no longer exist). Resolve it to packId/actorId here, in code,
// same discipline as resolveInlineFormulas: the model gets these ready-made
// on propose_encounter's creatures[], it never derives them. `packId` comes
// from Document#compendium.collection (the canonical pack name
// game.packs.get() expects), `actorId` from Document#id — both verified
// live against v14's API docs, spec §0. Defensive: a plain-text (non-linked)
// row has no documentUuid, and returns nulls rather than throwing — M6's
// authored Thornwood table predates pack-linking and still needs re-authoring
// before this path has real live input (STATUS.md).
async function resolveCreatureLink(result) {
  if (!result?.documentUuid) return { packId: null, actorId: null };
  const doc = await fromUuid(result.documentUuid);
  if (!doc?.compendium) return { packId: null, actorId: null };
  return { packId: doc.compendium.collection, actorId: doc.id };
}

export function rollOnTableTouches() {
  return []; // a draw touches no document; nothing to snapshot for undo
}

export async function rollOnTable({ tableId }) {
  const table = await fromUuid(tableId);
  if (!table) throw new Error(`roll_on_table: no table at ${tableId}`);
  const { roll, results } = await table.draw({ displayChat: false });
  const { qty, dice } = await resolveInlineFormulas(results);
  const { packId, actorId } = await resolveCreatureLink(results[0]);
  return {
    result: {
      drawn: results.map((r) => r.name),
      tableDice: roll.formula,
      tableTotal: roll.total,
      quantity: qty,
      quantityDice: dice,
      packId,
      actorId,
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

// Dedupe FIRST (§5.2): the second wolf encounter must reuse the first
// import, or four sessions later the Actors directory holds eleven Actors
// named Wolf. `sourceUuid` is the imported-from compendium document's own
// uuid (resolved via pack.getDocument(), not string-built) stamped as a
// flag on the world Actor, and checked here before importing again.
async function resolveOrImportActor({ packId, actorId }) {
  const pack = game.packs.get(packId);
  if (!pack) throw new Error(`place_encounter: no pack ${packId}`);
  const sourceDoc = await pack.getDocument(actorId);
  if (!sourceDoc) throw new Error(`place_encounter: no actor ${actorId} in ${packId}`);
  const srcUuid = sourceDoc.uuid;

  const existing = game.actors.find((a) => a.getFlag("gm-delegate", "sourceUuid") === srcUuid);
  if (existing) return { actor: existing, imported: false };

  const actor = await game.actors.importFromCompendium(pack, actorId, {
    "flags.gm-delegate.sourceUuid": srcUuid,
  });
  return { actor, imported: true };
}

export function placeEncounterTouches() {
  return []; // creates only (world Actor + tokens); nothing pre-existing is mutated
}

// Only callable after the GM accepts a proposal (tools.json's own
// description) — enforced here, not in the model's prompt (07-card.md's
// Traps): a missing/expired/already-consumed proposalId throws, which
// execute() (interceptor.js) turns into a REJECTED/EXEC_FAILED result. The
// proposal is single-use: removeProposal() runs on success, so a replayed
// proposalId finds nothing on the next call.
//
// Two undo layers, deliberately split (§4.5): the imported world Actor is a
// non-placeable create, so it goes in the return's top-level `created[]`
// (Layer B — journal.js deletes it on undo, unless getDependentTokens finds
// it still in play elsewhere, e.g. reused by dedupe). The placed tokens are
// placeables, so they go in `result.placeables` (Layer A — commit() already
// calls storeHistory/undoHistory for these, idempotently). Putting the same
// tokens in both would double-cover them across the two undo layers.
export async function placeEncounter({ proposalId }) {
  const proposal = getProposal(proposalId);
  if (!proposal) {
    throw new Error(`place_encounter: no proposal ${proposalId} (missing, expired, or already placed)`);
  }

  const created = [];
  const tokenData = [];
  for (const creature of proposal.creatures) {
    const { actor, imported } = await resolveOrImportActor(creature);
    if (imported) created.push(actor.uuid);
    for (let i = 0; i < creature.quantity; i++) {
      const t = await actor.getTokenDocument({ level: canvas.level.id }, { parent: canvas.scene });
      tokenData.push(t.toObject());
    }
  }

  const placed = await canvas.tokens.placeTokens(tokenData, {});
  removeProposal(proposalId);

  return {
    result: { placed: placed.length },
    created,
    placeables: { layer: "tokens", docs: placed.map((d) => d.toObject()) },
  };
}
