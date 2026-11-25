// Механики рудных жуков.
//  - Жук ест блоки своей руды: руда превращается в пустую породу, а жук получает слой
//    рудной брони (до 3). Блок хранения (например, алмазный блок) съедается целиком
//    и сразу даёт полную броню. Ручные жуки блоки хранения не трогают.
//  - Без брони жука можно забить чем угодно. В броне его берёт только кирка
//    (остальное отскакивает, это делает damage_sensor в файле поведения);
//    каждый удар киркой откалывает слой брони, и из него выпадает руда.
//  - После смерти выпадает вся съеденная руда.
import { world, system, ItemStack } from "@minecraft/server";
import { BEETLES, MAX_ARMOR, PICKAXES } from "./beetle_layout.js";
import { DIMENSIONS, valid, alive, isPlayer, fx, sound, actionBar } from "./util.js";
import { T } from "./i18n.js";

const TYPES = Object.keys(BEETLES);
const PICKS = new Set(PICKAXES);
const ARMOR_TAG = "cb_armored";
const EAT_COOLDOWN = 60;     // 3 секунды между «укусами» руды
const EAT_SHOW = 30;         // столько тиков играет анимация поедания
const MAX_DROP = 32;         // больше этого руды после смерти не выпадает

const eatUntil = new Map();  // id жука -> тик конца анимации поедания
const eatReady = new Map();  // id жука -> тик, когда можно есть снова
const hintAt = new Map();    // id игрока -> тик последней подсказки

function dyn(e, key, fallback) {
  try {
    const v = e.getDynamicProperty(key);
    return typeof v === "number" ? v : fallback;
  } catch {
    return fallback;
  }
}

function setProp(e, key, value) {
  try { if (e.getProperty(key) !== value) e.setProperty(key, value); } catch {}
}

function isTamed(e) {
  try { return !!e.getComponent("minecraft:is_tamed"); } catch { return false; }
}

function heldItem(e) {
  try { return e.getComponent("minecraft:equippable")?.getEquipment("Mainhand")?.typeId; } catch { return undefined; }
}

const replacement = (id) => (id.includes("deepslate") ? "minecraft:deepslate"
  : id === "minecraft:quartz_ore" ? "minecraft:netherrack" : "minecraft:stone");

// Броня, метка для damage_sensor, кристаллы на спине и «голод» (идти к руде или нет).
function applyArmor(e, armor) {
  try { e.setDynamicProperty("cb:armor", armor); } catch {}
  setProp(e, "cb:armor", armor);
  try {
    if (armor > 0) e.addTag(ARMOR_TAG);
    else e.removeTag(ARMOR_TAG);
  } catch {}
  const hungry = armor < MAX_ARMOR;
  let wasHungry;
  try { wasHungry = e.hasTag("cb_hungry"); } catch {}
  if (hungry !== wasHungry) {
    try {
      e.triggerEvent(hungry ? "cb:hungry" : "cb:full");
      if (hungry) e.addTag("cb_hungry");
      else e.removeTag("cb_hungry");
    } catch {}
  }
}

function stored(e) {
  return dyn(e, "cb:stored", 0);
}

function setStored(e, n) {
  try { e.setDynamicProperty("cb:stored", Math.max(0, n)); } catch {}
}

function dropOre(e, count) {
  const info = BEETLES[e.typeId];
  if (!info || count <= 0) return;
  try { e.dimension.spawnItem(new ItemStack(info.item, Math.min(count, 64)), e.location); } catch {}
}

// Ищем рядом (под жуком и вокруг) блок своей руды или блок хранения.
function findFood(e, info, allowStorage) {
  const l = e.location;
  const bx = Math.floor(l.x), by = Math.floor(l.y), bz = Math.floor(l.z);
  for (const dy of [-1, 0, 1]) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        let b;
        try { b = e.dimension.getBlock({ x: bx + dx, y: by + dy, z: bz + dz }); } catch { continue; }
        const id = b?.typeId;
        if (!id) continue;
        if (info.ores.includes(id)) return { b, id, storage: false };
        if (allowStorage && info.storage.includes(id)) return { b, id, storage: true };
      }
    }
  }
  return undefined;
}

function tryEat(e, now) {
  const info = BEETLES[e.typeId];
  const armor = dyn(e, "cb:armor", 1);
  if (armor >= MAX_ARMOR || (eatReady.get(e.id) ?? 0) > now) return;
  const food = findFood(e, info, !isTamed(e));
  if (!food) return;
  const at = { x: food.b.location.x + 0.5, y: food.b.location.y + 0.5, z: food.b.location.z + 0.5 };
  try { food.b.setType(food.storage ? "minecraft:air" : replacement(food.id)); } catch { return; }
  applyArmor(e, food.storage ? MAX_ARMOR : armor + 1);
  setStored(e, stored(e) + (food.storage ? 9 : 1));
  eatReady.set(e.id, now + EAT_COOLDOWN);
  eatUntil.set(e.id, now + EAT_SHOW);
  setProp(e, "cb:eating", true);
  for (let k = 0; k < 3; k++) fx(e.dimension, "minecraft:critical_hit_emitter", at);
  sound(e.dimension, "cb.beetle.munch", e.location, 1, 1);
}

function tickBeetle(e, now) {
  // первый раз видим жука: он родился на руде, так что один слой брони у него уже есть
  if (dyn(e, "cb:armor", -1) < 0) {
    applyArmor(e, 1);
    setStored(e, 1);
  } else if (now % 40 === 0) {
    applyArmor(e, dyn(e, "cb:armor", 1)); // после перезахода в мир свойства и метки на месте
  }
  if ((eatUntil.get(e.id) ?? 0) <= now) setProp(e, "cb:eating", false);
  tryEat(e, now);
}

// Удар киркой по бронированному жуку откалывает слой брони — и из него выпадает руда.
world.afterEvents.entityHurt.subscribe((ev) => {
  const e = ev.hurtEntity;
  if (!BEETLES[e?.typeId]) return;
  const a = ev.damageSource?.damagingEntity;
  const armor = dyn(e, "cb:armor", 0);
  if (armor <= 0 || !a || !PICKS.has(heldItem(a))) return;
  applyArmor(e, armor - 1);
  if (stored(e) > 0) {
    dropOre(e, 1);
    setStored(e, stored(e) - 1);
  }
  fx(e.dimension, "minecraft:critical_hit_emitter", e.location);
  sound(e.dimension, "cb.beetle.crack", e.location, 1, 1);
  if (isPlayer(a)) {
    actionBar(a, armor - 1 > 0 ? T("beetle.armor", armor - 1) : T("beetle.armor_broken"));
  }
});

// Удар не киркой по броне: звяк и подсказка.
world.afterEvents.entityHitEntity.subscribe((ev) => {
  const e = ev.hitEntity;
  if (!BEETLES[e?.typeId]) return;
  const a = ev.damagingEntity;
  if (dyn(e, "cb:armor", 0) <= 0 || PICKS.has(heldItem(a))) return;
  sound(e.dimension, "cb.beetle.clink", e.location, 1, 1);
  const now = system.currentTick;
  if (isPlayer(a) && now - (hintAt.get(a.id) ?? -1e9) > 40) {
    hintAt.set(a.id, now);
    actionBar(a, T("beetle.need_pickaxe"));
  }
});

// После смерти — вся съеденная руда.
world.afterEvents.entityDie.subscribe((ev) => {
  const e = ev.deadEntity;
  let type;
  try { type = e?.typeId; } catch { return; }
  if (!BEETLES[type]) return;
  dropOre(e, Math.min(stored(e), MAX_DROP));
  eatUntil.delete(e.id);
  eatReady.delete(e.id);
});

system.runInterval(() => {
  const now = system.currentTick;
  if (now % 5 !== 0) return;
  for (const id of DIMENSIONS) {
    let dim;
    try { dim = world.getDimension(id); } catch { continue; }
    for (const type of TYPES) {
      let list = [];
      try { list = dim.getEntities({ type }); } catch {}
      for (const e of list) {
        if (!alive(e)) continue;
        try { tickBeetle(e, now); } catch (err) { console.warn(`[beetle] ${err}`); }
      }
    }
  }
  if (now % 200 === 0) {
    for (const [k, t] of eatUntil) if (t < now) eatUntil.delete(k);
    for (const [k, t] of eatReady) if (t < now) eatReady.delete(k);
    for (const [k, t] of hintAt) if (now - t > 400) hintAt.delete(k);
  }
}, 1);
