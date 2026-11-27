"""Find geometry clusters that are detached from the main body in rest pose."""
import sys, os, glob
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from mcgeo import *

def world_boxes(geo):
    mats = bone_world_matrices(geo["bones"])
    out = []
    for b in geo["bones"]:
        M = mats[b["name"]]
        for ci, cube in enumerate(b.get("cubes", []) or []):
            ox, oy, oz = cube["origin"]; sx, sy, sz = cube["size"]
            Mc = M
            if cube.get("rotation"):
                Mc = M @ about_pivot(rot_matrix(*cube["rotation"]), to_int(cube.get("pivot", [0, 0, 0])))
            pts = np.array([(Mc @ np.array([cx, cy, cz, 1.0]))[:3] for cx in (-(ox + sx), -ox) for cy in (oy, oy + sy) for cz in (oz, oz + sz)])
            out.append((b["name"], ci, pts.min(0), pts.max(0)))
    return out

def clusters(geo, tol=0.6):
    bx = world_boxes(geo)
    n = len(bx)
    parent = list(range(n))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]; i = parent[i]
        return i
    for i in range(n):
        for j in range(i + 1, n):
            a, b = bx[i], bx[j]
            if np.all(a[2] <= b[3] + tol) and np.all(b[2] <= a[3] + tol):
                parent[find(i)] = find(j)
    groups = {}
    for i in range(n): groups.setdefault(find(i), []).append(i)
    return bx, sorted(groups.values(), key=len, reverse=True)

def report(path_glob):
    res = {}
    for p in glob.glob(path_glob):
        for gid, g in collect_geometries(p).items():
            if not any(b.get("cubes") for b in g["bones"]): continue
            bx, cl = clusters(g)
            if len(cl) > 1:
                res[gid] = [(len(c), sorted({bx[i][0] for i in c}), np.round(np.min([bx[i][2] for i in c], 0)).tolist(), np.round(np.max([bx[i][3] for i in c], 0)).tolist()) for c in cl[1:]]
    return res

if __name__ == "__main__":
    for gid, lst in sorted(report(sys.argv[1] + "/resource_pack/models/entity/*.json").items()):
        print(gid)
        for l in lst: print("   ", l)
