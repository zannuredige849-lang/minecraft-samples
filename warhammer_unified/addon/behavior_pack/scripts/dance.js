import { world, system, ItemStack } from "@minecraft/server";
import { valid, shared } from "./util.js";

function getProp(e, k) {
  try { return e.getProperty(k); } catch { return undefined; }
}

const DISC_ID = "cb:ting_tang_disc";
const SOUND_ID = "cb.music.ting_tang";
const TRACK_DURATION_TICKS = 1240; // ~62 seconds (61.91s)
const DANCE_RADIUS = 48;

// Active jukeboxes map: key -> { dimId, x, y, z, startTick, endTick }
const activeJukeboxes = new Map();
// Debounce map so multiple events in the same tick don't double-trigger the same jukebox
const lastJukeboxAction = new Map();

function normDim(dimId) {
  return String(dimId ?? "overworld").replace("minecraft:", "");
}

function keyOf(dimId, x, y, z) {
  return `${normDim(dimId)}:${x},${y},${z}`;
}

// Wire shared.isDancing so all AI scripts (guldan.js, orcs.js, mob_ai.js) can query if a location is in a dance zone
shared.isDancing = function (loc, dim) {
  if (!loc || activeJukeboxes.size === 0) return false;
  const dId = normDim(typeof dim === "string" ? dim : dim?.id);
  const now = system.currentTick;
  for (const jb of activeJukeboxes.values()) {
    if (jb.dimId !== dId || now >= jb.endTick) continue;
    const dx = jb.x + 0.5 - loc.x;
    const dy = jb.y + 0.5 - loc.y;
    const dz = jb.z + 0.5 - loc.z;
    if (dx * dx + dy * dy + dz * dz <= DANCE_RADIUS * DANCE_RADIUS) return true;
  }
  return false;
};

function canTriggerJukebox(k) {
  const now = system.currentTick;
  const prev = lastJukeboxAction.get(k) || -100;
  if (now - prev < 5) return false;
  lastJukeboxAction.set(k, now);
  return true;
}

function stopJukebox(key, dropItem = true) {
  const jb = activeJukeboxes.get(key);
  if (!jb) return;
  activeJukeboxes.delete(key);
  try {
    const dim = world.getDimension(jb.dimId);
    dim.runCommandAsync(`stopsound @a[x=${jb.x},y=${jb.y},z=${jb.z},r=96] ${SOUND_ID}`);
    if (dropItem) {
      dim.spawnItem(new ItemStack(DISC_ID, 1), { x: jb.x + 0.5, y: jb.y + 1.1, z: jb.z + 0.5 });
    }
    const near = dim.getEntities({ location: { x: jb.x + 0.5, y: jb.y + 0.5, z: jb.z + 0.5 }, maxDistance: DANCE_RADIUS + 16 });
    for (const e of near) {
      if (!valid(e) || !e.typeId?.startsWith("cb:")) continue;
      if (getProp(e, "cb:dancing") === true) {
        try { e.setProperty("cb:dancing", false); } catch {}
      }
    }
  } catch {}
}

function startJukebox(player, block, itemStack) {
  const dim = block.dimension;
  const { x, y, z } = block.location;
  const dId = normDim(dim.id);
  const k = keyOf(dId, x, y, z);
  const now = system.currentTick;

  if (activeJukeboxes.has(k)) {
    stopJukebox(k, true);
  }

  activeJukeboxes.set(k, {
    dimId: dId,
    x, y, z,
    startTick: now,
    endTick: now + TRACK_DURATION_TICKS
  });

  try {
    const eq = player.getComponent("minecraft:equippable");
    const gm = player.getGameMode?.();
    if (eq && gm !== "creative") {
      if (itemStack && itemStack.amount > 1) {
        itemStack.amount -= 1;
        eq.setEquipment("Mainhand", itemStack);
      } else {
        eq.setEquipment("Mainhand", undefined);
      }
    }
  } catch {}

  try {
    dim.playSound(SOUND_ID, { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, { volume: 4.0, pitch: 1.0 });
    dim.spawnParticle("minecraft:note_particle", { x: x + 0.5, y: y + 1.2, z: z + 0.5 });
  } catch {}
}

function handleJukeboxInteract(player, block, itemStack, evToCancel = null) {
  if (!player || !block || block.typeId !== "minecraft:jukebox") return false;
  const dim = block.dimension;
  const { x, y, z } = block.location;
  const k = keyOf(dim.id, x, y, z);

  // If our custom disc is currently playing in this jukebox, eject it
  if (activeJukeboxes.has(k)) {
    if (!canTriggerJukebox(k)) return true;
    if (evToCancel) {
      try { evToCancel.cancel = true; } catch {}
    }
    system.run(() => stopJukebox(k, true));
    return true;
  }

  // Otherwise, if the player is holding cb:ting_tang_disc, insert and play it
  let held = itemStack;
  if (!held) {
    try {
      held = player.getComponent("minecraft:equippable")?.getEquipment("Mainhand");
    } catch {}
  }
  if (held && held.typeId === DISC_ID) {
    if (!canTriggerJukebox(k)) return true;
    if (evToCancel) {
      try { evToCancel.cancel = true; } catch {}
    }
    const cloneStack = held.clone?.() ?? held;
    system.run(() => startJukebox(player, block, cloneStack));
    return true;
  }
  return false;
}

export function initDance() {
  // 1. Modern beforeEvents.playerInteractWithBlock (1.12+)
  try {
    world.beforeEvents?.playerInteractWithBlock?.subscribe?.((ev) => {
      handleJukeboxInteract(ev.player, ev.block, ev.itemStack, ev);
    });
  } catch {}

  // 2. @minecraft/server 1.11.0 beforeEvents.itemUseOn
  try {
    world.beforeEvents?.itemUseOn?.subscribe?.((ev) => {
      const p = ev.source;
      if (!p || p.typeId !== "minecraft:player") return;
      handleJukeboxInteract(p, ev.block, ev.itemStack, ev);
    });
  } catch {}

  // 3. @minecraft/server 1.11.0 afterEvents.itemUseOn fallback
  try {
    world.afterEvents?.itemUseOn?.subscribe?.((ev) => {
      const p = ev.source;
      if (!p || p.typeId !== "minecraft:player") return;
      handleJukeboxInteract(p, ev.block, ev.itemStack, null);
    });
  } catch {}

  // 4. @minecraft/server 1.11.0 afterEvents.itemUse with raycast (handles clicking block with custom item or empty hand)
  try {
    world.afterEvents?.itemUse?.subscribe?.((ev) => {
      const p = ev.source;
      if (!p || p.typeId !== "minecraft:player") return;
      if (ev.itemStack?.typeId !== DISC_ID && activeJukeboxes.size === 0) return;
      try {
        const hit = p.getBlockFromViewDirection({ maxDistance: 6 });
        const block = hit?.block;
        if (block && block.typeId === "minecraft:jukebox") {
          handleJukeboxInteract(p, block, ev.itemStack, null);
        }
      } catch {}
    });
  } catch {}

  // 5. Left-clicking / punching an active jukebox ejects the disc in 1.11.0
  try {
    world.afterEvents?.entityHitBlock?.subscribe?.((ev) => {
      const p = ev.damagingEntity;
      const block = ev.hitBlock;
      if (!p || p.typeId !== "minecraft:player" || !block || block.typeId !== "minecraft:jukebox") return;
      const k = keyOf(block.dimension.id, block.location.x, block.location.y, block.location.z);
      if (activeJukeboxes.has(k) && canTriggerJukebox(k)) {
        system.run(() => stopJukebox(k, true));
      }
    });
  } catch {}

  // 6. Breaking a jukebox ejects the disc and stops music
  try {
    world.beforeEvents?.playerBreakBlock?.subscribe?.((ev) => {
      const block = ev.block;
      if (!block || block.typeId !== "minecraft:jukebox") return;
      const k = keyOf(block.dimension.id, block.location.x, block.location.y, block.location.z);
      if (activeJukeboxes.has(k)) {
        system.run(() => stopJukebox(k, true));
      }
    });
  } catch {}

  // Periodic dance aura & music note ticker (every 10 ticks = 0.5s)
  system.runInterval(() => {
    const now = system.currentTick;
    const dancingNow = new Set();

    for (const [k, jb] of [...activeJukeboxes.entries()]) {
      if (now >= jb.endTick) {
        stopJukebox(k, false);
        continue;
      }
      try {
        const dim = world.getDimension(jb.dimId);
        const block = dim.getBlock({ x: jb.x, y: jb.y, z: jb.z });
        if (!block || block.typeId !== "minecraft:jukebox") {
          stopJukebox(k, true);
          continue;
        }
        const center = { x: jb.x + 0.5, y: jb.y + 0.5, z: jb.z + 0.5 };
        if (now % 20 === 0) {
          try {
            dim.spawnParticle("minecraft:note_particle", {
              x: jb.x + 0.5 + (Math.random() - 0.5) * 0.6,
              y: jb.y + 1.25,
              z: jb.z + 0.5 + (Math.random() - 0.5) * 0.6
            });
          } catch {}
        }
        const ents = dim.getEntities({ location: center, maxDistance: DANCE_RADIUS });
        for (const e of ents) {
          if (!valid(e) || !e.typeId?.startsWith("cb:")) continue;
          if (e.typeId.endsWith("_chunk") || e.typeId === "cb:fel_orb" || e.typeId === "cb:fel_rain" || e.typeId === "cb:magic_orb" || e.typeId === "cb:venom_spit") continue;
          dancingNow.add(e);
          if (getProp(e, "cb:dancing") !== true) {
            try { e.setProperty("cb:dancing", true); } catch {}
          }
          try { e.clearVelocity?.(); } catch {}
        }
      } catch {}
    }

    if (activeJukeboxes.size > 0) {
      for (const dimName of ["overworld", "nether", "the_end"]) {
        try {
          const dim = world.getDimension(dimName);
          for (const e of dim.getEntities()) {
            if (!valid(e) || !e.typeId?.startsWith("cb:")) continue;
            if (!dancingNow.has(e) && getProp(e, "cb:dancing") === true) {
              try { e.setProperty("cb:dancing", false); } catch {}
            }
          }
        } catch {}
      }
    }
  }, 10);
}

initDance();
