// Полная реализация механик 10 персонажей «Myths of the Forgotten World»:
//  1. Минотавр (cb:minotaur, 220 HP, 1.8x3.2): Таран (20 урона, по прямой, ломает только блоки стен лабиринта),
//     Восстановление (оглушение на 3 с после тарана + кулдаун 5 с и свободное пространство), Ярость быка (<50% HP),
//     Кровавый удар (радиус 4 блока), Охотник во тьме (скорость 1.25 в темноте), Звериное чутьё.
//  2. Повелитель Скверны (cb:fel_lord, 380 HP, 2.5x4.5): Призыв легиона (2-3 демона), Зелёное пламя (10 урона + горящая зона),
//     Проклятие Скверны (5 с замедление и слабость), Демоническая аура, Поглощение Скверны (+25 HP у источников Скверны),
//     Вторая фаза (<30% HP: тело в зелёном пламени, быстрые атаки, защита демонам), слабость к священному свету/очищению.
//  3. Король-лич (cb:lich_king, 450 HP, 1.5x3.3): Поднятие мёртвых (до 3 мобов, уязвим во время призыва), Ледяная гробница (2 с во льду),
//     Ледяные шипы (12 урона), Призыв рыцарей смерти (2 элитных cb:death_knight), Морозная аура (радиус 6), Проклятый клинок (каждый 3-й удар),
//     После первого поражения превращается в Ледяную статую (cb:lich_statue) на 8 секунд, затем появляется Ледяной дух (cb:ice_spirit, 120 HP, 50% физ. резист).
//  4. Повелитель ужаса (cb:dreadlord, 320 HP, 2.0x3.5): Гипноз (3 с дезориентации), Призыв летучих мышей (5-7 шт), Армия кошмаров (2 скелета/зомби),
//     Туман (4 с неуязвимости, уязвим при выходе из тумана), Кровавый укус (+10 HP при ударе), Ночной ужас (усиление в темноте, слабость на солнце).
//  5. Зевс (cb:zeus, 600 HP): Гнев Зевса (22 урона молнией), Грозовой шторм, Небесный удар, Божественный щит (50% поглощения на 6 с), Повелитель неба, испытания и Благословение.
//  6. Посейдон (cb:poseidon, 580 HP): Цунами, Водоворот, Гнев океана, Призыв морских стражей (cb:poseidon_triton), Повелитель глубин, Трезубец морей, Благословение.
//  7. Аид (cb:hades, 650 HP): Цепи подземного мира, Призыв душ (до 5), Пламя Аида (14 урона), Поглощение души (+20 HP), Врата смерти, Тёмное измерение, сделки и Благословение.
//  8. Арес (cb:ares, 520 HP): Боевая ярость (<50% HP: +30% урона), Кровавый рывок копьём (20 урона), Удар щитом, Воинственный клич, Мастер оружия (копьё 15 / меч 18), Арена войны и оценка мастерства игрока.
//  9. Афина (cb:athena, 480 HP): Не атакует первой; Божественный щит (барьер 60 HP), Копьё мудрости (16 урона), Тактическое усиление, Призыв 3 гоплитов (cb:athena_hoplite), Отражение снарядов, Испытание разума и задания.
// 10. Гефест (cb:hephaestus, 550 HP): NPC-кузнец; Удар молота (20 урона + 12 огнём), Огненная кузница, Создание стражей (2-3 cb:hephaestus_golem), Закалка брони, Божественное ремесло (создаёт и улучшает легендарные предметы), Пробуждение кузницы.
import { world, system, EntityDamageCause, ItemStack } from "@minecraft/server";
import { DIMENSIONS, valid, alive, healthOf, isPlayer, inSurvival, fx, sound, playersNear, actionBar, bossName, shared, getDifficultyProfile, applyBossDifficultyHp, assignSummonCipher, sameSummonCipher } from "./util.js";

// Только специальные блоки стен лабиринта могут разрушаться тараном Минотавра (Правило 13: обычные блоки мира не ломаются без разрешения!)
const LABYRINTH_WALL_BLOCK = /stone_bricks|mossy_stone_bricks|cracked_stone_bricks|chiseled_stone_bricks|deepslate_bricks|cracked_deepslate_bricks|cobblestone_wall|spruce_fence|dark_oak_fence/;
const LIGHT_BLOCK = /torch|lantern|glowstone|sea_lantern|shroomlight|froglight|campfire|fire|lava|beacon|lit_/;
const FEL_SOURCE_BLOCK = /emerald_block|soul_fire|soul_lantern|soul_campfire|fire|crying_obsidian|netherrack|magma/;
const HOLY_OR_CLEANSING_ITEM = /golden_sword|golden_axe|totem|zeus_bolt|athena_shield|athena_aegis|hephaestus_hammer/;

const minotaurStates = new Map();
const bossStates = new Map();
const lichHitCount = new Map();
const tempBlocks = []; // [{ dimId, x, y, z, matchId, removeAt }]
const activeHypnosis = [];
const lichStatues = []; // [{ statueId, dimId, loc, spawnSpiritAt }]
const playerSkills = new Map(); // playerId -> combat score for Ares dynamic trial scaling
const athenaQuests = new Map();
const itemCooldowns = new Map();

const BOSS_BASE_HP = {
  "cb:minotaur": 260, "cb:fel_lord": 580, "cb:lich_king": 300, "cb:ice_spirit": 120,
  "cb:dreadlord": 220, "cb:zeus": 360, "cb:poseidon": 350, "cb:hades": 380,
  "cb:ares": 320, "cb:athena": 300, "cb:hephaestus": 340,
};

function getBossSt(id, now = system.currentTick) {
  let s = bossStates.get(id);
  if (!s) {
    s = {
      cd1: now + 24, cd2: now + 68, cd3: now + 116, cd4: now + 164, gcdUntil: 0,
      meleeCd: 0, lastMeleeHitTick: 0,
      phase2: false,
      mistUntil: 0, vulnerableUntil: 0,
      shieldUntil: 0, barrierHp: 0,
      summoningUntil: 0
    };
    bossStates.set(id, s);
  }
  return s;
}

function performCloseMeleeStrike(boss, target, s, now, dmg, reach = 3.5, cdTicks = 22) {
  if (!target || !valid(target) || !alive(target)) return false;
  const dx = target.location.x - boss.location.x;
  const dz = target.location.z - boss.location.z;
  const dist = Math.hypot(dx, dz) || 1;
  if (dist > reach || now < (s.meleeCd ?? 0) || now < (s.gcdUntil ?? 0)) return false;
  const effCd = shared.diffCd ? shared.diffCd(cdTicks) : cdTicks;
  const effDmg = shared.diffDmg ? shared.diffDmg(dmg) : dmg;
  s.meleeCd = now + effCd;
  s.gcdUntil = now + 14;
  setCastState(boss, 5, 14);
  if (now - (s.lastMeleeHitTick ?? 0) >= 16) {
    s.lastMeleeHitTick = now;
    try {
      target.applyDamage(effDmg, { cause: EntityDamageCause.entityAttack, damagingEntity: boss });
      target.applyKnockback(dx / dist, dz / dist, 0.85, 0.25);
    } catch {}
  }
  return true;
}

function setCastState(e, val, durationTicks = 24) {
  try {
    e.setProperty("cb:cast_state", val);
    system.runTimeout(() => {
      if (valid(e)) { try { e.setProperty("cb:cast_state", 0); } catch {} }
    }, durationTicks);
  } catch {}
}

function drawRing(dim, loc, r, count, particle, yOff = 0.3) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    fx(dim, particle, { x: loc.x + Math.cos(a) * r, y: loc.y + yOff, z: loc.z + Math.sin(a) * r });
  }
}

const NON_TARGET_ENTITIES = new Set([
  "minecraft:item", "minecraft:xp_orb", "minecraft:arrow", "minecraft:armor_stand",
  "minecraft:painting", "minecraft:splash_potion", "minecraft:lingering_potion",
  "cb:boulder", "cb:hydra_spit", "cb:hydra_neck", "cb:circe_orb", "cb:circe_bolt",
  "cb:fel_orb", "cb:fel_rain", "cb:sargeras_prompt", "cb:lich_statue",
  "cb:hex_chicken", "cb:hex_goat", "cb:hex_pig", "cb:hex_sheep", "cb:hex_horse"
]);

const COMBAT_BOSS_AND_MOB_IDS = new Set([
  "minecraft:warden", "minecraft:wither", "minecraft:ender_dragon", "minecraft:elder_guardian",
  "minecraft:iron_golem", "minecraft:ravager", "minecraft:vindicator", "minecraft:evoker", "minecraft:pillager",
  "cb:cyclops", "cb:hydra", "cb:hydra_head", "cb:circe", "cb:guldan", "cb:laestrygonian",
  "cb:orc", "cb:green_orc", "cb:hell_orc", "cb:fel_minion", "cb:inferno_golem",
  "cb:minotaur", "cb:fel_lord", "cb:lich_king", "cb:dreadlord",
  "cb:zeus", "cb:poseidon", "cb:hades", "cb:ares", "cb:athena", "cb:hephaestus",
  "cb:death_knight", "cb:ice_spirit", "cb:athena_hoplite", "cb:hephaestus_golem", "cb:poseidon_triton", "cb:zeus_archon", "cb:hades_shade", "cb:ares_berserker"
]);

const lastAttackerByBoss = new Map(); // bossId -> { attackerId, until }

function resolveBossTargetEntity(boss, e) {
  if (!e || !valid(e)) return undefined;
  if (e.typeId === "cb:hydra") {
    const head = shared.hydraHeadNear?.(e, boss.location);
    if (head && valid(head) && alive(head)) return head;
  }
  return e;
}

function isAlliedBossOrMinion(bossTypeId, other, selfEnt = undefined) {
  if (!other || !valid(other)) return false;
  if (selfEnt && sameSummonCipher(selfEnt, other)) return true;
  if (other.typeId === bossTypeId) return true;
  if (bossTypeId === "cb:fel_lord") return isFelFactionEntity(other);
  if (bossTypeId === "cb:lich_king" || bossTypeId === "cb:dreadlord" || bossTypeId === "cb:ice_spirit") {
    if (other.typeId === "cb:death_knight" || other.typeId === "cb:ice_spirit" || other.typeId === "cb:lich_king" || other.typeId === "cb:dreadlord") return true;
    try { if (other.getComponent("minecraft:type_family")?.hasTypeFamily?.("undead")) return true; } catch {}
    return false;
  }
  if (bossTypeId === "cb:hades") {
    try {
      if (other.typeId !== "cb:lich_king" && other.typeId !== "cb:dreadlord" && other.typeId !== "cb:ice_spirit" && other.getComponent("minecraft:type_family")?.hasTypeFamily?.("undead")) return true;
    } catch {}
  }
  if (bossTypeId === "cb:zeus" && other.typeId === "cb:zeus_archon") return true;
  if (bossTypeId === "cb:hades" && other.typeId === "cb:hades_shade") return true;
  if (bossTypeId === "cb:ares" && other.typeId === "cb:ares_berserker") return true;
  if ((bossTypeId === "cb:athena" || bossTypeId === "cb:hephaestus") && (other.typeId === "cb:athena" || other.typeId === "cb:hephaestus" || other.typeId === "cb:athena_hoplite" || other.typeId === "cb:hephaestus_golem" || other.typeId === "minecraft:iron_golem" || other.typeId === "minecraft:villager" || other.typeId === "minecraft:villager_v2" || other.typeId === "cb:human_villager" || other.typeId === "cb:human_civilian")) return true;
  if (bossTypeId === "cb:poseidon" && other.typeId === "cb:poseidon_triton") return true;
  return false;
}

function isCombatTargetCandidate(boss, e, peacefulToPlayer) {
  if (!e || !valid(e) || !alive(e) || e.id === boss.id) return false;
  if (NON_TARGET_ENTITIES.has(e.typeId)) return false;
  if (isAlliedBossOrMinion(boss.typeId, e)) return false;
  if (isPlayer(e)) {
    if (!inSurvival(e)) return false;
    if (peacefulToPlayer && !e.hasTag(`cb_foe_${boss.typeId}`)) return false;
    return true;
  }
  if (COMBAT_BOSS_AND_MOB_IDS.has(e.typeId)) return true;
  try {
    const tf = e.getComponent("minecraft:type_family");
    if (tf) {
      for (const fam of ["warden", "boss", "monster", "undead", "illager", "cyclops", "hydra", "hydra_head", "laestrygonian", "brown_orc", "green_orc", "hell_orc", "fel_orc"]) {
        if (tf.hasTypeFamily?.(fam)) return true;
      }
    }
  } catch {}
  return false;
}

// Все боссы в первую очередь атакуют Вардена (minecraft:warden), а также сражаются со всеми несоюзными боссами и мобами!
function findBossTarget(boss, maxD = 32, peacefulToPlayer = false) {
  let best, bestScore = Infinity;
  try {
    const ents = boss.dimension.getEntities({ location: boss.location, maxDistance: maxD });
    for (const e of ents) {
      if (!e || e.id === boss.id || !alive(e)) continue;
      if (e.typeId === "minecraft:warden") {
        const d = Math.hypot(e.location.x - boss.location.x, e.location.z - boss.location.z);
        const score = d - 45;
        if (score < bestScore) { bestScore = score; best = e; }
      }
    }
    if (best) return best;

    const laRec = lastAttackerByBoss.get(boss.id);
    if (laRec && system.currentTick < laRec.until) {
      const la = resolveBossTargetEntity(boss, world.getEntity(laRec.attackerId));
      if (la && valid(la) && alive(la) && !NON_TARGET_ENTITIES.has(la.typeId) && !isAlliedBossOrMinion(boss.typeId, la)) {
        if (!isPlayer(la) || inSurvival(la)) return la;
      }
    }

    const curT = resolveBossTargetEntity(boss, boss.target);
    if (curT && valid(curT) && alive(curT) && !NON_TARGET_ENTITIES.has(curT.typeId) && !isAlliedBossOrMinion(boss.typeId, curT)) {
      if (!isPlayer(curT) || inSurvival(curT)) return curT;
    }

    for (const rawE of ents) {
      if (!isCombatTargetCandidate(boss, rawE, peacefulToPlayer)) continue;
      const e = resolveBossTargetEntity(boss, rawE);
      if (!e || !valid(e) || !alive(e)) continue;
      const d = Math.hypot(e.location.x - boss.location.x, e.location.z - boss.location.z);
      let score = d;
      if (isPlayer(e)) score -= 4;
      else if (COMBAT_BOSS_AND_MOB_IDS.has(e.typeId)) score -= 3;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
  } catch {}
  return best;
}

function isInDarkness(dim, loc) {
  try {
    const tod = world.getTimeOfDay?.() ?? 6000;
    const isNight = tod >= 12500 && tod <= 23500;
    const bx = Math.floor(loc.x), by = Math.floor(loc.y), bz = Math.floor(loc.z);
    for (let dx = -4; dx <= 4; dx += 2) {
      for (let dz = -4; dz <= 4; dz += 2) {
        for (let dy = -1; dy <= 3; dy++) {
          const b = dim.getBlock({ x: bx + dx, y: by + dy, z: bz + dz });
          if (b && LIGHT_BLOCK.test(b.typeId)) return false;
        }
      }
    }
    if (isNight) return true;
    for (let dy = 2; dy <= 8; dy++) {
      const above = dim.getBlock({ x: bx, y: by + dy, z: bz });
      if (above && above.typeId !== "minecraft:air" && !/leaves|glass/.test(above.typeId)) return true;
    }
  } catch {}
  return false;
}

// ==============================================================================
// 1. МИНОТАВР (260 HP, секира 12, таран 15, захват рогами и бросок в стиле Циклопа,
//    Топот Лабиринта с подбрасыванием, Кровавый сплеш-удар R=4, Ярость быка <50% HP)
// ==============================================================================
const minotaurGrabs = new Map(); // minotaurId -> { victimId, t }

function tickMinotaur(m, now) {
  if (now % 20 === 0) bossName(m);
  const dim = m.dimension;
  const loc = m.location;
  let st = minotaurStates.get(m.id);
  if (!st) {
    st = {
      charging: false,
      runDist: 0,
      lastPos: { x: loc.x, z: loc.z },
      chargeDir: { x: 0, z: 1 },
      stunnedUntil: 0,
      chargeCooldownUntil: 0,
      bloodSlamReady: now + 45,
      grabCooldownUntil: now + 85,
      meleeCd: 0,
      lastMeleeHitTick: 0,
      gcdUntil: 0
    };
    minotaurStates.set(m.id, st);
  }

  const h = healthOf(m);
  const hp = h ? h.currentValue : 260;
  const maxHp = h ? h.effectiveMax : 260;

  const enraged = hp < maxHp * 0.5;
  try { if (m.getProperty("cb:enraged") !== enraged) m.setProperty("cb:enraged", enraged); } catch {}
  if (enraged && now % 20 === 0) {
    try { m.addEffect("haste", 40, { amplifier: 1, showParticles: false }); } catch {}
    try { m.addEffect("strength", 40, { amplifier: 0, showParticles: true }); } catch {}
  }

  if (isInDarkness(dim, loc) && now % 15 === 0 && now >= st.stunnedUntil) {
    try { m.addEffect("speed", 35, { amplifier: 1, showParticles: false }); } catch {}
  }

  // Активная сцена захвата в стиле Циклопа (поднимает жертву левой рукой к рогам и швыряет через 24 тика!)
  if (minotaurGrabs.has(m.id)) {
    const g = minotaurGrabs.get(m.id);
    g.t += 2;
    const v = world.getEntity(g.victimId);
    if (!v || !valid(v) || !alive(v) || g.t >= 26) {
      minotaurGrabs.delete(m.id);
      if (v && valid(v) && alive(v)) {
        const yaw = (m.getRotation?.().y ?? 0) * Math.PI / 180;
        const fxDir = -Math.sin(yaw), fzDir = Math.cos(yaw);
        try {
          v.applyDamage(shared.diffDmg(10), { cause: EntityDamageCause.entityAttack, damagingEntity: m });
          v.applyKnockback(fxDir, fzDir, 2.4, 0.85);
        } catch {}
        sound(dim, "mob.goat.ram_impact", v.location, 2.0, 0.75);
      }
      return;
    }
    const yaw = (m.getRotation?.().y ?? 0) * Math.PI / 180;
    const fxDir = -Math.sin(yaw), fzDir = Math.cos(yaw);
    const liftY = loc.y + 1.8 + Math.sin((g.t / 24) * Math.PI) * 1.1;
    try {
      v.teleport({ x: loc.x + fxDir * 1.8, y: liftY, z: loc.z + fzDir * 1.8 }, { keepVelocity: false });
      if (g.t === 12) {
        v.applyDamage(shared.diffDmg(5), { cause: EntityDamageCause.entityAttack, damagingEntity: m });
        sound(dim, "mob.ravager.bite", v.location, 1.8, 0.85);
        fx(dim, "minecraft:critical_hit_emitter", v.location);
      }
    } catch {}
    return;
  }

  if (now < st.stunnedUntil) {
    st.charging = false;
    st.runDist = 0;
    try { if (m.getProperty("cb:charging") !== false) m.setProperty("cb:charging", false); } catch {}
    try { if (m.getProperty("cb:cast_state") !== 4) m.setProperty("cb:cast_state", 4); } catch {}
    if (now % 10 === 0) fx(dim, "minecraft:villager_angry", { x: loc.x, y: loc.y + 3.0, z: loc.z });
    st.lastPos = { x: loc.x, z: loc.z };
    return;
  } else {
    try { if (m.getProperty("cb:cast_state") === 4) m.setProperty("cb:cast_state", 0); } catch {}
  }

  const target = findBossTarget(m, 28, false);
  if (!target) {
    st.charging = false;
    st.runDist = 0;
    try { if (m.getProperty("cb:charging") !== false) m.setProperty("cb:charging", false); } catch {}
    st.lastPos = { x: loc.x, z: loc.z };
    return;
  }

  const dx = target.location.x - loc.x;
  const dz = target.location.z - loc.z;
  const distToTarget = Math.hypot(dx, dz) || 1;

  // Захват рогами и бросок (в стиле Циклопа)
  if (!st.charging && distToTarget <= 3.4 && now >= st.grabCooldownUntil) {
    const th = healthOf(target);
    const grabLimit = getDifficultyProfile().minotaurGrabLimit;
    const canGrab = th && th.effectiveMax <= grabLimit && (th.currentValue <= th.effectiveMax * 0.65 || !isPlayer(target));
    if (canGrab) {
      st.grabCooldownUntil = now + 180;
      minotaurGrabs.set(m.id, { victimId: target.id, t: 0 });
      setCastState(m, 2, 26);
      sound(dim, "mob.ravager.roar", loc, 2.0, 0.85);
      if (isPlayer(target)) 
      return;
    }
  }

  // Топот Лабиринта и Кровавый удар секирой оземь (с левитацией в стиле Циклопа)
  if (!st.charging && distToTarget <= 4.2 && now >= st.bloodSlamReady) {
    st.bloodSlamReady = now + (enraged ? 85 : 130);
    setCastState(m, 3, 24);
    drawRing(dim, loc, 4.0, 22, "minecraft:large_explosion", 0.3);
    sound(dim, "random.explode", loc, 1.8, 0.85);
    try {
      for (const e of dim.getEntities({ location: loc, maxDistance: 4.2 })) {
        if (!e || e.id === m.id || !alive(e) || (isPlayer(e) && !inSurvival(e))) continue;
        const edx = e.location.x - loc.x, edz = e.location.z - loc.z, en = Math.hypot(edx, edz) || 1;
        e.applyDamage(shared.diffDmg(9), { cause: EntityDamageCause.entityAttack, damagingEntity: m });
        e.applyKnockback(edx / en, edz / en, 1.8, 0.55);
        try { e.addEffect("levitation", 16, { amplifier: 2, showParticles: false }); } catch {}
        try { e.addEffect("slowness", 60, { amplifier: 1, showParticles: true }); } catch {}
      }
    } catch {}
    return;
  }

  if (!st.charging && distToTarget <= 3.5) {
    performCloseMeleeStrike(m, target, st, now, enraged ? 13 : 10, 3.5, enraged ? 18 : 24);
  }

  const stepMoved = Math.hypot(loc.x - st.lastPos.x, loc.z - st.lastPos.z);
  st.lastPos = { x: loc.x, z: loc.z };

  if (!st.charging && now >= st.chargeCooldownUntil && distToTarget >= 5.0) {
    st.charging = true;
    st.runDist = 0;
    st.chargeDir = { x: dx / distToTarget, z: dz / distToTarget };
    try { m.setProperty("cb:charging", true); } catch {}
    sound(dim, "mob.ravager.roar", loc, 2.0, 0.8);
  }

  if (st.charging) {
    st.runDist += stepMoved;
    if (m.isOnGround !== false && now % 2 === 0) {
      try { m.applyImpulse({ x: st.chargeDir.x * 0.42, y: 0.03, z: st.chargeDir.z * 0.42 }); } catch {}
      fx(dim, "minecraft:crit_emitter", { x: loc.x, y: loc.y + 0.5, z: loc.z });
    }

    if (st.runDist >= 3.5) {
      const bx = Math.floor(loc.x + st.chargeDir.x * 1.5);
      const by = Math.floor(loc.y);
      const bz = Math.floor(loc.z + st.chargeDir.z * 1.5);
      let brokeWall = false;
      for (let ox = -1; ox <= 1; ox++) {
        for (let oz = -1; oz <= 1; oz++) {
          for (let dy = 0; dy <= 2; dy++) {
            let blk;
            try { blk = dim.getBlock({ x: bx + ox, y: by + dy, z: bz + oz }); } catch {}
            if (blk && LABYRINTH_WALL_BLOCK.test(blk.typeId)) {
              try {
                dim.runCommandAsync(`setblock ${bx + ox} ${by + dy} ${bz + oz} air destroy`);
                brokeWall = true;
              } catch {}
            }
          }
        }
      }
      if (brokeWall) {
        st.charging = false;
        st.runDist = 0;
        st.stunnedUntil = now + 60;
        st.chargeCooldownUntil = now + 160;
        try { m.setProperty("cb:charging", false); } catch {}
        setCastState(m, 2, 30);
        try { m.addEffect("slowness", 60, { amplifier: 4, showParticles: true }); } catch {}
        fx(dim, "minecraft:huge_explosion_emitter", { x: bx + 0.5, y: by + 1.2, z: bz + 0.5 });
        sound(dim, "mob.wither.break_block", { x: bx, y: by + 1, z: bz }, 2.0, 0.8);
        
        return;
      }
    }

    if (distToTarget <= 2.5 && st.runDist >= 2.0) {
      st.charging = false;
      st.runDist = 0;
      st.stunnedUntil = now + 60;
      st.chargeCooldownUntil = now + 160;
      try { m.setProperty("cb:charging", false); } catch {}
      try {
        target.applyDamage(shared.diffDmg(13), { cause: EntityDamageCause.entityAttack, damagingEntity: m });
        target.applyKnockback(st.chargeDir.x, st.chargeDir.z, 2.4, 0.6);
      } catch {}
      sound(dim, "mob.goat.ram_impact", target.location, 2.2, 0.75);
    } else if (st.runDist >= 16) {
      st.charging = false;
      st.runDist = 0;
      st.stunnedUntil = now + 60;
      st.chargeCooldownUntil = now + 160;
      try { m.setProperty("cb:charging", false); } catch {}
    }
  }
}

// Союзники Скверны (Гул'Дан, зелёные и красные орки, демоны Скверны и сам Маннорот) никогда не атакуют и не ранят друг друга!
function isFelFactionEntity(e) {
  if (!e) return false;
  const tid = e.typeId;
  if (tid === "cb:fel_lord" || tid === "cb:guldan" || tid === "cb:green_orc" || tid === "cb:hell_orc" || tid === "cb:fel_minion") return true;
  if (tid === "cb:inferno_golem") {
    try { return e.getProperty("cb:golem_type") !== 2 && !e.hasTag("cb_player_golem"); } catch { return true; }
  }
  try { if (e.getProperty("cb:slave") === true || e.hasTag("cb_orc_slave")) return true; } catch {}
  return false;
}

const activeFelZones = [];   // [{ dimId, loc, radius, until, ownerId }]
const bloodCursedMobs = new Map(); // entityId -> { bossId, until, nextTick }

// ==============================================================================
// 2. ПОВЕЛИТЕЛЬ СКВЕРНЫ / МАННОРОТ (cb:fel_lord)
//    - 850 HP, Урон оружием 22 (+20% во 2 фазе), Урон кулаком 16, Пламя Скверны 18 (R=4, 4 с горения, КД 7 с),
//      Демонический таран 25 (разрушает укрепления, оглушение 2 с после атаки, КД 12 с),
//      Кровавое проклятие (10 с, 3 HP каждые 2 с, замедление, +10 HP Маннороту при смерти моба, КД 18 с),
//      Призыв демонической армии (2 демонических воина + 1 демонический страж, КД 25 с),
//      Крылья Разрушителя (раскрывает крылья, воздушный удар 12 HP в R=6 + отбрасывание + подскок, КД 15 с, НЕ летает!).
//    - 3 фазы: 100–60% Генерал Легиона | 60–25% Ярость Разрушителя | 25–0% Аватар Скверны
// ==============================================================================
function tickFelLord(e, now) {
  if (now % 20 === 0) bossName(e);
  const dim = e.dimension;
  const loc = e.location;
  const s = getBossSt(e.id);
  if (s.felInitialized !== true) {
    s.felInitialized = true;
    s.flameCd = now + 80;       // 1. Пламя Скверны (КД 7 с = 140 тиков)
    s.chargeCd = now + 120;     // 2. Демонический таран (КД 12 с = 240 тиков)
    s.wingsCd = now + 160;      // 3. Крылья Разрушителя (КД 15 с = 300 тиков)
    s.curseCd = now + 200;      // 4. Кровавое проклятие (КД 18 с = 360 тиков)
    s.armyCd = now + 260;       // 5. Призыв демонической армии (КД 25 с = 500 тиков)
    s.fistCd = now + 40;
    s.charging = false;
    s.chargeSteps = 0;
    s.chargeDir = { x: 0, z: 1 };
    s.stunnedUntil = 0;
    s.phase = 1;
  }

  // Обработка горящих зон Пламени Скверны (4 секунды)
  for (let i = activeFelZones.length - 1; i >= 0; i--) {
    const z = activeFelZones[i];
    if (now >= z.until) { activeFelZones.splice(i, 1); continue; }
    if (z.dimId === dim.id && now % 10 === 0) {
      drawRing(dim, z.loc, z.radius, 16, "cb:fel_green_flame", 0.25);
      if (now % 20 === 0) {
        try {
          for (const m of dim.getEntities({ location: z.loc, maxDistance: z.radius })) {
            if (!m || !alive(m) || isFelFactionEntity(m) || (isPlayer(m) && !inSurvival(m))) continue;
            m.applyDamage(4, { cause: EntityDamageCause.fire, damagingEntity: e });
            m.setOnFire(3, true);
          }
        } catch {}
      }
    }
  }

  // Обработка Кровавого проклятия (10 секунд, 3 HP каждые 2 секунды + замедление)
  for (const [cid, cinfo] of bloodCursedMobs.entries()) {
    if (now >= cinfo.until) { bloodCursedMobs.delete(cid); continue; }
    if (now >= cinfo.nextTick) {
      cinfo.nextTick = now + 40; // каждые 2 секунды (40 тиков)
      let victim;
      try { victim = world.getEntity(cid); } catch {}
      if (victim && alive(victim)) {
        try {
          victim.applyDamage(3, { cause: EntityDamageCause.magic, damagingEntity: e });
          victim.addEffect("slowness", 45, { amplifier: 1, showParticles: true });
          fx(victim.dimension, "minecraft:villager_angry", { x: victim.location.x, y: victim.location.y + 1.2, z: victim.location.z });
        } catch {}
      } else {
        bloodCursedMobs.delete(cid);
      }
    }
  }

  const h = healthOf(e);
  const hp = h ? h.currentValue : 850;
  const maxHp = h ? h.effectiveMax : 850;
  const hpPct = hp / Math.max(1, maxHp);

  // Определение текущей фазы боя (100-60% -> Фаза 1, 60-25% -> Фаза 2, 25-0% -> Фаза 3)
  let newPhase = 1;
  if (hpPct <= 0.25) newPhase = 3;
  else if (hpPct <= 0.60) newPhase = 2;

  if (newPhase > s.phase) {
    s.phase = newPhase;
    try { e.setProperty("cb:phase", newPhase); } catch {}
    try { e.setProperty("cb:enraged", newPhase >= 2); } catch {}
    if (newPhase === 2) {
      sound(dim, "mob.enderdragon.growl", loc, 2.4, 0.7);
      drawRing(dim, loc, 4.5, 24, "cb:fel_green_flame", 1.2);
      for (const p of playersNear(dim, loc, 32)) {
        actionBar(p, "§2Маннорот: Фаза 2");
      }
    } else if (newPhase === 3) {
      // 25–0% HP — Аватар Скверны: мощная волна демонической энергии!
      setCastState(e, 3, 25);
      sound(dim, "mob.wither.spawn", loc, 2.5, 0.75);
      drawRing(dim, loc, 7.0, 32, "cb:fel_green_flame", 1.0);
      fx(dim, "minecraft:huge_explosion_emitter", { x: loc.x, y: loc.y + 2.0, z: loc.z });
      try {
        for (const m of dim.getEntities({ location: loc, maxDistance: 7.0 })) {
          if (!m || !alive(m) || isFelFactionEntity(m) || (isPlayer(m) && !inSurvival(m))) continue;
          const dx = m.location.x - loc.x, dz = m.location.z - loc.z, n = Math.hypot(dx, dz) || 1;
          m.applyDamage(14, { cause: EntityDamageCause.magic, damagingEntity: e });
          m.applyKnockback(dx / n, dz / n, 2.4, 0.55);
          m.addEffect("wither", 80, { amplifier: 1, showParticles: true });
        }
      } catch {}
      for (const p of playersNear(dim, loc, 32)) {
        actionBar(p, "§2Маннорот: Фаза 3");
      }
    }
  }

  // Эффекты фаз (Фаза 2: свечение глаз и рогов +20% урона; Фаза 3: +15% скорости и аура Скверны)
  if (s.phase >= 2 && now % 10 === 0) {
    fx(dim, "cb:fel_green_flame", { x: loc.x, y: loc.y + 4.2, z: loc.z });
  }
  if (s.phase === 3 && now % 20 === 0) {
    try { e.addEffect("speed", 35, { amplifier: 0, showParticles: false }); } catch {}
    drawRing(dim, loc, 3.2, 12, "cb:fel_green_flame", 0.5);
  }

  // Коэффициент ускорения перезарядок во 2 и 3 фазе (на 20% быстрее)
  const cdMul = s.phase >= 2 ? 0.80 : 1.0;

  // Оглушение на 2 секунды (40 тиков) после Демонического тарана!
  if (now < s.stunnedUntil) {
    s.charging = false;
    try { if (e.getProperty("cb:charging") !== false) e.setProperty("cb:charging", false); } catch {}
    try { if (e.getProperty("cb:cast_state") !== 4) e.setProperty("cb:cast_state", 4); } catch {}
    if (now % 10 === 0) fx(dim, "minecraft:villager_angry", { x: loc.x, y: loc.y + 4.5, z: loc.z });
    return;
  } else {
    try { if (e.getProperty("cb:cast_state") === 4) e.setProperty("cb:cast_state", 0); } catch {}
  }

  // Поиск цели (Варден -> Игрок -> Враждебные мобы, НО НИКОГДА не Гул'Дан и не зелёные/красные орки!)
  let target = findBossTarget(e, 32, false);
  if (target && isFelFactionEntity(target)) target = undefined;
  if (!target) {
    try {
      for (const m of dim.getEntities({ location: loc, maxDistance: 32 })) {
        if (!m || m.id === e.id || !alive(m) || isFelFactionEntity(m)) continue;
        if (m.typeId === "cb:orc" || m.typeId === "cb:cyclops" || m.typeId === "cb:hydra" || m.typeId === "minecraft:iron_golem") {
          target = m; break;
        }
      }
    } catch {}
  }
  if (now % 10 === 0) {
    shared.commandFelLegion?.(e, target, now);
  }
  if (!target) {
    if (s.charging) {
      s.charging = false;
      try { e.setProperty("cb:charging", false); } catch {}
    }
    return;
  }

  const dx = target.location.x - loc.x;
  const dz = target.location.z - loc.z;
  const dist = Math.hypot(dx, dz) || 1;

  // Выполнение активного Демонического тарана (по прямой, 25 урона, ломает укрепления, затем 2 с оглушения)
  if (s.charging) {
    s.chargeSteps++;
    if (e.isOnGround !== false && now % 2 === 0) {
      try { e.applyImpulse({ x: s.chargeDir.x * 0.52, y: 0.04, z: s.chargeDir.z * 0.52 }); } catch {}
      fx(dim, "cb:fel_green_flame", { x: loc.x, y: loc.y + 0.6, z: loc.z });
    }
    // Разрушает специальные укрепления на пути тарана
    const bx = Math.floor(loc.x + s.chargeDir.x * 2.2);
    const by = Math.floor(loc.y);
    const bz = Math.floor(loc.z + s.chargeDir.z * 2.2);
    for (let ox = -1; ox <= 1; ox++) {
      for (let oz = -1; oz <= 1; oz++) {
        for (let dy = 0; dy <= 3; dy++) {
          let blk;
          try { blk = dim.getBlock({ x: bx + ox, y: by + dy, z: bz + oz }); } catch {}
          if (blk && LABYRINTH_WALL_BLOCK.test(blk.typeId)) {
            try { dim.runCommandAsync(`setblock ${bx + ox} ${by + dy} ${bz + oz} air destroy`); } catch {}
          }
        }
      }
    }
    if (dist <= 3.4) {
      s.charging = false;
      s.stunnedUntil = now + 40; // Оглушается на 2 секунды (40 тиков) после атаки!
      try { e.setProperty("cb:charging", false); } catch {}
      try {
        target.applyDamage(16, { cause: EntityDamageCause.entityAttack, damagingEntity: e });
        target.applyKnockback(s.chargeDir.x, s.chargeDir.z, 3.0, 0.65);
        if (s.phase === 3) target.addEffect("wither", 60, { amplifier: 1, showParticles: true });
      } catch {}
      sound(dim, "mob.ravager.roar", target.location, 2.2, 0.7);
      fx(dim, "minecraft:huge_explosion_emitter", target.location);
      
      return;
    } else if (s.chargeSteps >= 16) {
      s.charging = false;
      s.stunnedUntil = now + 40; // 2 секунды оглушения после промаха тараном!
      try { e.setProperty("cb:charging", false); } catch {}
      return;
    }
    return;
  }

  // Удар кулаком (16 HP) в ближнем бою + дополнительный урон оружием во 2/3 фазе
  if (dist <= 4.4 && now >= s.fistCd) {
    s.fistCd = now + 44;
    setCastState(e, 5, 20);
    try {
      target.applyDamage(12, { cause: EntityDamageCause.entityAttack, damagingEntity: e });
      target.applyKnockback(dx / dist, dz / dist, 1.4, 0.35);
      if (s.phase === 3) {
        target.setOnFire(3, true);
        target.addEffect("wither", 60, { amplifier: 0, showParticles: true });
      }
    } catch {}
    sound(dim, "mob.irongolem.hit", loc, 1.8, 0.75);
  }

  // 2. Демонический таран (КД 12 с = 240 тиков, дистанция 5..22 блоков)
  if (dist >= 5.0 && dist <= 22.0 && now >= s.chargeCd) {
    s.chargeCd = now + Math.round(240 * cdMul);
    s.charging = true;
    s.chargeSteps = 0;
    s.chargeDir = { x: dx / dist, z: dz / dist };
    try { e.setProperty("cb:charging", true); } catch {}
    sound(dim, "mob.ravager.roar", loc, 2.4, 0.65);
    return;
  }

  // 3. Крылья Разрушителя (раскрывает крылья, воздушный удар 12 HP в радиусе 6 блоков + отбрасывание + краткий подскок, КД 15 с = 300 тиков)
  if (dist <= 6.5 && now >= s.wingsCd) {
    s.wingsCd = now + Math.round(300 * cdMul);
    setCastState(e, 3, 22);
    // Кратковременно поднимает Маннорота в воздух (он НЕ летает!)
    try { e.applyImpulse({ x: 0, y: 0.55, z: 0 }); } catch {}
    drawRing(dim, loc, 6.0, 28, "minecraft:explosion_particle", 0.6);
    drawRing(dim, loc, 4.0, 20, "cb:fel_green_flame", 0.8);
    sound(dim, "mob.enderdragon.flap", loc, 2.5, 0.7);
    try {
      for (const m of dim.getEntities({ location: loc, maxDistance: 6.0 })) {
        if (!m || m.id === e.id || !alive(m) || isFelFactionEntity(m) || (isPlayer(m) && !inSurvival(m))) continue;
        const mdx = m.location.x - loc.x, mdz = m.location.z - loc.z, mn = Math.hypot(mdx, mdz) || 1;
        m.applyDamage(12, { cause: EntityDamageCause.entityAttack, damagingEntity: e });
        m.applyKnockback(mdx / mn, mdz / mn, 2.8, 0.65);
      }
    } catch {}
    
    return;
  }

  // 1. Пламя Скверны (огромный зелёный огненный снаряд, 18 HP, радиус взрыва 4 блока, горящая область на 4 с, КД 7 с = 140 тиков)
  if (dist <= 26.0 && now >= s.flameCd) {
    s.flameCd = now + Math.round(140 * cdMul);
    setCastState(e, 2, 18);
    const hitLoc = { x: target.location.x, y: target.location.y, z: target.location.z };
    // Визуальная трасса огромного снаряда Скверны от руки Маннорота к цели
    for (let step = 1; step <= 8; step++) {
      const t = step / 8;
      fx(dim, "cb:fel_green_flame", {
        x: loc.x + (hitLoc.x - loc.x) * t,
        y: loc.y + 3.2 + (hitLoc.y + 0.8 - (loc.y + 3.2)) * t,
        z: loc.z + (hitLoc.z - loc.z) * t,
      });
    }
    drawRing(dim, hitLoc, 4.0, 24, "cb:fel_green_flame", 0.35);
    fx(dim, "minecraft:large_explosion", { x: hitLoc.x, y: hitLoc.y + 0.6, z: hitLoc.z });
    sound(dim, "mob.ghast.fireball", loc, 2.2, 0.7);
    sound(dim, "random.explode", hitLoc, 2.0, 0.85);
    try {
      for (const m of dim.getEntities({ location: hitLoc, maxDistance: 4.0 })) {
        if (!m || !alive(m) || isFelFactionEntity(m) || (isPlayer(m) && !inSurvival(m))) continue;
        m.applyDamage(12, { cause: EntityDamageCause.fire, damagingEntity: e });
        m.setOnFire(4, true);
        if (s.phase === 3) m.addEffect("wither", 60, { amplifier: 1, showParticles: true });
      }
    } catch {}
    // Оставляет горящую область радиусом 4 блока на 4 секунды (80 тиков)
    activeFelZones.push({ dimId: dim.id, loc: hitLoc, radius: 4.0, until: now + 80, ownerId: e.id });
    return;
  }

  // 4. Кровавое проклятие (длительность 10 с = 200 тиков, 3 HP каждые 2 с, снижает скорость, +10 HP при смерти моба, КД 18 с = 360 тиков)
  if (dist <= 20.0 && now >= s.curseCd) {
    s.curseCd = now + Math.round(360 * cdMul);
    setCastState(e, 2, 18);
    bloodCursedMobs.set(target.id, { bossId: e.id, until: now + 200, nextTick: now + 40 });
    try {
      target.addEffect("slowness", 200, { amplifier: 1, showParticles: true });
      drawRing(dim, target.location, 2.0, 16, "minecraft:villager_angry", 0.5);
    } catch {}
    sound(dim, "mob.evocation_illager.cast_spell", target.location, 2.0, 0.75);
    
    return;
  }

  // 5. Призыв демонической армии (2 демонических воина cb:fel_minion + 1 демонический страж cb:inferno_golem, КД 25 с = 500 тиков)
  if (now >= s.armyCd) {
    s.armyCd = now + Math.round(500 * cdMul);
    let activeDemons = 0;
    try {
      for (const m of dim.getEntities({ location: loc, maxDistance: 32 })) {
        if (m && alive(m) && (m.typeId === "cb:fel_minion" || (m.typeId === "cb:inferno_golem" && !m.hasTag("cb_player_golem")))) {
          activeDemons++;
        }
      }
    } catch {}
    if (activeDemons < 4) {
      setCastState(e, 1, 24);
      sound(dim, "mob.wither.spawn", loc, 1.9, 0.85);
      // 2 демонических воина
      for (let i = 0; i < 2; i++) {
        const ang = (i / 2) * Math.PI * 2 + Math.random();
        const sx = loc.x + Math.cos(ang) * 3.5;
        const sz = loc.z + Math.sin(ang) * 3.5;
        try {
          const w = dim.spawnEntity("cb:fel_minion", { x: sx, y: loc.y, z: sz });
          w.nameTag = "";
          fx(dim, "cb:fel_green_flame", { x: sx, y: loc.y + 0.8, z: sz });
        } catch {}
      }
      // 1 демонический страж
      try {
        const gx = loc.x + (dx / dist) * 3.0;
        const gz = loc.z + (dz / dist) * 3.0;
        const g = dim.spawnEntity("cb:inferno_golem", { x: gx, y: loc.y, z: gz });
        
        fx(dim, "cb:fel_green_flame", { x: gx, y: loc.y + 1.2, z: gz });
      } catch {}
      for (const p of playersNear(dim, loc, 28)) {
        actionBar(p, "§2Маннорот призвал демоническую армию (2 воина и 1 демонического стража)!");
      }
    }
  }
}

// ==============================================================================
// 3. КОРОЛЬ-ЛИЧ (450 HP, меч 16, ледяные шипы 12, ледяная гробница 2 с, статуя 8 с -> Ледяной дух 120 HP с 50% физ. резистом)
// ==============================================================================
function spawnIceSpikes(dim, fromLoc, toLoc, boss, now) {
  const dx = toLoc.x - fromLoc.x, dz = toLoc.z - fromLoc.z;
  const L = Math.hypot(dx, dz) || 1;
  const ux = dx / L, uz = dz / L;
  const count = Math.min(7, Math.max(4, Math.floor(L)));
  for (let i = 2; i <= count + 1; i++) {
    const sx = Math.floor(fromLoc.x + ux * i * 1.4);
    const sy = Math.floor(fromLoc.y);
    const sz = Math.floor(fromLoc.z + uz * i * 1.4);
    try {
      for (let h = 0; h <= 1; h++) {
        const b = dim.getBlock({ x: sx, y: sy + h, z: sz });
        if (!b || b.typeId === "minecraft:air") {
          dim.runCommandAsync(`setblock ${sx} ${sy + h} ${sz} packed_ice`);
          tempBlocks.push({ dimId: String(dim.id).replace("minecraft:", ""), x: sx, y: sy + h, z: sz, matchId: "minecraft:packed_ice", removeAt: now + 80 });
        }
      }
      fx(dim, "minecraft:snowflake_particle", { x: sx + 0.5, y: sy + 1.5, z: sz + 0.5 });
    } catch {}
  }
  sound(dim, "random.glass", toLoc, 1.8, 0.65);
  try {
    for (const m of dim.getEntities({ location: toLoc, maxDistance: 3.2 })) {
      if (!m || m.id === boss.id || m.typeId === "cb:death_knight" || !alive(m) || (isPlayer(m) && !inSurvival(m))) continue;
      m.applyDamage(shared.diffDmg(12), { cause: EntityDamageCause.magic, damagingEntity: boss });
      m.addEffect("slowness", 80, { amplifier: 2, showParticles: true });
    }
  } catch {}
}

function tickLichKing(e, now) {
  if (now % 20 === 0) bossName(e);
  const dim = e.dimension;
  const loc = e.location;
  const s = getBossSt(e.id, now);

  // 5. Морозная аура: замедляет врагов в радиусе 6 блоков
  if (now % 20 === 0) {
    drawRing(dim, loc, 6.0, 18, "minecraft:snowflake_particle", 0.3);
    try {
      for (const m of dim.getEntities({ location: loc, maxDistance: 6.0 })) {
        if (!m || m.id === e.id || isAlliedBossOrMinion(e.typeId, m) || m.hasTag?.("cb_lich_risen") || !alive(m)) continue;
        if (isPlayer(m) && !inSurvival(m)) continue;
        m.addEffect("slowness", 40, { amplifier: 1, showParticles: true });
      }
    } catch {}
  }

  const target = findBossTarget(e, 32, false);
  if (!target) return;

  if (performCloseMeleeStrike(e, target, s, now, 11, 3.4, 22)) return;
  if (now < s.gcdUntil) return;

  // 3. Ледяные шипы (12 урона)
  if (now >= s.cd1) {
    s.cd1 = now + 110;
    s.gcdUntil = now + 26;
    setCastState(e, 1, 22);
    spawnIceSpikes(dim, loc, target.location, e, now);
    return;
  }

  // 2. Ледяная гробница: заключает игрока в лёд на 2 секунды (40 тиков)
  if (isPlayer(target) && now >= s.cd2) {
    s.cd2 = now + 220;
    s.gcdUntil = now + 26;
    setCastState(e, 2, 22);
    const px = Math.floor(target.location.x), py = Math.floor(target.location.y), pz = Math.floor(target.location.z);
    try {
      target.addEffect("slowness", 40, { amplifier: 6, showParticles: true });
      for (const [ox, dy, oz] of [[-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1], [-1, 1, 0], [1, 1, 0], [0, 1, -1], [0, 1, 1], [0, 2, 0]]) {
        const b = dim.getBlock({ x: px + ox, y: py + dy, z: pz + oz });
        if (!b || b.typeId === "minecraft:air") {
          dim.runCommandAsync(`setblock ${px + ox} ${py + dy} ${pz + oz} ice`);
          tempBlocks.push({ dimId: String(dim.id).replace("minecraft:", ""), x: px + ox, y: py + dy, z: pz + oz, matchId: "minecraft:ice", removeAt: now + 40 });
        }
      }
    } catch {}
    sound(dim, "random.glass", target.location, 1.8, 0.8);
    actionBar(target, "§bЛедяная гробница!");
    return;
  }

  // 4. Призыв рыцарей смерти (до 2 элитных рыцарей смерти)
  if (now >= s.cd3) {
    s.cd3 = now + 280;
    s.summoningUntil = now + 40;
    s.gcdUntil = now + 36;
    setCastState(e, 2, 32);
    let dks = [];
    try { dks = dim.getEntities({ location: loc, maxDistance: 28, type: "cb:death_knight" }); } catch {}
    for (let i = 0; i < 2 && dks.length + i < 2; i++) {
      const ox = i === 0 ? -2.2 : 2.2;
      const sl = { x: loc.x + ox, y: loc.y + 0.2, z: loc.z };
      drawRing(dim, sl, 1.2, 10, "minecraft:snowflake_particle", 0.3);
      try {
        const dk = dim.spawnEntity("cb:death_knight", sl);
        assignSummonCipher(dk, e);
        
      } catch {}
    }
    sound(dim, "mob.wither.spawn", loc, 0.9, 1.3);
  }
}

function tickIceSpirit(e, now) {
  if (now % 20 === 0) bossName(e);
  const dim = e.dimension;
  const loc = e.location;
  const s = getBossSt(e.id, now);
  if (now % 5 === 0) {
    fx(dim, "minecraft:snowflake_particle", { x: loc.x + (Math.random() - 0.5) * 1.4, y: loc.y + 0.8 + Math.random() * 1.4, z: loc.z + (Math.random() - 0.5) * 1.4 });
  }
  const target = findBossTarget(e, 30, false);
  if (!target) return;
  if (performCloseMeleeStrike(e, target, s, now, 8, 3.2, 22)) return;
  if (now >= s.cd1) {
    s.cd1 = now + 85;
    spawnIceSpikes(dim, loc, target.location, e, now);
  }
}

function tickDreadlord(e, now) {
  if (now % 20 === 0) bossName(e);
  const dim = e.dimension;
  const loc = e.location;
  const s = getBossSt(e.id, now);

  if (now % 20 === 0) {
    const dark = isInDarkness(dim, loc);
    if (dark) {
      try {
        e.addEffect("speed", 40, { amplifier: 0, showParticles: false });
        e.addEffect("strength", 40, { amplifier: 0, showParticles: false });
      } catch {}
    } else {
      try { e.addEffect("weakness", 40, { amplifier: 0, showParticles: false }); } catch {}
    }
  }

  if (now < s.mistUntil) {
    if (now % 4 === 0) {
      fx(dim, "minecraft:large_smoke", { x: loc.x + (Math.random() - 0.5) * 1.6, y: loc.y + 0.8 + Math.random(), z: loc.z + (Math.random() - 0.5) * 1.6 });
      fx(dim, "minecraft:witchspell_emitter", { x: loc.x, y: loc.y + 1.0, z: loc.z });
    }
    return;
  } else {
    try {
      if (e.getProperty("cb:mist") === true) {
        e.setProperty("cb:mist", false);
        s.vulnerableUntil = now + 40;
      }
    } catch {}
  }

  const target = findBossTarget(e, 32, false);
  if (!target) return;

  if (performCloseMeleeStrike(e, target, s, now, 9, 3.3, 20)) return;
  if (now < s.gcdUntil) return;

  // 1. Гипноз / Проклятие сна (9 магического урона + дезориентация)
  if (now >= s.cd1) {
    s.cd1 = now + 150;
    s.gcdUntil = now + 24;
    setCastState(e, 2, 22);
    try {
      target.applyDamage(shared.diffDmg(9), { cause: EntityDamageCause.magic, damagingEntity: e });
      target.addEffect("blindness", 60, { amplifier: 0, showParticles: true });
      target.addEffect("slowness", 60, { amplifier: 2, showParticles: true });
      if (isPlayer(target)) target.addEffect("nausea", 80, { amplifier: 0, showParticles: true });
    } catch {}
    if (isPlayer(target)) {
      activeHypnosis.push({ playerId: target.id, bossId: e.id, until: now + 60 });
      actionBar(target, "§5Гипноз!");
    }
    sound(dim, "mob.phantom.bite", target.location, 1.6, 0.7);
    return;
  }

  // 2. Призыв летучих мышей (редко: раз в 28 секунд, максимум 3 мыши) & Армия кошмаров
  if (now >= s.cd2) {
    s.cd2 = now + (shared.diffCd ? shared.diffCd(560) : 560);
    s.gcdUntil = now + 26;
    setCastState(e, 1, 22);
    let bats = [];
    try { bats = dim.getEntities({ location: loc, maxDistance: 24, type: "minecraft:bat" }); } catch {}
    for (let i = 0; i < 2 && bats.length + i < 3; i++) {
      try { dim.spawnEntity("minecraft:bat", { x: loc.x + (Math.random() - 0.5) * 3, y: loc.y + 1.8, z: loc.z + (Math.random() - 0.5) * 3 }); } catch {}
    }
    let nightmares = [];
    try { nightmares = dim.getEntities({ location: loc, maxDistance: 24, tags: ["cb_dread_minion"] }); } catch {}
    for (let i = 0; i < 2 && nightmares.length + i < 3; i++) {
      const mType = i % 2 === 0 ? "minecraft:skeleton" : "minecraft:zombie";
      try {
        const u = dim.spawnEntity(mType, { x: loc.x + (i === 0 ? -2 : 2), y: loc.y, z: loc.z });
        assignSummonCipher(u, e);
        u.addTag("cb_dread_minion");
        
      } catch {}
    }
    sound(dim, "mob.bat.takeoff", loc, 2.0, 0.8);
    return;
  }

  // 4. Превращение в туман: только при здоровье < 75% и редко (раз в 32 секунды на 2.5 секунды)
  const dlH = healthOf(e);
  const canMist = !dlH || dlH.currentValue < dlH.effectiveMax * 0.75;
  if (canMist && now >= s.cd3) {
    s.cd3 = now + (shared.diffCd ? shared.diffCd(640) : 640);
    s.mistUntil = now + 50;
    s.gcdUntil = now + 54;
    setCastState(e, 3, 50);
    try {
      e.setProperty("cb:mist", true);
      e.addEffect("invisibility", 50, { amplifier: 0, showParticles: false });
      e.addEffect("resistance", 50, { amplifier: 3, showParticles: false });
      e.addEffect("speed", 50, { amplifier: 1, showParticles: false });
    } catch {}
    drawRing(dim, loc, 2.0, 14, "minecraft:large_smoke", 0.5);
    sound(dim, "mob.phantom.swoop", loc, 1.8, 0.75);
  }
}

function tickZeus(e, now) {
  if (now % 20 === 0) bossName(e);
  const dim = e.dimension;
  const loc = e.location;
  const s = getBossSt(e.id, now);
  const target = findBossTarget(e, 34, false);
  if (!target) return;

  if (performCloseMeleeStrike(e, target, s, now, 11, 3.5, 22)) return;
  if (now < s.gcdUntil) return;

  // 1. Гнев Зевса (молния + Небесный удар)
  if (now >= s.cd1) {
    s.cd1 = now + 95;
    s.gcdUntil = now + 24;
    setCastState(e, 1, 22);
    try {
      dim.spawnEntity("minecraft:lightning_bolt", target.location);
      target.applyDamage(shared.diffDmg(16), { cause: EntityDamageCause.lightning, damagingEntity: e });
      drawRing(dim, target.location, 3.5, 18, "minecraft:totem_particle", 0.4);
      for (const m of dim.getEntities({ location: target.location, maxDistance: 3.5 })) {
        if (!m || m.id === e.id || !alive(m)) continue;
        const dx = m.location.x - target.location.x, dz = m.location.z - target.location.z, n = Math.hypot(dx, dz) || 1;
        m.applyKnockback(dx / n, dz / n, 1.8, 0.5);
      }
    } catch {}
    sound(dim, "ambient.weather.thunder", loc, 2.5, 1.0);
    return;
  }

  // 2. Грозовой шторм
  if (now >= s.cd2) {
    s.cd2 = now + 220;
    s.gcdUntil = now + 26;
    setCastState(e, 2, 24);
    try { dim.runCommandAsync("weather thunder"); } catch {}
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2 + Math.random();
      const lx = loc.x + Math.cos(ang) * 6, lz = loc.z + Math.sin(ang) * 6;
      try { dim.spawnEntity("minecraft:lightning_bolt", { x: lx, y: loc.y, z: lz }); } catch {}
    }
    return;
  }

  // 2b. Призыв Грозовых Архонтов Зевса (cb:zeus_archon, лимит <= 2)
  if (now - s.lastSpec2 >= 360) {
    let archons = [];
    try { archons = dim.getEntities({ location: loc, maxDistance: 28, type: "cb:zeus_archon" }); } catch {}
    if (archons.length < 2) {
      s.lastSpec2 = now;
      for (let i = 0; i < 2 && archons.length + i < 2; i++) {
        try {
          const ar = dim.spawnEntity("cb:zeus_archon", { x: loc.x + (i === 0 ? -2.5 : 2.5), y: loc.y + 0.5, z: loc.z });
          assignSummonCipher(ar, e);
          fx(dim, "minecraft:totem_particle", ar.location);
        } catch {}
      }
      sound(dim, "ambient.weather.thunder", loc, 1.5, 1.2);
    }
  }
  // 4. Божественный щит (50% поглощения на 6 секунд)
  if (now >= s.cd3) {
    s.cd3 = now + 250;
    s.shieldUntil = now + 120;
    s.gcdUntil = now + 24;
    setCastState(e, 3, 22);
    drawRing(dim, loc, 2.0, 16, "minecraft:totem_particle", 1.0);
    sound(dim, "random.totem", loc, 1.5, 1.2);
  }
}

function tickPoseidon(e, now) {
  if (now % 20 === 0) bossName(e);
  const dim = e.dimension;
  const loc = e.location;
  const s = getBossSt(e.id, now);

  if (now % 20 === 0) {
    try {
      if (e.isInWater) {
        e.addEffect("strength", 40, { amplifier: 1, showParticles: false });
        e.addEffect("speed", 40, { amplifier: 1, showParticles: false });
        e.addEffect("regeneration", 40, { amplifier: 0, showParticles: false });
      }
    } catch {}
  }

  const target = findBossTarget(e, 34, false);
  if (!target) return;

  if (performCloseMeleeStrike(e, target, s, now, 12, 3.5, 22)) return;
  if (now < s.gcdUntil) return;

  // 1. Цунами & Гнев океана (12 урона водой)
  if (now >= s.cd1) {
    s.cd1 = now + 95;
    s.gcdUntil = now + 24;
    setCastState(e, 2, 22);
    drawRing(dim, target.location, 3.5, 20, "minecraft:water_splash_particle_manual", 0.5);
    sound(dim, "mob.guardian.attack", loc, 2.0, 0.8);
    try {
      const dx = target.location.x - loc.x, dz = target.location.z - loc.z, n = Math.hypot(dx, dz) || 1;
      target.applyDamage(shared.diffDmg(12), { cause: EntityDamageCause.magic, damagingEntity: e });
      target.applyKnockback(dx / n, dz / n, 2.0, 0.55);
    } catch {}
    return;
  }

  // 2. Водоворот (затягивает противников к Посейдону)
  if (now >= s.cd2) {
    s.cd2 = now + 150;
    s.gcdUntil = now + 24;
    setCastState(e, 3, 22);
    drawRing(dim, loc, 5.0, 24, "minecraft:water_splash_particle_manual", 0.3);
    try {
      for (const m of dim.getEntities({ location: loc, maxDistance: 8.0 })) {
        if (!m || m.id === e.id || m.typeId === "cb:poseidon_triton" || !alive(m)) continue;
        const dx = loc.x - m.location.x, dz = loc.z - m.location.z, n = Math.hypot(dx, dz) || 1;
        m.applyKnockback(dx / n, dz / n, 1.6, 0.25);
      }
    } catch {}
    return;
  }

  // 4. Призыв морских стражей (тритонов cb:poseidon_triton, лимит <= 3)
  if (now >= s.cd3) {
    s.cd3 = now + 260;
    let tritons = [];
    try { tritons = dim.getEntities({ location: loc, maxDistance: 28, type: "cb:poseidon_triton" }); } catch {}
    if (tritons.length < 3) {
      s.gcdUntil = now + 24;
      setCastState(e, 1, 22);
      for (let i = 0; i < 2 && tritons.length + i < 3; i++) {
        try {
          const tr = dim.spawnEntity("cb:poseidon_triton", { x: loc.x + (i === 0 ? -2 : 2), y: loc.y, z: loc.z });
          assignSummonCipher(tr, e);
          
        } catch {}
      }
    }
  }
}

function tickHades(e, now) {
  if (now % 20 === 0) bossName(e);
  const dim = e.dimension;
  const loc = e.location;
  const s = getBossSt(e.id, now);
  const h = healthOf(e);
  const hp = h ? h.currentValue : 380;
  const maxHp = h ? h.effectiveMax : 380;

  const target = findBossTarget(e, 32, false);
  if (!target) return;

  if (performCloseMeleeStrike(e, target, s, now, 13, 3.5, 22)) return;
  if (now < s.gcdUntil) return;

  // 1. Цепи подземного мира & Пламя Аида (12 урона душами)
  if (now >= s.cd1) {
    s.cd1 = now + 100;
    s.gcdUntil = now + 24;
    setCastState(e, 3, 22);
    drawRing(dim, target.location, 2.0, 14, "minecraft:soul_particle", 0.4);
    try {
      target.applyDamage(shared.diffDmg(12), { cause: EntityDamageCause.wither, damagingEntity: e });
      target.addEffect("slowness", 50, { amplifier: 4, showParticles: true });
      target.addEffect("wither", 80, { amplifier: 1, showParticles: true });
    } catch {}
    sound(dim, "mob.wither.shoot", loc, 1.6, 0.8);
    return;
  }

  // 2. Призыв душ (до 5 призрачных существ)
  if (now >= s.cd2) {
    s.cd2 = now + 220;
    s.gcdUntil = now + 26;
    setCastState(e, 1, 24);
    let souls = [];
    try { souls = dim.getEntities({ location: loc, maxDistance: 28, tags: ["cb_hades_soul"] }); } catch {}
    for (let i = 0; i < 2 && souls.length + i < 5; i++) {
      const sl = { x: loc.x + (i === 0 ? -2.2 : 2.2), y: loc.y + 0.2, z: loc.z };
      drawRing(dim, sl, 1.2, 10, "minecraft:soul_particle", 0.3);
      try {
        const soul = dim.spawnEntity("cb:hades_shade", sl);
        assignSummonCipher(soul, e);
        soul.addTag("cb_hades_soul");
        
      } catch {}
    }
    sound(dim, "mob.wither.ambient", loc, 1.8, 0.75);
    return;
  }

  // 4. Поглощение души: восстанавливает 20 HP за счёт призванного существа
  if (hp < maxHp - 20 && now >= s.cd3) {
    let souls = [];
    try { souls = dim.getEntities({ location: loc, maxDistance: 24, tags: ["cb_hades_soul"] }); } catch {}
    const sac = souls.find((x) => alive(x));
    if (sac) {
      s.cd3 = now + 180;
      s.gcdUntil = now + 22;
      setCastState(e, 2, 20);
      drawRing(dim, sac.location, 1.2, 10, "minecraft:soul_particle", 0.5);
      try { sac.remove(); } catch {}
      if (h) { try { h.setCurrentValue(Math.min(h.effectiveMax, hp + 20)); } catch {} }
      fx(dim, "minecraft:heart_particle", { x: loc.x, y: loc.y + 2.8, z: loc.z });
    }
  }
}

function tickAres(e, now) {
  if (now % 20 === 0) bossName(e);
  const dim = e.dimension;
  const loc = e.location;
  const s = getBossSt(e.id, now);
  const h = healthOf(e);
  const hp = h ? h.currentValue : 320;
  const maxHp = h ? h.effectiveMax : 320;

  const enraged = hp < maxHp * 0.5;
  try { if (e.getProperty("cb:enraged") !== enraged) e.setProperty("cb:enraged", enraged); } catch {}

  const target = findBossTarget(e, 32, false);
  if (!target) return;
  const dx = target.location.x - loc.x, dz = target.location.z - loc.z;
  const dist = Math.hypot(dx, dz) || 1;

  if (now >= s.gcdUntil) {
    // 2. Кровавый рывок копьём
    if (dist >= 4.0 && dist <= 13.0 && now >= s.cd1) {
      s.cd1 = now + 105;
      s.gcdUntil = now + 22;
      setCastState(e, 2, 20);
      try {
        e.applyImpulse({ x: (dx / dist) * 1.15, y: 0.18, z: (dz / dist) * 1.15 });
        const dmg = Math.round(14 * (enraged ? 1.3 : 1.0));
        target.applyDamage(dmg, { cause: EntityDamageCause.entityAttack, damagingEntity: e });
      } catch {}
      sound(dim, "cb.orc.warcry", loc, 1.8, 0.9);
      return;
    }

    // 2b. Призыв Кровавых Берсерков Ареса (cb:ares_berserker, лимит <= 2)
  if (now - s.lastSpec3 >= 380) {
    let bers = [];
    try { bers = dim.getEntities({ location: loc, maxDistance: 28, type: "cb:ares_berserker" }); } catch {}
    if (bers.length < 2) {
      s.lastSpec3 = now;
      for (let i = 0; i < 2 && bers.length + i < 2; i++) {
        try {
          const br = dim.spawnEntity("cb:ares_berserker", { x: loc.x + (i === 0 ? -2.2 : 2.2), y: loc.y, z: loc.z });
          assignSummonCipher(br, e);
          fx(dim, "minecraft:lava_particle", br.location);
        } catch {}
      }
      sound(dim, "mob.ravager.roar", loc, 1.4, 0.9);
    }
  }
  // 3. Удар щитом вблизи
    if (dist <= 4.0 && now >= s.cd2) {
      s.cd2 = now + 80;
      s.gcdUntil = now + 20;
      setCastState(e, 1, 18);
      const dmg = Math.round(13 * (enraged ? 1.3 : 1.0));
      try {
        target.applyDamage(dmg, { cause: EntityDamageCause.entityAttack, damagingEntity: e });
        target.applyKnockback(dx / dist, dz / dist, 1.8, 0.45);
      } catch {}
      sound(dim, "random.anvil_land", loc, 1.4, 1.1);
      return;
    }
  }

  performCloseMeleeStrike(e, target, s, now, Math.round(13 * (enraged ? 1.3 : 1.0)), 3.6, 20);
}

function tickAthena(e, now) {
  if (now % 20 === 0) bossName(e);
  const dim = e.dimension;
  const loc = e.location;
  const s = getBossSt(e.id, now);

  const target = findBossTarget(e, 30, true);
  if (!target) return;

  if (performCloseMeleeStrike(e, target, s, now, 10, 3.5, 22)) return;
  if (now < s.gcdUntil) return;

  // 1. Божественный щит (барьер 60 HP) & Тактическое усиление
  if (now >= s.cd3) {
    s.cd3 = now + 240;
    s.barrierHp = 60;
    s.gcdUntil = now + 24;
    setCastState(e, 1, 22);
    drawRing(dim, loc, 1.8, 14, "minecraft:totem_particle", 1.0);
    try {
      for (const h of dim.getEntities({ location: loc, maxDistance: 16, type: "cb:athena_hoplite" })) {
        if (alive(h)) h.addEffect("resistance", 160, { amplifier: 1, showParticles: true });
      }
    } catch {}
    return;
  }

  // 2. Копьё мудрости (12 магического урона)
  if (now >= s.cd1) {
    s.cd1 = now + 90;
    s.gcdUntil = now + 22;
    setCastState(e, 2, 20);
    drawRing(dim, target.location, 1.5, 12, "minecraft:totem_particle", 0.8);
    try { target.applyDamage(shared.diffDmg(12), { cause: EntityDamageCause.magic, damagingEntity: e }); } catch {}
    sound(dim, "mob.evocation_illager.cast_spell", loc, 1.6, 1.2);
    return;
  }

  // 4. Призыв 3 элитных гоплитов (cb:athena_hoplite)
  if (now >= s.cd2) {
    s.cd2 = now + 280;
    let hops = [];
    try { hops = dim.getEntities({ location: loc, maxDistance: 28, type: "cb:athena_hoplite" }); } catch {}
    if (hops.length < 3) {
      s.gcdUntil = now + 26;
      setCastState(e, 3, 24);
      for (let i = 0; i < 3 && hops.length + i < 3; i++) {
        const ang = (i / 3) * Math.PI * 2;
        try {
          const hpEnt = dim.spawnEntity("cb:athena_hoplite", { x: loc.x + Math.cos(ang) * 2.2, y: loc.y, z: loc.z + Math.sin(ang) * 2.2 });
          assignSummonCipher(hpEnt, e);
          
        } catch {}
      }
      sound(dim, "raid.horn", loc, 1.6, 1.2);
    }
  }
}

function tickHephaestus(e, now) {
  if (now % 20 === 0) bossName(e);
  const dim = e.dimension;
  const loc = e.location;
  const s = getBossSt(e.id, now);

  if (now % 15 === 0) {
    fx(dim, "minecraft:lava_particle", { x: loc.x + (Math.random() - 0.5), y: loc.y + 1.3, z: loc.z + (Math.random() - 0.5) });
  }

  const target = findBossTarget(e, 28, true);
  if (!target) return;

  const dx = target.location.x - loc.x, dz = target.location.z - loc.z;
  const dist = Math.hypot(dx, dz) || 1;

  if (now >= s.gcdUntil) {
    // 1. Удар божественного молота и Огненная кузница
    if (dist <= 6.0 && now >= s.cd1) {
      s.cd1 = now + 95;
      s.gcdUntil = now + 24;
      setCastState(e, 1, 22);
      drawRing(dim, loc, 4.0, 20, "minecraft:lava_particle", 0.4);
      sound(dim, "random.anvil_land", loc, 2.0, 0.75);
      try {
        target.applyDamage(14, { cause: EntityDamageCause.entityAttack, damagingEntity: e });
        target.applyDamage(6, { cause: EntityDamageCause.fire, damagingEntity: e });
        target.setOnFire(5, true);
      } catch {}
      return;
    }

    // 3. Создание стражей (2–3 механических голема cb:hephaestus_golem) & Закалка брони
    if (now >= s.cd2) {
      s.cd2 = now + 260;
      s.gcdUntil = now + 26;
      setCastState(e, 3, 24);
      try { e.addEffect("resistance", 160, { amplifier: 1, showParticles: true }); } catch {}
      let gols = [];
      try { gols = dim.getEntities({ location: loc, maxDistance: 28, type: "cb:hephaestus_golem" }); } catch {}
      for (let i = 0; i < 2 && gols.length + i < 3; i++) {
        try {
          const g = dim.spawnEntity("cb:hephaestus_golem", { x: loc.x + (i === 0 ? -2.2 : 2.2), y: loc.y, z: loc.z });
        assignSummonCipher(g, e);
          
        } catch {}
      }
      sound(dim, "random.anvil_use", loc, 1.8, 0.85);
      return;
    }
  }

  performCloseMeleeStrike(e, target, s, now, 14, 3.6, 22);
}

// ==============================================================================
// Боевые хуки: Проклятый клинок Короля-лича, Кровавый укус Повелителя ужаса,
// Слабости боссов, Щит Зевса (50%), Барьер и Отражение Афины, 50% физ. резист Ледяного духа
// ==============================================================================
world.afterEvents.entityHitEntity.subscribe((ev) => {
  const a = ev.damagingEntity;
  const v = ev.hitEntity;
  if (!a || !v || !valid(v)) return;

  if (a.typeId && a.typeId.startsWith("cb:")) {
    try {
      const bst = bossStates.get(a.id) || minotaurStates.get(a.id);
      if (bst) bst.lastMeleeHitTick = system.currentTick;
      const cs = a.getProperty("cb:cast_state");
      if (cs === 0) setCastState(a, 5, 14);
    } catch {}
  }

  if (a.typeId === "cb:minotaur" || a.typeId === "cb:fel_lord") {
    try {
      const splashR = a.typeId === "cb:fel_lord" ? 3.8 : 3.0;
      const splashDmg = shared.diffDmg(a.typeId === "cb:fel_lord" ? 7 : 5);
      fx(v.dimension, "minecraft:crit_emitter", { x: v.location.x, y: v.location.y + 1.0, z: v.location.z });
      for (const m of v.dimension.getEntities({ location: v.location, maxDistance: splashR })) {
        if (!m || m.id === a.id || m.id === v.id || !alive(m)) continue;
        if (a.typeId === "cb:fel_lord" && isFelFactionEntity(m)) continue;
        if (isPlayer(m) && !inSurvival(m)) continue;
        m.applyDamage(splashDmg, { cause: EntityDamageCause.entityAttack, damagingEntity: a });
      }
    } catch {}
  }

  // Король-лич: 6. Проклятый клинок — каждый 3-й удар наносит дополнительный магический урон!
  if (a.typeId === "cb:lich_king") {
    const n = (lichHitCount.get(a.id) ?? 0) + 1;
    lichHitCount.set(a.id, n);
    if (n % 3 === 0) {
      try {
        v.applyDamage(8, { cause: EntityDamageCause.magic, damagingEntity: a });
        fx(v.dimension, "minecraft:snowflake_particle", { x: v.location.x, y: v.location.y + 1.2, z: v.location.z });
      } catch {}
    }
  }

  // Повелитель ужаса: 5. Кровавый укус — восстанавливает 10 HP при успешном попадании!
  if (a.typeId === "cb:dreadlord") {
    const h = healthOf(a);
    if (h) {
      try { h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + 10)); } catch {}
      fx(a.dimension, "minecraft:heart_particle", { x: a.location.x, y: a.location.y + 2.2, z: a.location.z });
    }
  }
});

world.afterEvents.entityHurt.subscribe((ev) => {
  const v = ev.hurtEntity;
  const a = ev.damageSource?.damagingEntity;
  const dmg = ev.damage ?? 0;
  if (!v || !valid(v)) return;
  const now = system.currentTick;

  if (a && v && valid(a) && valid(v) && isAlliedBossOrMinion(v.typeId, a)) {
    if (dmg > 0) {
      const vh = healthOf(v);
      if (vh && vh.currentValue > 0) { try { vh.setCurrentValue(Math.min(vh.effectiveMax, vh.currentValue + dmg)); } catch {} }
    }
    return;
  }
  if (a && valid(a) && alive(a) && v && valid(v) && !isAlliedBossOrMinion(v.typeId, a)) {
    lastAttackerByBoss.set(v.id, { attackerId: a.id, until: now + 240 });
    if (v.typeId === "cb:fel_lord") {
      shared.commandFelLegion?.(v, a, now);
    }
  }
  if (a && isPlayer(a) && (v.typeId === "cb:athena" || v.typeId === "cb:hephaestus")) {
    try { a.addTag(`cb_foe_${v.typeId}`); } catch {}
  }

  // Слабость Минотавра: уязвим после разрушения стены (во время 3-секундного оглушения)!
  if (v.typeId === "cb:minotaur") {
    const mst = minotaurStates.get(v.id);
    if (mst && now < mst.stunnedUntil && dmg > 0) {
      const h = healthOf(v);
      if (h) { try { h.setCurrentValue(Math.max(1, h.currentValue - Math.ceil(dmg * 0.35))); } catch {} }
    }
  }

  // Слабость Повелителя Скверны: священный свет / оружие с очищением
  if (a && a.typeId === "cb:fel_lord" && v && alive(v)) {
    if (isFelFactionEntity(v)) return;
    const st = getBossSt(a.id);
    if (st.phase >= 2 && ev.damageSource?.cause === EntityDamageCause.entityAttack) {
      try { v.applyDamage(4, { cause: EntityDamageCause.magic, damagingEntity: a }); } catch {}
    }
    if (st.phase === 3) {
      try {
        v.setOnFire(3, true);
        v.addEffect("wither", 60, { amplifier: 0, showParticles: true });
      } catch {}
    }
  }
  if (v.typeId === "cb:fel_lord" && a && valid(a)) {
    let held = "";
    try { held = a.getComponent("minecraft:equippable")?.getEquipment("Mainhand")?.typeId ?? ""; } catch {}
    if (HOLY_OR_CLEANSING_ITEM.test(held)) {
      const h = healthOf(v);
      if (h) { try { h.setCurrentValue(Math.max(1, h.currentValue - 6)); } catch {} }
    }
  }

  // Слабость Короля-лича: огненный урон и уязвимость во время призыва нежити
  if (v.typeId === "cb:lich_king") {
    const s = getBossSt(v.id);
    const isFire = String(ev.damageSource?.cause).includes("fire") || String(ev.damageSource?.cause).includes("lava");
    if (isFire || now < s.summoningUntil) {
      const h = healthOf(v);
      if (h) { try { h.setCurrentValue(Math.max(1, h.currentValue - 5)); } catch {} }
    }
  }

  // Ледяной дух (cb:ice_spirit): 50% сопротивления физическому урону!
  if (v.typeId === "cb:ice_spirit" && ev.damageSource?.cause === EntityDamageCause.entityAttack && dmg > 1) {
    const h = healthOf(v);
    if (h && h.currentValue > 0) {
      try { h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + Math.floor(dmg * 0.5))); } catch {}
    }
  }

  // Зевс: 4. Божественный щит поглощает 50% входящего урона на 6 секунд!
  if (v.typeId === "cb:zeus") {
    const s = getBossSt(v.id);
    if (now < s.shieldUntil && dmg > 1) {
      const h = healthOf(v);
      if (h && h.currentValue > 0) {
        try { h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + Math.floor(dmg * 0.5))); } catch {}
      }
    }
  }

  // Афина: 1. Божественный щит (поглощает до 60 урона) & 5. Отражение атаки (отражает часть снарядов/урона)
  if (v.typeId === "cb:athena") {
    const s = getBossSt(v.id);
    if (s.barrierHp > 0 && dmg > 0) {
      const absorbed = Math.min(s.barrierHp, dmg);
      s.barrierHp -= absorbed;
      const h = healthOf(v);
      if (h && h.currentValue > 0) {
        try { h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + absorbed)); } catch {}
      }
    }
    if (a && valid(a) && ev.damageSource?.cause === EntityDamageCause.projectile) {
      try { a.applyDamage(Math.max(3, Math.round(dmg * 0.5)), { cause: EntityDamageCause.magic, damagingEntity: v }); } catch {}
    }
  }
});

// ==============================================================================
// Смерть Короля-лича -> Ледяная статуя (8 секунд) -> Ледяной дух (120 HP)
// и Поднятие до 3 погибших мобов поблизости!
// ==============================================================================
world.afterEvents.entityDie.subscribe((ev) => {
  const dead = ev.deadEntity;
  if (dead && bloodCursedMobs.has(dead.id)) {
    const cinfo = bloodCursedMobs.get(dead.id);
    bloodCursedMobs.delete(dead.id);
    if (!isPlayer(dead)) {
      try {
        const boss = world.getEntity(cinfo.bossId);
        if (boss && alive(boss)) {
          const bh = healthOf(boss);
          if (bh) bh.setCurrentValue(Math.min(bh.effectiveMax, bh.currentValue + 10));
          fx(boss.dimension, "cb:fel_green_flame", { x: boss.location.x, y: boss.location.y + 2.5, z: boss.location.z });
        }
      } catch {}
    }
  }
  if (!dead) return;
  const dim = dead.dimension;
  const loc = { ...dead.location };
  const now = system.currentTick;

  if (dead.typeId === "cb:lich_king") {
    bossStates.delete(dead.id);
    // Превращается в Ледяную статую на 8 секунд (160 тиков)!
    system.runTimeout(() => {
      try {
        const statue = dim.spawnEntity("cb:lich_statue", loc);
        
        lichStatues.push({
          statueId: statue.id,
          dimId: String(dim.id).replace("minecraft:", ""),
          loc,
          spawnSpiritAt: system.currentTick + 160 // ровно через 8 секунд!
        });
        drawRing(dim, loc, 2.5, 20, "minecraft:snowflake_particle", 0.5);
        sound(dim, "random.glass", loc, 2.0, 0.6);
        for (const p of playersNear(dim, loc, 40)) {
          actionBar(p, "§bЛедяная статуя (8 с)");
        }
      } catch {}
    }, 2);
    return;
  }

  // Поднятие мёртвых Королём-личем (оживляет до 3 погибших мобов поблизости)
  if (!isPlayer(dead) && dead.typeId !== "cb:ice_spirit" && dead.typeId !== "cb:lich_statue" && dead.typeId !== "cb:death_knight" && !dead.hasTag?.("cb_lich_risen")) {
    let lichNear = false;
    let risenCount = 0;
    try {
      lichNear = dim.getEntities({ location: loc, maxDistance: 24, type: "cb:lich_king" }).some((l) => alive(l));
      risenCount = dim.getEntities({ location: loc, maxDistance: 28, tags: ["cb_lich_risen"] }).length;
    } catch {}
    if (lichNear && risenCount < 3) {
      system.runTimeout(() => {
        try {
          const risen = dim.spawnEntity("minecraft:zombie", loc);
          risen.addTag("cb_lich_risen");
          
          risen.addEffect("fire_resistance", 20000, { amplifier: 0, showParticles: false });
          drawRing(dim, loc, 1.2, 10, "minecraft:snowflake_particle", 0.3);
        } catch {}
      }, 4);
    }
  }

  // Зачёт убийств для испытаний Афины и оценки мастерства у Ареса
  const killer = ev.damageSource?.damagingEntity;
  if (killer && isPlayer(killer)) {
    playerSkills.set(killer.id, (playerSkills.get(killer.id) ?? 0) + 1);
    if (dead.hasTag?.("cb_athena_trial_mob")) {
      const q = athenaQuests.get(killer.id);
      if (q) {
        q.currentKills++;
        if (q.currentKills >= q.neededKills) {
          actionBar(killer, "§aИспытание Афины выполнено! Поговорите с Афиной для получения Щита Афины и Благословения!");
        } else {
          actionBar(killer, `§eИспытание Афины: ${q.currentKills}/${q.neededKills}`);
        }
      }
    }
  }
});

// ==============================================================================
// Взаимодействие с Олимпийскими Богами (Зевс, Аид, Арес, Афина, Гефест) и их Благословения
// ==============================================================================
function handleOlympianInteract(ent, eventId) {
  if (!ent || !valid(ent)) return;
  const ev = { entity: ent, eventId };
  const p = playersNear(ent.dimension, ent.location, 6)[0];
  if (!p) return;

  if (ev.eventId === "cb:zeus_trial" && ent.typeId === "cb:zeus") {
    try {
      p.addEffect("strength", 2400, { amplifier: 1, showParticles: true });
      p.addTag("cb_zeus_blessed");
    } catch {}
    sound(ent.dimension, "ambient.weather.thunder", ent.location, 2.0, 1.2);
    actionBar(p, "§eБлагословение Зевса");
  }

  if (ev.eventId === "cb:hades_deal" && ent.typeId === "cb:hades") {
    try {
      p.addEffect("resistance", 2400, { amplifier: 1, showParticles: true });
      p.addEffect("fire_resistance", 2400, { amplifier: 0, showParticles: true });
      p.addTag("cb_hades_blessed");
    } catch {}
    sound(ent.dimension, "mob.wither.ambient", ent.location, 1.6, 0.8);
    actionBar(p, "§8Дар Аида");
  }

  if (ev.eventId === "cb:ares_trial" && ent.typeId === "cb:ares") {
    const score = playerSkills.get(p.id) ?? 0;
    const waveSize = Math.min(5, 2 + Math.floor(score / 3));
    setCastState(ent, 3, 25);
    drawRing(ent.dimension, ent.location, 6.0, 24, "minecraft:lava_particle", 0.4);
    for (let i = 0; i < waveSize; i++) {
      const ang = (i / waveSize) * Math.PI * 2;
      try {
        const w = ent.dimension.spawnEntity("cb:ares_berserker", {
          x: ent.location.x + Math.cos(ang) * 5,
          y: ent.location.y,
          z: ent.location.z + Math.sin(ang) * 5
        });
        
      } catch {}
    }
    try { p.addEffect("strength", 1800, { amplifier: 1, showParticles: true }); } catch {}
    sound(ent.dimension, "raid.horn", ent.location, 2.0, 1.0);
    actionBar(p, "§4Благословение Ареса");
  }

  if (ev.eventId === "cb:athena_quest" && ent.typeId === "cb:athena") {
    const q = athenaQuests.get(p.id);
    if (!q) {
      athenaQuests.set(p.id, { neededKills: 3, currentKills: 0, athenaId: ent.id });
      sound(ent.dimension, "random.levelup", ent.location, 1.5, 1.2);
      actionBar(p, "§eИспытание Афины: 0/3");
      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * Math.PI * 2;
        try {
          const mob = ent.dimension.spawnEntity("minecraft:skeleton", {
            x: ent.location.x + Math.cos(ang) * 5,
            y: ent.location.y,
            z: ent.location.z + Math.sin(ang) * 5
          });
          mob.addTag("cb_athena_trial_mob");
          
        } catch {}
      }
    } else if (q.currentKills >= q.neededKills) {
      athenaQuests.delete(p.id);
      try {
        p.addEffect("resistance", 3600, { amplifier: 1, showParticles: true });
        p.addEffect("absorption", 3600, { amplifier: 2, showParticles: true });
      } catch {}
      sound(ent.dimension, "random.totem", p.location, 1.6, 1.1);
      actionBar(p, "§aБлагословение Афины");
    } else {
      actionBar(p, `§eЗадание Афины: побеждено ${q.currentKills}/${q.neededKills}`);
    }
  }

  if (ev.eventId === "cb:hephaestus_forge" && ent.typeId === "cb:hephaestus") {
    setCastState(ent, 2, 24);
    try {
      p.addEffect("resistance", 2400, { amplifier: 1, showParticles: true });
      p.addEffect("fire_resistance", 2400, { amplifier: 0, showParticles: true });
      p.addEffect("strength", 2400, { amplifier: 1, showParticles: true });
    } catch {}
    fx(ent.dimension, "minecraft:lava_particle", { x: ent.location.x, y: ent.location.y + 1.4, z: ent.location.z });
    sound(ent.dimension, "random.anvil_use", ent.location, 1.8, 0.9);
    actionBar(p, "§6Благословение Гефеста");
  }
}

world.afterEvents.dataDrivenEntityTrigger?.subscribe?.((ev) => {
  handleOlympianInteract(ev.entity, ev.eventId);
});

try {
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (["cb:zeus_trial", "cb:hades_deal", "cb:ares_trial", "cb:athena_quest", "cb:hephaestus_forge"].includes(ev.id)) {
      handleOlympianInteract(ev.sourceEntity, ev.id);
    }
  });
} catch {}

// Основной цикл
system.runInterval(() => {
  const now = system.currentTick;

  // 1) Очистка временного льда (ледяные шипы и ледяная гробница)
  for (let i = tempBlocks.length - 1; i >= 0; i--) {
    const tb = tempBlocks[i];
    if (now < tb.removeAt) continue;
    tempBlocks.splice(i, 1);
    try {
      const dim = world.getDimension(tb.dimId);
      const blk = dim.getBlock({ x: tb.x, y: tb.y, z: tb.z });
      if (blk && blk.typeId === tb.matchId) {
        dim.runCommandAsync(`setblock ${tb.x} ${tb.y} ${tb.z} air`);
      }
    } catch {}
  }

  // 2) Обработка 8-секундной Ледяной статуи Короля-лича -> появление Ледяного духа (120 HP, 50% физ. резист)
  for (let i = lichStatues.length - 1; i >= 0; i--) {
    const ls = lichStatues[i];
    let dim;
    try { dim = world.getDimension(ls.dimId); } catch { lichStatues.splice(i, 1); continue; }
    const stEnt = world.getEntity(ls.statueId);
    if (now < ls.spawnSpiritAt) {
      if (now % 10 === 0) {
        drawRing(dim, ls.loc, 1.8, 12, "minecraft:snowflake_particle", 0.8);
        if (stEnt && valid(stEnt)) {
          const secLeft = Math.max(1, Math.ceil((ls.spawnSpiritAt - now) / 20));
          try {  } catch {}
        }
      }
      continue;
    }
    lichStatues.splice(i, 1);
    const spawnLoc = stEnt && valid(stEnt) ? { ...stEnt.location } : ls.loc;
    if (stEnt && valid(stEnt)) { try { stEnt.remove(); } catch {} }
    try {
      drawRing(dim, spawnLoc, 2.8, 22, "minecraft:snowflake_particle", 0.6);
      fx(dim, "minecraft:huge_explosion_emitter", { x: spawnLoc.x, y: spawnLoc.y + 1.0, z: spawnLoc.z });
      sound(dim, "mob.wither.spawn", spawnLoc, 1.6, 1.35);
      const sp = dim.spawnEntity("cb:ice_spirit", { x: spawnLoc.x, y: spawnLoc.y + 0.4, z: spawnLoc.z });
      
      for (const p of playersNear(dim, spawnLoc, 40)) {
        actionBar(p, "§bВосстал Ледяной дух!");
      }
    } catch {}
  }

  // 3) Гипноз Повелителя ужаса (3 секунды искажения управления/взгляда)
  for (let i = activeHypnosis.length - 1; i >= 0; i--) {
    const h = activeHypnosis[i];
    if (now >= h.until) { activeHypnosis.splice(i, 1); continue; }
    if (now % 3 === 0) {
      const p = world.getEntity(h.playerId);
      const b = world.getEntity(h.bossId);
      if (!p || !valid(p) || !alive(p) || !b || !valid(b) || !alive(b)) {
        activeHypnosis.splice(i, 1);
        continue;
      }
      try { p.teleport(p.location, { facingLocation: { x: b.location.x, y: b.location.y + 1.6, z: b.location.z }, keepVelocity: true }); } catch {}
    }
  }

  if (now % 2 !== 0) return;

  for (const dimId of DIMENSIONS) {
    let dim;
    try { dim = world.getDimension(dimId); } catch { continue; }
    for (const [typeId, fn] of [
      ["cb:minotaur", tickMinotaur],
      ["cb:fel_lord", tickFelLord],
      ["cb:lich_king", tickLichKing],
      ["cb:ice_spirit", tickIceSpirit],
      ["cb:dreadlord", tickDreadlord],
      ["cb:zeus", tickZeus],
      ["cb:poseidon", tickPoseidon],
      ["cb:hades", tickHades],
      ["cb:ares", tickAres],
      ["cb:athena", tickAthena],
      ["cb:hephaestus", tickHephaestus],
    ]) {
      let ents = [];
      try { ents = dim.getEntities({ type: typeId }); } catch { continue; }
      for (const e of ents) {
        if (!alive(e)) continue;
        if (shared.isDancing?.(e.location, e.dimension)) continue;
        if (now % 20 === 0 && BOSS_BASE_HP[typeId]) applyBossDifficultyHp(e, BOSS_BASE_HP[typeId]);
        try { fn(e, now); } catch {}
      }
    }
  }
}, 1);
