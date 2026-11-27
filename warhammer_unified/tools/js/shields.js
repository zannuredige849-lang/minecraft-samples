// v10.8.5 Vanilla shields for item-holding mobs (orcs, goblins; trolls never carry shields since v10.8.7). Humans have their own shield
// logic in settlements.js. Only stable @minecraft/server 1.14.0 APIs.
//  * 40 % of melee orcs get a vanilla shield in the off hand (rolled once per orc; ranged orcs never).
//  * A mob holding a vanilla shield blocks like a player: only hits from the front, 100 % of arrows and other
//    projectiles, 75 % of melee damage; the attacker is pushed back; an axe hit disables the shield for 5 s.
//  * At most one block every half second, so a player can always break through.
import { world, system, EntityDamageCause } from "@minecraft/server";

const HOLDERS = new Set(["cb:orc", "cb:green_orc", "cb:hell_orc", "cb:goblin"]);
const ORCS = new Set(["cb:orc", "cb:green_orc", "cb:hell_orc"]);
const ROLLED = "cb_shield_rolled";
const disabledUntil = new Map();
const lastBlock = new Map();

function held(e, slot) {
  try { return e.getComponent("minecraft:equippable")?.getEquipment(slot)?.typeId; } catch { return undefined; }
}
function hasShield(e) { return held(e, "Offhand") === "minecraft:shield"; }
function ranged(id) { return typeof id === "string" && (id.endsWith(":bow") || id.endsWith(":crossbow")); }

function fromFront(e, a) {
  try {
    const v = e.getViewDirection();
    const dx = a.location.x - e.location.x, dz = a.location.z - e.location.z;
    const l = Math.hypot(dx, dz) || 1, lv = Math.hypot(v.x, v.z) || 1;
    return (dx * v.x + dz * v.z) / (l * lv) > 0.2;
  } catch { return true; }
}

// roll shields for orcs near players (new spawns and orcs loaded from older saves alike)
system.runInterval(() => {
  for (const p of world.getAllPlayers()) {
    let near = [];
    try { near = p.dimension.getEntities({ location: p.location, maxDistance: 64, excludeTags: [ROLLED] }); } catch {}
    for (const e of near) {
      if (!ORCS.has(e.typeId)) continue;
      try { e.addTag(ROLLED); } catch { continue; }
      if (ranged(held(e, "Mainhand")) || held(e, "Offhand")) continue;
      if (Math.random() < 0.4) { try { e.runCommandAsync("replaceitem entity @s slot.weapon.offhand 0 shield 1"); } catch {} }
    }
  }
}, 100);

world.afterEvents.entityHurt.subscribe((ev) => {
  try {
    const e = ev.hurtEntity;
    if (!e || !HOLDERS.has(e.typeId) || !hasShield(e)) return;
    const src = ev.damageSource;
    const a = src?.damagingEntity;
    if (!a || ev.damage <= 0) return;
    const now = system.currentTick;
    if ((disabledUntil.get(e.id) ?? 0) > now || now - (lastBlock.get(e.id) ?? -99) < 10) return;
    if (!fromFront(e, a)) return;
    const isProj = src.cause === EntityDamageCause.projectile || !!src.damagingProjectile;
    const weapon = held(a, "Mainhand") ?? "";
    lastBlock.set(e.id, now);
    const h = e.getComponent("minecraft:health");
    if (!isProj && weapon.includes("_axe")) {
      disabledUntil.set(e.id, now + 100);
      try { e.dimension.playSound("random.break", e.location, { volume: 1, pitch: 0.9 }); } catch {}
      if (h) { try { h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + Math.ceil(ev.damage * 0.5))); } catch {} }
      return;
    }
    const refund = isProj ? ev.damage : Math.ceil(ev.damage * 0.75);
    if (h) { try { h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + refund)); } catch {} }
    try { e.dimension.playSound("item.shield.block", e.location, { volume: 1, pitch: 0.95 + Math.random() * 0.15 }); } catch {}
    if (!isProj) {
      const dx = a.location.x - e.location.x, dz = a.location.z - e.location.z, l = Math.hypot(dx, dz) || 1;
      if (l <= 4) { try { a.applyKnockback(dx / l, dz / l, 0.9, 0.22); } catch {} }
    }
  } catch {}
});
