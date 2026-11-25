"""Bedrock geometry loader + small numpy software renderer.

Conventions (verified earlier in Blockbench, see notes): file x is mirrored vs. the visual
frame (x_int = -x_file); bone/cube rotation (rx,ry,rz) acts as Rz(rz) Ry(-ry) Rx(-rx) in the
visual frame; Bedrock face names refer to the visual frame (east=+x_int, north=-z).
Box UV net: row v: [up][down]; row v+d: [east][north][west][south].
"""
import json, re, math
import numpy as np
from PIL import Image


def load_json(path):
    t = open(path, encoding="utf-8").read()
    t = re.sub(r"^\s*//.*$", "", t, flags=re.M)
    return json.loads(t)


def rot_matrix(rx, ry, rz):
    rx, ry, rz = map(math.radians, (-rx, -ry, rz))
    cx, sx = math.cos(rx), math.sin(rx)
    cy, sy = math.cos(ry), math.sin(ry)
    cz, sz = math.cos(rz), math.sin(rz)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


def about_pivot(R, pivot_int):
    M = np.eye(4)
    M[:3, :3] = R
    M[:3, 3] = pivot_int - R @ pivot_int
    return M


def to_int(p):
    return np.array([-p[0], p[1], p[2]], dtype=float)


def collect_geometries(path):
    """Return {identifier: {'bones': [...], 'tw':, 'th':}} from a .geo.json (1.12 / 1.16+ styles)."""
    d = load_json(path)
    out = {}
    if "minecraft:geometry" in d:
        for g in d["minecraft:geometry"]:
            desc = g["description"]
            out[desc["identifier"]] = dict(bones=g.get("bones", []), tw=desc.get("texture_width", 64),
                                           th=desc.get("texture_height", 64))
    for k, v in d.items():
        if k.startswith("geometry."):
            name = k.split(":")[0]
            out[name] = dict(bones=v.get("bones", []), tw=v.get("texturewidth", 64), th=v.get("textureheight", 64))
    return out


def bone_world_matrices(bones, pose=None):
    byname = {b["name"]: b for b in bones}
    cache = {}

    def get(name):
        if name in cache:
            return cache[name]
        b = byname[name]
        par = b.get("parent")
        P = get(par) if par and par in byname else np.eye(4)
        piv = to_int(b.get("pivot", [0, 0, 0]))
        rot = b.get("rotation", [0, 0, 0])
        pos = [0, 0, 0]
        if pose and name in pose:
            pr = pose[name]
            if isinstance(pr, dict):
                if pr.get("rot") is not None:
                    rot = [rot[i] + pr["rot"][i] for i in range(3)]
                if pr.get("pos") is not None:
                    pos = pr["pos"]
            else:
                rot = [rot[i] + pr[i] for i in range(3)]
        T = np.eye(4)
        T[:3, 3] = [-pos[0], pos[1], pos[2]]
        M = P @ T @ about_pivot(rot_matrix(*rot), piv)
        cache[name] = M
        return M
    return {b["name"]: get(b["name"]) for b in bones}


def cube_faces(cube, tw, th):
    """Yield (corner, uaxis, vaxis, uvrect[u,v,w,h]) for each face in INT frame (local, unposed)."""
    ox, oy, oz = cube["origin"]
    sx, sy, sz = cube["size"]
    inf = cube.get("inflate", 0) or 0
    ox -= inf; oy -= inf; oz -= inf
    sx += 2 * inf; sy += 2 * inf; sz += 2 * inf
    x0, x1 = -(ox + sx), -ox
    y0, y1 = oy, oy + sy
    z0, z1 = oz, oz + sz
    uv = cube.get("uv")
    rects = {}
    if isinstance(uv, dict):
        for f, e in uv.items():
            rects[f] = (e["uv"][0], e["uv"][1], e.get("uv_size", [0, 0])[0], e.get("uv_size", [0, 0])[1])
    elif uv is not None:
        u, v = uv
        w, h, d = math.ceil(sx), math.ceil(sy), math.ceil(sz)
        rects = {"east": (u, v + d, d, h), "north": (u + d, v + d, w, h), "west": (u + d + w, v + d, d, h),
                 "south": (u + 2 * d + w, v + d, w, h), "up": (u + d, v, w, d), "down": (u + d + w, v, w, d)}
        if cube.get("mirror"):
            rects["east"], rects["west"] = rects["west"], rects["east"]
    faces = {
        "north": ((x1, y1, z0), (-(x1 - x0), 0, 0), (0, -(y1 - y0), 0)),
        "south": ((x0, y1, z1), ((x1 - x0), 0, 0), (0, -(y1 - y0), 0)),
        "east": ((x1, y1, z1), (0, 0, -(z1 - z0)), (0, -(y1 - y0), 0)),
        "west": ((x0, y1, z0), (0, 0, (z1 - z0)), (0, -(y1 - y0), 0)),
        "up": ((x1, y1, z1), (-(x1 - x0), 0, 0), (0, 0, -(z1 - z0))),
        "down": ((x1, y0, z0), (-(x1 - x0), 0, 0), (0, 0, (z1 - z0))),
    }
    for name, (c, ua, va) in faces.items():
        if name in rects:
            yield name, np.array(c, float), np.array(ua, float), np.array(va, float), rects[name]


NORMALS = {"north": (0, 0, -1), "south": (0, 0, 1), "east": (1, 0, 0), "west": (-1, 0, 0), "up": (0, 1, 0), "down": (0, -1, 0)}
SHADE = {"up": 1.0, "north": 0.86, "south": 0.78, "east": 0.7, "west": 0.7, "down": 0.5}


def render(geo, tex, yaw=0.0, pitch=15.0, scale=6.0, size=(400, 400), bg=(0, 0, 0, 0), pose=None,
           flat_shade=True, center=None, bone_filter=None):
    """geo: dict(bones,tw,th); tex: PIL RGBA image. Returns PIL RGBA image."""
    W, H = size
    img = np.zeros((H, W, 4), np.uint8)
    img[:] = bg
    zbuf = np.full((H, W), 1e9)
    tarr = np.asarray(tex.convert("RGBA"))
    th_img, tw_img = tarr.shape[:2]
    sxs, sys_ = tw_img / geo["tw"], th_img / geo["th"]
    mats = bone_world_matrices(geo["bones"], pose)
    ya, pa = math.radians(yaw), math.radians(pitch)
    Ry = np.array([[math.cos(ya), 0, math.sin(ya)], [0, 1, 0], [-math.sin(ya), 0, math.cos(ya)]])
    Rp = np.array([[1, 0, 0], [0, math.cos(pa), -math.sin(pa)], [0, math.sin(pa), math.cos(pa)]])
    V = Rp @ Ry

    # pass 1: gather bounds for centering
    polys = []
    for b in geo["bones"]:
        if bone_filter and not bone_filter(b["name"]):
            continue
        M = mats[b["name"]]
        for cube in b.get("cubes", []) or []:
            Mc = M
            if cube.get("rotation"):
                Mc = M @ about_pivot(rot_matrix(*cube["rotation"]), to_int(cube.get("pivot", [0, 0, 0])))
            for name, c, ua, va, rect in cube_faces(cube, geo["tw"], geo["th"]):
                c4 = Mc @ np.append(c, 1.0)
                ua4 = Mc[:3, :3] @ ua
                va4 = Mc[:3, :3] @ va
                polys.append((name, c4[:3], ua4, va4, rect, Mc[:3, :3] @ np.array(NORMALS[name], float)))
    if not polys:
        return Image.fromarray(img)
    allp = np.array([p[1] for p in polys])
    ctr = center if center is not None else (allp.min(0) + allp.max(0)) / 2
    for name, c, ua, va, rect, n in polys:
        nv = V @ n
        if nv[2] > 0.0:  # facing away (camera looks +z... front faces have z<0)
            continue
        c0 = V @ (c - ctr)
        eu, ev = V @ ua, V @ va
        # screen: x = -x', y = -y'  (viewer's right is -x_int)
        P0 = np.array([-c0[0], -c0[1]]) * scale
        Eu = np.array([-eu[0], -eu[1]]) * scale
        Ev = np.array([-ev[0], -ev[1]]) * scale
        det = Eu[0] * Ev[1] - Eu[1] * Ev[0]
        if abs(det) < 1e-6:
            continue
        pts = np.array([P0, P0 + Eu, P0 + Ev, P0 + Eu + Ev])
        x0 = int(max(0, math.floor(pts[:, 0].min() + W / 2)))
        x1 = int(min(W - 1, math.ceil(pts[:, 0].max() + W / 2)))
        y0 = int(max(0, math.floor(pts[:, 1].min() + H / 2)))
        y1 = int(min(H - 1, math.ceil(pts[:, 1].max() + H / 2)))
        if x1 < x0 or y1 < y0:
            continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5 - W / 2, np.arange(y0, y1 + 1) + 0.5 - H / 2)
        dx, dy = xs - P0[0], ys - P0[1]
        s = (dx * Ev[1] - dy * Ev[0]) / det
        t = (Eu[0] * dy - Eu[1] * dx) / det
        m = (s >= 0) & (s < 1) & (t >= 0) & (t < 1)
        if not m.any():
            continue
        depth = c0[2] + s * eu[2] + t * ev[2]
        u0, v0, uw, vh = rect
        tu = ((u0 + s * uw) * sxs).astype(int).clip(0, tw_img - 1) if uw >= 0 else ((u0 + s * uw) * sxs).astype(int).clip(0, tw_img - 1)
        tv = ((v0 + t * vh) * sys_).astype(int).clip(0, th_img - 1)
        col = tarr[tv, tu].astype(float)
        if flat_shade:
            col[..., :3] *= SHADE[name]
        yy, xx = ys.astype(int) + H // 2 - 0, xs.astype(int) + W // 2
        yy = np.clip(np.floor(ys + H / 2).astype(int), 0, H - 1)
        xx = np.clip(np.floor(xs + W / 2).astype(int), 0, W - 1)
        ok = m & (col[..., 3] > 8) & (depth < zbuf[yy, xx])
        zbuf[yy[ok], xx[ok]] = depth[ok]
        img[yy[ok], xx[ok]] = col[ok].astype(np.uint8)
    return Image.fromarray(img)


def bbox_units(geo, pose=None):
    mats = bone_world_matrices(geo["bones"], pose)
    pts = []
    for b in geo["bones"]:
        M = mats[b["name"]]
        for cube in b.get("cubes", []) or []:
            ox, oy, oz = cube["origin"]; sx, sy, sz = cube["size"]
            Mc = M
            if cube.get("rotation"):
                Mc = M @ about_pivot(rot_matrix(*cube["rotation"]), to_int(cube.get("pivot", [0, 0, 0])))
            for cx in (-(ox + sx), -ox):
                for cy in (oy, oy + sy):
                    for cz in (oz, oz + sz):
                        pts.append((Mc @ np.array([cx, cy, cz, 1.0]))[:3])
    if not pts:
        return None
    a = np.array(pts)
    return a.min(0), a.max(0)
