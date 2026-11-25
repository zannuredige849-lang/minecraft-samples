// Драконы: анимация дыхания при выстреле и особые свойства стихий.
//  - огненный плевок поджигает сам (JSON-снаряд);
//  - ледяной осколок замедляет (JSON), а попав в воду, замораживает её, на землю кладёт снег;
//  - грозовая искра перескакивает молнией на ближайшее другое существо (2 урона).
import { world, system } from "@minecraft/server";
import { valid, alive, dist, sound } from "./util.js";

export const BREATH = ["cb:dragon_fire", "cb:dragon_frost", "cb:dragon_spark"];
export const DRAGONS = ["cb:dragon_west", "cb:dragon_east"];
export const BREATH_TICKS = 16;          // столько держится поза «дыхание» после выстрела
export const CHAIN_RANGE = 4;            // искра перескакивает на цель не дальше 4 блоков
export const CHAIN_DAMAGE = 2;

const breathing = new Map();             // id дракона -> тик, до которого держится поза

function ownerOf(proj) {
  try {
    const o = proj.getComponent("minecraft:projectile")?.owner;
    if (o && valid(o)) return o;
  } catch {}
  // запасной путь: ближайший дракон в 12 блоках
  let best, bd = 12;
  try {
    for (const d of proj.dimension.getEntities({ location: proj.location, maxDistance: 12, families: ["cb_dragon"] })) {
      if (!DRAGONS.includes(d.typeId)) continue;
      const k = dist(d.location, proj.location);
      if (k < bd) { bd = k; best = d; }
    }
  } catch {}
  return best;
}

export function onBreath(proj) {
  if (!BREATH.includes(proj?.typeId)) return;
  const d = ownerOf(proj);
  if (!d || !DRAGONS.includes(d.typeId)) return;
  breathing.set(d.id, system.currentTick + BREATH_TICKS);
  try { d.setProperty("cb:breath", true); } catch {}
}

export function tickBreath() {
  for (const [id, until] of breathing) {
    if (system.currentTick < until) continue;
    breathing.delete(id);
    const d = world.getEntity(id);
    if (d && valid(d)) { try { d.setProperty("cb:breath", false); } catch {} }
  }
}

// Цепная молния: от поражённой цели — к ближайшему другому живому существу (не дракону и не хозяину).
export function chain(hitEntity, shooter) {
  if (!hitEntity || !valid(hitEntity)) return;
  let next, bd = CHAIN_RANGE;
  let near = [];
  try { near = hitEntity.dimension.getEntities({ location: hitEntity.location, maxDistance: CHAIN_RANGE }); } catch {}
  for (const e of near) {
    if (e.id === hitEntity.id || e.id === shooter?.id || !alive(e)) continue;
    if (DRAGONS.includes(e.typeId) || BREATH.includes(e.typeId) || e.typeId === "minecraft:item") continue;
    if (e.typeId === "minecraft:player") {
      try { if (["creative", "spectator"].includes(String(e.getGameMode()).toLowerCase())) continue; } catch {}
    }
    const k = dist(e.location, hitEntity.location);
    if (k < bd) { bd = k; next = e; }
  }
  if (!next) return;
  try { next.applyDamage(CHAIN_DAMAGE, { cause: "lightning", damagingEntity: shooter }); } catch {
    try { next.applyDamage(CHAIN_DAMAGE); } catch {}
  }
  // искры по линии между целями
  const a = hitEntity.location, b = next.location;
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    try {
      hitEntity.dimension.spawnParticle("minecraft:electric_spark_particle",
        { x: a.x + (b.x - a.x) * t, y: a.y + 1 + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
    } catch {}
  }
  sound(hitEntity.dimension, "cb.dragon.zap", next.location, 1.2, 1.3);
  return next;
}

// Ледяной осколок по блоку: вода — в лёд, сверху на твёрдый блок — снег.
export function frost(dim, block) {
  try {
    if (!block) return;
    const id = block.typeId;
    if (id === "minecraft:water" || id === "minecraft:flowing_water") { block.setType("minecraft:ice"); return "ice"; }
    const l = block.location;
    const above = dim.getBlock({ x: l.x, y: l.y + 1, z: l.z });
    if (above && above.typeId === "minecraft:air" && !String(id).includes("leaves") && id !== "minecraft:air") {
      above.setType("minecraft:snow_layer");
      return "snow";
    }
  } catch {}
}

world.afterEvents.entitySpawn?.subscribe?.((ev) => onBreath(ev.entity));

world.afterEvents.projectileHitEntity?.subscribe?.((ev) => {
  if (ev.projectile?.typeId !== "cb:dragon_spark") return;
  let hit;
  try { hit = ev.getEntityHit?.()?.entity; } catch {}
  chain(hit, ev.source);
});

world.afterEvents.projectileHitBlock?.subscribe?.((ev) => {
  if (ev.projectile?.typeId !== "cb:dragon_frost") return;
  let b;
  try { b = ev.getBlockHit?.()?.block; } catch {}
  frost(ev.dimension, b);
});

system.runInterval(tickBreath, 2);
