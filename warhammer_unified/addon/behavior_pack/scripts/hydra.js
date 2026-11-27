// Механики Гидры.
//  - Пять голов, у каждой свой хитбокс: невидимая сущность cb:hydra_head, которую
//    скрипт каждый тик ставит туда, где на модели нарисована голова.
//  - У каждой головы 120 HP. Срубленная голова отрастает через 30 секунд, если шею
//    не прижечь: голова или гидра должна гореть (огонь, лава, «Заговор огня», «Пламя»)
//    или быть под иссушением. Гидра умирает, только когда все пять шей прижжены.
//  - Тело неуязвимо. Каждая голова кусает ближайшую к себе цель: 6 урона и яд.
//  - Потеряв три головы, гидра начинает плеваться ядом издалека.
import { world, system, EntityDamageCause } from "@minecraft/server";
import { HEADS, HEAD_HP, SEG, SNOUT } from "./hydra_layout.js";
import { T } from "./i18n.js";
import {
  DIMENSIONS, valid, alive, healthOf, isPlayer, inSurvival, dist, lerp, clamp, wrapDeg,
  toWorld, fx, sound, playersNear, actionBar, safeRemove, shared, bossName,
} from "./util.js";

const HYDRA = "cb:hydra";
const HEAD = "cb:hydra_head";
const NECK = "cb:hydra_neck";       // хитбоксы шеи: урон по ним уходит в голову
const NECK_HALF = 0.45;
const SPIT = "cb:hydra_spit";
const N = HEADS.length;

const DAMAGE = 6;
const POISON_TICKS = 120;   // яд от укуса — 6 секунд
const STRIKE_LEN = 16;      // длительность выпада в тиках (как animation.hydra.strikeN, 0.8 с)
const HIT_TICK = 7;         // на каком тике выпада происходит укус или плевок (0.35 с)
const ARC = 78;             // на сколько градусов шея может отвернуть в сторону
const BITE_GAP = 12;        // минимум тиков между выпадами по одной цели
const HALF = 0.6;           // половина высоты хитбокса головы
const L1 = SEG[0] + SEG[1]; // нижняя половина шеи
const L2 = SEG[2] + SEG[3]; // верхняя половина шеи
const REACH = L1 + L2 + SNOUT + 0.25; // дальность укуса от основания шеи

const REGROW_TICKS = 600;   // срубленная голова отрастает через 30 секунд
const GROW_TICKS = 40;      // анимация отрастания (как animation.hydra.growN, 2 с)
const SCORCH_TICKS = 100;   // столько тиков голова «помнит» огонь или иссушение
const ENRAGE_HEADS = 2;     // голов осталось столько или меньше — ярость: плевки чаще
const SPIT_RANGE = 16;      // не дотянуться укусом — плюётся ядом до 16 блоков
const SPIT_GAP = 30;        // между плевками всего тела (одна голова за раз), в ярости — вдвое чаще
const SPIT_SPEED = 1.3;
const SPIT_GRAVITY = 0.03;  // как у cb:hydra_spit

const FIRE_CAUSES = new Set(["fire", "fireTick", "lava", "magma", "campfire", "soulCampfire", "wither"]);
// Гидра нападает на всё живое: игроков (кроме творческого режима), жителей, зверей, монстров, Циклопа…
// Не трогает только себя, предметы и неживое.
const NOT_ALIVE = new Set(["minecraft:item", "minecraft:xp_orb", "minecraft:arrow", "minecraft:armor_stand",
  "minecraft:painting", "minecraft:leash_knot", "minecraft:boat", "minecraft:chest_boat", "minecraft:minecart",
  "minecraft:falling_block", "minecraft:tnt", "minecraft:fireball", "minecraft:snowball",
  "cb:hex_chicken", "cb:hex_goat", "cb:hex_pig", "cb:hex_sheep", "cb:hex_horse", "cb:sargeras_prompt", "cb:lich_statue", "cb:circe_orb", "cb:fel_orb", "cb:fel_rain"]);
const CYCLOPS = "cb:cyclops";
const CYCLOPS_RADIUS = 1.3;   // до тела циклопа достаёт, если до его оси меньше REACH + это
const NEVER = new Set([HYDRA, HEAD, NECK, SPIT, "cb:sargeras_prompt", "cb:lich_statue", "cb:circe_orb", "cb:fel_orb", "cb:fel_rain", "minecraft:armor_stand", "minecraft:item", "minecraft:xp_orb"]);

const states = new Map();     // id тела -> состояние
const headLinks = new Map();  // id головы -> { bodyId, idx }
const grudges = new Map();    // id обидчика -> тик, до которого гидра считает его врагом
const lastBite = new Map();   // id цели -> тик начала последнего выпада по ней
const hintAt = new Map();     // id игрока -> тик последней подсказки
const orphanSeen = new Map(); // id головы без тела -> сколько проверок подряд

// ---------- огонь и иссушение ----------
function scorching(e) {
  if (!valid(e)) return false;
  try { if (e.getComponent("minecraft:onfire")) return true; } catch {}
  try { if (e.getEffect("wither")) return true; } catch {}
  return false;
}

function hasEnchant(item, id) {
  if (!item) return false;
  try {
    const c = item.getComponent("minecraft:enchantable");
    if (c?.getEnchantment?.(id)) return true;
  } catch {}
  try {
    const c = item.getComponent("minecraft:enchantments");
    if (c?.enchantments?.hasEnchantment?.(id)) return true;
  } catch {}
  return false;
}

function mainHand(e) {
  try {
    const eq = e.getComponent("minecraft:equippable");
    return eq?.getEquipment("Mainhand");
  } catch {
    return undefined;
  }
}

// Прижигает ли этот удар: огненный урон, горящий снаряд, оружие с «Заговором огня» или лук с «Пламенем».
function scorchingHit(src) {
  if (!src) return false;
  if (FIRE_CAUSES.has(String(src.cause))) return true;
  const projId = src.damagingProjectile?.typeId;
  if (projId === "cb:fel_orb" || projId === "cb:fel_rain" || scorching(src.damagingProjectile)) return true;
  const a = src.damagingEntity;
  if (!valid(a)) return false;
  if (a.typeId === "cb:guldan" || a.typeId === "cb:inferno_golem" || a.typeId === "cb:hell_orc" || a.typeId === "cb:fel_lord" || a.typeId === "cb:zeus" || a.typeId === "cb:hades" || a.typeId === "cb:ares" || a.typeId === "cb:hephaestus") return true;
  const item = mainHand(a);
  if (src.cause === EntityDamageCause.projectile) return hasEnchant(item, "flame");
  return hasEnchant(item, "fire_aspect");
}

// ---------- состояние ----------
function dyn(body, key, fallback) {
  try {
    const v = body.getDynamicProperty(key);
    return v === undefined ? fallback : v;
  } catch {
    return fallback;
  }
}

function stateOf(body, now) {
  let st = states.get(body.id);
  if (!st) {
    st = {
      body,
      hp: [],
      burn: [],
      regrow: [],
      growUntil: new Array(N).fill(0),
      scorchUntil: new Array(N).fill(-1),
      heads: new Array(N),
      necks: Array.from({ length: N }, () => []),
      rest: new Array(N),
      apex: new Array(N),
      cd: [],
      strike: new Array(N).fill(null),
      hurtUntil: new Array(N).fill(0),
      spawnedAt: new Array(N).fill(-1e9), // когда создан хитбокс головы
      retryAt: new Array(N).fill(0),      // не пересоздавать раньше этого тика
      props: {},
      seen: now,
      dying: false,
      killer: undefined,
      cands: null,
      warnAt: -1e9,
    };
    for (let i = 0; i < N; i++) {
      st.hp[i] = dyn(body, `cb:hp${i}`, HEAD_HP);
      st.burn[i] = dyn(body, `cb:burn${i}`, false) === true;
      st.regrow[i] = dyn(body, `cb:rg${i}`, REGROW_TICKS);
      st.cd[i] = now + 20 + i * 9;
    }
    states.set(body.id, st);
  }
  st.body = body;
  st.seen = now;
  return st;
}

function save(st, key, v) {
  try { st.body.setDynamicProperty(key, v); } catch {}
}

function setHp(st, i, v) {
  st.hp[i] = v;
  save(st, `cb:hp${i}`, v);
}

function setProp(st, name, value) {
  if (st.props[name] === value) return;
  try {
    st.body.setProperty(name, value);
    st.props[name] = value;
  } catch {}
}

const aliveCount = (st) => st.hp.reduce((n, v) => n + (v > 0 ? 1 : 0), 0);
const stepTo = (v, step) => Math.round(v / step) * step;
const tell = (st, text) => {
  for (const p of playersNear(st.body.dimension, st.body.location, 48)) actionBar(p, text);
};

// ---------- геометрия ----------
const headRest = (loc, yaw, i) => toWorld(loc, yaw, HEADS[i].head[0], HEADS[i].head[2], HEADS[i].head[1]);
const neckBase = (loc, yaw, i) => toWorld(loc, yaw, HEADS[i].base[0], HEADS[i].base[2], HEADS[i].base[1]);
const proxyLoc = (center) => ({ x: center.x, y: center.y - HALF, z: center.z });
const neckRest = (loc, yaw, i, j) => toWorld(loc, yaw, HEADS[i].necks[j][0], HEADS[i].necks[j][2], HEADS[i].necks[j][1]);
const neckLoc = (c) => ({ x: c.x, y: c.y - NECK_HALF, z: c.z });

function stumpTop(loc, yaw, i) {
  const b = neckBase(loc, yaw, i);
  return { x: b.x, y: b.y + SEG[0] * 0.9, z: b.z };
}

// Куда целиться: у циклопа — в глаз (пока он не слепой), у остальных — в середину тела.
function aimPoint(e) {
  if (e.typeId === CYCLOPS && !shared.isBlind(e)) {
    const eye = shared.eyeOf(e);
    if (eye) return eye;
  }
  return centerOf(e);
}

// Ближайшая к основанию шеи точка на теле циклопа (он высокий — глаз часто не достать).
function cyclopsBodyPoint(c, base) {
  const l = c.location;
  const y = clamp(base.y + 1.5, l.y + 0.5, l.y + 6.5);
  const dx = base.x - l.x, dz = base.z - l.z;
  const h = Math.hypot(dx, dz) || 1;
  const r = Math.min(CYCLOPS_RADIUS, h);
  return { x: l.x + (dx / h) * r, y, z: l.z + (dz / h) * r };
}

function centerOf(e) {
  const l = e.location;
  let top;
  try { top = e.getHeadLocation().y; } catch { top = l.y + 1.6; }
  return { x: l.x, y: (l.y + top) / 2 + 0.1, z: l.z };
}

// Куда и под какими углами тянуться шее i к точке tc.
//  ya — поворот в сторону относительно «своего» направления шеи, pitch — угол от вертикали
//  (0 вверх, 90 горизонтально, 180 вниз), look — на сколько градусов голове смотреть вниз.
function aimAt(yaw, i, base, rest, tc) {
  const dx = tc.x - base.x, dy = tc.y - base.y, dz = tc.z - base.z;
  const h = Math.hypot(dx, dz);
  const bearing = (Math.atan2(-dx, dz) * 180) / Math.PI;
  const ya = h < 0.25 ? 0 : wrapDeg(wrapDeg(bearing - yaw) - HEADS[i].fan);
  const pitch = (Math.atan2(h, dy) * 180) / Math.PI;
  const look = (Math.atan2(rest.y - tc.y, Math.hypot(tc.x - rest.x, tc.z - rest.z)) * 180) / Math.PI;
  const dir = h < 0.25 ? toWorld({ x: 0, y: 0, z: 0 }, yaw, 0, 1, 0) : { x: dx / h, y: 0, z: dz / h };
  return { ya, pitch, look, d: Math.hypot(h, dy), dir };
}

// Шея как двухзвенная «рука»: углы нижней (lo) и верхней (up) половин, при которых
// морда останавливается у цели, а не пролетает сквозь неё.
function neckIK(pitch, d) {
  const jd = clamp(d - SNOUT - 0.3, Math.abs(L1 - L2) + 0.05, L1 + L2 - 0.001);
  const al = (Math.acos(clamp((L1 * L1 + jd * jd - L2 * L2) / (2 * L1 * jd), -1, 1)) * 180) / Math.PI;
  const lo = pitch - al;
  const rl = (lo * Math.PI) / 180, rp = (pitch * Math.PI) / 180;
  const ef = L1 * Math.sin(rl), eu = L1 * Math.cos(rl);
  const jf = jd * Math.sin(rp), ju = jd * Math.cos(rp);
  let up = (Math.atan2(jf - ef, ju - eu) * 180) / Math.PI;
  while (up < lo) up += 360;
  return { lo, up, f: jf + 0.35 * Math.sin(rp), u: ju + 0.35 * Math.cos(rp) };
}

function setStrikeAngles(st, i, base, aim) {
  const ik = neckIK(aim.pitch, aim.d);
  setProp(st, `cb:lo${i}`, clamp(Math.round(ik.lo), -90, 270));
  setProp(st, `cb:up${i}`, clamp(Math.round(ik.up), -90, 450));
  st.apex[i] = { x: base.x + aim.dir.x * ik.f, y: base.y + ik.u, z: base.z + aim.dir.z * ik.f };
}

// 0..1: насколько голова (и её хитбокс) вынесена к цели на тике t выпада.
function lungeEnv(t) {
  if (t <= 3) return 0;
  if (t <= HIT_TICK) return (t - 3) / (HIT_TICK - 3);
  if (t <= HIT_TICK + 2) return 1;
  return Math.max(0, 1 - (t - HIT_TICK - 2) / (STRIKE_LEN - HIT_TICK - 2));
}

// ---------- головы-хитбоксы ----------
function link(e, bodyId, idx, part = 0) {
  headLinks.set(e.id, { bodyId, idx, part });
}

function linkOf(e) {
  const known = headLinks.get(e.id);
  if (known) return known;
  try {
    const bodyId = e.getDynamicProperty("cb:body");
    const idx = e.getDynamicProperty("cb:idx");
    const part = e.getDynamicProperty("cb:part") ?? 0;
    if (typeof bodyId === "string" && typeof idx === "number") return { bodyId, idx, part };
  } catch {}
  return undefined;
}

function spawnHead(st, i, center, now) {
  // Если прошлый хитбокс исчез сразу после создания (например, мирный режим убирает
  // монстров), не создаём новый каждый тик, а пробуем раз в две секунды.
  if (now < st.retryAt[i]) return;
  if (now - st.spawnedAt[i] < 10) {
    st.retryAt[i] = now + 40;
    return;
  }
  st.spawnedAt[i] = now;
  const body = st.body;
  let e;
  try { e = body.dimension.spawnEntity(HEAD, proxyLoc(center)); } catch { return; }
  try {
    e.setDynamicProperty("cb:body", body.id);
    e.setDynamicProperty("cb:idx", i);
  } catch {}
  const h = healthOf(e);
  if (h && st.hp[i] < h.effectiveMax) {
    try { h.setCurrentValue(Math.max(1, st.hp[i])); } catch {}
  }
  st.heads[i] = e;
  link(e, body.id, i);
}

function removeNecks(st, i) {
  for (const n of st.necks[i]) {
    if (valid(n)) headLinks.delete(n.id);
    safeRemove(n);
  }
  st.necks[i] = [];
}

function syncNecks(st, i, loc, yaw, shift, now) {
  const list = st.necks[i];
  const want = HEADS[i].necks.length;
  for (let j = 0; j < want; j++) {
    const f = HEADS[i].neckFrac[j];
    const r = neckRest(loc, yaw, i, j);
    const c = { x: r.x + shift.x * f, y: r.y + shift.y * f, z: r.z + shift.z * f };
    let n = list[j];
    if (valid(n)) {
      try { n.teleport(neckLoc(c), { dimension: st.body.dimension, keepVelocity: false, rotation: { x: 0, y: yaw } }); } catch {}
      continue;
    }
    if (now < st.retryAt[i]) continue;
    try { n = st.body.dimension.spawnEntity(NECK, neckLoc(c)); } catch { continue; }
    try {
      n.setDynamicProperty("cb:body", st.body.id);
      n.setDynamicProperty("cb:idx", i);
      n.setDynamicProperty("cb:part", j + 1);
    } catch {}
    list[j] = n;
    link(n, st.body.id, i, j + 1);
  }
}

// Сверяет головы рядом с телом: подхватывает свои, убирает дубликаты и головы мёртвых шей.
function reconcile(st) {
  const body = st.body;
  const found = new Array(N);
  let list = [];
  try { list = body.dimension.getEntities({ type: HEAD, location: body.location, maxDistance: 32 }); } catch {}
  const necks = Array.from({ length: N }, () => []);
  let nlist = [];
  try { nlist = body.dimension.getEntities({ type: NECK, location: body.location, maxDistance: 32 }); } catch {}
  for (const e of nlist) {
    if (!valid(e)) continue;
    const l = linkOf(e);
    if (!l || l.bodyId !== body.id) continue;
    const i = l.idx, j = (l.part ?? 1) - 1;
    if (!(i >= 0 && i < N) || j < 0 || st.hp[i] <= 0 || necks[i][j]) {
      safeRemove(e);
      continue;
    }
    necks[i][j] = e;
    link(e, body.id, i, j + 1);
  }
  st.necks = necks;
  for (const e of list) {
    if (!valid(e)) continue;
    const l = linkOf(e);
    if (!l || l.bodyId !== body.id) continue;
    const i = l.idx;
    if (!(i >= 0 && i < N) || found[i] || st.hp[i] <= 0 || !alive(e)) {
      if (found[i] !== e) safeRemove(e);
      continue;
    }
    found[i] = e;
    link(e, body.id, i);
  }
  st.heads = found;
}

function sweepOrphans(dim) {
  let list = [];
  try { list = [...dim.getEntities({ type: HEAD }), ...dim.getEntities({ type: NECK })]; } catch { return; }
  for (const e of list) {
    if (!valid(e)) continue;
    const l = linkOf(e);
    const st = l && states.get(l.bodyId);
    if (st && valid(st.body)) {
      orphanSeen.delete(e.id);
      const own = l.part ? st.necks[l.idx]?.[l.part - 1] : st.heads[l.idx];
      if (own && own !== e && valid(own)) safeRemove(e); // дубликат
      continue;
    }
    // тело известно, но исчезло — убираем сразу; неизвестное тело ждём три проверки (вдруг ещё грузится)
    const n = st ? 3 : (orphanSeen.get(e.id) ?? 0) + 1;
    if (n >= 3) {
      orphanSeen.delete(e.id);
      headLinks.delete(e.id);
      safeRemove(e);
    } else {
      orphanSeen.set(e.id, n);
    }
  }
}

// ---------- цели ----------
function candidates(body, now, range) {
  const out = [];
  let list = [];
  try { list = body.dimension.getEntities({ location: body.location, maxDistance: range + 5 }); } catch {}
  for (const e of list) {
    if (NEVER.has(e.typeId) || NOT_ALIVE.has(e.typeId) || !valid(e)) continue;
    if (isPlayer(e) && !inSurvival(e)) continue;
    const h = healthOf(e);
    if (!h || h.currentValue <= 0) continue;
    out.push({ e, center: aimPoint(e) });
  }
  return out;
}

// Ближайшая к голове цель из тех, до которых шея может довернуть.
function pickTarget(yaw, i, base, rest, cands, range) {
  let best = null, bd = range;
  for (const c of cands) {
    const rawD = dist(rest, c.center);
    if (rawD >= range) continue;
    // Босс Гидра в первую очередь атакует Вардена!
    const effD = c.e?.typeId === "minecraft:warden" ? rawD - 25 : rawD;
    if (effD >= bd) continue;
    const aim = aimAt(yaw, i, base, rest, c.center);
    if (Math.abs(aim.ya) > ARC) continue;
    best = { e: c.e, center: c.center, aim };
    bd = effD;
  }
  return best;
}

function bite(st, i, s, base) {
  const e = s.e;
  if (!alive(e) || (isPlayer(e) && !inSurvival(e))) return;
  if (e.typeId === CYCLOPS) {
    const dim = st.body.dimension;
    const held = shared.holder.get(st.body.id)?.id === e.id;
    const eye = shared.isBlind(e) ? undefined : shared.eyeOf(e);
    if (eye && (held || dist(base, eye) <= REACH + 0.7)) {
      shared.hitEye(e, DAMAGE, st.body);                     // в глаз!
      try { e.applyDamage(DAMAGE, { cause: EntityDamageCause.entityAttack, damagingEntity: st.body }); } catch {}
      try { e.addEffect("poison", POISON_TICKS, { amplifier: 0 }); } catch {}
      sound(dim, "cb.hydra.bite", eye, 1.5, 0.9);
      tell(st, T("hyd.bit_eye"));
      return;
    }
    const pt = cyclopsBodyPoint(e, base);
    if (dist(base, pt) > REACH + 0.7) {
      sound(dim, "cb.hydra.bite", st.rest[i], 0.8, 1.4);
      return;
    }
    try { e.applyDamage(DAMAGE, { cause: EntityDamageCause.entityAttack, damagingEntity: st.body }); } catch {}
    try { e.addEffect("poison", POISON_TICKS, { amplifier: 0 }); } catch {}
    fx(dim, "minecraft:critical_hit_emitter", pt);
    sound(dim, "cb.hydra.bite", pt, 1.5, 1);
    return;
  }
  const c = centerOf(e);
  const dim = st.body.dimension;
  if (dist(base, c) > REACH + 0.7) {
    sound(dim, "cb.hydra.bite", st.rest[i], 0.8, 1.4); // цель успела отскочить
    return;
  }
  try { e.applyDamage(DAMAGE, { cause: EntityDamageCause.entityAttack, damagingEntity: st.body }); } catch {}
  try { e.addEffect("poison", POISON_TICKS, { amplifier: 0 }); } catch {}
  fx(dim, "minecraft:critical_hit_emitter", c);
  sound(dim, "cb.hydra.bite", c, 1.5, 1);
}

// Плевок ядом: снаряд cb:hydra_spit летит по дуге в центр цели.
function spit(st, i, s) {
  const e = s.e;
  if (!alive(e)) return;
  const dim = st.body.dimension;
  const target = s.point ?? aimPoint(e);
  const head = st.rest[i];
  const d0 = dist(head, target) || 1;
  const mouth = lerp(head, target, Math.min(0.45, 1.1 / d0)); // за пределами своего хитбокса
  const dx = target.x - mouth.x, dy = target.y - mouth.y, dz = target.z - mouth.z;
  const d = Math.hypot(dx, dy, dz) || 1;
  const t = d / SPIT_SPEED;
  const vel = {
    x: (dx / d) * SPIT_SPEED,
    y: (dy / d) * SPIT_SPEED + 0.5 * SPIT_GRAVITY * t,   // поправка на падение
    z: (dz / d) * SPIT_SPEED,
  };
  let p;
  try { p = dim.spawnEntity(SPIT, mouth); } catch { return; }
  let shot = false;
  try {
    const pc = p.getComponent("minecraft:projectile");
    if (pc) {
      try { pc.owner = st.body; } catch {}
      if (typeof pc.shoot === "function") {
        pc.shoot(vel);
        shot = true;
      }
    }
  } catch {}
  if (!shot) {
    try { p.applyImpulse(vel); } catch {}
  }
  fx(dim, "minecraft:villager_angry", mouth);
  sound(dim, "cb.hydra.spit", mouth, 1.5, 1);
}

// ---------- смерть и отрастание голов ----------
function cauterize(st, i, quiet) {
  if (st.burn[i]) return;
  st.burn[i] = true;
  save(st, `cb:burn${i}`, true);
  const pos = stumpTop(st.body.location, st.props["cb:byaw"] ?? 0, i);
  fx(st.body.dimension, "minecraft:large_explosion", pos);
  sound(st.body.dimension, "cb.hydra.sizzle", pos, 1.5, 1);
  if (!quiet) {
    const left = st.burn.filter((b) => !b).length;
    tell(st, left > 0 ? T("hyd.cauterized_left", left) : T("hyd.cauterized_all"));
  }
}

function onHeadDeath(st, i, killer, scorched, now) {
  if (st.hp[i] <= 0) return;
  setHp(st, i, 0);
  st.strike[i] = null;
  st.regrow[i] = REGROW_TICKS;
  save(st, `cb:rg${i}`, REGROW_TICKS);
  setProp(st, `cb:act${i}`, 3);
  const body = st.body;
  const e = st.heads[i];
  let pos = st.rest[i] ?? body.location;
  const burning = scorched || now < st.scorchUntil[i] || scorching(e) || scorching(body);
  if (valid(e)) {
    try { pos = { x: e.location.x, y: e.location.y + HALF, z: e.location.z }; } catch {}
    headLinks.delete(e.id);
    safeRemove(e);
  }
  st.heads[i] = undefined;
  removeNecks(st, i);
  if (valid(killer) && killer.typeId !== HEAD && killer.typeId !== NECK && killer.typeId !== HYDRA) st.killer = killer;

  const dim = body.dimension;
  fx(dim, "minecraft:large_explosion", pos);
  for (let k = 0; k < 3; k++) fx(dim, "minecraft:critical_hit_emitter", pos);
  sound(dim, "cb.hydra.head_death", pos, 2, 1);

  const left = aliveCount(st);
  if (burning) {
    cauterize(st, i, true);
    tell(st, T("hyd.cut", left));
  } else {
    tell(st, T("hyd.cut_cauterize", left));
  }
  if (left === ENRAGE_HEADS) {
    tell(st, T("hyd.enraged"));
    sound(dim, "cb.hydra.enrage", body.location, 3, 1);
  }
  checkDeath(st);
}

function checkDeath(st) {
  if (st.dying || aliveCount(st) > 0) return;
  if (st.burn.every(Boolean)) beginDeath(st);
}

function beginDeath(st) {
  if (st.dying) return;
  st.dying = true;
  const body = st.body;
  for (const e of st.heads) safeRemove(e);
  st.heads = new Array(N);
  for (let i = 0; i < N; i++) removeNecks(st, i);
  try { body.addTag("cb_hydra_dying"); } catch {} // снимает неуязвимость тела
  tell(st, T("hyd.defeated"));
  sound(body.dimension, "cb.hydra.death_roar", body.location, 3, 1);
  const killer = valid(st.killer) ? st.killer : undefined;
  system.runTimeout(() => {
    if (!valid(body)) return;
    try {
      if (killer) body.applyDamage(100000, { cause: EntityDamageCause.entityAttack, damagingEntity: killer });
      else body.applyDamage(100000);
    } catch {}
    system.runTimeout(() => {
      try { if (alive(body)) body.kill(); } catch {}
    }, 2);
  }, 1);
}

// Шея без головы: прижечь, отсчитывать время до отрастания или отращивать.
function tickStump(st, i, now, loc, yaw, bodyScorched) {
  if (valid(st.heads[i])) safeRemove(st.heads[i]);
  st.heads[i] = undefined;
  if (st.necks[i].length) removeNecks(st, i);
  if (!st.burn[i] && bodyScorched && !st.growUntil[i]) cauterize(st, i, false);
  if (st.burn[i]) {
    setProp(st, `cb:act${i}`, 3);
    if (now % 20 === i * 4) fx(st.body.dimension, "minecraft:basic_smoke_particle", stumpTop(loc, yaw, i));
    return;
  }
  if (st.growUntil[i]) {
    if (now >= st.growUntil[i]) {
      st.growUntil[i] = 0;
      setHp(st, i, HEAD_HP);
      st.cd[i] = now + 30;
      st.spawnedAt[i] = -1e9;
      st.retryAt[i] = 0;
      setProp(st, `cb:act${i}`, 0);
      tell(st, T("hyd.regrown"));
    } else {
      setProp(st, `cb:act${i}`, 4);
    }
    return;
  }
  setProp(st, `cb:act${i}`, 3);
  st.regrow[i] -= 1;
  if (now % 20 === 0) save(st, `cb:rg${i}`, st.regrow[i]);
  if (st.regrow[i] === 100) tell(st, T("hyd.healing"));
  if (st.regrow[i] <= 0) {
    st.growUntil[i] = now + GROW_TICKS;
    st.regrow[i] = REGROW_TICKS;
    save(st, `cb:rg${i}`, REGROW_TICKS);
    setProp(st, `cb:act${i}`, 4);
    sound(st.body.dimension, "cb.hydra.regrow", stumpTop(loc, yaw, i), 2, 1);
  }
}

// ---------- основной цикл тела ----------
function tickBody(body, now) {
  if (now % 20 === 0) bossName(body);   // разноцветное имя над головой и на полоске босса
  const st = stateOf(body, now);
  if (st.dying) return;
  const dim = body.dimension;
  const loc = body.location;
  let yaw = 0;
  try { yaw = body.getRotation().y; } catch {}
  setProp(st, "cb:byaw", clamp(Math.round(wrapDeg(yaw)), -180, 180));
  const bodyScorched = scorching(body);

  let needReconcile = now % 20 === 3;
  for (let i = 0; i < N && !needReconcile; i++) {
    if (st.hp[i] > 0 && !valid(st.heads[i]) && now >= st.retryAt[i]) needReconcile = true;
  }
  if (needReconcile) reconcile(st);

  const enraged = aliveCount(st) <= ENRAGE_HEADS;
  const holder = shared.holder.get(body.id);
  if (holder && !alive(holder)) shared.holder.delete(body.id);
  const range = SPIT_RANGE;   // следит за целями на дальности плевка
  if (now % 2 === 0 || !st.cands) st.cands = candidates(body, now, range);
  let cands = st.cands;
  if (holder && alive(holder)) {
    cands = [{ e: holder, center: aimPoint(holder) }];   // в руках циклопа — только его глаз
    for (let i = 0; i < N; i++) if (st.cd[i] > now + 14) st.cd[i] = now + 6;
  }

  let total = 0;
  for (let i = 0; i < N; i++) {
    if (st.hp[i] <= 0) {
      tickStump(st, i, now, loc, yaw, bodyScorched);
      continue;
    }
    const rest = (st.rest[i] = headRest(loc, yaw, i));
    const base = neckBase(loc, yaw, i);

    // --- здоровье головы берём с её хитбокса
    let e = st.heads[i];
    if (valid(e)) {
      if (scorching(e) || bodyScorched || st.necks[i].some(scorching)) st.scorchUntil[i] = now + SCORCH_TICKS;
      const h = healthOf(e);
      if (h) {
        const cur = h.currentValue;
        if (cur <= 0) {
          onHeadDeath(st, i, undefined, false, now);
          continue;
        }
        if (cur !== st.hp[i]) setHp(st, i, cur);
      }
    }
    total += st.hp[i];

    // --- цель и наведение
    let s = st.strike[i];
    let target = null;
    if (s) {
      if (alive(s.e)) {
        const center = s.point ?? aimPoint(s.e);
        target = { e: s.e, center, aim: aimAt(yaw, i, base, rest, center) };
      }
    } else {
      target = pickTarget(yaw, i, base, rest, cands, range);
    }

    if (target) {
      const a = target.aim;
      setProp(st, `cb:yaw${i}`, clamp(stepTo(a.ya, 2), -90, 90));
      setProp(st, `cb:pitch${i}`, clamp(stepTo(a.pitch, 2), 0, 180));
      if (s) {
        if (now - s.start <= HIT_TICK + 1) setStrikeAngles(st, i, base, a);
        setProp(st, `cb:look${i}`, clamp(stepTo(a.pitch - 90, 3), -90, 90));
      } else {
        setProp(st, `cb:look${i}`, clamp(stepTo(a.look, 3), -90, 90));
      }
    } else if (!s) {
      setProp(st, `cb:pitch${i}`, -1); // целей нет: шея возвращается в покой
    }

    // --- выпад: укус вблизи, плевок, если укусом не достать
    if (s) {
      const t = now - s.start;
      if (t >= HIT_TICK && !s.done) {
        s.done = true;
        if (s.spit) spit(st, i, s);
        else bite(st, i, s, base);
      }
      if (t >= STRIKE_LEN) {
        st.strike[i] = s = null;
        st.cd[i] = now + 50 + Math.floor(Math.random() * 30);
      }
    } else if (target && now >= st.cd[i] && now - (lastBite.get(target.e.id) ?? -1e9) >= BITE_GAP) {
      const vsCyclops = target.e.typeId === CYCLOPS;
      const held = vsCyclops && shared.holder.get(st.body.id)?.id === target.e.id;
      let near = target.aim.d <= REACH || held;
      let point;
      if (vsCyclops && !near) {
        const bodyPt = cyclopsBodyPoint(target.e, base);
        if (dist(base, bodyPt) <= REACH && Math.random() < 0.5) {
          near = true;                       // глаз высоко — кусает за ногу или руку
          point = bodyPt;
          target.aim = aimAt(yaw, i, base, rest, bodyPt);
        }
      }
      // укусом не достать — плевок ядом (одна голова за раз, в ярости — чаще)
      const canSpit = !near && target.aim.d <= SPIT_RANGE && now >= (st.nextSpit ?? 0);
      if (near || canSpit) {
        if (!near) st.nextSpit = now + (enraged ? SPIT_GAP / 2 : SPIT_GAP);
        st.strike[i] = s = { start: now, e: target.e, done: false, spit: !near, point };
        lastBite.set(target.e.id, now);
        setStrikeAngles(st, i, base, target.aim);
        sound(dim, "cb.hydra.hiss", rest, 1.2, 1);
        if (!near) st.cd[i] = now + 70 + Math.floor(Math.random() * 30);
      }
    }
    setProp(st, `cb:act${i}`, s ? 1 : now < st.hurtUntil[i] ? 2 : 0);

    // --- хитбокс едет вместе с нарисованной головой
    let center = rest;
    if (s && st.apex[i]) {
      const k = lungeEnv(now - s.start) * (s.spit ? 0.5 : 1);
      if (k > 0) center = lerp(rest, st.apex[i], k);
    }
    e = st.heads[i];
    if (valid(e)) {
      try { e.teleport(proxyLoc(center), { dimension: dim, keepVelocity: false, rotation: { x: 0, y: yaw } }); } catch {}
    } else {
      spawnHead(st, i, center, now);
    }
    syncNecks(st, i, loc, yaw, { x: center.x - rest.x, y: center.y - rest.y, z: center.z - rest.z }, now);
  }

  if (st.dying) return;
  checkDeath(st);
  if (st.dying) return;
  if (aliveCount(st) === 0 && now - st.warnAt > 200) {
    st.warnAt = now;
    tell(st, T("hyd.not_cauterized"));
  }
  // полоска босса показывает суммарное здоровье голов
  const bh = healthOf(body);
  if (bh && Math.abs(bh.currentValue - total) >= 0.5) {
    try { bh.setCurrentValue(clamp(total, 1, bh.effectiveMax)); } catch {}
  }
}

// ---------- мост для циклопа ----------
shared.hydraHeads = (body) => {
  const st = states.get(body.id) ?? (valid(body) ? stateOf(body, system.currentTick) : undefined);
  return st ? aliveCount(st) : 0;
};
shared.hydraHeadNear = (body, pos) => {
  const st = states.get(body.id);
  if (!st) return undefined;
  let best, bd = Infinity;
  for (let i = 0; i < N; i++) {
    if (st.hp[i] <= 0) continue;
    for (const e of [st.heads[i], ...st.necks[i]]) {
      if (!valid(e)) continue;
      const d = dist(e.location, pos);
      if (d < bd) { bd = d; best = e; }
    }
  }
  return best;
};
shared.devourHydra = (body, killer) => {
  const st = states.get(body.id) ?? stateOf(body, system.currentTick);
  for (let i = 0; i < N; i++) {
    st.hp[i] = 0;
    st.burn[i] = true;
  }
  st.killer = killer;
  tell(st, T("hyd.swallowed"));
  beginDeath(st);
};

// ---------- события ----------
function bodyOf(bodyId) {
  const st = states.get(bodyId);
  if (st && valid(st.body)) return st;
  try {
    const b = world.getEntity(bodyId);
    if (valid(b) && b.typeId === HYDRA) return stateOf(b, system.currentTick);
  } catch {}
  return undefined;
}

function hint(player, now) {
  if (!isPlayer(player) || now - (hintAt.get(player.id) ?? -1e9) < 30) return;
  hintAt.set(player.id, now);
  actionBar(player, T("hyd.hit_heads"));
  try { sound(player.dimension, "cb.hydra.clang", player.location, 0.8, 1); } catch {}
}

function subscribe(signal, fn) {
  try { signal.subscribe(fn); } catch (e) { console.warn(`[hydra] event unavailable: ${e}`); }
}

// Удар по шее: хитбокс шеи сразу лечится, а урон получает голова этой шеи.
subscribe(world.afterEvents.entityHurt, (ev) => {
  const n = ev.hurtEntity;
  if (n?.typeId !== NECK) return;
  const l = linkOf(n);
  const nh = healthOf(n);
  try { if (nh) nh.setCurrentValue(nh.effectiveMax); } catch {}
  const st = l && bodyOf(l.bodyId);
  if (!st || st.dying || st.hp[l.idx] <= 0) return;
  const now = system.currentTick;
  const i = l.idx;
  const src = ev.damageSource;
  const attacker = src?.damagingEntity;
  if (valid(attacker) && !NEVER.has(attacker.typeId)) {
    grudges.set(attacker.id, now + 600);
    st.killer = attacker;
  }
  const hot = scorchingHit(src);
  if (hot) st.scorchUntil[i] = now + SCORCH_TICKS;
  st.hurtUntil[i] = now + 6;
  const head = st.heads[i];
  const hh = valid(head) ? healthOf(head) : undefined;
  const cur = Math.max(0, (hh ? hh.currentValue : st.hp[i]) - ev.damage);
  if (cur <= 0) {
    onHeadDeath(st, i, attacker, hot, now);
    return;
  }
  try { if (hh) hh.setCurrentValue(cur); } catch {}
  setHp(st, i, cur);
  fx(n.dimension, "minecraft:critical_hit_emitter", { x: n.location.x, y: n.location.y + NECK_HALF, z: n.location.z });
  if (isPlayer(attacker)) {
    
  }
});

subscribe(world.afterEvents.entityHurt, (ev) => {
  const e = ev.hurtEntity;
  if (e?.typeId !== HEAD) return;
  const l = linkOf(e);
  const st = l && bodyOf(l.bodyId);
  if (!st || st.dying) return;
  const now = system.currentTick;
  const i = l.idx;
  const src = ev.damageSource;
  const attacker = src?.damagingEntity;
  if (valid(attacker) && !NEVER.has(attacker.typeId)) {
    grudges.set(attacker.id, now + 600); // обидчика гидра помнит 30 секунд
    st.killer = attacker;
  }
  const hot = scorchingHit(src);
  if (hot) st.scorchUntil[i] = now + SCORCH_TICKS;
  st.hurtUntil[i] = now + 6;
  const cur = healthOf(e)?.currentValue ?? 0;
  if (cur <= 0) {
    onHeadDeath(st, i, attacker, hot, now);
    return;
  }
  setHp(st, i, cur);
  fx(e.dimension, "minecraft:critical_hit_emitter", { x: e.location.x, y: e.location.y + HALF, z: e.location.z });
  if (isPlayer(attacker)) {
    
  }
});

subscribe(world.afterEvents.entityDie, (ev) => {
  const e = ev.deadEntity;
  let type;
  try { type = e?.typeId; } catch { return; }
  if (type === HEAD) {
    const l = linkOf(e);
    const st = l && bodyOf(l.bodyId);
    if (st && !st.dying) onHeadDeath(st, l.idx, ev.damageSource?.damagingEntity, scorchingHit(ev.damageSource), system.currentTick);
  } else if (type === HYDRA) {
    const st = states.get(e.id);
    if (st) {
      for (const h of st.heads) safeRemove(h);
      for (let i = 0; i < N; i++) removeNecks(st, i);
      states.delete(e.id);
    }
  }
});

subscribe(world.afterEvents.entityHitEntity, (ev) => {
  if (ev.hitEntity?.typeId === HYDRA) hint(ev.damagingEntity, system.currentTick);
});

subscribe(world.afterEvents.projectileHitEntity, (ev) => {
  let hit;
  try { hit = ev.getEntityHit()?.entity; } catch { return; }
  if (hit?.typeId === HYDRA) hint(ev.source, system.currentTick);
});

system.runInterval(() => {
  const now = system.currentTick;
  for (const id of DIMENSIONS) {
    let dim;
    try { dim = world.getDimension(id); } catch { continue; }
    let bodies = [];
    try { bodies = dim.getEntities({ type: HYDRA }); } catch {}
    for (const body of bodies) {
      if (!alive(body)) continue;
      try { tickBody(body, now); } catch (e) { console.warn(`[hydra] ${e}`); }
    }
    if (now % 40 === 7) sweepOrphans(dim);
  }
  if (now % 20 === 9) {
    for (const [id, st] of states) {
      if (!valid(st.body) || now - st.seen > 60) { // тело выгружено или исчезло
        for (const h of st.heads) safeRemove(h);
        for (let i = 0; i < N; i++) removeNecks(st, i);
        states.delete(id);
      }
    }
    for (const [id, until] of grudges) if (until <= now) grudges.delete(id);
    for (const [id, t] of lastBite) if (now - t > 200) lastBite.delete(id);
    for (const [id, t] of hintAt) if (now - t > 200) hintAt.delete(id);
  }
}, 1);

// Перенаправление ударов других боссов и мобов по телу Гидры (cb:hydra) в ближайшую живую голову (cb:hydra_head)
const bodyRedirectCd = new Map();
world.afterEvents.entityHitEntity.subscribe((ev) => {
  const body = ev.hitEntity;
  const atk = ev.damagingEntity;
  if (!body || body.typeId !== HYDRA || !atk || !valid(atk) || atk.typeId === HEAD || atk.typeId === NECK || atk.typeId === HYDRA) return;
  if (isPlayer(atk)) return;
  const now = system.currentTick;
  const last = bodyRedirectCd.get(atk.id) ?? 0;
  if (now - last < 8) return;
  bodyRedirectCd.set(atk.id, now);
  const head = shared.hydraHeadNear?.(body, atk.location);
  if (head && valid(head) && alive(head)) {
    const dmg = atk.typeId === "cb:fel_lord" ? 14 : (atk.typeId === "cb:minotaur" ? 12 : 9);
    try { head.applyDamage(dmg, { cause: EntityDamageCause.entityAttack, damagingEntity: atk }); } catch {}
  }
});

