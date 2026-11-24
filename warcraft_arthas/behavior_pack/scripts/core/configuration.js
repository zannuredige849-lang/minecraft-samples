// @ts-check
/**
 * Central, validated configuration for the Arthas add-on.
 * Every cooldown (in seconds) and damage value used by the boss lives here so it can be tuned
 * without touching gameplay code.  `validateConfig` is run at startup and by the unit tests.
 */

export const ADDON_ID = "warcraft";
export const ARTHAS_ID = "warcraft:arthas";
export const FROSTMOURNE_ID = "warcraft:frostmourne";
export const DEBUG_PREFIX = "warcraft";

/** Values of the entity enum property `warcraft:action` (must stay in sync with entities/arthas.json). */
export const ACTIONS = Object.freeze([
  "idle", "attack_light", "attack_heavy", "overhead", "slash", "raise", "absorb",
  "cast", "execute", "ultimate", "transition", "intro", "victory", "death",
]);

/** Internal AI states of the boss state machine (kept in script memory, not synced to clients). */
export const AI_STATES = Object.freeze([
  "idle", "patrol", "detect", "approach", "combat", "heavy_attack", "cast", "summon",
  "enrage", "execute", "phase_transition", "victory", "death",
]);

/** @param {any} o */
function deepFreeze(o) {
  Object.values(o).forEach((v) => {
    if (v && typeof v === "object" && !Object.isFrozen(v)) deepFreeze(v);
  });
  return Object.freeze(o);
}

export const CONFIG = deepFreeze({
  boss: {
    /** Health fraction (current/max) at which the next phase starts. */
    phaseThresholds: { phase2: 0.7, phase3: 0.35 },
    /** The fight can never be won by a single hit: damage is never allowed to take the boss below this fraction before the death sequence runs. */
    deathFloorFraction: 0.01,
    aiTickInterval: 4,
  },
  debug: {
    enabled: true,
    /** Players need this tag to use developer commands (granting it requires command permission). */
    requiredTag: "warcraft_dev",
  },
  souls: { capacity: 64, maxActiveServants: 6 },
  cinematic: { enabled: true, durationTicks: 160, useCamera: true },
});

/**
 * @param {typeof CONFIG} [cfg]
 * @returns {string[]} list of human-readable problems (empty = valid)
 */
export function validateConfig(cfg = CONFIG) {
  const errors = [];
  const { phase2, phase3 } = cfg.boss.phaseThresholds;
  if (!(phase2 > phase3 && phase3 > 0 && phase2 < 1)) errors.push("boss.phaseThresholds must satisfy 1 > phase2 > phase3 > 0");
  if (!(cfg.boss.deathFloorFraction > 0 && cfg.boss.deathFloorFraction < phase3)) errors.push("boss.deathFloorFraction must be in (0, phase3)");
  if (!Number.isInteger(cfg.boss.aiTickInterval) || cfg.boss.aiTickInterval < 1) errors.push("boss.aiTickInterval must be an integer >= 1");
  if (!Number.isInteger(cfg.souls.capacity) || cfg.souls.capacity < 1 || cfg.souls.capacity > 256) errors.push("souls.capacity must be an integer in 1..256");
  if (!Number.isInteger(cfg.souls.maxActiveServants) || cfg.souls.maxActiveServants < 0 || cfg.souls.maxActiveServants > 16) errors.push("souls.maxActiveServants must be an integer in 0..16");
  if (!Number.isInteger(cfg.cinematic.durationTicks) || cfg.cinematic.durationTicks < 20) errors.push("cinematic.durationTicks must be >= 20");
  return errors;
}

/**
 * Boss phase (1..3) for a given health fraction.
 * @param {number} fraction current health / max health
 * @returns {1|2|3}
 */
export function phaseForHealthFraction(fraction) {
  const { phase2, phase3 } = CONFIG.boss.phaseThresholds;
  if (fraction <= phase3) return 3;
  if (fraction <= phase2) return 2;
  return 1;
}
