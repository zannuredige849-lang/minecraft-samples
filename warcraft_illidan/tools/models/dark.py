"""Illidan, dark demon form: obsidian skin with glowing green runes, horn arc + spiral plate,
spiky hair, wings that crumble into pixels."""
import random

from common import *

OB = hexc("#3a2548")
OB_L = hexc("#4a3358")
OB_LL = hexc("#5c4270")
OB_D = hexc("#2c1a38")
OB_DD = hexc("#1d1126")
GR = hexc("#20d62a")
GR_L = hexc("#7dff86")
GR_D = hexc("#12801a")
HORN = hexc("#3a2748")
HORN_L = hexc("#5b4470")
EYE = hexc("#7dff86")

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


def obsidian(c=OB, k=0.07, facet=3):
    """banded stone-like block: a few deliberate 3px facets, no per-pixel noise"""
    base = shaded(c, bands=3, top=1.12, bottom=0.82)

    def f(face, w, h):
        im = base(face, w, h)
        d = ImageDraw.Draw(im)
        for by in range(0, h, facet):
            for bx in range(0, w, facet):
                v = ((bx * 7 + by * 13 + w * 3 + h) % 5)
                if v == 0:
                    d.rectangle([bx, by, min(w - 1, bx + facet - 1), min(h - 1, by + facet - 1)], fill=lit(c, 1.10))
                elif v == 1:
                    d.rectangle([bx, by, min(w - 1, bx + facet - 1), min(h - 1, by + facet - 1)], fill=lit(c, 0.88))
        return im

    return f


def rune(rows, x=0, y=0, faces=None):
    return art(rows, {"G": GR, "g": GR_L, "d": GR_D}, x, y, faces)


CHEST_RUNES = [
    "..gg........gg..",
    ".dGGd......dGGd.",
    "..GG..G..G..GG..",
    ".......GG.......",
    "....G.GGGG.G....",
    ".....G.GG.G.....",
    "......GGGG......",
]
BACK_RUNES = [
    "..G.G....G.G....",
    "..GGG....GGG....",
    "...G..GG..G.....",
    "..G..GGGG..G....",
    ".....G..G.......",
]


def torso_paint(face, w, h):
    f = layer(obsidian(OB), rune(CHEST_RUNES, 0, 1, "north"), rune(BACK_RUNES, 0, 1, "south"))
    return f(face, w, h)


def belt_paint(face, w, h):
    return layer(obsidian(OB_D), only(SIDES, lambda f, im, w, h: ImageDraw.Draw(im).rectangle([0, 1, w - 1, 1], fill=GR)))(face, w, h)


def arm_paint(face, w, h):
    return layer(
        obsidian(OB),
        only(("north", "south", "east", "west"), lambda f, im, w, h: ImageDraw.Draw(im).rectangle([0, 3, w - 1, 3], fill=GR)),
    )(face, w, h)


def pad_paint(face, w, h):
    def orb(f, im, w, h):
        d = ImageDraw.Draw(im)
        cx, cy = w // 2, h // 2
        d.rectangle([cx - 1, cy - 1, cx, cy], fill=GR)
        d.point((cx - 2, cy), fill=GR_D)
        d.point((cx + 1, cy - 2), fill=GR_L)

    return layer(obsidian(OB_L), only(("north", "up", "east", "west"), orb))(face, w, h)


def head_paint(face, w, h):
    im = obsidian(OB_L)(face, w, h)
    d = ImageDraw.Draw(im)
    if face in SIDES:
        d.rectangle([0, 2, w - 1, 4], fill=OB_DD)
    if face == "north":
        d.rectangle([1, 3, 2, 3], fill=EYE)
        d.rectangle([5, 3, 6, 3], fill=EYE)
        d.line([(3, 6), (4, 6)], fill=OB_D)
    return im


def hair_paint(face, w, h):
    return layer(obsidian(OB_D))(face, w, h)


def horn_paint(i=0):
    def f(face, w, h):
        im = obsidian(HORN, facet=4)(face, w, h)
        d = ImageDraw.Draw(im)
        if face in SIDES and h >= 4:
            for y in range(1, h, 3):
                d.line([(0, y), (w - 1, y)], fill=HORN_L)
        return im

    return f


def spiral_paint(face, w, h):
    im = obsidian(HORN, facet=4)(face, w, h)
    if face in ("north", "south"):
        px = im.load()
        for j, row in enumerate(SPIRAL):
            for i, ch in enumerate(row):
                if ch == "." and i < w and j < h:
                    px[i, j] = (0, 0, 0, 0)
    return im


def wing_paint(idx, ln, solid_core=True):
    def f(face, w, h):
        if face in ("up", "down"):
            return solid(OB_D, w, h)
        im = Image.new("RGBA", (w, h))
        px = im.load()
        for y in range(h):
            for x in range(w):
                col = [OB, OB_L, OB_D, OB_L, OB][(x + y // 6 + idx) % 5]
                px[x, y] = lit(col, 1.12 - 0.3 * y / max(1, h - 1))
            px[0, y] = OB_DD
        # crumbling lower end: ragged and dithered
        for x in range(w):
            depth = (x * 3 + idx * 2) % 7 + 3
            for y in range(max(0, h - depth - 6), h):
                if y > h - depth or ((x + y + idx) % 2 == 0 and y > h - depth - 6):
                    px[x, y] = (0, 0, 0, 0)
        return im

    return f


def scrap_paint(face, w, h):
    return solid(OB_L, w, h)


def build():
    m = Model("illidan_demon_dark", 256, 128, bounds=(8, 6, (0, 2.2, 0)), fit=True)
    B = m.bone
    LEG = 22
    B("root", None, (0, 0, 0))
    B("body", "root", (0, 25, 0))
    B("head", "body", (0, 36, 0))
    B("hair_back", "head", (0, 42, 4))
    B("ear_r", "head", (4, 41, 0))
    B("ear_l", "head", (-4, 41, 0))
    B("horn_r", "head", (3, 43, 0))
    B("horn_l", "head", (-3, 43, 0))
    B("tail", "body", (0, 26, 4))
    for s, sx in (("r", 1), ("l", -1)):
        B(f"arm_{s}", "body", (sx * 11, 35, 0))
        B(f"forearm_{s}", f"arm_{s}", (sx * 11, 28, 0))
        B(f"leg_{s}", "root", (sx * 3.5, LEG, 0))
        B(f"shin_{s}", f"leg_{s}", (sx * 3.5, 13, 0))
        B(f"wing_{s}", "body", (sx * 4, 34, 6), rot=[4, sx * 14, 0])

    # torso
    m.cube("body", [-5.5, 25, -3.5], [11, 3, 7], obsidian(OB_D))
    m.cube("body", [-8, 28, -4], [16, 8, 8], torso_paint)
    m.cube("body", [-8, 22, -4.5], [16, 3, 9], belt_paint)
    m.cube("body", [-5, 14, -4.9], [10, 8, 1], obsidian(OB_L))  # front tasset
    m.cube("body", [-5, 14, 3.9], [10, 8, 1], obsidian(OB_L))
    # head
    m.cube("head", [-4, 36, -4], [8, 8, 8], head_paint)
    m.cube("head", [-4, 41, -4], [8, 3, 8], hair_paint, inflate=0.4)
    m.cube("hair_back", [-4.5, 30, 4], [9, 13, 2], hair_paint)
    # spiky hair: tufts raking back and up
    rng = random.Random(7)
    for i, (x, y, tilt) in enumerate([(-3, 43, 50), (0, 44, 40), (3, 43, 50), (-1.5, 42, 70), (1.5, 42, 70)]):
        m.cube("head", [x - 1, y, 3], [2, 2, 7], hair_paint, pivot=[x, y, 3], rot=[tilt, 0, 0], uvkey="spike")
    for s, sx in (("r", 1), ("l", -1)):
        eo = [4.0, 41, -1] if sx > 0 else [-5.0, 41, -1]
        m.cube(f"ear_{s}", eo, [1, 10, 4], obsidian(OB_LL), pivot=[sx * 4, 41, 0], rot=[0, 0, -sx * 24])

    # horns: character's right = long swept arm; left = rising curl ending in a spiral plate
    chain_xy(
        m, "horn_r", (3.0, 43, -2),
        [(6, 7, 7, 58), (8, 7, 7, -14), (8, 6, 7, -30), (7, 6, 6, -42)],
        side=1, paint=horn_paint(),
    )
    chain_xy(
        m, "horn_l", (-3.0, 43, -2),
        [(6, 7, 7, 66), (6, 6, 6, -22)],
        side=-1, paint=horn_paint(),
    )
    m.cube("horn_l", [-17.0, 47.0, -1], [10, 10, 3], spiral_paint)

    # arms, legs
    for s, sx in (("r", 1), ("l", -1)):
        ax = 8.0 if sx > 0 else -14.0
        m.cube(f"arm_{s}", [ax, 28, -3], [6, 8, 6], arm_paint)
        px = 7.5 if sx > 0 else -14.5
        m.cube(f"arm_{s}", [px, 35, -3.5], [7, 4, 7], pad_paint)
        m.cube(f"forearm_{s}", [ax, 20, -3], [6, 8, 6], arm_paint)
        m.cube(f"forearm_{s}", [ax, 20, -3], [6, 3, 6], obsidian(OB_D), inflate=0.3)
        lx = 0.5 if sx > 0 else -6.5
        m.cube(f"leg_{s}", [lx, 13, -3], [6, 9, 6], obsidian(OB))
        sx0 = 1 if sx > 0 else -6
        m.cube(f"shin_{s}", [sx0, 4, -2.5], [5, 9, 5], obsidian(OB_D))
        bx = 0.5 if sx > 0 else -6.5
        m.cube(f"shin_{s}", [bx, 0, -4.5], [6, 4, 8], obsidian(OB_DD))
    # hip rune band
    m.cube("body", [-8, 21, -4.5], [16, 1, 9], layer(obsidian(OB_D), only(SIDES, lambda f, im, w, h: ImageDraw.Draw(im).rectangle([0, 0, w - 1, 0], fill=GR))), inflate=0.1)
    m.cube("tail", [-1, 14, 3.5], [2, 12, 2], obsidian(OB_D), pivot=[0, 26, 4], rot=[-30, 0, 0])

    # wings: solid bone-like core + dissolving pixel cloud
    for s, sx in (("r", 1), ("l", -1)):
        bone = f"wing_{s}"
        pv = [sx * 4, 34, 6]
        m.cube(bone, [sx * 4 - 1.5, 34, 6], [3, 36, 2], obsidian(OB_LL), pivot=pv, rot=[0, 0, -sx * 33])
        for i, (a, ln) in enumerate(zip([40, 50, 60, 70, 80, 90, 100, 110], [40, 42, 42, 40, 38, 36, 33, 30])):
            m.cube(bone, [sx * 4 - 4.5, 34, 6.5 + i * 0.1], [9, ln, 1], wing_paint(i, ln), pivot=pv, rot=[0, 0, -sx * a])
        # pixel cloud beyond the solid part
        rr = random.Random(11 + sx)
        for k in range(110):
            a = math.radians(rr.uniform(36, 100))
            r = rr.uniform(34, 58)
            if rr.random() < (r - 34) / 30 * 0.6:
                continue
            size = rr.choice([2, 2, 3, 3, 4])
            x = sx * 4 + sx * math.sin(a) * r
            y = 34 + math.cos(a) * r
            m.cube(bone, [x - size / 2, y - size / 2, 6.3], [size, size, 1], scrap_paint, uvkey=f"scrap{size}")
    m.pack()
    return m


POSES = {
    "stand": {
        "arm_r": {"rot": [0, 0, -3]},
        "arm_l": {"rot": [0, 0, 3]},
        "forearm_r": {"rot": [-10, 0, 0]},
        "forearm_l": {"rot": [-10, 0, 0]},
    }
}

if __name__ == "__main__":
    import sys

    m = build()
    tex = m.texture()
    print("atlas height", m.used_height)
    out = sys.argv[1]
    row = Image.new("RGB", (4 * 480, 480), (255, 255, 255))
    for i, (yw, pi) in enumerate([(0, 8), (35, 8), (90, 8), (180, 8)]):
        row.paste(m.render(tex, POSES["stand"], yw, pi, size=480).convert("RGB"), (480 * i, 0))
    row.save(out)
