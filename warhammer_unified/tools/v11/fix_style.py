"""v10.8.2: one clean style on top of a built add-on folder.

1. Orcs (cb:orc, cb:green_orc, cb:hell_orc) get back the models and textures developed in this repository
   (addon/: restyled skins, Ominous banner of the leader); their client entity files (spawn eggs) stay as they are.
   The MER / texture_set of the old textures are removed, they belonged to the old texture layout.
2. "Rounding" cubes: many cb:* models round a box with two crossed, slightly longer cubes that reuse the box's
   UV origin with a different (fractional) size. Box UV then maps the wrong part of the texture onto them:
   stretched, shifted pixels, a second squeezed face in front of the real one (Circe's face, orcs, humans, trolls,
   golems, Cyclops, Hydra ...). Each such cube now gets per-face UV that shows exactly the pixels of the box face
   it stands on, so the rounded silhouette stays and the texture lines up.
3. cb:cannibal_troll gets its v9.1 textures back (the v10.6.2 ones do not fit its model).
4. Held items: vanilla rightItem/leftItem anchors (fix_held.fix_items); manifests bumped.

python3 fix_style.py <built folder> <repo addon/ folder> <original v9.1 folder> <version x.y.z> [out .mcaddon]
"""
import sys, os, glob, shutil, json
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fix_held import L, W, fix_items, bump
from mcgeo import cube_faces

ORCS = ["orc", "green_orc", "hell_orc"]


def restore_orcs(out, ours):
    n = 0
    for m in ORCS:
        src = f"{ours}/resource_pack/models/entity/{m}.geo.json"
        shutil.copy(src, f"{out}/resource_pack/models/entity/{m}.geo.json"); n += 1
    td = f"{out}/resource_pack/textures/entity/orc"
    for p in glob.glob(f"{ours}/resource_pack/textures/entity/orc/*.png"):
        shutil.copy(p, td); n += 1
    for p in glob.glob(td + "/*.texture_set.json") + glob.glob(td + "/*_mer.png") + glob.glob(td + "/*_mer.tga"):
        os.remove(p)
    return n


def restore_cannibal(out, orig):
    """cb:cannibal_troll: the v10.6.2 textures do not fit its model (83 % of the faces transparent: the troll falls
    apart into floating bits). The v9.1 textures were drawn for this exact model (same geometry file)."""
    td = f"{out}/resource_pack/textures/entity"
    for p in glob.glob(td + "/cannibal_troll*"): os.remove(p)
    n = 0
    for p in glob.glob(f"{orig}/resource_pack/textures/entity/cannibal_troll*"):
        shutil.copy(p, td); n += 1
    return n


def _frac(s):
    return any(abs(v - round(v)) > 1e-6 for v in s)


def _plain(c):
    d = dict(c); d.pop("inflate", None); return d


def _faces(c, tw, th):
    return {f[0]: (np.array(f[1], float), np.array(f[2], float), np.array(f[3], float), f[4]) for f in cube_faces(_plain(c), tw, th)}


def _contains(p, r):
    """r's centre lies inside p's box in at least two axes (the crossed rounding cubes poke out in one)."""
    k = 0
    for i in range(3):
        cc = r["origin"][i] + r["size"][i] / 2
        if p["origin"][i] - 1e-6 <= cc <= p["origin"][i] + p["size"][i] + 1e-6: k += 1
    return k >= 2


def fix_rounding(geo, tw, th):
    fixed = 0
    for b in geo["bones"]:
        cubes = b.get("cubes") or []
        for r in cubes:
            uv = r.get("uv")
            if not isinstance(uv, list) or not _frac(r["size"]): continue
            same = [p for p in cubes if p is not r and p.get("uv") == uv and list(p["size"]) != list(r["size"])
                    and p.get("rotation") == r.get("rotation") and _contains(p, r)]
            if not same: continue
            same.sort(key=lambda p: (_frac(p["size"]), -p["size"][0] * p["size"][1] * p["size"][2]))
            p = same[0]
            if _frac(p["size"]): continue
            pf, rf = _faces(p, tw, th), _faces(r, tw, th)
            new = {}
            for name, (cr, uar, var, _) in rf.items():
                cp, uap, vap, (u, v, w, h) = pf[name]
                def st(x):
                    s = np.dot(x - cp, uap) / np.dot(uap, uap); t = np.dot(x - cp, vap) / np.dot(vap, vap)
                    return min(1, max(0, s)), min(1, max(0, t))
                s0, t0 = st(cr); s1, t1 = st(cr + uar + var)
                u0, v0, u1, v1 = u + s0 * w, v + t0 * h, u + s1 * w, v + t1 * h
                new[name] = {"uv": [round(u0, 3), round(v0, 3)], "uv_size": [round(u1 - u0, 3), round(v1 - v0, 3)]}
            r["uv"] = new; r.pop("mirror", None); fixed += 1
            # a rounding cube of an outer layer (hat, hood: inflated box) stands out by the same amount,
            # otherwise its faces lie in one plane with the inner layer's rounding cube and flicker
            if (p.get("inflate") or 0) > (r.get("inflate") or 0): r["inflate"] = p["inflate"]
    return fixed


def fix_all_rounding(out):
    rep = []
    for p in sorted(glob.glob(f"{out}/resource_pack/models/**/*.json", recursive=True)):
        d = L(p); n = 0
        for g in d.get("minecraft:geometry", []):
            ds = g["description"]
            n += fix_rounding(g, ds.get("texture_width", 64), ds.get("texture_height", 64))
        if n:
            if d.get("format_version", "1.12.0") < "1.12.0": d["format_version"] = "1.12.0"
            W(p, d); rep.append((os.path.basename(p), n))
    return rep


if __name__ == "__main__":
    out, ours, orig, ver = sys.argv[1], sys.argv[2], sys.argv[3], tuple(int(x) for x in sys.argv[4].split("."))
    print("orc files from the repository:", restore_orcs(out, ours))
    print("cannibal troll textures from v9.1:", restore_cannibal(out, orig))
    rep = fix_all_rounding(out)
    print("rounding cubes re-mapped:", sum(n for _, n in rep), "in", len(rep), "models")
    for r in fix_items(out): print("  item anchor", r)
    bump(out, ver)
    if len(sys.argv) > 5:
        from apply11 import check_and_pack
        check_and_pack(out, sys.argv[5])
