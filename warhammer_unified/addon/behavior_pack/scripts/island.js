// Остров Циклопа — единственный на весь мир.
//  - Место выбирается само: когда игрок впервые заплывает в открытый океан
//    не ближе ISLAND_MIN_SPAWN блоков от точки появления мира, посреди воды
//    поднимается остров: песчаный берег, луг с деревьями и скалистый холм с пещерой.
//  - В пещере — сундук Циклопа (таблица добычи loot_tables/chests/cyclops_cave.json).
//  - На лугу пасутся его овцы и козы (тег cb_flock), на острове живёт Циклоп (тег cb_island).
//  - Островной Циклоп нападает, только когда ВИДИТ цель: она перед ним (конус обзора),
//    между ними нет стены, и она стоит на острове. Увиденных он помнит несколько секунд.
//  - С острова он не уходит: дальше берега не преследует, а унесённого в море возвращаем домой.
//  - У острова свой туман и надпись при входе — как у отдельного биома.
// Команды для проверки: /scriptevent cb:island here | where | reset
import { world, system, ItemStack } from "@minecraft/server";
import { valid, alive, isPlayer, actionBar, sound, playersNear, shared } from "./util.js";
import { T } from "./i18n.js";

const CYCLOPS = "cb:cyclops";
const ISLAND_TAG = "cb_island";
const FLOCK_TAG = "cb_flock";
const SPOTTED_TAG = "cb_spotted";
const STATE_KEY = "cb:island";

export const SEA = 62;              // уровень моря: вода до y=62 включительно
export const LAND_R = 28;           // средний радиус острова (берег ±3 блока)
export const HOME_R = 22;           // дальше этого Циклоп от дома не уходит
const AREA_R = LAND_R + 4;          // всё, что ближе к центру, — «на острове»
const FOG_R = LAND_R + 20;
export const ISLAND_MIN_SPAWN = 85; // остров не появится ближе к точке появления мира
export const ISLES_APART = 125;      // острова Циклопа, Гидры и Цирцеи — не ближе 400 блоков друг к другу
const SIGHT = 28;                   // как далеко видит Циклоп
const SIGHT_SNEAK = 12;             // ... пригнувшегося
const SPOT_MEMORY = 160;            // увиденного помнит 8 секунд
const FLOCK_MEMORY = 600;           // обидчика стада — 30 секунд
const CMDS_PER_TICK = 45;

// Холм с пещерой (координаты относительно центра острова)
export const HILL = { x: 9, z: 0, r: 13, h: 19 };
export const CAVE = { x: 10, z: 0, rx: 8, rz: 7.5, h: 10, floor: SEA + 2 };
export const CHEST = { x: CAVE.x + 6, y: CAVE.floor, z: 0 };
const TUNNEL = { x0: -6, x1: CAVE.x, half: 3, h: 8 };
export const LOOT_TABLE = "chests/cyclops_cave";

// ---------- состояние мира ----------
function loadState() {
  try {
    const raw = world.getDynamicProperty(STATE_KEY);
    return typeof raw === "string" ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}
function saveState(s) {
  try { world.setDynamicProperty(STATE_KEY, s ? JSON.stringify(s) : undefined); } catch {}
}
let island = loadState();      // { x, z, built, populated }
shared.island = () => island;
shared.islandBusy = () => !!job;     // строится ли сейчас остров Циклопа (острова строятся по одному)
shared.startCyclopsIsland = (x, z, why) => { if (!island && !job) startBuild(x, z, why); };

const overworld = () => world.getDimension("overworld");
const hdist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const onIsland = (loc) => !!island && hdist(loc, island) <= AREA_R && loc.y > (island.baseY ?? SEA) - 8;

// ---------- форма острова ----------
function hash(x, z, k) {
  let h = (x * 374761393 + z * 668265263 + k * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Колонка (dx, dz) от центра: { top, kind } или undefined, если там море.
export function column(cx, cz, dx, dz) {
  const r = Math.hypot(dx, dz);
  const a = Math.atan2(dz, dx);
  const p1 = hash(cx, cz, 1) * 6.28, p2 = hash(cx, cz, 2) * 6.28;
  const edge = LAND_R + 2.2 * Math.sin(3 * a + p1) + 1.4 * Math.sin(5 * a + p2);
  if (r > edge) return undefined;
  const t = r / edge;
  const n = hash(cx + dx, cz + dz, 3);
  let top, kind;
  if (t > 0.82) {
    top = Math.round(SEA + 1 - ((t - 0.82) / 0.18) * 3);    // песчаная отмель уходит под воду
    kind = "sand";
  } else {
    top = SEA + 1 + Math.floor((1.6 * (0.82 - t)) / 0.82 + n * 0.9);
    kind = "grass";
  }
  // площадка перед пещерой ровная, чтобы великан проходил
  if (dx >= TUNNEL.x0 - 6 && dx <= HILL.x && Math.abs(dz) <= TUNNEL.half + 2 && kind === "grass") top = SEA + 1;
  const d = Math.hypot(dx - HILL.x, dz - HILL.z);
  if (d < HILL.r) {
    const h = SEA + 1 + Math.round(HILL.h * Math.pow(1 - (d / HILL.r) ** 2, 0.8));
    if (h > top) {
      top = h;
      kind = d > HILL.r - 3 && n < 0.6 ? "grass" : "rock";
    }
  }
  return { top, kind, n };
}

// Высота пещеры над полом в колонке (0 — пещеры нет).
export function caveHeight(dx, dz) {
  const q = ((dx - CAVE.x) / CAVE.rx) ** 2 + ((dz - CAVE.z) / CAVE.rz) ** 2;
  let h = q < 1 ? Math.floor(CAVE.h * Math.sqrt(1 - q)) : 0;
  if (dx >= TUNNEL.x0 && dx <= TUNNEL.x1 && Math.abs(dz) <= TUNNEL.half) {
    h = Math.max(h, TUNNEL.h - Math.floor((dz * dz) / 3));
  }
  return h;
}

const ROCK = ["stone", "stone", "stone", "andesite", "andesite", "cobblestone", "mossy_cobblestone", "tuff"];

// Все команды постройки по порядку. Каждый шаг — { x, z, cmd }: x, z — колонка, чанк которой должен быть загружен.
function* buildSteps(cx, cz) {
  const S = 34;
  const at = (dx, y, dz) => `${cx + dx} ${y} ${cz + dz}`;
  // 1. Колонки: камень, слой грунта, верхний блок
  for (let dx = -S; dx <= S; dx++) {
    for (let dz = -S; dz <= S; dz++) {
      const x = cx + dx, z = cz + dz;
      const step = (cmd) => ({ x, z, cmd });
      const col = column(cx, cz, dx, dz);
      if (!col) {
        const r = Math.hypot(dx, dz);
        if (r <= LAND_R + 5) {
          yield step(`fill ${at(dx, SEA - 2, dz)} ${at(dx, SEA, dz)} water`);
          yield step(`fill ${at(dx, SEA + 1, dz)} ${at(dx, SEA + 18, dz)} air`);
        }
        continue;
      }
      yield step(`fill ${at(dx, col.top + 1, dz)} ${at(dx, SEA + 22, dz)} air`);
      const rock = ROCK[Math.floor(col.n * ROCK.length)];
      yield step(`fill ${at(dx, 20, dz)} ${at(dx, SEA - 4, dz)} stone replace water`);
      if (col.kind === "rock") {
        yield step(`fill ${at(dx, SEA - 3, dz)} ${at(dx, col.top, dz)} ${rock}`);
      } else if (col.kind === "grass") {
        yield step(`fill ${at(dx, SEA - 3, dz)} ${at(dx, col.top - 3, dz)} stone`);
        yield step(`fill ${at(dx, col.top - 2, dz)} ${at(dx, col.top - 1, dz)} dirt`);
        yield step(`setblock ${at(dx, col.top, dz)} grass_block`);
      } else {
        yield step(`fill ${at(dx, SEA - 3, dz)} ${at(dx, col.top - 3, dz)} sandstone`);
        yield step(`fill ${at(dx, col.top - 2, dz)} ${at(dx, col.top, dz)} sand`);
      }
    }
  }
  // 2. Пещера в холме: туннель и зал высотой до 10 блоков (Циклоп ростом 7)
  for (let dx = TUNNEL.x0; dx <= CAVE.x + CAVE.rx; dx++) {
    for (let dz = -Math.ceil(CAVE.rz); dz <= Math.ceil(CAVE.rz); dz++) {
      const h = caveHeight(dx, dz);
      const col = column(cx, cz, dx, dz);
      if (!h || !col) continue;
      const x = cx + dx, z = cz + dz;
      yield { x, z, cmd: `fill ${at(dx, CAVE.floor, dz)} ${at(dx, CAVE.floor + h - 1, dz)} air` };
      yield { x, z, cmd: `setblock ${at(dx, CAVE.floor - 1, dz)} ${hash(x, z, 9) < 0.7 ? "coarse_dirt" : "gravel"}` };
    }
  }
  // 3. Логово: ложе из сена, кости, костёр, фонари и сундук у дальней стены
  const deco = (dx, dz, cmd) => ({ x: cx + dx, z: cz + dz, cmd });
  yield deco(CAVE.x + 1, 3, `fill ${at(CAVE.x + 1, CAVE.floor, 3)} ${at(CAVE.x + 4, CAVE.floor, 5)} hay_block`);
  yield deco(CAVE.x + 3, -4, `setblock ${at(CAVE.x + 3, CAVE.floor, -4)} bone_block`);
  yield deco(CAVE.x + 5, -3, `setblock ${at(CAVE.x + 5, CAVE.floor, -3)} bone_block`);
  yield deco(CAVE.x + 4, -5, `setblock ${at(CAVE.x + 4, CAVE.floor, -5)} bone_block`);
  yield deco(CAVE.x - 2, -5, `setblock ${at(CAVE.x - 2, CAVE.floor, -5)} campfire`);
  yield deco(CAVE.x + 6, 3, `setblock ${at(CAVE.x + 6, CAVE.floor, 3)} lantern`);
  yield deco(CAVE.x - 4, 3, `setblock ${at(CAVE.x - 4, CAVE.floor, 3)} lantern`);
  yield deco(CHEST.x, CHEST.z, `setblock ${at(CHEST.x, CHEST.y, CHEST.z)} chest`);
  yield deco(CHEST.x, CHEST.z, `loot insert ${at(CHEST.x, CHEST.y, CHEST.z)} loot "${LOOT_TABLE}"`);
  // 4. Валун у входа (камень, которым Циклоп закрывает пещеру на ночь)
  yield deco(TUNNEL.x0 - 3, 5, `fill ${at(TUNNEL.x0 - 4, SEA + 2, 5)} ${at(TUNNEL.x0 - 2, SEA + 4, 7)} mossy_cobblestone`);
  // 5. Маяк на вершине холма: оранжевый луч виден издалека
  {
    const T = column(cx, cz, HILL.x, HILL.z).top;
    yield { x: cx + HILL.x, z: cz + HILL.z, cmd: `fill ${at(HILL.x - 1, T, HILL.z - 1)} ${at(HILL.x + 1, T, HILL.z + 1)} iron_block` };
    lastBeacon = { x: cx + HILL.x, y: T + 1, z: cz + HILL.z };
    yield { x: cx + HILL.x, z: cz + HILL.z, cmd: `setblock ${at(HILL.x, T + 1, HILL.z)} beacon` };
    yield { x: cx + HILL.x, z: cz + HILL.z, cmd: `setblock ${at(HILL.x, T + 2, HILL.z)} orange_stained_glass` };
  }
  // 6. Деревья на лугу
  for (const [dx, dz] of treeSpots(cx, cz)) {
    const col = column(cx, cz, dx, dz);
    const y = col.top;
    const s = (cmd) => ({ x: cx + dx, z: cz + dz, cmd });
    yield s(`fill ${at(dx - 2, y + 4, dz - 2)} ${at(dx + 2, y + 5, dz + 2)} oak_leaves ["persistent_bit"=true]`);
    yield s(`fill ${at(dx - 1, y + 6, dz - 1)} ${at(dx + 1, y + 7, dz + 1)} oak_leaves ["persistent_bit"=true]`);
    yield s(`fill ${at(dx, y + 1, dz)} ${at(dx, y + 6, dz)} oak_log`);
  }
}

export function treeSpots(cx, cz) {
  const out = [];
  for (let k = 0; out.length < 5 && k < 60; k++) {
    const a = hash(cx, cz, 20 + k) * Math.PI * 2;
    const r = 6 + hash(cx, cz, 90 + k) * 14;
    const dx = Math.round(Math.cos(a) * r), dz = Math.round(Math.sin(a) * r);
    const col = column(cx, cz, dx, dz);
    if (!col || col.kind !== "grass" || col.top < SEA + 1) continue;
    if (Math.hypot(dx - HILL.x, dz - HILL.z) < HILL.r + 3) continue;
    if (dx > TUNNEL.x0 - 14 && dx < HILL.x && Math.abs(dz) < 8) continue;   // путь к пещере свободен
    if (out.some(([x, z]) => Math.hypot(x - dx, z - dz) < 6)) continue;
    out.push([dx, dz]);
  }
  return out;
}

// Точки луга, где можно поставить моба.
function meadowSpot(cx, cz, k) {
  for (let i = 0; i < 40; i++) {
    const a = hash(cx, cz, 300 + k * 41 + i) * Math.PI * 2;
    const r = 4 + hash(cx, cz, 500 + k * 43 + i) * 15;
    const dx = Math.round(Math.cos(a) * r), dz = Math.round(Math.sin(a) * r);
    const col = column(cx, cz, dx, dz);
    if (!col || col.kind !== "grass" || caveHeight(dx, dz)) continue;
    if (treeSpots(cx, cz).some(([x, z]) => Math.abs(x - dx) <= 2 && Math.abs(z - dz) <= 2)) continue;
    return { x: cx + dx + 0.5, y: col.top + 1, z: cz + dz + 0.5 };
  }
  return { x: cx - 8.5, y: SEA + 2, z: cz + 0.5 };
}

// ---------- маяки: при появлении игрока разрушаются ----------
export let lastBeacon;   // координаты маяка, записываются при постройке и сохраняются вместе с островом
export function destroyBeacon(dim, b, players = []) {
  if (!b) return;
  run(dim, `setblock ${b.x} ${b.y + 1} ${b.z} air`);   // стекло над маяком пропадает полностью
  run(dim, `setblock ${b.x} ${b.y} ${b.z} air`);        // сам маяк пропадает полностью
  run(dim, `fill ${b.x - 1} ${b.y - 1} ${b.z - 1} ${b.x + 1} ${b.y - 1} ${b.z + 1} air replace iron_block`);
  run(dim, `fill ${b.x - 1} ${b.y - 1} ${b.z - 1} ${b.x + 1} ${b.y - 1} ${b.z + 1} air replace gold_block`);
  const loc = { x: b.x + 0.5, y: b.y + 0.5, z: b.z + 0.5 };
  try { dim.spawnParticle("minecraft:huge_explosion_emitter", loc); } catch {}
  sound(dim, "random.explode", loc, 4, 0.8);
  for (const p of players) actionBar(p, T("isl.beacon_shatter"));
}

// ---------- постройка ----------
let job;   // { gen, pending, done }

export function run(dim, cmd) {
  try {
    if (typeof dim.runCommandAsync === "function") return dim.runCommandAsync(cmd);
    if (typeof dim.runCommand === "function") return dim.runCommand(cmd);
  } catch {}
  return undefined;
}

export function detectBaseY(dim, x, z) {
  const bx = Math.floor(x), bz = Math.floor(z);
  try {
    const atSea = dim.getBlock({ x: bx, y: SEA, z: bz });
    if (atSea && WATERY(atSea.typeId)) return SEA;
    for (let y = 110; y >= -63; y--) {
      const b = dim.getBlock({ x: bx, y, z: bz });
      if (!b || b.typeId === "minecraft:air" || /leaves|log|short_grass|tall_grass|fern|flower|snow_layer/.test(b.typeId)) continue;
      if (WATERY(b.typeId)) return y;
      return Math.max(-62, y - 1);
    }
  } catch {}
  try {
    const p = dim.getPlayers()[0];
    if (p) return Math.max(-62, Math.floor(p.location.y) - 1);
  } catch {}
  return SEA;
}

export function shiftCmdY(cmd, dy) {
  if (!dy) return cmd;
  const clampY = (v) => Math.max(-63, Math.min(310, v + dy));
  const parts = cmd.split(" ");
  if (parts[0] === "fill" && parts.length >= 7) {
    parts[2] = String(clampY(parseInt(parts[2], 10)));
    parts[5] = String(clampY(parseInt(parts[5], 10)));
    return parts.join(" ");
  }
  if (parts[0] === "setblock" && parts.length >= 4) {
    parts[2] = String(clampY(parseInt(parts[2], 10)));
    return parts.join(" ");
  }
  if (parts[0] === "loot" && parts[1] === "insert" && parts.length >= 5) {
    parts[3] = String(clampY(parseInt(parts[3], 10)));
    return parts.join(" ");
  }
  return cmd;
}

export function loaded(dim, x, z) {
  try { return !!dim.getBlock({ x: Math.floor(x), y: 0, z: Math.floor(z) }); } catch { return false; }
}

function startBuild(x, z, why) {
  const dim = overworld();
  const baseY = detectBaseY(dim, x, z);
  island = { x: Math.floor(x), z: Math.floor(z), baseY, built: false, populated: false };
  saveState(island);
  run(dim, `tickingarea remove cb_cyclops_island`);
  run(dim, `tickingarea add circle ${island.x} ${baseY} ${island.z} 5 cb_cyclops_island true`);
  job = { gen: buildSteps(island.x, island.z), pending: undefined, wait: 10 };
  for (const p of playersNear(dim, { x: island.x, y: SEA, z: island.z }, 160)) {
    actionBar(p, T("isl.rises_mist"));
  }
  console.warn(`[island] Cyclops Island: ${island.x} ${island.z} (${why})`);
}

// Остров растёт быстро: кого засыпало камнем — поднимаем наверх.
function rescue(dim) {
  if (!island) return;
  for (const p of playersNear(dim, { x: island.x, y: SEA, z: island.z }, AREA_R + 4)) {
    try {
      const l = p.location;
      const head = dim.getBlock({ x: Math.floor(l.x), y: Math.floor(l.y + 1.6), z: Math.floor(l.z) });
      if (!head || head.typeId === "minecraft:air" || WATERY(head.typeId)) continue;
      const col = column(island.x, island.z, Math.floor(l.x) - island.x, Math.floor(l.z) - island.z);
      if (col) p.teleport({ x: l.x, y: col.top + 1, z: l.z }, { dimension: dim });
    } catch {}
  }
}

function tickBuild() {
  if (!job) return;
  if (shared.islesBusy()) return;   // сначала достроится другой остров
  if (job.wait > 0) { job.wait--; return; }   // ждём, пока игра загрузит чанки зоны
  const dim = overworld();
  if (system.currentTick % 10 === 0) rescue(dim);
  for (let n = 0; n < CMDS_PER_TICK; n++) {
    const step = job.pending ?? job.gen.next().value;
    if (!step) {
      job = undefined;
      finishBuild(dim);
      return;
    }
    if (!loaded(dim, step.x, step.z)) {
      job.stuck = (job.stuck ?? 0) + 1;
      if (job.stuck < 12) {
        job.pending = step;
        return;
      }
      job.stuck = 0;
    } else {
      job.stuck = 0;
    }
    job.pending = undefined;
    const dy = (island?.baseY ?? SEA) - SEA;
    const r = run(dim, shiftCmdY(step.cmd, dy));
    if (step.cmd.startsWith("loot ") && r && typeof r.catch === "function") {
      r.catch(() => fillChestByHand(dim));
    }
  }
}

// Запасной путь, если команда /loot недоступна: кладём добычу скриптом.
const HAND_LOOT = [
  ["cb:sheepskin", 1], ["minecraft:gold_ingot", 6], ["minecraft:emerald", 4], ["minecraft:bone", 7],
  ["minecraft:cooked_mutton", 8], ["minecraft:white_wool", 9], ["minecraft:iron_sword", 1], ["minecraft:golden_apple", 1],
];
function fillChestByHand(dim) {
  try {
    const b = dim.getBlock({ x: island.x + CHEST.x, y: CHEST.y + ((island?.baseY ?? SEA) - SEA), z: island.z + CHEST.z });
    const inv = b?.getComponent("minecraft:inventory")?.container;
    if (!inv) return;
    HAND_LOOT.forEach(([id, n], i) => { try { inv.setItem(i * 3, new ItemStack(id, n)); } catch {} });
  } catch {}
}

function finishBuild(dim) {
  island.built = true;
  if (lastBeacon) island.beacon = { ...lastBeacon, y: lastBeacon.y + ((island.baseY ?? SEA) - SEA) };
  saveState(island);
  rescue(dim);
  populate(dim);
  system.runTimeout(() => {
    try {
      run(dim, `loot insert ${island.x + CHEST.x} ${CHEST.y + ((island?.baseY ?? SEA) - SEA)} ${island.z + CHEST.z} loot "${LOOT_TABLE}"`);
      fillChestByHand(dim);
      populate(dim);
    } catch {}
  }, 15);
  system.runTimeout(() => {
    try { populate(dim); } catch {}
    run(dim, `tickingarea remove cb_cyclops_island`);
  }, 45);
  shared.announceIsland(T("isle.cyclops"), island, "orange");
}

function populate(dim) {
  if (!island || island.populated) return;
  const { x, z } = island;
  try {
    const dy = (island.baseY ?? SEA) - SEA;
    const home = { x: x + 0.5, y: SEA + 2 + dy, z: z + 0.5 };    // середина луга, вход в пещеру рядом
    const c = dim.spawnEntity(CYCLOPS, home);
    bindCyclops(c, home);
    for (let k = 0; k < 10; k++) {
      const spot = meadowSpot(x, z, k); spot.y += dy;
      const e = dim.spawnEntity(k < 6 ? "minecraft:sheep" : "minecraft:goat", spot);
      try { e.addTag(FLOCK_TAG); } catch {}
    }
    island.populated = true;
    saveState(island);
  } catch (e) {
    console.warn(`[island] populate: ${e}`);
  }
}

// Циклоп становится хозяином острова: дом, тег, ограничение по радиусу.
function bindCyclops(c, home) {
  if (!valid(c)) return;
  try { c.addTag(ISLAND_TAG); } catch {}
  try {
    c.setDynamicProperty("cb:hx", home.x);
    c.setDynamicProperty("cb:hy", home.y);
    c.setDynamicProperty("cb:hz", home.z);
  } catch {}
  try { c.triggerEvent("cb:island_home"); } catch {}
}

function homeOf(c) {
  const x = c.getDynamicProperty("cb:hx"), y = c.getDynamicProperty("cb:hy"), z = c.getDynamicProperty("cb:hz");
  if (typeof x === "number") return { x, y, z };
  return island ? { x: island.x + 0.5, y: SEA + 2, z: island.z + 0.5 } : undefined;
}

// ---------- поиск места: открытый океан вокруг игрока ----------
// Пробы не дальше 60 блоков от игрока: дальше чанки могут быть не загружены.
// Глубина 7 блоков по кругу и 12 в центре — это настоящий океан, а не река или озеро.
const SITE_DIST = 40;
export const WATERY = (id) => /water|kelp|seagrass/.test(id ?? "");
export function isOpenOcean(dim, x, z) {
  const pts = [[0, 0, 3]];
  for (const r of [8, 15]) for (let k = 0; k < 8; k++) pts.push([Math.cos((k * Math.PI) / 4) * r, Math.sin((k * Math.PI) / 4) * r, 2]);
  let good = 0;
  for (const [dx, dz, depth] of pts) {
    const bx = Math.floor(x + dx), bz = Math.floor(z + dz);
    try {
      const top = dim.getBlock({ x: bx, y: SEA, z: bz });
      const deep = dim.getBlock({ x: bx, y: SEA - depth, z: bz });
      const above = dim.getBlock({ x: bx, y: SEA + 2, z: bz });
      if (!top || !deep || !above) continue;
      if (WATERY(top.typeId) && WATERY(deep.typeId) && above.typeId === "minecraft:air") good++;
    } catch {}
  }
  return good >= 11;
}

export function spawnPoint() {
  try { return world.getDefaultSpawnLocation(); } catch { return { x: 0, y: 64, z: 0 }; }
}

function searchSite() {
  if (island) return;
  const dim = overworld();
  const sp = spawnPoint();
  for (const p of dim.getPlayers()) {
    const l = p.location;
    if (l.y < SEA - 4 || l.y > SEA + 30) continue;
    const v = p.getViewDirection?.() ?? { x: 1, z: 0 };
    const base = Math.atan2(v.z, v.x);
    for (let k = 0; k < 8; k++) {
      const a = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 4);
      const cx = l.x + Math.cos(a) * SITE_DIST, cz = l.z + Math.sin(a) * SITE_DIST;
      if (Math.hypot(cx - sp.x, cz - sp.z) < ISLAND_MIN_SPAWN) continue;
      if (shared.otherIslands().some((o) => Math.hypot(cx - o.x, cz - o.z) < ISLES_APART)) continue;   // подальше от островов Гидры и Цирцеи
      if (isOpenOcean(dim, cx, cz)) {
        startBuild(cx, cz, "ocean found");
        return;
      }
    }
  }
}

// ---------- зрение островного Циклопа ----------
const spotted = new Map();   // id -> тик, до которого Циклоп помнит цель
const told = new Map();      // id игрока -> тик последнего предупреждения

function islandCyclopes(dim) {
  try { return dim.getEntities({ type: CYCLOPS, tags: [ISLAND_TAG] }).filter(alive); } catch { return []; }
}

function spot(e, until, c) {
  const had = spotted.has(e.id);
  spotted.set(e.id, Math.max(spotted.get(e.id) ?? 0, until));
  try { e.addTag(SPOTTED_TAG); } catch {}
  if (!had && isPlayer(e)) {
    const now = system.currentTick;
    if ((told.get(e.id) ?? -1e9) + 200 <= now) {
      told.set(e.id, now);
      actionBar(e, T("isl.cyc_noticed"));
      if (c) sound(c.dimension, "cb.cyclops.roar", c.location, 2.5, 1.05);
    }
  }
}

function unspot(id, e) {
  spotted.delete(id);
  try { if (valid(e)) e.removeTag(SPOTTED_TAG); } catch {}
  for (const c of islandCyclopes(overworld())) shared.forgetCyclops(c);
}

function look(dim, now) {
  for (const c of islandCyclopes(dim)) {
    if (shared.isBlind(c)) continue;
    let near = [];
    try { near = dim.getEntities({ location: c.location, maxDistance: SIGHT }); } catch {}
    for (const e of near) {
      if (e.id === c.id || !shared.isCyclopsFoe(e) || !onIsland(e.location)) continue;
      const range = isPlayer(e) && e.isSneaking ? SIGHT_SNEAK : SIGHT;
      if (shared.cyclopsSees(c, e, range)) spot(e, now + SPOT_MEMORY, c);
    }
  }
  // метка могла остаться с прошлой игры (теги сохраняются, а память Циклопа — нет)
  let tagged = [];
  try { tagged = dim.getEntities({ tags: [SPOTTED_TAG] }); } catch {}
  for (const e of tagged) if (!spotted.has(e.id)) { try { e.removeTag(SPOTTED_TAG); } catch {} }
  for (const [id, until] of spotted) {
    let e;
    try { e = world.getEntity(id); } catch {}
    if (!alive(e)) { spotted.delete(id); continue; }
    if (until <= now || !onIsland(e.location)) unspot(id, e);
  }
}

// Не дальше берега: цель за пределами острова отпускает, унесённого в море — возвращаем.
function confine(dim) {
  for (const c of islandCyclopes(dim)) {
    const home = homeOf(c);
    if (!home) continue;
    const d = hdist(c.location, home);
    if (d > HOME_R) shared.forgetCyclops(c);
    if (d > HOME_R + 8 && shared.cyclopsIdle(c)) {
      try { c.teleport(home, { dimension: dim, keepVelocity: false }); } catch {}
    }
  }
}

// Стадо не разбредается с острова.
function herd(dim) {
  if (!island?.built) return;
  let flock = [];
  try { flock = dim.getEntities({ tags: [FLOCK_TAG] }); } catch {}
  flock.forEach((e, k) => {
    if (hdist(e.location, island) > LAND_R + 2) {
      try { e.teleport(meadowSpot(island.x, island.z, k + system.currentTick), { dimension: dim }); } catch {}
    }
  });
}

// Циклоп, появившийся на острове (яйцом, командой или сам), становится его хозяином.
function adoptNewcomers(dim) {
  let all = [];
  try { all = dim.getEntities({ type: CYCLOPS }); } catch {}
  for (const c of all) {
    if (c.getDynamicProperty("cb:born") !== undefined) continue;
    c.setDynamicProperty("cb:born", true);
    if (island?.built && !c.hasTag(ISLAND_TAG) && onIsland(c.location)) bindCyclops(c, { ...c.location });
  }
}

// Удар по островному Циклопу: зрячий оборачивается на обидчика, слепой «чует» его.
world.afterEvents.entityHurt.subscribe((ev) => {
  const c = ev.hurtEntity;
  const a = ev.damageSource?.damagingEntity;
  if (c?.typeId !== CYCLOPS || !a || a.typeId === CYCLOPS || !c.hasTag?.(ISLAND_TAG)) return;
  if (shared.isProvoking(c)) return;
  if (!onIsland(a.location)) {
    sound(c.dimension, "cb.cyclops.roar", c.location, 3, 0.9);
    if (isPlayer(a)) actionBar(a, T("isl.wont_leave"));
    return;
  }
  if (shared.isBlind(c)) { spot(a, system.currentTick + SPOT_MEMORY, c); return; }
  if (shared.cyclopsIdle(c)) {
    try { c.teleport(c.location, { facingLocation: a.location }); } catch {}
  }
  if (!isPlayer(a) || shared.cyclopsSees(c, a, SIGHT)) spot(a, system.currentTick + SPOT_MEMORY, c);
});

// Обидчик (стада или того, кто разбудил): островной Циклоп мстит, только если тот на острове.
// Обидчика стада помнит дольше.
shared.grudge = (c, attacker, flock) => {
  if (!c.hasTag?.(ISLAND_TAG)) return true;           // дикий Циклоп мстит без условий
  if (!onIsland(attacker.location)) return false;      // с лодки его не достать
  spot(attacker, system.currentTick + (flock ? FLOCK_MEMORY : SPOT_MEMORY), c);
  return true;
};

// Островной Циклоп спит в пещере, привалившись к ложу из сена, лицом к выходу.
export const BED = { x: CAVE.x + 2.5, z: 1.5, yaw: 90 };
shared.cyclopsBed = (c) => (c.hasTag?.(ISLAND_TAG) && island?.built
  ? { x: island.x + BED.x, y: CAVE.floor + ((island.baseY ?? SEA) - SEA), z: island.z + BED.z, yaw: BED.yaw } : undefined);

// ---------- камень у входа в пещеру ----------
// Ложась спать в пещере, Циклоп заваливает вход огромным камнем (как в «Одиссее»), утром отваливает его.
// Камень — это блоки в тоннеле, там, где он уже врезается в холм: две толщи на всё сечение тоннеля
// и выпуклый бок снаружи. Ставятся только в пустоту, убираются только свои — постройки игроков не трогаем.
export const BOULDER = { x: -1, depth: 2, height: 3 };   // стена из камней: 2 толщины, 3 блока в высоту, на всю ширину тоннеля
const BOULDER_MATS = ["stone", "cobblestone", "andesite", "stone", "mossy_cobblestone", "cobblestone"];
const SEALED_KEY = "cb:cave_sealed";
export const WALL_SLICES = TUNNEL.half * 2 + 1;           // Циклоп выкладывает стену по одному «столбцу» (dz от -3 до 3)

export function boulderBlocks(slice) {
  const out = [];
  for (let k = 0; k < BOULDER.depth; k++) {
    const dx = BOULDER.x - k;
    for (let dz = -TUNNEL.half; dz <= TUNNEL.half; dz++) {
      if (slice !== undefined && dz !== slice - TUNNEL.half) continue;
      const h = Math.min(BOULDER.height, caveHeight(dx, dz));
      for (let dy = 0; dy < h; dy++) out.push([dx, dy, dz]);
    }
  }
  return out.map(([dx, dy, dz]) => ({ dx, dy, dz, mat: BOULDER_MATS[Math.floor(hash(dx * 7 + dy, dz * 13 + dy, 21) * BOULDER_MATS.length)] }));
}

export const caveSealed = () => { try { return world.getDynamicProperty(SEALED_KEY) === true; } catch { return false; } };

// Место, где Циклоп стоит, выкладывая стену (внутри тоннеля, лицом к выходу), и «столбец» стены по номеру.
shared.cyclopsGate = (c) => (c.hasTag?.(ISLAND_TAG) && island?.built ? {
  x: island.x + BOULDER.x + 4.5, y: CAVE.floor + ((island.baseY ?? SEA) - SEA), z: island.z + 0.5, yaw: 90, half: TUNNEL.half,
  sealed: caveSealed(),
  inZone: (l) => Math.abs(l.z - island.z - 0.5) <= TUNNEL.half + 0.5 && l.x - island.x >= BOULDER.x + 2 && l.x - island.x <= BOULDER.x + 8,
} : undefined);

shared.stackSlice = (c, slice) => {
  if (!island?.built) return;
  const dim = c?.dimension ?? world.getDimension("overworld");
  for (const b of boulderBlocks(slice)) {
    run(dim, `setblock ${island.x + b.dx} ${CAVE.floor + b.dy + ((island?.baseY ?? SEA) - SEA)} ${island.z + b.dz} ${b.mat} keep`);
  }
  try { world.setDynamicProperty(SEALED_KEY, true); } catch {}
  const z = island.z + slice - TUNNEL.half + 0.5;
  sound(dim, "cb.cyclops.boulder", { x: island.x + BOULDER.x, y: CAVE.floor + 1, z }, 2, 1.2);
  try { dim.spawnParticle("minecraft:large_explosion", { x: island.x + BOULDER.x, y: CAVE.floor + 2, z }); } catch {}
};

shared.sealCave = (c) => {
  // Достраивает стену целиком, даже если часть уже выложена: кладку могли прервать на середине
  // (флаг «завалено» ставится с первого же столбца), а «keep» не трогает уже лежащие камни.
  if (!island?.built) return;
  const was = caveSealed();
  const dim = c?.dimension ?? world.getDimension("overworld");
  for (const b of boulderBlocks()) {
    run(dim, `setblock ${island.x + b.dx} ${CAVE.floor + b.dy + ((island?.baseY ?? SEA) - SEA)} ${island.z + b.dz} ${b.mat} keep`);
  }
  try { world.setDynamicProperty(SEALED_KEY, true); } catch {}
  if (!was) sound(dim, "cb.cyclops.boulder", { x: island.x + BOULDER.x, y: CAVE.floor + 3, z: island.z }, 3, 1);
};

shared.openCave = (c) => {
  if (!island?.built || !caveSealed()) return;
  const dim = c?.dimension ?? world.getDimension("overworld");
  for (const b of boulderBlocks()) {
    const at = `${island.x + b.dx} ${CAVE.floor + b.dy + ((island?.baseY ?? SEA) - SEA)} ${island.z + b.dz}`;
    run(dim, `fill ${at} ${at} air replace ${b.mat}`);
  }
  try { world.setDynamicProperty(SEALED_KEY, false); } catch {}
  sound(dim, "cb.cyclops.boulder", { x: island.x + BOULDER.x, y: CAVE.floor + 3, z: island.z }, 3, 0.9);
};

// Страховка: вход завален, а спящего Циклопа в пещере нет (погиб, исчез, мир перезагружен днём) — открываем.
function checkBoulder(dim) {
  if (!island?.built || !caveSealed()) return;
  let sleeping = false;
  try {
    for (const c of dim.getEntities({ type: "cb:cyclops", location: { x: island.x + CAVE.x, y: CAVE.floor, z: island.z }, maxDistance: 16 })) {
      if (c.getProperty("cb:state") === 4 || c.getProperty("cb:stack")) sleeping = true;
    }
  } catch {}
  if (!sleeping) shared.openCave();
}

// ---------- «биом»: туман и надпись при входе ----------
const inside = new Set();
function atmosphere(dim) {
  if (!island?.built) return;
  for (const p of dim.getPlayers()) {
    const d = hdist(p.location, island);
    if (d <= 85 && (!island.populated || !island.playerArrivedOnce)) {
      island.playerArrivedOnce = true;
      const existing = islandCyclopes(dim);
      if (existing.length === 0) {
        island.populated = false;
        populate(dim);
      }
      saveState(island);
    }
    const was = inside.has(p.id);
    if (d <= FOG_R && !was) {
      inside.add(p.id);
      if (island.beacon && !island.beaconGone) {
        island.beaconGone = true;
        saveState(island);
        destroyBeacon(dim, island.beacon, [p]);
      }
      try { p.runCommandAsync("fog @s push cb:cyclops_island cb_island"); } catch {}
      try {
        p.onScreenDisplay.setTitle(" ", { subtitle: T("isle.cyclops"), fadeInDuration: 10, stayDuration: 50, fadeOutDuration: 20 });
      } catch {}
    } else if (d > FOG_R + 6 && was) {
      inside.delete(p.id);
      try { p.runCommandAsync("fog @s remove cb_island"); } catch {}
    }
  }
}

// ---------- команды ----------
try {
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "cb:island") return;
    const p = ev.sourceEntity;
    const arg = String(ev.message ?? "").trim();
    if (arg === "here" && p) {
      job = undefined;
      startBuild(p.location.x, p.location.z, "command");
    } else if (arg === "reset") {
      job = undefined;
      island = undefined;
      saveState(undefined);
      if (p) actionBar(p, T("isl.forgotten"));
    } else if (p) {
      actionBar(p, island ? T("isl.coords", island.x, island.z) : T("isl.none_yet"));
    }
  });
} catch {}

// После перезахода: недостроенный остров достраиваем заново.
system.runTimeout(() => {
  if (island && !island.built && !job) startBuild(island.x, island.z, "finish build");
}, 100);

system.runInterval(() => {
  const now = system.currentTick;
  let dim;
  try { dim = overworld(); } catch { return; }
  try { tickBuild(); } catch (e) { console.warn(`[island] build: ${e}`); job = undefined; }
  if (now % 5 === 0) { try { look(dim, now); } catch (e) { console.warn(`[island] look: ${e}`); } }
  if (now % 10 === 0) {
    try { confine(dim); adoptNewcomers(dim); atmosphere(dim); } catch (e) { console.warn(`[island] tick: ${e}`); }
  }
  if (now % 200 === 100) { try { checkBoulder(dim); } catch {} }
  if (now % 16 === 0) {
    try { herd(dim); } catch {}
    if (!island && !job) { try { searchSite(); } catch (e) { console.warn(`[island] search: ${e}`); } }
  }
}, 1);
