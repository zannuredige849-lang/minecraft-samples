"""ONE golem template; elements differ by palette and 2-3 attachments only."""
from .common import *

ELEMENTS = {
    "frost":     dict(stone="#5f7f9a", glow="#d8ffff", accent="#8ae0ff", ice="#8ae0ff", snow="#f0f8ff", dark="#0a1624"),
    "lightning": dict(stone="#4c5a6c", glow="#fff8b0", accent="#ffe040", ice="#40e0ff", snow="#9ab0c8", dark="#0a0e18"),
    "inferno":   dict(stone="#3a2a26", glow="#ffb040", accent="#ff5a10", ice="#ff7a20", snow="#5a3a2a", dark="#0c0806"),
    "ember":     dict(stone="#2a2220", glow="#ffa040", accent="#ff3a10", ice="#ff5a20", snow="#3a2a24", dark="#080606"),
    "forge":     dict(stone="#a8683a", glow="#ffa030", accent="#ff8a20", ice="#ffb050", snow="#7a4a2a", dark="#2a1a12"),
    "fel":       dict(stone="#34342a", glow="#9aff30", accent="#6acc10", ice="#9aff30", snow="#4a4a3a", dark="#0a0c06"),
}


def golem(ident, element, H, k=1.0):
    e = ELEMENTS[element]
    p = pal(skin=e["stone"], armor=e["stone"], cloth=e["stone"], trim=e["accent"], metal=e["stone"], glow=e["glow"],
            ice=e["ice"], snow=e["snow"], dark=e["dark"], accent=e["accent"], bone=e["snow"], rock=e["stone"])
    kk = H / 50.0 * k
    lh = R(18 * kk); th = R(21 * kk); hs = R(10 * kk); tw = R(19 * kk) // 2 * 2; td = R(12 * kk); aw = R(8 * kk); ah = R(27 * kk)
    m = Humanoid(ident, p, H=H, hs=hs, lh=lh, th=th, tw=tw, td=td, aw=aw, arm_h=ah)
    m.base(armor="rock", cloth="rock", trim="armor", torso_style="rock", arm_style="rock", leg_style="rock", boots=True, gauntlets=True, sleeves_slot="rock")
    tw, td, lh, th = m.tw, m.td, m.lh, m.th
    # stacked torso: chest core + slabs
    core = M("glow", "glow", 4.0)
    if element == "forge":
        m.box(m.body, (-tw / 2 + 3, lh + 5, -td / 2 - 1), (tw - 6, th - 8, 1), dec(M("dark", "flat", 1.6), ("north", "grate", "glow")))
    elif element in ("ember", "inferno", "fel"):
        m.box(m.body, (-tw / 2 + 4, lh + 6, -td / 2 - 1), (tw - 8, th - 10, 1), dec(M("rock", "rock", 2.4), ("north", "crack", "glow")))
        m.box(m.body, (-3, lh + th - 9, -td / 2 - 2), (6, 6, 1), core)
    else:
        m.box(m.body, (-3, lh + th - 11, -td / 2 - 2), (6, 6, 1), dec(core, ("north", "gem", "glow")) if False else core)
        m.box(m.body, (-tw / 2 + 3, lh + 4, -td / 2 - 1), (tw - 6, 3, 1), M("accent", "plate", 3.2))
    m.box(m.body, (-tw / 2 - 2, lh + th - 6, -td / 2 - 1), (tw + 4, 6, td + 2), M("rock", "rock", 3.1))   # upper-back slab / hunch
    # head (small, sunk between shoulders): replaced eyes
    m.head_box(dec(M("rock", "rock", 3.0), ("north", "eyes", "glow", R(hs * 0.45))))
    m.pauldrons("round", slot="rock", trim="accent", size=1.0)
    for nm, sgn in ((m.arm_l, 1), (m.arm_r, -1)):   # big fists
        m.box(nm, (sgn * (m.acx) - (m.aw + 3) / 2, m.hand_y - 3, -(m.aw + 3) / 2), (m.aw + 3, 5, m.aw + 3), M("rock", "rock", 3.3))
    m.thigh_plates("rock")
    sh = m.sh; hs = m.hs
    if element == "frost":
        for sgn, nm in ((1, m.arm_l), (-1, m.arm_r)):
            for i, (dx, hh, rz) in enumerate(((0, 9, 18), (3, 6, 36))):
                m.box(nm, (sgn * (m.acx - 1 + dx) - 1, sh, -1), (2, hh, 2), M("ice", "ice", 3.6), rot=[0, 0, -sgn * rz], pivot=[sgn * (m.acx), sh, 0])
            m.box(nm, (sgn * m.acx - 4, sh + 1, -4), (8, 2, 8), M("snow", "fur", 3.4))
        for i in range(3):
            m.box(m.body, (-4 + i * 4, sh - 2, td / 2), (2, 7 + i % 2 * 3, 2), M("ice", "ice", 3.5), rot=[18, 0, 0], pivot=[-4 + i * 4, sh - 2, td / 2])
    elif element == "lightning":
        for sgn, nm in ((1, m.arm_l), (-1, m.arm_r)):
            m.box(nm, (sgn * m.acx - 0.5, sh + 2, -0.5), (1, 9, 1), M("metal", "metal", 3.5))
            m.box(nm, (sgn * m.acx - 1.5, sh + 11, -1.5), (3, 3, 3), M("glow", "glow", 4.0))
        m.floaters("glow", n=4, r=int(tw * 0.8), y=lh + th / 2)
    elif element in ("inferno", "fel"):
        m.horns("accent", size=1.8)
        m.flames_on(m.head, "ice" if False else "accent", w=3, h=6, n=3, at=(0, sh + hs, 0)) if False else None
        for i, (x, z) in enumerate(((-4, -2), (0, 1), (4, -1))):
            m.box(m.head, (x - 1.5, sh + hs, z - 1.5), (3, 5 - i % 2 * 2, 3), M("glow", "flame", 3.2))
        for sgn, nm in ((1, m.arm_l), (-1, m.arm_r)):
            m.box(nm, (sgn * m.acx - 1.5, m.hand_y - 7, -2), (3, 4, 3), M("glow", "flame", 3.0))
    elif element == "ember":
        m.spikes_back("accent", 5)
        for sgn, nm in ((1, m.arm_l), (-1, m.arm_r)):
            m.box(nm, (sgn * m.acx - 1, sh + 2, -1), (2, 5, 2), M("glow", "flame", 3.3))
        for sgn, nm in ((1, m.leg_l), (-1, m.leg_r)):
            m.box(nm, (sgn * m.lw / 2 - 1.5, 4, -m.lw / 2 - 1), (3, 5, 1), M("glow", "glow", 3.4))
    elif element == "forge":
        m.box(m.head, (-hs / 2 - 3, sh + hs - 2, -hs / 2 - 1), (hs + 6, 3, hs + 2), M("stone", "metal", 3.4)) if False else m.box(m.head, (-hs / 2 - 3, sh + hs - 2, -hs / 2 - 1), (hs + 6, 3, hs + 2), M("armor", "metal", 3.4))
        for sgn in (1, -1):
            m.box(m.body, (sgn * 6 - 2, sh - 4, td / 2), (4, 11, 4), M("dark", "metal", 2.0))
            m.box(m.body, (sgn * 6 - 1.5, sh + 7, td / 2 + 0.5), (3, 2, 3), M("glow", "flame", 3.6))
    return m
