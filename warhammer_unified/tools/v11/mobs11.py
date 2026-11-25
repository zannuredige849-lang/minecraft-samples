"""v11 hand-sculpted models for 10 mobs (references: WC3 / Warhammer .mdx / .blp named in the brief).
Coordinates are absolute model units; bones / pivots come from the add-on's existing geometry."""
from forge.core import Palette
from .rig11 import Rig11, M

BASE = dict(dark="#16121a", bone="#e2d8bc", glow="#7cff3a", armor="#6a6a72")


def pal(**kw):
    d = dict(BASE); d.update(kw)
    return Palette(**d)


# ------------------------------------------------------------------------------------------- 1. Abomination Lord
def abomination_lord(base):
    p = pal(flesh="#a9a374", flesh2="#8c8a5c", bile="#86ff3c", iron="#6c6c76", indigo="#2c2c5e", leather="#5a3a26",
            bone="#e0d6b8", horn="#cfc6a6", glow="#86ff3c", dark="#141018", gore="#6a2a26")
    r = Rig11("geometry.abomination_lord", p, base)
    fl = lambda t=3.0, **k: M("flesh", "flesh", t, **k)
    iron = lambda t=3.0, **k: M("iron", "forged", t, **k)
    # pelvis + loincloth
    r.c("pelvis", -9, 9, -7, 18, 7, 14, M("flesh2", "flesh", 2.8))
    r.c("pelvis", -6, 3, -8, 12, 7, 1, M("indigo", "cloth", 2.8, bands=[("leather", "leather", 0.0, 0.18)]))
    r.c("pelvis", -6, 4, 7, 12, 6, 1, M("indigo", "cloth", 2.5))
    # belly, chest, hump
    r.c("torso", -13, 12, -13, 26, 18, 22, fl(3.0, decals=[("east", "stitch", 9), ("west", "vstitch", 11), ("south", "stitch", 7)]))
    r.c("torso", -11, 13, -16, 22, 15, 3, fl(3.2, decals=[("north", "stitch", 4), ("north", "vstitch", 7)]))      # front bulge
    r.c("torso", -15, 14, -10, 2, 14, 18, fl(2.8))                                                              # side bulges
    r.c("torso", 13, 14, -10, 2, 14, 18, fl(2.8))
    r.c("torso", -11, 10, -15, 22, 3, 18, fl(2.5))                                                              # sagging underside
    r.c("torso", -11, 30, -9, 22, 11, 18, M("flesh2", "flesh", 3.0, decals=[("north", "vstitch", 15)]))
    r.c("torso", -9, 30, 7, 18, 10, 6, fl(2.8, decals=[("south", "stitch", 5)]))
    r.c("torso", -9, 31, -10, 7, 8, 1, M("gore", "flesh", 2.4, decals=[("north", "ribs", "bone")]))      # open ribs
    r.c("torso", 3, 16, -18, 7, 8, 3, M("bile", "glow", 4.0))                                             # bile sac
    r.c("torso", 2, 15, -17, 9, 10, 1, M("flesh2", "flesh", 2.2))                                          # torn rim
    # small asymmetric third arm from the belly
    r.c("torso", -12, 16, -18, 3, 3, 4, fl(2.8), rot=[0, 0, 20])
    r.c("torso", -14, 13, -20, 3, 4, 3, fl(2.6))
    r.c("torso", -14, 12, -22, 1, 2, 2, M("bone", "bone", 3.4))
    r.c("torso", -12, 12, -22, 1, 2, 2, M("bone", "bone", 3.4))
    # shoulders, bone spikes, chains
    r.c("torso", -17, 28, -6, 6, 8, 12, fl(3.1))
    r.c("torso", 11, 28, -6, 6, 8, 12, fl(3.1))
    r.c("torso", -17, 36, -3, 2, 7, 2, M("bone", "horn", 3.2), rot=[0, 0, 28])
    r.c("torso", -14, 37, 1, 2, 8, 2, M("bone", "horn", 3.2), rot=[-18, 0, 14])
    r.c("torso", -19, 33, 3, 2, 6, 2, M("bone", "horn", 3.0), rot=[0, 0, 45])
    r.c("torso", -12, 27, -15, 24, 2, 1, iron(2.6), rot=[0, 0, -12])                                    # chain across chest
    # head: horned iron helm with toothed jaw
    r.c("head", -5, 41, -8, 10, 9, 10, iron(3.1, decals=[("north", "eyes", "bile", 4)]))
    r.c("head", -5, 38, -9, 10, 3, 6, iron(2.7, decals=[("north", "mouth", 0, 8, "bone")]))
    r.c("head", -1, 50, -8, 2, 2, 10, iron(3.6))
    r.pair("head", "head", -8, 46, -4, 3, 3, 3, M("horn", "horn", 3.0))
    r.pair("head", "head", -10, 48, -4, 3, 4, 2, M("horn", "horn", 3.3))
    r.pair("head", "head", -11, 51, -3.5, 2, 4, 1, M("horn", "horn", 3.9))
    # right arm + butcher hook
    r.c("rightArm", -20, 22, -4.5, 8, 13, 9, fl(3.0, decals=[("west", "stitch", 6)]))
    r.c("rightForearm", -20.5, 8, -4, 8, 14, 8, fl(2.9))
    r.c("rightForearm", -21, 9, -4.5, 9, 3, 9, iron(2.8))
    r.c("rightForearm", -20, 3, -3.5, 7, 5, 7, fl(2.7))
    r.c("rightForearm", -17.5, 4, -13, 2, 2, 9, M("leather", "leather", 2.6))                            # hook shaft forward
    r.c("rightForearm", -18, 4, -16, 3, 9, 2, iron(3.4))                                                  # hook rises
    r.c("rightForearm", -18, 12, -16, 3, 2, 5, iron(3.6))                                                 # curls back
    r.c("rightForearm", -18, 9, -12, 3, 3, 1, iron(4.2))                                                  # barb point
    # left arm + jagged cleaver (weapon bone)
    r.c("leftArm", 12, 22, -4.5, 8, 13, 9, fl(3.0))
    r.c("leftForearm", 12.5, 8, -4, 8, 14, 8, fl(2.9, decals=[("east", "stitch", 7)]))
    r.c("leftForearm", 12, 9, -4.5, 9, 3, 9, iron(2.8))
    r.c("leftForearm", 13, 3, -3.5, 7, 5, 7, fl(2.7))
    r.c("weapon", 15, 6, -2.5, 2, 8, 2, M("leather", "leather", 2.5))
    r.c("weapon", 14, 13, -3, 4, 2, 3, iron(2.9))
    r.c("weapon", 13, 15, -3, 10, 20, 1, iron(3.2))
    r.c("weapon", 12, 15, -3.5, 1, 20, 2, iron(2.3))
    for k in range(5):
        r.c("weapon", 23, 16 + k * 4, -3, 1, 2, 1, iron(4.0))
    # legs with shackles
    for side, bn in ((-1, "rightLeg"), (1, "leftLeg")):
        x = -11.5 if side < 0 else 2.5
        r.c(bn, x, 5, -5, 9, 7, 10, fl(2.9))
        r.c(bn, x - 0.5, 0, -6.5, 10, 5, 12, fl(2.6))
        r.c(bn, x - 1, 5, -5.5, 11, 2, 11, iron(2.7))
    return r




# ------------------------------------------------------------------------------------------- 2. Great Unclean One
def great_unclean_one(base):
    p = pal(plague="#6f8436", plague2="#a3a25a", pus="#e2e85a", guts="#9a3a36", tongue="#c42a2a", horn="#c2b48c", rust="#6c4a2c",
            iron="#5e5e66", leather="#4a3424", glow="#9aff48", dark="#141a10", bone="#e6dcbc")
    r = Rig11("geometry.great_unclean_one", p, base)
    sk = lambda t=3.0, **k: M("plague", "flesh", t, **k)
    bl = lambda t=3.0, **k: M("plague2", "flesh", t, **k)
    r.c("pelvis", -12, 8, -10, 24, 6, 20, sk(2.7))
    r.c("pelvis", -8, 3, -11, 16, 6, 1, M("rust", "cloth", 2.6))
    r.c("torso", -16, 10, -16, 32, 10, 26, bl(3.0, decals=[("north", "mouth", 3, 20, "bone"), ("north", "spots", "pus", 4), ("east", "spots", "pus", 3)]))
    r.c("torso", -15, 20, -15, 30, 9, 24, bl(3.2, decals=[("north", "stitch", 4), ("north", "spots", "pus", 3), ("west", "spots", "pus", 3)]))
    r.c("torso", -13, 29, -11, 26, 9, 20, sk(3.0, decals=[("north", "spots", "pus", 3)]))
    r.c("torso", -11, 32, 7, 22, 8, 8, sk(2.8, decals=[("south", "spots", "pus", 4)]))
    r.c("torso", -1, 12, -17, 3, 3, 1, M("tongue", "flesh", 3.2))                                   # belly-mouth tongue
    r.c("torso", -6, 5, -17, 3, 7, 2, M("guts", "flesh", 2.8))                                      # hanging guts
    r.c("torso", 3, 4, -17, 2, 8, 2, M("guts", "flesh", 3.2))
    r.c("torso", -10, 6, -17, 1, 6, 1, M("iron", "forged", 2.6))                                    # chains
    r.c("torso", 9, 7, -17, 1, 5, 1, M("iron", "forged", 2.6))
    r.c("torso", -19, 27, -6, 6, 8, 12, sk(3.1))
    r.c("torso", 13, 27, -6, 6, 8, 12, sk(3.1))
    r.c("head", -7, 39, -12, 14, 11, 12, sk(3.1, decals=[("north", "eyes", "glow", 5)]))
    r.c("head", -6, 36, -13, 12, 4, 8, sk(2.8, decals=[("north", "mouth", 1, 10, "bone")]))
    r.c("head", -1, 32, -14, 2, 5, 1, M("tongue", "flesh", 3.4))
    # asymmetric branching antlers
    r.c("head", -6, 50, -8, 2, 5, 2, M("horn", "horn", 3.0))
    r.c("head", -10, 54, -8, 5, 2, 2, M("horn", "horn", 3.2))
    r.c("head", -11, 55, -8, 2, 6, 2, M("horn", "horn", 3.6))
    r.c("head", -6, 56, -8, 2, 3, 2, M("horn", "horn", 3.8))
    r.c("head", 4, 50, -8, 2, 6, 2, M("horn", "horn", 3.0))
    r.c("head", 5, 55, -8, 6, 2, 2, M("horn", "horn", 3.2))
    r.c("head", 9, 56, -8, 2, 7, 2, M("horn", "horn", 3.7))
    r.c("head", 6, 57, -8, 2, 2, 2, M("horn", "horn", 4.0))
    for side, up, fo in ((-1, "rightArm", "rightForearm"), (1, "leftArm", "leftForearm")):
        x = -24 if side < 0 else 14
        r.c(up, x, 21, -5, 10, 14, 10, sk(3.0, decals=[("north", "spots", "pus", 2)]))
        r.c(fo, x + 0.5, 7, -4.5, 9, 15, 9, sk(2.8))
        r.c(fo, x + 1, 3, -4, 8, 5, 8, sk(2.6))
    # plague sword (weapon bone, right hand)
    r.c("weapon", -20, 4, -3, 2, 8, 2, M("leather", "leather", 2.5))
    r.c("weapon", -23, 12, -4, 8, 2, 4, M("rust", "forged", 2.8))
    r.c("weapon", -22, 14, -3, 6, 30, 1, M("iron", "forged", 2.8, decals=[("north", "runes", "glow"), ("south", "runes", "glow")]))
    for k in range(6):
        r.c("weapon", -23, 16 + k * 4, -3, 1, 2, 1, M("iron", "forged", 3.8))
    r.c("weapon", -21, 44, -3, 4, 2, 1, M("iron", "forged", 3.6))
    for side, bn in ((-1, "rightLeg"), (1, "leftLeg")):
        x = -14 if side < 0 else 3
        r.c(bn, x, 4, -7, 11, 7, 12, sk(2.9))
        r.c(bn, x, 0, -9, 11, 4, 14, sk(2.5))
        r.c(bn, x + 1, 0, -11, 2, 2, 2, M("bone", "bone", 3.4))
        r.c(bn, x + 7, 0, -11, 2, 2, 2, M("bone", "bone", 3.4))
    return r


# ------------------------------------------------------------------------------------------- 3. Hornet Demon
def hornet_demon(base):
    p = pal(red="#ac2830", red2="#7c1a22", vein="#1c0a10", mane="#17121c", bone="#ead9bb", horn="#e2d2b2", gold="#d9a63a",
            iron="#55555f", glow="#ffb030", hoof="#2a2026", leather="#3a2420", dark="#120a0e")
    r = Rig11("geometry.hornet_demon", p, base)
    mu = lambda t=3.0, **k: M("red", "skin", t, **k)
    r.c("pelvis", -7, 12, -4, 14, 5, 9, M("red2", "skin", 2.8))
    r.c("torso", -9, 22, -5, 18, 11, 11, mu(3.1, decals=[("north", "veins", "vein"), ("east", "veins", "vein"), ("west", "veins", "vein")]))
    r.c("torso", -7, 16, -4, 14, 7, 9, M("red2", "ribbed", 3.0))
    r.c("torso", -8, 26, -6, 16, 6, 1, mu(3.4, decals=[("north", "veins", "vein")]))
    r.c("torso", -6, 24, 6, 12, 11, 3, M("mane", "fur", 2.8))                                          # mane down the back
    r.c("torso", -4, 33, 3, 8, 4, 5, M("mane", "fur", 3.0))
    r.c("torso", -9, 15, -5.5, 18, 3, 11, M("leather", "leather", 2.6, decals=[("north", "skull", 0)]))  # belt + skull buckle
    r.c("torso", -8, 11, -6, 1, 4, 1, M("iron", "forged", 2.8))
    r.c("torso", 6, 11, -6, 1, 5, 1, M("iron", "forged", 2.8))
    r.c("torso", -17, 30, -5, 8, 8, 10, M("iron", "forged", 2.9))                                     # spiked wheel pauldron
    r.c("torso", -19, 37, -1, 2, 4, 2, M("bone", "horn", 3.4), rot=[0, 0, 25])
    r.c("torso", -21, 33, 0, 3, 2, 2, M("bone", "horn", 3.6))
    r.c("torso", -19, 33, -7, 2, 2, 3, M("bone", "horn", 3.6))
    # bull head
    r.c("head", -5, 34, -8, 10, 9, 9, mu(3.0, decals=[("north", "eyes", "glow", 4)]))
    r.c("head", -4, 35, -12, 8, 5, 4, M("red2", "skin", 2.9))
    r.c("head", -1, 33, -13, 2, 2, 1, M("gold", "gold", 3.6))                                        # nose ring
    r.pair("head", "head", -4, 33, -12, 1, 2, 1, M("bone", "teeth", 4.0))
    r.pair("head", "head", -9, 41, -5, 4, 3, 3, M("horn", "horn", 3.0))
    r.pair("head", "head", -12, 43, -5, 3, 3, 3, M("horn", "horn", 3.4))
    r.pair("head", "head", -13, 46, -6, 2, 4, 2, M("horn", "horn", 3.9))
    r.pair("head", "head", -3, 44, -8, 2, 5, 2, M("horn", "horn", 3.7), rot=[-15, 0, 0])
    r.c("head", -3, 31, -6, 6, 4, 6, M("red2", "skin", 2.7))                                         # thick neck
    for side, up, fo in ((-1, "rightArm", "rightForearm"), (1, "leftArm", "leftForearm")):
        x = -16 if side < 0 else 9
        r.c(up, x, 20, -4, 7, 11, 8, mu(3.0, decals=[("north", "veins", "vein")]))
        r.c(fo, x, 9, -3.5, 7, 11, 7, M("red2", "skin", 2.9))
        r.c(fo, x - 0.5, 13, -4, 8, 3, 8, M("iron", "forged", 2.8))
        r.c(fo, x + 0.5, 6, -3, 6, 4, 6, mu(2.8))
    # black-crimson war blade
    r.c("weapon", -14, 4, -3, 2, 7, 2, M("leather", "leather", 2.5))
    r.c("weapon", -17, 11, -4, 8, 2, 4, M("iron", "forged", 2.5))
    r.c("weapon", -15, 13, -3, 4, 26, 1, M("dark", "forged", 3.2))
    r.c("weapon", -17, 13, -3, 2, 24, 1, M("red", "glow", 3.6))
    r.c("weapon", -15, 39, -3, 3, 3, 1, M("dark", "forged", 3.6))
    for side, bn in ((-1, "rightLeg"), (1, "leftLeg")):
        x = -9 if side < 0 else 2
        r.c(bn, x, 8, -4, 7, 6, 8, mu(2.9))
        r.c(bn, x + 0.5, 3, -1, 6, 6, 5, M("red2", "skin", 2.8))
        r.c(bn, x, 0, -5, 7, 3, 7, M("hoof", "horn", 2.6, decals=[("north", "vstitch", 3)]))
    r.c("tail", -1.5, 14, 6, 3, 3, 7, mu(2.9))
    r.c("tail", -1, 14.5, 13, 2, 2, 6, M("red2", "skin", 2.8))
    r.c("tail", -1.5, 14, 19, 3, 3, 3, M("bone", "horn", 3.4))
    r.c("tail", -0.5, 17, 9, 1, 2, 1, M("bone", "horn", 3.6))
    r.c("tail", -0.5, 16.5, 15, 1, 2, 1, M("bone", "horn", 3.6))
    return r


# ------------------------------------------------------------------------------------------- 4. Pink Horror of Tzeentch
def pink_horror(base):
    p = pal(pink="#e2897f", pink2="#c66a6c", gum="#8a2a3c", bone="#efe2c8", flame="#3ae4d2", flame2="#f2c23e",
            claw="#3a2632", glow="#3ae4d2", dark="#2a0e1a")
    r = Rig11("geometry.pink_horror", p, base)
    pk = lambda t=3.0, **k: M("pink", "ribbed", t, **k)
    r.bone("lowerArmR", "torso", [-9, 18, -3], [-35, 0, 15])
    r.bone("lowerArmL", "torso", [9, 18, -3], [-35, 0, -15])
    r.c("pelvis", -5, 11, -4, 10, 4, 8, M("pink2", "ribbed", 2.8))
    r.c("torso", -8, 13, -7, 16, 13, 12, pk(3.0))
    r.c("torso", -7, 13, -9, 14, 9, 2, M("pink2", "ribbed", 3.0, decals=[("north", "mouth", 3, 10, "bone")]))   # chest maw
    r.c("torso", -6, 22, 2, 12, 6, 6, pk(3.2))
    r.c("torso", -9, 23, -5, 3, 4, 7, pk(2.8))
    r.c("torso", 6, 23, -5, 3, 4, 7, pk(2.8))
    r.c("head", -6, 25, -9, 12, 8, 10, pk(3.1, decals=[("north", "eyes", "flame2", 5)]))
    r.c("head", -5, 24, -10, 10, 3, 2, M("pink2", "ribbed", 2.9, decals=[("north", "mouth", 0, 8, "bone")]))
    r.c("head", -4, 30, -1, 2, 2, 9, pk(3.3), rot=[22, 0, -8])                                            # swept-back tentacles
    r.c("head", 2, 30, -1, 2, 2, 9, pk(3.3), rot=[22, 0, 8])
    r.c("head", -1, 31, 0, 2, 2, 11, pk(3.5), rot=[28, 0, 0])
    r.c("head", -4, 28, 8, 1, 1, 5, M("pink2", "ribbed", 3.0), rot=[35, 0, -8])
    r.c("head", -4, 22, -9, 8, 2, 3, M("pink2", "ribbed", 2.6))                                         # hanging lower jaw
    r.c("torso", -4, 26, 0, 3, 3, 3, pk(3.4)); r.c("torso", 1, 25, 3, 3, 3, 3, pk(3.4))                 # back lumps
    r.c("head", 3, 28, 8, 1, 1, 5, M("pink2", "ribbed", 3.0), rot=[35, 0, 8])
    for side, up, fo in ((-1, "rightArm", "rightForearm"), (1, "leftArm", "leftForearm")):
        x = -11 if side < 0 else 8
        r.c(up, x, 15, -3, 3, 10, 3, pk(3.0))
        r.c(fo, x - 1, 7, -6, 3, 9, 3, M("pink2", "ribbed", 2.9))
        r.c(fo, x - 1.5, 4, -8, 4, 3, 4, M("claw", "horn", 2.8))
        r.c(fo, x - 1.5, 2, -9, 4, 2, 3, M("flame", "flame", 4.0))
        r.c(fo, x - 1, 5, -10, 1, 2, 1, M("claw", "horn", 3.4))
        r.c(fo, x + 1, 5, -10, 1, 2, 1, M("claw", "horn", 3.4))
        r.c(fo, x - 1.5, 13, -4, 4, 2, 2, M("pink", "ribbed", 3.4))                                      # elbow nodule
    for side, bn in ((-1, "lowerArmR"), (1, "lowerArmL")):
        x = -11 if side < 0 else 9
        r.c(bn, x, 10, -5, 2, 8, 2, M("pink2", "ribbed", 2.9))
        r.c(bn, x - 0.5, 7, -6, 3, 3, 3, M("claw", "horn", 2.8))
        r.c(bn, x - 0.5, 5, -7, 3, 2, 3, M("flame2", "flame", 4.0))
        r.c(bn, x + (1 if side < 0 else -1), 16, -4, 3, 3, 3, pk(3.2))                                   # rib-cage socket
    for side, bn in ((-1, "rightLeg"), (1, "leftLeg")):
        x = -6.5 if side < 0 else 2
        r.c(bn, x, 7, -3, 4.5, 6, 5, pk(2.9))
        r.c(bn, x + 0.5, 3, -1, 3, 5, 3, M("pink2", "ribbed", 2.8))
        r.c(bn, x - 0.5, 0, -5, 5, 3, 6, pk(2.7))
        r.c(bn, x, 0, -6, 1, 1, 1, M("claw", "horn", 3.4))
        r.c(bn, x + 3, 0, -6, 1, 1, 1, M("claw", "horn", 3.4))
    return r


# ------------------------------------------------------------------------------------------- 5. Ice Demon
def ice_demon(base):
    p = pal(scale="#2a4470", scale2="#1a2a4c", ice="#8fe2ff", crystal="#cff6ff", heart="#6ff0ff", membrane="#4f8fc8",
            glow="#9ff2ff", dark="#0a1424", bone="#dfe8f0")
    r = Rig11("geometry.ice_demon", p, base)
    sc = lambda t=3.0, **k: M("scale", "scale", t, **k)
    r.c("pelvis", -6, 13, -4, 12, 5, 8, M("scale2", "scale", 2.8))
    r.c("torso", -7, 22, -5, 14, 11, 10, sc(3.0))
    r.c("torso", -5, 16, -4, 10, 7, 8, M("scale2", "scale", 2.9))
    r.c("torso", -2, 25, -6, 4, 4, 1, M("heart", "glow", 4.2))                                         # ice heart
    r.c("torso", -1, 22, 5, 2, 3, 2, M("crystal", "ice", 3.4))                                         # crystal spine
    r.c("torso", -1, 26, 5, 2, 4, 2, M("crystal", "ice", 3.6))
    r.c("torso", -1, 31, 4, 2, 4, 2, M("crystal", "ice", 3.8), rot=[-20, 0, 0])
    r.pair("torso", "torso", -11, 29, -4, 4, 3, 8, M("ice", "ice", 3.2))
    r.c("head", -4, 32, -6, 8, 8, 8, sc(3.1, decals=[("north", "eyes", "glow", 3)]))
    r.c("head", -3, 31, -7, 6, 2, 4, M("scale2", "scale", 2.8, decals=[("north", "mouth", 0, 4, "crystal")]))
    r.pair("head", "head", -5, 39, -4, 2, 4, 2, M("ice", "ice", 3.3), rot=[0, 0, 20], pivot=[-4, 39, -3])
    r.pair("head", "head", -7, 42, -4, 2, 5, 2, M("crystal", "ice", 3.8), rot=[0, 0, 35], pivot=[-5, 42, -3])
    r.c("head", -1, 40, -5, 2, 3, 4, M("crystal", "ice", 3.6))
    for side, up, fo in ((-1, "rightArm", "rightForearm"), (1, "leftArm", "leftForearm")):
        x = -14 if side < 0 else 8
        r.c(up, x, 20, -3, 6, 12, 6, sc(3.0))
        r.c(fo, x + 0.5, 9, -2.5, 5, 12, 5, M("scale2", "scale", 2.9))
        r.c(fo, x + 0.5, 6, -3, 5, 3, 5, sc(2.8))
        for k in range(3):
            r.c(fo, x + 0.5 + k * 2, 1, -5, 1, 6, 1, M("ice", "glow", 3.8), rot=[22, 0, 0], pivot=[x + 1 + k * 2, 6, -4])
    for side, bn in ((-1, "rightLeg"), (1, "leftLeg")):
        x = -7.5 if side < 0 else 1.5
        r.c(bn, x, 7, -3.5, 6, 7, 6, sc(2.9))
        r.c(bn, x + 0.5, 2, -2.5, 5, 5, 5, M("scale2", "scale", 2.8))
        r.c(bn, x, 0, -5, 6, 3, 7, sc(2.7))
        r.c(bn, x + 1, 0, -6, 1, 2, 1, M("ice", "ice", 3.6))
        r.c(bn, x + 4, 0, -6, 1, 2, 1, M("ice", "ice", 3.6))
    for wing, sgn in (("leftWing", 1), ("rightWing", -1)):
        ox = 8 if sgn > 0 else -24
        r.c(wing, ox, 31, 5, 16, 2, 2, M("ice", "ice", 3.4))
        for k, (dx, hh) in enumerate(((5, 13), (10, 11), (14, 9))):
            xx = (8 + dx) if sgn > 0 else (-8 - dx - 1)
            r.c(wing, xx, 31 - hh, 6, 1, hh, 1, M("ice", "ice", 3.6))
        for k, (dx, hh, ww) in enumerate(((1, 12, 5), (6, 10, 4), (10, 8, 5))):
            xx = (8 + dx) if sgn > 0 else (-8 - dx - ww)
            r.c(wing, xx, 31 - hh, 6.5, ww, hh, 1, M("membrane", "ice", 2.6 + 0.2 * k))
    r.c("tail", -1.5, 14, 5, 3, 3, 7, sc(2.9))
    r.c("tail", -1, 14.5, 12, 2, 2, 6, M("scale2", "scale", 2.8))
    r.c("tail", -1.5, 14, 18, 3, 3, 4, M("crystal", "ice", 3.6))
    r.c("tail", -0.5, 17, 8, 1, 2, 1, M("ice", "ice", 3.6))
    r.c("tail", -0.5, 16.5, 14, 1, 2, 1, M("ice", "ice", 3.6))
    return r


# ------------------------------------------------------------------------------------------- Faceless Ones (N'raqi)
FACELESS = dict(chitin="#1f8a78", chitin2="#13574e", bronze="#c58b3a", iron="#55555e", gem="#3aff9a", glow="#5affa0",
                tent="#2a7a68", bone="#ddd3b2", robe="#14474a", gold="#dcaa44", leather="#3a2a20", dark="#081412", cloth="#1a2a30")


def _fl_head(r, x0, y0, z0, s, eyes=2, tent=4):
    r.c("head", x0, y0, z0, s, s, s, M("chitin", "chitin", 3.1, decals=[("north", "eyes", "glow", s // 3, eyes)]))
    step = max(1, (s - 2) // max(1, tent - 1))
    for k in range(tent):
        r.c("head", x0 + 1 + k * step, y0 - 5, z0 - 1, 1, 5 + (k % 2), 1, M("tent", "ribbed", 3.0 + 0.2 * (k % 2)))


def faceless_general(base):
    p = pal(**FACELESS)
    r = Rig11("geometry.faceless_general", p, base)
    ch = lambda t=3.0, **k: M("chitin", "chitin", t, **k)
    br = lambda t=3.0, **k: M("bronze", "forged", t, **k)
    r.c("pelvis", -9, 10, -7, 18, 6, 14, M("chitin2", "chitin", 2.8))
    r.c("pelvis", -6, 3, -8, 12, 8, 1, M("cloth", "cloth", 2.6, decals=[("north", "gem", "gem", 5, 2, 2)]))
    r.c("torso", -11, 20, -8, 22, 16, 17, ch(3.0))
    r.c("torso", -10, 24, -10, 20, 10, 2, br(3.1))
    r.c("torso", -8, 16, -7, 16, 6, 13, M("chitin2", "chitin", 2.9))
    r.c("torso", -11, 31, -11, 22, 1, 1, M("iron", "forged", 2.6), rot=[0, 0, 10])
    r.c("torso", -11, 27, -11, 22, 1, 1, M("iron", "forged", 2.6), rot=[0, 0, -10])
    for (sx, y, z) in ((6, 35, 1), (2, 36, 4), (8, 32, 6)):
        r.pair("torso", "torso", -sx - 1, y, z, 2, 9, 2, M("bone", "horn", 3.3), rot=[-25, 0, 12], pivot=[-sx, y, z + 1])
    r.pair("torso", "torso", -20, 30, -6, 8, 5, 11, br(3.2))
    r.pair("torso", "torso", -18, 35, -2, 2, 4, 2, M("bone", "horn", 3.5), rot=[0, 0, 25], pivot=[-17, 35, -1])
    r.c("torso", -9, 34, 4, 18, 2, 6, br(2.9))                                                          # riveted hump band
    r.c("torso", -1, 27, -11, 2, 2, 1, M("gem", "gem", 3.8))
    _fl_head(r, -5, 27, -14, 10, eyes=4, tent=4)
    r.c("head", -5, 36, -14, 10, 2, 4, M("chitin2", "chitin", 3.3))
    for side, up, fo in ((-1, "rightArm", "rightForearm"), (1, "leftArm", "leftForearm")):
        x = -20 if side < 0 else 10
        r.c(up, x, 20, -5, 10, 13, 10, ch(3.0))
        r.c(fo, x + 1, 8, -7, 8, 12, 9, M("chitin2", "chitin", 2.9))
        r.c(fo, x + 0.5, 13, -7.5, 9, 4, 10, br(3.0))
        r.c(fo, x + 1, 3, -10, 8, 5, 8, ch(2.9))                                                        # claw palm
        r.c(fo, x + 0.5, 5, -16, 9, 3, 7, M("chitin2", "chitin", 3.2))                                   # upper pincer
        r.c(fo, x + 1, 1, -15, 8, 2, 6, ch(2.8))                                                        # lower pincer
        r.c(fo, x + 0.5, 4, -17, 2, 2, 1, M("bone", "horn", 3.8))
    for side, bn in ((-1, "rightLeg"), (1, "leftLeg")):
        x = -11 if side < 0 else 2
        r.c(bn, x, 6, -6, 9, 8, 10, ch(2.9))
        r.c(bn, x - 0.5, 0, -8, 10, 6, 13, M("chitin2", "chitin", 2.7))
        r.c(bn, x - 0.5, 9, -7, 10, 3, 2, br(3.1))
        r.c(bn, x + 3.5, 11, -8, 2, 3, 2, M("bone", "horn", 3.6))
    return r


def faceless_berserker(base):
    p = pal(**FACELESS)
    r = Rig11("geometry.faceless_berserker", p, base)
    ch = lambda t=3.0, **k: M("chitin", "chitin", t, **k)
    br = lambda t=3.0, **k: M("bronze", "forged", t, **k)
    r.c("pelvis", -6, 9, -4.5, 12, 5, 9, M("chitin2", "chitin", 2.8))
    r.c("pelvis", -4, 4, -5, 8, 6, 1, M("cloth", "cloth", 2.6))
    r.c("torso", -7, 19, -4.5, 14, 9, 9, ch(3.1))
    r.c("torso", -6, 14, -4, 12, 5, 8, M("chitin2", "ribbed", 3.0))
    r.c("torso", -6.5, 22, -5, 13, 5, 1, ch(3.4))
    r.c("torso", -7, 13, -5, 14, 3, 10, br(3.0, decals=[("north", "gem", "gem", 6, 1, 2)]))
    r.pair("torso", "torso", -12, 25, -3.5, 5, 4, 7, M("chitin2", "chitin", 3.0))
    r.pair("torso", "torso", -11, 29, -1, 2, 4, 2, M("bone", "horn", 3.4), rot=[0, 0, 20], pivot=[-10, 29, 0])
    r.pair("torso", "torso", -13, 28, 1, 2, 3, 2, M("bone", "horn", 3.6), rot=[0, 0, 35], pivot=[-12, 28, 2])
    _fl_head(r, -4, 28, -5, 8, eyes=2, tent=4)
    r.c("head", -1, 36, -4, 2, 4, 2, M("bone", "horn", 3.4))
    r.c("head", -1, 35, 0, 2, 4, 2, M("bone", "horn", 3.6), rot=[-30, 0, 0])
    r.pair("head", "head", -4, 34, -2, 1, 3, 2, M("bone", "horn", 3.6), rot=[0, 0, 20], pivot=[-3.5, 34, -1])
    for side, up, fo in ((-1, "rightArm", "rightForearm"), (1, "leftArm", "leftForearm")):
        x = -11.5 if side < 0 else 6.5
        r.c(up, x, 17, -2.5, 5, 10, 5, ch(3.0))
        r.c(fo, x - 0.5, 9, -2.5, 5, 9, 5, M("chitin2", "chitin", 2.9))
        r.c(fo, x - 1, 11, -3, 6, 4, 6, br(3.0))
        r.c(fo, x, 6, -2, 4, 4, 4, ch(2.8))
    r.c("weapon", -10, 4, -2.5, 1, 24, 1, M("leather", "leather", 2.6))
    r.c("weapon", -15, 21, -3, 5, 6, 1, M("iron", "forged", 3.0))
    r.c("weapon", -16, 22, -3, 1, 4, 1, M("iron", "forged", 3.8))
    r.c("weapon", -9, 23, -3, 3, 2, 1, M("iron", "forged", 3.2))
    r.c("weapon", -7, 24, -3, 1, 2, 1, M("iron", "forged", 3.8))
    r.c("weapon", -10, 28, -3, 1, 3, 1, M("iron", "forged", 3.6))
    r.c("weapon", -10.5, 10, -3, 2, 2, 2, M("bronze", "forged", 3.2))
    r.c("weapon", -16, 25, -3, 1, 1, 1, M("iron", "forged", 4.0))
    r.c("torso", -5, 20, -5.5, 4, 3, 1, M("chitin2", "chitin", 3.6)); r.c("torso", 1, 19, -5.5, 4, 3, 1, M("chitin2", "chitin", 3.6))
    for side, bn in ((-1, "rightLeg"), (1, "leftLeg")):
        x = -6.5 if side < 0 else 0.5
        r.c(bn, x, 6, -3.5, 6, 6, 7, ch(2.9))
        r.c(bn, x, 0, -4.5, 6, 6, 8, M("chitin2", "chitin", 2.7))
        r.c(bn, x - 0.5, 6, -4, 7, 2, 2, br(3.1))
        r.c(bn, x + 0.5, 1, -5, 5, 4, 1, br(2.8))
    return r


def faceless_warrior(base):
    p = pal(**FACELESS)
    r = Rig11("geometry.faceless_warrior", p, base)
    ch = lambda t=3.0, **k: M("chitin", "chitin", t, **k)
    br = lambda t=3.0, **k: M("bronze", "forged", t, **k)
    r.c("pelvis", -6, 9, -4.5, 12, 5, 9, M("chitin2", "chitin", 2.8))
    r.c("pelvis", -4, 3, -5, 8, 7, 1, M("cloth", "cloth", 2.6, decals=[("north", "gem", "gem", 3, 1, 2)]))
    r.c("torso", -7, 18, -4.5, 14, 10, 9, ch(3.1))
    r.c("torso", -6, 14, -4, 12, 4, 8, M("chitin2", "chitin", 2.9))
    r.c("torso", -6.5, 20, -5, 13, 7, 1, br(3.0))
    r.c("torso", -7, 13, -5, 14, 2, 10, M("leather", "leather", 2.7))
    for side, bn in ((-1, "rightArm"), (1, "leftArm")):                                           # tiered angular pauldrons
        x = -15 if side < 0 else 7
        x = -13.5 if side < 0 else 6.5
        r.c(bn, x, 26, -4, 7, 3, 8, br(3.2))
        r.c(bn, x + (-0.5 if side < 0 else 0.5), 25, -4.5, 7, 1, 9, M("bone", "bone", 3.2))
        r.c(bn, x + (1 if side < 0 else 0), 29, -3, 6, 2, 6, br(3.5))
        r.c(bn, x + (0 if side < 0 else 5), 31, -1, 2, 3, 2, M("bone", "horn", 3.6))
    _fl_head(r, -4, 28, -5, 8, eyes=2, tent=4)
    r.c("head", -4, 35, -5, 8, 1, 8, M("chitin2", "chitin", 3.3))
    for side, up, fo in ((-1, "rightArm", "rightForearm"), (1, "leftArm", "leftForearm")):
        x = -11.5 if side < 0 else 6.5
        r.c(up, x, 17, -2.5, 5, 9, 5, ch(3.0))
        r.c(fo, x - 0.5, 9, -2.5, 5, 9, 5, M("chitin2", "chitin", 2.9))
        r.c(fo, x - 1, 12, -3, 6, 3, 6, br(3.0))
        r.c(fo, x, 6, -2, 4, 4, 4, ch(2.8))
    r.c("weapon", -10, 5, -2.5, 1, 7, 1, M("leather", "leather", 2.6))
    r.c("weapon", -12, 11, -3, 5, 1, 2, M("bronze", "forged", 3.2))
    r.c("weapon", -11, 12, -2.5, 3, 20, 1, M("iron", "forged", 3.0, decals=[("north", "runes", "glow"), ("south", "runes", "glow")]))
    for k in range(4):
        r.c("weapon", -12, 14 + k * 4, -2.5, 1, 2, 1, M("iron", "forged", 3.8))
    r.c("weapon", -10.5, 32, -2.5, 2, 2, 1, M("iron", "forged", 3.7))
    r.c("leftForearm", 12, 6, -7, 2, 13, 11, M("chitin2", "chitin", 3.0, decals=[("east", "gem", "gem", 4, 5, 2)]))   # spiked shield
    r.c("leftForearm", 13.5, 5, -7.5, 1, 15, 12, br(3.1))
    r.c("leftForearm", 14.5, 11, -2, 2, 2, 2, M("bone", "horn", 3.6))
    r.c("leftForearm", 14.5, 15, -5, 2, 2, 2, M("bone", "horn", 3.6))
    r.c("leftForearm", 14.5, 7, 1, 2, 2, 2, M("bone", "horn", 3.6))
    for side, bn in ((-1, "rightLeg"), (1, "leftLeg")):
        x = -6.5 if side < 0 else 0.5
        r.c(bn, x, 6, -3.5, 6, 6, 7, ch(2.9))
        r.c(bn, x, 0, -4.5, 6, 6, 8, M("chitin2", "chitin", 2.7))
        r.c(bn, x - 0.5, 6, -4, 7, 2, 2, br(3.1))
    return r


def faceless_sorcerer(base):
    p = pal(**FACELESS)
    r = Rig11("geometry.faceless_sorcerer", p, base)
    rb = lambda t=3.0, **k: M("robe", "robe", t, **k)
    r.c("pelvis", -6, 0, -5, 12, 14, 10, rb(2.8, bands=[("gold", "forged", 0.82, 1.0)]))
    r.c("pelvis", -7, 0, -6, 14, 3, 12, rb(2.5, bands=[("gold", "forged", 0.0, 0.34)]))
    r.c("torso", -7, 14, -4.5, 14, 14, 9, rb(3.0))
    r.c("torso", -1, 4, -6, 2, 22, 1, M("gold", "forged", 3.4))
    r.c("torso", -6, 26, 2, 12, 9, 2, M("bronze", "forged", 3.1))                                   # high collar
    r.pair("torso", "torso", -7, 26, -3, 1, 8, 6, M("bronze", "forged", 3.3))
    r.c("torso", -8, 25, -5, 16, 3, 10, M("bronze", "forged", 2.9))                                  # shoulder mantle
    r.c("torso", -7, 13, -5, 14, 2, 10, M("gold", "forged", 3.0, decals=[("north", "gem", "gem", 6, 0, 2)]))   # belt
    r.c("torso", -5, 4, -6, 10, 10, 1, rb(2.7, bands=[("gold", "forged", 0.85, 1.0)]))               # front apron
    r.c("torso", -6, 8, 4.5, 12, 18, 1, rb(2.6))                                                     # back cloak
    r.pair("head", "head", -4, 36, -3, 1, 3, 2, M("chitin2", "chitin", 3.4))                         # head crest
    _fl_head(r, -4, 28, -5, 8, eyes=2, tent=5)
    r.c("head", -2, 19, -6, 1, 4, 1, M("tent", "ribbed", 2.8))
    r.c("head", 1, 18, -6, 1, 5, 1, M("tent", "ribbed", 2.8))
    for side, up, fo in ((-1, "rightArm", "rightForearm"), (1, "leftArm", "leftForearm")):
        x = -11.5 if side < 0 else 6.5
        r.c(up, x, 17, -2.5, 5, 9, 5, rb(3.0))
        r.c(fo, x - 0.5, 10, -2.5, 5, 8, 5, rb(2.9))
        r.c(fo, x - 1, 9, -3, 6, 3, 6, M("gold", "forged", 3.2))
        r.c(fo, x, 6, -2, 4, 3, 4, M("chitin", "chitin", 2.8))
        cx = -15 if side < 0 else 13
        r.c(up, cx, 28, -1, 2, 4, 2, M("gem", "gem", 3.8))                                            # rune crystal
        r.c(up, cx + (2 if side < 0 else -1), 29, -0.5, 1, 1, 1, M("gem", "glow", 4.0))               # glowing tether
    r.c("weapon", -10, -2, -2.5, 1, 32, 1, M("leather", "wood", 2.6))
    r.c("weapon", -10.5, 8, -3, 2, 1, 2, M("bronze", "forged", 3.2))
    r.c("weapon", -10.5, 20, -3, 2, 1, 2, M("bronze", "forged", 3.2))
    r.c("weapon", -11.5, 29, -4, 4, 4, 4, M("bone", "bone", 3.3, decals=[("north", "eyes", "dark", 1)]))
    r.c("weapon", -10.5, 33, -3, 2, 3, 2, M("gem", "glow", 4.0))
    r.c("weapon", -12, 31, -3, 1, 4, 1, M("bronze", "forged", 3.6))
    r.c("weapon", -8, 31, -3, 1, 4, 1, M("bronze", "forged", 3.6))
    r.c("weapon", -10.5, 14, -3, 2, 1, 2, M("bronze", "forged", 3.2))
    r.c("weapon", -10.5, 26, -3, 2, 2, 2, M("bronze", "forged", 3.4))
    r.c("weapon", -10.5, -3, -3, 2, 1, 2, M("bronze", "forged", 3.0))                                # staff foot
    r.c("head", -3, 17, -6, 1, 2, 1, M("tent", "ribbed", 2.6)); r.c("head", 2, 17, -6, 1, 2, 1, M("tent", "ribbed", 2.6))
    return r


def faceless_cultist(base):
    p = pal(**FACELESS)
    r = Rig11("geometry.faceless_cultist", p, base)
    cl = lambda t=3.0, **k: M("cloth", "cloth", t, **k)
    r.c("pelvis", -6, 0, -5, 12, 14, 10, cl(2.7))
    r.c("pelvis", -7, 0, -6, 14, 3, 12, cl(2.4))
    r.c("torso", -7.5, 14, -4.5, 15, 14, 9, cl(2.9))
    r.c("torso", -8, 24, -5, 16, 4, 10, M("bronze", "forged", 3.1))                                  # ritual mantle
    r.pair("torso", "torso", -6, 17, -5.5, 4, 8, 1, M("bronze", "forged", 2.9, decals=[("north", "runes", "glow")]))
    r.c("head", -4, 28, -4.5, 8, 8, 8, M("chitin2", "chitin", 2.6, decals=[("north", "eyes", "glow", 3)]))
    r.c("head", -5, 29, -3, 10, 9, 9, cl(2.6))                                                        # hood, pushed back
    r.c("head", -3, 36, 2, 6, 3, 5, cl(2.8))
    r.c("head", -5, 24, 3, 10, 7, 3, cl(2.4))
    for k, x in enumerate((-2, 0, 2)):
        r.c("head", x - 0.5, 24, -5, 1, 4 + (k % 2), 1, M("tent", "ribbed", 3.0))
    for side, up, fo in ((-1, "rightArm", "rightForearm"), (1, "leftArm", "leftForearm")):
        x = -10 if side < 0 else 6
        r.c(up, x, 18, -2, 4, 8, 4, cl(2.9))
        r.c(fo, x - 0.5, 11, -2.5, 5, 7, 5, cl(2.8))
        r.c(fo, x - 1, 10, -3, 6, 2, 6, M("bronze", "forged", 3.1))
        r.c(fo, x, 7, -2, 4, 3, 4, M("chitin2", "chitin", 2.8))
    r.c("leftForearm", 6.5, 7, -5, 3, 3, 3, M("glow", "glow", 4.3))                                  # glowing orb in hand
    r.c("leftForearm", 6, 10, -5.5, 4, 1, 4, M("bronze", "forged", 3.4))                              # orb ring
    r.c("leftForearm", 6, 6, -5.5, 4, 1, 4, M("bronze", "forged", 3.0))
    r.c("head", -5, 28, -4, 10, 2, 1, cl(2.2))                                                        # hood rim (shadow)
    r.pair("head", "head", -6, 26, -3, 1, 10, 7, cl(2.5))                                             # hood side drapes
    r.c("torso", -8, 20, 4.5, 16, 8, 1, M("bronze", "forged", 2.8))                                   # mantle back
    r.c("torso", -7, 22, -5.5, 14, 1, 1, M("leather", "leather", 2.8), rot=[0, 0, -20])              # chest strap
    r.c("torso", -7.5, 13, -5, 15, 2, 10, M("leather", "leather", 2.6))                               # belt
    for k, x in enumerate((-5, -1, 3)):
        r.c("torso", x, 10, -5.5, 2, 3, 1, M("bone" if k != 1 else "glow", "bone" if k != 1 else "glow", 3.4))   # charms
    r.pair("pelvis", "pelvis", -5, 0, -5.5, 4, 13, 1, cl(2.5))                                        # robe slit panels
    for side, fo in ((-1, "rightForearm"), (1, "leftForearm")):
        x = -11 if side < 0 else 6
        r.c(fo, x, 12, -3, 5, 5, 1, cl(2.4))                                                          # sleeve drape
    r.c("weapon", -9.5, 4, -3, 2, 1, 2, M("bronze", "forged", 3.3))                                   # pommel
    r.c("head", 1.5, 23, -5, 1, 5, 1, M("tent", "ribbed", 3.2))
    r.c("weapon", -9, 5, -2.5, 1, 5, 1, M("leather", "leather", 2.6))
    r.c("weapon", -10, 10, -3, 3, 1, 2, M("bronze", "forged", 3.2))
    for k, dx in enumerate((0, -0.5, 0, -0.5)):
        r.c("weapon", -9 + dx, 11 + k * 3, -2.5, 1, 3, 1, M("iron", "forged", 3.2 + 0.2 * k))
    return r


BUILDERS = {"warcraft:abomination_lord": abomination_lord, "warcraft:great_unclean_one": great_unclean_one,
            "warcraft:hornet_demon": hornet_demon, "warcraft:pink_horror": pink_horror, "warcraft:ice_demon": ice_demon,
            "warcraft:faceless_general": faceless_general, "warcraft:faceless_berserker": faceless_berserker,
            "warcraft:faceless_warrior": faceless_warrior, "warcraft:faceless_sorcerer": faceless_sorcerer,
            "warcraft:faceless_cultist": faceless_cultist}
