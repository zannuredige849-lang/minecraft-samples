// Русалки и сирены: пение.
//  - Обе время от времени поют (свойство cb:sing включает анимацию, звучит cb.mermaid.song / cb.siren.song,
//    над головой ноты). Когда рядом игрок — поют заметно чаще.
//  - Песня русалки безвредна.
//  - Песня сирены (такой же певучий голос, как у русалки) завораживает: игроки в радиусе песни слепнут
//    на первые 7,5 секунды песни, и всю песню их медленно тянет к сирене.
//  - На суше сирена ползёт (русалка на сушу не выходит).
//  - Подплыл к сирене ближе 10 блоков — песня обрывается, сирена с визгом нападает (событие cb:hunt,
//    атаку ведёт поведение моба). Ударили её — тоже нападает. Добыча далеко — успокаивается.
// Игроки в творческом режиме и наблюдатели песню не слышат.
import { world, system } from "@minecraft/server";
import { DIMENSIONS, valid, alive, isPlayer, inSurvival, sub, fx, sound, playersNear, actionBar } from "./util.js";
import { T } from "./i18n.js";

export const MERMAID = "cb:mermaid";
export const SIREN = "cb:siren";
const TYPES = [MERMAID, SIREN];

export const SONG_TICKS = 140;          // песня длится 7 с (как звук песни)
export const SONG_RANGE = 16;           // очарование действует в 16 блоках
export const NEAR_RANGE = 24;           // игрок «рядом» — поют чаще
export const ATTACK_RANGE = 2;          // подтянули ближе 2 блоков — сирена нападает
export const CALM_RANGE = 20;           // добыча дальше — сирена со временем успокаивается
export const CALM_AFTER = 200;          // через 10 с без добычи рядом
// пауза между песнями (тики): без игроков — 40–90 с, с игроком рядом — 10–25 с
export const GAP_ALONE = [800, 1800];
export const GAP_NEAR = [200, 500];
export const PULL_EVERY = 4;            // как часто подтягивать игрока к сирене
export const PULL_STRENGTH = 0.09;      // слабый толчок: тянет медленно
export const BLIND_TICKS = 200;         // слепота ровно 10 с (один раз за песню)
export const PULL_STOP = 2;             // ближе 2 блоков — тянуть перестаём
const PREY_TAG = "cb_siren_prey";

const states = new Map();               // id -> { singUntil, nextSong, angry, quietSince }

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function stateOf(e, now) {
  let st = states.get(e.id);
  if (!st) {
    st = { singUntil: 0, singFrom: 0, blinded: new Set(), nextSong: now + rnd(60, 400), angry: false, quietSince: now };
    states.set(e.id, st);
  }
  return st;
}

function listeners(e, range) {
  return playersNear(e.dimension, e.location, range).filter((p) => alive(p) && inSurvival(p));
}

function setSing(e, on) {
  try { if (e.getProperty("cb:sing") !== on) e.setProperty("cb:sing", on); } catch {}
}

export function startSong(e, now) {
  const st = stateOf(e, now);
  st.singUntil = now + SONG_TICKS;
  st.singFrom = now;
  st.blinded = new Set();
  setSing(e, true);
  const siren = e.typeId === SIREN;
  sound(e.dimension, siren ? "cb.siren.song" : "cb.mermaid.song", e.location, siren ? 3 : 2.5, 1);
  for (const p of listeners(e, SONG_RANGE)) {
    
  }
}

function endSong(e, st, now) {
  st.singUntil = 0;
  setSing(e, false);
  const near = listeners(e, NEAR_RANGE).length > 0;
  const gap = near ? GAP_NEAR : GAP_ALONE;
  st.nextSong = now + rnd(gap[0], gap[1]);
}

// Песня сирены: слепота на первые 7,5 с песни (один раз) и медленное притяжение к ней.
function enchant(e, now) {
  const st = stateOf(e, now);
  for (const p of listeners(e, SONG_RANGE)) {
    if (!st.blinded.has(p.id)) {
      st.blinded.add(p.id);
      try { p.addEffect("blindness", BLIND_TICKS, { amplifier: 0, showParticles: false }); } catch {}
    }
    if (now % PULL_EVERY) continue;
    const d = sub(e.location, p.location);
    const h = Math.hypot(d.x, d.z) || 1;
    if (h <= PULL_STOP) continue;                   // подошёл к сирене на 2 блока — дальше не тянем
    const up = Math.max(-0.06, Math.min(0.06, d.y * 0.02));
    try { p.applyKnockback(d.x / h, d.z / h, PULL_STRENGTH, up); } catch {}
  }
}

export function hunt(e, prey) {
  const st = stateOf(e, system.currentTick);
  if (st.angry) return;
  st.angry = true;
  st.singUntil = 0;
  setSing(e, false);
  try { prey?.addTag(PREY_TAG); } catch {}
  try { e.triggerEvent("cb:hunt"); } catch {}
  sound(e.dimension, "cb.siren.screech", e.location, 2.5, 1);
}

function calmDown(e, st, now) {
  st.angry = false;
  st.quietSince = now;
  st.nextSong = now + rnd(GAP_NEAR[0], GAP_NEAR[1]);
  try { e.triggerEvent("cb:calm_down"); } catch {}
}

function tickOne(e, now) {
  const st = stateOf(e, now);
  const siren = e.typeId === SIREN;
  if (siren) {
    const close = listeners(e, ATTACK_RANGE);
    if (close.length) {                             // подплыл ближе 10 блоков — песня обрывается, нападение
      for (const p of close) { try { p.addTag(PREY_TAG); } catch {} }
      if (!st.angry) hunt(e, close[0]);
      st.quietSince = now;
      return;
    }
    if (st.angry) {
      if (listeners(e, CALM_RANGE).length) st.quietSince = now;
      else if (now - st.quietSince >= CALM_AFTER) calmDown(e, st, now);
      return;
    }
  }
  if (st.singUntil) {
    if (now >= st.singUntil) endSong(e, st, now);
    else {
      if (siren) enchant(e, now);
      if (now % 10 === 0) fx(e.dimension, "minecraft:note_particle", { x: e.location.x, y: e.location.y + 2.6, z: e.location.z });
    }
    return;
  }
  if (now >= st.nextSong) startSong(e, now);
  // игрок подплыл, пока она молчит, — следующая песня наступит скорее
  else if (now % 20 === 0 && st.nextSong - now > GAP_NEAR[1] && listeners(e, NEAR_RANGE).length) {
    st.nextSong = now + rnd(GAP_NEAR[0], GAP_NEAR[1]);
  }
}

// ударили сирену — нападает на обидчика
world.afterEvents.entityHurt.subscribe((ev) => {
  const e = ev.hurtEntity;
  if (e?.typeId !== SIREN) return;
  const a = ev.damageSource?.damagingEntity;
  if (isPlayer(a) && inSurvival(a)) hunt(e, a);
});

world.afterEvents.entityDie.subscribe((ev) => {
  if (TYPES.includes(ev.deadEntity?.typeId)) states.delete(ev.deadEntity.id);
});

system.runInterval(() => {
  const now = system.currentTick;
  for (const id of DIMENSIONS) {
    let dim;
    try { dim = world.getDimension(id); } catch { continue; }
    for (const type of TYPES) {
      let list = [];
      try { list = dim.getEntities({ type }); } catch {}
      for (const e of list) {
        if (!valid(e) || !alive(e)) continue;
        try { tickOne(e, now); } catch (err) { console.warn(`[merfolk] ${err}`); }
      }
    }
  }
  // метка «добыча сирены» снимается с тех, кто уплыл от всех сирен
  if (now % 100 === 0) {
    let players = [];
    try { players = world.getPlayers(); } catch {}
    for (const p of players) {
      try {
        if (!p.hasTag(PREY_TAG)) continue;
        const near = p.dimension.getEntities({ type: SIREN, location: p.location, maxDistance: CALM_RANGE });
        if (!near.length) p.removeTag(PREY_TAG);
      } catch {}
    }
  }
}, 1);

