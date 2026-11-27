// Движок уникальных способностей (данные: abilities_data.js, создаётся tools/patch_bp.py из tools/forge/uniq.py).
// Каждое существо аддона получает своё сочетание способностей и свой трофей. Союзники (areAllies) никогда не страдают.
import { world, system, EntityDamageCause, ItemStack } from "@minecraft/server";
import { ABILITIES, DROPS, NAMES } from "./abilities_data.js";
import { areAllies } from "./factions.js";
import { valid, alive, isPlayer, inSurvival, fx, sound, playersNear, assignSummonCipher } from "./util.js";

const DIMS = ["overworld", "nether", "the_end"];
const cooldown = new Map();     // `${id}|${key}` -> tick
const rnd = Math.random;

function ready(e, key, ticks, jitter = true) {
  const k = e.id + "|" + key, t = system.currentTick;
  const next = cooldown.get(k);
  if (next === undefined && jitter) { cooldown.set(k, t + Math.floor(rnd() * ticks * 0.6)); return false; }
  if (next !== undefined && next > t) return false;
  cooldown.set(k, t + ticks);
  return true;
}
const hpOf = (e) => { try { return e.getComponent("minecraft:health"); } catch { return undefined; } };
function frac(e) { const h = hpOf(e); return h ? h.currentValue / Math.max(1, h.effectiveMax) : 1; }
function heal(e, amt) { const h = hpOf(e); if (h && h.currentValue > 0) { try { h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + amt)); } catch {} } }
function addFx(e, list) { for (const [id, sec, amp] of list || []) { try { e.addEffect(id, Math.round(sec * 20), { amplifier: amp, showParticles: true }); } catch {} } }
function isFoe(self, x) {
  if (!x || x.id === self.id || !valid(x) || !alive(x) || areAllies(self, x)) return false;
  if (isPlayer(x)) return inSurvival(x);
  try { return x.getComponent("minecraft:type_family")?.hasTypeFamily("monster") === true && !!hpOf(x); } catch { return false; }
}
function near(self, r) {
  try { return self.dimension.getEntities({ location: self.location, maxDistance: r }); } catch { return []; }
}
const foesNear = (self, r) => near(self, r).filter((x) => isFoe(self, x));
const alliesNear = (self, r, withSelf = false) => near(self, r).filter((x) => (withSelf || x.id !== self.id) && areAllies(self, x) && valid(x) && alive(x) && x.typeId !== "minecraft:player");
function nearestFoe(self, r) {
  let t; try { t = self.target; } catch {}
  if (t && isFoe(self, t)) { const d = dist(self.location, t.location); if (d <= r) return t; }
  let best, bd = r + 1;
  for (const f of foesNear(self, r)) { const d = dist(self.location, f.location); if (d < bd) { bd = d; best = f; } }
  return best;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
function push(from, to, h, v) {
  const dx = to.location.x - from.location.x, dz = to.location.z - from.location.z, l = Math.hypot(dx, dz) || 1;
  try { if (isPlayer(to)) to.applyKnockback(dx / l, dz / l, h, v); else to.applyImpulse({ x: dx / l * h * 0.5, y: v * 0.6, z: dz / l * h * 0.5 }); } catch {}
}
function hurtFoe(self, f, dmg, cause = EntityDamageCause.magic) { try { f.applyDamage(dmg, { cause, damagingEntity: self }); } catch {} }
function say(self, text) {
  for (const p of playersNear(self.dimension, self.location, 22)) { try { p.onScreenDisplay.setActionBar(`§7${NAMES[self.typeId] ?? ""}: §f${text}`); } catch {} }
}
function beam(dim, a, b, particle) {
  const n = Math.max(2, Math.floor(dist(a, b) / 1.2));
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    try { dim.spawnParticle(particle || "minecraft:basic_crit_particle", { x: a.x + (b.x - a.x) * k, y: a.y + 1.2 + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k }); } catch {}
  }
}
function ring(dim, c, r, particle) {
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; try { dim.spawnParticle(particle || "minecraft:large_explosion", { x: c.x + Math.cos(a) * r, y: c.y + 0.3, z: c.z + Math.sin(a) * r }); } catch {} }
}

// ------------------------------------------------------------------ casts
function doCast(e, ab, target) {
  const dim = e.dimension, loc = e.location;
  switch (ab.do) {
    case "bolt": {
      if (!target) return false;
      beam(dim, loc, target.location, ab.p);
      hurtFoe(e, target, ab.dmg ?? 5); if (ab.fire) { try { target.setOnFire(ab.fire, true); } catch {} } addFx(target, ab.fx);
      if (ab.chain) { let left = ab.chain.n; for (const f of foesNear(target, ab.chain.r)) { if (f.id === target.id || left-- <= 0) break; beam(dim, target.location, f.location, ab.p); hurtFoe(e, f, ab.chain.dmg); } }
      sound(dim, "random.bow", loc, 1, 1.4); return true;
    }
    case "slam": {
      const hit = foesNear(e, ab.r ?? 4); if (!hit.length) return false;
      for (const f of hit) { hurtFoe(e, f, ab.dmg ?? 5, EntityDamageCause.entityAttack); if (ab.kb) push(e, f, ab.kb[0], ab.kb[1]); if (ab.fire) { try { f.setOnFire(ab.fire, true); } catch {} } addFx(f, ab.fx); }
      ring(dim, loc, (ab.r ?? 4) * 0.8); sound(dim, "random.explode", loc, 0.8, 1.2); return true;
    }
    case "leap": {
      if (!target) return false;
      const dx = target.location.x - loc.x, dz = target.location.z - loc.z, l = Math.hypot(dx, dz) || 1;
      try { e.applyImpulse({ x: dx / l * (ab.h ?? 0.9), y: ab.v ?? 0.5, z: dz / l * (ab.h ?? 0.9) }); } catch {} return true;
    }
    case "charge": {
      if (!target) return false;
      const dx = target.location.x - loc.x, dz = target.location.z - loc.z, l = Math.hypot(dx, dz) || 1;
      try { e.applyImpulse({ x: dx / l * 1.3, y: 0.35, z: dz / l * 1.3 }); } catch {}
      system.runTimeout(() => {
        if (!valid(e) || !alive(e)) return;
        for (const f of foesNear(e, ab.r ?? 3)) { hurtFoe(e, f, ab.dmg ?? 8, EntityDamageCause.entityAttack); push(e, f, 1.6, 0.5); if (ab.fire) { try { f.setOnFire(ab.fire, true); } catch {} } addFx(f, ab.fx); }
        ring(e.dimension, e.location, ab.r ?? 3);
      }, 12);
      return true;
    }
    case "summon": {
      const have = near(e, 28).filter((x) => x.typeId === ab.id).length;
      if (have >= (ab.cap ?? 3)) return false;
      for (let i = 0; i < (ab.n ?? 1); i++) {
        try { const m = dim.spawnEntity(ab.id, { x: loc.x + (rnd() - 0.5) * 4, y: loc.y, z: loc.z + (rnd() - 0.5) * 4 }); try { assignSummonCipher(m, e); } catch {} try { m.addTag("uniq_child"); } catch {} } catch {}
      }
      fx(dim, "minecraft:totem_particle", loc); return true;
    }
    case "heal": {
      if (ab.only_self) { if (frac(e) > 0.5) return false; heal(e, ab.amt ?? 6); fx(dim, "minecraft:heart_particle", loc); return true; }
      const allies = alliesNear(e, ab.r ?? 8, !!ab.self_too).filter((a) => frac(a) < 0.95);
      if (!allies.length && frac(e) > 0.8) return false;
      for (const a of allies) { heal(a, ab.amt ?? 6); fx(a.dimension, "minecraft:heart_particle", a.location); }
      if (frac(e) < 0.9) heal(e, (ab.amt ?? 6) / 2);
      sound(dim, "random.levelup", loc, 0.6, 1.4); return true;
    }
    case "blink": {
      if (!target) return false;
      const yaw = (target.getRotation?.().y ?? 0) * Math.PI / 180;
      const to = { x: target.location.x + Math.sin(yaw) * 1.6, y: target.location.y, z: target.location.z - Math.cos(yaw) * 1.6 };
      fx(dim, "minecraft:portal_directional", loc); try { e.teleport(to, { dimension: dim }); } catch { return false; } fx(dim, "minecraft:portal_directional", to);
      sound(dim, "mob.endermen.portal", to, 0.8, 1.2); return true;
    }
    case "rally": { const a = alliesNear(e, ab.r ?? 10, true); if (a.length < 2 && !target) return false; for (const x of a) { addFx(x, ab.fx); fx(x.dimension, "minecraft:totem_particle", x.location); } return true; }
    case "fear": { const f = foesNear(e, ab.r ?? 8); if (!f.length) return false; for (const x of f) addFx(x, ab.fx); ring(dim, loc, ab.r ?? 8, "minecraft:villager_angry"); sound(dim, "mob.wither.ambient", loc, 0.7, 0.7); return true; }
    case "pull": { const f = foesNear(e, ab.r ?? 8); if (!f.length) return false; for (const x of f) { push(x, e, ab.str ?? 1.1, 0.25); addFx(x, ab.fx); } return true; }
    case "mist": { const f = foesNear(e, ab.r ?? 7); if (!f.length) return false; for (const x of f) addFx(x, ab.fx); addFx(e, ab.self_fx); ring(dim, loc, 3, "minecraft:cauldron_explosion_emitter"); return true; }
  }
  return false;
}

// ------------------------------------------------------------------ telegraphs (v10.12)
const TELEGRAPH = new Set(["bolt", "slam", "charge", "pull", "fear", "mist"]);
function warn(e, ab) {
  const dim = e.dimension, loc = e.location;
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, r = ab.do === "slam" ? (ab.r ?? 4) : 1.6;
    try { dim.spawnParticle("minecraft:villager_angry", { x: loc.x + Math.cos(a) * r, y: loc.y + 0.4, z: loc.z + Math.sin(a) * r }); } catch {}
  }
  sound(dim, ab.do === "charge" ? "mob.goat.prepare_ram" : "mob.evocation_illager.prepare_attack", loc, 1, 0.9);
  say(e, "§c⚠ " + ab.name + "…");
}

// ------------------------------------------------------------------ main loop (every 10 ticks)
system.runInterval(() => {
  for (const d of DIMS) {
    let list = [];
    try { list = world.getDimension(d).getEntities({ families: ["summon_safe"] }); } catch { continue; }
    for (const e of list) {
      const defs = ABILITIES[e.typeId];
      if (!defs || !valid(e) || !alive(e)) continue;
      try {
        for (let i = 0; i < defs.length; i++) {
          const ab = defs[i];
          if (ab.k === "aura") {
            if (!ready(e, "a" + i, ab.every)) continue;
            const targets = ab.to === "self" ? [e] : ab.to === "allies" ? alliesNear(e, ab.r, true) : foesNear(e, ab.r);
            if (!targets.length) continue;
            for (const t of targets) { addFx(t, ab.fx); if (ab.to === "foes" && !ab.fx.length) { try { t.setOnFire(2, true); } catch {} } }
            if (ab.p && ab.to !== "self") fx(e.dimension, ab.p, { x: e.location.x, y: e.location.y + 1, z: e.location.z });
          } else if (ab.k === "cast") {
            if (!ready(e, "c" + i, ab.cd)) continue;
            if (ab.do === "heal" && ab.only_self && frac(e) > 0.5) continue;
            const t = nearestFoe(e, ab.rng ?? 12);
            if (!t && ab.do !== "heal") continue;
            if (TELEGRAPH.has(ab.do) && isPlayer(t)) {          // fair play: warn, then strike ~0.8 s later (step away / block)
              warn(e, ab);
              system.runTimeout(() => {
                try { if (valid(e) && alive(e)) { const t2 = nearestFoe(e, ab.rng ?? 12); if (t2) doCast(e, ab, t2); } } catch {}
              }, 16);
              continue;
            }
            if (doCast(e, ab, t)) say(e, ab.name + "!");
            else cooldown.set(e.id + "|c" + i, system.currentTick + 40);
          }
        }
      } catch {}
    }
  }
}, 10);

// ------------------------------------------------------------------ on hit
world.afterEvents.entityHitEntity.subscribe((ev) => {
  try {
    const a = ev.damagingEntity, v = ev.hitEntity;
    const defs = ABILITIES[a?.typeId];
    if (!defs || !valid(a) || !valid(v) || areAllies(a, v)) return;
    for (const ab of defs) {
      if (ab.k !== "hit" || rnd() > ab.ch) continue;
      let extra = 0;
      if (ab.vs) { try { const tf = v.getComponent("minecraft:type_family"); for (const fam in ab.vs) if (tf?.hasTypeFamily(fam)) { extra += ab.vs[fam].dmg ?? 0; if (ab.vs[fam].fire) v.setOnFire(ab.vs[fam].fire, true); } } catch {} }
      if (extra) hurtFoe(a, v, extra, EntityDamageCause.magic);
      addFx(v, ab.fx); if (ab.fire) { try { v.setOnFire(ab.fire, true); } catch {} }
      if (ab.kb) push(a, v, ab.kb[0], ab.kb[1]);
      if (ab.steal) heal(a, Math.min(4, 3 * ab.steal * 5));
      addFx(a, ab.self_fx);
      if (ab.cleave) for (const f of foesNear(v, ab.cleave.r)) if (f.id !== v.id) hurtFoe(a, f, ab.cleave.dmg, EntityDamageCause.entityAttack);
      if (ab.chain) { let n = ab.chain.n; for (const f of foesNear(v, ab.chain.r)) { if (f.id === v.id || n-- <= 0) break; hurtFoe(a, f, ab.chain.dmg); } }
      if (ab.p) fx(v.dimension, ab.p, v.location);
    }
  } catch {}
});

// ------------------------------------------------------------------ on hurt
world.afterEvents.entityHurt.subscribe((ev) => {
  try {
    const e = ev.hurtEntity, defs = ABILITIES[e?.typeId];
    if (!defs || !valid(e) || !alive(e)) return;
    const atk = ev.damageSource?.damagingEntity;
    for (let i = 0; i < defs.length; i++) {
      const ab = defs[i];
      if (ab.k !== "hurt") continue;
      if (ab.below !== null && ab.below !== undefined && frac(e) > ab.below) continue;
      if (ab.thorns && atk && valid(atk) && !areAllies(e, atk)) hurtFoe(e, atk, ab.thorns, EntityDamageCause.thorns);
      if (!ready(e, "h" + i, ab.cd, false)) continue;
      if (atk && valid(atk) && !areAllies(e, atk)) { if (ab.kb) push(e, atk, ab.kb[0], ab.kb[1]); addFx(atk, ab.fx); }
      addFx(e, ab.self_fx); if (ab.heal) heal(e, ab.heal);
      if (ab.self_fx?.length || ab.kb) say(e, ab.name + "!");
    }
  } catch {}
});

// ------------------------------------------------------------------ on death: burst, children, unique trophies
world.afterEvents.entityDie.subscribe((ev) => {
  try {
    const e = ev.deadEntity, id = e.typeId;
    const defs = ABILITIES[id] || [], drops = DROPS[id] || [];
    if (!defs.length && !drops.length) return;
    const loc = e.location, dim = e.dimension;
    for (const ab of defs) {
      if (ab.k !== "death") continue;
      if (ab.burst) {
        for (const f of near(e, ab.burst.r)) { if (areAllies(e, f) || f.id === e.id || !valid(f)) continue; if (!isFoe(e, f) && !isPlayer(f)) continue;
          if (ab.burst.dmg) hurtFoe(e, f, ab.burst.dmg, EntityDamageCause.entityExplosion); if (ab.burst.fire) { try { f.setOnFire(ab.burst.fire, true); } catch {} } addFx(f, ab.burst.fx); }
        ring(dim, loc, ab.burst.r, ab.p || "minecraft:large_explosion");
      }
      if (ab.spawn && !e.hasTag("uniq_child")) {
        for (let i = 0; i < ab.spawn[1]; i++) { try { const m = dim.spawnEntity(ab.spawn[0], { x: loc.x + (rnd() - 0.5) * 3, y: loc.y, z: loc.z + (rnd() - 0.5) * 3 }); m.addTag("uniq_child"); } catch {} }
      }
    }
    for (const [item, lo, hi, ch, name, lore] of drops) {
      if (rnd() > ch) continue;
      try {
        const st = new ItemStack(item, lo + Math.floor(rnd() * (hi - lo + 1)));
        if (name) st.nameTag = name; if (lore) st.setLore([lore]);
        dim.spawnItem(st, loc);
      } catch {}
    }
  } catch {}
});
