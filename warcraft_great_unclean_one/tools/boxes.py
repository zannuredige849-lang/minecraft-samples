"""Greedy decomposition of the hybrid voxel grid into axis-aligned boxes (one bone at a time) + face exposure."""
import numpy as np

FACES = ("north", "south", "east", "west", "up", "down")
# (axis, sign): north = -z, south = +z, east = +x, west = -x, up = +y, down = -y   (INT frame)
FACE_DIR = {"north": (2, -1), "south": (2, 1), "east": (0, 1), "west": (0, -1), "up": (1, 1), "down": (1, -1)}


def _greedy(free):
    """scanline greedy box merge on a boolean array; returns [(lo, hi)]"""
    out = []
    for x, y, z in np.argwhere(free):
        if not free[x, y, z]:
            continue
        x1 = x + 1
        while x1 < free.shape[0] and free[x1, y, z]:
            x1 += 1
        z1 = z + 1
        while z1 < free.shape[2] and free[x:x1, y, z1].all():
            z1 += 1
        y1 = y + 1
        while y1 < free.shape[1] and free[x:x1, y1, z:z1].all():
            y1 += 1
        free[x:x1, y:y1, z:z1] = False
        out.append(((int(x), int(y), int(z)), (int(x1), int(y1), int(z1))))
    return out


PERMS = [(0, 1, 2), (0, 2, 1), (1, 0, 2), (1, 2, 0), (2, 0, 1), (2, 1, 0)]


def decompose_hybrid(vx):
    """boxes for the hybrid grid: coarse cells (step 2 in grid units) and fine cells (step 1)"""
    solid, bone = vx["solid"], vx["bone"]
    out = []
    ids = sorted(set(bone[solid].tolist()))
    for k in ids:
        mask = vx["coarse"] & (vx["coarse_bone"] == k)
        if mask.any():
            best = None
            for p in PERMS:
                res = _greedy(np.ascontiguousarray(mask.transpose(p)).copy())
                if best is None or len(res) < len(best[1]):
                    best = (p, res)
            p, res = best
            inv = np.argsort(p)
            for lo, hi in res:
                out.append(dict(bone=int(k), step=2,
                                lo=tuple(2 * lo[inv[i]] for i in range(3)), hi=tuple(2 * hi[inv[i]] for i in range(3))))
    refined_cells = np.repeat(np.repeat(np.repeat(vx["refine"], 2, 0), 2, 1), 2, 2) & solid
    for k in ids:
        mask = refined_cells & (bone == k)
        if mask.any():
            best = None
            for p in PERMS:
                res = _greedy(np.ascontiguousarray(mask.transpose(p)).copy())
                if best is None or len(res) < len(best[1]):
                    best = (p, res)
            p, res = best
            inv = np.argsort(p)
            for lo, hi in res:
                out.append(dict(bone=int(k), step=1, lo=tuple(lo[inv[i]] for i in range(3)), hi=tuple(hi[inv[i]] for i in range(3))))
    kept = np.where(solid, bone, -1).astype(np.int16)
    return out, kept


def exposure(boxes, kept, ext):
    """for every box decide which faces need texture.

    A face is visible when any voxel on it touches outside air or a voxel of another bone
    (so joints stay closed while the bones move)."""
    shape = kept.shape
    pad = np.pad(kept, 1, constant_values=-1)  # -1 = air/void
    pext = np.pad(ext, 1, constant_values=True)
    for bx in boxes:
        (x0, y0, z0), (x1, y1, z1) = bx["lo"], bx["hi"]
        vis = {}
        for f in FACES:
            ax, sg = FACE_DIR[f]
            sl = [slice(x0 + 1, x1 + 1), slice(y0 + 1, y1 + 1), slice(z0 + 1, z1 + 1)]
            if sg > 0:
                sl[ax] = slice((x0, y0, z0)[ax] + 1 + ((x1, y1, z1)[ax] - (x0, y0, z0)[ax]), (x1, y1, z1)[ax] + 2)
            else:
                sl[ax] = slice((x0, y0, z0)[ax], (x0, y0, z0)[ax] + 1)
            nb = pad[tuple(sl)]
            ne = pext[tuple(sl)]
            visible = (ne & (nb < 0)) | ((nb >= 0) & (nb != bx["bone"]))
            vis[f] = bool(visible.any())
        bx["faces"] = vis
    return boxes

