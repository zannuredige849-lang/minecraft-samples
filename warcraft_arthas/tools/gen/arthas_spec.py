"""Arthas Menethil, the Lich King - geometry description (geometry.warcraft_arthas).

Scale: 1 unit = 1/16 block.  Feet at y=0, top of the helm at y~45, crown spikes
to y~54.  Coordinates are Bedrock geometry coordinates (character RIGHT = -X).
"""
from spec_lib import Model, chain_xy, chain_yz
from frostmourne_spec import add_frostmourne

R, L = -1, 1  # right / left sign
GRIP = (-9.5, 10.5, 0.0)  # centre of Arthas' right fist (Frostmourne grip)


def build_arthas(with_sword=True, rest_pose=True):
    m = Model("geometry.warcraft_arthas")
    B, C = m.bone, m.cube

    # ===================================================================== skeleton
    B("root", None, (0, 0, 0), "cloth", locators={"ground": (0, 0, 0)})
    B("body", "root", (0, 22, 0), "cloth", locators={"chest_core": (0, 30, -6.5)})
    B("waist", "body", (0, 19, 0), "cloth")
    B("waist_armor", "body", (0, 19, 0), "metal")
    B("tabard", "body", (0, 20, -4.6), "cloth")
    B("torso", "body", (0, 22, 0), "cloth")
    B("chest_armor", "body", (0, 22, 0), "metal")
    B("cape", "body", (0, 34, 4.5), "cloth")
    B("cape_mid", "cape", (0, 26, 5.5), "cloth")
    B("cape_low", "cape_mid", (0, 18, 6), "cloth")
    B("cape_tail", "cape_low", (0, 10, 6.5), "cloth", locators={"cape_hem": (0, 3, 7)})
    B("cape_trim", "body", (0, 34, 0), "metal")
    B("head", "body", (0, 35, 0), "cloth")
    B("helmet", "head", (0, 35, 0), "metal")
    B("helmet_crown", "helmet", (0, 43, 0), "metal", locators={"crown_top": (0, 54, -3.5)})
    B("eyes", "head", (0, 40, -4), "cloth", locators={"eye_right": (-2, 39.5, -4.4), "eye_left": (2, 39.5, -4.4)})
    B("hair", "head", (0, 42, 3.5), "cloth")
    B("hair_strands", "hair", (0, 34, 6.5), "cloth")
    for suf, s in (("right", R), ("left", L)):
        sx = 9.5 * s
        B(f"shoulder_{suf}", "body", (sx, 33, 0), "metal")
        B(f"arm_{suf}", "body", (sx, 33, 0), "cloth")
        B(f"arm_armor_{suf}", f"arm_{suf}", (sx, 33, 0), "metal")
        B(f"forearm_{suf}", f"arm_{suf}", (sx, 23, 0), "cloth")
        B(f"forearm_armor_{suf}", f"forearm_{suf}", (sx, 23, 0), "metal")
        B(f"gauntlet_{suf}", f"forearm_{suf}", (sx, 13, 0), "metal", locators={f"hand_{suf}": (sx, 10, 0)})
        B(f"frost_shoulder_{suf}", f"shoulder_{suf}", (sx, 33, 0), "frost")
        lx = 3.5 * s
        B(f"leg_{suf}", "root", (lx, 19, 0), "cloth")
        B(f"leg_armor_{suf}", f"leg_{suf}", (lx, 19, 0), "metal")
        B(f"shin_{suf}", f"leg_{suf}", (lx, 10, 0), "cloth")
        B(f"shin_armor_{suf}", f"shin_{suf}", (lx, 10, 0), "metal")
        B(f"boot_{suf}", f"shin_{suf}", (lx, 3, 0), "metal")
    B("frost_crown", "helmet_crown", (0, 43, 0), "frost")
    B("frost_p2_aura", "body", (0, 22, 0), "frost")
    B("frost_p3_wings", "body", (0, 30, 5), "frost")

    # ---- rest (bind) pose: ready stance, Frostmourne held out in front, blade up-forward.
    # Negative X rotation raises limbs forward in Bedrock. Animations are added on top of this pose.
    if rest_pose:
        m.bones["arm_right"].rotation = (-30, 0, 6)
        m.bones["forearm_right"].rotation = (-22, 0, 0)
        m.bones["arm_left"].rotation = (-12, 0, -7)
        m.bones["forearm_left"].rotation = (-14, 0, 0)

    # ===================================================================== LEGS
    C("leg_right", (-6, 10, -3), (5, 9, 6), "cloth_dark")
    C("shin_right", (-5.5, 3, -2.5), (4, 7, 5), "cloth_dark")
    # cuisse (thigh armour)
    C("leg_armor_right", (-6.5, 11, -3.5), (6, 6, 1), "plate", detail="plate_fluted")
    C("leg_armor_right", (-7, 10, -3), (1, 9, 6), "plate")
    C("leg_armor_right", (-1.5, 10, -3), (1, 9, 6), "plate")
    C("leg_armor_right", (-6.5, 11, 2.5), (6, 8, 1), "plate")
    C("leg_armor_right", (-7, 17, -3.5), (7, 2, 7), "plate_trim")
    C("leg_armor_right", (-5.5, 14.5, -4.5), (4, 1, 1), "plate_trim")
    # poleyn (knee guard) + spike
    C("leg_armor_right", (-6, 8, -4.5), (5, 4, 2), "plate", detail="plate_fluted")
    m.spike("leg_armor_right", (-3.5, 9, -5.5), 3, 2, 5, 2, 26, plane="x", mat="spike")
    # greave
    C("shin_armor_right", (-6, 3, -3.5), (5, 6, 1), "plate", detail="plate_fluted")
    C("shin_armor_right", (-6.5, 3, -3), (1, 7, 6), "plate")
    C("shin_armor_right", (-1.5, 3, -3), (1, 7, 6), "plate")
    C("shin_armor_right", (-6, 3, 2.5), (5, 7, 1), "plate")
    C("shin_armor_right", (-4, 4, -4.5), (1, 5, 1), "plate_trim")
    C("shin_armor_right", (-6.5, 9, -3.5), (6, 2, 7), "plate_trim")
    # sabaton boot
    C("boot_right", (-6, 0, -3), (5, 4, 6), "plate")
    C("boot_right", (-5.5, 0, -6), (4, 3, 3), "plate", detail="plate_fluted")
    C("boot_right", (-5, 0, -9), (3, 2, 3), "plate_trim")
    m.spike("boot_right", (-3.5, 0.5, -10), 2, 2, 3, 2, 70, plane="x", mat="spike")
    m.spike("boot_right", (-3.5, 1, 3), 2, 2, 3, 2, -55, plane="x", mat="spike")
    C("boot_right", (-6.5, 0, -3.5), (1, 1, 7), "plate_trim")
    for a in ("leg", "leg_armor", "shin", "shin_armor", "boot"):
        m.mirror_cubes(f"{a}_right", f"{a}_left")

    # ===================================================================== WAIST / TABARD
    C("waist", (-6, 19, -3.5), (12, 3, 7), "cloth_dark")
    C("waist_armor", (-6.5, 19, -4), (13, 2, 8), "plate_trim")
    C("waist_armor", (-2, 18, -5), (4, 3, 1), "skull_plate", detail="skull")      # skull buckle
    C("waist_armor", (-8, 12, -4), (5, 7, 1), "plate", detail="plate_fluted", pivot=(-6, 19, -3.5), rot=(0, 0, 10))
    C("waist_armor", (3, 12, -4), (5, 7, 1), "plate", detail="plate_fluted", pivot=(6, 19, -3.5), rot=(0, 0, -10))
    C("waist_armor", (-5, 12, 3.5), (10, 7, 1), "plate", detail="plate_fluted")
    C("waist_armor", (-7, 14, -1.5), (1, 5, 4), "plate_trim", pivot=(-6, 19, 0), rot=(0, 0, 8))
    C("waist_armor", (6, 14, -1.5), (1, 5, 4), "plate_trim", pivot=(6, 19, 0), rot=(0, 0, -8))
    C("tabard", (-3, 8, -5.2), (6, 12, 1), "tabard", detail="tabard_main")
    for x0, ln in ((-3, 3), (-1, 1), (0, 4), (2, 2)):
        C("tabard", (x0, 8 - ln, -5.2), (1 if ln < 3 else 2, ln, 1), "tabard", detail="tabard_hem")

    # ===================================================================== TORSO
    C("torso", (-6, 22, -3.5), (12, 12, 7), "cloth_dark")
    # abdomen lames
    for k, (w, ox) in enumerate(((13, -6.5), (12, -6), (13, -6.5))):
        C("chest_armor", (ox, 22 + 2 * k, -4.5), (w, 2, 9), "plate_trim" if k == 1 else "plate", detail="plate_lame")
    # breastplate (V-shaped halves)
    C("chest_armor", (-7.5, 28, -5), (7, 6, 2), "plate", detail="plate_fluted", pivot=(0, 31, -4), rot=(0, 7, 0))
    C("chest_armor", (0.5, 28, -5), (7, 6, 2), "plate", detail="plate_fluted", pivot=(0, 31, -4), rot=(0, -7, 0))
    C("chest_armor", (-8, 28, -4), (1, 6, 8), "plate")
    C("chest_armor", (7, 28, -4), (1, 6, 8), "plate")
    C("chest_armor", (-7, 28, 3), (14, 6, 2), "plate", detail="plate_fluted")
    C("chest_armor", (-6.5, 22, 3.5), (13, 6, 1), "plate", detail="plate_lame")
    C("chest_armor", (-1, 28, -6.5), (2, 7, 1), "plate_trim")                      # sternum ridge
    C("chest_armor", (-1, 22, -5.5), (2, 6, 1), "plate_trim")
    C("chest_armor", (-2, 29, -7.5), (4, 4, 1), "skull_plate", detail="skull")     # chest skull plaque
    for s in (R, L):                                                              # glowing rune channels
        x0 = -6 if s == R else 3
        C("chest_armor", (x0, 30, -5.6), (3, 1, 1), "rune", detail="rune_h")
        C("chest_armor", (x0 + (0 if s == R else 1), 32, -5.6), (2, 1, 1), "rune", detail="rune_h")
        C("chest_armor", ((-5.5 if s == R else 4.5), 24, -5.2), (1, 3, 1), "rune", detail="rune_v")
    # gorget ring + high back collar
    C("chest_armor", (-4, 34, -4.5), (8, 3, 1), "plate")
    C("chest_armor", (-4, 34, 3.5), (8, 3, 1), "plate")
    C("chest_armor", (-5, 34, -3.5), (1, 3, 7), "plate")
    C("chest_armor", (4, 34, -3.5), (1, 3, 7), "plate")
    C("chest_armor", (-4.5, 36, -4), (9, 1, 8), "plate_trim")
    for x, ln, tl in ((-4, 6, -14), (0, 8, 0), (4, 6, 14)):
        m.spike("chest_armor", (x, 35, 4.5), 2, 2, ln, 2, tl, plane="x" if x == 0 else "z", mat="spike")

    # ===================================================================== CAPE
    C("cape", (-7, 34, 3.5), (14, 3, 2), "cape", detail="cape_collar")
    C("cape", (-8, 26, 4.5), (16, 8, 1), "cape", detail="cape_a")
    C("cape_mid", (-8.5, 18, 5), (17, 8, 1), "cape", detail="cape_b")
    C("cape_low", (-9, 10, 5.5), (18, 8, 1), "cape", detail="cape_c")
    C("cape_tail", (-9.5, 3, 6), (19, 7, 1), "cape", detail="cape_d")
    for x0, ln in ((-9, 3), (-6, 1), (-4, 3), (-1, 2), (1, 3), (4, 1), (6, 2), (8, 3)):
        C("cape_tail", (x0, 3 - ln, 6), (2 if x0 % 2 == 0 else 3, ln, 1), "cape", detail="cape_hem")
    for x0 in (-5, 0, 5):                                                          # drape folds
        C("cape", (x0, 27, 5.5), (1, 7, 1), "cape_fold")
        C("cape_mid", (x0 + 1, 19, 6), (1, 7, 1), "cape_fold")
        C("cape_low", (x0 - 1, 11, 6.5), (1, 7, 1), "cape_fold")
    C("cape", (-9, 26, 3.5), (2, 8, 1), "cape", pivot=(-8, 34, 4), rot=(0, 28, 0))
    C("cape", (7, 26, 3.5), (2, 8, 1), "cape", pivot=(8, 34, 4), rot=(0, -28, 0))
    # chest chain & soul-gem clasp
    for i in range(-4, 5):
        C("cape_trim", (i * 1.25 - 0.5, 33.2 - 0.35 * (4 - abs(i)), -6), (1, 1, 1), "chain")
    C("cape_trim", (-1.5, 30.5, -6.2), (3, 3, 1), "plate_trim")
    C("cape_trim", (-1, 31, -6.7), (2, 2, 1), "gem", detail="gem_blue")

    # ===================================================================== SHOULDERS (right)
    C("shoulder_right", (-13, 34, -4), (7, 2, 8), "plate", detail="plate_fluted")
    C("shoulder_right", (-14, 32, -4.5), (8, 2, 9), "plate_trim", detail="plate_lame")
    C("shoulder_right", (-14.5, 30, -4), (8, 2, 8), "plate", detail="plate_lame")
    C("shoulder_right", (-15, 30, -3), (1, 6, 6), "plate_trim")
    C("shoulder_right", (-14, 31, -5.5), (5, 5, 1), "plate_trim", detail="plate_fluted")
    m.spike("shoulder_right", (-13, 36, 0), 3, 3, 14, 4, -24, plane="z", mat="spike")
    m.spike("shoulder_right", (-10.5, 36, -3), 2, 2, 9, 3, -10, plane="z", mat="spike")
    m.spike("shoulder_right", (-10.5, 36, 3), 2, 2, 9, 3, -14, plane="z", mat="spike")
    m.spike("shoulder_right", (-15, 31, 0), 2, 2, 6, 2, -75, plane="z", mat="spike")
    # frost on shoulder
    m.spike("frost_shoulder_right", (-12, 36, -2), 1, 2, 5, 2, -30, plane="z", mat="ice")
    m.spike("frost_shoulder_right", (-9, 36, 2), 1, 2, 4, 2, 10, plane="z", mat="ice")
    for ox, ln in ((-14, 3), (-11.5, 2), (-8.5, 3)):
        C("frost_shoulder_right", (ox, 30 - ln, -3), (1, ln, 1), "ice", inflate=-0.1)
    m.mirror_cubes("shoulder_right", "shoulder_left")
    m.mirror_cubes("frost_shoulder_right", "frost_shoulder_left")

    # ===================================================================== ARMS (right)
    C("arm_right", (-12, 23, -2.5), (5, 11, 5), "cloth_dark")
    C("arm_armor_right", (-12.5, 24, -3), (6, 6, 6), "plate", detail="plate_fluted")
    C("arm_armor_right", (-12.5, 30, -3), (6, 1, 6), "plate_trim")
    C("arm_armor_right", (-10.5, 24, -3.5), (2, 6, 1), "plate_trim")
    C("forearm_right", (-11.5, 13, -2), (4, 10, 4), "cloth_dark")
    C("forearm_armor_right", (-12.5, 21, -3.5), (6, 4, 7), "plate_trim")
    m.spike("forearm_armor_right", (-13, 23, 0), 3, 3, 5, 2, -80, plane="z", mat="spike")
    C("forearm_armor_right", (-12, 13, -3), (5, 8, 6), "plate", detail="plate_fluted")
    C("forearm_armor_right", (-13, 14, -1), (1, 6, 2), "plate_trim")
    C("forearm_armor_right", (-12, 12, -3), (5, 2, 6), "plate_trim")
    # gripping gauntlet
    C("gauntlet_right", (-11.5, 8, -2.5), (4, 5, 5), "plate", detail="plate_fluted")
    C("gauntlet_right", (-12, 11, -3), (5, 2, 6), "plate_trim")
    C("gauntlet_right", (-11.5, 8, -3.5), (4, 3, 1), "plate", detail="plate_lame")   # curled fingers
    C("gauntlet_right", (-11.5, 8, 2.5), (4, 3, 1), "plate", detail="plate_lame")
    C("gauntlet_right", (-7.5, 9, -2), (1, 3, 4), "plate")
    for fz in (-3, -1.5, 0, 1.5):
        C("gauntlet_right", (-11, 10.5, fz - 1.5 if fz < 0 else fz), (1, 1, 1), "spike", inflate=-0.1)
    m.mirror_cubes("arm_right", "arm_left")
    m.mirror_cubes("arm_armor_right", "arm_armor_left")
    m.mirror_cubes("forearm_right", "forearm_left")
    m.mirror_cubes("forearm_armor_right", "forearm_armor_left")
    # left gauntlet: open clawed hand
    C("gauntlet_left", (7.5, 8, -2.5), (4, 5, 5), "plate", detail="plate_fluted")
    C("gauntlet_left", (7, 11, -3), (5, 2, 6), "plate_trim")
    for k, fz in enumerate((-2, -0.5, 1)):
        C("gauntlet_left", (8, 4, fz), (1, 4, 1), "plate_trim", inflate=-0.1, pivot=(8.5, 8, fz + 0.5), rot=(-8 * (k + 1), 0, 0))
    C("gauntlet_left", (10.5, 5, -1.5), (1, 4, 1), "plate_trim", inflate=-0.1, pivot=(11, 9, -1), rot=(0, 0, -20))

    # ===================================================================== HEAD
    C("head", (-4, 36, -4), (8, 8, 8), "skin", detail="face")
    C("head", (-2, 34, -2), (4, 2, 4), "skin", detail="neck")
    C("eyes", (-3.5, 39, -4.25), (3, 1, 1), "eye", detail="eye")
    C("eyes", (0.5, 39, -4.25), (3, 1, 1), "eye", detail="eye")
    C("hair", (-3, 27, 5.5), (6, 15, 2), "hair", detail="hair_back")
    C("hair", (-4, 41, -4.3), (8, 1, 1), "hair", detail="hair_front")
    for x0, ln in ((-3, 17), (-1, 20), (1, 15)):
        C("hair_strands", (x0, 27 - ln + 8, 7.5), (2, ln, 1), "hair", detail="hair_strand")
    # helmet shell (open-faced Helm of Domination: brow band, rear guard, ear plates, crown of spikes)
    C("helmet", (-4.5, 42, -4.5), (9, 3, 9), "plate", detail="plate_fluted")          # skull cap
    C("helmet", (-5, 43, -5), (10, 2, 10), "plate_trim")                              # crown band
    C("helmet", (-4.5, 36, 4), (9, 8, 2), "plate", detail="plate_lame")               # rear neck guard
    C("helmet", (-5, 38, -2.5), (1, 5, 6), "plate", detail="plate_fluted")             # ear plates
    C("helmet", (4, 38, -2.5), (1, 5, 6), "plate", detail="plate_fluted")
    C("helmet", (-4.5, 41.5, -5.2), (9, 1, 1), "plate_trim")                          # brow ridge (thin: eyes stay visible)
    C("helmet", (-4.5, 40.5, -5.2), (2, 1, 1), "plate_trim", inflate=-0.2)            # downward brow points
    C("helmet", (2.5, 40.5, -5.2), (2, 1, 1), "plate_trim", inflate=-0.2)
    C("helmet", (-0.5, 38, -4.8), (1, 3, 1), "plate_trim", inflate=-0.15)             # slim nasal guard
    C("helmet", (-1, 43, -5.6), (2, 2, 1), "gem", detail="gem_blue")                  # forehead soul-gem
    # crown of spikes: tall centre, fanning pairs, sweeping side horns, swept-back crest
    m.spike("helmet_crown", (0, 45, -3.5), 2, 2, 15, 4, 0, plane="z", mat="spike")
    for s_ in (R, L):
        m.spike("helmet_crown", (3.5 * s_, 45, -3), 2, 2, 12, 3, 10 * s_, plane="z", mat="spike")
        m.spike("helmet_crown", (5.5 * s_, 44.5, -1.5), 2, 2, 11, 3, 24 * s_, plane="z", mat="spike")
        m.spike("helmet_crown", (5.5 * s_, 44, 1.5), 2, 2, 10, 3, 40 * s_, plane="z", mat="spike")
        chain_yz(m, "helmet_crown", [(44.5, 3), (47.5, 5.5), (51, 8.5)], [3, 2], 2, "spike", x=2.5 * s_)
    chain_yz(m, "helmet_crown", [(44.5, 3), (48, 5.5), (52, 9.5)], [3, 2], 2, "spike", x=0)
    m.spike("frost_crown", (-2.5, 45.5, -5), 1, 2, 4, 2, -18, plane="z", mat="ice")
    m.spike("frost_crown", (2.5, 45.5, -5), 1, 2, 4, 2, 18, plane="z", mat="ice")

    # ===================================================================== PHASE FROST
    for s in (R, L):
        m.spike("frost_p2_aura", (6.5 * s, 33.5, 3), 2, 2, 6, 2, 22 * s, plane="z", mat="ice")
        m.spike("frost_p2_aura", (3 * s, 20.5, -5), 2, 2, 5, 2, 40 * s, plane="z", mat="ice")
        m.spike("frost_p2_aura", (6 * s, 22, 4), 2, 2, 5, 2, 30 * s, plane="z", mat="ice")
        # phase-3 wings of ice swept behind the cape
        pts = [(4 * s, 36), (9 * s, 40), (16 * s, 46), (21 * s, 54)]
        chain_xy(m, "frost_p3_wings", pts, [3, 3, 2], 1, "ice", z=8)
        pts2 = [(3 * s, 33), (9 * s, 35), (16 * s, 39), (22 * s, 45)]
        chain_xy(m, "frost_p3_wings", pts2, [2, 2, 2], 1, "ice", z=9)
        pts3 = [(3 * s, 30), (9 * s, 31), (15 * s, 33), (20 * s, 37)]
        chain_xy(m, "frost_p3_wings", pts3, [2, 2, 1], 1, "ice", z=10)

    if with_sword:
        # +90deg about X lays the blade along -Z (forward) so the grip runs ACROSS the fist; the raised
        # forearm then lifts the blade up-forward.
        add_frostmourne(m, "gauntlet_right", GRIP, rotation=(90, 0, 0))
    return m
