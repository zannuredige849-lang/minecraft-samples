// Общие функции для скриптов мобов.
import { world } from "@minecraft/server";

export const DIMENSIONS = ["overworld", "nether", "the_end"];

export function valid(e) {
  try {
    if (!e) return false;
    return typeof e.isValid === "function" ? e.isValid() : !!e.isValid;
  } catch {
    return false;
  }
}

export function healthOf(e) {
  try {
    return e.getComponent("minecraft:health");
  } catch {
    return undefined;
  }
}

export function alive(e) {
  if (!valid(e)) return false;
  const h = healthOf(e);
  return !h || h.currentValue > 0;
}

export const isPlayer = (e) => e?.typeId === "minecraft:player";

// Игрок в выживании или приключении (в творческом режиме и у наблюдателя — false).
export function inSurvival(p) {
  try {
    if (typeof p.getGameMode === "function") {
      const gm = String(p.getGameMode()).toLowerCase();
      return gm !== "creative" && gm !== "spectator";
    }
  } catch {}
  try {
    return !(p.matches({ gameMode: "creative" }) || p.matches({ gameMode: "spectator" }));
  } catch {
    return true;
  }
}

export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const len = (a) => Math.sqrt(dot(a, a));
export const dist = (a, b) => len(sub(a, b));
export const lerp = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });
export const smooth = (k) => k * k * (3 - 2 * k);
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const wrapDeg = (a) => ((((a + 180) % 360) + 360) % 360) - 180;

// Локальные координаты существа (вправо, вперёд, вверх) -> мировые. yaw в градусах Minecraft.
export function toWorld(origin, yaw, right, forward, up) {
  const r = (yaw * Math.PI) / 180;
  const fx = -Math.sin(r), fz = Math.cos(r); // вперёд
  const rx = -Math.cos(r), rz = -Math.sin(r); // вправо
  return {
    x: origin.x + rx * right + fx * forward,
    y: origin.y + up,
    z: origin.z + rz * right + fz * forward,
  };
}

export function fx(dim, particle, loc) {
  try {
    dim.spawnParticle(particle, loc);
  } catch {}
}

// Звук: способ зависит от версии API, поэтому пробуем по очереди.
export function sound(dim, id, loc, volume = 1, pitch = 1) {
  try {
    if (typeof dim.playSound === "function") {
      dim.playSound(id, loc, { volume, pitch });
      return;
    }
  } catch {}
  try {
    if (typeof world.playSound === "function") {
      world.playSound(id, loc, { volume, pitch });
      return;
    }
  } catch {}
  try {
    const p = `${loc.x.toFixed(2)} ${loc.y.toFixed(2)} ${loc.z.toFixed(2)}`;
    dim.runCommandAsync(`playsound ${id} @a[x=${loc.x.toFixed(0)},y=${loc.y.toFixed(0)},z=${loc.z.toFixed(0)},r=48] ${p} ${volume} ${pitch}`);
  } catch {}
}

export function playersNear(dim, loc, radius) {
  try {
    return dim.getPlayers({ location: loc, maxDistance: radius });
  } catch {
    return [];
  }
}

export function actionBar(player, text) {
  try {
    player.onScreenDisplay.setActionBar(text);
  } catch {}
}

export function safeRemove(e) {
  try {
    if (valid(e)) e.remove();
  } catch {}
}

// Мост между скриптами мобов (Циклоп ↔ Гидра). Каждый модуль заполняет свои функции.
export const shared = {
  hydraHeads: (_body) => 5,            // сколько голов живо у гидры (hydra.js)
  hydraHeadNear: (_body, _pos) => undefined, // ближайший хитбокс головы или шеи (hydra.js)
  devourHydra: (_body, _killer) => {},  // гидру съели целиком (hydra.js)
  eyeOf: (_cyclops) => undefined,       // центр глаза циклопа (cyclops.js)
  hitEye: (_cyclops, _amount, _attacker) => {}, // урон по глазу (cyclops.js)
  isBlind: (_cyclops) => false,         // (cyclops.js)
  holder: new Map(),                    // id гидры -> циклоп, который держит её в руках
  cyclopsSees: (_c, _e, _range) => false, // видит ли Циклоп цель: конус обзора и стены (cyclops.js)
  cyclopsIdle: (_c) => true,            // Циклоп не занят сценой (cyclops.js)
  forgetCyclops: (_c) => {},            // снять цель (cyclops.js)
  isProvoking: (_c) => false,           // удар — «подставной» (cyclops.js)
  isCyclopsFoe: (_e) => false,          // на кого Циклоп вообще нападает (cyclops.js)
  grudge: (_c, _a, _flock) => true,     // Циклоп запомнил обидчика: можно ли мстить (island.js)
  cyclopsBed: (_c) => undefined,        // где Циклоп спит: { x, y, z, yaw } или нет ложа (island.js)
  isSleeping: (_c) => false,            // (cyclops.js)
  island: () => undefined,              // { x, z, built } острова Циклопа (island.js)
  islandBusy: () => false,              // строится остров Циклопа (island.js)
  otherIslands: () => [],               // центры островов Гидры и Цирцеи (isles.js)
  islesBusy: () => false,               // строится остров Гидры или Цирцеи (isles.js)
  nextIsle: () => undefined,            // какой остров (hydra/circe) на очереди (isles.js)
  startIsle: (_id, _x, _z, _why) => {}, // начать постройку острова Гидры/Цирцеи (isles.js)
  isles: () => [],                      // готовые острова Гидры и Цирцеи (isles.js)
  startCyclopsIsland: (_x, _z, _why) => {}, // начать постройку острова Циклопа (island.js)
  announceIsland: (_title, _isl, _beam) => {}, // сообщить всем о новом острове (scout.js)
};

// ---------- имена боссов ----------
// Цветные имена («Циклоп», «Cyclops») лежат в самих файлах перевода (entity.cb:<босс>.name в en_US.lang и ru_RU.lang):
// бирку-имя скрипт больше не ставит, потому что бирка не переводится и показывала бы один язык всем игрокам.
// Бирки, поставленные прежними версиями, снимаются, чтобы заработал перевод; своё имя игрока (из бирки) не трогаем.
function paintName(text, colors) {
  return [...text].map((ch, i) => `${colors[i % colors.length]}${ch}`).join("");
}
export const BOSS_NAMES = {
  "cb:cyclops": paintName("Cyclops", ["§6", "§e", "§c"]),
  "cb:hydra": paintName("Hydra", ["§2", "§a", "§3"]),
  "cb:circe": paintName("Circe", ["§5", "§d", "§9"]),
  "cb:guldan": paintName("Gul'dan", ["§2", "§a", "§e"]),
  "cb:minotaur": paintName("Minotaur", ["§4", "§c", "§6"]),
  "cb:fel_lord": paintName("Fel Lord", ["§2", "§a", "§g"]),
  "cb:lich_king": paintName("Lich King", ["§b", "§3", "§9"]),
  "cb:ice_spirit": paintName("Ice Spirit", ["§b", "§f", "§3"]),
  "cb:dreadlord": paintName("Dreadlord", ["§4", "§5", "§c"]),
  "cb:zeus": paintName("Zeus", ["§e", "§f", "§b"]),
  "cb:poseidon": paintName("Poseidon", ["§3", "§b", "§9"]),
  "cb:hades": paintName("Hades", ["§8", "§b", "§5"]),
  "cb:ares": paintName("Ares", ["§4", "§c", "§6"]),
  "cb:athena": paintName("Athena", ["§e", "§6", "§b"]),
  "cb:hephaestus": paintName("Hephaestus", ["§6", "§c", "§e"]),
};
shared.bossNames = BOSS_NAMES;
const OLD_NAMES = new Set(["§6Циклоп", "§2Гидра", "§5Цирцея", "§6Cyclops", "§2Hydra", "§5Circe", ...Object.values(BOSS_NAMES),
  paintName("Циклоп", ["§6", "§e", "§c"]), paintName("Гидра", ["§2", "§a", "§3"]), paintName("Цирцея", ["§5", "§d", "§9"])]);
export function bossName(e) {
  try {
    if (!BOSS_NAMES[e?.typeId]) return;
    const cur = e.nameTag;
    if (cur && OLD_NAMES.has(cur)) e.nameTag = "";   // старая бирка прежней версии — убрать; чужие имена не трогаем
  } catch {}
}
// Бирку снимаем сразу при появлении (на случай копий со старой биркой).
try { world.afterEvents.entitySpawn?.subscribe((ev) => bossName(ev.entity)); } catch {}

// Великан на ходу ломает блоки перед собой (Циклоп — деревья, лестригоны — листву).
// reach — на сколько блоков вперёд, half — в стороны от оси, from..to — высота от ног;
// match(typeId) — что ломать. Блоки ломаются как игроком (setblock … destroy: с частицами, звуком и дропом).
export function forward(e) {
  try {
    const v = e.getViewDirection();
    const h = Math.hypot(v.x, v.z) || 1;
    return { x: v.x / h, z: v.z / h };
  } catch {}
  const r = ((e.getRotation?.().y ?? 0) * Math.PI) / 180;
  return { x: -Math.sin(r), z: Math.cos(r) };
}

export function moving(e, min = 0.02) {
  try { const v = e.getVelocity(); return Math.hypot(v.x, v.z) > min; } catch { return false; }
}

export function breakAhead(e, { reach = [1, 2], half = 1, from = 0, to = 3, match, max = 8 }) {
  const dim = e.dimension;
  const f = forward(e);
  const r = { x: f.z, z: -f.x };
  const l = e.location;
  const seen = new Set();
  let broken = 0;
  for (let d = reach[0]; d <= reach[1]; d++) {
    for (let s = -half; s <= half; s++) {
      const bx = Math.floor(l.x + f.x * d + r.x * s), bz = Math.floor(l.z + f.z * d + r.z * s);
      for (let dy = from; dy <= to; dy++) {
        const by = Math.floor(l.y) + dy;
        const key = `${bx},${by},${bz}`;
        if (seen.has(key)) continue;
        seen.add(key);
        let id;
        try { id = dim.getBlock({ x: bx, y: by, z: bz })?.typeId; } catch { continue; }
        if (!id || !match(id)) continue;
        try { dim.runCommandAsync(`setblock ${bx} ${by} ${bz} air destroy`); } catch { continue; }
        if (++broken >= max) return broken;
      }
    }
  }
  return broken;
}

export const isLeaves = (id) => id.endsWith("_leaves");
export const isTree = (id) => id.endsWith("_leaves") || id.endsWith("_log") || id.endsWith("_wood");

export function getProp(e, k) {
  try {
    return e?.getProperty?.(k);
  } catch {
    return undefined;
  }
}

// Динамическая балансировка по сложности мира (Easy / Normal / Hard):
// меняет ХП, урон, перезарядки и пороги способностей всех боссов (например, порог поедания Циклопа: 50 / 100 / 500 HP)
export function getDifficultyProfile() {
  try {
    const d = String(world.getDifficulty?.() ?? "Normal").toLowerCase();
    if (d.includes("easy")) {
      return {
        id: "easy", hpMult: 0.75, dmgMult: 0.75, cdMult: 1.30, mobToughness: 0.80,
        cyclopsEatLimit: 50, minotaurGrabLimit: 60, abilityThresholdMult: 0.75,
      };
    }
    if (d.includes("hard")) {
      return {
        id: "hard", hpMult: 1.35, dmgMult: 1.25, cdMult: 0.80, mobToughness: 1.25,
        cyclopsEatLimit: 500, minotaurGrabLimit: 250, abilityThresholdMult: 1.25,
      };
    }
  } catch {}
  return {
    id: "normal", hpMult: 1.0, dmgMult: 1.0, cdMult: 1.0, mobToughness: 1.0,
    cyclopsEatLimit: 100, minotaurGrabLimit: 120, abilityThresholdMult: 1.0,
  };
}
shared.diffDmg = (baseDmg) => Math.max(1, Math.round(baseDmg * getDifficultyProfile().dmgMult));
shared.diffCd = (baseCd) => Math.max(10, Math.round(baseCd * getDifficultyProfile().cdMult));
shared.diffHp = (baseHp) => Math.max(1, Math.round(baseHp * getDifficultyProfile().hpMult));

// Применяет масштабирование ХП босса к текущей сложности мира (Easy 0.75x / Normal 1.0x / Hard 1.35x)
export function applyBossDifficultyHp(e, baseMaxHp) {
  if (!valid(e)) return;
  const prof = getDifficultyProfile();
  try {
    const prev = e.getDynamicProperty("cb:diff_hp_mode");
    if (prev === prof.id) return;
    e.setDynamicProperty("cb:diff_hp_mode", prof.id);
    const h = healthOf(e);
    if (!h) return;
    const pct = Math.max(0.05, Math.min(1, h.currentValue / Math.max(1, h.effectiveMax)));
    // Используем health_boost для увеличения ХП на Сложном уровне и лёгкое снижение на Лёгком
    try { e.removeEffect("health_boost"); } catch {}
    if (prof.id === "hard") {
      // +35% ХП: каждый уровень health_boost даёт +4 HP; подбираем усилитель под ~35% от baseMaxHp
      const amp = Math.max(0, Math.min(25, Math.round((baseMaxHp * 0.35) / 4) - 1));
      e.addEffect("health_boost", 2000000, { amplifier: amp, showParticles: false });
      h.setCurrentValue(Math.min(h.effectiveMax, Math.round(h.effectiveMax * pct)));
    } else if (prof.id === "easy") {
      const targetMax = Math.max(10, Math.round(baseMaxHp * 0.75));
      if (h.currentValue > targetMax) h.setCurrentValue(targetMax);
    }
  } catch {}
}

// Шифры призванных юнитов: различают своих и чужих юнитов, не мешая боям между разными призывателями
export function assignSummonCipher(minion, summoner) {
  if (!valid(minion) || !valid(summoner)) return;
  const cipher = String(summoner.id);
  try {
    minion.setDynamicProperty("cb:cipher", cipher);
    minion.addTag(`cb_cipher_${cipher}`);
  } catch {}
}

export function getSummonCipher(e) {
  if (!e) return undefined;
  try {
    const c = e.getDynamicProperty("cb:cipher");
    if (typeof c === "string" && c.length > 0) return c;
  } catch {}
  try {
    const oid = e.getDynamicProperty("cb:owner_id");
    if (typeof oid === "string" && oid.length > 0) return oid;
  } catch {}
  return undefined;
}

export function sameSummonCipher(a, b) {
  const ca = getSummonCipher(a);
  const cb = getSummonCipher(b);
  return !!ca && !!cb && ca === cb;
}

export const dist2 = (a, b) => Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.z ?? 0) - (b?.z ?? 0));
export const dist3 = (a, b) => Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0), (a?.z ?? 0) - (b?.z ?? 0));
export const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
export function getDifficultyScale() {
  const p = getDifficultyProfile();
  return { id: p.id, hp: p.hpMult, dmg: p.dmgMult, cd: p.cdMult };
}
export function safePlayAnim(e, anim, opts = undefined) {
  try {
    if (valid(e) && typeof e.playAnimation === "function") e.playAnimation(anim, opts);
  } catch {}
}
