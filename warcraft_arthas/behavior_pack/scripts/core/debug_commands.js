// @ts-check
/**
 * Developer-only commands, kept separate from normal gameplay.
 * Invoke in game with:  /scriptevent warcraft:<command> [args]
 * They require the tag `warcraft_dev` (see core/configuration.js); granting it needs command permission:
 * /tag @s add warcraft_dev
 */
import { world, system, ItemStack } from "@minecraft/server";
import { ACTIONS, ARTHAS_ID, CONFIG, FROSTMOURNE_ID, validateConfig } from "./configuration.js";
import { createStore, NS } from "./persistence.js";
import { formatError, isValidEntity } from "./utilities.js";

/** @param {import("@minecraft/server").Player} player */
function isDeveloper(player) {
  if (!CONFIG.debug.enabled) return false;
  // @minecraft/server 2.0.0 exposes no operator check, so access is gated by a tag that only
  // players with command permission can grant:  /tag @s add warcraft_dev
  return player.hasTag(CONFIG.debug.requiredTag);
}

/** Nearest Arthas to a player (within 64 blocks). @param {import("@minecraft/server").Player} player */
function nearestArthas(player) {
  const found = player.dimension.getEntities({ type: ARTHAS_ID, location: player.location, maxDistance: 64, closest: 1 });
  return found[0];
}

/** @type {Record<string, (player: import("@minecraft/server").Player, args: string[]) => string>} */
const COMMANDS = {
  help: () => `warcraft commands: ${Object.keys(COMMANDS).join(", ")}`,
  info: () => `Arthas add-on dev build | config errors: ${validateConfig().length}`,
  spawn(player) {
    const dir = player.getViewDirection();
    const loc = { x: player.location.x + dir.x * 8, y: player.location.y, z: player.location.z + dir.z * 8 };
    player.dimension.spawnEntity(ARTHAS_ID, loc);
    return "Arthas spawned 8 blocks ahead.";
  },
  give(player) {
    const inv = player.getComponent("inventory");
    if (!inv || !inv.container) return "No inventory.";
    inv.container.addItem(new ItemStack(FROSTMOURNE_ID, 1));
    return "Frostmourne given.";
  },
  phase(player, args) {
    const phase = Number(args[0]);
    if (![1, 2, 3].includes(phase)) return "usage: warcraft:phase <1|2|3>";
    const boss = nearestArthas(player);
    if (!isValidEntity(boss)) return "No Arthas within 64 blocks.";
    boss.setProperty("warcraft:phase", phase);
    return `Visual phase set to ${phase} (render only; the boss AI arrives in a later stage).`;
  },
  action(player, args) {
    const action = args[0];
    if (!ACTIONS.includes(action)) return `usage: warcraft:action <${ACTIONS.join("|")}>`;
    const boss = nearestArthas(player);
    if (!isValidEntity(boss)) return "No Arthas within 64 blocks.";
    boss.setProperty("warcraft:action", action);
    return `Action property set to ${action}.`;
  },
  persist_test(player) {
    const store = createStore(world, NS.world);
    const probe = { t: system.currentTick, blob: "x".repeat(20000) };
    store.set("persist_probe", probe);
    /** @type {any} */
    const back = store.get("persist_probe", null);
    store.remove("persist_probe");
    return back && back.blob.length === probe.blob.length ? "Persistence round-trip OK (chunked 20 kB)." : "Persistence round-trip FAILED.";
  },
};

export function registerDebugCommands() {
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (!ev.id.startsWith("warcraft:")) return;
    const entity = ev.sourceEntity;
    if (!entity || entity.typeId !== "minecraft:player") return;
    const player = /** @type {import("@minecraft/server").Player} */ (entity);
    if (!isDeveloper(player)) {
      player.sendMessage("§cWarcraft developer commands need the 'warcraft_dev' tag or operator rights.");
      return;
    }
    const name = ev.id.slice("warcraft:".length);
    const handler = COMMANDS[name];
    if (!handler) {
      player.sendMessage(`§cUnknown command '${name}'. ${COMMANDS.help(player, [])}`);
      return;
    }
    try {
      player.sendMessage(`§b[Warcraft]§r ${handler(player, ev.message.trim().split(/\s+/).filter(Boolean))}`);
    } catch (e) {
      player.sendMessage(`§c[Warcraft] ${formatError(e)}`);
    }
  }, { namespaces: ["warcraft"] });
}
