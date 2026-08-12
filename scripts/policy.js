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
