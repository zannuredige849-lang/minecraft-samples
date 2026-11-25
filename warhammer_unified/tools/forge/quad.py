"""Quadruped rig (bears, dogs, horses, cats) + composite helper for riders."""
from .core import Model
from .humanoid import M, dec, R


class Quad(Model):
    """Bones: root > body > head(+jaw), tail; root > leg_fl, leg_fr, leg_bl, leg_br. Front is -z."""

    def __init__(self, ident, pal, L=24, W=12, Hb=12, leg=12, lt=5, hl=None, hw=None, hh=None, neck=0, neck_up=0):
        super().__init__(ident, pal)
        self.L, self.W, self.Hb, self.leg, self.lt = L, W, Hb, leg, lt
        self.hw = hw or max(6, int(W * 0.7)); self.hh = hh or max(6, int(Hb * 0.7)); self.hl = hl or max(6, int(L * 0.3))
        self.top = leg + Hb
        self.root = self.bone("root", None, (0, 0, 0))
        self.body = self.bone("body", "root", (0, leg + Hb / 2, 0))
        self.neck_y = leg + Hb - self.hh / 2 + neck_up
        self.head = self.bone("head", "body", (0, self.neck_y, -L / 2))
        zf = -L / 2 + lt / 2 + 0.5
        zb = L / 2 - lt / 2 - 0.5
        xo = W / 2 - lt / 2
        self.leg_fl = self.bone("leg_fl", "root", (xo, leg, zf))
        self.leg_fr = self.bone("leg_fr", "root", (-xo, leg, zf))
        self.leg_bl = self.bone("leg_bl", "root", (xo, leg, zb))
        self.leg_br = self.bone("leg_br", "root", (-xo, leg, zb))
        self.neck = neck

    def base(self, body="skin", legs=None, belly=None, bstyle="fur", lstyle="fur", paws="dark", ptone=2.5):
        L, W, Hb, lg, lt = self.L, self.W, self.Hb, self.leg, self.lt
        self.box(self.body, (-W / 2, lg, -L / 2), (W, Hb, L), M(body, bstyle, 3.0))
        if belly:
            self.box(self.body, (-W / 2 + 1, lg - 1, -L / 2 + 2), (W - 2, 2, L - 4), M(belly, bstyle, 3.2))
        xo = W / 2 - lt
        for nm, sx, sz in (("leg_fl", 1, -1), ("leg_fr", -1, -1), ("leg_bl", 1, 1), ("leg_br", -1, 1)):
            x = (W / 2 - lt) if sx > 0 else -W / 2
            z = (-L / 2) if sz < 0 else (L / 2 - lt)
            self.box(nm, (x, 2, z), (lt, lg - 2, lt), M(legs or body, lstyle, 2.8))
            self.box(nm, (x - 0.5, 0, z - 0.5 - (1 if sz < 0 else 0)), (lt + 1, 2, lt + 1 + (1 if sz < 0 else 0)), M(paws, "plate", ptone))

    def head_box(self, mat, snout=None, snout_mat=None, ears=None, ear_size=3, eyes="glow", eye_y=None, fangs=None, jaw=False):
        hw, hh, hl = self.hw, self.hh, self.hl
        hy = self.neck_y - hh / 2
        ey = eye_y if eye_y is not None else R(hh * 0.5)
        m = dec(mat, ("north", "eyes", eyes, ey)) if eyes else mat
        # head main (back part), face on its north side
        self.box(self.head, (-hw / 2, hy, -self.L / 2 - hl + 2), (hw, hh, hl - 2), mat)
        if snout:
            sw = max(3, hw - 3); sh = max(3, hh - 3)
            sm = snout_mat or mat
            self.box(self.head, (-sw / 2, hy, -self.L / 2 - hl - snout + 2), (sw, sh, snout), dec(sm, ("north", "mouth", 1)) if False else sm)
            self.box(self.head, (-hw / 2, hy, -self.L / 2 - hl + 1), (hw, hh, 1), m)   # eyes plate at the brow
        else:
            self.box(self.head, (-hw / 2, hy, -self.L / 2 - hl + 1), (hw, hh, 1), m)
        if self.neck > 0 or hy > self.leg + self.Hb - self.hh + 1:
            nh = int(hy + hh - (self.leg + self.Hb)) + 3
            self.box(self.head, (-(hw - 2) / 2, self.leg + self.Hb - 2, -self.L / 2 - 1), (hw - 2, max(nh, 4), 6), mat)
        if ears:
            for sgn in (1, -1):
                ox = sgn * (hw / 2 - 1) - (0 if sgn > 0 else ear_size - 1)
                self.box(self.head, (ox, hy + hh, -self.L / 2 - hl / 2 + 2), (ear_size - 1 if ear_size > 2 else 2, ear_size, 2), M(ears, "fur", 2.8))
        if fangs:
            zz = -self.L / 2 - hl - (snout or 0) + 2
            for sgn in (1, -1):
                self.box(self.head, (sgn * (max(3, hw - 3) / 2 - 1) - (0 if sgn > 0 else 1), hy - 3, zz), (1, 4, 1), M(fangs, "bone", 3.8))

    def tail(self, slot, length=8, thick=2, style="fur", up=2, tuft=None):
        self.bone("tail", "body", (0, self.leg + self.Hb - 2, self.L / 2))
        self.box("tail", (-thick / 2, self.leg + self.Hb - 2 - up, self.L / 2), (thick, thick, length), M(slot, style, 3.0))
        if tuft:
            self.box("tail", (-thick / 2 - 1, self.leg + self.Hb - 3 - up, self.L / 2 + length - 1), (thick + 2, thick + 2, 3), M(tuft, style, 3.2))

    def mane(self, slot, length=None):
        L = length or self.L // 2
        self.box(self.body, (-2, self.top, -self.L / 2 + 1), (4, 3, L), M(slot, "fur", 3.0))
        self.box(self.head, (-2, self.neck_y + self.hh / 2, -self.L / 2 - 2), (4, 3, 6), M(slot, "fur", 3.2))

    def hump(self, slot, h=4, style="fur"):
        self.box(self.body, (-self.W / 2 + 1, self.top, -self.L / 2 + 3), (self.W - 2, h, self.L // 3), M(slot, style, 3.1))

    def barding(self, slot="armor", trim="trim"):
        L, W, lg = self.L, self.W, self.leg
        self.box(self.body, (-W / 2 - 1, lg + self.Hb - 3, -L / 2 + 2), (W + 2, 3, L - 4), M(slot, "plate", 3.0))
        self.box(self.body, (-W / 2 - 1, lg + 1, -L / 2 + 1), (W + 2, 3, 4), M(slot, "plate", 3.0))
        self.box(self.head, (-self.hw / 2 - 0.5, self.neck_y - self.hh / 2 + self.hh - 2, -self.L / 2 - self.hl + 2), (self.hw + 1, 2, self.hl - 1), M(slot, "plate", 3.3))
        self.box(self.head, (-1, self.neck_y - self.hh / 2 + self.hh, -self.L / 2 - self.hl + 1), (2, 2, 4), M(trim, "plate", 3.6))

    def saddle(self, slot="leather", trim="trim"):
        self.box(self.body, (-self.W / 2 - 0.5, self.top, -3), (self.W + 1, 2, 8), M(slot, "leather", 2.6))
        self.box(self.body, (-1, self.top + 2, 3), (2, 1, 2), M(trim, "plate", 3.5))

    def spikes(self, slot="bone", n=4):
        for i in range(n):
            self.box(self.body, (-1, self.top, -self.L / 2 + 3 + i * (self.L - 6) / n), (2, 2 + (i % 2), 2), M(slot, "bone", 3.6))

    def ribs(self, slot="bone"):
        for i in range(4):
            z = -self.L / 2 + 3 + i * 4
            self.box(self.body, (-self.W / 2 - 1, self.leg + 2, z), (self.W + 2, self.Hb - 3, 1), M(slot, "bone", 3.4))
        self.box(self.body, (-1, self.top, -self.L / 2 + 2), (2, 1, self.L - 4), M(slot, "bone", 3.0))


def attach(mount, rider, parent_bone="body"):
    """Merge a prefixed Humanoid (built with parent_bone=mount body) into the mount model."""
    for name, b in rider.bones.items():
        mount.bones[name] = b
    mount.roles_rider = rider.pre
    return mount
