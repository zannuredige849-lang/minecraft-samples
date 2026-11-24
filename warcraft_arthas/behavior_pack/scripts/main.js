// @ts-check
/**
 * Entry point of the Arthas behavior-pack scripts.
 * Stage 1 wires the shared core (configuration, persistence, utilities) and the developer commands.
 * Later stages add arthas/, servants/ and cinematics/ modules and register them from here.
 */
import { world } from "@minecraft/server";
import { validateConfig } from "./core/configuration.js";
import { registerDebugCommands } from "./core/debug_commands.js";
import { formatError } from "./core/utilities.js";

try {
  const problems = validateConfig();
  if (problems.length) console.warn(`[Warcraft] invalid configuration: ${problems.join("; ")}`);
  registerDebugCommands();
  world.afterEvents.worldLoad.subscribe(() => console.warn("[Warcraft] Arthas add-on loaded."));
} catch (e) {
  console.error(`[Warcraft] startup failed: ${formatError(e)}`);
}
