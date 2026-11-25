"""Humanoid rig + feature kit for the unified chunky style."""
from .core import Model, Palette

def M(slot, style="plate", tone=3.0, **kw):
    d = {"slot": slot, "style": style, "tone": tone}
    d.update(kw)
    return d

def dec(mat, *decals):
    m = dict(mat); m["decals"] = list(mat.get("decals", ())) + list(decals)
    return m

def R(v):  # round to int >=1
    return max(1, int(round(v)))


class Humanoid(Model):
    """Skeleton: root > body > head, arm_l, arm_r (+weapon_*), cape; root > leg_l, leg_r."""

    def __init__(self, ident, pal, H=32, w=1.0, hs=None, arm_h=None, bulk=1.0, shoulder=0, pre="", oy=0.0, oz=0.0, parent_bone=None, legs=True, lh=None, th=None, tw=None, td=None, aw=None):
        super().__init__(ident, pal)
        self.pre = pre; self.oy = oy; self.oz = oz; self.has_legs = legs
        s = H / 32.0
        self.lh = lh or R(12 * s)
        self.th = th or R(12 * s)
        self.hs = hs or R(9 * s)
        self.tw = (tw or R(10 * s * w)) // 2 * 2
        self.td = td or R(6 * s * (0.5 + 0.5 * w))
        self.aw = aw or R(5 * s * w * bulk)
        self.lw = R(self.tw / 2)
        self.arm_h = arm_h or self.th
        self.H = H
        self.s = s
        self.sh = self.lh + self.th          # shoulder line y
        self.top = self.sh + self.hs
        self.acx = self.tw / 2 + self.aw / 2  # arm centre |x|
        self.hand_y = self.sh - self.arm_h
        self.arm_rot = None
        pb = parent_bone
        self.root = self.bone(self.n("root"), pb, (0, 0, 0)) if (pre or pb) else self.bone("root", None, (0, 0, 0))
        self.body = self.bone(self.n("body"), self.root, (0, self.lh, 0))
        self.head = self.bone(self.n("head"), self.body, (0, self.sh, 0))
        self.arm_l = self.bone(self.n("arm_l"), self.body, (self.acx, self.sh - 2, 0))
        self.arm_r = self.bone(self.n("arm_r"), self.body, (-self.acx, self.sh - 2, 0))
        self.leg_l = self.bone(self.n("leg_l"), self.root, (self.lw / 2, self.lh, 0))
        self.leg_r = self.bone(self.n("leg_r"), self.root, (-self.lw / 2, self.lh, 0))
        self.shoulder_extra = shoulder
        self.cm = {}   # default material set
        self.base_done = False

    def n(self, base):
        return self.pre + base

    def bone(self, name, parent=None, pivot=(0, 0, 0), rot=None):
        p = list(pivot); p[1] += self.oy; p[2] += self.oz
        return super().bone(name, parent, tuple(p), rot)

    def box(self, bone, o, s, mat=None, rot=None, pivot=None, **kw):
        o = (o[0], o[1] + self.oy, o[2] + self.oz)
        if pivot is not None: pivot = [pivot[0], pivot[1] + self.oy, pivot[2] + self.oz]
        super().box(bone, o, s, mat, rot=rot, pivot=pivot, **kw)

    # ------------------------------------------------------------- base body
    def base(self, skin="skin", cloth="cloth", armor="armor", trim="trim", arm_style="cloth", leg_style="cloth",
             torso_style="plate", boots=True, gauntlets=True, sleeves_slot=None):
        tw, td, th, lh, aw = self.tw, self.td, self.th, self.lh, self.aw
        b = self.body
        # torso: chest + abdomen
        self.box(b, (-tw / 2, lh + 3 * self.s, -td / 2), (tw, th - 3 * self.s, td), M(armor, torso_style))
        self.box(b, (-tw / 2 + 1, lh, -td / 2 + 0.5), (tw - 2, R(3 * self.s), td - 1), M(cloth, "cloth", 2.5))
        # arms
        for side, bone in ((1, self.arm_l), (-1, self.arm_r)):
            ox = side * (tw / 2) if side > 0 else -(tw / 2) - aw
            slot = sleeves_slot or cloth
            self.box(bone, (ox, self.hand_y + R(3 * self.s), -aw / 2), (aw, self.arm_h - R(3 * self.s), aw), M(slot, arm_style, 3.0))
            if gauntlets:
                self.box(bone, (ox - 0.5, self.hand_y, -aw / 2 - 0.5), (aw + 1, R(3 * self.s), aw + 1), M(trim if trim in self.pal else armor, "plate", 3.0))
            else:
                self.box(bone, (ox, self.hand_y, -aw / 2), (aw, R(3 * self.s), aw), M(skin, "skin"))
        # legs
        lw = self.lw
        if not self.has_legs:
            return self._finish_base()
        for side, bone in ((1, self.leg_l), (-1, self.leg_r)):
            ox = 0 if side > 0 else -lw
            self.box(bone, (ox, R(3 * self.s) if boots else 0, -lw / 2), (lw, lh - (R(3 * self.s) if boots else 0), lw), M(cloth, leg_style, 2.8))
            if boots:
                self.box(bone, (ox - 0.5, 0, -lw / 2 - 1.5), (lw + 1, R(3 * self.s), lw + 2), M(trim if trim in self.pal else armor, "plate", 2.5))
        return self._finish_base()

    def _finish_base(self):
        self.base_done = True

    # ------------------------------------------------------------- heads
    def head_box(self, mat, inflate=0, y_off=0, size=None):
        hs = size or self.hs
        self.box(self.head, (-hs / 2, self.sh + y_off, -hs / 2), (hs, hs, hs), mat)

    def head_bare(self, skin="skin", hair=None, eyes="glow", beard=None, eye_y=None, brow=True):
        hs = self.hs
        ey = eye_y if eye_y is not None else R(hs * 0.45)
        decals = [("north", "eyes", eyes, ey)]
        if beard: pass
        self.head_box(dec(M(skin, "skin", 3.0), *decals))
        if hair:
            self.box(self.head, (-hs / 2 - 0.5, self.sh + hs - 2, -hs / 2 - 0.5), (hs + 1, 3, hs + 1), M(hair, "flat", 2.6))
            self.box(self.head, (-hs / 2 - 0.5, self.sh + 1, hs / 2 - 0.5), (hs + 1, hs - 2, 2), M(hair, "flat", 2.4))
        if beard:
            self.box(self.head, (-hs / 2 + 1, self.sh - 3, -hs / 2 - 1), (hs - 2, 4, 2), M(beard, "fur", 3.0))

    def head_helm(self, kind="great", metal="armor", eyes="glow", trim="trim", plume=None, crest=None, horns=None, skin="skin"):
        hs = self.hs; sh = self.sh
        ey = R(hs * 0.45)
        face = dec(M(metal, "plate", 3.0), ("north", "slit", ey, eyes), ("north", "visor", ey - 1, 1, "dark"))
        if kind == "great":
            self.head_box(face)
            self.box(self.head, (-hs / 2 - 1, sh + hs - 3, -hs / 2 - 1), (hs + 2, 3, hs + 2), M(metal, "plate", 3.4))
            self.box(self.head, (-1, sh + hs, -hs / 2 - 1), (2, 2, hs + 2), M(trim, "plate", 3.5))
        elif kind == "sallet":
            self.head_box(face)
            self.box(self.head, (-hs / 2 - 1, sh + hs - 2, -hs / 2 - 1), (hs + 2, 3, hs + 2), M(metal, "plate", 3.3))
            self.box(self.head, (-hs / 2 - 1, sh - 2, hs / 2 - 1), (hs + 2, hs, 2), M(metal, "plate", 2.8))
        elif kind == "open":
            self.head_box(dec(M(skin, "skin", 3.0), ("north", "eyes", eyes, ey)))
            self.box(self.head, (-hs / 2 - 1, sh + hs - 3, -hs / 2 - 1), (hs + 2, 4, hs + 2), M(metal, "plate", 3.2))
            self.box(self.head, (-1, sh + 2, -hs / 2 - 2), (2, hs - 3, 1), M(metal, "plate", 3.0))  # nasal
        elif kind == "hood":
            self.head_box(dec(M(skin, "skin", 2.6), ("north", "eyes", eyes, ey)))
            self.box(self.head, (-hs / 2 - 1, sh - 1, -hs / 2 - 1), (hs + 2, hs + 2, hs + 3), M(metal, "cloth", 2.4,
                     decals=[("north", "fill", "dark", 0)] if False else []))
            self.box(self.head, (-hs / 2 + 1, sh + hs - 1, -hs / 2 - 2), (hs - 2, hs - 2, 1), M("dark", "flat", 2.0, decals=[("north", "eyes", eyes, ey - 1)]))
        elif kind == "hood_open":
            self.head_box(dec(M(skin, "skin", 3.0), ("north", "eyes", eyes, ey)))
            self.box(self.head, (-hs / 2 - 1, sh + hs - 1, -hs / 2 - 1), (hs + 2, 3, hs + 3), M(metal, "cloth", 2.8))
            self.box(self.head, (-hs / 2 - 1, sh - 1, hs / 2), (hs + 2, hs, 2), M(metal, "cloth", 2.4))
            for sgn in (1, -1):
                self.box(self.head, (sgn * hs / 2 - (0 if sgn > 0 else 1), sh - 1, -hs / 2 - 1), (1, hs - 1, hs + 3), M(metal, "cloth", 2.6))
        elif kind == "skull":
            f = dec(M("bone", "bone", 3.4), ("north", "eyes", eyes, ey), ("north", "teeth", sh * 0 + R(hs * 0.18)))
            self.head_box(f)
        # crests / plumes
        if plume:
            self.box(self.head, (-1, sh + hs, -hs / 2), (2, 3, hs), M(plume, "cloth", 3.0))
            self.box(self.head, (-1, sh + hs + 2, hs / 2 - 1), (2, 4, 3), M(plume, "cloth", 2.8))
        if crest:
            for i in range(3):
                self.box(self.head, (-1, sh + hs + i, -hs / 2 + 2 + i * 2), (2, 3 - i + 1, 2), M(crest, "plate", 3.5))
        if horns:
            self.horns(horns)

    def horns(self, slot, size=1.0, out=True, curve=True):
        hs = self.hs; sh = self.sh
        L = R(hs * 0.55 * size)
        for sgn in (1, -1):
            x0 = sgn * hs / 2
            ox = x0 - (0 if sgn > 0 else 2)
            self.box(self.head, (ox, sh + hs - 2, -1), (2, 2, 2), M(slot, "bone", 3.3))
            self.box(self.head, (ox + sgn * 1, sh + hs - 1, -1), (2, L, 2), M(slot, "bone", 3.5), rot=[0, 0, -sgn * 25], pivot=[x0, sh + hs - 1, 0])
            self.box(self.head, (ox + sgn * (L * 0.35 + 2), sh + hs + L - 2, -1), (1, R(L * 0.5), 1), M(slot, "bone", 4.0), rot=[0, 0, -sgn * 40], pivot=[x0, sh + hs - 1, 0]) if False else None

    # ------------------------------------------------------------- shoulders / armour
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
            if spikes:
                for k in range(spikes):
                    sx = ox + (pw / 2 - 0.5) + (k - (spikes - 1) / 2) * 0
                    self.box(bone, (ox + pw / 2 - 1 + side * 0.5, y + ph + 1, -pw / 2 + 1 + k * 2 if spikes > 1 else -0.5), (1, 2 + k % 2, 1), M(trim, "bone", 3.8))

    def fur_collar(self, slot="fur"):
        tw = self.tw; td = self.td
        self.box(self.body, (-tw / 2 - 1, self.sh - 3, -td / 2 - 1), (tw + 2, 3, td + 2), M(slot, "fur", 3.0))
        for sgn in (1, -1):
            self.box(self.body, (sgn * tw / 2 - (0 if sgn > 0 else 3) , self.sh - 1, -td / 2 - 1), (3, 2, td + 2), M(slot, "fur", 3.2))

    def belt(self, slot="leather", buckle="trim", skull=False, y_off=0):
        tw, td, lh = self.tw, self.td, self.lh
        mat = M(slot, "leather", 2.6)
        self.box(self.body, (-tw / 2 - 0.5, lh + 1 + y_off, -td / 2 - 0.5), (tw + 1, 2, td + 1), mat)
        bm = M(buckle, "plate", 3.8)
        if skull: bm = dec(bm, ("north", "skull", "bone"))
        self.box(self.body, (-2, lh + 1 + y_off, -td / 2 - 1.5), (4, 3, 1), bm)

    def tabard(self, slot="cloth", trim="trim", emblem=None, length=None):
        tw, td, lh = self.tw, self.td, self.lh
        L = length or R(7 * self.s)
        mat = M(slot, "cloth", 3.0)
        if emblem: mat = dec(mat, ("north", emblem, trim))
        self.box(self.body, (-tw / 2 + 2, lh - L + 3, -td / 2 - 1), (tw - 4, L, 1), mat)
        self.box(self.body, (-tw / 2 + 2, lh + 3, td / 2), (tw - 4, L - 3, 1), M(slot, "cloth", 2.6))
        self.box(self.body, (-tw / 2 + 2, lh - L + 3, -td / 2 - 1), (tw - 4, 1, 1), M(trim, "plate", 3.5))

    def skirt(self, slot="cloth", length=None, widen=2, trim=None):
        """Robe / long skirt from the waist (bone `skirt`, swings)."""
        if self.n("skirt") not in self.bones:
            self.bone(self.n("skirt"), self.body, (0, self.lh + 2, 0))
        tw, td = self.tw, self.td
        L = length or R(9 * self.s)
        self.box(self.n("skirt"), (-tw / 2 - widen / 2, self.lh + 2 - L, -td / 2 - widen / 2), (tw + widen, L, td + widen), M(slot, "cloth", 2.8))
        if trim:
            self.box(self.n("skirt"), (-tw / 2 - widen / 2 - 0.5, self.lh + 2 - L, -td / 2 - widen / 2 - 0.5), (tw + widen + 1, 1, td + widen + 1), M(trim, "plate", 3.4))

    def cape(self, slot="cloth", length=None, trim=None, half=False):
        if self.n("cape") not in self.bones:
            self.bone(self.n("cape"), self.body, (0, self.sh - 1, self.td / 2 + 1))
        L = length or R(self.th * 1.5)
        tw, td = self.tw, self.td
        self.box(self.n("cape"), (-tw / 2, self.sh - 1 - L, td / 2), (tw, L, 1), M(slot, "cloth", 2.6))
        self.box(self.n("cape"), (-tw / 2 - 1, self.sh - 1 - 1, td / 2 - 1), (tw + 2, 2, 2), M(trim or slot, "plate", 3.3))
        if trim:
            self.box(self.n("cape"), (-tw / 2, self.sh - 1 - L, td / 2), (tw, 1, 1), M(trim, "plate", 3.4))

    def backpack(self, slot="leather", size=(6, 8, 3)):
        self.box(self.body, (-size[0] / 2, self.lh + 2, self.td / 2), size, M(slot, "leather", 2.6))

    def thigh_plates(self, slot="armor"):
        for side, bone in ((1, self.leg_l), (-1, self.leg_r)):
            ox = 0 if side > 0 else -self.lw
            self.box(bone, (ox - 0.5, self.lh - 6 * self.s, -self.lw / 2 - 1), (self.lw + 1, R(5 * self.s), self.lw + 2), M(slot, "plate", 3.1))

    # ------------------------------------------------------------- weapons
    def _wbone(self, hand="r"):
        name = self.n("weapon_" + hand)
        if name not in self.bones:
            parent = self.arm_r if hand == "r" else self.arm_l
            sx = -self.acx if hand == "r" else self.acx
            self.bone(name, parent, (sx, self.hand_y + 2, -1))
        return name

    def weapon(self, kind, hand="r", slot="metal", grip="leather", trim="trim", length=None, glow=None, rest=-25, wrot=None):
        """Weapon built along +y from the hand (grip at hand)."""
        wb = self._wbone(hand)
        parent = self.arm_r if hand == "r" else self.arm_l
        self.bones[parent]["rot"] = [rest, 0, 0]
        if wrot is None:
            wrot = 0 if kind in ("spear", "staff", "scythe") else -38
        self.bones[wb]["rot"] = [wrot, 0, 0]
        sx = -self.acx if hand == "r" else self.acx
        hy = self.hand_y
        s = self.s
        gx = sx - 0.5
        gz = -1.5
        L = length or R(18 * s)
        if kind == "sword":
            self.box(wb, (gx, hy - 3, gz), (1, 6, 1), M(grip, "leather", 2.5))
            self.box(wb, (gx - 2, hy + 3, gz - 0.5), (5, 1, 2), M(trim, "plate", 3.6))
            self.box(wb, (gx - 0.5, hy + 4, gz), (2, L, 1), M(slot, "metal", 3.5))
            self.box(wb, (gx, hy + 4 + L, gz), (1, 2, 1), M(slot, "metal", 4.2))
            if glow: self.box(wb, (gx, hy + 5, gz - 0.5), (1, L - 2, 1), M(glow, "glow", 4.5))
        elif kind == "greatsword":
            L = R(26 * s)
            self.box(wb, (gx, hy - 4, gz), (1, 8, 1), M(grip, "leather", 2.5))
            self.box(wb, (gx - 3, hy + 4, gz - 1), (7, 2, 3), M(trim, "plate", 3.6))
            self.box(wb, (gx - 1, hy + 6, gz - 0.5), (3, L, 2), M(slot, "metal", 3.4))
            self.box(wb, (gx - 0.5, hy + 6 + L, gz), (2, 3, 1), M(slot, "metal", 4.2))
            if glow: self.box(wb, (gx - 0.5, hy + 8, gz - 1), (2, L - 4, 1), M(glow, "glow", 4.5))
        elif kind == "axe":
            self.box(wb, (gx, hy - 4, gz), (1, L, 1), M(grip, "wood", 2.8))
            self.box(wb, (gx - 4, hy + L - 6, gz - 1), (5, 6, 3), M(slot, "metal", 3.3))
            self.box(wb, (gx + 1, hy + L - 4, gz - 0.5), (2, 3, 2), M(slot, "metal", 3.0))
            self.box(wb, (gx - 5, hy + L - 5, gz - 0.5), (1, 4, 2), M(slot, "metal", 4.1))
        elif kind == "greataxe":
            L = R(24 * s)
            self.box(wb, (gx, hy - 5, gz), (1, L, 1), M(grip, "wood", 2.8))
            for sgn in (1, -1):
                ox = gx - 6 if sgn > 0 else gx + 1
                self.box(wb, (ox, hy + L - 11, gz - 1), (6, 8, 3), M(slot, "metal", 3.3))
                self.box(wb, (ox + (-1 if sgn > 0 else 6), hy + L - 10, gz - 0.5), (1, 6, 2), M(slot, "metal", 4.1))
            self.box(wb, (gx - 0.5, hy + L - 4, gz - 0.5), (2, 3, 2), M(trim, "plate", 3.6))
        elif kind == "hammer":
            self.box(wb, (gx, hy - 4, gz), (1, L, 1), M(grip, "wood", 2.8))
            self.box(wb, (gx - 3, hy + L - 6, gz - 2), (7, 6, 5), M(slot, "metal", 3.1))
            self.box(wb, (gx - 3, hy + L - 6, gz - 2), (7, 1, 5), M(trim, "plate", 3.6))
        elif kind == "spear":
            L = R(34 * s)
            self.box(wb, (gx, hy - 8, gz), (1, L, 1), M(grip, "wood", 2.8))
            self.box(wb, (gx - 1, hy - 8 + L, gz - 0.5), (3, 4, 2), M(slot, "metal", 3.5))
            self.box(wb, (gx, hy - 8 + L + 4, gz), (1, 3, 1), M(slot, "metal", 4.2))
            self.box(wb, (gx - 1, hy - 8 + L - 2, gz - 0.5), (3, 1, 2), M(trim, "plate", 3.5))
        elif kind == "staff":
            L = R(36 * s)
            self.box(wb, (gx, hy - 10, gz), (1, L, 1), M(grip, "wood", 2.6))
            col = glow or trim
            self.box(wb, (gx - 1.5, hy - 10 + L, gz - 1), (4, 4, 3), M(col, "glow", 4.0))
            self.box(wb, (gx - 2.5, hy - 10 + L - 2, gz - 1.5), (6, 1, 4), M(trim, "plate", 3.4))
        elif kind == "mace":
            self.box(wb, (gx, hy - 3, gz), (1, L - 4, 1), M(grip, "wood", 2.8))
            self.box(wb, (gx - 2, hy + L - 8, gz - 1.5), (5, 5, 4), M(slot, "metal", 3.2))
        elif kind == "cleaver":
            self.box(wb, (gx, hy - 3, gz), (1, 6, 1), M(grip, "leather", 2.5))
            self.box(wb, (gx - 1, hy + 3, gz - 0.5), (3, L, 1), M(slot, "metal", 3.2))
            self.box(wb, (gx - 2, hy + 3 + L - 4, gz - 0.5), (1, 4, 1), M(slot, "metal", 3.9))
        elif kind == "scythe":
            L = R(30 * s)
            self.box(wb, (gx, hy - 8, gz), (1, L, 1), M(grip, "wood", 2.6))
            self.box(wb, (gx - 1, hy - 8 + L - 1, gz - 0.5), (3, 2, 2), M(slot, "metal", 3.6))
            self.box(wb, (gx - 6, hy - 8 + L, gz - 0.5), (7, 2, 1), M(slot, "metal", 3.9))
            self.box(wb, (gx - 8, hy - 8 + L - 3, gz - 0.5), (3, 3, 1), M(slot, "metal", 4.2))
        elif kind == "dagger":
            self.box(wb, (gx, hy - 2, gz), (1, 4, 1), M(grip, "leather", 2.5))
            self.box(wb, (gx - 1, hy + 2, gz - 0.5), (3, 1, 2), M(trim, "plate", 3.5))
            self.box(wb, (gx, hy + 3, gz), (1, R(8 * s), 1), M(slot, "metal", 3.9))
        return wb

    def shield(self, kind="kite", slot="armor", trim="trim", emblem=None, hand="l"):
        parent = self.arm_l if hand == "l" else self.arm_r
        name = self.n("shield_" + hand)
        sx = self.acx if hand == "l" else -self.acx
        if name not in self.bones:
            self.bone(name, parent, (sx, self.hand_y + 4, -self.aw / 2 - 1))
        s = self.s
        z = -self.aw / 2 - 3
        mat = M(slot, "plate", 3.1)
        if emblem: mat = dec(mat, ("north", emblem, trim))
        if kind == "kite":
            self.box(name, (sx - 4, self.hand_y - 2, z), (9, R(13 * s), 2), mat)
            self.box(name, (sx - 3, self.hand_y - 4, z), (7, 2, 2), mat)
            self.box(name, (sx - 4, self.hand_y - 2, z - 0.5), (9, 1, 2), M(trim, "plate", 3.5)) if False else None
            self.box(name, (sx - 5, self.hand_y + R(11 * s) - 1, z - 0.5), (11, 1, 3), M(trim, "plate", 3.5))
        elif kind == "round":
            self.box(name, (sx - 4, self.hand_y, z), (9, 9, 2), mat)
            self.box(name, (sx - 1, self.hand_y + 3, z - 1), (3, 3, 1), M(trim, "plate", 3.8))
        elif kind == "tower":
            self.box(name, (sx - 5, self.hand_y - 4, z), (11, R(18 * s), 2), mat)
            self.box(name, (sx - 5, self.hand_y - 4, z - 1), (11, 1, 1), M(trim, "plate", 3.5))
            self.box(name, (sx - 5, self.hand_y + R(14 * s) - 1, z - 1), (11, 1, 1), M(trim, "plate", 3.5))
        elif kind == "buckler":
            self.box(name, (sx - 3, self.hand_y + 1, z), (7, 7, 2), mat)

    # ------------------------------------------------------------- extras
    def wings(self, kind="feather", slot="cloth", trim=None, span=None, rot=14):
        span = span or R(20 * self.s)
        for side, nm in ((1, self.n("wing_l")), (-1, self.n("wing_r"))):
            self.bone(nm, self.body, (side * 2, self.sh - 3, self.td / 2))
            z = self.td / 2 + 1
            ox = 1 if side > 0 else -1 - span
            if kind == "feather":
                rows = 4
                for i in range(rows):
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
                self.box(nm, (ox, self.sh - 3 - 12, z - 0.5), (2, 12, 1), M(trim or slot, "bone", 3.4)) if False else None
            elif kind == "insect":
                self.box(nm, (ox, self.sh - 9, z), (span, 10, 1), M(slot, "ice", 3.4))
                self.box(nm, (ox + (2 if side > 0 else 0), self.sh - 15, z), (span - 2, 6, 1), M(slot, "ice", 3.0))
            self.bones[nm]["rot"] = [0, side * -rot, 0]

    def tail(self, slot="skin", length=10, style="skin", segs=3, thick=3):
        self.bone(self.n("tail"), self.body, (0, self.lh + 2, self.td / 2))
        z = self.td / 2
        for i in range(segs):
            t = max(1, thick - i)
            self.box(self.n("tail"), (-t / 2, self.lh + 1 - i * 1.0, z + i * (length / segs)), (t, t, length / segs + 1), M(slot, style, 3.0))

    def halo(self, slot="glow", r=7, y=None):
        self.bone(self.n("halo"), self.head, (0, self.sh + self.hs, 0))
        yy = (y if y is not None else self.sh + self.hs + 3)
        for sgn in (1, -1):
            self.box(self.n("halo"), (-r / 2, yy, sgn * r / 2 - 0.5), (r, 1, 1), M(slot, "glow", 4.0))
            self.box(self.n("halo"), (sgn * r / 2 - 0.5, yy, -r / 2), (1, 1, r), M(slot, "glow", 4.0))

    def floaters(self, slot="glow", n=3, r=11, y=None):
        """Orbiting orbs/crystals (bone `orbit` spins)."""
        self.bone(self.n("orbit"), self.body, (0, self.lh + self.th / 2, 0))
        import math
        for i in range(n):
            a = 2 * math.pi * i / n
            x, z = r * math.cos(a), r * math.sin(a)
            yy = (y if y is not None else self.lh + self.th / 2) + (i % 2) * 3
            self.box(self.n("orbit"), (x - 1.5, yy - 1.5, z - 1.5), (3, 3, 3), M(slot, "glow", 4.0))

    def spikes_back(self, slot="bone", n=3):
        for i in range(n):
            y = self.lh + self.th - 3 - i * 3 * self.s
            self.box(self.body, (-1, y, self.td / 2), (2, 2, 2 + (n - i) % 3 + 1), M(slot, "bone", 3.4))

    def flames_on(self, bone, slot="flame", w=4, h=8, n=3, at=(0, 0, 0)):
        for i in range(n):
            self.box(bone, (at[0] - w / 2 + i * 1.5 - 1.5, at[1] + i % 2 * 2, at[2] - w / 2), (w - i, h - i * 2, w - i), M(slot, "flame", 3.2))
