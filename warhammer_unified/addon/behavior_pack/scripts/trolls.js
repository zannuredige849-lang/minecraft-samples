import { world, system } from "@minecraft/server";
import {
  dist2, dist3, randInt, getDifficultyScale, safePlayAnim,
  assignSummonCipher, sameSummonCipher, isPlayer, inSurvival, alive, valid
} from "./util.js";
import { sameSide, setFoe, foeOf } from "./mob_ai.js";

/**
 * TROLLS SYSTEM (ZhekAziz Fathylogy v1.68)
 * 5 Unique Types with distinct models, roles, behaviors, and abilities:
 * 1. cb:smart_troll    (22 HP, 4 DMG, 3.8 blocks) — Weapon Strike & Spear Throw, allied with cb:orc & cb:tribal_troll
 * 2. cb:tribal_troll   (25 HP, 5 DMG, 3.8 blocks) — Summon Tribemates & Healing/Buffing Totem, allied with cb:orc & cb:smart_troll
 * 3. cb:wild_troll     (50 HP, 7 DMG, 4.0 blocks) — Fast Regeneration, Frenzy & Leap Attack
 * 4. cb:cannibal_troll (170 HP, 14 DMG, 4.2 blocks, Mini-Boss) — Stonefall, Earthquake Ground Slam, Stone Skin & Cannibal Feast
 * 5. cb:ice_troll      (120 HP, 10 DMG, 4.5 blocks, Elite) — Frost Aura & Ice Blast / Shards
 */

const TROLL_TYPES = [
  "cb:smart_troll",
  "cb:tribal_troll",
  "cb:wild_troll",
  "cb:cannibal_troll",
  "cb:ice_troll"
];

const cooldowns = new Map(); // id -> { spear, summon, totem, leap, stonefall, slam, stoneskin, iceblast }

function cdOf(id) {
  let c = cooldowns.get(id);
  if (!c) {
    c = { spear: 0, summon: 0, totem: 0, leap: 0, stonefall: 0, slam: 0, stoneskin: 0, iceblast: 0 };
    cooldowns.set(id, c);
  }
  return c;
}

function isTribalAlly(a, b) {
  if (!a || !b) return false;
  if (a.id === b.id) return true;
  if (sameSummonCipher(a, b)) return true;
  if (sameSide(a, b)) return true;
  const allySet = new Set(["cb:smart_troll", "cb:tribal_troll", "cb:orc", "cb:troll_totem"]);
  return allySet.has(a.typeId) && allySet.has(b.typeId);
}

function findTargetForTroll(troll, maxRadius = 22) {
  const dim = troll.dimension;
  const loc = troll.location;
  const type = troll.typeId;

  // Check if mob_ai has an active foe first (for smart_troll & tribal_troll)
  const aiFoe = foeOf(troll);
  if (aiFoe && alive(aiFoe) && !isTribalAlly(troll, aiFoe) && dist3(loc, aiFoe.location) <= maxRadius) {
    return aiFoe;
  }

  let best = null;
  let bestD = maxRadius;
  let list = [];
  try {
    list = dim.getEntities({ location: loc, maxDistance: maxRadius });
  } catch (e) {
    return null;
  }

  for (const e of list) {
    if (!e || !valid(e) || !alive(e) || e.id === troll.id) continue;
    if (e.typeId === "cb:sargeras_prompt" || e.typeId === "cb:lich_statue" || e.typeId === "cb:circe_orb" || e.typeId === "cb:fel_orb" || e.typeId === "cb:fel_rain" || e.typeId === "cb:hydra_spit" || e.typeId?.startsWith("cb:dragon_")) continue;
    if (isPlayer(e) && !inSurvival(e)) continue;
    if (e.typeId === "minecraft:item" || e.typeId === "minecraft:xp_orb" || e.typeId === "minecraft:arrow" || e.typeId === "minecraft:trident") continue;
    if (isPlayer(e) && !inSurvival(e)) continue;
    if (sameSummonCipher(troll, e)) continue;

    if (type === "cb:smart_troll" || type === "cb:tribal_troll") {
      // Friendly with cb:orc, cb:smart_troll, cb:tribal_troll; neutral to player unless provoked (setFoe)
      if (isTribalAlly(troll, e)) continue;
      const tf = e.getComponent("minecraft:type_family");
      const hostileToTribe =
        e.typeId === "cb:green_orc" ||
        e.typeId === "cb:hell_orc" ||
        e.typeId === "cb:fel_minion" ||
        e.typeId === "cb:guldan" ||
        e.typeId === "cb:wild_troll" ||
        e.typeId === "cb:cannibal_troll" ||
        (tf && (tf.hasTypeFamily("undead") || tf.hasTypeFamily("fel_orc") || tf.hasTypeFamily("fel_demon")));
      if (!hostileToTribe) continue;
    } else if (type === "cb:wild_troll") {
      if (e.typeId === "cb:wild_troll") continue;
      if (!isPlayer(e) && !e.typeId.startsWith("cb:human_") && !e.typeId.includes("orc") && e.typeId !== "minecraft:villager") continue;
    } else if (type === "cb:cannibal_troll") {
      // Hunts all living creatures except other cannibal trolls
      if (e.typeId === "cb:cannibal_troll" || e.typeId === "cb:troll_totem") continue;
    } else if (type === "cb:ice_troll") {
      if (e.typeId === "cb:ice_troll" || e.typeId === "cb:troll_totem") continue;
      if (dist3(loc, e.location) > 15) continue; // Territorial radius
    }

    const d = dist3(loc, e.location);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

// ============================================================================
// DIFFICULTY SCALING ON SPAWN (Exact Table Values on Normal = 1.0x)
// ============================================================================
const BASE_HP = {
  "cb:smart_troll": 22,
  "cb:tribal_troll": 25,
  "cb:wild_troll": 50,
  "cb:cannibal_troll": 170,
  "cb:ice_troll": 120
};

world.afterEvents.entitySpawn.subscribe((ev) => {
  const e = ev.entity;
  if (!e || !valid(e)) return;
  if (!BASE_HP[e.typeId]) return;
  system.runTimeout(() => {
    if (!valid(e)) return;
    try {
      const diff = getDifficultyScale();
      const hpComp = e.getComponent("minecraft:health");
      if (hpComp && Math.abs(diff.hp - 1.0) > 0.05) {
        const targetHp = Math.max(10, Math.round(BASE_HP[e.typeId] * diff.hp));
        hpComp.setCurrentValue(Math.min(hpComp.effectiveMax, targetHp));
      }
    } catch (err) {}
  }, 2);
});

// Cannibal Troll heals when killing prey
world.afterEvents.entityDie.subscribe((ev) => {
  const killer = ev.damageSource?.damagingEntity;
  if (!killer || !valid(killer) || killer.typeId !== "cb:cannibal_troll") return;
  try {
    const hp = killer.getComponent("minecraft:health");
    if (hp) {
      hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + 20));
    }
    killer.dimension.runCommand(`particle minecraft:villager_happy ${killer.location.x} ${killer.location.y + 2.5} ${killer.location.z}`);
    killer.dimension.runCommand(`playsound random.burp @a ${killer.location.x} ${killer.location.y} ${killer.location.z} 1.2 0.7`);
  } catch (e) {}
});

// Rally Smart Trolls, Tribal Trolls & Brown Orcs together when hurt
world.afterEvents.entityHurt.subscribe((ev) => {
  const hurt = ev.hurtEntity;
  const attacker = ev.damageSource?.damagingEntity;
  if (!hurt || !valid(hurt) || !attacker || !valid(attacker)) return;
  if (hurt.typeId === "cb:smart_troll" || hurt.typeId === "cb:tribal_troll" || hurt.typeId === "cb:orc") {
    if (isTribalAlly(hurt, attacker)) return;
    setFoe(hurt, attacker);
    try {
      const allies = hurt.dimension.getEntities({ location: hurt.location, maxDistance: 20 });
      for (const a of allies) {
        if (valid(a) && alive(a) && isTribalAlly(hurt, a)) {
          setFoe(a, attacker);
        }
      }
    } catch (e) {}
  }
});

// ============================================================================
// MAIN ABILITY LOOP FOR ALL 5 TROLL TYPES + TOTEM AURA
// ============================================================================
system.runInterval(() => {
  const now = system.currentTick;
  const diff = getDifficultyScale();

  for (const dimName of ["overworld", "nether", "the_end"]) {
    let dim;
    try {
      dim = world.getDimension(dimName);
    } catch (e) {
      continue;
    }

    // 1. Process Active Tribal Totems (cb:troll_totem)
    let totems = [];
    try {
      totems = dim.getEntities({ type: "cb:troll_totem" });
    } catch (e) {}
    for (const totem of totems) {
      if (!valid(totem)) continue;
      const born = Number(totem.getDynamicProperty("cb:born_tick") ?? now);
      if (now - born > 300) {
        try {
          totem.remove();
        } catch (e) {}
        continue;
      }
      try {
        dim.runCommand(`particle minecraft:villager_happy ${totem.location.x} ${totem.location.y + 1.6} ${totem.location.z}`);
        const nearAllies = dim.getEntities({ location: totem.location, maxDistance: 10 });
        for (const a of nearAllies) {
          if (!valid(a) || !alive(a) || a.id === totem.id) continue;
          if (isTribalAlly(totem, a)) {
            a.addEffect("regeneration", 60, { amplifier: 0, showParticles: true });
            a.addEffect("strength", 60, { amplifier: 0, showParticles: false });
          }
        }
      } catch (e) {}
    }

    // 2. Process All 5 Troll Types
    for (const tType of TROLL_TYPES) {
      let list = [];
      try {
        list = dim.getEntities({ type: tType });
      } catch (e) {
        continue;
      }

      for (const troll of list) {
        if (!valid(troll) || !alive(troll)) continue;
        const cd = cdOf(troll.id);
        const loc = troll.location;
        if (!troll.hasTag("cb_troll_init")) {
          troll.addTag("cb_troll_init");
          try { troll.setProperty("cb:variant", Math.floor(Math.random() * 3)); } catch {}
        }
        const target = findTargetForTroll(troll, tType === "cb:cannibal_troll" ? 26 : 22);

        // --------------------------------------------------------------------
        // TYPE 1: РАЗУМНЫЙ ТРОЛЛЬ (cb:smart_troll — 22 HP, 4 DMG, 3.8 blocks)
        // Abilities: Weapon Strike + Spear Throw (метание копья)
        // --------------------------------------------------------------------
        if (tType === "cb:smart_troll") {
          if (target) {
            const d = dist3(loc, target.location);
            // Throw spear / ranged shot when target is 5..18 blocks away
            if (d >= 5.0 && d <= 18.0 && now >= cd.spear) {
              cd.spear = now + 70; // 3.5s cooldown
              safePlayAnim(troll, "animation.cb_troll.throw_spear");
              try {
                const dx = target.location.x - loc.x;
                const dy = (target.location.y + 1.0) - (loc.y + 2.4);
                const dz = target.location.z - loc.z;
                const len = Math.max(0.1, Math.hypot(dx, dy, dz));
                const proj = dim.spawnEntity("minecraft:arrow", {
                  x: loc.x + (dx / len) * 1.2,
                  y: loc.y + 2.4,
                  z: loc.z + (dz / len) * 1.2
                });
                proj.applyImpulse({
                  x: (dx / len) * 1.65,
                  y: (dy / len) * 1.65 + 0.08,
                  z: (dz / len) * 1.65
                });
                dim.runCommand(`playsound item.trident.throw @a ${loc.x} ${loc.y} ${loc.z} 1.0 1.0`);
              } catch (e) {}
            } else if (d < 3.4) {
              safePlayAnim(troll, "animation.cb_troll.attack");
            }
          }
        }

        // --------------------------------------------------------------------
        // TYPE 2: ПЛЕМЕННОЙ ТРОЛЛЬ (cb:tribal_troll — 25 HP, 5 DMG, 3.8 blocks)
        // Abilities: Summon Tribemates (призыв соплеменников) + Tribal Totem (тотем)
        // --------------------------------------------------------------------
        else if (tType === "cb:tribal_troll") {
          if (target) {
            // 1. Place Tribal Totem Ward (heals & buffs trolls + brown orcs)
            if (now >= cd.totem) {
              cd.totem = now + 360; // 18s cooldown
              safePlayAnim(troll, "animation.cb_troll.totem_cast");
              try {
                const totem = dim.spawnEntity("cb:troll_totem", {
                  x: loc.x + 1.5,
                  y: loc.y,
                  z: loc.z + 1.5
                });
                totem.setDynamicProperty("cb:born_tick", now);
                assignSummonCipher(troll, totem);
                dim.runCommand(`playsound block.enchantment_table.use @a ${loc.x} ${loc.y} ${loc.z} 1.2 0.8`);
              } catch (e) {}
            }
            // 2. Summon Tribemate (призыв соплеменников)
            if (now >= cd.summon) {
              cd.summon = now + 500; // 25s cooldown
              safePlayAnim(troll, "animation.cb_troll.roar");
              try {
                const ally = dim.spawnEntity("cb:smart_troll", {
                  x: loc.x - 1.5,
                  y: loc.y,
                  z: loc.z + 1.0
                });
                assignSummonCipher(troll, ally);
                setFoe(ally, target);
                dim.runCommand(`particle minecraft:totem_particle ${ally.location.x} ${ally.location.y + 1.5} ${ally.location.z}`);
                dim.runCommand(`playsound raid.horn @a ${loc.x} ${loc.y} ${loc.z} 1.4 1.1`);
              } catch (e) {}
            }
          }
        }

        // --------------------------------------------------------------------
        // TYPE 3: ОДИЧАЛЫЙ ТРОЛЛЬ (cb:wild_troll — 50 HP, 7 DMG, 4.0 blocks)
        // Abilities: Fast Regeneration (регенерация) + Frenzy (ярость) + Leap Attack
        // --------------------------------------------------------------------
        else if (tType === "cb:wild_troll") {
          // Passive Fast Regeneration (+2 HP every 2 seconds)
          try {
            const hp = troll.getComponent("minecraft:health");
            if (hp && hp.currentValue < hp.effectiveMax) {
              hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + 2));
              dim.runCommand(`particle minecraft:heart_particle ${loc.x} ${loc.y + 3.2} ${loc.z}`);
            }
            // Frenzy (Ярость) when below 65% HP
            if (hp && hp.currentValue <= hp.effectiveMax * 0.65) {
              troll.addEffect("speed", 60, { amplifier: 1, showParticles: false });
              troll.addEffect("strength", 60, { amplifier: 0, showParticles: true });
              dim.runCommand(`particle minecraft:villager_angry ${loc.x} ${loc.y + 3.5} ${loc.z}`);
            }
          } catch (e) {}

          // Savage Leap Attack onto target
          if (target) {
            const d = dist3(loc, target.location);
            if (d >= 4.0 && d <= 11.0 && now >= cd.leap) {
              cd.leap = now + 110; // 5.5s cooldown
              safePlayAnim(troll, "animation.cb_troll.roar");
              try {
                const dx = target.location.x - loc.x;
                const dz = target.location.z - loc.z;
                const l = Math.max(0.1, Math.hypot(dx, dz));
                troll.applyImpulse({ x: (dx / l) * 0.95, y: 0.48, z: (dz / l) * 0.95 });
                dim.runCommand(`playsound mob.ravager.roar @a ${loc.x} ${loc.y} ${loc.z} 1.2 1.15`);
              } catch (e) {}
            }
          }
        }

        // --------------------------------------------------------------------
        // TYPE 4: ТРОЛЛЬ-КАННИБАЛ (cb:cannibal_troll — 170 HP, 14 DMG, 4.2 blocks, MINI-BOSS)
        // Abilities:
        //  1) Камнепад (Stonefall)
        //  2) Удар по земле (Earthquake / Ground Slam)
        //  3) Каменная кожа (Stone Skin)
        // --------------------------------------------------------------------
        else if (tType === "cb:cannibal_troll") {
          if (target) {
            const d = dist3(loc, target.location);

            // 1. Stone Skin (Каменная кожа): activates hardening armor every 14s
            if (now >= cd.stoneskin) {
              cd.stoneskin = now + 280;
              safePlayAnim(troll, "animation.cb_troll.roar");
              try {
                troll.addEffect("resistance", 160, { amplifier: 1, showParticles: true });
                dim.runCommand(`playsound random.anvil_land @a ${loc.x} ${loc.y} ${loc.z} 1.2 0.65`);
                dim.runCommand(`particle minecraft:knockback_roar_particle ${loc.x} ${loc.y + 2.0} ${loc.z}`);
              } catch (e) {}
            }

            // 2. Earthquake / Ground Slam (Удар по земле) when enemies are within 6.5 blocks
            if (d <= 6.5 && now >= cd.slam) {
              cd.slam = now + 140; // 7s cooldown
              safePlayAnim(troll, "animation.cb_troll.ground_slam");
              try {
                dim.runCommand(`playsound mob.irongolem.crack @a ${loc.x} ${loc.y} ${loc.z} 1.8 0.55`);
                dim.runCommand(`particle minecraft:huge_explosion_emitter ${loc.x} ${loc.y + 0.5} ${loc.z}`);
                const victims = dim.getEntities({ location: loc, maxDistance: 7.0 });
                for (const v of victims) {
                  if (!valid(v) || !alive(v) || v.id === troll.id || v.typeId === "cb:cannibal_troll" || v.typeId === "cb:troll_totem" || v.typeId === "cb:sargeras_prompt" || (isPlayer(v) && !inSurvival(v))) continue;
                  if (isPlayer(v) && !inSurvival(v)) continue;
                  const vx = v.location.x - loc.x;
                  const vz = v.location.z - loc.z;
                  const vl = Math.max(0.1, Math.hypot(vx, vz));
                  v.applyDamage(Math.round(12 * diff.dmg), { cause: "entityAttack", damagingEntity: troll });
                  v.applyKnockback(vx / vl, vz / vl, 1.8, 0.55);
                }
              } catch (e) {}
            }

            // 3. Stonefall (Камнепад) when target is within 14 blocks
            if (d <= 14.0 && now >= cd.stonefall) {
              cd.stonefall = now + 200; // 10s cooldown
              safePlayAnim(troll, "animation.cb_troll.ground_slam");
              try {
                const tx = target.location.x;
                const ty = target.location.y;
                const tz = target.location.z;
                dim.runCommand(`playsound block.stone.break @a ${tx} ${ty} ${tz} 2.0 0.6`);
                for (let k = 0; k < 6; k++) {
                  const rx = tx + (Math.random() - 0.5) * 5.0;
                  const rz = tz + (Math.random() - 0.5) * 5.0;
                  dim.runCommand(`particle minecraft:falling_dust_gravel_particle ${rx} ${ty + 5} ${rz}`);
                  dim.runCommand(`particle minecraft:large_explosion ${rx} ${ty + 1} ${rz}`);
                }
                const hitList = dim.getEntities({ location: target.location, maxDistance: 4.5 });
                for (const v of hitList) {
                  if (!valid(v) || !alive(v) || v.id === troll.id || v.typeId === "cb:cannibal_troll" || v.typeId === "cb:troll_totem" || v.typeId === "cb:sargeras_prompt" || (isPlayer(v) && !inSurvival(v))) continue;
                  if (isPlayer(v) && !inSurvival(v)) continue;
                  v.applyDamage(Math.round(10 * diff.dmg), { cause: "entityAttack", damagingEntity: troll });
                  v.addEffect("slowness", 60, { amplifier: 1, showParticles: true });
                }
              } catch (e) {}
            }
          }
        }

        // --------------------------------------------------------------------
        // TYPE 5: ЛЕДЯНОЙ ТРОЛЛЬ (cb:ice_troll — 120 HP, 10 DMG, 4.5 blocks, ELITE)
        // Abilities:
        //  1) Морозная аура (Frost Aura — constant chilling slowness around the troll)
        //  2) Ледяной удар / Осколки льда (Ice Blast / Ice Shards)
        // --------------------------------------------------------------------
        else if (tType === "cb:ice_troll") {
          // 1. Passive Frost Aura (Морозная аура within 6.5 blocks)
          try {
            dim.runCommand(`particle minecraft:snowflake_particle ${loc.x} ${loc.y + 2.5} ${loc.z}`);
            const chilled = dim.getEntities({ location: loc, maxDistance: 6.5 });
            for (const v of chilled) {
              if (!valid(v) || !alive(v) || v.id === troll.id || v.typeId === "cb:ice_troll") continue;
              if (isPlayer(v) && !inSurvival(v)) continue;
              v.addEffect("slowness", 60, { amplifier: 1, showParticles: true });
            }
          } catch (e) {}

          // 2. Ice Blast / Ice Shards (Ледяной удар)
          if (target) {
            const d = dist3(loc, target.location);
            if (d <= 12.0 && now >= cd.iceblast) {
              cd.iceblast = now + 130; // 6.5s cooldown
              safePlayAnim(troll, "animation.cb_troll.ground_slam");
              try {
                const dx = (target.location.x - loc.x) / Math.max(0.1, d);
                const dz = (target.location.z - loc.z) / Math.max(0.1, d);
                dim.runCommand(`playsound random.glass @a ${loc.x} ${loc.y} ${loc.z} 1.6 0.7`);
                for (let step = 2; step <= 11; step += 2) {
                  const sx = loc.x + dx * step;
                  const sz = loc.z + dz * step;
                  dim.runCommand(`particle minecraft:snowflake_particle ${sx} ${loc.y + 1.2} ${sz}`);
                  dim.runCommand(`particle minecraft:blue_flame_particle ${sx} ${loc.y + 0.8} ${sz}`);
                  const hits = dim.getEntities({ location: { x: sx, y: loc.y + 1, z: sz }, maxDistance: 2.3 });
                  for (const h of hits) {
                    if (!valid(h) || !alive(h) || h.id === troll.id || h.typeId === "cb:ice_troll") continue;
                    if (isPlayer(h) && !inSurvival(h)) continue;
                    h.applyDamage(Math.round(10 * diff.dmg), { cause: "entityAttack", damagingEntity: troll });
                    h.addEffect("slowness", 90, { amplifier: 3, showParticles: true });
                    h.applyKnockback(dx, dz, 1.2, 0.35);
                  }
                }
              } catch (e) {}
            }
          }
        }
      }
    }
  }
}, 20);
