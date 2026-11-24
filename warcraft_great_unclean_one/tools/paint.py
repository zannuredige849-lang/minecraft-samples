"""Procedural colours for the voxel faces (the original Warcraft III textures are not in the .mdx).

Every visible voxel face is exactly one texel.  Colours come from the geoset's material family,
smooth low-frequency noise (blotches, rust), a baked ambient-occlusion term and a few deliberate
motifs (horn growth rings, rusty blade with a toxic tip, red cavity inside the belly and mouth).
"""
import numpy as np

import voxel

_TABLE = {}


def vnoise(p, scale, seed):
    """smooth 3D value noise in 0..1"""
    if seed not in _TABLE:
        _TABLE[seed] = np.random.RandomState(seed).rand(64, 64, 64)
    t = _TABLE[seed]
    q = np.asarray(p, float) / scale
    i = np.floor(q).astype(int)
    f = q - i
    f = f * f * (3 - 2 * f)

    def g(dx, dy, dz):
        return t[(i[..., 0] + dx) & 63, (i[..., 1] + dy) & 63, (i[..., 2] + dz) & 63]

    fx, fy, fz = f[..., 0], f[..., 1], f[..., 2]
    c00 = g(0, 0, 0) * (1 - fx) + g(1, 0, 0) * fx
    c10 = g(0, 1, 0) * (1 - fx) + g(1, 1, 0) * fx
    c01 = g(0, 0, 1) * (1 - fx) + g(1, 0, 1) * fx
    c11 = g(0, 1, 1) * (1 - fx) + g(1, 1, 1) * fx
    return (c00 * (1 - fy) + c10 * fy) * (1 - fz) + (c01 * (1 - fy) + c11 * fy) * fz


def mix(a, b, t):
    a, b = np.asarray(a, float), np.asarray(b, float)
    t = np.asarray(t, float)[..., None]
    return a + (b - a) * t


def smooth(x, lo, hi):
    t = np.clip((x - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


class Painter:
    def __init__(self, vx):
        self.vx = vx
        self.solid = vx["solid"]
        self.geo = vx["geo"]
        self.origin = np.asarray(vx["origin"], float)
        self.V = vx["V"]
        self.pad = np.pad(self.solid, 2)
        self.cls = np.empty(max(voxel.GEO) + 1, object)
        for g, (c, _) in voxel.GEO.items():
            self.cls[g] = c
        # how enclosed an air voxel is sideways / vertically (belly cavity, mouth, nostrils)
        R = int(round(8 / vx["V"]))
        enc = np.zeros(self.solid.shape, np.int8)
        for ax in (0, 1):
            for sg in (1, -1):
                reach = np.zeros(self.solid.shape, bool)
                for st in range(1, R + 1):
                    sh = np.roll(self.solid, -sg * st, ax)
                    reach |= sh
                enc += reach
        self.enc = np.pad(enc, 2)

    def center(self, I, J, K):
        return self.origin + (np.stack([I, J, K], -1) + 0.5) * self.V

    def ao(self, I, J, K, face):
        from boxes import FACE_DIR
        ax, sg = FACE_DIR[face]
        idx = [np.asarray(I) + 2, np.asarray(J) + 2, np.asarray(K) + 2]
        idx[ax] = idx[ax] + sg
        u, v = [a for a in range(3) if a != ax]
        tot = 0
        for du in (-1, 0, 1):
            for dv in (-1, 0, 1):
                if du == 0 and dv == 0:
                    continue
                j = list(idx)
                j[u] = j[u] + du
                j[v] = j[v] + dv
                tot = tot + self.pad[j[0], j[1], j[2]].astype(float)
        enc = self.enc[idx[0], idx[1], idx[2]]
        return tot / 8.0, enc

    def face(self, I, J, K, face):
        """rgb uint8 array (..., 3) for the voxel faces"""
        I, J, K = np.asarray(I), np.asarray(J), np.asarray(K)
        p = self.center(I, J, K)
        geo = self.geo[I, J, K]
        ao, enc = self.ao(I, J, K, face)
        wc = np.stack([-p[..., 2] / voxel.SCALE, -p[..., 0] / voxel.SCALE, p[..., 1] / voxel.SCALE - voxel.FOOT_LIFT], -1)
        out = np.zeros(p.shape, float)
        cls = self.cls[geo]
        n1, n2, n3 = vnoise(p, 8, 1), vnoise(p, 5, 2), vnoise(p, 11, 3)
        n4 = vnoise(p, 3, 4)
        for c in np.unique(cls):
            m = cls == c
            out[m] = self._cls(c, p[m], wc[m], n1[m], n2[m], n3[m], n4[m], ao[m], enc[m])
        out *= (1.0 - 0.34 * ao)[..., None]
        return np.clip(out, 0, 255).astype(np.uint8)

    # ------------------------------------------------------------------ material families
    def _cls(self, c, p, wc, n1, n2, n3, n4, ao, enc):
        h = wc[:, 2]
        if c == "skin":
            col = mix((84, 108, 60), (124, 150, 86), n1)
            col = mix(col, (172, 168, 102), 0.8 * smooth(n2, 0.78, 0.86))   # a few pale pus blotches
            col = mix(col, (70, 92, 50), 0.4 * smooth(0.5 - n1, 0, 0.35))    # darker folds
            belly = (wc[:, 2] < 126) & (np.abs(wc[:, 1]) < 48) & (wc[:, 0] > 5)  # the belly maw
            mouth = (wc[:, 2] >= 130) & (wc[:, 0] > 30)                          # the grin
            cav = ((enc >= 4) & (belly | mouth)).astype(float)
            col = mix(col, mix((150, 70, 74), (86, 32, 42), smooth(ao, 0.2, 0.75)), cav)
            return col
        if c in ("flesh", "flesh_ring"):
            base = (176, 98, 100) if c == "flesh" else (126, 58, 64)
            return mix(base, (200, 128, 120), n1 * 0.6)
        if c == "horn":
            t = smooth(h, 138, 188)
            col = mix((150, 140, 104), (226, 216, 172), t)
            ring = ((np.floor(h / 3.2).astype(int) % 2) == 0).astype(float)
            return mix(col, col * 0.86, ring * 0.9)
        if c == "bone":
            return mix((214, 204, 170), (236, 228, 196), n1)
        if c == "tooth":
            return mix((226, 214, 160), (246, 238, 196), n1)
        if c == "eye":
            return mix((255, 150, 24), (255, 226, 96), smooth(n4, 0.3, 0.9))
        if c == "eye_dark":
            return np.full(p.shape, (24, 12, 10.0))
        if c == "brow":
            return mix((78, 98, 60), (104, 124, 78), n1)
        if c == "boil":
            col = mix((170, 160, 82), (206, 192, 112), n1)
            return mix(col, (196, 120, 96), 0.55 * smooth(0.5 - n2, 0, 0.5))
        if c == "chain":
            col = mix((82, 82, 92), (112, 112, 120), n1)
            return mix(col, (132, 78, 44), smooth(n2, 0.5, 0.7) * 0.9)
        if c == "flail":
            col = mix((34, 34, 42), (62, 62, 72), n1)
            return mix(col, (120, 70, 40), smooth(n2, 0.62, 0.8) * 0.8)
        if c == "flail_stud":
            return mix((170, 164, 142), (210, 204, 180), n1)
        if c in ("hook", "hook_gem"):
            if c == "hook_gem":
                return mix((70, 220, 120), (170, 255, 170), n1)
            col = mix((78, 56, 44), (108, 82, 64), n1)
            return mix(col, (74, 112, 88), smooth(n2, 0.7, 0.85) * 0.6)
        if c in ("blade", "blade_edge"):
            tip = np.clip((wc[:, 0] - 41) / 160.0, 0, 1)
            col = mix((100, 110, 116), (142, 154, 158), n1)
            col = mix(col, (132, 80, 46), smooth(n2, 0.6, 0.78) * 0.9)
            col = mix(col, (112, 176, 70), 0.75 * smooth(tip, 0.55, 1.0) * smooth(n3, 0.3, 0.6))
            if c == "blade_edge":
                col = mix(col, (205, 214, 208), 0.65)
            return col
        if c == "hilt":
            return mix((92, 108, 80), (128, 144, 108), n1)
        if c == "gem":
            return mix((70, 230, 120), (170, 255, 170), n1)
        if c == "cloth":
            return mix((66, 54, 46), (92, 78, 64), n1)
        if c == "fly":
            return mix((30, 26, 24), (74, 70, 66), n4)
        return np.full(p.shape, (200, 0, 200.0))
