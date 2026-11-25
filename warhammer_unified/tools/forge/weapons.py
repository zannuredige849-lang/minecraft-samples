"""Hand-built weapon voxel models (v10.3): vanilla-readable silhouettes with Mowzie-style thin, slightly rotated plates.

Study notes that drive the shapes:
  * vanilla trident  – 1px pole, 3x2 crossbar, three 1x4 prongs; vanilla spear – 1px shaft + a leaf head with a dark outline
  * vanilla swords   – 3 tones only: light bevel on the upper edge, mid body, dark lower edge; guard is a bar, pommel a single pixel
  * Mowzie's items   – thin plates (1 texel thick) fanned/rotated 20-45 deg, a heavy "collar" where the head meets the haft,
                       hanging cloth/feather tassels, small dark gaps instead of solid slabs
Every part is a real box touching its neighbour: nothing floats.
All coordinates are in the weapon bone's space: +y runs along the shaft away from the hand, -z is the front.
"""
import math


def _M(slot, style="plate", tone=3.0, **kw):
    d = {"slot": slot, "style": style, "tone": tone}
    d.update(kw)
    return d


class W:
    """Small drawing helper bound to one weapon bone."""

    def __init__(self, h, wb, gx, gz, hy, s, slot, grip, trim, glow):
        self.h, self.wb, self.gx, self.gz, self.hy, self.s = h, wb, gx, gz, hy, s
        self.slot, self.grip, self.trim, self.glow = slot, grip, trim, glow

    # -- primitives ------------------------------------------------------------------------------------------------
    def b(self, dx, y, dz, sx, sy, sz, mat, rz=0.0, rx=0.0, ry=0.0):
        """Box with its min corner at (gx+dx, hy+y, gz+dz). Optional rotation about its own centre."""
        o = (self.gx + dx, self.hy + y, self.gz + dz)
        if rz or rx or ry:
            piv = (o[0] + sx / 2, o[1] + sy / 2, o[2] + sz / 2)
            self.h.box(self.wb, o, (sx, sy, sz), mat, rot=[rx, ry, rz], pivot=list(piv))
        else:
            self.h.box(self.wb, o, (sx, sy, sz), mat)

    def metal(self, tone=3.4, slot=None): return _M(slot or self.slot, "metal", tone)
    def edge(self, slot=None): return _M(slot or self.slot, "metal", 4.5)
    def dark(self, slot=None): return _M(slot or self.slot, "metal", 2.2)
    def plate(self, tone=3.4, slot=None): return _M(slot or self.trim, "plate", tone)
    def wood(self, tone=2.8): return _M(self.grip, "wood", tone)
    def wrap(self, tone=2.3): return _M(self.grip, "leather", tone)
    def hp(self, tone=3.2):
        return _M(self.slot, "metal", max(2.4, tone - 0.7))

    def cloth(self, slot=None, tone=3.0): return _M(slot or self.trim, "cloth", tone)

    # -- composite parts -------------------------------------------------------------------------------------------
    def haft(self, y0, length, tone=2.8, rings=(), ferrule=True, thick=1):
        o = -0.5 * (thick - 1)
        self.b(o, y0, o, thick, length, thick, self.wood(tone))
        for ry in rings:                                       # leather/metal binding rings, 1px proud of the shaft
            self.b(o - 0.5, y0 + ry, o - 0.5, thick + 1, 1, thick + 1, self.wrap(2.2))
        if ferrule:
            self.b(o - 0.5, y0 - 1, o - 0.5, thick + 1, 2, thick + 1, self.plate(3.2, self.slot))

    def grip_wrap(self, y0, length):
        """Hilt: leather core with criss-cross rings every second unit."""
        self.b(0, y0, 0, 1, length, 1, self.wrap(2.4))
        for k in range(0, length, 2):
            self.b(-0.5, y0 + k, -0.5, 2, 1, 2, self.wrap(2.0 if k % 4 == 0 else 2.6))

    def blade(self, y0, length, w0, w1, bevel=True, tip=2, glow=None, thick=1):
        """Tapered blade built from 2-unit slices. Centre ridge + bright upper bevel give the vanilla 3-tone look."""
        seg = 2
        n = max(1, length // seg)
        for i in range(n):
            t = i / max(1, n - 1)
            w = max(1, int(round(w0 + (w1 - w0) * t)))
            x = -(w // 2)
            self.b(x, y0 + i * seg, -0.5 * (thick - 1), w, seg, thick, self.metal(3.3 + 0.12 * (i % 2)))
            if bevel and w >= 3:                               # sharpened edge: bright on the left, shadowed on the right
                self.b(x, y0 + i * seg, -0.5 * (thick - 1) - 0.5, 1, seg, thick + 1, self.edge())
                self.b(x + w - 1, y0 + i * seg, -0.5 * (thick - 1) - 0.5, 1, seg, thick + 1, self.dark())
        top = y0 + n * seg
        wt = max(1, int(round(w1)))
        if tip:
            self.b(-(max(1, wt - 1) // 2), top, 0, max(1, wt - 1), 1, thick, self.metal(4.0))
            self.b(0, top + 1, 0, 1, tip - 1 if tip > 1 else 1, thick, self.edge())
        # ridge / fuller
        gm = _M(glow or self.slot, "glow" if glow else "metal", 4.4 if glow else 2.4)
        self.b(0, y0 + 1, -1, 1, max(1, length - 3), 1, gm)

    def arc(self, x0, y0, ang0, dang, n, seg, wid, thick, mat_fn, flip=1):
        """A bent blade: n boxes of (wid x seg x thick) laid along an arc, each rotated about z (degrees)."""
        x, y, a = x0, y0, ang0
        for i in range(n):
            ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
            cx, cy = x + sa * flip * seg / 2, y + ca * seg / 2
            w = wid(i) if callable(wid) else wid
            self.b(cx - w / 2, cy - seg / 2, -0.5 * (thick - 1), w, seg + 1, thick, mat_fn(i), rz=-a * flip)
            x += sa * flip * seg
            y += ca * seg
            a += dang
        return x, y

    def pommel(self, y=-1, gem=False):
        self.b(-1, y - 1, -1, 3, 1, 3, self.plate(3.5))
        self.b(0, y - 2, 0, 1, 1, 1, self.plate(4.2))
        if gem: self.b(0, y, -1.5, 1, 1, 1, _M(self.glow or self.trim, "glow", 4.3))

    def guard(self, y, wid, quill=2, down=True, thick=2):
        self.b(-(wid // 2), y, -thick / 2 + 0.5, wid, 1, thick, self.plate(3.6))
        for sgn in (-1, 1):
            xx = sgn * (wid // 2) + (-1 if sgn > 0 else 0)
            self.b(xx, y - quill, -thick / 2 + 1, 1, quill + 1, max(1, thick - 1), self.plate(3.2), rz=(-14 if sgn > 0 else 14))


def _sword(w, L, ww, grip, guard, big=False, glow=None):
    w.pommel(-2 if not big else -3, gem=big)
    w.grip_wrap(-grip + 1, grip)
    w.guard(1, guard, quill=2 if not big else 3, thick=2 if not big else 3)
    w.blade(3, L, ww, max(1, ww - 2), glow=glow)


def build(h, wb, kind, hy, gx, gz, s, slot, grip, trim, L, glow):
    R = lambda v: max(1, int(round(v)))
    w = W(h, wb, gx, gz, hy, s, slot, grip, trim, glow)
    hy0 = 0   # all y offsets are relative to hy (hand centre)

    if kind == "sword":
        _sword(w, L, 3, 6, 6, glow=glow)

    elif kind == "dagger":
        w.pommel(-1)
        w.grip_wrap(-1, 4)
        w.guard(3, 5, quill=1, thick=2)
        w.blade(4, R(9 * s), 3, 1, tip=2)

    elif kind == "greatsword":
        _sword(w, R(26 * s), 4, 9, 9, big=True, glow=glow)

    elif kind == "claymore":
        w.pommel(-4, gem=True)
        w.grip_wrap(-3, 10)
        w.guard(7, 11, quill=3, thick=4)
        for sgn in (-1, 1):                                                         # trefoil ends
            w.b(sgn * 5 + (-1 if sgn > 0 else 0), 4, -1, 2, 2, 3, w.plate(3.0))
        w.b(-1, 8, -1, 3, 2, 3, w.plate(3.2))
        w.blade(10, R(30 * s) - 2, 4, 2, glow=glow, thick=2)

    elif kind == "scimitar":
        w.pommel(-1)
        w.grip_wrap(-1, 5)
        w.b(-2, 4, -1, 5, 1, 3, w.plate(3.3))
        w.b(-1, 3, -1.5, 3, 1, 4, w.plate(2.9))
        # curved blade: starts straight, bends forward-and-out
        w.arc(0.5, 5, 0, 7, 6, 3, lambda i: [3, 3, 4, 4, 3, 2][i], 1, lambda i: w.metal(3.2 + 0.15 * i), flip=1)
        w.b(2, 21, 0, 1, 2, 1, w.edge())

    elif kind == "axe":
        w.haft(-4, L + 2, rings=(0, 6, L - 5))
        w.b(-1, -5, -1, 3, 1, 3, w.hp(3.4))
        # head: collar on the haft, thin fan-shaped bit with a bright edge, short back spike
        yc = L - 7
        w.b(-1, yc, -1.5, 3, 7, 3, w.hp(3.2))                                    # socket
        w.b(-1, yc + 7, -1, 3, 1, 2, w.hp(3.8))
        for i, (dy, ww) in enumerate(((0, 3), (1, 5), (2, 6), (3, 6), (4, 5), (5, 3))):
            w.b(-1 - ww, yc + dy + 0, -0.5, ww, 1, 1, w.metal(3.0 + 0.2 * i), rz=0)
        w.b(-8, yc + 1, -1, 1, 5, 2, w.edge())                                      # cutting edge
        w.b(-7, yc + 1, -0.5, 1, 5, 1, w.metal(3.9))
        w.b(2, yc + 2, -0.5, 3, 2, 1, w.metal(3.1)); w.b(4, yc + 3, -0.5, 2, 1, 1, w.edge())  # poll spike
        w.b(0, L + 1, -0.5, 1, 3, 1, w.edge())                                      # top spike
        w.b(-0.5, L - 1, -1, 2, 1, 2, w.hp(3.8))

    elif kind == "greataxe":
        L = R(24 * s)
        w.haft(-5, L, rings=(0, 5, 10, L - 12))
        yc = L - 12
        w.b(-1, yc, -1.5, 3, 9, 3, w.hp(3.2))
        for sgn in (1, -1):
            xs = (-1 if sgn > 0 else 2)
            for i, (dy, ww) in enumerate(((0, 3), (1, 5), (2, 6), (3, 6), (4, 6), (5, 5), (6, 3))):
                x0 = (-ww + xs) if sgn > 0 else xs
                w.b(x0, yc + 1 + dy, -0.5, ww, 1, 1, w.metal(3.0 + 0.2 * i), rz=(4 * sgn))
            xe = (xs - 7) if sgn > 0 else (xs + 6)
            w.b(xe, yc + 2, -1, 1, 6, 2, w.edge() if sgn > 0 else w.dark())
        w.b(0, yc + 9, -0.5, 1, 4, 1, w.edge())                                     # spike
        w.b(-1, yc + 9, -1, 3, 1, 2, w.hp(3.8))

    elif kind == "hammer":
        w.haft(-4, L, rings=(1, 5, L - 8))
        yh = L - 8
        w.b(-3, yh, -3, 7, 6, 6, w.metal(3.0))                                      # head core
        w.b(-4, yh + 1, -2, 1, 4, 4, w.hp(3.7)); w.b(4, yh + 1, -2, 1, 4, 4, w.hp(3.0))  # striking faces
        w.b(-3, yh - 1, -2, 7, 1, 4, w.hp(3.4)); w.b(-3, yh + 6, -2, 7, 1, 4, w.hp(3.6))
        for dx in (-2, 2):
            w.b(dx, yh + 2, -3.5, 1, 1, 1, w.edge()); w.b(dx, yh + 2, 2.5, 1, 1, 1, w.dark())  # studs
        w.b(-0.5, yh + 7, -0.5, 2, 3, 2, w.metal(3.8))

    elif kind == "mace":
        w.haft(-3, L - 4, rings=(0, 5))
        yh = L - 11
        w.b(-1, yh, -1, 3, 3, 3, w.hp(3.2))                                      # collar
        w.b(-2, yh + 3, -2, 5, 5, 5, w.metal(3.1))                                  # core
        for dx, dz, sx_, sz_ in ((-3, -1, 1, 3), (3, -1, 1, 3), (-1, -3, 3, 1), (-1, 3, 3, 1)):   # flanges
            w.b(dx if dx != 3 else 3, yh + 3, dz, sx_, 5, sz_, w.edge() if dx < 0 or dz < 0 else w.dark())
        w.b(0, yh + 8, 0, 1, 3, 1, w.edge())
        w.b(-1, yh + 8, -1, 3, 1, 3, w.hp(3.6))

    elif kind == "cleaver":
        w.pommel(-1); w.grip_wrap(-1, 5)
        w.b(-1, 4, -1, 3, 1, 3, w.hp(3.4))
        w.b(-2, 5, -0.5, 5, R(L * 0.45), 1, w.metal(3.2))
        w.b(-3, 5 + R(L * 0.45) + 1, -0.5, 6, R(L * 0.45), 1, w.metal(3.3))          # gap = hang hole
        w.b(-4, 6, -1, 1, L - 3, 2, w.edge())
        w.b(2, 5, -1, 1, L - 3, 2, w.dark())

    elif kind == "scythe":
        L = R(30 * s)
        w.haft(-8, L, rings=(1, 9, 20, L - 4))
        w.b(-2, 6, -0.5, 2, 1, 2, w.hp(3.2))                                     # side grip peg
        w.b(-3, 5, -0.5, 1, 3, 2, w.wrap(2.4))
        w.b(-1, L - 9, -1.5, 3, 3, 3, w.hp(3.3))
        x, y = w.arc(-1, L - 6, 70, 8, 7, 3, lambda i: [2, 2, 2, 2, 2, 1, 1][i], 1, lambda i: w.metal(3.1 + 0.18 * i), flip=-1)

    elif kind == "spear":
        L = R(34 * s)
        w.haft(-8, L, rings=(0, 10, L - 12))
        ys = L - 11
        w.b(-1, ys - 1, -1, 3, 5, 3, w.hp(3.3))                                   # socket
        w.b(-1, ys + 3, -1, 3, 1, 3, w.plate(3.6))
        for i, ww in enumerate((3, 5, 5, 5, 5, 4, 4, 3, 3, 2)):                     # leaf-shaped blade
            w.b(-(ww // 2), ys + 4 + i, -0.5, ww, 1, 1, w.metal(3.1 + 0.1 * i))
        w.b(0, ys + 4, -1, 1, 8, 2, w.edge())
        w.b(-2, ys + 5, -1, 1, 3, 2, w.edge()); w.b(2, ys + 5, -1, 1, 3, 2, w.dark())
        w.b(0, ys + 14, 0, 1, 1, 1, w.edge())
        w.b(1, ys - 6, -0.5, 1, 5, 1, w.cloth(tone=3.2), rz=10); w.b(1, ys - 10, -0.5, 1, 4, 1, w.cloth(tone=2.8), rz=16)   # pennant

    elif kind == "trident":
        L = R(34 * s)
        w.haft(-8, L, rings=(0, 8, L - 9), tone=2.7)
        yt = L - 10
        w.b(-1, yt - 2, -1, 3, 3, 2, w.cloth(tone=3.0))                           # binding
        w.b(-4, yt + 1, -1, 9, 2, 2, w.hp(3.4))                                   # crossbar
        w.b(-1, yt + 3, -0.5, 3, 2, 1, w.metal(3.5))
        w.b(0, yt + 5, -0.5, 1, 9, 1, w.metal(4.0))                               # centre prong
        for dx in (-3, 3):
            w.b(dx, yt + 3, -0.5, 1, 8, 1, w.metal(3.5))                          # side prongs
            w.b(dx + (1 if dx < 0 else -1), yt + 8, -0.5, 1, 2, 1, w.edge())      # barbs
            w.b(dx, yt + 11, -0.5, 1, 1, 1, w.edge())
        w.b(0, yt + 14, -0.5, 1, 1, 1, w.edge())

    elif kind == "halberd":
        L = R(36 * s)
        w.haft(-8, L, rings=(0, 10, 20, L - 14))
        yh = L - 14
        w.b(-1, yh, -1, 3, 4, 3, w.hp(3.3))
        for i, (dy, ww) in enumerate(((2, 4), (3, 6), (4, 7), (5, 7), (6, 6), (7, 5), (8, 3))):
            w.b(-ww - 0, yh + dy, -0.5, ww, 1, 1, w.metal(3.1 + 0.15 * i))           # axe bit
        w.b(-8, yh + 3, -1, 1, 5, 2, w.edge())
        w.b(1, yh + 4, -0.5, 1, 1, 1, w.metal(3.4)); w.b(2, yh + 5, -0.5, 2, 1, 1, w.metal(3.8)); w.b(3, yh + 3, -0.5, 1, 2, 1, w.edge())   # rear hook
        w.b(-1, yh + 4, -0.5, 3, 5, 1, w.metal(3.3)); w.b(0, yh + 9, -0.5, 1, 3, 1, w.edge()); w.b(0, yh + 4, -1, 1, 5, 2, w.edge())    # spear tip
        w.b(0, yh - 5, -1, 1, 4, 1, w.cloth(tone=3.0), rz=-8)

    elif kind == "glaive":
        L = R(32 * s)
        w.haft(-8, L, rings=(0, 10, L - 6))
        w.b(-1, L - 8, -1, 3, 3, 3, w.hp(3.2))
        w.arc(0, L - 5, -4, 6, 6, 3, lambda i: [4, 4, 4, 4, 3, 2][i], 1, lambda i: w.metal(3.2 + 0.15 * i), flip=1)
        w.b(1, L - 4, -1, 1, 9, 2, w.edge())

    elif kind == "staff":
        L = R(36 * s)
        w.haft(-10, L, tone=2.6, rings=(2, 8, 14, L - 8))
        yt = L - 10
        col = glow or trim
        w.b(-1, yt, -1, 3, 2, 3, w.hp(3.4))
        for dx in (-2, 2):                                                          # prongs holding the crystal
            w.b(dx, yt + 1, -0.5, 1, 6, 1, w.hp(3.2), rz=(6 if dx < 0 else -6))
        w.b(-1, yt + 2, -1, 3, 5, 3, _M(col, "glow", 4.1))
        w.b(0, yt + 7, 0, 1, 2, 1, _M(col, "glow", 4.6))
        w.b(-2, yt + 1, -1, 5, 1, 3, w.hp(2.9))

    elif kind == "bone_club":
        L = R(20 * s)
        bone = lambda t: _M("bone", "bone", t)
        w.b(-0.5, -4, -0.5, 2, L, 2, bone(3.0))
        w.b(-1, -5, -1, 3, 2, 3, bone(3.5)); w.b(-1.5, -6, -0.5, 1, 2, 1, bone(3.8)); w.b(1.5, -6, -0.5, 1, 2, 1, bone(3.8))   # knuckle end
        yh = L - 10
        w.b(-2, yh, -2, 5, 7, 5, bone(3.2))
        for dx, dz in ((-3, 0), (3, 0), (0, -3), (0, 3)):
            w.b(dx - 0.5 + (0.5 if dx == 3 else 0), yh + 2, dz - 0.5 + (0.5 if dz == 3 else 0), 1, 2, 1, bone(4.1))
        w.b(-1, yh + 7, -1, 3, 2, 3, bone(3.6)); w.b(0, yh + 9, 0, 1, 1, 1, bone(4.3))
        w.b(-1.5, yh + 3, -0.5, 4, 1, 1, w.wrap(2.2))

    elif kind == "war_pick":
        L = R(22 * s)
        w.haft(-4, L, rings=(0, 6, L - 7))
        yh = L - 6
        w.b(-1, yh - 1, -1.5, 3, 7, 3, w.hp(3.2))
        w.arc(-2, yh + 3, 70, -9, 4, 3, lambda i: [2, 2, 2, 1][i], 1, lambda i: w.metal(3.3 + 0.25 * i), flip=-1)
        w.b(2, yh + 2, -0.5, 3, 3, 2, w.metal(3.0)); w.b(4, yh + 2, -1, 1, 3, 3, w.edge())     # hammer face
        w.b(0, yh + 6, -0.5, 1, 3, 1, w.edge())
    else:
        raise ValueError(kind)
