"""Voxelise the Warcraft III mesh into a Bedrock-friendly grid.

Frames
------
* WC3 : X forward, Y left, Z up.
* INT : the "visual" frame (what Blockbench / the game draw): X = character's right, Y up, -Z forward.
        x_int = -y_wc3, y_int = z_wc3, z_int = -x_wc3   (a proper rotation, det = +1)
  Bedrock *files* store x mirrored (x_file = -x_int); the exporter handles that.
"""
import math

import numpy as np

import mdx

SCALE = 0.35  # WC3 unit -> Bedrock unit (1/16 block).  193 WC3 units tall -> ~68 units (4.2 blocks)
FOOT_LIFT = 2.05  # model sits slightly below z=0 in the original

# --------------------------------------------------------------------------- geoset table
# class: colour/material family used by the painter, prio: who wins a voxel shared by several geosets
HIDDEN = {1, 2, 38, 39}  # gore / decay / portrait backdrop: never visible in normal sequences
FLY_GEOSET = 0
GLOW = {21, 34, 35, 36, 40, 41}  # additive glow / poison sprites -> painted as emissive texels instead
GEO = {
    0: ("fly", 9),
    3: ("hook", 6), 16: ("hook", 6), 17: ("hook_gem", 7),
    4: ("bone", 8), 13: ("bone", 8), 28: ("bone", 8), 37: ("bone", 8),
    5: ("skin", 1),
    6: ("flesh", 3), 14: ("flesh", 3), 15: ("flesh", 3), 27: ("flesh", 4), 29: ("flesh_ring", 4),
    7: ("chain", 6), 30: ("flail", 7), 31: ("flail_stud", 8), 32: ("flail_stud", 8),
    8: ("horn", 8),
    9: ("blade", 6), 10: ("blade_edge", 7),
    11: ("eye", 10), 33: ("eye_dark", 10),
    12: ("tooth", 9), 18: ("brow", 8), 19: ("tooth", 9),
    20: ("hilt", 6), 22: ("gem", 8), 23: ("gem", 8),
    24: ("boil", 5), 25: ("boil", 6),
    26: ("cloth", 2),
}
CLASSES = sorted({v[0] for v in GEO.values()})
CLASS_ID = {c: i for i, c in enumerate(CLASSES)}


def to_int(p):
    p = np.asarray(p, float)
    return SCALE * np.stack([-p[..., 1], p[..., 2] + FOOT_LIFT, -p[..., 0]], -1)


def load(path):
    m = mdx.parse(path)
    return m


def triangles(m):
    """yield (geoset, tri_points_int(3,3), tri_vertex_bone_lists)"""
    for gi, g in enumerate(m.geosets):
        if gi not in GEO or gi == FLY_GEOSET:
            continue  # flies are placed as tiny cubes, see voxelise()
        v = to_int(np.array(g.verts).reshape(-1, 3))
        for t in g.tris:
            yield gi, v[list(t)], [g.groups[g.gndx[i]] for i in t]


def voxelise(m, V):
    """returns dict(geo=int16[nx,ny,nz], bone=int16[...], origin=(3,), V, shape) for the solid model"""
    allp = np.vstack([to_int(np.array(g.verts).reshape(-1, 3)) for gi, g in enumerate(m.geosets) if gi in GEO])
    lo = np.floor(allp.min(0) / V).astype(int) - 2
    hi = np.ceil(allp.max(0) / V).astype(int) + 2
    shape = tuple(hi - lo)
    origin = lo * V
    N = int(np.prod(shape))
    step = V / 3.0
    vox_l, geo_l = [], []
    bv_l, bg_l, bb_l, bw_l = [], [], [], []
    for gi, tri, groups in triangles(m):
        a, b, c = tri
        n = int(max(1, math.ceil(max(np.linalg.norm(b - a), np.linalg.norm(c - b), np.linalg.norm(a - c)) / step)))
        ii, jj = np.meshgrid(np.arange(n + 1), np.arange(n + 1))
        keep = (ii + jj) <= n
        i = ii[keep] / n
        j = jj[keep] / n
        lam = np.stack([1 - i - j, i, j], 1)  # (K,3)
        pts = lam @ tri
        idx = np.floor((pts - origin) / V).astype(int)
        flat = np.ravel_multi_index(idx.T, shape)
        vox_l.append(flat)
        geo_l.append(np.full(len(flat), gi, np.int16))
        for vi in range(3):
            grp = groups[vi]
            for bone in grp:
                bv_l.append(flat)
                bg_l.append(np.full(len(flat), gi, np.int16))
                bb_l.append(np.full(len(flat), bone, np.int16))
                bw_l.append(lam[:, vi] / len(grp))
    vox = np.concatenate(vox_l)
    geo = np.concatenate(geo_l)
    prio = np.array([GEO.get(k, ("", 0))[1] for k in range(max(GEO) + 1)])
    # --- winner geoset per voxel: highest priority, then most samples
    NG = max(GEO) + 1
    key = vox.astype(np.int64) * NG + geo
    uk, cnt = np.unique(key, return_counts=True)
    uv_, ug = uk // NG, uk % NG
    score = prio[ug] * 1e9 + cnt
    order = np.lexsort((score, uv_))  # by voxel, then score ascending
    uv_s, ug_s = uv_[order], ug[order]
    last = np.r_[uv_s[1:] != uv_s[:-1], True]
    geo_grid = np.full(N, -1, np.int16)
    geo_grid[uv_s[last]] = ug_s[last]
    # --- bone per voxel from the winner geoset's skin weights
    bv = np.concatenate(bv_l)
    bg = np.concatenate(bg_l)
    bb = np.concatenate(bb_l)
    bw = np.concatenate(bw_l)
    ok = geo_grid[bv] == bg
    bv, bb, bw = bv[ok], bb[ok], bw[ok]
    NB = 128
    key = bv.astype(np.int64) * NB + bb
    uk, inv = np.unique(key, return_inverse=True)
    wsum = np.bincount(inv, weights=bw)
    uv_, ub = uk // NB, uk % NB
    order = np.lexsort((wsum, uv_))
    uv_s, ub_s = uv_[order], ub[order]
    last = np.r_[uv_s[1:] != uv_s[:-1], True]
    bone_grid = np.full(N, -1, np.int16)
    bone_grid[uv_s[last]] = ub_s[last]
    geo_grid = geo_grid.reshape(shape)
    bone_grid = bone_grid.reshape(shape)
    # the fly swarm: one 2x2x2 cube per fly bone at its pivot (the bones orbit the body via a looping animation)
    for b in m.bones:
        if b.geoset == FLY_GEOSET:
            i0 = np.floor((to_int(m.pivots[b.id]) - origin) / V).astype(int)
            geo_grid[i0[0]:i0[0] + 2, i0[1]:i0[1] + 2, i0[2]:i0[2] + 2] = FLY_GEOSET
            bone_grid[i0[0]:i0[0] + 2, i0[1]:i0[1] + 2, i0[2]:i0[2] + 2] = b.id
    surf = geo_grid >= 0
    # --- exterior flood fill (6-connected) from the padded border
    ext = np.zeros(shape, bool)
    ext[0, :, :] = ext[-1, :, :] = True
    ext[:, 0, :] = ext[:, -1, :] = True
    ext[:, :, 0] = ext[:, :, -1] = True
    ext &= ~surf
    empty = ~surf
    while True:
        g = ext.copy()
        g[1:] |= ext[:-1]; g[:-1] |= ext[1:]
        g[:, 1:] |= ext[:, :-1]; g[:, :-1] |= ext[:, 1:]
        g[:, :, 1:] |= ext[:, :, :-1]; g[:, :, :-1] |= ext[:, :, 1:]
        g &= empty
        if (g == ext).all():
            break
        ext = g
    interior = empty & ~ext
    # --- fill enclosed voids with the nearest surface voxel's identity
    todo = interior.copy()
    while todo.any():
        progressed = False
        for ax in range(3):
            for sh in (1, -1):
                ng = np.roll(geo_grid, sh, ax)
                nb = np.roll(bone_grid, sh, ax)
                # roll wraps around; the padded border is always empty so wrap-around never carries data
                take = todo & (ng >= 0)
                if take.any():
                    geo_grid[take] = ng[take]
                    bone_grid[take] = nb[take]
                    todo &= ~take
                    progressed = True
        if not progressed:
            break
    solid = geo_grid >= 0
    return dict(geo=geo_grid, bone=bone_grid, solid=solid, ext=ext, origin=origin, V=V, shape=shape)


def flood_exterior(solid):
    """6-connected flood fill of empty voxels reachable from the padded border"""
    ext = np.zeros(solid.shape, bool)
    ext[0, :, :] = ext[-1, :, :] = True
    ext[:, 0, :] = ext[:, -1, :] = True
    ext[:, :, 0] = ext[:, :, -1] = True
    ext &= ~solid
    empty = ~solid
    while True:
        g = ext.copy()
        g[1:] |= ext[:-1]; g[:-1] |= ext[1:]
        g[:, 1:] |= ext[:, :-1]; g[:, :-1] |= ext[:, 1:]
        g[:, :, 1:] |= ext[:, :, :-1]; g[:, :, :-1] |= ext[:, :, 1:]
        g &= empty
        if (g == ext).all():
            return ext
        ext = g


# classes kept at the fine 0.5 resolution (everything else is merged into 1x1x1 blocks)
FINE_CLASSES = {"tooth", "eye", "eye_dark", "brow", "fly", "bone"}


def hybrid(m, fine_classes=FINE_CLASSES, min_fill=3):
    """Mixed resolution grid G (cell = 0.5 units).

    Smooth regions are snapped to 2x2x2 blocks (one 1-unit cube), blocks that contain any voxel of a
    'fine' class stay at 0.5 so teeth, eyes, brows, ribs and the fly swarm keep their detail."""
    F = voxelise(m, 0.5)
    sh = [s // 2 * 2 for s in F["solid"].shape]
    sl = tuple(slice(0, s) for s in sh)
    geo, bone, solid = F["geo"][sl], F["bone"][sl], F["solid"][sl]
    names = np.array([GEO[g][0] if g in GEO else "" for g in range(max(GEO) + 1)], object)
    det = np.zeros(geo.shape, bool)
    det[solid] = np.isin(names[geo[solid]], list(fine_classes))

    def blk(a):
        return a.reshape(sh[0] // 2, 2, sh[1] // 2, 2, sh[2] // 2, 2)

    refine = blk(det).sum((1, 3, 5)) > 0
    cnt = blk(solid).sum((1, 3, 5))
    csolid = (cnt >= min_fill) & ~refine
    best = np.full(csolid.shape, -1, np.int16)
    bc = np.zeros(csolid.shape, int)
    for b in sorted(set(bone[solid].tolist())):
        c = blk(solid & (bone == b)).sum((1, 3, 5))
        u = c > bc
        bc[u] = c[u]
        best[u] = b
    # dominant geoset of each coarse block (priority first, then count)
    bgeo = np.full(csolid.shape, -1, np.int16)
    bscore = np.full(csolid.shape, -1.0)
    for g in sorted(set(geo[solid].tolist())):
        c = blk(solid & (geo == g)).sum((1, 3, 5))
        score = np.where(c > 0, GEO[g][1] * 1000.0 + c, -1.0)
        u = score > bscore
        bscore[u] = score[u]
        bgeo[u] = g
    up = lambda a: np.repeat(np.repeat(np.repeat(a, 2, 0), 2, 1), 2, 2)
    fine_cells = up(refine) & solid
    coarse_cells = up(csolid)
    G_geo = np.where(fine_cells, geo, np.where(coarse_cells, up(bgeo), -1)).astype(np.int16)
    G_bone = np.where(fine_cells, bone, np.where(coarse_cells, up(best), -1)).astype(np.int16)
    G_solid = fine_cells | coarse_cells
    out = dict(F)
    out.update(geo=G_geo, bone=G_bone, solid=G_solid, ext=flood_exterior(G_solid), shape=tuple(sh),
               refine=refine, coarse=csolid, coarse_bone=best)
    return out
