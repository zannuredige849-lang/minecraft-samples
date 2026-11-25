// Orc outpost/camp building AI removed per user request.
// Keeps lightweight exported helpers required by orcs.js combat & warg-riding mechanics.
export const STYLE = {
  "cb:orc":       { log: "minecraft:oak_log", plank: "minecraft:oak_planks", fence: "minecraft:oak_fence" },
  "cb:green_orc": { log: "minecraft:spruce_log", plank: "minecraft:spruce_planks", fence: "minecraft:spruce_fence" },
  "cb:hell_orc":  { log: "minecraft:crimson_stem", plank: "minecraft:crimson_planks", fence: "minecraft:crimson_fence" },
};
export const list = () => [];
export function reset() {}
export function surface(dim, x, z) {
  try {
    for (let y = 120; y >= 50; y--) {
      const b = dim.getBlock({ x: Math.floor(x), y, z: Math.floor(z) });
      const a = dim.getBlock({ x: Math.floor(x), y: y + 1, z: Math.floor(z) });
      if (b && !b.isAir && !b.isLiquid && a && a.isAir) return { y, ground: b.typeId };
    }
  } catch {}
  return { y: 64, ground: "minecraft:grass_block" };
}
