"""Geometry description library shared by the Arthas and Frostmourne specs.

Everything is expressed in *Bedrock geometry coordinates* (the coordinates that
end up in `*.geo.json`): +Y up, the model's front faces -Z and the character's
RIGHT side is -X.  All cube sizes are integers because Bedrock/Blockbench floor
box-UV sizes; thin parts are made with negative `inflate`.
"""
from __future__ import annotations
import math
from dataclasses import dataclass, field
from typing import Optional

LAYERS = ("cloth", "metal", "frost", "sword")


@dataclass
class Cube:
    bone: str
    origin: tuple
    size: tuple
    mat: str
    name: str = ""
    inflate: float = 0.0
    pivot: Optional[tuple] = None
    rot: Optional[tuple] = None
    detail: str = ""          # optional special painter key
    ref: Optional[tuple] = None  # optional reference point (sword grip centre) for world-space painters
    uv: tuple = (0, 0)        # filled by the packer
    layer: str = ""           # filled from the bone

    def __post_init__(self):
        for s in self.size:
            assert float(s).is_integer() and s >= 1, f"integer size >=1 required: {self.bone} {self.size}"
        self.origin = tuple(float(v) for v in self.origin)
        self.size = tuple(int(v) for v in self.size)
        if self.rot is not None:
            assert sum(1 for r in self.rot if abs(r) > 1e-6) <= 1, f"single-axis rotation only: {self.bone} {self.rot}"
            if self.pivot is None:
                self.pivot = tuple(o + s / 2 for o, s in zip(self.origin, self.size))


@dataclass
class Bone:
    name: str
    parent: Optional[str]
    pivot: tuple
    layer: str
    rotation: tuple = (0, 0, 0)
    locators: dict = field(default_factory=dict)
    cubes: list = field(default_factory=list)


class Model:
    def __init__(self, identifier: str):
        self.identifier = identifier
        self.bones: dict[str, Bone] = {}
        self.order: list[str] = []

    # ------------------------------------------------------------------ bones
    def bone(self, name, parent, pivot, layer, rotation=(0, 0, 0), locators=None):
        assert layer in LAYERS, layer
        assert name not in self.bones, f"duplicate bone {name}"
        if parent is not None:
            assert parent in self.bones, f"unknown parent {parent} for {name}"
        b = Bone(name, parent, tuple(float(v) for v in pivot), layer, tuple(rotation), locators or {})
        self.bones[name] = b
        self.order.append(name)
        return b

    def cube(self, bone, origin, size, mat, **kw):
        b = self.bones[bone]
        c = Cube(bone, origin, size, mat, **kw)
        c.layer = b.layer
        if not c.name:
            c.name = f"{bone}_{len(b.cubes)}"
        b.cubes.append(c)
        return c

    def all_cubes(self):
        for n in self.order:
            for c in self.bones[n].cubes:
                yield c

    def layer_bones(self, layer):
        return [n for n in self.order if self.bones[n].layer == layer]

    def layer_cubes(self, layer):
        return [c for c in self.all_cubes() if c.layer == layer]

    # ---------------------------------------------------------------- helpers
    def mirror_cube(self, bone_to, c: Cube, **over):
        ox = -(c.origin[0] + c.size[0])
        piv = None if c.pivot is None else (-c.pivot[0], c.pivot[1], c.pivot[2])
        rot = None
        if c.rot is not None:
            rot = (c.rot[0], -c.rot[1], -c.rot[2])
        kw = dict(inflate=c.inflate, pivot=piv, rot=rot, detail=over.get("detail", c.detail))
        return self.cube(bone_to, (ox, c.origin[1], c.origin[2]), c.size, c.mat, **kw)

    def mirror_bone(self, src, dst, parent):
        """Copy bone `src` (a right-side bone) mirrored to the left side."""
        s = self.bones[src]
        piv = (-s.pivot[0], s.pivot[1], s.pivot[2])
        rot = (s.rotation[0], -s.rotation[1], -s.rotation[2])
        loc = {k: (-v[0], v[1], v[2]) for k, v in s.locators.items()}
        self.bone(dst, parent, piv, s.layer, rot, loc)
        for c in list(s.cubes):
            self.mirror_cube(dst, c)

    def spike(self, bone, base_center, base_w, base_d, length, segs, tilt, plane="z",
              mat="spike", tip_inflate=-0.25, detail=""):
        """Tapered, curved spike made of `segs` stacked single-axis-rotated cubes.

        base_center: (x, y, z) centre of the bottom face.  tilt: total bend in
        degrees (positive bends toward +x for plane 'z', toward -z for plane 'x').
        """
        x, y, z = base_center
        segs = max(segs, math.ceil(length / 2.6))   # fine segments give a smooth, sharp taper
        seg_h = max(1, round(length / segs))
        ang_total = math.radians(tilt)
        cx, cy = 0.0, 0.0
        made = []
        for i in range(segs):
            t = i / max(1, segs - 1)
            w = max(1, round(base_w + (1 - base_w) * t))
            d = max(1, round(base_d + (1 - base_d) * t))
            a = ang_total * (i + 0.5) / segs
            # centre of this segment along the bent path
            half = seg_h / 2
            px = cx + math.sin(a) * half
            py = cy + math.cos(a) * half
            cx += math.sin(a) * seg_h
            cy += math.cos(a) * seg_h
            if plane == "z":
                centre = (x + px, y + py, z)
                rot = (0, 0, -math.degrees(a))
            else:
                centre = (x, y + py, z - px)
                rot = (math.degrees(a), 0, 0)
            origin = (centre[0] - w / 2, centre[1] - seg_h / 2, centre[2] - d / 2)
            infl = tip_inflate if i == segs - 1 else (tip_inflate / 2 if i >= segs - 2 and segs > 3 else 0)
            made.append(self.cube(bone, origin, (w, seg_h, d), mat, inflate=infl,
                                  pivot=centre, rot=rot if abs(a) > 1e-6 else None, detail=detail))
        return made

    def mirror_cubes(self, src, dst):
        """Mirror every cube of right-side bone `src` into existing left-side bone `dst`."""
        for c in list(self.bones[src].cubes):
            self.mirror_cube(dst, c)

    def mirror_spike(self, bone, made):
        return [self.mirror_cube(bone, c) for c in made]


# ------------------------------------------------------------------ UV packing
def pack_layer(cubes, size=256):
    """Shelf-pack box-UV rectangles for one layer. Returns used height."""
    items = []
    for c in cubes:
        w, h, d = c.size
        items.append((c, 2 * (d + w), d + h))
    items.sort(key=lambda t: (-t[2], -t[1]))
    x = y = shelf_h = 0
    for c, rw, rh in items:
        if x + rw > size:
            x = 0
            y += shelf_h
            shelf_h = 0
        if y + rh > size:
            raise RuntimeError(f"layer overflow packing {c.bone} (y={y}+{rh} > {size})")
        c.uv = (x, y)
        x += rw
        shelf_h = max(shelf_h, rh)
    return y + shelf_h


def face_rects(c: Cube):
    """Return {face: (x, y, w, h)} in layout units using the Bedrock box-UV net.

    Net (u,v = cube.uv):  row0: up at (u+d, v) wxd, down at (u+d+w, v) wxd
                          row1: east(-x) (u, v+d) dxh, north(front,-z) (u+d, v+d) wxh,
                                west(+x) (u+d+w, v+d) dxh, south(back,+z) (u+2d+w, v+d) wxh
    """
    w, h, d = c.size
    u, v = c.uv
    return {
        "up": (u + d, v, w, d),
        "down": (u + d + w, v, w, d),
        "east": (u, v + d, d, h),
        "north": (u + d, v + d, w, h),
        "west": (u + d + w, v + d, d, h),
        "south": (u + 2 * d + w, v + d, w, h),
    }


# ------------------------------------------------------------ polyline chains
def chain_xy(model, bone, pts, widths, thick, mat, z=0.0, overlap=1, tip_inflate=-0.2, detail=""):
    """Stack of cubes following an XY polyline (long axis X, rotated about Z).
    pts: [(x,y), ...]; widths: height of each segment's cube (len(pts)-1)."""
    out = []
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy)
        length = max(1, math.ceil(L) + overlap)
        ang = math.degrees(math.atan2(dy, dx))
        w = widths[i]
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        origin = (cx - length / 2, cy - w / 2, z - thick / 2)
        last = i == len(pts) - 2
        out.append(model.cube(bone, origin, (length, w, thick), mat,
                              inflate=tip_inflate if last else 0,
                              pivot=(cx, cy, z), rot=(0, 0, ang) if abs(ang) > 1e-6 else None, detail=detail))
    return out


def chain_yz(model, bone, pts, widths, thick, mat, x=0.0, overlap=1, tip_inflate=-0.2, detail=""):
    """Same as chain_xy but in the YZ plane (long axis Z, rotated about X); pts: [(y,z), ...]."""
    out = []
    for i in range(len(pts) - 1):
        (y0, z0), (y1, z1) = pts[i], pts[i + 1]
        dy, dz = y1 - y0, z1 - z0
        L = math.hypot(dy, dz)
        length = max(1, math.ceil(L) + overlap)
        # rotation about X by angle taking +Z toward +Y is -ang(deg) in bone space
        ang = -math.degrees(math.atan2(dy, dz))
        w = widths[i]
        cy, cz = (y0 + y1) / 2, (z0 + z1) / 2
        origin = (x - thick / 2, cy - w / 2, cz - length / 2)
        last = i == len(pts) - 2
        out.append(model.cube(bone, origin, (thick, w, length), mat,
                              inflate=tip_inflate if last else 0,
                              pivot=(x, cy, cz), rot=(ang, 0, 0) if abs(ang) > 1e-6 else None, detail=detail))
    return out
