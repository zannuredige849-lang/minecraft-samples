"""Single source of truth for factions. Same faction (or same alliance group) never fights each other;
summoned minions share the faction of the entity type they are, so they never fight their summoner's side."""

# faction key -> dict(title, color (primary), color2, emblem)
FACTIONS = {
    "order":     dict(title="Орден Королевства", c1="#2f4ea8", c2="#dcae3c", emblem="cross"),
    "norsca":    dict(title="Норска", c1="#6a5238", c2="#b02a2a", emblem="axe"),
    "chaos":     dict(title="Легион Хаоса", c1="#2e2a3c", c2="#a98a4a", emblem="star"),
    "nurgle":    dict(title="Нургл", c1="#7a9a4a", c2="#c8c070", emblem="drop"),
    "faceless":  dict(title="Безликие", c1="#2fb89a", c2="#5a3a9a", emblem="eye"),
    "scourge":   dict(title="Плеть", c1="#6a8aa8", c2="#6ae6ff", emblem="skull"),
    "golems":    dict(title="Стихийные големы", c1="#5f7f9a", c2="#ffb040", emblem="gear"),
    "nature":    dict(title="Дикая природа", c1="#4aa83a", c2="#6a4a2a", emblem="leaf"),
    "fel":       dict(title="Орда Скверны", c1="#3a7a2a", c2="#9aff30", emblem="flame"),
    "tribes":    dict(title="Племена орков и троллей", c1="#8a5a2a", c2="#e0c080", emblem="tusk"),
    "wild_trolls": dict(title="Дикие тролли", c1="#4a8a3a", c2="#d8d0b8", emblem="tusk"),
    "olympus":   dict(title="Олимп", c1="#e8c040", c2="#40c8e0", emblem="bolt"),
    "giants":    dict(title="Великаны", c1="#b0603a", c2="#e8c080", emblem="fist"),
    "sea":       dict(title="Морской народ", c1="#2a8aa8", c2="#f0a0c0", emblem="wave"),
    "dragons":   dict(title="Драконы", c1="#a05a2a", c2="#ffb040", emblem="wing"),
    "hydra":     dict(title="Гидра", c1="#1a7a6a", c2="#e0c070", emblem="fang"),
    "witches":   dict(title="Ведьмы", c1="#5a2a8a", c2="#e0b040", emblem="star"),
    "beetles":   dict(title="Рудные жуки", c1="#2a2a30", c2="#9a9aa8", emblem="gem"),
    "humans":    dict(title="Люди", c1="#8a6a4a", c2="#d8b080", emblem="house"),
    "goblins":   dict(title="Гоблины", c1="#6a8a3a", c2="#d0c060", emblem="coin"),
    "labyrinth": dict(title="Лабиринт", c1="#6a4a2a", c2="#e0b040", emblem="horn"),
    "santa":     dict(title="Зимний дед", c1="#c82a2a", c2="#f0f0f0", emblem="snow"),
    "beasts":    dict(title="Ездовые звери", c1="#3a3a44", c2="#c0c0c8", emblem="fang"),
}

_W = lambda *n: ["warcraft:" + x for x in n]
_C = lambda *n: ["cb:" + x for x in n]
GROUPS = {
    "order": _W("chival_warrior", "dark_plate_knight", "elector_knight", "garithos_paladin", "heide_hood_knight", "heide_knight",
                "high_elf_spearman", "imperial_guard", "paladin_swordsman", "royal_captain", "royal_knight", "royal_queen", "teutonic_cleric"),
    "norsca": _W("bandit_dog", "bandit_raider", "chaos_warrior", "norse_berserker", "norse_marauder", "norse_shaman", "sabertooth_rider", "skaal_villager", "wulfrik_champion"),
    "chaos": _W("chaos_knight", "void_knight", "hornet_demon", "black_blocker", "blood_angel", "pink_horror", "burning_chariot"),
    "nurgle": _W("abomination_lord", "great_unclean_one"),
    "faceless": _W("faceless_berserker", "faceless_cultist", "faceless_general", "faceless_nightmare", "faceless_sorcerer", "faceless_warrior"),
    "scourge": _W("nazgul", "pirate_ghost", "skeleton_bear", "undead_zombie") + _C("death_knight", "dreadlord", "lich_king", "lich_statue", "ice_spirit"),
    "golems": _W("frost_golem", "lightning_golem", "inferno_golem", "ember_colossus", "ice_demon") + _C("inferno_golem", "hephaestus_golem"),
    "nature": _W("big_ent", "grizzly_bear"),
    "fel": _C("fel_lord", "fel_minion", "fel_orb", "fel_rain", "green_orc", "hell_orc", "guldan", "warg", "sargeras_prompt"),
    "tribes": _C("orc", "smart_troll", "tribal_troll", "troll_totem", "thunder_lizard"),
    "wild_trolls": _C("wild_troll", "cannibal_troll", "ice_troll"),
    "olympus": _C("zeus", "zeus_archon", "ares", "ares_berserker", "athena", "athena_hoplite", "hades", "hades_shade", "poseidon", "poseidon_triton", "hephaestus", "hephaestus_golem"),
    "giants": _C("cyclops", "laestrygonian"),
    "sea": _C("mermaid", "siren"),
    "dragons": _C("dragon_east", "dragon_west", "dragon_fire", "dragon_frost", "dragon_spark"),
    "hydra": _C("hydra", "hydra_head", "hydra_neck", "hydra_spit"),
    "witches": _C("circe", "circe_orb", "hex_chicken", "hex_goat", "hex_horse", "hex_pig", "hex_sheep"),
    "beetles": _C("ore_beetle", "coal_beetle", "copper_beetle", "diamond_beetle", "emerald_beetle", "gold_beetle", "iron_beetle", "lapis_beetle", "quartz_beetle", "redstone_beetle"),
    "humans": _C("human_civilian", "human_villager"),
    "goblins": _C("goblin"),
    "labyrinth": _C("minotaur"),
    "santa": _W("santa_claus"),
}
# alliance groups that cut across factions (all golems are one kin; Olympian summons ally their gods)
KIN = {"golem_kin": _W("frost_golem", "lightning_golem", "inferno_golem", "ember_colossus") + _C("inferno_golem", "hephaestus_golem")}

FACTION_OF = {}
for f, ids in GROUPS.items():
    for i in ids:
        assert i not in FACTION_OF or i == "cb:hephaestus_golem", i
        FACTION_OF.setdefault(i, f)
# cb:hephaestus_golem is both an Olympian summon and a golem: faction olympus, kin golem_kin
FACTION_OF["cb:hephaestus_golem"] = "olympus"
FACTION_OF["cb:inferno_golem"] = "fel"          # summoned by Gul'dan: Horde faction + golem kin
for k in ("warcraft:frost_golem", "warcraft:lightning_golem", "warcraft:inferno_golem", "warcraft:ember_colossus"):
    FACTION_OF[k] = "golems"

KIN_OF = {}
for kin, ids in KIN.items():
    for i in ids: KIN_OF.setdefault(i, []).append(kin)


def allies_of(ent):
    """Alliance family tags an entity carries."""
    tags = []
    f = FACTION_OF.get(ent)
    if f: tags.append("f_" + f)
    tags += KIN_OF.get(ent, [])
    return tags
