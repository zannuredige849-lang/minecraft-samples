"""Faceless (teal/purple), Scourge (icy undead), Santa, ice demon."""
from .common import *

TEAL = "#2fb89a"; PURPLE = "#5a3a9a"; ORANGE = "#e08a30"


def _fpal(**kw):
    d = dict(armor=TEAL, cloth=PURPLE, trim=ORANGE, metal="#3a8a9a", glow="#ffe080", skin="#28a08a", dark="#10081c", leather="#3a2a5a", bone="#e0d8c0")
    d.update(kw); return pal(**d)


def _fhead(m, **kw):
    """Faceless: blank mask, one glowing rune on the brow."""
    m.head_box(dec(M("armor", "plate", 3.1), ("north", "rune", "glow")))
    hs = m.hs
    m.box(m.head, (-hs / 2 - 1, m.sh + hs - 3, -hs / 2 - 1), (hs + 2, 3, hs + 2), M("cloth", "cloth", 2.6))


def faceless_warrior():
    m = Humanoid("geometry.faceless_warrior", _fpal(), H=target_h("warcraft:faceless_warrior") * 0.93, w=1.1)
    m.base(armor="armor", cloth="cloth", trim="trim", torso_style="plate"); _fhead(m)
    m.pauldrons("round", trim="trim", size=1.1); m.belt("leather", "trim"); m.tabard("cloth", "trim", "rune", length=8)
    m.weapon("axe", slot="metal"); m.shield("round", emblem="rune", slot="armor")
    return Spec(m)


def faceless_berserker():
    m = Humanoid("geometry.faceless_berserker", _fpal(armor="#28a08a"), H=target_h("warcraft:faceless_berserker") * 0.93, w=1.2, bulk=1.1)
    m.base(armor="skin", cloth="cloth", trim="trim", torso_style="skin", arm_style="skin", sleeves_slot="skin", gauntlets=True)
    m.box(m.body, (-m.tw / 2 - 0.1, m.lh + 3, -m.td / 2 - 0.1), (m.tw + 0.2, m.th - 3, 1), M("skin", "skin", 3.0, decals=[("north", "crack", "trim")]))
    _fhead(m); m.horns("trim", size=1.1)
    m.pauldrons("round", slot="cloth", trim="trim", spikes=3, size=1.2); m.belt("leather", "trim")
    m.weapon("axe", slot="metal"); m.weapon("axe", hand="l", slot="metal")
    return Spec(m, heavy=1.2)


def faceless_general():
    m = Humanoid("geometry.faceless_general", _fpal(armor="#2a9a88", trim="#f0b040"), H=target_h("warcraft:faceless_general") * 0.9, w=1.25, bulk=1.1)
    m.base(armor="armor", cloth="cloth", trim="trim", torso_style="plate"); _fhead(m); m.horns("trim", size=1.5)
    m.pauldrons("round", trim="trim", spikes=3, size=1.3); m.belt("leather", "trim", skull=False)
    m.tabard("cloth", "trim", "rune", length=10); m.cape("cloth", trim="trim", length=20)
    m.weapon("greatsword", glow="glow", slot="metal", trim="trim"); m.thigh_plates("armor")
    return Spec(m, heavy=1.4)


def faceless_sorcerer():
    m = Humanoid("geometry.faceless_sorcerer", _fpal(), H=target_h("warcraft:faceless_sorcerer") * 0.93, legs=False)
    m.base(armor="cloth", cloth="cloth", trim="trim", torso_style="cloth", gauntlets=False, arm_style="cloth")
    _fhead(m); m.skirt("cloth", length=m.lh + 2, widen=5, trim="trim"); m.pauldrons("round", slot="cloth", trim="trim", size=0.95)
    m.belt("leather", "trim"); m.cape("cloth", trim="trim", length=20)
    m.weapon("staff", glow="glow", trim="trim", rest=-10); m.floaters("glow", n=3, r=11)
    return Spec(m)


def faceless_cultist():
    m = Humanoid("geometry.faceless_cultist", _fpal(armor="#c8d4d8", cloth="#2a2a52"), H=target_h("warcraft:faceless_cultist") * 0.9, legs=False)
    m.base(armor="cloth", cloth="cloth", trim="leather", torso_style="cloth", gauntlets=False)
    m.head_box(dec(M("armor", "plate", 3.3), ("north", "rune", "glow")))
    hs = m.hs
    m.box(m.head, (-hs / 2 - 1, m.sh - 1, -hs / 2 - 1), (hs + 2, hs + 2, hs + 3), M("cloth", "cloth", 2.4)) if False else None
    m.box(m.head, (-hs / 2 - 1, m.sh + hs - 2, -hs / 2 - 1), (hs + 2, 3, hs + 3), M("cloth", "cloth", 2.4))
    m.box(m.head, (-hs / 2 - 1, m.sh - 1, hs / 2), (hs + 2, hs, 2), M("cloth", "cloth", 2.3))
    m.skirt("cloth", length=m.lh + 2, widen=4, trim=None)
    m.box(m.body, (-1, m.sh - 6, m.td / 2), (2, hs + 8, 1), M("trim", "plate", 3.0))                 # pole bolted to the back
    m.box(m.body, (-5, m.sh + hs - 2, m.td / 2 + 1), (10, 10, 1), M("glow", "glow", 3.4, decals=[("*", "rune", "dark")]))
    m.weapon("dagger", slot="metal", trim="trim")
    return Spec(m)


def faceless_nightmare():
    m = Humanoid("geometry.faceless_nightmare", _fpal(armor="#3a2a6a", cloth="#2a1a52", glow="#b070ff"), H=target_h("warcraft:faceless_nightmare") * 0.93, legs=False)
    m.base(armor="cloth", cloth="cloth", trim="trim", torso_style="cloth", gauntlets=False, arm_style="cloth")
    _fhead(m); m.horns("armor", size=1.3)
    m.skirt("cloth", length=m.lh + 2, widen=6, trim=None); m.wings("bat", slot="cloth", trim="armor", span=14, rot=20)
    m.floaters("glow", n=4, r=10)
    return Spec(m, floaty=True)


FACELESS = dict(faceless_warrior=faceless_warrior, faceless_berserker=faceless_berserker, faceless_general=faceless_general,
                faceless_sorcerer=faceless_sorcerer, faceless_cultist=faceless_cultist, faceless_nightmare=faceless_nightmare)


# ---------------------------------------------------------------- scourge
def nazgul():
    p = pal(armor="#3a4458", cloth="#2a3042", trim="#7a8aa8", metal="#9ab0c8", glow="#6ae6ff", skin="#9ab0c0", dark="#080a10", bone="#d0dce8")
    m = Humanoid("geometry.nazgul", p, H=target_h("warcraft:nazgul") * 0.92, legs=False)
    m.base(armor="armor", cloth="cloth", trim="trim", torso_style="plate", gauntlets=True)
    m.head_helm("hood", metal="cloth", eyes="glow"); m.pauldrons("round", slot="armor", trim="trim", spikes=2)
    m.skirt("cloth", length=m.lh + 4, widen=6, trim=None); m.cape("cloth", trim=None, length=26)
    m.wings("bat", slot="cloth", trim="trim", span=16, rot=24)
    m.weapon("scythe", slot="metal", trim="trim")
    return Spec(m, floaty=True, heavy=1.1)


def pirate_ghost():
    p = pal(skin="#7ae0d0", armor="#3a8a8a", cloth="#2a6a6a", trim="#c8b070", metal="#9ad8e0", glow="#baffff", leather="#2a4a50", bone="#d8f4f0", dark="#0a1c20", hat="#1c3a40")
    m = Humanoid("geometry.pirate_ghost", p, H=target_h("warcraft:pirate_ghost") * 0.93, legs=False)
    m.base(armor="cloth", cloth="cloth", trim="trim", torso_style="cloth", gauntlets=False, arm_style="cloth")
    m.head_helm("skull", eyes="glow"); hs = m.hs
    m.box(m.head, (-hs / 2 - 2, m.sh + hs - 1, -hs / 2 - 2), (hs + 4, 2, hs + 4), M("hat", "cloth", 2.4))
    m.box(m.head, (-hs / 2 + 0.5, m.sh + hs + 1, -hs / 2 + 0.5), (hs - 1, 3, hs - 1), M("hat", "cloth", 2.6))
    m.box(m.head, (-hs / 2 - 2, m.sh + hs, -hs / 2 - 3), (hs + 4, 2, 1), M("trim", "plate", 3.4))
    m.skirt("cloth", length=m.lh + 4, widen=3, trim=None); m.belt("leather", "trim"); m.cape("hat", trim=None, length=14)
    m.weapon("scimitar", slot="metal")
    return Spec(m, floaty=True)


def undead_zombie():
    p = pal(skin="#7a9a7a", armor="#4a4a52", cloth="#3a3a44", trim="#6a6a70", glow="#e8ff60", leather="#3a2a22", bone="#d0d8c0", dark="#0c0e0c")
    m = Humanoid("geometry.undead_zombie", p, H=target_h("warcraft:undead_zombie") * 0.95, w=1.0)
    m.base(armor="armor", cloth="cloth", trim="leather", torso_style="cloth", gauntlets=False, arm_style="skin", sleeves_slot="skin", leg_style="cloth")
    m.head_bare("skin", hair=None, eyes="glow", eye_y=4)
    hs = m.hs
    m.box(m.head, (-hs / 2 - 0.5, m.sh + hs - 2, -hs / 2 - 0.5), (hs + 1, 3, hs / 2 + 1), M("dark", "flat", 2.4))
    m.box(m.body, (-m.tw / 2, m.sh - 6, -m.td / 2 - 1), (4, 5, 1), M("bone", "bone", 3.0))
    m.bones[m.arm_l]["rot"] = [-82, 0, 4]; m.bones[m.arm_r]["rot"] = [-76, 0, -4]
    return Spec(m, armed=False)


def santa_claus():
    p = pal(skin="#f0c8a0", armor="#c82a2a", cloth="#c82a2a", trim="#f0f0f0", metal="#c8d0d8", glow="#fff0a0", leather="#2a1c1a", fur="#f0f0f0", dark="#101010", cane="#d02a2a", green="#2a8a3a", gold="#e8c040")
    m = Humanoid("geometry.santa_claus", p, H=target_h("warcraft:santa_claus") * 0.92, w=1.3, bulk=1.1, td=8)
    m.base(armor="armor", cloth="cloth", trim="leather", torso_style="cloth", gauntlets=False, arm_style="cloth", leg_style="cloth")
    m.head_bare("skin", hair="fur", eyes="dark", beard="fur", eye_y=4); hs = m.hs
    m.box(m.head, (-hs / 2 - 0.5, m.sh + hs - 1, -hs / 2 - 0.5), (hs + 1, 3, hs + 1), M("cloth", "cloth", 3.0))
    m.box(m.head, (-hs / 2 - 0.5, m.sh + hs + 2, -hs / 2 - 0.5), (hs - 1, 4, hs - 1), M("cloth", "cloth", 3.0))
    m.box(m.head, (-1, m.sh + hs + 5, hs / 2 - 1), (3, 3, 3), M("fur", "fur", 3.4))
    m.box(m.body, (-m.tw / 2 - 1, m.sh - 3, -m.td / 2 - 1), (m.tw + 2, 2, m.td + 2), M("fur", "fur", 3.0))
    m.box(m.body, (-1, m.lh, -m.td / 2 - 1), (2, m.th, 1), M("fur", "fur", 3.0))
    for sgn, bn in ((1, m.arm_l), (-1, m.arm_r)):
        m.box(bn, (sgn * m.tw / 2 - (0 if sgn > 0 else m.aw) - 0.5, m.hand_y + 3, -m.aw / 2 - 0.5), (m.aw + 1, 2, m.aw + 1), M("fur", "fur", 3.0))
    m.belt("leather", "gold"); m.backpack("green", (10, 10, 5))
    m.weapon("hammer", slot="cane", grip="cane", trim="fur", length=24)
    return Spec(m, heavy=1.2)


def ice_demon():
    p = pal(skin="#5cc8f0", armor="#3a8ac8", cloth="#2a5a9a", trim="#d8f4ff", metal="#a8e0ff", glow="#d8ffff", bone="#e8fbff", dark="#0a1a3a", ice="#8ae0ff")
    m = Humanoid("geometry.ice_demon", p, H=target_h("warcraft:ice_demon") * 0.92, w=1.1)
    m.base(armor="armor", cloth="cloth", trim="trim", torso_style="plate", gauntlets=True, arm_style="ice", leg_style="ice")
    m.head_helm("skull", eyes="glow", horns="bone"); m.pauldrons("round", slot="ice", trim="bone", spikes=3, size=1.2)
    m.wings("insect", slot="ice", span=14, rot=22); m.spikes_back("ice", 4)
    m.cape("cloth", trim="trim", length=14)
    return Spec(m, armed=False, heavy=1.1)


SCOURGE = dict(nazgul=nazgul, pirate_ghost=pirate_ghost, undead_zombie=undead_zombie, santa_claus=santa_claus, ice_demon=ice_demon)
