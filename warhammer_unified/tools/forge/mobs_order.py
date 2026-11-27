"""Kingdom Order: blue cloth + gold trim + steel. All share the tabard/trim language."""
from .common import *

STEEL = "#8a95a6"; BLUE = "#2f4ea8"; GOLD = "#dcae3c"; WHITE = "#e8ecf2"; RED = "#a8283a"


def _mount(name, pal_, top_h, body="#e8e4dc", barding=True, dark=False, tex_trim=None):
    leg = 11; Hb = 9; L = 26
    q = Quad("geometry." + name, pal_, L=L, W=11, Hb=Hb, leg=leg, lt=4, hl=10, hw=6, hh=8, neck_up=6)
    q.base(body="horse", bstyle="fur", paws="armor", legs="horse")
    q.head_box(M("horse", "fur", 3.0), snout=3, ears="horse", eyes="glow")
    q.tail("mane", length=10, thick=3, up=2)
    q.mane("mane")
    if barding: q.barding("armor", "trim")
    q.saddle("leather", "trim")
    return q


def _rider(q, pal_, H, pre="r_"):
    from .player import PEOPLE
    key = q.ident.split(".", 1)[1]
    if key in PEOPLE: H = 32                            # riders who are people use the vanilla player model
    r = Humanoid("x", pal_, H=H, pre=pre, oy=q.top - R(H * 0.34) + 1, oz=0, parent_bone="body", legs=False,
                 player=key if key in PEOPLE else None)
    return r


def _riding_legs(q, slot="armor"):
    for sgn in (1, -1):
        x = sgn * (q.W / 2 + 0.5) - (0 if sgn > 0 else 3)
        q.box("body", (x, q.leg + 1, -3), (3, 7, 5), M("cloth", "cloth", 2.8))
        q.box("body", (x, q.leg - 3, -3.5), (3, 4, 6), M(slot, "plate", 3.0))


def royal_captain():
    p = pal(armor=STEEL, cloth=BLUE, trim=GOLD, metal="#c4ccd8", glow="#ffe9a0", plume=RED)
    m = Humanoid("geometry.royal_captain", p, H=target_h("warcraft:royal_captain") * 0.93, w=1.05)
    m.base(armor="armor", cloth="cloth", trim="trim")
    m.head_helm("sallet", plume="plume", trim="trim")
    m.pauldrons("round", trim="trim")
    m.belt("leather", "trim"); m.tabard("cloth", "trim", "cross"); m.cape("plume", trim="trim", length=14)
    m.weapon("sword", glow=None); m.shield("buckler", emblem="cross")
    return Spec(m)


def royal_knight():
    p = pal(armor="#aab4c4", cloth=BLUE, trim=GOLD, metal="#c4ccd8", glow="#ffe9a0", plume=RED, horse="#ece7de", mane="#cdb98c")
    H = target_h("warcraft:royal_knight")
    q = _mount("royal_knight", p, H)
    r = _rider(q, p, 30)
    r.base(armor="armor", cloth="cloth", trim="trim", torso_style="plate")
    r.head_helm("great", plume="plume", trim="trim")
    r.pauldrons("round", spikes=None, trim="trim", size=1.15)
    r.tabard("cloth", "trim", "cross", length=6); r.cape("plume", trim="trim", length=15)
    r.weapon("spear", length=None, glow=None); r.shield("kite", emblem="cross")
    _riding_legs(q)
    attach(q, r)
    return Spec(q, rig="rider", heavy=1.3)


def dark_plate_knight():
    p = pal(armor="#35363f", cloth="#52202a", trim="#b9893a", metal="#7c8190", glow="#ff4a38", plume="#8a1020", horse="#26262e", mane="#6a1a24", dark="#0c0c10")
    q = _mount("dark_plate_knight", p, target_h("warcraft:dark_plate_knight"), dark=True)
    r = _rider(q, p, 32)
    r.base(armor="armor", cloth="cloth", trim="trim")
    r.head_helm("great", plume=None, trim="trim", horns="trim", eyes="glow")
    r.pauldrons("round", spikes=3, trim="trim", size=1.25)
    r.tabard("cloth", "trim", None, length=6); r.cape("cloth", trim="trim", length=16)
    r.weapon("claymore", glow="glow"); 
    _riding_legs(q)
    attach(q, r)
    return Spec(q, rig="rider", heavy=1.4)


def elector_knight():
    p = pal(armor="#8d98aa", cloth="#25449a", trim=GOLD, metal="#c4ccd8", glow="#ffe9a0", plume="#e8ecf2", leather="#5a3f27")
    m = Humanoid("geometry.elector_knight", p, H=target_h("warcraft:elector_knight") * 0.93)
    m.base(armor="armor", cloth="cloth", trim="trim")
    m.head_helm("open", plume="plume", trim="trim", skin="skin")
    m.pauldrons("round", trim="trim"); m.belt("leather", "trim"); m.tabard("cloth", "trim", "cross")
    m.cape("cloth", trim="trim", length=13); m.backpack("leather", (6, 7, 3))
    m.weapon("sword"); m.shield("round", emblem="cross")
    return Spec(m)


def garithos_paladin():
    p = pal(armor="#c9d0dc", cloth="#27419a", trim="#f0c040", metal="#dfe5ee", glow="#fff0a8", plume="#27419a")
    m = Humanoid("geometry.garithos_paladin", p, H=target_h("warcraft:garithos_paladin") * 0.93, w=1.2, bulk=1.1)
    m.base(armor="armor", cloth="cloth", trim="trim", torso_style="plate")
    m.head_helm("great", crest="trim", trim="trim")
    m.pauldrons("round", trim="trim", size=1.35, spikes=None)
    m.belt("leather", "trim"); m.tabard("cloth", "trim", "cross", length=8); m.cape("cloth", trim="trim", length=17)
    m.thigh_plates("armor")
    m.weapon("hammer", glow=None); m.shield("tower", emblem="cross")
    return Spec(m, heavy=1.25)


def heide_knight():
    p = pal(armor="#7c8a8a", cloth="#4a6648", trim="#c8a040", metal="#a9b4b4", glow="#d8f0c0", plume="#4a6648", leather="#5a4028")
    m = Humanoid("geometry.heide_knight", p, H=target_h("warcraft:heide_knight") * 0.93)
    m.base(armor="armor", cloth="cloth", trim="trim")
    m.head_helm("sallet", trim="trim"); m.pauldrons("round", trim="trim")
    m.belt("leather", "trim"); m.tabard("cloth", "trim", "chevrons"); m.cape("cloth", trim="trim", length=12)
    m.weapon("sword"); m.shield("round", emblem="cross")
    return Spec(m)


def heide_hood_knight():
    p = pal(armor="#6e7c7c", cloth="#3f5a3a", trim="#c8a040", metal="#a9b4b4", glow="#d8f0c0", leather="#4a3522")
    m = Humanoid("geometry.heide_hood_knight", p, H=target_h("warcraft:heide_hood_knight") * 0.93)
    m.base(armor="armor", cloth="cloth", trim="trim")
    m.head_helm("hood_open", metal="cloth", eyes="glow"); m.pauldrons("round", trim="trim")
    m.belt("leather", "trim"); m.tabard("cloth", "trim", None); m.cape("cloth", trim=None, length=14)
    m.weapon("spear"); m.shield("tower", emblem="chevrons")
    return Spec(m)


def high_elf_spearman():
    p = pal(skin="#f0cfae", armor="#e6e9f0", cloth="#f2efe6", trim="#e0b84a", metal="#e8eef6", glow="#9fe6ff", hair="#d9dbe8", leather="#6a5238")
    m = Humanoid("geometry.high_elf_spearman", p, H=target_h("warcraft:high_elf_spearman") * 0.96, w=0.85)
    m.base(armor="armor", cloth="cloth", trim="trim", gauntlets=False, leg_style="cloth", arm_style="cloth")
    m.head_bare("skin", hair="hair", eyes="glow", eye_y=4)
    hs = m.hs
    for sgn in (1, -1):   # pointed ears
        m.box(m.head, (sgn * (hs / 2) - (0 if sgn > 0 else 3), m.sh + 3, -1), (3, 2, 2), M("skin", "skin", 3.2))
    m.box(m.head, (-hs / 2 - 0.5, m.sh + 1, hs / 2), (hs + 1, hs + 2, 1), M("hair", "flat", 2.8))
    m.box(m.head, (-hs / 2, m.sh + hs - 1, -hs / 2 - 0.5), (hs, 1, 1), M("trim", "plate", 3.8))
    m.pauldrons("round", trim="trim", size=0.95); m.belt("leather", "trim"); m.tabard("cloth", "trim", "cross", length=9)
    m.cape("cloth", trim="trim", length=15)
    m.weapon("glaive", slot="metal", trim="trim")
    return Spec(m)


def imperial_guard():
    p = pal(armor="#4a3a3a", cloth="#a82a34", trim="#e0b040", metal="#b6bcc8", glow="#ffd070", plume="#c82a34", leather="#4a3322")
    m = Humanoid("geometry.imperial_guard", p, H=target_h("warcraft:imperial_guard") * 0.93, w=1.1)
    m.base(armor="armor", cloth="cloth", trim="trim")
    m.head_helm("sallet", plume="plume", trim="trim", crest=None); m.pauldrons("round", trim="trim", size=1.1)
    m.belt("leather", "trim"); m.tabard("cloth", "trim", "chevrons", length=9)
    m.weapon("halberd"); m.shield("tower", emblem="chevrons")
    return Spec(m)


def paladin_swordsman():
    p = pal(armor="#e2e7ee", cloth="#f4f1ea", trim="#f1c84a", metal="#eef3fa", glow="#fff0a8", plume="#f1c84a")
    m = Humanoid("geometry.paladin_swordsman", p, H=target_h("warcraft:paladin_swordsman") * 0.93)
    m.base(armor="armor", cloth="cloth", trim="trim")
    m.head_helm("great", crest="trim", trim="trim"); m.pauldrons("round", trim="trim", size=1.2)
    m.belt("leather", "trim"); m.tabard("cloth", "trim", "cross", length=9); m.cape("cloth", trim="trim", length=15)
    m.weapon("greatsword", glow="glow"); m.halo("glow", r=9)
    m.wings("feather", slot="cloth", trim="trim", span=11, rot=10)
    return Spec(m, heavy=1.1)


def royal_queen():
    p = pal(skin="#f0cfae", armor="#d8dde8", cloth="#8f1f3d", trim="#f1c84a", metal="#e8eef6", glow="#ffd0e8", hair="#6b3a1e", leather="#5a3a2a")
    m = Humanoid("geometry.royal_queen", p, H=target_h("warcraft:royal_queen") * 0.95, w=0.95, legs=False)
    m.base(armor="armor", cloth="cloth", trim="trim", gauntlets=False, torso_style="cloth")
    m.head_bare("skin", hair="hair", eyes="glow", eye_y=4)
    hs = m.hs
    m.box(m.head, (-hs / 2 - 0.5, m.sh + hs, -hs / 2 - 0.5), (hs + 1, 2, hs + 1), M("trim", "plate", 3.4))
    for i in range(4):
        m.box(m.head, (-hs / 2 + i * (hs - 1) / 3 - 0.5, m.sh + hs + 2, -0.5), (1, 3, 1), M("trim", "plate", 4.0))
    m.box(m.head, (-hs / 2 - 0.5, m.sh - 6, hs / 2), (hs + 1, hs, 1), M("hair", "flat", 2.4))
    m.pauldrons("round", trim="trim", size=0.9); m.skirt("cloth", length=m.lh + 2, widen=6, trim="trim")
    m.cape("cloth", trim="trim", length=22)
    m.weapon("staff", glow="glow", trim="trim", rest=-10)
    return Spec(m, floaty=False)


def teutonic_cleric():
    p = pal(armor="#d9d6c0", cloth="#e9e4cf", trim="#c9a24a", metal="#c6c9cf", glow="#fff0a8", cloth2="#4a6a4a", leather="#6a5238")
    m = Humanoid("geometry.teutonic_cleric", p, H=target_h("warcraft:teutonic_cleric") * 0.95, legs=False)
    m.base(armor="cloth", cloth="cloth", trim="trim", gauntlets=False, torso_style="cloth")
    m.head_helm("hood_open", metal="cloth", eyes="glow", skin="skin")
    m.skirt("cloth", length=m.lh + 2, widen=4, trim="trim"); m.tabard("cloth2", "trim", "cross", length=14)
    m.belt("leather", "trim"); m.cape("cloth2", trim="trim", length=16)
    m.weapon("mace", slot="metal", trim="trim"); m.halo("glow", r=8, y=m.sh + m.hs + 3)
    return Spec(m)


def chival_warrior():
    p = pal(armor="#a0693a", cloth="#3a4a8a", trim="#e0b040", metal="#c4ccd8", glow="#ffd070", plume="#a8283a", leather="#5a3a22")
    m = Humanoid("geometry.chival_warrior", p, H=target_h("warcraft:chival_warrior") * 0.93, w=1.1)
    m.base(armor="armor", cloth="cloth", trim="trim")
    m.head_helm("great", plume="plume", trim="trim"); m.pauldrons("round", trim="trim", size=1.15)
    m.belt("leather", "trim"); m.tabard("cloth", "trim", "chevrons"); m.cape("plume", trim="trim", length=13)
    m.weapon("claymore", glow=None)
    return Spec(m)


ORDER = dict(royal_captain=royal_captain, royal_knight=royal_knight, dark_plate_knight=dark_plate_knight,
             elector_knight=elector_knight, garithos_paladin=garithos_paladin, heide_knight=heide_knight,
             heide_hood_knight=heide_hood_knight, high_elf_spearman=high_elf_spearman, imperial_guard=imperial_guard,
             paladin_swordsman=paladin_swordsman, royal_queen=royal_queen, teutonic_cleric=teutonic_cleric,
             chival_warrior=chival_warrior)
