// Орки сами управляют зверями, на которых едут (варги, громовые ящерицы).
//  - Есть враг (ищет боевой ИИ орка: игрок рядом, обидчик, тот, кого ударил): собственный «ум» зверя отключается
//    (событие cb:steer_on снимает группу cb:free), и скрипт ведёт зверя к врагу: рывки по земле, поворот мордой
//    на цель, прыжок через ступеньку, если упёрся. Испуганный орк (мало здоровья, гибель своих) уводит зверя прочь.
//  - Зверь кусает врага сам (варг 5, ящерица 7), когда подошёл на 2,4 блока, не чаще раза в секунду.
//  - Орк в седле бьёт оружием тех, кто в 3,2 блока: урон как у пешего (3, предводитель 5), не чаще раза в 0,75 с.
//  - Цели нет или орк слез — cb:steer_off возвращает зверю собственное поведение.
import { world, system } from "@minecraft/server";
import { valid, alive, sound, fx } from "./util.js";
import { mountOf, ridingOrcs } from "./orcs.js";
import { foeOf, isScared } from "./mob_ai.js";

export const STEER_EVERY = 2;
export const SPEED = { "cb:warg": 0.12, "cb:thunder_lizard": 0.10 };   // рывок за 2 тика
export const BITE = { "cb:warg": 5, "cb:thunder_lizard": 7 };
export const BITE_R = 2.4;
export const BITE_COOLDOWN = 20;
export const SWING_R = 3.2;
export const SWING_COOLDOWN = 15;
export const STOP_DIST = 1.6;
export const HOP = 0.42;

const st = new Map();         // id зверя -> { orc, steering, nextBite, nextSwing, last }

function stateOf(m) {
  let s = st.get(m.id);
  if (!s) { s = { orc: undefined, steering: false, nextBite: 0, nextSwing: 0, last: undefined, stuck: 0 }; st.set(m.id, s); }
  return s;
}
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function release(m, s) {
  if (!s.steering) return;
  s.steering = false;
  try { m.triggerEvent("cb:steer_off"); } catch {}
}

function push(m, dx, dz, k, up = 0) {
  const n = Math.hypot(dx, dz) || 1;
  try { m.applyImpulse({ x: (dx / n) * k, y: up, z: (dz / n) * k }); } catch {}
}

export function steer(orc, now = system.currentTick) {
  const m = mountOf(orc);
  if (!m || !SPEED[m.typeId]) return false;
  const s = stateOf(m);
  s.orc = orc.id;
  const foe = foeOf(orc, now);
  if (!foe || !alive(foe)) { release(m, s); return false; }
  if (!s.steering) { s.steering = true; try { m.triggerEvent("cb:steer_on"); } catch {} }
  const dx = foe.location.x - m.location.x, dz = foe.location.z - m.location.z, d = Math.hypot(dx, dz);
  const scared = isScared(orc, now);
  // повернуть морду к цели (или от неё)
  if (now % 10 === 0) {
    try { m.teleport(m.location, { facingLocation: scared ? { x: m.location.x - dx, y: m.location.y, z: m.location.z - dz } : foe.location }); } catch {}
  }
  const moved = s.last ? flat(m.location, s.last) : 1;
  s.last = { x: m.location.x, z: m.location.z };
  const grounded = (() => { try { return m.isOnGround !== false; } catch { return true; } })();
  if (scared) {
    push(m, -dx, -dz, SPEED[m.typeId]);
  } else if (d > STOP_DIST) {
    // упёрся в ступеньку — прыжок
    s.stuck = moved < 0.02 && grounded ? s.stuck + 1 : 0;
    push(m, dx, dz, SPEED[m.typeId], s.stuck >= 3 && grounded ? HOP : 0);
    if (s.stuck >= 3) s.stuck = 0;
  }
  if (!scared && d <= BITE_R && now >= s.nextBite) {
    s.nextBite = now + BITE_COOLDOWN;
    try { foe.applyDamage(BITE[m.typeId], { cause: "entityAttack", damagingEntity: m }); } catch {}
    try { foe.applyKnockback(dx / (d || 1), dz / (d || 1), 0.5, 0.25); } catch {}
    sound(m.dimension, m.typeId === "cb:warg" ? "mob.wolf.growl" : "cb.lizard.ram", foe.location, 1, 1);
  }
  if (!scared && d <= SWING_R && now >= s.nextSwing) {
    s.nextSwing = now + SWING_COOLDOWN;
    let lead = false;
    try { lead = orc.getProperty("cb:leader") === true; } catch {}
    try { foe.applyDamage(lead ? 5 : 3, { cause: "entityAttack", damagingEntity: orc }); } catch {}
    fx(foe.dimension, "minecraft:critical_hit_emitter", { x: foe.location.x, y: foe.location.y + 1, z: foe.location.z });
  }
  return true;
}

function tick() {
  const now = system.currentTick;
  if (now % STEER_EVERY) return;
  for (const id of ridingOrcs()) {
    const orc = world.getEntity(id);
    if (!orc || !valid(orc) || !alive(orc)) continue;
    try { steer(orc, now); } catch (e) { console.warn(`[mounts] ${e}`); }
  }
  // зверь остался без орка (слез, погиб) — вернуть ему собственное поведение
  for (const [mid, s] of st) {
    const m = world.getEntity(mid);
    if (!m || !valid(m)) { st.delete(mid); continue; }
    const orc = s.orc ? world.getEntity(s.orc) : undefined;
    if (s.steering && (!orc || !valid(orc) || !alive(orc) || mountOf(orc)?.id !== mid)) { release(m, s); s.orc = undefined; }
  }
}

system.runInterval(tick, 1);
