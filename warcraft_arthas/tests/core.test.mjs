import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ACTIONS, CONFIG, validateConfig, phaseForHealthFraction } from "../behavior_pack/scripts/core/configuration.js";
import { weightedPick, CooldownTracker, yawToDirection, distance, ticks, clamp } from "../behavior_pack/scripts/core/utilities.js";
import { createStore } from "../behavior_pack/scripts/core/persistence.js";

const entity = JSON.parse(fs.readFileSync(new URL("../behavior_pack/entities/arthas.json", import.meta.url)));

test("default configuration is valid", () => assert.deepEqual(validateConfig(), []));

test("invalid configuration is reported", () => {
  const bad = structuredClone(CONFIG);
  bad.boss.phaseThresholds = { phase2: 0.3, phase3: 0.6 };
  bad.souls.capacity = 0;
  assert.equal(validateConfig(bad).length, 2);
});

test("phases: 100-70% / 70-35% / 35-0%", () => {
  assert.equal(phaseForHealthFraction(1), 1);
  assert.equal(phaseForHealthFraction(0.71), 1);
  assert.equal(phaseForHealthFraction(0.7), 2);
  assert.equal(phaseForHealthFraction(0.36), 2);
  assert.equal(phaseForHealthFraction(0.35), 3);
  assert.equal(phaseForHealthFraction(0.01), 3);
});

test("script ACTIONS match the entity enum property warcraft:action", () => {
  const prop = entity["minecraft:entity"].description.properties["warcraft:action"];
  assert.deepEqual([...ACTIONS], prop.values);
  assert.ok(ACTIONS.includes(prop.default));
});

test("entity phase property range covers the three boss phases", () => {
  const p = entity["minecraft:entity"].description.properties["warcraft:phase"];
  assert.deepEqual(p.range, [1, 3]);
});

test("weightedPick avoids repeating recent entries but falls back when it must", () => {
  const entries = [{ item: "a", weight: 1 }, { item: "b", weight: 1 }];
  for (let i = 0; i < 50; i++) assert.equal(weightedPick(entries, ["a"]), "b");
  assert.ok(["a", "b"].includes(weightedPick(entries, ["a", "b"])));
  assert.equal(weightedPick([{ item: "z", weight: 0 }]), undefined);
});

test("CooldownTracker", () => {
  const c = new CooldownTracker();
  assert.ok(c.isReady("x", 0));
  c.start("x", 10, 40);
  assert.ok(!c.isReady("x", 49));
  assert.equal(c.remaining("x", 20), 30);
  assert.ok(c.isReady("x", 50));
});

test("vector helpers", () => {
  assert.equal(distance({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 }), 5);
  const d = yawToDirection(0);
  assert.ok(Math.abs(d.z - 1) < 1e-9 && Math.abs(d.x) < 1e-9);
  assert.equal(ticks(1.5), 30);
  assert.equal(clamp(5, 0, 3), 3);
});

/** Map-backed stand-in for `world` / `Player` dynamic properties. */
function fakeHost() {
  const m = new Map();
  return { m, getDynamicProperty: (k) => m.get(k), setDynamicProperty: (k, v) => (v === undefined ? m.delete(k) : m.set(k, v)) };
}

test("persistence round-trips structured data, chunking long values", () => {
  const h = fakeHost();
  const s = createStore(h, "t");
  const data = { souls: Array.from({ length: 400 }, (_, i) => ({ soul_id: `s${i}`, original_entity_type: "minecraft:zombie", soul_strength: i % 7 })) };
  s.set("souls", data);
  assert.ok([...h.m.keys()].filter((k) => /#\d+$/.test(k)).length >= 2, "expected several chunks");
  assert.deepEqual(s.get("souls", null), data);
});

test("persistence overwrite removes stale chunks; remove() clears everything", () => {
  const h = fakeHost();
  const s = createStore(h, "t");
  s.set("k", "y".repeat(30000));
  const big = h.m.size;
  s.set("k", "small");
  assert.ok(h.m.size < big);
  assert.equal(s.get("k", null), "small");
  s.remove("k");
  assert.equal(h.m.size, 0);
  assert.equal(s.has("k"), false);
});

test("persistence never throws on corrupt or foreign-version data", () => {
  const h = fakeHost();
  const s = createStore(h, "t");
  s.set("k", { a: 1 });
  h.m.set("t:k#0", "{not json");
  assert.deepEqual(s.get("k", "fallback"), "fallback");
  h.m.set("t:k#0", JSON.stringify({ v: 999, data: 1 }));
  assert.equal(s.get("k", "fallback"), "fallback");
  h.m.delete("t:k#0");
  assert.equal(s.get("k", "fallback"), "fallback");
});
