"""Norsca: fur, rusted iron, bone, red war-paint."""
from .common import *
from .mobs_order import _riding_legs, _rider

FUR = "#6a5238"; IRON = "#6a6a70"; RUST = "#7a5a48"; PAINT = "#b02a2a"; BRONZE = "#b48a3c"


def bandit_raider():
    p = pal(armor="#5a4a3a", cloth="#4a3a2a", trim=BRONZE, metal="#8a8f98", fur="#5a4630", leather="#4a3322", glow="#ffb050")
    m = Humanoid("geometry.bandit_raider", p, H=target_h("warcraft:bandit_raider") * 0.9, w=1.15)
    m.base(armor="armor", cloth="cloth", trim="leather", torso_style="leather")
    m.head_helm("hood_open", metal="fur", eyes="glow")
    hs = m.hs
    m.box(m.head, (-hs / 2 - 0.5, m.sh - 1, -hs / 2 - 1), (hs + 1, 4, 1), M("cloth", "cloth", 2.0))   # face wrap
    m.fur_collar("fur"); m.pauldrons("round", slot="leather", trim="metal", spikes=2)
    m.belt("leather", "trim"); m.backpack("leather", (8, 8, 4))
    m.weapon("scimitar", slot="metal", grip="leather")
    return Spec(m, heavy=1.15)


def bandit_dog():
    p = pal(skin="#6a604f", fur="#6a604f", armor="#5a5048", trim="#8a8f98", dark="#14141c", glow="#ffb050")
    q = Quad("geometry.bandit_dog", p, L=20, W=9, Hb=9, leg=9, lt=3, hl=9, hw=6, hh=6)
    q.base(body="fur", bstyle="fur", paws="dark", belly="skin")
    q.head_box(M("fur", "fur", 3.0), snout=3, snout_mat=M("skin", "fur", 3.4), ears="dark", ear_size=3, eyes="glow", fangs="bone")
    q.tail("fur", length=7, thick=2, up=0)
    q.box("head", (-3.5, q.neck_y - q.hh / 2 - 1, -q.L / 2 - 1), (7, 2, 4), M("leather", "leather", 2.5))
    for i in range(3):
        q.box("head", (-0.5 + (i - 1) * 2.5, q.neck_y - q.hh / 2 - 1, -q.L / 2 - 2), (1, 1, 1), M("trim", "bone", 3.8))
    q.mane("dark", length=7)
    return Spec(q, rig="quad", heavy=0.8)


def chaos_warrior():
    p = pal(armor="#3a3a46", cloth="#5a1822", trim="#b98a3a", metal="#7c8190", glow="#ff4a38", plume="#8a1020", leather="#3a2a22", dark="#0c0c10")
    m = Humanoid("geometry.chaos_warrior", p, H=target_h("warcraft:chaos_warrior") * 0.93, w=1.15)
    m.base(armor="armor", cloth="cloth", trim="trim")
    m.head_helm("great", trim="trim", horns="trim", eyes="glow"); m.pauldrons("round", trim="trim", spikes=3, size=1.2)
    m.belt("leather", "trim", skull=True); m.tabard("cloth", "trim", "rune", length=8); m.cape("cloth", trim="trim", length=14)
    m.weapon("war_pick", slot="metal"); m.shield("round", emblem="rune", slot="armor")
    return Spec(m, heavy=1.1)


def norse_berserker():
    p = pal(armor="#c89070", skin="#c89070", cloth="#5a3a28", trim="#8a8f98", fur="#6a5238", metal="#8a8f98", leather="#4a3322", glow="#ff6030")
    m = Humanoid("geometry.norse_berserker", p, H=target_h("warcraft:norse_berserker") * 0.93, w=1.1, bulk=1.1)
    m.base(armor="skin", cloth="fur", trim="leather", torso_style="skin", arm_style="skin", sleeves_slot="skin", gauntlets=False, leg_style="fur")
    tw = m.tw
    m.box(m.body, (-tw / 2 - 0.1, m.lh + 3, -m.td / 2 - 0.1), (tw + 0.2, m.th - 3, 1), M("skin", "skin", 3.0, decals=[("north", "vstripe", 2, 1, "paint", 3), ("north", "stripe", 3, 1, "paint", 3)]))
    m.head_helm("open", metal="metal", eyes="glow", horns="bone", skin="skin")
    m.box(m.head, (-m.hs / 2, m.sh + 2, -m.hs / 2 - 0.5), (m.hs, 2, 1), M("paint", "flat", 3.0))   # war-paint band
    m.fur_collar("fur"); m.belt("leather", "trim", skull=True)
    m.weapon("axe", slot="metal"); m.weapon("axe", hand="l", slot="metal")
    return Spec(m, heavy=1.1)


def norse_marauder():
    p = pal(armor="#5a4a3a", cloth="#4a3a2a", trim="#8a8f98", fur="#6a5238", metal="#8a8f98", leather="#4a3322", glow="#ffb050", beard="#8a5a2a")
    m = Humanoid("geometry.norse_marauder", p, H=target_h("warcraft:norse_marauder") * 0.93)
    m.base(armor="armor", cloth="cloth", trim="leather", torso_style="leather")
    m.head_helm("open", metal="metal", eyes="glow", horns="bone")
    m.box(m.head, (-m.hs / 2 + 1, m.sh - 4, -m.hs / 2 - 1), (m.hs - 2, 5, 2), M("beard", "fur", 3.0))
    m.fur_collar("fur"); m.pauldrons("round", slot="leather", trim="metal")
    m.belt("leather", "trim"); m.weapon("axe", slot="metal"); m.shield("round", emblem="rune", slot="leather")
    return Spec(m)


def norse_shaman():
    p = pal(armor="#4a3a6a", cloth="#4a3a6a", trim="#c8b890", fur="#6a5238", metal="#8a8f98", glow="#b070ff", leather="#4a3322", bone="#e6dcc0")
    m = Humanoid("geometry.norse_shaman", p, H=target_h("warcraft:norse_shaman") * 0.95, legs=False)
    m.base(armor="cloth", cloth="cloth", trim="leather", torso_style="cloth", gauntlets=False)
    m.head_helm("skull", eyes="glow", horns="bone"); hs = m.hs
    m.box(m.head, (-hs / 2 - 1, m.sh - 1, -hs / 2 - 1), (hs + 2, 3, hs + 3), M("fur", "fur", 3.0))
    m.skirt("cloth", length=m.lh + 2, widen=4, trim="trim"); m.fur_collar("fur"); m.belt("leather", "trim", skull=True)
    m.weapon("staff", glow="glow", trim="trim", rest=-12); m.floaters("glow", n=3, r=10)
    return Spec(m)


def skaal_villager():
    p = pal(armor="#6a5238", cloth="#5a4a3a", trim="#8a8f98", fur="#6a5238", leather="#4a3322", glow="#ffb050", hair="#7a5a2a", beard="#7a5a2a")
    m = Humanoid("geometry.skaal_villager", p, H=target_h("warcraft:skaal_villager") * 0.95, w=0.95)
    m.base(armor="armor", cloth="cloth", trim="leather", torso_style="leather", gauntlets=False)
    m.head_bare("skin", hair="hair", eyes="dark", beard="beard", eye_y=4)
    m.fur_collar("fur"); m.belt("leather", "trim"); m.weapon("trident", slot="metal", length=None)
    return Spec(m)


def wulfrik_champion():
    p = pal(armor="#7a3a30", cloth="#3a2a22", trim="#c0a050", fur="#5a4630", metal="#8a8f98", leather="#3a2a22", glow="#ff5030", paint="#b02a2a", bone="#e6dcc0")
    m = Humanoid("geometry.wulfrik_champion", p, H=target_h("warcraft:wulfrik_champion") * 0.93, w=1.2, bulk=1.15)
    m.base(armor="armor", cloth="cloth", trim="leather", torso_style="plate", leg_style="fur")
    m.head_helm("skull", eyes="glow", horns="bone"); hs = m.hs
    m.box(m.head, (-hs / 2 - 1, m.sh + hs - 2, -hs / 2 - 1), (hs + 2, 3, hs + 3), M("fur", "fur", 3.0))
    m.pauldrons("round", slot="armor", trim="bone", spikes=3, size=1.3, skull=True)
    m.fur_collar("fur"); m.belt("leather", "trim", skull=True); m.cape("fur", trim=None, length=16)
    m.weapon("greataxe", slot="metal", length=None)
    return Spec(m, heavy=1.25)


def sabertooth_rider():
    p = pal(skin="#d98a3a", fur="#d98a3a", armor="#5a4a3a", cloth="#4a3a2a", trim="#8a8f98", leather="#4a3322", metal="#8a8f98", glow="#ffe080", dark="#14141c", belly="#f0d8b0")
    q = Quad("geometry.sabertooth_rider", p, L=28, W=10, Hb=10, leg=11, lt=4, hl=9, hw=7, hh=7, neck_up=2)
    q.base(body="fur", bstyle="stripes", paws="dark", belly="belly", legs="fur", lstyle="stripes")
    q.head_box(M("fur", "fur", 3.0), snout=3, snout_mat=M("belly", "fur", 3.4), ears="fur", ear_size=3, eyes="glow", fangs="bone")
    q.tail("fur", length=10, thick=3, up=0, style="stripes")
    q.saddle("leather", "trim")
    r = _rider(q, p, 28)
    r.base(armor="armor", cloth="cloth", trim="leather", torso_style="leather")
    r.head_helm("open", metal="metal", horns="bone", eyes="glow")
    r.fur_collar("fur"); r.pauldrons("round", slot="leather", trim="metal"); r.cape("fur", trim=None, length=12)
    r.weapon("spear")
    _riding_legs(q, "leather")
    attach(q, r)
    return Spec(q, rig="rider", heavy=1.2)


NORSCA = dict(bandit_raider=bandit_raider, bandit_dog=bandit_dog, chaos_warrior=chaos_warrior, norse_berserker=norse_berserker,
              norse_marauder=norse_marauder, norse_shaman=norse_shaman, skaal_villager=skaal_villager,
              wulfrik_champion=wulfrik_champion, sabertooth_rider=sabertooth_rider)
