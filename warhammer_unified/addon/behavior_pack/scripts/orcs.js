import { areAllies } from "./factions.js";
// Орки: характеры рас, предводители, верховые орки, звери на службе, а также добыча блоков и возведение орочьих баз в мирное время.
import { world, system, ItemStack } from "@minecraft/server";
import { valid, alive, sound, fx, actionBar, isPlayer, inSurvival, playersNear, shared } from "./util.js";
import { T } from "./i18n.js";
import { sameSide, foeOf, factionOf, levelOf, levelUp, POINTS_KEY, LEVELS, FOE_TAG } from "./mob_ai.js";
import { STYLE, surface, list as outpostList } from "./outposts.js";

export const ORCS = ["cb:orc", "cb:green_orc", "cb:hell_orc"];
export const MOUNT_CHANCE = { "cb:orc": 0.18, "cb:green_orc": 0.25, "cb:hell_orc": 0.22 };
export const WARCRY_R = 12;
export const WARCRY_COOLDOWN = 800;
export const WARCRY_TICKS = 30;
export const RAGE_COOLDOWN = 800;
export const BEAST_R = 14;
export const BEASTS = ["minecraft:wolf", "minecraft:polar_bear", "minecraft:llama", "minecraft:trader_llama",
  "minecraft:goat", "minecraft:bee", "minecraft:panda", "cb:thunder_lizard", "cb:warg"];

const isOrc = (e) => ORCS.includes(e?.typeId);
const isLeader = (e) => { try { return e.getProperty("cb:leader") === true; } catch { return false; } };
const lastCry = new Map();
const lastRage = new Map();
const crying = new Map();
const spawnTick = new Map();
const warUntil = new Map(); // orcId -> tick until which the orc is considered in active combat/war

// Неразрушимые и ценные блоки, которые орки никогда не ломают
const UNBREAKABLE = /bedrock|obsidian|crying_obsidian|barrier|command_block|end_portal|portal|chest|barrel|shulker_box|spawner|beacon|jukebox|enchanting_table|anvil|iron_bars|campfire|soul_campfire|furnace|crafting_table|ladder|torch|lantern|soul_lantern/;

// Древесина, которую орки могут рубить топором
const WOOD_BLOCK_RE = /(oak|spruce|birch|dark_oak|jungle|acacia|mangrove|cherry|crimson|warped)_(log|wood|stem|hyphae|planks)/;
// Каменные породы, которые орки могут добывать киркой
const STONE_BLOCK_RE = /(stone|cobblestone|mossy_cobblestone|deepslate|cobbled_deepslate|blackstone|sandstone|red_sandstone|andesite|diorite|granite|tuff|netherrack|basalt)/;
// Грунт и земля, которые орки могут копать лопатой/киркой
const GROUND_BLOCK_RE = /(grass_block|dirt|coarse_dirt|podzol|mycelium|sand|red_sand|gravel|mud|packed_mud|soul_soil|soul_sand)/;

const UNDEAD_RE = /zombie|husk|drowned|skeleton|stray|bogged|wither_skeleton|zombified_piglin|zoglin|phantom|wither/;
const ILLAGER_VILLAGER_RE = /villager|wandering_trader|pillager|vindicator|evoker|ravager|witch|vex/;

// ---------- верховые орки ----------
export function mountOf(orc) {
  try {
    const id = orc.getDynamicProperty("cb:mount");
    const m = typeof id === "string" ? world.getEntity(id) : undefined;
    return m && alive(m) ? m : undefined;
  } catch { return undefined; }
}
export function isRiding(e) {
  try { if (e.getComponent("minecraft:riding")) return true; } catch {}
  return !!mountOf(e);
}
export function releaseOrphans() {
  for (const id of orcsTracked) {
    const o = world.getEntity(id);
    if (!o || !valid(o)) { orcsTracked.delete(id); continue; }
    if (mountOf(o)) continue;
    orcsTracked.delete(id);
    try { o.setDynamicProperty("cb:mount", undefined); } catch {}
    try { o.runCommandAsync("ride @s stop_riding"); } catch {}
  }
}
const orcsTracked = new Set();
export const ridingOrcs = () => [...orcsTracked];

export function mountFor(orc, roll = Math.random()) {
  if (!isOrc(orc)) return;
  try {
    if (orc.getDynamicProperty("cb:mount_rolled")) return;
    orc.setDynamicProperty("cb:mount_rolled", true);
  } catch {}
  // Предводители остаются пешими, чтобы руководить постройкой базы
  if (isLeader(orc)) return;
  if (roll >= (MOUNT_CHANCE[orc.typeId] ?? 0)) return;
  const dim = orc.dimension, at = orc.location;
  let mount;
  try {
    if (orc.typeId === "cb:green_orc") {
      mount = dim.spawnEntity("cb:warg", at);
      mount.triggerEvent("cb:make_war_mount");
    } else {
      mount = dim.spawnEntity("cb:thunder_lizard", at);
      mount.triggerEvent("cb:make_war_mount");
      mount.setProperty("cb:variant", orc.typeId === "cb:hell_orc" ? 2 : (Math.random() < 0.5 ? 0 : 1));
    }
  } catch { return; }
  if (!mount) return;
  let seated = false;
  try {
    const rd = mount.getComponent("minecraft:rideable");
    seated = !!rd?.addRider?.(orc);
    if (!seated) orc.runCommandAsync?.(`ride @s start_riding @e[type=${mount.typeId},r=2,c=1]`);
  } catch {}
  try { orc.setDynamicProperty("cb:mount", mount.id); mount.setDynamicProperty("cb:owner_id", orc.id); orcsTracked.add(orc.id); } catch {}
  return mount;
}

// ---------- боевой клич и звери ----------
function alliedOrcsNear(dim, refOrc, r) {
  try {
    return dim.getEntities({ location: refOrc.location, maxDistance: r, excludeTypes: ["minecraft:item", "minecraft:xp_orb"] })
      .filter((e) => isOrc(e) && alive(e) && sameSide(refOrc, e));
  } catch { return []; }
}

export function warcry(leader, foe, now = system.currentTick) {
  if (!isOrc(leader) || !isLeader(leader) || !alive(leader) || sameSide(leader, foe)) return false;
  if (shared.isDancing?.(leader.location, leader.dimension)) return false;
  if (now - (lastCry.get(leader.id) ?? -1e9) < WARCRY_COOLDOWN) return false;
  lastCry.set(leader.id, now);
  crying.set(leader.id, now + WARCRY_TICKS);
  try { leader.triggerEvent("cb:start_warcry"); } catch {}
  sound(leader.dimension, "cb.orc.warcry", leader.location, 2.5, 1);
  for (const o of alliedOrcsNear(leader.dimension, leader, WARCRY_R)) {
    warUntil.set(o.id, now + 240);
    try { o.addEffect("strength", 160, { amplifier: 0, showParticles: true }); } catch {}
    try { o.addEffect("speed", 160, { amplifier: 0, showParticles: true }); } catch {}
  }
  if (leader.typeId === "cb:green_orc" && foe && valid(foe)) rallyBeasts(leader, foe);
  if (isPlayer(foe)) actionBar(foe, T("orc.warcry"));
  return true;
}

export function rallyBeasts(leader, foe) {
  let n = 0;
  let near = [];
  try { near = leader.dimension.getEntities({ location: leader.location, maxDistance: BEAST_R }); } catch {}
  for (const b of near) {
    if (!BEASTS.includes(b.typeId) || !alive(b) || b.id === foe.id || sameSide(leader, foe)) continue;
    try { if (b.getComponent("minecraft:is_tamed")) continue; } catch {}
    try { if (b.getComponent("minecraft:rideable")?.getRiders?.().some((r) => isOrc(r))) continue; } catch {}
    try { b.applyDamage(1, { cause: "entityAttack", damagingEntity: foe }); n++; } catch {}
  }
  if (n) sound(leader.dimension, "cb.orc.whip", leader.location, 1.5, 1);
  return n;
}

export function rage(orc, now = system.currentTick) {
  if (orc?.typeId !== "cb:green_orc" || !alive(orc)) return false;
  const h = orc.getComponent("minecraft:health");
  if (!h || h.currentValue > h.effectiveMax / 2) return false;
  if (now - (lastRage.get(orc.id) ?? -1e9) < RAGE_COOLDOWN) return false;
  lastRage.set(orc.id, now);
  try { orc.addEffect("strength", 200, { amplifier: 0, showParticles: true }); } catch {}
  try { orc.addEffect("speed", 200, { amplifier: 0, showParticles: true }); } catch {}
  sound(orc.dimension, "cb.orc.rage", orc.location, 1.5, 1);
  return true;
}

function leaderNear(o) {
  if (isLeader(o)) return o;
  return alliedOrcsNear(o.dimension, o, WARCRY_R + 6).find((e) => isLeader(e));
}

function mainhand(e) {
  try { return e.getComponent("minecraft:equippable")?.getEquipment("Mainhand")?.typeId; } catch { return undefined; }
}

function defaultWeaponForOrc(orc) {
  if (orc.typeId === "cb:hell_orc") return "minecraft:iron_sword";
  if (orc.typeId === "cb:green_orc") return "minecraft:iron_axe";
  return "minecraft:iron_axe";
}

function restoreCombatWeapon(orc) {
  if (!orc || !valid(orc)) return;
  try {
    const eq = orc.getComponent("minecraft:equippable");
    if (!eq) return;
    const cur = eq.getEquipment("Mainhand")?.typeId;
    const weap = defaultWeaponForOrc(orc);
    if (cur !== weap) {
      eq.setEquipment("Mainhand", new ItemStack(weap, 1));
    }
  } catch {}
}

export function onHurt(victim, attacker) {
  const now = system.currentTick;
  if (attacker && victim && valid(victim) && attacker.typeId === "cb:hell_orc") {
    try { victim.setOnFire(4, true); } catch {}
  }
  if (isOrc(victim)) {
    warUntil.set(victim.id, now + 260);
    restoreCombatWeapon(victim);
    rage(victim, now);
    if (attacker && !sameSide(victim, attacker)) {
      for (const ally of alliedOrcsNear(victim.dimension, victim, 24)) {
        warUntil.set(ally.id, now + 260);
        restoreCombatWeapon(ally);
      }
      const L = leaderNear(victim);
      if (L) warcry(L, attacker, now);
    }
  }
  if (isOrc(attacker)) {
    warUntil.set(attacker.id, now + 260);
    restoreCombatWeapon(attacker);
    if (attacker.typeId === "cb:hell_orc" && victim && valid(victim) && !sameSide(attacker, victim)) {
      try { victim.setOnFire(3, true); } catch {}
    }
    if (victim && !sameSide(attacker, victim)) {
      for (const ally of alliedOrcsNear(attacker.dimension, attacker, 24)) {
        warUntil.set(ally.id, now + 260);
        restoreCombatWeapon(ally);
      }
      const L = leaderNear(attacker);
      if (L) warcry(attacker, victim, now);
    }
  }
}

// ==============================================================================
// ПРОВЕРКА СОСТОЯНИЯ ВОЙНЫ (Орки НЕ строят во время войны!)
// ==============================================================================
function isHostileToOrc(orc, other) {
  if (!other || other.id === orc.id || !alive(other) || sameSide(orc, other) || areAllies(orc, other)) return false;
  const fac = factionOf(orc);
  const otherFac = factionOf(other);
  const tid = other.typeId;
  if (fac === "brown_orc") {
    if (otherFac === "fel_orc" || tid === "cb:guldan" || tid === "cb:fel_lord" || tid === "cb:inferno_golem") return true;
    if (UNDEAD_RE.test(tid)) return true;
    if (isPlayer(other) && inSurvival(other)) {
      try { if (other.hasTag(FOE_TAG)) return true; } catch {}
    }
    return false;
  }
  if (fac === "fel_orc") {
    if (isPlayer(other) && inSurvival(other)) return true;
    if (otherFac === "brown_orc") return true;
    if (UNDEAD_RE.test(tid) || ILLAGER_VILLAGER_RE.test(tid)) return true;
    if (tid === "cb:cyclops" || tid === "cb:hydra" || tid === "cb:hydra_head") return true;
    return false;
  }
  return false;
}

function isOrcOrSquadAtWar(orc, dim, now) {
  if (!orc || !valid(orc) || !alive(orc)) return true;
  try {
    // 1) Тег похода/войны (после гибели лидера аванпоста), стражи Гул'дана или рабы никогда не строят базы
    if (orc.hasTag("cb_orc_war") || orc.hasTag("cb_guldan_guard") || orc.hasTag("cb_orc_slave")) return true;
    if (orc.getProperty("cb:slave") === true) return true;
  } catch {}

  // 2) Если рядом объявлена война в аванпосте
  const dimId = String(dim.id).replace("minecraft:", "");
  try {
    const ops = outpostList?.() ?? [];
    if (ops.some((o) => o.dim === dimId && o.war && Math.hypot(o.x - orc.location.x, o.z - orc.location.z) <= 120)) {
      return true;
    }
  } catch {}

  // 3) Если сам орк недавно сражался или имеет активного врага
  if (now < (warUntil.get(orc.id) ?? 0)) return true;
  if (foeOf(orc, now)) return true;
  try { if (orc.target && alive(orc.target)) return true; } catch {}

  // 4) Проверяем всех союзных орков отряда (в радиусе 28 блоков) и наличие врагов вокруг отряда (в радиусе 22 блоков)
  try {
    const ents = dim.getEntities({ location: orc.location, maxDistance: 28, excludeTypes: ["minecraft:item", "minecraft:xp_orb"] });
    for (const e of ents) {
      if (!e || !alive(e)) continue;
      if (isOrc(e) && sameSide(orc, e)) {
        if (now < (warUntil.get(e.id) ?? 0)) return true;
        if (foeOf(e, now)) return true;
        try { if (e.hasTag("cb_orc_war")) return true; } catch {}
        try { if (e.target && alive(e.target)) return true; } catch {}
      } else {
        const d = Math.hypot(e.location.x - orc.location.x, e.location.z - orc.location.z);
        if (d <= 22 && isHostileToOrc(orc, e)) {
          return true;
        }
      }
    }
  } catch {}

  return false;
}

// ==============================================================================
// ДОБЫЧА БЛОКОВ И ПОСТРОЙКА ОРОЧЬИХ БАЗ ИЗ ДОБЫТЫХ МАТЕРИАЛОВ (ТОЛЬКО В МИРНОЕ ВРЕМЯ)
// ==============================================================================
const basePlans = new Map();
// id вождя -> {
//   dimId, cx, cy, cz, race,
//   queue: [{ x, y, z, role, fallback }],
//   woodStock: [],   // массив видов срубленной древесины: "oak", "spruce", "birch", "dark_oak", "crimson", ...
//   stoneStock: [],  // массив добытых каменных блоков: "cobblestone", "cobbled_deepslate", "blackstone", "sandstone", ...
//   groundStock: [], // массив вскопанных грунтовых блоков: "dirt", "coarse_dirt", "podzol", "sand", "gravel", ...
//   minedLocations: Set<string>,
//   minedCount: 0,
//   builtCount: 0,
//   done: false
// }
const builtCenters = []; // [{ dimId, cx, cz }]

function hasNearbyBase(dimId, x, z, minDist = 24) {
  for (const b of builtCenters) {
    if (b.dimId === dimId && Math.hypot(b.cx - x, b.cz - z) < minDist) return true;
  }
  return false;
}

function swingOrcArms(orc) {
  try { orc.playAnimation("animation.cb_orc.chop", { blendOutTime: 0.15 }); } catch {}
  try { orc.playAnimation("animation.humanoid.attack.rotations", { blendOutTime: 0.15 }); } catch {}
}

// Генерация чертежа орочьей базы с указанием роли каждого блока (чтобы строить именно из тех блоков, которые орки добыли!)
function buildBasePlan(cx, cy, cz, raceKey, styleVariant = null) {
  const S = STYLE[raceKey] ?? STYLE.orc;
  const styles = ["stockade", "keep", "war_hall"];
  const chosenStyle = styleVariant || styles[Math.abs(cx + cz) % styles.length];
  const R = chosenStyle === "keep" ? 7 : 6;
  const q = [];
  const seen = new Set();
  const add = (dx, dy, dz, role, fallback) => {
    const x = cx + dx, y = cy + dy, z = cz + dz;
    const k = `${x},${y},${z}`;
    if (seen.has(k)) return;
    seen.add(k);
    q.push({ x, y, z, role, fallback });
  };

  // 1) Фундамент центральной площадки (ground / stone) и костёр в центре
  for (let dx = -4; dx <= 4; dx++) {
    for (let dz = -4; dz <= 4; dz++) {
      const isRim = Math.abs(dx) === 4 || Math.abs(dz) === 4;
      add(dx, 0, dz, isRim ? "stone" : "ground", isRim ? S.accent : S.floor);
    }
  }
  add(0, 1, 0, "utility", raceKey === "hell_orc" ? "soul_campfire" : "campfire");

  // 2) Зубчатый частокол или каменный бастион вокруг базы (южный вход с воротами на dz = R, dx in -1..1)
  for (let d = -R; d <= R; d++) {
    for (const [dx, dz] of [[d, -R], [d, R], [-R, d], [R, d]]) {
      if (dz === R && Math.abs(dx) <= 1) continue; // проход ворот
      const isCorner = Math.abs(dx) === R && Math.abs(dz) === R;
      const isPost = d % 2 === 0;
      add(dx, 0, dz, "ground", S.floor);
      if (chosenStyle === "keep") {
        add(dx, 1, dz, "stone", S.accent);
        add(dx, 2, dz, isCorner ? "wood_log" : "stone", isCorner ? S.log : S.accent);
        if (isPost) add(dx, 3, dz, "wood_fence", S.fence);
      } else {
        add(dx, 1, dz, isCorner ? "stone" : "wood_log", isCorner ? S.accent : S.log);
        add(dx, 2, dz, isPost ? "wood_log" : "wood_planks", isPost ? S.log : S.planks);
        if (isPost) add(dx, 3, dz, "wood_fence", S.fence);
      }
      if (isCorner) add(dx, 4, dz, "utility", "torch");
    }
  }
  // Арка южных ворот
  add(-2, 1, R, "wood_log", S.log); add(-2, 2, R, "wood_log", S.log); add(-2, 3, R, "wood_log", S.log);
  add(2, 1, R, "wood_log", S.log);  add(2, 2, R, "wood_log", S.log);  add(2, 3, R, "wood_log", S.log);
  add(-1, 3, R, "wood_planks", S.planks); add(0, 3, R, "stone", S.accent); add(1, 3, R, "wood_planks", S.planks);
  add(-2, 4, R, "utility", "torch"); add(2, 4, R, "utility", "torch");

  if (chosenStyle === "war_hall") {
    // ВАРИАЦИЯ "WAR HALL": Крытый Зал Войны на севере с троном вождя и двумя жаровнями
    for (let dx = -4; dx <= 4; dx++) {
      for (let dz = -5; dz <= -2; dz++) {
        if (Math.abs(dx) === 4 || dz === -5) {
          for (let h = 1; h <= 3; h++) add(dx, h, dz, Math.abs(dx) === 4 && (dz === -5 || dz === -2) ? "wood_log" : "wood_planks", S.planks);
        }
        add(dx, 4, dz, "wood_planks", S.planks);
      }
    }
    add(0, 1, -4, "stone", S.accent);
    add(-2, 1, -4, "utility", "chest");
    add(2, 1, -4, "utility", "barrel");
    add(-3, 1, 2, "utility", "anvil");
    add(-4, 1, 2, "utility", "furnace");
    add(3, 1, 2, "utility", "crafting_table");
  } else {
    // 3) Сторожевая башня Вождя (северо-западный сектор: -4..-2, -4..-2)
    for (const [ox, oz] of [[-4, -4], [-2, -4], [-4, -2], [-2, -2]]) {
      for (let h = 1; h <= 4; h++) add(ox, h, oz, "wood_log", S.log);
    }
    for (let ox = -4; ox <= -2; ox++) {
      for (let oz = -4; oz <= -2; oz++) {
        add(ox, 5, oz, "wood_planks", S.planks);
        if (ox === -4 || ox === -2 || oz === -4 || oz === -2) add(ox, 6, oz, "wood_fence", S.fence);
      }
    }
    for (let h = 1; h <= 4; h++) add(-3, h, -2, "utility", "ladder");
    add(-4, 7, -4, "wood_fence", S.fence);
    add(-4, 8, -4, "utility", S.flag);

    // 4) Военный шатёр и склад с кузницей (северо-восточный сектор: 2..4, -4..0)
    for (let dz = -3; dz <= 0; dz++) {
      add(2, 1, dz, "wood_planks", S.planks);
      add(4, 1, dz, "wood_planks", S.planks);
      add(2, 2, dz, "wood_fence", S.fence);
      add(4, 2, dz, "wood_fence", S.fence);
      add(2, 3, dz, "wood_planks", S.wool);
      add(3, 3, dz, "wood_planks", S.wool);
      add(4, 3, dz, "wood_planks", S.wool);
    }
    add(3, 1, -3, "utility", "chest");
    add(3, 1, -2, "utility", "crafting_table");
    add(-3, 1, 2, "utility", "anvil");
    add(-4, 1, 2, "utility", "furnace");
    add(-2, 1, 2, "utility", "barrel");
  }

  return q;
}

// Классификация добытого блока мира -> какие строительные блоки из него получаются
function classifyMinedBlock(typeId) {
  const shortId = String(typeId ?? "").replace(/^minecraft:/, "");
  const wm = shortId.match(/^(oak|spruce|birch|dark_oak|jungle|acacia|mangrove|cherry|crimson|warped)_/);
  if (wm) {
    return { kind: "wood", material: wm[1], tool: "minecraft:iron_axe", snd: "dig.wood" };
  }
  if (STONE_BLOCK_RE.test(shortId)) {
    let mat = shortId;
    if (shortId === "stone") mat = "cobblestone";
    else if (shortId === "deepslate") mat = "cobbled_deepslate";
    return { kind: "stone", material: mat, tool: "minecraft:iron_pickaxe", snd: "dig.stone" };
  }
  if (GROUND_BLOCK_RE.test(shortId)) {
    let mat = shortId;
    if (shortId === "grass_block" || shortId === "mycelium") mat = "dirt";
    else if (shortId === "mud") mat = "packed_mud";
    return { kind: "ground", material: mat, tool: "minecraft:iron_shovel", snd: "dig.grass" };
  }
  return undefined;
}

function logBlockForWood(w) {
  return (w === "crimson" || w === "warped") ? `${w}_stem` : `${w}_log`;
}

function wallBlockForStone(s) {
  if (s === "cobblestone" || s === "mossy_cobblestone" || s === "cobbled_deepslate" || s === "blackstone" || s === "sandstone" || s === "red_sandstone" || s === "andesite" || s === "diorite" || s === "granite" || s === "tuff") {
    return `${s}_wall`;
  }
  return s;
}

function totalStockOf(plan) {
  return plan.woodStock.length + plan.stoneStock.length + plan.groundStock.length;
}

// Поиск реального блока вокруг базы (за пределами периметра R=7), который орк может добыть
function findBlockToMine(dim, plan, preferKind) {
  const cx = plan.cx, cy = plan.cy, cz = plan.cz;
  let fallbackCandidate = undefined;

  // Ищем по спирали/кольцам от 8 до 22 блоков вокруг базы
  for (let attempt = 0; attempt < 28; attempt++) {
    const dist = 8 + (attempt % 13);
    const angle = ((attempt * 137.5 + plan.minedCount * 53) * Math.PI) / 180;
    const mx = cx + Math.round(Math.cos(angle) * dist);
    const mz = cz + Math.round(Math.sin(angle) * dist);
    if (Math.abs(mx - cx) <= 7 && Math.abs(mz - cz) <= 7) continue;

    // Проверяем высоту от +6 (деревья/холмы) до -2 (поверхность/камень)
    for (let dy = 6; dy >= -2; dy--) {
      const my = cy + dy;
      const key = `${mx},${my},${mz}`;
      if (plan.minedLocations.has(key)) continue;
      let blk;
      try { blk = dim.getBlock({ x: mx, y: my, z: mz }); } catch { continue; }
      if (!blk || blk.typeId === "minecraft:air" || /water|lava/.test(blk.typeId) || UNBREAKABLE.test(blk.typeId)) continue;
      const info = classifyMinedBlock(blk.typeId);
      if (!info) continue;

      if (info.kind === preferKind) {
        return { x: mx, y: my, z: mz, key, info };
      }
      if (!fallbackCandidate) {
        fallbackCandidate = { x: mx, y: my, z: mz, key, info };
      }
    }
  }
  return fallbackCandidate;
}

// Добыча одного блока рабочим орком: орк берёт инструмент, подходит к блоку, ломает его и складывает добытый материал в запас базы
function mineOneBlock(miner, dim, plan, preferKind) {
  const target = findBlockToMine(dim, plan, preferKind);
  if (!target) return false;

  plan.minedLocations.add(target.key);
  plan.minedCount++;

  // Экипируем подходящий инструмент (топор для дерева, кирку для камня, лопату для грунта)
  try {
    const eq = miner.getComponent("minecraft:equippable");
    if (eq) eq.setEquipment("Mainhand", new ItemStack(target.info.tool, 1));
  } catch {}

  // Орк НЕ телепортируется — подходит к блоку пешком и добывает его с анимацией игрока!
  const dx = target.x + 0.5 - miner.location.x;
  const dz = target.z + 0.5 - miner.location.z;
  const d = Math.hypot(dx, dz) || 1;
  if (d > 3.6) {
    try {
      miner.setProperty("cb:mining", false);
      if (miner.isOnGround !== false) {
        miner.applyImpulse({ x: (dx / d) * 0.28, y: 0.14, z: (dz / d) * 0.28 });
      }
      miner.teleport(miner.location, { facingLocation: { x: target.x + 0.5, y: target.y + 0.5, z: target.z + 0.5 }, keepVelocity: true });
    } catch {}
    return false;
  }
  try {
    miner.teleport(miner.location, { facingLocation: { x: target.x + 0.5, y: target.y + 0.5, z: target.z + 0.5 }, keepVelocity: true });
    miner.setProperty("cb:mining", true);
    system.runTimeout(() => {
      if (valid(miner)) { try { miner.setProperty("cb:mining", false); } catch {} }
    }, 18);
  } catch {}
  try {
    // Разрушаем блок в мире без выпадения лишних предметов на землю (материал сразу идёт в инвентарь стройки орков)
    dim.runCommandAsync(`setblock ${target.x} ${target.y} ${target.z} air`);
    sound(dim, target.info.snd, { x: target.x, y: target.y, z: target.z }, 1.25, 0.95);
    fx(dim, "minecraft:villager_happy", { x: target.x + 0.5, y: target.y + 0.5, z: target.z + 0.5 });
  } catch {}

  // Из 1 добытого блока дерева/камня/грунта орк получает 2 строительных блока соответствующего материала
  if (target.info.kind === "wood") {
    plan.woodStock.push(target.info.material, target.info.material);
  } else if (target.info.kind === "stone") {
    plan.stoneStock.push(target.info.material, target.info.material);
  } else {
    plan.groundStock.push(target.info.material, target.info.material);
  }
  return true;
}

// Выбор и списание конкретного блока из добытых запасов под текущую ячейку чертежа базы
function consumeMaterialForBlueprint(plan, item) {
  if (totalStockOf(plan) <= 0) return undefined;

  const role = item.role;
  if (role === "wood_log") {
    if (plan.woodStock.length > 0) return logBlockForWood(plan.woodStock.shift());
    if (plan.stoneStock.length > 0) return plan.stoneStock.shift();
    if (plan.groundStock.length > 0) return plan.groundStock.shift();
  }
  if (role === "wood_planks") {
    if (plan.woodStock.length > 0) return `${plan.woodStock.shift()}_planks`;
    if (plan.stoneStock.length > 0) return plan.stoneStock.shift();
    if (plan.groundStock.length > 0) return plan.groundStock.shift();
  }
  if (role === "wood_fence") {
    if (plan.woodStock.length > 0) return `${plan.woodStock.shift()}_fence`;
    if (plan.stoneStock.length > 0) return wallBlockForStone(plan.stoneStock.shift());
    if (plan.groundStock.length > 0) return plan.groundStock.shift();
  }
  if (role === "stone") {
    if (plan.stoneStock.length > 0) return plan.stoneStock.shift();
    if (plan.groundStock.length > 0) return plan.groundStock.shift();
    if (plan.woodStock.length > 0) return logBlockForWood(plan.woodStock.shift());
  }
  if (role === "ground") {
    if (plan.groundStock.length > 0) return plan.groundStock.shift();
    if (plan.stoneStock.length > 0) return plan.stoneStock.shift();
    if (plan.woodStock.length > 0) return `${plan.woodStock.shift()}_planks`;
  }
  // Для "utility" (костёр, верстак, печь, сундук, лестница, факелы) расходуем 1 единицу любого добытого ресурса
  if (plan.woodStock.length > 0) { plan.woodStock.shift(); return item.fallback; }
  if (plan.stoneStock.length > 0) { plan.stoneStock.shift(); return item.fallback; }
  if (plan.groundStock.length > 0) { plan.groundStock.shift(); return item.fallback; }
  return undefined;
}

function desiredResourceKind(item) {
  if (!item) return "wood";
  if (item.role === "wood_log" || item.role === "wood_planks" || item.role === "wood_fence") return "wood";
  if (item.role === "stone") return "stone";
  if (item.role === "ground") return "ground";
  return "wood";
}

// Добыча ресурсов и пошаговая постройка орочьей базы (строго в мирное время и только из добытых блоков!)
function tickChiefBaseBuilding(leader, nearPlayers, now) {
  if (!valid(leader) || !alive(leader)) return;
  const dim = leader.dimension;

  // Если этот орк из системного аванпоста, страж Гул'дана или раб — он не строит новую базу
  try {
    if (leader.hasTag("cb_orc_garrison") || leader.hasTag("cb_orc_war") || leader.hasTag("cb_guldan_guard") || leader.hasTag("cb_orc_slave")) return;
  } catch {}

  // Во время войны или боя орки НЕ добывают блоки и НЕ строят базу!
  if (isOrcOrSquadAtWar(leader, dim, now)) {
    for (const w of alliedOrcsNear(dim, leader, 28)) restoreCombatWeapon(w);
    return;
  }

  const dimId = String(dim.id).replace("minecraft:", "");
  const raceKey = leader.typeId === "cb:green_orc" ? "green_orc" : (leader.typeId === "cb:hell_orc" ? "hell_orc" : "orc");

  let plan = basePlans.get(leader.id);
  if (!plan) {
    const cx = Math.floor(leader.location.x);
    const cz = Math.floor(leader.location.z);
    if (hasNearbyBase(dimId, cx, cz, 22)) return;

    const surf = surface(dim, cx, cz);
    const cy = surf ? surf.y : Math.floor(leader.location.y) - 1;
    plan = {
      dimId, cx, cy, cz, race: raceKey,
      queue: buildBasePlan(cx, cy, cz, raceKey),
      woodStock: [],
      stoneStock: [],
      groundStock: [],
      minedLocations: new Set(),
      minedCount: 0,
      builtCount: 0,
      done: false
    };
    basePlans.set(leader.id, plan);
    builtCenters.push({ dimId, cx, cz });

    // Повышаем вождя и оповещаем игроков
    try {
      if (!isLeader(leader)) {
        leader.triggerEvent("cb:as_leader");
        leader.setProperty("cb:leader", true);
      }
      if (levelOf(leader) < LEVELS.length - 1) {
        leader.setDynamicProperty(POINTS_KEY, 1200);
        levelUp(leader, LEVELS.length - 1);
      }
    } catch {}
    for (const p of nearPlayers) actionBar(p, T("orc.base_start"));
    sound(dim, "cb.orc.warcry", leader.location, 2.2, 0.9);
  }

  if (plan.done) return;

  // Рабочие: все союзные пешие орки в радиусе 28 блоков
  const workers = alliedOrcsNear(dim, leader, 28).filter((o) => !isRiding(o));
  if (workers.length === 0) workers.push(leader);

  // Фаза А: Сначала орки ДОБЫВАЮТ блоки вокруг будущей базы (рубка дерева, добыча камня и копка грунта)
  // Без добытых блоков в запасе (woodStock / stoneStock / groundStock) ни один блок базы построен быть не может!
  const nextItem = plan.queue[0];
  const wantKind = desiredResourceKind(nextItem);
  const needMining = totalStockOf(plan) < workers.length * 2 ||
    (wantKind === "wood" && plan.woodStock.length === 0) ||
    (wantKind === "stone" && plan.stoneStock.length === 0) ||
    (wantKind === "ground" && plan.groundStock.length === 0);

  if (plan.queue.length > 0 && needMining) {
    const minersCount = Math.min(workers.length, 3);
    for (let m = 0; m < minersCount; m++) {
      const miner = workers[(now + m) % workers.length];
      const itemHint = plan.queue[Math.min(m, plan.queue.length - 1)];
      mineOneBlock(miner, dim, plan, desiredResourceKind(itemHint));
    }
  }

  // Фаза Б: Возведение орочьей базы СТРОГО из добытых блоков в запасе
  const maxBuildThisStep = Math.min(4, Math.max(2, workers.length));
  let builtNow = 0;
  for (let i = 0; i < maxBuildThisStep && plan.queue.length > 0; i++) {
    if (totalStockOf(plan) <= 0) break; // Нет добытых блоков — сначала нужно добыть!
    const item = plan.queue[0];
    const blockToPlace = consumeMaterialForBlueprint(plan, item);
    if (!blockToPlace) break;
    plan.queue.shift();

    const builder = workers[i % workers.length];
    try {
      // Строитель держит в руке блок, который он сейчас ставит
      const eq = builder.getComponent("minecraft:equippable");
      if (eq && !/campfire|soul_campfire|torch|ladder|chest|barrel|anvil|furnace|crafting_table/.test(blockToPlace)) {
        try { eq.setEquipment("Mainhand", new ItemStack(`minecraft:${blockToPlace}`, 1)); } catch {}
      }

      const bdx = item.x + 0.5 - builder.location.x;
      const bdz = item.z + 0.5 - builder.location.z;
      const bDist = Math.hypot(bdx, bdz) || 1;
      if (bDist > 5.0 && builder.isOnGround !== false) {
        try { builder.applyImpulse({ x: (bdx / bDist) * 0.26, y: 0.12, z: (bdz / bDist) * 0.26 }); } catch {}
      }
      try {
        builder.teleport(builder.location, { facingLocation: { x: item.x + 0.5, y: item.y + 0.5, z: item.z + 0.5 }, keepVelocity: true });
        builder.setProperty("cb:mining", true);
        system.runTimeout(() => {
          if (valid(builder)) { try { builder.setProperty("cb:mining", false); } catch {} }
        }, 14);
      } catch {}
      dim.runCommandAsync(`setblock ${item.x} ${item.y} ${item.z} ${blockToPlace}`);
      if (blockToPlace === "chest" || blockToPlace === "barrel") {
        dim.runCommandAsync(`loot insert ${item.x} ${item.y} ${item.z} loot "chests/orc_camp"`);
      }
      plan.builtCount++;
      builtNow++;
    } catch {}
  }

  if (builtNow > 0) {
    sound(dim, "use.wood", { x: plan.cx, y: plan.cy + 1, z: plan.cz }, 1.2, 0.95);
    fx(dim, "minecraft:villager_happy", { x: plan.cx, y: plan.cy + 2, z: plan.cz });
  }

  if (plan.queue.length === 0 && !plan.done) {
    plan.done = true;
    // Возвращаем всем оркам боевое оружие после завершения строительства базы
    for (const w of workers) restoreCombatWeapon(w);
    sound(dim, "random.levelup", { x: plan.cx, y: plan.cy + 2, z: plan.cz }, 1.8, 0.85);
    for (const p of nearPlayers) actionBar(p, T("orc.base_done"));
  }
}

export function tickOrcs() {
  const now = system.currentTick;
  if (now % 20 === 0) releaseOrphans();
  for (const [id, until] of crying) {
    if (now < until) continue;
    crying.delete(id);
    const e = world.getEntity(id);
    if (e && valid(e)) { try { e.triggerEvent("cb:end_warcry"); } catch {} }
  }

  // Каждые 10 тиков (0.5 с) проверяем орков рядом с игроками (радиус 48 блоков)
  if (now % 10 === 0) {
    for (const dimId of ["overworld", "nether", "the_end"]) {
      let dim;
      try { dim = world.getDimension(dimId); } catch { continue; }
      let ps = [];
      try { ps = dim.getPlayers(); } catch {}
      if (ps.length === 0) continue;

      const visitedOrcs = new Set();
      for (const p of ps) {
        if (!alive(p)) continue;
        if (shared.isDancing?.(p.location, dim)) continue;

        let nearOrcs = [];
        try { nearOrcs = dim.getEntities({ location: p.location, maxDistance: 48, excludeTypes: ["minecraft:item", "minecraft:xp_orb"] }); } catch {}
        for (const o of nearOrcs) {
          if (visitedOrcs.has(o.id) || !isOrc(o) || !alive(o)) continue;
          visitedOrcs.add(o.id);
          if (!spawnTick.has(o.id)) spawnTick.set(o.id, now);

          // 1) Если орк или его отряд в состоянии войны/боя — НЕ строим базу, возвращаем боевое оружие!
          if (isOrcOrSquadAtWar(o, dim, now)) {
            restoreCombatWeapon(o);
            continue;
          }

          // 2) Авто-выбор Вождя и запуск постройки орочьей базы (только в мирное время!):
          if (!isLeader(o)) {
            const squad = alliedOrcsNear(dim, o, 24);
            const existingLeader = squad.find((m) => isLeader(m));
            const age = now - (spawnTick.get(o.id) ?? now);
            if (!existingLeader && (squad.length >= 2 || age >= 60)) {
              try {
                o.triggerEvent("cb:as_leader");
                o.setProperty("cb:leader", true);
              } catch {}
            }
          }

          if (isLeader(o)) {
            const age = now - (spawnTick.get(o.id) ?? now);
            if (age >= 30 || basePlans.has(o.id) || o.hasTag("cb_max_leader")) {
              tickChiefBaseBuilding(o, ps, now);
            }
          }
        }
      }
    }
  }
}

// Команда /scriptevent cb:orcs maxlevel (или base / build) — запускает постройку базы рядом с игроком
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id !== "cb:orcs") return;
  const p = ev.sourceEntity;
  const arg = String(ev.message ?? "").trim().toLowerCase();
  if ((arg === "maxlevel" || arg === "base" || arg === "build") && p && valid(p)) {
    const dim = p.dimension;
    let orcs = [];
    try { orcs = dim.getEntities({ location: p.location, maxDistance: 36, excludeTypes: ["minecraft:item", "minecraft:xp_orb"] }).filter((e) => isOrc(e) && alive(e)); } catch {}
    let leader = orcs.find((o) => isLeader(o));
    if (!leader && orcs.length > 0) {
      leader = orcs[0];
      try { leader.triggerEvent("cb:as_leader"); leader.setProperty("cb:leader", true); } catch {}
    }
    if (!leader) {
      try {
        leader = dim.spawnEntity("cb:orc", { x: p.location.x + 4, y: p.location.y, z: p.location.z + 4 });
        leader.triggerEvent("cb:as_leader");
        leader.setProperty("cb:leader", true);
        for (let i = 0; i < 3; i++) {
          const w = dim.spawnEntity("cb:orc", { x: p.location.x + 2 + i * 2, y: p.location.y, z: p.location.z + 5 });
          w.setDynamicProperty("cb:mount_rolled", true);
        }
      } catch {}
    }
    if (leader) {
      try {
        leader.addTag("cb_max_leader");
        leader.setDynamicProperty("cb:max_leader", true);
        leader.setDynamicProperty(POINTS_KEY, 1500);
        levelUp(leader, LEVELS.length - 1);
        basePlans.delete(leader.id);
        tickChiefBaseBuilding(leader, [p], system.currentTick);
      } catch {}
    }
  }
});

world.afterEvents.entitySpawn?.subscribe?.((ev) => {
  const e = ev.entity;
  if (!isOrc(e)) return;
  spawnTick.set(e.id, system.currentTick);
  system.runTimeout(() => { if (valid(e)) mountFor(e); }, 2);
});
world.afterEvents.entityHurt.subscribe((ev) => onHurt(ev.hurtEntity, ev.damageSource?.damagingEntity));
system.runInterval(tickOrcs, 5);
