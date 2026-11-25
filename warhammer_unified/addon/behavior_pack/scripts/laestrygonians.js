// Лестригоны — великаны-людоеды с острова Телепил (см. isles.js: остров и стая из 10–15).
//  - Ломают листву на пути: взмах левой рукой (свойство cb:swipe → анимация), листья осыпаются.
//  - Два удара мечом — рубящий сверху и размашистый сбоку (свойство cb:style меняется время от времени,
//    сам удар ведёт поведение моба, анимация идёт по variable.attack_time).
//  - Боевой клич, когда замечают игрока (cb:roar → анимация и рёв), не чаще раза в 30 с.
//  - Урон 6,5–7,5 у лестригона и 6,5 у меча лестригона: Bedrock даёт только целый урон,
//    недостающие 0,5 скрипт снимает со здоровья цели сразу после удара.
//  - Дальний удар мечом лестригона: правая кнопка (на телефоне — долгое нажатие) — выпад на 5,5 блока
//    по взгляду (обычный удар бьёт на 3) с анимацией выпада у игрока. Пронзает насквозь: ранит всех
//    на линии удара. Урон тот же 6,5 каждому, отбрасывание, тратит прочность (1 за выпад); не чаще раза
//    в 0,6 с; стена останавливает выпад. Обычный удар левой кнопкой Bedrock удлинить не даёт.
//  - Стая мстит: ранили лестригона — все лестригоны в 32 блоках нападают на обидчика (метка cb_laes_foe,
//    группа cb:alerted), кем бы он ни был, и впадают в ярость: на 7,5% быстрее, над головой злые
//    частицы. Через 30 с без новых обид тревога и ярость спадают.
import { world, system, EntityDamageCause } from "@minecraft/server";
import { DIMENSIONS, valid, alive, isPlayer, inSurvival, sound, fx, playersNear, breakAhead, moving, isLeaves , shared } from "./util.js";

export const LAESTRYGONIAN = "cb:laestrygonian";
export const SWORD = "cb:laestrygonian_sword";
export const EXTRA_DAMAGE = 0.5;
export const SWIPE_TICKS = 20;          // анимация взмаха 0,5 с
export const ROAR_TICKS = 60;           // боевой клич 1,5 с
export const ROAR_COOLDOWN = 600;       // не чаще раза в 30 с
export const ROAR_RANGE = 16;
export const STYLE_EVERY = 40;
export const REACH = 5.5;               // дальний удар мечом: 5,5 блока (обычный — 3)
export const LUNGE_COOLDOWN = 24;       // 1,2 с — замедленный выпад меча
export const ATTACK_ANIM_TICKS = 36;    // 1,8 с — медленная анимация удара лестригона
export const ATTACK_CD_TICKS = 70;      // 3,5 с — пауза между ударами лестригона
export const LUNGE_DAMAGE = 6;          // + 0,5 добавляет обработчик ниже = 6,5
export const SWEEP_R = 3.5;             // размах кописы: все враги в 3,5 блоках от жертвы
export const SWEEP_DAMAGE = 4;
export const ORC_CRUSH = 3;             // лестригон крушит орков: +3 урона мимо брони (орки вдвое меньше ростом)
const ORC_TYPES = ["cb:orc", "cb:green_orc", "cb:hell_orc"];

// ---------- особые удары по коротким врагам ----------
// Рост лестригона — 3,9 блока. Враги ниже 60% его роста (2,3 блока) — «короткие»: по ним особый удар-кол сверху
// (cb:style = 2); мельче 1,2 блока (звери, детёныши) — топтание (cb:style = 3). Остальных (големы, всадники,
// другие великаны) бьют обычным рубящим или размашистым.
export const GIANT_H = 3.9;
export const SHORT_H = GIANT_H * 0.6;
export const TINY_H = 1.2;
export const STYLE_CHOP = 0, STYLE_SLASH = 1, STYLE_SMASH = 2, STYLE_STOMP = 3;
export const HEIGHTS = {
  "minecraft:player": 1.8, "cb:orc": 2.1, "cb:green_orc": 2.1, "cb:hell_orc": 2.1, "minecraft:villager": 1.95, "minecraft:zombie": 1.95,
  "minecraft:skeleton": 1.99, "minecraft:creeper": 1.7, "minecraft:witch": 1.95, "minecraft:pillager": 1.95, "minecraft:vindicator": 1.95,
  "minecraft:wolf": 0.85, "minecraft:pig": 0.9, "minecraft:sheep": 1.3, "minecraft:goat": 1.3, "minecraft:cow": 1.4, "minecraft:chicken": 0.7,
  "minecraft:rabbit": 0.5, "minecraft:cat": 0.7, "minecraft:fox": 0.7, "minecraft:spider": 0.9, "minecraft:cave_spider": 0.5,
  "minecraft:silverfish": 0.3, "minecraft:bee": 0.6, "minecraft:parrot": 0.9, "cb:warg": 1.4, "cb:thunder_lizard": 1.5,
  "minecraft:iron_golem": 2.7, "minecraft:ravager": 2.2, "minecraft:enderman": 2.9, "cb:laestrygonian": 3.9, "cb:cyclops": 7, "cb:hydra": 6,
};
export function heightOf(t) {
  try { if (t.getComponent("minecraft:is_baby")) return 0.8; } catch {}
  let h = HEIGHTS[t.typeId] ?? 1.8;
  try { if (t.getComponent("minecraft:riding")) h += 1.2; } catch {}   // всадник выше пешего
  return h;
}
export function styleFor(t, roll = Math.random()) {
  const h = heightOf(t);
  if (h < TINY_H) return STYLE_STOMP;
  if (h < SHORT_H) return STYLE_SMASH;
  return roll < 0.5 ? STYLE_CHOP : STYLE_SLASH;
}
// Кого бьёт сейчас: ближайший игрок (в выживании), орк или помеченный обидчик в 7 блоках.
export function currentFoe(e) {
  if (shared.isDancing?.(e.location, e.dimension)) return undefined;
  let best, bd = 7;
  let near = [];
  try { near = e.dimension.getEntities({ location: e.location, maxDistance: 7 }); } catch {}
  for (const t of near) {
    if (t.id === e.id || t.typeId === LAESTRYGONIAN || NOT_TARGET.has(t.typeId) || !alive(t)) continue;
    const enemy = (isPlayer(t) && inSurvival(t)) || ORC_TYPES.includes(t.typeId) || (() => { try { return t.hasTag(FOE_TAG); } catch { return false; } })();
    if (!enemy) continue;
    const d = Math.hypot(t.location.x - e.location.x, t.location.z - e.location.z);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}
const NOT_TARGET = new Set(["minecraft:item", "minecraft:xp_orb", "minecraft:arrow", "minecraft:painting",
  "minecraft:armor_stand", "minecraft:leash_knot"]);

const st = new Map();                    // id -> { swipeUntil, roarUntil, nextRoar }

function stateOf(e, now) {
  let s = st.get(e.id);
  if (!s) {
    s = { swipeUntil: 0, roarUntil: 0, attackUntil: 0, cdUntil: 0, nextRoar: now + 40, init: false };
    st.set(e.id, s);
  }
  return s;
}

function setProp(e, k, v) {
  try { if (e.getProperty(k) !== v) e.setProperty(k, v); } catch {}
}

// Добавка 0,5 урона мимо брони: прямо со здоровья цели.
export function extraDamage(target, amount = EXTRA_DAMAGE) {
  try {
    const h = target.getComponent("minecraft:health");
    const cur = h?.currentValue ?? 0;
    if (cur <= 0) return false;
    if (cur > amount) h.setCurrentValue(cur - amount);
    else target.kill?.();
    return true;
  } catch {
    return false;
  }
}

function heldType(p) {
  try { return p.getComponent("minecraft:equippable")?.getEquipment("Mainhand")?.typeId; } catch { return undefined; }
}

// ---------- месть стаи ----------
export const FOE_TAG = "cb_laes_foe";
export const ALERT_RANGE = 32;
export const ALERT_TICKS = 600;          // тревога держится 30 с после последней обиды
const foes = new Map();                  // id обидчика -> тик, до которого его помнят
const alerted = new Set();               // id встревоженных лестригонов

export function alarm(victim, offender) {
  if (!valid(offender) || offender.typeId === LAESTRYGONIAN) return;
  if (isPlayer(offender) && !inSurvival(offender)) return;
  try { offender.addTag(FOE_TAG); } catch {}
  foes.set(offender.id, system.currentTick + ALERT_TICKS);
  let pack = [];
  try { pack = victim.dimension.getEntities({ type: LAESTRYGONIAN, location: victim.location, maxDistance: ALERT_RANGE }); } catch {}
  for (const g of pack) {
    if (!alive(g)) continue;
    alerted.add(g.id);
    try { g.triggerEvent("cb:alert"); } catch {}
  }
}

function tickFoes(now) {
  for (const [id, until] of foes) {
    const o = world.getEntity(id);
    if (alive(o) && until > now) continue;
    foes.delete(id);
    try { o?.removeTag(FOE_TAG); } catch {}
  }
  if (foes.size) return;
  for (const id of alerted) { try { world.getEntity(id)?.triggerEvent("cb:calm"); } catch {} }
  alerted.clear();
}

world.afterEvents.entityHurt.subscribe((ev) => {
  const src = ev.damageSource;
  const a = src?.damagingEntity;
  if (ev.hurtEntity?.typeId === LAESTRYGONIAN && a) alarm(ev.hurtEntity, a);
  if (!valid(a) || src.cause !== EntityDamageCause.entityAttack) return;
  if (a.typeId === LAESTRYGONIAN || (isPlayer(a) && heldType(a) === SWORD)) extraDamage(ev.hurtEntity);
});

// ---------- размах кописы: лестригон выигрывает бой с орками ----------
// Лестригон бьёт сверху вниз по мелким бойцам: орка добивает «крушение», а размах задевает весь строй вокруг жертвы.
export function sweep(giant, victim) {
  if (!valid(giant) || !valid(victim) || victim.typeId === LAESTRYGONIAN) return 0;
  let n = 0;
  if (ORC_TYPES.includes(victim.typeId)) { try { victim.applyDamage(ORC_CRUSH, { cause: EntityDamageCause.entityAttack, damagingEntity: giant }); } catch {} }
  let near = [];
  try { near = victim.dimension.getEntities({ location: victim.location, maxDistance: SWEEP_R }); } catch {}
  const dx0 = victim.location.x - giant.location.x, dz0 = victim.location.z - giant.location.z, n0 = Math.hypot(dx0, dz0) || 1;
  for (const e of near) {
    if (e.id === victim.id || e.id === giant.id || e.typeId === LAESTRYGONIAN || NOT_TARGET.has(e.typeId) || !alive(e)) continue;
    if (isPlayer(e) && !inSurvival(e)) continue;
    try { e.applyDamage(SWEEP_DAMAGE, { cause: EntityDamageCause.entityAttack, damagingEntity: giant }); } catch { continue; }
    try { e.applyKnockback(dx0 / n0, dz0 / n0, 0.7, 0.3); } catch {}
    n++;
  }
  const style = (() => { try { return giant.getProperty("cb:style"); } catch { return 0; } })();
  if (style === STYLE_SMASH || style === STYLE_STOMP) {       // особый удар вбивает врага в землю
    fx(victim.dimension, "minecraft:large_explosion", { x: victim.location.x, y: victim.location.y + 0.2, z: victim.location.z });
    sound(victim.dimension, "random.anvil_land", victim.location, 1, 0.7);
  }
  if (n || ORC_TYPES.includes(victim.typeId)) {
    fx(victim.dimension, "minecraft:sweep_particle", { x: victim.location.x, y: victim.location.y + 1, z: victim.location.z });
    sound(victim.dimension, "cb.laestrygonian.swing", victim.location, 1.2, 0.8);
  }
  return n;
}
world.afterEvents.entityHitEntity.subscribe((ev) => {
  const g = ev.damagingEntity;
  if (g?.typeId !== LAESTRYGONIAN || !valid(g)) return;
  const now = system.currentTick;
  const s = stateOf(g, now);
  if (s.cdUntil && now < s.cdUntil) return;
  s.attackUntil = now + ATTACK_ANIM_TICKS;
  s.cdUntil = now + ATTACK_CD_TICKS;
  setProp(g, "cb:attacking", true);
  try { g.triggerEvent("cb:start_cooldown"); } catch {}
  sweep(g, ev.hitEntity);
});

// ---------- дальний удар мечом ----------
const lungeReady = new Map();            // id игрока -> тик

function blockDistance(p) {
  try {
    const hit = p.getBlockFromViewDirection({ maxDistance: REACH, includeLiquidBlocks: false, includePassableBlocks: false });
    if (!hit?.block) return Infinity;
    const h = p.getHeadLocation();
    const b = hit.block.location;
    return Math.hypot(b.x + 0.5 - h.x, b.y + 0.5 - h.y, b.z + 0.5 - h.z) - 0.5;
  } catch {
    return Infinity;
  }
}

// Все цели на линии выпада до стены (выпад пронзает насквозь).
export function lungeTargets(p) {
  let hits = [];
  try { hits = p.getEntitiesFromViewDirection({ maxDistance: REACH }); } catch { return []; }
  const wall = blockDistance(p);
  const out = [];
  for (const h of hits.sort((a, b) => a.distance - b.distance)) {
    const e = h.entity;
    if (h.distance > wall || h.distance > REACH) break;  // стена останавливает выпад
    if (!valid(e) || e.id === p.id || NOT_TARGET.has(e.typeId) || !alive(e)) continue;
    if (isPlayer(e) && !inSurvival(e)) continue;
    out.push({ entity: e, distance: h.distance });
  }
  return out;
}

function wearSword(p) {
  try {
    const eq = p.getComponent("minecraft:equippable");
    const it = eq?.getEquipment("Mainhand");
    const d = it?.getComponent?.("minecraft:durability");
    if (!it || !d || !inSurvival(p)) return;
    if (d.damage + 1 >= d.maxDurability) {
      eq.setEquipment("Mainhand", undefined);
      sound(p.dimension, "random.break", p.location, 1, 1);
      return;
    }
    d.damage += 1;
    eq.setEquipment("Mainhand", it);
  } catch {}
}

export function lunge(p, now = system.currentTick) {
  if ((lungeReady.get(p.id) ?? 0) > now) return false;
  lungeReady.set(p.id, now + LUNGE_COOLDOWN);
  sound(p.dimension, "cb.laestrygonian.swing", p.location, 1, 1.3);
  try { p.playAnimation("animation.cb_laestrygonian_sword.lunge", { blendOutTime: 0.1 }); } catch {}
  const targets = lungeTargets(p);
  let h;
  try { h = p.getHeadLocation(); } catch { h = { x: p.location.x, y: p.location.y + 1.6, z: p.location.z }; }
  let v = { x: 0, y: 0, z: 1 };
  try { v = p.getViewDirection(); } catch {}
  const len = REACH;
  for (let k = 1; k <= Math.ceil(len); k++) {            // след выпада
    fx(p.dimension, "minecraft:critical_hit_emitter", { x: h.x + v.x * k, y: h.y - 0.2 + v.y * k, z: h.z + v.z * k });
  }
  if (!targets.length) return 0;
  const n = Math.hypot(v.x, v.z) || 1;
  for (const { entity: e } of targets) {
    try { e.applyDamage(LUNGE_DAMAGE, { cause: EntityDamageCause.entityAttack, damagingEntity: p }); } catch {}
    try { e.applyKnockback(v.x / n, v.z / n, 0.5, 0.25); } catch {}
  }
  wearSword(p);
  return targets.length;
}

world.afterEvents.itemUse.subscribe((ev) => {
  const p = ev.source;
  if (ev.itemStack?.typeId !== SWORD || !isPlayer(p)) return;
  lunge(p);
});

export function swipe(e, now) {
  const s = stateOf(e, now);
  const n = breakAhead(e, { reach: [1, 2], half: 1, from: 1, to: 4, match: isLeaves, max: 8 });
  if (!n) return 0;
  s.swipeUntil = now + SWIPE_TICKS;
  setProp(e, "cb:swipe", true);
  sound(e.dimension, "cb.laestrygonian.swing", e.location, 1.2, 0.9);
  return n;
}

export function roar(e, now) {
  const s = stateOf(e, now);
  s.roarUntil = now + ROAR_TICKS;
  s.nextRoar = now + ROAR_COOLDOWN;
  setProp(e, "cb:roar", true);
  sound(e.dimension, "cb.laestrygonian.roar", e.location, 3, 0.9 + Math.random() * 0.2);
}

function tickOne(e, now) {
  const s = stateOf(e, now);
  if (!s.init) {
    s.init = true;
    try { e.triggerEvent("cb:end_cooldown"); } catch {}
  }
  if (now % 20 === 0 && alerted.has(e.id)) {                 // ярость: злые частицы над головой
    fx(e.dimension, "minecraft:villager_angry", { x: e.location.x, y: e.location.y + 4.3, z: e.location.z });
  }
  if (s.attackUntil && now >= s.attackUntil) {
    s.attackUntil = 0;
    setProp(e, "cb:attacking", false);
  }
  if (s.cdUntil && now >= s.cdUntil) {
    s.cdUntil = 0;
    try { e.triggerEvent("cb:end_cooldown"); } catch {}
  }
  if (s.swipeUntil && now >= s.swipeUntil) { s.swipeUntil = 0; setProp(e, "cb:swipe", false); }
  if (s.roarUntil && now >= s.roarUntil) { s.roarUntil = 0; setProp(e, "cb:roar", false); }
  if (!s.attackUntil && now % 5 === 2) {                     // удар подбирается под рост врага (не меняем посреди замаха!)
    const foe = currentFoe(e);
    if (foe) {
      const want = styleFor(foe);
      const cur = e.getProperty?.("cb:style");
      const wasSpecial = cur === STYLE_SMASH || cur === STYLE_STOMP;
      const isSpecial = want === STYLE_SMASH || want === STYLE_STOMP;
      if (isSpecial) setProp(e, "cb:style", want);
      else if (wasSpecial || now % STYLE_EVERY === 2) setProp(e, "cb:style", want);
    } else if (now % STYLE_EVERY === 2) setProp(e, "cb:style", Math.random() < 0.5 ? 0 : 1);
  }
  if (now % 10 === 0 && !s.swipeUntil && moving(e)) swipe(e, now);
  if (now % 10 === 5 && !s.roarUntil && now >= s.nextRoar) {
    const prey = playersNear(e.dimension, e.location, ROAR_RANGE).filter((p) => alive(p) && inSurvival(p));
    if (prey.length) roar(e, now);
  }
}

world.afterEvents.entityDie.subscribe((ev) => {
  if (ev.deadEntity?.typeId === LAESTRYGONIAN) st.delete(ev.deadEntity.id);
});

system.runInterval(() => {
  const now = system.currentTick;
  if (now % 20 === 0) { try { tickFoes(now); } catch {} }
  for (const id of DIMENSIONS) {
    let list = [];
    try { list = world.getDimension(id).getEntities({ type: LAESTRYGONIAN }); } catch { continue; }
    for (const e of list) {
      if (!alive(e)) continue;
      try { tickOne(e, now); } catch (err) { console.warn(`[laestrygonians] ${err}`); }
    }
  }
}, 1);
