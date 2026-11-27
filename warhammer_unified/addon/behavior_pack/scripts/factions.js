// Единая таблица фракций (создаётся tools/patch_bp.py из tools/forge/factions.py).
// Правило: существа одной фракции (и одного «родства», например все големы) НЕ воюют друг с другом;
// призванные существа принадлежат той же фракции, что и их тип, поэтому не воюют со своими.
import { world, EntityDamageCause } from "@minecraft/server";

export const FACTION_OF = {
 "warcraft:chival_warrior": "order",
 "warcraft:dark_plate_knight": "order",
 "warcraft:elector_knight": "order",
 "warcraft:garithos_paladin": "order",
 "warcraft:heide_hood_knight": "order",
 "warcraft:heide_knight": "order",
 "warcraft:high_elf_spearman": "order",
 "warcraft:imperial_guard": "order",
 "warcraft:paladin_swordsman": "order",
 "warcraft:royal_captain": "order",
 "warcraft:royal_knight": "order",
 "warcraft:royal_queen": "order",
 "warcraft:teutonic_cleric": "order",
 "warcraft:bandit_dog": "norsca",
 "warcraft:bandit_raider": "norsca",
 "warcraft:chaos_warrior": "norsca",
 "warcraft:norse_berserker": "norsca",
 "warcraft:norse_marauder": "norsca",
 "warcraft:norse_shaman": "norsca",
 "warcraft:sabertooth_rider": "norsca",
 "warcraft:skaal_villager": "norsca",
 "warcraft:wulfrik_champion": "norsca",
 "warcraft:chaos_knight": "chaos",
 "warcraft:void_knight": "chaos",
 "warcraft:hornet_demon": "chaos",
 "warcraft:black_blocker": "chaos",
 "warcraft:blood_angel": "chaos",
 "warcraft:pink_horror": "chaos",
 "warcraft:burning_chariot": "chaos",
 "warcraft:abomination_lord": "nurgle",
 "warcraft:great_unclean_one": "nurgle",
 "warcraft:faceless_berserker": "faceless",
 "warcraft:faceless_cultist": "faceless",
 "warcraft:faceless_general": "faceless",
 "warcraft:faceless_nightmare": "faceless",
 "warcraft:faceless_sorcerer": "faceless",
 "warcraft:faceless_warrior": "faceless",
 "warcraft:nazgul": "scourge",
 "warcraft:pirate_ghost": "scourge",
 "warcraft:skeleton_bear": "scourge",
 "warcraft:undead_zombie": "scourge",
 "cb:death_knight": "scourge",
 "cb:dreadlord": "scourge",
 "cb:lich_king": "scourge",
 "cb:lich_statue": "scourge",
 "cb:ice_spirit": "scourge",
 "warcraft:frost_golem": "golems",
 "warcraft:lightning_golem": "golems",
 "warcraft:inferno_golem": "golems",
 "warcraft:ember_colossus": "golems",
 "warcraft:ice_demon": "golems",
 "cb:inferno_golem": "fel",
 "cb:hephaestus_golem": "olympus",
 "warcraft:big_ent": "nature",
 "warcraft:grizzly_bear": "nature",
 "cb:fel_lord": "fel",
 "cb:fel_minion": "fel",
 "cb:fel_orb": "fel",
 "cb:fel_rain": "fel",
 "cb:green_orc": "fel",
 "cb:hell_orc": "fel",
 "cb:guldan": "fel",
 "cb:warg": "fel",
 "cb:sargeras_prompt": "fel",
 "cb:orc": "tribes",
 "cb:smart_troll": "tribes",
 "cb:tribal_troll": "tribes",
 "cb:troll_totem": "tribes",
 "cb:thunder_lizard": "tribes",
 "cb:wild_troll": "wild_trolls",
 "cb:cannibal_troll": "wild_trolls",
 "cb:ice_troll": "wild_trolls",
 "cb:zeus": "olympus",
 "cb:zeus_archon": "olympus",
 "cb:ares": "olympus",
 "cb:ares_berserker": "olympus",
 "cb:athena": "olympus",
 "cb:athena_hoplite": "olympus",
 "cb:hades": "olympus",
 "cb:hades_shade": "olympus",
 "cb:poseidon": "olympus",
 "cb:poseidon_triton": "olympus",
 "cb:hephaestus": "olympus",
 "cb:cyclops": "giants",
 "cb:laestrygonian": "giants",
 "cb:mermaid": "sea",
 "cb:siren": "sea",
 "cb:dragon_east": "dragons",
 "cb:dragon_west": "dragons",
 "cb:dragon_fire": "dragons",
 "cb:dragon_frost": "dragons",
 "cb:dragon_spark": "dragons",
 "cb:hydra": "hydra",
 "cb:hydra_head": "hydra",
 "cb:hydra_neck": "hydra",
 "cb:hydra_spit": "hydra",
 "cb:circe": "witches",
 "cb:circe_orb": "witches",
 "cb:hex_chicken": "witches",
 "cb:hex_goat": "witches",
 "cb:hex_horse": "witches",
 "cb:hex_pig": "witches",
 "cb:hex_sheep": "witches",
 "cb:ore_beetle": "beetles",
 "cb:coal_beetle": "beetles",
 "cb:copper_beetle": "beetles",
 "cb:diamond_beetle": "beetles",
 "cb:emerald_beetle": "beetles",
 "cb:gold_beetle": "beetles",
 "cb:iron_beetle": "beetles",
 "cb:lapis_beetle": "beetles",
 "cb:quartz_beetle": "beetles",
 "cb:redstone_beetle": "beetles",
 "cb:human_civilian": "humans",
 "cb:human_villager": "humans",
 "cb:goblin": "goblins",
 "cb:minotaur": "labyrinth",
 "warcraft:santa_claus": "santa"
};
export const KIN_OF = {
 "warcraft:frost_golem": [
  "golem_kin"
 ],
 "warcraft:lightning_golem": [
  "golem_kin"
 ],
 "warcraft:inferno_golem": [
  "golem_kin"
 ],
 "warcraft:ember_colossus": [
  "golem_kin"
 ],
 "cb:inferno_golem": [
  "golem_kin"
 ],
 "cb:hephaestus_golem": [
  "golem_kin"
 ]
};

export function factionOf(e) {
  try { return FACTION_OF[e.typeId] ?? null; } catch { return null; }
}

export function areAllies(a, b) {
  if (!a || !b) return false;
  let ta, tb;
  try { ta = a.typeId; tb = b.typeId; } catch { return false; }
  if (ta === tb && FACTION_OF[ta]) return true;
  const fa = FACTION_OF[ta], fb = FACTION_OF[tb];
  if (fa && fa === fb) return true;
  const ka = KIN_OF[ta], kb = KIN_OF[tb];
  if (ka && kb && ka.some((k) => kb.includes(k))) return true;
  return false;
}

// Страховка: если урон всё же прошёл между союзниками (область, снаряд, скриптовый удар) — возвращаем здоровье.
world.afterEvents.entityHurt.subscribe((ev) => {
  try {
    const victim = ev.hurtEntity;
    const attacker = ev.damageSource?.damagingEntity;
    if (!victim || !attacker || victim.id === attacker.id) return;
    if (!areAllies(attacker, victim)) return;
    const hp = victim.getComponent("minecraft:health");
    if (!hp) return;
    hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + ev.damage));
  } catch {}
});
