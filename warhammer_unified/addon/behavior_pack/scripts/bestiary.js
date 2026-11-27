// Бестиарий уникальностей: фракции -> существа -> способности, трофеи; плюс уникальные предметы.
import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { ABILITIES, DROPS, NAMES, NOTES, FACTION_TITLES, ITEM_INFO } from "./abilities_data.js";
import { FACTION_OF } from "./factions.js";

const byFaction = () => {
  const m = {};
  for (const id of Object.keys(NAMES)) (m[FACTION_OF[id] ?? "other"] ??= []).push(id);
  for (const k in m) m[k].sort((a, b) => NAMES[a].localeCompare(NAMES[b], "ru"));
  return m;
};

function mobText(id) {
  const lines = [`§l${NAMES[id]}§r`, `§7Фракция: §f${FACTION_TITLES[FACTION_OF[id]] ?? "—"}`, ""];
  const ab = (ABILITIES[id] || []).filter((a) => a.name);
  if (ab.length) { lines.push("§6Способности:"); for (const a of ab) lines.push(`§e• ${a.name}§r — ${a.d}`); }
  if (NOTES[id]) { lines.push("", `§bОсобенности: §f${NOTES[id]}`); }
  const dr = DROPS[id] || [];
  if (dr.length) { lines.push("", "§aТрофеи:"); for (const d of dr) lines.push(`§f• ${d[4] || d[0]} §7(${d[1] === d[2] ? d[1] : d[1] + "–" + d[2]}, ${Math.round(d[3] * 100)}%)`); }
  return lines.join("\n");
}

function showMob(p, id, back) {
  new ActionFormData().title(NAMES[id]).body(mobText(id)).button("§lНазад").show(p).then(() => back());
}
function showFaction(p, key) {
  const ids = byFaction()[key] || [];
  const f = new ActionFormData().title(FACTION_TITLES[key] ?? "Прочие").body(`Существ: ${ids.length}`);
  for (const id of ids) f.button(NAMES[id]);
  f.button("§lНазад");
  f.show(p).then((r) => {
    if (r.canceled) return;
    if (r.selection === ids.length) return showRoot(p);
    showMob(p, ids[r.selection], () => showFaction(p, key));
  });
}
function showItems(p) {
  const body = Object.values(ITEM_INFO).map((i) => `§e${i.ru}§r\n§7${i.d}`).join("\n\n");
  new ActionFormData().title("Предметы").body(body).button("§lНазад").show(p).then(() => showRoot(p));
}
function showRoot(p) {
  const m = byFaction(), keys = Object.keys(m).sort((a, b) => (FACTION_TITLES[a] ?? "яя").localeCompare(FACTION_TITLES[b] ?? "яя", "ru"));
  const f = new ActionFormData().title("Бестиарий уникальностей").body("Выберите фракцию. У каждого существа своя способность и свой трофей.");
  for (const k of keys) f.button(`${FACTION_TITLES[k] ?? "Прочие"} §7(${m[k].length})`);
  f.button("§6Предметы");
  f.show(p).then((r) => {
    if (r.canceled) return;
    if (r.selection === keys.length) return showItems(p);
    showFaction(p, keys[r.selection]);
  });
}

world.afterEvents.itemUse?.subscribe?.((ev) => {
  try { if (ev.itemStack?.typeId === "cb:bestiary") system.run(() => showRoot(ev.source)); } catch {}
});
world.afterEvents.playerSpawn.subscribe((ev) => {
  try {
    if (!ev.initialSpawn || ev.player.hasTag("cb_bestiary_given")) return;
    ev.player.addTag("cb_bestiary_given");
    ev.player.runCommand("give @s cb:bestiary 1");
  } catch {}
});
