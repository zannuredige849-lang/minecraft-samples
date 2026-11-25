"""Humanoid rig v2 (Cyclops / Fel Lord level of detail): segmented limbs, elbow bend, held weapons, many layered parts.

Bones: root > body > head, arm_l > farm_l (forearm), arm_r > farm_r; weapon_*/shield_* are children of the forearms;
root > leg_l, leg_r. Extras: cape, skirt, wing_l/r, tail, (no floating bits: everything touches the body).
"""
import math
from .core import Model, Palette


def M(slot, style="plate", tone=3.0, **kw):
    d = {"slot": slot, "style": style, "tone": tone}
    d.update(kw)
    return d


def dec(mat, *decals):
    m = dict(mat); m["decals"] = list(mat.get("decals", ())) + list(decals)
    return m


def R(v):
    return max(1, int(round(v)))


# total forward tilt of a held weapon (deg from vertical) and the matching local rotation
HOLD = {  # kind: (final tilt forward, forearm bend)
    "sword": (48, -52), "greatsword": (30, -40), "axe": (52, -52), "greataxe": (34, -42), "hammer": (44, -48), "mace": (50, -52),
    "cleaver": (50, -52), "dagger": (60, -55), "spear": (14, -36), "staff": (10, -34), "scythe": (18, -36),
}


class Humanoid(Model):
    def __init__(self, ident, pal, H=32, w=1.0, hs=None, arm_h=None, bulk=1.0, shoulder=0, pre="", oy=0.0, oz=0.0,
                 parent_bone=None, legs=True, lh=None, th=None, tw=None, td=None, aw=None):
        super().__init__(ident, pal)
        self.pre, self.oy, self.oz, self.has_legs = pre, oy, oz, legs
        s = H / 32.0
        self.s = s; self.H = H
        self.lh = lh or R(12 * s)
        self.th = th or R(12 * s)
        self.hs = hs or R(9 * s)
        self.tw = (tw or R(10 * s * w)) // 2 * 2
        self.td = td or R(6 * s * (0.5 + 0.5 * w))
        self.aw = aw or R(5 * s * w * bulk)
        self.lw = R(self.tw / 2)
        self.arm_h = arm_h or self.th
        self.sh = self.lh + self.th
        self.top = self.sh + self.hs
        self.acx = self.tw / 2 + self.aw / 2
        self.hand_y = self.sh - self.arm_h
        self.ua = max(3, R(self.arm_h * 0.5))            # upper-arm length
        self.elbow_y = self.sh - self.ua
        pb = parent_bone
        self.root = self.bone(self.n("root"), pb, (0, 0, 0)) if (pre or pb) else self.bone("root", None, (0, 0, 0))
        self.body = self.bone(self.n("body"), self.root, (0, self.lh, 0))
        self.head = self.bone(self.n("head"), self.body, (0, self.sh, 0))
        self.arm_l = self.bone(self.n("arm_l"), self.body, (self.acx, self.sh - 2, 0))
        self.arm_r = self.bone(self.n("arm_r"), self.body, (-self.acx, self.sh - 2, 0))
        self.farm_l = self.bone(self.n("farm_l"), self.arm_l, (self.acx, self.elbow_y, 0), rot=[-14, 0, 0])
        self.farm_r = self.bone(self.n("farm_r"), self.arm_r, (-self.acx, self.elbow_y, 0), rot=[-14, 0, 0])
        self.leg_l = self.bone(self.n("leg_l"), self.root, (self.lw / 2, self.lh, 0))
        self.leg_r = self.bone(self.n("leg_r"), self.root, (-self.lw / 2, self.lh, 0))
        self.base_done = False

    # ---------------------------------------------------------------- plumbing
    def n(self, base):
        return self.pre + base

    def bone(self, name, parent=None, pivot=(0, 0, 0), rot=None):
        p = list(pivot); p[1] += self.oy; p[2] += self.oz
        return super().bone(name, parent, tuple(p), rot)

    def box(self, bone, o, s, mat=None, rot=None, pivot=None, **kw):
        o = (o[0], o[1] + self.oy, o[2] + self.oz)
        if pivot is not None: pivot = [pivot[0], pivot[1] + self.oy, pivot[2] + self.oz]
        super().box(bone, o, s, mat, rot=rot, pivot=pivot, **kw)

    def pose_arm(self, side, upper=-8, fore=-14):
        """Rest pose of an arm (side 'l'/'r'): upper-arm and forearm bend."""
        up = self.arm_l if side == "l" else self.arm_r
        fo = self.farm_l if side == "l" else self.farm_r
        self.bones[up]["rot"] = [upper, 0, 0]
        self.bones[fo]["rot"] = [fore, 0, 0]

    # ---------------------------------------------------------------- body
    def base(self, skin="skin", cloth="cloth", armor="armor", trim="trim", arm_style="cloth", leg_style="cloth",
             torso_style="plate", boots=True, gauntlets=True, sleeves_slot=None):
        s, tw, td, th, lh, aw, sh = self.s, self.tw, self.td, self.th, self.lh, self.aw, self.sh
        b = self.body
        trimslot = trim if trim in self.pal else armor
        pel_h = R(3 * s); ch_h = R(7 * s); ab_h = max(2, th - pel_h - ch_h)
        y_ab = lh + pel_h; y_ch = y_ab + ab_h
        # --- torso: pelvis, abdomen, chest, pecs, back plate, neck, gorget
        self.box(b, (-(tw - 1) / 2, lh, -td / 2), (tw - 1, pel_h, td), M(cloth, "cloth", 2.4))
        self.box(b, (-(tw - 2) / 2, y_ab, -td / 2 + 0.5), (tw - 2, ab_h, td - 1), M(cloth if torso_style != "skin" else armor, "cloth" if torso_style != "skin" else "skin", 2.7))
        self.box(b, (-tw / 2, y_ch, -td / 2), (tw, ch_h, td), M(armor, torso_style, 3.0))
        for sgn in (1, -1):
            ox = 0.5 if sgn > 0 else -(tw / 2 - 0.5)
            self.box(b, (ox, y_ch + 1, -td / 2 - 1), (tw / 2 - 1, max(2, R(4 * s)), 1), M(armor, "plate" if torso_style != "skin" else "skin", 3.35))
        self.box(b, (-(tw - 2) / 2, y_ch, td / 2), (tw - 2, ch_h - 1, 1), M(armor, "plate" if torso_style != "skin" else "skin", 3.2))
        self.box(b, (-2, sh - 1, -2), (4, 2, 4), M(skin, "skin", 2.8))
        self.box(b, (-tw / 2 + 1, sh - 3, -td / 2 - 0.5), (tw - 2, 2, td + 1), M(trimslot, "plate", 3.0))
        # --- arms
        slot = sleeves_slot or cloth
        fa_h = max(2, self.elbow_y - (self.hand_y + 3))
        for side, up, fo in ((1, self.arm_l, self.farm_l), (-1, self.arm_r, self.farm_r)):
            ox = side * (tw / 2) if side > 0 else -(tw / 2) - aw
            self.box(up, (ox, self.elbow_y, -aw / 2), (aw, self.ua, aw), M(slot, arm_style, 3.0))
            self.box(up, (ox - 0.5, self.elbow_y + 1, -aw / 2 - 0.5), (aw + 1, 1, aw + 1), M(trimslot, "woven", 3.1))
            self.box(fo, (ox, self.hand_y + 3, -aw / 2), (aw, fa_h, aw), M(slot, arm_style, 2.8))
            self.box(fo, (ox - 0.5, self.elbow_y - 2, -aw / 2 - 1), (aw + 1, 2, aw + 1), M(armor if armor != skin else trimslot, "plate", 3.2))
            self.box(fo, (ox - 0.5, self.hand_y + 3, -aw / 2 - 0.5), (aw + 1, min(3, fa_h), aw + 1), M(trimslot, "woven", 3.0))
            hm = M(trimslot, "plate", 3.0) if gauntlets else M(skin, "skin", 3.0)
            self.box(fo, (ox, self.hand_y, -aw / 2), (aw, 3, aw), hm)
            self.box(fo, (ox + 0.5, self.hand_y + 1, -aw / 2 - 1), (max(1, aw - 1), 2, 1), M(trimslot if gauntlets else skin, "plate" if gauntlets else "skin", 3.4))
        self.pose_arm("l"); self.pose_arm("r")
        # --- legs
        if not self.has_legs:
            self.base_done = True
            return
        lw = self.lw
        boot_h = R(3 * s) if boots else 0
        th_h = max(3, R(lh * 0.5)); sh_h = lh - th_h - boot_h
        for side, bone in ((1, self.leg_l), (-1, self.leg_r)):
            ox = 0 if side > 0 else -lw
            self.box(bone, (ox, lh - th_h, -lw / 2), (lw, th_h, lw), M(cloth, leg_style, 2.8))
            self.box(bone, (ox - 0.5, lh - th_h + 1, -lw / 2 - 0.5), (lw + 1, 1, lw + 1), M("leather" if "leather" in self.pal else cloth, "leather", 2.6))
            if boots:
                self.box(bone, (ox, lh - th_h - 1, -lw / 2 - 1), (lw, 2, 1), M(armor, "plate", 3.3))
                self.box(bone, (ox + 0.5, boot_h, -lw / 2 + 0.5), (max(1, lw - 1), sh_h, max(1, lw - 1)), M(cloth, leg_style, 2.5))
                if sh_h > 3: self.box(bone, (ox + 0.5, boot_h + 1, -lw / 2 - 0.5), (max(1, lw - 1), sh_h - 2, 1), M(armor, "plate", 3.0))
                self.box(bone, (ox - 0.5, 0, -lw / 2 - 1), (lw + 1, boot_h, lw + 1), M(trimslot, "plate", 2.8))
                self.box(bone, (ox + 0.5, 0, -lw / 2 - 2.5), (max(1, lw - 1), 2, 2), M(trimslot, "plate", 3.1))
                self.box(bone, (ox - 0.5, boot_h, -lw / 2 - 0.5), (lw + 1, 1, lw + 1), M(trimslot, "woven", 3.0))
            else:
                self.box(bone, (ox + 0.5, 0, -lw / 2 + 0.5), (max(1, lw - 1), lh - th_h, max(1, lw - 1)), M(cloth, leg_style, 2.5))
        self.base_done = True

    # ---------------------------------------------------------------- heads
    def head_box(self, mat, inflate=0, y_off=0, size=None):
        hs = size or self.hs
        self.box(self.head, (-hs / 2, self.sh + y_off, -hs / 2), (hs, hs, hs), mat)

    def head_bare(self, skin="skin", hair=None, eyes="glow", beard=None, eye_y=None, brow=True):
        hs, sh = self.hs, self.sh
        ey = eye_y if eye_y is not None else R(hs * 0.45)
        self.head_box(dec(M(skin, "skin", 3.0), ("north", "eyes", eyes, ey)))
        self.box(self.head, (-1, sh + ey - 2, -hs / 2 - 1), (2, 2, 1), M(skin, "skin", 3.3))          # nose
        for sgn in (1, -1):                                                                        # ears
            self.box(self.head, (sgn * hs / 2 - (0 if sgn > 0 else -0), sh + ey - 1, -1), (1 if sgn > 0 else 1, 3, 2), M(skin, "skin", 2.6)) if False else \
                self.box(self.head, (hs / 2 if sgn > 0 else -hs / 2 - 1, sh + ey - 1, -1), (1, 3, 2), M(skin, "skin", 2.6))
        self.box(self.head, (-hs / 2 + 1, sh - 1, -hs / 2 - 0.5), (hs - 2, 2, 1), M(skin, "skin", 2.5))   # jaw
        if brow:
            self.box(self.head, (-hs / 2, sh + ey + 1, -hs / 2 - 0.5), (hs, 1, 1), M(hair or "dark", "flat", 2.2))
        if hair:
            self.box(self.head, (-hs / 2 - 0.5, sh + hs - 2, -hs / 2 - 0.5), (hs + 1, 3, hs + 1), M(hair, "fur", 2.8))
            self.box(self.head, (-hs / 2 - 0.5, sh + 1, hs / 2 - 0.5), (hs + 1, hs - 2, 2), M(hair, "fur", 2.4))
            for sgn in (1, -1):
                self.box(self.head, (hs / 2 - 0.5 if sgn > 0 else -hs / 2 - 0.5, sh + hs - 6, -hs / 2 + 1), (1, 5, 3), M(hair, "fur", 2.6))
        if beard:
            self.box(self.head, (-hs / 2 + 1, sh - 3, -hs / 2 - 1), (hs - 2, 4, 2), M(beard, "fur", 3.0))
            self.box(self.head, (-hs / 2 + 2, sh - 5, -hs / 2 - 1), (hs - 4, 2, 2), M(beard, "fur", 2.8))

    def head_helm(self, kind="great", metal="armor", eyes="glow", trim="trim", plume=None, crest=None, horns=None, skin="skin"):
        hs = self.hs; sh = self.sh
        ey = R(hs * 0.45)
        face = dec(M(metal, "plate", 3.0), ("north", "slit", ey, eyes), ("north", "visor", ey - 1, 1, "dark"))
        if kind == "great":
            self.head_box(face)
            self.box(self.head, (-hs / 2 - 1, sh + hs - 3, -hs / 2 - 1), (hs + 2, 3, hs + 2), M(metal, "plate", 3.4))
            self.box(self.head, (-1, sh + hs, -hs / 2 - 1), (2, 2, hs + 2), M(trim, "plate", 3.5))
            self.box(self.head, (-hs / 2 - 0.5, sh - 1, -hs / 2 - 1), (hs + 1, 2, 1), M(metal, "plate", 2.8))      # chin guard
            for sgn in (1, -1):
                self.box(self.head, (hs / 2 if sgn > 0 else -hs / 2 - 1, sh + 1, -hs / 2 + 1), (1, hs - 3, hs - 2), M(metal, "plate", 3.2))
            self.box(self.head, (-0.5, sh + 1, -hs / 2 - 1.5), (1, ey, 1), M(metal, "plate", 3.6))                  # nasal bar
        elif kind == "sallet":
            self.head_box(face)
            self.box(self.head, (-hs / 2 - 1, sh + hs - 2, -hs / 2 - 1), (hs + 2, 3, hs + 2), M(metal, "plate", 3.3))
            self.box(self.head, (-hs / 2 - 1, sh - 2, hs / 2 - 1), (hs + 2, hs, 2), M(metal, "plate", 2.8))
            self.box(self.head, (-hs / 2, sh + hs - 4, -hs / 2 - 1.5), (hs, 1, 1), M(trim, "plate", 3.4))
        elif kind == "open":
            self.head_box(dec(M(skin, "skin", 3.0), ("north", "eyes", eyes, ey)))
            self.box(self.head, (-hs / 2 - 1, sh + hs - 3, -hs / 2 - 1), (hs + 2, 4, hs + 2), M(metal, "plate", 3.2))
            self.box(self.head, (-1, sh + 2, -hs / 2 - 2), (2, hs - 3, 1), M(metal, "plate", 3.0))
            self.box(self.head, (-1, sh + ey - 2, -hs / 2 - 1), (2, 2, 1), M(skin, "skin", 3.3))
            for sgn in (1, -1):
                self.box(self.head, (hs / 2 if sgn > 0 else -hs / 2 - 1, sh, -hs / 2 + 1), (1, hs - 3, 3), M(metal, "plate", 3.0))
        elif kind in ("hood", "hood_open"):
            if kind == "hood":
                self.head_box(dec(M(skin, "skin", 2.6), ("north", "eyes", eyes, ey)))
                self.box(self.head, (-hs / 2 - 1, sh - 1, -hs / 2 - 1), (hs + 2, hs + 2, hs + 3), M(metal, "cloth", 2.4))
                self.box(self.head, (-hs / 2 + 1, sh + hs - 1, -hs / 2 - 2), (hs - 2, hs - 2, 1), M("dark", "flat", 2.0, decals=[("north", "eyes", eyes, ey - 1)]))
            else:
                self.head_box(dec(M(skin, "skin", 3.0), ("north", "eyes", eyes, ey)))
                self.box(self.head, (-hs / 2 - 1, sh + hs - 1, -hs / 2 - 1), (hs + 2, 3, hs + 3), M(metal, "cloth", 2.8))
                self.box(self.head, (-hs / 2 - 1, sh - 1, hs / 2), (hs + 2, hs, 2), M(metal, "cloth", 2.4))
                for sgn in (1, -1):
                    self.box(self.head, (sgn * hs / 2 - (0 if sgn > 0 else 1), sh - 1, -hs / 2 - 1), (1, hs - 1, hs + 3), M(metal, "cloth", 2.6))
            self.box(self.head, (-1, sh + hs + 1, hs / 2), (2, 3, 3), M(metal, "cloth", 2.9))                        # hood peak
        elif kind == "skull":
            f = dec(M("bone", "bone", 3.4), ("north", "eyes", eyes, ey), ("north", "teeth", R(hs * 0.18)))
            self.head_box(f)
            self.box(self.head, (-hs / 2 + 1, sh - 2, -hs / 2 - 0.5), (hs - 2, 2, hs - 1), M("bone", "bone", 3.0))   # jaw
            self.box(self.head, (-hs / 2, sh + ey + 1, -hs / 2 - 1), (hs, 1, 1), M("bone", "bone", 2.6))              # brow
        if plume:
            self.box(self.head, (-1, sh + hs, -hs / 2), (2, 3, hs), M(plume, "cloth", 3.0))
            self.box(self.head, (-1, sh + hs + 2, hs / 2 - 1), (2, 4, 3), M(plume, "cloth", 2.8))
            self.box(self.head, (-1, sh + hs + 3, hs / 2 + 1), (2, 3, 2), M(plume, "cloth", 2.6))
        if crest:
            for i in range(4):
                self.box(self.head, (-1, sh + hs + i, -hs / 2 + 1 + i * 2), (2, 4 - i, 2), M(crest, "plate", 3.5))
        if horns:
            self.horns(horns)

    def horns(self, slot, size=1.0, out=True, curve=True):
        hs = self.hs; sh = self.sh
        L = R(hs * 0.55 * size)
        for sgn in (1, -1):
            x0 = sgn * hs / 2
            ox = x0 - (0 if sgn > 0 else 2)
            self.box(self.head, (ox, sh + hs - 2, -1), (2, 2, 2), M(slot, "bone", 3.0))
            self.box(self.head, (ox + sgn * 1, sh + hs - 1, -1), (2, L, 2), M(slot, "bone", 3.4), rot=[0, 0, -sgn * 25], pivot=[x0, sh + hs - 1, 0])
            self.box(self.head, (ox + sgn * 1 + 0.5, sh + hs - 1 + L, -0.5), (1, max(2, R(L * 0.6)), 1), M(slot, "bone", 4.0), rot=[0, 0, -sgn * 25], pivot=[x0, sh + hs - 1, 0])

    # ---------------------------------------------------------------- armour pieces
    def pauldrons(self, kind="round", slot="armor", spikes=None, trim="trim", skull=False, size=1.0):
        aw = self.aw; s = self.s; tw = self.tw
        pw = R((aw + 3) * size); ph = R(3 * s * size)
        for side, bone in ((1, self.arm_l), (-1, self.arm_r)):
            ox = side * tw / 2 - (pw - aw) / 2 if side > 0 else -tw / 2 - aw - (pw - aw) / 2
            y = self.sh - ph + 1
            mat = M(slot, "plate", 3.2)
            if skull: mat = dec(mat, ("north", "skull", "bone"))
            self.box(bone, (ox, y, -pw / 2), (pw, ph, pw), mat)
            self.box(bone, (ox + 1, y + ph, -pw / 2 + 1), (pw - 2, 1, pw - 2), M(trim, "plate", 3.6))
            self.box(bone, (ox - 0.5, y - 2, -pw / 2 - 0.5), (pw + 1, 2, pw + 1), M(slot, "plate", 2.8))       # lower lame
            self.box(bone, (ox + 1, y - 3, -pw / 2 + 0.5), (pw - 2, 1, pw - 1), M(trim, "woven", 3.0))
            if spikes:
                for k in range(spikes):
                    self.box(bone, (ox + pw / 2 - 1 + side * 0.5, y + ph + 1, -pw / 2 + 1 + k * 2 if spikes > 1 else -0.5), (1, 2 + k % 2, 1), M(trim, "bone", 3.8))

    def fur_collar(self, slot="fur"):
        tw = self.tw; td = self.td
        self.box(self.body, (-tw / 2 - 1, self.sh - 3, -td / 2 - 1), (tw + 2, 3, td + 2), M(slot, "fur", 3.0))
        for sgn in (1, -1):
            self.box(self.body, (sgn * tw / 2 - (0 if sgn > 0 else 3), self.sh - 1, -td / 2 - 1), (3, 2, td + 2), M(slot, "fur", 3.2))
        self.box(self.body, (-tw / 2 + 1, self.sh - 5, -td / 2 - 1.5), (tw - 2, 2, 1), M(slot, "fur", 2.8))

    def belt(self, slot="leather", buckle="trim", skull=False, y_off=0):
        tw, td, lh, s = self.tw, self.td, self.lh, self.s
        y = lh + R(2 * s) + y_off
        self.box(self.body, (-tw / 2 - 0.5, y, -td / 2 - 0.5), (tw + 1, 2, td + 1), M(slot, "leather", 2.6))
        bm = M(buckle, "plate", 3.8)
        if skull: bm = dec(bm, ("north", "skull", "bone"))
        self.box(self.body, (-2, y, -td / 2 - 1.5), (4, 3, 1), bm)
        for sgn in (1, -1):    # pouches + hanging straps
            self.box(self.body, (sgn * (tw / 2 - 1) - (0 if sgn > 0 else 3), y - 2, -td / 2 - 1), (3, 3, 2), M(slot, "leather", 2.9))
            self.box(self.body, (sgn * 3 - (0 if sgn > 0 else 1), y - 4, -td / 2 - 1), (1, 4, 1), M(slot, "leather", 2.4))

    def loincloth(self, slot="fur", length=None, trim="trim"):
        tw, td, lh = self.tw, self.td, self.lh
        L = length or R(6 * self.s)
        y = lh + R(2 * self.s)
        self.box(self.body, (-tw / 2 + 2, y - L, -td / 2 - 1.5), (tw - 4, L, 1), M(slot, "fur", 3.0))
        self.box(self.body, (-tw / 2 + 2, y - L, td / 2 + 0.5), (tw - 4, L - 1, 1), M(slot, "fur", 2.7))
        self.box(self.body, (-tw / 2 + 2, y - 1, -td / 2 - 1.5), (tw - 4, 1, 1), M(trim if trim in self.pal else slot, "woven", 3.2))

    def strap_cross(self, slot="leather", metal="metal"):
        """Diagonal bandolier across the chest (like the Cyclops' strap)."""
        tw, td, sh, th, s = self.tw, self.td, self.sh, self.th, self.s
        L = R(th * 0.8)
        self.box(self.body, (-1, sh - L - 1, -td / 2 - 1.5), (2, L, 1), M(slot, "leather", 2.5), rot=[0, 0, 38], pivot=[0, sh - L / 2 - 1, -td / 2])
        self.box(self.body, (-0.5, sh - th * 0.55, -td / 2 - 2), (1, 1, 1), M(metal, "plate", 3.8))

    def tabard(self, slot="cloth", trim="trim", emblem=None, length=None):
        tw, td, lh = self.tw, self.td, self.lh
        L = length or R(7 * self.s)
        mat = M(slot, "cloth", 3.0)
        if emblem: mat = dec(mat, ("north", emblem, trim))
        self.box(self.body, (-tw / 2 + 2, lh - L + 3, -td / 2 - 1.5), (tw - 4, L, 1), mat)
        self.box(self.body, (-tw / 2 + 2, lh + 3, td / 2 + 0.5), (tw - 4, L - 3, 1), M(slot, "cloth", 2.6))
        self.box(self.body, (-tw / 2 + 2, lh - L + 3, -td / 2 - 1.5), (tw - 4, 1, 1), M(trim, "woven", 3.3))
        self.box(self.body, (-tw / 2 + 3, lh - L + 2, -td / 2 - 1.5), (tw - 6, 1, 1), M(slot, "cloth", 2.3))

    def skirt(self, slot="cloth", length=None, widen=2, trim=None):
        if self.n("skirt") not in self.bones:
            self.bone(self.n("skirt"), self.body, (0, self.lh + 2, 0))
        tw, td = self.tw, self.td
        L = length or R(9 * self.s)
        k = self.n("skirt")
        top = R(L * 0.45)
        self.box(k, (-tw / 2 - widen / 4, self.lh + 2 - top, -td / 2 - widen / 4), (tw + widen / 2, top, td + widen / 2), M(slot, "cloth", 2.9))
        self.box(k, (-tw / 2 - widen / 2, self.lh + 2 - L, -td / 2 - widen / 2), (tw + widen, L - top, td + widen), M(slot, "cloth", 2.7))
        self.box(k, (-tw / 2 - widen / 2 - 0.5, self.lh + 2 - L, -td / 2 - widen / 2 - 0.5), (tw + widen + 1, 1, td + widen + 1), M(trim or slot, "woven" if trim else "cloth", 3.4 if trim else 2.2))
        if trim:
            self.box(k, (-tw / 2 - widen / 4 - 0.5, self.lh + 2 - top, -td / 2 - widen / 4 - 0.5), (tw + widen / 2 + 1, 1, td + widen / 2 + 1), M(trim, "plate", 3.3))

    def cape(self, slot="cloth", length=None, trim=None, half=False):
        if self.n("cape") not in self.bones:
            self.bone(self.n("cape"), self.body, (0, self.sh - 1, self.td / 2 + 1))
        k = self.n("cape")
        L = length or R(self.th * 1.5)
        tw, td = self.tw, self.td
        up = R(L * 0.45)
        self.box(k, (-tw / 2, self.sh - 1 - up, td / 2), (tw, up, 1), M(slot, "cloth", 2.7))
        self.box(k, (-tw / 2 + 1, self.sh - 1 - L, td / 2 + 0.5), (tw - 2, L - up, 1), M(slot, "cloth", 2.5))
        self.box(k, (-tw / 2 - 1, self.sh - 2, td / 2 - 1), (tw + 2, 2, 2), M(trim or slot, "plate", 3.3))
        if trim:
            self.box(k, (-tw / 2 + 1, self.sh - 1 - L, td / 2 + 0.5), (tw - 2, 1, 1), M(trim, "woven", 3.4))

    def backpack(self, slot="leather", size=(6, 8, 3)):
        self.box(self.body, (-size[0] / 2, self.lh + 2, self.td / 2), size, M(slot, "leather", 2.6))
        self.box(self.body, (-size[0] / 2 - 0.5, self.lh + 2 + size[1] - 2, self.td / 2 - 0.5), (size[0] + 1, 2, size[2] + 1), M(slot, "leather", 3.0))

    def thigh_plates(self, slot="armor"):
        for side, bone in ((1, self.leg_l), (-1, self.leg_r)):
            ox = 0 if side > 0 else -self.lw
            self.box(bone, (ox - 0.5, self.lh - 6 * self.s, -self.lw / 2 - 1), (self.lw + 1, R(5 * self.s), self.lw + 2), M(slot, "plate", 3.1))

    def claws(self, slot="bone"):
        for side, bone in ((1, self.leg_l), (-1, self.leg_r)):
            ox = 0 if side > 0 else -self.lw
            for k in range(3):
                self.box(bone, (ox + 0.5 + k * max(1, (self.lw - 2) // 2), 0, -self.lw / 2 - 4), (1, 1, 2), M(slot, "bone", 3.9))
        for side, bone in ((1, self.farm_l), (-1, self.farm_r)):
            ox = side * (self.tw / 2) if side > 0 else -(self.tw / 2) - self.aw
            for k in range(3):
                self.box(bone, (ox + 0.5 + k * max(1, (self.aw - 2) // 2), self.hand_y - 1, -self.aw / 2 - 1), (1, 2, 1), M(slot, "bone", 3.9))

    # ---------------------------------------------------------------- weapons (held in the hand, blade tilted forward)
    def _wbone(self, hand="r", kind="sword"):
        name = self.n("weapon_" + hand)
        if name not in self.bones:
            parent = self.farm_r if hand == "r" else self.farm_l
            sx = -self.acx if hand == "r" else self.acx
            self.bone(name, parent, (sx, self.hand_y + 2, 0))
        return name

    def weapon(self, kind, hand="r", slot="metal", grip="leather", trim="trim", length=None, glow=None, rest=None, wrot=None):
        tilt, fore = HOLD.get(kind, (48, -52))
        wb = self._wbone(hand, kind)
        up = self.arm_r if hand == "r" else self.arm_l
        fo = self.farm_r if hand == "r" else self.farm_l
        self.bones[up]["rot"] = [-10, 0, 0]
        self.bones[fo]["rot"] = [fore, 0, 0]
        # an upright blade tilts FORWARD for a positive total x-rotation: upper + forearm + local = +tilt
        self.bones[wb]["rot"] = [tilt - (-10 + fore) if wrot is None else wrot, 0, 0]
        sx = -self.acx if hand == "r" else self.acx
        hy = self.hand_y
        s = self.s
        gx = sx - 0.5
        gz = -0.5
        L = length or R(18 * s)
        wrap = M(grip, "leather", 2.3)
        if kind == "sword":
            self.box(wb, (gx, hy - 3, gz), (1, 7, 1), wrap)
            self.box(wb, (gx - 0.5, hy - 4, gz - 0.5), (2, 1, 2), M(trim, "plate", 3.6))                       # pommel
            self.box(wb, (gx - 2.5, hy + 4, gz - 1), (6, 1, 3), M(trim, "plate", 3.6))                        # guard
            self.box(wb, (gx - 3, hy + 3, gz - 0.5), (1, 2, 2), M(trim, "plate", 3.2)); self.box(wb, (gx + 3, hy + 3, gz - 0.5), (1, 2, 2), M(trim, "plate", 3.2))
            self.box(wb, (gx - 0.5, hy + 5, gz - 0.5), (2, L, 2), M(slot, "metal", 3.5))
            self.box(wb, (gx, hy + 5 + L, gz), (1, 2, 1), M(slot, "metal", 4.2))
            self.box(wb, (gx, hy + 6, gz - 1), (1, L - 2, 1), M(glow or slot, "glow" if glow else "metal", 4.5 if glow else 2.6))   # fuller
        elif kind == "greatsword":
            L = R(26 * s)
            self.box(wb, (gx, hy - 5, gz), (1, 10, 1), wrap)
            self.box(wb, (gx - 0.5, hy - 6, gz - 0.5), (2, 2, 2), M(trim, "plate", 3.6))
            self.box(wb, (gx - 3.5, hy + 5, gz - 1.5), (8, 2, 4), M(trim, "plate", 3.6))
            self.box(wb, (gx - 4.5, hy + 4, gz - 1), (1, 4, 3), M(trim, "plate", 3.2)); self.box(wb, (gx + 4.5, hy + 4, gz - 1), (1, 4, 3), M(trim, "plate", 3.2))
            self.box(wb, (gx - 1, hy + 7, gz - 1), (3, L, 2), M(slot, "metal", 3.4))
            self.box(wb, (gx - 0.5, hy + 7 + L, gz - 0.5), (2, 3, 1), M(slot, "metal", 4.2))
            self.box(wb, (gx, hy + 8, gz - 2), (1, L - 3, 1), M(glow or slot, "glow" if glow else "metal", 4.5 if glow else 2.6))
        elif kind == "axe":
            self.box(wb, (gx, hy - 4, gz), (1, L + 2, 1), M(grip, "wood", 2.8))
            self.box(wb, (gx - 0.5, hy - 5, gz - 0.5), (2, 1, 2), M(trim, "plate", 3.4))
            self.box(wb, (gx - 5, hy + L - 6, gz - 1), (6, 6, 3), M(slot, "metal", 3.3))
            self.box(wb, (gx + 1, hy + L - 4, gz - 0.5), (2, 3, 2), M(slot, "metal", 3.0))
            self.box(wb, (gx - 6, hy + L - 5, gz - 0.5), (1, 4, 2), M(slot, "metal", 4.1))
            self.box(wb, (gx, hy + L + 2, gz - 0.5), (1, 2, 2), M(slot, "metal", 3.8))
        elif kind == "greataxe":
            L = R(24 * s)
            self.box(wb, (gx, hy - 5, gz), (1, L, 1), M(grip, "wood", 2.8))
            for sgn in (1, -1):
                ox = gx - 6 if sgn > 0 else gx + 1
                self.box(wb, (ox, hy + L - 11, gz - 1), (6, 8, 3), M(slot, "metal", 3.3))
                self.box(wb, (ox + (-1 if sgn > 0 else 6), hy + L - 10, gz - 0.5), (1, 6, 2), M(slot, "metal", 4.1))
            self.box(wb, (gx - 1, hy + L - 4, gz - 1), (3, 3, 2), M(trim, "plate", 3.6))
            self.box(wb, (gx, hy + L - 1, gz - 0.5), (1, 3, 1), M(slot, "metal", 4.0))
        elif kind == "hammer":
            self.box(wb, (gx, hy - 4, gz), (1, L, 1), M(grip, "wood", 2.8))
            self.box(wb, (gx - 3.5, hy + L - 6, gz - 2.5), (8, 6, 6), M(slot, "metal", 3.1))
            self.box(wb, (gx - 3.5, hy + L - 6, gz - 2.5), (8, 1, 6), M(trim, "plate", 3.6))
            self.box(wb, (gx - 3.5, hy + L - 1, gz - 2.5), (8, 1, 6), M(trim, "plate", 3.6))
            self.box(wb, (gx - 0.5, hy + L, gz - 0.5), (2, 3, 2), M(slot, "metal", 3.8))
        elif kind == "spear":
            L = R(34 * s)
            self.box(wb, (gx, hy - 8, gz), (1, L, 1), M(grip, "wood", 2.8))
            self.box(wb, (gx - 1, hy - 8 + L, gz - 1), (3, 4, 2), M(slot, "metal", 3.5))
            self.box(wb, (gx - 0.5, hy - 8 + L + 4, gz - 0.5), (2, 3, 1), M(slot, "metal", 4.0))
            self.box(wb, (gx, hy - 8 + L + 7, gz), (1, 2, 1), M(slot, "metal", 4.4))
            self.box(wb, (gx - 1.5, hy - 8 + L - 2, gz - 1), (4, 1, 2), M(trim, "plate", 3.5))
            self.box(wb, (gx - 0.5, hy - 9, gz - 0.5), (2, 1, 2), M(slot, "metal", 3.0))
        elif kind == "staff":
            L = R(36 * s)
            self.box(wb, (gx, hy - 10, gz), (1, L, 1), M(grip, "wood", 2.6))
            col = glow or trim
            self.box(wb, (gx - 1.5, hy - 10 + L, gz - 1), (4, 4, 3), M(col, "glow", 4.0))
            self.box(wb, (gx - 2.5, hy - 10 + L - 2, gz - 1.5), (6, 1, 4), M(trim, "plate", 3.4))
            self.box(wb, (gx - 0.5, hy - 10 + L - 4, gz - 0.5), (2, 2, 1), M(trim, "plate", 3.2))
        elif kind == "mace":
            self.box(wb, (gx, hy - 3, gz), (1, L - 4, 1), M(grip, "wood", 2.8))
            self.box(wb, (gx - 2, hy + L - 8, gz - 2), (5, 5, 5), M(slot, "metal", 3.2))
            for dx, dz in ((-3, 0), (3, 0), (0, -3), (0, 3)):
                self.box(wb, (gx + dx - (0 if dx == 0 else 0.5) + (0.5 if dx == 0 else 0), hy + L - 6, gz + dz - 0.5), (1, 1, 1), M(slot, "metal", 4.0))
        elif kind == "cleaver":
            self.box(wb, (gx, hy - 3, gz), (1, 7, 1), wrap)
            self.box(wb, (gx - 1.5, hy + 4, gz - 0.5), (4, L, 2), M(slot, "metal", 3.2))
            self.box(wb, (gx - 2.5, hy + 4 + L - 5, gz - 0.5), (1, 5, 2), M(slot, "metal", 3.9))
        elif kind == "scythe":
            L = R(30 * s)
            self.box(wb, (gx, hy - 8, gz), (1, L, 1), M(grip, "wood", 2.6))
            self.box(wb, (gx - 1, hy - 8 + L - 1, gz - 0.5), (3, 2, 2), M(slot, "metal", 3.6))
            self.box(wb, (gx - 6, hy - 8 + L, gz - 0.5), (7, 2, 1), M(slot, "metal", 3.9))
            self.box(wb, (gx - 8, hy - 8 + L - 3, gz - 0.5), (3, 3, 1), M(slot, "metal", 4.2))
        elif kind == "dagger":
            self.box(wb, (gx, hy - 2, gz), (1, 5, 1), wrap)
            self.box(wb, (gx - 1.5, hy + 3, gz - 0.5), (4, 1, 2), M(trim, "plate", 3.5))
            self.box(wb, (gx - 0.5, hy + 4, gz - 0.5), (2, R(9 * s), 1), M(slot, "metal", 3.9))
        return wb

    def shield(self, kind="kite", slot="armor", trim="trim", emblem=None, hand="l"):
        fo = self.farm_l if hand == "l" else self.farm_r
        name = self.n("shield_" + hand)
        sx = self.acx if hand == "l" else -self.acx
        if name not in self.bones:
            self.bone(name, fo, (sx, self.hand_y + 4, 0))
        self.bones[self.arm_l if hand == "l" else self.arm_r]["rot"] = [-14, 0, 0]
        self.bones[fo]["rot"] = [-46, 0, 0]
        s = self.s
        z = -self.aw / 2 - 3
        mat = M(slot, "plate", 3.1)
        if emblem: mat = dec(mat, ("north", emblem, trim))
        cx = sx - 0.5
        if kind == "kite":
            h = R(14 * s)
            self.box(name, (cx - 4, self.hand_y - 2, z), (9, h, 2), mat)
            self.box(name, (cx - 3, self.hand_y - 4, z), (7, 2, 2), mat)
            self.box(name, (cx - 1.5, self.hand_y - 6, z), (3, 2, 2), mat)
            self.box(name, (cx - 5, self.hand_y - 2 + h - 1, z - 0.5), (11, 1, 3), M(trim, "plate", 3.5))
            self.box(name, (cx - 5, self.hand_y - 2, z - 0.5), (1, h, 3), M(trim, "plate", 3.2)); self.box(name, (cx + 5, self.hand_y - 2, z - 0.5), (1, h, 3), M(trim, "plate", 3.2))
            self.box(name, (cx - 1, self.hand_y + 3, z - 1.5), (3, 3, 1), M(trim, "plate", 3.8))
        elif kind == "round":
            self.box(name, (cx - 4, self.hand_y, z), (9, 9, 2), mat)
            self.box(name, (cx - 5, self.hand_y + 2, z - 0.5), (11, 5, 3), M(slot, "plate", 3.0))
            self.box(name, (cx - 1, self.hand_y + 3, z - 1.5), (3, 3, 1), M(trim, "plate", 3.8))
            self.box(name, (cx - 5, self.hand_y + 2, z - 1), (1, 5, 1), M(trim, "plate", 3.3)); self.box(name, (cx + 5, self.hand_y + 2, z - 1), (1, 5, 1), M(trim, "plate", 3.3))
        elif kind == "tower":
            h = R(18 * s)
            self.box(name, (cx - 5, self.hand_y - 4, z), (11, h, 2), mat)
            self.box(name, (cx - 5, self.hand_y - 4, z - 1), (11, 1, 1), M(trim, "plate", 3.5))
            self.box(name, (cx - 5, self.hand_y - 4 + h - 1, z - 1), (11, 1, 1), M(trim, "plate", 3.5))
            self.box(name, (cx - 6, self.hand_y - 4, z - 0.5), (1, h, 2), M(trim, "plate", 3.2)); self.box(name, (cx + 6, self.hand_y - 4, z - 0.5), (1, h, 2), M(trim, "plate", 3.2))
            self.box(name, (cx - 1.5, self.hand_y - 4 + h / 2 - 1, z - 1.5), (4, 3, 1), M(trim, "plate", 3.8))
        elif kind == "buckler":
            self.box(name, (cx - 3, self.hand_y + 1, z), (7, 7, 2), mat)
            self.box(name, (cx - 1, self.hand_y + 3, z - 1), (3, 3, 1), M(trim, "plate", 3.8))
            self.box(name, (cx - 4, self.hand_y + 2, z - 0.5), (1, 5, 2), M(trim, "plate", 3.2)); self.box(name, (cx + 4, self.hand_y + 2, z - 0.5), (1, 5, 2), M(trim, "plate", 3.2))

    # ---------------------------------------------------------------- extras (always attached to the body)
    def wings(self, kind="feather", slot="cloth", trim=None, span=None, rot=14):
        span = span or R(20 * self.s)
        for side, nm in ((1, self.n("wing_l")), (-1, self.n("wing_r"))):
            self.bone(nm, self.body, (side * 2, self.sh - 3, self.td / 2))
            z = self.td / 2 + 1
            ox = 1 if side > 0 else -1 - span
            self.box(nm, (side * 1 - 1, self.sh - 8, self.td / 2), (3, 8, 2), M(trim or slot, "plate", 3.0))      # shoulder mount
            if kind == "feather":
                for i in range(4):
                    w = span - i * 2
                    x = ox if side > 0 else ox + (span - w)
                    self.box(nm, (x, self.sh - 5 - i * 4, z), (w, 4, 1), M(slot, "stripes", 3.0 + i * 0.15))
                self.box(nm, (ox, self.sh - 2, z - 0.5), (span, 2, 2), M(trim or slot, "plate", 3.2))
            elif kind == "bat":
                self.box(nm, (ox, self.sh - 3, z), (span, 2, 1), M(slot, "plate", 3.0))
                for i in range(3):
                    w = span - 2 - i * 3
                    x = ox + (1 if side > 0 else span - w - 1)
                    self.box(nm, (x, self.sh - 5 - i * 4, z), (w, 4, 1), M(slot, "cloth", 2.6))
                for k in range(3):
                    self.box(nm, (ox + (k * span / 3) if side > 0 else ox + span - 1 - k * span / 3, self.sh - 16, z - 0.5), (1, 14, 1), M(trim or slot, "bone", 3.2))
            elif kind == "insect":
                self.box(nm, (ox, self.sh - 9, z), (span, 10, 1), M(slot, "ice", 3.4))
                self.box(nm, (ox + (2 if side > 0 else 0), self.sh - 15, z), (span - 2, 6, 1), M(slot, "ice", 3.0))
            self.bones[nm]["rot"] = [0, side * -rot, 0]

    def tail(self, slot="skin", length=10, style="skin", segs=3, thick=3):
        k = self.n("tail")
        self.bone(k, self.body, (0, self.lh + 2, self.td / 2))
        z = self.td / 2
        for i in range(segs):
            t = max(1, thick - i)
            self.box(k, (-t / 2, self.lh + 1 - i * 1.0, z + i * (length / segs)), (t, t, length / segs + 1), M(slot, style, 3.0 - i * 0.1))
        self.box(k, (-0.5, self.lh + 1 - segs, z + length), (1, 2, 2), M(slot, "bone", 3.8))

    def halo(self, *a, **k):
        pass   # removed on purpose: no floating parts

    def floaters(self, slot="glow", n=3, r=11, y=None):
        """Attached crystal studs on the shoulder line instead of floating orbs."""
        for sgn in (1, -1):
            self.box(self.body, (sgn * (self.tw / 2 + 1) - 1.5, self.sh - 2, self.td / 2 - 1), (3, 5, 3), M(slot, "glow", 3.8), rot=[0, 0, -sgn * 15], pivot=[sgn * (self.tw / 2 + 1), self.sh - 2, self.td / 2])

    def spikes_back(self, slot="bone", n=3):
        for i in range(n):
            y = self.lh + self.th - 3 - i * 3 * self.s
            self.box(self.body, (-1, y, self.td / 2), (2, 2, 2 + (n - i) % 3 + 1), M(slot, "bone", 3.4))

    def flames_on(self, bone, slot="flame", w=4, h=8, n=3, at=(0, 0, 0)):
        for i in range(n):
            self.box(bone, (at[0] - w / 2 + i * 1.5 - 1.5, at[1] + i % 2 * 2, at[2] - w / 2), (w - i, h - i * 2, w - i), M(slot, "flame", 3.2))
