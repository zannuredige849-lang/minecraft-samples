// @ts-check
/**
 * Persistent storage on top of Bedrock *dynamic properties*.
 *
 * Entity properties and arbitrary entity fields are NOT saved automatically, so structured data
 * (captured souls, settings) is stored as versioned JSON in dynamic properties of the world or of a
 * player.  Long values are split into chunks so a single property never grows beyond `CHUNK`.
 * The store is created from a "host" (anything with get/set/getDynamicProperty, i.e. `world` or a
 * `Player`), which keeps the logic unit-testable without the game.
 */

export const STORE_VERSION = 1;
const CHUNK = 8000;

/**
 * @typedef {{
 *   getDynamicProperty(id: string): string | number | boolean | {x:number,y:number,z:number} | undefined,
 *   setDynamicProperty(id: string, value?: string | number | boolean): void,
 *   getDynamicPropertyIds?(): string[]
 * }} PropertyHost
 */

/** @param {PropertyHost} host @param {string} namespace */
export function createStore(host, namespace) {
  const k = (/** @type {string} */ key) => `${namespace}:${key}`;
  const metaKey = (/** @type {string} */ key) => `${k(key)}#n`;
  const partKey = (/** @type {string} */ key, /** @type {number} */ i) => `${k(key)}#${i}`;

  /** @param {string} key */
  function clearParts(key) {
    const n = host.getDynamicProperty(metaKey(key));
    if (typeof n === "number") for (let i = 0; i < n; i++) host.setDynamicProperty(partKey(key, i), undefined);
    host.setDynamicProperty(metaKey(key), undefined);
  }

  return {
    /** @param {string} key @param {unknown} value */
    set(key, value) {
      const json = JSON.stringify({ v: STORE_VERSION, data: value });
      clearParts(key);
      const n = Math.ceil(json.length / CHUNK);
      for (let i = 0; i < n; i++) host.setDynamicProperty(partKey(key, i), json.slice(i * CHUNK, (i + 1) * CHUNK));
      host.setDynamicProperty(metaKey(key), n);
    },
    /** @template T @param {string} key @param {T} fallback @returns {T} */
    get(key, fallback) {
      const n = host.getDynamicProperty(metaKey(key));
      if (typeof n !== "number" || n < 1) return fallback;
      let json = "";
      for (let i = 0; i < n; i++) {
        const part = host.getDynamicProperty(partKey(key, i));
        if (typeof part !== "string") return fallback; // corrupted/missing chunk -> never crash the game
        json += part;
      }
      try {
        const env = JSON.parse(json);
        if (!env || env.v !== STORE_VERSION) return fallback;
        return env.data;
      } catch {
        return fallback;
      }
    },
    /** @param {string} key */
    has(key) {
      return typeof host.getDynamicProperty(metaKey(key)) === "number";
    },
    /** @param {string} key */
    remove(key) {
      clearParts(key);
    },
  };
}

/** Namespaces used by the add-on. */
export const NS = Object.freeze({ world: "warcraft", souls: "warcraft_souls" });
