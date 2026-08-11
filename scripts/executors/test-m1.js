// THROWAWAY — M1 test executors, existing only so undoLast() has something to
// undo before M7 builds encounter.js. Delete this file in M7.
//
// renameActor writes actor data. That is fine HERE and only here: the hard
// ban is on the agent's tool surface, and this file is never exposed to the
// agent — it is driven by the GM from the console to exercise Layer B undo.

// Layer B test: actor-data change, reverted via snapshot restore.
export function renameActorTouches({ actorUuid }) {
  return [actorUuid];
}

export async function renameActor({ actorUuid, name }) {
  const actor = await fromUuid(actorUuid);
  if (!actor) throw new Error(`test.actor.rename: no document at ${actorUuid}`);
  await actor.update({ name });
  return { renamed: actorUuid, to: name };
}

// Layer A test: token placement, reverted via storeHistory / undoHistory.
export function placeTokenTouches() {
  return []; // creates placeables only; Layer A history covers the undo
}

export async function placeToken({ actorId, x, y }) {
  const actor = game.actors.get(actorId);
  if (!actor) throw new Error(`test.token.place: no actor with id ${actorId}`);
  const tokenDoc = await actor.getTokenDocument({ x, y });
  const created = await canvas.scene.createEmbeddedDocuments("Token", [tokenDoc.toObject()]);
  return { placeables: { layer: "tokens", docs: created.map((d) => d.toObject()) } };
}
