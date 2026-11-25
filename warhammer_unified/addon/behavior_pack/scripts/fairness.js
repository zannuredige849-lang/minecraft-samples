// v10.12 Fairness guard: every scripted mechanic of the add-on stays beatable.
// Loaded first (main.js). It wraps the few engine calls that scripts use to hurt players or to heal bosses:
//   * Entity.applyDamage on a player  -> per-hit cap (40% of max HP from a boss, 25% from other mobs),
//                                        rolling 3-second cap (60% of max HP), short scripted i-frames
//   * Entity.kill on a player         -> turned into a capped hit (no scripted instant deaths)
//   * Entity.addEffect on a player    -> harmful effects: duration and amplifier caps, no endless re-stacking
//   * health.setCurrentValue on a boss-> while fighting players a boss heals at most 8% of max HP per 10 s
// Melee hits from minecraft:attack are not touched here; those are balanced in the behaviour files (BALANCE.md).
import { world, system, Entity, EntityAttributeComponent } from "@minecraft/server";

const BOSSES = new Set(["cb:ares", "cb:athena", "cb:circe", "cb:cyclops", "cb:dreadlord", "cb:fel_lord", "cb:guldan", "cb:hades", "cb:hephaestus", "cb:hydra", "cb:ice_spirit", "cb:lich_king", "cb:lich_statue", "cb:minotaur", "cb:poseidon", "cb:zeus", "warcraft:abomination_lord", "warcraft:ember_colossus", "warcraft:great_unclean_one"]);
const OURS = (id) => typeof id === "string" && (id.startsWith("cb:") || id.startsWith("warcraft:"));

// harmful effect -> [max duration ticks, max amplifier]
const EFFECT_CAP = {
  slowness: [100, 1], mining_fatigue: [100, 1], levitation: [40, 0], wither: [100, 0], poison: [100, 1],
  fatal_poison: [60, 0], blindness: [60, 0], darkness: [80, 0], nausea: [100, 0], weakness: [160, 1],
  hunger: [200, 1], instant_damage: [1, 0], bad_omen: [0, 0], infested: [100, 0], oozing: [100, 0], weaving: [100, 0],
};

const hitLog = new Map();      // player id -> [{t, dmg}]
const lastHit = new Map();     // player id -> tick of last scripted hit
const bossHeal = new Map();    // boss id -> {t0, healed}
const bossFight = new Map();   // boss id -> tick a player last hurt it

function isPlayer(e) { try { return e?.typeId === "minecraft:player"; } catch { return false; } }
function vulnerable(p) {
  try { const m = String(p.getGameMode?.() ?? "survival").toLowerCase(); return m !== "creative" && m !== "spectator"; } catch { return true; }
}
function maxHp(e) { try { return e.getComponent("minecraft:health")?.effectiveMax ?? 20; } catch { return 20; } }

function capScripted(player, amount, src) {
  const now = system.currentTick;
  const mx = maxHp(player);
  const fromBoss = src && BOSSES.has(src.typeId);
  let dmg = Math.min(amount, Math.max(2, mx * (fromBoss ? 0.40 : 0.25)));
  // scripted i-frames: a second scripted hit within half a second only does half
  const lt = lastHit.get(player.id);
  if (lt !== undefined && now - lt < 10) dmg *= 0.5;
  // rolling 3-second budget
  const log = (hitLog.get(player.id) ?? []).filter((h) => now - h.t < 60);
  const used = log.reduce((s, h) => s + h.dmg, 0);
  const room = Math.max(0, mx * 0.60 - used);
  dmg = Math.min(dmg, room);
  if (dmg <= 0) return 0;
  log.push({ t: now, dmg });
  hitLog.set(player.id, log);
  lastHit.set(player.id, now);
  return Math.max(0.5, Math.round(dmg * 2) / 2);
}

function patch(proto, name, wrap) {
  try {
    const orig = proto[name];
    if (typeof orig !== "function" || orig.__fair) return;
    const f = wrap(orig);
    f.__fair = true;
    proto[name] = f;
  } catch (e) { console.warn(`[fairness] cannot wrap ${name}: ${e}`); }
}

patch(Entity.prototype, "applyDamage", (orig) => function (amount, options) {
  try {
    if (isPlayer(this) && vulnerable(this) && amount > 0) {
      const src = options?.damagingEntity;
      if (!isPlayer(src)) {
        amount = capScripted(this, amount, src);
        if (amount <= 0) return false;
      }
    }
  } catch {}
  return orig.call(this, amount, options);
});

patch(Entity.prototype, "kill", (orig) => function () {
  try {
    if (isPlayer(this) && vulnerable(this)) {
      const dmg = capScripted(this, maxHp(this), undefined);
      if (dmg > 0) { try { this.applyDamage(dmg); } catch {} }
      return false;
    }
  } catch {}
  return orig.call(this);
});

patch(Entity.prototype, "addEffect", (orig) => function (effectType, duration, options) {
  try {
    if (isPlayer(this) && vulnerable(this)) {
      const id = String(typeof effectType === "string" ? effectType : effectType?.getName?.() ?? effectType?.id ?? "").replace("minecraft:", "");
      const cap = EFFECT_CAP[id];
      if (cap) {
        if (cap[0] === 0) return undefined;
        duration = Math.min(duration, cap[0]);
        const o = { ...(options ?? {}) };
        if ((o.amplifier ?? 0) > cap[1]) o.amplifier = cap[1];
        let cur; try { cur = this.getEffect(id); } catch {}
        if (cur && cur.duration >= duration * 0.5) return cur;     // no endless re-stacking: let it run out first
        options = o;
      }
    }
  } catch {}
  return orig.call(this, effectType, duration, options);
});

// bosses: who is fighting them
world.afterEvents.entityHurt.subscribe((ev) => {
  try {
    const e = ev.hurtEntity;
    if (e && BOSSES.has(e.typeId) && isPlayer(ev.damageSource?.damagingEntity)) bossFight.set(e.id, system.currentTick);
  } catch {}
});

patch(EntityAttributeComponent.prototype, "setCurrentValue", (orig) => function (value) {
  try {
    if (this.typeId === "minecraft:health") {
      const e = this.entity;
      if (e && BOSSES.has(e.typeId)) {
        const now = system.currentTick, cur = this.currentValue, mx = this.effectiveMax;
        const fighting = now - (bossFight.get(e.id) ?? -99999) < 600;
        if (value > cur && fighting) {
          let st = bossHeal.get(e.id);
          if (!st || now - st.t0 >= 200) { st = { t0: now, healed: 0 }; bossHeal.set(e.id, st); }
          const room = Math.max(0, mx * 0.08 - st.healed);
          const add = Math.min(value - cur, room);
          st.healed += add;
          value = cur + add;
        }
      }
    }
  } catch {}
  return orig.call(this, value);
});

// warnings: when a boss gets a player in range for the first time, tell them what helps
const warned = new Map();
system.runInterval(() => {
  const now = system.currentTick;
  for (const p of world.getAllPlayers()) {
    let boss;
    try { boss = p.dimension.getEntities({ location: p.location, maxDistance: 24 }).find((e) => BOSSES.has(e.typeId)); } catch {}
    if (!boss) continue;
    const k = p.id + "|" + boss.id;
    if (warned.has(k) && now - warned.get(k) < 6000) continue;
    warned.set(k, now);
    try {
      p.onScreenDisplay.setActionBar("§6Босс рядом: §fперед сильными ударами он предупреждает — отходите; приёмы босса — в Бестиарии");
    } catch {}
  }
  for (const [id, list] of hitLog) if (!list.some((h) => now - h.t < 60)) hitLog.delete(id);
}, 40);
