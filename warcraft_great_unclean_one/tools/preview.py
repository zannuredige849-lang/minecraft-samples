"""Software preview of the *exported* geo/animation/texture files (no game needed).

Uses the conventions measured in Blockbench: file x is mirrored (x_int = -x_file); file rotation acts as
Rz(rz) Ry(-ry) Rx(-rx) in the INT frame; bone matrix = T(pos) T(pivot) R S T(-pivot) (parents on the left);
per-face UV orientation as described in build.face_voxels.
"""
import json
import math
import os

import numpy as np
from PIL import Image

import anim

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP = os.path.join(ROOT, "resource_pack")


class Model:
    def __init__(self, name="great_unclean_one"):
        g = json.load(open(os.path.join(RP, "models/entity", name + ".geo.json")))["minecraft:geometry"][0]
        self.tex = np.asarray(Image.open(os.path.join(RP, "textures/entity", name + ".png")).convert("RGBA"))
        self.anims = json.load(open(os.path.join(RP, "animations", name + ".animation.json")))["animations"]
        self.prefix = "animation.%s." % name
        self.bones = {}
        self.order = []
        quads = []
        for b in g["bones"]:
            self.bones[b["name"]] = dict(parent=b.get("parent"), pivot=np.array([-b["pivot"][0], b["pivot"][1], b["pivot"][2]], float))
            self.order.append(b["name"])
            for c in b.get("cubes", []):
                ox, oy, oz = c["origin"]
                sx, sy, sz = c["size"]
                x0, x1 = -(ox + sx), -ox
                y0, y1 = oy, oy + sy
                z0, z1 = oz, oz + sz
                spec = {
                    "north": ((x1, y1, z0), (-sx, 0, 0), (0, -sy, 0)),
                    "south": ((x0, y1, z1), (sx, 0, 0), (0, -sy, 0)),
                    "east": ((x1, y1, z1), (0, 0, -sz), (0, -sy, 0)),
                    "west": ((x0, y1, z0), (0, 0, sz), (0, -sy, 0)),
                    "up": ((x0, y1, z0), (sx, 0, 0), (0, 0, sz)),
                    "down": ((x0, y0, z1), (sx, 0, 0), (0, 0, -sz)),
                }
                for f, d in c["uv"].items():
                    (u, v), (w, h) = d["uv"], d["uv_size"]
                    if w < 0:
                        u, w = u + w, -w
                    if h < 0:
                        v, h = v + h, -h
                    a, eu, ev = (np.array(t, float) for t in spec[f])
                    quads.append((b["name"], a, eu, ev, (u, v, w, h), f))
        self.quads = quads
        normals = {"north": (0, 0, -1), "south": (0, 0, 1), "east": (1, 0, 0), "west": (-1, 0, 0), "up": (0, 1, 0), "down": (0, -1, 0)}
        self.N0 = np.array([normals[q[5]] for q in quads], float)
        self.th, self.tw = self.tex.shape[:2]
        self.qbone = [q[0] for q in quads]
        self.A = np.array([q[1] for q in quads])
        self.EU = np.array([q[2] for q in quads])
        self.EV = np.array([q[3] for q in quads])
        self.R = np.array([q[4] for q in quads], float)

    # ------------------------------------------------------------------ pose
    @staticmethod
    def _lerp(chan, t, length, loop):
        ks = sorted((float(k), v) for k, v in chan.items())
        if loop and length:
            t = t % length
        if t <= ks[0][0]:
            return np.array(ks[0][1], float)
        if t >= ks[-1][0]:
            return np.array(ks[-1][1], float)
        for (t0, a), (t1, b) in zip(ks, ks[1:]):
            if t0 <= t <= t1:
                f = (t - t0) / (t1 - t0 or 1)
                return np.array(a, float) * (1 - f) + np.array(b, float) * f
        return np.array(ks[-1][1], float)

    def pose(self, anim_name=None, t=0.0):
        a = self.anims.get(self.prefix + anim_name) if anim_name else None
        mats = {}
        for n in self.order:
            b = self.bones[n]
            p = b["pivot"]
            rot = pos = None
            sc = np.ones(3)
            if a and n in a["bones"]:
                d = a["bones"][n]
                loop = a.get("loop") is True
                L = a["animation_length"]
                if "rotation" in d:
                    rot = self._lerp(d["rotation"], t, L, loop)
                if "position" in d:
                    pos = self._lerp(d["position"], t, L, loop)
                if "scale" in d:
                    sc = self._lerp(d["scale"], t, L, loop)
            Rm = anim.file_rot_matrix(rot) if rot is not None else np.eye(3)
            Lm = Rm @ np.diag(sc)
            tr = np.zeros(3) if pos is None else np.array([-pos[0], pos[1], pos[2]])
            M = np.eye(4)
            M[:3, :3] = Lm
            M[:3, 3] = tr + p - Lm @ p
            if b["parent"]:
                M = mats[b["parent"]] @ M
            mats[n] = M
        return mats

    # ------------------------------------------------------------------ render
    def render(self, anim_name=None, t=0.0, yaw=0.0, pitch=10.0, size=700, ss=2, frame=None, bg=(246, 244, 238),
               light=(0.35, 0.8, -0.5), mats=None):
        mats = mats or self.pose(anim_name, t)
        names = np.array(self.qbone)
        A = np.empty_like(self.A)
        EU = np.empty_like(self.EU)
        EV = np.empty_like(self.EV)
        N = np.empty_like(self.N0)
        for n, M in mats.items():
            idx = np.nonzero(names == n)[0]
            if not len(idx):
                continue
            A[idx] = self.A[idx] @ M[:3, :3].T + M[:3, 3]
            EU[idx] = self.EU[idx] @ M[:3, :3].T
            EV[idx] = self.EV[idx] @ M[:3, :3].T
            N[idx] = self.N0[idx] @ np.linalg.inv(M[:3, :3])  # normals transform with the inverse transpose
        ya, pi = math.radians(yaw), -math.radians(pitch)
        Ry = np.array([[math.cos(ya), 0, math.sin(ya)], [0, 1, 0], [-math.sin(ya), 0, math.cos(ya)]])
        Rx = np.array([[1, 0, 0], [0, math.cos(pi), -math.sin(pi)], [0, math.sin(pi), math.cos(pi)]])
        Vm = Rx @ Ry
        A, EU, EV = A @ Vm.T, EU @ Vm.T, EV @ Vm.T
        N = N @ Vm.T
        ln = np.linalg.norm(N, axis=1)
        ln[ln == 0] = 1
        N /= ln[:, None]
        front = N[:, 2] < 0  # camera at -Z looking +Z
        if frame is None:
            P = np.concatenate([A, A + EU, A + EV, A + EU + EV])
            lo, hi = P.min(0), P.max(0)
            frame = ((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, max(hi[0] - lo[0], hi[1] - lo[1]) * 1.05)
        cx, cy, span = frame
        W = size * ss
        sc = W / span
        zb = np.full((W, W), 1e9)
        col = np.zeros((W, W, 4), np.float32)
        col[:] = (*bg, 255)
        L = np.array(light)
        L /= np.linalg.norm(L)
        sh_all = 0.62 + 0.5 * np.clip(-(N * np.array([-L[0], -L[1], L[2]])).sum(1) * -1, 0, 1)
        T = self.tex
        order = np.nonzero(front)[0]
        sa = np.stack([(-(A[:, 0] - cx)) * sc + W / 2, (-(A[:, 1] - cy)) * sc + W / 2], 1)
        se1 = np.stack([-EU[:, 0] * sc, -EU[:, 1] * sc], 1)
        se2 = np.stack([-EV[:, 0] * sc, -EV[:, 1] * sc], 1)
        for i in order:
            a, e1, e2 = sa[i], se1[i], se2[i]
            det = e1[0] * e2[1] - e1[1] * e2[0]
            if abs(det) < 1e-6:
                continue
            xs = (a[0], a[0] + e1[0], a[0] + e2[0], a[0] + e1[0] + e2[0])
            ys = (a[1], a[1] + e1[1], a[1] + e2[1], a[1] + e1[1] + e2[1])
            x0, x1 = max(int(math.floor(min(xs))), 0), min(int(math.ceil(max(xs))), W - 1)
            y0, y1 = max(int(math.floor(min(ys))), 0), min(int(math.ceil(max(ys))), W - 1)
            if x1 < x0 or y1 < y0:
                continue
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            px, py = gx - a[0], gy - a[1]
            s = (px * e2[1] - py * e2[0]) / det
            t = (e1[0] * py - e1[1] * px) / det
            m = (s >= 0) & (s < 1) & (t >= 0) & (t < 1)
            if not m.any():
                continue
            depth = A[i, 2] + s * EU[i, 2] + t * EV[i, 2]
            sub = zb[y0:y1 + 1, x0:x1 + 1]
            m &= depth < sub
            if not m.any():
                continue
            u, v, w, h = self.R[i]
            tx = np.clip((u + s * w).astype(int), 0, self.tw - 1)
            ty = np.clip((v + t * h).astype(int), 0, self.th - 1)
            rgb = T[ty, tx, :3].astype(np.float32) * sh_all[i]
            c = col[y0:y1 + 1, x0:x1 + 1]
            c[m, :3] = rgb[m]
            sub[m] = depth[m]
        img = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8), "RGBA").convert("RGB")
        if ss > 1:
            img = img.resize((size, size), Image.LANCZOS)
        return img, frame


if __name__ == "__main__":
    import sys

    mdl = Model()
    out = sys.argv[1] if len(sys.argv) > 1 else "preview.png"
    views = [(0, 8), (90, 8), (180, 8), (270, 8)]
    ims = []
    _, fr = mdl.render(None, 0, 0, 8, size=200, ss=1)
    for yaw, pit in views:
        im, _ = mdl.render(None, 0, yaw, pit, size=700, ss=1, frame=(fr[0], fr[1], fr[2] * 1.25))
        ims.append(im)
    sheet = Image.new("RGB", (1400, 1400), "white")
    for i, im in enumerate(ims):
        sheet.paste(im, ((i % 2) * 700, (i // 2) * 700))
    sheet.save(out)
    print("saved", out)
