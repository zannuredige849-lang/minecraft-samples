// Уникальные эффекты предметов аддона.
import { world, system, EntityDamageCause } from "@minecraft/server";
import { fx, sound, valid, alive } from "./util.js";

const held = (p) => { try { return p.getComponent("minecraft:equippable")?.getEquipment("Mainhand")?.typeId; } catch { return undefined; } };
const addFx = (e, id, sec, amp) => { try { e.addEffect(id, Math.round(sec * 20), { amplifier: amp, showParticles: true }); } catch {} };
const knock = (from, to, h, v) => { const dx = to.location.x - from.location.x, dz = to.location.z - from.location.z, l = Math.hypot(dx, dz) || 1; try { if (to.typeId === "minecraft:player") to.applyKnockback(dx / l, dz / l, h, v); else to.applyImpulse({ x: dx / l * h * 0.5, y: v * 0.6, z: dz / l * h * 0.5 }); } catch {} };

world.afterEvents.entityHitEntity.subscribe((ev) => {
  try {
    const p = ev.damagingEntity, v = ev.hitEntity;
    if (p?.typeId !== "minecraft:player" || !valid(v)) return;
    switch (held(p)) {
      case "cb:hell_scimitar":
        try { v.setOnFire(4, true); } catch {}
        if (Math.random() < 0.15) {
          fx(v.dimension, "minecraft:large_explosion", v.location); sound(v.dimension, "mob.blaze.shoot", v.location, 1, 0.8);
          for (const f of v.dimension.getEntities({ location: v.location, maxDistance: 3 })) if (f.id !== p.id && f.typeId !== "minecraft:player") { try { f.applyDamage(4, { cause: EntityDamageCause.fire, damagingEntity: p }); f.setOnFire(3, true); } catch {} }
        }
        break;
      case "cb:laestrygonian_sword":
        for (const f of v.dimension.getEntities({ location: v.location, maxDistance: 3 })) if (f.id !== p.id && f.id !== v.id && f.typeId !== "minecraft:player") { try { f.applyDamage(4, { cause: EntityDamageCause.entityAttack, damagingEntity: p }); knock(p, f, 1.0, 0.35); } catch {} }
        fx(v.dimension, "minecraft:critical_hit_emitter", v.location); break;
    }
  } catch {}
});

const useCd = new Map();
world.afterEvents.itemUse?.subscribe?.((ev) => {
  try {
    const p = ev.source, id = ev.itemStack?.typeId;
    const rule = { "cb:dragon_scale": ["fire_resistance", 40, 0, 900, "§6Чешуя дракона: огнеупорность"], "cb:bronze_ingot": ["absorption", 20, 1, 1200, "§6Бронза: поглощение"] }[id];
    if (!rule) return;
    const k = p.id + id, t = system.currentTick;
    if ((useCd.get(k) ?? 0) > t) return;
    useCd.set(k, t + rule[3]);
    addFx(p, rule[0], rule[1], rule[2]);
    fx(p.dimension, "minecraft:totem_particle", p.location);
    p.onScreenDisplay.setActionBar(rule[4]);
  } catch {}
});
