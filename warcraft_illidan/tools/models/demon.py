"""Illidan, demon form (purple): striped horn pillars, blindfold, long navy hair with red beads,
black swirl tattoos, grey belt + red/cream wraps, feathered wings with a hooked claw, skull warglaives."""
from common import *

SK = hexc("#7568a1")
SK_L = hexc("#9a8fb5")
SK_D = hexc("#5e5388")
SK_DD = hexc("#463f64")
BLK = hexc("#1e1e24")
NAVY = hexc("#27263d")
NAVY_D = hexc("#141625")
NAVY_L = hexc("#383a55")
CRM = hexc("#c4bf97")
CRM_L = hexc("#e6e1b8")
CRM_W = hexc("#f3f3e3")
RED = hexc("#720d0d")
RED_D = hexc("#520808")
RED_L = hexc("#8e1212")
GRY = hexc("#474351")
GRY_L = hexc("#5b585f")
GRY_D = hexc("#312f38")
HB1, HB2, HB3 = hexc("#1e1e1e"), hexc("#2f2f33"), hexc("#454449")
WG = [hexc(c) for c in ("#38314f", "#52497a", "#443d62", "#2d2842", "#222444")]
WG_EDGE = hexc("#15172c")
GREEN = hexc("#2fd24a")


def skin(c=SK, **kw):
    return shaded(c, **kw)


def tat(rows, x=0, y=0, faces=None):
    return art(rows, {"#": BLK}, x, y, faces)


# ---------------------------------------------------------------------------------------------- painters
def head_paint(face, w, h):
    im = skin(SK, bands=3)(face, w, h)
    d = ImageDraw.Draw(im)
    if face in SIDES:
        d.rectangle([0, 2, w - 1, 4], fill=BLK)  # blindfold wraps the head
        d.line([(0, 2), (w - 1, 2)], fill=hexc("#34343e"))
    if face == "north":
        d.point((3, 5), fill=SK_D)
        d.point((4, 5), fill=SK_D)
        d.line([(3, 6), (4, 6)], fill=SK_DD)
    return im


def hair_paint(face, w, h):
    im = gradient_v(NAVY_L, NAVY_D, bands=4, up=NAVY_L)(face, w, h)
    if face in ("north", "east", "west") and w >= 6 and h >= 2:
        d = ImageDraw.Draw(im)
        # fringe strands: small notched pattern on the lower edge
        for x in range(0, w, 2):
            d.point((x, h - 1), fill=(0, 0, 0, 0))
    return im


def strand_paint(face, w, h):
    return gradient_v(NAVY_L, NAVY_D, bands=4, up=NAVY_L)(face, w, h)


def ear_paint(face, w, h):
    return skin(SK_L, bands=3, top=1.08, bottom=0.82)(face, w, h)


def pillar_paint(face, w, h):
    if face in ("up", "down"):
        return solid(HB3 if face == "up" else HB1, w, h)
    # rows top->bottom of the 13px pillar
    pat = [HB3, HB2, HB1, HB1, HB3, HB2, HB1, CRM, CRM_L, CRM, HB1, HB3, HB2]
    pat = (pat * 3)[:h]
    if h >= 13:
        pat = [HB2, HB1, HB3, HB2, HB1, HB1, HB3, HB2, CRM, CRM_L, CRM, HB1, HB2, HB3, HB1, CRM, CRM_L, CRM, HB1, HB2][:h]
    im = Image.new("RGBA", (w, h))
    d = ImageDraw.Draw(im)
    for y in range(h):
        d.line([(0, y), (w - 1, y)], fill=pat[y])
    if face in ("east", "south"):
        d.line([(w - 1, 0), (w - 1, h - 1)], fill=(0, 0, 0, 90))
    return im


def horn_cap_paint(face, w, h):
    if face in ("up", "down"):
        return solid(HB3 if face == "up" else HB1, w, h)
    pat = [HB3, HB2, HB1, HB1, HB3, HB2, HB1, HB1, HB3]
    im = Image.new("RGBA", (w, h))
    d = ImageDraw.Draw(im)
    for y in range(h):
        d.line([(0, y), (w - 1, y)], fill=pat[y % len(pat)])
    return im


CHEST_FRONT = [
    "..##.......##.",
    ".#..#.####.#..",
    ".#.##.#..#.#..",
    ".#.#..#.##.#.#",
    "..##..#.#...##",
    "......##......",
]
CHEST_BACK = [
    "##..........##",
    "#.#.######.#.#",
    "#.#.#....#.#..",
    "..#.#.##.#.#..",
    ".##...##...##.",
    "....###.......",
]
SHOULDER = [
    "####.",
    "#..#.",
    "#.##.",
    "#....",
]


def chest_paint(face, w, h):
    f = layer(skin(SK, bands=4), tat(CHEST_FRONT, 0, 1, "north"), tat(CHEST_BACK, 0, 1, "south"))
    im = f(face, w, h)
    d = ImageDraw.Draw(im)
    if face in ("north", "south"):
        d.line([(w // 2 - 1, h - 3), (w // 2, h - 3)], fill=SK_L)  # pec highlight
        d.rectangle([0, h - 2, w - 1, h - 1], fill=SK_D)
    return im


def abdomen_paint(face, w, h):
    return layer(skin(SK_D, bands=3, top=1.1, bottom=0.85), edge(SK_DD, ("bottom",)))(face, w, h)


def belt_paint(face, w, h):
    base = skin(GRY, bands=3, top=1.1, bottom=0.8)
    spec = layer(
        base,
        edge(CRM, ("top", "bottom")),
        only("north", lambda f, im, w, h: ImageDraw.Draw(im).rectangle([w // 2 - 1, 0, w // 2, h - 1], fill=CRM)),
    )
    return spec(face, w, h)


def cloth_paint(face, w, h):
    # red hanging cloth: dark red body, cream trim top/bottom, vertical cream centre stripe
    base = gradient_v(RED_L, RED_D, bands=4, up=RED, down=RED_D)
    spec = layer(
        base,
        sides_only(lambda f, im, w, h: ImageDraw.Draw(im).rectangle([0, h - 2, w - 1, h - 1], fill=CRM)),
        sides_only(lambda f, im, w, h: ImageDraw.Draw(im).rectangle([0, 0, w - 1, 1], fill=CRM)),
        only(("north", "south"), lambda f, im, w, h: ImageDraw.Draw(im).line([(w // 2, 2), (w // 2, h - 3)], fill=CRM)),
        only(("north", "south"), lambda f, im, w, h: ImageDraw.Draw(im).line([(w // 2 - 1, 2), (w // 2 - 1, h - 3)], fill=RED_D)),
    )
    return spec(face, w, h)


def plate_paint(face, w, h):
    return layer(skin(GRY_L, bands=3), edge(CRM, ("top",)), edge(GRY_D, ("bottom",)))(face, w, h)


ARM_TAT = [
    "..#.",
    ".##.",
    ".#..",
    "##..",
    "#...",
]


def arm_paint(face, w, h):
    f = layer(skin(SK, bands=4), tat(ARM_TAT, 0, 2, ("north", "east", "west")))
    return f(face, w, h)


def forearm_paint(face, w, h):
    return layer(skin(SK_D, bands=3), edge(RED, ("bottom",), width=0))(face, w, h)


def bracer_paint(face, w, h):
    return layer(
        skin(GRY, bands=3, top=1.1, bottom=0.82),
        edge(CRM, ("top", "bottom")),
        hbands([(1, CRM), (1, GRY), (1, RED)], margin=1),
    )(face, w, h)


def sash_paint(face, w, h):
    return layer(gradient_v(RED_L, RED_D, bands=3), edge(CRM, ("top",)))(face, w, h)


def thigh_paint(face, w, h):
    return layer(skin(GRY, bands=3, top=1.12, bottom=0.82), edge(CRM, ("top",)))(face, w, h)


def shin_paint(face, w, h):
    # grey, cream, red, red, blue pinstripe, red, cream (the wraps from the reference)
    spec = hbands([(1, GRY_L), (1, CRM), (2, RED_L), (2, RED), (1, hexc("#34406b")), (1, RED_D), (1, CRM), (-1, GRY)])
    base = skin(RED, bands=2)
    return layer(base, spec)(face, w, h)


def boot_paint(face, w, h):
    return layer(skin(hexc("#26252b"), bands=3, top=1.2, bottom=0.8), edge(CRM, ("top",)))(face, w, h)


# ---- wings ---------------------------------------------------------------------------------------------
def feather_paint(idx, length):
    cols = [WG[0], WG[2], WG[1], WG[2], WG[0], WG[3]]

    def f(face, w, h):
        if face in ("up", "down"):
            return solid(WG_EDGE, w, h)
        im = Image.new("RGBA", (w, h))
        px = im.load()
        for y in range(h):
            for x in range(w):
                # long diagonal streaks: the stripe index drifts slowly with y
                k = (x + y // 7 + idx) // 2
                col = cols[k % len(cols)]
                shade = 1.10 - 0.30 * y / max(1, h - 1)
                px[x, y] = lit(col, shade)
            px[0, y] = WG_EDGE
            if w > 2:
                px[w - 1, y] = lit(WG_EDGE, 1.3)
        # stair-stepped ragged tip with a dark navy outline row
        for x in range(w):
            depth = (x * 2 + idx) % 6 + 1
            for y in range(h - 1 - depth, h):
                if y >= 0:
                    px[x, y] = (0, 0, 0, 0)
            if h - 2 - depth >= 0:
                px[x, h - 2 - depth] = WG_EDGE
        return im

    return f


def bar_paint(face, w, h):
    return layer(skin(SK, bands=4, top=1.15, bottom=0.8), edge(SK_D, ("right",)))(face, w, h)


def claw_paint(face, w, h):
    return solid(hexc("#2a2a30"), w, h)


# ---- glaive ----------------------------------------------------------------------------------------------
def skull_paint(face, w, h):
    im = layer(skin(CRM, bands=3, top=1.1, bottom=0.82), edge(CRM_W, ("top",)))(face, w, h)
    if face == "north":
        art(
            [
                ".....",
                ".#.#.",
                ".G#..",
                "..#..",
                ".#.#.",
            ],
            {"#": hexc("#1a120c"), "G": GREEN},
            0,
            0,
        )("north", im, w, h)
        d = ImageDraw.Draw(im)
        d.rectangle([0, 1, 0, 2], fill=lit(CRM, 0.8))
    return im


PAD_TOP = [
    "###...",
    "#.....",
    "###...",
    "..#...",
    "###...",
]


def pad_paint(face, w, h):
    return layer(skin(SK, bands=3, top=1.12), tat(PAD_TOP, 0, 0, "up"), edge(BLK, ("bottom",), faces=("north", "south", "east", "west")))(face, w, h)


def blade_paint(i, side):
    def f(face, w, h):
        if face in ("up",):
            return solid(CRM, w, h)
        if face == "down":
            return solid(CRM_W, w, h)
        im = Image.new("RGBA", (w, h))
        px = im.load()
        for y in range(h):
            for x in range(w):
                px[x, y] = RED_L if y == 1 else (RED if y == 0 else RED_D)
        for x in range(w):
            px[x, 0] = CRM_L  # upper (cutting) edge
        # white serrated underside
        for x in range(w):
            if (x + i) % 2 == 0 and h >= 3:
                px[x, h - 1] = CRM_W
            elif h >= 3:
                px[x, h - 1] = (0, 0, 0, 0)
        return im

    return f


def build():
    m = Model("illidan_demon", 256, 128, bounds=(8, 6, (0, 2.2, 0)), fit=True)
    B = m.bone
    LEG = 22  # hip height
    B("root", None, (0, 0, 0))
    B("body", "root", (0, 25, 0))
    B("head", "body", (0, 36, 0))
    B("hair_back", "head", (0, 42, 4))
    B("strand_r", "head", (5, 41, -5))
    B("strand_l", "head", (-5, 41, -5))
    B("ear_r", "head", (4, 41, 0))
    B("ear_l", "head", (-4, 41, 0))
    B("horn_r", "head", (5, 41, 0))
    B("horn_l", "head", (-5, 41, 0))
    for s, sx in (("r", 1), ("l", -1)):
        B(f"arm_{s}", "body", (sx * 11, 35, 0))
        B(f"forearm_{s}", f"arm_{s}", (sx * 11, 28, 0))
        B(f"glaive_{s}", f"forearm_{s}", (sx * 11, 21, -4))
        B(f"leg_{s}", "root", (sx * 3.5, LEG, 0))
        B(f"shin_{s}", f"leg_{s}", (sx * 3.5, 13, 0))
        B(f"wing_{s}", "body", (sx * 4, 34, 6), rot=[4, sx * 14, 0])
    B("loin", "body", (0, 22, -5))
    B("tail_cloth", "body", (0, 22, 5))

    # ---- torso
    m.cube("body", [-5.5, 25, -3.5], [11, 3, 7], abdomen_paint)
    m.cube("body", [-8, 28, -4], [16, 8, 8], chest_paint)
    m.cube("body", [-8, 22, -4.5], [16, 3, 9], belt_paint)
    m.cube("body", [-9.4, 18, -3.5], [2, 6, 7], plate_paint)  # side hip plates
    m.cube("body", [7.4, 18, -3.5], [2, 6, 7], plate_paint)
    m.cube("loin", [-2, 12, -5.4], [4, 10, 1], cloth_paint)  # narrow belt tassel
    m.cube("tail_cloth", [-3, 11, 4.4], [6, 11, 1], cloth_paint)

    # ---- head
    m.cube("head", [-4, 36, -4], [8, 8, 8], head_paint)
    m.cube("head", [-4, 41.5, -4], [8, 3, 8], hair_paint, inflate=0.4)
    m.cube("hair_back", [-5.5, 25, 4], [11, 19, 3], hair_paint)
    m.cube("hair_back", [4.0, 33, 0], [3, 11, 5], hair_paint, uvkey="hair_side_r")
    m.cube("hair_back", [-7.0, 33, 0], [3, 11, 5], hair_paint, uvkey="hair_side_l")
    ring = layer(skin(BLK, bands=2, top=1.4, bottom=1.0), edge(hexc("#26262e"), ("top",)))
    m.cube("head", [-4, 39, -4], [8, 3, 8], ring, inflate=0.35)  # blindfold, proud of the skull
    for s, sx in (("r", 1), ("l", -1)):
        xo = 4.0 if sx > 0 else -6.0
        m.cube(f"strand_{s}", [xo, 31, -6.2], [2, 11, 2], strand_paint)
        m.cube(f"strand_{s}", [xo, 29, -6.2], [2, 2, 2], skin(RED_L, bands=2))
        # tall pointed ears behind the face
        eo = [4.0, 41, -1] if sx > 0 else [-5.0, 41, -1]
        m.cube(f"ear_{s}", eo, [1, 11, 4], ear_paint, pivot=[sx * 4, 41, 0], rot=[0, 0, -sx * 24])
        # striped horn pillar + overhanging cap (L shape)
        pillar = [2.0, 40, -3] if sx > 0 else [-8.0, 40, -3]
        m.cube(f"horn_{s}", pillar, [6, 16, 6], pillar_paint)
        cap = [2.0, 56, -3] if sx > 0 else [-11.0, 56, -3]
        m.cube(f"horn_{s}", cap, [9, 6, 6], horn_cap_paint)

    # ---- arms / legs
    for s, sx in (("r", 1), ("l", -1)):
        ax = 8.0 if sx > 0 else -14.0
        m.cube(f"arm_{s}", [ax, 28, -3], [6, 8, 6], arm_paint)
        px = 7.5 if sx > 0 else -14.5
        m.cube(f"arm_{s}", [px, 35, -3.5], [7, 3, 7], pad_paint)
        m.cube(f"forearm_{s}", [ax, 20, -3], [6, 8, 6], forearm_paint)
        m.cube(f"forearm_{s}", [ax, 20, -3], [6, 5, 6], bracer_paint, inflate=0.3)
        m.cube(f"forearm_{s}", [ax, 25.2, -3], [6, 1, 6], sash_paint, inflate=0.45)
        lx = 0.5 if sx > 0 else -6.5
        m.cube(f"leg_{s}", [lx, 13, -3], [6, 9, 6], thigh_paint)
        sx0 = 1 if sx > 0 else -6
        m.cube(f"shin_{s}", [sx0, 4, -2.5], [5, 9, 5], shin_paint)
        bx = 0.5 if sx > 0 else -6.5
        m.cube(f"shin_{s}", [bx, 0, -4.5], [6, 4, 8], boot_paint)

    # ---- wings: leading bar + fan of long feathers + hooked claw
    for s, sx in (("r", 1), ("l", -1)):
        bone = f"wing_{s}"
        pv = [sx * 4, 34, 6]
        bar_len = 38
        ang = -sx * 33
        m.cube(bone, [sx * 4 - 1.5, 34, 6], [3, bar_len, 2], bar_paint, pivot=pv, rot=[0, 0, ang])
        angles = [40, 50, 60, 70, 80, 90, 100, 110, 120]
        lens = [37, 39, 41, 42, 42, 41, 39, 36, 33]
        for i, (a, ln) in enumerate(zip(angles, lens)):
            m.cube(bone, [sx * 4 - 4.5, 34, 6.5 + i * 0.1], [9, ln, 1], feather_paint(i, ln), pivot=pv, rot=[0, 0, -sx * a])
        top = [sx * 4 - 0.5, 34 + bar_len, 6.5]
        m.cube(bone, top, [1, 4, 1], claw_paint, pivot=pv, rot=[0, 0, ang])
        m.cube(bone, [top[0] + (1 if sx > 0 else -3), top[1] + 3, top[2]], [3, 1, 1], claw_paint, pivot=pv, rot=[0, 0, ang])

    # ---- warglaives: skull guard + curved red/cream blades both ways
    for s, sx in (("r", 1), ("l", -1)):
        bone = f"glaive_{s}"
        cx = sx * 11
        z = -4 if sx > 0 else -6.5
        m.cube(bone, [cx - 1, 20.5, z + 2], [2, 3, 6], skin(CRM, bands=2))
        m.cube(bone, [cx - 2.5, 19.5, z - 1.5], [5, 5, 3], skull_paint)
        for side in (1, -1):
            chain_xy(
                m,
                bone,
                (cx + side * 2.5, 22.0, z - 0.6),
                [(5, 6, 1, 3), (5, 6, 1, 14), (4, 5, 1, 22)],
                side=side,
                factory=lambda i, side=side: blade_paint(i, side),
            )

    m.pack()
    return m


# --------------------------------------------------------------------------------------------- poses
POSES = {
    "stand": {
        "arm_r": {"rot": [0, 0, -4]},
        "arm_l": {"rot": [0, 0, 4]},
        "forearm_r": {"rot": [-18, 0, 0]},
        "forearm_l": {"rot": [-18, 0, 0]},
    },
}

if __name__ == "__main__":
    import sys

    m = build()
    tex = m.texture()
    print("used atlas height", m.used_height)
    out = sys.argv[1] if len(sys.argv) > 1 else "/tmp/demon.png"
    row = Image.new("RGB", (4 * 480, 480), (255, 255, 255))
    for i, (yw, pi) in enumerate([(0, 8), (35, 8), (90, 8), (180, 8)]):
        row.paste(m.render(tex, POSES["stand"], yw, pi, size=480).convert("RGB"), (480 * i, 0))
    row.save(out)
    tex.save(out.replace(".png", "_tex.png"))
