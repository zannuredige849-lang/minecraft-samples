// Острова Гидры, Цирцеи и лестригонов — у каждого свой, по одному на мир (как остров Циклопа, island.js).
//  - «Скальная пустошь» Гидры: голые скалы, каменные шпили, гравийные осыпи, кости, ядовитые
//    зелёные озерца и посередине грязевой кратер — логово Гидры. Мутный зелёный туман.
//  - Остров Ээя Цирцеи: зелёный луг, цветы, цветущие деревья и домик колдуньи
//    (каменный фундамент, дощатые стены, ступенчатая крыша, труба, окна; внутри котёл,
//    варочная стойка, книжные полки, сундук). Рядом загон со свиньями — её «гостями».
//    Сиреневая дымка.
//  - Место выбирается само, по порядку: когда остров Циклопа уже стоит, следующий открытый океан
//    (не ближе 300 блоков от точки появления мира и 400 — от других островов) достаётся Гидре,
//    потом Цирцее, потом лестригонам (Телепил: большой лесистый остров, стая 10–15). Острова строятся по одному.
//  - Хозяин острова с него не уходит: унесённого или увлёкшегося погоней возвращает домой.
//  - Сами по миру Гидра и Цирцея не появляются — только на своих островах. Погибший хозяин
//    не возвращается (вернуть его можно будет ритуалом — позже).
// Команды: /scriptevent cb:isle hydra here | circe here | where | reset
import { world, system } from "@minecraft/server";
import { valid, alive, actionBar, playersNear, shared } from "./util.js";
import { T, joinWith } from "./i18n.js";
import { SEA, ISLAND_MIN_SPAWN, ISLES_APART, run, loaded, isOpenOcean, spawnPoint, WATERY, destroyBeacon, detectBaseY, shiftCmdY } from "./island.js";

let lastBeacon;   // маяк текущей постройки; сохраняется вместе с островом

const CMDS_PER_TICK = 45;
const SITE_DIST = 40;
const HOME_TAG = "cb_isle_home";

const overworld = () => world.getDimension("overworld");
const hdist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function hash(x, z, k) {
  let h = (x * 374761393 + z * 668265263 + k * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function shoreEdge(cx, cz, dx, dz, R) {
  const a = Math.atan2(dz, dx);
  return R + 2.2 * Math.sin(3 * a + hash(cx, cz, 1) * 6.28) + 1.4 * Math.sin(5 * a + hash(cx, cz, 2) * 6.28);
}

// ======================= Скальная пустошь Гидры =======================
export const HYDRA_R = 28;
export const CRATER = { r: 9, rim: 13 };          // логово в центре: грязь на y = SEA + 1
export const POOLS = [[-14, 6], [10, -14], [15, 10]];
export const HYDRA_CHEST = { x: -6, z: -5 };
const HYDRA_ROCK = ["stone", "stone", "andesite", "andesite", "tuff", "cobblestone", "gravel", "coarse_dirt"];

function spikes(cx, cz) {
  const out = [];
  for (let k = 0; out.length < 7 && k < 80; k++) {
    const a = hash(cx, cz, 40 + k) * Math.PI * 2;
    const r = CRATER.rim + 2 + hash(cx, cz, 70 + k) * 10;
    const dx = Math.round(Math.cos(a) * r), dz = Math.round(Math.sin(a) * r);
    if (out.some(([x, z]) => Math.hypot(x - dx, z - dz) < 6) || POOLS.some(([x, z]) => Math.hypot(x - dx, z - dz) < 5)) continue;
    out.push([dx, dz, 5 + Math.floor(hash(cx, cz, 99 + k) * 7)]);
  }
  return out;
}

export function hydraColumn(cx, cz, dx, dz) {
  const r = Math.hypot(dx, dz);
  const edge = shoreEdge(cx, cz, dx, dz, HYDRA_R);
  if (r > edge) return undefined;
  const t = r / edge;
  const n = hash(cx + dx, cz + dz, 3);
  let top, mat;
  if (t > 0.85) {
    top = Math.round(SEA + 1 - ((t - 0.85) / 0.15) * 3);
    mat = n < 0.7 ? "gravel" : "stone";
  } else {
    top = SEA + 2 + Math.floor(3 * hash(Math.floor((cx + dx) / 3), Math.floor((cz + dz) / 3), 5) + 2 * (1 - t));
    mat = HYDRA_ROCK[Math.floor(n * HYDRA_ROCK.length)];
  }
  for (const [x, z, h] of spikes(cx, cz)) {     // каменные шпили
    const d = Math.hypot(dx - x, dz - z);
    if (d < 2.2) { top += Math.round(h * (1 - d / 2.6)); mat = n < 0.5 ? "stone" : "andesite"; }
  }
  if (r < CRATER.r) { top = SEA + 1; mat = "mud"; }                                  // грязевой кратер
  else if (r < CRATER.rim) { top = SEA + 4 + Math.floor(n * 3); mat = n < 0.5 ? "tuff" : "stone"; }   // кольцо скал
  let pool = false;
  for (const [x, z] of POOLS) {
    const d = Math.hypot(dx - x, dz - z);
    if (d < 2.6) pool = true;
    else if (d < 4.2) top = Math.max(top, SEA + 3);   // берег выше воды — озерцо не растекается
  }
  return { top, mat, pool };
}

function* hydraSteps(cx, cz) {
  const S = HYDRA_R + 6;
  const at = (dx, y, dz) => `${cx + dx} ${y} ${cz + dz}`;
  for (let dx = -S; dx <= S; dx++) {
    for (let dz = -S; dz <= S; dz++) {
      const col = hydraColumn(cx, cz, dx, dz);
      if (!col) continue;
      const x = cx + dx, z = cz + dz;
      const step = (cmd) => ({ x, z, cmd });
      yield step(`fill ${at(dx, 20, dz)} ${at(dx, SEA - 4, dz)} stone replace water`);
      if (col.pool) {
        // ядовитое озерцо: зелёное дно из слизи, вода в один блок, берега выше воды
        yield step(`fill ${at(dx, SEA - 3, dz)} ${at(dx, SEA, dz)} stone`);
        yield step(`setblock ${at(dx, SEA + 1, dz)} slime`);
        yield step(`setblock ${at(dx, SEA + 2, dz)} water`);
      } else {
        yield step(`fill ${at(dx, SEA - 3, dz)} ${at(dx, col.top - 1, dz)} ${col.mat === "mud" ? "packed_mud" : "stone"}`);
        yield step(`setblock ${at(dx, col.top, dz)} ${col.mat}`);
      }
    }
  }
  // мох и кости вокруг озёр и по пустоши
  for (const [px, pz] of POOLS) {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const dx = Math.round(px + Math.cos(a) * 3.2), dz = Math.round(pz + Math.sin(a) * 3.2);
      const col = hydraColumn(cx, cz, dx, dz);
      if (col && !col.pool) yield { x: cx + dx, z: cz + dz, cmd: `setblock ${at(dx, col.top, dz)} moss_block` };
    }
  }
  for (let k = 0; k < 14; k++) {
    const a = hash(cx, cz, 200 + k) * Math.PI * 2;
    const r = CRATER.r - 2 + hash(cx, cz, 230 + k) * 16;
    const dx = Math.round(Math.cos(a) * r), dz = Math.round(Math.sin(a) * r);
    const col = hydraColumn(cx, cz, dx, dz);
    if (!col || col.pool) continue;
    const h = hash(cx, cz, 260 + k) < 0.4 ? 2 : 1;   // иногда торчит ребро в два блока
    yield { x: cx + dx, z: cz + dz, cmd: `fill ${at(dx, col.top + 1, dz)} ${at(dx, col.top + h, dz)} bone_block` };
  }
  // маяк на кольце скал: зелёный луч виден издалека
  {
    const T = hydraColumn(cx, cz, 0, -CRATER.r - 2).top;
    const bz = -CRATER.r - 2;
    yield { x: cx, z: cz + bz, cmd: `fill ${at(-1, T, bz - 1)} ${at(1, T, bz + 1)} iron_block` };
    lastBeacon = { x: cx, y: T + 1, z: cz + bz };
    yield { x: cx, z: cz + bz, cmd: `setblock ${at(0, T + 1, bz)} beacon` };
    yield { x: cx, z: cz + bz, cmd: `setblock ${at(0, T + 2, bz)} lime_stained_glass` };
  }
  // останки героев: сундук у края кратера
  const cc = hydraColumn(cx, cz, HYDRA_CHEST.x, HYDRA_CHEST.z);
  yield { x: cx + HYDRA_CHEST.x, z: cz + HYDRA_CHEST.z, cmd: `setblock ${at(HYDRA_CHEST.x, cc.top + 1, HYDRA_CHEST.z)} chest` };
  yield { x: cx + HYDRA_CHEST.x, z: cz + HYDRA_CHEST.z, cmd: `loot insert ${at(HYDRA_CHEST.x, cc.top + 1, HYDRA_CHEST.z)} loot "chests/hydra_lair"` };
}

// ======================= Остров Ээя (Цирцея) =======================
export const CIRCE_R = 27;
export const HOUSE = { x: -4, z: 0, w: 9, d: 7, floor: SEA + 2, wall: 4 };   // домик: 9×7, пол на y = 64
export const PEN = { x0: 7, x1: 14, z0: -5, z1: 4 };                          // загон для свиней
export const DOOR = { x: HOUSE.x, z: HOUSE.z + 3 };                            // дверной проём на юг (+z)
export const CIRCE_CHEST = { x: HOUSE.x - 3, z: HOUSE.z + 2 };
const FLOWERS = ["poppy", "allium", "cornflower", "lily_of_the_valley", "azure_bluet", "oxeye_daisy"];

const inHouseLot = (dx, dz) => Math.abs(dx - HOUSE.x) <= 7 && Math.abs(dz - HOUSE.z) <= 6;
const inPen = (dx, dz) => dx >= PEN.x0 - 1 && dx <= PEN.x1 + 1 && dz >= PEN.z0 - 1 && dz <= PEN.z1 + 1;

export function circeColumn(cx, cz, dx, dz) {
  const r = Math.hypot(dx, dz);
  const edge = shoreEdge(cx, cz, dx, dz, CIRCE_R);
  if (r > edge) return undefined;
  const t = r / edge;
  const n = hash(cx + dx, cz + dz, 3);
  if (t > 0.84) return { top: Math.round(SEA + 1 - ((t - 0.84) / 0.16) * 3), mat: "sand", n };
  let top = SEA + 2 + Math.floor(1.5 * (0.84 - t) / 0.84 + n * 0.8);
  if (inHouseLot(dx, dz) || inPen(dx, dz)) top = SEA + 2;     // ровная площадка под дом и загон
  return { top, mat: "grass_block", n };
}

export function circeTrees(cx, cz) {
  const out = [];
  for (let k = 0; out.length < 5 && k < 80; k++) {
    const a = hash(cx, cz, 20 + k) * Math.PI * 2;
    const r = 8 + hash(cx, cz, 90 + k) * 12;
    const dx = Math.round(Math.cos(a) * r), dz = Math.round(Math.sin(a) * r);
    const col = circeColumn(cx, cz, dx, dz);
    if (!col || col.mat !== "grass_block" || inHouseLot(dx, dz) || inPen(dx, dz)) continue;
    if (Math.abs(dx - DOOR.x) <= 2 && dz > DOOR.z && dz < DOOR.z + 8) continue;     // перед дверью свободно
    if (out.some(([x, z]) => Math.hypot(x - dx, z - dz) < 6)) continue;
    out.push([dx, dz]);
  }
  return out;
}

function* circeSteps(cx, cz) {
  const S = CIRCE_R + 6;
  const at = (dx, y, dz) => `${cx + dx} ${y} ${cz + dz}`;
  const step = (dx, dz, cmd) => ({ x: cx + dx, z: cz + dz, cmd });
  for (let dx = -S; dx <= S; dx++) {
    for (let dz = -S; dz <= S; dz++) {
      const col = circeColumn(cx, cz, dx, dz);
      if (!col) continue;
      yield step(dx, dz, `fill ${at(dx, 20, dz)} ${at(dx, SEA - 4, dz)} stone replace water`);
      if (col.mat === "sand") {
        yield step(dx, dz, `fill ${at(dx, SEA - 3, dz)} ${at(dx, col.top - 3, dz)} sandstone`);
        yield step(dx, dz, `fill ${at(dx, col.top - 2, dz)} ${at(dx, col.top, dz)} sand`);
      } else {
        yield step(dx, dz, `fill ${at(dx, SEA - 3, dz)} ${at(dx, col.top - 3, dz)} stone`);
        yield step(dx, dz, `fill ${at(dx, col.top - 2, dz)} ${at(dx, col.top - 1, dz)} dirt`);
        yield step(dx, dz, `setblock ${at(dx, col.top, dz)} grass_block`);
        // цветы по лугу (не у дома, не в загоне)
        if (col.n > 0.93 && !inHouseLot(dx, dz) && !inPen(dx, dz)) {
          yield step(dx, dz, `setblock ${at(dx, col.top + 1, dz)} ${FLOWERS[Math.floor(hash(dx, dz, 7) * FLOWERS.length)]}`);
        }
      }
    }
  }
  // ---- домик колдуньи ----
  const { x: hx, z: hz, floor: y0, wall } = HOUSE;
  const x0 = hx - 4, x1 = hx + 4, z0 = hz - 3, z1 = hz + 3, top = y0 + wall;
  yield step(hx, hz, `fill ${at(x0, y0, z0)} ${at(x1, y0, z1)} stone_bricks`);              // фундамент
  yield step(hx, hz, `fill ${at(x0 + 1, y0, z0 + 1)} ${at(x1 - 1, y0, z1 - 1)} oak_planks`); // пол
  yield step(hx, hz, `fill ${at(x0, y0 + 1, z0)} ${at(x1, top, z1)} oak_planks`);            // стены…
  yield step(hx, hz, `fill ${at(x0 + 1, y0 + 1, z0 + 1)} ${at(x1 - 1, top, z1 - 1)} air`);   // …и пустота внутри
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
    yield step(hx, hz, `fill ${at(x, y0 + 1, z)} ${at(x, top, z)} dark_oak_log`);           // угловые брёвна
  }
  for (const [x, z] of [[hx - 2, z0], [hx + 2, z0], [x0, hz], [x1, hz], [hx + 2, z1]]) {
    yield step(hx, hz, `fill ${at(x, y0 + 2, z)} ${at(x, y0 + 3, z)} glass_pane`);          // окна
  }
  yield step(hx, hz, `fill ${at(DOOR.x, y0 + 1, z1)} ${at(DOOR.x, y0 + 2, z1)} air`);       // дверной проём
  for (let k = 0; k < 4; k++) {                                                             // ступенчатая крыша
    const y = top + 1 + k;
    yield step(hx, hz, `fill ${at(x0 - 1 + k, y, z0 - 1 + k)} ${at(x1 + 1 - k, y, z1 + 1 - k)} dark_oak_planks`);
    if (k < 3) yield step(hx, hz, `fill ${at(x0 + k, y, z0 + k)} ${at(x1 - k, y, z1 - k)} air`);
  }
  // маяк на коньке крыши: пурпурный луч виден издалека
  yield step(hx, hz, `fill ${at(hx - 1, top + 4, hz - 1)} ${at(hx + 1, top + 4, hz + 1)} gold_block`);
  lastBeacon = { x: cx + hx, y: top + 5, z: cz + hz };
  yield step(hx, hz, `setblock ${at(hx, top + 5, hz)} beacon`);
  yield step(hx, hz, `setblock ${at(hx, top + 6, hz)} magenta_stained_glass`);
  yield step(hx, hz, `fill ${at(x1 - 1, top + 1, z0 + 1)} ${at(x1 - 1, top + 6, z0 + 1)} cobblestone`);   // труба
  yield step(hx, hz, `setblock ${at(x1 - 1, top + 7, z0 + 1)} campfire`);
  // убранство
  yield step(hx, hz, `fill ${at(hx - 1, y0 + 1, hz - 1)} ${at(hx + 1, y0 + 1, hz + 1)} purple_carpet`);
  yield step(hx, hz, `setblock ${at(x1 - 1, y0 + 1, z0 + 2)} cauldron`);
  yield step(hx, hz, `setblock ${at(x1 - 1, y0 + 1, z0 + 3)} brewing_stand`);
  yield step(hx, hz, `fill ${at(x0 + 1, y0 + 1, z0 + 1)} ${at(x0 + 1, y0 + 2, z0 + 3)} bookshelf`);
  yield step(hx, hz, `setblock ${at(x1 - 1, y0 + 1, z1 - 1)} crafting_table`);
  yield step(hx, hz, `setblock ${at(hx, y0 + 1, z0 + 1)} lantern`);
  yield step(hx, hz, `setblock ${at(x0 + 1, y0 + 1, z1 - 1)} lantern`);
  yield step(hx, hz, `setblock ${at(CIRCE_CHEST.x, y0 + 1, CIRCE_CHEST.z - 1)} chest`);
  yield step(hx, hz, `loot insert ${at(CIRCE_CHEST.x, y0 + 1, CIRCE_CHEST.z - 1)} loot "chests/circe_house"`);
  // тропинка от двери
  for (let k = 1; k <= 5; k++) yield step(DOOR.x, z1 + k, `setblock ${at(DOOR.x, y0, z1 + k)} dirt_path`);
  // ---- загон со свиньями ----
  const py = SEA + 3;
  yield step(PEN.x0, PEN.z0, `fill ${at(PEN.x0, py, PEN.z0)} ${at(PEN.x1, py, PEN.z1)} oak_fence`);
  yield step(PEN.x0, PEN.z0, `fill ${at(PEN.x0 + 1, py, PEN.z0 + 1)} ${at(PEN.x1 - 1, py, PEN.z1 - 1)} air`);
  yield step(PEN.x0, PEN.z0, `fill ${at(PEN.x0 + 1, py - 1, PEN.z0 + 1)} ${at(PEN.x1 - 1, py - 1, PEN.z1 - 1)} coarse_dirt`);
  yield step(PEN.x0, PEN.z0, `setblock ${at(PEN.x1 - 1, py - 1, PEN.z1 - 1)} water`);   // поилка
  // ---- цветущие деревья ----
  for (const [dx, dz] of circeTrees(cx, cz)) {
    const y = circeColumn(cx, cz, dx, dz).top;
    yield step(dx, dz, `fill ${at(dx - 2, y + 4, dz - 2)} ${at(dx + 2, y + 5, dz + 2)} azalea_leaves_flowered ["persistent_bit"=true]`);
    yield step(dx, dz, `fill ${at(dx - 1, y + 6, dz - 1)} ${at(dx + 1, y + 7, dz + 1)} azalea_leaves_flowered ["persistent_bit"=true]`);
    yield step(dx, dz, `fill ${at(dx, y + 1, dz)} ${at(dx, y + 6, dz)} oak_log`);
  }
}

// ======================= Телепил — остров лестригонов =======================
// Большой лесистый остров: дубы, берёзы и толстые тёмные дубы стоят густо, в центре поляна-стоянка
// людоедов: костёр, каменные сиденья, кости, черепа на кольях, сундук с добычей, маяк. Стая 10–15 лестригонов.
export const LAES_R = 44;
export const CAMP = { r: 10, floor: SEA + 3 };
export const LAES_CHEST = { x: -3, z: 5 };
export const LAES_GROUP = [10, 15];

export function laesColumn(cx, cz, dx, dz) {
  const r = Math.hypot(dx, dz);
  const edge = shoreEdge(cx, cz, dx, dz, LAES_R);
  if (r > edge) return undefined;
  const t = r / edge;
  const n = hash(cx + dx, cz + dz, 3);
  if (t > 0.86) return { top: Math.round(SEA + 1 - ((t - 0.86) / 0.14) * 3), mat: "sand", n };
  if (r < CAMP.r) return { top: CAMP.floor, mat: r < 4 ? "coarse_dirt" : "grass_block", n };
  const hill = hash(Math.floor((cx + dx) / 5), Math.floor((cz + dz) / 5), 5);
  return { top: SEA + 2 + Math.floor(2.5 * hill + 2.5 * (0.86 - t)), mat: "grass_block", n };
}

export function laesTrees(cx, cz) {
  const out = [];
  const S = 6;
  for (let gx = -LAES_R; gx <= LAES_R; gx += S) {
    for (let gz = -LAES_R; gz <= LAES_R; gz += S) {
      const dx = gx + Math.round((hash(cx + gx, cz + gz, 31) - 0.5) * 3);
      const dz = gz + Math.round((hash(cx + gx, cz + gz, 32) - 0.5) * 3);
      const r = Math.hypot(dx, dz);
      if (r < CAMP.r + 3) continue;
      const col = laesColumn(cx, cz, dx, dz);
      if (!col || col.mat !== "grass_block" || r > LAES_R * 0.8) continue;
      const q = hash(cx + dx, cz + dz, 33);
      out.push([dx, dz, q < 0.18 ? "dark_oak" : q < 0.55 ? "birch" : "oak"]);
    }
  }
  return out;
}

function* laesSteps(cx, cz) {
  const S = LAES_R + 6;
  const at = (dx, y, dz) => `${cx + dx} ${y} ${cz + dz}`;
  const step = (dx, dz, cmd) => ({ x: cx + dx, z: cz + dz, cmd });
  for (let dx = -S; dx <= S; dx++) {
    for (let dz = -S; dz <= S; dz++) {
      const col = laesColumn(cx, cz, dx, dz);
      if (!col) continue;
      yield step(dx, dz, `fill ${at(dx, 20, dz)} ${at(dx, SEA - 4, dz)} stone replace water`);
      if (col.mat === "sand") {
        yield step(dx, dz, `fill ${at(dx, SEA - 3, dz)} ${at(dx, col.top - 3, dz)} sandstone`);
        yield step(dx, dz, `fill ${at(dx, col.top - 2, dz)} ${at(dx, col.top, dz)} sand`);
        continue;
      }
      yield step(dx, dz, `fill ${at(dx, SEA - 3, dz)} ${at(dx, col.top - 3, dz)} stone`);
      yield step(dx, dz, `fill ${at(dx, col.top - 2, dz)} ${at(dx, col.top - 1, dz)} dirt`);
      yield step(dx, dz, `setblock ${at(dx, col.top, dz)} ${col.mat}`);
      if (col.mat === "grass_block" && col.n > 0.86 && Math.hypot(dx, dz) > CAMP.r) {
        yield step(dx, dz, `setblock ${at(dx, col.top + 1, dz)} ${col.n > 0.95 ? "fern" : "short_grass"}`);
      }
    }
  }
  // ---- лес ----
  for (const [dx, dz, kind] of laesTrees(cx, cz)) {
    const y = laesColumn(cx, cz, dx, dz).top;
    if (kind === "dark_oak") {                 // толстый тёмный дуб 2×2 с широкой кроной
      const L = `dark_oak_leaves ["persistent_bit"=true]`;
      yield step(dx, dz, `fill ${at(dx - 3, y + 6, dz - 3)} ${at(dx + 4, y + 7, dz + 4)} ${L}`);
      yield step(dx, dz, `fill ${at(dx - 2, y + 8, dz - 2)} ${at(dx + 3, y + 8, dz + 3)} ${L}`);
      yield step(dx, dz, `fill ${at(dx - 1, y + 9, dz - 1)} ${at(dx + 2, y + 9, dz + 2)} ${L}`);
      yield step(dx, dz, `fill ${at(dx, y + 1, dz)} ${at(dx + 1, y + 8, dz + 1)} dark_oak_log`);
    } else {
      const h = kind === "birch" ? 7 : 6;
      const L = `${kind}_leaves ["persistent_bit"=true]`;
      yield step(dx, dz, `fill ${at(dx - 2, y + h - 2, dz - 2)} ${at(dx + 2, y + h - 1, dz + 2)} ${L}`);
      yield step(dx, dz, `fill ${at(dx - 1, y + h, dz - 1)} ${at(dx + 1, y + h + 1, dz + 1)} ${L}`);
      yield step(dx, dz, `fill ${at(dx, y + 1, dz)} ${at(dx, y + h, dz)} ${kind}_log`);
    }
  }
  // ---- стоянка людоедов ----
  const y = CAMP.floor;
  yield step(0, 0, `setblock ${at(0, y + 1, 0)} campfire`);
  for (let k = 0; k < 8; k++) {                                   // каменные сиденья по кругу
    const a = (k / 8) * Math.PI * 2;
    const sx = Math.round(Math.cos(a) * 5), sz = Math.round(Math.sin(a) * 5);
    yield step(sx, sz, `setblock ${at(sx, y + 1, sz)} ${k % 2 ? "mossy_cobblestone" : "cobblestone"}`);
  }
  for (const [bx, bz] of [[3, -7], [-6, -4], [7, 3], [-2, 8]]) {   // кости и черепа на кольях
    yield step(bx, bz, `setblock ${at(bx, y + 1, bz)} bone_block`);
    yield step(bx + 1, bz, `setblock ${at(bx + 1, y + 1, bz)} cobblestone_wall`);
    yield step(bx + 1, bz, `setblock ${at(bx + 1, y + 2, bz)} skeleton_skull`);
  }
  yield step(LAES_CHEST.x, LAES_CHEST.z, `setblock ${at(LAES_CHEST.x, y + 1, LAES_CHEST.z)} chest`);
  yield step(LAES_CHEST.x, LAES_CHEST.z, `loot insert ${at(LAES_CHEST.x, y + 1, LAES_CHEST.z)} loot "chests/laestrygonian_camp"`);
  yield step(-7, 2, `setblock ${at(-7, y + 1, 2)} cauldron`);
  // маяк на краю поляны: оранжевый луч над лесом
  yield step(7, -5, `fill ${at(6, y - 1, -6)} ${at(8, y - 1, -4)} gold_block`);
  lastBeacon = { x: cx + 7, y, z: cz - 5 };
  yield step(7, -5, `setblock ${at(7, y, -5)} beacon`);
  yield step(7, -5, `setblock ${at(7, y + 1, -5)} orange_stained_glass`);
}


// ======================= Цитадель Скверны — остров Гул'дана =======================
export const GULDAN_R = 38;
export const ARENA_R = 11;
export const GULDAN_GATE = { x0: -2, x1: 2, z: -11 };
export const GULDAN_END_ROOM = { x0: -6, x1: 6, z0: -24, z1: -11, chestX: 0, chestZ: -20 };

export function guldanColumn(cx, cz, dx, dz) {
  const r = Math.hypot(dx, dz);
  const edge = shoreEdge(cx, cz, dx, dz, GULDAN_R);
  if (r > edge) return undefined;
  const t = r / edge;
  const n = hash(cx + dx, cz + dz, 7);
  if (t > 0.88) return { top: Math.round(SEA + 1 - ((t - 0.88) / 0.12) * 3), mat: "gravel", n };
  return { top: SEA + 3, mat: "blackstone", n };
}

function* guldanSteps(cx, cz) {
  const S = GULDAN_R + 6;
  const at = (dx, y, dz) => `${cx + dx} ${y} ${cz + dz}`;
  const step = (dx, dz, cmd) => ({ x: cx + dx, z: cz + dz, cmd });
  const floor = SEA + 3;

  // 1. Основание острова
  for (let dx = -S; dx <= S; dx++) {
    for (let dz = -S; dz <= S; dz++) {
      const col = guldanColumn(cx, cz, dx, dz);
      if (!col) continue;
      yield step(dx, dz, `fill ${at(dx, 20, dz)} ${at(dx, SEA - 4, dz)} stone replace water`);
      yield step(dx, dz, `fill ${at(dx, SEA - 3, dz)} ${at(dx, col.top - 1, dz)} deepslate`);
      yield step(dx, dz, `setblock ${at(dx, col.top, dz)} ${col.mat}`);
    }
  }

  // 2. Расчистка площадки и пола цитадели
  yield step(0, 0, `fill ${at(-27, floor + 1, -27)} ${at(27, floor + 9, 27)} air`);
  yield step(0, 0, `fill ${at(-26, floor, -26)} ${at(26, floor, 26)} polished_blackstone`);

  // 3. Настоящий многоконтурный лабиринт Скверны (радиус 26 -> кольцо 20 -> кольцо 15 -> тронная арена 11)
  // Кольцевые стены и радиальные перегородки образуют извилистый маршрут от южных ворот (z = 26) к арене и комнате в конце (z = -11..-24).
  for (let x = -26; x <= 26; x++) {
    for (let z = -26; z <= 26; z++) {
      const ax = Math.abs(x), az = Math.abs(z);
      const ring = Math.max(ax, az);

      // Пространство финальной Комнаты в конце лабиринта (северное крыло: x in -6..6, z in -24..-11) строим отдельно ниже
      if (z <= -11 && z >= -24 && ax <= 6) continue;

      // Южный вход в лабиринт (z = 26, x in -2..2)
      if (z === 26 && ax <= 2) continue;

      let isWall = false;

      // Внешняя крепостная стена (ring === 26)
      if (ring === 26) isWall = true;

      // Второе кольцо лабиринта (ring === 20) с проходами на востоке (x=20, z in -3..-1), западе (x=-20, z in 4..6) и юге-востоке (z=20, x in 9..11)
      if (ring === 20) {
        const doorE = (x === 20 && z >= -3 && z <= -1);
        const doorW = (x === -20 && z >= 4 && z <= 6);
        const doorSE = (z === 20 && x >= 9 && x <= 11);
        if (!doorE && !doorW && !doorSE) isWall = true;
      }

      // Третье кольцо лабиринта (ring === 15) с проходами на северо-востоке (x=15, z in -8..-6), юго-западе (z=15, x in -8..-6) и западе (x=-15, z in -2..0)
      if (ring === 15) {
        const doorNE = (x === 15 && z >= -8 && z <= -6);
        const doorSW = (z === 15 && x >= -8 && x <= -6);
        const doorW2 = (x === -15 && z >= -2 && z <= 0);
        if (!doorNE && !doorSW && !doorW2) isWall = true;
      }

      // Стена Тронной Арены (ring === 11) с главными южными вратами арены (z=11, ax<=2) и боковыми арками (ax=11, az<=1)
      if (ring === 11) {
        const gateS = (z === 11 && ax <= 2);
        const gateSide = (ax === 11 && az <= 1);
        if (!gateS && !gateSide) isWall = true;
      }

      // Радиальные перегородки во внешнем коридоре (20 < ring < 26)
      if (ring > 20 && ring < 26) {
        if (x === -7 && z > 20 && z <= 24) isWall = true;
        if (x === 14 && z > 20 && z <= 25 && z !== 23) isWall = true;
        if (z === 10 && x > 20 && x <= 25) isWall = true;
        if (z === -10 && x > 20 && x <= 25 && x !== 23) isWall = true;
        if (z === -4 && x < -20 && x >= -25) isWall = true;
        if (x === -12 && z < -20 && z >= -25 && z !== -23) isWall = true;
        if (x === 10 && z < -20 && z >= -25) isWall = true;
      }

      // Радиальные перегородки в среднем коридоре (15 < ring < 20)
      if (ring > 15 && ring < 20) {
        if (x === 0 && z > 15 && z < 20) isWall = true;
        if (z === 2 && x > 15 && x < 20) isWall = true;
        if (z === -12 && x > 15 && x < 20 && x !== 17) isWall = true;
        if (z === 10 && x < -15 && x > -20) isWall = true;
        if (x === -10 && z < -15 && z > -20) isWall = true;
      }

      // Радиальные перегородки во внутреннем коридоре (11 < ring < 15)
      if (ring > 11 && ring < 15) {
        if (x === 6 && z > 11 && z < 15) isWall = true;
        if (x === -10 && z > 11 && z < 15 && z !== 13) isWall = true;
        if (z === -5 && x > 11 && x < 15) isWall = true;
        if (z === 6 && x < -11 && x > -15) isWall = true;
      }

      if (isWall) {
        const mat = ((x + z) & 1) ? "polished_blackstone_bricks" : "mossy_cobblestone";
        yield step(x, z, `fill ${at(x, floor + 1, z)} ${at(x, floor + 5, z)} ${mat}`);
      }
    }
  }

  // 4. Оформление Тронной Арены (x in -10..10, z in -10..10): жаровни Скверны и трон Гул'дана
  for (const [bx, bz] of [[-7, -6], [7, -6], [-7, 6], [7, 6]]) {
    yield step(bx, bz, `fill ${at(bx, floor + 1, bz)} ${at(bx, floor + 2, bz)} crying_obsidian`);
    yield step(bx, bz, `setblock ${at(bx, floor + 3, bz)} netherrack`);
    yield step(bx, bz, `setblock ${at(bx, floor + 4, bz)} soul_fire`);
  }
  // Помост трона перед вратами в финальную комнату
  yield step(0, -8, `fill ${at(-3, floor, -9)} ${at(3, floor, -7)} chiseled_polished_blackstone`);
  yield step(0, -8, `setblock ${at(-3, floor + 1, -8)} soul_lantern`);
  yield step(0, -8, `setblock ${at(3, floor + 1, -8)} soul_lantern`);

  // 5. КОМНАТА В КОНЦЕ ЛАБИРИНТА (Святилище Саргераса: x in -6..6, z in -24..-11)
  // Пол, стены и сводчатый потолок финальной сокровищницы
  yield step(0, -18, `fill ${at(-6, floor, -24)} ${at(6, floor, -11)} chiseled_polished_blackstone`);
  yield step(0, -18, `fill ${at(-6, floor + 1, -24)} ${at(-6, floor + 6, -11)} polished_blackstone_bricks`);
  yield step(0, -18, `fill ${at(6, floor + 1, -24)} ${at(6, floor + 6, -11)} polished_blackstone_bricks`);
  yield step(0, -24, `fill ${at(-6, floor + 1, -24)} ${at(6, floor + 6, -24)} polished_blackstone_bricks`);
  yield step(0, -18, `fill ${at(-6, floor + 6, -24)} ${at(6, floor + 6, -11)} deepslate_tile_slab`);

  // Входная стена в Комнату в конце (z = -11): боковые пилоны и решётка Скверны (x in -2..2), которая открывается после победы над Гул'даном
  yield step(-4, -11, `fill ${at(-5, floor + 1, -11)} ${at(-3, floor + 5, -11)} crying_obsidian`);
  yield step(4, -11, `fill ${at(3, floor + 1, -11)} ${at(5, floor + 5, -11)} crying_obsidian`);
  yield step(0, -11, `fill ${at(-2, floor + 5, -11)} ${at(2, floor + 5, -11)} chiseled_polished_blackstone`);
  yield step(0, -11, `fill ${at(-2, floor + 1, -11)} ${at(2, floor + 4, -11)} iron_bars`);

  // Колонны, ковровая дорожка и фонари душ внутри Комнаты в конце
  yield step(0, -17, `fill ${at(-1, floor, -21)} ${at(1, floor, -12)} emerald_block`);
  for (const rz of [-14, -17, -21]) {
    yield step(-4, rz, `fill ${at(-4, floor + 1, rz)} ${at(-4, floor + 5, rz)} crying_obsidian`);
    yield step(4, rz, `fill ${at(4, floor + 1, rz)} ${at(4, floor + 5, rz)} crying_obsidian`);
    yield step(-3, rz, `setblock ${at(-3, floor + 1, rz)} soul_lantern`);
    yield step(3, rz, `setblock ${at(3, floor + 1, rz)} soul_lantern`);
  }

  // Алтарь в самом конце комнаты (z = -20) с сундуком Саргераса и музыкальной пластинкой
  yield step(0, -20, `fill ${at(-2, floor + 1, -21)} ${at(2, floor + 1, -19)} polished_blackstone_bricks`);
  yield step(0, -20, `setblock ${at(0, floor + 1, -20)} emerald_block`);
  yield step(0, -20, `setblock ${at(-2, floor + 2, -20)} soul_lantern`);
  yield step(0, -20, `setblock ${at(2, floor + 2, -20)} soul_lantern`);
  yield step(0, -20, `setblock ${at(0, floor + 2, -20)} chest`);
  yield step(0, -20, `loot insert ${at(0, floor + 2, -20)} loot "chests/guldan_shrine"`);

  // 6. Зелёные фонари душ в коридорах лабиринта
  for (const [lx, lz] of [[-18, 0], [18, 0], [0, 18], [-22, 22], [22, 22], [-22, -22], [22, -22], [-13, 13], [13, 13]]) {
    yield step(lx, lz, `setblock ${at(lx, floor + 1, lz)} soul_lantern`);
  }

  // 7. Изумрудный маяк Скверны над южными вратами
  yield step(0, 14, `fill ${at(-1, floor + 6, 13)} ${at(1, floor + 6, 15)} iron_block`);
  lastBeacon = { x: cx, y: floor + 7, z: cz + 14 };
  yield step(0, 14, `setblock ${at(0, floor + 7, 14)} beacon`);
  yield step(0, 14, `setblock ${at(0, floor + 8, 14)} green_stained_glass`);
}


// ======================= Кносский Лабиринт Минотавра =======================
export const MINOTAUR_R = 36;
export function minotaurColumn(cx, cz, dx, dz) {
  const r = Math.hypot(dx, dz);
  const edge = shoreEdge(cx, cz, dx, dz, MINOTAUR_R);
  if (r > edge) return undefined;
  const t = r / edge;
  const n = hash(cx + dx, cz + dz, 11);
  if (t > 0.88) return { top: Math.round(SEA + 1 - ((t - 0.88) / 0.12) * 3), mat: "sand", n };
  return { top: SEA + 3, mat: "stone_bricks", n };
}

function* minotaurSteps(cx, cz) {
  const S = MINOTAUR_R + 5;
  const at = (dx, y, dz) => `${cx + dx} ${y} ${cz + dz}`;
  const step = (dx, dz, cmd) => ({ x: cx + dx, z: cz + dz, cmd });
  const floor = SEA + 3;
  for (let dx = -S; dx <= S; dx++) {
    for (let dz = -S; dz <= S; dz++) {
      const col = minotaurColumn(cx, cz, dx, dz);
      if (!col) continue;
      yield step(dx, dz, `fill ${at(dx, 20, dz)} ${at(dx, SEA - 4, dz)} stone replace water`);
      yield step(dx, dz, `fill ${at(dx, SEA - 3, dz)} ${at(dx, col.top - 1, dz)} stone`);
      yield step(dx, dz, `setblock ${at(dx, col.top, dz)} ${col.mat}`);
    }
  }
  yield step(0, 0, `fill ${at(-25, floor + 1, -25)} ${at(25, floor + 8, 25)} air`);
  yield step(0, 0, `fill ${at(-24, floor, -24)} ${at(24, floor, 24)} stone_bricks`);
  // Тёмный свод лабиринта (чтобы внутри была темнота, где Минотавр быстрее преследует игрока!)
  yield step(0, 0, `fill ${at(-24, floor + 6, -24)} ${at(24, floor + 6, 24)} deepslate_bricks`);

  for (let x = -24; x <= 24; x++) {
    for (let z = -24; z <= 24; z++) {
      const ax = Math.abs(x), az = Math.abs(z);
      const ring = Math.max(ax, az);
      if (z === 24 && ax <= 2) continue;
      let isWall = false;
      if (ring === 24) isWall = true;
      if (ring === 18 && !(x === 18 && Math.abs(z) <= 2) && !(x === -18 && Math.abs(z - 5) <= 1) && !(z === -18 && Math.abs(x) <= 2)) isWall = true;
      if (ring === 12 && !(z === 12 && Math.abs(x + 4) <= 1) && !(x === -12 && Math.abs(z) <= 2) && !(x === 12 && Math.abs(z + 4) <= 1)) isWall = true;
      if (ring === 7 && !(z === 7 && ax <= 2) && !(z === -7 && ax <= 1)) isWall = true;
      if (ring > 18 && ring < 24 && ((x === 8 && z > 18) || (x === -9 && z < -18) || (z === 8 && x < -18))) isWall = true;
      if (ring > 12 && ring < 18 && ((x === 0 && z > 12) || (z === -6 && x > 12) || (x === -6 && z < -12))) isWall = true;
      if (isWall) {
        const mat = ((x + z) & 1) ? "stone_bricks" : "mossy_stone_bricks";
        yield step(x, z, `fill ${at(x, floor + 1, z)} ${at(x, floor + 5, z)} ${mat}`);
      }
    }
  }
  yield step(0, 0, `setblock ${at(0, floor + 1, -4)} chest`);
  yield step(0, 0, `loot insert ${at(0, floor + 1, -4)} loot "chests/minotaur_lair"`);
  yield step(0, 12, `fill ${at(-1, floor + 6, 11)} ${at(1, floor + 6, 13)} gold_block`);
  lastBeacon = { x: cx, y: floor + 7, z: cz + 12 };
  yield step(0, 12, `setblock ${at(0, floor + 7, 12)} beacon`);
  yield step(0, 12, `setblock ${at(0, floor + 8, 12)} red_stained_glass`);
}

// ======================= Подводный Дворец Посейдона =======================
export const POSEIDON_R = 26;
function* poseidonSteps(cx, cz) {
  const at = (dx, y, dz) => `${cx + dx} ${y} ${cz + dz}`;
  const step = (dx, dz, cmd) => ({ x: cx + dx, z: cz + dz, cmd });
  const floor = SEA - 10;
  // Призмариновая платформа и колоннада Подводного Дворца Посейдона
  yield step(0, 0, `fill ${at(-16, floor, -16)} ${at(16, floor, 16)} prismarine_bricks`);
  yield step(0, 0, `fill ${at(-14, floor, -14)} ${at(14, floor, 14)} dark_prismarine`);
  for (const [px, pz] of [[-12, -12], [12, -12], [-12, 12], [12, 12], [-12, 0], [12, 0], [0, -12], [0, 12]]) {
    yield step(px, pz, `fill ${at(px - 1, floor + 1, pz - 1)} ${at(px + 1, floor + 8, pz + 1)} prismarine`);
    yield step(px, pz, `setblock ${at(px, floor + 9, pz)} sea_lantern`);
  }
  // Купол дворца и трон Посейдона
  yield step(0, 0, `fill ${at(-12, floor + 8, -12)} ${at(12, floor + 8, 12)} prismarine_bricks`);
  yield step(0, -6, `fill ${at(-2, floor + 1, -8)} ${at(2, floor + 2, -5)} gold_block`);
  yield step(0, -6, `setblock ${at(0, floor + 3, -6)} sea_lantern`);
  yield step(0, 0, `fill ${at(-13, floor + 1, -13)} ${at(13, floor + 7, 13)} water`);
  yield step(0, -6, `fill ${at(-2, floor + 1, -8)} ${at(2, floor + 2, -5)} gold_block`);
  yield step(0, -6, `setblock ${at(0, floor + 3, -6)} sea_lantern`);
  yield step(0, -4, `setblock ${at(0, floor + 1, -4)} chest`);
  yield step(0, -4, `loot insert ${at(0, floor + 1, -4)} loot "chests/poseidon_palace"`);
  // Надводный сигнальный маяк Посейдона
  yield step(0, 0, `fill ${at(-1, SEA, -1)} ${at(1, SEA, 1)} diamond_block`);
  lastBeacon = { x: cx, y: SEA + 1, z: cz };
  yield step(0, 0, `setblock ${at(0, SEA + 1, 0)} beacon`);
  yield step(0, 0, `setblock ${at(0, SEA + 2, 0)} cyan_stained_glass`);
}


// ======================= Кратер Скверны Маннорота =======================
export const FEL_LORD_R = 26;
function* felLordSteps(cx, cz) {
  const S = FEL_LORD_R + 4;
  const at = (dx, y, dz) => `${cx + dx} ${y} ${cz + dz}`;
  const step = (dx, dz, cmd) => ({ x: cx + dx, z: cz + dz, cmd });
  const floor = SEA + 2;
  for (let dx = -S; dx <= S; dx++) {
    for (let dz = -S; dz <= S; dz++) {
      const r = Math.hypot(dx, dz);
      const edge = shoreEdge(cx, cz, dx, dz, FEL_LORD_R);
      if (r > edge) {
        if (r <= FEL_LORD_R + 4) {
          yield step(dx, dz, `fill ${at(dx, SEA - 2, dz)} ${at(dx, SEA, dz)} water`);
          yield step(dx, dz, `fill ${at(dx, SEA + 1, dz)} ${at(dx, SEA + 16, dz)} air`);
        }
        continue;
      }
      const rim = r > 12 && r < 18 ? 3 : (r > 18 ? 1 : 0);
      const top = floor + rim;
      yield step(dx, dz, `fill ${at(dx, 20, dz)} ${at(dx, SEA - 4, dz)} stone replace water`);
      yield step(dx, dz, `fill ${at(dx, SEA - 3, dz)} ${at(dx, top - 1, dz)} deepslate`);
      const mat = r < 5 ? "emerald_block" : (((dx + dz) & 3) === 0 ? "crying_obsidian" : "blackstone");
      yield step(dx, dz, `setblock ${at(dx, top, dz)} ${mat}`);
      yield step(dx, dz, `fill ${at(dx, top + 1, dz)} ${at(dx, top + 16, dz)} air`);
    }
  }
  for (const [px, pz] of [[-9, -9], [9, -9], [-9, 9], [9, 9], [-12, 0], [12, 0]]) {
    yield step(px, pz, `fill ${at(px, floor + 1, pz)} ${at(px, floor + 6, pz)} bone_block`);
    yield step(px, pz, `setblock ${at(px, floor + 7, pz)} netherrack`);
    yield step(px, pz, `setblock ${at(px, floor + 8, pz)} soul_fire`);
  }
  yield step(0, -6, `setblock ${at(0, floor + 1, -6)} chest`);
  yield step(0, -6, `loot insert ${at(0, floor + 1, -6)} loot "chests/guldan_shrine"`);
  yield step(0, 10, `fill ${at(-1, floor, 9)} ${at(1, floor, 11)} emerald_block`);
  lastBeacon = { x: cx, y: floor + 1, z: cz + 10 };
  yield step(0, 10, `setblock ${at(0, floor + 1, 10)} beacon`);
  yield step(0, 10, `setblock ${at(0, floor + 2, 10)} lime_stained_glass`);
}

// ======================= Ледяной Трон Короля-лича =======================
export const LICH_R = 25;
function* lichKingSteps(cx, cz) {
  const S = LICH_R + 4;
  const at = (dx, y, dz) => `${cx + dx} ${y} ${cz + dz}`;
  const step = (dx, dz, cmd) => ({ x: cx + dx, z: cz + dz, cmd });
  const floor = SEA + 2;
  for (let dx = -S; dx <= S; dx++) {
    for (let dz = -S; dz <= S; dz++) {
      const r = Math.hypot(dx, dz);
      const edge = shoreEdge(cx, cz, dx, dz, LICH_R);
      if (r > edge) {
        if (r <= LICH_R + 4) {
          yield step(dx, dz, `setblock ${at(dx, SEA, dz)} frosted_ice`);
          yield step(dx, dz, `fill ${at(dx, SEA + 1, dz)} ${at(dx, SEA + 16, dz)} air`);
        }
        continue;
      }
      const stepH = r < 7 ? 3 : (r < 13 ? 1 : 0);
      const top = floor + stepH;
      yield step(dx, dz, `fill ${at(dx, 20, dz)} ${at(dx, SEA - 4, dz)} stone replace water`);
      yield step(dx, dz, `fill ${at(dx, SEA - 3, dz)} ${at(dx, top - 1, dz)} packed_ice`);
      const mat = r < 7 ? "blue_ice" : (((dx + dz) & 1) ? "packed_ice" : "snow");
      yield step(dx, dz, `setblock ${at(dx, top, dz)} ${mat}`);
      yield step(dx, dz, `fill ${at(dx, top + 1, dz)} ${at(dx, top + 16, dz)} air`);
    }
  }
  for (const [px, pz] of [[-8, -8], [8, -8], [-8, 8], [8, 8], [-11, 0], [11, 0], [0, -11]]) {
    yield step(px, pz, `fill ${at(px, floor + 1, pz)} ${at(px, floor + 8, pz)} blue_ice`);
    yield step(px, pz, `setblock ${at(px, floor + 9, pz)} soul_lantern`);
  }
  yield step(0, -4, `fill ${at(-2, floor + 4, -6)} ${at(2, floor + 8, -4)} blue_ice`);
  yield step(0, -3, `setblock ${at(0, floor + 4, -3)} chest`);
  yield step(0, -3, `loot insert ${at(0, floor + 4, -3)} loot "chests/hydra_lair"`);
  yield step(0, 9, `fill ${at(-1, floor, 8)} ${at(1, floor, 10)} diamond_block`);
  lastBeacon = { x: cx, y: floor + 1, z: cz + 9 };
  yield step(0, 9, `setblock ${at(0, floor + 1, 9)} beacon`);
  yield step(0, 9, `setblock ${at(0, floor + 2, 9)} light_blue_stained_glass`);
}

// ======================= 1. Небесный Храм Зевса (Олимп) =======================
export const OLYMPUS_R = 27;
function* olympusSteps(cx, cz) {
  const S = OLYMPUS_R + 4;
  const at = (dx, y, dz) => `${cx + dx} ${y} ${cz + dz}`;
  const step = (dx, dz, cmd) => ({ x: cx + dx, z: cz + dz, cmd });
  const floor = SEA + 4;
  for (let dx = -S; dx <= S; dx++) {
    for (let dz = -S; dz <= S; dz++) {
      const r = Math.hypot(dx, dz);
      const edge = shoreEdge(cx, cz, dx, dz, OLYMPUS_R);
      if (r > edge) {
        if (r <= OLYMPUS_R + 4) {
          yield step(dx, dz, `fill ${at(dx, SEA - 2, dz)} ${at(dx, SEA, dz)} water`);
          yield step(dx, dz, `fill ${at(dx, SEA + 1, dz)} ${at(dx, SEA + 18, dz)} air`);
        }
        continue;
      }
      const stepH = r < 14 ? 3 : (r < 19 ? 1 : 0);
      const top = floor + stepH;
      yield step(dx, dz, `fill ${at(dx, 20, dz)} ${at(dx, SEA - 4, dz)} stone replace water`);
      yield step(dx, dz, `fill ${at(dx, SEA - 3, dz)} ${at(dx, top - 1, dz)} quartz_block`);
      const mat = r < 14 ? (((dx + dz) & 3) === 0 ? "gold_block" : "quartz_bricks") : "calcite";
      yield step(dx, dz, `setblock ${at(dx, top, dz)} ${mat}`);
      yield step(dx, dz, `fill ${at(dx, top + 1, dz)} ${at(dx, top + 18, dz)} air`);
    }
  }
  for (const [px, pz] of [[-10, -10], [10, -10], [-10, 10], [10, 10], [-10, 0], [10, 0], [0, -10], [0, 10]]) {
    yield step(px, pz, `fill ${at(px, floor + 4, pz)} ${at(px, floor + 11, pz)} quartz_pillar`);
    yield step(px, pz, `setblock ${at(px, floor + 12, pz)} ochre_froglight`);
  }
  yield step(0, 0, `fill ${at(-11, floor + 12, -11)} ${at(11, floor + 12, 11)} quartz_slab`);
  yield step(0, -6, `fill ${at(-2, floor + 4, -8)} ${at(2, floor + 7, -6)} gold_block`);
  yield step(0, -4, `setblock ${at(0, floor + 4, -4)} chest`);
  yield step(0, -4, `loot insert ${at(0, floor + 4, -4)} loot "chests/poseidon_palace"`);
  yield step(0, 0, `fill ${at(-1, floor + 3, -1)} ${at(1, floor + 3, 1)} gold_block`);
  lastBeacon = { x: cx, y: floor + 4, z: cz };
  yield step(0, 0, `setblock ${at(0, floor + 4, 0)} beacon`);
  yield step(0, 0, `setblock ${at(0, floor + 5, 0)} yellow_stained_glass`);
}

// ======================= 2. Цитадель Аида (Врата Подземного Мира) =======================
export const HADES_R = 26;
function* hadesSteps(cx, cz) {
  const S = HADES_R + 4;
  const at = (dx, y, dz) => `${cx + dx} ${y} ${cz + dz}`;
  const step = (dx, dz, cmd) => ({ x: cx + dx, z: cz + dz, cmd });
  const floor = SEA + 2;
  for (let dx = -S; dx <= S; dx++) {
    for (let dz = -S; dz <= S; dz++) {
      const r = Math.hypot(dx, dz);
      const edge = shoreEdge(cx, cz, dx, dz, HADES_R);
      if (r > edge) {
        if (r <= HADES_R + 4) {
          yield step(dx, dz, `fill ${at(dx, SEA - 2, dz)} ${at(dx, SEA, dz)} water`);
          yield step(dx, dz, `fill ${at(dx, SEA + 1, dz)} ${at(dx, SEA + 16, dz)} air`);
        }
        continue;
      }
      const stepH = r < 12 ? 2 : 0;
      const top = floor + stepH;
      yield step(dx, dz, `fill ${at(dx, 20, dz)} ${at(dx, SEA - 4, dz)} deepslate replace water`);
      yield step(dx, dz, `fill ${at(dx, SEA - 3, dz)} ${at(dx, top - 1, dz)} polished_blackstone_bricks`);
      const mat = r < 6 ? "crying_obsidian" : (((dx + dz) & 3) === 0 ? "soul_soil" : "polished_blackstone_bricks");
      yield step(dx, dz, `setblock ${at(dx, top, dz)} ${mat}`);
      yield step(dx, dz, `fill ${at(dx, top + 1, dz)} ${at(dx, top + 16, dz)} air`);
    }
  }
  for (const [px, pz] of [[-9, -9], [9, -9], [-9, 9], [9, 9], [-11, 0], [11, 0]]) {
    yield step(px, pz, `fill ${at(px, floor + 3, pz)} ${at(px, floor + 9, pz)} crying_obsidian`);
    yield step(px, pz, `setblock ${at(px, floor + 10, pz)} soul_soil`);
    yield step(px, pz, `setblock ${at(px, floor + 11, pz)} soul_fire`);
  }
  // Трон Аида и костяная арка Врат Смерти
  yield step(0, -6, `fill ${at(-3, floor + 3, -8)} ${at(3, floor + 8, -6)} obsidian`);
  yield step(0, -6, `fill ${at(-4, floor + 9, -7)} ${at(4, floor + 10, -7)} bone_block`);
  yield step(0, -4, `setblock ${at(0, floor + 3, -4)} chest`);
  yield step(0, -4, `loot insert ${at(0, floor + 3, -4)} loot "chests/guldan_shrine"`);
  yield step(0, 9, `fill ${at(-1, floor, 8)} ${at(1, floor, 10)} netherite_block`);
  lastBeacon = { x: cx, y: floor + 1, z: cz + 9 };
  yield step(0, 9, `setblock ${at(0, floor + 1, 9)} beacon`);
  yield step(0, 9, `setblock ${at(0, floor + 2, 9)} purple_stained_glass`);
}

// ======================= 3. Кровавая Арена Ареса =======================
export const ARES_R = 27;
function* aresSteps(cx, cz) {
  const S = ARES_R + 4;
  const at = (dx, y, dz) => `${cx + dx} ${y} ${cz + dz}`;
  const step = (dx, dz, cmd) => ({ x: cx + dx, z: cz + dz, cmd });
  const floor = SEA + 2;
  for (let dx = -S; dx <= S; dx++) {
    for (let dz = -S; dz <= S; dz++) {
      const r = Math.hypot(dx, dz);
      const edge = shoreEdge(cx, cz, dx, dz, ARES_R);
      if (r > edge) {
        if (r <= ARES_R + 4) {
          yield step(dx, dz, `fill ${at(dx, SEA - 2, dz)} ${at(dx, SEA, dz)} water`);
          yield step(dx, dz, `fill ${at(dx, SEA + 1, dz)} ${at(dx, SEA + 16, dz)} air`);
        }
        continue;
      }
      const wallH = (r >= 13 && r <= 15 && Math.abs(dx) > 3) ? 5 : 0;
      const top = floor + wallH;
      yield step(dx, dz, `fill ${at(dx, 20, dz)} ${at(dx, SEA - 4, dz)} stone replace water`);
      yield step(dx, dz, `fill ${at(dx, SEA - 3, dz)} ${at(dx, floor - 1, dz)} red_nether_brick`);
      const mat = wallH > 0 ? "red_nether_brick" : (r < 4 ? "gold_block" : (Math.abs(r - 9) < 1.2 ? "magma" : "polished_blackstone"));
      yield step(dx, dz, `fill ${at(dx, floor, dz)} ${at(dx, top, dz)} ${mat}`);
      yield step(dx, dz, `fill ${at(dx, top + 1, dz)} ${at(dx, top + 16, dz)} air`);
    }
  }
  for (const [px, pz] of [[-10, -10], [10, -10], [-10, 10], [10, 10], [-13, 0], [13, 0]]) {
    yield step(px, pz, `fill ${at(px, floor + 1, pz)} ${at(px, floor + 7, pz)} polished_blackstone_wall`);
    yield step(px, pz, `setblock ${at(px, floor + 8, pz)} netherrack`);
    yield step(px, pz, `setblock ${at(px, floor + 9, pz)} fire`);
  }
  yield step(0, -4, `setblock ${at(0, floor + 1, -4)} chest`);
  yield step(0, -4, `loot insert ${at(0, floor + 1, -4)} loot "chests/minotaur_lair"`);
  yield step(0, 10, `fill ${at(-1, floor, 9)} ${at(1, floor, 11)} gold_block`);
  lastBeacon = { x: cx, y: floor + 1, z: cz + 10 };
  yield step(0, 10, `setblock ${at(0, floor + 1, 10)} beacon`);
  yield step(0, 10, `setblock ${at(0, floor + 2, 10)} red_stained_glass`);
}

// ======================= 4. Акрополь Афины (Святилище Мудрости) =======================
export const ATHENA_R = 26;
function* athenaSteps(cx, cz) {
  const S = ATHENA_R + 4;
  const at = (dx, y, dz) => `${cx + dx} ${y} ${cz + dz}`;
  const step = (dx, dz, cmd) => ({ x: cx + dx, z: cz + dz, cmd });
  const floor = SEA + 3;
  for (let dx = -S; dx <= S; dx++) {
    for (let dz = -S; dz <= S; dz++) {
      const r = Math.hypot(dx, dz);
      const edge = shoreEdge(cx, cz, dx, dz, ATHENA_R);
      if (r > edge) {
        if (r <= ATHENA_R + 4) {
          yield step(dx, dz, `fill ${at(dx, SEA - 2, dz)} ${at(dx, SEA, dz)} water`);
          yield step(dx, dz, `fill ${at(dx, SEA + 1, dz)} ${at(dx, SEA + 16, dz)} air`);
        }
        continue;
      }
      const stepH = r < 13 ? 2 : 0;
      const top = floor + stepH;
      yield step(dx, dz, `fill ${at(dx, 20, dz)} ${at(dx, SEA - 4, dz)} stone replace water`);
      yield step(dx, dz, `fill ${at(dx, SEA - 3, dz)} ${at(dx, top - 1, dz)} quartz_block`);
      const mat = r < 13 ? (((dx + dz) & 3) === 0 ? "lapis_block" : "chiseled_quartz_block") : "grass_block";
      yield step(dx, dz, `setblock ${at(dx, top, dz)} ${mat}`);
      yield step(dx, dz, `fill ${at(dx, top + 1, dz)} ${at(dx, top + 16, dz)} air`);
    }
  }
  for (const [px, pz] of [[-9, -9], [9, -9], [-9, 9], [9, 9], [-9, 0], [9, 0]]) {
    yield step(px, pz, `fill ${at(px, floor + 3, pz)} ${at(px, floor + 9, pz)} quartz_pillar`);
    yield step(px, pz, `setblock ${at(px, floor + 10, pz)} sea_lantern`);
  }
  // Священная олива Афины и алтарь мудрости
  yield step(0, 5, `fill ${at(0, floor + 3, 5)} ${at(0, floor + 7, 5)} oak_log`);
  yield step(0, 5, `fill ${at(-2, floor + 7, 3)} ${at(2, floor + 9, 7)} azalea_leaves_flowered`);
  yield step(0, -4, `setblock ${at(0, floor + 3, -4)} chest`);
  yield step(0, -4, `loot insert ${at(0, floor + 3, -4)} loot "chests/poseidon_palace"`);
  yield step(0, -9, `fill ${at(-1, floor + 2, -10)} ${at(1, floor + 2, -8)} lapis_block`);
  lastBeacon = { x: cx, y: floor + 3, z: cz - 9 };
  yield step(0, -9, `setblock ${at(0, floor + 3, -9)} beacon`);
  yield step(0, -9, `setblock ${at(0, floor + 4, -9)} blue_stained_glass`);
}

// ======================= 5. Божественная Кузница Гефеста =======================
export const HEPHAESTUS_R = 25;
function* hephaestusSteps(cx, cz) {
  const S = HEPHAESTUS_R + 4;
  const at = (dx, y, dz) => `${cx + dx} ${y} ${cz + dz}`;
  const step = (dx, dz, cmd) => ({ x: cx + dx, z: cz + dz, cmd });
  const floor = SEA + 2;
  for (let dx = -S; dx <= S; dx++) {
    for (let dz = -S; dz <= S; dz++) {
      const r = Math.hypot(dx, dz);
      const edge = shoreEdge(cx, cz, dx, dz, HEPHAESTUS_R);
      if (r > edge) {
        if (r <= HEPHAESTUS_R + 4) {
          yield step(dx, dz, `fill ${at(dx, SEA - 2, dz)} ${at(dx, SEA, dz)} water`);
          yield step(dx, dz, `fill ${at(dx, SEA + 1, dz)} ${at(dx, SEA + 16, dz)} air`);
        }
        continue;
      }
      const stepH = r < 12 ? 2 : 0;
      const top = floor + stepH;
      yield step(dx, dz, `fill ${at(dx, 20, dz)} ${at(dx, SEA - 4, dz)} deepslate replace water`);
      yield step(dx, dz, `fill ${at(dx, SEA - 3, dz)} ${at(dx, top - 1, dz)} deepslate_bricks`);
      const isLavaChannel = (r >= 6 && r <= 7.5 && Math.abs(dx) > 2 && Math.abs(dz) > 2);
      const mat = isLavaChannel ? "lava" : (r < 12 ? (((dx + dz) & 3) === 0 ? "copper_block" : "deepslate_tiles") : "basalt");
      yield step(dx, dz, `setblock ${at(dx, top, dz)} ${mat}`);
      yield step(dx, dz, `fill ${at(dx, top + 1, dz)} ${at(dx, top + 16, dz)} air`);
    }
  }
  for (const [px, pz] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) {
    yield step(px, pz, `fill ${at(px, floor + 3, pz)} ${at(px, floor + 9, pz)} deepslate_brick_wall`);
    yield step(px, pz, `setblock ${at(px, floor + 10, pz)} shroomlight`);
  }
  // Наковальни и плавильные печи Гефеста
  yield step(0, 0, `setblock ${at(0, floor + 3, 0)} anvil`);
  yield step(-3, -5, `setblock ${at(-3, floor + 3, -5)} blast_furnace`);
  yield step(3, -5, `setblock ${at(3, floor + 3, -5)} blast_furnace`);
  yield step(0, -4, `setblock ${at(0, floor + 3, -4)} chest`);
  yield step(0, -4, `loot insert ${at(0, floor + 3, -4)} loot "chests/minotaur_lair"`);
  yield step(0, 9, `fill ${at(-1, floor, 8)} ${at(1, floor, 10)} copper_block`);
  lastBeacon = { x: cx, y: floor + 1, z: cz + 9 };
  yield step(0, 9, `setblock ${at(0, floor + 1, 9)} beacon`);
  yield step(0, 9, `setblock ${at(0, floor + 2, 9)} orange_stained_glass`);
}

// ======================= общий механизм =======================
export const ISLES = {
  minotaur: {
    key: "cb:isle_minotaur", boss: "cb:minotaur", R: MINOTAUR_R, homeR: 22, steps: minotaurSteps,
    title: T("isle.minotaur"), fog: "cb:laestry_isle", beam: "red", rise: T("isle.minotaur.rise"),
    bossAt: (isl) => ({ x: isl.x + 0.5, y: SEA + 4, z: isl.z + 0.5 }),
  },
  poseidon: {
    key: "cb:isle_poseidon", boss: "cb:poseidon", R: POSEIDON_R, homeR: 22, steps: poseidonSteps,
    title: T("isle.poseidon"), fog: "cb:hydra_isle", beam: "cyan", rise: T("isle.poseidon.rise"),
    bossAt: (isl) => ({ x: isl.x + 0.5, y: SEA - 8, z: isl.z + 0.5 }),
    extra: (dim, isl) => {
      for (const [dx, dz] of [[-4, 4], [4, 4]]) {
        try {
          const tr = dim.spawnEntity("cb:poseidon_triton", { x: isl.x + dx + 0.5, y: SEA - 8 + (isl.dy ?? ((isl.baseY ?? SEA) - SEA)), z: isl.z + dz + 0.5 });
          bind(tr, "poseidon", { x: isl.x + dx + 0.5, y: SEA - 8 + (isl.dy ?? ((isl.baseY ?? SEA) - SEA)), z: isl.z + dz + 0.5 });
        } catch {}
      }
    },
  },
  fel_lord: {
    key: "cb:isle_fel_lord", boss: "cb:fel_lord", R: FEL_LORD_R, homeR: 24, steps: felLordSteps,
    title: T("isle.fel_lord"), fog: "cb:guldan_isle", beam: "green", rise: T("isle.fel_lord.rise"),
    bossAt: (isl) => ({ x: isl.x + 0.5, y: SEA + 3, z: isl.z + 0.5 }),
    extra: (dim, isl) => {
      const y0 = SEA + 3 + (isl.dy ?? ((isl.baseY ?? SEA) - SEA));
      for (const [oid, dx, dz] of [["cb:hell_orc", -4, 4], ["cb:hell_orc", 4, 4], ["cb:green_orc", -5, -3], ["cb:green_orc", 5, -3]]) {
        try {
          const orc = dim.spawnEntity(oid, { x: isl.x + dx + 0.5, y: y0, z: isl.z + dz + 0.5 });
          bind(orc, "fel_lord", { x: isl.x + dx + 0.5, y: y0, z: isl.z + dz + 0.5 });
        } catch {}
      }
    },
  },
  lich_king: {
    key: "cb:isle_lich_king", boss: "cb:lich_king", R: LICH_R, homeR: 22, steps: lichKingSteps,
    title: T("isle.lich_king"), fog: "cb:hydra_isle", beam: "cyan", rise: T("isle.lich_king.rise"),
    bossAt: (isl) => ({ x: isl.x + 0.5, y: SEA + 6, z: isl.z + 0.5 }),
    extra: (dim, isl) => {
      for (const dx of [-4, 4]) {
        try {
          const dk = dim.spawnEntity("cb:death_knight", { x: isl.x + dx + 0.5, y: SEA + 4 + (isl.dy ?? ((isl.baseY ?? SEA) - SEA)), z: isl.z + 4.5 });
          bind(dk, "lich_king", { x: isl.x + dx + 0.5, y: SEA + 4 + (isl.dy ?? ((isl.baseY ?? SEA) - SEA)), z: isl.z + 4.5 });
        } catch {}
      }
    },
  },
  olympus: {
    key: "cb:isle_olympus", boss: "cb:zeus", R: OLYMPUS_R, homeR: 24, steps: olympusSteps,
    title: T("isle.olympus"), fog: "cb:circe_isle", beam: "yellow", rise: T("isle.olympus.rise"),
    bossAt: (isl) => ({ x: isl.x + 0.5, y: SEA + 7, z: isl.z - 2.5 }),
    extra: (dim, isl) => {
      const y0 = SEA + 7 + (isl.dy ?? ((isl.baseY ?? SEA) - SEA));
      for (const [dx, dz] of [[-4, 3], [4, 3]]) {
        try {
          const ar = dim.spawnEntity("cb:zeus_archon", { x: isl.x + dx + 0.5, y: y0, z: isl.z + dz + 0.5 });
          bind(ar, "olympus", { x: isl.x + dx + 0.5, y: y0, z: isl.z + dz + 0.5 });
        } catch {}
      }
    },
  },
  hades: {
    key: "cb:isle_hades", boss: "cb:hades", R: HADES_R, homeR: 24, steps: hadesSteps,
    title: T("isle.hades"), fog: "cb:guldan_isle", beam: "purple", rise: T("isle.hades.rise"),
    bossAt: (isl) => ({ x: isl.x + 0.5, y: SEA + 5, z: isl.z - 2.5 }),
    extra: (dim, isl) => {
      const y0 = SEA + 5 + (isl.dy ?? ((isl.baseY ?? SEA) - SEA));
      for (const [dx, dz] of [[-4, 3], [4, 3]]) {
        try {
          const sh = dim.spawnEntity("cb:hades_shade", { x: isl.x + dx + 0.5, y: y0, z: isl.z + dz + 0.5 });
          bind(sh, "hades", { x: isl.x + dx + 0.5, y: y0, z: isl.z + dz + 0.5 });
        } catch {}
      }
    },
  },
  ares: {
    key: "cb:isle_ares", boss: "cb:ares", R: ARES_R, homeR: 24, steps: aresSteps,
    title: T("isle.ares"), fog: "cb:laestry_isle", beam: "red", rise: T("isle.ares.rise"),
    bossAt: (isl) => ({ x: isl.x + 0.5, y: SEA + 3, z: isl.z + 0.5 }),
    extra: (dim, isl) => {
      const y0 = SEA + 3 + (isl.dy ?? ((isl.baseY ?? SEA) - SEA));
      for (const [dx, dz] of [[-4, 4], [4, 4]]) {
        try {
          const br = dim.spawnEntity("cb:ares_berserker", { x: isl.x + dx + 0.5, y: y0, z: isl.z + dz + 0.5 });
          bind(br, "ares", { x: isl.x + dx + 0.5, y: y0, z: isl.z + dz + 0.5 });
        } catch {}
      }
    },
  },
  athena: {
    key: "cb:isle_athena", boss: "cb:athena", R: ATHENA_R, homeR: 24, steps: athenaSteps,
    title: T("isle.athena"), fog: "cb:circe_isle", beam: "blue", rise: T("isle.athena.rise"),
    bossAt: (isl) => ({ x: isl.x + 0.5, y: SEA + 6, z: isl.z - 2.5 }),
    extra: (dim, isl) => {
      const y0 = SEA + 6 + (isl.dy ?? ((isl.baseY ?? SEA) - SEA));
      for (const [dx, dz] of [[-4, 3], [0, 5], [4, 3]]) {
        try {
          const hp = dim.spawnEntity("cb:athena_hoplite", { x: isl.x + dx + 0.5, y: y0, z: isl.z + dz + 0.5 });
          bind(hp, "athena", { x: isl.x + dx + 0.5, y: y0, z: isl.z + dz + 0.5 });
        } catch {}
      }
    },
  },
  hephaestus: {
    key: "cb:isle_hephaestus", boss: "cb:hephaestus", R: HEPHAESTUS_R, homeR: 24, steps: hephaestusSteps,
    title: T("isle.hephaestus"), fog: "cb:laestry_isle", beam: "orange", rise: T("isle.hephaestus.rise"),
    bossAt: (isl) => ({ x: isl.x + 0.5, y: SEA + 5, z: isl.z - 1.5 }),
    extra: (dim, isl) => {
      const y0 = SEA + 5 + (isl.dy ?? ((isl.baseY ?? SEA) - SEA));
      for (const [dx, dz] of [[-4, 3], [4, 3]]) {
        try {
          const gl = dim.spawnEntity("cb:hephaestus_golem", { x: isl.x + dx + 0.5, y: y0, z: isl.z + dz + 0.5 });
          bind(gl, "hephaestus", { x: isl.x + dx + 0.5, y: y0, z: isl.z + dz + 0.5 });
        } catch {}
      }
    },
  },
  guldan: {
    key: "cb:isle_guldan", boss: "cb:guldan", R: GULDAN_R, homeR: 20, steps: guldanSteps,
    title: T("isle.guldan"), fog: "cb:guldan_isle", beam: "green", rise: T("isle.guldan.rise"),
    bossAt: (isl) => ({ x: isl.x + 0.5, y: SEA + 4, z: isl.z + 0.5 }),
    extra: () => {},
  },
  hydra: {
    key: "cb:isle_hydra", boss: "cb:hydra", R: HYDRA_R, homeR: 22, steps: hydraSteps,
    title: T("isle.hydra"), fog: "cb:hydra_isle", beam: "green", rise: T("isle.hydra.rise"),
    bossAt: (isl) => ({ x: isl.x + 0.5, y: SEA + 2, z: isl.z + 0.5 }),
  },
  circe: {
    key: "cb:isle_circe", boss: "cb:circe", R: CIRCE_R, homeR: 22, steps: circeSteps,
    title: T("isle.circe"), fog: "cb:circe_isle", beam: "purple", rise: T("isle.circe.rise"),
    bossAt: (isl) => ({ x: isl.x + DOOR.x + 0.5, y: SEA + 3, z: isl.z + DOOR.z + 2.5 }),
    extra: (dim, isl) => {
      for (let k = 0; k < 5; k++) {
        const pig = dim.spawnEntity("minecraft:pig", {
          x: isl.x + PEN.x0 + 1.5 + (k % 3) * 2, y: SEA + 3 + (isl.dy ?? ((isl.baseY ?? SEA) - SEA)), z: isl.z + PEN.z0 + 1.5 + Math.floor(k / 3) * 3,
        });
        try { pig.addTag("cb_circe_pig"); } catch {}
      }
    },
  },
  laestry: {
    key: "cb:isle_laestry", boss: "cb:laestrygonian", R: LAES_R, homeR: 38, steps: laesSteps,
    title: T("isle.laestry"), fog: "cb:laestry_isle", beam: "orange", rise: T("isle.laestry.rise"),
    bossAt: (isl) => ({ x: isl.x + 0.5, y: CAMP.floor + 1, z: isl.z + 3.5 }),
    extra: (dim, isl) => {
      const total = LAES_GROUP[0] + Math.floor(Math.random() * (LAES_GROUP[1] - LAES_GROUP[0] + 1));
      for (let k = 1; k < total; k++) {
        const a = (k / total) * Math.PI * 2;
        const r = 6.5 + (k % 3);
        const home = { x: isl.x + 0.5 + Math.cos(a) * r, y: CAMP.floor + 1 + (isl.dy ?? ((isl.baseY ?? SEA) - SEA)), z: isl.z + 0.5 + Math.sin(a) * r };
        try { bind(dim.spawnEntity("cb:laestrygonian", home), "laestry", home); } catch {}
      }
    },
  },
};
const ORDER = ["hydra", "circe", "laestry", "guldan", "minotaur", "poseidon", "fel_lord", "lich_king", "olympus", "hades", "ares", "athena", "hephaestus"];

function load(key) {
  try { const r = world.getDynamicProperty(key); return typeof r === "string" ? JSON.parse(r) : undefined; } catch { return undefined; }
}
function save(key, v) {
  try { world.setDynamicProperty(key, v ? JSON.stringify(v) : undefined); } catch {}
}
const isles = Object.fromEntries(ORDER.map((id) => [id, load(ISLES[id].key)]));
let job;   // { id, gen, pending, wait }

shared.otherIslands = () => ORDER.map((id) => isles[id]).filter(Boolean);
shared.islesBusy = () => !!job;
shared.nextIsle = () => (shared.island()?.built ? ORDER.find((k) => !isles[k]) : undefined);
shared.startIsle = (id, x, z, why) => { if (!job && !isles[id]) startBuild(id, x, z, why); };
shared.isles = () => ORDER.filter((id) => isles[id]?.built).map((id) => ({ ...isles[id], id, title: ISLES[id].title }));
shared.isleTitles = () => ORDER.map((id) => ({ id, title: ISLES[id].title }));
export const isleOf = (id) => isles[id];

function allCenters(except) {
  const out = ORDER.filter((id) => id !== except && isles[id]).map((id) => isles[id]);
  const cy = shared.island();
  if (cy) out.push(cy);
  return out;
}

function startBuild(id, x, z, why) {
  const def = ISLES[id];
  const dim = overworld();
  const baseY = detectBaseY(dim, x, z);
  isles[id] = { x: Math.floor(x), z: Math.floor(z), baseY, built: false, populated: false };
  save(def.key, isles[id]);
  run(dim, `tickingarea remove cb_${id}_isle`);
  run(dim, `tickingarea add circle ${isles[id].x} ${baseY} ${isles[id].z} 5 cb_${id}_isle true`);
  job = { id, gen: def.steps(isles[id].x, isles[id].z), pending: undefined, wait: 10 };
  for (const p of playersNear(dim, { x: isles[id].x, y: SEA, z: isles[id].z }, 160)) actionBar(p, def.rise);
  console.warn(`[isles] ${id}: ${isles[id].x} ${isles[id].z} (${why})`);
}

// Кого засыпало камнем при постройке — поднимаем наверх.
function rescue(dim, id) {
  const isl = isles[id];
  for (const p of playersNear(dim, { x: isl.x, y: SEA, z: isl.z }, ISLES[id].R + 8)) {
    try {
      const l = p.location;
      const head = dim.getBlock({ x: Math.floor(l.x), y: Math.floor(l.y + 1.6), z: Math.floor(l.z) });
      if (!head || head.typeId === "minecraft:air" || WATERY(head.typeId)) continue;
      p.teleport({ x: l.x, y: l.y + 12, z: l.z }, { dimension: dim });
    } catch {}
  }
}

function tickBuild(now) {
  if (!job) return;
  if (job.wait > 0) { job.wait--; return; }
  const dim = overworld();
  if (now % 10 === 0) rescue(dim, job.id);
  for (let n = 0; n < CMDS_PER_TICK; n++) {
    const step = job.pending ?? job.gen.next().value;
    if (!step) { finish(dim, job.id); job = undefined; return; }
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
    const dy = (isles[job.id]?.baseY ?? SEA) - SEA;
    run(dim, shiftCmdY(step.cmd, dy));
  }
}

function finish(dim, id) {
  const def = ISLES[id];
  const isl = isles[id];
  const dy = (isl.baseY ?? SEA) - SEA;
  isl.built = true;
  if (lastBeacon) isl.beacon = { ...lastBeacon, y: lastBeacon.y + dy };
  save(def.key, isl);
  rescue(dim, id);
  const doPopulate = () => {
    if (isl.populated) return;
    try {
      const rawHome = def.bossAt(isl);
      const home = { x: rawHome.x, y: rawHome.y + dy, z: rawHome.z };
      const b = dim.spawnEntity(def.boss, home);
      bind(b, id, home);
      def.extra?.(dim, { ...isl, dy });
      isl.populated = true;
      save(def.key, isl);
    } catch (e) { console.warn(`[isles] populate ${id}: ${e}`); }
  };
  doPopulate();
  system.runTimeout(() => {
    doPopulate();
    if (id === "guldan") {
      run(dim, shiftCmdY(`loot insert ${isl.x} ${SEA + 5} ${isl.z - 20} loot "chests/guldan_shrine"`, dy));
    } else if (id === "hydra") {
      run(dim, shiftCmdY(`loot insert ${isl.x + HYDRA_CHEST.x} ${SEA + 2} ${isl.z + HYDRA_CHEST.z} loot "chests/hydra_lair"`, dy));
    } else if (id === "circe") {
      run(dim, shiftCmdY(`loot insert ${isl.x + CIRCE_CHEST.x} ${HOUSE.floor + 1} ${isl.z + CIRCE_CHEST.z - 1} loot "chests/circe_house"`, dy));
    } else if (id === "laestry") {
      run(dim, shiftCmdY(`loot insert ${isl.x + LAES_CHEST.x} ${CAMP.floor + 1} ${isl.z + LAES_CHEST.z} loot "chests/laestrygonian_camp"`, dy));
    } else if (id === "minotaur") {
      run(dim, shiftCmdY(`loot insert ${isl.x} ${SEA + 4} ${isl.z - 4} loot "chests/minotaur_lair"`, dy));
    } else if (id === "poseidon") {
      run(dim, shiftCmdY(`loot insert ${isl.x} ${SEA - 9} ${isl.z - 4} loot "chests/poseidon_palace"`, dy));
    } else if (id === "fel_lord") {
      run(dim, shiftCmdY(`loot insert ${isl.x} ${SEA + 3} ${isl.z - 6} loot "chests/guldan_shrine"`, dy));
    } else if (id === "lich_king") {
      run(dim, shiftCmdY(`loot insert ${isl.x} ${SEA + 6} ${isl.z - 3} loot "chests/hydra_lair"`, dy));
    } else if (id === "olympus") {
      run(dim, shiftCmdY(`loot insert ${isl.x} ${SEA + 8} ${isl.z - 4} loot "chests/poseidon_palace"`, dy));
    } else if (id === "hades") {
      run(dim, shiftCmdY(`loot insert ${isl.x} ${SEA + 5} ${isl.z - 4} loot "chests/guldan_shrine"`, dy));
    } else if (id === "ares") {
      run(dim, shiftCmdY(`loot insert ${isl.x} ${SEA + 3} ${isl.z - 4} loot "chests/minotaur_lair"`, dy));
    } else if (id === "athena") {
      run(dim, shiftCmdY(`loot insert ${isl.x} ${SEA + 6} ${isl.z - 4} loot "chests/poseidon_palace"`, dy));
    } else if (id === "hephaestus") {
      run(dim, shiftCmdY(`loot insert ${isl.x} ${SEA + 5} ${isl.z - 4} loot "chests/minotaur_lair"`, dy));
    }
  }, 12);
  system.runTimeout(() => {
    doPopulate();
    run(dim, `tickingarea remove cb_${id}_isle`);
  }, 35);
  shared.announceIsland(def.title, isl, def.beam);
}

function bind(b, id, home) {
  if (!valid(b)) return;
  try { b.addTag(HOME_TAG); b.setDynamicProperty("cb:isle", id); } catch {}
  try { b.setDynamicProperty("cb:hx", home.x); b.setDynamicProperty("cb:hy", home.y); b.setDynamicProperty("cb:hz", home.z); } catch {}
}

function searchSite() {
  if (job || shared.islandBusy()) return;
  if (!shared.island()?.built) return;   // по порядку: сначала остров Циклопа, потом Гидры, потом Цирцеи
  const id = ORDER.find((k) => !isles[k]);
  if (!id) return;
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
      if (allCenters(id).some((o) => Math.hypot(cx - o.x, cz - o.z) < ISLES_APART)) continue;
      if (isOpenOcean(dim, cx, cz)) { startBuild(id, cx, cz, "ocean found"); return; }
    }
  }
}

// Хозяин острова не уходит с него: увлёкся погоней или его унесло — возвращаем к дому.
function confine(dim) {
  let list = [];
  try { list = dim.getEntities({ tags: [HOME_TAG] }); } catch {}
  for (const b of list) {
    if (!alive(b)) continue;
    const id = b.getDynamicProperty("cb:isle");
    const isl = isles[id];
    if (!isl) continue;
    const home = { x: b.getDynamicProperty("cb:hx"), y: b.getDynamicProperty("cb:hy"), z: b.getDynamicProperty("cb:hz") };
    if (typeof home.x !== "number") continue;
    if (hdist(b.location, isl) > ISLES[id].homeR + 6) {
      try { b.teleport(home, { dimension: dim, keepVelocity: false }); } catch {}
    }
  }
}

// Босс, появившийся на чужом для себя острове, остаётся бродягой; на своём — становится хозяином.
function adopt(dim) {
  for (const id of ORDER) {
    const isl = isles[id];
    if (!isl?.built) continue;
    let list = [];
    try { list = dim.getEntities({ type: ISLES[id].boss, location: { x: isl.x, y: SEA, z: isl.z }, maxDistance: ISLES[id].R }); } catch {}
    for (const b of list) {
      if (b.getDynamicProperty("cb:isle_seen") !== undefined) continue;
      b.setDynamicProperty("cb:isle_seen", true);
      if (!b.hasTag(HOME_TAG)) bind(b, id, { ...b.location });
    }
  }
}

// «Биом»: свой туман и надпись при входе.
const inside = new Map();   // id игрока -> id острова
function atmosphere(dim) {
  for (const p of dim.getPlayers()) {
    const cur = inside.get(p.id);
    let here;
    for (const id of ORDER) {
      const isl = isles[id];
      if (!isl?.built) continue;
      const d = hdist(p.location, isl);
      if (d <= 85 && (!isl.populated || !isl.playerArrivedOnce)) {
        isl.playerArrivedOnce = true;
        const def = ISLES[id];
        let existing = [];
        try { existing = dim.getEntities({ type: def.boss, location: { x: isl.x, y: SEA, z: isl.z }, maxDistance: def.R + 24 }); } catch {}
        if (existing.length === 0) {
          try {
            const dy = (isl.baseY ?? SEA) - SEA;
            const rawHome = def.bossAt(isl);
            const home = { x: rawHome.x, y: rawHome.y + dy, z: rawHome.z };
            const b = dim.spawnEntity(def.boss, home);
            bind(b, id, home);
            def.extra?.(dim, { ...isl, dy });
            isl.populated = true;
          } catch {}
        }
        save(def.key, isl);
      }
      if (d <= ISLES[id].R + 20) here = id;
    }
    if (here === cur) continue;
    if (cur) { try { p.runCommandAsync(`fog @s remove cb_${cur}_isle`); } catch {} }
    if (here) {
      const hi = isles[here];
      if (hi.beacon && !hi.beaconGone) {
        hi.beaconGone = true;
        save(ISLES[here].key, hi);
        destroyBeacon(dim, hi.beacon, [p]);
      }
      try { p.runCommandAsync(`fog @s push ${ISLES[here].fog} cb_${here}_isle`); } catch {}
      try { p.onScreenDisplay.setTitle(" ", { subtitle: ISLES[here].title, fadeInDuration: 10, stayDuration: 50, fadeOutDuration: 20 }); } catch {}
      inside.set(p.id, here);
    } else {
      inside.delete(p.id);
    }
  }
}

try {
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "cb:isle") return;
    const p = ev.sourceEntity;
    const [what, arg] = String(ev.message ?? "").trim().split(/\s+/);
    if (ISLES[what] && arg === "here" && p) {
      if (job) { actionBar(p, T("isles.wait")); return; }
      startBuild(what, p.location.x, p.location.z, "command");
    } else if (what === "reset") {
      job = undefined;
      for (const id of ORDER) { isles[id] = undefined; save(ISLES[id].key, undefined); }
      if (p) actionBar(p, T("isles.forgotten"));
    } else if (p) {
      actionBar(p, joinWith("  ", ORDER.map((id) => T("isles.entry", ISLES[id].title, isles[id] ? `${isles[id].x} ${isles[id].z}` : T("isles.none")))));
    }
  });
} catch {}

// После перезахода: недостроенный остров достраиваем заново.
system.runTimeout(() => {
  const id = ORDER.find((k) => isles[k] && !isles[k].built);
  if (id && !job) startBuild(id, isles[id].x, isles[id].z, "finish build");
}, 120);

system.runInterval(() => {
  const now = system.currentTick;
  let dim;
  try { dim = overworld(); } catch { return; }
  try { tickBuild(now); } catch (e) { console.warn(`[isles] build: ${e}`); job = undefined; }
  if (now % 10 === 0) { try { confine(dim); adopt(dim); atmosphere(dim); } catch (e) { console.warn(`[isles] tick: ${e}`); } }
  if (now % 20 === 10) { try { searchSite(); } catch (e) { console.warn(`[isles] search: ${e}`); } }
}, 1);
