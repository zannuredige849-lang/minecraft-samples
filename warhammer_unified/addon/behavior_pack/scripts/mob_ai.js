// Боевой ИИ бойцов — приёмы ботов из AI Multiplayer 1.9, перенесённые на орков и лестригонов.
// Фракции и дипломатия:
//  · Зелёные орки (cb:green_orc), красные/адские орки (cb:hell_orc), орки-рабы (cb:orc с cb:slave=true) и Гул'дан (cb:guldan)
//    состоят в едином союзе Орды Скверны — они НЕ дерутся друг с другом и вместе воюют против обычных орков (cb:orc).
//  · Обычные бурые орки (cb:orc) нейтральны к игрокам и мирным мобам (защищаются только если их ударить),
//    но агрессивны к нежити (undead) и другим видам орков (зелёным, красным, рабам Скверны и Гул'дану).
//  · Красные и зелёные орки более агрессивны (атакуют игроков, обычных орков, нежить, големов, лестригонов,
//    жителей и странствующих торговцев), но НЕ трогают мирных животных.
import { world, system, ItemStack } from "@minecraft/server";
import { DIMENSIONS, valid, alive, isPlayer, inSurvival, sound, fx, healthOf, actionBar, shared, getDifficultyProfile } from "./util.js";
import { T } from "./i18n.js";
import { isRiding } from "./orcs.js";

export const FIGHTERS = {
  "cb:orc":          { family: "brown_orc", strafe: true,  jump: true,  retreat: true,  combo: "bash",  help: true },
  "cb:smart_troll":  { family: "brown_orc", strafe: true,  jump: true,  retreat: true,  combo: "bash",  help: true },
  "cb:tribal_troll": { family: "brown_orc", strafe: true,  jump: true,  retreat: false, combo: "bash",  help: true },
  "cb:green_orc":    { family: "green_orc", strafe: true,  jump: true,  retreat: true,  combo: "rend",  help: true },
  "cb:hell_orc":     { family: "hell_orc",  strafe: true,  jump: true,  retreat: true,  combo: "blast", help: true },
  "cb:fel_minion":   { family: "fel_orc",   strafe: true,  jump: true,  retreat: false, combo: "rend",  help: true },
  "cb:laestrygonian": { family: "laestrygonian", strafe: false, jump: false, retreat: false, combo: "stomp", help: false },
};

export const THINK_EVERY = 5;
export const FOE_MEMORY = 120;          // 6 с помнит врага после последнего удара
export const SEE_PLAYER = 10;           // агрессивные орки замечают врага за 10 блоков
export const FOE_FAR = 24;              // дальше этого враг забыт
export const STRAFE_MIN = 2.6;
export const STRAFE_MAX = 5.5;
export const STRAFE_PUSH = 0.30;
export const STRAFE_COOLDOWN = 24;
export const JUMP_MIN = 3.0;
export const JUMP_MAX = 4.6;
export const JUMP_COOLDOWN = 70;
export const CRIT_BONUS = 0.3;          // +30% урона удару на спуске
export const RETREAT_HP = 0.3;
export const EAT_COOLDOWN = 900;
export const HELP_COOLDOWN = 600;
export const HELP_R = 16;
export const ALERT_TICKS = 400;
export const COMBO_HITS = 3;
export const COMBO_WINDOW = 60;
export const COMBO_COOLDOWN = 200;
export const FEAR_DEATHS = 2;
export const FEAR_R = 16;
export const FEAR_TICKS = 120;
export const FEAR_HP = 0.6;
export const FOE_TAG = "cb_orc_foe";
export const POINTS_KEY = "cb:ai_points";

// Мирные животные и нейтральные существа, которых зелёные/красные орки НЕ трогают (кроме жителей и торговцев)
const PEACEFUL_MOBS = new Set([
  "minecraft:cow", "minecraft:mooshroom", "minecraft:sheep", "minecraft:pig", "minecraft:chicken",
  "minecraft:horse", "minecraft:donkey", "minecraft:mule", "minecraft:llama", "minecraft:trader_llama",
  "minecraft:rabbit", "minecraft:cat", "minecraft:ocelot", "minecraft:fox", "minecraft:panda",
  "minecraft:polar_bear", "minecraft:wolf", "minecraft:bee", "minecraft:turtle", "minecraft:frog",
  "minecraft:tadpole", "minecraft:axolotl", "minecraft:goat", "minecraft:camel", "minecraft:sniffer",
  "minecraft:armadillo", "minecraft:allay", "minecraft:strider", "minecraft:Bat", "minecraft:bat",
  "minecraft:parrot", "minecraft:squid", "minecraft:glow_squid", "minecraft:cod", "minecraft:salmon",
  "minecraft:tropical_fish", "minecraft:pufferfish", "minecraft:dolphin",
  "cb:mermaid", "cb:ore_beetle", "cb:warg", "cb:thunder_lizard",
  "cb:hex_pig", "cb:hex_sheep", "cb:hex_goat", "cb:hex_chicken", "cb:hex_horse"
]);

const UNDEAD_TYPES = new Set([
  "minecraft:zombie", "minecraft:husk", "minecraft:drowned", "minecraft:zombie_villager",
  "minecraft:skeleton", "minecraft:stray", "minecraft:bogged", "minecraft:wither_skeleton",
  "minecraft:zombified_piglin", "minecraft:zoglin", "minecraft:phantom", "minecraft:wither"
]);

export const LEVELS = [
  { pts: 0,    name: "Recruit" },
  { pts: 60,   name: "Raider" },
  { pts: 180,  name: "Veteran" },
  { pts: 400,  name: "Champion" },
  { pts: 750,  name: "Warlord" },
  { pts: 1200, name: "Legend" },
];
export const KILL_POINTS = {
  "minecraft:player": 60, "minecraft:villager": 15, "minecraft:wandering_trader": 15, "minecraft:iron_golem": 100,
  "minecraft:zombie": 12, "minecraft:husk": 12, "minecraft:skeleton": 12, "minecraft:stray": 14, "minecraft:creeper": 15,
  "minecraft:spider": 10, "minecraft:witch": 20, "minecraft:pillager": 15, "minecraft:vindicator": 30,
  "minecraft:evoker": 40, "minecraft:ravager": 60, "minecraft:piglin": 15, "minecraft:piglin_brute": 40,
  "minecraft:wolf": 6, "minecraft:enderman": 25, "minecraft:warden": 200,
  "cb:orc": 35, "cb:green_orc": 35, "cb:hell_orc": 35, "cb:laestrygonian": 90, "cb:cyclops": 200,
};
export const GEAR = {
  1: { Head: "minecraft:chainmail_helmet", Feet: "minecraft:chainmail_boots" },
  2: { Chest: "minecraft:chainmail_chestplate", Legs: "minecraft:chainmail_leggings" },
  3: { Head: "minecraft:iron_helmet", Feet: "minecraft:iron_boots" },
  4: { Chest: "minecraft:iron_chestplate" },
  5: { Head: "minecraft:iron_helmet", Chest: "minecraft:iron_chestplate", Legs: "minecraft:iron_leggings", Feet: "minecraft:iron_boots" },
};
const RANK = ["leather", "chainmail", "golden", "iron", "diamond", "netherite"];
const rankOf = (id) => { const k = RANK.findIndex((r) => String(id ?? "").includes(`_${r}`) || String(id ?? "").includes(`${r}_`)); return k; };

export const pointsOf = (e) => { try { const v = e.getDynamicProperty(POINTS_KEY); return typeof v === "number" ? v : 0; } catch { return 0; } };
export function levelOf(e) {
  const p = pointsOf(e);
  let lv = 0;
  for (let i = 0; i < LEVELS.length; i++) if (p >= LEVELS[i].pts) lv = i;
  return lv;
}

const st = new Map();
const fighters = new Set();
const deaths = [];
const alertedUntil = new Map();

const cfgOf = (e) => FIGHTERS[e?.typeId];
const isFighter = (e) => !!cfgOf(e);
function stateOf(e) {
  let s = st.get(e.id);
  if (!s) { s = { foe: undefined, until: 0, nextStrafe: 0, nextJump: 0, hits: [], nextCombo: 0, ate: -1e9, helped: -1e9, fear: 0, side: 1, push: 0 }; st.set(e.id, s); }
  return s;
}
const hpFrac = (e) => { const h = healthOf(e); return h ? h.currentValue / (h.effectiveMax || 1) : 1; };
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function isSlave(e) {
  if (!e || e.typeId !== "cb:orc") return false;
  try { return e.getProperty("cb:slave") === true || e.hasTag("cb_orc_slave"); } catch { return false; }
}

// Определение фракции:
//  - "fel_orc": cb:green_orc, cb:hell_orc, cb:guldan и порабощённые cb:orc (cb:slave === true) — союзники!
//  - "brown_orc": свободные cb:orc
//  - "laestrygonian": cb:laestrygonian
export function factionOf(e) {
  if (!e) return undefined;
  const t = e.typeId;
  if (t === "cb:green_orc" || t === "cb:hell_orc" || t === "cb:guldan" || t === "cb:fel_minion" || t === "cb:fel_lord") return "fel_orc";
  if (t === "cb:orc") return isSlave(e) ? "fel_orc" : "brown_orc";
  if (t === "cb:smart_troll" || t === "cb:tribal_troll") return "brown_orc";
  if (t === "cb:laestrygonian") return "laestrygonian";
  return undefined;
}

export function sameSide(a, b) {
  if (!a || !b) return false;
  if (a.id === b.id) return true;
  const fa = factionOf(a), fb = factionOf(b);
  if (fa && fb) return fa === fb;
  return false;
}

export function clearFoe(e) {
  const s = st.get(e?.id);
  if (s) { s.foe = undefined; s.until = 0; }
}

// ---------- враг ----------
export function setFoe(e, foe, now = system.currentTick) {
  if (!valid(foe) || foe.id === e.id || sameSide(e, foe)) return false;
  if (shared.isDancing?.(e.location, e.dimension)) return false;
  if (isPlayer(foe) && !inSurvival(foe)) return false;
  // Зелёные и красные орки не трогают мирных животных (кроме жителей и торговцев)
  const fac = factionOf(e);
  if ((fac === "fel_orc" || fac === "brown_orc") && PEACEFUL_MOBS.has(foe.typeId)) return false;
  const s = stateOf(e);
  s.foe = foe.id;
  s.until = now + FOE_MEMORY;
  return true;
}

export function foeOf(e, now) {
  if (shared.isDancing?.(e.location, e.dimension)) return undefined;
  const s = st.get(e.id);
  if (!s?.foe) return undefined;
  const foe = world.getEntity(s.foe);
  if (!foe || !alive(foe) || sameSide(e, foe) || now > s.until || flat(foe.location, e.location) > FOE_FAR || (isPlayer(foe) && !inSurvival(foe))) {
    s.foe = undefined;
    return undefined;
  }
  return foe;
}

function isUndead(e) {
  if (!e) return false;
  if (UNDEAD_TYPES.has(e.typeId)) return true;
  try { return e.getComponent("minecraft:type_family")?.hasTypeFamily?.("undead") === true; } catch { return false; }
}

function isHostileMob(e) {
  if (!e) return false;
  if (isPlayer(e) || PEACEFUL_MOBS.has(e.typeId)) return false;
  if (factionOf(e) === "fel_orc") return false;
  if (e.typeId === "minecraft:villager" || e.typeId === "minecraft:villager_v2" || e.typeId === "minecraft:wandering_trader") return false;
  try {
    const tf = e.getComponent("minecraft:type_family");
    if (tf?.hasTypeFamily?.("monster")) return true;
  } catch {}
  return false;
}

// Поиск цели по правилам дипломатии:
//  - Обычный орк (brown_orc): нейтрален к игрокам и мирным мобам (бьёт игрока только при метке cb_orc_foe),
//    но агрессивен к нежити (undead) и другим видам орков / силам Скверны (green_orc, hell_orc, orc_slave, fel_minion, guldan).
//  - Силы Скверны (fel_orc: зелёные орки, красные орки, демоны Гул'дана cb:fel_minion, рабы cb:orc):
//    дружны друг с другом (никогда не дерутся между собой), НО агрессивны к игроку, обычным оркам (brown_orc),
//    нежити (undead) и враждебным мобам (monster), не трогая мирных животных.
function isVillagerOrIllagerOrBoss(e) {
  if (!e) return false;
  const t = e.typeId;
  if (t === "minecraft:villager" || t === "minecraft:villager_v2" || t === "minecraft:wandering_trader" ||
      t === "minecraft:pillager" || t === "minecraft:vindicator" || t === "minecraft:evoker" ||
      t === "minecraft:ravager" || t === "minecraft:witch" || t === "minecraft:vex" ||
      t === "cb:cyclops" || t === "cb:hydra" || t === "cb:hydra_head" || t === "cb:circe" || t === "cb:laestrygonian" ||
      t === "cb:minotaur" || t === "cb:lich_king" || t === "cb:dreadlord" ||
      t === "cb:zeus" || t === "cb:poseidon" || t === "cb:hades" || t === "cb:ares" || t === "cb:athena" || t === "cb:hephaestus" ||
      t === "minecraft:warden" || t === "minecraft:iron_golem") return true;
  try {
    const tf = e.getComponent("minecraft:type_family");
    if (tf && (tf.hasTypeFamily?.("illager") || tf.hasTypeFamily?.("pillager") || tf.hasTypeFamily?.("villager"))) return true;
  } catch {}
  return false;
}

function spot(e, r = SEE_PLAYER) {
  const fac = factionOf(e);
  let best, bd = r + 8;
  try {
    const ents = e.dimension.getEntities({ location: e.location, maxDistance: r + 8 });
    for (const t of ents) {
      if (t.id === e.id || !alive(t) || sameSide(e, t)) continue;
      const d = flat(t.location, e.location);
      if (d >= bd) continue;

      if (fac === "brown_orc") {
        const otherFac = factionOf(t);
        const foePlayer = isPlayer(t) && inSurvival(t) && (() => { try { return t.hasTag(FOE_TAG); } catch { return false; } })();
        if (otherFac === "fel_orc" || isUndead(t) || foePlayer) {
          bd = d; best = t;
        }
      } else if (fac === "fel_orc") {
        // Зелёные орки, красные орки и демоны Гул'дана атакуют ТОЛЬКО жителей, игрока, нежить и обычных орков!
        const otherFac = factionOf(t);
        const validTarget =
          (isPlayer(t) && inSurvival(t) && d <= r + 6) ||
          isVillagerOrIllagerOrBoss(t) ||
          isUndead(t) ||
          otherFac === "brown_orc";
        if (validTarget) {
          bd = d; best = t;
        }
      } else {
        if (isPlayer(t) && inSurvival(t) && d <= r) {
          bd = d; best = t;
        }
      }
    }
  } catch {}
  return best;
}

function push(e, dx, dz, k, up = 0) {
  const n = Math.hypot(dx, dz) || 1;
  try { e.applyImpulse({ x: (dx / n) * k, y: up, z: (dz / n) * k }); return true; } catch { return false; }
}
const grounded = (e) => { try { return e.isOnGround !== false && !e.isInWater; } catch { return true; } };

export function strafe(e, foe, now) {
  const s = stateOf(e);
  if (now < s.nextStrafe || !grounded(e)) return false;
  const d = flat(foe.location, e.location);
  if (d < STRAFE_MIN || d > STRAFE_MAX) return false;
  s.nextStrafe = now + STRAFE_COOLDOWN + Math.floor(Math.random() * 12);
  s.side = -s.side;
  const dx = foe.location.x - e.location.x, dz = foe.location.z - e.location.z;
  return push(e, -dz * s.side, dx * s.side, STRAFE_PUSH, 0.05);
}

export function leap(e, foe, now) {
  const s = stateOf(e);
  if (now < s.nextJump || !grounded(e)) return false;
  const d = flat(foe.location, e.location);
  if (d < JUMP_MIN || d > JUMP_MAX) return false;
  s.nextJump = now + JUMP_COOLDOWN + Math.floor(Math.random() * 30);
  s.leapAt = now;
  return push(e, foe.location.x - e.location.x, foe.location.z - e.location.z, 0.28, 0.42);
}

export function critical(attacker, victim) {
  if (!cfgOf(attacker)?.jump || isRiding(attacker)) return false;
  let air = false;
  try { air = attacker.isOnGround === false && !attacker.isInWater; } catch {}
  if (!air) return false;
  let lead = false;
  try { lead = attacker.getProperty("cb:leader") === true; } catch {}
  const base = lead ? 5 : 3;
  try { victim.applyDamage(Math.max(1, Math.round(base * CRIT_BONUS * 2) / 2), { cause: "entityAttack", damagingEntity: attacker }); } catch { return false; }
  fx(victim.dimension, "minecraft:critical_hit_emitter", { x: victim.location.x, y: victim.location.y + 1, z: victim.location.z });
  sound(victim.dimension, "game.player.attack.critical", victim.location, 1, 1);
  return true;
}

export function eat(e, now) {
  const s = stateOf(e);
  if (now - s.ate < EAT_COOLDOWN) return false;
  s.ate = now;
  try { e.addEffect("regeneration", 80, { amplifier: 0, showParticles: true }); } catch {}
  sound(e.dimension, "random.eat", e.location, 1, 1);
  fx(e.dimension, "minecraft:heart_particle", { x: e.location.x, y: e.location.y + 2, z: e.location.z });
  return true;
}
export function fallBack(e, foe, now) {
  const s = stateOf(e);
  if (now < s.push || !grounded(e)) return false;
  const d = flat(foe.location, e.location);
  if (d > 8) return false;
  s.push = now + 10;
  return push(e, e.location.x - foe.location.x, e.location.z - foe.location.z, 0.34, 0.12);
}

export function callHelp(e, foe, now) {
  const c = cfgOf(e), s = stateOf(e);
  if (!c?.help || now - s.helped < HELP_COOLDOWN) return 0;
  s.helped = now;
  let n = 0, near = [];
  try { near = e.dimension.getEntities({ location: e.location, maxDistance: HELP_R, excludeTypes: ["minecraft:item", "minecraft:xp_orb"] }); } catch {}
  try { foe.addTag(FOE_TAG); } catch {}
  for (const o of near) {
    if (o.id === e.id || !isFighter(o) || !sameSide(e, o) || !alive(o)) continue;
    setFoe(o, foe, now);
    try { o.triggerEvent("cb:alert"); } catch {}
    try { o.addEffect("strength", 160, { amplifier: 0, showParticles: true }); } catch {}
    alertedUntil.set(o.id, now + ALERT_TICKS);
    n++;
  }
  if (n) sound(e.dimension, "cb.orc.warcry", e.location, 1.6, 1.2);
  return n;
}

export function finisher(e, victim, now) {
  const c = cfgOf(e), s = stateOf(e);
  const dx = victim.location.x - e.location.x, dz = victim.location.z - e.location.z, n = Math.hypot(dx, dz) || 1;
  const knock = (h, v) => { try { victim.applyKnockback(dx / n, dz / n, h, v); } catch {} };
  const at = { x: victim.location.x, y: victim.location.y + 0.5, z: victim.location.z };
  switch (c.combo) {
    case "bash":   knock(1.1, 0.35); try { victim.addEffect("slowness", 60, { amplifier: 1 }); } catch {} fx(victim.dimension, "minecraft:large_explosion", at); break;
    case "rend":   knock(0.5, 0.2);  try { victim.addEffect("weakness", 100, { amplifier: 0 }); } catch {} fx(victim.dimension, "minecraft:critical_hit_emitter", at); break;
    case "blast":  knock(1.0, 0.45); try { victim.setOnFire(5, true); } catch {} fx(victim.dimension, "minecraft:lava_particle", at); break;
    case "stomp":  knock(0.4, 0.9);  try { victim.addEffect("slowness", 80, { amplifier: 1 }); } catch {} fx(victim.dimension, "minecraft:large_explosion", at); break;
    default: return false;
  }
  sound(victim.dimension, c.combo === "blast" ? "random.explode" : "random.anvil_land", victim.location, 1, 0.9);
  s.hits.length = 0;
  s.nextCombo = now + COMBO_COOLDOWN;
  return true;
}
export function onHit(attacker, victim, now = system.currentTick) {
  if (!isFighter(attacker) || !valid(victim) || sameSide(attacker, victim)) return;
  if (shared.isDancing?.(attacker.location, attacker.dimension)) return;
  setFoe(attacker, victim, now);
  critical(attacker, victim);
  const s = stateOf(attacker);
  s.hits = s.hits.filter((t) => now - t <= COMBO_WINDOW);
  s.hits.push(now);
  if (s.hits.length >= COMBO_HITS && now >= s.nextCombo) finisher(attacker, victim, now);
}

export function onFighterDeath(dead, now = system.currentTick) {
  const c = cfgOf(dead);
  if (!c) return;
  const fac = factionOf(dead);
  deaths.push({ t: now, x: dead.location.x, z: dead.location.z, fac });
  while (deaths.length && now - deaths[0].t > 100) deaths.shift();
  const recent = deaths.filter((d) => d.fac === fac && Math.hypot(d.x - dead.location.x, d.z - dead.location.z) <= FEAR_R);
  if (recent.length < FEAR_DEATHS) return;
  let near = [];
  try { near = dead.dimension.getEntities({ location: dead.location, maxDistance: FEAR_R, excludeTypes: ["minecraft:item", "minecraft:xp_orb"] }); } catch {}
  const leaderNearby = near.some((o) => { try { return sameSide(dead, o) && o.getProperty("cb:leader") === true && alive(o); } catch { return false; } });
  if (leaderNearby) return;
  for (const o of near) {
    if (!isFighter(o) || !sameSide(dead, o) || !cfgOf(o).retreat || !alive(o) || hpFrac(o) > FEAR_HP) continue;
    stateOf(o).fear = now + FEAR_TICKS;
  }
}

export function award(killer, victim, now = system.currentTick) {
  if (!isFighter(killer) || !alive(killer) || !victim) return 0;
  const pts = KILL_POINTS[victim.typeId] ?? 10;
  const before = levelOf(killer);
  try { killer.setDynamicProperty(POINTS_KEY, pointsOf(killer) + pts); } catch {}
  const after = levelOf(killer);
  if (after > before) levelUp(killer, after);
  // Если рядом есть главный орк (вождь) своей стороны — он тоже получает опыт командования за победы отряда!
  try {
    for (const o of killer.dimension.getEntities({ location: killer.location, maxDistance: 24, excludeTypes: ["minecraft:item", "minecraft:xp_orb"] })) {
      if (o.id === killer.id || !alive(o) || !sameSide(killer, o)) continue;
      if (o.getProperty("cb:leader") === true) {
        const lBefore = levelOf(o);
        o.setDynamicProperty(POINTS_KEY, pointsOf(o) + Math.ceil(pts * 0.75));
        const lAfter = levelOf(o);
        if (lAfter > lBefore) levelUp(o, lAfter);
      }
    }
  } catch {}
  return pts;
}

export function levelUp(e, lv = levelOf(e)) {
  try { e.addEffect("health_boost", 1000000, { amplifier: Math.floor((lv - 1) / 2), showParticles: false }); } catch {}
  if (lv >= 3) { try { e.addEffect("strength", 1000000, { amplifier: lv >= 5 ? 1 : 0, showParticles: false }); } catch {} }
  if (lv >= 4) { try { e.addEffect("resistance", 1000000, { amplifier: 0, showParticles: false }); } catch {} }
  const eq = (() => { try { return e.getComponent("minecraft:equippable"); } catch { return undefined; } })();
  if (eq) {
    for (let k = 1; k <= Math.min(lv, 5); k++) {
      for (const [slot, id] of Object.entries(GEAR[k] ?? {})) {
        let cur;
        try { cur = eq.getEquipment(slot)?.typeId; } catch {}
        if (cur && rankOf(cur) >= rankOf(id)) continue;
        try { eq.setEquipment(slot, makeItem(id)); } catch {}
      }
    }
  }
  const h = healthOf(e);
  if (h) { try { h.setCurrentValue(Math.max(h.currentValue, Math.min(h.effectiveMax, h.effectiveMax * 0.6))); } catch {} }
  fx(e.dimension, "minecraft:totem_particle", { x: e.location.x, y: e.location.y + 1.5, z: e.location.z });
  sound(e.dimension, "random.levelup", e.location, 1, 0.8);
  try {
    for (const p of e.dimension.getPlayers({ location: e.location, maxDistance: 32 })) {
      
    }
  } catch {}
}
const RANKS = { "cb:orc": "orc", "cb:green_orc": "green_orc", "cb:hell_orc": "hell_orc", "cb:laestrygonian": "laestrygonian" };
const rankTitle = (e) => T("ai.rank." + (RANKS[e.typeId] ?? "fighter"));
function makeItem(id) {
  try { return new ItemStack(id, 1); } catch { return { typeId: id, amount: 1 }; }
}

export function isScared(e, now = system.currentTick) {
  const c = cfgOf(e);
  if (!c?.retreat) return false;
  let lead = false;
  try { lead = e.getProperty("cb:leader") === true; } catch {}
  return now < stateOf(e).fear || hpFrac(e) < (lead ? 0.15 : RETREAT_HP);
}

export function think(e, now = system.currentTick) {
  const c = cfgOf(e);
  if (!c || !alive(e)) return;
  if (shared.isDancing?.(e.location, e.dimension)) {
    clearFoe(e);
    return;
  }
  const riding = isRiding(e);
  const s = stateOf(e);
  let foe = foeOf(e, now);
  if (!foe) {
    const p = spot(e, riding ? SEE_PLAYER * 1.6 : SEE_PLAYER);
    if (p) { setFoe(e, p, now); foe = foeOf(e, now); }
  }
  if (now >= (alertedUntil.get(e.id) ?? Infinity)) {
    alertedUntil.delete(e.id);
    try { e.triggerEvent("cb:calm"); } catch {}
  }
  if (!foe) return;
  const hp = hpFrac(e);
  const isLead = (() => { try { return e.getProperty("cb:leader") === true; } catch { return false; } })();
  const scared = c.retreat && (now < s.fear || hp < (isLead ? 0.15 : RETREAT_HP));
  if (hp < RETREAT_HP) {
    eat(e, now);
    if (c.help) callHelp(e, foe, now);
  }
  if (riding) return;
  if (scared) { fallBack(e, foe, now); return; }
  if (c.jump && leap(e, foe, now)) return;
  if (c.strafe) strafe(e, foe, now);
}

function scan() {
  try {
    for (const id of Object.keys(FIGHTERS)) {
      for (const dimId of ["overworld", "nether", "the_end"]) {
        let dim;
        try { dim = world.getDimension(dimId); } catch { continue; }
        for (const e of dim.getEntities({ type: id })) fighters.add(e.id);
      }
    }
  } catch {}
}

let lastThink = -1e9, lastScan = -1e9;
function tick() {
  const now = system.currentTick;
  if (now - lastScan >= 400) { lastScan = now; scan(); }
  if (now - lastThink < THINK_EVERY) return;
  lastThink = now;
  for (const id of [...fighters]) {
    const e = world.getEntity(id);
    if (!e || !valid(e)) { fighters.delete(id); st.delete(id); alertedUntil.delete(id); continue; }
    try { think(e, now); } catch (err) { console.warn(`[mob_ai] ${err}`); }
  }
}

world.afterEvents.entitySpawn?.subscribe?.((ev) => { if (isFighter(ev.entity)) fighters.add(ev.entity.id); });
world.afterEvents.entityHurt.subscribe((ev) => {
  const v = ev.hurtEntity, a = ev.damageSource?.damagingEntity;
  if (isFighter(v)) {
    fighters.add(v.id);
    if (a && !sameSide(v, a)) {
      setFoe(v, a);
      // Если игрок или враг ударил обычного орка — бурый орк злится и зовёт соплеменников на защиту
      if (v.typeId === "cb:orc" || v.typeId === "cb:green_orc" || v.typeId === "cb:hell_orc") {
        try { a.addTag(FOE_TAG); v.triggerEvent("cb:alert"); } catch {}
        alertedUntil.set(v.id, system.currentTick + ALERT_TICKS);
      }
    }
  }
});
world.afterEvents.entityHitEntity.subscribe((ev) => {
  const a = ev.damagingEntity;
  if (isFighter(a)) { fighters.add(a.id); onHit(a, ev.hitEntity); }
});
world.afterEvents.entityDie.subscribe((ev) => {
  const dead = ev.deadEntity, killer = ev.damageSource?.damagingEntity;
  if (isFighter(dead)) onFighterDeath(dead);
  if (killer && isFighter(killer)) award(killer, dead);
});
system.runInterval(tick, 1);

// ==============================================================================
// Групповой ИИ Гоблинов (cb:goblin, 12 HP, 1 урон, нейтральные, ходят стаей и бьют обидчика всей группой)
// и динамическое масштабирование всех мобов и боссов по сложности мира (Easy / Normal / Hard)
// ==============================================================================

const goblinFoes = new Map(); // entityId -> expireTick

world.afterEvents.entityHurt.subscribe((ev) => {
  const hurt = ev.hurtEntity;
  const attacker = ev.damageSource?.damagingEntity;
  const dmg = ev.damage ?? 0;
  if (!hurt || !valid(hurt)) return;

  // 1) Групповая защита Гоблинов: если кто-то ударил гоблина, вся стая в радиусе 24 блоков бежит бить обидчика!
  if (hurt.typeId === "cb:goblin" && attacker && valid(attacker) && alive(attacker) && attacker.typeId !== "cb:goblin" && hurt.getDynamicProperty("cb:owner_id") !== attacker.id) {
    if (!isPlayer(attacker) || inSurvival(attacker)) {
      goblinFoes.set(attacker.id, system.currentTick + 500);
      try { attacker.addTag("cb_goblin_foe"); } catch {}
      let pack = [];
      try { pack = hurt.dimension.getEntities({ type: "cb:goblin", location: hurt.location, maxDistance: 24 }); } catch {}
      for (const g of pack) {
        if (!valid(g) || !alive(g)) continue;
        try { g.triggerEvent("cb:angry"); } catch {}
        const dx = attacker.location.x - g.location.x;
        const dz = attacker.location.z - g.location.z;
        const dist = Math.hypot(dx, dz) || 1;
        if (dist > 2.2 && g.isOnGround !== false) {
          try { g.applyImpulse({ x: (dx / dist) * 0.25, y: 0.08, z: (dz / dist) * 0.25 }); } catch {}
        }
      }
    }
  }

  // 2) Балансировка урона и живучести всех кастомных мобов и боссов по уровню сложности игры (Easy / Normal / Hard)
  if (dmg > 0) {
    const prof = getDifficultyProfile();
    // На Лёгкой сложности (Easy): мобы аддона наносят на 25% меньше урона игроку и получают на 20% больше урона
    if (prof.id === "easy") {
      if (attacker?.typeId?.startsWith("cb:") && isPlayer(hurt) && hurt.typeId !== "cb:goblin") {
        const refund = Math.floor(dmg * 0.25);
        if (refund >= 1) {
          const h = healthOf(hurt);
          if (h && h.currentValue > 0) { try { h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + refund)); } catch {} }
        }
      }
      if (hurt.typeId?.startsWith("cb:") && hurt.typeId !== "cb:goblin" && attacker && isPlayer(attacker)) {
        const bonus = Math.max(1, Math.floor(dmg * 0.2));
        const h = healthOf(hurt);
        if (h && h.currentValue > 1) { try { h.setCurrentValue(Math.max(1, h.currentValue - bonus)); } catch {} }
      }
    }
    // На Сложной сложности (Hard): мобы и боссы аддона наносят на 20% больше урона и на 15% крепче
    else if (prof.id === "hard") {
      if (attacker?.typeId?.startsWith("cb:") && attacker.typeId !== "cb:goblin" && dmg >= 3) {
        const extra = Math.max(1, Math.round(dmg * 0.18));
        const h = healthOf(hurt);
        if (h && h.currentValue > extra) { try { h.setCurrentValue(Math.max(1, h.currentValue - extra)); } catch {} }
      }
      if (hurt.typeId?.startsWith("cb:") && hurt.typeId !== "cb:goblin" && dmg >= 4) {
        const mitigate = Math.floor(dmg * 0.15);
        if (mitigate >= 1) {
          const h = healthOf(hurt);
          if (h && h.currentValue > 0) { try { h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + mitigate)); } catch {} }
        }
      }
    }
  }
});

// Поддержание стаи гоблинов вместе и преследование обидчика группой
system.runInterval(() => {
  const now = system.currentTick;
  for (const [fid, until] of goblinFoes) {
    if (now >= until) {
      goblinFoes.delete(fid);
      try {
        const ent = world.getEntity(fid);
        if (ent && valid(ent)) ent.removeTag("cb_goblin_foe");
      } catch {}
    }
  }

  for (const dimId of DIMENSIONS) {
    let dim;
    try { dim = world.getDimension(dimId); } catch { continue; }
    let goblins = [];
    try { goblins = dim.getEntities({ type: "cb:goblin" }); } catch { continue; }
    if (goblins.length < 2) continue;

    for (const g of goblins) {
      if (!valid(g) || !alive(g) || g.isOnGround === false) continue;
      // Если гоблин приручен — держится рядом с хозяином
      const ownerId = (() => { try { return g.getDynamicProperty("cb:owner_id"); } catch { return undefined; } })();
      if (ownerId) {
        const owner = world.getEntity(ownerId);
        if (owner && valid(owner) && alive(owner) && owner.dimension.id === dim.id) {
          const odx = owner.location.x - g.location.x, odz = owner.location.z - g.location.z;
          const odist = Math.hypot(odx, odz) || 1;
          if (odist > 26) {
            try { g.teleport({ x: owner.location.x + 1.5, y: owner.location.y, z: owner.location.z + 1.5 }, { keepVelocity: false }); } catch {}
            continue;
          } else if (odist > 6.5) {
            try { g.applyImpulse({ x: (odx / odist) * 0.18, y: 0.03, z: (odz / odist) * 0.18 }); } catch {}
          }
        }
      }
      // Если рядом есть обидчик стаи (cb_goblin_foe) — вся группа сближается с ним
      let foe;
      try {
        foe = dim.getEntities({ location: g.location, maxDistance: 20, tags: ["cb_goblin_foe"] }).find((x) => alive(x) && (!isPlayer(x) || inSurvival(x)));
      } catch {}
      if (foe) {
        const dx = foe.location.x - g.location.x, dz = foe.location.z - g.location.z;
        const dist = Math.hypot(dx, dz) || 1;
        if (dist > 2.0 && dist < 18.0) {
          try { g.applyImpulse({ x: (dx / dist) * 0.14, y: 0.02, z: (dz / dist) * 0.14 }); } catch {}
        }
        continue;
      }

      // В мирном состоянии гоблины держатся группой: если гоблин отошёл от сородичей на 8..22 блока, он подтягивается к центру группы
      let sx = 0, sz = 0, cnt = 0;
      for (const other of goblins) {
        if (other.id === g.id || !valid(other) || !alive(other)) continue;
        const d = Math.hypot(other.location.x - g.location.x, other.location.z - g.location.z);
        if (d <= 22) {
          sx += other.location.x;
          sz += other.location.z;
          cnt++;
        }
      }
      if (cnt > 0) {
        const cx = sx / cnt, cz = sz / cnt;
        const dx = cx - g.location.x, dz = cz - g.location.z;
        const dist = Math.hypot(dx, dz) || 1;
        if (dist > 7.5) {
          try { g.applyImpulse({ x: (dx / dist) * 0.11, y: 0.02, z: (dz / dist) * 0.11 }); } catch {}
        }
      }
    }
  }
}, 20);

// ==============================================================================
// Приручение Гоблина кусочком золота (minecraft:gold_nugget) и вручение ему ЛЮБОГО оружия!
// ==============================================================================
const WEAPON_DAMAGE_BONUS = {
  "minecraft:wooden_sword": 3, "minecraft:golden_sword": 3, "minecraft:stone_sword": 4,
  "minecraft:iron_sword": 5, "minecraft:diamond_sword": 6, "minecraft:netherite_sword": 7,
  "minecraft:wooden_axe": 3, "minecraft:golden_axe": 3, "minecraft:stone_axe": 4,
  "minecraft:iron_axe": 5, "minecraft:diamond_axe": 6, "minecraft:netherite_axe": 7,
  "minecraft:trident": 7, "minecraft:mace": 6, "cb:laestrygonian_sword": 6,
  "minecraft:iron_pickaxe": 3, "minecraft:diamond_pickaxe": 4, "minecraft:netherite_pickaxe": 5,
  "minecraft:iron_shovel": 2, "minecraft:diamond_shovel": 3, "minecraft:netherite_shovel": 4,
};

function isGiveableWeapon(typeId) {
  if (!typeId || typeId === "minecraft:gold_nugget") return false;
  if (WEAPON_DAMAGE_BONUS[typeId] !== undefined) return true;
  return /_sword|_axe|_pickaxe|_shovel|_hoe|mace|trident|bow|crossbow|stick|blaze_rod|bone/.test(typeId);
}

function getGoblinWeaponBonus(g) {
  let wid;
  try { wid = g.getDynamicProperty("cb:weapon_id"); } catch {}
  if (!wid) {
    try { wid = g.getComponent("minecraft:equippable")?.getEquipment("Mainhand")?.typeId; } catch {}
  }
  if (!wid) return 0;
  if (WEAPON_DAMAGE_BONUS[wid] !== undefined) return WEAPON_DAMAGE_BONUS[wid];
  if (wid.includes("netherite")) return 6;
  if (wid.includes("diamond")) return 5;
  if (wid.includes("iron")) return 4;
  if (wid.includes("stone") || wid.includes("golden")) return 3;
  return 2;
}

const goblinInteractDebounce = new Map();

function handleGoblinInteract(player, goblin, itemStack) {
  if (!player || !goblin || goblin.typeId !== "cb:goblin" || !valid(goblin) || !alive(goblin)) return;
  const now = system.currentTick;
  if (now - (goblinInteractDebounce.get(player.id) ?? -20) < 6) return;
  goblinInteractDebounce.set(player.id, now);

  let held = itemStack;
  try {
    if (!held) held = player.getComponent("minecraft:equippable")?.getEquipment("Mainhand");
  } catch {}
  if (!held) return;
  const itemId = held.typeId;

  // 1) Приручение кусочком золота (minecraft:gold_nugget)
  if (itemId === "minecraft:gold_nugget") {
    const curOwner = (() => { try { return goblin.getDynamicProperty("cb:owner_id"); } catch { return undefined; } })();
    if (curOwner === player.id) {
      // Лечение уже прирученного гоблина кусочком золота
      const h = healthOf(goblin);
      if (h && h.currentValue < h.effectiveMax) {
        try { h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + 4)); } catch {}
        fx(goblin.dimension, "minecraft:heart_particle", { x: goblin.location.x, y: goblin.location.y + 1.4, z: goblin.location.z });
        sound(goblin.dimension, "random.eat", goblin.location, 1.0, 1.2);
      }
      return;
    }
    try {
      goblin.setDynamicProperty("cb:owner_id", player.id);
      goblin.addTag("cb_tamed_goblin");
      goblin.triggerEvent("cb:on_tame");
      const h = healthOf(goblin);
      if (h) h.setCurrentValue(h.effectiveMax);
      goblin.nameTag = "";
    } catch {}
    if (inSurvival(player)) {
      try {
        const eq = player.getComponent("minecraft:equippable");
        if (held.amount > 1) {
          held.amount -= 1;
          eq?.setEquipment("Mainhand", held);
        } else {
          eq?.setEquipment("Mainhand", undefined);
        }
      } catch {}
    }
    for (let i = 0; i < 6; i++) {
      fx(goblin.dimension, "minecraft:heart_particle", {
        x: goblin.location.x + (Math.random() - 0.5) * 0.8,
        y: goblin.location.y + 1.0 + Math.random() * 0.8,
        z: goblin.location.z + (Math.random() - 0.5) * 0.8
      });
    }
    sound(goblin.dimension, "random.orb", goblin.location, 1.2, 1.3);
    actionBar(player, "§aГоблин приручен!");
    return;
  }

  // 2) Передача Гоблину ЛЮБОГО оружия из руки игрока
  if (isGiveableWeapon(itemId)) {
    const weaponClone = new ItemStack(itemId, 1);
    try {
      const prevWid = goblin.getDynamicProperty("cb:weapon_id");
      if (prevWid && inSurvival(player)) {
        try { goblin.dimension.spawnItem(new ItemStack(prevWid, 1), { x: goblin.location.x, y: goblin.location.y + 0.8, z: goblin.location.z }); } catch {}
      }
    } catch {}

    try {
      const geq = goblin.getComponent("minecraft:equippable");
      geq?.setEquipment("Mainhand", weaponClone);
    } catch {}
    try {
      goblin.runCommandAsync(`replaceitem entity @s slot.weapon.mainhand 0 ${itemId} 1`);
    } catch {}
    try { goblin.setDynamicProperty("cb:weapon_id", itemId); } catch {}

    if (inSurvival(player)) {
      try {
        const peq = player.getComponent("minecraft:equippable");
        if (held.amount > 1) {
          held.amount -= 1;
          peq?.setEquipment("Mainhand", held);
        } else {
          peq?.setEquipment("Mainhand", undefined);
        }
      } catch {}
    }
    sound(goblin.dimension, "armor.equip_iron", goblin.location, 1.2, 1.15);
    fx(goblin.dimension, "minecraft:villager_happy", { x: goblin.location.x, y: goblin.location.y + 1.3, z: goblin.location.z });
    actionBar(player, "§eОружие выдано");
  }
}

try {
  world.beforeEvents?.playerInteractWithEntity?.subscribe?.((ev) => {
    if (ev.target?.typeId !== "cb:goblin") return;
    const p = ev.player;
    const it = ev.itemStack;
    if (it && isGiveableWeapon(it.typeId)) {
      ev.cancel = true;
      system.run(() => handleGoblinInteract(p, ev.target, it));
    } else if (it && it.typeId === "minecraft:gold_nugget") {
      system.run(() => handleGoblinInteract(p, ev.target, it));
    }
  });
} catch {}

// Дополнительный урон от выданного оружия у Гоблина и защита хозяина прирученными гоблинами
world.afterEvents.entityHitEntity.subscribe((ev) => {
  const a = ev.damagingEntity;
  const v = ev.hitEntity;
  if (!a || !v || !valid(v)) return;

  if (a.typeId === "cb:goblin" && alive(v)) {
    const bonus = getGoblinWeaponBonus(a);
    if (bonus > 0) {
      try { v.applyDamage(bonus, { cause: "entityAttack", damagingEntity: a }); } catch {}
    }
  }

  // Если игрок ударил врага (не другого прирученного гоблина), прирученные гоблины игрока атакуют эту цель!
  if (isPlayer(a) && v.typeId !== "cb:goblin" && alive(v)) {
    let myGoblins = [];
    try {
      myGoblins = a.dimension.getEntities({ type: "cb:goblin", location: a.location, maxDistance: 24 })
        .filter((g) => valid(g) && alive(g) && g.getDynamicProperty("cb:owner_id") === a.id);
    } catch {}
    if (myGoblins.length > 0) {
      goblinFoes.set(v.id, system.currentTick + 400);
      try { v.addTag("cb_goblin_foe"); } catch {}
      for (const g of myGoblins) {
        try { g.triggerEvent("cb:angry"); } catch {}
      }
    }
  }
});

// Подчинение всей Орды Скверны (Гул'Дан, зелёные и красные орки, демоны Скверны) Повелителю Скверны — Маннороту!
shared.commandFelLegion = (mannoroth, target, now = system.currentTick) => {
  if (!mannoroth || !valid(mannoroth)) return;
  const dim = mannoroth.dimension;
  const mloc = mannoroth.location;
  let ents = [];
  try { ents = dim.getEntities({ location: mloc, maxDistance: 36 }); } catch { return; }
  for (const ally of ents) {
    if (!ally || ally.id === mannoroth.id || !valid(ally) || !alive(ally)) continue;
    const tid = ally.typeId;
    const isFollower = tid === "cb:green_orc" || tid === "cb:hell_orc" || tid === "cb:fel_minion" || tid === "cb:guldan" || isSlave(ally);
    if (!isFollower) continue;

    if (target && valid(target) && alive(target) && factionOf(target) !== "fel_orc" && target.typeId !== "cb:fel_lord") {
      if (tid === "cb:guldan") {
        shared.commandGuldan?.(ally, target, now);
      } else {
        fighters.add(ally.id);
        setFoe(ally, target, now);
        try { ally.triggerEvent("cb:alert"); } catch {}
        alertedUntil.set(ally.id, now + ALERT_TICKS);
      }
      const dx = target.location.x - ally.location.x, dz = target.location.z - ally.location.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d > 3.2 && d < 28 && grounded(ally) && now % 10 === 0) {
        push(ally, dx, dz, 0.20, 0.04);
      }
    } else {
      // Вне боя Гул'Дан, зелёные и красные орки и демоны сопровождают Маннорота, держась в 5..12 блоках от него
      const dx = mloc.x - ally.location.x, dz = mloc.z - ally.location.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d > 11.0 && d < 36.0 && grounded(ally)) {
        push(ally, dx, dz, 0.16, 0.03);
      }
    }
  }
};
