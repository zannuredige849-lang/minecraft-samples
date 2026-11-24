"""Build the Great Unclean One add-on assets from the Warcraft III .mdx model.

    python3 tools/build.py path/to/GreatUncleanOne.mdx [--fast]

Writes (relative to the add-on root):
    resource_pack/models/entity/great_unclean_one.geo.json
    resource_pack/textures/entity/great_unclean_one.png
    resource_pack/animations/great_unclean_one.animation.json
"""
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import anim  # noqa: E402
import boxes as bxm  # noqa: E402
import mdx  # noqa: E402
import pack as packfiles  # noqa: E402
import paint  # noqa: E402
import voxel  # noqa: E402

ROOT = os.path.dirname(HERE)
RP = os.path.join(ROOT, "resource_pack")
NAME = "great_unclean_one"
V = 0.5  # grid cell size of the hybrid grid (1-unit cubes for smooth parts, 0.5 for fine detail)


def write_json(path, obj, compact=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        json.dump(obj, fh, separators=(",", ":") if compact else None, indent=None if compact else 2)
        fh.write("\n")


def face_rect_size(b, face):
    """texel size of a box face: one texel per cell of the box's own lattice (step 2 = coarse 1-unit cubes)"""
    nx, ny, nz = ((b["hi"][i] - b["lo"][i]) // b["step"] for i in range(3))
    return {"north": (nx, ny), "south": (nx, ny), "east": (nz, ny), "west": (nz, ny), "up": (nx, nz), "down": (nx, nz)}[face]


def face_voxels(b, face):
    """grid cells (I, J, K), shape (h, w), that supply the colour of texel (s=column, t=row) of a box face -- INT frame,
    matching the orientation Blockbench uses for per-face UV (checked numerically)."""
    st = b["step"]
    (i0, j0, k0), (i1, j1, k1) = (tuple(c // st for c in b["lo"]), tuple(c // st for c in b["hi"]))
    w, h = face_rect_size(b, face)
    s, t = np.meshgrid(np.arange(w), np.arange(h))
    if face == "north":
        I, J, K = i1 - 1 - s, j1 - 1 - t, np.full_like(s, k0)
    elif face == "south":
        I, J, K = i0 + s, j1 - 1 - t, np.full_like(s, k1 - 1)
    elif face == "east":
        I, J, K = np.full_like(s, i1 - 1), j1 - 1 - t, k1 - 1 - s
    elif face == "west":
        I, J, K = np.full_like(s, i0), j1 - 1 - t, k0 + s
    elif face == "up":
        I, J, K = i0 + s, np.full_like(s, j1 - 1), k0 + t
    else:  # down
        I, J, K = i0 + s, np.full_like(s, j0), k1 - 1 - t
    ax, sg = bxm.FACE_DIR[face]
    out = []
    for a, arr in enumerate((I, J, K)):
        off = (st - 1) if (a == ax and sg > 0) else 0
        out.append(arr * st + off)
    return tuple(out)


def pack(rects):
    """shelf packing with a 1 texel gutter; returns (positions, W, H)"""
    order = sorted(range(len(rects)), key=lambda i: (-rects[i][1], -rects[i][0]))
    for W, H in [(256, 256), (512, 512), (1024, 512), (1024, 1024), (2048, 1024), (2048, 2048), (4096, 4096)]:
        pos = {}
        x = y = row = 0
        ok = True
        for i in order:
            w, h = rects[i]
            cw, ch = w + 2, h + 2
            if x + cw > W:
                x, y, row = 0, y + row, 0
            if y + ch > H:
                ok = False
                break
            pos[i] = (x + 1, y + 1)
            x += cw
            row = max(row, ch)
        if ok:
            return pos, W, H
    raise RuntimeError("atlas does not fit")


def main():
    src = sys.argv[1]
    fast = "--fast" in sys.argv
    m = mdx.parse(src)
    m.path = src
    print("voxelising ...")
    vx = voxel.hybrid(m)
    used = sorted(set(vx["bone"][vx["solid"]].tolist()))
    ids, names, parent = anim.skeleton(m, used)
    print("boxes ...")
    boxes, kept = bxm.decompose_hybrid(vx)
    bxm.exposure(boxes, kept, vx["ext"])
    boxes = [b for b in boxes if any(b["faces"].values())]
    print("  %d boxes, %d bones" % (len(boxes), len(ids)))

    # ---- atlas
    rects, owner = [], []
    for bi, b in enumerate(boxes):
        for f in bxm.FACES:
            if b["faces"][f]:
                rects.append(face_rect_size(b, f))
                owner.append((bi, f))
    pos, TW, TH = pack(rects)
    print("  %d face rects -> atlas %dx%d" % (len(rects), TW, TH))
    painter = paint.Painter(vx)
    atlas = np.zeros((TH, TW, 4), np.uint8)
    for n, (bi, f) in enumerate(owner):
        b = boxes[bi]
        w, h = rects[n]
        x, y = pos[n]
        I, J, K = face_voxels(b, f)
        rgb = painter.face(I, J, K, f)
        atlas[y:y + h, x:x + w, :3] = rgb
        atlas[y:y + h, x:x + w, 3] = 255
        # gutter: replicate the border texels so mip-mapping never bleeds neighbouring faces in
        atlas[y - 1, x:x + w] = atlas[y, x:x + w]
        atlas[y + h, x:x + w] = atlas[y + h - 1, x:x + w]
        atlas[y - 1:y + h + 1, x - 1] = atlas[y - 1:y + h + 1, x]
        atlas[y - 1:y + h + 1, x + w] = atlas[y - 1:y + h + 1, x + w - 1]
    os.makedirs(os.path.join(RP, "textures/entity"), exist_ok=True)
    Image.fromarray(atlas, "RGBA").save(os.path.join(RP, "textures/entity", NAME + ".png"), optimize=True)

    # ---- geometry (file frame: x mirrored)
    origin = np.asarray(vx["origin"], float)
    rect_of = {o: i for i, o in enumerate(owner)}
    bone_json = []
    cubes_by_bone = {}
    for bi, b in enumerate(boxes):
        lo = origin + np.array(b["lo"]) * V
        sz = (np.array(b["hi"]) - np.array(b["lo"])) * V
        uv = {}
        for f in bxm.FACES:
            if not b["faces"][f]:
                continue
            U, Vv = pos[rect_of[(bi, f)]]
            w, h = face_rect_size(b, f)
            if f in ("up", "down"):
                uv[f] = {"uv": [U + w, Vv + h], "uv_size": [-w, -h]}
            else:
                uv[f] = {"uv": [U, Vv], "uv_size": [w, h]}
        cube = {"origin": [round(-(lo[0] + sz[0]), 4), round(lo[1], 4), round(lo[2], 4)],
                "size": [round(float(v), 4) for v in sz], "uv": uv}
        cubes_by_bone.setdefault(b["bone"], []).append(cube)
    for nid in ids:
        pv = anim.pivot_int(m, nid)
        bj = {"name": names[nid]}
        if parent[nid] is not None:
            bj["parent"] = names[parent[nid]]
        bj["pivot"] = [round(-float(pv[0]), 4), round(float(pv[1]), 4), round(float(pv[2]), 4)]
        if nid in cubes_by_bone:
            bj["cubes"] = cubes_by_bone[nid]
        bone_json.append(bj)
    lo_all = origin + np.array([min(b["lo"][i] for b in boxes) for i in range(3)]) * V
    hi_all = origin + np.array([max(b["hi"][i] for b in boxes) for i in range(3)]) * V
    ext = float(max(abs(lo_all[0]), abs(hi_all[0]), abs(lo_all[2]), abs(hi_all[2]))) / 16.0
    geo = {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": "geometry." + NAME,
                "texture_width": TW,
                "texture_height": TH,
                "visible_bounds_width": int(np.ceil(ext * 2.2)),
                "visible_bounds_height": int(np.ceil(hi_all[1] / 16.0 + 1)),
                "visible_bounds_offset": [0, round(float(hi_all[1]) / 32.0, 2), 0],
            },
            "bones": bone_json,
        }],
    }
    write_json(os.path.join(RP, "models/entity", NAME + ".geo.json"), geo, compact=True)

    # ---- animations
    print("animations ...")
    anims = anim.build_animations(m, ids, names, NAME)
    write_json(os.path.join(RP, "animations", NAME + ".animation.json"),
               {"format_version": "1.8.0", "animations": anims}, compact=True)
    packfiles.main()
    info = dict(boxes=len(boxes), bones=len(ids), atlas=[TW, TH],
                size_units=[round(float(v), 1) for v in (hi_all - lo_all)],
                height_blocks=round(float(hi_all[1] / 16), 2))
    print(json.dumps(info))
    return info


if __name__ == "__main__":
    main()
