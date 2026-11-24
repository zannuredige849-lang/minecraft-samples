"""Side-by-side: original Warcraft III mesh (flat colours per material family) vs the Bedrock voxel model.

    python3 tools/compare.py path/to/model.mdx out.png
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import mdx  # noqa: E402
import preview  # noqa: E402
import voxel  # noqa: E402

FLAT = {"skin": (126, 150, 92), "boil": (214, 200, 118), "horn": (200, 190, 150), "bone": (222, 212, 180),
        "flesh": (176, 98, 100), "flesh_ring": (126, 58, 64), "chain": (96, 96, 104), "flail": (62, 62, 72),
        "flail_stud": (176, 170, 150), "hook": (120, 90, 72), "hook_gem": (80, 230, 130), "blade": (150, 160, 164),
        "blade_edge": (200, 208, 204), "eye": (255, 190, 40), "eye_dark": (20, 12, 10), "tooth": (236, 226, 176),
        "brow": (90, 110, 70), "hilt": (100, 116, 86), "gem": (80, 235, 130), "cloth": (96, 82, 70), "fly": (40, 36, 34)}


def raw_render(m, frame, yaw, pitch, size):
    ya, pi = math.radians(yaw), -math.radians(pitch)
    Ry = np.array([[math.cos(ya), 0, math.sin(ya)], [0, 1, 0], [-math.sin(ya), 0, math.cos(ya)]])
    Rx = np.array([[1, 0, 0], [0, math.cos(pi), -math.sin(pi)], [0, math.sin(pi), math.cos(pi)]])
    Vm = Rx @ Ry
    cx, cy, span = frame
    sc = size / span
    img = np.full((size, size, 3), (246, 244, 238), np.float32)
    zb = np.full((size, size), 1e9)
    for gi, g in enumerate(m.geosets):
        if gi not in voxel.GEO or gi == voxel.FLY_GEOSET:
            continue
        base = np.array(FLAT[voxel.GEO[gi][0]], float)
        v = voxel.to_int(np.array(g.verts).reshape(-1, 3)) @ Vm.T
        for t in g.tris:
            p = v[list(t)]
            n = np.cross(p[1] - p[0], p[2] - p[0])
            ln = np.linalg.norm(n)
            if ln < 1e-9:
                continue
            n /= ln
            if n[2] > 0:
                n = -n
            sh = 0.62 + 0.45 * max(0.0, float(np.dot(n * [-1, -1, 1], [-0.35, -0.8, -0.5]) * -1))
            sx = -(p[:, 0] - cx) * sc + size / 2
            sy = -(p[:, 1] - cy) * sc + size / 2
            x0, x1 = int(max(sx.min(), 0)), int(min(sx.max() + 1, size - 1))
            y0, y1 = int(max(sy.min(), 0)), int(min(sy.max() + 1, size - 1))
            if x1 < x0 or y1 < y0:
                continue
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + .5, np.arange(y0, y1 + 1) + .5)
            d = (sy[1] - sy[2]) * (sx[0] - sx[2]) + (sx[2] - sx[1]) * (sy[0] - sy[2])
            if abs(d) < 1e-9:
                continue
            a = ((sy[1] - sy[2]) * (gx - sx[2]) + (sx[2] - sx[1]) * (gy - sy[2])) / d
            b = ((sy[2] - sy[0]) * (gx - sx[2]) + (sx[0] - sx[2]) * (gy - sy[2])) / d
            c = 1 - a - b
            mk = (a >= 0) & (b >= 0) & (c >= 0)
            z = a * p[0, 2] + b * p[1, 2] + c * p[2, 2]
            sub = zb[y0:y1 + 1, x0:x1 + 1]
            mk &= z < sub
            sub[mk] = z[mk]
            img[y0:y1 + 1, x0:x1 + 1][mk] = base * sh
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))


def main(src, out):
    m = mdx.parse(src)
    mdl = preview.Model()
    _, fr = mdl.render(None, 0, 0, 8, size=200, ss=1)
    W = 640
    shots = [("front", 0, 8, (fr[0] + 6, fr[1], fr[2] * 1.55)), ("3/4", 38, 14, (fr[0] + 6, fr[1], fr[2] * 1.55)),
             ("side", 90, 6, (fr[0] + 6, fr[1], fr[2] * 1.55)), ("back", 180, 8, (fr[0] + 6, fr[1], fr[2] * 1.55)),
             ("head", 0, 6, (fr[0] + 8, fr[1] + 22, fr[2] * 0.42)), ("belly", 0, 6, (fr[0] + 8, fr[1] - 2, fr[2] * 0.55))]
    sheet = Image.new("RGB", (W * 2, 36 + (W + 20) * len(shots)), "white")
    dr = ImageDraw.Draw(sheet)
    for i, (name, yaw, pit, frame) in enumerate(shots):
        y = 36 + i * (W + 20)
        a = raw_render(m, frame, yaw, pit, W)
        b, _ = mdl.render(None, 0, yaw, pit, size=W, ss=1, frame=frame)
        sheet.paste(a, (0, y))
        sheet.paste(b, (W, y))
        dr.text((6, y + 4), "original mesh: " + name, fill=(120, 0, 0))
        dr.text((W + 6, y + 4), "Bedrock voxel model: " + name, fill=(0, 90, 0))
    dr.text((6, 10), "Great Unclean One - original Warcraft III mesh (left) vs converted Bedrock geometry (right)", fill=(0, 0, 0))
    sheet.save(out)
    print("saved", out)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
