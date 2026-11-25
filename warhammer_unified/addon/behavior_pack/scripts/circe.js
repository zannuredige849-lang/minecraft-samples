// Цирцея — могущественная волшебница с острова Ээя (70 HP).
//  - Первой атакует Вардена (minecraft:warden), а также сражается со своими обидчиками.
//  - Помимо удара посохом/ладонью в ближнем бою (6 урона), колдует энергетические шары (cb:circe_orb), наносящие 7 магического урона.
//  - Отходит и телепортируется назад от непрерывно атакующих или зажимающих её вблизи мобов.
//  - НЕ может превратить в животное боссов: Визера, Дракона Края, Циклопа, Гидру, Вардена, Минотавра, Повелителя Скверны, Короля-лича, Повелителя ужаса и Богов Олимпа (им её заклинания наносят прямой магический урон и ослабление).
//  - Гул'Дана (cb:guldan) превращает в животное ТОЛЬКО на 10 секунд (200 тиков), после чего Гул'Дан возвращает свой облик и здоровье!
import { world, system, EntityDamageCause, ItemStack } from "@minecraft/server";
import { DIMENSIONS, valid, alive, healthOf, isPlayer, inSurvival, sub, len, fx, sound, playersNear, actionBar, bossName, BOSS_NAMES, shared } from "./util.js";
import { T } from "./i18n.js";

const CIRCE = "cb:circe";
export const FORM_TYPES = ["cb:hex_chicken", "cb:hex_goat", "cb:hex_pig", "cb:hex_sheep", "cb:hex_horse"];
const FOE_TAG = "cb_circe_foe";
export const NAME = BOSS_NAMES[CIRCE];

export const CAST_LEN = 24, CAST_HIT = 12;
export const STRIKE_LEN = 12, STRIKE_HIT = 7;
const CAST_GAP = 65;          // между заклинаниями превращения
const ORB_GAP = 30;           // каждые 1.5 с — энергетический шар, наносящий урон
const STRIKE_GAP = 8;
const STRIKE_REACH = 3.2;
const STRIKE_DAMAGE = 6;
const ORB_DAMAGE = 7;
const CAST_RANGE = 22;
const RETREAT_CD = 70;        // 3.5 с кулдаун телепортации назад при натиске врагов
const GULDAN_HEX_TICKS = 200; // 10 секунд (200 тиков) длится превращение Гул'Дана в животное!
const GULDAN_REHEX_CD = 260;  // пауза перед повторным превращением Гул'Дана
const CURSE_TICKS = 600;
const CURSE_REFRESH = 200;
const OFFENDERS = "cb:offenders";
const HEX_KEY = "cb:hex";
const FREED_KEY = "cb:circe_freed";
const SEQ_KEY = "cb:hex_seq";

function worldJson(key, fallback) {
  try { return JSON.parse(world.getDynamicProperty(key) ?? "null") ?? fallback; } catch { return fallback; }
}
function nextSeq() {
  const n = (worldJson(SEQ_KEY, 0) | 0) + 1;
  try { world.setDynamicProperty(SEQ_KEY, JSON.stringify(n)); } catch {}
  return n;
}
function freeAll(circeId) {
  const freed = worldJson(FREED_KEY, {});
  freed[circeId] = worldJson(SEQ_KEY, 0) | 0;
  const keys = Object.keys(freed);
  if (keys.length > 64) delete freed[keys[0]];
  try { world.setDynamicProperty(FREED_KEY, JSON.stringify(freed)); } catch {}
}
const CALM_AFTER = 600;
const GRUDGE = 1200;

export const FORMS = [
  { type: "minecraft:chicken", insult: "This is what you are, silly chicken!",
    effects: [["slow_falling", 0], ["slowness", 0]], ambient: "mob.chicken.say", hurt: "mob.chicken.hurt" },
  { type: "minecraft:goat", insult: "This is what you are, stubborn goat!",
    effects: [["jump_boost", 2], ["slowness", 0]], ambient: "mob.goat.ambient", hurt: "mob.goat.hurt" },
  { type: "minecraft:pig", insult: "This is what you are, filthy pig!",
    effects: [["slowness", 1]], ambient: "mob.pig.say", hurt: "mob.pig.say" },
  { type: "minecraft:sheep", insult: "This is what you are, dull ram!",
    effects: [["slowness", 1]], ambient: "mob.sheep.say", hurt: "mob.sheep.say" },
  { type: "minecraft:horse", insult: "This is what you are, beast of burden!",
    effects: [["speed", 1], ["jump_boost", 1]], ambient: "mob.horse.idle", hurt: "mob.horse.hit" },
];
export const FORM = { CHICKEN: 0, GOAT: 1, PIG: 2, SHEEP: 3, HORSE: 4 };
export const CURSE = [["mining_fatigue", 2], ["hunger", 2], ["weakness", 1]];
const HEX_EFFECTS = ["invisibility", ...new Set([...CURSE, ...FORMS.flatMap((f) => f.effects)].map((x) => x[0]))];
const formIndex = (form) => (Number.isInteger(form) && form >= 0 && form < FORMS.length ? form : FORM.PIG);

export const EGG_MIN = 6000, EGG_SPREAD = 6000;
export const RAM_COOLDOWN = 60;
export const GRAZE_TICKS = 40;
const PIG_FOOD = new Set(["minecraft:carrot", "minecraft:potato", "minecraft:beetroot"]);

export const ARMOR_SLOTS = ["Head", "Chest", "Legs", "Feet", "Offhand"];
const OLD_ARMOR_MARKS = ["§8§oСнято чарами Цирцеи: ", "§8§oRemoved by Circe's magic: "];
export const ARMOR_MARK = "§8§oRemoved by Circe's magic · Снято чарами Цирцеи: ";
const markOf = (l) => (typeof l === "string" ? [ARMOR_MARK, ...OLD_ARMOR_MARKS].find((m) => l.startsWith(m)) : undefined);

// Боссы, которых Цирцея НЕ может превратить в животное (Визер, Дракон Края, Циклоп, Гидра, Варден и новые боссы/боги)
const BOSSES = new Set([
  CIRCE,
  "cb:cyclops",
  "cb:hydra",
  "cb:hydra_head",
  "cb:hydra_neck",
  "minecraft:ender_dragon",
  "minecraft:wither",
  "minecraft:warden",
  "minecraft:elder_guardian",
  "cb:minotaur",
  "cb:fel_lord",
  "cb:lich_king",
  "cb:ice_spirit",
  "cb:dreadlord",
  "cb:zeus",
  "cb:poseidon",
  "cb:hades",
  "cb:ares",
  "cb:athena",
  "cb:hephaestus",
]);

const NOT_ALIVE = new Set([
  ...FORM_TYPES, "cb:hydra_spit", "cb:circe_orb", "cb:fel_orb", "cb:fel_rain", "cb:sargeras_prompt",
  "minecraft:item", "minecraft:xp_orb", "minecraft:armor_stand", "minecraft:arrow", "minecraft:painting"
]);

const states = new Map();   // id Цирцеи -> { act, nextCast, nextOrb, nextStrike, nextRetreat, closeTicks, recentHits, quietSince, greeted }
const foes = new Map();     // id Цирцеи -> Map(id обидчика -> тик)
const hexed = new Map();    // id игрока -> запись превращения
// Временное превращение Гул'Дана на 10 секунд: beastId -> { dimId, returnAt, hp, phase, circeId, isle, hx, hy, hz, hasHome }
const tempHexedGuldan = new Map();
let guldanHexImmuneUntil = 0;

const hdist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function stateOf(c) {
  let st = states.get(c.id);
  if (!st) {
    st = {
      act: null,
      nextCast: 0,
      nextOrb: 0,
      nextStrike: 0,
      nextRetreat: 0,
      closeTicks: 0,
      recentHits: [],
      quietSince: system.currentTick,
      greeted: new Map()
    };
    states.set(c.id, st);
  }
  return st;
}
function foesOf(c) {
  let f = foes.get(c.id);
  if (!f) foes.set(c.id, (f = new Map()));
  return f;
}

function isAngry(c) {
  try { return c.getProperty("cb:angry") === true; } catch { return false; }
}

function ensureName(c) {
  bossName(c);
}

// ---------- гнев ----------
function anger(c, a) {
  if (!valid(a) || a.id === c.id || a.typeId === CIRCE || NOT_ALIVE.has(a.typeId)) return;
  if (isPlayer(a) && !inSurvival(a)) return;
  if (hexed.has(a.id) || tempHexedGuldan.has(a.id)) return;
  // Если ударили по телу Гидры, добавляем в цели саму Гидру (бить будем по живым головам)
  const now = system.currentTick;
  foesOf(c).set(a.id, now + GRUDGE);
  if (isPlayer(a)) {
    try { a.addTag(FOE_TAG); } catch {}
    addOffender(c, a.id);
  }
  stateOf(c).quietSince = now;
  if (isAngry(c)) return;
  try { c.triggerEvent("cb:anger"); } catch {}
  sound(c.dimension, "cb.circe.laugh", c.location, 2.5, 0.9);
  for (const p of playersNear(c.dimension, c.location, 40)) {
    try {
      p.onScreenDisplay.setTitle(" ", { subtitle: T("circe.furious"), fadeInDuration: 5, stayDuration: 40, fadeOutDuration: 10 });
    } catch {}
  }
}

function offendersOf(c) {
  try { return new Set(JSON.parse(c.getDynamicProperty(OFFENDERS) ?? "[]")); } catch { return new Set(); }
}
function addOffender(c, id) {
  const s = offendersOf(c);
  if (s.has(id)) return;
  s.add(id);
  try { c.setDynamicProperty(OFFENDERS, JSON.stringify([...s])); } catch {}
}

function calmDown(c) {
  try { c.triggerEvent("cb:calm_down"); } catch {}
  for (const id of foesOf(c).keys()) {
    try { world.getEntity(id)?.removeTag(FOE_TAG); } catch {}
  }
  foes.delete(c.id);
  for (const p of playersNear(c.dimension, c.location, 40)) actionBar(p, T("circe.calm"));
}

// Отступление и телепортация назад от непрерывно атакующих её мобов!
function retreatTeleport(c, attacker, now) {
  const st = stateOf(c);
  if (now < st.nextRetreat) return false;
  st.nextRetreat = now + RETREAT_CD;
  st.closeTicks = 0;
  st.recentHits.length = 0;

  const dim = c.dimension;
  const oldLoc = { ...c.location };
  const dx = c.location.x - attacker.location.x;
  const dz = c.location.z - attacker.location.z;
  const baseAng = Math.atan2(dz, dx) + (Math.random() - 0.5) * 0.65;

  // Сначала отталкиваем атакующего назад волной магии
  const n = Math.hypot(dx, dz) || 1;
  try { attacker.applyKnockback(-dx / n, -dz / n, 1.3, 0.35); } catch {}

  // Ищем безопасную точку в 7–9 блоках позади Цирцеи
  const dist = 7.5 + Math.random() * 2.0;
  const tx = c.location.x + Math.cos(baseAng) * dist;
  const tz = c.location.z + Math.sin(baseAng) * dist;
  let ty = Math.floor(c.location.y);
  try {
    for (let dy = 3; dy >= -4; dy--) {
      const b = dim.getBlock({ x: Math.floor(tx), y: ty + dy, z: Math.floor(tz) });
      const above = dim.getBlock({ x: Math.floor(tx), y: ty + dy + 1, z: Math.floor(tz) });
      if (b && b.typeId !== "minecraft:air" && !/water|lava/.test(b.typeId) && (!above || above.typeId === "minecraft:air")) {
        ty = ty + dy + 1;
        break;
      }
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      fx(dim, "minecraft:witchspell_emitter", { x: oldLoc.x + Math.cos(a), y: oldLoc.y + 0.5, z: oldLoc.z + Math.sin(a) });
    }
    sound(dim, "mob.endermen.portal", oldLoc, 1.6, 1.15);
    c.teleport({ x: tx, y: ty, z: tz }, { facingLocation: attacker.location, keepVelocity: false });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      fx(dim, "minecraft:witchspell_emitter", { x: tx + Math.cos(a), y: ty + 0.5, z: tz + Math.sin(a) });
    }
    sound(dim, "mob.endermen.portal", { x: tx, y: ty, z: tz }, 1.6, 1.25);
  } catch {}

  // Сразу после отскока выпускает энергетический шар в преследователя!
  shootEnergyOrb(c, attacker);
  return true;
}

world.afterEvents.entityHurt.subscribe((ev) => {
  const c = ev.hurtEntity;
  if (c?.typeId !== CIRCE) return;
  const a = ev.damageSource?.damagingEntity;
  const now = system.currentTick;
  if (a) {
    anger(c, a);
    const st = stateOf(c);
    st.recentHits = st.recentHits.filter((t) => now - t <= 65);
    st.recentHits.push(now);
    // Если мобы атакуют её без остановки (2+ удара подряд или зажали вблизи) — отходит и телепортируется назад!
    if (valid(a) && alive(a) && (st.recentHits.length >= 2 || hdist(a.location, c.location) <= 4.0)) {
      retreatTeleport(c, a, now);
    }
  }
});

// ---------- энергетические шары и чары ----------
function clearLine(c, e) {
  try {
    const from = { x: c.location.x, y: c.location.y + 1.6, z: c.location.z };
    let to;
    try { to = e.getHeadLocation(); } catch { to = { x: e.location.x, y: e.location.y + 1, z: e.location.z }; }
    const d = sub(to, from);
    const L = len(d) || 1;
    const hit = c.dimension.getBlockFromRay(from, { x: d.x / L, y: d.y / L, z: d.z / L },
      { maxDistance: L, includeLiquidBlocks: false, includePassableBlocks: false });
    if (!hit?.block) return true;
    const b = hit.block.location;
    return len(sub({ x: b.x + 0.5, y: b.y + 0.5, z: b.z + 0.5 }, from)) >= L - 0.8;
  } catch {
    return true;
  }
}

// Если цель — неуязвимое тело Гидры, перенаправляем энергетический шар в ближайшую живую голову Гидры
function resolveActualTarget(c, e) {
  if (!e || !valid(e)) return undefined;
  if (e.typeId === "cb:hydra") {
    const head = shared.hydraHeadNear?.(e, c.location);
    if (head && valid(head) && alive(head)) return head;
  }
  return e;
}

// Колдовство энергетического шара (cb:circe_orb), наносящего магический урон
export function shootEnergyOrb(c, rawTarget) {
  const target = resolveActualTarget(c, rawTarget);
  if (!target || !alive(target)) return false;
  const dim = c.dimension;
  const from = { x: c.location.x, y: c.location.y + 1.45, z: c.location.z };
  const to = { x: target.location.x, y: target.location.y + 0.9, z: target.location.z };
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const L = Math.hypot(dx, dy, dz) || 1;
  const ux = dx / L, uy = dy / L, uz = dz / L;

  try {
    const orb = dim.spawnEntity("cb:circe_orb", {
      x: from.x + ux * 1.1,
      y: from.y + uy * 1.1,
      z: from.z + uz * 1.1
    });
    const proj = orb.getComponent("minecraft:projectile");
    if (proj) {
      proj.owner = c;
      proj.shoot({ x: ux * 1.3, y: uy * 1.3, z: uz * 1.3 });
    }
  } catch {}

  // Луч чародейской энергии и гарантированный магический урон при прямом попадании
  const steps = Math.min(16, Math.ceil(L * 1.2));
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    fx(dim, "minecraft:witchspell_emitter", {
      x: from.x + dx * k,
      y: from.y + dy * k,
      z: from.z + dz * k
    });
  }
  sound(dim, "cb.circe.cast", from, 1.8, 1.15);
  system.runTimeout(() => {
    if (!valid(target) || !alive(target)) return;
    try {
      target.applyDamage(ORB_DAMAGE, { cause: EntityDamageCause.magic, damagingEntity: c });
      fx(target.dimension, "minecraft:witchspell_emitter", { x: target.location.x, y: target.location.y + 1.0, z: target.location.z });
    } catch {}
  }, 6);
  return true;
}

function bolt(c, e) {
  const dim = c.dimension;
  const from = { x: c.location.x, y: c.location.y + 1.5, z: c.location.z };
  const to = { x: e.location.x, y: e.location.y + 1, z: e.location.z };
  const n = Math.min(24, Math.ceil(len(sub(to, from)) * 1.5));
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    fx(dim, "minecraft:witchspell_emitter", { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, z: from.z + (to.z - from.z) * k });
  }
  sound(dim, "cb.circe.cast", from, 2, 1);
}

function setEffect(e, id, ticks, amp) {
  try { e.addEffect(id, ticks, { amplifier: amp, showParticles: id !== "invisibility" }); } catch {}
}

// Возврат Гул'Дана из 10-секундного превращения в животное!
function restoreGuldanFromBeast(beastId, rec) {
  tempHexedGuldan.delete(beastId);
  let dim;
  try { dim = world.getDimension(rec.dimId); } catch { return; }
  const beast = world.getEntity(beastId);
  const loc = beast && valid(beast) ? { ...beast.location } : rec.lastLoc;
  if (beast && valid(beast)) {
    try { beast.remove(); } catch {}
  }
  if (!loc) return;
  try {
    const g = dim.spawnEntity("cb:guldan", loc);
    const gh = healthOf(g);
    if (gh && typeof rec.hp === "number") {
      gh.setCurrentValue(Math.max(10, Math.min(gh.effectiveMax, rec.hp)));
    }
    if (rec.phase) {
      try { g.setProperty("cb:phase", rec.phase); } catch {}
    }
    if (rec.hasHome) {
      try {
        g.addTag("cb_isle_home");
        if (rec.isle) g.setDynamicProperty("cb:isle", rec.isle);
        if (typeof rec.hx === "number") g.setDynamicProperty("cb:hx", rec.hx);
        if (typeof rec.hy === "number") g.setDynamicProperty("cb:hy", rec.hy);
        if (typeof rec.hz === "number") g.setDynamicProperty("cb:hz", rec.hz);
      } catch {}
    }
    fx(dim, "minecraft:huge_explosion_emitter", { x: loc.x, y: loc.y + 1, z: loc.z });
    fx(dim, "minecraft:witchspell_emitter", { x: loc.x, y: loc.y + 1.2, z: loc.z });
    sound(dim, "mob.evocation_illager.prepare_summon", loc, 2.0, 0.8);
    const circe = rec.circeId ? world.getEntity(rec.circeId) : undefined;
    if (circe && valid(circe) && alive(circe)) {
      anger(circe, g);
    }
  } catch {}
}

// form — номер облика; по умолчанию случайный
export function hex(e, c, form) {
  const pick = () => (Number.isInteger(form) ? formIndex(form) : Math.floor(Math.random() * FORMS.length));
  if (!alive(e) || NOT_ALIVE.has(e.typeId)) return;
  const dim = e.dimension;
  const now = system.currentTick;
  if (isPlayer(e)) {
    if (!inSurvival(e)) return;
    if (hexed.has(e.id)) {
      shootEnergyOrb(c, e);
      return;
    }
    const fi = pick();
    const f = spawnForm(e, fi);
    hexed.set(e.id, newRecord(f?.id, fi, c?.id, now));
    try { e.setDynamicProperty(HEX_KEY, JSON.stringify({ form: fi, by: c?.id, seq: nextSeq() })); } catch {}
    applyCurse(e, fi);
    stripArmor(e);
    if (c) {
      foesOf(c).delete(e.id);
      try { e.removeTag(FOE_TAG); } catch {}
    }
    try {
      e.onScreenDisplay.setTitle(" ", { subtitle: T(`circe.insult${fi}`), fadeInDuration: 0, stayDuration: 60, fadeOutDuration: 15 });
    } catch {}
    sound(dim, "cb.circe.hex", e.location, 2, 1);
    fx(dim, "minecraft:huge_explosion_emitter", e.location);
    return;
  }

  // ОСОБОЕ ПРАВИЛО: Гул'Дана (cb:guldan) Цирцея превращает в животное ЛИШЬ НА 10 СЕКУНД (200 тиков)!
  if (e.typeId === "cb:guldan") {
    if (now < guldanHexImmuneUntil) {
      shootEnergyOrb(c, e);
      return;
    }
    guldanHexImmuneUntil = now + GULDAN_HEX_TICKS + GULDAN_REHEX_CD;
    const gh = healthOf(e);
    const savedHp = gh ? gh.currentValue : 100;
    let savedPhase = 1;
    try { savedPhase = e.getProperty("cb:phase") ?? 1; } catch {}
    let hasHome = false, isle, hx, hy, hz;
    try {
      hasHome = e.hasTag("cb_isle_home");
      isle = e.getDynamicProperty("cb:isle");
      hx = e.getDynamicProperty("cb:hx");
      hy = e.getDynamicProperty("cb:hy");
      hz = e.getDynamicProperty("cb:hz");
    } catch {}
    const beastForm = FORMS[pick()];
    const loc = { ...e.location };
    let beast;
    try { beast = dim.spawnEntity(beastForm.type, loc); } catch { return; }
    try { beast.nameTag = ""; } catch {}
    tempHexedGuldan.set(beast.id, {
      dimId: String(dim.id).replace("minecraft:", ""),
      returnAt: now + GULDAN_HEX_TICKS,
      lastLoc: loc,
      hp: savedHp,
      phase: savedPhase,
      circeId: c?.id,
      hasHome, isle, hx, hy, hz
    });
    fx(dim, "minecraft:huge_explosion_emitter", loc);
    sound(dim, "cb.circe.hex", loc, 2.2, 1.0);
    for (const p of playersNear(dim, loc, 40)) {
      actionBar(p, "§dЦирцея превратила Гул'Дана в зверя на 10 секунд!");
    }
    try { e.remove(); } catch {}
    return;
  }

  // Боссов (Визер, Дракон Края, Циклоп, Гидра, Варден и др.) превратить НЕЛЬЗЯ — по ним бьёт магический взрыв!
  if (BOSSES.has(e.typeId)) {
    const effTarget = c ? resolveActualTarget(c, e) : e;
    setEffect(effTarget, "slowness", 160, 2);
    setEffect(effTarget, "weakness", 160, 1);
    try { effTarget.applyDamage(9, { cause: EntityDamageCause.magic, damagingEntity: c }); } catch {}
    fx(dim, "minecraft:witchspell_emitter", { x: effTarget.location.x, y: effTarget.location.y + 1.2, z: effTarget.location.z });
    sound(dim, "cb.circe.hex", effTarget.location, 2, 0.7);
    return;
  }

  const h = healthOf(e);
  if (!h) return;
  // Не превращаем уже временно заколдованного Гул'Дана повторно
  if (tempHexedGuldan.has(e.id)) return;
  const beastForm = FORMS[pick()];
  if (e.typeId === beastForm.type) return;
  let beast;
  try { beast = dim.spawnEntity(beastForm.type, e.location); } catch { return; }
  try { if (e.nameTag) beast.nameTag = e.nameTag; } catch {}
  for (const f of foes.values()) if (f.delete(e.id)) f.set(beast.id, now);
  fx(dim, "minecraft:huge_explosion_emitter", e.location);
  sound(dim, "cb.circe.hex", e.location, 2, 1.1);
  try { e.remove(); } catch {}
}

function newRecord(formId, form, by, now) {
  return { t0: now, formId, form, by, refresh: now + CURSE_REFRESH, egg: now + EGG_MIN + Math.floor(Math.random() * EGG_SPREAD),
    ram: 0, graze: 0, sheared: false, ambient: now + 160 + Math.floor(Math.random() * 160) };
}

function applyCurse(p, form) {
  setEffect(p, "invisibility", CURSE_TICKS, 0);
  for (const [id, amp] of CURSE) setEffect(p, id, CURSE_TICKS, amp);
  for (const [id, amp] of FORMS[formIndex(form)].effects) setEffect(p, id, CURSE_TICKS, amp);
}

function clearCurse(p) {
  for (const e of HEX_EFFECTS) { try { p.removeEffect(e); } catch {} }
}

// ---------- броня ----------
function equipOf(p) {
  try { return p.getComponent("minecraft:equippable"); } catch { return undefined; }
}
function containerOf(p) {
  try { return p.getComponent("minecraft:inventory")?.container; } catch { return undefined; }
}
function loreOf(it) {
  try { return it.getLore?.() ?? []; } catch { return []; }
}
function setLore(it, lore) {
  try { it.setLore(lore); } catch {}
}
function markSlot(it) {
  const lore = loreOf(it);
  const line = lore.find((l) => markOf(l));
  return line ? line.slice(markOf(line).length) : undefined;
}
function unmark(it) {
  setLore(it, loreOf(it).filter((l) => !markOf(l)));
}

export function stripArmor(p) {
  const eq = equipOf(p);
  const inv = containerOf(p);
  if (!eq) return 0;
  let moved = 0, dropped = 0;
  for (const slot of ARMOR_SLOTS) {
    let it;
    try { it = eq.getEquipment(slot); } catch { continue; }
    if (!it) continue;
    unmark(it);
    setLore(it, [...loreOf(it), ARMOR_MARK + slot]);
    try { eq.setEquipment(slot, undefined); } catch { continue; }
    let rest = it;
    try { rest = inv ? inv.addItem(it) : it; } catch { rest = it; }
    if (rest) {
      try { p.dimension.spawnItem(rest, p.location); dropped++; } catch {}
    }
    moved++;
  }
  if (moved) {
    actionBar(p, T(dropped ? "circe.armor_dropped" : "circe.armor_bag"));
  }
  return moved;
}

export function restoreArmor(p) {
  const eq = equipOf(p);
  const inv = containerOf(p);
  if (!inv) return 0;
  let back = 0;
  const size = inv.size ?? 36;
  for (let i = 0; i < size; i++) {
    let it;
    try { it = inv.getItem(i); } catch { continue; }
    if (!it) continue;
    const slot = markSlot(it);
    if (!slot) continue;
    unmark(it);
    let free = false;
    try { free = eq && ARMOR_SLOTS.includes(slot) && !eq.getEquipment(slot); } catch {}
    try {
      if (free) { eq.setEquipment(slot, it); inv.setItem(i, undefined); back++; }
      else inv.setItem(i, it);
    } catch {}
  }
  return back;
}

function spawnForm(p, form) {
  let f;
  try { f = p.dimension.spawnEntity(FORM_TYPES[form], p.location); } catch { return undefined; }
  try { f.setDynamicProperty("cb:owner", p.id); } catch {}
  return f;
}

function unhex(id, quiet) {
  const h = hexed.get(id);
  if (!h) return;
  hexed.delete(id);
  try { world.getEntity(h.formId)?.remove(); } catch {}
  const p = world.getEntity(id);
  if (!valid(p)) return;
  try { p.setDynamicProperty(HEX_KEY, undefined); } catch {}
  clearCurse(p);
  restoreArmor(p);
  if (!quiet) {
    sound(p.dimension, "cb.circe.hex", p.location, 1.5, 1.3);
    actionBar(p, T("circe.human"));
  }
}

function tickHexed(now) {
  // 1) Проверяем 10-секундный таймер превращённого Гул'Дана
  for (const [beastId, rec] of tempHexedGuldan) {
    const beast = world.getEntity(beastId);
    if (beast && valid(beast) && alive(beast)) {
      rec.lastLoc = { ...beast.location };
      if (now % 8 === 0) {
        fx(beast.dimension, "minecraft:witchspell_emitter", { x: beast.location.x, y: beast.location.y + 0.8, z: beast.location.z });
      }
      const leftSec = Math.max(1, Math.ceil((rec.returnAt - now) / 20));
      try { beast.nameTag = ""; } catch {}
    }
    if (!beast || !valid(beast) || !alive(beast) || now >= rec.returnAt) {
      restoreGuldanFromBeast(beastId, rec);
    }
  }

  // 2) Заколдованные игроки
  for (const [id, h] of hexed) {
    const p = world.getEntity(id);
    if (!valid(p)) continue;
    if (!alive(p)) { try { world.getEntity(h.formId)?.remove(); } catch {} continue; }
    if (now >= h.refresh) { h.refresh = now + CURSE_REFRESH; applyCurse(p, h.form); }
    if (now % 10 === 0) stripArmor(p);
    let f = world.getEntity(h.formId);
    if (!valid(f)) {
      f = spawnForm(p, h.form);
      if (!f) continue;
      h.formId = f.id;
      if (h.sheared) { try { f.setProperty("cb:sheared", true); } catch {} }
    }
    tickHabits(p, f, h, now);
    let yaw = 0;
    try { yaw = p.getRotation().y; } catch {}
    try { f.teleport(p.location, { dimension: p.dimension, rotation: { x: 0, y: yaw }, keepVelocity: false }); } catch {}
    let speed = 0;
    try { const v = p.getVelocity(); speed = Math.min(1, Math.hypot(v.x, v.z) / 0.22); } catch {}
    try { if (Math.abs((f.getProperty("cb:speed") ?? 0) - speed) > 0.05) f.setProperty("cb:speed", Math.round(speed * 20) / 20); } catch {}
  }
}

// ---------- повадки зверей ----------
function onGround(p) {
  try { if (typeof p.isOnGround === "boolean") return p.isOnGround; } catch {}
  try { return Math.abs(p.getVelocity().y) < 0.01; } catch { return true; }
}
function blockBelow(p) {
  try { return p.dimension.getBlock({ x: Math.floor(p.location.x), y: Math.floor(p.location.y) - 1, z: Math.floor(p.location.z) }); } catch { return undefined; }
}
function dropAt(p, typeId, amount) {
  try { p.dimension.spawnItem(new ItemStack(typeId, amount), p.location); return true; } catch { return false; }
}

function tickHabits(p, f, h, now) {
  const form = FORMS[formIndex(h.form)];
  if (now >= h.ambient) {
    h.ambient = now + 160 + Math.floor(Math.random() * 200);
    sound(p.dimension, form.ambient, p.location, 1, 0.9 + Math.random() * 0.2);
  }
  switch (formIndex(h.form)) {
    case FORM.CHICKEN: {
      const air = !onGround(p);
      try { if (f.getProperty("cb:air") !== air) f.setProperty("cb:air", air); } catch {}
      if (now >= h.egg) {
        h.egg = now + EGG_MIN + Math.floor(Math.random() * EGG_SPREAD);
        if (dropAt(p, "minecraft:egg", 1)) sound(p.dimension, "mob.chicken.plop", p.location, 1, 1);
      }
      break;
    }
    case FORM.SHEEP: {
      if (!h.sheared) { h.graze = 0; break; }
      const b = blockBelow(p);
      if (p.isSneaking && b?.typeId === "minecraft:grass_block") {
        if (++h.graze >= GRAZE_TICKS) {
          h.graze = 0;
          try { b.setType("minecraft:dirt"); } catch {}
          setSheared(p, h, false);
          setEffect(p, "saturation", 1, 0);
          sound(p.dimension, "dig.grass", p.location, 1, 1);
          actionBar(p, T("circe.wool"));
        }
      } else h.graze = 0;
      break;
    }
  }
}

function setSheared(p, h, on) {
  h.sheared = on;
  try {
    const rec = JSON.parse(p.getDynamicProperty(HEX_KEY) ?? "null");
    if (rec) p.setDynamicProperty(HEX_KEY, JSON.stringify({ ...rec, sheared: on }));
  } catch {}
  try { world.getEntity(h.formId)?.setProperty("cb:sheared", on); } catch {}
}

function heldItem(p) {
  try { const it = equipOf(p)?.getEquipment("Mainhand"); if (it) return it; } catch {}
  try { return containerOf(p)?.getItem(p.selectedSlotIndex ?? 0); } catch { return undefined; }
}

world.afterEvents.entityHitEntity.subscribe((ev) => {
  const a = ev.damagingEntity;
  const t = ev.hitEntity;
  if (!valid(a) || !valid(t)) return;
  const now = system.currentTick;
  const ha = hexed.get(a.id);
  if (ha && formIndex(ha.form) === FORM.GOAT && now >= ha.ram) {
    ha.ram = now + RAM_COOLDOWN;
    const d = sub(t.location, a.location);
    const n = Math.hypot(d.x, d.z) || 1;
    const sprint = (() => { try { return a.isSprinting === true; } catch { return false; } })();
    try { t.applyKnockback(d.x / n, d.z / n, sprint ? 2.6 : 1.4, sprint ? 0.6 : 0.4); } catch {}
    sound(a.dimension, "mob.goat.ram_impact", t.location, 1, 1);
  }
  let ownerId = t.id;
  if (FORM_TYPES.includes(t.typeId)) { try { ownerId = t.getDynamicProperty("cb:owner") ?? t.id; } catch {} }
  const ht = hexed.get(ownerId);
  if (ht && ownerId !== a.id && formIndex(ht.form) === FORM.SHEEP && !ht.sheared && heldItem(a)?.typeId === "minecraft:shears") {
    const p = world.getEntity(ownerId);
    if (!valid(p)) return;
    setSheared(p, ht, true);
    dropAt(p, "minecraft:white_wool", 1 + Math.floor(Math.random() * 3));
    sound(p.dimension, "mob.sheep.shear", p.location, 1, 1);
    actionBar(p, T("circe.sheared"));
  }
});

world.afterEvents.entityHurt.subscribe((ev) => {
  const p = ev.hurtEntity;
  const h = p && hexed.get(p.id);
  if (!h) return;
  sound(p.dimension, FORMS[formIndex(h.form)].hurt, p.location, 1, 1);
});

world.afterEvents.itemCompleteUse?.subscribe((ev) => {
  const p = ev.source;
  const h = p && hexed.get(p.id);
  if (!h || formIndex(h.form) !== FORM.PIG || !PIG_FOOD.has(ev.itemStack?.typeId)) return;
  setEffect(p, "regeneration", 100, 1);
  setEffect(p, "saturation", 1, 1);
  sound(p.dimension, "mob.pig.say", p.location, 1, 1.2);
  actionBar(p, T("circe.oink"));
});

function restoreHexes(now) {
  let players = [];
  try { players = world.getPlayers(); } catch {}
  for (const p of players) {
    if (hexed.has(p.id)) continue;
    let rec;
    try { rec = JSON.parse(p.getDynamicProperty(HEX_KEY) ?? "null"); } catch {}
    if (!rec) continue;
    if (rec.by && (rec.seq ?? 0) <= (worldJson(FREED_KEY, {})[rec.by] ?? -1)) {
      try { p.setDynamicProperty(HEX_KEY, undefined); } catch {}
      clearCurse(p);
      restoreArmor(p);
      actionBar(p, T("circe.human"));
      continue;
    }
    const h = newRecord(undefined, formIndex(rec.form), rec.by, now);
    h.refresh = now;
    h.sheared = rec.sheared === true;
    hexed.set(p.id, h);
  }
}

function sweepForms() {
  for (const id of DIMENSIONS) {
    let dim;
    try { dim = world.getDimension(id); } catch { continue; }
    let list = [];
    for (const type of FORM_TYPES) try { list.push(...dim.getEntities({ type })); } catch {}
    for (const f of list) {
      const owner = f.getDynamicProperty("cb:owner");
      const rec = hexed.get(owner);
      const p = rec && world.getEntity(owner);
      if (!rec || rec.formId !== f.id || !alive(p)) { try { f.remove(); } catch {} }
    }
  }
}

// ---------- бой ----------
// Цирцея в первую очередь атакует Вардена!
const CIRCE_AUTO_FOE_TYPES = new Set([
  "minecraft:warden", "minecraft:wither", "minecraft:ravager",
  "cb:cyclops", "cb:hydra", "cb:hydra_head", "cb:guldan", "cb:laestrygonian",
  "cb:green_orc", "cb:hell_orc", "cb:fel_minion",
  "cb:minotaur", "cb:fel_lord", "cb:lich_king", "cb:dreadlord",
  "cb:zeus", "cb:poseidon", "cb:hades", "cb:ares", "cb:hephaestus"
]);

function scanPriorityThreats(c) {
  try {
    const wardens = c.dimension.getEntities({ location: c.location, maxDistance: 32, type: "minecraft:warden" });
    for (const w of wardens) {
      if (alive(w)) {
        anger(c, w);
        return w;
      }
    }
    const near = c.dimension.getEntities({ location: c.location, maxDistance: 20 });
    for (const m of near) {
      if (m && m.id !== c.id && alive(m) && CIRCE_AUTO_FOE_TYPES.has(m.typeId)) {
        const eff = resolveActualTarget(c, m) ?? m;
        anger(c, eff);
        return eff;
      }
    }
  } catch {}
  return undefined;
}

function pickFoe(c) {
  const f = foesOf(c);
  let best, bd = Infinity;
  for (const id of f.keys()) {
    const e = world.getEntity(id);
    if (!alive(e) || hexed.has(id) || tempHexedGuldan.has(id)) continue;
    let d = hdist(e.location, c.location);
    // Варден — первоочередная цель для босса!
    if (e.typeId === "minecraft:warden") d -= 25;
    if (d < bd) { bd = d; best = e; }
  }
  if (best) return best;
  let t;
  try { t = c.target; } catch {}
  if (valid(t) && alive(t) && !hexed.has(t.id) && !tempHexedGuldan.has(t.id)) return t;
  return undefined;
}

function face(c, e) {
  try { c.teleport(c.location, { facingLocation: { x: e.location.x, y: e.location.y, z: e.location.z } }); } catch {}
}

function startAct(c, st, kind, e) {
  st.act = { kind, t: 0, e };
  try { c.setProperty(kind === "cast" || kind === "orb" ? "cb:cast" : "cb:swing", true); } catch {}
  face(c, e);
  if (kind === "cast") sound(c.dimension, "cb.circe.laugh", c.location, 1.5, 1.1);
}

function endAct(c, st) {
  const kind = st.act?.kind;
  st.act = null;
  try { c.setProperty(kind === "cast" || kind === "orb" ? "cb:cast" : "cb:swing", false); } catch {}
  const now = system.currentTick;
  if (kind === "cast") st.nextCast = now + CAST_GAP + Math.floor(Math.random() * 25);
  if (kind === "orb") st.nextOrb = now + ORB_GAP;
  st.nextStrike = now + STRIKE_GAP;
}

function tickAct(c, st) {
  const a = st.act;
  a.t++;
  const e = a.e;
  if (a.kind === "strike") {
    if (a.t === STRIKE_HIT && alive(e) && hdist(e.location, c.location) <= STRIKE_REACH + 1) {
      const eff = resolveActualTarget(c, e) ?? e;
      try { eff.applyDamage(STRIKE_DAMAGE, { cause: EntityDamageCause.entityAttack, damagingEntity: c }); } catch {}
      const d = sub(e.location, c.location);
      const n = Math.hypot(d.x, d.z) || 1;
      try { e.applyKnockback(d.x / n, d.z / n, 1.1, 0.35); } catch {}
      sound(c.dimension, "cb.cyclops.swing", c.location, 1, 1.6);
    }
    if (a.t >= STRIKE_LEN) endAct(c, st);
  } else if (a.kind === "orb") {
    if (a.t === 8 && alive(e)) {
      shootEnergyOrb(c, e);
    }
    if (a.t >= 16) endAct(c, st);
  } else {
    if (a.t === CAST_HIT && alive(e)) {
      bolt(c, e);
      if (hdist(e.location, c.location) <= CAST_RANGE + 3 && clearLine(c, e)) {
        hex(e, c);
        if (![...foesOf(c).keys()].some((id) => alive(world.getEntity(id)))) st.hexedAll = true;
      }
    }
    if (a.t >= CAST_LEN) endAct(c, st);
  }
}

function tickCirce(c, now) {
  if (now % 20 === 0) ensureName(c);
  if (now % 10 === 0) scanPriorityThreats(c);
  const st = stateOf(c);
  if (st.act) { tickAct(c, st); return; }
  if (!isAngry(c)) {
    if (now % 20 === 0) greet(c, st, now);
    return;
  }

  const f = foesOf(c);
  for (const [id, until] of f) {
    const e = world.getEntity(id);
    if (!alive(e) || until <= now || hdist(e.location, c.location) > 48 || (isPlayer(e) && !inSurvival(e)) || tempHexedGuldan.has(id)) {
      f.delete(id);
      try { e?.removeTag(FOE_TAG); } catch {}
    }
  }
  if (f.size) st.quietSince = now;
  else if (st.hexedAll || now - st.quietSince >= CALM_AFTER) { st.hexedAll = false; calmDown(c); return; }

  const e = pickFoe(c);
  if (!e) return;
  const d = hdist(e.location, c.location);

  // Если враг напирает вплотную без остановки — Цирцея отходит назад и телепортируется!
  if (d <= 4.5) {
    st.closeTicks = (st.closeTicks ?? 0) + 1;
    // Плавный отход назад от атакующего моба
    if (now % 4 === 0 && c.isOnGround !== false) {
      const dx = c.location.x - e.location.x, dz = c.location.z - e.location.z;
      const n = Math.hypot(dx, dz) || 1;
      try { c.applyImpulse({ x: (dx / n) * 0.26, y: 0.05, z: (dz / n) * 0.26 }); } catch {}
    }
    if (st.closeTicks >= 20 && now >= st.nextRetreat) {
      retreatTeleport(c, e, now);
      return;
    }
  } else {
    st.closeTicks = Math.max(0, (st.closeTicks ?? 0) - 1);
  }

  const isUnhexableBoss = BOSSES.has(e.typeId) || (e.typeId === "cb:guldan" && now < guldanHexImmuneUntil);

  if (d <= STRIKE_REACH && now >= st.nextStrike) {
    startAct(c, st, "strike", e);
  } else if (!isUnhexableBoss && d <= CAST_RANGE && now >= st.nextCast && clearLine(c, e)) {
    startAct(c, st, "cast", e);
  } else if (d <= CAST_RANGE + 4 && now >= st.nextOrb && clearLine(c, e)) {
    startAct(c, st, "orb", e);
  }
}

const GREETINGS = 3;
function greet(c, st, now) {
  for (const p of playersNear(c.dimension, c.location, 6)) {
    if (!inSurvival(p) || (st.greeted.get(p.id) ?? -1e9) + 600 > now) continue;
    st.greeted.set(p.id, now);
    
  }
}

// ---------- прощение ----------
function takeFromHand(p, typeId, n) {
  try {
    const inv = p.getComponent("minecraft:inventory")?.container;
    const slot = p.selectedSlotIndex ?? 0;
    const it = inv?.getItem(slot);
    if (!it || it.typeId !== typeId || it.amount < n) return false;
    if (it.amount === n) inv.setItem(slot, undefined);
    else { it.amount -= n; inv.setItem(slot, it); }
    return true;
  } catch {
    return false;
  }
}

export function appease(c, giver) {
  const now = system.currentTick;
  freeAll(c.id);
  for (const [id, h] of hexed) {
    if (h.by && h.by !== c.id) continue;
    unhex(id, false);
  }
  try { c.setDynamicProperty(OFFENDERS, undefined); } catch {}
  for (const id of foesOf(c).keys()) { try { world.getEntity(id)?.removeTag(FOE_TAG); } catch {} }
  foes.delete(c.id);
  if (isAngry(c)) { try { c.triggerEvent("cb:calm_down"); } catch {} }
  stateOf(c).quietSince = now;
  for (let i = 0; i < 6; i++) fx(c.dimension, "minecraft:heart_particle", { x: c.location.x + (i % 3 - 1) * 0.4, y: c.location.y + 2.1, z: c.location.z + (i < 3 ? -0.3 : 0.3) });
  sound(c.dimension, "cb.circe.laugh", c.location, 1.5, 1.35);
  const who = giver.name ?? T("circe.traveler");
  for (const p of playersNear(c.dimension, c.location, 48)) {
    actionBar(p, T("circe.forgives", who));
  }
}

export const GIFT_REACH = 6;
const GIFTS = new Set(["minecraft:gold_ingot", "minecraft:apple"]);
function findGiver(c) {
  let best, score = Infinity;
  for (const p of playersNear(c.dimension, c.location, GIFT_REACH)) {
    const it = heldItem(p);
    if (!GIFTS.has(it?.typeId)) continue;
    let s = hdist(p.location, c.location);
    try {
      const v = p.getViewDirection();
      const d = sub(c.location, p.location);
      const n = Math.hypot(d.x, d.z) || 1;
      s -= 3 * ((v.x * d.x + v.z * d.z) / n);
    } catch {}
    if (s < score) { score = s; best = p; }
  }
  return best;
}

export function offer(c, p) {
  if (c?.typeId !== CIRCE || !valid(p)) return;
  const type = heldItem(p)?.typeId;
  if (!GIFTS.has(type)) return;
  if (offendersOf(c).has(p.id) || hexed.has(p.id)) {
    actionBar(p, T("circe.no_offender"));
    return;
  }
  const guilty = isAngry(c) || [...hexed.values()].some((h) => !h.by || h.by === c.id);
  if (!guilty) {
    actionBar(p, T("circe.nothing_forgive"));
    return;
  }
  const need = type === "minecraft:gold_ingot" ? 1 : 2;
  if (!takeFromHand(p, type, need)) {
    actionBar(p, T("circe.needs_gift"));
    return;
  }
  appease(c, p);
}

world.afterEvents.dataDrivenEntityTrigger?.subscribe?.((ev) => {
  if (ev.eventId !== "cb:offer" || ev.entity?.typeId !== CIRCE) return;
  const p = findGiver(ev.entity);
  if (p) offer(ev.entity, p);
});
try {
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "cb:offer") return;
    const ent = ev.sourceEntity;
    if (ent && ent.typeId === CIRCE) {
      const p = findGiver(ent);
      if (p) offer(ent, p);
    }
  });
} catch {}

world.afterEvents.entityDie.subscribe((ev) => {
  const c = ev.deadEntity;
  if (c?.typeId !== CIRCE) return;
  freeAll(c.id);
  for (const [id, h] of hexed) if (!h.by || h.by === c.id) unhex(id, false);
  for (const [beastId, rec] of tempHexedGuldan) {
    if (!rec.circeId || rec.circeId === c.id) restoreGuldanFromBeast(beastId, rec);
  }
  for (const id of foesOf(c).keys()) { try { world.getEntity(id)?.removeTag(FOE_TAG); } catch {} }
  foes.delete(c.id);
  states.delete(c.id);
  for (const p of playersNear(c.dimension, c.location, 48)) actionBar(p, T("circe.defeated"));
});

system.runInterval(() => {
  const now = system.currentTick;
  for (const id of DIMENSIONS) {
    let dim;
    try { dim = world.getDimension(id); } catch { continue; }
    let list = [];
    try { list = dim.getEntities({ type: CIRCE }); } catch {}
    for (const c of list) {
      if (!alive(c)) continue;
      try { tickCirce(c, now); } catch (e) { console.warn(`[circe] ${e}`); }
    }
  }
  try { tickHexed(now); } catch (e) { console.warn(`[circe] hex: ${e}`); }
  if (now % 40 === 0) { try { restoreHexes(now); sweepForms(); } catch {} }
}, 1);


// ---------- v10.12 fairness: a hexed player is never stuck - the spell wears off after 60 s ----------
system.runInterval(() => {
  const now = system.currentTick;
  for (const [id, h] of hexed) {
    if (h.t0 === undefined || now - h.t0 < 1200) continue;
    let e; try { e = world.getEntity(id); } catch {}
    if (!e || !isPlayer(e)) continue;
    unhex(id, false);
    actionBar(e, "§aЧары Цирцеи развеялись — вы снова человек");
  }
}, 20);
