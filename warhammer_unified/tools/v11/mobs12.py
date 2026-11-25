"""v10.8 high-detail sculpts (no simplification): rounded volumes from slices, limbs / horns / tentacles from rotated segments,
patchwork materials. Bones / pivots stay those of the add-on's geometry (animations keep working)."""
from .rig11 import Rig11, M
from .mobs11 import pal, FACELESS


def S(r, side_fn):
    for side in (-1, 1): side_fn(side)


# ============================================================================================ 1. ABOMINATION LORD
def abomination_lord(base):
    p = pal(flesh="#a7a072", flesh2="#8e8a5a", flesh3="#7f8a5e", face="#7c8a68", bile="#8cff3c", iron="#6a6a74", rust="#7a4a2c",
            indigo="#2d2c60", leather="#5a3a26", bone="#e0d6b8", horn="#cfc6a6", glow="#8cff3c", dark="#141018", gore="#6e2a26", chain="#5c5c66")
    r = Rig11("geometry.abomination_lord", p, base); r.png = 1024
    F = lambda s="flesh", t=3.0, **k: M(s, "flesh", t, **k)
    I = lambda t=3.0, **k: M("iron", "forged", t, **k)
    st = lambda *d: [("north", "stitch", d[0]), ("east", "vstitch", d[1] if len(d) > 1 else 3)]
    # --- the gut: an enormous low belly resting forward, patchwork of three flesh tones
    r.ell("torso", (0, 21, -4), (15, 10, 13), F("flesh", 3.0, decals=st(4, 5)))
    r.ell("torso", (-7, 18, -12), (6, 6, 4), F("flesh2", 3.1, decals=[("north", "stitch", 3)]), cross=False)
    r.ell("torso", (8, 24, -12), (5, 5, 4), F("flesh3", 3.0, decals=[("north", "vstitch", 4)]), cross=False)
    r.c("torso", -10, 11, -15, 20, 3, 16, F("flesh2", 2.4))                                               # sagging underside
    # chest, hump, shoulders
    r.ell("torso", (0, 34, -1), (12, 6, 10), F("flesh2", 3.0, decals=st(3, 4)))
    r.ell("torso", (0, 37, 6), (9, 5, 6), F("flesh3", 2.9, decals=[("south", "stitch", 3)]))
    S(r, lambda s: r.ell("torso", (s * 14, 34, 0), (5, 5, 6), F("flesh", 3.1), cross=False))
    # open ribs on the left flank, glowing bile gland on the right
    r.c("torso", 9, 25, -12, 6, 9, 1, F("gore", 2.3, decals=[("north", "ribs", "bone")]))
    r.c("torso", 9, 25, -13, 1, 9, 2, M("bone", "bone", 3.4)); r.c("torso", 14, 25, -13, 1, 9, 2, M("bone", "bone", 3.2))
    r.c("torso", -12, 17, -16, 7, 8, 3, M("bile", "glow", 4.0)); r.c("torso", -13, 16, -15, 9, 10, 1, F("flesh2", 2.2))
    # iron staples over the seams, boils, meat hooks in the back, chain belt
    for (x, y, z) in ((-4, 26, -17), (3, 20, -17), (-14, 22, -8), (14, 18, -6), (-2, 30, -11)):
        r.c("torso", x, y, z, 3, 1, 1, I(3.5))
    for (x, y, z) in ((5, 28, -15), (-6, 14, -16), (12, 30, -7), (-12, 30, 3)):
        r.c("torso", x, y, z, 2, 2, 1, M("bile", "glow", 3.4))
    for (x, y, z, a) in ((-5, 36, 11, -25), (2, 33, 12, -15), (7, 38, 10, -30)):
        r.seg("torso", (x, y, z), (x, y + 5, z + 3), 1, 1, I(3.6))
        r.seg("torso", (x, y + 5, z + 3), (x, y + 4, z + 6), 1, 1, I(3.9))
    pts = [(-15, 20, -8), (-10, 18, -16), (0, 17, -18), (10, 18, -16), (15, 20, -8)]
    r.chain("torso", pts, 2, 2, lambda i: M("chain", "forged", 2.8 + 0.2 * (i % 2)))
    # bone spikes from the right shoulder
    for (dx, dy, dz, l) in ((-2, 2, -2, 8), (0, 3, 1, 9), (2, 1, 3, 7), (-3, 0, 3, 6)):
        b = (-14 + dx, 37 + dy, dz)
        r.chain("torso", [b, (b[0] - 3, b[1] + l * 0.6, b[2] + 1), (b[0] - 5, b[1] + l, b[2] + 2)], 2, 1, lambda i: M("horn", "horn", 3.0 + 0.6 * i))
    # --- head: small, sunk forward between the shoulders; iron mask with a toothed jaw, tusks, burning slits
    r.c("head", -5, 37, -14, 10, 8, 9, M("face", "flesh", 2.9))
    r.c("head", -5.5, 39, -15, 11, 7, 3, I(3.1, decals=[("north", "eyes", "bile", 2)]))
    r.c("head", -4.5, 35, -16, 9, 3, 6, I(2.7, decals=[("north", "mouth", 0, 7, "bone")]))
    S(r, lambda s: r.chain("head", [(s * 3.5, 36, -15), (s * 4.5, 38, -17), (s * 4, 40, -18)], 1, 1, lambda i: M("bone", "teeth", 3.8)))
    r.c("head", -1, 45, -14, 2, 2, 9, I(3.6))
    S(r, lambda s: r.chain("head", [(s * 5, 43, -10), (s * 8, 46, -10), (s * 9, 50, -11), (s * 8, 53, -12)], 3, 1, lambda i: M("horn", "horn", 3.0 + 0.4 * i)))
    r.c("head", -3, 44, -12, 6, 2, 6, F("flesh3", 3.2, decals=[("up", "stitch", 3)]))                    # stitched scalp
    # --- arms: massive, stitched; right holds a hook on a chain, left the cleaver (weapon bone)
    for side, up, fo in ((-1, "rightArm", "rightForearm"), (1, "leftArm", "leftForearm")):
        x = 16 * side
        r.seg(up, (x, 34, 0), (x + side, 22, -1), 8, 8, F("flesh", 3.0, decals=[("north", "stitch", 5)]))
        r.ell(up, (x + side * 1.5, 29, 0), (5, 5, 5), F("flesh2", 3.1), cross=False)
        r.seg(fo, (x + side, 22, -1), (x + side, 8, -3), 9, 9, F("flesh3", 2.9, decals=[("east", "vstitch", 4)]))
        r.c(fo, x + side - 5, 10, -8, 10, 3, 10, I(2.8))                                                   # shackle
        r.ell(fo, (x + side, 6, -3), (5, 3, 5), F("flesh", 2.8), cross=False)                     # fist
        for k in range(3):
            r.c(fo, x + side - 3 + k * 2.2, 3, -8, 1, 3, 2, F("flesh2", 2.6))                              # fingers
    r.seg("rightForearm", (-17, 6, -6), (-17, 6, -14), 2, 2, M("leather", "leather", 2.6))
    for k in range(4):
        r.c("rightForearm", -17.5, 4 - k * 2, -15 - k, 1, 2, 1, M("chain", "forged", 3.0 + 0.2 * k))
    r.chain("rightForearm", [(-17, -3, -18), (-17, -6, -18), (-17, -7, -15), (-17, -4, -13)], 2, 1, lambda i: I(3.4 + 0.2 * i))
    # cleaver: broad jagged blade, rusted spine, bone grip
    r.c("weapon", 15, 5, -2.5, 2, 9, 2, M("bone", "bone", 3.0)); r.c("weapon", 14.5, 4, -3, 3, 1, 3, I(3.2))
    r.c("weapon", 14, 13, -3, 4, 2, 3, I(2.8))
    r.c("weapon", 12, 15, -3, 12, 22, 1, I(3.1, decals=[("north", "stitch", 6)]))
    r.c("weapon", 11, 15, -3.5, 2, 22, 2, M("rust", "forged", 2.6))
    for k in range(6):
        r.c("weapon", 24, 16 + k * 3.5, -3, 1, 2, 1, I(4.0))
    r.c("weapon", 12, 37, -3, 10, 2, 1, I(3.6)); r.c("weapon", 13, 31, -3.2, 2, 2, 1, M("dark", "flat", 1.5))  # hanging hole
    # pelvis, loincloth, legs with shackles
    r.ell("pelvis", (0, 12, 0), (9, 3, 7), F("flesh2", 2.8), cross=False)
    r.c("pelvis", -6, 2, -9, 12, 9, 1, M("indigo", "cloth", 2.8, bands=[("leather", "leather", 0.0, 0.16)]))
    r.c("pelvis", -6, 4, 7, 12, 7, 1, M("indigo", "cloth", 2.5))
    for side, bn in ((-1, "rightLeg"), (1, "leftLeg")):
        x = 7 * side
        r.ell(bn, (x, 8, 0), (5, 4, 5), F("flesh", 2.9), cross=False)
        r.c(bn, x - 5, 0, -7, 10, 4, 12, F("flesh3", 2.6))
        r.c(bn, x - 5.5, 4, -5.5, 11, 2, 11, I(2.7))
        for k in range(3):
            r.c(bn, x - 4 + k * 3, 0, -8, 2, 2, 1, M("bone", "horn", 3.4))                                  # toenails
    return r




def claws(r, bone, base, n=3, length=3, spread=1.6, fwd=-1, mat=None, down=True):
    x, y, z = base
    for k in range(n):
        xx = x + (k - (n - 1) / 2) * spread
        r.chain(bone, [(xx, y, z), (xx, y - (1.5 if down else 0), z + fwd * length * 0.6), (xx, y - (length if down else 1), z + fwd * length)],
                1.4, 1, lambda i: mat or M("bone", "horn", 3.4 + i * 0.4))


# ============================================================================================ 2. GREAT UNCLEAN ONE
def great_unclean_one(base):
    p = pal(plague="#6f8436", plague2="#a6a35a", plague3="#58712e", pus="#e8ec5c", guts="#a03a36", gore="#4a1e1a", tongue="#cc2c2c",
            horn="#c6b88e", rust="#6e4a2c", iron="#5e5e66", leather="#4a3424", glow="#9cff48", dark="#141a10", bone="#e6dcbc")
    r = Rig11("geometry.great_unclean_one", p, base); r.png = 1024
    F = lambda s="plague", t=3.0, **k: M(s, "flesh", t, **k)
    r.ell("torso", (0, 22, -3), (17, 12, 15), F("plague2", 3.0, decals=[("north", "spots", "pus", 5), ("east", "spots", "pus", 4), ("west", "spots", "pus", 4)]))
    r.ell("torso", (0, 13, -6), (15, 5, 13), F("plague2", 2.7))
    r.ell("torso", (0, 34, 0), (14, 6, 11), F("plague", 3.0, decals=[("north", "spots", "pus", 3)]))
    r.ell("torso", (0, 38, 7), (10, 5, 6), F("plague3", 2.9, decals=[("south", "spots", "pus", 4)]))
    r.c("torso", -9, 26, -19, 18, 3, 2, F("plague2", 2.6, decals=[("north", "mouth", 0, 16, "bone")]))          # belly maw
    r.c("torso", -1, 23, -20, 2, 4, 1, M("tongue", "flesh", 3.4))
    r.c("torso", -8, 15, -19, 16, 9, 2, F("gore", 2.2, decals=[("north", "ribs", "guts")]))                   # torn belly
    r.chain("torso", [(-7, 20, -20), (-5, 13, -22), (0, 11, -21), (5, 13, -22), (7, 19, -20)], 3, 2, lambda i: M("guts", "flesh", 3.0 + 0.2 * (i % 2)))
    r.chain("torso", [(-2, 12, -21), (-3, 7, -20), (-1, 4, -19)], 2, 2, lambda i: M("guts", "flesh", 3.2))
    for (x, y) in ((-12, 14), (11, 15), (-4, 9)):
        r.chain("torso", [(x, y, -17), (x, y - 3, -18), (x + 1, y - 6, -17)], 1, 1, lambda i: M("iron", "forged", 2.8 + 0.3 * i))
    for (x, y, z) in ((-14, 28, -10), (13, 24, -12), (-6, 32, -11), (8, 33, -9), (15, 18, -6), (-16, 20, -4), (3, 38, 10), (-7, 36, 11)):
        r.c("torso", x, y, z, 2, 2, 1, M("pus", "glow", 3.5))
    S(r, lambda s: r.ell("torso", (s * 17, 33, 0), (6, 5, 6), F("plague", 3.1), cross=False))
    # head
    r.c("head", -6, 39, -12, 12, 10, 11, F("plague", 3.1, decals=[("north", "eyes", "glow", 5)]))
    r.c("head", -5.5, 36, -13, 11, 4, 8, F("plague3", 2.8, decals=[("north", "mouth", 0, 9, "bone")]))
    r.chain("head", [(0, 37, -14), (0, 33, -15), (0.5, 30, -14)], 2, 2, lambda i: M("tongue", "flesh", 3.4))
    r.c("head", -2, 43, -13, 4, 2, 2, F("plague3", 3.4))                                                     # snout
    r.chain("head", [(-4, 48, -7), (-8, 53, -7), (-11, 58, -8), (-12, 62, -10)], 3, 1, lambda i: M("horn", "horn", 3.0 + 0.3 * i))
    r.chain("head", [(-8, 53, -7), (-10, 56, -4), (-10, 59, -2)], 2, 1, lambda i: M("horn", "horn", 3.4))
    r.chain("head", [(-10, 56, -8), (-14, 57, -9)], 2, 1, lambda i: M("horn", "horn", 3.6))
    r.chain("head", [(4, 48, -7), (7, 52, -8), (8, 57, -7), (6, 61, -6)], 3, 1, lambda i: M("horn", "horn", 3.0 + 0.3 * i))
    r.chain("head", [(7, 52, -8), (11, 54, -8), (13, 57, -9)], 2, 1, lambda i: M("horn", "horn", 3.5))
    for side, up, fo in ((-1, "rightArm", "rightForearm"), (1, "leftArm", "leftForearm")):
        x = 18 * side
        r.seg(up, (x, 34, 0), (x + 2 * side, 21, 0), 9, 9, F("plague", 3.0, decals=[("north", "spots", "pus", 2)]))
        r.seg(fo, (x + 2 * side, 21, 0), (x + 2 * side, 7, -2), 8, 8, F("plague3", 2.9))
        r.ell(fo, (x + 2 * side, 5, -2), (5, 3, 5), F("plague", 2.8), cross=False)
        claws(r, fo, (x + 2 * side, 4, -6), n=3, length=3, spread=2.2)
    # Bilesword
    r.c("weapon", -20, 3, -3, 2, 10, 2, M("leather", "leather", 2.5)); r.c("weapon", -20.5, 2, -3.5, 3, 1, 3, M("rust", "forged", 3.0))
    r.c("weapon", -24, 13, -4, 10, 2, 4, M("rust", "forged", 2.8, decals=[("north", "skull", 0)]))
    r.c("weapon", -24, 15, -3, 9, 28, 1, M("iron", "forged", 2.7, decals=[("north", "runes", "glow"), ("south", "runes", "glow")]))
    r.c("weapon", -20, 15, -3.5, 2, 28, 2, M("rust", "forged", 2.4))
    for k in range(7):
        r.c("weapon", -25, 16 + k * 4, -3, 1, 2, 1, M("iron", "forged", 3.9))
    r.c("weapon", -23, 43, -3, 7, 2, 1, M("iron", "forged", 3.4)); r.c("weapon", -22, 45, -3, 4, 2, 1, M("iron", "forged", 3.8))
    r.c("pelvis", -9, 1, -17, 18, 8, 1, M("rust", "cloth", 2.6))
    for side, bn in ((-1, "rightLeg"), (1, "leftLeg")):
        x = 8.5 * side
        r.ell(bn, (x, 7, -1), (6, 4, 6), F("plague", 2.9), cross=False)
        r.c(bn, x - 6, 0, -9, 12, 3, 14, F("plague3", 2.6))
        claws(r, bn, (x, 1, -9), n=3, length=2, spread=3, down=False)
    return r


# ============================================================================================ 3. HORNET DEMON
def hornet_demon(base):
    p = pal(red="#b0262e", red2="#7e1a22", vein="#1c0a10", mane="#17121c", bone="#ead9bb", horn="#e2d2b2", gold="#e0aa36",
            blk="#26222c", iron="#55555f", glow="#ffd030", hoof="#2a2026", leather="#3a2420", dark="#120a0e", crim="#ff3a3a")
    r = Rig11("geometry.hornet_demon", p, base); r.png = 1024
    U = lambda s="red", t=3.0, **k: M(s, "skin", t, **k)
    B = lambda t=3.0, **k: M("blk", "forged", t, **k)
    r.ell("torso", (0, 26, 0), (9, 6, 7), U("red", 3.1, decals=[("north", "veins", "vein"), ("east", "veins", "vein"), ("west", "veins", "vein")]))
    r.ell("torso", (0, 19, -1), (6, 4, 5), M("red2", "ribbed", 3.0))
    r.c("torso", -7, 28, -8, 14, 4, 2, B(3.1)); r.c("torso", -1, 31, -9, 2, 3, 1, M("bone", "horn", 3.6))      # spiked gorget
    S(r, lambda s: r.c("torso", s * 8 - (1 if s > 0 else 1), 18, -7, 2, 7, 1, B(3.0)))
    for k in range(4):
        x = -3 + k * 2
        r.seg("torso", (x, 33, 6), (x * 1.2, 20, 9), 2, 2, M("mane", "fur", 2.9 + 0.1 * k))
    for k, y in enumerate((31, 27, 23, 19)):
        r.chain("torso", [(0, y, 7), (0, y + 2, 10)], 1.6, 1, lambda i: M("blk", "forged", 3.3))
    r.c("torso", -9, 15, -6, 18, 3, 12, M("leather", "leather", 2.6, decals=[("north", "skull", 0)]))
    S(r, lambda s: r.chain("torso", [(s * 8, 15, -6), (s * 6, 11, -7), (s * 3, 10, -7)], 1, 1, lambda i: M("iron", "forged", 2.9)))
    r.ell("torso", (-14, 32, 0), (5, 5, 5), B(3.0), cross=True)
    for (dy, dz, a) in ((5, 0, 0), (3, -4, 0), (3, 4, 0), (0, -5, 0), (0, 5, 0), (-3, 0, 0)):
        r.chain("torso", [(-16, 32 + dy * 0.6, dz * 0.6), (-19, 32 + dy, dz)], 2, 1, lambda i: M("bone", "horn", 3.5))
    r.ell("torso", (14, 32, 0), (4, 3, 4), B(3.0), cross=False)
    r.chain("torso", [(15, 34, 0), (17, 38, 1)], 2, 1, lambda i: M("bone", "horn", 3.5))
    # head
    r.ell("head", (0, 38, -5), (5, 5, 5), U("red", 3.0, decals=[("north", "eyes", "glow", 4)]), cross=False)
    r.c("head", -4, 34, -14, 8, 5, 6, U("red2", 2.9))
    r.c("head", -3.5, 32, -13, 7, 2, 6, U("red2", 2.6, decals=[("north", "mouth", 0, 6, "bone")]))
    S(r, lambda s: r.c("head", s * 3 - (1 if s > 0 else 0), 31, -14, 1, 3, 1, M("bone", "teeth", 4.0)))
    r.c("head", -1, 32, -15, 2, 2, 1, M("gold", "gold", 3.6)); r.c("head", -1.5, 30, -15, 3, 1, 1, M("gold", "gold", 4.0))
    S(r, lambda s: r.chain("head", [(s * 5, 40, -5), (s * 10, 42, -3), (s * 13, 46, -5), (s * 12, 50, -8)], 3, 1, lambda i: M("horn", "horn", 3.0 + 0.3 * i)))
    S(r, lambda s: r.chain("head", [(s * 2, 42, -9), (s * 3, 47, -12), (s * 3, 50, -14)], 2, 1, lambda i: M("horn", "horn", 3.4 + 0.3 * i)))
    for side, up, fo in ((-1, "rightArm", "rightForearm"), (1, "leftArm", "leftForearm")):
        x = 12 * side
        r.seg(up, (x, 30, 0), (x + side, 20, -1), 7, 7, U("red", 3.0, decals=[("north", "veins", "vein")]))
        r.ell(up, (x + side, 26, 0), (4, 3, 4), U("red", 3.2), cross=False)
        r.seg(fo, (x + side, 20, -1), (x + side, 9, -2), 6, 6, U("red2", 2.9))
        r.c(fo, x + side - 4, 12, -6, 8, 4, 8, B(2.9))
        r.chain(fo, [(x + side * 4, 14, -2), (x + side * 7, 16, -2)], 2, 1, lambda i: M("bone", "horn", 3.5))
        r.ell(fo, (x + side, 7, -2), (4, 2, 4), U("red", 2.8), cross=False)
        claws(r, fo, (x + side, 6, -5), n=3, length=2.5)
    r.c("weapon", -14, 3, -3, 2, 9, 2, M("leather", "leather", 2.5))
    r.c("weapon", -18, 12, -4, 10, 2, 4, B(2.7)); S(r, lambda s: None)
    r.chain("weapon", [(-18, 13, -2), (-20, 15, -2)], 2, 1, lambda i: M("bone", "horn", 3.5))
    r.chain("weapon", [(-8, 13, -2), (-6, 15, -2)], 2, 1, lambda i: M("bone", "horn", 3.5))
    r.c("weapon", -16, 14, -3, 6, 28, 1, M("dark", "forged", 3.2))
    r.c("weapon", -18, 14, -3, 2, 26, 1, M("crim", "glow", 3.6))
    for k in range(6):
        r.c("weapon", -19, 16 + k * 4, -3, 1, 2, 1, M("crim", "glow", 4.0))
    r.c("weapon", -15, 42, -3, 4, 3, 1, M("dark", "forged", 3.6)); r.c("weapon", -14, 45, -3, 2, 2, 1, M("dark", "forged", 3.9))
    r.c("pelvis", -6, 9, -6, 12, 6, 1, M("blk", "cloth", 2.6))
    for side, bn in ((-1, "rightLeg"), (1, "leftLeg")):
        x = 5.5 * side
        r.seg(bn, (x, 14, 0), (x + side * 0.5, 8, -2), 6, 6, U("red", 2.9))
        r.seg(bn, (x + side * 0.5, 8, -2), (x + side * 0.5, 3, 2), 5, 5, U("red2", 2.8))
        r.c(bn, x - 3, 0, -2, 6, 3, 6, M("hoof", "horn", 2.6, decals=[("north", "vstitch", 3)]))
        r.c(bn, x - 3.5, 5, 1, 7, 3, 3, M("mane", "fur", 2.8))
    r.chain("tail", [(0, 15, 6), (0, 15, 12), (0, 13, 17), (0, 12, 21)], 3, 1.5, lambda i: U("red" if i < 2 else "red2", 2.9))
    for k, z in enumerate((9, 14, 18)):
        r.chain("tail", [(0, 16.5 - k * 0.8, z), (0, 18.5 - k * 0.8, z + 1)], 1, 1, lambda i: M("bone", "horn", 3.6))
    r.chain("tail", [(0, 12, 21), (0, 13, 25)], 3, 1, lambda i: M("bone", "horn", 3.4))
    return r


# ============================================================================================ 4. PINK HORROR
def pink_horror(base):
    p = pal(pink="#d98571", pink2="#b4625f", pink3="#e9a08a", gum="#8a2a3c", bone="#efe2c8", flame="#3ae8ff", flame2="#ff4ad8",
            claw="#3a2632", glow="#ff4ad8", dark="#2a0e1a")
    r = Rig11("geometry.pink_horror", p, base); r.png = 512
    P = lambda s="pink", t=3.0, **k: M(s, "ribbed", t, **k)
    r.bone("lowerArmR", "torso", [-8, 18, -3], [-35, 0, 15]); r.bone("lowerArmL", "torso", [8, 18, -3], [-35, 0, -15])
    r.ell("pelvis", (0, 12, 0), (5, 2, 4), P("pink2", 2.8), cross=False)
    r.ell("torso", (0, 20, -1), (7, 6, 6), P("pink", 3.0))
    r.c("torso", -6, 15, -8, 12, 5, 2, P("pink2", 2.8, decals=[("north", "mouth", 1, 10, "bone")]))
    r.c("torso", -5, 20, -8, 10, 1, 1, P("pink3", 3.6)); r.c("torso", -5, 14, -8, 10, 1, 1, P("pink3", 3.4))
    r.ell("torso", (0, 24, 4), (5, 3, 3), P("pink3", 3.2), cross=False)
    r.ell("head", (0, 29, -4), (6, 4, 6), P("pink", 3.1, decals=[("north", "eyes", "flame", 2, 3)]), cross=False)
    r.c("head", -5, 25, -11, 10, 3, 2, P("pink2", 2.9, decals=[("north", "mouth", 0, 8, "bone")]))
    r.c("head", -4, 23, -10, 8, 2, 2, P("pink2", 2.6))
    for (x, z0) in ((-3, -1), (3, -1), (0, 0), (-5, -2), (5, -2)):
        lift = 2 if x == 0 else 1
        r.chain("head", [(x, 31 + lift, z0), (x * 1.3, 33 + lift, z0 + 6), (x * 1.6, 32 + lift, z0 + 12), (x * 1.8, 29 + lift, z0 + 16)],
                2, 1, lambda i: P("pink3" if i == 0 else "pink", 3.2 + 0.1 * i))
    for side, up, fo in ((-1, "rightArm", "rightForearm"), (1, "leftArm", "leftForearm")):
        x = 9 * side
        r.seg(up, (x, 24, -1), (x + 3 * side, 15, -3), 2.5, 2.5, P("pink", 3.0))
        r.seg(fo, (x + 3 * side, 15, -3), (x + 4 * side, 5, -7), 2, 2, P("pink2", 2.9))
        r.c(fo, x + 4 * side - 1.5, 3, -9, 3, 3, 3, M("claw", "horn", 2.8))
        claws(r, fo, (x + 4 * side, 3, -9), n=3, length=3, spread=1.1, mat=M("claw", "horn", 3.4))
        r.c(fo, x + 4 * side - 1, 1, -10, 2, 2, 2, M("flame" if side < 0 else "flame2", "flame", 4.2))
    for side, bn in ((-1, "lowerArmR"), (1, "lowerArmL")):
        x = 8 * side
        r.chain(bn, [(x, 18, -3), (x + 3 * side, 12, -5), (x + 3 * side, 7, -8)], 2, 2, lambda i: P("pink2", 2.9))
        claws(r, bn, (x + 3 * side, 6, -9), n=2, length=2.5, spread=1.2, mat=M("claw", "horn", 3.4))
        r.c(bn, x + 3 * side - 1, 4, -10, 2, 2, 2, M("flame2" if side < 0 else "flame", "flame", 4.2))
    for side, bn in ((-1, "rightLeg"), (1, "leftLeg")):
        x = 4.5 * side
        r.seg(bn, (x, 12, 0), (x + side * 0.5, 7, -3), 3, 3, P("pink", 2.9))
        r.seg(bn, (x + side * 0.5, 7, -3), (x + side * 0.5, 2, 0), 2.5, 2.5, P("pink2", 2.8))
        r.chain(bn, [(x, 1, 0), (x, 0.5, -4)], 3, 3, lambda i: P("pink", 2.7))
        claws(r, bn, (x, 1, -4), n=2, length=1.5, spread=1.5, down=False, mat=M("claw", "horn", 3.4))
    return r


# ============================================================================================ 5. ICE DEMON
def ice_demon(base):
    p = pal(scale="#2a4a7a", scale2="#1a2c50", ice="#9ae6ff", crystal="#dcf8ff", frost="#cfe8f6", heart="#6ff0ff",
            glow="#9ff6ff", dark="#0a1424", bone="#dfe8f0")
    r = Rig11("geometry.ice_demon", p, base); r.png = 1024
    SC = lambda s="scale", t=3.0, **k: M(s, "scale", t, **k)
    C = lambda t=3.5: M("crystal", "ice", t)
    r.ell("torso", (0, 26, 0), (9, 6, 7), SC("scale", 3.1))
    r.ell("torso", (0, 19, 0), (6, 4, 5), SC("scale2", 2.9))
    r.c("torso", -2, 25, -8, 4, 4, 1, M("heart", "glow", 4.3)); r.c("torso", -3, 24, -7, 6, 6, 1, M("ice", "ice", 3.0))
    for k, x in enumerate((-6, -3, 0, 3, 6)):
        r.seg("torso", (x, 22, -7), (x, 17 - (k % 2) * 2, -7), 1, 1, M("frost", "ice", 3.6))             # icicle drips
    for k, y in enumerate((32, 28, 24, 20)):
        r.chain("torso", [(0, y, 6), (0, y + 3, 10 - k * 0.5)], 2, 1, lambda i: C(3.6 + 0.1 * k))         # spine crystals
    S(r, lambda s: r.ell("torso", (s * 11, 31, 0), (4, 3, 5), M("ice", "ice", 3.3), cross=False))
    for side in (-1, 1):
        for (dx, dz, l) in ((0, -2, 7), (1, 1, 9), (0, 4, 6)):
            b = (side * (11 + dx), 33, dz)
            r.chain("torso", [b, (b[0] + side * 3, b[1] + l * 0.6, b[2] + 1), (b[0] + side * 4, b[1] + l, b[2] + 2)], 2, 1, lambda i: C(3.4 + 0.3 * i))
    r.ell("head", (0, 36, -2), (4, 4, 4), SC("scale", 3.1, decals=[("north", "eyes", "glow", 3)]), cross=False)
    r.c("head", -3, 32, -7, 6, 2, 4, SC("scale2", 2.8, decals=[("north", "mouth", 0, 4, "crystal")]))
    for (x, z, l) in ((-4, -2, 6), (-2, -4, 8), (0, -4, 10), (2, -4, 8), (4, -2, 6), (0, 1, 7)):
        r.chain("head", [(x, 39, z), (x * 1.3, 39 + l * 0.6, z - 1), (x * 1.5, 39 + l, z - 1)], 2, 1, lambda i: C(3.5 + 0.3 * i))
    for side, up, fo in ((-1, "rightArm", "rightForearm"), (1, "leftArm", "leftForearm")):
        x = 10.5 * side
        r.seg(up, (x, 30, 0), (x + side, 20, 0), 6, 6, SC("scale", 3.0))
        r.seg(fo, (x + side, 20, 0), (x + side, 8, -1), 5, 5, SC("scale2", 2.9))
        r.c(fo, x + side - 3, 9, -4, 6, 4, 6, M("ice", "ice", 3.2))
        r.chain(fo, [(x + side * 3, 12, 0), (x + side * 6, 15, 1)], 2, 1, lambda i: C(3.6))
        r.ell(fo, (x + side, 6, -1), (3, 2, 3), SC("scale", 2.8), cross=False)
        claws(r, fo, (x + side, 5, -3), n=3, length=4, spread=1.6, mat=M("ice", "glow", 3.9))
    for side, bn in ((-1, "rightLeg"), (1, "leftLeg")):
        x = 4.5 * side
        r.seg(bn, (x, 14, 0), (x + side * 0.5, 7, -1), 6, 6, SC("scale", 2.9))
        r.seg(bn, (x + side * 0.5, 7, -1), (x + side * 0.5, 2, 0), 5, 5, SC("scale2", 2.8))
        r.c(bn, x - 3, 0, -5, 6, 3, 7, SC("scale", 2.7))
        r.chain(bn, [(x, 8, -3), (x, 11, -6)], 2, 1, lambda i: C(3.6))
        claws(r, bn, (x, 1, -5), n=2, length=2, spread=2.5, down=False, mat=M("ice", "ice", 3.6))
    for wing, sgn in (("leftWing", 1), ("rightWing", -1)):
        r.ell(wing, (sgn * 9, 29, 5), (3, 3, 2), M("ice", "ice", 3.2), cross=False)
        for k, (dx, l, a) in enumerate(((2, 11, 30), (5, 15, 45), (8, 10, 62), (4, 8, 15))):
            b = (sgn * (8 + dx), 30, 5.5)
            r.chain(wing, [b, (b[0] + sgn * l * 0.5, b[1] + l * 0.7, b[2] + 1.5), (b[0] + sgn * l * 0.7, b[1] + l, b[2] + 2.5)], 3, 1, lambda i: C(3.3 + 0.2 * i + 0.1 * k))
    r.chain("tail", [(0, 15, 5), (0, 15, 11), (0, 14, 16), (0, 13, 21)], 3, 1.5, lambda i: SC("scale" if i < 2 else "scale2", 2.9))
    for z in (8, 13, 18):
        r.chain("tail", [(0, 16.5, z), (0, 19, z + 1)], 1.5, 1, lambda i: C(3.7))
    r.chain("tail", [(0, 13, 21), (0, 14, 25)], 3, 1, lambda i: C(3.6))
    return r


# ============================================================================================ FACELESS ONES
def _fhead(r, c, rad, eyes=2, tent=4, tl=6, z_off=-1):
    x, y, z = c
    r.ell("head", c, rad, M("chitin", "chitin", 3.1, decals=[("north", "eyes", "glow", 2, eyes)]), cross=False)
    r.c("head", x - rad[0], y + rad[1] - 2, z - rad[2] - 1, 2 * rad[0], 2, 3, M("chitin2", "chitin", 3.4))    # brow plate
    for k in range(tent):
        xx = x - rad[0] * 0.7 + k * (rad[0] * 1.4 / max(1, tent - 1))
        top = (xx, y - rad[1] * 0.4, z - rad[2] + z_off)
        L = tl + (k % 2) * 2
        r.chain("head", [top, (xx * 1.1, top[1] - L * 0.45, top[2] - 1), (xx * 1.2, top[1] - L * 0.8, top[2]), (xx * 1.25, top[1] - L, top[2] + 1.5)],
                1.6, 1, lambda i: M("tent", "ribbed", 3.0 + 0.15 * i))


def faceless_general(base):
    p = pal(**FACELESS)
    r = Rig11("geometry.faceless_general", p, base); r.png = 1024
    CH = lambda s="chitin", t=3.0, **k: M(s, "chitin", t, **k)
    BR = lambda t=3.0, **k: M("bronze", "forged", t, **k)
    r.ell("torso", (0, 30, 0), (11, 9, 9), CH("chitin", 3.0))
    r.ell("torso", (0, 19, -2), (8, 4, 7), CH("chitin2", 2.9))
    r.c("torso", -9, 24, -11, 18, 10, 2, BR(3.1))
    r.c("torso", -6, 33, -10, 12, 3, 2, BR(3.4))
    r.chain("torso", [(-11, 31, -10), (0, 28, -12), (11, 31, -10)], 1.5, 1.5, lambda i: M("iron", "forged", 2.7))
    r.chain("torso", [(-11, 26, -10), (0, 23, -12), (11, 26, -10)], 1.5, 1.5, lambda i: M("iron", "forged", 2.7))
    for x in (-9, -5, -1.5, 1.5, 5, 9):
        r.chain("torso", [(x, 37, 2), (x * 1.2, 44, 6), (x * 1.35, 49, 12), (x * 1.3, 51, 17)], 3, 1, lambda i: M("bone", "horn", 3.1 + 0.25 * i))
    S(r, lambda s: r.ell("torso", (s * 15, 33, -1), (6, 4, 6), BR(3.2), cross=True))
    for side in (-1, 1):
        for dz in (-3, 2):
            r.chain("torso", [(side * 16, 36, dz), (side * 19, 41, dz + 1), (side * 20, 44, dz + 2)], 2, 1, lambda i: M("bone", "horn", 3.4 + 0.3 * i))
    r.c("pelvis", -9, 9, -7, 18, 7, 14, CH("chitin2", 2.8))
    r.c("pelvis", -6, 0, -9.5, 12, 15, 1, M("cloth", "cloth", 2.6, bands=[("bronze", "forged", 0.0, 0.1), ("bronze", "forged", 0.9, 1.0)]))
    r.c("pelvis", -1.5, 7, -11, 3, 5, 2, M("gem", "gem", 3.8))
    _fhead(r, (0, 31, -12), (5, 4, 4), eyes=4, tent=6, tl=9)
    for side, up, fo in ((-1, "rightArm", "rightForearm"), (1, "leftArm", "leftForearm")):
        x = 14 * side
        r.seg(up, (x, 32, -1), (x + side, 19, -3), 10, 10, CH("chitin", 3.0))
        r.seg(fo, (x + side, 19, -3), (x + side, 5, -6), 9, 9, CH("chitin2", 2.9))
        r.c(fo, x + side - 5, 12, -9, 10, 4, 10, BR(3.0))
        r.chain(fo, [(x + side * 5, 15, -4), (x + side * 9, 18, -4)], 2, 1, lambda i: M("bone", "horn", 3.6))
    r.ell("rightForearm", (-15, 4, -6), (4, 3, 4), CH("chitin", 2.8), cross=False)
    r.chain("leftForearm", [(15, 5, -7), (16, 7, -13), (15, 7, -18), (14, 5, -20)], 5, 2, lambda i: CH("chitin2", 3.0 + 0.2 * i))
    r.chain("leftForearm", [(15, 3, -7), (16, 1, -12), (15, 1, -16), (14, 3, -18)], 4, 2, lambda i: CH("chitin", 2.9 + 0.2 * i))
    r.bone("weapon", "rightForearm", [-15, 3, -6], [78, 0, 0])
    r.c("weapon", -16, -2, -7, 2, 10, 2, M("leather", "leather", 2.6))
    r.c("weapon", -20, 8, -8, 10, 2, 4, BR(3.2))
    r.chain("weapon", [(-20, 9, -6), (-23, 11, -6)], 2, 1, lambda i: M("bone", "horn", 3.5))
    r.c("weapon", -20, 10, -7, 9, 22, 1, M("iron", "forged", 3.0, decals=[("north", "runes", "glow"), ("south", "runes", "glow")]))
    r.c("weapon", -16, 10, -7.5, 2, 22, 2, BR(2.6))
    for k in range(5):
        r.c("weapon", -21, 12 + k * 4.5, -7, 1, 3, 1, M("iron", "forged", 3.8))
    r.c("weapon", -19, 32, -7, 6, 2, 1, M("iron", "forged", 3.6)); r.c("weapon", -18, 34, -7, 3, 2, 1, M("iron", "forged", 3.9))
    for side, bn in ((-1, "rightLeg"), (1, "leftLeg")):
        x = 6.5 * side
        r.ell(bn, (x, 9, -1), (5, 5, 5), CH("chitin", 2.9), cross=False)
        r.c(bn, x - 5, 0, -8, 10, 5, 13, CH("chitin2", 2.7))
        r.c(bn, x - 5, 9, -7, 10, 3, 2, BR(3.1))
        r.chain(bn, [(x, 11, -6), (x, 14, -9)], 2, 1, lambda i: M("bone", "horn", 3.6))
        claws(r, bn, (x, 1, -8), n=3, length=2, spread=3, down=False)
    return r


def _faceless_body(r, chest_w=8, shoulders="bone", weapon=True):
    CH = lambda s="chitin", t=3.0, **k: M(s, "chitin", t, **k)
    BR = lambda t=3.0, **k: M("bronze", "forged", t, **k)
    r.ell("torso", (0, 22, 0), (chest_w, 5, 5), CH("chitin", 3.1, decals=[("north", "scar", 2), ("north", "scar", 7)]))
    r.ell("torso", (0, 16, 0), (6, 2, 4), CH("chitin2", 2.9), cross=False)
    r.c("torso", -7, 13, -5, 14, 3, 10, BR(3.0, decals=[("north", "gem", "gem", 6, 1, 2)]))
    r.c("pelvis", -6, 8, -4.5, 12, 6, 9, CH("chitin2", 2.8))
    r.c("pelvis", -4, 2, -5.5, 8, 9, 1, M("cloth", "cloth", 2.6, bands=[("bronze", "forged", 0.0, 0.12)]))
    _fhead(r, (0, 32, -2), (4, 4, 4), eyes=2, tent=4, tl=6)
    for side, up, fo in ((-1, "rightArm", "rightForearm"), (1, "leftArm", "leftForearm")):
        x = 9 * side
        r.seg(up, (x, 26, 0), (x + side * 0.5, 17, 0), 5, 5, CH("chitin", 3.0))
        r.seg(fo, (x + side * 0.5, 17, 0), (x + side * 0.5, 8, -1), 5, 5, CH("chitin2", 2.9))
        r.c(fo, x + side * 0.5 - 3, 11, -4, 6, 4, 6, BR(3.0))
        r.ell(fo, (x + side * 0.5, 7, -1), (3, 2, 3), CH("chitin", 2.8), cross=False)
    for side, bn in ((-1, "rightLeg"), (1, "leftLeg")):
        x = 3.5 * side
        r.seg(bn, (x, 12, 0), (x, 6, -1), 6, 6, CH("chitin", 2.9))
        r.seg(bn, (x, 6, -1), (x, 2, 0), 5, 5, CH("chitin2", 2.8))
        r.c(bn, x - 3, 0, -5, 6, 3, 8, CH("chitin2", 2.7))
        r.c(bn, x - 3.5, 6, -4, 7, 3, 2, BR(3.1))


def faceless_berserker(base):
    p = pal(**FACELESS)
    r = Rig11("geometry.faceless_berserker", p, base); r.png = 512
    _faceless_body(r, chest_w=9)
    for side in (-1, 1):
        r.ell("torso", (side * 10, 27, 0), (4, 3, 4), M("bronze", "forged", 3.1), cross=False)
        r.c("torso", side * 10 - 4.5, 25, -4.5, 9, 1, 9, M("bone", "bone", 3.2))
        for dz in (-2, 1, 3):
            r.chain("torso", [(side * 11, 29, dz), (side * 13, 33, dz + 1), (side * 14, 35, dz + 2)], 2, 1, lambda i: M("bone", "horn", 3.4 + 0.3 * i))
    for z in (-3, 0, 3):
        r.chain("head", [(0, 36, z), (0, 39, z + 1), (0, 40, z + 3)], 2, 1, lambda i: M("bone", "horn", 3.5))
    # hooked axe (right) and paired blade (left)
    r.c("weapon", -10, 3, -2.5, 1, 26, 1, M("leather", "leather", 2.6))
    r.chain("weapon", [(-10, 27, -2), (-14, 25, -2), (-16, 21, -2), (-15, 18, -2)], 3, 2, lambda i: M("iron", "forged", 3.0 + 0.2 * i))
    r.c("weapon", -15, 19, -3, 5, 7, 1, M("iron", "forged", 3.2))
    for k in range(3):
        r.c("weapon", -17, 19 + k * 2.5, -3, 1, 1, 1, M("iron", "forged", 4.0))
    r.chain("weapon", [(-9.5, 26, -2), (-7, 28, -2), (-6, 31, -2)], 2, 1, lambda i: M("iron", "forged", 3.6))
    r.bone("weaponL", "leftForearm", [9.5, 10, -2], [78, 0, 0])
    r.c("weaponL", 9, 4, -2.5, 1, 7, 1, M("leather", "leather", 2.6)); r.c("weaponL", 8, 11, -3, 3, 1, 2, M("bronze", "forged", 3.2))
    r.chain("weaponL", [(9.5, 12, -2), (10, 19, -2), (11, 24, -2), (12.5, 27, -2)], 2, 1, lambda i: M("iron", "forged", 3.1 + 0.2 * i))
    return r


def faceless_warrior(base):
    p = pal(**FACELESS)
    r = Rig11("geometry.faceless_warrior", p, base); r.png = 512
    _faceless_body(r, chest_w=8)
    for side, bn in ((-1, "rightArm"), (1, "leftArm")):
        x = 10 * side
        r.ell(bn, (x, 27, 0), (4, 3, 5), M("bronze", "forged", 3.2), cross=False)
        r.c(bn, x - 4.5, 25, -5, 9, 1, 10, M("bone", "bone", 3.2))
        r.c(bn, x - 3.5, 29, -3.5, 7, 2, 7, M("bronze", "forged", 3.5))
        r.chain(bn, [(x + side, 31, 0), (x + side * 2, 34, 1)], 2, 1, lambda i: M("bone", "horn", 3.6))
    r.c("weapon", -10, 4, -2.5, 1, 8, 1, M("leather", "leather", 2.6)); r.c("weapon", -12, 11, -3, 5, 1, 2, M("bronze", "forged", 3.2))
    r.c("weapon", -11, 12, -2.5, 3, 18, 1, M("iron", "forged", 3.0, decals=[("north", "runes", "glow"), ("south", "runes", "glow")]))
    for k in range(4):
        r.c("weapon", -12, 14 + k * 4, -2.5, 1, 2, 1, M("iron", "forged", 3.8))
    r.chain("weapon", [(-9.5, 30, -2), (-9.5, 33, -2)], 2, 1, lambda i: M("iron", "forged", 3.8))
    r.c("leftForearm", 12.5, 5, -7, 2, 13, 12, M("chitin2", "chitin", 3.0))
    r.c("leftForearm", 14, 4, -7.5, 1, 15, 13, M("bronze", "forged", 3.1, decals=[("east", "gem", "gem", 5, 6, 2)]))
    for (y, z) in ((15, -5), (15, 3), (7, -5), (7, 3), (11, -1)):
        r.chain("leftForearm", [(15, y, z), (17.5, y, z)], 2, 1, lambda i: M("bone", "horn", 3.6))
    return r


def faceless_sorcerer(base):
    p = pal(**FACELESS)
    r = Rig11("geometry.faceless_sorcerer", p, base); r.png = 512
    RB = lambda t=3.0, **k: M("robe", "robe", t, **k)
    for i, (y, rx, rz) in enumerate(((0, 8, 7), (4, 7.5, 6.5), (8, 7, 6), (12, 6.5, 5.5), (16, 7, 5), (20, 7.5, 5), (24, 7.5, 5))):
        r.c("pelvis" if y < 14 else "torso", -rx, y, -rz, 2 * rx, 4, 2 * rz, RB(2.7 + 0.05 * i, bands=([("gold", "forged", 0.6, 1.0)] if i == 0 else [])))
    r.c("torso", -1, 4, -7.5, 2, 24, 1, M("gold", "forged", 3.4, decals=[("north", "runes", "violet")]))
    r.c("torso", -7, 26, 3, 14, 10, 2, M("bronze", "forged", 3.1)); S(r, lambda s: r.c("torso", s * 7 - (1 if s > 0 else 0), 26, -3, 1, 9, 6, M("bronze", "forged", 3.3)))
    r.c("torso", -8, 25, -5, 16, 3, 10, M("bronze", "forged", 2.9))
    _fhead(r, (0, 32, -2), (4, 4, 4), eyes=2, tent=7, tl=11)
    r.c("head", -2, 36, -3, 4, 5, 3, M("bronze", "forged", 3.3)); r.c("head", -1, 41, -2.5, 2, 3, 2, M("bronze", "forged", 3.7))
    for side, up, fo in ((-1, "rightArm", "rightForearm"), (1, "leftArm", "leftForearm")):
        x = 9 * side
        r.seg(up, (x, 26, 0), (x + side, 17, 0), 5, 5, RB(3.0))
        r.seg(fo, (x + side, 17, 0), (x + side, 9, -1), 6, 6, RB(2.9))
        r.c(fo, x + side - 3.5, 8, -4.5, 7, 3, 7, M("gold", "forged", 3.2))
        r.ell(fo, (x + side, 6, -1), (2, 2, 2), M("chitin", "chitin", 2.8), cross=False)
        r.c(up, side * 14 - 1, 28, -1, 2, 5, 2, M("gem" if side < 0 else "violet", "gem", 3.9))
    r.c("weapon", -10, -4, -2.5, 1, 36, 1, M("leather", "wood", 2.6))
    for y in (6, 14, 22): r.c("weapon", -10.5, y, -3, 2, 1, 2, M("bronze", "forged", 3.2))
    r.c("weapon", -11.5, 30, -4, 4, 4, 4, M("bone", "bone", 3.3, decals=[("north", "eyes", "dark", 1)]))
    S(r, lambda s: r.chain("weapon", [(-10 + s * 2, 32, -2), (-10 + s * 3, 36, -2), (-10 + s * 2, 38, -2)], 1, 1, lambda i: M("bronze", "forged", 3.6)))
    r.c("weapon", -11, 37, -3.5, 3, 4, 3, M("violet", "gem", 3.9)); r.c("weapon", -10.5, 38, -4, 2, 2, 1, M("gem", "glow", 4.4))
    return r


def faceless_cultist(base):
    p = pal(**FACELESS)
    r = Rig11("geometry.faceless_cultist", p, base); r.png = 512
    CL = lambda t=3.0, **k: M("cloth", "cloth", t, **k)
    for i, (y, rx, rz) in enumerate(((0, 7, 6.5), (4, 6.5, 6), (8, 6, 5.5), (12, 6.5, 5), (16, 7.5, 5), (20, 8, 5.5))):
        r.c("pelvis" if y < 14 else "torso", -rx, y, -rz, 2 * rx, 4, 2 * rz, CL(2.6 + 0.05 * i, decals=[("north", "runes", "glow")] if i in (1, 4) else []))
    r.c("torso", -8, 24, -5.5, 16, 4, 11, M("bronze", "forged", 3.1))
    S(r, lambda s: r.c("torso", s * 6 - (4 if s > 0 else 0), 16, -6, 4, 8, 1, M("bronze", "forged", 2.9, decals=[("north", "runes", "glow")])))
    for k in range(4):                                                                                 # long cape behind
        r.c("torso", -7 + k * 3.5, 1 + k % 2, 5.5, 3, 26 - (k % 2) * 2, 1, CL(2.4 + 0.1 * (k % 2)))
    r.c("head", -4, 27, -6.5, 8, 8, 8, M("chitin2", "chitin", 2.4, decals=[("north", "eyes", "glow", 3)]))
    r.c("head", -5, 28, -5, 10, 9, 9, CL(2.6)); r.c("head", -5.5, 27, -7, 11, 2, 3, CL(2.2))
    S(r, lambda s: r.c("head", s * 5 - (1 if s > 0 else 0), 25, -6, 1, 11, 9, CL(2.5)))
    r.chain("head", [(0, 37, 1), (0, 38, 5), (0, 36, 8)], 4, 2, lambda i: CL(2.8))
    for k, x in enumerate((-2.5, -1, 0.5, 2)):
        r.chain("head", [(x, 27, -7), (x * 1.1, 23, -8), (x * 1.2, 19, -7), (x * 1.2, 16, -6)], 1.4, 1, lambda i: M("tent", "ribbed", 3.0 + 0.15 * i))
    for side, up, fo in ((-1, "rightArm", "rightForearm"), (1, "leftArm", "leftForearm")):
        x = 8 * side
        r.seg(up, (x, 26, 0), (x + side * 0.5, 17, 0), 4, 4, CL(2.9))
        r.seg(fo, (x + side * 0.5, 17, 0), (x + side * 0.5, 9, -1), 5, 5, CL(2.8))
        r.c(fo, x + side * 0.5 - 3, 10, -3.5, 6, 2, 6, M("bronze", "forged", 3.1))
        r.ell(fo, (x + side * 0.5, 7, -1), (2, 2, 2), M("chitin2", "chitin", 2.8), cross=False)
    r.c("leftForearm", 7, 6, -6, 3, 3, 3, M("glow", "glow", 4.4))
    r.c("leftForearm", 6.5, 9, -6.5, 4, 1, 4, M("bronze", "forged", 3.4)); r.c("leftForearm", 6.5, 5, -6.5, 4, 1, 4, M("bronze", "forged", 3.0))
    r.c("weapon", -9, 4, -2.5, 1, 6, 1, M("leather", "leather", 2.6)); r.c("weapon", -10.5, 10, -3, 4, 1, 2, M("bronze", "forged", 3.2))
    r.chain("weapon", [(-8.5, 11, -2), (-9.3, 14, -2), (-8.5, 17, -2), (-9.3, 20, -2), (-8.8, 23, -2)], 1.6, 1, lambda i: M("iron", "forged", 3.1 + 0.15 * i))
    return r


BUILDERS = {"warcraft:abomination_lord": abomination_lord, "warcraft:great_unclean_one": great_unclean_one,
            "warcraft:hornet_demon": hornet_demon, "warcraft:pink_horror": pink_horror, "warcraft:ice_demon": ice_demon,
            "warcraft:faceless_general": faceless_general, "warcraft:faceless_berserker": faceless_berserker,
            "warcraft:faceless_warrior": faceless_warrior, "warcraft:faceless_sorcerer": faceless_sorcerer,
            "warcraft:faceless_cultist": faceless_cultist}
