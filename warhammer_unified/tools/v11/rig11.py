"""v11 rig: keeps the bone names / parents / pivots / bind rotations of the add-on's existing geometry
(so every existing animation and controller keeps working) and lets a builder sculpt new cubes around them.

Clean Box-UV: every cube gets its own UV island (no shared or overlapping UVs), integer sizes >= 1,
thin shells via `inflate`. The texture is a 256x256 PNG; when the UV islands fit into 128x128 the geometry
declares texture_width/height 128 so every model unit carries 2x2 texture pixels (finer detail), else 256.
"""
import json, re
import numpy as np
from PIL import Image
from forge.core import Palette
from .paint11 import paint, decal


def M(slot, style="flat", tone=3.0, **kw):
    d = {"slot": slot, "style": style, "tone": tone}
    d.update(kw)
    return d


class Cube11:
    __slots__ = ("o", "s", "mat", "rot", "pivot", "inflate", "uv", "seed")

    def __init__(self, o, s, mat, rot, pivot, inflate, seed):
        self.o, self.s, self.mat, self.rot, self.pivot, self.inflate, self.seed = o, s, mat, rot, pivot, inflate, seed
        self.uv = None


class Rig11:
    def __init__(self, ident, pal, base_geo):
        self.ident, self.pal = ident, pal
        self.bones = {}
        self.order = []
        for b in base_geo["bones"]:
            self.bone(b["name"], b.get("parent"), b.get("pivot", [0, 0, 0]), b.get("rotation"))
        self.n = 0

    def bone(self, name, parent, pivot, rot=None):
        if name not in self.bones: self.order.append(name)
        self.bones[name] = dict(parent=parent, pivot=list(pivot), rot=list(rot) if rot else None, cubes=[])
        return name

    def piv(self, name):
        return self.bones[name]["pivot"]

    # c(bone, x, y, z, w, h, d, mat): min corner + integer size (model / file coordinates)
    def c(self, bone, x, y, z, w, h, d, mat, rot=None, pivot=None, inflate=0.0):
        s = tuple(max(1, int(round(v))) for v in (w, h, d))
        if rot and pivot is None: pivot = [x + s[0] / 2, y + s[1] / 2, z + s[2] / 2]
        self.n += 1
        self.bones[bone]["cubes"].append(Cube11((float(x), float(y), float(z)), s, mat, rot, pivot, inflate, self.n))
        return s

    def pair(self, bone_r, bone_l, x, y, z, w, h, d, mat, rot=None, pivot=None, inflate=0.0):
        """Right-side cube given; the left twin is mirrored about x = 0 (rotations about y/z flip sign)."""
        self.c(bone_r, x, y, z, w, h, d, mat, rot, pivot, inflate)
        s = max(1, int(round(w)))
        r2 = [rot[0], -rot[1], -rot[2]] if rot else None
        p2 = [-pivot[0], pivot[1], pivot[2]] if pivot else None
        if rot and pivot is None: p2 = [-(x + s / 2), y + max(1, round(h)) / 2, z + max(1, round(d)) / 2]
        self.c(bone_l, -(x + s), y, z, w, h, d, mat, r2, p2, inflate)

    # ------------------------------------------------------------------ sculpting helpers (v10.8)
    def seg(self, bone, p0, p1, w, d, mat, inflate=0.0, over=0.0):
        """Box of section w x d running from point p0 to p1 (file coordinates), rotated to follow the segment."""
        import math
        vx, vy, vz = (p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2])
        L = math.sqrt(vx * vx + vy * vy + vz * vz) + over
        if L < 1e-6: return
        tx, ty, tz = -vx / (L - over), vy / (L - over), vz / (L - over)
        a = math.asin(max(-1, min(1, tz)))
        b = math.atan2(-tx, ty) if abs(math.cos(a)) > 1e-6 else 0.0
        rx, rz = round(-math.degrees(a), 2), round(math.degrees(b), 2)
        wi, di, Li = max(1, round(w)), max(1, round(d)), max(1, round(L))
        rot = [rx, 0, rz] if (abs(rx) > 0.01 or abs(rz) > 0.01) else None
        self.c(bone, p0[0] - wi / 2, p0[1], p0[2] - di / 2, wi, Li, di, mat, rot=rot, pivot=list(p0) if rot else None, inflate=inflate)

    def chain(self, bone, pts, w0, w1, mat_fn, d0=None, d1=None):
        n = len(pts) - 1
        for i in range(n):
            t = i / max(1, n - 1)
            w = w0 + (w1 - w0) * t
            d = (d0 if d0 is not None else w0) + ((d1 if d1 is not None else w1) - (d0 if d0 is not None else w0)) * t
            self.seg(bone, pts[i], pts[i + 1], w, d, mat_fn(i), over=0.6)

    def ell(self, bone, c, r, mat, step=3, cross=True, squash=0.84):
        """Rounded volume (ellipsoid) from horizontal slices; each slice is a cross of two boxes for round x and z.
        Slices share one noise field (continuous across slices) and a single top-lit gradient; decals go on the middle slice."""
        import math
        cx, cy, cz = c; rx, ry, rz = r
        n = max(2, int(round(2 * ry / step)))
        h = step
        seed = abs(hash((bone, round(cx), round(cy), round(cz)))) % 100000
        for i in range(n):
            yc = -n * h / 2 + (i + 0.5) * h
            f = math.sqrt(max(0.05, 1 - (yc / (n * h / 2 + 0.5)) ** 2))
            w, d = max(1, round(2 * rx * f)), max(1, round(2 * rz * f))
            y0 = cy - n * h / 2 + i * h
            m = dict(mat); m["seed"] = seed; m["wy"] = (n - 1 - i) * h; m["vg"] = 0
            m["tone"] = mat.get("tone", 3.0) + 0.45 * (yc / max(1, n * h / 2)) + (0.15 if i == n - 1 else 0)
            if i != n // 2: m.pop("decals", None)
            if cross and w > 3 and d > 3:
                w2, d2 = max(1, round(w * squash)), max(1, round(d * squash))
                self.c(bone, cx - w / 2, y0, cz - d2 / 2, w, h, d2, m)
                m2 = dict(m); m2.pop("decals", None)
                self.c(bone, cx - w2 / 2, y0, cz - d / 2, w2, h, d, m2)
            else:
                self.c(bone, cx - w / 2, y0, cz - d / 2, w, h, d, m)

    def cube_count(self):
        return sum(len(b["cubes"]) for b in self.bones.values())

    # ------------------------------------------------------------------ uv + paint
    def _pack(self, size):
        cubes = [c for n in self.order for c in self.bones[n]["cubes"]]
        items = sorted(cubes, key=lambda c: (-(c.s[2] + c.s[1]), -(2 * c.s[2] + 2 * c.s[0])))
        shelves = []
        for c in items:
            rw, rh = 2 * c.s[2] + 2 * c.s[0], c.s[2] + c.s[1]
            if rw > size or rh > size: return False
            for sh in shelves:
                if rh <= sh[1] and sh[2] + rw <= size:
                    c.uv = (sh[2], sh[0]); sh[2] += rw; break
            else:
                y = (shelves[-1][0] + shelves[-1][1]) if shelves else 0
                if y + rh > size: return False
                shelves.append([y, rh, rw]); c.uv = (0, y)
        return True

    def dezfight(self):
        """Coplanar, overlapping, same-facing faces of two cubes in one bone flicker in game: lift the smaller cube."""
        fixed = 0
        for n in self.order:
            cs = [c for c in self.bones[n]["cubes"] if not c.rot]
            for i, a in enumerate(cs):
                for b in cs[i + 1:]:
                    lo_a = [a.o[k] - a.inflate for k in range(3)]; hi_a = [a.o[k] + a.s[k] + a.inflate for k in range(3)]
                    lo_b = [b.o[k] - b.inflate for k in range(3)]; hi_b = [b.o[k] + b.s[k] + b.inflate for k in range(3)]
                    hit = False
                    for ax in range(3):
                        o1, o2 = [k for k in range(3) if k != ax]
                        ov = min(hi_a[o1], hi_b[o1]) - max(lo_a[o1], lo_b[o1]) > 0 and min(hi_a[o2], hi_b[o2]) - max(lo_a[o2], lo_b[o2]) > 0
                        if ov and (abs(lo_a[ax] - lo_b[ax]) < 1e-6 or abs(hi_a[ax] - hi_b[ax]) < 1e-6): hit = True
                    if hit:
                        small = a if a.s[0] * a.s[1] * a.s[2] <= b.s[0] * b.s[1] * b.s[2] else b
                        small.inflate = round(small.inflate + 0.05, 3); fixed += 1
        return fixed

    def finalize(self, png=None):
        self.zfix = self.dezfight()
        import os
        td = int(os.environ.get("TEXEL_DENSITY", "0") or 0)
        if td:   # one style with the rest of the add-on: a fixed number of texture pixels per model unit
            for uvsize in (64, 128, 256, 512, 1024):
                if self._pack(uvsize): break
            else:
                raise RuntimeError(f"{self.ident}: UV islands do not fit 1024x1024")
            png = uvsize * td
        else:
            png = png or getattr(self, "png", 256)
            for uvsize in [u for u in (64, 128, 256, 512) if u <= png and png // u <= 4]:
                if self._pack(uvsize): break
            else:
                raise RuntimeError(f"{self.ident}: UV islands do not fit {png}x{png}")
        self.tw = uvsize
        dens = png // uvsize
        tex = np.zeros((png, png, 4), np.uint8)
        mer = np.zeros((png, png, 3), np.uint8); mer[..., 2] = 255
        for n in self.order:
            for c in self.bones[n]["cubes"]:
                u, v = c.uv
                w, h, d = c.s
                rects = {"east": (u, v + d, d, h), "north": (u + d, v + d, w, h), "west": (u + d + w, v + d, d, h),
                         "south": (u + 2 * d + w, v + d, w, h), "up": (u + d, v, w, d), "down": (u + d + w, v, w, d)}
                for face, (x, y, fw, fh) in rects.items():
                    rgba, m = paint(c.mat, face, fw * dens, fh * dens, dens, self.pal, c.seed * 7 + len(face))
                    decal(rgba, m, c.mat, face, dens, self.pal)
                    tex[y * dens:(y + fh) * dens, x * dens:(x + fw) * dens] = rgba
                    mer[y * dens:(y + fh) * dens, x * dens:(x + fw) * dens] = m
        self.texture = Image.fromarray(tex)
        self.mer = Image.fromarray(mer)
        return self.texture

    def geometry(self):
        bones = []
        lo = [1e9] * 3; hi = [-1e9] * 3
        for n in self.order:
            b = self.bones[n]
            bd = {"name": n}
            if b["parent"]: bd["parent"] = b["parent"]
            bd["pivot"] = [round(v, 4) for v in b["pivot"]]
            if b["rot"]: bd["rotation"] = b["rot"]
            cl = []
            for c in b["cubes"]:
                cd = {"origin": [round(v, 4) for v in c.o], "size": list(c.s), "uv": list(c.uv)}
                if c.inflate: cd["inflate"] = c.inflate
                if c.rot: cd["rotation"] = c.rot; cd["pivot"] = [round(v, 4) for v in c.pivot]
                cl.append(cd)
                for i in range(3):
                    lo[i] = min(lo[i], c.o[i]); hi[i] = max(hi[i], c.o[i] + c.s[i])
            if cl: bd["cubes"] = cl
            bones.append(bd)
        ext = max(abs(lo[0]), abs(hi[0]), abs(lo[2]), abs(hi[2]))
        return {"description": {"identifier": self.ident, "texture_width": self.tw, "texture_height": self.tw,
                                "visible_bounds_width": round(max(4, ext / 16 * 2.6), 1), "visible_bounds_height": round(max(4, hi[1] / 16 * 1.4), 1),
                                "visible_bounds_offset": [0, round(hi[1] / 32, 2), 0]}, "bones": bones}
