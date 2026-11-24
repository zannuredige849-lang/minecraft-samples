"""Illidan, night elf form: dark blindfolded face with glowing green eyes, olive horns (swept arm + spiral plate),
mauve skin with green tattoos, tan bracers and belt, green/gold tassets, gold-banded greaves, green Azzinoth glaives."""
import random

from common import *

SKIN = hexc("#a6727f")
SKIN_L = hexc("#c08c98")
SKIN_D = hexc("#7d4f5b")
EAR = hexc("#c98f9d")
HAIR = hexc("#2a2614")
HAIR_L = hexc("#3c3720")
HAIR_D = hexc("#17150b")
HORN = hexc("#2e2915")
HORN_L = hexc("#4a4324")
GRN = hexc("#4d7d1c")
GRN_L = hexc("#74a52c")
GRN_D = hexc("#35581a")
GOLD = hexc("#d2a82e")
GOLD_L = hexc("#f0cf5a")
GOLD_D = hexc("#8f6c17")
TAN = hexc("#9a8a52")
TAN_L = hexc("#b8a96c")
TAN_D = hexc("#6e6038")
BRN = hexc("#5b372d")
BRN_L = hexc("#7a4a3a")
BRN_D = hexc("#3b231d")
BOOT = hexc("#1d1a12")
EYE = hexc("#9be31c")
EYE_L = hexc("#e4ff7a")
BONE = hexc("#a9a37e")
BONE_L = hexc("#d3cda4")
RED_GEM = hexc("#c4202a")

SPIRAL = [
    "##########",
    "#........#",
    "#.######.#",
    "#.#....#.#",
    "#.#.##.#.#",
    "#.#.#..#.#",
    "#.#.####.#",
    "#.#......#",
    "#.########",
    "##########",
]

TATTOO_CHEST = [
    "G..G.....G...",
    ".GG.G.G.GG...",
    "..G.GGG.G.G..",
    "G.G..G..GG...",
    ".GG.G.G.G....",
    "...GG.G..G...",
]
TATTOO_BACK = [
    "..G..G.G..G..",
    ".GGG.GGG.GG..",
    "..G...G...G..",
    ".G.G..G..G.G.",
    "...G.GGG.G...",
]


def tat(rows, x=0, y=0, faces=None):
    return art(rows, {"G": GRN}, x, y, faces)


def skin_paint(c=SKIN):
    return shaded(c, bands=3, top=1.1, bottom=0.82)


def head_paint(face, w, h):
    im = skin_paint()(face, w, h)
    d = ImageDraw.Draw(im)
    if face == "north":
        d.rectangle([0, 0, w - 1, 1], fill=HAIR)
        d.rectangle([0, 2, w - 1, 5], fill=HAIR_D)  # dark blindfold over the eyes
        d.line([(0, 2), (w - 1, 2)], fill=lit(HAIR_D, 1.5))
        for x0 in (1, 5):
            d.rectangle([x0, 3, x0 + 1, 3], fill=EYE)
            d.point((x0, 4), fill=lit(EYE, 0.55))
        d.point((x0 - 4, 3), fill=EYE_L)
        d.point((x0, 3), fill=EYE_L)
        d.line([(3, 6), (4, 6)], fill=SKIN_D)
        d.line([(3, 7), (4, 7)], fill=lit(SKIN_D, 0.85))
    elif face in ("east", "west", "south"):
        d.rectangle([0, 0, w - 1, 1], fill=HAIR)
        d.rectangle([0, 2, w - 1, 5], fill=HAIR_D)
    elif face == "up":
        d.rectangle([0, 0, w - 1, h - 1], fill=HAIR)
    return im


def hair_paint(face, w, h):
    return gradient_v(HAIR_L, HAIR_D, bands=4, up=HAIR_L)(face, w, h)


def lock_paint(face, w, h):
    im = gradient_v(HAIR_L, HAIR_D, bands=4, up=HAIR)(face, w, h)
    if face in SIDES and h >= 4:
        px = im.load()
        for x in range(w):
            if x % 2 == 0:
                px[x, h - 1] = (0, 0, 0, 0)
    return im


def ear_paint(face, w, h):
    return skin_paint(EAR)(face, w, h)


def horn_paint(face, w, h):
    im = shaded(HORN, bands=3, top=1.18, bottom=0.8)(face, w, h)
    d = ImageDraw.Draw(im)
    if face in SIDES and h >= 4:
        for y in range(1, h, 3):
            d.line([(0, y), (w - 1, y)], fill=HORN_L)
    return im


def spiral_paint(face, w, h):
    im = shaded(HORN, bands=3, top=1.18, bottom=0.8)(face, w, h)
    if face in ("north", "south"):
        px = im.load()
        for j, row in enumerate(SPIRAL):
            for i, ch in enumerate(row):
                if ch == "." and i < w and j < h:
                    px[i, j] = (0, 0, 0, 0)
    return im


def chest_paint(face, w, h):
    base = layer(skin_paint(), tat(TATTOO_CHEST, 0, 1, "north"), tat(TATTOO_BACK, 0, 1, "south"))
    im = base(face, w, h)
    if face == "north":
        d = ImageDraw.Draw(im)
        d.rectangle([w // 2 - 1, h - 2, w // 2, h - 2], fill=SKIN_L)
    return im


def abdomen_paint(face, w, h):
    return layer(skin_paint(SKIN_D), tat(["G.G.G", ".G.G."], 3, 0, ("north",)))(face, w, h)


def belt_paint(face, w, h):
    return layer(shaded(TAN, bands=3, top=1.12, bottom=0.8), edge(TAN_D, ("bottom",)), edge(TAN_L, ("top",)))(face, w, h)


def arm_paint(face, w, h):
    return layer(skin_paint(), tat(["G..", ".GG", "G.G", "..G"], 0, 1, ("north", "east", "west", "south")))(face, w, h)


def bracer_paint(face, w, h):
    return layer(
        shaded(TAN, bands=3, top=1.12, bottom=0.78),
        hbands([(1, TAN_L), (3, TAN), (1, TAN_D), (1, TAN_L)], margin=0),
        edge(TAN_D, ("bottom",)),
    )(face, w, h)


def pad_paint(face, w, h):
    return layer(shaded(GRN, bands=3, top=1.15, bottom=0.8), edge(GOLD, ("bottom",)), edge(GOLD_L, ("top",)))(face, w, h)


def tasset_paint(gem=False):
    def f(face, w, h):
        im = shaded(GRN, bands=3, top=1.18, bottom=0.82)(face, w, h)
        d = ImageDraw.Draw(im)
        if face in ("north", "south"):
            d.rectangle([0, 0, w - 1, h - 1], outline=GOLD)
            d.line([(1, 1), (w - 2, 1)], fill=GOLD_L)
            d.line([(1, h - 2), (w - 2, h - 2)], fill=GOLD_D)
            if gem and face == "north":
                d.rectangle([w // 2 - 1, h - 4, w // 2, h - 3], fill=RED_GEM)
                d.point((w // 2 - 1, h - 4), fill=lit(RED_GEM, 1.5))
        else:
            d.rectangle([0, 0, w - 1, h - 1], fill=GOLD)
        return im

    return f


def thigh_paint(face, w, h):
    return layer(shaded(BRN, bands=3, top=1.12, bottom=0.8), edge(BRN_D, ("bottom",)))(face, w, h)


def shin_paint(face, w, h):
    spec = hbands([(1, BRN_D), (1, GOLD), (1, BRN), (1, GOLD), (1, BRN_D)], margin=0)
    return layer(shaded(BRN, bands=2, top=1.1, bottom=0.85), spec)(face, w, h)


def boot_paint(face, w, h):
    return layer(shaded(BOOT, bands=3, top=1.4, bottom=0.9), edge(GOLD, ("top",)))(face, w, h)


BACK_PLATE = [
    ".OOO..OOO.",
    "OOOOGGOOOO",
    ".OOGGGGOO.",
    "OOOOGGOOOO",
    ".OOO..OOO.",
]


def back_plate_paint(face, w, h):
    base = layer(shaded(hexc("#a89a26"), bands=3, top=1.12, bottom=0.82), edge(GOLD_D, ("top", "bottom", "left", "right")))
    im = base(face, w, h)
    if face == "south":
        art(BACK_PLATE, {"O": hexc("#c8801c"), "G": GRN_L}, 0, 1)("south", im, w, h)
    return im


def sash_paint(face, w, h):
    return layer(shaded(GRN, bands=3, top=1.15, bottom=0.8), edge(GOLD, ("top", "bottom")))(face, w, h)


def collar_paint(face, w, h):
    return layer(shaded(GRN_D, bands=2), edge(GOLD, ("bottom",)))(face, w, h)


# ---- Azzinoth glaive ------------------------------------------------------------------------------------
MOTTLE = [hexc("#77753a"), hexc("#6d8e32"), hexc("#a9a37e"), hexc("#585334"), hexc("#6d8e32")]


def glaive_blade_paint(i, side):
    """leafy Azzinoth blade: mottled grey-green bone spine down the middle, saturated green leaf edges
    with ragged pixel-leaf teeth on both sides"""

    def f(face, w, h):
        if face in ("up", "down"):
            return solid(GRN_D if face == "down" else GRN, w, h)
        im = Image.new("RGBA", (w, h))
        px = im.load()
        mid = h // 2
        for y in range(h):
            for x in range(w):
                gx = x + i * 9
                d = abs(y - mid)
                if d <= 1:
                    px[x, y] = MOTTLE[(gx * 3 + y) % len(MOTTLE)]
                elif d == 2:
                    px[x, y] = GRN_L if gx % 3 else GRN
                else:
                    px[x, y] = GRN if (gx + y) % 4 else GRN_D
        for x in range(w):
            gx = x + i * 9
            up = [0, 2, 1, 3, 0, 2, 3, 1][gx % 8] if h >= 6 else 0
            dn = [2, 0, 3, 1, 2, 0, 1, 3][(gx + 3) % 8] if h >= 6 else 0
            for y in range(0, up):
                px[x, y] = (0, 0, 0, 0)
            for y in range(h - dn, h):
                px[x, y] = (0, 0, 0, 0)
        return im

    return f


def glaive_core_paint(face, w, h):
    return layer(shaded(BONE, bands=3, top=1.1, bottom=0.8), edge(GRN_D, ("bottom",)))(face, w, h)


def build():
    m = Model("illidan_elf", 128, 128, bounds=(6, 4, (0, 1.6, 0)), fit=True)
    B = m.bone
    LEG = 15
    B("root", None, (0, 0, 0))
    B("body", "root", (0, 17, 0))
    B("head", "body", (0, 27, 0))
    B("hair_back", "head", (0, 34, 4))
    B("lock_r", "head", (4, 30, 0))
    B("lock_l", "head", (-4, 30, 0))
    B("ear_r", "head", (4, 32, 0))
    B("ear_l", "head", (-4, 32, 0))
    B("horn_r", "head", (3, 35, 0))
    B("horn_l", "head", (-3, 35, 0))
    B("tabard", "body", (0, 17, -4))
    B("tasset_r", "body", (5, 16, -3))
    B("tasset_l", "body", (-5, 16, -3))
    for s, sx in (("r", 1), ("l", -1)):
        B(f"arm_{s}", "body", (sx * 7.5, 26, 0))
        B(f"forearm_{s}", f"arm_{s}", (sx * 7.5, 20, 0))
        B(f"glaive_{s}", f"forearm_{s}", (sx * 7.5, 13, -4))
        B(f"leg_{s}", "root", (sx * 2.5, LEG, 0))
        B(f"shin_{s}", f"leg_{s}", (sx * 2.5, 9, 0))

    # torso
    m.cube("body", [-4.5, 17, -3], [9, 3, 6], abdomen_paint)
    m.cube("body", [-5.5, 20, -3.5], [11, 7, 7], chest_paint)
    m.cube("body", [-5.5, 15, -3.5], [11, 2, 7], belt_paint, inflate=0.2)
    m.cube("body", [-3, 26, -3.4], [6, 1, 6.8 if False else 7], collar_paint, inflate=0.1)
    m.cube("body", [-5, 19.5, 3.6], [10, 7, 1], back_plate_paint)
    m.cube("tabard", [-3, 7, -4.2], [6, 10, 1], tasset_paint(False))
    m.cube("tabard", [-3, 7, 3.2], [6, 10, 1], tasset_paint(False))
    m.cube("tasset_r", [5.0, 8, -4.1], [5, 8, 1], tasset_paint(True), pivot=[5, 16, -3.5], rot=[0, 0, -16])
    m.cube("tasset_l", [-10.0, 8, -4.1], [5, 8, 1], tasset_paint(False), pivot=[-5, 16, -3.5], rot=[0, 0, 16])

    # head
    m.cube("head", [-4, 27, -4], [8, 8, 8], head_paint)
    m.cube("head", [-4, 33, -4], [8, 2, 8], hair_paint, inflate=0.35)
    m.cube("hair_back", [-4.5, 27, 4], [9, 8, 2], hair_paint)
    for s, sx in (("r", 1), ("l", -1)):
        lx = 3.8 if sx > 0 else -6.2
        m.cube(f"lock_{s}", [lx, 22, -3], [2.4 if False else 2, 11, 6], lock_paint)
        m.cube(f"lock_{s}", [lx + (0.0 if sx > 0 else 0.0), 20, -1], [2, 4, 3], lock_paint)
        eo = [4.0, 31, -1] if sx > 0 else [-5.0, 31, -1]
        m.cube(f"ear_{s}", eo, [1, 9, 4], ear_paint, pivot=[sx * 4, 31, 1], rot=[0, 0, -sx * 58])

    # horns: right = long swept arm, left = curl ending in spiral plate
    chain_xy(
        m, "horn_r", (3.0, 34.5, -2.5),
        [(4, 5, 5, 54), (5, 5, 5, -12), (5, 5, 5, -30), (4, 4, 4, -40)],
        side=1, paint=horn_paint,
    )
    chain_xy(
        m, "horn_l", (-3.0, 34.5, -2.5),
        [(5, 5, 5, 62), (4, 4, 4, -22)],
        side=-1, paint=horn_paint,
    )
    m.cube("horn_l", [-14.0, 40.0, -1], [10, 10, 2], spiral_paint)

    # arms (crossed in the rest pose), legs
    for s, sx in (("r", 1), ("l", -1)):
        ax = 5.0 if sx > 0 else -10.0
        m.cube(f"arm_{s}", [ax, 20, -2.5], [5, 6, 5], arm_paint)
        pd = 4.7 if sx > 0 else -10.7
        m.cube(f"arm_{s}", [pd, 24, -3], [6, 3, 6], pad_paint)
        m.cube(f"forearm_{s}", [ax, 13, -2.5], [5, 7, 5], arm_paint)
        m.cube(f"forearm_{s}", [ax, 13, -2.5], [5, 5, 5], bracer_paint, inflate=0.3)
        lx = 0.2 if sx > 0 else -5.8
        m.cube(f"leg_{s}", [lx, 9, -2.8], [5.6 if False else 6, 6, 6 if False else 6], thigh_paint)
        sx0 = 0.5 if sx > 0 else -5.5
        m.cube(f"shin_{s}", [sx0, 4, -2.5], [5, 5, 5], shin_paint)
        bx = 0.2 if sx > 0 else -6.2
        m.cube(f"shin_{s}", [bx, 0, -4], [6, 4, 7], boot_paint)

    # Azzinoth glaives: bone grip, leaf-green double crescent (hidden in the crossed-arms pose)
    for s, sx in (("r", 1), ("l", -1)):
        bone = f"glaive_{s}"
        cx = sx * 7.5
        z = -4 if sx > 0 else -5.5
        m.cube(bone, [cx - 1, 13.5, z + 1.5], [2, 2, 8], glaive_core_paint, tag="glaive")
        m.cube(bone, [cx - 2, 12.5, z - 1], [4, 4, 3], glaive_core_paint, tag="glaive")
        for side in (1, -1):
            chain_xy(
                m, bone, (cx + side * 2.0, 14.5, z - 0.3),
                [(9, 7, 1, 3), (9, 7, 1, 9), (8, 6, 1, 14)],
                side=side, factory=lambda i, side=side: glaive_blade_paint(i, side), tag="glaive",
            )
    m.pack()
    return m


POSES = {
    "crossed": {
        "arm_r": {"rot": [-23.7, 0, -37.7]},
        "arm_l": {"rot": [-28.2, 0, 38.8]},
        "forearm_r": {"rot": [-20.3, 0, -43.0]},
        "forearm_l": {"rot": [-24.1, 0, 33.9]},
        "body": {"rot": [3, 0, 0]},
    },
    "armed": {
        "arm_r": {"rot": [-30, 0, -6]},
        "arm_l": {"rot": [-30, 0, 6]},
        "forearm_r": {"rot": [-55, 0, 0]},
        "forearm_l": {"rot": [-55, 0, 0]},
    },
}

if __name__ == "__main__":
    import sys

    m = build()
    tex = m.texture()
    print("atlas height", m.used_height)
    out = sys.argv[1]
    row = Image.new("RGB", (4 * 480, 480), (255, 255, 255))
    for i, (yw, pi, pose, hide) in enumerate(
        [(10, 8, "crossed", ("glaive",)), (45, 8, "crossed", ("glaive",)), (180, 8, "armed", ()), (20, 8, "armed", ())]
    ):
        row.paste(m.render(tex, POSES[pose], yw, pi, size=480, hide=hide).convert("RGB"), (480 * i, 0))
    row.save(out)
