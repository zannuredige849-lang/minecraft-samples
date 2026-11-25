"""Chaos: black iron, crimson, brass; Tzeentch pinks/blues; Nurgle rot."""
from .common import *
from .mobs_order import _riding_legs, _rider


def chaos_knight():
    p = pal(armor="#2e2a3c", cloth="#3a1c5a", trim="#a98a4a", metal="#6c7388", glow="#4af0d0", leather="#2a2230", horse="#1e1c26", mane="#3a1c5a", dark="#08080c", plume="#3a1c5a")
    q = Quad("geometry.chaos_knight", p, L=26, W=11, Hb=9, leg=11, lt=4, hl=10, hw=6, hh=8, neck_up=6)
    q.base(body="horse", bstyle="fur", paws="armor", legs="horse")
    q.head_box(M("horse", "fur", 3.0), snout=3, ears="horse", eyes="glow")
    q.tail("mane", length=10, thick=3, up=2); q.mane("mane"); q.barding("armor", "trim"); q.spikes("trim", n=4); q.saddle("leather", "trim")
    r = _rider(q, p, 32)
    r.base(armor="armor", cloth="cloth", trim="trim")
    r.head_helm("great", horns="trim", eyes="glow")
    r.pauldrons("round", spikes=3, trim="trim", size=1.25)
    r.tabard("cloth", "trim", "rune", length=6); r.cape("cloth", trim="trim", length=17)
    r.weapon("spear", glow="glow"); r.shield("round", emblem="rune", slot="armor")
    _riding_legs(q)
    attach(q, r)
    return Spec(q, rig="rider", heavy=1.35)


def void_knight():
    p = pal(armor="#3a2e66", cloth="#24184a", trim="#e0b84a", metal="#7a80c0", glow="#52e4ff", plume="#7a30c0", dark="#08060c")
    m = Humanoid("geometry.void_knight", p, H=target_h("warcraft:void_knight") * 0.88, w=0.95)
    m.base(armor="armor", cloth="cloth", trim="trim")
    m.head_helm("great", horns="glow", eyes="glow", trim="trim"); m.pauldrons("round", spikes=3, trim="glow", size=1.4)
    m.belt("leather", "glow"); m.tabard("cloth", "glow", "gem", length=10); m.cape("cloth", trim="glow", length=24)
    m.weapon("spear", glow="glow", slot="metal", trim="glow"); m.floaters("glow", n=4, r=14)
    m.box(m.body, (-2, m.sh - 7, -m.td / 2 - 1), (4, 4, 1), M("glow", "glow", 4.0))
    return Spec(m, heavy=1.1)


def hornet_demon():
    p = pal(skin="#b02a2a", armor="#8a1c24", cloth="#4a1018", trim="#e0c070", metal="#9aa0ab", glow="#ffb020", bone="#e6dcc0", leather="#3a1a1a", dark="#14080a")
    m = Humanoid("geometry.hornet_demon", p, H=target_h("warcraft:hornet_demon") * 0.9, w=1.15)
    m.base(armor="armor", cloth="cloth", trim="trim", gauntlets=False, arm_style="skin", sleeves_slot="skin")
    m.head_helm("skull", eyes="glow", horns="bone"); m.pauldrons("round", slot="armor", trim="bone", spikes=2)
    m.belt("leather", "trim", skull=True); m.wings("insect", slot="glow", span=14, rot=26)
    m.tail("armor", length=14, thick=4, segs=3); m.weapon("hammer", slot="metal", trim="bone")
    return Spec(m, heavy=1.15)


def blood_angel():
    p = pal(skin="#e8c0a0", armor="#a8202e", cloth="#4a1018", trim="#d8a040", metal="#c4ccd8", glow="#ff3030", hair="#f0f0f0", leather="#3a1a1a")
    m = Humanoid("geometry.blood_angel", p, H=target_h("warcraft:blood_angel") * 0.9, w=1.0)
    m.base(armor="armor", cloth="cloth", trim="trim")
    m.head_bare("skin", hair="hair", eyes="glow", eye_y=4)
    m.pauldrons("round", spikes=2, trim="trim", size=1.2); m.belt("leather", "trim"); m.tabard("cloth", "trim", "cross", length=9)
    m.wings("feather", slot="hair", trim="armor", span=24, rot=14); m.weapon("sword", glow="glow", length=26)
    return Spec(m, heavy=1.0)


def black_blocker():
    p = pal(armor="#262c38", cloth="#1c2028", trim="#d8d0b8", metal="#4a5262", glow="#ff3a2a", bone="#d8d0b8", skin="#2e3440", dark="#08080c", red="#8a2020")
    m = Humanoid("geometry.black_blocker", p, H=target_h("warcraft:black_blocker") * 0.82, w=1.4, hs=12, th=22, lh=12, arm_h=26, aw=11)
    m.base(armor="armor", cloth="cloth", trim="metal", torso_style="rock", arm_style="rock", leg_style="rock", sleeves_slot="skin", gauntlets=True)
    m.head_helm("great", metal="armor", eyes="glow", horns="bone", trim="trim")
    m.pauldrons("round", slot="armor", trim="bone", skull=True, size=1.0, spikes=2)
    tw = m.tw
    for i in range(3):   # exposed bone ribs on the chest
        m.box(m.body, (-tw / 2 + 2, m.lh + 8 + i * 4, -m.td / 2 - 1), (tw - 4, 2, 1), M("bone", "bone", 3.4))
    m.box(m.body, (-m.tw / 2 - 1, m.lh + 3, -m.td / 2 - 1), (4, 6, 1), M("red", "flat", 3.0))
    return Spec(m, armed=False, heavy=1.5)


def pink_horror():
    p = pal(skin="#e0508a", armor="#e0508a", cloth="#a02a6a", trim="#4aa8ff", glow="#4aa8ff", metal="#5a2a6a", bone="#f0e0d0", dark="#2a0a2a", flame="#4aa8ff")
    m = Humanoid("geometry.pink_horror", p, H=target_h("warcraft:pink_horror") * 0.86, w=0.9, hs=12)
    m.base(armor="skin", cloth="cloth", trim="skin", torso_style="skin", gauntlets=False, arm_style="skin", sleeves_slot="skin")
    hs = m.hs
    m.head_box(dec(M("skin", "skin", 3.0), ("north", "eyes", "glow", 6), ("north", "teeth", 3), ("north", "mouth", 2)))
    m.horns("bone", size=0.9)
    m.flames_on(m.head, "flame", w=4, h=8, n=3, at=(0, m.sh + hs, 0))
    m.tail("skin", length=10, thick=3, style="skin")
    m.weapon("staff", glow="glow", trim="metal", rest=-8)
    return Spec(m, heavy=0.8)


def burning_chariot():
    p = pal(skin="#2a2220", fur="#2a2220", armor="#3a3a44", wood="#6a4a2e", trim="#8a8f98", glow="#ff7a20", flame="#ff7a20", leather="#3a2a1e", dark="#0c0808", horse="#2a2220", mane="#ff7a20")
    q = Quad("geometry.burning_chariot", p, L=24, W=10, Hb=10, leg=12, lt=4, hl=10, hw=6, hh=8, neck_up=5)
    q.base(body="horse", bstyle="fur", paws="flame", legs="horse")
    q.head_box(M("horse", "fur", 3.0), snout=3, ears="horse", eyes="glow")
    q.mane("flame"); q.tail("flame", length=10, thick=4, style="flame")
    zb = q.L / 2 + 5
    # draw-bar, cart, wheels
    q.box("body", (-1, q.leg + 3, q.L / 2 - 2), (2, 2, 9), M("wood", "wood", 2.8))
    q.box("body", (-8, 8, zb + 3), (16, 3, 16), M("wood", "wood", 2.9))
    q.box("body", (-9, 11, zb + 3), (2, 7, 16), M("wood", "wood", 3.2)); q.box("body", (7, 11, zb + 3), (2, 7, 16), M("wood", "wood", 3.2))
    q.box("body", (-9, 11, zb + 17), (18, 7, 2), M("wood", "wood", 3.0))
    q.box("body", (-9, 17, zb + 3), (18, 1, 2), M("trim", "plate", 3.4))
    for sgn, nm in ((1, "wheel_l"), (-1, "wheel_r")):
        q.bone(nm, "root", (sgn * 10, 6, zb + 11))
        q.box(nm, (sgn * 10 - 1, 0, zb + 5), (2, 12, 12), M("wood", "wood", 2.6))
        q.box(nm, (sgn * 10 - 1.5, 5, zb + 10), (3, 2, 2), M("trim", "plate", 3.8))
        q.box(nm, (sgn * 10 - 1, 5, zb + 4), (2, 2, 14), M("trim", "plate", 3.2))
    for i in range(3):
        q.box("body", (-6 + i * 5, 18, zb + 6 + i * 3), (4, 8 - i, 4), M("flame", "flame", 3.2))
    wheel = {"walk": {"wheel_l": {"rotation": ["query.anim_time*450", 0, 0]}, "wheel_r": {"rotation": ["query.anim_time*450", 0, 0]}}}
    return Spec(q, rig="quad", heavy=1.2, extra=wheel)


def great_unclean_one():
    p = pal(skin="#7a9a4a", armor="#6a8a3a", cloth="#5a4a2a", trim="#c8c070", bone="#d8d0a0", glow="#c8ff40", dark="#1c2210", flesh="#b0505a", metal="#8a8470", leather="#4a3a22", fly="#1a1a14")
    H = target_h("warcraft:great_unclean_one")
    m = Humanoid("geometry.great_unclean_one", p, H=H * 0.9, w=2.0, hs=14, th=26, lh=14, tw=28, td=18, arm_h=22, aw=11)
    m.base(armor="skin", cloth="skin", trim="skin", torso_style="skin", arm_style="skin", sleeves_slot="skin", gauntlets=False, leg_style="skin")
    tw, td, lh, th = m.tw, m.td, m.lh, m.th
    # bloated belly
    m.box(m.body, (-tw / 2 - 3, lh + 2, -td / 2 - 4), (tw + 6, 12, td + 6), M("skin", "skin", 3.1))
    m.box(m.body, (-tw / 2 - 1, lh + 12, -td / 2 - 5), (tw + 2, 8, 4), M("skin", "skin", 3.3))
    m.box(m.body, (-7, lh + 5, -td / 2 - 5), (14, 8, 1), M("flesh", "flat", 2.4, decals=[("north", "teeth", 1, "bone"), ("north", "teeth", 6, "bone")]))
    # boils
    for (x, y, z) in ((-10, lh + 18, -td / 2 - 6), (9, lh + 15, -td / 2 - 6), (-12, lh + 8, td / 2 + 2), (11, lh + 20, td / 2 + 2), (0, lh + 24, td / 2 + 2)):
        m.box(m.body, (x, y, z), (3, 3, 2), M("glow", "flat", 3.6))
    m.head_box(dec(M("skin", "skin", 3.0), ("north", "eyes", "glow", 6), ("north", "teeth", 3, "bone"), ("north", "mouth", 2)))
    m.horns("bone", size=1.6)
    hs = m.hs
    m.box(m.head, (-hs / 2 - 1, m.sh - 3, -hs / 2 - 1), (hs + 2, 4, hs + 2), M("skin", "skin", 2.6))
    m.pauldrons("round", slot="skin", trim="bone", size=1.0)
    m.weapon("greatsword", slot="metal", grip="leather", glow=None, length=40)
    wb = m._wbone("l")
    m.bones[m.arm_l]["rot"] = [-12, 0, 0]
    for i in range(5):  # chain + flail
        m.box(wb, (m.acx - 0.5, m.hand_y - 3 - i * 2.2, -2), (1, 2, 1), M("metal", "metal", 3.0))
    m.box(wb, (m.acx - 2.5, m.hand_y - 17, -4), (5, 5, 5), M("metal", "metal", 3.2))
    m.bone("orbit", m.head, (0, m.sh + 4, 0))
    import math
    for i in range(7):
        a = 2 * math.pi * i / 7; r_ = 12 + (i % 3) * 2
        m.box("orbit", (r_ * math.cos(a) - 1, m.sh + 2 + (i % 4) * 3, r_ * math.sin(a) - 1), (2, 2, 2), M("fly", "flat", 2.0))
    return Spec(m, heavy=1.6)


def abomination_lord():
    p = pal(skin="#b0aa50", armor="#9a9a46", cloth="#6a5a2a", trim="#d8d090", bone="#e0d8b0", glow="#e8ff40", dark="#1c2210", flesh="#a05050", metal="#7a7a70", leather="#4a3a22", stitch="#3a3020")
    m = Humanoid("geometry.abomination_lord", p, H=target_h("warcraft:abomination_lord") * 0.86, w=1.5, hs=12, th=22, lh=13, arm_h=24, aw=11)
    m.base(armor="skin", cloth="cloth", trim="skin", torso_style="skin", arm_style="skin", sleeves_slot="skin", gauntlets=False, leg_style="skin")
    tw, td, lh, th = m.tw, m.td, m.lh, m.th
    m.box(m.body, (-tw / 2 - 2, lh + 2, -td / 2 - 3), (tw + 4, 10, td + 5), M("skin", "skin", 3.1))
    for i in range(3):
        m.box(m.body, (-tw / 2 + 2, lh + 12 + i * 3, -td / 2 - 1), (tw - 4, 1, 1), M("bone", "bone", 3.4))
    m.box(m.body, (-tw / 2 - 1, m.sh - 8, -td / 2 - 1), (tw + 2, 1, td + 2), M("stitch", "flat", 2.0))
    m.head_box(dec(M("skin", "skin", 3.0), ("north", "eyes", "glow", 5), ("north", "teeth", 2, "bone"), ("north", "mouth", 1)))
    for sgn in (1, -1):
        m.box(m.arm_l if sgn > 0 else m.arm_r, (sgn * (m.acx + 1) - (0 if sgn > 0 else 5) + (1 if sgn > 0 else 0), m.sh - 4, -3), (5, 5, 6), M("flesh", "skin", 2.8))  # growths
    m.pauldrons("round", slot="skin", trim="bone", size=1.0, spikes=2)
    m.weapon("cleaver", slot="metal", length=26)
    m.box(m.arm_l, (m.tw / 2 - 1, m.hand_y - 4, -5), (m.aw + 3, 6, 10), M("skin", "skin", 2.8))   # giant fist
    return Spec(m, heavy=1.5)


CHAOS = dict(chaos_knight=chaos_knight, void_knight=void_knight, hornet_demon=hornet_demon, blood_angel=blood_angel,
             black_blocker=black_blocker, pink_horror=pink_horror, burning_chariot=burning_chariot,
             great_unclean_one=great_unclean_one, abomination_lord=abomination_lord)
