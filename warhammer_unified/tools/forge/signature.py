"""Authentic, unique details per creature (Warhammer / Warcraft heraldry, tribal marks, trophies, accessories).
Applied after a mob is built and before its atlas is painted: SIG[short_name](model)."""
from .humanoid import M, dec, R


def H(m):            # the humanoid that owns the dimensions (the rider on mounted mobs)
    return getattr(m, "rider", m)


def _chest(h):
    return next((c for c in h.bones[h.body]["cubes"] if c.s[0] == h.tw and c.s[2] == h.td), None)


def badge(m, name, slot="trim", base="armor", tone=3.2):
    """Heraldic plate on the breast (7x7 emblem)."""
    h = H(m)
    w = max(7, h.tw - 4)
    y = h.sh - 3 - 7
    h.box(h.body, (-w / 2, y, -h.td / 2 - 2), (w, 7, 1), dec(M(base, "plate", tone), ("north", "emblem", name, slot)))


def back_badge(m, name, slot="trim", base="cloth"):
    h = H(m)
    w = max(7, h.tw - 4)
    h.box(h.body, (-w / 2, h.sh - 3 - 7, h.td / 2 + 1), (w, 7, 1), dec(M(base, "cloth", 2.8), ("south", "emblem", name, slot)))


def shield_emblem(m, name, slot="trim"):
    h = H(m)
    for bn, b in h.bones.items():
        if "shield" in bn:
            for c in b["cubes"]:
                if c.s[0] >= 7 and c.s[2] == 2:
                    c.mat = dict(c.mat); c.mat["decals"] = [d for d in c.mat.get("decals", ()) if d[0] != "north"] + [("north", "emblem", name, slot)]
                    return


def head_cube(h):
    return next((c for c in h.bones[h.head]["cubes"] if c.s[0] == h.hs and c.s[1] == h.hs), None)


def decal_head(m, *d):
    c = head_cube(H(m))
    if c: c.mat = dec(c.mat, *d)


def epaulets(m, slot="trim"):
    h = H(m)
    for bone, sgn in ((h.arm_l, 1), (h.arm_r, -1)):
        pw = R((h.aw + 3))
        for k in range(3):
            x = sgn * h.tw / 2 + (k - 1) * 2 - (0 if sgn > 0 else 0) + (h.aw / 2 - 0.5) * sgn - (0.5 if sgn < 0 else 0)
            h.box(bone, (x - 0.5, h.sh - 7, -1), (1, 3, 1), M(slot, "woven", 3.4))


def sash(m, slot="cloth"):
    H(m).strap_cross(slot, "trim")


def antlers(m, slot="bone"):
    h = H(m)
    for sgn in (1, -1):
        x = sgn * (h.hs / 2 - 1) - (0 if sgn > 0 else 1)
        h.box(h.head, (x, h.sh + h.hs, -0.5), (1, 4, 1), M(slot, "bone", 3.3))
        h.box(h.head, (x + sgn * 1, h.sh + h.hs + 3, -0.5), (1, 3, 1), M(slot, "bone", 3.6))
        h.box(h.head, (x + sgn * 2, h.sh + h.hs + 5, -0.5), (1, 2, 1), M(slot, "bone", 3.9))
        h.box(h.head, (x - sgn * 1, h.sh + h.hs + 2, -0.5), (1, 3, 1), M(slot, "bone", 3.6))


def tusks(m, slot="bone"):
    h = H(m)
    for sgn in (1, -1):
        h.box(h.head, (sgn * (h.hs / 2 - 2) - (0 if sgn > 0 else 1), h.sh - 1, -h.hs / 2 - 1), (1, 3, 1), M(slot, "bone", 3.9))


def braids(m, slot="hair"):
    h = H(m)
    for sgn in (1, -1):
        for k in range(3):
            h.box(h.head, (sgn * (h.hs / 3) - 0.5, h.sh + 1 - k * 2, h.hs / 2 + (0 if k < 2 else 0.5)), (1, 2, 1), M(slot, "woven", 2.6 + (k % 2) * 0.4))


def skull_trophies(m):
    h = H(m)
    for sgn in (1, -1):
        h.box(h.body, (sgn * (h.tw / 2 - 2) - (0 if sgn > 0 else 2), h.lh + R(1 * h.s), -h.td / 2 - 2.5), (2, 2, 1), M("bone", "bone", 3.8))


def spiked_knees(m, slot="trim"):
    h = H(m)
    for bone, sgn in ((h.leg_l, 1), (h.leg_r, -1)):
        h.box(bone, (sgn * h.lw / 2 - 0.5, h.lh - R(h.lh * 0.5) - 1, -h.lw / 2 - 3), (1, 1, 2), M(slot, "bone", 3.8))


def chain(m, slot="metal"):
    h = H(m)
    n = h.tw - 2
    for i in range(n):
        x = -n / 2 + i
        sag = 3 - abs(i - (n - 1) / 2) * (3.0 / max(1, (n - 1) / 2))
        h.box(h.body, (x, h.sh - 4 - sag, -h.td / 2 - 2.5), (1, 1, 1), M(slot, "metal", 3.7))


def eyepatch(m):
    h = H(m)
    h.box(h.head, (-h.hs / 2 + 1, h.sh + R(h.hs * 0.45) - 1, -h.hs / 2 - 0.5), (2, 2, 1), M("dark", "flat", 1.2))
    h.box(h.head, (-h.hs / 2, h.sh + R(h.hs * 0.45), -h.hs / 2 - 0.5), (h.hs, 1, 1), M("leather", "leather", 2.2))


def feather_plume(m, slot="plume"):
    h = H(m)
    for k in range(4):
        h.box(h.head, (-1, h.sh + h.hs + 1 + k, h.hs / 2 - 1 + k), (2, 3, 2), M(slot, "stripes", 3.0 + k * 0.2))


def gem_necklace(m, slot="glow"):
    h = H(m)
    for dx in (-2, 0, 2):
        h.box(h.body, (dx - 0.5, h.sh - 5 - (1 if dx == 0 else 0), -h.td / 2 - 2.5), (1, 1, 1), M(slot, "glow", 4.2))


def back_spines(m, slot="bone", n=4):
    h = H(m)
    for i in range(n):
        h.box(h.body, (-1, h.sh - 3 - i * 3, h.td / 2 + 1), (2, 2, 2 + (n - i) % 3), M(slot, "bone", 3.5))


def runes(m, slot="glow", name="rune"):
    h = H(m)
    for bone, sgn in ((h.arm_l, 1), (h.arm_r, -1)):
        h.box(bone, (sgn * (h.tw / 2 + h.aw / 2) - 1, h.elbow_y + 1, -h.aw / 2 - 1.5), (2, 2, 1), dec(M(slot, "glow", 4.0)))


def tattoo_chest(m, slot="paint"):
    c = _chest(H(m))
    if c: c.mat = dec(c.mat, ("north", "tattoo", slot), ("south", "tattoo", slot))


def stitch_chest(m):
    c = _chest(H(m))
    if c: c.mat = dec(c.mat, ("north", "stitches", c.s[1] // 2))


def bile(m, slot="glow"):
    h = H(m)
    for dx in (-3, 1):
        h.box(h.head, (dx, h.sh - 4, -h.hs / 2 - 1), (1, 4, 1), M(slot, "flat", 3.8))


# ---------------------------------------------------------------- per-creature signatures
SIG = {
    # Kingdom Order (blue / gold, griffon + sun + hammer heraldry)
    "royal_captain": lambda m: (badge(m, "lion"), epaulets(m), sash(m, "plume"), shield_emblem(m, "lion")),
    "royal_knight": lambda m: (badge(m, "griffon"), feather_plume(m), epaulets(m)),
    "dark_plate_knight": lambda m: (badge(m, "skull", "glow"), spiked_knees(m), chain(m)),
    "elector_knight": lambda m: (badge(m, "griffon"), feather_plume(m, "plume"), shield_emblem(m, "griffon")),
    "garithos_paladin": lambda m: (badge(m, "hammer"), epaulets(m), gem_necklace(m, "glow"), shield_emblem(m, "hammer")),
    "heide_knight": lambda m: (badge(m, "tree", "trim"), shield_emblem(m, "tree"), antlers(m)),
    "heide_hood_knight": lambda m: (badge(m, "rune_knot"), shield_emblem(m, "tree")),
    "high_elf_spearman": lambda m: (badge(m, "sun"), gem_necklace(m), feather_plume(m, "trim")),
    "imperial_guard": lambda m: (badge(m, "griffon", "trim"), epaulets(m), shield_emblem(m, "griffon")),
    "paladin_swordsman": lambda m: (badge(m, "sun", "glow"), runes(m), epaulets(m)),
    "royal_queen": lambda m: (badge(m, "fleur", "trim"), gem_necklace(m, "glow"), epaulets(m)),
    "teutonic_cleric": lambda m: (badge(m, "hammer", "trim"), gem_necklace(m, "trim")),
    "chival_warrior": lambda m: (badge(m, "fleur"), epaulets(m), feather_plume(m, "plume")),
    # Norsca (wolf, rune knots, tribal marks, trophies)
    "bandit_raider": lambda m: (eyepatch(m), decal_head(m, ("scar", 1, 1)), skull_trophies(m), chain(m, "leather")),
    "chaos_warrior": lambda m: (badge(m, "chaos_star", "glow"), spiked_knees(m), shield_emblem(m, "chaos_star", "glow")),
    "norse_berserker": lambda m: (tattoo_chest(m), braids(m, "fur"), skull_trophies(m)),
    "norse_marauder": lambda m: (badge(m, "wolf", "bone"), shield_emblem(m, "wolf", "bone"), braids(m)),
    "norse_shaman": lambda m: (badge(m, "rune_knot", "glow"), antlers(m), runes(m)),
    "skaal_villager": lambda m: (decal_head(m, ("scar", 4, 2)), braids(m)),
    "wulfrik_champion": lambda m: (badge(m, "wolf", "bone"), braids(m, "fur"), skull_trophies(m), tattoo_chest(m), tusks(m)),
    # Chaos / Nurgle
    "chaos_knight": lambda m: (badge(m, "chaos_star", "glow"), spiked_knees(m), back_badge(m, "chaos_star", "trim")),
    "void_knight": lambda m: (badge(m, "tzeentch", "glow"), gem_necklace(m, "glow"), runes(m)),
    "hornet_demon": lambda m: (badge(m, "skull", "bone"), tusks(m), back_spines(m)),
    "blood_angel": lambda m: (badge(m, "chaos_star", "glow"), gem_necklace(m, "glow"), epaulets(m, "trim")),
    "black_blocker": lambda m: (badge(m, "skull", "bone"), back_spines(m, "bone", 5), chain(m, "metal")),
    "pink_horror": lambda m: (badge(m, "tzeentch", "glow"), tusks(m)),
    "great_unclean_one": lambda m: (badge(m, "nurgle", "glow"), bile(m), back_spines(m, "bone", 4)),
    "abomination_lord": lambda m: (badge(m, "nurgle", "glow"), stitch_chest(m), bile(m), tusks(m)),
    # Faceless (eye-rune everywhere)
    "faceless_warrior": lambda m: (badge(m, "eye_rune", "glow"), shield_emblem(m, "eye_rune", "glow")),
    "faceless_berserker": lambda m: (badge(m, "eye_rune", "trim"), runes(m, "trim")),
    "faceless_general": lambda m: (badge(m, "eye_rune", "glow"), epaulets(m), back_badge(m, "eye_rune", "glow", "cloth")),
    "faceless_sorcerer": lambda m: (badge(m, "eye_rune", "glow", "cloth"), runes(m)),
    "faceless_cultist": lambda m: (badge(m, "eye_rune", "glow", "cloth"),),
    "faceless_nightmare": lambda m: (badge(m, "eye_rune", "glow", "cloth"), back_spines(m, "armor", 3)),
    # Scourge & others
    "nazgul": lambda m: (badge(m, "skull", "glow"), chain(m, "metal"), spiked_knees(m) if m.has_legs else None),
    "pirate_ghost": lambda m: (badge(m, "crossbones", "bone", "cloth"), eyepatch(m), chain(m, "trim")),
    "undead_zombie": lambda m: (stitch_chest(m), decal_head(m, ("scar", 3, 1), ("stitches", 6))),
    "santa_claus": lambda m: (badge(m, "snow", "trim", "cloth"), gem_necklace(m, "trim")),
    "ice_demon": lambda m: (badge(m, "snow", "glow"), back_spines(m, "ice", 5), tusks(m, "ice")),
    # Golems (one body, an element rune on the chest)
    "frost_golem": lambda m: badge(m, "snow", "glow", "rock"),
    "lightning_golem": lambda m: badge(m, "bolt", "accent", "rock"),
    "inferno_golem": lambda m: badge(m, "flame", "glow", "rock"),
    "ember_colossus": lambda m: (badge(m, "flame", "glow", "rock"), back_spines(m, "accent", 5)),
    "cb_inferno_golem": lambda m: badge(m, "skull", "glow", "rock"),
    "cb_hephaestus_golem": lambda m: badge(m, "anvil", "glow", "rock"),
    "big_ent": lambda m: (decal_head(m, ("scar", 2, 2)), back_spines(m, "leaf", 4)),
}
