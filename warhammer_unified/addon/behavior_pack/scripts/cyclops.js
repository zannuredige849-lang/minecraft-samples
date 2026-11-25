// Механики Циклопа.
//  - Глаз (30 HP): попадания в глаз замедляют Циклопа; после 30 урона он слепнет.
//  - Захват: если рядом моб с <= 50% здоровья и макс. здоровьем <= 90
//    (слепой Циклоп — <= 150), Циклоп хватает его, подносит ко рту и съедает.
//  - Стиль атаки: ногами по низким целям, руками по высоким.
//  - Нападает на всех, кроме своих овец и коз. Игрока в овечьей шкуре принимает за овцу,
//    но каждые 30–40 с пересчитывает стадо: кто в шкуре и не пригнулся — раскрыт.
//  - Ночью засыпает (островной — на ложе в пещере). Будят его рассвет, удар, крик стада
//    и шаги рядом; пригнувшийся игрок может прокрасться мимо спящего.
//  - Защищает стадо: на того, кто при нём ударил овцу или козу, Циклоп идёт войной.
//    Зрячий должен это увидеть (обидчик перед ним и не за стеной), слепой — услышать вблизи.
import { world, system, EntityDamageCause } from "@minecraft/server";
import {
  EYE_UP, EYE_FORWARD, MOUTH_UP, MOUTH_FORWARD, EYE_STAND, EYE_SLEEP, EYE_LIE, EYE_POISON, EYE_EAT, EYE_SWING,
} from "./cyclops_layout.js";
import {
  DIMENSIONS, valid, alive, healthOf, isPlayer, inSurvival, sub, dot, len, lerp, smooth,
  toWorld, fx, sound, playersNear, actionBar, shared, bossName, breakAhead, moving, isTree, getDifficultyProfile, applyBossDifficultyHp,
} from "./util.js";
import { T } from "./i18n.js";

const CYCLOPS = "cb:cyclops";

const EYE_MAX = 30;
const EYE_PROP = "cb:eye_hp";
const EYE_RADIUS = 0.99;  // радиус «попадания» в глаз (0.9 + 10%: глаз стал крупнее на 10%)

const LIMIT_SIGHTED = 90;  // макс. здоровье жертвы, пока Циклоп видит
const LIMIT_BLIND = 150;   // ... и когда ослеп
const HEALTH_RATIO = 0.5;  // порог: 50% от максимального здоровья
const GRAB_RADIUS = 4.0;   // дальность захвата по горизонтали

const COOLDOWN = 40;

// Битва с Гидрой
const HYDRA = "cb:hydra";
const HYDRA_POISON = 600;   // съев гидру, Циклоп отравлен на 30 секунд
const HEAD_REACH = 6;       // как далеко Циклоп дотягивается до головы гидры
const POISON_SIT = 400;     // съев гидру, Циклоп 20 секунд сидит на земле, отравленный
const poisoned = new Map(); // id циклопа -> { until, t, loc, yaw }

// Хватка (свойство cb:hold) зависит от цели: 0 — обеими руками, 1 — игрока сдавливает
// в ладонях, 2 — мелкую добычу берёт одной правой рукой.
const HOLD_TWO = 0, HOLD_SQUEEZE = 1, HOLD_PINCH = 2;
const SMALL_HEIGHT = 0.9;   // ниже этого (по высоте головы) — мелкая добыча

// Способ съесть (свойство cb:eat) выбирается случайно. Таймлайн в тиках (20 тиков = 1 с)
// совпадает с анимациями animation.cyclops.eat_* (3.2 с). Путь жертвы — в локальных
// координатах Циклопа: [тик, вправо, вперёд, вверх].
const MF = MOUTH_FORWARD, MU = MOUTH_UP;
const EAT_STYLES = [
  { name: "bite", kill: 34, burp: 48, len: 64, sound: "cb.cyclops.chomp", path: [
    [12, 0, 2.6, 0.7], [18, 0, 2.6, 2.0], [30, 0, MF + 0.7, MU - 1.1], [34, 0, MF + 0.4, MU - 0.9]] },
  { name: "toss", kill: 37, burp: 52, len: 64, sound: "cb.cyclops.gulp", path: [
    [12, 0, 2.6, 0.7], [18, 0, 2.6, 2.0], [27, 0, MF + 0.9, MU - 1.3], [32, 0, MF + 0.4, MU + 1.1],
    [37, 0, MF + 0.2, MU - 0.5]] },
  { name: "swallow", kill: 44, burp: 56, len: 64, sound: "cb.cyclops.slurp", path: [
    [12, 0, 2.6, 0.7], [18, 0, 2.6, 2.0], [30, 0, MF + 0.3, MU + 0.2], [44, 0, MF + 0.15, MU - 0.7]] },
];
const PINCH_RIGHT = 1.3;    // мелкая добыча висит в правой руке, пока её не поднесут ко рту

// Стиль атаки (свойство cb:attack): 0 — прямой удар, 1 — двуручный удар сверху,
// 2 — пинок, 3 — топот, 4 — удар руками с разворота корпуса, 5 — апперкот (подбрасывает),
// 6 — удар наотмашь (отшвыривает вбок), 7 — хлопок ладонями (оглушает), 8 — удар кулаками
// оземь (ударная волна, по низким целям), 9 — двойка: тычок левой и прямой правой (второй удар).
// Цели ниже KICK_HEIGHT получают ногами и ударом оземь, выше — руками.
const HIGH_ATTACKS = [0, 1, 4, 5, 6, 7, 9];
const LOW_ATTACKS = [2, 3, 8];
const HYDRA_ATTACKS = [0, 1, 4];   // по головам гидры — прямые и размашистые удары, как раньше
const STOMP = 3;
const UPPERCUT = 5, BACKHAND = 6, CLAP = 7, POUND = 8, COMBO = 9;
const KICK_HEIGHT = 2.2;  // высота головы цели над ногами Циклопа (блоки)
const ATTACK_SCAN = 7;    // дальность поиска ближайшей цели

// ---------- овечья шкура и пересчёт стада ----------
const SHEEPSKIN = "cb:sheepskin";
const DISGUISE_TAG = "cb_disguised";
const FLOCK = new Set(["minecraft:sheep", "minecraft:goat"]);
const EXPOSED_TICKS = 1200;          // раскрытого игрока Циклоп помнит 60 секунд
const INSPECT_EVERY = [600, 800];    // пересчёт стада каждые 30–40 секунд
const INSPECT_LEN = 100;             // пересчёт длится 5 секунд
const INSPECT_GRACE = 20;            // первую секунду можно успеть пригнуться
const INSPECT_RADIUS = 16;

const IGNORE_TYPES = new Set([
  CYCLOPS,
  "cb:hydra_head",
  "cb:hydra_neck",
  "cb:hydra_spit",
  "cb:sargeras_prompt",
  "cb:lich_statue",
  "cb:fel_orb",
  "cb:circe_orb",
  "cb:fel_rain",
  "cb:hex_chicken",
  "cb:hex_goat",
  "cb:hex_pig",
  "cb:hex_sheep",
  "cb:hex_horse",
  "minecraft:armor_stand",
  "minecraft:ender_dragon",
  "minecraft:wither",
  "minecraft:item",
  "minecraft:xp_orb",
]);

const exposedUntil = new Map();   // id игрока -> тик, до которого маскировка не работает
const inspections = new Map();    // id циклопа -> { t }
const nextInspect = new Map();    // id циклопа -> тик следующего пересчёта
const forgetting = new Set();     // циклопы, которым на тик сняли цель

const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

const DYE_TO_SHEEPSKIN = {
  "minecraft:white_dye": "cb:sheepskin",
  "minecraft:orange_dye": "cb:sheepskin_orange",
  "minecraft:magenta_dye": "cb:sheepskin_magenta",
  "minecraft:light_blue_dye": "cb:sheepskin_light_blue",
  "minecraft:yellow_dye": "cb:sheepskin_yellow",
  "minecraft:lime_dye": "cb:sheepskin_lime",
  "minecraft:pink_dye": "cb:sheepskin_pink",
  "minecraft:gray_dye": "cb:sheepskin_gray",
  "minecraft:light_gray_dye": "cb:sheepskin_light_gray",
  "minecraft:cyan_dye": "cb:sheepskin_cyan",
  "minecraft:purple_dye": "cb:sheepskin_purple",
  "minecraft:blue_dye": "cb:sheepskin_blue",
  "minecraft:brown_dye": "cb:sheepskin_brown",
  "minecraft:green_dye": "cb:sheepskin_green",
  "minecraft:red_dye": "cb:sheepskin_red",
  "minecraft:black_dye": "cb:sheepskin_black",
};

export function isSheepskinId(id) {
  return typeof id === "string" && (id === SHEEPSKIN || id.startsWith("cb:sheepskin_"));
}

function wearsSheepskin(p) {
  try {
    const eq = p.getComponent("minecraft:equippable");
    return isSheepskinId(eq?.getEquipment("Chest")?.typeId);
  } catch {
    return false;
  }
}

function isDisguised(e) {
  try { return isPlayer(e) && e.hasTag(DISGUISE_TAG); } catch { return false; }
}

// Маскировка прямо сейчас: метка уже стоит или шкура надета, а игрок не раскрыт.
function disguisedNow(e) {
  if (!isPlayer(e)) return false;
  if (isDisguised(e)) return true;
  return wearsSheepskin(e) && (exposedUntil.get(e.id) ?? 0) <= system.currentTick;
}

function sneaking(p) {
  try { return !!p.isSneaking; } catch { return false; }
}

// Циклоп «забывает» цель: на тик снимаем поведение атаки, потом возвращаем.
function forget(c) {
  if (forgetting.has(c.id) || grabs.has(c.id) || inspections.has(c.id)) return;
  try { if (c.getProperty("cb:state") !== 0) return; } catch {}
  try {
    c.triggerEvent("cb:forget");
    forgetting.add(c.id);
  } catch {}
}

function expose(p, c, reason) {
  const now = system.currentTick;
  exposedUntil.set(p.id, now + EXPOSED_TICKS);
  try { p.removeTag(DISGUISE_TAG); } catch {}
  try {
    p.onScreenDisplay.setTitle(" ", { subtitle: T("cyc.saw_through"), fadeInDuration: 0, stayDuration: 40, fadeOutDuration: 10 });
  } catch {}
  if (c) {
    sound(c.dimension, "cb.cyclops.roar", c.location, 3, 1);
    for (const q of playersNear(c.dimension, c.location, 32)) {
      if (q.id !== p.id) actionBar(q, T("cyc.exposed", p.name ?? T("cyc.player")));
    }
  }
}

// Раз в полсекунды: кто в шкуре и не раскрыт — помечен тегом, этот тег видят фильтры целей Циклопа.
function updateDisguises(now) {
  let players = [];
  try { players = world.getPlayers(); } catch { return; }
  for (const p of players) {
    if (!valid(p)) continue;
    const want = wearsSheepskin(p) && (exposedUntil.get(p.id) ?? 0) <= now;
    const has = isDisguised(p);
    if (want && !has) {
      try { p.addTag(DISGUISE_TAG); } catch {}
      sound(p.dimension, "cb.sheepskin.wear", p.location, 1, 1);
      actionBar(p, T("cyc.took_for_sheep"));
      for (const c of p.dimension.getEntities({ type: CYCLOPS, location: p.location, maxDistance: 32 })) forget(c);
    } else if (!want && has) {
      try { p.removeTag(DISGUISE_TAG); } catch {}
    }
  }
  for (const [id, until] of exposedUntil) if (until <= now) exposedUntil.delete(id);
}

function startInspect(c) {
  inspections.set(c.id, { t: 0 });
  c.triggerEvent("cb:start_inspect");
  sound(c.dimension, "cb.cyclops.count", c.location, 2, 1);
  for (const p of playersNear(c.dimension, c.location, INSPECT_RADIUS + 8)) {
    if (!isDisguised(p)) continue;
    try {
      p.onScreenDisplay.setTitle(" ", {
        subtitle: T("cyc.counting"),
        fadeInDuration: 0, stayDuration: 40, fadeOutDuration: 10,
      });
    } catch {}
  }
}

function endInspect(c, now) {
  inspections.delete(c.id);
  nextInspect.set(c.id, now + randInt(...INSPECT_EVERY));
  if (!alive(c)) return;
  c.triggerEvent(isBlind(c) ? "cb:end_inspect_blind" : "cb:end_inspect_sighted");
}

function tickInspect(c, insp, now) {
  let hasTarget = false;
  try { hasTarget = !!c.target && alive(c.target); } catch {}
  if (hasTarget || disturbed(c)) {
    inspections.delete(c.id);
    try { c.triggerEvent(isBlind(c) ? "cb:end_inspect_blind" : "cb:end_inspect_sighted"); } catch {}
    return;
  }
  insp.t++;
  if (insp.t % 20 === 10) {
    for (const e of c.dimension.getEntities({ location: c.location, maxDistance: INSPECT_RADIUS })) {
      if (FLOCK.has(e.typeId)) { sound(c.dimension, "mob.sheep.say", e.location, 0.8, 1); break; }
    }
  }
  if (insp.t >= INSPECT_GRACE) {
    for (const p of playersNear(c.dimension, c.location, INSPECT_RADIUS)) {
      if (isDisguised(p) && inSurvival(p) && !sneaking(p)) {
        expose(p, c, isBlind(c) ? "He felt you among the sheep" : "You didn't sneak while he counted the sheep");
        endInspect(c, now);
        return;
      }
    }
  }
  if (insp.t >= INSPECT_LEN) {
    for (const p of playersNear(c.dimension, c.location, INSPECT_RADIUS)) {
      if (isDisguised(p)) actionBar(p, T("cyc.noticed_nothing"));
    }
    endInspect(c, now);
  }
}

const grabs = new Map();          // cyclopsId -> состояние сцены
const grabbedVictims = new Set(); // id жертв, которые уже в руках
const cooldowns = new Map();      // cyclopsId -> тик, до которого нельзя хватать
const pendingHits = new Map();    // cyclopsId -> { tick, eye, damage, attacker }
const pendingBlind = new Set();   // ослеп во время сцены — применим после неё
const attackRolls = new Map();    // cyclopsId -> случайный выбор внутри группы атак (0/1)
const lastAttackers = new Map();  // cyclopsId -> id того, кто последним ударил Циклопа

function isBlind(c) {
  try {
    return c.getProperty("cb:blind") === true;
  } catch {
    return false;
  }
}
function eyeHp(c) {
  const v = c.getDynamicProperty(EYE_PROP);
  return typeof v === "number" ? v : EYE_MAX;
}

// Где сейчас видимый глаз относительно ног и оси Циклопа: [вправо, вверх, вперёд] в блоках.
// Во сне, у отравленного, при поедании и в замахе корпус и голова смещаются, и зона попадания
// должна ехать вместе с нарисованным глазом (таблицы считает tools/cyclops.py по модели и анимациям).
function eyePose(c) {
  const sw = swings.get(c.id);
  if (sw) return EYE_SWING[sw.style]?.[Math.min(sw.t, 20)] ?? EYE_STAND;
  const g = grabs.get(c.id);
  if (g) return EYE_EAT[g.eat]?.[Math.min(Math.floor(g.t / 2), 32)] ?? EYE_STAND;
  let state;
  try { state = c.getProperty("cb:state"); } catch {}
  if (state === 3) return EYE_POISON;
  if (state === 4) {
    let lie = false;
    try { lie = c.getProperty("cb:lie") === true; } catch {}
    return lie ? EYE_LIE : EYE_SLEEP;
  }
  return EYE_STAND;
}

function eyeCenter(c) {
  const [right, up, fwd] = eyePose(c);
  const l = c.location;
  const v = c.getViewDirection();
  const n = Math.hypot(v.x, v.z) || 1;
  const fx = v.x / n, fz = v.z / n;   // вперёд; вправо — (-fz, fx)
  return { x: l.x + fx * fwd - fz * right, y: l.y + up, z: l.z + fz * fwd + fx * right };
}

// Проходит ли луч (origin, dir) через сферу глаза.
function rayHitsEye(origin, dir, eye, radius = EYE_RADIUS, maxDist = 12) {
  const d = len(dir);
  if (d === 0) return false;
  const nd = { x: dir.x / d, y: dir.y / d, z: dir.z / d };
  const w = sub(eye, origin);
  const t = dot(w, nd);
  if (t < 0 || t > maxDist) return false;
  const closest = { x: origin.x + nd.x * t, y: origin.y + nd.y * t, z: origin.z + nd.z * t };
  return len(sub(eye, closest)) <= radius;
}

// ---------- глаз ----------
shared.eyeOf = (c) => eyeCenter(c);
shared.hitEye = (c, amount, attacker) => damageEye(c, amount, attacker);
shared.isBlind = (c) => isBlind(c);

function damageEye(c, amount, attacker) {
  if (!alive(c) || isBlind(c) || pendingBlind.has(c.id)) return;
  let hp = eyeHp(c);
  if (hp <= 0) return;
  hp = Math.max(0, hp - amount);
  c.setDynamicProperty(EYE_PROP, hp);

  // замедление от боли
  try { c.addEffect("slowness", 80, { amplifier: 2, showParticles: false }); } catch {}

  const eye = eyeCenter(c);
  fx(c.dimension, "minecraft:critical_hit_emitter", eye);
  sound(c.dimension, "cb.cyclops.eye_hurt", eye, 1.5, 1);

  if (isPlayer(attacker)) {
    actionBar(attacker, T("cyc.eye_hit", Math.ceil(hp), EYE_MAX));
  }
  if (hp <= 0) {
    if (grabs.has(c.id) || poisoned.has(c.id)) pendingBlind.add(c.id);
    else applyBlind(c);
  }
}

function applyBlind(c) {
  if (!alive(c) || isBlind(c)) return;
  c.triggerEvent("cb:go_blind");
  const eye = eyeCenter(c);
  sound(c.dimension, "cb.cyclops.roar", c.location, 3, 0.85);
  for (let i = 0; i < 4; i++) fx(c.dimension, "minecraft:critical_hit_emitter", eye);
  for (const p of playersNear(c.dimension, c.location, 48)) {
    actionBar(p, T("cyc.blind"));
  }
}

function resolveHit(c, rec) {
  if (rec.eye === undefined || rec.damage === undefined) return;
  pendingHits.delete(c.id);
  if (rec.eye && rec.damage > 0) damageEye(c, rec.damage, rec.attacker);
}

// Снаряды: место попадания + направление полёта -> луч через глаз.
world.afterEvents.projectileHitEntity.subscribe((ev) => {
  const c = ev.getEntityHit()?.entity;
  if (!c || c.typeId !== CYCLOPS || isBlind(c)) return;
  const eye = eyeCenter(c);
  const dir = ev.hitVector ?? { x: 0, y: 0, z: 0 };
  const dl = len(dir) || 1;
  const back = { x: ev.location.x - (dir.x / dl) * 3, y: ev.location.y - (dir.y / dl) * 3, z: ev.location.z - (dir.z / dl) * 3 };
  const hitEye = len(sub(ev.location, eye)) <= EYE_RADIUS + 0.3 || rayHitsEye(back, dir, eye, EYE_RADIUS, 8);

  const rec = pendingHits.get(c.id) ?? {};
  rec.tick = system.currentTick;
  rec.eye = hitEye;
  rec.attacker = ev.source ?? rec.attacker;
  pendingHits.set(c.id, rec);
  resolveHit(c, rec);
});

world.afterEvents.entityHurt.subscribe((ev) => {
  const c = ev.hurtEntity;
  if (c.typeId !== CYCLOPS || isProvoking(c)) return;
  const src = ev.damageSource;
  if (sleepers.has(c.id)) wake(c, true, src.damagingEntity);
  if (stackers.has(c.id)) abortStack(c);
  if (src.damagingEntity) lastAttackers.set(c.id, src.damagingEntity.id);
  if (isDisguised(src.damagingEntity)) expose(src.damagingEntity, c, "Sheep don't fight the shepherd");
  if (isBlind(c)) return;

  if (src.cause === EntityDamageCause.projectile) {
    const rec = pendingHits.get(c.id) ?? {};
    rec.tick = system.currentTick;
    rec.damage = ev.damage;
    rec.attacker = rec.attacker ?? src.damagingEntity;
    pendingHits.set(c.id, rec);
    resolveHit(c, rec);
    return;
  }

  // Ближний бой: игрок смотрит точно в глаз
  const a = src.damagingEntity;
  if (isPlayer(a) && src.cause === EntityDamageCause.entityAttack) {
    try {
      if (rayHitsEye(a.getHeadLocation(), a.getViewDirection(), eyeCenter(c))) damageEye(c, ev.damage, a);
    } catch {}
  }
});

// ---------- зрение: видит ли Циклоп цель ----------
const SIGHT_COS = 0.34;   // конус обзора ±70° от взгляда
const FEEL_RADIUS = 4;    // вплотную чувствует и без взгляда

function sees(c, e, range) {
  if (!alive(c) || !valid(e) || isBlind(c) || sleepers.has(c.id)) return false;
  const hd = Math.hypot(e.location.x - c.location.x, e.location.z - c.location.z);
  if (hd <= FEEL_RADIUS) return true;
  try { if (e.getEffect?.("invisibility")) return false; } catch {}
  const eye = eyeCenter(c);
  let head;
  try { head = e.getHeadLocation(); } catch { head = { x: e.location.x, y: e.location.y + 1, z: e.location.z }; }
  const to = sub(head, eye);
  const d = len(to);
  if (d > range) return false;
  const v = c.getViewDirection();
  const vh = Math.hypot(v.x, v.z) || 1;
  const th = Math.hypot(to.x, to.z) || 1;
  if ((v.x * to.x + v.z * to.z) / (vh * th) < SIGHT_COS) return false;
  try {
    const hit = c.dimension.getBlockFromRay(eye, { x: to.x / d, y: to.y / d, z: to.z / d },
      { maxDistance: d, includeLiquidBlocks: false, includePassableBlocks: false });
    if (hit?.block) {
      const b = hit.block.location;
      if (len(sub({ x: b.x + 0.5, y: b.y + 0.5, z: b.z + 0.5 }, eye)) < d - 0.8) return false;
    }
  } catch {}
  return true;
}

function idle(c) {
  if (grabs.has(c.id) || poisoned.has(c.id) || inspections.has(c.id) || swings.has(c.id)) return false;
  try { return (c.getProperty("cb:state") ?? 0) === 0; } catch { return true; }
}

// «Подставной» удар в 1 HP от обидчика: так Циклоп (hurt_by_target) берёт в цель именно его.
// afterEvents приходят в конце тика, поэтому помним тик провокации.
const provoking = new Map();   // id циклопа -> тик
function isProvoking(c) {
  const t = provoking.get(c.id);
  return t !== undefined && system.currentTick - t <= 1;
}
function provoke(c, a) {
  if (!idle(c)) return;
  provoking.set(c.id, system.currentTick);
  try {
    c.applyDamage(1, { cause: EntityDamageCause.entityAttack, damagingEntity: a });
    const h = healthOf(c);
    if (h) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + 1));
  } catch {}
}

shared.cyclopsSees = (c, e, range) => sees(c, e, range);
shared.cyclopsIdle = (c) => idle(c);
shared.forgetCyclops = (c) => forget(c);
shared.isProvoking = (c) => isProvoking(c);
shared.isCyclopsFoe = (e) => isFoe(e);
shared.isSleeping = (c) => sleepers.has(c.id);
// Для проверок: начать замах заданным ударом.
shared.startCyclopsSwing = (c, v, style) => {
  endSwing(c);
  startSwing(c, v);
  swings.get(c.id).style = style;
  try { c.setProperty("cb:attack", style); } catch {}
};

// ---------- защита стада ----------
const FLOCK_SIGHT = 32;
const FLOCK_HEAR = 8;
world.afterEvents.entityHurt.subscribe((ev) => {
  const s = ev.hurtEntity;
  if (!FLOCK.has(s?.typeId)) return;
  const a = ev.damageSource?.damagingEntity;
  if (!valid(a) || a.typeId === CYCLOPS || FLOCK.has(a.typeId) || IGNORE_TYPES.has(a.typeId)) return;
  if (isPlayer(a) && !inSurvival(a)) return;
  let near = [];
  try { near = s.dimension.getEntities({ type: CYCLOPS, location: s.location, maxDistance: FLOCK_SIGHT }); } catch {}
  for (const c of near) {
    if (!alive(c)) continue;
      if (!c.hasTag('cb_init_sighted')) { try { c.addTag('cb_init_sighted'); if ((c.getProperty('cb:state') ?? 0) === 0 && !isBlind(c)) c.triggerEvent('cb:end_grab_sighted'); } catch {} }
    // крик стада будит спящего, если он рядом
    if (sleepers.has(c.id)) {
      if (Math.hypot(s.location.x - c.location.x, s.location.z - c.location.z) > FLOCK_HEAR) continue;
      wake(c, true);
    }
    const noticed = isBlind(c)
      ? Math.hypot(a.location.x - c.location.x, a.location.z - c.location.z) <= FLOCK_HEAR
      : sees(c, a, FLOCK_SIGHT);
    if (!noticed) continue;
    if (isPlayer(a) && (isDisguised(a) || wearsSheepskin(a))) expose(a, c, "You attacked his flock");
    if (!shared.grudge(c, a, true)) continue;
    provoke(c, a);
    sound(c.dimension, "cb.cyclops.roar", c.location, 3, 1);
    if (isPlayer(a)) actionBar(a, T("cyc.revenge"));
  }
});

// ---------- выбор атаки: ногами по низким целям, руками по высоким ----------
function isFoe(e) {
  if (IGNORE_TYPES.has(e.typeId) || FLOCK.has(e.typeId) || disguisedNow(e)) return false;
  if (isPlayer(e) && !inSurvival(e)) return false;
  return !!healthOf(e) && alive(e);
}

function nearestFoe(c) {
  let best, bestD = Infinity;
  for (const e of c.dimension.getEntities({ location: c.location, maxDistance: ATTACK_SCAN })) {
    if (e.id === c.id || !isFoe(e)) continue;
    const bonus = e.typeId === "minecraft:warden" ? 20 : (isPlayer(e) ? 3 : 0);
    const d = Math.hypot(e.location.x - c.location.x, e.location.z - c.location.z) - bonus;
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

const ALL_GROUND_ATTACKS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
function styleFor(c, foe) {
  let headY;
  try { headY = foe.getHeadLocation().y; } catch { headY = foe.location.y + 1.6; }
  const relH = headY - c.location.y;
  const roll = attackRolls.get(c.id) ?? 0;   // случайное число 0..1, новое после каждого удара
  let pool;
  if (foe.typeId === HYDRA) pool = HYDRA_ATTACKS;
  else if (relH < 1.1) pool = LOW_ATTACKS;   // мелкие мобы (пауки, жуки, волки) — пинок, топот, удар оземь
  else if (relH >= 2.8) pool = HIGH_ATTACKS; // высокие цели вверху — удары руками
  else pool = ALL_GROUND_ATTACKS;            // игроки, гуманоиды и боссы на земле — все 10 ударов Циклопа!
  return pool[Math.min(pool.length - 1, Math.floor(roll * pool.length))];
}

function updateAttackStyle(c) {
  if (grabs.has(c.id) || poisoned.has(c.id) || swings.has(c.id)) return;   // во время замаха вид удара не меняется
  const foe = nearestFoe(c);
  if (!foe) return;
  const style = styleFor(c, foe);
  try { if (c.getProperty("cb:attack") !== style) c.setProperty("cb:attack", style); } catch {}
}

// ---------- замах и удар: ведёт скрипт, анимация идёт по свойству cb:swing ----------
// Замах длится SWING_LEN тиков (анимации ударов — 1 с), урон — на тике SWING_HIT (кадр удара 0.55 с).
const SWING_LEN = 20;
const SWING_HIT = 11;
const SWING_REST = 6;      // передышка между ударами
const SWING_REACH = 5.0;   // руки и ноги великана достают на 5 блоков от его оси
const STOMP_HALF = 1.5;    // топот накрывает квадрат 3×3 блока
const swings = new Map();      // id циклопа -> { t, v, style }
const swingReady = new Map();  // id циклопа -> тик, с которого можно замахнуться снова
const struck = new Map();      // "циклоп:цель" -> тик удара, нанесённого замахом

const wasStruck = (c, v) => { const t = struck.get(`${c.id}:${v.id}`); return t !== undefined && system.currentTick - t <= 1; };

function inReach(c, e, extra = 0) {
  const hd = Math.hypot(e.location.x - c.location.x, e.location.z - c.location.z);
  const dy = e.location.y - c.location.y;
  return hd <= SWING_REACH + extra + (e.typeId === HYDRA ? 1.5 : 0) && dy > -2.5 && dy < 6;
}

function victimFor(c) {
  const island = c.hasTag?.("cb_island") && !isBlind(c);
  const ok = (e) => valid(e) && e.id !== c.id && (e.typeId === HYDRA || isFoe(e))
    && (!island || e.typeId === HYDRA || e.typeId === "minecraft:warden" || e.hasTag?.("cb_spotted"));
  // Если в радиусе удара есть Варден — Циклоп бьёт Вардена первым!
  let near = [];
  try { near = c.dimension.getEntities({ location: c.location, maxDistance: SWING_REACH + 3 }); } catch {}
  for (const e of near) {
    if (e.typeId === "minecraft:warden" && alive(e) && inReach(c, e, 1.0)) return e;
  }
  let t;
  try { t = c.target; } catch {}
  if (ok(t) && inReach(c, t)) return t;
  let best, bd = Infinity;
  for (const e of near) {
    if (!ok(e) || !inReach(c, e) || (isBlind(c) && Math.hypot(e.location.x - c.location.x, e.location.z - c.location.z) > 5)) continue;
    const d = Math.hypot(e.location.x - c.location.x, e.location.z - c.location.z) - (e.typeId === "minecraft:warden" ? 20 : 0);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function startSwing(c, v) {
  const style = styleFor(c, v);
  swings.set(c.id, { t: 0, v, style });
  try { c.setProperty("cb:attack", style); c.setProperty("cb:swing", true); } catch {}
  try { c.teleport(c.location, { facingLocation: { x: v.location.x, y: c.location.y, z: v.location.z } }); } catch {}
}

function endSwing(c) {
  if (!swings.delete(c.id)) return;
  swingReady.set(c.id, system.currentTick + SWING_REST);
  try { c.setProperty("cb:swing", false); } catch {}
}

function tickSwing(c, sw) {
  sw.t++;
  if (grabs.has(c.id) || poisoned.has(c.id) || sleepers.has(c.id) || inspections.has(c.id)) { endSwing(c); return; }
  if (sw.t === SWING_HIT) landBlow(c, sw);
  if (sw.t >= SWING_LEN) endSwing(c);
}

// Сплеш-урон Циклопа по ВСЕМ живым существам в радиусе удара!
function splashAllAround(c, center, primaryId, dmg, radius = 4.2) {
  const dim = c.dimension;
  fx(dim, "minecraft:large_explosion", { x: center.x, y: center.y + 0.5, z: center.z });
  let near = [];
  try { near = dim.getEntities({ location: center, maxDistance: radius }); } catch {}
  for (const e of near) {
    if (!e || e.id === c.id || e.id === primaryId || !alive(e) || IGNORE_TYPES.has(e.typeId)) continue;
    if (isPlayer(e) && !inSurvival(e)) continue;
    if (e.typeId === HYDRA) {
      const head = shared.hydraHeadNear?.(e, center);
      if (head && valid(head) && alive(head)) {
        try { head.applyDamage(dmg, { cause: EntityDamageCause.entityAttack, damagingEntity: c }); } catch {}
      }
      continue;
    }
    if (!healthOf(e)) continue;
    followUps.set(`${c.id}:${e.id}`, system.currentTick);
    try { e.applyDamage(dmg, { cause: EntityDamageCause.entityAttack, damagingEntity: c }); } catch {}
    const dx = e.location.x - c.location.x, dz = e.location.z - c.location.z;
    const n = Math.hypot(dx, dz) || 1;
    try { e.applyKnockback(dx / n, dz / n, 1.1, 0.38); } catch {}
  }
}

function landBlow(c, sw) {
  const v = sw.v;
  const dim = c.dimension;
  attackRolls.set(c.id, Math.random());   // следующий удар — другой
  if (sw.style === STOMP) { stompQuake(c, v); return; }
  if (!alive(v) || !inReach(c, v, 1.2)) {
    sound(dim, "cb.cyclops.swing", c.location, 1.2, 0.9);   // промах: только свист
    return;
  }
  const dmg = shared.diffDmg(isBlind(c) ? 14 + Math.floor(Math.random() * 3) : 10 + Math.floor(Math.random() * 3));
  if (v.typeId === HYDRA) {
    hydraBlow(c, v);
    splashAllAround(c, v.location, v.id, dmg, 4.2);
    return;
  }
  struck.set(`${c.id}:${v.id}`, system.currentTick);
  sound(dim, "cb.cyclops.swing", v.location, 1.3, 0.9);
  try { v.applyDamage(dmg, { cause: EntityDamageCause.entityAttack, damagingEntity: c }); } catch {}
  splashAllAround(c, v.location, v.id, dmg, 4.2);
}

// Топот: удар ногой в землю. Все враги в квадрате 3×3 вокруг цели получают урон,
// на секунду взлетают вверх (левитация) и потом замедлены.
function stompQuake(c, v) {
  const dim = c.dimension;
  const yaw = c.getRotation?.().y ?? 0;
  const at = alive(v) && inReach(c, v, 1.2) ? { ...v.location } : toWorld(c.location, yaw, 0.6, 2.2, 0);
  for (let i = 0; i < 5; i++) {
    fx(dim, "minecraft:explosion_particle", { x: at.x + (i % 3 - 1) * STOMP_HALF, y: at.y + 0.1, z: at.z + (i < 3 ? -1 : 1) * STOMP_HALF * 0.7 });
  }
  sound(dim, "cb.cyclops.step", at, 3, 0.5);
  let near = [];
  try { near = dim.getEntities({ location: at, maxDistance: 3.5 }); } catch {}
  for (const e of near) {
    if (e.id === c.id || e.typeId === HYDRA || IGNORE_TYPES.has(e.typeId) || !alive(e) || (isPlayer(e) && !inSurvival(e))) continue;
    if (Math.abs(e.location.x - at.x) > STOMP_HALF + 0.3 || Math.abs(e.location.z - at.z) > STOMP_HALF + 0.3) continue;
    const dy = e.location.y - at.y;
    if (dy < -1.5 || dy > 2.5) continue;
    followUps.set(`${c.id}:${e.id}`, system.currentTick);
    try { e.applyDamage(shared.diffDmg(isBlind(c) ? 9 : 6), { cause: EntityDamageCause.entityAttack, damagingEntity: c }); } catch {}
    try { e.addEffect("levitation", 20, { amplifier: 2, showParticles: false }); } catch {}
    try { e.addEffect("slowness", 100, { amplifier: 2, showParticles: true }); } catch {}
  }
}

// Тело гидры неуязвимо: удар Циклопа приходится в ближайшую к его кулаку голову (или шею).
function hydraBlow(c, h) {
  const fist = toWorld(c.location, c.getRotation?.().y ?? 0, 0, 2.2, 4.2);
  const head = shared.hydraHeadNear(h, fist);
  if (!head || Math.hypot(head.location.x - c.location.x, head.location.z - c.location.z) > HEAD_REACH) return;
  const dmg = shared.diffDmg(isBlind(c) ? 14 + Math.floor(Math.random() * 3) : 10 + Math.floor(Math.random() * 3));
  try { head.applyDamage(dmg, { cause: EntityDamageCause.entityAttack, damagingEntity: c }); } catch {}
  sound(c.dimension, "cb.cyclops.swing", head.location, 1.5, 0.8);
}

// ---------- особые удары руками ----------
const followUps = new Map();   // "циклоп:цель" -> тик «вторичного» удара (волна, второй удар двойки)
const isFollowUp = (c, v) => { const t = followUps.get(`${c.id}:${v.id}`); return t !== undefined && system.currentTick - t <= 1; };

function knock(e, dir, h, v) {
  try { e.applyKnockback(dir.x, dir.z, h, v); return; } catch {}
  try { e.applyKnockback({ x: dir.x * h, z: dir.z * h }, v); } catch {}
}
function flatDir(from, to) {
  const x = to.x - from.x, z = to.z - from.z;
  const n = Math.hypot(x, z) || 1;
  return { x: x / n, z: z / n };
}
function hitWith(c, v, dmg) {
  followUps.set(`${c.id}:${v.id}`, system.currentTick);
  try { v.applyDamage(dmg, { cause: EntityDamageCause.entityAttack, damagingEntity: c }); } catch {}
}

function attackEffect(c, v, cause) {
  if (cause !== EntityDamageCause.entityAttack || grabs.has(c.id) || !valid(v) || isFollowUp(c, v)) return;
  if ( IGNORE_TYPES.has(v.typeId) || v.typeId === HYDRA) return;
  let style;
  try { style = c.getProperty("cb:attack"); } catch { return; }
  const dim = c.dimension;
  const dir = flatDir(c.location, v.location);
  if (style === UPPERCUT) {
    knock(v, dir, 0.5, 1.1);
  } else if (style === BACKHAND) {
    const side = { x: dir.z * 0.85 + dir.x * 0.5, z: -dir.x * 0.85 + dir.z * 0.5 };
    knock(v, side, 2.4, 0.35);
    sound(dim, "cb.cyclops.swing", v.location, 1.5, 0.7);
  } else if (style === CLAP) {
    try { v.addEffect("nausea", 120, { amplifier: 0, showParticles: false }); } catch {}
    try { v.addEffect("slowness", 60, { amplifier: 2, showParticles: false }); } catch {}
    knock(v, dir, 0.3, 0.2);
    fx(dim, "minecraft:critical_hit_emitter", v.location);
    sound(dim, "cb.cyclops.squeeze", v.location, 2, 0.6);
  } else if (style === POUND) {
    const yaw = c.getRotation?.().y ?? 0;
    const at = toWorld(c.location, yaw, 0, 3, 0);
    for (let i = 0; i < 3; i++) fx(dim, "minecraft:explosion_particle", { x: at.x + (i - 1), y: at.y + 0.2, z: at.z });
    sound(dim, "cb.cyclops.step", at, 3, 0.55);
    knock(v, dir, 0.4, 0.7);
    let near = [];
    try { near = dim.getEntities({ location: at, maxDistance: 4.5 }); } catch {}
    for (const e of near) {
      if (e.id === c.id || e.id === v.id || !isFoe(e)) continue;
      hitWith(c, e, isBlind(c) ? 6 : 4);
      knock(e, flatDir(at, e.location), 0.6, 0.6);
    }
  } else if (style === COMBO) {
    system.runTimeout(() => {
      if (!alive(c) || !alive(v) || grabs.has(c.id) || sleepers.has(c.id)) return;
      if (Math.hypot(v.location.x - c.location.x, v.location.z - c.location.z) > 5.5) return;
      hitWith(c, v, isBlind(c) ? 6 : 4);
      sound(dim, "cb.cyclops.swing", v.location, 1.5, 1.2);
    }, 6);
  }
}

// После каждого удара Циклопа — особый эффект удара и новый случайный вариант внутри группы
// Особые эффекты — только у ударов замаха (движок урона не наносит: minecraft:attack с уроном 0).
world.afterEvents.entityHurt.subscribe((ev) => {
  const c = ev.damageSource?.damagingEntity;
  const v = ev.hurtEntity;
  if (c?.typeId !== CYCLOPS || !valid(v) || !wasStruck(c, v) || isFollowUp(c, v)) return;
  try { attackEffect(c, v, ev.damageSource.cause); } catch (e) { console.warn(`[cyclops] attack: ${e}`); }
});

// ---------- захват и поедание ----------
function canBeGrabbed(e, c, limit) {
  if (e.id === c.id || IGNORE_TYPES.has(e.typeId) || grabbedVictims.has(e.id)) return false;
  if (e.typeId === HYDRA) {
    // гидру целиком — только когда у неё осталась последняя голова
    const near = Math.hypot(e.location.x - c.location.x, e.location.z - c.location.z) <= GRAB_RADIUS + 1;
    return near && shared.hydraHeads(e) === 1;
  }
  if (FLOCK.has(e.typeId) || disguisedNow(e)) return false;
  const dx = e.location.x - c.location.x;
  const dz = e.location.z - c.location.z;
  const dy = e.location.y - c.location.y;
  if (Math.hypot(dx, dz) > GRAB_RADIUS || dy < -1.5 || dy > 4) return false;
  const h = healthOf(e);
  if (!h) return false;
  const max = h.effectiveMax;
  const cur = h.currentValue;
  if (cur <= 0 || max > limit || cur > max * HEALTH_RATIO) return false;
  if (isPlayer(e) && !inSurvival(e)) return false;
  return true;
}

function scan(now) {
  for (const id of DIMENSIONS) {
    let dim;
    try { dim = world.getDimension(id); } catch { continue; }
    for (const c of dim.getEntities({ type: CYCLOPS })) {
      if (!alive(c)) continue;
      if (!c.hasTag('cb_init_sighted')) { try { c.addTag('cb_init_sighted'); if ((c.getProperty('cb:state') ?? 0) === 0 && !isBlind(c)) c.triggerEvent('cb:end_grab_sighted'); } catch {} }

      // Восстановление после перезахода в мир: сцена прервалась, а состояние осталось
      if (!grabs.has(c.id) && !inspections.has(c.id)) {
        try {
          const state = c.getProperty("cb:state");
          if (state === 1) c.triggerEvent(isBlind(c) ? "cb:end_grab_blind" : "cb:end_grab_sighted");
          if (state === 2) c.triggerEvent(isBlind(c) ? "cb:end_inspect_blind" : "cb:end_inspect_sighted");
          if (state === 3 && !poisoned.has(c.id)) c.triggerEvent(isBlind(c) ? "cb:end_poison_blind" : "cb:end_poison_sighted");
          if (state === 4 && !sleepers.has(c.id)) {
            if (isNight()) sleepers.set(c.id, { t: 0 });
            else c.triggerEvent(isBlind(c) ? "cb:end_sleep_blind" : "cb:end_sleep_sighted");
          }
        } catch {}
        if (!isBlind(c) && eyeHp(c) <= 0) applyBlind(c);
      }

      if (now % 20 === 0) bossName(c);   // разноцветное имя над головой и на полоске босса
      if (stackers.has(c.id)) { tickStack(c, now); continue; }
      try { if (c.getProperty("cb:stack")) c.triggerEvent("cb:end_stack"); } catch {}   // после перезахода в мир
      if (sleepers.has(c.id)) { tickSleep(c, now); continue; }
      if (now % 15 === 0 && idle(c)) {
        try {
          const w = dim.getEntities({ location: c.location, maxDistance: 26, type: "minecraft:warden" }).find((x) => alive(x));
          if (w) {
            try { w.addTag("cb_spotted"); } catch {}
            provoke(c, w);
          }
        } catch {}
      }
      if (now % 4 === 0) updateAttackStyle(c);
      if (grabs.has(c.id) || inspections.has(c.id) || poisoned.has(c.id)) continue;
      if (now % 10 === 0) breakTrees(c);
      const swinging = swings.has(c.id);
      if (now % 20 === 0) applyBossDifficultyHp(c, 560);
      if (!swinging) {
        if (tryBedtime(c, now) || bedtime.has(c.id)) continue;
        const hasTarget = (() => { try { return !!c.target && alive(c.target); } catch { return false; } })();
        const foeNear = !!nearestFoe(c);
        if (!hasTarget && !foeNear && idle(c)) {
          if (!nextInspect.has(c.id)) nextInspect.set(c.id, now + randInt(...INSPECT_EVERY));
          if (now >= nextInspect.get(c.id)) {
            startInspect(c);
            continue;
          }
        }
      }
      // ослабевшую добычу хватает даже посреди замаха (замах прерывается)
      let grabbed = false;
      if ((cooldowns.get(c.id) ?? 0) <= now) {
        const dp = getDifficultyProfile();
        const limit = dp.cyclopsEatLimit;
        for (const e of dim.getEntities({ location: c.location, maxDistance: GRAB_RADIUS + 3 })) {
          if (canBeGrabbed(e, c, limit)) {
            startGrab(c, e);
            grabbed = true;
            break;
          }
        }
      }
      if (!grabbed && !swinging && (swingReady.get(c.id) ?? 0) <= now) {
        const v = victimFor(c);
        if (v) startSwing(c, v);
      }
    }
  }
}

// ---------- сон ----------
const NIGHT_FROM = 13000, NIGHT_TO = 23000;  // время суток (0..24000)
const CALM_NEED = 200;     // 10 секунд спокойствия ночью — и Циклоп ложится спать
const BED_WAIT = 600;      // островной 30 секунд идёт к ложу, потом спит где стоит
const WAKE_R = 5;          // шаги ближе 5 блоков будят
const WAKE_SNEAK_R = 1.8;  // пригнувшийся будит, только задев вплотную
const SNORE_EVERY = 70;
const sleepers = new Map();  // id -> { t }
const stackers = new Map();  // id -> { t, gate, bed } — выкладывает камни перед пещерой
const calm = new Map();      // id -> тики спокойствия
const bedtime = new Map();   // id -> тик, когда пошёл к ложу

function isNight() {
  try {
    const t = world.getTimeOfDay();
    return t >= NIGHT_FROM && t < NIGHT_TO;
  } catch {
    return false;
  }
}

// Ночью мешает уснуть: игрок-враг ближе 16 блоков или любой враг ближе 6.
function disturbed(c) {
  let near = [];
  try { near = c.dimension.getEntities({ location: c.location, maxDistance: 16 }); } catch {}
  for (const e of near) {
    if (e.id === c.id || !isFoe(e)) continue;
    if (isPlayer(e) || Math.hypot(e.location.x - c.location.x, e.location.z - c.location.z) <= 6) return true;
  }
  return false;
}

function stopBedtime(c) {
  if (!bedtime.delete(c.id)) return;
  try { c.triggerEvent("cb:leave_bed"); } catch {}
}

// Сено рядом (до HAY_R блоков на уровне ног): тогда Циклоп спит лёжа на нём, иначе — сидя.
export const HAY_R = 5;
export function findHay(dim, loc) {
  const x0 = Math.floor(loc.x), y0 = Math.floor(loc.y), z0 = Math.floor(loc.z);
  let sx = 0, sz = 0, sy = 0, n = 0;
  for (let dx = -HAY_R; dx <= HAY_R; dx++) {
    for (let dz = -HAY_R; dz <= HAY_R; dz++) {
      if (dx * dx + dz * dz > HAY_R * HAY_R) continue;
      for (const dy of [-1, 0]) {
        let id;
        try { id = dim.getBlock({ x: x0 + dx, y: y0 + dy, z: z0 + dz })?.typeId; } catch {}
        if (id === "minecraft:hay_block") { sx += x0 + dx + 0.5; sz += z0 + dz + 0.5; sy = Math.max(sy, y0 + dy + 1); n++; }
      }
    }
  }
  return n ? { x: sx / n, y: sy, z: sz / n, count: n } : undefined;
}

// Ломает деревья на пути: стволы и листву перед собой во весь рост.
export function breakTrees(c) {
  if (sleepers.has(c.id) || !moving(c)) return 0;
  const n = breakAhead(c, { reach: [1, 3], half: 2, from: 0, to: 6, match: isTree, max: 10 });
  if (n) sound(c.dimension, "cb.cyclops.swing", c.location, 1.5, 0.8);
  return n;
}

// ---------- Циклоп закладывает вход в пещеру камнями ----------
const STACK_BEAT = 24;       // один «камень» (столбец стены) — 1,2 с анимации
const STACK_PLACE = 18;      // на этом тике такта камень ложится на место

function startStack(c, gate, bed, teleport) {
  bedtime.delete(c.id);
  stackers.set(c.id, { t: 0, gate, bed });
  c.triggerEvent("cb:start_stack");
  const start = { x: gate.x, y: gate.y, z: gate.z - gate.half };
  try { c.teleport(teleport ? start : { x: gate.x, y: c.location.y, z: c.location.z }, { rotation: { x: 0, y: gate.yaw } }); } catch {}
}

function endStack(c) {
  stackers.delete(c.id);
  try { c.triggerEvent("cb:end_stack"); } catch {}
}

function abortStack(c) {
  if (!stackers.has(c.id)) return;
  endStack(c);
  shared.openCave?.(c);
  calm.set(c.id, -600);
}

function tickStack(c, now) {
  const s = stackers.get(c.id);
  s.t += 2;
  if (!isNight() || disturbed(c)) { abortStack(c); return; }
  const slices = s.gate.half * 2 + 1;
  const beat = Math.min(Math.floor(s.t / STACK_BEAT), slices - 1);
  const phase = s.t - beat * STACK_BEAT;
  // шагает вдоль стены к очередному столбцу
  const z = s.gate.z - s.gate.half + beat;
  if (phase <= 10) {
    const nz = c.location.z + (z - c.location.z) * 0.35;
    try { c.teleport({ x: s.gate.x, y: s.gate.y, z: nz }, { rotation: { x: 0, y: s.gate.yaw } }); } catch {}
  }
  if (phase === STACK_PLACE && s.placed !== beat) {
    s.placed = beat;
    shared.stackSlice?.(c, beat);
    sound(c.dimension, "cb.cyclops.swing", c.location, 1.5, 0.6);
  }
  if (s.t >= slices * STACK_BEAT + 10) {
    endStack(c);
    startSleep(c, s.bed, s.bed.yaw, true);
  }
}

function startSleep(c, loc, yaw, atBed = false) {
  bedtime.delete(c.id);
  sleepers.set(c.id, { t: 0 });
  const hay = findHay(c.dimension, loc);
  c.triggerEvent("cb:start_sleep");
  try { c.setProperty("cb:lie", !!hay); } catch {}
  try { c.teleport(hay ? { x: hay.x, y: hay.y, z: hay.z } : loc, { rotation: { x: 0, y: yaw } }); } catch {}
  sound(c.dimension, "cb.cyclops.sit", c.location, 2, 1);
  if (atBed) shared.sealCave?.(c);           // островной: заваливает вход в пещеру камнем
  for (const p of playersNear(c.dimension, c.location, 24)) {
    actionBar(p, T("cyc.asleep"));
  }
}

function wake(c, angry, who) {
  if (!sleepers.delete(c.id)) return;
  try { c.setProperty("cb:lie", false); } catch {}
  shared.openCave?.(c);                       // отваливает камень от входа
  calm.set(c.id, angry ? -600 : 0);   // разбуженный 30 секунд не уснёт снова
  if (alive(c)) c.triggerEvent(isBlind(c) ? "cb:end_sleep_blind" : "cb:end_sleep_sighted");
  sound(c.dimension, "cb.cyclops.getup", c.location, 2, 1);
  if (!angry) {
    sound(c.dimension, "cb.cyclops.yawn", c.location, 2, 1);
    return;
  }
  sound(c.dimension, "cb.cyclops.roar", c.location, 3, 1);
  if (valid(who) && who.typeId !== CYCLOPS && !FLOCK.has(who.typeId)) {
    if (isPlayer(who)) actionBar(who, T("cyc.woke"));
    if (shared.grudge(c, who, false)) provoke(c, who);
  }
}

function tickSleep(c, now) {
  const s = sleepers.get(c.id);
  s.t += 2;
  if ((s.t - 2) % SNORE_EVERY === 0) sound(c.dimension, "cb.cyclops.snore", { x: c.location.x, y: c.location.y + 3, z: c.location.z }, 1.5, 1);
  if (!isNight()) { wake(c, false); return; }
  for (const p of playersNear(c.dimension, c.location, WAKE_R)) {
    if (!isFoe(p)) continue;   // творческий режим и «овца» в шкуре не будят
    const d = Math.hypot(p.location.x - c.location.x, p.location.z - c.location.z);
    if (!sneaking(p) || d <= WAKE_SNEAK_R) { wake(c, true, p); return; }
  }
}

// Ночью, если вокруг спокойно, ложится спать (островной сначала идёт к ложу в пещере).
function tryBedtime(c, now) {
  if (!isNight() || !idle(c)) { stopBedtime(c); if (!isNight()) calm.delete(c.id); return false; }
  if (disturbed(c)) { calm.set(c.id, Math.min(0, calm.get(c.id) ?? 0)); stopBedtime(c); return false; }
  const k = (calm.get(c.id) ?? 0) + 2;
  calm.set(c.id, k);
  if (k < CALM_NEED) return false;
  const yaw = c.getRotation?.().y ?? 0;
  const bed = shared.cyclopsBed(c);
  if (!bed) { startSleep(c, { ...c.location }, yaw); return true; }
  const gate = shared.cyclopsGate?.(c);
  const needWall = gate && !gate.sealed;
  // проходит через тоннель — по пути выкладывает стену из камней у входа (на всю ширину, 3 блока в высоту)
  if (needWall && gate.inZone(c.location)) { startStack(c, gate, bed, false); return true; }
  if (Math.hypot(bed.x - c.location.x, bed.z - c.location.z) <= 3.5) {
    if (needWall) startStack(c, gate, bed, true); else startSleep(c, bed, bed.yaw, true);
    return true;
  }
  if (!bedtime.has(c.id)) {
    bedtime.set(c.id, now);
    try { c.triggerEvent("cb:go_to_bed"); } catch {}
  } else if (now - bedtime.get(c.id) >= BED_WAIT) {
    // никто не смотрит — «дошёл» до ложа; при свидетелях засыпает где стоит
    if (playersNear(c.dimension, c.location, 32).length) startSleep(c, { ...c.location }, yaw);
    else if (needWall) startStack(c, gate, bed, true);
    else startSleep(c, bed, bed.yaw, true);
    return true;
  }
  return false;
}

function holdFor(v) {
  if (isPlayer(v)) return HOLD_SQUEEZE;
  let h = 1.6;
  try { h = v.getHeadLocation().y - v.location.y; } catch {}
  return h < SMALL_HEIGHT ? HOLD_PINCH : HOLD_TWO;
}

function startGrab(c, v) {
  const dx = v.location.x - c.location.x;
  const dz = v.location.z - c.location.z;
  const yaw = (Math.atan2(-dx, dz) * 180) / Math.PI;
  const hold = holdFor(v);
  const eat = Math.floor(Math.random() * EAT_STYLES.length);
  try { c.setProperty("cb:hold", hold); c.setProperty("cb:eat", eat); } catch {}
  if (v.typeId === HYDRA) {
    shared.holder.set(v.id, c);
    for (const p of playersNear(c.dimension, c.location, 48)) actionBar(p, T("cyc.grabbed_hydra"));
  }
  const g = {
    hold,
    isHydra: v.typeId === HYDRA,
    style: EAT_STYLES[eat],
    eat,
    c,
    v,
    vId: v.id,
    t: 0,
    yaw,
    cLoc: { ...c.location },
    vStart: { ...v.location },
    eaten: false,
  };
  grabs.set(c.id, g);
  grabbedVictims.add(v.id);
  endSwing(c);

  c.triggerEvent("cb:start_grab");
  try { c.teleport(g.cLoc, { rotation: { x: 0, y: yaw } }); } catch {}
  sound(c.dimension, "cb.cyclops.grab", c.location, 2, 1);

  if (isPlayer(v)) {
    try {
      v.onScreenDisplay.setTitle(" ", { subtitle: T("cyc.grabbed_you"), fadeInDuration: 0, stayDuration: 40, fadeOutDuration: 10 });
    } catch {}
  }
}

function victimPos(g) {
  const t = g.t;
  const PATH = g.style.path;
  // в правой руке добыча смещена вправо, пока её не поднесли ко рту
  const right = (p) => (g.hold === HOLD_PINCH ? PINCH_RIGHT * Math.max(0, 1 - Math.max(0, p[0] - 18) / 12) : 0) + p[1];
  const pt = (p) => toWorld(g.cLoc, g.yaw, right(p), p[2], p[3]);
  if (t <= PATH[0][0]) return lerp(g.vStart, pt(PATH[0]), smooth(t / PATH[0][0]));
  for (let i = 1; i < PATH.length; i++) {
    const [t0] = PATH[i - 1];
    const [t1] = PATH[i];
    if (t <= t1) return lerp(pt(PATH[i - 1]), pt(PATH[i]), smooth((t - t0) / (t1 - t0)));
  }
  return pt(PATH[PATH.length - 1]);
}

function eat(g) {
  g.eaten = true;
  const { c, v } = g;
  const vh = healthOf(v);
  const victimMax = vh?.effectiveMax ?? 20;
  const mouth = toWorld(g.cLoc, g.yaw, 0, MOUTH_FORWARD + 0.1, MOUTH_UP - 0.2);

  for (let i = 0; i < 3; i++) fx(c.dimension, "minecraft:critical_hit_emitter", mouth);
  fx(c.dimension, "minecraft:basic_smoke_particle", mouth);
  sound(c.dimension, g.style.sound, mouth, 2, 1);

  if (v.typeId === HYDRA) {
    // тело гидры неуязвимо — её «съедает» модуль гидры; а яд гидры травит Циклопа
    shared.holder.delete(v.id);
    shared.devourHydra(v, c);
    try { c.addEffect("poison", HYDRA_POISON, { amplifier: 1 }); } catch {}
    try { c.addEffect("nausea", 200, { amplifier: 0 }); } catch {}
    for (const p of playersNear(c.dimension, c.location, 48)) actionBar(p, T("cyc.poisoned"));
  } else {
    try {
      v.applyDamage(100000, { cause: EntityDamageCause.entityAttack, damagingEntity: c });
    } catch {}
    system.runTimeout(() => {
      try { if (alive(v)) v.kill(); } catch {}
    }, 1);
  }

  // Сытый Циклоп немного лечится: 10% от максимального здоровья жертвы, минимум 4
  const ch = healthOf(c);
  if (ch) {
    try { ch.setCurrentValue(Math.min(ch.effectiveMax, ch.currentValue + Math.max(4, victimMax * 0.1))); } catch {}
  }
  grabbedVictims.delete(g.vId);
}

function release(id, g) {
  grabs.delete(id);
  grabbedVictims.delete(g.vId);
  shared.holder.delete(g.vId);
}

function finish(id, g, now) {
  release(id, g);
  const c = g.c;
  if (!alive(c)) return;
  if (g.isHydra && g.eaten) {
    startPoison(c, g, now);
    return;
  }
  c.triggerEvent(isBlind(c) ? "cb:end_grab_blind" : "cb:end_grab_sighted");
  cooldowns.set(id, now + COOLDOWN);
  if (pendingBlind.delete(id)) applyBlind(c);
}

// ---------- отравление гидрой: 20 секунд сидит на земле ----------
function startPoison(c, g, now) {
  poisoned.set(c.id, { until: now + POISON_SIT, t: 0, loc: { ...g.cLoc }, yaw: g.yaw });
  c.triggerEvent("cb:start_poison");
  sound(c.dimension, "cb.cyclops.sit", c.location, 2.5, 1);
  for (const p of playersNear(c.dimension, c.location, 48)) actionBar(p, T("cyc.sick"));
}

function endPoison(c, now) {
  poisoned.delete(c.id);
  cooldowns.set(c.id, now + COOLDOWN);
  if (!alive(c)) return;
  sound(c.dimension, "cb.cyclops.getup", c.location, 2, 1);
  sound(c.dimension, "cb.cyclops.roar", c.location, 3, 0.9);
  c.triggerEvent(isBlind(c) ? "cb:end_poison_blind" : "cb:end_poison_sighted");
  if (pendingBlind.delete(c.id)) applyBlind(c);
}

function tickPoison(c, ps, now) {
  ps.t++;
  try { c.teleport(ps.loc, { rotation: { x: 0, y: ps.yaw } }); } catch {}
  const mouth = toWorld(ps.loc, ps.yaw, 0, MOUTH_FORWARD + 0.3, MOUTH_UP - 2.2);   // сидя рот ниже
  const phase = ps.t % 70;
  if (phase === 5) sound(c.dimension, "cb.cyclops.hurt", c.location, 1.5, 0.55);           // стон
  if (phase === 18) sound(c.dimension, "cb.cyclops.retch", mouth, 1.5, 1);                 // рвотный позыв
  if (phase === 30) {
    sound(c.dimension, "cb.cyclops.gulp", mouth, 1.5, 0.8);                               // давится
    for (let k = 0; k < 3; k++) fx(c.dimension, "minecraft:basic_smoke_particle", mouth);
  }
  if (phase === 52) sound(c.dimension, "cb.cyclops.burp", mouth, 2, 0.8);                // отрыжка
  if (now >= ps.until) endPoison(c, now);
}

function tickGrab(id, g, now) {
  g.t++;
  if (!alive(g.c)) {
    // Циклоп погиб посреди сцены — жертва свободна
    release(id, g);
    pendingBlind.delete(id);
    return;
  }

  if (!g.eaten) {
    if (!alive(g.v)) {
      g.eaten = true;
      grabbedVictims.delete(g.vId);
    } else if (g.t >= g.style.kill) {
      eat(g);
    } else {
      try {
        g.v.teleport(victimPos(g), {
          dimension: g.c.dimension,
          keepVelocity: false,
          facingLocation: toWorld(g.cLoc, g.yaw, 0, MOUTH_FORWARD - 0.1, MOUTH_UP - 0.4),
        });
      } catch {}
    }
  }

  // держим Циклопа на месте и лицом к жертве
  try { g.c.teleport(g.cLoc, { rotation: { x: 0, y: g.yaw } }); } catch {}

  // звуки по ходу сцены: сдавливание игрока, подброс, хлюпанье, отрыжка
  const dim = g.c.dimension;
  if (g.hold === HOLD_SQUEEZE && !g.eaten && (g.t === 16 || g.t === 22 || g.t === 28)) {
    sound(dim, "cb.cyclops.squeeze", victimPos(g), 1.5, 1);
  }
  if (g.style.name === "toss" && g.t === 28) sound(dim, "cb.cyclops.swing", victimPos(g), 1.5, 1.3);
  if (g.style.name === "swallow" && g.t === 31) sound(dim, "cb.cyclops.slurp", victimPos(g), 1.5, 0.9);
  if (g.t === g.style.burp) sound(dim, "cb.cyclops.burp", g.c.location, 2, 1);
  if (g.t >= g.style.len) finish(id, g, now);
}

system.runInterval(() => {
  const now = system.currentTick;

  for (const [id, rec] of pendingHits) {
    if (now - rec.tick > 3) pendingHits.delete(id);
  }
  for (const [k, t] of followUps) if (now - t > 2) followUps.delete(k);
  for (const [k, t] of struck) if (now - t > 2) struck.delete(k);
  for (const [id, sw] of swings) {
    let c;
    try { c = world.getEntity(id); } catch {}
    if (!alive(c)) { swings.delete(id); continue; }
    try { tickSwing(c, sw); } catch (e) { console.warn(`[cyclops] swing: ${e}`); swings.delete(id); }
  }
  for (const [id, until] of cooldowns) {
    if (until <= now) cooldowns.delete(id);
  }

  // вернуть атаку тем, кому на тик сняли цель
  for (const id of forgetting) {
    forgetting.delete(id);
    try {
      const c = world.getEntity(id);
      if (alive(c)) c.triggerEvent(isBlind(c) ? "cb:remember_blind" : "cb:remember_sighted");
    } catch {}
  }
  if (now % 10 === 0) {
    try { updateDisguises(now); } catch (e) { console.warn(`[cyclops] disguise: ${e}`); }
  }
  for (const [id, ps] of poisoned) {
    let c;
    try { c = world.getEntity(id); } catch {}
    if (!alive(c)) { poisoned.delete(id); pendingBlind.delete(id); continue; }
    try { tickPoison(c, ps, now); } catch (e) { console.warn(`[cyclops] poison: ${e}`); poisoned.delete(id); }
  }
  for (const [id, insp] of inspections) {
    let c;
    try { c = world.getEntity(id); } catch {}
    if (!alive(c)) { inspections.delete(id); continue; }
    try { tickInspect(c, insp, now); } catch (e) { console.warn(`[cyclops] inspect: ${e}`); inspections.delete(id); }
  }
  if (now % 2 === 0) {
    try { scan(now); } catch (e) { console.warn(`[cyclops] scan: ${e}`); }
  }
  for (const [id, g] of grabs) {
    try { tickGrab(id, g, now); } catch (e) { console.warn(`[cyclops] grab: ${e}`); release(id, g); }
  }
}, 1);

// Погиб во сне — камень у входа в пещеру больше некому держать: вход открывается.
world.afterEvents.entityDie.subscribe((ev) => {
  const c = ev.deadEntity;
  if (c?.typeId !== CYCLOPS) return;
  if (sleepers.delete(c.id)) shared.openCave?.(c);
  else if (stackers.delete(c.id)) shared.openCave?.(c);
});

// Покраска надетой накидки овечьей шкуры красителем в руке (в дополнение к покраске в верстаке/инвентаре)
import { ItemStack } from "@minecraft/server";
try {
  world.afterEvents.itemUse?.subscribe((ev) => {
    const p = ev.source;
    const dyeId = ev.itemStack?.typeId;
    const targetSkinId = DYE_TO_SHEEPSKIN[dyeId];
    if (!targetSkinId || !isPlayer(p)) return;
    try {
      const eq = p.getComponent("minecraft:equippable");
      const chest = eq?.getEquipment("Chest");
      if (!chest || !isSheepskinId(chest.typeId) || chest.typeId === targetSkinId) return;
      const newSkin = new ItemStack(targetSkinId, 1);
      const oldDur = chest.getComponent?.("minecraft:durability");
      const newDur = newSkin.getComponent?.("minecraft:durability");
      if (oldDur && newDur) newDur.damage = oldDur.damage;
      eq.setEquipment("Chest", newSkin);
      if (inSurvival(p)) {
        if (ev.itemStack.amount > 1) {
          ev.itemStack.amount -= 1;
          eq.setEquipment("Mainhand", ev.itemStack);
        } else {
          eq.setEquipment("Mainhand", undefined);
        }
      }
      sound(p.dimension, "item.book.put", p.location, 1.0, 1.2);
    } catch {}
  });
} catch {}
