"""Tiny Bedrock-geometry toolkit: model spec -> geo.json + texture atlas + software preview renders.

Conventions (checked against Blockbench / Bedrock behaviour):
  * model front faces -Z, +X is the character's right, +Y is up, 16 units = 1 block
  * bone / cube `rotation` is stored like Bedrock files do: file (rx, ry, rz) acts as
    three.js (-rx, -ry, rz) with order ZYX, so a NEGATIVE X rotation swings limbs forward
  * box UV layout: north (front) at (u+d, v+d), east (+X) at (u, v+d), south at (u+2d+w, v+d),
    west at (u+d+w, v+d), up at (u+d, v), down at (u+d+w, v)
"""
import json
import math

import numpy as np
from PIL import Image

FACES = ("north", "east", "south", "west", "up", "down")


def rot_mat(rot):
    rx, ry, rz = (math.radians(a) for a in rot)
    rx, ry = -rx, -ry
    cx, sx, cy, sy, cz, sz = math.cos(rx), math.sin(rx), math.cos(ry), math.sin(ry), math.cos(rz), math.sin(rz)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


class Cube:
    def __init__(self, bone, origin, size, paint=None, pivot=None, rot=None, inflate=0.0, uvkey=None, tag=""):
        self.bone = bone
        self.origin = [float(v) for v in origin]
        self.size = [int(round(v)) for v in size]
        self.paint = paint
        self.pivot = None if pivot is None else [float(v) for v in pivot]
        self.rot = None if rot is None else [float(v) for v in rot]
        self.inflate = float(inflate)
        self.uvkey = uvkey
        self.tag = tag
        self.uv = None

    @property
    def footprint(self):
        w, h, d = self.size
        return 2 * (w + d), h + d

    def rects(self):
        w, h, d = self.size
        U, V = self.uv
        return {
            "north": (U + d, V + d, w, h),
            "east": (U, V + d, d, h),
            "south": (U + d + w + d, V + d, w, h),
            "west": (U + d + w, V + d, d, h),
            "up": (U + d, V, w, d),
            "down": (U + d + w, V, w, d),
        }


class Bone:
    def __init__(self, name, parent, pivot, rot):
        self.name = name
        self.parent = parent
        self.pivot = [float(v) for v in pivot]
        self.rot = None if rot is None else [float(v) for v in rot]
        self.cubes = []


class Model:
    def __init__(self, ident, tw, th, bounds=(4, 4, (0, 1.5, 0)), fit=False):
        self.ident = ident
        self.fit = fit
        self.tw, self.th = tw, (4096 if fit else th)
        self.bones = {}
        self.order = []
        self.bounds = bounds

    def bone(self, name, parent=None, pivot=(0, 0, 0), rot=None):
        b = Bone(name, parent, pivot, rot)
        self.bones[name] = b
        self.order.append(name)
        return b

    def cube(self, bone, origin, size, paint=None, **kw):
        c = Cube(bone, origin, size, paint, **kw)
        self.bones[bone].cubes.append(c)
        return c

    def all_cubes(self):
        for n in self.order:
            for c in self.bones[n].cubes:
                yield c

    # ---------------------------------------------------------------- uv packing
    def pack(self):
        first = {}
        followers = []
        todo = []
        for c in self.all_cubes():
            if c.uvkey is not None and c.uvkey in first:
                followers.append(c)
                continue
            if c.uvkey is not None:
                first[c.uvkey] = c
            todo.append(c)
        todo.sort(key=lambda c: (-c.footprint[1], -c.footprint[0]))
        x = y = shelf_h = 0
        for c in todo:
            fw, fh = c.footprint
            if x + fw > self.tw:
                x, y, shelf_h = 0, y + shelf_h, 0
            c.uv = (x, y)
            x += fw
            shelf_h = max(shelf_h, fh)
        for c in followers:
            c.uv = first[c.uvkey].uv
        self.used_height = y + shelf_h
        if self.fit:
            t = 16
            while t < self.used_height:
                t *= 2
            self.th = t
        if y + shelf_h > self.th:
            raise RuntimeError(f"{self.ident}: atlas overflow ({y + shelf_h} > {self.th})")

    # ---------------------------------------------------------------- texture
    def texture(self):
        atlas = Image.new("RGBA", (self.tw, self.th), (0, 0, 0, 0))
        done = set()
        for c in self.all_cubes():
            key = c.uvkey if c.uvkey is not None else id(c)
            if key in done:
                continue
            done.add(key)
            if c.paint is None:
                continue
            for face, (x, y, w, h) in c.rects().items():
                if w <= 0 or h <= 0:
                    continue
                img = c.paint(face, w, h)
                if img is not None:
                    atlas.paste(img, (x, y))
        return atlas

    # ---------------------------------------------------------------- export
    def geo(self):
        bones = []
        for n in self.order:
            b = self.bones[n]
            j = {"name": n}
            if b.parent:
                j["parent"] = b.parent
            j["pivot"] = [round(v, 4) for v in b.pivot]
            if b.rot:
                j["rotation"] = [round(v, 4) for v in b.rot]
            if b.cubes:
                cubes = []
                for c in b.cubes:
                    cj = {
                        "origin": [round(v, 4) for v in c.origin],
                        "size": list(c.size),
                        "uv": list(c.uv),
                    }
                    if c.inflate:
                        cj["inflate"] = round(c.inflate, 4)
                    if c.rot:
                        cj["pivot"] = [round(v, 4) for v in (c.pivot if c.pivot else b.pivot)]
                        cj["rotation"] = [round(v, 4) for v in c.rot]
                    cubes.append(cj)
                j["cubes"] = cubes
            bones.append(j)
        bw, bh, bo = self.bounds
        return {
            "format_version": "1.12.0",
            "minecraft:geometry": [
                {
                    "description": {
                        "identifier": f"geometry.{self.ident}",
                        "texture_width": self.tw,
                        "texture_height": self.th,
                        "visible_bounds_width": bw,
                        "visible_bounds_height": bh,
                        "visible_bounds_offset": list(bo),
                    },
                    "bones": bones,
                }
            ],
        }

    # ---------------------------------------------------------------- rendering
    def _bone_matrix(self, name, pose):
        """return (R 3x3, t 3) so that world = R @ v + t for bone-local coords of `name`."""
        chain = []
        n = name
        while n:
            chain.append(n)
            n = self.bones[n].parent
        R = np.eye(3)
        t = np.zeros(3)
        for n in reversed(chain):
            b = self.bones[n]
            p = np.array(b.pivot)
            rot = np.array(b.rot if b.rot else [0, 0, 0], float)
            pos = np.zeros(3)
            sc = 1.0
            if pose and n in pose:
                po = pose[n]
                if "rot" in po:
                    rot = rot + np.array(po["rot"], float)
                if "pos" in po:
                    pos = np.array(po["pos"], float)
                if "scale" in po:
                    sc = float(po["scale"])
            Rb = rot_mat(rot) * sc
            # v' = pos + p + Rb (v - p), then parent transform
            tb = pos + p - Rb @ p
            R, t = R @ Rb, R @ tb + t
        return R, t

    def quads(self, pose=None, hide=()):
        out = []
        for n in self.order:
            b = self.bones[n]
            if not b.cubes:
                continue
            R, t = self._bone_matrix(n, pose)
            for c in b.cubes:
                if c.tag in hide or n in hide:
                    continue
                ox, oy, oz = (v - c.inflate for v in c.origin)
                w, h, d = (s + 2 * c.inflate for s in c.size)
                Rc = np.eye(3)
                pc = np.zeros(3)
                if c.rot:
                    pc = np.array(c.pivot if c.pivot else b.pivot)
                    Rc = rot_mat(c.rot)
                # (corner, u_dir, v_dir) per face; u/v are full edge vectors
                spec = {
                    "north": ((ox + w, oy + h, oz), (-w, 0, 0), (0, -h, 0)),
                    "south": ((ox, oy + h, oz + d), (w, 0, 0), (0, -h, 0)),
                    "east": ((ox + w, oy + h, oz + d), (0, 0, -d), (0, -h, 0)),
                    "west": ((ox, oy + h, oz), (0, 0, d), (0, -h, 0)),
                    "up": ((ox + w, oy + h, oz + d), (-w, 0, 0), (0, 0, -d)),
                    "down": ((ox + w, oy, oz), (-w, 0, 0), (0, 0, d)),
                }
                rects = c.rects()
                for f, (a, eu, ev) in spec.items():
                    a, eu, ev = np.array(a, float), np.array(eu, float), np.array(ev, float)
                    a = pc + Rc @ (a - pc)
                    eu, ev = Rc @ eu, Rc @ ev
                    a = R @ a + t
                    eu, ev = R @ eu, R @ ev
                    nrm = np.cross(eu, ev)
                    ln = np.linalg.norm(nrm)
                    if ln < 1e-9:
                        continue
                    out.append((a, eu, ev, nrm / ln, rects[f], f))
        return out

    def render(self, tex, pose=None, yaw=0.0, pitch=10.0, size=640, ss=2, hide=(), bg=(255, 255, 255, 255),
               frame=None, light=(0.35, 0.85, -0.45)):
        """orthographic z-buffer render. yaw 0 = front view, 180 = back view."""
        T = np.asarray(tex.convert("RGBA"), dtype=np.uint8)
        quads = self.quads(pose, hide)
        ya, pi = math.radians(yaw), -math.radians(pitch)
        # view: rotate model about Y (yaw) then about X (pitch); camera sits at -Z looking +Z
        Ry = np.array([[math.cos(ya), 0, math.sin(ya)], [0, 1, 0], [-math.sin(ya), 0, math.cos(ya)]])
        Rx = np.array([[1, 0, 0], [0, math.cos(pi), -math.sin(pi)], [0, math.sin(pi), math.cos(pi)]])
        V = Rx @ Ry
        pts = []
        for a, eu, ev, nrm, rect, f in quads:
            pts += [V @ a, V @ (a + eu), V @ (a + ev), V @ (a + eu + ev)]
        pts = np.array(pts)
        if frame is None:
            lo, hi = pts.min(0), pts.max(0)
            cx, cy = (lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2
            span = max(hi[0] - lo[0], hi[1] - lo[1]) * 1.06
        else:
            cx, cy, span = frame
        W = size * ss
        sc = W / span
        zb = np.full((W, W), 1e9)
        col = np.zeros((W, W, 4), dtype=np.float32)
        col[:] = bg
        LS = np.array([-0.3, -0.6, -0.75])
        LS /= np.linalg.norm(LS)
        for a, eu, ev, nrm, (rx, ry, rw, rh), f in quads:
            A, EU, EV = V @ a, V @ eu, V @ ev
            N = V @ nrm
            # screen x = -x (camera at -Z), screen y = -y
            sa = np.array([(-A[0] - (-cx)) * sc + W / 2, (-A[1] - (-cy)) * sc + W / 2])
            se1 = np.array([-EU[0] * sc, -EU[1] * sc])
            se2 = np.array([-EV[0] * sc, -EV[1] * sc])
            det = se1[0] * se2[1] - se1[1] * se2[0]
            if abs(det) < 1e-6:
                continue
            xs = [sa[0], sa[0] + se1[0], sa[0] + se2[0], sa[0] + se1[0] + se2[0]]
            ys = [sa[1], sa[1] + se1[1], sa[1] + se2[1], sa[1] + se1[1] + se2[1]]
            x0, x1 = max(int(math.floor(min(xs))), 0), min(int(math.ceil(max(xs))), W - 1)
            y0, y1 = max(int(math.floor(min(ys))), 0), min(int(math.ceil(max(ys))), W - 1)
            if x1 < x0 or y1 < y0:
                continue
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            px, py = gx - sa[0], gy - sa[1]
            s = (px * se2[1] - py * se2[0]) / det
            t = (se1[0] * py - se1[1] * px) / det
            m = (s >= 0) & (s < 1) & (t >= 0) & (t < 1)
            if not m.any():
                continue
            depth = A[2] + s * EU[2] + t * EV[2]
            tx = np.clip((rx + s * rw).astype(int), 0, self.tw - 1)
            ty = np.clip((ry + t * rh).astype(int), 0, self.th - 1)
            texel = T[ty, tx].astype(np.float32)
            m &= texel[..., 3] >= 128
            m &= depth < zb[y0 : y1 + 1, x0 : x1 + 1]
            if not m.any():
                continue
            # two-sided shading: use normal facing the camera
            nz = N if N[2] <= 0 else -N
            ns = np.array([-nz[0], -nz[1], nz[2]])
            sh = 0.60 + 0.50 * max(0.0, float(np.dot(ns, LS)))
            rgb = texel[..., :3] * sh
            sub = col[y0 : y1 + 1, x0 : x1 + 1]
            sub[m, :3] = rgb[m]
            sub[m, 3] = 255
            zb[y0 : y1 + 1, x0 : x1 + 1][m] = depth[m]
        img = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8), "RGBA")
        if ss > 1:
            img = img.resize((size, size), Image.LANCZOS)
        return img

    def bounds_xyz(self, pose=None):
        q = self.quads(pose)
        p = np.array([a + e for a, eu, ev, n, r, f in q for e in (0, eu, ev, eu + ev)])
        return p.min(0), p.max(0)


def write_json(path, obj):
    with open(path, "w") as fh:
        json.dump(obj, fh, indent=2)
        fh.write("\n")
