import { areAllies } from "./factions.js";
// Гул'дан, Повелитель Скверны — босс Цитадели Скверны.
// Разнообразные и чёткие функции Гул'дана:
//  1) Поглощение Сущности и Призыв Демонов (cb:state = 2):
//     Когда ХП < 180 (изначально 100 ХП, порог 180 ХП), высасывает ровно 2–5 ХП с ближайшего моба/врага,
//     восстанавливает себе эквивалентное количество ХП (до 180), зажигает на земле 2 рунных круга Скверны
//     и ровно через 5 секунд (100 тиков) призывает 2 тёмных демонов Скверны (cb:fel_minion, 15 ХП, 2 урона, живут 30 с).
//  2) Залп Сфер Скверны (cb:state = 1): одиночная сфера в Фазе 1, веер из 3 сфер в Фазе 2.
//  3) Оковы Скверны / Клетка Тьмы (cb:state = 3): сковывает цель изумрудной клеткой рун (Slowness III + Weakness + Wither).
//  4) Кольцо Пламени Скверны (cb:state = 7): удар посохом о землю вблизи — расходящаяся волна зелёного огня (R = 1.5 -> 3.2 -> 5.0),
//     отбрасывающая врагов и обращающая ослабленных обычных орков в рабов.
//  5) Цепная Молния Скверны (cb:state = 8): разряд Скверны, перескакивающий по цепочке до 3 врагов с видимыми зелёными лучами.
//  6) Тёмный Шаг и Ловушка Скверны (cb:state = 6): при угрозе вблизи оставляет взрывную руну Скверны и телепортируется за спину своей гвардии.
//  7) Метеоритный Дождь Скверны (cb:state = 4 -> 5): прицельный круг предупреждения и бомбардировка метеоритами Скверны сверху.
//  8) Власть над Ордой Скверны и Порабощение: зелёные орки (cb:green_orc), красные орки (cb:hell_orc), демоны (cb:fel_minion)
//     и орки-рабы получают от Гул'дана боевую ауру (Strength + Speed + исцеление) и синхронно атакуют его цель,
//     а побеждённые обычные бурые орки (cb:orc) превращаются в Орков-рабов Скверны (cb:slave = true).
import { world, system, EntityDamageCause, ItemStack } from "@minecraft/server";
import { DIMENSIONS, valid, alive, healthOf, isPlayer, inSurvival, fx, sound, actionBar, bossName, shared, assignSummonCipher, sameSummonCipher, applyBossDifficultyHp } from "./util.js";
import { SEA } from "./island.js";
import { T } from "./i18n.js";
import { isleOf, GULDAN_GATE } from "./isles.js";
import { setFoe } from "./mob_ai.js";

export const GULDAN = "cb:guldan";
const START_HP = 100;
const MAX_HP = 180;        // Порог здоровья 180 HP (изначально 100 HP)
const ORB_CD = 54;         // 2.7 с — Сфера Скверны
const ABSORB_CD = 180;     // 9 с — Поглощение 2-5 ХП + призыв 2 демонов через 5 с
const MINION_DELAY = 100;  // 5 секунд (100 тиков) до появления 2 демонов Скверны
const MINION_LIFE = 600;   // 30 секунд (600 тиков) время жизни демонов Скверны
const DRAIN_CD = 240;      // 12 с — Потоковое похищение жизни
const DRAIN_LEN = 60;      // 3 с канал
const DRAIN_LOCK = 60;     // 3 с пауза после канала
const SHACKLE_CD = 170;    // 8.5 с — Оковы Скверны (Клетка Тьмы)
const CHAIN_CD = 140;      // 7 с — Цепная Молния Скверны
const NOVA_CD = 120;       // 6 с — Кольцо Пламени Скверны вблизи
const STEP_CD = 200;       // 10 с — Тёмный Шаг (телепортация с ловушкой Скверны)
const RAIN_CD = 300;       // 15 с — Метеоритный Дождь Скверны
const RAIN_PREP = 24;      // 1.2 с предупреждение
const RAIN_LEN = 80;       // 4 с дождь
const SUMMON_CD = 320;     // 16 с — Призыв гвардейцев Скверны

const states = new Map();
let gateOpened = false;

function getSt(e) {
  let s = states.get(e.id);
  if (!s) {
    s = {
      orbReady: 0,
      absorbReady: 40,
      drainReady: 120,
      shackleReady: 60,
      chainReady: 80,
      novaReady: 40,
      stepReady: 100,
      rainReady: 140,
      summonReady: 180,
      meteorReady: 0,
      meteorCastOnce: false,
      cmdReady: 20,
      busyUntil: 0,
      lockUntil: 0,
      mode: 0,
      modeUntil: 0,
      phase: 1,
      drainTarget: undefined,
      rainCenter: undefined,
    };
    states.set(e.id, s);
  }
  return s;
}

const MINION_ID = "cb:fel_minion";
export const INFERNO_ID = "cb:inferno_golem";
const GOLEM_MAGIC_LIFE = 900; // 45 seconds (900 ticks) for Magic Inferno Golem
const METEOR_HP_THRESHOLD = 54; // 30% of 180 max HP (or <= 30% HP)
const METEOR_CD = 900; // 45s cooldown after summoning magic Inferno Golem
const pendingMinions = []; // [{ dimId, loc, spawnAt, targetId }]
const activeMinions = new Map(); // id -> expiresAt
const activeMagicGolems = new Map(); // id -> expiresAt (45s)
const fallingMeteors = []; // [{ dimId, startLoc, targetLoc, startTick, hitTick, targetId, ownerId }]
const playerGolems = new Map(); // playerId -> golemEntityId
const playerEnemyMap = new Map(); // playerId -> { enemyId, until }
const felTraps = []; // [{ dimId, loc, explodeAt, ownerId }]
const activeShackles = []; // [{ dimId, targetId, until }]

const SKIP_ABSORB = new Set([
  GULDAN, "cb:fel_lord", MINION_ID, "cb:fel_orb", "cb:fel_rain", "cb:hydra_spit", "cb:circe_bolt", "cb:boulder",
  "minecraft:item", "minecraft:xp_orb", "minecraft:arrow", "minecraft:armor_stand", "minecraft:painting",
  "cb:warg", "cb:thunder_lizard", "cb:sargeras_prompt"
]);

function setProp(e, k, v) {
  try { if (e.getProperty(k) !== v) e.setProperty(k, v); } catch {}
}

export function isSlaveOrc(e) {
  if (!e || e.typeId !== "cb:orc") return false;
  try { return e.getProperty("cb:slave") === true || e.hasTag("cb_orc_slave"); } catch { return false; }
}

export function isRegularOrc(e) {
  return !!e && e.typeId === "cb:orc" && !isSlaveOrc(e);
}

export function isPlayerGolem(e) {
  if (!e || e.typeId !== INFERNO_ID) return false;
  try { return e.getProperty("cb:golem_type") === 2 || e.hasTag("cb_player_golem"); } catch { return false; }
}

export function isFelFollower(e) {
  if (!e) return false;
    if (e.typeId === "cb:fel_lord") return true;
  if (e.typeId === INFERNO_ID) return !isPlayerGolem(e);
  return e.typeId === "cb:green_orc" || e.typeId === "cb:hell_orc" || e.typeId === "cb:fel_minion" || isSlaveOrc(e);
}

export function isFelAllyOrSelf(e) {
  if (!e) return false;
  return e.typeId === GULDAN || isFelFollower(e);
}

// Находит всех союзников Скверны (зелёных орков, красных орков, демонов и рабов) в радиусе r без опоры на общие type_family
function getFelAlliesNear(dim, loc, r) {
  const out = [];
  try {
    for (const e of dim.getEntities({ location: loc, maxDistance: r })) {
      if (alive(e) && isFelFollower(e)) out.push(e);
    }
  } catch {}
  return out;
}

// Находит ближайшего любого живого моба/игрока (кроме союзников Скверны) для поглощения 2-5 ХП
function nearestAnyMob(e, maxD = 18) {
  let best, bd = maxD;
  try {
    for (const m of e.dimension.getEntities({ location: e.location, maxDistance: maxD })) {
      if (!m || m.id === e.id || !alive(m) || SKIP_ABSORB.has(m.typeId) || isFelAllyOrSelf(m)) continue;
      if (isPlayer(m) && !inSurvival(m)) continue;
      const mh = healthOf(m);
      if (!mh || mh.currentValue <= 0) continue;
      const d = Math.hypot(m.location.x - e.location.x, m.location.z - e.location.z);
      if (d < bd) { bd = d; best = m; }
    }
  } catch {}
  return best;
}

function drawCircleFx(dim, center, radius, count, particle = "minecraft:villager_happy", yOff = 0.25) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    fx(dim, particle, {
      x: center.x + Math.cos(a) * radius,
      y: center.y + yOff,
      z: center.z + Math.sin(a) * radius
    });
  }
}

function drawBeamFx(dim, p0, p1, steps = 9) {
  for (let i = 1; i <= steps; i++) {
    const t = i / (steps + 1);
    const pos = {
      x: p0.x + (p1.x - p0.x) * t,
      y: p0.y + (p1.y - p0.y) * t,
      z: p0.z + (p1.z - p0.z) * t,
    };
    fx(dim, "minecraft:villager_happy", pos);
    if (i % 2 === 0) fx(dim, "minecraft:totem_particle", pos);
  }
}

function spawnFelMinionsPair(dim, loc, target, now, summoner = undefined) {
  for (const [ox, oz] of [[-1.8, 0.8], [1.8, 0.8]]) {
    const sl = { x: loc.x + ox, y: loc.y + 0.2, z: loc.z + oz };
    drawCircleFx(dim, sl, 1.1, 10, "minecraft:totem_particle", 0.3);
    fx(dim, "minecraft:villager_happy", { x: sl.x, y: sl.y + 1.2, z: sl.z });
    try {
      const m = dim.spawnEntity(MINION_ID, sl);
      if (summoner && valid(summoner)) assignSummonCipher(m, summoner);
      activeMinions.set(m.id, now + MINION_LIFE);
      if (target && valid(target)) setFoe(m, target, now);
    } catch {}
  }
  sound(dim, "mob.evocation_illager.cast_spell", loc, 1.6, 0.7);
  sound(dim, "mob.wither.spawn", loc, 0.6, 1.5);
}

function nearestPlayer(e, maxD = 28) {
  let best, bd = maxD;
  try {
    for (const p of e.dimension.getPlayers({ location: e.location, maxDistance: maxD })) {
      if (!alive(p) || !inSurvival(p)) continue;
      const d = Math.hypot(p.location.x - e.location.x, p.location.z - e.location.z);
      if (d < bd) { bd = d; best = p; }
    }
  } catch {}
  return best;
}

const UNDEAD_OR_ILLAGER_IDS = new Set([
  "minecraft:zombie", "minecraft:husk", "minecraft:drowned", "minecraft:zombie_villager", "minecraft:zombie_villager_v2",
  "minecraft:skeleton", "minecraft:stray", "minecraft:bogged", "minecraft:wither_skeleton",
  "minecraft:zombified_piglin", "minecraft:zoglin", "minecraft:phantom", "minecraft:wither", "minecraft:warden",
  "minecraft:pillager", "minecraft:vindicator", "minecraft:evoker", "minecraft:ravager", "minecraft:witch", "minecraft:vex",
  "minecraft:villager", "minecraft:villager_v2", "minecraft:wandering_trader"
]);

function isGuldanEnemy(m) {
  if (!m || !alive(m) || isFelAllyOrSelf(m) || SKIP_ABSORB.has(m.typeId)) return false;
  if (isPlayer(m)) return inSurvival(m);
  const tid = m.typeId;
  if (isRegularOrc(m)) return true;
  if (tid === "cb:cyclops" || tid === "cb:hydra" || tid === "cb:hydra_head" || tid === "cb:circe" || tid === "cb:laestrygonian" ||
      tid === "cb:minotaur" || tid === "cb:lich_king" || tid === "cb:dreadlord" ||
      tid === "cb:zeus" || tid === "cb:poseidon" || tid === "cb:hades" || tid === "cb:ares" || tid === "cb:athena" || tid === "cb:hephaestus" ||
      tid === "cb:death_knight" || tid === "cb:ice_spirit" || tid === "cb:athena_hoplite" || tid === "cb:hephaestus_golem" || tid === "cb:poseidon_triton" ||
      tid === "minecraft:iron_golem") return true;
  if (isPlayerGolem(m)) return true;
  if (UNDEAD_OR_ILLAGER_IDS.has(tid)) return true;
  try {
    const tf = m.getComponent("minecraft:type_family");
    if (tf) {
      for (const fam of ["warden", "undead", "illager", "pillager", "vindicator", "evoker", "ravager", "witch", "vex", "villager", "wandering_trader", "cyclops", "hydra", "hydra_head", "brown_orc"]) {
        if (tf.hasTypeFamily?.(fam)) return true;
      }
    }
  } catch {}
  return false;
}

// Если цель — неуязвимое тело Гидры (cb:hydra), перенаправляем прицел и урон Гул'дана в ближайшую живую голову Гидры (cb:hydra_head)!
function resolveCombatTarget(boss, target) {
  if (!target || !valid(target)) return undefined;
  if (target.typeId === "cb:hydra") {
    const head = shared.hydraHeadNear?.(target, boss.location);
    if (head && valid(head) && alive(head)) return head;
  }
  return target;
}

// Гул'дан агрессивен к: игроку, циклопу, гидре, ванильной нежити, пилладжерам (разбойникам), жителям и обычным оркам

const mannorothOrders = new Map(); // guldanId -> { targetId, until }
shared.commandGuldan = (guldan, target, now) => {
  if (!guldan || !valid(guldan) || !target || !valid(target) || isFelAllyOrSelf(target)) return;
  mannorothOrders.set(guldan.id, { targetId: target.id, until: now + 100 });
};

function findGuldanTarget(e, maxD = 36) {
  const ord = mannorothOrders.get(e.id);
  if (ord && system.currentTick < ord.until) {
    const ot = resolveCombatTarget(e, world.getEntity(ord.targetId));
    if (ot && valid(ot) && alive(ot) && !isFelAllyOrSelf(ot)) return ot;
  }
  let best, bestScore = Infinity;
  try {
    for (const m of e.dimension.getEntities({ location: e.location, maxDistance: maxD })) {
      if (!m || m.id === e.id || !isGuldanEnemy(m)) continue;
      const eff = resolveCombatTarget(e, m);
      if (!eff || !alive(eff)) continue;
      const d = Math.hypot(eff.location.x - e.location.x, eff.location.z - e.location.z);
      // Приоритет: ближайшая цель, с небольшим бонусом для игрока, циклопа, гидры и обычных орков
      let score = d;
      if (eff.typeId === "minecraft:warden") {
        score -= 25.0;
      } else if (isPlayer(eff) || isRegularOrc(eff) || eff.typeId === "cb:cyclops" || eff.typeId === "cb:hydra_head") {
        score -= 3.0;
      }
      if (score < bestScore) {
        bestScore = score;
        best = eff;
      }
    }
  } catch {}
  return best;
}

// Превращение побеждённого обычного орка в раба Гул'дана
export function enslaveOrc(orc, masterLoc) {
  return false;
  if (!orc || !valid(orc) || orc.typeId !== "cb:orc" || isSlaveOrc(orc)) return false;
  try {
    orc.addTag("cb_orc_slave");
    orc.addTag("cb_guldan_guard");
    orc.setDynamicProperty("cb:slave", true);
    orc.triggerEvent("cb:enslave");
    orc.setProperty("cb:slave", true);
    orc.setProperty("cb:leader", false);
  } catch {}
  try {
    const h = healthOf(orc);
    if (h) h.setCurrentValue(h.effectiveMax);
  } catch {}
  try {
    orc.nameTag = "";
    const eq = orc.getComponent("minecraft:equippable");
    if (eq) {
      eq.setEquipment("Mainhand", new ItemStack("minecraft:iron_pickaxe", 1));
      eq.setEquipment("Head", new ItemStack("minecraft:chainmail_helmet", 1));
    }
  } catch {}
  const loc = orc.location;
  drawCircleFx(orc.dimension, loc, 1.2, 12, "minecraft:totem_particle", 0.5);
  fx(orc.dimension, "minecraft:villager_happy", { x: loc.x, y: loc.y + 1.5, z: loc.z });
  sound(orc.dimension, "mob.zombie.remedy", loc, 1.4, 0.85);
  for (const p of orc.dimension.getPlayers({ location: loc, maxDistance: 32 })) {
    actionBar(p, T("guldan.enslaved"));
  }
  return true;
}

// Открытие решётки в Комнату в конце лабиринта после победы над Гул'даном
export function openEndRoomGate(dim, centerLoc) {
  const isl = isleOf("guldan");
  const cx = isl ? isl.x : Math.round(centerLoc.x);
  const cz = isl ? isl.z : Math.round(centerLoc.z);
  const floor = SEA + 3;
  const gx0 = cx + GULDAN_GATE.x0;
  const gx1 = cx + GULDAN_GATE.x1;
  const gz = cz + GULDAN_GATE.z;
  try {
    dim.runCommandAsync(`fill ${gx0} ${floor + 1} ${gz} ${gx1} ${floor + 4} ${gz} air destroy`);
    dim.runCommandAsync(`fill ${cx - 2} ${floor + 1} ${cz - 10} ${cx + 2} ${floor + 3} ${cz - 8} air replace iron_bars`);
  } catch {}
  gateOpened = true;
  sound(dim, "random.door_open", { x: cx, y: floor + 2, z: gz }, 2.0, 0.8);
  sound(dim, "mob.wither.break_block", { x: cx, y: floor + 2, z: gz }, 1.6, 0.9);
  for (let x = gx0; x <= gx1; x++) {
    fx(dim, "minecraft:totem_particle", { x: x + 0.5, y: floor + 2.0, z: gz + 0.5 });
  }
  for (const p of dim.getPlayers({ location: { x: cx, y: floor + 2, z: cz }, maxDistance: 48 })) {
    actionBar(p, T("guldan.room_open"));
  }
}

// 8. Аура Повелителя Скверны: Гул'дан командует зелёными, красными орками, демонами и рабами
function commandFelOrcs(boss, target, now) {
  const dim = boss.dimension;
  // Проверяем раненых обычных орков рядом — обращаем их в рабов
  try {
    for (const o of dim.getEntities({ location: boss.location, maxDistance: 24, type: "cb:orc" })) {
      if (!alive(o) || isSlaveOrc(o)) continue;
      const oh = healthOf(o);
      if (oh && oh.currentValue <= 7) enslaveOrc(o, boss.location);
    }
  } catch {}

  const allies = getFelAlliesNear(dim, boss.location, 30);
  for (const a of allies) {
    if (target && valid(target) && !isFelAllyOrSelf(target)) {
      setFoe(a, target, now);
    }
    if (now % 60 === 0) {
      try { a.addEffect("strength", 100, { amplifier: 0, showParticles: false }); } catch {}
      try { a.addEffect("speed", 100, { amplifier: 0, showParticles: false }); } catch {}
      const ah = healthOf(a);
      if (ah && ah.currentValue < ah.effectiveMax) {
        try { ah.setCurrentValue(Math.min(ah.effectiveMax, ah.currentValue + 2)); } catch {}
      }
      fx(dim, "minecraft:villager_happy", { x: a.location.x, y: a.location.y + 1.5, z: a.location.z });
    }
  }
}

function faceTarget(e, target) {
  try {
    e.teleport(e.location, { facingLocation: { x: target.location.x, y: target.location.y + 1, z: target.location.z }, keepVelocity: true });
  } catch {}
}

// 2. Сфера Скверны / Веер Скверны
function shootFelOrb(e, target, angleOffset = 0) {
  const from = { x: e.location.x, y: e.location.y + 1.45, z: e.location.z };
  const dx0 = target.location.x - from.x;
  const dy = (target.location.y + 0.9) - from.y;
  const dz0 = target.location.z - from.z;
  const cos = Math.cos(angleOffset), sin = Math.sin(angleOffset);
  const dx = dx0 * cos - dz0 * sin;
  const dz = dx0 * sin + dz0 * cos;
  const len = Math.hypot(dx, dy, dz) || 1;
  try {
    const orb = e.dimension.spawnEntity("cb:fel_orb", {
      x: from.x + (dx / len) * 1.15,
      y: from.y + (dy / len) * 1.15,
      z: from.z + (dz / len) * 1.15,
    });
    const proj = orb.getComponent("minecraft:projectile");
    proj.owner = e;
    proj.shoot({ x: (dx / len) * 1.25, y: (dy / len) * 1.25, z: (dz / len) * 1.25 });
  } catch {}
  sound(e.dimension, "mob.wither.shoot", e.location, 1.4, 1.2);
  fx(e.dimension, "minecraft:totem_particle", from);
}

function tickDrainBeam(e, target) {
  const p0 = { x: e.location.x, y: e.location.y + 1.35, z: e.location.z };
  const p1 = { x: target.location.x, y: target.location.y + 1.0, z: target.location.z };
  drawBeamFx(e.dimension, p0, p1, 9);
}

function spawnFelRainDrop(dim, center) {
  const rx = center.x + (Math.random() - 0.5) * 9.5;
  const rz = center.z + (Math.random() - 0.5) * 9.5;
  const ry = center.y + 10;
  try {
    const drop = dim.spawnEntity("cb:fel_rain", { x: rx, y: ry, z: rz });
    const proj = drop.getComponent("minecraft:projectile");
    proj.shoot({ x: (Math.random() - 0.5) * 0.12, y: -0.95, z: (Math.random() - 0.5) * 0.12 });
  } catch {}
}

// 4. Кольцо Пламени Скверны (расходящаяся волна R = 1.6 -> 3.2 -> 5.0)
function felShockwave(e) {
  const dim = e.dimension;
  const c = { ...e.location };
  drawCircleFx(dim, c, 1.8, 14, "minecraft:totem_particle", 0.4);
  fx(dim, "minecraft:large_explosion", { x: c.x, y: c.y + 0.5, z: c.z });
  sound(dim, "mob.wither.break_block", c, 1.5, 0.85);

  system.runTimeout(() => {
    try { drawCircleFx(dim, c, 3.4, 20, "minecraft:villager_happy", 0.5); } catch {}
  }, 4);
  system.runTimeout(() => {
    try { drawCircleFx(dim, c, 5.0, 26, "minecraft:totem_particle", 0.6); } catch {}
  }, 8);

  try {
    for (const m of dim.getEntities({ location: c, maxDistance: 5.5 })) {
      if (!m || m.id === e.id || !alive(m) || isFelAllyOrSelf(m) || SKIP_ABSORB.has(m.typeId)) continue;
      if (isPlayer(m) && !inSurvival(m)) continue;
      if (isRegularOrc(m)) {
        const oh = healthOf(m);
        if (oh && oh.currentValue <= 9) { enslaveOrc(m, c); continue; }
      }
      const dx = m.location.x - c.x, dz = m.location.z - c.z, d = Math.hypot(dx, dz) || 1;
      try { m.applyDamage(5, { cause: EntityDamageCause.magic, damagingEntity: e }); } catch {}
      try { m.applyKnockback(dx / d, dz / d, 1.7, 0.45); } catch {}
      try { m.addEffect("wither", 80, { amplifier: 0, showParticles: true }); } catch {}
    }
  } catch {}
}

// 5. Цепная Молния Скверны (перескакивает по цепочке до 3 врагов)
function castChainFelLightning(e, firstTarget) {
  const dim = e.dimension;
  const hitIds = new Set([e.id]);
  const chain = [firstTarget];
  hitIds.add(firstTarget.id);

  let cur = firstTarget;
  for (let jump = 0; jump < 2; jump++) {
    let nextBest, nextDist = 8.5;
    try {
      for (const m of dim.getEntities({ location: cur.location, maxDistance: 8.5 })) {
        if (!m || hitIds.has(m.id) || !alive(m) || isFelAllyOrSelf(m) || SKIP_ABSORB.has(m.typeId)) continue;
        if (isPlayer(m) && !inSurvival(m)) continue;
        const d = Math.hypot(m.location.x - cur.location.x, m.location.z - cur.location.z);
        if (d < nextDist) { nextDist = d; nextBest = m; }
      }
    } catch {}
    if (!nextBest) break;
    chain.push(nextBest);
    hitIds.add(nextBest.id);
    cur = nextBest;
  }

  let fromPos = { x: e.location.x, y: e.location.y + 1.45, z: e.location.z };
  for (let i = 0; i < chain.length; i++) {
    const tgt = chain[i];
    const toPos = { x: tgt.location.x, y: tgt.location.y + 1.0, z: tgt.location.z };
    drawBeamFx(dim, fromPos, toPos, 10);
    const dmg = Math.max(2, 5 - i);
    try {
      if (isRegularOrc(tgt) && (healthOf(tgt)?.currentValue ?? 10) <= dmg + 3) {
        enslaveOrc(tgt, e.location);
      } else {
        try { if (tgt.typeId === "cb:hydra_head" || tgt.typeId === "cb:hydra_neck") tgt.setOnFire(5, true); } catch {}
        tgt.applyDamage(dmg, { cause: EntityDamageCause.magic, damagingEntity: e });
        tgt.addEffect("weakness", 80, { amplifier: 0, showParticles: true });
      }
    } catch {}
    fromPos = toPos;
  }
  sound(dim, "mob.elderguardian.curse", e.location, 1.6, 1.4);
  sound(dim, "ambient.weather.thunder", e.location, 0.9, 1.6);
}

// 6. Тёмный Шаг и Взрывная Ловушка Скверны
function castShadowStep(e, target, now) {
  const dim = e.dimension;
  const oldLoc = { x: e.location.x, y: e.location.y, z: e.location.z };
  drawCircleFx(dim, oldLoc, 1.6, 14, "minecraft:totem_particle", 0.3);
  sound(dim, "mob.endermen.portal", oldLoc, 1.6, 0.8);

  // Оставляем взрывную руну-ловушку Скверны на старом месте (взрывается через 1.5 с = 30 тиков)
  felTraps.push({
    dimId: String(dim.id).replace("minecraft:", ""),
    loc: oldLoc,
    explodeAt: now + 30,
    ownerId: e.id
  });

  // Выбираем точку телепортации за спиной своих союзников или в 8 блоках от цели
  const dx = e.location.x - target.location.x;
  const dz = e.location.z - target.location.z;
  const baseAng = Math.atan2(dz, dx) + (Math.random() - 0.5) * 0.9;
  const dist = 8 + Math.random() * 2.5;
  const tx = target.location.x + Math.cos(baseAng) * dist;
  const tz = target.location.z + Math.sin(baseAng) * dist;
  let ty = e.location.y;
  try {
    for (let dy = 3; dy >= -3; dy--) {
      const b = dim.getBlock({ x: Math.floor(tx), y: Math.floor(e.location.y) + dy, z: Math.floor(tz) });
      const above = dim.getBlock({ x: Math.floor(tx), y: Math.floor(e.location.y) + dy + 1, z: Math.floor(tz) });
      if (b && b.typeId !== "minecraft:air" && (!above || above.typeId === "minecraft:air")) {
        ty = Math.floor(e.location.y) + dy + 1;
        break;
      }
    }
    e.teleport({ x: tx, y: ty, z: tz }, { facingLocation: target.location, keepVelocity: false });
  } catch {}
  drawCircleFx(dim, { x: tx, y: ty, z: tz }, 1.6, 14, "minecraft:villager_happy", 0.5);
  sound(dim, "mob.endermen.portal", { x: tx, y: ty, z: tz }, 1.6, 0.85);
}


// Призыв Метеорита Скверны (на <= 30% ХП Гул'дана): падает на врага и рождает Магического Инфернального Голема на 45 с!
function launchInfernoMeteor(boss, target, now) {
  const dim = boss.dimension;
  const tLoc = { x: target.location.x, y: target.location.y, z: target.location.z };
  const sLoc = { x: tLoc.x + (Math.random() - 0.5) * 6, y: tLoc.y + 18, z: tLoc.z + (Math.random() - 0.5) * 6 };
  fallingMeteors.push({
    dimId: String(dim.id).replace("minecraft:", ""),
    startLoc: sLoc,
    targetLoc: tLoc,
    startTick: now,
    hitTick: now + 30, // 1.5 секунды полёта метеорита с неба
    targetId: target.id,
    ownerId: boss.id
  });
  drawCircleFx(dim, tLoc, 2.8, 18, "minecraft:totem_particle", 0.3);
  sound(dim, "mob.evocation_illager.prepare_summon", boss.location, 2.2, 0.65);
  sound(dim, "mob.ghast.fireball", sLoc, 2.0, 0.6);
  for (const p of dim.getPlayers({ location: boss.location, maxDistance: 40 })) {
    actionBar(p, T("guldan.meteor"));
  }
}

const sargerasCd = new Map(); // playerId -> readyTick (45s = 900 ticks)
const golemLastPos = new Map(); // golemId -> { x, z }
const tempTrailFires = []; // [{ dimId, x, y, z, removeAt }]
const TREE_OR_LEAF = /_log|_wood|_stem|leaves|vine|mangrove_roots/;

function findGroundY(dim, x, startY, z) {
  const bx = Math.floor(x), bz = Math.floor(z), sy = Math.floor(startY);
  try {
    for (let dy = 4; dy >= -8; dy--) {
      const b = dim.getBlock({ x: bx, y: sy + dy, z: bz });
      const above = dim.getBlock({ x: bx, y: sy + dy + 1, z: bz });
      if (b && b.typeId !== "minecraft:air" && !/water|lava|fire/.test(b.typeId) && (!above || above.typeId === "minecraft:air" || /fire|tallgrass|fern/.test(above.typeId))) {
        return sy + dy + 1;
      }
    }
  } catch {}
  return sy;
}

// Инфернальный Голем разрушает деревья (стволы и листву) на своём пути и вокруг себя
function breakTreesAroundGolem(g) {
  const dim = g.dimension;
  const gx = Math.floor(g.location.x);
  const gy = Math.floor(g.location.y);
  const gz = Math.floor(g.location.z);
  let broken = 0;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
      for (let dy = 0; dy <= 4; dy++) {
        let blk;
        try { blk = dim.getBlock({ x: gx + dx, y: gy + dy, z: gz + dz }); } catch {}
        if (blk && TREE_OR_LEAF.test(blk.typeId)) {
          try {
            dim.runCommandAsync(`setblock ${gx + dx} ${gy + dy} ${gz + dz} air destroy`);
            broken++;
            if (broken >= 6) break;
          } catch {}
        }
      }
      if (broken >= 6) break;
    }
    if (broken >= 6) break;
  }
  if (broken > 0) {
    sound(dim, "dig.wood", g.location, 1.2, 0.85);
    fx(dim, "cb:fel_green_flame", { x: g.location.x, y: g.location.y + 1.5, z: g.location.z });
  }
}

// Инфернальный Голем поджигает землю за собой при движении
function igniteGroundBehindGolem(g, now) {
  const prev = golemLastPos.get(g.id);
  const cur = { x: g.location.x, z: g.location.z };
  if (!prev) {
    golemLastPos.set(g.id, cur);
    return;
  }
  const dx = cur.x - prev.x;
  const dz = cur.z - prev.z;
  const moved = Math.hypot(dx, dz);
  if (moved < 0.35) return;
  golemLastPos.set(g.id, cur);

  const dim = g.dimension;
  const bx = Math.floor(cur.x - (dx / moved) * 1.15);
  const by = Math.floor(g.location.y);
  const bz = Math.floor(cur.z - (dz / moved) * 1.15);
  try {
    const atBlk = dim.getBlock({ x: bx, y: by, z: bz });
    const belowBlk = dim.getBlock({ x: bx, y: by - 1, z: bz });
    if (atBlk && atBlk.typeId === "minecraft:air" && belowBlk && belowBlk.typeId !== "minecraft:air" && !/water|lava|ice/.test(belowBlk.typeId)) {
      dim.runCommandAsync(`setblock ${bx} ${by} ${bz} fire keep`);
      fx(dim, "cb:fel_green_flame", { x: bx + 0.5, y: by + 0.2, z: bz + 0.5 });
      tempTrailFires.push({
        dimId: String(dim.id).replace("minecraft:", ""),
        x: bx, y: by, z: bz,
        removeAt: now + 80
      });
    }
  } catch {}
}

function spawnMagicInfernoGolem(dim, loc, target, now, playerOwner = undefined) {
  fx(dim, "minecraft:huge_explosion_emitter", { x: loc.x, y: loc.y + 0.6, z: loc.z });
  fx(dim, "cb:fel_green_flame", { x: loc.x, y: loc.y + 1.0, z: loc.z });
  drawCircleFx(dim, loc, 3.2, 22, "minecraft:totem_particle", 0.4);
  drawCircleFx(dim, loc, 2.0, 16, "minecraft:villager_happy", 0.8);
  sound(dim, "cb.inferno_golem.spawn", loc, 2.0, 0.95);
  sound(dim, "random.explode", loc, 2.0, 0.75);

  // Поджигаем землю в кратере падения метеорита и наносим урон врагам вокруг точки удара
  const cx = Math.floor(loc.x), cy = Math.floor(loc.y), cz = Math.floor(loc.z);
  for (const [ox, oz] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1]]) {
    try {
      dim.runCommandAsync(`setblock ${cx + ox} ${cy} ${cz + oz} fire keep`);
      tempTrailFires.push({
        dimId: String(dim.id).replace("minecraft:", ""),
        x: cx + ox, y: cy, z: cz + oz,
        removeAt: now + 100
      });
    } catch {}
  }

  try {
    for (const m of dim.getEntities({ location: loc, maxDistance: 4.5 })) {
      if (!m || !alive(m) || SKIP_ABSORB.has(m.typeId)) continue;
      if (playerOwner) {
        if (m.id === playerOwner.id || isPlayerGolem(m) || sameSummonCipher(playerOwner, m) || m.typeId === "cb:hephaestus_golem") continue;
      } else {
        if (isFelAllyOrSelf(m) || (isPlayer(m) && !inSurvival(m))) continue;
      }
      try { m.applyDamage(6, { cause: EntityDamageCause.entityExplosion, damagingEntity: playerOwner }); } catch {}
      try { m.setOnFire(5, true); } catch {}
    }
  } catch {}

  // Если метеорит вызван игроком через Частичку Саргераса — призываем (или обновляем) личного Инфернального Голема игрока!
  if (playerOwner && valid(playerOwner)) {
    try {
      const existingPets = dim.getEntities({ type: INFERNO_ID, tags: ["cb_player_golem"] })
        .filter((x) => valid(x) && alive(x) && x.getDynamicProperty("cb:owner_id") === playerOwner.id);
      if (existingPets.length >= 5) {
        try { existingPets[0].remove(); } catch {}
      }
    } catch {}
    try {
      const g = dim.spawnEntity(INFERNO_ID, { x: loc.x, y: loc.y + 0.2, z: loc.z });
      g.triggerEvent("cb:as_player_pet");
      g.setProperty("cb:golem_type", 2);
      g.setProperty("cb:spawning", true);
      g.addTag("cb_player_golem");
      g.setDynamicProperty("cb:owner_id", playerOwner.id);
      assignSummonCipher(g, playerOwner);
      g.nameTag = "";
      playerGolems.set(playerOwner.id, g.id);
      system.runTimeout(() => {
        if (valid(g)) {
          try { g.triggerEvent("cb:finish_spawn"); g.setProperty("cb:spawning", false); } catch {}
        }
      }, 24);
      actionBar(playerOwner, T("sargeras.golem_spawn"));
    } catch {}
    return;
  }

  // Иначе это Магический Инфернальный Голем Гул'дана (живёт 45 секунд)
  try {
    const g = dim.spawnEntity(INFERNO_ID, { x: loc.x, y: loc.y + 0.2, z: loc.z });
    g.triggerEvent("cb:as_magic");
    g.setProperty("cb:golem_type", 1);
    g.setProperty("cb:spawning", true);
    g.addTag("cb_magic_golem");
    if (target) {}
    g.setDynamicProperty("cb:cipher", "fel_legion");
    g.nameTag = "";
    activeMagicGolems.set(g.id, now + GOLEM_MAGIC_LIFE);
    if (target && valid(target)) setFoe(g, target, now);
    system.runTimeout(() => {
      if (valid(g)) {
        try { g.triggerEvent("cb:finish_spawn"); g.setProperty("cb:spawning", false); } catch {}
      }
    }, 24);
  } catch {}
}

const sargerasPrompts = new Map(); // playerId -> promptEntityId
const sargerasDebounce = new Map(); // playerId -> tick


const WARCRAFT_ORBS = {
  "warcraft:inferno_orb": {
    golemId: "warcraft:inferno_golem",
    name: "§6Союзный Инферно Голем",
    p1: "minecraft:basic_flame_particle",
    p2: "minecraft:lava_particle",
    snd: "mob.blaze.shoot",
    elem: "fire",
  },
  "warcraft:frost_orb": {
    golemId: "warcraft:frost_golem",
    name: "§bСоюзный Ледяной Голем",
    p1: "minecraft:blue_flame_particle",
    p2: "minecraft:basic_smoke_particle",
    snd: "random.glass",
    elem: "frost",
  },
  "warcraft:storm_orb": {
    golemId: "warcraft:lightning_golem",
    name: "§9Союзный Грозовой Голем",
    p1: "minecraft:blue_flame_particle",
    p2: "minecraft:electric_spark_particle",
    snd: "ambient.weather.thunder",
    elem: "storm",
  },
};
function isGolemArtifactId(typeId) {
  return typeId === "cb:sargeras_shard" || Boolean(WARCRAFT_ORBS[typeId]);
}
function launchWarcraftOrbMeteor(player, cfg, wear) {
  const dim = player.dimension;
  const v = player.getViewDirection?.() ?? { x: 0, y: 0, z: 1 };
  const hLen = Math.hypot(v.x, v.z) || 1;
  const hx = v.x / hLen, hz = v.z / hLen;
  const landX = player.location.x + hx * 5.5;
  const landZ = player.location.z + hz * 5.5;
  const landY = findGroundY(dim, landX, player.location.y, landZ);
  const landLoc = { x: landX, y: landY, z: landZ };

  sound(dim, "mob.ghast.fireball", player.location, 1.8, 0.72);
  sound(dim, cfg.snd, landLoc, 1.5, 0.95);
  if (wear.broken) {
    actionBar(player, `${cfg.name}§c — последний заряд сферы! Метеорит обрушивается!`);
  } else {
    actionBar(player, `§e☄ Метеорит: ${cfg.name} §7(зарядов: §e${wear.left}/5§7)`);
  }

  const STEPS = 15;
  for (let step = 0; step < STEPS; step++) {
    system.runTimeout(() => {
      try {
        const frac = step / STEPS;
        const mx = landX - hx * (1.0 - frac) * 4.2;
        const my = landY + 17.0 * (1.0 - frac);
        const mz = landZ - hz * (1.0 - frac) * 4.2;
        for (let k = 0; k < 5; k++) {
          const ox = (Math.random() - 0.5) * 0.9, oy = (Math.random() - 0.5) * 0.9, oz = (Math.random() - 0.5) * 0.9;
          fx(dim, cfg.p1, { x: mx + ox, y: my + oy, z: mz + oz });
          if (k % 2 === 0) fx(dim, cfg.p2, { x: mx + ox * 1.2, y: my + oy + 0.5, z: mz + oz * 1.2 });
        }
        fx(dim, "minecraft:large_explosion", { x: mx, y: my, z: mz });
        if (step % 3 === 0) drawCircleFx(dim, landLoc, 1.3 + frac * 1.8, 12, cfg.p1, 0.25);
      } catch {}
    }, step);
  }

  system.runTimeout(() => {
    try {
      sound(dim, "random.explode", landLoc, 2.0, 0.85);
      sound(dim, cfg.snd, landLoc, 1.6, 0.95);
      sound(dim, "random.levelup", landLoc, 1.2, 1.1);
      fx(dim, "minecraft:huge_explosion_emitter", { x: landX, y: landY + 0.8, z: landZ });
      drawCircleFx(dim, landLoc, 2.2, 18, cfg.p1, 0.45);
      drawCircleFx(dim, landLoc, 4.0, 22, cfg.p2, 0.7);
      if (cfg.elem === "storm") {
        try { dim.spawnEntity("minecraft:lightning_bolt", landLoc); } catch {}
      }
      const golem = dim.spawnEntity(cfg.golemId, { x: landX, y: landY + 0.3, z: landZ });
      golem.addTag("warcraft_ally");
      golem.triggerEvent("warcraft:make_ally");
      try {
        const tm = golem.getComponent("minecraft:tameable");
        if (tm) tm.tame(player);
        golem.addEffect("resistance", 40, { amplifier: 4, showParticles: false });
      } catch {}
      golem.nameTag = cfg.name;

      // Friendly-fire-proof meteor crash AoE (4.8 blocks)
      for (const e of dim.getEntities({ location: landLoc, maxDistance: 4.8 })) {
        if (!e || e.id === golem.id || e.id === player.id) continue;
        if (e.typeId === "minecraft:player" || e.hasTag?.("warcraft_ally") || e.hasTag?.("cb_player_golem")) continue;
        if (e.typeId === "cb:sargeras_prompt") continue;
        try {
          if (!e.getComponent("minecraft:health")) continue;
          e.applyDamage(8, { cause: cfg.elem === "fire" ? "fire" : "entityExplosion", damagingEntity: golem });
          const dx = e.location.x - landX, dz = e.location.z - landZ;
          const d = Math.max(0.5, Math.hypot(dx, dz));
          e.applyKnockback(dx / d, dz / d, 1.35, 0.5);
          if (cfg.elem === "fire") { try { e.setOnFire(4, true); } catch {} }
          else if (cfg.elem === "frost") e.addEffect("slowness", 80, { amplifier: 2, showParticles: true });
          else if (cfg.elem === "storm") e.addEffect("weakness", 80, { amplifier: 1, showParticles: true });
        } catch {}
      }
      if (valid(player)) actionBar(player, `${cfg.name} §aпризван метеоритом и сражается за вас!`);
    } catch {}
  }, STEPS);
}

const sargerasSlotCd = new Map(); // `${playerId}:${slot}` -> readyTick

function getShardReadyTick(player, it, now = system.currentTick) {
  if (!it || !isGolemArtifactId(it.typeId)) return 0;
  let tickVal = 0;
  try {
    const dp = it.getDynamicProperty?.("cb:ready_tick");
    if (typeof dp === "number") tickVal = dp;
  } catch {}
  if (!tickVal) {
    const slotKey = `${player.id}:${player.selectedSlotIndex ?? 0}`;
    tickVal = sargerasSlotCd.get(slotKey) ?? 0;
  }
  if (tickVal > now + 900) return 0;
  return tickVal;
}

// Расход 1 заряда прочности и запись индивидуального кулдауна КОНКРЕТНОЙ «Частички Саргераса» в текущем слоте!
// В Креативе (!inSurvival(player)) частичка НЕ тратит прочность и НЕ разрушается!
function wearAndCooldownSargerasParticle(player, readyTick) {
  const slotKey = `${player.id}:${player.selectedSlotIndex ?? 0}`;
  sargerasSlotCd.set(slotKey, readyTick);
  try {
    const eq = player.getComponent("minecraft:equippable");
    const it = eq?.getEquipment("Mainhand");
    if (!it || !isGolemArtifactId(it.typeId)) return { broken: false, left: 5 };
    try { it.setDynamicProperty?.("cb:ready_tick", readyTick); } catch {}
    try {
      const prevLore = (it.getLore?.() ?? []).filter((l) => !l.startsWith("§0§kcd:"));
      it.setLore?.(prevLore);
    } catch {}

    // В Креативе не разрушается и не теряет прочность!
    if (!inSurvival(player)) {
      eq.setEquipment("Mainhand", it);
      return { broken: false, left: 5 };
    }

    const d = it.getComponent?.("minecraft:durability");
    const maxD = d?.maxDurability ?? 5;
    const curDmg = d ? d.damage : 0;
    const nextDmg = curDmg + 1;
    if (nextDmg >= maxD) {
      eq.setEquipment("Mainhand", undefined);
      sargerasSlotCd.delete(slotKey);
      sound(player.dimension, "random.break", player.location, 1.4, 0.95);
      return { broken: true, left: 0 };
    }
    if (d) {
      d.damage = nextDmg;
    }
    eq.setEquipment("Mainhand", it);
    return { broken: false, left: maxD - nextDmg };
  } catch {
    return { broken: false, left: 4 };
  }
}

function removePromptForPlayer(playerId) {
  const pid = sargerasPrompts.get(playerId);
  if (!pid) return;
  sargerasPrompts.delete(playerId);
  try {
    const ent = world.getEntity(pid);
    if (ent && valid(ent)) ent.remove();
  } catch {}
}

// Нажатие кнопки «Вызвать Голема» / использование «Частички Саргераса» (cb:sargeras_shard):
// У каждой отдельной частички в своём слоте — свой собственный кулдаун (как у арбалетов в разных слотах)!
function useSargerasScale(player, now) {
  if (!player || !valid(player)) return;
  if (now - (sargerasDebounce.get(player.id) ?? -100) < 6) return;
  sargerasDebounce.set(player.id, now);

  let it;
  try { it = player.getComponent("minecraft:equippable")?.getEquipment("Mainhand"); } catch {}
  if (!it || !isGolemArtifactId(it.typeId)) return;

  const readyAt = getShardReadyTick(player, it);
  if (now < readyAt) {
    const leftSec = Math.ceil((readyAt - now) / 20);
    actionBar(player, T("sargeras.cooldown", leftSec));
    return;
  }
  const nextReady = now + 900; // 45 секунд (900 тиков) только для ЭТОЙ частички!
  removePromptForPlayer(player.id);
  const wear = wearAndCooldownSargerasParticle(player, nextReady);
  if (WARCRAFT_ORBS[it.typeId]) {
    launchWarcraftOrbMeteor(player, WARCRAFT_ORBS[it.typeId], wear);
    return;
  }

  const dim = player.dimension;
  const v = player.getViewDirection?.() ?? { x: 0, y: 0, z: 1 };
  const hLen = Math.hypot(v.x, v.z) || 1;
  const dirX = v.x / hLen;
  const dirZ = v.z / hLen;

  // Точка падения метеорита — ровно в 5 блоках впереди перед игроком!
  const tx = player.location.x + dirX * 5.0;
  const tz = player.location.z + dirZ * 5.0;
  const ty = findGroundY(dim, tx, player.location.y, tz);
  const tLoc = { x: tx, y: ty, z: tz };
  const sLoc = { x: player.location.x + dirX * 1.5, y: ty + 15, z: player.location.z + dirZ * 1.5 };

  fallingMeteors.push({
    dimId: String(dim.id).replace("minecraft:", ""),
    startLoc: sLoc,
    targetLoc: tLoc,
    startTick: now,
    hitTick: now + 18, // 0.9 секунды стремительного падения метеорита в точку в 5 блоках перед игроком
    targetId: undefined,
    ownerId: player.id,
    playerOwnerId: player.id
  });

  drawCircleFx(dim, tLoc, 2.2, 16, "minecraft:totem_particle", 0.25);
  fx(dim, "cb:fel_green_flame", { x: tLoc.x, y: tLoc.y + 0.4, z: tLoc.z });
  sound(dim, "mob.ghast.fireball", player.location, 1.8, 0.7);
  if (wear.broken) {
    actionBar(player, T("sargeras.broken"));
  } else {
    actionBar(player, T("sargeras.meteor_cast", wear.left));
  }
}

function tickGuldan(e, now) {
  if (now % 20 === 0) bossName(e);
  if (shared.isDancing?.(e.location, e.dimension)) {
    const s = getSt(e);
    if (s.mode !== 0) {
      s.mode = 0;
      s.drainTarget = undefined;
      setProp(e, "cb:state", 0);
      try { e.triggerEvent("cb:unfreeze"); } catch {}
    }
    return;
  }

  const s = getSt(e);
  const h = healthOf(e);
  const hp = h ? h.currentValue : START_HP;

  // Изумрудная аура Скверны вокруг Гул'дана
  if (now % 6 === 0) {
    fx(e.dimension, "minecraft:villager_happy", {
      x: e.location.x + (Math.random() - 0.5) * 1.1,
      y: e.location.y + 0.9 + Math.random() * 1.3,
      z: e.location.z + (Math.random() - 0.5) * 1.1,
    });
    if (s.phase === 2) {
      fx(e.dimension, "minecraft:totem_particle", {
        x: e.location.x + (Math.random() - 0.5) * 1.4,
        y: e.location.y + 1.2 + Math.random() * 1.2,
        z: e.location.z + (Math.random() - 0.5) * 1.4,
      });
    }
  }

  // Переход во 2-ю фазу (< 65 HP)
  if (s.phase === 1 && hp < 65) {
    s.phase = 2;
    setProp(e, "cb:phase", 2);
    sound(e.dimension, "mob.enderdragon.growl", e.location, 2.0, 0.8);
    felShockwave(e);
    const p = nearestPlayer(e, 36);
    if (p) actionBar(p, T("guldan.phase2"));
  }

  const target = findGuldanTarget(e, 30);
  if (now >= s.cmdReady) {
    s.cmdReady = now + 20;
    commandFelOrcs(e, target, now);
  }

  // Потоковое похищение жизни (Drain Life канал)
  if (s.mode === 2 && s.drainTarget) {
    const tgt = world.getEntity(s.drainTarget);
    const validTgt = tgt && alive(tgt) && (isPlayer(tgt) ? inSurvival(tgt) : !isFelAllyOrSelf(tgt));
    if (!validTgt || now >= s.modeUntil || Math.hypot(tgt.location.x - e.location.x, tgt.location.z - e.location.z) > 20) {
      s.mode = 0;
      s.drainTarget = undefined;
      setProp(e, "cb:state", 0);
      try { e.triggerEvent("cb:unfreeze"); } catch {}
      s.lockUntil = now + DRAIN_LOCK;
      return;
    }
    if (now % 4 === 0) {
      faceTarget(e, tgt);
      tickDrainBeam(e, tgt);
    }
    if (now % 20 === 10) {
      try {
        const dmg = s.phase === 2 ? 3 : 2;
        if (isRegularOrc(tgt)) {
          const oh = healthOf(tgt);
          if (oh && oh.currentValue <= dmg + 5) {
            enslaveOrc(tgt, e.location);
            s.mode = 0;
            s.drainTarget = undefined;
            setProp(e, "cb:state", 0);
            try { e.triggerEvent("cb:unfreeze"); } catch {}
            return;
          }
        }
        try { if (tgt.typeId === "cb:hydra_head" || tgt.typeId === "cb:hydra_neck") tgt.setOnFire(5, true); } catch {}
        tgt.applyDamage(dmg, { cause: EntityDamageCause.magic, damagingEntity: e });
        if (h) h.setCurrentValue(Math.min(MAX_HP, h.currentValue + dmg));
        sound(e.dimension, "mob.elderguardian.curse", e.location, 1.1, 1.25);
      } catch {}
    }
    return;
  }

  // Подготовка и обрушение Метеоритного Дождя Скверны (mode 4 -> 5)
  if (s.mode === 4) {
    if (now % 4 === 0 && s.rainCenter) {
      drawCircleFx(e.dimension, s.rainCenter, 4.5, 14, "minecraft:villager_happy", 0.3);
    }
    if (now >= s.modeUntil) {
      s.mode = 5;
      s.modeUntil = now + RAIN_LEN;
      setProp(e, "cb:state", 5);
      sound(e.dimension, "mob.ghast.fireball", e.location, 1.8, 0.8);
    }
    return;
  }

  if (s.mode === 5) {
    if (now >= s.modeUntil) {
      s.mode = 0;
      setProp(e, "cb:state", 0);
      try { e.triggerEvent("cb:unfreeze"); } catch {}
      return;
    }
    const tgt = findGuldanTarget(e, 30);
    if (tgt) s.rainCenter = { ...tgt.location };
    if (now % (s.phase === 2 ? 6 : 8) === 0 && s.rainCenter) spawnFelRainDrop(e.dimension, s.rainCenter);
    return;
  }

  // Сброс анимации каста после завершения коротких способностей
  if (s.mode !== 0 && now >= s.modeUntil && !s.drainTarget) {
    s.mode = 0;
    setProp(e, "cb:state", 0);
  }

  if (!target) return;

  const dist = Math.hypot(target.location.x - e.location.x, target.location.z - e.location.z);
  if (dist > 5.5 && now % 8 === 0) {
    const dx = target.location.x - e.location.x, dz = target.location.z - e.location.z;
    const n = Math.hypot(dx, dz) || 1;
    faceTarget(e, target);
    try { if (e.isOnGround !== false) e.applyImpulse({ x: (dx / n) * 0.28, y: 0.04, z: (dz / n) * 0.28 }); } catch {}
  }

  if (now < s.lockUntil || now < s.busyUntil) return;

  // СПОСОБНОСТЬ 0 (Ультимативная при <= 30% ХП = <= 54 ХП): Призыв Метеорита Скверны и Магического Инфернального Голема (cb:state = 9)!
  if ((hp <= METEOR_HP_THRESHOLD || (!s.meteorCastOnce && hp <= 60)) && now >= s.meteorReady) {
    s.meteorCastOnce = true;
    s.meteorReady = now + METEOR_CD;
    s.busyUntil = now + 34;
    s.mode = 9;
    s.modeUntil = now + 30;
    setProp(e, "cb:state", 9);
    faceTarget(e, target);
    launchInfernoMeteor(e, target, now);
    return;
  }

  // СПОСОБНОСТЬ 1 (Приоритетная): Поглощение 2-5 ХП с ближайшего моба -> восстановление до порога 180 ХП -> призыв 2 демонов через 5 с
  if (hp < MAX_HP && now >= s.absorbReady) {
    const victim = nearestAnyMob(e, 18);
    if (victim) {
      s.absorbReady = now + ABSORB_CD;
      s.busyUntil = now + 22;
      s.mode = 2;
      s.drainTarget = undefined;
      s.modeUntil = now + 18;
      setProp(e, "cb:state", 2);
      faceTarget(e, victim);

      const vh = healthOf(victim);
      const want = 2 + Math.floor(Math.random() * 4); // ровно от 2 до 5 единиц ХП
      const stolen = Math.min(want, Math.max(1, Math.floor(vh?.currentValue ?? want)));
      try {
        victim.applyDamage(stolen, { cause: EntityDamageCause.magic, damagingEntity: e });
      } catch {}
      let newHp = hp;
      if (h) {
        newHp = Math.min(MAX_HP, Math.round(h.currentValue + stolen));
        try { h.setCurrentValue(newHp); } catch {}
      }
      bossName(e);
      tickDrainBeam(e, victim);
      fx(e.dimension, "minecraft:heart_particle", { x: e.location.x, y: e.location.y + 2.2, z: e.location.z });
      sound(e.dimension, "mob.elderguardian.curse", e.location, 1.5, 1.05);

      // Через 5 секунд (100 тиков) призываем 2 временных демонов Скверны (живут 30 с)
      pendingMinions.push({
        dimId: String(e.dimension.id).replace("minecraft:", ""),
        loc: { x: e.location.x, y: e.location.y, z: e.location.z },
        spawnAt: now + MINION_DELAY,
        targetId: target?.id
      });
      for (const p of e.dimension.getPlayers({ location: e.location, maxDistance: 36 })) {
        actionBar(p, T("guldan.absorb", stolen));
      }
      return;
    }
  }

  // СПОСОБНОСТЬ 4: Кольцо Пламени Скверны (удар посохом о землю, если враг подошёл ближе 4.8 блоков)
  if (dist <= 4.8 && now >= s.novaReady) {
    s.novaReady = now + NOVA_CD;
    s.busyUntil = now + 22;
    s.mode = 7;
    s.modeUntil = now + 18;
    setProp(e, "cb:state", 7);
    felShockwave(e);
    return;
  }

  // СПОСОБНОСТЬ 6: Тёмный Шаг (телепортация с взрывной ловушкой Скверны, если враг зажал вблизи <= 4.5 блоков)
  if (dist <= 4.5 && now >= s.stepReady) {
    s.stepReady = now + STEP_CD;
    s.busyUntil = now + 18;
    s.mode = 6;
    s.modeUntil = now + 14;
    setProp(e, "cb:state", 6);
    castShadowStep(e, target, now);
    return;
  }

  // СПОСОБНОСТЬ 7: Метеоритный Дождь Скверны
  if ((s.phase === 2 || hp < 85) && now >= s.rainReady) {
    s.rainReady = now + RAIN_CD;
    s.busyUntil = now + RAIN_PREP + RAIN_LEN + 20;
    s.mode = 4;
    s.modeUntil = now + RAIN_PREP;
    s.rainCenter = { ...target.location };
    setProp(e, "cb:state", 4);
    try { e.triggerEvent("cb:freeze"); } catch {}
    sound(e.dimension, "mob.evocation_illager.prepare_summon", e.location, 1.8, 0.9);
    if (isPlayer(target)) actionBar(target, T("guldan.rain"));
    return;
  }

  // Орки НЕ призываются от Гул'дана (Гул'дан призывает только демонов Скверны cb:fel_minion и Магического Инфернального Голема cb:inferno_golem)

  // СПОСОБНОСТЬ 5: Цепная Молния Скверны (перескакивает по цепочке врагов на средней дистанции)
  if (dist <= 18 && now >= s.chainReady) {
    s.chainReady = now + CHAIN_CD;
    s.busyUntil = now + 20;
    s.mode = 8;
    s.modeUntil = now + 16;
    setProp(e, "cb:state", 8);
    faceTarget(e, target);
    castChainFelLightning(e, target);
    return;
  }

  // СПОСОБНОСТЬ 3: Оковы Скверны / Клетка Тьмы (сковывает цель рунами Скверны)
  if (dist <= 20 && now >= s.shackleReady) {
    s.shackleReady = now + SHACKLE_CD;
    s.busyUntil = now + 20;
    s.mode = 3;
    s.modeUntil = now + 16;
    setProp(e, "cb:state", 3);
    faceTarget(e, target);
    try {
      target.addEffect("slowness", 70, { amplifier: 2, showParticles: true });
      target.addEffect("weakness", 100, { amplifier: 0, showParticles: true });
      target.addEffect("wither", 60, { amplifier: 0, showParticles: true });
    } catch {}
    activeShackles.push({
      dimId: String(e.dimension.id).replace("minecraft:", ""),
      targetId: target.id,
      until: now + 70
    });
    drawCircleFx(e.dimension, target.location, 1.3, 12, "minecraft:totem_particle", 0.3);
    sound(e.dimension, "mob.evocation_illager.cast_spell", target.location, 1.5, 1.15);
    if (isPlayer(target)) actionBar(target, T("guldan.curse"));
    return;
  }

  // СПОСОБНОСТЬ 1Б: Потоковое Похищение Жизни (для порабощения обычного орка или лечения)
  if ((hp < MAX_HP - 10 || isRegularOrc(target)) && dist <= 16 && now >= s.drainReady) {
    s.drainReady = now + DRAIN_CD;
    s.busyUntil = now + DRAIN_LEN + DRAIN_LOCK;
    s.mode = 2;
    s.modeUntil = now + DRAIN_LEN;
    s.drainTarget = target.id;
    setProp(e, "cb:state", 2);
    faceTarget(e, target);
    try { e.triggerEvent("cb:freeze"); } catch {}
    sound(e.dimension, "mob.evocation_illager.cast_spell", e.location, 1.6, 0.8);
    return;
  }

  // СПОСОБНОСТЬ 2: Сфера Скверны (одиночная в Фазе 1, веер из 3 сфер в Фазе 2)
  if (now >= s.orbReady) {
    s.orbReady = now + (s.phase === 2 ? 42 : ORB_CD);
    s.busyUntil = now + 18;
    s.mode = 1;
    s.modeUntil = now + 14;
    setProp(e, "cb:state", 1);
    faceTarget(e, target);
    if (s.phase === 2) {
      shootFelOrb(e, target, -0.16);
      shootFelOrb(e, target, 0);
      shootFelOrb(e, target, 0.16);
    } else {
      shootFelOrb(e, target, 0);
    }
  }
}


function triggerShardFromPromptEntity(ent) {
  if (!ent || !valid(ent)) return;
  let owner;
  try {
    const oid = ent.getDynamicProperty("cb:prompt_owner");
    if (oid) owner = world.getEntity(oid);
  } catch {}
  if (!owner) {
    try {
      owner = ent.dimension.getPlayers({ location: ent.location, maxDistance: 6 })
        .find((p) => p.getComponent("minecraft:equippable")?.getEquipment("Mainhand")?.typeId && isGolemArtifactId(p.getComponent("minecraft:equippable")?.getEquipment("Mainhand")?.typeId));
    } catch {}
  }
  if (owner && valid(owner)) {
    useSargerasScale(owner, system.currentTick);
  }
}

// Нажатие экранной кнопки «Вызвать Голема» (компонент minecraft:interact на cb:sargeras_prompt) или ПКМ/зажатие
world.afterEvents.dataDrivenEntityTrigger?.subscribe?.((ev) => {
  if (ev.eventId !== "cb:summon_golem_btn" || ev.entity?.typeId !== "cb:sargeras_prompt") return;
  triggerShardFromPromptEntity(ev.entity);
});

try {
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "cb:sargeras_use") return;
    if (ev.sourceEntity?.typeId === "cb:sargeras_prompt") {
      triggerShardFromPromptEntity(ev.sourceEntity);
    } else if (ev.sourceEntity && isPlayer(ev.sourceEntity)) {
      useSargerasScale(ev.sourceEntity, system.currentTick);
    }
  });
} catch {}

world.beforeEvents?.playerInteractWithEntity?.subscribe?.((ev) => {
  if (ev.target?.typeId !== "cb:sargeras_prompt") return;
  const p = ev.player;
  if (!p) return;
  system.run(() => useSargerasScale(p, system.currentTick));
});

world.afterEvents?.playerInteractWithEntity?.subscribe?.((ev) => {
  if (ev.target?.typeId !== "cb:sargeras_prompt") return;
  const p = ev.player;
  if (!p) return;
  useSargerasScale(p, system.currentTick);
});

world.afterEvents.itemUse?.subscribe?.((ev) => {
  const p = ev.source;
  if (!p || !isPlayer(p) || !isGolemArtifactId(ev.itemStack?.typeId)) return;
  useSargerasScale(p, system.currentTick);
});

world.beforeEvents?.itemUse?.subscribe?.((ev) => {
  const p = ev.source;
  if (!p || !isPlayer(p) || !isGolemArtifactId(ev.itemStack?.typeId)) return;
  system.run(() => useSargerasScale(p, system.currentTick));
});

world.afterEvents?.itemUseOn?.subscribe?.((ev) => {
  const p = ev.source;
  if (!p || !isPlayer(p) || !isGolemArtifactId(ev.itemStack?.typeId)) return;
  useSargerasScale(p, system.currentTick);
});

world.beforeEvents?.itemUseOn?.subscribe?.((ev) => {
  const p = ev.source;
  if (!p || !isPlayer(p) || !isGolemArtifactId(ev.itemStack?.typeId)) return;
  system.run(() => useSargerasScale(p, system.currentTick));
});

// Огненный удар Инфернального Голема (4 урона + поджог цели) и отслеживание врагов хозяина (как верный пёс!)
world.afterEvents.entityHitEntity.subscribe((ev) => {
  const a = ev.damagingEntity;
  const v = ev.hitEntity;
  if (!a || !v || !valid(v)) return;
  if (a.typeId === INFERNO_ID) {
    try { v.setOnFire(5, true); } catch {}
    fx(v.dimension, "minecraft:lava_particle", { x: v.location.x, y: v.location.y + 1.2, z: v.location.z });
    sound(v.dimension, "cb.inferno_golem.attack", v.location, 1.3, 1.0);
    fx(v.dimension, "cb:fel_green_flame", { x: v.location.x, y: v.location.y + 1.0, z: v.location.z });
  }
  if (isPlayer(a) && v.typeId === "cb:sargeras_prompt") {
    let heldId;
    try { heldId = a.getComponent("minecraft:equippable")?.getEquipment("Mainhand")?.typeId; } catch {}
    if (isGolemArtifactId(heldId)) {
      useSargerasScale(a, system.currentTick);
    }
    return;
  }
  if (isPlayer(a) && v.typeId !== INFERNO_ID && v.typeId !== "cb:hephaestus_golem" && v.typeId !== "minecraft:iron_golem") {
    try { v.addTag("cb_player_foe"); } catch {}
    playerEnemyMap.set(a.id, { enemyId: v.id, until: system.currentTick + 400 });
  }
});

world.afterEvents.entityHurt.subscribe((ev) => {
  const v = ev.hurtEntity;
  const a = ev.damageSource?.damagingEntity;
  if (v && a && isPlayer(v) && valid(a) && a.id !== v.id && !isPlayerGolem(a)) {
    try { a.addTag("cb_player_foe"); } catch {}
    playerEnemyMap.set(v.id, { enemyId: a.id, until: system.currentTick + 400 });
  }
});



world.afterEvents.entityDie.subscribe((ev) => {
  const dead = ev.deadEntity;
  if (!dead) return;
  if (dead.typeId === GULDAN) {
    states.delete(dead.id);
    const p = nearestPlayer(dead, 45);
    if (p) actionBar(p, T("guldan.defeated"));
    openEndRoomGate(dead.dimension, dead.location);
    return;
  }

});

system.runInterval(() => {
  const now = system.currentTick;

  // 0) Мгновенная проверка нажатия экранной кнопки «Вызвать Голема» через свойство cb:used на cb:sargeras_prompt
  for (const [pid, entId] of sargerasPrompts) {
    try {
      const pent = world.getEntity(entId);
      if (pent && valid(pent) && pent.getProperty("cb:used") === true) {
        const p = world.getEntity(pid);
        if (p && valid(p)) useSargerasScale(p, now);
      }
    } catch {}
  }

  // Поддержка экранной кнопки «Вызвать Голема», когда игрок держит в руках «Частичку Саргераса»
  if (now % 2 === 0) {
    const activeHolders = new Set();
    let allPlayers = [];
    try { allPlayers = world.getPlayers(); } catch {}
    for (const p of allPlayers) {
      if (!valid(p) || !alive(p)) continue;
      let heldItem;
      try { heldItem = p.getComponent("minecraft:equippable")?.getEquipment("Mainhand"); } catch {}
      const heldId = heldItem?.typeId;
      const ready = isGolemArtifactId(heldId) && now >= getShardReadyTick(p, heldItem);
      if (isGolemArtifactId(heldId) && ready) {
        activeHolders.add(p.id);
        let head = { x: p.location.x, y: p.location.y + 1.6, z: p.location.z };
        let v = { x: 0, y: 0, z: 1 };
        try { head = p.getHeadLocation(); v = p.getViewDirection(); } catch {}
        const px = head.x + v.x * 1.75;
        const py = head.y + v.y * 1.75 - 0.5;
        const pz = head.z + v.z * 1.75;
        let promptEnt = sargerasPrompts.has(p.id) ? world.getEntity(sargerasPrompts.get(p.id)) : undefined;
        if (!promptEnt || !valid(promptEnt)) {
          try {
            promptEnt = p.dimension.spawnEntity("cb:sargeras_prompt", { x: px, y: py, z: pz });
            promptEnt.setDynamicProperty("cb:prompt_owner", p.id);
            sargerasPrompts.set(p.id, promptEnt.id);
          } catch {}
        } else {
          try {
            promptEnt.teleport({ x: px, y: py, z: pz }, { keepVelocity: false });
          } catch {}
        }
      } else {
        removePromptForPlayer(p.id);
      }
    }
    for (const [pid] of sargerasPrompts) {
      if (!activeHolders.has(pid)) removePromptForPlayer(pid);
    }
  }


  // 0A) Полёт падающих с неба Метеоритов Скверны и рождение Магического Инфернального Голема
  for (let i = fallingMeteors.length - 1; i >= 0; i--) {
    const fm = fallingMeteors[i];
    let dim;
    try { dim = world.getDimension(fm.dimId); } catch { fallingMeteors.splice(i, 1); continue; }
    const tgt = fm.targetId ? world.getEntity(fm.targetId) : undefined;
    if (tgt && valid(tgt) && alive(tgt) && now < fm.hitTick - 6) {
      fm.targetLoc = { x: tgt.location.x, y: tgt.location.y, z: tgt.location.z };
    }
    if (now < fm.hitTick) {
      const frac = Math.min(1, Math.max(0, (now - fm.startTick) / Math.max(1, fm.hitTick - fm.startTick)));
      const mx = fm.startLoc.x + (fm.targetLoc.x - fm.startLoc.x) * frac;
      const my = fm.startLoc.y + (fm.targetLoc.y - fm.startLoc.y) * frac;
      const mz = fm.startLoc.z + (fm.targetLoc.z - fm.startLoc.z) * frac;
      fx(dim, "minecraft:huge_explosion_emitter", { x: mx, y: my, z: mz });
      fx(dim, "minecraft:totem_particle", { x: mx, y: my + 0.5, z: mz });
      fx(dim, "cb:fel_green_flame", { x: mx, y: my, z: mz });
      fx(dim, "minecraft:villager_happy", { x: mx, y: my, z: mz });
      if (now % 4 === 0) drawCircleFx(dim, fm.targetLoc, 2.6, 14, "minecraft:villager_happy", 0.25);
      continue;
    }
    fallingMeteors.splice(i, 1);
    const pOwner = fm.playerOwnerId ? world.getEntity(fm.playerOwnerId) : undefined;
    spawnMagicInfernoGolem(dim, fm.targetLoc, tgt, now, pOwner);
  }

  // Очистка временного огня от шагов Инфернального Голема
  for (let i = tempTrailFires.length - 1; i >= 0; i--) {
    const tf = tempTrailFires[i];
    if (now < tf.removeAt) continue;
    tempTrailFires.splice(i, 1);
    try {
      const dim = world.getDimension(tf.dimId);
      const blk = dim.getBlock({ x: tf.x, y: tf.y, z: tf.z });
      if (blk && blk.typeId === "minecraft:fire") {
        dim.runCommandAsync(`setblock ${tf.x} ${tf.y} ${tf.z} air`);
      }
    } catch {}
  }

  // 0B) Контроль 45-секундного времени жизни Магических Инфернальных Големов Гул'дана и огненно-зелёной ауры всех Инферналов
  if (now % 5 === 0) {
    for (const [gid, exp] of activeMagicGolems) {
      const g = world.getEntity(gid);
      if (!g || !valid(g) || !alive(g)) { activeMagicGolems.delete(gid); continue; }
      if (now >= exp) {
        activeMagicGolems.delete(gid);
        fx(g.dimension, "minecraft:huge_explosion_emitter", { x: g.location.x, y: g.location.y + 1.2, z: g.location.z });
        drawCircleFx(g.dimension, g.location, 2.0, 14, "minecraft:totem_particle", 0.5);
        sound(g.dimension, "random.explode", g.location, 1.4, 0.9);
        try { g.remove(); } catch {}
        continue;
      }
    }

    // Аура зелёного пламени Скверны на всех живых Инфернальных Големах + ИИ спутника игрока (бегает за хозяином как пёс и бьёт врагов!)
    for (const dimId of DIMENSIONS) {
      let dim;
      try { dim = world.getDimension(dimId); } catch { continue; }
      let golems = [];
      try { golems = dim.getEntities({ type: INFERNO_ID }); } catch { continue; }
      for (const g of golems) {
        if (!alive(g)) continue;
        if (now % 5 === 0) {
          fx(dim, "cb:fel_green_flame", {
            x: g.location.x + (Math.random() - 0.5) * 1.3,
            y: g.location.y + 1.4 + Math.random() * 1.4,
            z: g.location.z + (Math.random() - 0.5) * 1.3
          });
        }
        if (now % 10 === 0) {
          fx(dim, "minecraft:villager_happy", {
            x: g.location.x + (Math.random() - 0.5) * 1.4,
            y: g.location.y + 1.2 + Math.random() * 1.5,
            z: g.location.z + (Math.random() - 0.5) * 1.4
          });
          breakTreesAroundGolem(g);
        }
        igniteGroundBehindGolem(g, now);
        // Если это личный Инфернальный Голем игрока (cb:golem_type == 2)
        if (isPlayerGolem(g)) {
          let ownerId;
          try { ownerId = g.getDynamicProperty("cb:owner_id"); } catch {}
          const owner = ownerId ? world.getEntity(ownerId) : nearestPlayer(g, 32);
          if (!owner || !valid(owner) || !alive(owner)) continue;
          playerGolems.set(owner.id, g.id);

          // 1) Ищем врага хозяина (кого ударил хозяин, кто ударил хозяина, либо ближайшего враждебного моба)
          let foe;
          const rec = playerEnemyMap.get(owner.id);
          if (rec && now < rec.until) {
            const cand = world.getEntity(rec.enemyId);
            if (cand && valid(cand) && alive(cand) && cand.id !== owner.id && !sameSummonCipher(g, cand)) {
              foe = cand;
            }
          }
          if (!foe) {
            let bestD = 18;
            try {
              for (const m of dim.getEntities({ location: owner.location, maxDistance: 18 })) {
                if (!m || m.id === owner.id || m.id === g.id || !alive(m) || sameSummonCipher(g, m) || areAllies(g, m)) continue;
                const tid = m.typeId;
                const isHostile = tid === GULDAN || tid === "cb:fel_lord" || tid === "cb:green_orc" || tid === "cb:hell_orc" || tid === "cb:fel_minion" ||
                  tid === "cb:laestrygonian" || tid === "cb:cyclops" || tid === "cb:hydra" || tid === "cb:hydra_head" || tid === "cb:circe" ||
                  tid === "cb:minotaur" || tid === "cb:lich_king" || tid === "cb:ice_spirit" || tid === "cb:dreadlord" ||
                  tid === "cb:wild_troll" || tid === "cb:cannibal_troll" || tid === "cb:ice_troll" ||
                  (tid === INFERNO_ID && !isPlayerGolem(m)) ||
                  (() => { try { return m.getComponent("minecraft:type_family")?.hasTypeFamily?.("monster") === true || m.getComponent("minecraft:type_family")?.hasTypeFamily?.("undead") === true; } catch { return false; } })();
                if (!isHostile) continue;
                const d = Math.hypot(m.location.x - owner.location.x, m.location.z - owner.location.z);
                if (d < bestD) { bestD = d; foe = m; }
              }
            } catch {}
          }

          const distToOwner = Math.hypot(owner.location.x - g.location.x, owner.location.z - g.location.z);
          // Если хозяин ушёл далеко (> 22 блоков) — телепортируемся к хозяину как приручённый пёс!
          if (distToOwner > 22) {
            try {
              g.teleport({ x: owner.location.x + 2, y: owner.location.y, z: owner.location.z + 2 }, { keepVelocity: false });
            } catch {}
            continue;
          }

          // Если есть враг и хозяин не слишком далеко — атакуем и преследуем врага!
          if (foe && distToOwner <= 20) {
            const edx = foe.location.x - g.location.x;
            const edz = foe.location.z - g.location.z;
            const ed = Math.hypot(edx, edz) || 1;
            if (ed <= 3.2 && now % 15 === 0) {
              try {
                foe.applyDamage(4, { cause: EntityDamageCause.entityAttack, damagingEntity: g });
                foe.setOnFire(5, true);
                fx(dim, "minecraft:lava_particle", { x: foe.location.x, y: foe.location.y + 1.2, z: foe.location.z });
              } catch {}
            } else if (ed > 2.5 && g.isOnGround !== false) {
              try { g.applyImpulse({ x: (edx / ed) * 0.30, y: 0.04, z: (edz / ed) * 0.30 }); } catch {}
            }
          } else if (distToOwner > 5.0 && g.isOnGround !== false) {
            // Иначе бежим следом за хозяином как верный пёс!
            const odx = owner.location.x - g.location.x;
            const odz = owner.location.z - g.location.z;
            const od = Math.hypot(odx, odz) || 1;
            try { g.applyImpulse({ x: (odx / od) * 0.28, y: 0.04, z: (odz / od) * 0.28 }); } catch {}
          }
        }
      }
    }
  }

  // 1) Отрисовка рунных кругов призыва (в течение 5 секунд) и спавн 2 демонов Скверны
  for (let i = pendingMinions.length - 1; i >= 0; i--) {
    const pm = pendingMinions[i];
    let dim;
    try { dim = world.getDimension(pm.dimId); } catch { pendingMinions.splice(i, 1); continue; }
    if (now < pm.spawnAt) {
      if (now % 10 === 0) {
        for (const [ox, oz] of [[-1.8, 0.8], [1.8, 0.8]]) {
          drawCircleFx(dim, { x: pm.loc.x + ox, y: pm.loc.y, z: pm.loc.z + oz }, 0.9, 8, "minecraft:villager_happy", 0.2);
        }
      }
      continue;
    }
    pendingMinions.splice(i, 1);
    const tgt = pm.targetId ? world.getEntity(pm.targetId) : undefined;
    spawnFelMinionsPair(dim, pm.loc, tgt, now);
  }

  // 2) Обработка взрывных ловушек Скверны (после Тёмного Шага)
  for (let i = felTraps.length - 1; i >= 0; i--) {
    const tr = felTraps[i];
    let dim;
    try { dim = world.getDimension(tr.dimId); } catch { felTraps.splice(i, 1); continue; }
    if (now < tr.explodeAt) {
      if (now % 6 === 0) drawCircleFx(dim, tr.loc, 1.5, 10, "minecraft:villager_happy", 0.2);
      continue;
    }
    felTraps.splice(i, 1);
    fx(dim, "minecraft:large_explosion", { x: tr.loc.x, y: tr.loc.y + 0.5, z: tr.loc.z });
    drawCircleFx(dim, tr.loc, 2.5, 16, "minecraft:totem_particle", 0.4);
    sound(dim, "random.explode", tr.loc, 1.3, 1.2);
    const owner = tr.ownerId ? world.getEntity(tr.ownerId) : undefined;
    try {
      for (const m of dim.getEntities({ location: tr.loc, maxDistance: 3.8 })) {
        if (!m || !alive(m) || isFelAllyOrSelf(m) || SKIP_ABSORB.has(m.typeId)) continue;
        if (isPlayer(m) && !inSurvival(m)) continue;
        m.applyDamage(4, { cause: EntityDamageCause.magic, damagingEntity: owner });
      }
    } catch {}
  }

  // 3) Отрисовка клетки Оков Скверны вокруг скованной цели
  for (let i = activeShackles.length - 1; i >= 0; i--) {
    const sh = activeShackles[i];
    if (now >= sh.until) { activeShackles.splice(i, 1); continue; }
    if (now % 8 === 0) {
      const tgt = world.getEntity(sh.targetId);
      if (!tgt || !valid(tgt) || !alive(tgt)) { activeShackles.splice(i, 1); continue; }
      drawCircleFx(tgt.dimension, tgt.location, 1.0, 8, "minecraft:villager_happy", 0.2);
      drawCircleFx(tgt.dimension, tgt.location, 1.0, 8, "minecraft:totem_particle", 1.1);
    }
  }

  // 4) Контроль 30-секундного времени жизни и зелёных эссенций демонов Скверны
  if (now % 5 === 0) {
    for (const [mid, exp] of activeMinions) {
      const m = world.getEntity(mid);
      if (!m || !valid(m) || !alive(m)) { activeMinions.delete(mid); continue; }
      if (now >= exp) {
        activeMinions.delete(mid);
        fx(m.dimension, "minecraft:totem_particle", { x: m.location.x, y: m.location.y + 0.8, z: m.location.z });
        try { m.remove(); } catch {}
        continue;
      }
      if (now % 10 === 0) {
        fx(m.dimension, "minecraft:villager_happy", {
          x: m.location.x + (Math.random() - 0.5) * 0.9,
          y: m.location.y + 0.4 + Math.random() * 0.9,
          z: m.location.z + (Math.random() - 0.5) * 0.9
        });
      }
    }
  }

  for (const dimId of DIMENSIONS) {
    let dim;
    try { dim = world.getDimension(dimId); } catch { continue; }
    let list = [];
    try { list = dim.getEntities({ type: GULDAN }); } catch {}
    for (const e of list) {
      if (!alive(e)) continue;
      if (now % 20 === 0) applyBossDifficultyHp(e, 180);
      tickGuldan(e, now);
    }
    if (now % 40 === 0 && dimId === "overworld" && !gateOpened) {
      const isl = isleOf("guldan");
      if (isl?.built && isl?.populated && list.length === 0) {
        const ps = dim.getPlayers({ location: { x: isl.x, y: SEA + 4, z: isl.z - 11 }, maxDistance: 18 });
        if (ps.length > 0) openEndRoomGate(dim, { x: isl.x, y: SEA + 4, z: isl.z });
      }
    }
    // Стражи и слуги Гул'дана (зелёные, красные орки, демоны и рабы) держатся рядом со своим господином
    if (now % 40 === 0 && list.length > 0) {
      const boss = list[0];
      const allies = getFelAlliesNear(dim, boss.location, 36);
      for (const g of allies) {
        if (!nearestPlayer(g, 14)) {
          const d = Math.hypot(g.location.x - boss.location.x, g.location.z - boss.location.z);
          if (d > 13) {
            const dx = boss.location.x - g.location.x, dz = boss.location.z - g.location.z;
            const n = Math.hypot(dx, dz) || 1;
            try { g.applyImpulse({ x: (dx / n) * 0.32, y: 0.05, z: (dz / n) * 0.32 }); } catch {}
          }
        }
      }
    }
  }
}, 1);
