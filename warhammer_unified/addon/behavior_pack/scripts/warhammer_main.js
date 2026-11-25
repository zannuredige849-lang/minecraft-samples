import { areAllies } from "./factions.js";
import { world, system } from "@minecraft/server";

const GUO_ID = "warcraft:great_unclean_one";
const ABOM_ID = "warcraft:abomination_lord";
const INF_ID = "warcraft:inferno_golem";
const FROST_ID = "warcraft:frost_golem";
const LIGHT_ID = "warcraft:lightning_golem";
const DEMON_ID = "warcraft:hornet_demon";
const VOID_KNIGHT_ID = "warcraft:void_knight";
const CHAOS_KNIGHT_ID = "warcraft:chaos_knight";
const BLOOD_ANGEL_ID = "warcraft:blood_angel";

const FL_WARRIOR = "warcraft:faceless_warrior";
const FL_BERSERKER = "warcraft:faceless_berserker";
const FL_SORCERER = "warcraft:faceless_sorcerer";
const FL_GENERAL = "warcraft:faceless_general";
const PINK_HORROR_ID = "warcraft:pink_horror";
const EMBER_COLOSSUS_ID = "warcraft:ember_colossus";
const BLACK_BLOCKER_ID = "warcraft:black_blocker";
const BIG_ENT_ID = "warcraft:big_ent";

const NURGLE_SET = new Set([GUO_ID, ABOM_ID, "minecraft:slime"]);
const FACELESS_SET = new Set([FL_WARRIOR, FL_BERSERKER, FL_SORCERER, FL_GENERAL, "warcraft:faceless_nightmare", "warcraft:faceless_cultist"]);
const CHAOS_SET = new Set([DEMON_ID, VOID_KNIGHT_ID, CHAOS_KNIGHT_ID, BLOOD_ANGEL_ID]);
const GOLEM_SET = new Set([INF_ID, FROST_ID, LIGHT_ID]);

const ALL_OUR_MOBS = new Set([
  GUO_ID, ABOM_ID, INF_ID, FROST_ID, LIGHT_ID,
  DEMON_ID, VOID_KNIGHT_ID, CHAOS_KNIGHT_ID, BLOOD_ANGEL_ID,
  FL_WARRIOR, FL_BERSERKER, FL_SORCERER, FL_GENERAL,
  PINK_HORROR_ID, EMBER_COLOSSUS_ID, BLACK_BLOCKER_ID, BIG_ENT_ID,
  "warcraft:bandit_dog", "warcraft:bandit_raider", "warcraft:norse_marauder", "warcraft:norse_berserker", "warcraft:wulfrik_champion", "warcraft:chaos_warrior", "warcraft:sabertooth_rider", "warcraft:norse_shaman", "warcraft:skaal_villager", "warcraft:paladin_swordsman", "warcraft:royal_captain", "warcraft:garithos_paladin", "warcraft:royal_knight", "warcraft:dark_plate_knight", "warcraft:heide_knight", "warcraft:heide_hood_knight", "warcraft:chival_warrior", "warcraft:elector_knight", "warcraft:imperial_guard", "warcraft:high_elf_spearman", "warcraft:teutonic_cleric", "warcraft:royal_queen", "warcraft:nazgul", "warcraft:pirate_ghost", "warcraft:skeleton_bear", "warcraft:undead_zombie", "warcraft:faceless_nightmare", "warcraft:faceless_cultist", "warcraft:ice_demon", "warcraft:grizzly_bear", "warcraft:burning_chariot", "warcraft:santa_claus",
]);

const ORB_TO_GOLEM = {
  "warcraft:inferno_orb": { id: INF_ID, name: "§6Союзный Инферно Голем", p: "minecraft:basic_flame_particle", p2: "minecraft:lava_particle", s: "mob.blaze.shoot", elem: "fire" },
  "warcraft:frost_orb": { id: FROST_ID, name: "§bСоюзный Ледяной Голем", p: "minecraft:blue_flame_particle", p2: "minecraft:basic_smoke_particle", s: "random.glass", elem: "frost" },
  "warcraft:storm_orb": { id: LIGHT_ID, name: "§9Союзный Грозовой Голем", p: "minecraft:blue_flame_particle", p2: "minecraft:electric_spark_particle", s: "ambient.weather.thunder", elem: "storm" },
};

const FURY_THRESHOLD = 30;
const CLOUD_DURATION_TICKS = 80;
const CHAIN_COOLDOWN_TICKS = 140;

const activeClouds = [];
const stateMap = new Map();

function safeParticle(dim, id, loc) { try { dim.spawnParticle(id, loc); } catch {} }
function safeSound(dim, id, loc) { try { dim.playSound(id, loc); } catch {} }
function alive(e) { try { return e && (typeof e.isValid === "function" ? e.isValid() : !!e.isValid); } catch { return false; } }
function isCreative(ent) {
  if (ent.typeId !== "minecraft:player") return false;
  try { const gm = ent.getGameMode(); return gm === "creative" || gm === "spectator"; } catch { return false; }
}
const CB_NEVER_TARGET = new Set([
  "cb:sargeras_prompt", "cb:lich_statue", "cb:circe_orb", "cb:fel_orb",
  "cb:fel_rain", "cb:hydra_spit", "cb:dragon_fire", "cb:dragon_frost", "cb:dragon_spark",
]);
function isTamedAlly(ent) {
  try { return ent.hasTag("warcraft_ally") || ent.hasTag("cb_player_golem"); } catch { return false; }
}
function isValidVictim(ent, selfEnt, excludeSet) {
  if (!ent || ent.id === selfEnt.id) return false;
  if (areAllies(selfEnt, ent)) return false;
  if (CB_NEVER_TARGET.has(ent.typeId)) return false;
  if (excludeSet && excludeSet.has(ent.typeId)) return false;
  // Tamed player-ally golems NEVER hurt players or other tamed ally golems!
  if (isTamedAlly(selfEnt)) {
    if (ent.typeId === "minecraft:player" || isTamedAlly(ent)) return false;
  } else {
    if (isCreative(ent)) return false;
  }
  try { return !!ent.getComponent("minecraft:health"); } catch { return false; }
}

function getSt(ent, defaults = {}) {
  let st = stateMap.get(ent.id);
  if (!st) {
    st = { animResetTick: 0, ...defaults };
    if (ent.typeId === GUO_ID) {
      const sf = ent.getDynamicProperty("warcraft:fury");
      const sfr = ent.getDynamicProperty("warcraft:frenzy");
      if (typeof sf === "number") st.fury = sf;
      if (sfr === true) {
        st.frenzyTriggered = true;
        try { ent.triggerEvent("warcraft:enter_plague_phase"); } catch {}
      }
    }
    stateMap.set(ent.id, st);
  } else {
    for (const k in defaults) {
      if (st[k] === undefined) st[k] = defaults[k];
    }
  }
  return st;
}

function setAnim(ent, val, ticks, st) {
  try {
    ent.setProperty("warcraft:anim_state", val);
    if (st) st.animResetTick = system.currentTick + ticks;
  } catch {}
}

function playAnim(ent, val, ticks) {
  setAnim(ent, val, ticks, getSt(ent, {}));
}

function spawnRing(dim, loc, radius, count, particleId, yOff = 0.6) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    safeParticle(dim, particleId, { x: loc.x + Math.cos(a) * radius, y: loc.y + yOff, z: loc.z + Math.sin(a) * radius });
  }
}

function spawnBeam(dim, a, b, steps, particleA, particleB = null) {
  for (let i = 1; i <= steps; i++) {
    const f = i / steps;
    const loc = {
      x: a.x + (b.x - a.x) * f,
      y: (a.y + 1.4) + ((b.y + 1.0) - (a.y + 1.4)) * f,
      z: a.z + (b.z - a.z) * f,
    };
    safeParticle(dim, particleA, loc);
    if (particleB && i % 2 === 0) safeParticle(dim, particleB, loc);
  }
}

function formatFuryBar(fury, frenzy) {
  const clamped = Math.max(0, Math.min(FURY_THRESHOLD, Math.floor(fury)));
  const filled = Math.round((clamped / FURY_THRESHOLD) * 10);
  const bar = "§a" + "█".repeat(filled) + "§8" + "░".repeat(10 - filled);
  return `§2☣ Ярость Нечистого: §f[${bar}§f] §e${clamped}/${FURY_THRESHOLD}${frenzy ? " §c[ФАЗА ЧУМЫ +20%]" : ""}`;
}

// Golem Artifacts now use the unified Sargeras Artifact engine in guldan.js (5 charges, 45s CD, on-screen button + meteor!)

// === GUARANTEED MELEE ATTACK ANIMATION TRIGGER FOR ALL 13 MOBS ===
world.afterEvents.entityHitEntity.subscribe((ev) => {
  const atk = ev.damagingEntity;
  if (!atk || !ALL_OUR_MOBS.has(atk.typeId)) return;
  if (atk.typeId === BIG_ENT_ID) {
    const est = stateMap.get(atk.id);
    if (est) {
      est.lastCombatTick = system.currentTick;
      if (est.rootState && est.rootState !== "mobile") return;
    }
  }
  const st = getSt(atk);
  if (st.animResetTick <= system.currentTick) {
    setAnim(atk, 3, 18, st);
  }
});

// === ABILITY FUNCTIONS ===
function triggerPlagueCloud(boss, st) {
  const dim = boss.dimension, loc = boss.location;
  const radius = st.frenzyTriggered ? 7.5 : 6.0;
  setAnim(boss, 1, 34, st);
  safeSound(dim, "mob.wither.shoot", loc);
  spawnRing(dim, loc, 3.2, 22, "minecraft:totem_particle", 1.1);
  activeClouds.push({ dim, x: loc.x, y: loc.y + 0.6, z: loc.z, ticksLeft: CLOUD_DURATION_TICKS, radius });
  try {
    for (const p of dim.getPlayers({ location: loc, maxDistance: 28 })) {
      p.onScreenDisplay.setActionBar("§2☣ Великий Нечистый выпустил §aОБЛАКО ЯДА§2!");
    }
  } catch {}
}

function triggerChainPull(boss, target, st) {
  const dim = boss.dimension, bLoc = boss.location, tLoc = target.location;
  setAnim(boss, 2, 32, st);
  safeSound(dim, "block.chain.place", bLoc);
  safeSound(dim, "random.anvil_land", tLoc);
  spawnBeam(dim, bLoc, tLoc, 14, "minecraft:crit", "minecraft:totem_particle");
  const dx = bLoc.x - tLoc.x, dz = bLoc.z - tLoc.z, dist = Math.hypot(dx, dz) || 1;
  try {
    target.applyKnockback(dx / dist, dz / dist, Math.min(2.6, Math.max(1.2, dist * 0.22)), 0.35);
    target.addEffect("slowness", 50, { amplifier: 1, showParticles: true });
    target.applyDamage(2);
  } catch {}
  if (target.typeId === "minecraft:player") {
    try { target.onScreenDisplay.setActionBar("§2⛓ §cВеликий Нечистый притянул вас цепью!"); } catch {}
  }
}

// Abomination Lord (Поганище): Toxic Belch
function triggerToxicBelch(abom, st) {
  const dim = abom.dimension, loc = abom.location;
  setAnim(abom, 1, 24, st);
  safeSound(dim, "mob.slime.big", loc);
  spawnRing(dim, loc, 2.8, 18, "minecraft:totem_particle", 1.2);
  spawnRing(dim, loc, 4.2, 18, "minecraft:villager_happy", 0.9);
  try {
    for (const v of dim.getEntities({ location: loc, maxDistance: 4.5 })) {
      if (!isValidVictim(v, abom, NURGLE_SET)) continue;
      try {
        v.applyDamage(5);
        v.addEffect("poison", 80, { amplifier: 1, showParticles: true });
        v.addEffect("nausea", 70, { amplifier: 0, showParticles: true });
        v.addEffect("slowness", 50, { amplifier: 0, showParticles: true });
      } catch {}
    }
  } catch {}
}

function triggerMagmaSlam(golem, st) {
  const dim = golem.dimension, loc = golem.location;
  setAnim(golem, 1, 22, st);
  safeSound(dim, "random.explode", loc);
  safeSound(dim, "mob.blaze.shoot", loc);
  spawnRing(dim, loc, 2.6, 22, "minecraft:basic_flame_particle", 0.6);
  spawnRing(dim, loc, 4.4, 24, "minecraft:lava_particle", 0.9);
  const excl = isTamedAlly(golem) ? null : new Set([golem.typeId]);
  try {
    for (const v of dim.getEntities({ location: loc, maxDistance: 5.5 })) {
      if (!isValidVictim(v, golem, excl)) continue;
      const dx = v.location.x - loc.x, dz = v.location.z - loc.z, d = Math.hypot(dx, dz) || 1;
      try { v.applyDamage(6); v.setOnFire(5, true); v.applyKnockback(dx / d, dz / d, 1.4, 0.55); } catch {}
    }
  } catch {}
}

function triggerGlacialPrison(golem, st) {
  const dim = golem.dimension, loc = golem.location;
  setAnim(golem, 1, 24, st);
  safeSound(dim, "random.glass", loc);
  spawnRing(dim, loc, 2.5, 24, "minecraft:blue_flame_particle", 0.6);
  spawnRing(dim, loc, 4.8, 28, "minecraft:blue_flame_particle", 1.1);
  spawnRing(dim, loc, 3.6, 18, "minecraft:snowflake_particle", 1.4);
  const excl = isTamedAlly(golem) ? null : new Set([golem.typeId]);
  try {
    for (const v of dim.getEntities({ location: loc, maxDistance: 5.5 })) {
      if (!isValidVictim(v, golem, excl)) continue;
      try {
        v.applyDamage(5);
        v.addEffect("slowness", 90, { amplifier: 3, showParticles: true });
        v.addEffect("mining_fatigue", 90, { amplifier: 1, showParticles: true });
      } catch {}
    }
  } catch {}
}

function triggerChainLightning(golem, primary, st) {
  const dim = golem.dimension, gLoc = golem.location, tLoc = primary.location;
  setAnim(golem, 1, 24, st);
  safeSound(dim, "ambient.weather.thunder", tLoc);
  spawnBeam(dim, gLoc, tLoc, 14, "minecraft:blue_flame_particle", "minecraft:crit");
  // If tamed ally, deal direct shock damage instead of spawning fire-starting lightning near owner
  if (isTamedAlly(golem)) {
    try { primary.applyDamage(7); spawnRing(dim, tLoc, 1.4, 12, "minecraft:blue_flame_particle", 1.0); } catch {}
  } else {
    try { dim.spawnEntity("minecraft:lightning_bolt", tLoc); } catch { try { primary.applyDamage(6); } catch {} }
  }
  const excl = isTamedAlly(golem) ? null : new Set([golem.typeId]);
  try {
    let jumps = 0;
    for (const v of dim.getEntities({ location: tLoc, maxDistance: 5.0 })) {
      if (v.id === primary.id || !isValidVictim(v, golem, excl)) continue;
      spawnBeam(dim, tLoc, v.location, 8, "minecraft:blue_flame_particle", "minecraft:endrod");
      try { v.applyDamage(5); } catch {}
      jumps++;
      if (jumps >= 2) break;
    }
  } catch {}
}

function triggerBlinkSurge(golem, target, st) {
  const dim = golem.dimension, gLoc = golem.location, tLoc = target.location;
  const dx = tLoc.x - gLoc.x, dz = tLoc.z - gLoc.z, dist = Math.hypot(dx, dz) || 1;
  const dest = { x: tLoc.x - (dx / dist) * 2.2, y: tLoc.y, z: tLoc.z - (dz / dist) * 2.2 };
  spawnRing(dim, gLoc, 1.5, 14, "minecraft:blue_flame_particle", 1.0);
  spawnBeam(dim, gLoc, dest, 12, "minecraft:blue_flame_particle", "minecraft:endrod");
  safeSound(dim, "mob.endermen.portal", dest);
  try {
    golem.teleport(dest, { dimension: dim });
    spawnRing(dim, dest, 2.0, 16, "minecraft:blue_flame_particle", 0.8);
    setAnim(golem, 1, 20, st);
  } catch {}
}

function triggerHornedGore(demon, target, st) {
  const dim = demon.dimension, dLoc = demon.location, tLoc = target.location;
  setAnim(demon, 1, 26, st);
  safeSound(dim, "mob.ghast.scream", dLoc);
  const dx = tLoc.x - dLoc.x, dz = tLoc.z - dLoc.z, dist = Math.hypot(dx, dz) || 1;
  spawnBeam(dim, dLoc, tLoc, 10, "minecraft:basic_flame_particle");
  try {
    demon.applyKnockback(dx / dist, dz / dist, Math.min(2.2, dist * 0.25), 0.45);
    demon.addEffect("speed", 40, { amplifier: 2, showParticles: false });
  } catch {}
  if (dist <= 6.5) {
    try { target.applyDamage(5); target.applyKnockback(dx / dist, dz / dist, 1.1, 0.45); } catch {}
  }
}

function triggerHellfireRoar(demon, st) {
  const dim = demon.dimension, loc = demon.location;
  setAnim(demon, 2, 32, st);
  safeSound(dim, "mob.wither.ambient", loc);
  spawnRing(dim, loc, 3.6, 20, "minecraft:basic_flame_particle", 1.1);
  try {
    for (const v of dim.getEntities({ location: loc, maxDistance: 4.8 })) {
      if (!isValidVictim(v, demon, new Set([DEMON_ID]))) continue;
      try {
        v.applyDamage(3);
        v.addEffect("blindness", 50, { amplifier: 0, showParticles: true });
        v.addEffect("weakness", 80, { amplifier: 0, showParticles: true });
      } catch {}
    }
  } catch {}
}

function triggerSorcererLevitateBolt(caster, target, st) {
  const dim = caster.dimension, cLoc = caster.location, tLoc = target.location;
  setAnim(caster, 1, 24, st);
  safeSound(dim, "mob.evocation_illager.cast_spell", cLoc);
  for (let i = 1; i <= 12; i++) {
    const f = i / 12;
    const pt = {
      x: cLoc.x + (tLoc.x - cLoc.x) * f + Math.sin(i * 1.1) * 0.25,
      y: cLoc.y + 1.5 + (tLoc.y + 1.0 - cLoc.y - 1.5) * f,
      z: cLoc.z + (tLoc.z - cLoc.z) * f + Math.cos(i * 1.1) * 0.25,
    };
    safeParticle(dim, "minecraft:blue_flame_particle", pt);
    if (i % 3 === 0) safeParticle(dim, "minecraft:witchspell_emitter", pt);
  }
  try {
    target.applyDamage(5, { cause: "magic", damagingEntity: caster });
    target.addEffect("levitation", 40, { amplifier: 0, showParticles: true });
    target.addEffect("weakness", 60, { amplifier: 0, showParticles: true });
  } catch {}
}

function triggerSorcererRitualHeal(caster, st) {
  const dim = caster.dimension, cLoc = caster.location;
  setAnim(caster, 1, 26, st);
  safeSound(dim, "mob.evocation_illager.prepare_summon", cLoc);
  let healed = false;
  try {
    for (const ally of dim.getEntities({ location: cLoc, maxDistance: 14.0, families: ["faceless"] })) {
      const hp = ally.getComponent("minecraft:health");
      if (hp && hp.currentValue > 0 && hp.currentValue < hp.effectiveMax * 0.85) {
        hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + 10));
        try { ally.addEffect("resistance", 80, { amplifier: 0, showParticles: true }); } catch {}
        spawnRing(dim, ally.location, 1.2, 10, "minecraft:totem_particle", 1.1);
        spawnRing(dim, ally.location, 1.4, 8, "minecraft:blue_flame_particle", 0.5);
        healed = true;
      }
    }
  } catch {}
  return healed;
}

function triggerSorcererVoidBlink(caster, threat, st) {
  const dim = caster.dimension, cLoc = caster.location, tLoc = threat.location;
  setAnim(caster, 1, 16, st);
  safeSound(dim, "mob.endermen.portal", cLoc);
  spawnRing(dim, cLoc, 1.2, 12, "minecraft:witchspell_emitter", 1.0);
  spawnRing(dim, cLoc, 1.4, 10, "minecraft:blue_flame_particle", 0.6);
  // Leave blinding void cloud on attacker
  try {
    threat.addEffect("blindness", 50, { amplifier: 0, showParticles: true });
    threat.addEffect("slowness", 60, { amplifier: 1, showParticles: true });
  } catch {}
  // Blink 6 blocks away from attacker
  const dx = cLoc.x - tLoc.x, dz = cLoc.z - tLoc.z;
  const dist = Math.max(0.5, Math.hypot(dx, dz));
  const nx = cLoc.x + (dx / dist) * 6.0;
  const nz = cLoc.z + (dz / dist) * 6.0;
  try {
    caster.teleport({ x: nx, y: cLoc.y + 0.4, z: nz }, { checkForBlocks: true });
    spawnRing(dim, { x: nx, y: cLoc.y, z: nz }, 1.2, 12, "minecraft:blue_flame_particle", 1.0);
  } catch {}
}

function triggerGeneralMindCrush(gen, st) {
  const dim = gen.dimension, loc = gen.location;
  setAnim(gen, 1, 30, st);
  safeSound(dim, "mob.wither.shoot", loc);
  spawnRing(dim, loc, 3.0, 20, "minecraft:blue_flame_particle", 0.9);
  spawnRing(dim, loc, 4.5, 18, "minecraft:totem_particle", 1.1);
  try {
    for (const v of dim.getEntities({ location: loc, maxDistance: 5.0 })) {
      if (!isValidVictim(v, gen, FACELESS_SET)) continue;
      try {
        v.applyDamage(5);
        v.addEffect("wither", 70, { amplifier: 0, showParticles: true });
        v.addEffect("nausea", 80, { amplifier: 0, showParticles: true });
        v.addEffect("slowness", 60, { amplifier: 1, showParticles: true });
      } catch {}
    }
    for (const ally of dim.getEntities({ location: loc, maxDistance: 12.0, families: ["faceless"] })) {
      try {
        ally.addEffect("strength", 120, { amplifier: 0, showParticles: true });
        ally.addEffect("resistance", 120, { amplifier: 0, showParticles: false });
        safeParticle(dim, "minecraft:blue_flame_particle", { x: ally.location.x, y: ally.location.y + 1.8, z: ally.location.z });
      } catch {}
    }
  } catch {}
}

function triggerVoidGravity(knight, st) {
  const dim = knight.dimension, loc = knight.location;
  setAnim(knight, 1, 24, st);
  safeSound(dim, "mob.endermen.portal", loc);
  spawnRing(dim, loc, 4.5, 24, "minecraft:blue_flame_particle", 1.0);
  try {
    for (const v of dim.getEntities({ location: loc, maxDistance: 7.5 })) {
      if (!isValidVictim(v, knight, new Set([VOID_KNIGHT_ID]))) continue;
      const dx = loc.x - v.location.x, dz = loc.z - v.location.z, d = Math.hypot(dx, dz) || 1;
      try {
        v.applyKnockback(dx / d, dz / d, 1.3, 0.25);
        v.applyDamage(5);
        v.addEffect("blindness", 45, { amplifier: 0, showParticles: true });
      } catch {}
    }
    knight.addEffect("resistance", 80, { amplifier: 1, showParticles: true });
  } catch {}
}

function triggerBloodDive(angel, target, st) {
  const dim = angel.dimension, aLoc = angel.location, tLoc = target.location;
  setAnim(angel, 1, 24, st);
  safeSound(dim, "mob.phantom.swoop", aLoc);
  const dx = tLoc.x - aLoc.x, dz = tLoc.z - aLoc.z, dist = Math.hypot(dx, dz) || 1;
  spawnBeam(dim, aLoc, tLoc, 12, "minecraft:basic_flame_particle", "minecraft:crit");
  try {
    angel.applyKnockback(dx / dist, dz / dist, Math.min(2.3, dist * 0.26), 0.55);
    angel.addEffect("slow_falling", 50, { amplifier: 0, showParticles: false });
    if (dist <= 6.5) {
      target.applyDamage(6);
      target.setOnFire(3, true);
      spawnRing(dim, tLoc, 2.5, 16, "minecraft:basic_flame_particle", 0.9);
    }
  } catch {}
}

// === DAMAGE EVENTS ===
world.afterEvents.entityHurt.subscribe((ev) => {
  const ent = ev.hurtEntity;
  if (!ent) return;
  const attacker = ev.damageSource?.damagingEntity;

  if (attacker && attacker.typeId === FROST_ID && ent.id !== attacker.id) {
    try {
      if (ent.getEffect("slowness")) {
        ent.applyDamage(3);
        spawnRing(ent.dimension, ent.location, 0.9, 8, "minecraft:blue_flame_particle", 1.0);
      }
    } catch {}
  }

  if (attacker && attacker.typeId === FL_BERSERKER && ent.id !== attacker.id) {
    const bst = getSt(attacker, { hits: 0, frenzy: false });
    bst.hits = (bst.hits || 0) + 1;
    if (bst.hits >= 3) {
      bst.hits = 0;
      setAnim(attacker, 1, 22, bst);
      safeSound(attacker.dimension, "random.anvil_land", attacker.location);
      spawnRing(attacker.dimension, attacker.location, 2.8, 16, "minecraft:blue_flame_particle", 0.9);
      try {
        for (const v of attacker.dimension.getEntities({ location: attacker.location, maxDistance: 3.2 })) {
          if (!isValidVictim(v, attacker, FACELESS_SET)) continue;
          const dx = v.location.x - attacker.location.x, dz = v.location.z - attacker.location.z, d = Math.hypot(dx, dz) || 1;
          try { v.applyDamage(4); v.applyKnockback(dx / d, dz / d, 1.1, 0.35); } catch {}
        }
      } catch {}
    }
  }

  if (attacker && attacker.typeId === CHAOS_KNIGHT_ID && ent.id !== attacker.id) {
    const cst = getSt(attacker, { hits: 0 });
    cst.hits = (cst.hits || 0) + 1;
    if (cst.hits >= 3) {
      cst.hits = 0;
      setAnim(attacker, 1, 22, cst);
      safeSound(attacker.dimension, "random.explode", attacker.location);
      spawnRing(attacker.dimension, attacker.location, 3.4, 20, "minecraft:basic_flame_particle", 1.0);
      try {
        for (const v of attacker.dimension.getEntities({ location: attacker.location, maxDistance: 3.8 })) {
          if (!isValidVictim(v, attacker, new Set([CHAOS_KNIGHT_ID]))) continue;
          const dx = v.location.x - attacker.location.x, dz = v.location.z - attacker.location.z, d = Math.hypot(dx, dz) || 1;
          try { v.applyDamage(6); v.applyKnockback(dx / d, dz / d, 1.3, 0.4); } catch {}
        }
      } catch {}
    }
  }

  if (ent.typeId === GUO_ID) {
    const st = getSt(ent, { fury: 0, frenzyTriggered: false, chainCooldown: 60 });
    st.fury += Math.max(0, ev.damage || 0);
    if (!st.frenzyTriggered) {
      try {
        const hp = ent.getComponent("minecraft:health");
        if (hp && hp.currentValue > 0 && hp.currentValue <= 150) {
          st.frenzyTriggered = true;
          ent.setDynamicProperty("warcraft:frenzy", true);
          ent.triggerEvent("warcraft:enter_plague_phase");
          safeSound(ent.dimension, "mob.wither.spawn", ent.location);
          spawnRing(ent.dimension, ent.location, 3.5, 26, "minecraft:totem_particle", 1.5);
          for (let i = 0; i < 2; i++) {
            try {
              const a = i * Math.PI;
              const sl = ent.dimension.spawnEntity("minecraft:slime", { x: ent.location.x + Math.cos(a) * 2.4, y: ent.location.y + 0.5, z: ent.location.z + Math.sin(a) * 2.4 });
              sl.nameTag = "§aНурглинг";
            } catch {}
          }
          for (const p of ent.dimension.getPlayers({ location: ent.location, maxDistance: 32 })) {
            p.sendMessage("§2☣ §lВеликий Нечистый впал в ФАЗУ ЧУМЫ (+20% размер)§r§2 и призвал Нурглингов!");
          }
        }
      } catch {}
    }
    if (st.fury >= FURY_THRESHOLD) { st.fury %= FURY_THRESHOLD; triggerPlagueCloud(ent, st); }
    try { ent.setDynamicProperty("warcraft:fury", st.fury); } catch {}
    return;
  }

  if (ent.typeId === INF_ID) {
    const st = getSt(ent, { slamCd: 80, auraTick: 0, fury: 0 });
    st.fury += Math.max(0, ev.damage || 0);
    const excl = isTamedAlly(ent) ? null : new Set([ent.typeId]);
    if (attacker && isValidVictim(attacker, ent, excl) && Math.hypot(attacker.location.x - ent.location.x, attacker.location.z - ent.location.z) <= 4.0) {
      try { attacker.setOnFire(3, true); attacker.applyDamage(1); } catch {}
    }
    if (st.fury >= 35) { st.fury = 0; triggerMagmaSlam(ent, st); }
    return;
  }

  if (ent.typeId === FROST_ID) {
    const st = getSt(ent, { prisonCd: 90, shieldUsed: false, fury: 0 });
    st.fury += Math.max(0, ev.damage || 0);
    if (!st.shieldUsed) {
      try {
        const hp = ent.getComponent("minecraft:health");
        if (hp && hp.currentValue > 0 && hp.currentValue <= 60) {
          st.shieldUsed = true;
          ent.addEffect("resistance", 80, { amplifier: 1, showParticles: true });
          safeSound(ent.dimension, "random.glass", ent.location);
          spawnRing(ent.dimension, ent.location, 2.0, 20, "minecraft:blue_flame_particle", 1.2);
        }
      } catch {}
    }
    if (st.fury >= 40) { st.fury = 0; triggerGlacialPrison(ent, st); }
    return;
  }

  if (ent.typeId === LIGHT_ID) {
    const excl = isTamedAlly(ent) ? null : new Set([ent.typeId]);
    if (attacker && isValidVictim(attacker, ent, excl) && Math.hypot(attacker.location.x - ent.location.x, attacker.location.z - ent.location.z) <= 4.5) {
      const dx = attacker.location.x - ent.location.x, dz = attacker.location.z - ent.location.z, d = Math.hypot(dx, dz) || 1;
      try { attacker.applyDamage(2); attacker.applyKnockback(dx / d, dz / d, 1.0, 0.3); } catch {}
      safeParticle(ent.dimension, "minecraft:blue_flame_particle", attacker.location);
    }
    return;
  }

  if (ent.typeId === DEMON_ID) {
    const st = getSt(ent, { dashCd: 60, roarCd: 120, frenzy: false });
    if (!st.frenzy) {
      try {
        const hp = ent.getComponent("minecraft:health");
        if (hp && hp.currentValue > 0 && hp.currentValue <= 32) {
          st.frenzy = true;
          ent.addEffect("speed", 240, { amplifier: 1, showParticles: true });
          ent.addEffect("strength", 240, { amplifier: 0, showParticles: true });
          spawnRing(ent.dimension, ent.location, 1.4, 12, "minecraft:basic_flame_particle", 1.1);
        }
      } catch {}
    }
    return;
  }

  if (ent.typeId === FL_BERSERKER) {
    const st = getSt(ent, { hits: 0, frenzy: false });
    if (!st.frenzy) {
      try {
        const hp = ent.getComponent("minecraft:health");
        if (hp && hp.currentValue > 0 && hp.currentValue <= 25) {
          st.frenzy = true;
          ent.addEffect("speed", 240, { amplifier: 1, showParticles: true });
          ent.addEffect("strength", 240, { amplifier: 0, showParticles: true });
          spawnRing(ent.dimension, ent.location, 1.4, 12, "minecraft:blue_flame_particle", 1.1);
        }
      } catch {}
    }
    return;
  }

  if (ent.typeId === FL_GENERAL) {
    const st = getSt(ent, { novaCd: 90, summoned: false });
    if (!st.summoned) {
      try {
        const hp = ent.getComponent("minecraft:health");
        if (hp && hp.currentValue > 0 && hp.currentValue <= 28) {
          st.summoned = true;
          safeSound(ent.dimension, "mob.evocation_illager.prepare_summon", ent.location);
          const loc = { x: ent.location.x + 1.8, y: ent.location.y + 0.3, z: ent.location.z + 1.8 };
          ent.dimension.spawnEntity(FL_WARRIOR, loc);
          spawnRing(ent.dimension, loc, 1.2, 12, "minecraft:blue_flame_particle", 0.8);
        }
      } catch {}
    }
  }
});

// === DEATH EVENTS ===
world.afterEvents.entityDie.subscribe((ev) => {
  const dead = ev.deadEntity;
  if (dead) {
    stateMap.delete(dead.id);
    if (dead.typeId === ABOM_ID) {
      // Mini plague cloud on death (3 seconds)
      safeSound(dead.dimension, "mob.slime.big", dead.location);
      activeClouds.push({ dim: dead.dimension, x: dead.location.x, y: dead.location.y + 0.5, z: dead.location.z, ticksLeft: 60, radius: 4.5 });
      return;
    }
    if (dead.typeId === INF_ID) {
      safeSound(dead.dimension, "random.explode", dead.location);
      spawnRing(dead.dimension, dead.location, 2.5, 22, "minecraft:lava_particle", 1.0);
      const excl = isTamedAlly(dead) ? null : new Set([dead.typeId]);
      for (const v of dead.dimension.getEntities({ location: dead.location, maxDistance: 4.5 })) {
        if (isValidVictim(v, dead, excl)) { try { v.applyDamage(6); v.setOnFire(4, true); } catch {} }
      }
      return;
    }
    if (dead.typeId === LIGHT_ID && !isTamedAlly(dead)) {
      try { dead.dimension.spawnEntity("minecraft:lightning_bolt", dead.location); } catch {}
      spawnRing(dead.dimension, dead.location, 2.8, 20, "minecraft:blue_flame_particle", 1.0);
      return;
    }
  }
  const killer = ev.damageSource?.damagingEntity;
  if (killer && (killer.typeId === GUO_ID || killer.typeId === ABOM_ID || killer.typeId === BLOOD_ANGEL_ID)) {
    try {
      const hp = killer.getComponent("minecraft:health");
      if (hp && hp.currentValue > 0) {
        const heal = killer.typeId === GUO_ID ? 15 : (killer.typeId === ABOM_ID ? 12 : 8);
        hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + heal));
        spawnRing(killer.dimension, killer.location, 1.4, 10, killer.typeId === BLOOD_ANGEL_ID ? "minecraft:basic_flame_particle" : "minecraft:totem_particle", 1.5);
      }
    } catch {}
  }
});

// === MAIN 4-TICK LOOP (5 Hz) ===
system.runInterval(() => {
  const now = system.currentTick;

  for (let i = activeClouds.length - 1; i >= 0; i--) {
    const c = activeClouds[i];
    c.ticksLeft -= 4;
    if (c.ticksLeft <= 0) { activeClouds.splice(i, 1); continue; }
    for (let k = 0; k < 14; k++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * c.radius;
      const loc = { x: c.x + Math.cos(a) * r, y: c.y + Math.random() * 2.2, z: c.z + Math.sin(a) * r };
      safeParticle(c.dim, k % 2 === 0 ? "minecraft:totem_particle" : "minecraft:villager_happy", loc);
    }
    if (c.ticksLeft % 20 === 0) {
      try {
        for (const v of c.dim.getEntities({ location: { x: c.x, y: c.y, z: c.z }, maxDistance: c.radius, excludeFamilies: ["nurgle"] })) {
          if (NURGLE_SET.has(v.typeId) || isCreative(v) || !v.getComponent("minecraft:health")) continue;
          try { v.addEffect("poison", 80, { amplifier: 1, showParticles: true }); v.applyDamage(2); } catch {}
        }
      } catch {}
    }
  }

  for (const dimId of ["overworld", "nether", "the_end"]) {
    let dim;
    try { dim = world.getDimension(dimId); } catch { continue; }

    try {
      for (const mId of ALL_OUR_MOBS) {
        for (const ent of dim.getEntities({ type: mId })) {
          const st = stateMap.get(ent.id);
          if (st && st.animResetTick > 0 && now >= st.animResetTick && (!st.rootState || st.rootState === "mobile")) {
            st.animResetTick = 0;
            try { ent.setProperty("warcraft:anim_state", 0); } catch {}
          }
        }
      }
    } catch {}

    // 1. Nurgle Faction: Great Unclean One & Abomination Lord
    try {
      for (const boss of dim.getEntities({ type: GUO_ID })) {
        const st = getSt(boss, { fury: 0, frenzyTriggered: false, chainCooldown: 60 });
        if (now % 8 === 0) safeParticle(dim, "minecraft:totem_particle", { x: boss.location.x + (Math.random() - 0.5) * 1.6, y: boss.location.y + 0.5, z: boss.location.z + (Math.random() - 0.5) * 1.6 });
        if (now % 8 === 0 && st.animResetTick === 0) {
          const bar = formatFuryBar(st.fury, st.frenzyTriggered);
          for (const p of dim.getPlayers({ location: boss.location, maxDistance: 24 })) p.onScreenDisplay.setActionBar(bar);
        }
        st.chainCooldown -= 4;
        if (st.chainCooldown <= 0) {
          let best = null, bd = 999;
          for (const c of dim.getEntities({ location: boss.location, minDistance: 5.0, maxDistance: 16.0, excludeFamilies: ["nurgle"] })) {
            if (!isValidVictim(c, boss, NURGLE_SET)) continue;
            const d = Math.hypot(c.location.x - boss.location.x, c.location.z - boss.location.z);
            if (d < bd) { bd = d; best = c; }
          }
          if (best) { triggerChainPull(boss, best, st); st.chainCooldown = CHAIN_COOLDOWN_TICKS; }
          else st.chainCooldown = 20;
        }
      }
      for (const abom of dim.getEntities({ type: ABOM_ID })) {
        const st = getSt(abom, { belchCd: 70, auraTick: 0 });
        if (now % 12 === 0) safeParticle(dim, "minecraft:villager_happy", { x: abom.location.x + (Math.random() - 0.5) * 1.4, y: abom.location.y + 1.0, z: abom.location.z + (Math.random() - 0.5) * 1.4 });
        st.auraTick += 4;
        if (st.auraTick >= 40) {
          st.auraTick = 0;
          for (const v of dim.getEntities({ location: abom.location, maxDistance: 3.2, excludeFamilies: ["nurgle"] })) {
            if (isValidVictim(v, abom, NURGLE_SET)) { try { v.addEffect("poison", 50, { amplifier: 0, showParticles: true }); v.applyDamage(1); } catch {} }
          }
        }
        st.belchCd -= 4;
        if (st.belchCd <= 0) {
          const has = dim.getEntities({ location: abom.location, maxDistance: 4.5, excludeFamilies: ["nurgle"] }).some(v => isValidVictim(v, abom, NURGLE_SET));
          if (has) { triggerToxicBelch(abom, st); st.belchCd = 140; } else st.belchCd = 24;
        }
      }
    } catch {}

    // 2. Elemental Golems (wild or tamed player allies!)
    try {
      for (const g of dim.getEntities({ type: INF_ID })) {
        const st = getSt(g, { slamCd: 80, auraTick: 0, fury: 0 });
        const excl = isTamedAlly(g) ? null : new Set([g.typeId]);
        if (now % 8 === 0) {
          for (let k = 0; k < 2; k++) {
            const a = Math.random() * Math.PI * 2;
            safeParticle(dim, "minecraft:basic_flame_particle", { x: g.location.x + Math.cos(a) * 1.1, y: g.location.y + 0.9 + Math.random() * 1.4, z: g.location.z + Math.sin(a) * 1.1 });
          }
        }
        st.auraTick += 4;
        if (st.auraTick >= 32) {
          st.auraTick = 0;
          for (const v of dim.getEntities({ location: g.location, maxDistance: 3.5 })) {
            if (isValidVictim(v, g, excl)) { try { v.setOnFire(3, true); v.applyDamage(2); } catch {} }
          }
        }
        st.slamCd -= 4;
        if (st.slamCd <= 0) {
          const has = dim.getEntities({ location: g.location, maxDistance: 5.5 }).some(v => isValidVictim(v, g, excl));
          if (has) { triggerMagmaSlam(g, st); st.slamCd = 160; } else st.slamCd = 20;
        }
      }
      for (const g of dim.getEntities({ type: FROST_ID })) {
        const st = getSt(g, { prisonCd: 90, shieldUsed: false, fury: 0 });
        const excl = isTamedAlly(g) ? null : new Set([g.typeId]);
        if (now % 8 === 0) {
          for (let k = 0; k < 2; k++) {
            const a = Math.random() * Math.PI * 2;
            safeParticle(dim, k === 0 ? "minecraft:snowflake_particle" : "minecraft:blue_flame_particle", {
              x: g.location.x + Math.cos(a) * 1.1, y: g.location.y + 0.9 + Math.random() * 1.4, z: g.location.z + Math.sin(a) * 1.1,
            });
          }
        }
        st.prisonCd -= 4;
        if (st.prisonCd <= 0) {
          const has = dim.getEntities({ location: g.location, maxDistance: 5.5 }).some(v => isValidVictim(v, g, excl));
          if (has) { triggerGlacialPrison(g, st); st.prisonCd = 170; } else st.prisonCd = 20;
        }
      }
      for (const g of dim.getEntities({ type: LIGHT_ID })) {
        const st = getSt(g, { boltCd: 70, blinkCd: 140 });
        const excl = isTamedAlly(g) ? null : new Set([g.typeId]);
        if (now % 8 === 0) {
          for (let k = 0; k < 2; k++) {
            const a = Math.random() * Math.PI * 2;
            safeParticle(dim, k === 0 ? "minecraft:endrod" : "minecraft:blue_flame_particle", {
              x: g.location.x + Math.cos(a) * 1.1, y: g.location.y + 1.0 + Math.random() * 1.4, z: g.location.z + Math.sin(a) * 1.1,
            });
          }
        }
        st.boltCd -= 4;
        if (st.boltCd <= 0) {
          let best = null, bd = 999;
          for (const v of dim.getEntities({ location: g.location, maxDistance: 13.0 })) {
            if (!isValidVictim(v, g, excl)) continue;
            const d = Math.hypot(v.location.x - g.location.x, v.location.z - g.location.z);
            if (d < bd) { bd = d; best = v; }
          }
          if (best) { triggerChainLightning(g, best, st); st.boltCd = 140; } else st.boltCd = 20;
        }
        st.blinkCd -= 4;
        if (st.blinkCd <= 0) {
          let farTarget = null;
          for (const v of dim.getEntities({ location: g.location, minDistance: 7.0, maxDistance: 15.0 })) {
            if (isValidVictim(v, g, excl)) { farTarget = v; break; }
          }
          if (farTarget) { triggerBlinkSurge(g, farTarget, st); st.blinkCd = 200; } else st.blinkCd = 30;
        }
      }
    } catch {}

    // 3. Chaos Legion
    try {
      for (const d of dim.getEntities({ type: DEMON_ID })) {
        const st = getSt(d, { dashCd: 60, roarCd: 120, frenzy: false });
        if (st.frenzy && now % 8 === 0) safeParticle(dim, "minecraft:basic_flame_particle", { x: d.location.x + (Math.random() - 0.5) * 0.8, y: d.location.y + 1.1, z: d.location.z + (Math.random() - 0.5) * 0.8 });
        st.dashCd -= 4;
        if (st.dashCd <= 0) {
          let best = null, bd = 999;
          for (const c of dim.getEntities({ location: d.location, minDistance: 4.5, maxDistance: 13.0 })) {
            if (!isValidVictim(c, d, new Set([DEMON_ID]))) continue;
            const dist = Math.hypot(c.location.x - d.location.x, c.location.z - d.location.z);
            if (dist < bd) { bd = dist; best = c; }
          }
          if (best) { triggerHornedGore(d, best, st); st.dashCd = 120; } else st.dashCd = 20;
        }
        st.roarCd -= 4;
        if (st.roarCd <= 0) {
          const has = dim.getEntities({ location: d.location, maxDistance: 4.5 }).some(c => isValidVictim(c, d, new Set([DEMON_ID])));
          if (has) { triggerHellfireRoar(d, st); st.roarCd = 200; } else st.roarCd = 24;
        }
      }
      for (const vk of dim.getEntities({ type: VOID_KNIGHT_ID })) {
        const st = getSt(vk, { gravCd: 90 });
        if (now % 12 === 0) safeParticle(dim, "minecraft:blue_flame_particle", { x: vk.location.x, y: vk.location.y + 1.4, z: vk.location.z });
        st.gravCd -= 4;
        if (st.gravCd <= 0) {
          const has = dim.getEntities({ location: vk.location, maxDistance: 7.5 }).some(c => isValidVictim(c, vk, new Set([VOID_KNIGHT_ID])));
          if (has) { triggerVoidGravity(vk, st); st.gravCd = 160; } else st.gravCd = 24;
        }
      }
      for (const ba of dim.getEntities({ type: BLOOD_ANGEL_ID })) {
        const st = getSt(ba, { diveCd: 70 });
        if (now % 12 === 0) safeParticle(dim, "minecraft:basic_flame_particle", { x: ba.location.x, y: ba.location.y + 1.8, z: ba.location.z });
        st.diveCd -= 4;
        if (st.diveCd <= 0) {
          let best = null, bd = 999;
          for (const c of dim.getEntities({ location: ba.location, minDistance: 4.5, maxDistance: 14.0 })) {
            if (!isValidVictim(c, ba, new Set([BLOOD_ANGEL_ID]))) continue;
            const dist = Math.hypot(c.location.x - ba.location.x, c.location.z - ba.location.z);
            if (dist < bd) { bd = dist; best = c; }
          }
          if (best) { triggerBloodDive(ba, best, st); st.diveCd = 130; } else st.diveCd = 24;
        }
      }
    } catch {}

    // 4. Faceless Family
    try {
      for (const s of dim.getEntities({ type: FL_SORCERER })) {
        const st = getSt(s, { castCd: 45, healCd: 90, blinkCd: 60 });
        if (now % 14 === 0) {
          safeParticle(dim, "minecraft:blue_flame_particle", { x: s.location.x, y: s.location.y + 1.9, z: s.location.z });
        }
        let best = null, bd = 999;
        for (const c of dim.getEntities({ location: s.location, maxDistance: 16.5 })) {
          if (!isValidVictim(c, s, FACELESS_SET)) continue;
          const dist = Math.hypot(c.location.x - s.location.x, c.location.z - s.location.z);
          if (dist < bd) { bd = dist; best = c; }
        }
        // 1. Void Blink Escape when enemy closes <= 4.2 blocks
        st.blinkCd -= 4;
        if (st.blinkCd <= 0 && best && bd <= 4.2) {
          triggerSorcererVoidBlink(s, best, st);
          st.blinkCd = 130;
          continue;
        }
        // 2. Faceless Ritual Heal & Shield when self or ally < 85% HP
        st.healCd -= 4;
        if (st.healCd <= 0) {
          const didHeal = triggerSorcererRitualHeal(s, st);
          st.healCd = didHeal ? 125 : 28;
          if (didHeal) continue;
        }
        // 3. Void Levitate Bolt at range (up to 16.5 blocks)
        st.castCd -= 4;
        if (st.castCd <= 0) {
          if (best) { triggerSorcererLevitateBolt(s, best, st); st.castCd = 75; } else st.castCd = 20;
        }
      }
      for (const gen of dim.getEntities({ type: FL_GENERAL })) {
        const st = getSt(gen, { novaCd: 90, summoned: false });
        if (now % 12 === 0) safeParticle(dim, "minecraft:blue_flame_particle", { x: gen.location.x, y: gen.location.y + 1.6, z: gen.location.z });
        st.novaCd -= 4;
        if (st.novaCd <= 0) {
          const has = dim.getEntities({ location: gen.location, maxDistance: 5.0 }).some(c => isValidVictim(c, gen, FACELESS_SET));
          if (has) { triggerGeneralMindCrush(gen, st); st.novaCd = 170; } else st.novaCd = 24;
        }
      }
    } catch {}
  }
}, 4);


// =========================================================================
// v3.4.0 NEW MOBS: Pink Horror, Ember Colossus, Black Blocker, Ancient Treant
// =========================================================================
function triggerPinkHorrorWarpBolt(caster, target, st) {
  playAnim(caster, 1, 24);
  const dim = caster.dimension;
  const src = caster.location, dst = target.location;
  safeSound(dim, "mob.blaze.shoot", src);
  for (let i = 1; i <= 10; i++) {
    const f = i / 10;
    const lx = src.x + (dst.x - src.x) * f + Math.sin(i * 0.9) * 0.3;
    const ly = src.y + 1.2 + (dst.y + 1.0 - src.y - 1.2) * f;
    const lz = src.z + (dst.z - src.z) * f + Math.cos(i * 0.9) * 0.3;
    safeParticle(dim, "minecraft:blue_flame_particle", { x: lx, y: ly, z: lz });
    if (i % 3 === 0) safeParticle(dim, "minecraft:witchspell_emitter", { x: lx, y: ly, z: lz });
  }
  try {
    target.applyDamage(6, { cause: "magic", damagingEntity: caster });
    try { target.setOnFire(3, true); } catch {}
    if (Math.random() < 0.5) {
      target.addEffect("levitation", 35, { amplifier: 0, showParticles: true });
    } else {
      target.addEffect("weakness", 60, { amplifier: 0, showParticles: true });
    }
  } catch {}
}

function triggerEmberBeam(boss, target, st) {
  playAnim(boss, 1, 40);
  const dim = boss.dimension;
  safeSound(dim, "mob.ravager.roar", boss.location);
  for (let pulse = 0; pulse < 3; pulse++) {
    system.runTimeout(() => {
      try {
        if (!alive(boss) || !alive(target)) return;
        const src = boss.location, dst = target.location;
        safeSound(dim, "mob.blaze.shoot", src);
        for (let i = 1; i <= 12; i++) {
          const f = i / 12;
          const pt = {
            x: src.x + (dst.x - src.x) * f,
            y: src.y + 2.4 + (dst.y + 1.0 - src.y - 2.4) * f,
            z: src.z + (dst.z - src.z) * f,
          };
          safeParticle(dim, i % 2 === 0 ? "minecraft:blue_flame_particle" : "minecraft:basic_flame_particle", pt);
        }
        const dist = Math.hypot(dst.x - src.x, dst.z - src.z);
        if (dist <= 16.0) {
          target.applyDamage(5, { cause: "fire", damagingEntity: boss });
          try { target.setOnFire(4, true); } catch {}
        }
      } catch {}
    }, pulse * 12);
  }
}

function triggerEmberSlam(boss, st) {
  playAnim(boss, 2, 55);
  const dim = boss.dimension, loc = boss.location;
  safeSound(dim, "random.explode", loc);
  for (let a = 0; a < 20; a++) {
    const ang = (a / 20) * Math.PI * 2;
    for (const r of [2.0, 4.0, 6.0]) {
      const pt = { x: loc.x + Math.cos(ang) * r, y: loc.y + 0.4, z: loc.z + Math.sin(ang) * r };
      safeParticle(dim, r > 4.5 ? "minecraft:blue_flame_particle" : "minecraft:basic_flame_particle", pt);
      if (a % 2 === 0) safeParticle(dim, "minecraft:lava_particle", pt);
    }
  }
  const excl = new Set([EMBER_COLOSSUS_ID]);
  for (const v of dim.getEntities({ location: loc, maxDistance: 6.8 })) {
    if (!isValidVictim(v, boss, excl)) continue;
    try {
      v.applyDamage(9, { cause: "entityExplosion", damagingEntity: boss });
      try { v.setOnFire(4, true); } catch {}
      const dx = v.location.x - loc.x, dz = v.location.z - loc.z;
      const d = Math.max(0.5, Math.hypot(dx, dz));
      v.applyKnockback(dx / d, dz / d, 1.3, 0.55);
    } catch {}
  }
}

function triggerBlockerFortify(blocker, st) {
  playAnim(blocker, 2, 24);
  const dim = blocker.dimension, loc = blocker.location;
  safeSound(dim, "random.anvil_land", loc);
  try { blocker.addEffect("resistance", 100, { amplifier: 1, showParticles: true }); } catch {}
  for (let a = 0; a < 14; a++) {
    const ang = (a / 14) * Math.PI * 2;
    safeParticle(dim, "minecraft:basic_smoke_particle", { x: loc.x + Math.cos(ang) * 1.8, y: loc.y + 1.4, z: loc.z + Math.sin(ang) * 1.8 });
    safeParticle(dim, "minecraft:critical_hit_emitter", { x: loc.x + Math.cos(ang) * 1.5, y: loc.y + 1.8, z: loc.z + Math.sin(ang) * 1.5 });
  }
}

function triggerBlockerCounterSlam(blocker, st) {
  playAnim(blocker, 1, 28);
  const dim = blocker.dimension, loc = blocker.location;
  safeSound(dim, "random.anvil_land", loc);
  for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2;
    safeParticle(dim, "minecraft:basic_smoke_particle", { x: loc.x + Math.cos(ang) * 3.5, y: loc.y + 0.5, z: loc.z + Math.sin(ang) * 3.5 });
  }
  const excl = new Set([BLACK_BLOCKER_ID]);
  for (const v of dim.getEntities({ location: loc, maxDistance: 5.2 })) {
    if (!isValidVictim(v, blocker, excl)) continue;
    try {
      v.applyDamage(8, { cause: "entityAttack", damagingEntity: blocker });
      v.addEffect("slowness", 60, { amplifier: 1, showParticles: true });
      v.addEffect("weakness", 60, { amplifier: 0, showParticles: true });
      const dx = v.location.x - loc.x, dz = v.location.z - loc.z;
      const d = Math.max(0.5, Math.hypot(dx, dz));
      v.applyKnockback(dx / d, dz / d, 1.1, 0.35);
    } catch {}
  }
}

function getEntVariant(ent) {
  try { return ent.getComponent("minecraft:variant")?.value ?? 0; } catch { return 0; }
}

function triggerEntRootSlam(ent, st) {
  playAnim(ent, 1, 26);
  const dim = ent.dimension, loc = ent.location;
  const vId = getEntVariant(ent);
  // 0=oak, 1=birch, 2=spruce, 3=cherry, 4=crimson, 5=warped, 6=jungle, 7=acacia, 8=dark_oak, 9=mangrove, 10=pale_oak, 11=azalea, 12=poplar (4, 5 = Nether stems)
  safeSound(dim, (vId === 4 || vId === 5) ? "mob.blaze.shoot" : "dig.wood", loc);
  safeSound(dim, "mob.ravager.roar", loc);
  const pMain = vId === 4 ? "minecraft:basic_flame_particle"
              : vId === 5 ? "minecraft:blue_flame_particle"
              : vId === 3 ? "minecraft:heart_particle"
              : "minecraft:villager_happy";
  const pSub  = vId === 4 ? "minecraft:lava_particle"
              : vId === 5 ? "minecraft:witchspell_emitter"
              : "minecraft:totem_particle";
  for (let a = 0; a < 18; a++) {
    const ang = (a / 18) * Math.PI * 2;
    for (const r of [2.5, 5.0]) {
      const pt = { x: loc.x + Math.cos(ang) * r, y: loc.y + 0.4, z: loc.z + Math.sin(ang) * r };
      safeParticle(dim, pMain, pt);
      if (a % 3 === 0) safeParticle(dim, pSub, pt);
    }
  }
  if (vId === 2) {
    // Spruce Taiga tank gains Resistance I on slam
    try { ent.addEffect("resistance", 80, { amplifier: 0, showParticles: true }); } catch {}
  }
  const dmg = vId === 4 ? 10 : (vId === 2 || vId === 5) ? 9 : vId === 0 ? 8 : 7;
  const excl = new Set([BIG_ENT_ID]);
  for (const v of dim.getEntities({ location: loc, maxDistance: 6.5 })) {
    if (!isValidVictim(v, ent, excl)) continue;
    try {
      v.applyDamage(dmg, { cause: vId === 4 ? "fire" : "entityAttack", damagingEntity: ent });
      if (vId === 0) {
        v.addEffect("slowness", 70, { amplifier: 3, showParticles: true });
        v.addEffect("poison", 80, { amplifier: 0, showParticles: true });
      } else if (vId === 1) {
        v.addEffect("slowness", 60, { amplifier: 2, showParticles: true });
        v.addEffect("weakness", 80, { amplifier: 0, showParticles: true });
      } else if (vId === 2) {
        v.addEffect("slowness", 90, { amplifier: 3, showParticles: true });
        v.addEffect("mining_fatigue", 80, { amplifier: 1, showParticles: true });
      } else if (vId === 3) {
        v.addEffect("slowness", 60, { amplifier: 1, showParticles: true });
      } else if (vId === 4) {
        try { v.setOnFire(5, true); } catch {}
        v.addEffect("wither", 70, { amplifier: 0, showParticles: true });
      } else if (vId === 5) {
        v.addEffect("levitation", 40, { amplifier: 0, showParticles: true });
        v.addEffect("wither", 70, { amplifier: 0, showParticles: true });
      } else if (vId === 6) {  // jungle
        v.addEffect("poison", 100, { amplifier: 1, showParticles: true });
        v.addEffect("slowness", 50, { amplifier: 1, showParticles: true });
      } else if (vId === 7) {  // acacia
        v.addEffect("hunger", 120, { amplifier: 1, showParticles: true });
        v.addEffect("slowness", 50, { amplifier: 1, showParticles: true });
      } else if (vId === 8) {  // dark_oak
        v.addEffect("blindness", 60, { amplifier: 0, showParticles: true });
        v.addEffect("slowness", 90, { amplifier: 3, showParticles: true });
      } else if (vId === 9) {  // mangrove
        v.addEffect("slowness", 100, { amplifier: 4, showParticles: true });
      } else if (vId === 10) {  // pale_oak
        v.addEffect("darkness", 80, { amplifier: 0, showParticles: true });
        v.addEffect("weakness", 80, { amplifier: 1, showParticles: true });
      } else if (vId === 11) {  // azalea
        v.addEffect("nausea", 80, { amplifier: 0, showParticles: true });
        v.addEffect("slowness", 40, { amplifier: 1, showParticles: true });
      } else if (vId === 12) {  // poplar
        v.addEffect("levitation", 20, { amplifier: 0, showParticles: true });
        v.addEffect("slowness", 60, { amplifier: 2, showParticles: true });
      }
    } catch {}
  }
}

function triggerEntEatTreeHeal(ent, st) {
  playAnim(ent, 2, 55);
  const dim = ent.dimension, loc = ent.location;
  const vId = getEntVariant(ent);
  safeSound(dim, "random.eat", loc);
  safeSound(dim, (vId === 4 || vId === 5) ? "mob.blaze.ambient" : "dig.wood", loc);
  const healAmt = vId === 3 ? 30 : 22;
  try {
    const hp = ent.getComponent("minecraft:health");
    if (hp) hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + healAmt));
    ent.addEffect("regeneration", 80, { amplifier: vId === 3 ? 2 : 1, showParticles: true });
  } catch {}
  // Cherry Blossom Ent also heals nearby allied Ents!
  if (vId === 3) {
    for (const ally of dim.getEntities({ type: BIG_ENT_ID, location: loc, maxDistance: 10.0 })) {
      if (ally.id === ent.id) continue;
      try {
        const ahp = ally.getComponent("minecraft:health");
        if (ahp) ahp.setCurrentValue(Math.min(ahp.effectiveMax, ahp.currentValue + 16));
        safeParticle(dim, "minecraft:heart_particle", { x: ally.location.x, y: ally.location.y + 2.5, z: ally.location.z });
      } catch {}
    }
  }
  const pHeal = vId === 4 ? "minecraft:basic_flame_particle"
              : vId === 5 ? "minecraft:blue_flame_particle"
              : vId === 3 ? "minecraft:heart_particle"
              : "minecraft:villager_happy";
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    safeParticle(dim, pHeal, { x: loc.x + Math.cos(ang) * 1.4, y: loc.y + 1.0 + (i % 4) * 0.5, z: loc.z + Math.sin(ang) * 1.4 });
    safeParticle(dim, "minecraft:totem_particle", { x: loc.x + Math.cos(ang) * 1.0, y: loc.y + 1.8, z: loc.z + Math.sin(ang) * 1.0 });
  }
}

// Pink Horror Warp Detonation & Blue Horror split on death
world.afterEvents.entityDie.subscribe((ev) => {
  const dead = ev.deadEntity;
  if (!dead || dead.typeId !== PINK_HORROR_ID) return;
  try {
    const dim = dead.dimension, loc = dead.location;
    safeSound(dim, "mob.blaze.death", loc);
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      safeParticle(dim, "minecraft:blue_flame_particle", { x: loc.x + Math.cos(ang) * 2.2, y: loc.y + 0.8, z: loc.z + Math.sin(ang) * 2.2 });
      safeParticle(dim, "minecraft:witchspell_emitter", { x: loc.x + Math.cos(ang) * 1.4, y: loc.y + 1.2, z: loc.z + Math.sin(ang) * 1.4 });
    }
    const excl = new Set([PINK_HORROR_ID]);
    for (const v of dim.getEntities({ location: loc, maxDistance: 4.5 })) {
      if (!isValidVictim(v, dead, excl)) continue;
      try {
        v.applyDamage(5, { cause: "magic" });
        try { v.setOnFire(3, true); } catch {}
      } catch {}
    }
    // Spawn 2 temporary Blue Horror sparks (vexes) that despawn after 14s
    for (let i = 0; i < 2; i++) {
      try {
        const spark = dim.spawnEntity("minecraft:vex", { x: loc.x + (i === 0 ? 0.8 : -0.8), y: loc.y + 0.8, z: loc.z });
        spark.nameTag = "§9Синий Ужас Тзинча";
        system.runTimeout(() => { try { if (alive(spark)) spark.remove(); } catch {} }, 280);
      } catch {}
    }
  } catch {}
});

// v3.4.0 4-tick ability loop for the 4 new factions
system.runInterval(() => {
  const now = system.currentTick;
  const dims = ["overworld", "nether", "the_end"];
  for (const dn of dims) {
    let dim;
    try { dim = world.getDimension(dn); } catch { continue; }

    // Pink Horror of Tzeentch
    try {
      for (const ph of dim.getEntities({ type: PINK_HORROR_ID })) {
        const st = getSt(ph, { boltCd: 45 });
        if (now % 14 === 0) safeParticle(dim, "minecraft:blue_flame_particle", { x: ph.location.x, y: ph.location.y + 1.4, z: ph.location.z });
        st.boltCd -= 4;
        if (st.boltCd <= 0) {
          let best = null, bd = 999;
          const excl = new Set([PINK_HORROR_ID]);
          for (const c of dim.getEntities({ location: ph.location, maxDistance: 14.5 })) {
            if (!isValidVictim(c, ph, excl)) continue;
            const d = Math.hypot(c.location.x - ph.location.x, c.location.z - ph.location.z);
            if (d < bd) { bd = d; best = c; }
          }
          if (best) { triggerPinkHorrorWarpBolt(ph, best, st); st.boltCd = 85; } else st.boltCd = 20;
        }
      }
    } catch {}

    // Ember Colossus (Boss)
    try {
      for (const ec of dim.getEntities({ type: EMBER_COLOSSUS_ID })) {
        const st = getSt(ec, { beamCd: 80, slamCd: 110 });
        if (now % 10 === 0) {
          safeParticle(dim, "minecraft:blue_flame_particle", { x: ec.location.x + (Math.random() - 0.5) * 1.4, y: ec.location.y + 2.2, z: ec.location.z + (Math.random() - 0.5) * 1.4 });
          safeParticle(dim, "minecraft:basic_flame_particle", { x: ec.location.x + (Math.random() - 0.5) * 1.4, y: ec.location.y + 1.2, z: ec.location.z + (Math.random() - 0.5) * 1.4 });
        }
        const excl = new Set([EMBER_COLOSSUS_ID]);
        st.beamCd -= 4;
        if (st.beamCd <= 0) {
          let best = null, bd = 999;
          for (const c of dim.getEntities({ location: ec.location, minDistance: 3.5, maxDistance: 15.0 })) {
            if (!isValidVictim(c, ec, excl)) continue;
            const d = Math.hypot(c.location.x - ec.location.x, c.location.z - ec.location.z);
            if (d < bd) { bd = d; best = c; }
          }
          if (best) { triggerEmberBeam(ec, best, st); st.beamCd = 165; } else st.beamCd = 24;
        }
        st.slamCd -= 4;
        if (st.slamCd <= 0) {
          const has = dim.getEntities({ location: ec.location, maxDistance: 6.5 }).some(c => isValidVictim(c, ec, excl));
          if (has) { triggerEmberSlam(ec, st); st.slamCd = 190; } else st.slamCd = 24;
        }
      }
    } catch {}

    // Black Blocker
    try {
      for (const bb of dim.getEntities({ type: BLACK_BLOCKER_ID })) {
        const st = getSt(bb, { slamCd: 75, fortCd: 100 });
        const excl = new Set([BLACK_BLOCKER_ID]);
        st.slamCd -= 4;
        if (st.slamCd <= 0) {
          const has = dim.getEntities({ location: bb.location, maxDistance: 5.0 }).some(c => isValidVictim(c, bb, excl));
          if (has) { triggerBlockerCounterSlam(bb, st); st.slamCd = 140; } else st.slamCd = 20;
        }
        st.fortCd -= 4;
        if (st.fortCd <= 0) {
          const has = dim.getEntities({ location: bb.location, maxDistance: 7.0 }).some(c => isValidVictim(c, bb, excl));
          if (has) { triggerBlockerFortify(bb, st); st.fortCd = 185; } else st.fortCd = 24;
        }
      }
    } catch {}

    // Ancient Treant (Big Ent — 13 vanilla tree variants + WC3 Peace-Only Rooting & Vulnerable Transitions!)
    try {
      for (const ent of dim.getEntities({ type: BIG_ENT_ID })) {
        const st = getSt(ent, { rootCd: 70, healCd: 120, rootState: "mobile", morphEnd: 0, lastCombatTick: now });
        const vId = getEntVariant(ent);
        const excl = new Set([BIG_ENT_ID]);
        const pAmb = vId === 4 ? "minecraft:basic_flame_particle"
                   : vId === 5 ? "minecraft:blue_flame_particle"
                   : vId === 3 ? "minecraft:heart_particle"
                   : "minecraft:villager_happy";

        // Check nearby enemies (20 blocks for peace check, 16 blocks to wake up rooted Ent)
        let nearestEnemyDist = 999;
        for (const c of dim.getEntities({ location: ent.location, maxDistance: 20.0 })) {
          if (!isValidVictim(c, ent, excl)) continue;
          const d = Math.hypot(c.location.x - ent.location.x, c.location.z - ent.location.z);
          if (d < nearestEnemyDist) nearestEnemyDist = d;
        }
        if (nearestEnemyDist <= 20.0) st.lastCombatTick = now;

        // STATE 1: Currently ROOTING (4) or UPROOTING (6) — HELPLESS VULNERABILITY WINDOW (2.6s)
        if (st.rootState === "rooting" || st.rootState === "uprooting") {
          try {
            ent.addEffect("slowness", 12, { amplifier: 255, showParticles: false });
            ent.addEffect("weakness", 12, { amplifier: 255, showParticles: false });
          } catch {}
          if (now % 8 === 0) {
            safeParticle(dim, pAmb, { x: ent.location.x + (Math.random() - 0.5) * 1.6, y: ent.location.y + 0.5, z: ent.location.z + (Math.random() - 0.5) * 1.6 });
          }
          if (now >= st.morphEnd) {
            if (st.rootState === "rooting") {
              // If enemy suddenly arrived while rooting, immediately begin vulnerable uprooting!
              if (nearestEnemyDist <= 16.0) {
                st.rootState = "uprooting";
                st.morphEnd = now + 52;
                try { ent.setProperty("warcraft:anim_state", 6); } catch {}
                safeSound(dim, "dig.wood", ent.location);
              } else {
                st.rootState = "rooted";
                try { ent.setProperty("warcraft:anim_state", 5); } catch {}
                safeSound(dim, "dig.grass", ent.location);
              }
            } else {
              // Finished uprooting -> mobile & ready for battle!
              st.rootState = "mobile";
              try { ent.setProperty("warcraft:anim_state", 0); } catch {}
              safeSound(dim, "mob.ravager.roar", ent.location);
            }
          }
          continue; // Helpless during morph: no abilities!
        }

        // STATE 2: ROOTED IN PEACE (5) — living tree stance, gentle regen, wakes up on enemy <= 16 blocks
        if (st.rootState === "rooted") {
          try { ent.addEffect("slowness", 12, { amplifier: 255, showParticles: false }); } catch {}
          if (now % 24 === 0) {
            safeParticle(dim, pAmb, { x: ent.location.x + (Math.random() - 0.5) * 1.5, y: ent.location.y + 2.5, z: ent.location.z + (Math.random() - 0.5) * 1.5 });
          }
          if (now % 40 === 0) {
            try {
              const hp = ent.getComponent("minecraft:health");
              if (hp && hp.currentValue < hp.effectiveMax) {
                hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + 2));
              }
            } catch {}
          }
          if (nearestEnemyDist <= 16.0) {
            // Wake up! Enter 2.6s helpless Uprooting transition!
            st.rootState = "uprooting";
            st.morphEnd = now + 52;
            try {
              ent.setProperty("warcraft:anim_state", 6);
              ent.addEffect("slowness", 56, { amplifier: 255, showParticles: false });
              ent.addEffect("weakness", 56, { amplifier: 255, showParticles: false });
            } catch {}
            safeSound(dim, "dig.wood", ent.location);
          }
          continue;
        }

        // STATE 3: MOBILE (0) — normal combat OR root down ONLY during peace (>= 8s with no enemies <= 20 blocks)
        if (now % 16 === 0) {
          safeParticle(dim, pAmb, { x: ent.location.x + (Math.random() - 0.5) * 1.4, y: ent.location.y + 2.4, z: ent.location.z + (Math.random() - 0.5) * 1.4 });
        }
        if (nearestEnemyDist > 20.0 && (now - st.lastCombatTick) >= 160) {
          // Peace detected -> begin 2.6s vulnerable Rooting transition!
          st.rootState = "rooting";
          st.morphEnd = now + 52;
          try {
            ent.setProperty("warcraft:anim_state", 4);
            ent.addEffect("slowness", 56, { amplifier: 255, showParticles: false });
            ent.addEffect("weakness", 56, { amplifier: 255, showParticles: false });
          } catch {}
          safeSound(dim, "dig.wood", ent.location);
          continue;
        }

        st.rootCd -= 4;
        if (st.rootCd <= 0) {
          if (nearestEnemyDist <= 6.5) { triggerEntRootSlam(ent, st); st.rootCd = vId === 1 ? 110 : 145; } else st.rootCd = 24;
        }
        st.healCd -= 4;
        if (st.healCd <= 0) {
          try {
            const hp = ent.getComponent("minecraft:health");
            if (hp && hp.currentValue < hp.effectiveMax * 0.72) {
              triggerEntEatTreeHeal(ent, st);
              st.healCd = 220;
            } else st.healCd = 30;
          } catch { st.healCd = 30; }
        }
      }
    } catch {}
  }
}, 4);


// Wake up rooted Ent immediately if attacked (triggers 2.6s helpless uprooting transition)
world.afterEvents.entityHurt.subscribe((ev) => {
  const ent = ev.hurtEntity;
  if (!ent || ent.typeId !== BIG_ENT_ID) return;
  const st = stateMap.get(ent.id);
  if (!st) return;
  const now = system.currentTick;
  st.lastCombatTick = now;
  if (st.rootState === "rooted") {
    st.rootState = "uprooting";
    st.morphEnd = now + 52;
    try {
      ent.setProperty("warcraft:anim_state", 6);
      ent.addEffect("slowness", 56, { amplifier: 255, showParticles: false });
      ent.addEffect("weakness", 56, { amplifier: 255, showParticles: false });
    } catch {}
    safeSound(ent.dimension, "dig.wood", ent.location);
  }
});

// Clean up stateMap on entity death to prevent memory growth
world.afterEvents.entityDie.subscribe((ev) => {
  try { if (ev.deadEntity) stateMap.delete(ev.deadEntity.id); } catch {}
});


// =========================================================================
// v5.0.0 EXPANSION: 32 NEW MOBS ACROSS NORSCA, KINGDOM, UNDEAD, SANTA & MORE
// =========================================================================
const V50_FAM_SETS = {
  norsca_bandits: new Set([
    "warcraft:bandit_dog", "warcraft:bandit_raider", "warcraft:norse_marauder",
    "warcraft:norse_berserker", "warcraft:wulfrik_champion", "warcraft:chaos_warrior",
    "warcraft:sabertooth_rider", "warcraft:norse_shaman", "warcraft:skaal_villager",
  ]),
  kingdom_order: new Set([
    "warcraft:paladin_swordsman", "warcraft:royal_captain", "warcraft:garithos_paladin",
    "warcraft:royal_knight", "warcraft:dark_plate_knight", "warcraft:heide_knight",
    "warcraft:heide_hood_knight", "warcraft:chival_warrior", "warcraft:elector_knight",
    "warcraft:imperial_guard", "warcraft:high_elf_spearman", "warcraft:teutonic_cleric",
    "warcraft:royal_queen",
  ]),
  undead_scourge: new Set([
    "warcraft:nazgul", "warcraft:pirate_ghost", "warcraft:skeleton_bear", "warcraft:undead_zombie",
  ]),
  faceless: FACELESS_SET,
  frost_elem: new Set([FROST_ID, "warcraft:ice_demon"]),
  nature_ent: new Set([BIG_ENT_ID, "warcraft:grizzly_bear"]),
  tzeentch: new Set([PINK_HORROR_ID, "warcraft:burning_chariot"]),
  santa_boss: new Set(["warcraft:santa_claus"]),
};

const V50_ROLES = {
  "warcraft:bandit_dog": { fam: "norsca_bandits", role: "leaper", cd: 90 },
  "warcraft:bandit_raider": { fam: "norsca_bandits", role: "charger", cd: 110 },
  "warcraft:norse_marauder": { fam: "norsca_bandits", role: "melee", cd: 120 },
  "warcraft:norse_berserker": { fam: "norsca_bandits", role: "berserker", cd: 105 },
  "warcraft:wulfrik_champion": { fam: "norsca_bandits", role: "warlord", cd: 130 },
  "warcraft:chaos_warrior": { fam: "norsca_bandits", role: "tank", cd: 135 },
  "warcraft:sabertooth_rider": { fam: "norsca_bandits", role: "leaper", cd: 100 },
  "warcraft:norse_shaman": { fam: "norsca_bandits", role: "shaman", cd: 95 },
  "warcraft:skaal_villager": { fam: "norsca_bandits", role: "melee", cd: 140 },
  "warcraft:paladin_swordsman": { fam: "kingdom_order", role: "paladin", cd: 125 },
  "warcraft:royal_captain": { fam: "kingdom_order", role: "captain", cd: 130 },
  "warcraft:garithos_paladin": { fam: "kingdom_order", role: "paladin_boss", cd: 120 },
  "warcraft:royal_knight": { fam: "kingdom_order", role: "charger", cd: 110 },
  "warcraft:dark_plate_knight": { fam: "kingdom_order", role: "charger", cd: 115 },
  "warcraft:heide_knight": { fam: "kingdom_order", role: "lightning_duelist", cd: 105 },
  "warcraft:heide_hood_knight": { fam: "kingdom_order", role: "lightning_duelist", cd: 100 },
  "warcraft:chival_warrior": { fam: "kingdom_order", role: "tank", cd: 130 },
  "warcraft:elector_knight": { fam: "kingdom_order", role: "paladin", cd: 125 },
  "warcraft:imperial_guard": { fam: "kingdom_order", role: "tank", cd: 135 },
  "warcraft:high_elf_spearman": { fam: "kingdom_order", role: "lancer", cd: 95 },
  "warcraft:teutonic_cleric": { fam: "kingdom_order", role: "cleric", cd: 95 },
  "warcraft:royal_queen": { fam: "kingdom_order", role: "queen", cd: 120 },
  "warcraft:nazgul": { fam: "undead_scourge", role: "nazgul", cd: 115 },
  "warcraft:pirate_ghost": { fam: "undead_scourge", role: "ghost", cd: 110 },
  "warcraft:skeleton_bear": { fam: "undead_scourge", role: "undead_beast", cd: 125 },
  "warcraft:undead_zombie": { fam: "undead_scourge", role: "zombie", cd: 130 },
  "warcraft:faceless_nightmare": { fam: "faceless", role: "nightmare", cd: 115 },
  "warcraft:faceless_cultist": { fam: "faceless", role: "cultist", cd: 95 },
  "warcraft:ice_demon": { fam: "frost_elem", role: "frost_brute", cd: 120 },
  "warcraft:grizzly_bear": { fam: "nature_ent", role: "beast", cd: 125 },
  "warcraft:burning_chariot": { fam: "tzeentch", role: "chariot", cd: 90 },
  "warcraft:santa_claus": { fam: "santa_boss", role: "santa", cd: 110 },
};

function runV50Ability(mob, target, dist, cfg, st) {
  const dim = mob.dimension, loc = mob.location, excl = V50_FAM_SETS[cfg.fam];
  const r = cfg.role;
  playAnim(mob, 1, 24);

  if (r === "leaper" || r === "charger") {
    // Leap pounce or cavalry charge toward target
    const dx = target.location.x - loc.x, dz = target.location.z - loc.z;
    const d = Math.max(0.5, Math.hypot(dx, dz));
    try { mob.applyKnockback(dx / d, dz / d, 1.5, 0.42); } catch {}
    safeSound(dim, r === "charger" ? "mob.horse.gallop" : "mob.wolf.bark", loc);
    spawnRing(dim, loc, 1.5, 10, "minecraft:critical_hit_emitter", 0.8);
    if (dist <= 4.5) {
      try {
        target.applyDamage(r === "charger" ? 8 : 6, { cause: "entityAttack", damagingEntity: mob });
        target.applyKnockback(dx / d, dz / d, 1.1, 0.35);
      } catch {}
    }
  } else if (r === "berserker" || r === "warlord") {
    safeSound(dim, "mob.ravager.roar", loc);
    try { mob.addEffect("strength", 80, { amplifier: 0, showParticles: true }); } catch {}
    spawnRing(dim, loc, 2.5, 14, "minecraft:basic_flame_particle", 0.8);
    for (const v of dim.getEntities({ location: loc, maxDistance: 4.5 })) {
      if (!isValidVictim(v, mob, excl)) continue;
      try { v.applyDamage(r === "warlord" ? 9 : 7, { cause: "entityAttack", damagingEntity: mob }); } catch {}
    }
  } else if (r === "tank" || r === "captain") {
    safeSound(dim, "random.anvil_land", loc);
    try { mob.addEffect("resistance", 90, { amplifier: 1, showParticles: true }); } catch {}
    spawnRing(dim, loc, 2.2, 12, "minecraft:totem_particle", 1.0);
    if (r === "captain") {
      for (const ally of dim.getEntities({ location: loc, maxDistance: 10.0 })) {
        if (excl.has(ally.typeId)) {
          try { ally.addEffect("resistance", 80, { amplifier: 0, showParticles: true }); } catch {}
        }
      }
    }
  } else if (r === "paladin" || r === "paladin_boss") {
    safeSound(dim, "random.levelup", loc);
    spawnRing(dim, loc, 3.0, 16, "minecraft:totem_particle", 1.0);
    try {
      const hp = mob.getComponent("minecraft:health");
      if (hp) hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + (r === "paladin_boss" ? 18 : 10)));
      if (r === "paladin_boss") mob.addEffect("resistance", 80, { amplifier: 1, showParticles: true });
    } catch {}
    for (const v of dim.getEntities({ location: loc, maxDistance: 5.0 })) {
      if (!isValidVictim(v, mob, excl)) continue;
      try { v.applyDamage(r === "paladin_boss" ? 9 : 6, { cause: "magic", damagingEntity: mob }); } catch {}
    }
  } else if (r === "lightning_duelist") {
    safeSound(dim, "mob.blaze.shoot", loc);
    spawnBeam(dim, loc, target.location, 10, "minecraft:blue_flame_particle", "minecraft:critical_hit_emitter");
    try {
      target.applyDamage(8, { cause: "lightning", damagingEntity: mob });
      mob.addEffect("speed", 50, { amplifier: 1, showParticles: true });
    } catch {}
  } else if (r === "lancer") {
    safeSound(dim, "mob.vindicator.celebrate", loc);
    const dx = target.location.x - loc.x, dz = target.location.z - loc.z;
    const d = Math.max(0.5, Math.hypot(dx, dz));
    try {
      target.applyDamage(7, { cause: "entityAttack", damagingEntity: mob });
      target.applyKnockback(dx / d, dz / d, 1.2, 0.25);
    } catch {}
  } else if (r === "shaman" || r === "cleric" || r === "cultist" || r === "queen") {
    safeSound(dim, "mob.evocation_illager.cast_spell", loc);
    const pBeam = r === "cleric" || r === "queen" ? "minecraft:totem_particle" : "minecraft:blue_flame_particle";
    spawnBeam(dim, loc, target.location, 12, pBeam, "minecraft:witchspell_emitter");
    try {
      target.applyDamage(5, { cause: "magic", damagingEntity: mob });
      if (r === "shaman" || r === "cultist") target.addEffect("weakness", 60, { amplifier: 0, showParticles: true });
    } catch {}
    // Heal & buff same-faction allies
    for (const ally of dim.getEntities({ location: loc, maxDistance: 12.0 })) {
      if (!excl.has(ally.typeId)) continue;
      try {
        const hp = ally.getComponent("minecraft:health");
        if (hp && hp.currentValue < hp.effectiveMax) hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + 8));
        if (r === "queen") ally.addEffect("speed", 80, { amplifier: 0, showParticles: true });
        spawnRing(dim, ally.location, 1.0, 8, "minecraft:totem_particle", 1.0);
      } catch {}
    }
  } else if (r === "nazgul" || r === "ghost" || r === "nightmare") {
    safeSound(dim, "mob.endermen.scream", loc);
    spawnRing(dim, loc, 4.0, 18, "minecraft:basic_smoke_particle", 1.0);
    spawnRing(dim, loc, 3.0, 14, "minecraft:blue_flame_particle", 0.7);
    for (const v of dim.getEntities({ location: loc, maxDistance: 5.5 })) {
      if (!isValidVictim(v, mob, excl)) continue;
      try {
        v.applyDamage(r === "nazgul" ? 9 : 6, { cause: "wither", damagingEntity: mob });
        v.addEffect("wither", 70, { amplifier: 0, showParticles: true });
        v.addEffect("blindness", 50, { amplifier: 0, showParticles: true });
      } catch {}
    }
  } else if (r === "undead_beast" || r === "beast" || r === "frost_brute" || r === "zombie") {
    safeSound(dim, r === "frost_brute" ? "random.glass" : "mob.polarbear.warning", loc);
    const pRing = r === "frost_brute" ? "minecraft:blue_flame_particle" : "minecraft:basic_smoke_particle";
    spawnRing(dim, loc, 3.5, 16, pRing, 0.6);
    for (const v of dim.getEntities({ location: loc, maxDistance: 4.8 })) {
      if (!isValidVictim(v, mob, excl)) continue;
      try {
        v.applyDamage(r === "zombie" ? 5 : 8, { cause: "entityAttack", damagingEntity: mob });
        if (r === "frost_brute") v.addEffect("slowness", 70, { amplifier: 2, showParticles: true });
        else if (r === "undead_beast") v.addEffect("wither", 60, { amplifier: 0, showParticles: true });
        else if (r === "zombie") v.addEffect("poison", 60, { amplifier: 0, showParticles: true });
      } catch {}
    }
  } else if (r === "chariot") {
    safeSound(dim, "mob.blaze.shoot", loc);
    spawnBeam(dim, loc, target.location, 14, "minecraft:blue_flame_particle", "minecraft:basic_flame_particle");
    try {
      target.applyDamage(7, { cause: "fire", damagingEntity: mob });
      try { target.setOnFire(4, true); } catch {}
    } catch {}
  } else if (r === "santa") {
    safeSound(dim, "random.explode", loc);
    spawnRing(dim, loc, 4.5, 20, "minecraft:blue_flame_particle", 0.9);
    spawnRing(dim, loc, 2.5, 14, "minecraft:totem_particle", 1.2);
    for (const v of dim.getEntities({ location: loc, maxDistance: 6.0 })) {
      if (!isValidVictim(v, mob, excl)) continue;
      try {
        v.applyDamage(8, { cause: "magic", damagingEntity: mob });
        v.addEffect("slowness", 70, { amplifier: 2, showParticles: true });
        const dx = v.location.x - loc.x, dz = v.location.z - loc.z;
        const d = Math.max(0.5, Math.hypot(dx, dz));
        v.applyKnockback(dx / d, dz / d, 1.3, 0.45);
      } catch {}
    }
  } else {
    // Standard melee power strike
    safeSound(dim, "mob.vindicator.celebrate", loc);
    try { target.applyDamage(6, { cause: "entityAttack", damagingEntity: mob }); } catch {}
  }
}

// Unified 8-tick lightweight ability scheduler for all 32 v5.0 mobs
const V50_IDS = Object.keys(V50_ROLES);
system.runInterval(() => {
  for (const dn of ["overworld", "nether", "the_end"]) {
    let dim;
    try { dim = world.getDimension(dn); } catch { continue; }
    for (const mId of V50_IDS) {
      let mobs;
      try { mobs = dim.getEntities({ type: mId }); } catch { continue; }
      if (!mobs || mobs.length === 0) continue;
      const cfg = V50_ROLES[mId];
      const excl = V50_FAM_SETS[cfg.fam];
      const isRanged = cfg.role === "shaman" || cfg.role === "cleric" || cfg.role === "cultist" || cfg.role === "queen" || cfg.role === "chariot";
      const maxR = isRanged ? 15.0 : (cfg.role === "leaper" || cfg.role === "charger" ? 11.0 : 5.5);
      for (const mob of mobs) {
        const st = getSt(mob, { abCd: 50 });
        st.abCd -= 8;
        if (st.abCd > 0) continue;
        let best = null, bd = 999;
        for (const c of dim.getEntities({ location: mob.location, maxDistance: maxR })) {
          if (!isValidVictim(c, mob, excl)) continue;
          const d = Math.hypot(c.location.x - mob.location.x, c.location.z - mob.location.z);
          if (d < bd) { bd = d; best = c; }
        }
        if (best) {
          runV50Ability(mob, best, bd, cfg, st);
          st.abCd = cfg.cd;
        } else {
          st.abCd = 24;
        }
      }
    }
  }
}, 8);
