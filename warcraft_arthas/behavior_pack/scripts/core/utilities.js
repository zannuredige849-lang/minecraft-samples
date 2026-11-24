// @ts-check
/** Small, dependency-free helpers shared by all modules (pure functions: unit-tested without the game). */

/** @typedef {{x:number,y:number,z:number}} Vec3 */

export const TICKS_PER_SECOND = 20;

/** @param {number} seconds */
export const ticks = (seconds) => Math.max(0, Math.round(seconds * TICKS_PER_SECOND));

/** @param {number} v @param {number} lo @param {number} hi */
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** @param {Vec3} a @param {Vec3} b */
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Horizontal (XZ) distance. @param {Vec3} a @param {Vec3} b */
export const distanceXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** @param {Vec3} a @param {Vec3} b @returns {Vec3} */
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

/** @param {Vec3} a @param {number} k @returns {Vec3} */
export const scale = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });

/** @param {Vec3} a @returns {Vec3} */
export function normalize(a) {
  const l = Math.hypot(a.x, a.y, a.z);
  return l < 1e-9 ? { x: 0, y: 0, z: 0 } : scale(a, 1 / l);
}

/** Unit vector for a yaw angle in degrees (Minecraft: yaw 0 faces +Z). @param {number} yawDeg @returns {Vec3} */
export function yawToDirection(yawDeg) {
  const r = (yawDeg * Math.PI) / 180;
  return { x: -Math.sin(r), y: 0, z: Math.cos(r) };
}

/** @template T @param {T[]} arr @param {() => number} [rng] */
export function pick(arr, rng = Math.random) {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Weighted random choice that refuses to repeat the last `avoid` entries when alternatives exist.
 * @template T
 * @param {{item:T, weight:number}[]} entries
 * @param {T[]} [avoid]
 * @param {() => number} [rng]
 * @returns {T|undefined}
 */
export function weightedPick(entries, avoid = [], rng = Math.random) {
  let pool = entries.filter((e) => e.weight > 0 && !avoid.includes(e.item));
  if (pool.length === 0) pool = entries.filter((e) => e.weight > 0);
  const total = pool.reduce((s, e) => s + e.weight, 0);
  if (total <= 0) return undefined;
  let r = rng() * total;
  for (const e of pool) {
    r -= e.weight;
    if (r <= 0) return e.item;
  }
  return pool[pool.length - 1].item;
}

/** Runs `fn`, returning `fallback` instead of throwing (entities may become invalid between ticks). @template T @param {() => T} fn @param {T} fallback */
export function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** @param {any} entity */
export const isValidEntity = (entity) => !!entity && safe(() => entity.isValid, false) === true;

/** @param {unknown} e */
export function formatError(e) {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

/** Cooldown tracker keyed by ability name; time is supplied by the caller (game tick). */
export class CooldownTracker {
  constructor() {
    /** @type {Map<string, number>} */
    this.readyAt = new Map();
  }
  /** @param {string} key @param {number} nowTick */
  isReady(key, nowTick) {
    return nowTick >= (this.readyAt.get(key) ?? 0);
  }
  /** @param {string} key @param {number} nowTick @param {number} durationTicks */
  start(key, nowTick, durationTicks) {
    this.readyAt.set(key, nowTick + durationTicks);
  }
  /** @param {string} key @param {number} nowTick */
  remaining(key, nowTick) {
    return Math.max(0, (this.readyAt.get(key) ?? 0) - nowTick);
  }
}
