#!/usr/bin/env python3
"""Isometric preview of the 3D voxel held items (what the texture-mesh geometry produces).
Usage: preview_items.py <pack dir> <out.png> item_id [item_id ...]"""
import math, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

T = 1.5      # thickness in model units (matches ITEM_THICKNESS in build.py)
VOX = 0.5    # voxel edge in model units
YAW, PITCH = math.radians(-35), math.radians(22)
S = 11       # screen px per model unit


def proj(x, y, z):
    xr = x * math.cos(YAW) + z * math.sin(YAW)
    zr = -x * math.sin(YAW) + z * math.cos(YAW)
    yr = y * math.cos(PITCH) - zr * math.sin(PITCH)
    return xr * S, -yr * S, zr * math.cos(PITCH) + y * math.sin(PITCH)


def render(png):
    a = np.asarray(Image.open(png).convert("RGBA"))
    h, w, _ = a.shape
    opaque = a[..., 3] > 0
    W = 330
    img = Image.new("RGBA", (W, W), (48, 48, 52, 255))
    d = ImageDraw.Draw(img, "RGBA")
    cx, cy = W / 2, W / 2 + 10
    polys = []
    for j in range(h):
        for i in range(w):
            if not opaque[j, i]:
                continue
            x0, x1 = (i - w / 2) * VOX, (i - w / 2 + 1) * VOX
            y1, y0 = (h / 2 - j) * VOX, (h / 2 - j - 1) * VOX
            z0, z1 = 0.0, T
            col = tuple(int(c) for c in a[j, i, :3])
            free = lambda di, dj: not (0 <= i + di < w and 0 <= j + dj < h and opaque[j + dj, i + di])
            faces = [("front", [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)], 1.0)]
            faces.append(("back", [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], 0.55))
            if free(1, 0): faces.append(("r", [(x1, y0, z0), (x1, y0, z1), (x1, y1, z1), (x1, y1, z0)], 0.78))
            if free(-1, 0): faces.append(("l", [(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)], 0.62))
            if free(0, -1): faces.append(("t", [(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], 1.12))
            if free(0, 1): faces.append(("b", [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], 0.5))
            for name, pts, sh in faces:
                pp = [proj(*p) for p in pts]
                depth = sum(p[2] for p in pp) / 4
                polys.append((depth, pp, tuple(min(255, int(c * sh)) for c in col)))
    polys.sort(key=lambda t: t[0])
    for depth, pp, col in polys:
        d.polygon([(cx + p[0], cy + p[1]) for p in pp], fill=col + (255,))
    return img


if __name__ == "__main__":
    pack, out, *ids = sys.argv[1:]
    tiles = [render(Path(pack) / "textures" / "voxel" / "items" / f"{i}.png") for i in ids]
    sheet = Image.new("RGBA", (330 * len(tiles), 330))
    for k, t in enumerate(tiles):
        sheet.paste(t, (330 * k, 0))
    sheet.save(out)
