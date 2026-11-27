"""Bears and the Ent."""
from .common import *


def grizzly_bear():
    from .vanilla_mobs import grizzly
    p = pal(skin="#6a4a2e", fur="#6a4a2e", dark="#1c140e", belly="#8a6a44", bone="#e6dcc0", glow="#ffb050", claw="#d8d0b8")
    return Spec(grizzly("geometry.grizzly_bear", p), rig="quad", heavy=1.4)


def grizzly_bear_old():
    p = pal(skin="#6a4a2e", fur="#6a4a2e", dark="#1c140e", belly="#8a6a44", bone="#e6dcc0", glow="#ffb050", claw="#d8d0b8")
    q = Quad("geometry.grizzly_bear", p, L=30, W=16, Hb=15, leg=13, lt=7, hl=11, hw=10, hh=9)
    q.base(body="fur", bstyle="fur", paws="dark", belly="belly", legs="fur")
    q.head_box(M("fur", "fur", 3.0), snout=4, snout_mat=M("belly", "fur", 3.3), ears="fur", ear_size=3, eyes="glow", fangs="bone")
    q.hump("fur", h=5)
    q.tail("fur", length=3, thick=4, up=3)
    for nm, sx, sz in (("leg_fl", 1, -1), ("leg_fr", -1, -1)):
        x = (q.W / 2 - q.lt) if sx > 0 else -q.W / 2
        for k in range(3):
            q.box(nm, (x + 1 + k * 2 - 0.5, 0, -q.L / 2 - 2), (1, 1, 2), M("claw", "bone", 3.6))
    return Spec(q, rig="quad", heavy=1.4)


def _ent_pal(trunk, leaf, glow="#c8ff60", leaf2=None):
    return pal(armor=trunk, skin=trunk, wood=trunk, leaf=leaf, leaf2=leaf2 or leaf, glow=glow, dark="#140c06", bone="#e6dcc0", cloth=trunk, trim=leaf)


# Every vanilla tree. Index = minecraft:variant value (0-5 are the original six, keep their order).
# bark/top/inner/leaves are real vanilla block textures (tools/data/vanilla/blocks); tint = vanilla default foliage colour
# for the grey leaf textures (oak/birch/spruce/jungle/acacia/dark oak/mangrove), None for leaves that carry their own colour.
ENT_VARIANTS = {
    "oak": dict(trunk="#6a4a2a", leaf="#4aa83a", glow="#c8ff60", bark="log_oak", top="log_oak_top", inner="stripped_oak_log", leaves="leaves_oak_opaque", tint="#77ab2f"),
    "birch": dict(trunk="#d8d4c4", leaf="#8ac848", glow="#e8ffa0", bark="log_birch", top="log_birch_top", inner="stripped_birch_log", leaves="leaves_birch_opaque", tint="#80a755"),
    "spruce": dict(trunk="#3e2a18", leaf="#2a6a3a", glow="#a0ffc0", bark="log_spruce", top="log_spruce_top", inner="stripped_spruce_log", leaves="leaves_spruce_opaque", tint="#619961"),
    "cherry": dict(trunk="#5a3a30", leaf="#f0a0c8", glow="#ffd0e8", bark="cherry_log_side", top="cherry_log_top", inner="stripped_cherry_log_side", leaves="cherry_leaves_opaque", tint=None),
    "crimson": dict(trunk="#5a2030", leaf="#b02840", glow="#ff8080", bark="crimson_log_side", top="crimson_log_top", inner="stripped_crimson_stem_side", leaves="nether_wart_block", tint=None),
    "warped": dict(trunk="#1c5a5a", leaf="#20b0a0", glow="#80fff0", bark="warped_stem_side", top="warped_stem_top", inner="stripped_warped_stem_side", leaves="warped_wart_block", tint=None),
    "jungle": dict(trunk="#5a4220", leaf="#30a020", glow="#d0ff70", bark="log_jungle", top="log_jungle_top", inner="stripped_jungle_log", leaves="leaves_jungle_opaque", tint="#30bb0b"),
    "acacia": dict(trunk="#5a5450", leaf="#9a9a30", glow="#ffe080", bark="log_acacia", top="log_acacia_top", inner="stripped_acacia_log", leaves="leaves_acacia_opaque", tint="#aea42a"),
    "dark_oak": dict(trunk="#3a2a18", leaf="#3a8a28", glow="#b0ff60", bark="log_big_oak", top="log_big_oak_top", inner="stripped_dark_oak_log", leaves="leaves_big_oak_opaque", tint="#59ae30"),
    "mangrove": dict(trunk="#4a3a2a", leaf="#7ab030", glow="#e0ff80", bark="mangrove_log_side", top="mangrove_log_top", inner="stripped_mangrove_log_side", leaves="mangrove_leaves_opaque", tint="#8db127"),
    "pale_oak": dict(trunk="#4a4440", leaf="#8a9088", glow="#ff9a40", bark="pale_oak_log_side", top="pale_oak_log_top", inner="stripped_pale_oak_log_side", leaves="pale_oak_leaves_opaque", tint=None),
    "azalea": dict(trunk="#6a4a2a", leaf="#6a8a30", glow="#ff9ad8", bark="log_oak", top="log_oak_top", inner="stripped_oak_log", leaves=("azalea_leaves_opaque", "azalea_leaves_flowers_opaque"), tint=None),
    "poplar": dict(trunk="#8a8478", leaf="#e09030", glow="#ffd060", bark="poplar_log_side", top="poplar_log_top", inner="stripped_poplar_log_side", leaves=("yellow_poplar_leaves_opaque", "orange_poplar_leaves_opaque", "red_poplar_leaves_opaque"), tint=None),
}


def vanillaize_ent(m, variant):
    """Swap the generated wood/leaf materials for the real vanilla textures of this tree (same equality pattern for
    every variant, so all variants share one UV layout / geometry)."""
    v = ENT_VARIANTS[variant]
    for bn, b in m.bones.items():
        for c in b["cubes"]:
            st = c.mat.get("style")
            if st == "wood":
                face = "head" in bn and c.mat.get("decals")          # the carved face: stripped (inner) wood
                c.mat = dict(c.mat, vtex=v["inner"] if face else v["bark"], vtop=v["inner"] if face else v["top"])
            elif st == "leaf":
                c.mat = dict(c.mat, vtex=v["leaves"], vtint=v["tint"])


def big_ent(variant="oak"):
    v = ENT_VARIANTS[variant]
    p = _ent_pal(v["trunk"], v["leaf"], v["glow"])
    H = target_h("warcraft:big_ent")
    m = Humanoid("geometry.big_ent", p, H=H * 0.86, w=1.5, hs=12, th=24, lh=16, tw=18, td=14, arm_h=26, aw=7)
    m.base(armor="wood", cloth="wood", trim="wood", torso_style="wood", arm_style="wood", leg_style="wood", boots=False, gauntlets=False, sleeves_slot="wood")
    tw, td, lh, th = m.tw, m.td, m.lh, m.th
    # roots (feet)
    for nm, sgn in ((m.leg_l, 1), (m.leg_r, -1)):
        for k in range(3):
            m.box(nm, (sgn * 2.5 - 3 + (k - 1) * 3, 0, -4 + k * 3), (3, 3, 6), M("wood", "wood", 2.4))
    # face
    m.head_box(dec(M("wood", "wood", 3.0), ("north", "eyes", "glow", 5), ("north", "mouth", 2)))
    # bark ridges
    for i in range(3):
        m.box(m.body, (-tw / 2 - 1, lh + 3 + i * 7, -td / 2 + 2 + i), (2, 4, 6), M("wood", "wood", 2.6))
        m.box(m.body, (tw / 2 - 1, lh + 6 + i * 6, -td / 2 + 1), (2, 4, 7), M("wood", "wood", 2.6))
    # leaves: crown + shoulders + arm foliage
    hs = m.hs
    m.box(m.head, (-hs / 2 - 8, m.sh + hs - 3, -hs / 2 - 8), (hs + 16, 5, hs + 16), M("leaf", "leaf", 2.8))
    m.box(m.head, (-hs / 2 - 6, m.sh + hs + 2, -hs / 2 - 6), (hs + 12, 5, hs + 12), M("leaf", "leaf", 3.2))
    m.box(m.head, (-hs / 2 - 3, m.sh + hs + 7, -hs / 2 - 3), (hs + 6, 4, hs + 6), M("leaf", "leaf", 3.6))
    for nm, sgn in ((m.arm_l, 1), (m.arm_r, -1)):
        ox = sgn * (m.acx) - 5
        m.box(nm, (ox, m.sh - 2, -5), (10, 4, 10), M("leaf", "leaf", 3.0))
        m.box(nm, (ox + 1, m.hand_y - 4, -4), (8, 5, 8), M("leaf", "leaf", 2.8))
    m.box(m.body, (-tw / 2 - 2, m.sh - 3, -td / 2 - 2), (tw + 4, 3, td + 4), M("leaf", "leaf", 2.8))
    return Spec(m, armed=False, heavy=1.6)


def skeleton_bear():
    from .vanilla_mobs import skeleton_bear as _sk
    p = pal(skin="#d8d0b8", fur="#4a3a2e", bone="#d8d0b8", dark="#14100c", glow="#ff4030", claw="#e8e0c8")
    return Spec(_sk("geometry.skeleton_bear", p), rig="quad", heavy=1.3)


def skeleton_bear_old():
    p = pal(skin="#d8d0b8", fur="#4a3a2e", bone="#d8d0b8", dark="#14100c", glow="#ff4030", claw="#e8e0c8")
    q = Quad("geometry.skeleton_bear", p, L=28, W=14, Hb=14, leg=13, lt=6, hl=11, hw=9, hh=9)
    q.base(body="bone", bstyle="bone", paws="dark", legs="bone", lstyle="bone")
    q.head_box(M("bone", "bone", 3.3), snout=4, snout_mat=M("bone", "bone", 3.5), ears="fur", ear_size=2, eyes="glow", fangs="bone")
    q.ribs("bone"); q.hump("fur", h=4)
    q.box("body", (-q.W / 2 - 0.5, q.leg + 4, -q.L / 2 + 6), (q.W + 1, 5, 10), M("fur", "fur", 2.4))   # rotten fur patch
    q.tail("bone", length=3, thick=3, up=3, style="bone")
    for nm, sx in (("leg_fl", 1), ("leg_fr", -1)):
        x = (q.W / 2 - q.lt) if sx > 0 else -q.W / 2
        for k in range(3):
            q.box(nm, (x + 1 + k * 2 - 0.5, 0, -q.L / 2 - 2), (1, 1, 2), M("claw", "bone", 3.8))
    return Spec(q, rig="quad", heavy=1.3)


BEASTS = dict(grizzly_bear=grizzly_bear, big_ent=big_ent, skeleton_bear=skeleton_bear)
