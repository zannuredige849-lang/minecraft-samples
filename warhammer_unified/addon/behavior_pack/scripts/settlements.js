import { world, system, ItemStack, EquipmentSlot, EntityDamageCause } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { dist2, dist3, randInt, getDifficultyScale, safePlayAnim, clamp, valid, alive, isPlayer, inSurvival, healthOf, fx, sound, actionBar } from "./util.js";

/**
 * HUMAN SETTLEMENT, TRADE, RECRUITMENT & WARRIOR SYSTEM (ZhekAziz Fathylogy v2.4)
 *
 * 1. 6 Architectural & Biome Variations of Human Bases & Settlements:
 *    - "small" / "hamlet": Лесной хутор с частоколом, сторожевой вышкой, фермой, колодцем и кузницей
 *    - "medium" / "town": Средневековый укреплённый посад с каменными стенами, 4 воротами, ратушей и колокольней
 *    - "large" / "citadel": Королевская цитадель с донжоном, двойными башнями, казармами, арсеналом и рыночной площадью
 *    - "outpost": Рыцарский пограничный форт с зубчатыми бастионами, плацем и сигнальным огнём
 *    - "nordic": Северная крепость из ели и глубинного сланца с длинным залом ярла и жаровнями
 *    - "desert": Пустынный бастион-оазис из тёсаного песчаника с пальмами, источником и террасами
 *
 * 2. Full Vanilla Weapon Mastery & Player-Like Shield Blocking:
 *    - Humans use all vanilla weapons: Swords (Wood..Netherite), Axes (Wood..Netherite, break enemy shields!),
 *      Spears & Tridents (extended 4.5-block reach + impaling thrust + medium-range spear throw),
 *      Bows (high-arc volley & aimed shots), Crossbows (high-velocity piercing bolts), and Maces (crush slam).
 *    - Player-like Shield Mechanics (`cb:blocking`):
 *      * Raises shield in combat when approaching enemies or under ranged/melee threat.
 *      * Blocks 100% of frontal arrows/projectiles (reflecting arrows with `item.shield.block` sound) and 85% of frontal melee damage, knocking back the attacker!
 *      * If hit by an Axe (`_axe`) or heavy boss slam while blocking, the shield is disabled for 5 seconds (100 ticks) with `random.break` sound, just like a player's shield!
 *
 * 3. Interactive Trading & Warrior Hiring System (`@minecraft/server-ui` + quick item interactions):
 *    - Trade Menu (Торговля): Buy food, arrows, iron/diamond gear, shields, tridents, golden apples, or sell resources for emeralds.
 *    - Hire Menu (Найм воина): Hire any human villager or knight for Emeralds, Gold Ingots, or Iron Ingots (or by handing them a weapon/emerald).
 *    - Hired Warrior Controls:
 *      * Modes: СЛЕДОВАТЬ (Follow Owner), ОХРАНЯТЬ ТОЧКУ (Guard Position), СВОБОДНЫЙ ПАТРУЛЬ (Patrol).
 *      * Equipment Menu: Give any weapon, shield, or armor from your mainhand directly to your warrior, or heal them with food!
 */

const SETTLEMENT_PROP = "cb:human_settlements_v1";
const MIN_SETTLEMENT_SPACING = 260;
const AUTO_CHECK_TICKS = 300; // Check every 15s for natural settlement discovery

// Role constants on cb:human_villager
export const ROLE_VILLAGER = 0;
export const ROLE_MILITIA = 1;
export const ROLE_SWORDSMAN = 2;
export const ROLE_ARCHER = 3;
export const ROLE_CROSSBOWMAN = 4;
export const ROLE_SPEARMAN = 5;
export const ROLE_CAPTAIN = 6;

// Stance constants on hired cb:human_villager
export const STANCE_DEFAULT = 0;
export const STANCE_FOLLOW = 1;
export const STANCE_GUARD = 2;
export const STANCE_PATROL = 3;

// Weapon type constants (cb:weapon_type)
export const WTYPE_NONE = 0;
export const WTYPE_SWORD = 1;
export const WTYPE_AXE = 2;
export const WTYPE_SPEAR = 3;
export const WTYPE_BOW = 4;
export const WTYPE_CROSSBOW = 5;
export const WTYPE_MACE = 6;

// Job constants on cb:human_villager (when ROLE_VILLAGER)
const JOB_FARMER = 0;
const JOB_WOODCUTTER = 1;
const JOB_MINER = 2;
const JOB_BLACKSMITH = 3;
const JOB_MERCHANT = 4;

// Command orders issued by Knights / Captains
const CMD_RETURN_DUTY = "RETURN_DUTY";
const CMD_GATHER_BELL = "GATHER_BELL";
const CMD_DEFEND_GATE = "DEFEND_GATE";
const CMD_PROTECT_CIVILIANS = "PROTECT_CIVILIANS";
const CMD_ATTACK_HOSTILES = "ATTACK_HOSTILES";
const CMD_HOLD_POSITIONS = "HOLD_POSITIONS";

const HOSTILE_FAMILIES = [
  "monster", "undead", "zombie", "skeleton", "illager",
  "orc", "orc_faction", "green_orc", "hell_orc", "goblin",
  "fel", "fel_faction", "scourge", "dread", "cyclops",
  "minotaur", "hydra", "laestrygonian", "siren", "dragon",
  "wild_troll", "cannibal_troll", "ice_troll"
];

const WEAPON_BASE_DMG = {
  "minecraft:wooden_sword": 4,
  "minecraft:golden_sword": 4,
  "minecraft:stone_sword": 5,
  "minecraft:iron_sword": 6,
  "minecraft:diamond_sword": 7,
  "minecraft:netherite_sword": 8,
  "minecraft:wooden_axe": 4,
  "minecraft:golden_axe": 4,
  "minecraft:stone_axe": 5,
  "minecraft:iron_axe": 6,
  "minecraft:diamond_axe": 7,
  "minecraft:netherite_axe": 8,
  "minecraft:trident": 8,
  "minecraft:mace": 8,
  "minecraft:wooden_spear": 5,
  "minecraft:stone_spear": 6,
  "minecraft:iron_spear": 7,
  "minecraft:golden_spear": 6,
  "minecraft:diamond_spear": 8,
  "minecraft:netherite_spear": 9,
  "cb:laestrygonian_sword": 8,
  "cb:hell_scimitar": 7
};

const ARMOR_SLOT_MAP = [
  { test: /_helmet$|_cap$|carved_pumpkin|turtle_helmet/, slot: EquipmentSlot.Head },
  { test: /_chestplate$|_tunic$/, slot: EquipmentSlot.Chest },
  { test: /_leggings$|_pants$/, slot: EquipmentSlot.Legs },
  { test: /_boots$/, slot: EquipmentSlot.Feet }
];

const FOOD_HEAL_MAP = {
  "minecraft:bread": 5,
  "minecraft:apple": 4,
  "minecraft:cooked_beef": 8,
  "minecraft:cooked_porkchop": 8,
  "minecraft:cooked_mutton": 6,
  "minecraft:cooked_chicken": 6,
  "minecraft:cooked_salmon": 6,
  "minecraft:cooked_cod": 5,
  "minecraft:carrot": 3,
  "minecraft:baked_potato": 5,
  "minecraft:golden_carrot": 8,
  "minecraft:golden_apple": 14
};

let settlements = [];
let loadedFromWorld = false;
const buildQueue = [];
let buildTaskRunning = false;

// Per-entity runtime combat state for humans
// id -> { shieldDisabledUntil, lastBlockTick, lastShotTick, lastSpearThrowTick, lastSlashTick, targetId }
const humanCombatState = new Map();

function getCombatState(id) {
  let st = humanCombatState.get(id);
  if (!st) {
    st = {
      shieldDisabledUntil: 0,
      lastBlockTick: 0,
      lastShotTick: 0,
      lastSpearThrowTick: 0,
      lastSlashTick: 0,
      targetId: undefined
    };
    humanCombatState.set(id, st);
  }
  return st;
}

function loadSettlements() {
  if (loadedFromWorld) return;
  loadedFromWorld = true;
  try {
    const raw = world.getDynamicProperty(SETTLEMENT_PROP);
    if (typeof raw === "string" && raw.length > 2) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) settlements = parsed;
    }
  } catch (e) {
    settlements = [];
  }
}

function saveSettlements() {
  try {
    if (settlements.length > 24) settlements = settlements.slice(-24);
    world.setDynamicProperty(SETTLEMENT_PROP, JSON.stringify(settlements));
  } catch (e) {}
}

export function getNearestSettlement(loc, maxDist = 96) {
  loadSettlements();
  let best = null;
  let bestD = maxDist;
  for (const s of settlements) {
    const d = Math.hypot(loc.x - s.x, loc.z - s.z);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

// ============================================================================
// PROGRESSIVE STRUCTURE BUILDER (55 cmds/tick, zero lag, multi-point terrain check)
// ============================================================================
function enqueueCommands(dim, cmds, onDone) {
  buildQueue.push({ dim, cmds, idx: 0, waitTicks: 8, onDone });
  if (!buildTaskRunning) {
    buildTaskRunning = true;
    system.runInterval(processBuildQueue, 1);
  }
}

function processBuildQueue() {
  if (buildQueue.length === 0) return;
  const job = buildQueue[0];
  if (job.waitTicks > 0) {
    job.waitTicks--;
    return;
  }
  const batch = 55;
  let count = 0;
  while (job.idx < job.cmds.length && count < batch) {
    const cmd = job.cmds[job.idx++];
    count++;
    try {
      if (typeof job.dim.runCommandAsync === "function") {
        job.dim.runCommandAsync(cmd);
      } else {
        job.dim.runCommand(cmd);
      }
    } catch (e) {}
  }
  if (job.idx >= job.cmds.length) {
    buildQueue.shift();
    if (typeof job.onDone === "function") {
      system.runTimeout(() => {
        try {
          job.onDone();
        } catch (e) {}
      }, 6);
    }
  }
}

export function detectSurfaceInfo(dim, x, z, fallbackY = 70) {
  try {
    for (let y = 150; y >= 50; y--) {
      const b = dim.getBlock({ x, y, z });
      if (!b) continue;
      const id = b.typeId;
      if (
        id === "minecraft:air" ||
        id.includes("leaves") ||
        id.includes("log") ||
        id.includes("grass_plant") ||
        id.includes("short_grass") ||
        id.includes("tall_grass") ||
        id.includes("fern") ||
        id.includes("flower") ||
        id.includes("bush") ||
        id.includes("vine") ||
        id.includes("snow_layer") ||
        id.includes("cactus") ||
        id.includes("deadbush")
      ) {
        continue;
      }
      if (id.includes("water") || id.includes("lava") || id.includes("ice") || id.includes("kelp") || id.includes("seagrass")) {
        return null;
      }
      return { y, blockId: id };
    }
  } catch (e) {}
  return fallbackY !== null ? { y: fallbackY, blockId: "minecraft:grass_block" } : null;
}

/**
 * Multi-point terrain validation so settlements never build over oceans, rivers, or extreme cliffs
 */
function validateSettlementTerrain(dim, cx, cz, checkRadius = 18) {
  const center = detectSurfaceInfo(dim, cx, cz, null);
  if (!center) return null;
  const sampleOffsets = [
    [-checkRadius, 0], [checkRadius, 0], [0, -checkRadius], [0, checkRadius],
    [-checkRadius, -checkRadius], [checkRadius, -checkRadius], [-checkRadius, checkRadius], [checkRadius, checkRadius]
  ];
  let minY = center.y;
  let maxY = center.y;
  let validSamples = 0;
  for (const [ox, oz] of sampleOffsets) {
    const info = detectSurfaceInfo(dim, cx + ox, cz + oz, null);
    if (!info) return null; // Reject if any corner is water/lava
    minY = Math.min(minY, info.y);
    maxY = Math.max(maxY, info.y);
    validSamples++;
  }
  if (validSamples < sampleOffsets.length || (maxY - minY) > 12) return null;
  return center;
}

// ============================================================================
// 6 ARCHITECTURAL & BIOME VARIATIONS OF HUMAN SETTLEMENTS & BASES
// ============================================================================
const SETTLEMENT_VARIANTS = {
  small: {
    key: "small",
    radius: 19,
    houses: 3,
    towers: 2,
    minPop: 7,
    maxPop: 10,
    knights: 2,
    hasCaptain: false,
    label: "Лесной хутор людей",
    wallMat: "spruce_log",
    battlementMat: "spruce_fence",
    houseWallA: "spruce_planks",
    houseWallB: "cobblestone",
    roofMat: "dark_oak_planks",
    roofSlab: "dark_oak_slab",
    groundMat: "grass_block",
    roadMat: "dirt_path",
    plazaMat: "mossy_cobblestone",
    style: "hamlet"
  },
  medium: {
    key: "medium",
    radius: 25,
    houses: 4,
    towers: 4,
    minPop: 13,
    maxPop: 19,
    knights: 4,
    hasCaptain: true,
    label: "Средневековый посад людей",
    wallMat: "stone_bricks",
    battlementMat: "cobblestone_wall",
    houseWallA: "oak_planks",
    houseWallB: "cobblestone",
    roofMat: "dark_oak_planks",
    roofSlab: "spruce_slab",
    groundMat: "grass_block",
    roadMat: "dirt_path",
    plazaMat: "stone_bricks",
    style: "town"
  },
  large: {
    key: "large",
    radius: 31,
    houses: 6,
    towers: 4,
    minPop: 22,
    maxPop: 30,
    knights: 7,
    hasCaptain: true,
    label: "Королевская цитадель людей",
    wallMat: "stone_bricks",
    battlementMat: "stone_brick_wall",
    houseWallA: "stone_bricks",
    houseWallB: "oak_planks",
    roofMat: "dark_oak_planks",
    roofSlab: "stone_brick_slab",
    groundMat: "grass_block",
    roadMat: "cobblestone",
    plazaMat: "chiseled_stone_bricks",
    style: "citadel"
  },
  outpost: {
    key: "outpost",
    radius: 17,
    houses: 2,
    towers: 4,
    minPop: 8,
    maxPop: 12,
    knights: 5,
    hasCaptain: true,
    label: "Рыцарский пограничный форт",
    wallMat: "stone_bricks",
    battlementMat: "cobblestone_wall",
    houseWallA: "stone_bricks",
    houseWallB: "spruce_planks",
    roofMat: "spruce_planks",
    roofSlab: "stone_brick_slab",
    groundMat: "grass_block",
    roadMat: "cobblestone",
    plazaMat: "stone_bricks",
    style: "outpost"
  },
  nordic: {
    key: "nordic",
    radius: 24,
    houses: 4,
    towers: 4,
    minPop: 12,
    maxPop: 18,
    knights: 5,
    hasCaptain: true,
    label: "Северная твердыня людей",
    wallMat: "deepslate_bricks",
    battlementMat: "cobbled_deepslate_wall",
    houseWallA: "spruce_planks",
    houseWallB: "deepslate_bricks",
    roofMat: "dark_oak_planks",
    roofSlab: "spruce_slab",
    groundMat: "snow",
    roadMat: "gravel",
    plazaMat: "polished_deepslate",
    style: "nordic"
  },
  desert: {
    key: "desert",
    radius: 24,
    houses: 4,
    towers: 4,
    minPop: 12,
    maxPop: 18,
    knights: 4,
    hasCaptain: true,
    label: "Пустынный бастион-оазис людей",
    wallMat: "cut_sandstone",
    battlementMat: "sandstone_wall",
    houseWallA: "smooth_sandstone",
    houseWallB: "cut_sandstone",
    roofMat: "acacia_planks",
    roofSlab: "sandstone_slab",
    groundMat: "sand",
    roadMat: "smooth_sandstone",
    plazaMat: "chiseled_sandstone",
    style: "desert"
  }
};

function chooseNaturalVariant(surfaceBlockId) {
  const id = String(surfaceBlockId || "");
  if (id.includes("sand")) return "desert";
  if (id.includes("snow") || id.includes("ice") || id.includes("podzol")) {
    return Math.random() < 0.65 ? "nordic" : "small";
  }
  const r = Math.random();
  if (r < 0.22) return "small";
  if (r < 0.48) return "medium";
  if (r < 0.68) return "outpost";
  if (r < 0.84) return "nordic";
  return "large";
}

/**
 * Generates a complete Medieval Human Settlement of any of the 6 variations
 */
export function buildHumanSettlement(dim, centerLoc, sizeType = "medium", announcePlayer = null) {
  // Human settlement building AI disabled per user request.
  return null;
  loadSettlements();
  const cx = Math.floor(centerLoc.x);
  const cz = Math.floor(centerLoc.z);
  const surf = detectSurfaceInfo(dim, cx, cz, Math.floor(centerLoc.y));
  const by = surf !== null ? surf.y : Math.floor(centerLoc.y) - 1;

  const sizeCfg = SETTLEMENT_VARIANTS[sizeType] || SETTLEMENT_VARIANTS.medium;
  const R = sizeCfg.radius;
  const cmds = [];
  const areaName = `cb_vil_${Math.abs(cx % 999)}_${Math.abs(cz % 999)}`;

  cmds.push(`tickingarea remove ${areaName}`);
  cmds.push(`tickingarea add circle ${cx} ${by} ${cz} 5 ${areaName} true`);

  // 1. Foundation & Courtyard leveling with natural stepped terrace support
  const subGround = sizeCfg.groundMat === "sand" ? "sandstone" : "dirt";
  cmds.push(`fill ${cx - R - 2} ${by - 4} ${cz - R - 2} ${cx + R + 2} ${by - 1} ${cz + R + 2} ${subGround}`);
  cmds.push(`fill ${cx - R - 1} ${by} ${cz - R - 1} ${cx + R + 1} ${by} ${cz + R + 1} ${sizeCfg.groundMat}`);
  cmds.push(`fill ${cx - R - 1} ${by + 1} ${cz - R - 1} ${cx + R + 1} ${by + 15} ${cz + R + 1} air`);

  // 2. Crossroads & Central Plaza
  cmds.push(`fill ${cx - R + 1} ${by} ${cz - 1} ${cx + R - 1} ${by} ${cz + 1} ${sizeCfg.roadMat}`);
  cmds.push(`fill ${cx - 1} ${by} ${cz - R + 1} ${cx + 1} ${by} ${cz + R - 1} ${sizeCfg.roadMat}`);
  cmds.push(`fill ${cx - 5} ${by} ${cz - 5} ${cx + 5} ${by} ${cz + 5} ${sizeCfg.roadMat}`);
  cmds.push(`fill ${cx - 4} ${by} ${cz - 4} ${cx + 4} ${by} ${cz + 4} ${sizeCfg.plazaMat}`);

  // 3. Central Well, Bell Tower & Market Stalls (or Keep / Jarl Hall depending on style)
  cmds.push(`fill ${cx - 2} ${by + 1} ${cz - 2} ${cx + 2} ${by + 1} ${cz + 2} stone_brick_stairs`);
  cmds.push(`fill ${cx - 1} ${by - 2} ${cz - 1} ${cx + 1} ${by} ${cz + 1} ${sizeCfg.wallMat}`);
  cmds.push(`fill ${cx} ${by - 1} ${cz} ${cx} ${by} ${cz} water`);

  for (const [px, pz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
    cmds.push(`fill ${cx + px} ${by + 1} ${cz + pz} ${cx + px} ${by + 7} ${cz + pz} ${sizeCfg.battlementMat}`);
  }
  cmds.push(`fill ${cx - 2} ${by + 8} ${cz - 2} ${cx + 2} ${by + 8} ${cz + 2} ${sizeCfg.roofMat}`);
  cmds.push(`fill ${cx - 1} ${by + 9} ${cz - 1} ${cx + 1} ${by + 9} ${cz + 1} ${sizeCfg.roofSlab}`);
  cmds.push(`setblock ${cx + 2} ${by + 1} ${cz} ${sizeCfg.wallMat}`);
  cmds.push(`setblock ${cx + 2} ${by + 2} ${cz} bell`);
  cmds.push(`setblock ${cx} ${by + 7} ${cz} bell`);
  cmds.push(`setblock ${cx - 2} ${by + 3} ${cz} lantern`);
  cmds.push(`setblock ${cx + 2} ${by + 3} ${cz} lantern`);

  // Market stalls near plaza for trading
  cmds.push(`fill ${cx - 5} ${by + 1} ${cz - 4} ${cx - 5} ${by + 2} ${cz - 2} oak_fence`);
  cmds.push(`fill ${cx - 6} ${by + 3} ${cz - 4} ${cx - 4} ${by + 3} ${cz - 2} red_wool`);
  cmds.push(`setblock ${cx - 5} ${by + 1} ${cz - 3} emerald_block`);
  cmds.push(`setblock ${cx - 5} ${by + 2} ${cz - 3} lantern`);

  // Style-specific centerpiece enhancements
  if (sizeCfg.style === "citadel") {
    // Royal banners & beacon spire atop central bell tower
    cmds.push(`fill ${cx - 1} ${by + 10} ${cz - 1} ${cx + 1} ${by + 12} ${cz + 1} chiseled_stone_bricks`);
    cmds.push(`setblock ${cx} ${by + 13} ${cz} gold_block`);
    cmds.push(`setblock ${cx} ${by + 14} ${cz} shroomlight`);
  } else if (sizeCfg.style === "nordic") {
    // Nordic braziers around plaza
    for (const [bx, bz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
      cmds.push(`setblock ${cx + bx} ${by + 1} ${cz + bz} cobbled_deepslate_wall`);
      cmds.push(`setblock ${cx + bx} ${by + 2} ${cz + bz} campfire`);
    }
  } else if (sizeCfg.style === "desert") {
    // Oasis palms around the central water source
    for (const [tx, tz] of [[-4, -4], [4, 4]]) {
      cmds.push(`fill ${cx + tx} ${by + 1} ${cz + tz} ${cx + tx} ${by + 5} ${cz + tz} jungle_log`);
      cmds.push(`fill ${cx + tx - 2} ${by + 6} ${cz + tz - 2} ${cx + tx + 2} ${by + 6} ${cz + tz + 2} jungle_leaves ["persistent_bit"=true]`);
    }
  }

  // 4. Perimeter Defensive Walls & 4 Main Gates
  const wallH = sizeCfg.style === "citadel" ? 5 : sizeCfg.style === "hamlet" ? 3 : 4;
  cmds.push(`fill ${cx - R} ${by + 1} ${cz - R} ${cx + R} ${by + wallH} ${cz - R} ${sizeCfg.wallMat}`);
  cmds.push(`fill ${cx - R} ${by + 1} ${cz + R} ${cx + R} ${by + wallH} ${cz + R} ${sizeCfg.wallMat}`);
  cmds.push(`fill ${cx - R} ${by + 1} ${cz - R} ${cx - R} ${by + wallH} ${cz + R} ${sizeCfg.wallMat}`);
  cmds.push(`fill ${cx + R} ${by + 1} ${cz - R} ${cx + R} ${by + wallH} ${cz + R} ${sizeCfg.wallMat}`);

  // Battlements on walls
  cmds.push(`fill ${cx - R} ${by + wallH + 1} ${cz - R} ${cx + R} ${by + wallH + 1} ${cz - R} ${sizeCfg.battlementMat}`);
  cmds.push(`fill ${cx - R} ${by + wallH + 1} ${cz + R} ${cx + R} ${by + wallH + 1} ${cz + R} ${sizeCfg.battlementMat}`);
  cmds.push(`fill ${cx - R} ${by + wallH + 1} ${cz - R} ${cx - R} ${by + wallH + 1} ${cz + R} ${sizeCfg.battlementMat}`);
  cmds.push(`fill ${cx + R} ${by + wallH + 1} ${cz - R} ${cx + R} ${by + wallH + 1} ${cz + R} ${sizeCfg.battlementMat}`);

  // Carve 4 Gateways (North, South, West, East) with portcullis iron bars & lanterns
  const gates = [
    { x: cx, z: cz - R },
    { x: cx, z: cz + R },
    { x: cx - R, z: cz },
    { x: cx + R, z: cz }
  ];
  cmds.push(`fill ${cx - 2} ${by + 1} ${cz - R} ${cx + 2} ${by + 3} ${cz - R} air`);
  cmds.push(`fill ${cx - 2} ${by + 1} ${cz + R} ${cx + 2} ${by + 3} ${cz + R} air`);
  cmds.push(`fill ${cx - R} ${by + 1} ${cz - 2} ${cx - R} ${by + 3} ${cz + 2} air`);
  cmds.push(`fill ${cx + R} ${by + 1} ${cz - 2} ${cx + R} ${by + 3} ${cz + 2} air`);
  // Portcullis top trim
  cmds.push(`fill ${cx - 2} ${by + 3} ${cz - R} ${cx + 2} ${by + 3} ${cz - R} iron_bars`);
  cmds.push(`fill ${cx - 2} ${by + 3} ${cz + R} ${cx + 2} ${by + 3} ${cz + R} iron_bars`);
  cmds.push(`setblock ${cx - 3} ${by + 3} ${cz - R + 1} lantern`);
  cmds.push(`setblock ${cx + 3} ${by + 3} ${cz + R - 1} lantern`);

  // 5. Corner Guard Towers (for Archers & Crossbowmen)
  const towerPositions = [];
  const corners = [
    [cx - R + 2, cz - R + 2],
    [cx + R - 2, cz - R + 2],
    [cx - R + 2, cz + R - 2],
    [cx + R - 2, cz + R - 2]
  ].slice(0, sizeCfg.towers);

  for (const [tx, tz] of corners) {
    cmds.push(`fill ${tx - 2} ${by + 1} ${tz - 2} ${tx + 2} ${by + 8} ${tz + 2} ${sizeCfg.wallMat} hollow`);
    cmds.push(`fill ${tx - 3} ${by + 8} ${tz - 3} ${tx + 3} ${by + 8} ${tz + 3} ${sizeCfg.wallMat}`);
    cmds.push(`fill ${tx - 3} ${by + 9} ${tz - 3} ${tx + 3} ${by + 9} ${tz + 3} ${sizeCfg.battlementMat}`);
    cmds.push(`fill ${tx - 2} ${by + 9} ${tz - 2} ${tx + 2} ${by + 9} ${tz + 2} air`);
    cmds.push(`setblock ${tx} ${by + 1} ${tz - 2} air`);
    cmds.push(`setblock ${tx} ${by + 2} ${tz - 2} air`);
    cmds.push(`fill ${tx} ${by + 1} ${tz + 1} ${tx} ${by + 8} ${tz + 1} ladder ["facing_direction"=2]`);
    cmds.push(`setblock ${tx} ${by + 9} ${tz} lantern`);
    towerPositions.push({ x: tx + 0.5, y: by + 9, z: tz + 0.5 });
  }

  // 6. Blacksmith Workshop & Armory + Knight Training Post (NE quadrant)
  const bx = cx + 8;
  const bz = cz - 9;
  cmds.push(`fill ${bx - 3} ${by} ${bz - 3} ${bx + 3} ${by} ${bz + 3} cobblestone`);
  cmds.push(`fill ${bx - 3} ${by + 1} ${bz - 3} ${bx + 3} ${by + 4} ${bz + 3} ${sizeCfg.wallMat} hollow`);
  cmds.push(`fill ${bx - 3} ${by + 5} ${bz - 3} ${bx + 3} ${by + 5} ${bz + 3} ${sizeCfg.roofMat}`);
  cmds.push(`fill ${bx - 1} ${by + 1} ${bz + 3} ${bx + 1} ${by + 2} ${bz + 3} air`);
  cmds.push(`setblock ${bx - 2} ${by + 1} ${bz - 2} blast_furnace`);
  cmds.push(`setblock ${bx - 1} ${by + 1} ${bz - 2} anvil`);
  cmds.push(`setblock ${bx + 1} ${by + 1} ${bz - 2} grindstone`);
  cmds.push(`setblock ${bx + 2} ${by + 1} ${bz - 2} smithing_table`);
  cmds.push(`setblock ${bx + 2} ${by + 1} ${bz + 1} chest`);
  cmds.push(`loot insert ${bx + 2} ${by + 1} ${bz + 1} loot "chests/human_armory"`);
  cmds.push(`setblock ${bx} ${by + 3} ${bz} lantern`);
  // Training dummies outside blacksmith
  cmds.push(`setblock ${bx - 4} ${by + 1} ${bz + 2} oak_fence`);
  cmds.push(`setblock ${bx - 4} ${by + 2} ${bz + 2} hay_block`);
  cmds.push(`setblock ${bx - 4} ${by + 3} ${bz + 2} carved_pumpkin`);
  cmds.push(`setblock ${bx - 4} ${by + 1} ${bz - 1} oak_fence`);
  cmds.push(`setblock ${bx - 4} ${by + 2} ${bz - 1} target`);
  const armoryChestPos = { x: bx + 2, y: by + 1, z: bz + 1 };
  const blacksmithWorkPos = { x: bx, y: by + 1, z: bz - 1 };
  const trainingPos = { x: bx - 4, y: by + 1, z: bz + 1 };

  // 7. Settlement Warehouse & Supply Storage (NW quadrant)
  const wx = cx - 9;
  const wz = cz - 9;
  cmds.push(`fill ${wx - 3} ${by} ${wz - 3} ${wx + 3} ${by} ${wz + 3} spruce_planks`);
  cmds.push(`fill ${wx - 3} ${by + 1} ${wz - 3} ${wx + 3} ${by + 4} ${wz + 3} ${sizeCfg.houseWallA} hollow`);
  cmds.push(`fill ${wx - 3} ${by + 5} ${wz - 3} ${wx + 3} ${by + 5} ${wz + 3} ${sizeCfg.roofSlab}`);
  cmds.push(`fill ${wx} ${by + 1} ${wz + 3} ${wx} ${by + 2} ${wz + 3} air`);
  cmds.push(`setblock ${wx - 2} ${by + 1} ${wz - 2} chest`);
  cmds.push(`loot insert ${wx - 2} ${by + 1} ${wz - 2} loot "chests/human_warehouse"`);
  cmds.push(`setblock ${wx + 2} ${by + 1} ${wz - 2} chest`);
  cmds.push(`loot insert ${wx + 2} ${by + 1} ${wz - 2} loot "chests/human_warehouse"`);
  cmds.push(`setblock ${wx - 2} ${by + 1} ${wz + 1} barrel`);
  cmds.push(`setblock ${wx + 2} ${by + 1} ${wz + 1} hay_block`);
  cmds.push(`setblock ${wx} ${by + 3} ${wz} lantern`);
  const warehouseChestPos = { x: wx - 2, y: by + 1, z: wz - 2 };
  const granaryChestPos = { x: wx + 2, y: by + 1, z: wz - 2 };

  // 8. Irrigated Farms & Food Storage (SW quadrant)
  const fx = cx - 9;
  const fz = cz + 9;
  cmds.push(`fill ${fx - 4} ${by} ${fz - 4} ${fx + 4} ${by} ${fz + 4} farmland`);
  cmds.push(`fill ${fx - 4} ${by + 1} ${fz - 4} ${fx + 4} ${by + 1} ${fz + 4} oak_fence`);
  cmds.push(`fill ${fx - 3} ${by + 1} ${fz - 3} ${fx + 3} ${by + 1} ${fz + 3} wheat`);
  cmds.push(`setblock ${fx} ${by} ${fz} water`);
  cmds.push(`setblock ${fx} ${by + 1} ${fz} oak_trapdoor`);
  cmds.push(`setblock ${fx} ${by + 1} ${fz - 4} oak_fence_gate`);
  cmds.push(`setblock ${fx + 3} ${by + 1} ${fz - 3} composter`);
  const farmPos = { x: fx, y: by + 1, z: fz - 2 };

  // 9. Civilian Houses & Barracks (SE & outer quadrants)
  const houseCandidateCoords = [
    [cx + 9, cz + 9],
    [cx + 15, cz + 4],
    [cx - 15, cz + 4],
    [cx + 15, cz - 4],
    [cx - 15, cz - 4],
    [cx, cz + 15]
  ].slice(0, sizeCfg.houses);

  const houses = [];
  for (let i = 0; i < houseCandidateCoords.length; i++) {
    const [hx, hz] = houseCandidateCoords[i];
    const wallBlock = i % 2 === 0 ? sizeCfg.houseWallA : sizeCfg.houseWallB;
    cmds.push(`fill ${hx - 3} ${by} ${hz - 3} ${hx + 3} ${by} ${hz + 3} cobblestone`);
    cmds.push(`fill ${hx - 3} ${by + 1} ${hz - 3} ${hx + 3} ${by + 4} ${hz + 3} ${wallBlock} hollow`);
    cmds.push(`fill ${hx - 3} ${by + 5} ${hz - 3} ${hx + 3} ${by + 5} ${hz + 3} ${sizeCfg.roofMat}`);
    cmds.push(`fill ${hx - 2} ${by + 6} ${hz - 2} ${hx + 2} ${by + 6} ${hz + 2} ${sizeCfg.roofSlab}`);
    const doorZ = hz > cz ? hz - 3 : hz + 3;
    cmds.push(`fill ${hx} ${by + 1} ${doorZ} ${hx} ${by + 2} ${doorZ} air`);
    cmds.push(`setblock ${hx - 2} ${by + 2} ${doorZ} glass_pane`);
    cmds.push(`setblock ${hx + 2} ${by + 2} ${doorZ} glass_pane`);
    cmds.push(`setblock ${hx} ${by + 3} ${hz} lantern`);
    cmds.push(`setblock ${hx - 2} ${by + 1} ${hz} crafting_table`);
    cmds.push(`setblock ${hx + 2} ${by + 1} ${hz} chest`);
    cmds.push(`loot insert ${hx + 2} ${by + 1} ${hz} loot "chests/human_warehouse"`);
    houses.push({ x: hx, y: by + 1, z: hz, doorZ });
  }

  const settlementRecord = {
    id: `settlement_${Date.now()}_${Math.abs(cx)}_${Math.abs(cz)}`,
    sizeType: sizeCfg.key,
    label: sizeCfg.label,
    dimensionId: dim.id,
    x: cx,
    y: by + 1,
    z: cz,
    radius: R + 8,
    bellPos: { x: cx + 2, y: by + 2, z: cz },
    wellPos: { x: cx, y: by + 1, z: cz },
    armoryChestPos,
    warehouseChestPos,
    granaryChestPos,
    blacksmithWorkPos,
    trainingPos,
    farmPos,
    gates,
    towers: towerPositions,
    houses,
    alarmActive: false,
    alarmUntilTick: 0,
    commanderDeadUntilTick: 0,
    currentCommand: CMD_RETURN_DUTY,
    resources: {
      food: sizeCfg.key === "large" ? 40 : sizeCfg.key === "medium" ? 26 : 16,
      wood: sizeCfg.key === "large" ? 32 : 20,
      stone: sizeCfg.key === "large" ? 32 : 20,
      iron: sizeCfg.key === "large" ? 18 : 12,
      weapons: sizeCfg.key === "large" ? 10 : 6,
      armor: sizeCfg.key === "large" ? 8 : 5
    }
  };

  settlements.push(settlementRecord);
  saveSettlements();

  enqueueCommands(dim, cmds, () => {
    populateSettlementChestsAndInhabitants(dim, settlementRecord, sizeCfg);
    system.runTimeout(() => {
      try {
        dim.runCommandAsync(`tickingarea remove ${areaName}`);
      } catch (e) {}
    }, 40);
    if (announcePlayer) {
      try {
        announcePlayer.sendMessage(`§a[Поселение людей]§r Возведено: §e${sizeCfg.label}§r (${cx}, ${by + 1}, ${cz}). Подойдите к жителям или воинам для §bторговли и найма§r!`);
      } catch (e) {}
    }
  });

  return settlementRecord;
}

function populateChestWithItems(dim, pos, items) {
  try {
    const block = dim.getBlock(pos);
    if (!block) return;
    const inv = block.getComponent("minecraft:inventory");
    if (!inv || !inv.container) return;
    const c = inv.container;
    for (const [id, amount] of items) {
      try {
        c.addItem(new ItemStack(id, amount));
      } catch (e) {}
    }
  } catch (e) {}
}

function populateSettlementChestsAndInhabitants(dim, s, sizeCfg) {
  // 1. Stock Warehouse, Granary & Armory Chests with real items
  populateChestWithItems(dim, s.warehouseChestPos, [
    ["minecraft:oak_log", 20],
    ["minecraft:cobblestone", 24],
    ["minecraft:iron_ingot", 12],
    ["minecraft:emerald", 6],
    ["minecraft:coal", 12]
  ]);
  populateChestWithItems(dim, s.granaryChestPos, [
    ["minecraft:bread", 20],
    ["minecraft:apple", 12],
    ["minecraft:cooked_beef", 8],
    ["minecraft:carrot", 14],
    ["minecraft:wheat", 24]
  ]);
  populateChestWithItems(dim, s.armoryChestPos, [
    ["minecraft:iron_sword", 3],
    ["minecraft:iron_axe", 2],
    ["minecraft:diamond_sword", 1],
    ["minecraft:bow", 2],
    ["minecraft:crossbow", 2],
    ["minecraft:trident", 2],
    ["minecraft:shield", 5],
    ["minecraft:iron_chestplate", 3],
    ["minecraft:iron_helmet", 3],
    ["minecraft:arrow", 48]
  ]);

  // 2. Spawn Inhabitants according to settlement size
  const totalPop = randInt(sizeCfg.minPop, sizeCfg.maxPop);
  const knightCount = sizeCfg.knights;
  const civilianCount = Math.max(2, Math.floor(totalPop * 0.32));
  const maleVillagerCount = Math.max(3, totalPop - knightCount - civilianCount);

  // Spawn Ordinary Male Villagers with assigned jobs
  for (let i = 0; i < maleVillagerCount; i++) {
    const angle = (i / maleVillagerCount) * Math.PI * 2;
    const sx = s.x + Math.cos(angle) * 4.5 + 0.5;
    const sz = s.z + Math.sin(angle) * 4.5 + 0.5;
    try {
      const v = dim.spawnEntity("cb:human_villager", { x: sx, y: s.y, z: sz });
      const job = i % 5; // Farmer, Woodcutter, Miner, Blacksmith, Merchant
      v.setProperty("cb:role", ROLE_VILLAGER);
      v.setProperty("cb:job", job);
      v.setProperty("cb:skin", i % 6);
      v.addTag(`cb_settlement_${s.id}`);
      equipVillagerForJob(v, job);
    } catch (e) {}
  }

  // Spawn Trained Knights (Swordsman, Archer, Crossbowman, Spearman, Axeman/Vanguard) + Captain
  const knightRoles = [ROLE_SWORDSMAN, ROLE_ARCHER, ROLE_CROSSBOWMAN, ROLE_SPEARMAN, ROLE_SWORDSMAN];
  for (let k = 0; k < knightCount; k++) {
    const role = (k === 0 && sizeCfg.hasCaptain) ? ROLE_CAPTAIN : knightRoles[k % knightRoles.length];
    const spawnPos = (role === ROLE_ARCHER || role === ROLE_CROSSBOWMAN) && s.towers.length > 0
      ? s.towers[k % s.towers.length]
      : { x: s.x + ((k % 3) - 1) * 2.5 + 0.5, y: s.y, z: s.z + 3.5 };
    try {
      const kn = dim.spawnEntity("cb:human_villager", spawnPos);
      kn.addTag(`cb_settlement_${s.id}`);
      kn.setProperty("cb:skin", k % 6);
      promoteHumanToRole(kn, role, s);
    } catch (e) {}
  }

  // Spawn Women & Children Civilians near houses
  for (let c = 0; c < civilianCount; c++) {
    const h = s.houses.length > 0 ? s.houses[c % s.houses.length] : { x: s.x - 3, y: s.y, z: s.z + 3 };
    try {
      const civ = dim.spawnEntity("cb:human_civilian", { x: h.x + 0.5, y: h.y, z: h.z + 0.5 });
      civ.addTag(`cb_settlement_${s.id}`);
      civ.setProperty("cb:skin", c % 6);
      const isChild = c % 3 === 2;
      civ.triggerEvent(isChild ? "cb:set_child" : "cb:set_woman");
    } catch (e) {}
  }
}

// ============================================================================
// VANILLA WEAPON & SHIELD EQUIPMENT HELPERS
// ============================================================================
export function classifyVanillaWeapon(itemId) {
  if (!itemId) return WTYPE_NONE;
  const s = String(itemId);
  if (s === "minecraft:bow") return WTYPE_BOW;
  if (s === "minecraft:crossbow") return WTYPE_CROSSBOW;
  if (s === "minecraft:trident" || s.includes("_spear")) return WTYPE_SPEAR;
  if (s === "minecraft:mace") return WTYPE_MACE;
  if (s.includes("_axe")) return WTYPE_AXE;
  if (s.includes("_sword") || s === "cb:hell_scimitar") return WTYPE_SWORD;
  return WTYPE_NONE;
}

export function setEntitySlot(entity, slot, itemId) {
  if (!entity || !valid(entity)) return;
  try {
    const eq = entity.getComponent("minecraft:equippable");
    if (eq) {
      if (!itemId) {
        eq.setEquipment(slot, undefined);
      } else {
        eq.setEquipment(slot, new ItemStack(itemId, 1));
      }
    }
  } catch (e) {}
  // Reliable command fallback for mainhand / offhand so visual rendering is 100% guaranteed
  try {
    const slotCmdMap = {
      [EquipmentSlot.Mainhand]: "slot.weapon.mainhand",
      [EquipmentSlot.Offhand]: "slot.weapon.offhand",
      [EquipmentSlot.Head]: "slot.armor.head",
      [EquipmentSlot.Chest]: "slot.armor.chest",
      [EquipmentSlot.Legs]: "slot.armor.legs",
      [EquipmentSlot.Feet]: "slot.armor.feet"
    };
    const cmdSlot = slotCmdMap[slot];
    if (cmdSlot) {
      entity.runCommandAsync(`replaceitem entity @s ${cmdSlot} 0 ${itemId || "air"} 1`);
    }
  } catch (e) {}
}

export function getEntitySlotId(entity, slot) {
  try {
    const eq = entity.getComponent("minecraft:equippable");
    return eq?.getEquipment(slot)?.typeId;
  } catch (e) {
    return undefined;
  }
}

export function hasShieldEquipped(entity) {
  const off = getEntitySlotId(entity, EquipmentSlot.Offhand);
  if (off === "minecraft:shield") return true;
  const role = Number(entity.getProperty("cb:role") ?? 0);
  return role === ROLE_SWORDSMAN || role === ROLE_SPEARMAN || role === ROLE_CAPTAIN;
}

function equipVillagerForJob(v, job) {
  if (job === JOB_FARMER) {
    setEntitySlot(v, EquipmentSlot.Mainhand, "minecraft:iron_hoe");
  } else if (job === JOB_WOODCUTTER) {
    setEntitySlot(v, EquipmentSlot.Mainhand, "minecraft:iron_axe");
  } else if (job === JOB_MINER) {
    setEntitySlot(v, EquipmentSlot.Mainhand, "minecraft:iron_pickaxe");
  } else if (job === JOB_BLACKSMITH) {
    setEntitySlot(v, EquipmentSlot.Mainhand, "minecraft:iron_axe");
    setEntitySlot(v, EquipmentSlot.Chest, "minecraft:leather_chestplate");
  } else {
    setEntitySlot(v, EquipmentSlot.Mainhand, "minecraft:emerald");
  }
  try { v.setProperty("cb:weapon_type", WTYPE_NONE); } catch (e) {}
}

export function promoteHumanToRole(entity, role, settlement = null, customWeaponId = null) {
  if (!entity || !valid(entity)) return;
  const eventMap = {
    [ROLE_VILLAGER]: "cb:become_villager",
    [ROLE_MILITIA]: "cb:become_militia",
    [ROLE_SWORDSMAN]: "cb:become_swordsman",
    [ROLE_ARCHER]: "cb:become_archer",
    [ROLE_CROSSBOWMAN]: "cb:become_crossbowman",
    [ROLE_SPEARMAN]: "cb:become_spearman",
    [ROLE_CAPTAIN]: "cb:become_captain"
  };
  try {
    entity.triggerEvent(eventMap[role] || "cb:become_villager");
    entity.setProperty("cb:role", role);
  } catch (e) {}

  if (role === ROLE_MILITIA) {
    const militiaWeapons = ["minecraft:stone_sword", "minecraft:iron_axe", "minecraft:iron_sword", "minecraft:stone_axe"];
    let weapon = customWeaponId || militiaWeapons[Math.floor(Math.random() * militiaWeapons.length)];
    if (!customWeaponId && settlement && settlement.resources.weapons > 0) {
      settlement.resources.weapons--;
      weapon = Math.random() < 0.5 ? "minecraft:iron_sword" : "minecraft:iron_axe";
    }
    setEntitySlot(entity, EquipmentSlot.Mainhand, weapon);
    setEntitySlot(entity, EquipmentSlot.Offhand, "minecraft:shield");
    setEntitySlot(entity, EquipmentSlot.Chest, "minecraft:chainmail_chestplate");
    setEntitySlot(entity, EquipmentSlot.Head, "minecraft:leather_helmet");
    try { entity.setProperty("cb:weapon_type", classifyVanillaWeapon(weapon)); } catch (e) {}
  } else if (role === ROLE_SWORDSMAN) {
    const defaultWeap = customWeaponId || (Math.random() < 0.3 ? "minecraft:iron_axe" : Math.random() < 0.2 ? "minecraft:diamond_sword" : "minecraft:iron_sword");
    setEntitySlot(entity, EquipmentSlot.Mainhand, defaultWeap);
    setEntitySlot(entity, EquipmentSlot.Offhand, "minecraft:shield");
    setEntitySlot(entity, EquipmentSlot.Head, "minecraft:iron_helmet");
    setEntitySlot(entity, EquipmentSlot.Chest, "minecraft:iron_chestplate");
    setEntitySlot(entity, EquipmentSlot.Legs, "minecraft:iron_leggings");
    setEntitySlot(entity, EquipmentSlot.Feet, "minecraft:iron_boots");
    try { entity.setProperty("cb:weapon_type", classifyVanillaWeapon(defaultWeap)); } catch (e) {}
  } else if (role === ROLE_ARCHER) {
    setEntitySlot(entity, EquipmentSlot.Mainhand, "minecraft:bow");
    setEntitySlot(entity, EquipmentSlot.Offhand, null);
    setEntitySlot(entity, EquipmentSlot.Head, "minecraft:chainmail_helmet");
    setEntitySlot(entity, EquipmentSlot.Chest, "minecraft:chainmail_chestplate");
    setEntitySlot(entity, EquipmentSlot.Legs, "minecraft:leather_leggings");
    setEntitySlot(entity, EquipmentSlot.Feet, "minecraft:leather_boots");
    try { entity.setProperty("cb:weapon_type", WTYPE_BOW); } catch (e) {}
  } else if (role === ROLE_CROSSBOWMAN) {
    setEntitySlot(entity, EquipmentSlot.Mainhand, "minecraft:crossbow");
    setEntitySlot(entity, EquipmentSlot.Offhand, "minecraft:shield");
    setEntitySlot(entity, EquipmentSlot.Head, "minecraft:iron_helmet");
    setEntitySlot(entity, EquipmentSlot.Chest, "minecraft:chainmail_chestplate");
    setEntitySlot(entity, EquipmentSlot.Legs, "minecraft:iron_leggings");
    setEntitySlot(entity, EquipmentSlot.Feet, "minecraft:iron_boots");
    try { entity.setProperty("cb:weapon_type", WTYPE_CROSSBOW); } catch (e) {}
  } else if (role === ROLE_SPEARMAN) {
    const weap = customWeaponId || "minecraft:trident";
    setEntitySlot(entity, EquipmentSlot.Mainhand, weap);
    setEntitySlot(entity, EquipmentSlot.Offhand, "minecraft:shield");
    setEntitySlot(entity, EquipmentSlot.Head, "minecraft:iron_helmet");
    setEntitySlot(entity, EquipmentSlot.Chest, "minecraft:iron_chestplate");
    setEntitySlot(entity, EquipmentSlot.Legs, "minecraft:chainmail_leggings");
    setEntitySlot(entity, EquipmentSlot.Feet, "minecraft:iron_boots");
    try { entity.setProperty("cb:weapon_type", WTYPE_SPEAR); } catch (e) {}
  } else if (role === ROLE_CAPTAIN) {
    const weap = customWeaponId || "minecraft:diamond_sword";
    setEntitySlot(entity, EquipmentSlot.Mainhand, weap);
    setEntitySlot(entity, EquipmentSlot.Offhand, "minecraft:shield");
    setEntitySlot(entity, EquipmentSlot.Head, "minecraft:golden_helmet");
    setEntitySlot(entity, EquipmentSlot.Chest, "minecraft:iron_chestplate");
    setEntitySlot(entity, EquipmentSlot.Legs, "minecraft:iron_leggings");
    setEntitySlot(entity, EquipmentSlot.Feet, "minecraft:golden_boots");
    try { entity.setProperty("cb:weapon_type", classifyVanillaWeapon(weap)); } catch (e) {}
  } else if (role === ROLE_VILLAGER) {
    const job = Number(entity.getProperty("cb:job") ?? 0);
    setEntitySlot(entity, EquipmentSlot.Offhand, null);
    setEntitySlot(entity, EquipmentSlot.Head, null);
    setEntitySlot(entity, EquipmentSlot.Chest, null);
    setEntitySlot(entity, EquipmentSlot.Legs, null);
    setEntitySlot(entity, EquipmentSlot.Feet, null);
    try { entity.setProperty("cb:blocking", false); } catch (e) {}
    equipVillagerForJob(entity, job);
  }
}

/**
 * Equips any vanilla weapon given by player and updates role/weapon_type accordingly
 */
export function giveWeaponOrArmorToHuman(player, human, itemStack) {
  if (!human || !valid(human) || !itemStack) return false;
  const itemId = itemStack.typeId;
  const wType = classifyVanillaWeapon(itemId);
  const s = getNearestSettlement(human.location, 64);

  if (wType !== WTYPE_NONE) {
    const roleMap = {
      [WTYPE_SWORD]: ROLE_SWORDSMAN,
      [WTYPE_AXE]: ROLE_SWORDSMAN,
      [WTYPE_MACE]: ROLE_SWORDSMAN,
      [WTYPE_SPEAR]: ROLE_SPEARMAN,
      [WTYPE_BOW]: ROLE_ARCHER,
      [WTYPE_CROSSBOW]: ROLE_CROSSBOWMAN
    };
    const curRole = Number(human.getProperty("cb:role") ?? 0);
    const targetRole = curRole === ROLE_CAPTAIN ? ROLE_CAPTAIN : (roleMap[wType] || ROLE_SWORDSMAN);
    promoteHumanToRole(human, targetRole, s, itemId);
    sound(human.dimension, "armor.equip_iron", human.location, 1.2, 1.1);
    fx(human.dimension, "minecraft:villager_happy", { x: human.location.x, y: human.location.y + 1.5, z: human.location.z });
    return true;
  }

  if (itemId === "minecraft:shield") {
    setEntitySlot(human, EquipmentSlot.Offhand, "minecraft:shield");
    sound(human.dimension, "armor.equip_iron", human.location, 1.2, 1.0);
    fx(human.dimension, "minecraft:villager_happy", { x: human.location.x, y: human.location.y + 1.5, z: human.location.z });
    return true;
  }

  for (const entry of ARMOR_SLOT_MAP) {
    if (entry.test.test(itemId)) {
      setEntitySlot(human, entry.slot, itemId);
      sound(human.dimension, "armor.equip_diamond", human.location, 1.2, 1.1);
      fx(human.dimension, "minecraft:villager_happy", { x: human.location.x, y: human.location.y + 1.5, z: human.location.z });
      return true;
    }
  }
  return false;
}

// ============================================================================
// BELL & EMERGENCY SYSTEM
// ============================================================================
export function triggerSettlementAlarm(dim, settlement, reason = "Враги у ворот!") {
  if (!settlement) return;
  const now = system.currentTick;
  const wasActive = settlement.alarmActive && now < settlement.alarmUntilTick;
  settlement.alarmActive = true;
  settlement.alarmUntilTick = now + 900;
  settlement.currentCommand = CMD_GATHER_BELL;

  try {
    dim.runCommandAsync(`playsound block.bell.hit @a ${settlement.x} ${settlement.y} ${settlement.z} 3.0 0.9`);
    dim.runCommandAsync(`particle minecraft:villager_angry ${settlement.x} ${settlement.y + 3} ${settlement.z}`);
  } catch (e) {}

  if (!wasActive) {
    try {
      const players = dim.getPlayers({ location: { x: settlement.x, y: settlement.y, z: settlement.z }, maxDistance: 72 });
      for (const p of players) {
        p.onScreenDisplay.setActionBar(`§c🔔 Тревога в поселении: ${reason}`);
      }
    } catch (e) {}
  }

  const humans = dim.getEntities({
    location: { x: settlement.x, y: settlement.y, z: settlement.z },
    maxDistance: settlement.radius + 16,
    families: ["human_faction"]
  });

  for (const h of humans) {
    if (!valid(h)) continue;
    try { h.setProperty("cb:alarm", 1); } catch (e) {}
    if (h.typeId === "cb:human_villager") {
      const isHired = Boolean(h.getProperty("cb:hired"));
      if (isHired) continue;
      const role = Number(h.getProperty("cb:role") ?? 0);
      if (role === ROLE_VILLAGER) {
        promoteHumanToRole(h, ROLE_MILITIA, settlement);
      } else if (role === ROLE_CAPTAIN) {
        safePlayAnim(h, "animation.cb_human.command_horn");
      }
    } else if (h.typeId === "cb:human_civilian") {
      safePlayAnim(h, "animation.cb_human.panic_indoors");
    }
  }
  saveSettlements();
}

function endSettlementAlarm(dim, settlement) {
  settlement.alarmActive = false;
  settlement.currentCommand = CMD_RETURN_DUTY;
  try {
    dim.runCommandAsync(`playsound random.levelup @a ${settlement.x} ${settlement.y} ${settlement.z} 1.2 1.2`);
  } catch (e) {}

  const humans = dim.getEntities({
    location: { x: settlement.x, y: settlement.y, z: settlement.z },
    maxDistance: settlement.radius + 20,
    families: ["human_faction"]
  });

  for (const h of humans) {
    if (!valid(h)) continue;
    try {
      h.setProperty("cb:alarm", 0);
      h.setProperty("cb:blocking", false);
    } catch (e) {}
    if (h.typeId === "cb:human_villager") {
      const isHired = Boolean(h.getProperty("cb:hired"));
      if (isHired) continue;
      const role = Number(h.getProperty("cb:role") ?? 0);
      if (role === ROLE_MILITIA) {
        settlement.resources.weapons = Math.min(24, (settlement.resources.weapons || 0) + 1);
        promoteHumanToRole(h, ROLE_VILLAGER, settlement);
      }
    }
  }
  saveSettlements();
}

// ============================================================================
// SMOOTH WALKING & COMBAT HELPERS (NO TELEPORTING EXCEPT LONG OWNER LEASH)
// ============================================================================
function walkToward(entity, targetPos, speed = 0.22) {
  if (!entity || !valid(entity) || !targetPos) return 999;
  const loc = entity.location;
  const dx = targetPos.x - loc.x;
  const dz = targetPos.z - loc.z;
  const d = Math.hypot(dx, dz);
  if (d < 1.35) return d;
  const nx = dx / d;
  const nz = dz / d;
  const yaw = Math.atan2(-nx, nz) * (180 / Math.PI);
  try {
    entity.setRotation({ x: 0, y: yaw });
    const vel = entity.getVelocity();
    entity.clearVelocity();
    entity.applyImpulse({
      x: nx * speed,
      y: vel.y < 0.02 && Math.random() < 0.18 ? 0.20 : 0,
      z: nz * speed
    });
  } catch (e) {}
  return d;
}

function faceTarget(entity, targetPos) {
  if (!entity || !valid(entity) || !targetPos) return;
  const dx = targetPos.x - entity.location.x;
  const dz = targetPos.z - entity.location.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.05) return;
  const yaw = Math.atan2(-(dx / d), dz / d) * (180 / Math.PI);
  try { entity.setRotation({ x: 0, y: yaw }); } catch (e) {}
}

function isEntityHostileToHuman(human, e) {
  if (!e || !valid(e) || !alive(e) || e.id === human.id) return false;
  if (e.typeId === "minecraft:player" || e.typeId.startsWith("cb:human_")) return false;
  const ownerId = (() => { try { return human.getDynamicProperty("cb:owner_id"); } catch { return undefined; } })();
  if (ownerId) {
    try {
      if (e.getDynamicProperty("cb:owner_id") === ownerId) return false;
    } catch {}
  }
  const tf = e.getComponent("minecraft:type_family");
  if (!tf) return false;
  for (const fam of HOSTILE_FAMILIES) {
    if (tf.hasTypeFamily(fam)) return true;
  }
  return false;
}

function findNearestHostile(dim, center, radius, refHuman = null) {
  let nearest = null;
  let bestD = radius;
  let candidates = [];
  try {
    candidates = dim.getEntities({ location: center, maxDistance: radius });
  } catch (e) {
    return null;
  }
  for (const e of candidates) {
    if (!e || !valid(e) || !alive(e)) continue;
    if (e.typeId === "minecraft:player" || e.typeId.startsWith("cb:human_")) continue;
    if (refHuman && !isEntityHostileToHuman(refHuman, e)) continue;
    if (!refHuman) {
      const tf = e.getComponent("minecraft:type_family");
      if (!tf || !HOSTILE_FAMILIES.some((fam) => tf.hasTypeFamily(fam))) continue;
    }
    const d = dist3(center, e.location);
    if (d < bestD) {
      bestD = d;
      nearest = e;
    }
  }
  return nearest;
}

/**
 * Executes Human Combat AI for any weapon (Sword, Axe, Spear/Trident, Bow, Crossbow, Mace) + Player-Like Shield Blocking
 */
function executeHumanCombatTick(h, foe, now, diff, allowAdvance = true) {
  const dim = h.dimension;
  const st = getCombatState(h.id);
  const role = Number(h.getProperty("cb:role") ?? 0);
  const heldId = getEntitySlotId(h, EquipmentSlot.Mainhand) || "";
  const wType = classifyVanillaWeapon(heldId) || Number(h.getProperty("cb:weapon_type") ?? 0) || (
    role === ROLE_ARCHER ? WTYPE_BOW :
    role === ROLE_CROSSBOWMAN ? WTYPE_CROSSBOW :
    role === ROLE_SPEARMAN ? WTYPE_SPEAR : WTYPE_SWORD
  );
  const canUseShield = hasShieldEquipped(h) && now >= st.shieldDisabledUntil && wType !== WTYPE_BOW;
  const d = dist3(h.location, foe.location);

  faceTarget(h, foe.location);

  // 1. RANGED COMBAT: BOW & CROSSBOW
  if (wType === WTYPE_BOW || wType === WTYPE_CROSSBOW) {
    try { h.setProperty("cb:blocking", false); } catch (e) {}
    if (d < 4.5 && allowAdvance) {
      // Kiting back slightly when enemy is too close
      const dx = h.location.x - foe.location.x;
      const dz = h.location.z - foe.location.z;
      const l = Math.max(0.1, Math.hypot(dx, dz));
      try { h.applyImpulse({ x: (dx / l) * 0.16, y: 0.04, z: (dz / l) * 0.16 }); } catch (e) {}
    } else if (d > 22.0 && allowAdvance) {
      walkToward(h, foe.location, 0.24);
    }

    const shotCd = wType === WTYPE_CROSSBOW ? 34 : 26;
    if (d <= 28.0 && now - st.lastShotTick >= shotCd) {
      st.lastShotTick = now;
      safePlayAnim(h, wType === WTYPE_CROSSBOW ? "animation.cb_human.crossbow_aim" : "animation.cb_human.bow_aim");
      try {
        const dx = foe.location.x - h.location.x;
        const dy = (foe.location.y + 1.0) - (h.location.y + 1.55);
        const dz = foe.location.z - h.location.z;
        const len = Math.max(0.1, Math.hypot(dx, dy, dz));
        const arrow = dim.spawnEntity("minecraft:arrow", {
          x: h.location.x + (dx / len) * 1.15,
          y: h.location.y + 1.6,
          z: h.location.z + (dz / len) * 1.15
        });
        const speed = wType === WTYPE_CROSSBOW ? 2.15 : 1.70;
        const arc = wType === WTYPE_CROSSBOW ? 0.04 : 0.09 + (len * 0.004);
        arrow.applyImpulse({
          x: (dx / len) * speed,
          y: (dy / len) * speed + arc,
          z: (dz / len) * speed
        });
        sound(dim, wType === WTYPE_CROSSBOW ? "crossbow.shoot" : "random.bow", h.location, 1.2, wType === WTYPE_CROSSBOW ? 0.95 : 1.1);
      } catch (e) {}
    }
    return;
  }

  // 2. SPEAR & TRIDENT COMBAT (Extended 4.5-block reach + Ranged Spear Throw at 6.5..17 blocks!)
  if (wType === WTYPE_SPEAR) {
    if (d >= 6.5 && d <= 17.0 && now - st.lastSpearThrowTick >= 70) {
      st.lastSpearThrowTick = now;
      try { h.setProperty("cb:blocking", false); } catch (e) {}
      safePlayAnim(h, "animation.cb_human.spear_thrust");
      try {
        const dx = foe.location.x - h.location.x;
        const dy = (foe.location.y + 1.0) - (h.location.y + 1.55);
        const dz = foe.location.z - h.location.z;
        const len = Math.max(0.1, Math.hypot(dx, dy, dz));
        const proj = dim.spawnEntity("minecraft:arrow", {
          x: h.location.x + (dx / len) * 1.2,
          y: h.location.y + 1.6,
          z: h.location.z + (dz / len) * 1.2
        });
        proj.applyImpulse({ x: (dx / len) * 1.9, y: (dy / len) * 1.9 + 0.07, z: (dz / len) * 1.9 });
        sound(dim, "item.trident.throw", h.location, 1.3, 1.0);
      } catch (e) {}
      return;
    }

    if (d <= 4.6 && now - st.lastSlashTick >= 20) {
      st.lastSlashTick = now;
      try { h.setProperty("cb:blocking", false); } catch (e) {}
      safePlayAnim(h, "animation.cb_human.spear_thrust");
      const baseDmg = WEAPON_BASE_DMG[heldId] ?? 7;
      try {
        foe.applyDamage(Math.round(baseDmg * diff.dmg), { cause: EntityDamageCause.entityAttack, damagingEntity: h });
        const dx = foe.location.x - h.location.x;
        const dz = foe.location.z - h.location.z;
        const l = Math.max(0.1, Math.hypot(dx, dz));
        foe.applyKnockback(dx / l, dz / l, 1.45, 0.30);
        sound(dim, "item.trident.hit", foe.location, 1.1, 1.05);
      } catch (e) {}
      return;
    }
  }

  // 3. PLAYER-LIKE SHIELD BLOCKING & TACTICAL ADVANCE (Swords, Axes, Spears, Maces)
  // Raise shield when closing distance (2.8..12 blocks) or between melee swings!
  const shouldRaiseShield = canUseShield && (
    (d >= 2.6 && d <= 12.0) ||
    (d < 2.6 && (now - st.lastSlashTick) < 12)
  );
  try {
    if (Boolean(h.getProperty("cb:blocking")) !== shouldRaiseShield) {
      h.setProperty("cb:blocking", shouldRaiseShield);
    }
  } catch (e) {}

  if (d > 2.8 && allowAdvance) {
    walkToward(h, foe.location, shouldRaiseShield ? 0.21 : 0.26);
  }

  // 4. MELEE STRIKE (Sword / Axe / Mace)
  if (d <= 3.3 && now - st.lastSlashTick >= 18) {
    st.lastSlashTick = now;
    try { h.setProperty("cb:blocking", false); } catch (e) {}
    safePlayAnim(h, "animation.cb_human.attack");
    const baseDmg = WEAPON_BASE_DMG[heldId] ?? (role === ROLE_CAPTAIN ? 7 : 6);
    try {
      foe.applyDamage(Math.round(baseDmg * diff.dmg), { cause: EntityDamageCause.entityAttack, damagingEntity: h });
      const dx = foe.location.x - h.location.x;
      const dz = foe.location.z - h.location.z;
      const l = Math.max(0.1, Math.hypot(dx, dz));
      const kb = wType === WTYPE_MACE ? 1.7 : wType === WTYPE_AXE ? 1.25 : 0.9;
      foe.applyKnockback(dx / l, dz / l, kb, 0.26);
      if (wType === WTYPE_MACE) {
        fx(dim, "minecraft:large_explosion", { x: foe.location.x, y: foe.location.y + 0.3, z: foe.location.z });
        sound(dim, "random.anvil_land", foe.location, 1.1, 0.9);
      }
    } catch (e) {}
  }
}

// ============================================================================
// MAIN AI LOOP: HIRED WARRIORS, SETTLEMENT LIFE, ECONOMY & COMBAT FORMATIONS
// ============================================================================
system.runInterval(() => {
  loadSettlements();
  const now = system.currentTick;
  const timeOfDay = world.getTimeOfDay();
  const isNight = timeOfDay >= 13000 && timeOfDay <= 23000;
  const diff = getDifficultyScale();

  // A. PROCESS HIRED MERCENARIES / WARRIORS ACROSS ALL DIMENSIONS
  for (const dimId of ["overworld", "nether", "the_end"]) {
    let dim;
    try { dim = world.getDimension(dimId); } catch (e) { continue; }
    let hiredList = [];
    try { hiredList = dim.getEntities({ type: "cb:human_villager", tags: ["cb_hired_warrior"] }); } catch (e) { continue; }

    for (const w of hiredList) {
      if (!valid(w) || !alive(w)) continue;
      const ownerId = (() => { try { return w.getDynamicProperty("cb:owner_id"); } catch { return undefined; } })();
      const owner = ownerId ? world.getEntity(ownerId) : null;
      const stance = Number(w.getProperty("cb:stance") ?? STANCE_FOLLOW);

      // Passive regeneration for hired warriors out of combat
      if (now % 100 === 0) {
        const hp = healthOf(w);
        if (hp && hp.currentValue < hp.effectiveMax) {
          try { hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + 1)); } catch (e) {}
        }
      }

      // Find enemy: either owner's target, attacker of owner, or nearest hostile monster/orc/boss
      const st = getCombatState(w.id);
      let foe = st.targetId ? world.getEntity(st.targetId) : null;
      if (!foe || !valid(foe) || !alive(foe) || dist3(w.location, foe.location) > 28) {
        st.targetId = undefined;
        foe = findNearestHostile(dim, w.location, stance === STANCE_GUARD ? 16 : 22, w);
      }

      if (foe && valid(foe) && alive(foe)) {
        executeHumanCombatTick(w, foe, now, diff, stance !== STANCE_GUARD || dist2(w.location, foe.location) <= 8.0);
        continue;
      }

      // Out of combat: clear shield block pose
      try { if (w.getProperty("cb:blocking")) w.setProperty("cb:blocking", false); } catch (e) {}

      if (stance === STANCE_FOLLOW && owner && valid(owner) && alive(owner) && owner.dimension.id === dim.id) {
        const dOwner = dist3(w.location, owner.location);
        if (dOwner > 28) {
          try {
            w.teleport({ x: owner.location.x + 1.5, y: owner.location.y, z: owner.location.z + 1.5 }, { keepVelocity: false });
          } catch (e) {}
        } else if (dOwner > 4.2) {
          walkToward(w, owner.location, dOwner > 10 ? 0.27 : 0.22);
        }
      } else if (stance === STANCE_GUARD) {
        const gx = w.getDynamicProperty("cb:guard_x");
        const gz = w.getDynamicProperty("cb:guard_z");
        if (typeof gx === "number" && typeof gz === "number") {
          if (Math.hypot(w.location.x - gx, w.location.z - gz) > 2.5) {
            walkToward(w, { x: gx, y: w.location.y, z: gz }, 0.20);
          }
        }
      }
    }
  }

  // B. PROCESS SETTLEMENTS
  for (const s of settlements) {
    let dim;
    try {
      dim = world.getDimension(s.dimensionId || "minecraft:overworld");
    } catch (e) {
      continue;
    }
    const center = { x: s.x, y: s.y, z: s.z };
    const playersNear = dim.getPlayers({ location: center, maxDistance: 104 });
    if (playersNear.length === 0) continue;

    const hostile = findNearestHostile(dim, center, s.radius + 8);
    if (hostile) {
      triggerSettlementAlarm(dim, s, "Враги вторглись в периметр поселения!");
    } else if (s.alarmActive && now >= s.alarmUntilTick) {
      endSettlementAlarm(dim, s);
    }

    const inhabitants = dim.getEntities({
      location: center,
      maxDistance: s.radius + 20,
      families: ["human_faction"]
    });

    let activeCaptain = null;
    const knights = [];
    const ordinaryVillagers = [];

    for (const ent of inhabitants) {
      if (!valid(ent) || !alive(ent)) continue;
      if (ent.typeId === "cb:human_villager" && !ent.hasTag("cb_hired_warrior")) {
        const r = Number(ent.getProperty("cb:role") ?? 0);
        if (r === ROLE_CAPTAIN) activeCaptain = ent;
        if (r >= ROLE_SWORDSMAN && r <= ROLE_CAPTAIN) knights.push(ent);
        if (r === ROLE_VILLAGER) ordinaryVillagers.push(ent);
      }
    }

    if (s.alarmActive) {
      if (!activeCaptain && knights.length > 0 && now > s.commanderDeadUntilTick) {
        s.currentCommand = hostile && dist2(hostile.location, center) < s.radius * 0.55
          ? CMD_PROTECT_CIVILIANS
          : hostile
            ? CMD_ATTACK_HOSTILES
            : CMD_DEFEND_GATE;
      } else if (activeCaptain) {
        const dHostile = hostile ? dist2(hostile.location, center) : 999;
        if (dHostile < 12) {
          s.currentCommand = CMD_PROTECT_CIVILIANS;
        } else if (dHostile < s.radius) {
          s.currentCommand = CMD_ATTACK_HOSTILES;
        } else {
          s.currentCommand = CMD_DEFEND_GATE;
        }
        if (now % 100 === 0) {
          safePlayAnim(activeCaptain, "animation.cb_human.command_horn");
          try {
            dim.runCommandAsync(`particle minecraft:villager_happy ${activeCaptain.location.x} ${activeCaptain.location.y + 2.2} ${activeCaptain.location.z}`);
          } catch (e) {}
        }
      }
    }

    // Automatic Knight Training at Blacksmith/Training Post during peacetime
    if (!s.alarmActive && !isNight && now % 240 === 0 && ordinaryVillagers.length > 3 && knights.length < 7) {
      if ((s.resources.iron || 0) >= 3 && (s.resources.weapons || 0) >= 1) {
        const trainee = ordinaryVillagers[0];
        s.resources.iron -= 3;
        s.resources.weapons -= 1;
        const nextRoles = [ROLE_SWORDSMAN, ROLE_ARCHER, ROLE_SPEARMAN, ROLE_CROSSBOWMAN];
        const newRole = (!activeCaptain && knights.length >= 2) ? ROLE_CAPTAIN : nextRoles[knights.length % nextRoles.length];
        promoteHumanToRole(trainee, newRole, s);
        safePlayAnim(trainee, "animation.cb_human.command_horn");
        try {
          dim.runCommandAsync(`particle minecraft:totem_particle ${trainee.location.x} ${trainee.location.y + 1} ${trainee.location.z}`);
          dim.runCommandAsync(`playsound random.anvil_use @a ${trainee.location.x} ${trainee.location.y} ${trainee.location.z} 1.0 1.1`);
        } catch (e) {}
      }
    }

    const disarray = now < s.commanderDeadUntilTick;
    const lowFoodFactor = (s.resources.food || 0) <= 2 ? 0.65 : 1.0;

    for (let idx = 0; idx < inhabitants.length; idx++) {
      const h = inhabitants[idx];
      if (!h || !valid(h) || !alive(h) || h.hasTag("cb_hired_warrior")) continue;

      if (!s.alarmActive && now % 100 === 0 && (s.resources.food || 0) > 2) {
        try {
          const hp = h.getComponent("minecraft:health");
          if (hp && hp.currentValue < hp.effectiveMax) {
            hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + 2));
            if (Math.random() < 0.25) s.resources.food = Math.max(0, s.resources.food - 1);
          }
        } catch (e) {}
      }

      // A. WOMEN & CHILDREN CIVILIANS
      if (h.typeId === "cb:human_civilian") {
        if (s.alarmActive || isNight) {
          const house = s.houses.length > 0 ? s.houses[idx % s.houses.length] : s.wellPos;
          const d = walkToward(h, house, s.alarmActive ? 0.27 : 0.20);
          if (d < 2.2 && s.alarmActive && now % 60 === 0) {
            safePlayAnim(h, "animation.cb_human.panic_indoors");
          }
        } else {
          const target = (idx % 2 === 0) ? s.wellPos : s.farmPos;
          if (dist2(h.location, target) > 5.0) {
            walkToward(h, target, 0.16 * lowFoodFactor);
          } else if (now % 80 === 0) {
            safePlayAnim(h, "animation.cb_human.work");
          }
        }
        continue;
      }

      // B. SETTLEMENT VILLAGERS, MILITIA & KNIGHTS
      const role = Number(h.getProperty("cb:role") ?? 0);
      const job = Number(h.getProperty("cb:job") ?? 0);

      const localFoe = hostile || findNearestHostile(dim, h.location, 20, h);
      if (s.alarmActive || localFoe) {
        if (localFoe) {
          // Archers & Crossbowmen prefer shooting from towers if near one
          if ((role === ROLE_ARCHER || role === ROLE_CROSSBOWMAN) && s.towers.length > 0) {
            const tower = s.towers[idx % s.towers.length];
            if (dist2(h.location, tower) > 4.0 && dist3(h.location, localFoe.location) > 10.0 && !disarray) {
              walkToward(h, tower, 0.25);
            }
          }
          executeHumanCombatTick(h, localFoe, now, diff, !disarray);
        } else if (!disarray) {
          const post = s.currentCommand === CMD_PROTECT_CIVILIANS && s.houses.length > 0
            ? s.houses[idx % s.houses.length]
            : s.currentCommand === CMD_DEFEND_GATE && s.gates.length > 0
              ? s.gates[idx % s.gates.length]
              : s.bellPos;
          walkToward(h, post, 0.23);
        }
        continue;
      }

      try { if (h.getProperty("cb:blocking")) h.setProperty("cb:blocking", false); } catch (e) {}

      if (isNight) {
        if (role === ROLE_VILLAGER) {
          const house = s.houses.length > 0 ? s.houses[idx % s.houses.length] : s.wellPos;
          walkToward(h, house, 0.19);
        } else {
          const post = (role === ROLE_ARCHER || role === ROLE_CROSSBOWMAN) && s.towers.length > 0
            ? s.towers[idx % s.towers.length]
            : s.gates[idx % s.gates.length];
          walkToward(h, post, 0.18);
        }
        continue;
      }

      // Daytime Routine for Ordinary Male Villagers
      if (role === ROLE_VILLAGER) {
        const workPhase = Math.floor((now / 120) + idx) % 3;
        if (workPhase < 2) {
          const station = job === JOB_FARMER
            ? s.farmPos
            : job === JOB_BLACKSMITH
              ? s.blacksmithWorkPos
              : job === JOB_WOODCUTTER
                ? { x: s.x - s.radius + 10, y: s.y, z: s.z + 5 }
                : job === JOB_MINER
                  ? { x: s.x + s.radius - 10, y: s.y, z: s.z - 5 }
                  : s.wellPos;

          const d = walkToward(h, station, 0.19 * lowFoodFactor);
          if (d < 2.8) {
            safePlayAnim(h, "animation.cb_human.work");
            if (now % 160 === 0) {
              if (job === JOB_FARMER && s.resources.food < 64) {
                s.resources.food += 2;
                populateChestWithItems(dim, s.granaryChestPos, [["minecraft:bread", 1]]);
              } else if (job === JOB_WOODCUTTER && s.resources.wood < 64) {
                s.resources.wood += 2;
                populateChestWithItems(dim, s.warehouseChestPos, [["minecraft:oak_log", 1]]);
              } else if (job === JOB_MINER && s.resources.stone < 64) {
                s.resources.stone += 2;
                if (Math.random() < 0.45 && s.resources.iron < 32) {
                  s.resources.iron += 1;
                  populateChestWithItems(dim, s.warehouseChestPos, [["minecraft:iron_ingot", 1]]);
                }
              } else if (job === JOB_BLACKSMITH) {
                if (s.resources.iron >= 2 && s.resources.wood >= 1 && s.resources.weapons < 18) {
                  s.resources.iron -= 2;
                  s.resources.wood -= 1;
                  s.resources.weapons += 1;
                  const forged = ["minecraft:iron_sword", "minecraft:iron_axe", "minecraft:crossbow", "minecraft:bow", "minecraft:trident"][Math.floor(Math.random() * 5)];
                  populateChestWithItems(dim, s.armoryChestPos, [[forged, 1]]);
                  try {
                    dim.runCommandAsync(`playsound random.anvil_use @a ${h.location.x} ${h.location.y} ${h.location.z} 0.7 1.0`);
                  } catch (e) {}
                } else if (s.resources.iron >= 3 && s.resources.armor < 14) {
                  s.resources.iron -= 3;
                  s.resources.armor += 1;
                  populateChestWithItems(dim, s.armoryChestPos, [["minecraft:iron_chestplate", 1]]);
                }
              }
            }
          }
        } else {
          const dest = job === JOB_FARMER
            ? s.granaryChestPos
            : job === JOB_BLACKSMITH
              ? s.armoryChestPos
              : idx % 2 === 0
                ? s.warehouseChestPos
                : s.wellPos;
          const d = walkToward(h, dest, 0.18 * lowFoodFactor);
          if (d < 2.5 && now % 120 === 0) {
            safePlayAnim(h, "animation.cb_human.work");
          }
        }
      } else {
        const patrolTarget = (role === ROLE_ARCHER || role === ROLE_CROSSBOWMAN) && s.towers.length > 0
          ? s.towers[idx % s.towers.length]
          : (now % 400 < 200)
            ? s.trainingPos
            : s.gates[idx % s.gates.length];
        const d = walkToward(h, patrolTarget, 0.19);
        if (d < 2.2 && patrolTarget === s.trainingPos && now % 80 === 0) {
          safePlayAnim(h, "animation.cb_human.attack");
        }
      }
    }
  }

  // C. WILD / STANDALONE HUMANS OUTSIDE SETTLEMENTS (Natural Spawns)
  for (const dimId of ["overworld"]) {
    let dim;
    try { dim = world.getDimension(dimId); } catch (e) { continue; }
    let allHumans = [];
    try { allHumans = dim.getEntities({ type: "cb:human_villager" }); } catch (e) { continue; }
    for (const h of allHumans) {
      if (!valid(h) || !alive(h) || h.hasTag("cb_hired_warrior")) continue;
      // Initialize newly spawned natural humans with varied roles and weapons!
      if (!h.hasTag("cb_human_init")) {
        h.addTag("cb_human_init");
        const nearS = getNearestSettlement(h.location, 64);
        if (!nearS) {
          const roll = Math.random();
          const role = roll < 0.30 ? ROLE_SWORDSMAN
            : roll < 0.50 ? ROLE_ARCHER
            : roll < 0.68 ? ROLE_CROSSBOWMAN
            : roll < 0.85 ? ROLE_SPEARMAN
            : ROLE_VILLAGER;
          promoteHumanToRole(h, role, null);
        }
      }
      const nearS = getNearestSettlement(h.location, 64);
      if (nearS) continue; // Handled by settlement loop above
      const foe = findNearestHostile(dim, h.location, 20, h);
      if (foe) {
        executeHumanCombatTick(h, foe, now, diff, true);
      } else {
        try { if (h.getProperty("cb:blocking")) h.setProperty("cb:blocking", false); } catch (e) {}
      }
    }
  }
}, 10);

// ============================================================================
// PLAYER-LIKE SHIELD BLOCKING & COMBAT HOOKS
// ============================================================================
try {
  world.afterEvents.entityHurt.subscribe((ev) => {
    const hurt = ev.hurtEntity;
    const attacker = ev.damageSource?.damagingEntity;
    const cause = ev.damageSource?.cause;
    const dmg = ev.damage ?? 0;
    if (!hurt || !valid(hurt)) return;
    const now = system.currentTick;

    // 1. If a player or hired warrior's owner is attacked or attacks, command hired warriors to defend!
    if (isPlayer(hurt) && attacker && valid(attacker) && alive(attacker)) {
      const guards = hurt.dimension.getEntities({ type: "cb:human_villager", location: hurt.location, maxDistance: 28, tags: ["cb_hired_warrior"] });
      for (const g of guards) {
        if (g.getDynamicProperty("cb:owner_id") === hurt.id) {
          getCombatState(g.id).targetId = attacker.id;
        }
      }
    }
    if (attacker && isPlayer(attacker) && hurt.typeId !== "cb:human_villager" && hurt.typeId !== "cb:human_civilian") {
      const guards = attacker.dimension.getEntities({ type: "cb:human_villager", location: attacker.location, maxDistance: 28, tags: ["cb_hired_warrior"] });
      for (const g of guards) {
        if (g.getDynamicProperty("cb:owner_id") === attacker.id) {
          getCombatState(g.id).targetId = hurt.id;
        }
      }
    }

    // 2. Human Villager / Warrior Shield Blocking (works just like a Player's Shield!)
    if (hurt.typeId === "cb:human_villager" && alive(hurt)) {
      const st = getCombatState(hurt.id);
      if (attacker && attacker.typeId !== "minecraft:player") {
        st.targetId = attacker.id;
        const s = getNearestSettlement(hurt.location, 64);
        if (s) triggerSettlementAlarm(hurt.dimension, s, "Жители атакованы врагами!");
      }

      const canBlock = hasShieldEquipped(hurt) && now >= st.shieldDisabledUntil;
      if (canBlock && dmg > 0 && attacker && valid(attacker)) {
        // Check if attacker is using an Axe (disables shield for 5s like a player!)
        const attackerWeapon = getEntitySlotId(attacker, EquipmentSlot.Mainhand) || "";
        const isAxeHit = attackerWeapon.includes("_axe") || attacker.typeId === "cb:minotaur" || attacker.typeId === "cb:cyclops";

        // Activate shield pose immediately on incoming attack
        try { hurt.setProperty("cb:blocking", true); } catch (e) {}

        if (isAxeHit) {
          st.shieldDisabledUntil = now + 100; // 5 seconds shield cooldown
          try { hurt.setProperty("cb:blocking", false); } catch (e) {}
          sound(hurt.dimension, "random.break", hurt.location, 1.3, 0.9);
          fx(hurt.dimension, "minecraft:crit_emitter", { x: hurt.location.x, y: hurt.location.y + 1.2, z: hurt.location.z });
          // Still blocks 50% of the axe blow that disabled the shield
          const hp = healthOf(hurt);
          if (hp) {
            try { hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + Math.ceil(dmg * 0.5))); } catch (e) {}
          }
        } else {
          // Block 100% of projectiles or 85% of melee damage!
          const isProj = cause === EntityDamageCause.projectile;
          const refund = isProj ? dmg : Math.ceil(dmg * 0.85);
          const hp = healthOf(hurt);
          if (hp && refund > 0) {
            try { hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + refund)); } catch (e) {}
          }
          sound(hurt.dimension, "item.shield.block", hurt.location, 1.3, 1.0 + Math.random() * 0.15);
          safePlayAnim(hurt, "animation.cb_human.shield_bash");
          // Recoil knockback on melee attacker when hitting raised shield!
          if (!isProj && dist3(hurt.location, attacker.location) <= 4.0) {
            const dx = attacker.location.x - hurt.location.x;
            const dz = attacker.location.z - hurt.location.z;
            const l = Math.max(0.1, Math.hypot(dx, dz));
            try { attacker.applyKnockback(dx / l, dz / l, 1.15, 0.25); } catch (e) {}
          }
        }
      }
    }
  });
} catch (e) {}

// ============================================================================
// INTERACTIVE TRADING & WARRIOR HIRING SYSTEM (UI FORMS + ITEM INTERACTIONS)
// ============================================================================
function countItemInPlayerInventory(player, itemId) {
  let total = 0;
  try {
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv) return 0;
    for (let i = 0; i < inv.size; i++) {
      const it = inv.getItem(i);
      if (it && it.typeId === itemId) total += it.amount;
    }
  } catch (e) {}
  return total;
}

function consumeItemFromPlayer(player, itemId, count) {
  if (!inSurvival(player)) return true;
  if (countItemInPlayerInventory(player, itemId) < count) return false;
  let rem = count;
  try {
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv) return false;
    for (let i = 0; i < inv.size && rem > 0; i++) {
      const it = inv.getItem(i);
      if (!it || it.typeId !== itemId) continue;
      if (it.amount > rem) {
        it.amount -= rem;
        inv.setItem(i, it);
        rem = 0;
      } else {
        rem -= it.amount;
        inv.setItem(i, undefined);
      }
    }
  } catch (e) {
    return false;
  }
  return rem === 0;
}

function giveItemToPlayer(player, itemId, amount = 1) {
  try {
    const stack = new ItemStack(itemId, amount);
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (inv) {
      const leftover = inv.addItem(stack);
      if (leftover) {
        player.dimension.spawnItem(leftover, player.location);
      }
    } else {
      player.dimension.spawnItem(stack, player.location);
    }
  } catch (e) {}
}

export function hireHumanWarrior(player, target, chosenRole = null) {
  if (!player || !target || !valid(target)) return;
  const s = getNearestSettlement(target.location, 64);
  const curRole = Number(target.getProperty("cb:role") ?? 0);
  const finalRole = chosenRole !== null ? chosenRole : (curRole >= ROLE_SWORDSMAN ? curRole : ROLE_SWORDSMAN);

  promoteHumanToRole(target, finalRole, s);
  try {
    target.setDynamicProperty("cb:owner_id", player.id);
    target.setDynamicProperty("cb:owner_name", player.name || "Игрок");
    target.addTag("cb_hired_warrior");
    target.triggerEvent("cb:on_hired");
    target.setProperty("cb:hired", true);
    target.setProperty("cb:stance", STANCE_FOLLOW);
    const hp = healthOf(target);
    if (hp) hp.setCurrentValue(hp.effectiveMax);
  } catch (e) {}

  sound(target.dimension, "random.levelup", target.location, 1.2, 1.2);
  fx(target.dimension, "minecraft:totem_particle", { x: target.location.x, y: target.location.y + 1.5, z: target.location.z });
  const roleTitles = ["Житель", "Ополченец", "Мечник со щитом", "Лучник", "Арбалетчик", "Копейщик со щитом", "Капитан стражи"];
  actionBar(player, `§a⚔ Нанят воин: §e${roleTitles[finalRole] || "Воин"}§a (Режим: Следовать)`);
}

const TRADE_OFFERS = [
  { label: "🍞 Каравай хлеба x6\n§8Цена: 1 Изумруд", costId: "minecraft:emerald", costCount: 1, giveId: "minecraft:bread", giveCount: 6, icon: "textures/items/bread" },
  { label: "🏹 Стрелы x24\n§8Цена: 1 Изумруд", costId: "minecraft:emerald", costCount: 1, giveId: "minecraft:arrow", giveCount: 24, icon: "textures/items/arrow" },
  { label: "🛡 Боевой щит x1\n§8Цена: 2 Изумруда", costId: "minecraft:emerald", costCount: 2, giveId: "minecraft:shield", giveCount: 1, icon: "textures/items/iron_ingot" },
  { label: "⚔ Железный меч + Топор\n§8Цена: 3 Изумруда", costId: "minecraft:emerald", costCount: 3, giveId: "minecraft:iron_sword", giveCount: 1, extraId: "minecraft:iron_axe", icon: "textures/items/iron_sword" },
  { label: "🏹 Лук + Арбалет\n§8Цена: 3 Изумруда", costId: "minecraft:emerald", costCount: 3, giveId: "minecraft:crossbow", giveCount: 1, extraId: "minecraft:bow", icon: "textures/items/crossbow_standby" },
  { label: "🔱 Боевое копьё (Трезубец)\n§8Цена: 5 Изумрудов", costId: "minecraft:emerald", costCount: 5, giveId: "minecraft:trident", giveCount: 1, icon: "textures/items/trident" },
  { label: "🍎 Золотое яблоко x2\n§8Цена: 4 Изумруда", costId: "minecraft:emerald", costCount: 4, giveId: "minecraft:golden_apple", giveCount: 2, icon: "textures/items/apple_golden" },
  { label: "💎 Алмазный меч\n§8Цена: 7 Изумрудов", costId: "minecraft:emerald", costCount: 7, giveId: "minecraft:diamond_sword", giveCount: 1, icon: "textures/items/diamond_sword" },
  { label: "💰 Продать 16 Дубовых брёвен\n§8Награда: 2 Изумруда", costId: "minecraft:oak_log", costCount: 16, giveId: "minecraft:emerald", giveCount: 2, icon: "textures/items/emerald" },
  { label: "💰 Продать 4 Железных слитка\n§8Награда: 2 Изумруда", costId: "minecraft:iron_ingot", costCount: 4, giveId: "minecraft:emerald", giveCount: 2, icon: "textures/items/emerald" },
  { label: "💰 Продать 16 Пшеницы\n§8Награда: 1 Изумруд", costId: "minecraft:wheat", costCount: 16, giveId: "minecraft:emerald", giveCount: 1, icon: "textures/items/emerald" }
];

async function openTradeMenu(player, human) {
  if (!valid(player) || !valid(human)) return;
  const emeralds = countItemInPlayerInventory(player, "minecraft:emerald");
  const form = new ActionFormData()
    .title("§l§6Торговля с поселением людей")
    .body(`§7Ваши изумруды: §a${emeralds} шт.§r\nВыберите товар для покупки или продажи ресурсов:`);

  for (const offer of TRADE_OFFERS) {
    form.button(offer.label, offer.icon);
  }
  form.button("§7Назад");

  try {
    const res = await form.show(player);
    if (res.canceled || res.selection === undefined || res.selection >= TRADE_OFFERS.length) return;
    const offer = TRADE_OFFERS[res.selection];
    if (!consumeItemFromPlayer(player, offer.costId, offer.costCount)) {
      actionBar(player, `§cНедостаточно предметов для обмена (${offer.costCount} шт.)!`);
      sound(player.dimension, "note.bass", player.location, 1.0, 0.8);
      return;
    }
    giveItemToPlayer(player, offer.giveId, offer.giveCount);
    if (offer.extraId) giveItemToPlayer(player, offer.extraId, 1);
    const s = getNearestSettlement(human.location, 64);
    if (s) {
      if (offer.costId === "minecraft:oak_log") s.resources.wood = Math.min(99, (s.resources.wood || 0) + 16);
      if (offer.costId === "minecraft:iron_ingot") s.resources.iron = Math.min(99, (s.resources.iron || 0) + 4);
      if (offer.costId === "minecraft:wheat") s.resources.food = Math.min(99, (s.resources.food || 0) + 8);
    }
    sound(player.dimension, "random.orb", player.location, 1.2, 1.25);
    fx(human.dimension, "minecraft:villager_happy", { x: human.location.x, y: human.location.y + 1.5, z: human.location.z });
    actionBar(player, "§aСделка успешно совершена!");
  } catch (e) {}
}

async function openHireMenu(player, human) {
  if (!valid(player) || !valid(human)) return;
  const emeralds = countItemInPlayerInventory(player, "minecraft:emerald");
  const gold = countItemInPlayerInventory(player, "minecraft:gold_ingot");
  const iron = countItemInPlayerInventory(player, "minecraft:iron_ingot");

  const form = new ActionFormData()
    .title("§l§bНайм воина в отряд")
    .body(
      `§7У вас: §a${emeralds} изумр.§7 | §e${gold} зол.§7 | §f${iron} жел.§r\n` +
      `Нанятый воин использует щит как игрок, сражается мечом, топором, копьём, луком или арбалетом и защищает вас:`
    )
    .button("⚔ Нанять Мечника со щитом\n§8Цена: 2 Изумруда или 3 Железа")
    .button("🔱 Нанять Копейщика со щитом\n§8Цена: 3 Изумруда или 4 Железа")
    .button("🏹 Нанять Лучника\n§8Цена: 2 Изумруда или 3 Железа")
    .button("🎯 Нанять Арбалетчика со щитом\n§8Цена: 3 Изумруда или 4 Железа")
    .button("👑 Нанять Капитана гвардии\n§8Цена: 5 Изумрудов или 4 Золота")
    .button("§7Отмена");

  try {
    const res = await form.show(player);
    if (res.canceled || res.selection === undefined || res.selection === 5) return;

    const options = [
      { role: ROLE_SWORDSMAN, em: 2, altId: "minecraft:iron_ingot", altCnt: 3 },
      { role: ROLE_SPEARMAN, em: 3, altId: "minecraft:iron_ingot", altCnt: 4 },
      { role: ROLE_ARCHER, em: 2, altId: "minecraft:iron_ingot", altCnt: 3 },
      { role: ROLE_CROSSBOWMAN, em: 3, altId: "minecraft:iron_ingot", altCnt: 4 },
      { role: ROLE_CAPTAIN, em: 5, altId: "minecraft:gold_ingot", altCnt: 4 }
    ];
    const opt = options[res.selection];
    const paid = consumeItemFromPlayer(player, "minecraft:emerald", opt.em) ||
                 consumeItemFromPlayer(player, opt.altId, opt.altCnt);

    if (!paid) {
      actionBar(player, `§cНужно ${opt.em} изумрудов или ${opt.altCnt} слитков для найма!`);
      sound(player.dimension, "note.bass", player.location, 1.0, 0.8);
      return;
    }
    hireHumanWarrior(player, human, opt.role);
  } catch (e) {}
}

export async function openHumanInteractionMenu(player, human) {
  if (!valid(player) || !valid(human)) return;
  const role = Number(human.getProperty("cb:role") ?? 0);
  const isHired = Boolean(human.getProperty("cb:hired")) || human.hasTag("cb_hired_warrior");
  const ownerId = (() => { try { return human.getDynamicProperty("cb:owner_id"); } catch { return undefined; } })();
  const stance = Number(human.getProperty("cb:stance") ?? STANCE_FOLLOW);
  const hp = healthOf(human);
  const hpStr = hp ? `${Math.ceil(hp.currentValue)}/${hp.effectiveMax} HP` : "20/20 HP";
  const roleNames = ["Житель поселения", "Ополченец", "Рыцарь-Мечник", "Рыцарь-Лучник", "Рыцарь-Арбалетчик", "Рыцарь-Копейщик", "Капитан стражи"];
  const stanceNames = ["Поселение", "Следовать за вами", "Охранять позицию", "Свободный патруль"];
  const mainhandId = (getEntitySlotId(human, EquipmentSlot.Mainhand) || "нет").replace("minecraft:", "");
  const offhandId = (getEntitySlotId(human, EquipmentSlot.Offhand) || "нет").replace("minecraft:", "");

  const form = new ActionFormData()
    .title(`§l§e${roleNames[role] || "Человек"} (${hpStr})`)
    .body(
      `§7Оружие: §f${mainhandId}§7 | Вторая рука: §b${offhandId}§r\n` +
      (isHired ? `§aСтатус: Нанят вами (${stanceNames[stance] || "Следовать"})§r` : `§eСтатус: Свободный житель / стражник (доступен для торговли и найма)§r`)
    )
    .button("💰 Торговать (Изумруды, Снаряжение, Еда)")
    .button(isHired && ownerId === player.id ? "🔄 Сменить класс вооружения воина" : "⚔ Нанять как воина в свой отряд")
    .button("🛡 Передать предмет из вашей руки (Оружие / Щит / Броню / Еду)")
    .button("👣 Приказ воину: Следовать за мной")
    .button("📍 Приказ воину: Охранять текущую точку")
    .button("🔔 Созвать тревогу / Сменить боевой приказ поселения");

  try {
    const res = await form.show(player);
    if (res.canceled || res.selection === undefined) return;

    if (res.selection === 0) {
      await openTradeMenu(player, human);
    } else if (res.selection === 1) {
      await openHireMenu(player, human);
    } else if (res.selection === 2) {
      const eq = player.getComponent("minecraft:equippable");
      const held = eq ? eq.getEquipment(EquipmentSlot.Mainhand) : null;
      if (!held) {
        actionBar(player, "§eВозьмите в руку меч, топор, копьё, трезубец, лук, арбалет, щит, броню или еду!");
        return;
      }
      if (FOOD_HEAL_MAP[held.typeId] && hp) {
        hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + FOOD_HEAL_MAP[held.typeId]));
        if (inSurvival(player)) {
          if (held.amount > 1) { held.amount--; eq.setEquipment(EquipmentSlot.Mainhand, held); }
          else eq.setEquipment(EquipmentSlot.Mainhand, undefined);
        }
        sound(human.dimension, "random.eat", human.location, 1.0, 1.1);
        fx(human.dimension, "minecraft:heart_particle", { x: human.location.x, y: human.location.y + 1.6, z: human.location.z });
        actionBar(player, `§aВоин исцелён (${Math.ceil(hp.currentValue)}/${hp.effectiveMax} HP)!`);
        return;
      }
      if (giveWeaponOrArmorToHuman(player, human, held)) {
        if (inSurvival(player)) {
          if (held.amount > 1) { held.amount--; eq.setEquipment(EquipmentSlot.Mainhand, held); }
          else eq.setEquipment(EquipmentSlot.Mainhand, undefined);
        }
        actionBar(player, `§aВы передали снаряжение: §e${held.typeId.replace("minecraft:", "")}`);
      } else {
        actionBar(player, "§cЭтот предмет нельзя экипировать как оружие, щит или броню.");
      }
    } else if (res.selection === 3) {
      if (!isHired || ownerId !== player.id) {
        actionBar(player, "§cСначала наймите этого воина!");
        return;
      }
      human.setProperty("cb:stance", STANCE_FOLLOW);
      actionBar(player, "§aПриказ воину: Следовать за вами!");
    } else if (res.selection === 4) {
      if (!isHired || ownerId !== player.id) {
        actionBar(player, "§cСначала наймите этого воина!");
        return;
      }
      human.setProperty("cb:stance", STANCE_GUARD);
      human.setDynamicProperty("cb:guard_x", human.location.x);
      human.setDynamicProperty("cb:guard_z", human.location.z);
      actionBar(player, "§eПриказ воину: Охранять эту позицию!");
    } else if (res.selection === 5) {
      const s = getNearestSettlement(human.location, 64);
      if (s) {
        const orderCycle = [CMD_GATHER_BELL, CMD_DEFEND_GATE, CMD_PROTECT_CIVILIANS, CMD_ATTACK_HOSTILES, CMD_HOLD_POSITIONS, CMD_RETURN_DUTY];
        const nextIdx = (orderCycle.indexOf(s.currentCommand) + 1) % orderCycle.length;
        s.currentCommand = orderCycle[nextIdx];
        safePlayAnim(human, "animation.cb_human.command_horn");
        actionBar(player, `§eПриказ гарнизону: §b${s.currentCommand}`);
      } else {
        actionBar(player, "§7Поблизости нет поселения.");
      }
    }
  } catch (e) {}
}

// ============================================================================
// EVENT LISTENERS: BELL INTERACTION, CAPTAIN DEATH, PLAYER INTERACTION
// ============================================================================
try {
  if (world.afterEvents?.playerInteractWithBlock) {
    world.afterEvents.playerInteractWithBlock.subscribe((ev) => {
      const b = ev.block;
      if (!b || !b.typeId.includes("bell")) return;
      const s = getNearestSettlement(b.location, 48);
      if (s) {
        triggerSettlementAlarm(b.dimension, s, `Игрок ${ev.player?.name || ""} ударил в набатный колокол!`);
      }
    });
  }
} catch (e) {}

try {
  if (world.afterEvents?.entityHitBlock) {
    world.afterEvents.entityHitBlock.subscribe((ev) => {
      const b = ev.hitBlock;
      if (!b || !b.typeId.includes("bell")) return;
      const s = getNearestSettlement(b.location, 48);
      if (s) {
        triggerSettlementAlarm(b.dimension, s, "Колокол прозвонил тревогу!");
      }
    });
  }
} catch (e) {}

try {
  world.afterEvents.entityDie.subscribe((ev) => {
    const dead = ev.deadEntity;
    if (!dead || dead.typeId !== "cb:human_villager") return;
    humanCombatState.delete(dead.id);
    let role = 0;
    try { role = Number(dead.getProperty("cb:role") ?? 0); } catch (e) {}
    if (role === ROLE_CAPTAIN) {
      const s = getNearestSettlement(dead.location, 64);
      if (s) {
        s.commanderDeadUntilTick = system.currentTick + 200;
      }
    }
  });
} catch (e) {}

const humanInteractDebounce = new Map();

try {
  if (world.afterEvents?.playerInteractWithEntity) {
    world.afterEvents.playerInteractWithEntity.subscribe((ev) => {
      const player = ev.player;
      const target = ev.target;
      if (!player || !target || target.typeId !== "cb:human_villager") return;

      const now = system.currentTick;
      if (now - (humanInteractDebounce.get(player.id) ?? -20) < 8) return;
      humanInteractDebounce.set(player.id, now);

      const eq = player.getComponent("minecraft:equippable");
      const held = eq ? eq.getEquipment(EquipmentSlot.Mainhand) : null;
      const isHired = Boolean(target.getProperty("cb:hired")) || target.hasTag("cb_hired_warrior");
      const ownerId = (() => { try { return target.getDynamicProperty("cb:owner_id"); } catch { return undefined; } })();

      // Quick sneak-interact for hired warrior: toggle Follow <-> Guard stance immediately!
      if (isHired && ownerId === player.id && player.isSneaking && !held) {
        const curStance = Number(target.getProperty("cb:stance") ?? STANCE_FOLLOW);
        const nextStance = curStance === STANCE_FOLLOW ? STANCE_GUARD : STANCE_FOLLOW;
        target.setProperty("cb:stance", nextStance);
        if (nextStance === STANCE_GUARD) {
          target.setDynamicProperty("cb:guard_x", target.location.x);
          target.setDynamicProperty("cb:guard_z", target.location.z);
          actionBar(player, "§e📍 Воин охраняет текущую точку!");
        } else {
          actionBar(player, "§a👣 Воин следует за вами!");
        }
        sound(target.dimension, "random.click", target.location, 1.0, 1.2);
        return;
      }

      // If player is holding a weapon, shield, or armor while sneaking -> directly equip & hire the human!
      if (held && player.isSneaking) {
        if (giveWeaponOrArmorToHuman(player, target, held)) {
          if (!isHired) hireHumanWarrior(player, target, Number(target.getProperty("cb:role") ?? ROLE_SWORDSMAN));
          if (inSurvival(player)) {
            if (held.amount > 1) { held.amount--; eq.setEquipment(EquipmentSlot.Mainhand, held); }
            else eq.setEquipment(EquipmentSlot.Mainhand, undefined);
          }
          return;
        }
      }

      // Open full interactive Trading, Hiring & Command UI Menu!
      system.run(() => {
        openHumanInteractionMenu(player, target);
      });
    });
  }
} catch (e) {}

// ============================================================================
// NATURAL WORLD DISCOVERY + /scriptevent cb:village COMMANDS
// ============================================================================
system.runInterval(() => {
  loadSettlements();
  for (const p of world.getAllPlayers()) {
    if (!p || !valid(p)) continue;
    if (p.dimension.id !== "minecraft:overworld" && p.dimension.id !== "overworld") continue;
    const loc = p.location;
    if (Math.hypot(loc.x, loc.z) < 160) continue;

    let tooClose = false;
    for (const s of settlements) {
      if (Math.hypot(loc.x - s.x, loc.z - s.z) < MIN_SETTLEMENT_SPACING) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    if (Math.random() > 0.35) continue;

    const angle = Math.random() * Math.PI * 2;
    const dist = randInt(54, 76);
    const sx = Math.floor(loc.x + Math.cos(angle) * dist);
    const sz = Math.floor(loc.z + Math.sin(angle) * dist);
    const surf = validateSettlementTerrain(p.dimension, sx, sz, 16);
    if (!surf || surf.y < 62 || surf.y > 115) continue;

    const variantKey = chooseNaturalVariant(surf.blockId);
    buildHumanSettlement(p.dimension, { x: sx, y: surf.y + 1, z: sz }, variantKey, p);
    break;
  }
}, AUTO_CHECK_TICKS);

try {
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "cb:village") return;
    const msg = (ev.message || "medium").trim().toLowerCase();
    const player = ev.sourceEntity || world.getAllPlayers()[0];
    if (!player) return;
    const dim = player.dimension;

    if (SETTLEMENT_VARIANTS[msg]) {
      buildHumanSettlement(dim, player.location, msg, player);
    } else if (msg === "random" || msg === "here") {
      const keys = Object.keys(SETTLEMENT_VARIANTS);
      const pick = keys[Math.floor(Math.random() * keys.length)];
      buildHumanSettlement(dim, player.location, pick, player);
    } else if (msg === "alarm") {
      const s = getNearestSettlement(player.location, 96);
      if (s) triggerSettlementAlarm(dim, s, "Учебная боевая тревога!");
      else player.sendMessage("§cПоблизости нет поселения людей.");
    } else if (msg === "calm" || msg === "peace") {
      const s = getNearestSettlement(player.location, 96);
      if (s) endSettlementAlarm(dim, s);
    } else if (msg === "status" || msg === "list") {
      const s = getNearestSettlement(player.location, 96);
      if (!s) {
        player.sendMessage("§e[Поселения людей]§r Поблизости поселений не найдено. Доступные вариации: §b/scriptevent cb:village small | medium | large | outpost | nordic | desert§r.");
      } else {
        player.sendMessage(
          `§a[${s.label}]§r Центр: (${s.x}, ${s.y}, ${s.z}) | Тип: §e${s.sizeType}§r | Тревога: ${s.alarmActive ? "§cДА§r" : "§aНЕТ§r"} | Приказ: §b${s.currentCommand}§r\n` +
          `§7Ресурсы склада:§r Еда=${s.resources.food}, Дерево=${s.resources.wood}, Камень=${s.resources.stone}, Железо=${s.resources.iron}, Оружие=${s.resources.weapons}, Броня=${s.resources.armor}`
        );
      }
    }
  });
} catch (e) {}
