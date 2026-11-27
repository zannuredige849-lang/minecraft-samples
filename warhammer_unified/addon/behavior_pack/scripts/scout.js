import { getNearestSettlement } from "./settlements.js";
// Поиск островов и диагностика.
//  - Разведка: острова больше не ждут, пока игрок сам заплывёт в океан. Вскоре после входа
//    в мир скрипт по очереди проверяет точки вокруг точки появления (от 350 блоков и дальше,
//    по золотой спирали): на пару секунд подгружает чанки (tickingarea), смотрит, открытый ли там
//    глубокий океан, и если да — строит там следующий остров (Циклоп → Гидра → Цирцея).
//  - Найти легко:
//      · на каждом острове маяк со своим цветом луча (оранжевый, зелёный, пурпурный);
//      · о новом острове всем приходит сообщение в чат с координатами и направлением;
//      · «Компас островов» (cb:island_compass) в руке показывает ближайший остров: расстояние,
//        куда повернуть и дорожку искр в его сторону; правый клик или присесть — список всех островов.
//        Сам он не появляется — его нужно скрафтить (компас и 4 осколка аметиста крестом).
//      · по правому клику компас открывает МЕНЮ: игрок выбирает остров-цель (или «ближайший»),
//        выбор запоминается за игроком, и стрелка, надпись и дорожка искр ведут именно к нему.
//  - /scriptevent cb:check — проверка прямо в игре: работают ли скрипты и появляется ли
//    каждый моб аддона (если нет — с текстом ошибки).
//  - /scriptevent cb:scout off | on — выключить или включить разведку.
import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { valid, actionBar, shared } from "./util.js";
import { T, J, joinWith } from "./i18n.js";
import { SEA, ISLAND_MIN_SPAWN, ISLES_APART, run, loaded, isOpenOcean, spawnPoint } from "./island.js";

const SCOUT_KEY = "cb:scout";          // { k: номер следующей точки, off }
const START_DELAY = 1200;              // разведка начинается через 30 секунд после входа в мир
let nextAutoIsleTick = 1200;               // разведка начинается через 30 секунд после входа в мир
const LOAD_WAIT = 6;                  // сколько ждать подгрузки чанков точки (тики)
const LOAD_GIVE_UP = 16;
const MAX_POINTS = 800;
const AREA = "cb_scout";

const CYCLOPS_TITLE = T("isle.cyclops");
const overworld = () => world.getDimension("overworld");

function loadScout() {
  try { return JSON.parse(world.getDynamicProperty(SCOUT_KEY) ?? "null") ?? { k: 0, off: false }; } catch { return { k: 0, off: false }; }
}
function saveScout() {
  try { world.setDynamicProperty(SCOUT_KEY, JSON.stringify(scout)); } catch {}
}
const scout = loadScout();
let probe;   // { x, z, t }

// k-я точка разведки: золотая спираль от точки появления, 350…~1900 блоков
export function scoutPoint(k, sp = { x: 0, z: 0 }) {
  const a = k * 2.39996323;   // золотой угол
  const step = k % 24;
  const r = ISLAND_MIN_SPAWN + 15 + 9 * step;
  return { x: Math.round(sp.x + Math.cos(a) * r), z: Math.round(sp.z + Math.sin(a) * r) };
}

function allIslands() {
  const out = [...shared.isles()];
  const cy = shared.island();
  if (cy) out.push({ ...cy, id: "cyclops", title: CYCLOPS_TITLE });
  return out;
}
function centers() {
  const out = allIslands();
  for (const id of ["hydra", "circe", "laestry", "guldan", "minotaur", "poseidon", "fel_lord", "lich_king", "olympus", "hades", "ares", "athena", "hephaestus"]) {
    try { const raw = world.getDynamicProperty(`cb:isle_${id}`); if (raw) out.push(JSON.parse(raw)); } catch {}
  }
  return out;
}

// какой остров на очереди: Циклоп, потом Гидра, потом Цирцея
function nextIsland() {
  if (!shared.island()) return "cyclops";
  return shared.nextIsle();
}

function tickScout(now) {
  if (scout.off || now < START_DELAY || now < nextAutoIsleTick || shared.islandBusy() || shared.islesBusy()) return;
  const next = nextIsland();
  if (!next) { if (probe) { run(overworld(), `tickingarea remove ${AREA}`); probe = undefined; } return; }
  if (next === "cyclops" ? false : !shared.island()?.built) return;
  let players = [];
  try { players = world.getPlayers(); } catch {}
  if (!players.length) return;
  const dim = overworld();
  if (!probe) {
    if (scout.k >= MAX_POINTS) scout.k = 0;
    const sp = players[0] ? { x: Math.round(players[0].location.x), z: Math.round(players[0].location.z) } : spawnPoint();
    const pt = scoutPoint(scout.k++, sp);
    saveScout();
    if (centers().some((o) => Math.hypot(pt.x - o.x, pt.z - o.z) < ISLES_APART)) return;   // слишком близко к другому острову
    probe = { ...pt, t: 0 };
    run(dim, `tickingarea add circle ${pt.x} ${SEA} ${pt.z} 4 ${AREA} true`);
    return;
  }
  probe.t++;
  if (probe.t < LOAD_WAIT) return;
  if (!loaded(dim, probe.x, probe.z) && probe.t < LOAD_GIVE_UP) return;
  const ok = isOpenOcean(dim, probe.x, probe.z) || (scout.k > 28 && loaded(dim, probe.x, probe.z));
  run(dim, `tickingarea remove ${AREA}`);
  const { x, z } = probe;
  probe = undefined;
  if (!ok) return;
  nextAutoIsleTick = now + 6000; // пауза 2 минуты между автоматическим подъёмом островов (через Компас можно вызвать сразу)
  if (next === "cyclops") shared.startCyclopsIsland(x, z, "scouting");
  else shared.startIsle(next, x, z, "scouting");
}

// ---------- как найти острова ----------
const SIDES = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
function compassSide(dx, dz) {
  const deg = (Math.atan2(dx, -dz) * 180) / Math.PI;           // 0 — север (−Z), 90 — восток (+X)
  return T(`dir.${SIDES[Math.round(((deg % 360) + 360) % 360 / 45) % 8]}`);
}

shared.announceIsland = (title, isl, beam) => {
  let players = [];
  try { players = world.getPlayers(); } catch {}
  for (const p of players) {
    const dx = isl.x - p.location.x, dz = isl.z - p.location.z;
    const d = Math.round(Math.hypot(dx, dz));
    try {
      p.sendMessage(T("scout.announce", title, isl.x, isl.z, d, compassSide(dx, dz), T(`beam.${beam}`)));
    } catch {}
    try { p.playSound("ambient.weather.thunder", { volume: 0.6, pitch: 0.8 }); } catch {}
  }
};

// Направление относительно взгляда игрока.
function turnWords(p, isl) {
  const dx = isl.x - p.location.x, dz = isl.z - p.location.z;
  const to = (Math.atan2(-dx, dz) * 180) / Math.PI;            // как поворот моба: 0 — юг, 90 — запад
  let yaw = 0;
  try { yaw = p.getRotation().y; } catch {}
  let rel = ((to - yaw) % 360 + 540) % 360 - 180;              // >0 — справа
  const a = Math.abs(rel);
  const side = rel > 0 ? "right" : "left";
  if (a < 22.5) return T("turn.straight");
  if (a < 67.5) return T(`turn.ahead_${side}`);
  if (a < 112.5) return T(`turn.${side}`);
  if (a < 157.5) return T(`turn.behind_${side}`);
  return T("turn.behind");
}

export const COMPASS = "cb:island_compass";

function holdsCompass(p) {
  try {
    const eq = p.getComponent("minecraft:equippable")?.getEquipment("Mainhand");
    if (eq) return eq.typeId === COMPASS;
  } catch {}
  try {
    const inv = p.getComponent("minecraft:inventory")?.container;
    return inv?.getItem(p.selectedSlotIndex ?? 0)?.typeId === COMPASS;
  } catch {
    return false;
  }
}

function nearestIsland(p) {
  let best, bd = Infinity;
  for (const isl of allIslands().filter((i) => i.built)) {
    const d = Math.hypot(isl.x - p.location.x, isl.z - p.location.z);
    if (d < bd) { bd = d; best = isl; }
  }
  return best && { isl: best, d: bd };
}

// ---------- меню компаса: выбор острова-цели ----------
export const TARGET_KEY = "cb:compass_target";   // за игроком: id острова или "auto" (ближайший)
export const MENU_ORDER = ["cyclops", "hydra", "circe", "laestry", "guldan", "minotaur", "poseidon", "fel_lord", "lich_king", "olympus", "hades", "ares", "athena", "hephaestus"];
export const MENU_ICONS = {
  cyclops: "textures/items/cb_map_cyclops", hydra: "textures/items/cb_map_hydra",
  circe: "textures/items/cb_map_circe", laestry: "textures/items/cb_map_laestry",
  guldan: "textures/items/cb_sargeras_shard", minotaur: "textures/items/cb_map_cyclops",
  poseidon: "textures/items/cb_map_hydra", fel_lord: "textures/items/cb_sargeras_shard",
  lich_king: "textures/items/cb_map_circe", olympus: "textures/items/cb_map_laestry",
  hades: "textures/items/cb_sargeras_shard", ares: "textures/items/cb_map_cyclops",
  athena: "textures/items/cb_map_hydra", hephaestus: "textures/items/cb_map_laestry",
  auto: "textures/items/cb_island_compass", chat: "textures/items/cb_map_list",
};

export function getTarget(p) {
  try { const v = p.getDynamicProperty(TARGET_KEY); return typeof v === "string" ? v : "auto"; } catch { return "auto"; }
}
export function setTarget(p, id) {
  try { p.setDynamicProperty(TARGET_KEY, id === "auto" ? undefined : id); } catch {}
}

// Острова, о которых компас знает: построенные — с координатами, остальные — «ещё не поднялся».
function menuIslands() {
  const have = new Map(allIslands().filter((i) => i.built).map((i) => [i.id, i]));
  const titles = new Map([["cyclops", CYCLOPS_TITLE], ...(shared.isleTitles?.() ?? []).map((t) => [t.id, t.title])]);
  return MENU_ORDER.map((id) => ({ id, title: titles.get(id) ?? id, isl: have.get(id) }));
}

// Цель, к которой сейчас ведёт компас: выбранный остров (если он уже поднялся) или ближайший.
export function activeTarget(p) {
  const want = getTarget(p);
  if (want !== "auto") {
    const isl = allIslands().find((i) => i.built && i.id === want);
    if (isl) return { isl, d: Math.hypot(isl.x - p.location.x, isl.z - p.location.z), chosen: true };
  }
  const n = nearestIsland(p);
  return n && { ...n, chosen: false };
}

// Описание меню (отдельно от показа, чтобы проверять без игры). Подписи — RawMessage: язык подставляет клиент игрока.
const pre = (id, want) => (want === id ? "§l§a▶ §r" : "§r");
export function buildMenu(p) {
  const want = getTarget(p);
  const list = menuIslands();
  const buttons = [];
  const nearest = nearestIsland(p);
  buttons.push({
    id: "auto", icon: MENU_ICONS.auto,
    label: J(pre("auto", want), T("compass.nearest"), "\n§8",
      nearest ? T("compass.nearest_info", nearest.isl.title, Math.round(nearest.d)) : T("compass.none_found")),
  });
  for (const it of list) {
    if (it.isl) {
      const dx = it.isl.x - p.location.x, dz = it.isl.z - p.location.z;
      buttons.push({
        id: it.id, icon: MENU_ICONS[it.id],
        label: J(pre(it.id, want), it.title, "\n§8", T("compass.row_info", Math.round(Math.hypot(dx, dz)), compassSide(dx, dz), it.isl.x, it.isl.z)),
      });
    } else {
      buttons.push({ id: it.id, icon: MENU_ICONS[it.id], locked: true, name: T(`isle.plain.${it.id}`),
        label: J("§8", T(`isle.plain.${it.id}`), "\n§8", T("compass.locked")) });
    }
  }
  buttons.push({ id: "chat", icon: MENU_ICONS.chat, label: J("§r", T("compass.chat"), "\n§8", T("compass.chat_info")) });
  const cur = activeTarget(p);
  const body = cur
    ? J(T("compass.tracking", cur.isl.title), "\n", T(cur.chosen ? "compass.chosen" : "compass.by_nearest"), " · ", T("compass.dist", Math.round(cur.d)))
    : T("compass.no_islands_body");
  return { title: T("compass.title"), body, buttons };
}

export function applyChoice(p, btn) {
  if (!btn) return;
  if (btn.id === "chat") { listIslands(p); return; }
  if (btn.locked) {
    if (!shared.islandBusy() && !shared.islesBusy()) {
      const v = p.getViewDirection?.() ?? { x: 0, z: 1 };
      const vn = Math.hypot(v.x, v.z) || 1;
      let tx = Math.round(p.location.x + (v.x / vn) * 110);
      let tz = Math.round(p.location.z + (v.z / vn) * 110);
      for (let k = 0; k < 16; k++) {
        if (!centers().some((o) => Math.hypot(tx - o.x, tz - o.z) < ISLES_APART)) break;
        const ang = (k + 1) * 0.75;
        tx = Math.round(p.location.x + Math.cos(ang) * (115 + k * 12));
        tz = Math.round(p.location.z + Math.sin(ang) * (115 + k * 12));
      }
      if (btn.id === "cyclops") shared.startCyclopsIsland(tx, tz, "compass summon");
      else shared.startIsle(btn.id, tx, tz, "compass summon");
      setTarget(p, btn.id);
      try { p.playSound("random.orb", { volume: 0.8, pitch: 1.1 }); } catch {}
      return;
    }
    try { p.sendMessage(T("compass.not_risen", btn.name ?? T(`isle.plain.${btn.id}`))); } catch {}
    try { p.playSound("note.bass", { volume: 0.6, pitch: 0.8 }); } catch {}
    return;
  }
  setTarget(p, btn.id);
  try { p.playSound("random.orb", { volume: 0.7, pitch: 1.2 }); } catch {}
  const cur = activeTarget(p);
  try {
    p.sendMessage(btn.id === "auto" || !cur ? T("compass.set_auto") : T("compass.set", cur.isl.title, cur.isl.x, cur.isl.z));
  } catch {}
}

const menuOpen = new Set();
export async function openMenu(p, tries = 0) {
  if (!valid(p)) { menuOpen.delete(p?.id); return; }
  if (tries === 0 && menuOpen.has(p.id)) return;
  menuOpen.add(p.id);
  try {
    const m = buildMenu(p);
    const form = new ActionFormData().title(m.title).body(m.body);
    for (const b of m.buttons) form.button(b.label, b.icon);
    const res = await form.show(p);
    if (res?.canceled) {
      // игрок «занят» (чат, другое окно) — пробуем ещё раз через полсекунды; метка «меню открыто» остаётся
      if (res.cancelationReason === "UserBusy" && tries < 8) {
        system.runTimeout(() => { openMenu(p, tries + 1); }, 10);
        return;
      }
    } else {
      applyChoice(p, m.buttons[res.selection]);
    }
  } catch (e) {
    console.warn(`[compass] ${e}`);
  }
  menuOpen.delete(p.id);
}

// Дорожка искр от игрока в сторону острова.
function sparkTrail(p, isl) {
  const dx = isl.x - p.location.x, dz = isl.z - p.location.z;
  const n = Math.hypot(dx, dz) || 1;
  for (let k = 2; k <= 6; k++) {
    const at = { x: p.location.x + (dx / n) * k, y: p.location.y + 1.1 + k * 0.05, z: p.location.z + (dz / n) * k };
    try { p.spawnParticle("minecraft:endrod", at); } catch {
      try { p.dimension.spawnParticle("minecraft:endrod", at); } catch {}
    }
  }
}

function listIslands(p) {
  const list = allIslands().filter((i) => i.built);
  if (!list.length) { try { p.sendMessage(T("compass.none_yet")); } catch {} return; }
  for (const isl of list) {
    const dx = isl.x - p.location.x, dz = isl.z - p.location.z;
    try { p.sendMessage(T("compass.list_line", isl.title, isl.x, isl.z, Math.round(Math.hypot(dx, dz)), compassSide(dx, dz))); } catch {}
  }
}

// Компас островов сам не появляется — его нужно скрафтить (компас + 4 осколка аметиста).

try {
  world.afterEvents.itemUse?.subscribe((ev) => {
    if (ev.itemStack?.typeId === COMPASS && ev.source) openMenu(ev.source);
  });
} catch {}

const sneakList = new Set();
function tickCompass() {
  let players = [];
  try { players = world.getPlayers(); } catch {}
  for (const p of players) {
    if (!holdsCompass(p)) { sneakList.delete(p.id); continue; }
    if (p.dimension?.id && p.dimension.id !== "overworld" && p.dimension.id !== "minecraft:overworld") {
      actionBar(p, T("compass.overworld"));
      continue;
    }
    // присел с компасом — список всех островов (один раз за приседание)
    if (p.isSneaking && !sneakList.has(p.id)) { sneakList.add(p.id); listIslands(p); }
    if (!p.isSneaking) sneakList.delete(p.id);
    const near = activeTarget(p);
    if (!near) {
      actionBar(p, T(scout.off ? "compass.no_islands" : "compass.searching"));
      continue;
    }
    const { isl, d, chosen } = near;
    const pin = chosen ? "§e◆ " : "";
    actionBar(p, d < 40 ? T("compass.here", pin, isl.title) : T("compass.far", pin, isl.title, Math.round(d), turnWords(p, isl)));
    if (d >= 40) sparkTrail(p, isl);
  }
}

// ---------- диагностика ----------
const MOBS = ["cb:cyclops", "cb:hydra", "cb:circe", "cb:mermaid", "cb:siren", "cb:laestrygonian", "cb:ore_beetle", "cb:coal_beetle", "cb:copper_beetle", "cb:iron_beetle",
  "cb:gold_beetle", "cb:lapis_beetle", "cb:redstone_beetle", "cb:diamond_beetle", "cb:emerald_beetle", "cb:quartz_beetle",
  "cb:dragon_west", "cb:dragon_east", "cb:thunder_lizard",
  "cb:goblin", "cb:orc", "cb:green_orc", "cb:hell_orc", "cb:warg", "cb:guldan", "cb:inferno_golem", "cb:fel_minion", "cb:minotaur", "cb:fel_lord", "cb:lich_king", "cb:death_knight", "cb:ice_spirit", "cb:dreadlord", "cb:zeus", "cb:poseidon", "cb:hades", "cb:ares", "cb:athena", "cb:hephaestus", "cb:human_villager", "cb:human_civilian", "cb:smart_troll", "cb:tribal_troll", "cb:wild_troll", "cb:cannibal_troll", "cb:ice_troll", "cb:zeus_archon", "cb:hades_shade", "cb:ares_berserker", "cb:athena_hoplite", "cb:hephaestus_golem", "cb:poseidon_triton"];

export function check(p) {
  const lines = [T("check.ok")];
  const at = { x: p.location.x, y: p.location.y + 40, z: p.location.z };
  const bad = [];
  for (const id of MOBS) {
    try {
      const e = p.dimension.spawnEntity(id, at);
      if (!valid(e)) throw new Error("failed to spawn");
      try { e.remove(); } catch {}
    } catch (err) {
      bad.push(`§c${id}: ${String(err?.message ?? err).slice(0, 80)}`);
    }
  }
  lines.push(bad.length ? T("check.fail", bad.length, MOBS.length) : T("check.all", MOBS.length));
  lines.push(...bad);
  const isl = allIslands();
  lines.push(isl.length ? T("check.islands", joinWith(", ", isl.map((i) => J(i.title, `§f ${i.x} ${i.z}`)))) : T("check.none"));
  lines.push(scout.off ? T("check.scouting_off") : T("check.scouting_point", scout.k));
  for (const l of lines) { try { p.sendMessage(l); } catch {} }
  return { bad, lines };
}

try {
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    const p = ev.sourceEntity;
    if (ev.id === "cb:check" && p) check(p);
    if (ev.id === "cb:scout") {
      const arg = String(ev.message ?? "").trim();
      if (arg === "off" || arg === "on") {
        scout.off = arg === "off";
        if (scout.off && probe) { run(overworld(), `tickingarea remove ${AREA}`); probe = undefined; }
        saveScout();
        if (p) actionBar(p, T(scout.off ? "scout.off" : "scout.on"));
      }
    }
  });
} catch {}

system.runInterval(() => {
  const now = system.currentTick;
  try { tickScout(now); } catch (e) { console.warn(`[scout] ${e}`); probe = undefined; }
  if (now % 10 === 5) { try { tickCompass(); } catch {} }
}, 1);
