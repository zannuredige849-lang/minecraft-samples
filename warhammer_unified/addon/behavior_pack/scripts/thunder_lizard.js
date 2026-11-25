// Громовая ящерица:
// 1. Разгон под седоком, топтание врагов на бегу и удар о землю после прыжка.
// 2. ОТВЕТНОЕ БОДАНИЕ (бодается в ответ): если любое существо или игрок ударит ящерицу,
//    она немедленно разворачивается, разгоняется и бодает обидчика рогом с отбросом!
// 3. МЕСТЬ ЗА ХОЗЯИНА (мстит за своего хозяина): запоминает своего хозяина (приручившего игрока,
//    седока или орка-наездника). Если хозяина ударили, хозяин атакует врага или хозяин погиб,
//    громовая ящерица яростно несётся на врага и таранит/бодает его рогом!
import { world, system } from "@minecraft/server";
import { valid, alive, sound, isPlayer, inSurvival } from "./util.js";

export const LIZARD = "cb:thunder_lizard";
export const CHARGE_TICKS = 24;     // 1,2 с разгона
export const COOLDOWN = 60;         // 3 с передышки
export const DAMAGE = 4;
export const HEADBUTT_DAMAGE = 6;   // Урон от ответного бодания и мести за хозяина
export const REACH = 2.4;
export const TRAMPLE_DAMAGE = 3;
export const TRAMPLE_SPEED = 0.12;
export const TRAMPLE_COOLDOWN = 10;
export const TRAMPLE_REACH = 1.9;
export const SLAM_DAMAGE = 4;
export const SLAM_R = 3;
export const JUMP_UP = 0.62;
export const JUMP_FORWARD = 0.22;
export const JUMP_COOLDOWN = 24;
export const SLAM_AIR = 5;

const state = new Map(); // id -> { until, ready, hit:Set, ridden, player, last, air, trampled:Map, ownerId, revengeTargetId, revengeUntil, nextHeadbutt }

function getState(e) {
  let st = state.get(e.id);
  if (!st) {
    st = {
      until: 0,
      ready: 0,
      hit: new Set(),
      ridden: false,
      player: false,
      last: undefined,
      air: 0,
      trampled: new Map(),
      ownerId: undefined,
      revengeTargetId: undefined,
      revengeUntil: 0,
      nextHeadbutt: 0
    };
    try {
      const savedOwner = e.getDynamicProperty("cb:owner_id");
      if (typeof savedOwner === "string") st.ownerId = savedOwner;
    } catch {}
    state.set(e.id, st);
  }
  return st;
}

export function setLizardOwner(lizard, owner) {
  if (!lizard || !valid(lizard) || !owner || !valid(owner)) return;
  const st = getState(lizard);
  st.ownerId = owner.id;
  try {
    lizard.setDynamicProperty("cb:owner_id", owner.id);
  } catch {}
}

export function getLizardOwnerId(lizard) {
  const st = getState(lizard);
  if (st.ownerId) return st.ownerId;
  try {
    const saved = lizard.getDynamicProperty("cb:owner_id");
    if (typeof saved === "string") {
      st.ownerId = saved;
      return saved;
    }
  } catch {}
  try {
    const tame = lizard.getComponent("minecraft:tameable");
    if (tame?.tamedToPlayerId) {
      st.ownerId = tame.tamedToPlayerId;
      lizard.setDynamicProperty("cb:owner_id", st.ownerId);
      return st.ownerId;
    }
  } catch {}
  return undefined;
}

export function assignLizardRevenge(lizard, foe, durationTicks = 400) {
  if (!lizard || !valid(lizard) || !foe || !valid(foe)) return;
  if (foe.id === lizard.id) return;
  const ownerId = getLizardOwnerId(lizard);
  if (ownerId && foe.id === ownerId) return;
  if (isPlayer(foe) && !inSurvival(foe)) return;

  const st = getState(lizard);
  st.revengeTargetId = foe.id;
  st.revengeUntil = system.currentTick + durationTicks;
  try {
    lizard.triggerEvent("cb:start_charge");
  } catch {}
  sound(lizard.dimension, "cb.lizard.charge", lizard.location, 1.4, 0.95);
}

function riderOf(e) {
  try {
    const r = e.getComponent("minecraft:rideable")?.getRiders?.() ?? [];
    return r.find((x) => valid(x));
  } catch { return undefined; }
}

function forward(e) {
  try {
    const v = e.getViewDirection();
    const h = Math.hypot(v.x, v.z) || 1;
    return { x: v.x / h, z: v.z / h };
  } catch { return { x: 0, z: 1 }; }
}

const hostile = (e, t, rider) => t.id !== e.id && (!rider || t.id !== rider.id) && alive(t) && t.typeId !== "minecraft:item"
  && t.typeId !== "minecraft:xp_orb" && t.typeId !== e.typeId && !(isPlayer(t) && !inSurvival(t));

// Топчет всех на пути: пока ящерица бежит быстрее TRAMPLE_SPEED, каждый перед мордой получает урон.
export function trample(e, rider, st, now, speed) {
  if (speed < TRAMPLE_SPEED) return 0;
  const f = forward(e);
  let n = 0, near = [];
  try { near = e.dimension.getEntities({ location: e.location, maxDistance: TRAMPLE_REACH + 1 }); } catch {}
  for (const t of near) {
    if (!hostile(e, t, rider) || now - (st.trampled.get(t.id) ?? -1e9) < TRAMPLE_COOLDOWN) continue;
    const dx = t.location.x - e.location.x, dz = t.location.z - e.location.z, d = Math.hypot(dx, dz);
    if (d > TRAMPLE_REACH || (d > 0.01 && (dx * f.x + dz * f.z) / d < 0.2)) continue;
    st.trampled.set(t.id, now);
    try { t.applyDamage(TRAMPLE_DAMAGE, { cause: "entityAttack", damagingEntity: rider ?? e }); } catch { continue; }
    try { t.applyKnockback(f.x, f.z, 0.9, 0.3); } catch {}
    sound(e.dimension, "cb.lizard.ram", t.location, 1, 1.2);
    n++;
  }
  return n;
}

// Приземление после прыжка: удар о землю.
export function slam(e, rider) {
  let n = 0, near = [];
  try { near = e.dimension.getEntities({ location: e.location, maxDistance: SLAM_R }); } catch {}
  for (const t of near) {
    if (!hostile(e, t, rider)) continue;
    const dx = t.location.x - e.location.x, dz = t.location.z - e.location.z, d = Math.hypot(dx, dz) || 1;
    try { t.applyDamage(SLAM_DAMAGE, { cause: "entityAttack", damagingEntity: rider ?? e }); } catch { continue; }
    try { t.applyKnockback(dx / d, dz / d, 1.1, 0.5); } catch {}
    n++;
  }
  try { e.dimension.spawnParticle("minecraft:large_explosion", { x: e.location.x, y: e.location.y + 0.3, z: e.location.z }); } catch {}
  sound(e.dimension, "cb.lizard.ram", e.location, 1.6, 0.7);
  return n;
}

export function jump(e, rider, st, now, onGround) {
  let wants = false;
  try { wants = rider.isJumping === true; } catch {}
  if (!wants || !onGround || now < (st.nextJump ?? 0)) return false;
  let vy = 0;
  try { vy = e.getVelocity?.().y ?? 0; } catch {}
  if (vy > 0.15) return false;
  st.nextJump = now + JUMP_COOLDOWN;
  const f = forward(rider);
  try { e.applyImpulse({ x: f.x * JUMP_FORWARD, y: JUMP_UP, z: f.z * JUMP_FORWARD }); } catch { return false; }
  sound(e.dimension, "cb.lizard.charge", e.location, 1, 1.4);
  return true;
}

// Ответное бодание и месть за хозяина (когда ящерица без седока или защищает/мстит за хозяина)
function tickRetaliationAndRevenge(e, st, now) {
  if (!st.revengeTargetId || now >= st.revengeUntil) {
    if (st.revengeTargetId) {
      st.revengeTargetId = undefined;
      try { e.triggerEvent("cb:end_charge"); } catch {}
    }
    return;
  }
  const foe = world.getEntity(st.revengeTargetId);
  if (!foe || !valid(foe) || !alive(foe) || foe.dimension.id !== e.dimension.id) {
    st.revengeTargetId = undefined;
    try { e.triggerEvent("cb:end_charge"); } catch {}
    return;
  }

  const dx = foe.location.x - e.location.x;
  const dz = foe.location.z - e.location.z;
  const d = Math.hypot(dx, dz);
  if (d > 28) {
    st.revengeTargetId = undefined;
    try { e.triggerEvent("cb:end_charge"); } catch {}
    return;
  }

  const nx = dx / Math.max(0.1, d);
  const nz = dz / Math.max(0.1, d);
  const yaw = Math.atan2(-nx, nz) * (180 / Math.PI);
  try {
    e.setRotation({ x: 0, y: yaw });
    if (d > 2.1 && now % 2 === 0) {
      e.applyImpulse({ x: nx * 0.16, y: e.isOnGround ? 0.05 : 0, z: nz * 0.16 });
    }
  } catch {}

  // Бодание рогом при сближении!
  if (d <= 2.8 && now >= st.nextHeadbutt) {
    st.nextHeadbutt = now + 18; // Бодает каждые 0.9 с
    try {
      e.playAnimation("animation.cb_thunder_lizard.charge");
      e.playAnimation("animation.cb_thunder_lizard.bite");
    } catch {}
    try {
      foe.applyDamage(HEADBUTT_DAMAGE, { cause: "entityAttack", damagingEntity: e });
      foe.applyKnockback(nx, nz, 2.4, 0.48);
    } catch {}
    sound(e.dimension, "cb.lizard.ram", foe.location, 1.4, 0.95);
    try {
      e.dimension.spawnParticle("minecraft:critical_hit_emitter", {
        x: foe.location.x,
        y: foe.location.y + 1.0,
        z: foe.location.z
      });
    } catch {}
  }
}

export function tickLizard(e, now) {
  const st = getState(e);
  const rider = riderOf(e);

  // Запомнить седока (игрока или орка) как хозяина ящерицы
  if (rider) {
    setLizardOwner(e, rider);
  } else {
    getLizardOwnerId(e);
  }

  if (rider && !st.ridden) { st.ridden = true; try { e.triggerEvent("cb:ridden_on"); } catch {} }
  if (!rider && st.ridden) { st.ridden = false; st.air = 0; try { e.triggerEvent("cb:ridden_off"); } catch {} }

  const byPlayer = !!rider && isPlayer(rider);
  if (byPlayer && !st.player) { st.player = true; try { e.triggerEvent("cb:player_ride_on"); } catch {} }
  if (!byPlayer && st.player) { st.player = false; try { e.triggerEvent("cb:player_ride_off"); } catch {} }

  const speed = st.last ? Math.hypot(e.location.x - st.last.x, e.location.z - st.last.z) : 0;
  st.last = { x: e.location.x, z: e.location.z };

  if (rider) {
    let onGround = true;
    try { onGround = e.isOnGround !== false; } catch {}
    if (!onGround) st.air++;
    else {
      if (st.air >= SLAM_AIR) slam(e, rider);
      st.air = 0;
    }
    if (byPlayer) jump(e, rider, st, now, onGround);
    trample(e, rider, st, now, speed);
    for (const [id, t] of st.trampled) if (now - t > 100) st.trampled.delete(id);
  } else {
    // Без седока: выполняем ответное бодание и месть за хозяина
    tickRetaliationAndRevenge(e, st, now);
  }

  const charging = now < st.until;
  if (!charging && st.until) {
    st.until = 0;
    if (!st.revengeTargetId) {
      try { e.triggerEvent("cb:end_charge"); } catch {}
    }
  }
  if (!rider) return;
  if (!charging && now >= st.ready && rider.isSprinting) {
    st.until = now + CHARGE_TICKS;
    st.ready = now + CHARGE_TICKS + COOLDOWN;
    st.hit = new Set();
    try { e.triggerEvent("cb:start_charge"); } catch {}
    sound(e.dimension, "cb.lizard.charge", e.location, 1.5, 1);
  }
  if (now >= st.until) return;
  const f = forward(e);
  try { e.applyImpulse?.({ x: f.x * 0.12, y: 0, z: f.z * 0.12 }); } catch {}
  let near = [];
  try { near = e.dimension.getEntities({ location: e.location, maxDistance: REACH + 1.5 }); } catch {}
  for (const t of near) {
    if (t.id === e.id || t.id === rider.id || st.hit.has(t.id) || !alive(t) || t.typeId === "minecraft:item") continue;
    const dx = t.location.x - e.location.x, dz = t.location.z - e.location.z;
    const d = Math.hypot(dx, dz);
    if (d > REACH || (d > 0.01 && (dx * f.x + dz * f.z) / d < 0.3)) continue;
    st.hit.add(t.id);
    try { t.applyDamage(DAMAGE, { cause: "entityAttack", damagingEntity: rider }); } catch {}
    try { t.applyKnockback(f.x, f.z, 2.2, 0.45); } catch {}
    sound(e.dimension, "cb.lizard.ram", t.location, 1.2, 1);
  }
}

// Подписка на урон и гибель:
// 1) Ударили саму Громовую ящерицу -> она бодается в ответ!
// 2) Ударили хозяина ящерицы ИЛИ хозяин ударил врага -> ящерица мстит за хозяина и бодает врага!
world.afterEvents.entityHurt.subscribe((ev) => {
  const hurt = ev.hurtEntity;
  const attacker = ev.damageSource?.damagingEntity;
  if (!hurt || !valid(hurt) || !attacker || !valid(attacker)) return;

  // А) Ударили саму громовую ящерицу -> бодается в ответ
  if (hurt.typeId === LIZARD) {
    const ownerId = getLizardOwnerId(hurt);
    if (ownerId && attacker.id === ownerId) return; // Не бодает своего хозяина
    assignLizardRevenge(hurt, attacker, 360);
    return;
  }

  // Б) Ударили хозяина ИЛИ хозяин атаковал цель -> все громовые ящерицы хозяина поблизости мстят и бодают!
  let lizards = [];
  try {
    lizards = hurt.dimension.getEntities({ type: LIZARD, location: hurt.location, maxDistance: 32 });
  } catch {}
  for (const liz of lizards) {
    if (!valid(liz) || !alive(liz)) continue;
    const ownerId = getLizardOwnerId(liz);
    if (!ownerId) continue;
    if (hurt.id === ownerId && attacker.id !== liz.id && attacker.id !== ownerId) {
      assignLizardRevenge(liz, attacker, 440);
    } else if (attacker.id === ownerId && hurt.id !== liz.id && hurt.id !== ownerId) {
      assignLizardRevenge(liz, hurt, 360);
    }
  }
});

// В) Если хозяин (игрок или орк) погиб -> ящерица яростно мстит убийце хозяина!
world.afterEvents.entityDie.subscribe((ev) => {
  const dead = ev.deadEntity;
  const killer = ev.damageSource?.damagingEntity;
  if (!dead || !killer || !valid(killer)) return;
  let lizards = [];
  try {
    lizards = killer.dimension.getEntities({ type: LIZARD, location: killer.location, maxDistance: 36 });
  } catch {}
  for (const liz of lizards) {
    if (!valid(liz) || !alive(liz)) continue;
    const ownerId = getLizardOwnerId(liz);
    if (ownerId && ownerId === dead.id) {
      assignLizardRevenge(liz, killer, 600); // 30 секунд беспощадной мести за погибшего хозяина!
    }
  }
});

// При кормлении/приручении игроком сразу запоминаем игрока как хозяина
try {
  if (world.afterEvents?.playerInteractWithEntity) {
    world.afterEvents.playerInteractWithEntity.subscribe((ev) => {
      if (ev.target?.typeId === LIZARD && ev.player) {
        setLizardOwner(ev.target, ev.player);
      }
    });
  }
} catch {}

system.runInterval(() => {
  const now = system.currentTick;
  for (const dim of ["overworld", "nether", "the_end"]) {
    let list = [];
    try { list = world.getDimension(dim).getEntities({ type: LIZARD }); } catch {}
    for (const e of list) tickLizard(e, now);
  }
}, 1);
