// policy.js — the PolicyStore (spec §4.3). Delegation policy is a world
// setting, edited via the Panel (M3), never via the settings sheet, enforced
// in code, never by the model (§1.2).

const MODULE_ID = "gm-delegate";
const POLICY_KEY = "policy";

export const SUBSYSTEMS = [
  "random_encounters",
  "loot",
  "npc_voice",
  "combat_tactics",
  "rules_lookup",
  "recap",
];
export const STAGES = ["decide", "prompt"]; // NOT "narrate". See §1.1.
export const MODES = ["off", "propose", "auto"];

// hardBans travels with the policy object for shape completeness, but it is
// NOT enforced from here. §1.4: hard bans are not a policy setting and no
// mode can lift them, so interceptor.js checks against this same literal
// array imported directly, never against the mutable world-settings copy.
export const DEFAULT_POLICY = {
  version: 1,
  subsystems: {
    random_encounters: { decide: "propose", prompt: "auto" },
    loot: { decide: "off", prompt: "off" },
    npc_voice: { decide: "off", prompt: "off" },
    combat_tactics: { decide: "off", prompt: "off" },
    rules_lookup: { decide: "off", prompt: "off" },
    recap: { decide: "off", prompt: "off" },
  },
  actorOverrides: {}, // "Actor.abc123": { npc_voice: {...} }
  sceneOverride: null, // "all_off" when reclaimed
  hardBans: ["actor.hp.write", "document.delete", "macro.execute", "compendium.searchAll"],
};

export function registerPolicySettings() {
  game.settings.register(MODULE_ID, POLICY_KEY, {
    scope: "world",
    config: false,
    type: Object,
    default: DEFAULT_POLICY,
  });
}

export function getPolicy() {
  return game.settings.get(MODULE_ID, POLICY_KEY);
}

// Default-deny: `?? "off"`. An unknown subsystem is off, not on.
export function modeFor(subsystem, stage, actorId = null) {
  const p = getPolicy();
  if (p.sceneOverride === "all_off") return "off";
  const override = actorId && p.actorOverrides?.[actorId]?.[subsystem]?.[stage];
  return override ?? p.subsystems[subsystem]?.[stage] ?? "off";
}

/* -------------------------------------------- */
/*  Writes — the Panel (M3) is the only caller   */
/* -------------------------------------------- */

export function nextMode(mode) {
  const i = MODES.indexOf(mode);
  return MODES[(i + 1) % MODES.length];
}

// The chip in §4.7's mockup shows one dot per subsystem, and that dot is the
// `decide` stage's mode (confirmed against DEFAULT_POLICY: random_encounters
// shows "propose", which is decide's value, not prompt's "auto"). So the chip
// cycles `decide` only; `prompt` is left alone. Not stated explicitly in the
// spec — recorded as an assumption in STATUS.md.
export async function setSubsystemDecide(subsystem, mode) {
  const p = getPolicy();
  const next = {
    ...p,
    subsystems: { ...p.subsystems, [subsystem]: { ...p.subsystems[subsystem], decide: mode } },
  };
  await game.settings.set(MODULE_ID, POLICY_KEY, next);
  return next;
}

// RECLAIM (§4.7). Sticky by construction: nothing ever sets this back to
// null except an explicit future call with a different value.
export async function setSceneOverride(value) {
  const p = getPolicy();
  const next = { ...p, sceneOverride: value };
  await game.settings.set(MODULE_ID, POLICY_KEY, next);
  return next;
}

// "I'll voice this one" (§4.7, right-click an NPC token).
export async function setActorOverride(actorId, subsystem, patch) {
  const p = getPolicy();
  const existingActor = p.actorOverrides[actorId] ?? {};
  const existingSub = existingActor[subsystem] ?? {};
  const next = {
    ...p,
    actorOverrides: {
      ...p.actorOverrides,
      [actorId]: { ...existingActor, [subsystem]: { ...existingSub, ...patch } },
    },
  };
  await game.settings.set(MODULE_ID, POLICY_KEY, next);
  return next;
}
