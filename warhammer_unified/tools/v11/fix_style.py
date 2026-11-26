"""v10.8.2-10.8.4: one clean style on top of a built add-on folder.

1. Orcs (cb:orc, cb:green_orc, cb:hell_orc) get back the models and textures developed in this repository
   (addon/: restyled skins, Ominous banner of the leader); their client entity files (spawn eggs) stay as they are.
   The MER / texture_set of the old textures are removed, they belonged to the old texture layout.
2. "Rounding" cubes: many cb:* models round a box with two crossed, slightly longer cubes that reuse the box's
   UV origin with a different (fractional) size. They stand ~0.7 out of the front/back/sides as an extra layer and
   box UV maps the wrong part of the texture onto them (a second squeezed face in front of Circe's real one, etc.).
   v10.8.2 re-mapped them; since v10.8.4 they are removed (the user found the extra front layer unnecessary).
3. cb:cannibal_troll gets its v9.1 textures back (the v10.6.2 ones do not fit its model).
5. Vanilla combat (vanilla_combat.py): bows that keep their distance, real vanilla shields.
4. Held items: vanilla rightItem/leftItem anchors (fix_held.fix_items); manifests bumped.

python3 fix_style.py <built folder> <repo addon/ folder> <original v9.1 folder> <version x.y.z> [out .mcaddon]
"""
import sys, os, glob, shutil, json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fix_held import L, W, fix_items, bump

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


def orc_theme(out):
    """The orc look the user picked (previews: Ominous banner on the back, skin-coloured shoulders and arms
    under the leather vest). That picture mapped each inflated overlay cube (vest, sleeves, pauldrons) onto the
    texture net of its inflated size (ceil(size + 2 * inflate)); the game maps the un-inflated size. Per-face UV
    pins exactly that mapping, so the game shows the picture. The banner is shown on every orc, not only leaders."""
    import math
    n = 0
    for m in ORCS:
        p = f"{out}/resource_pack/models/entity/{m}.geo.json"; d = L(p)
        for g in d["minecraft:geometry"]:
            for b in g["bones"]:
                for c in b.get("cubes") or []:
                    inf = c.get("inflate") or 0
                    if not inf or not isinstance(c.get("uv"), list): continue
                    u, v = c["uv"]
                    w, h, dd = (math.ceil(x + 2 * inf) for x in c["size"])
                    rects = {"east": (u, v + dd, dd, h), "north": (u + dd, v + dd, w, h), "west": (u + dd + w, v + dd, dd, h),
                             "south": (u + 2 * dd + w, v + dd, w, h), "up": (u + dd, v, w, dd), "down": (u + dd + w, v, w, dd)}
                    c["uv"] = {f: {"uv": [r[0], r[1]], "uv_size": [r[2], r[3]]} for f, r in rects.items()}; n += 1
        W(p, d)
    ap = f"{out}/resource_pack/animations/orc.animation.json"; a = L(ap)
    a["animations"]["animation.cb_orc.banner"]["bones"]["banner"]["scale"] = 1
    W(ap, a)
    return n


def _frac(s):
    return any(abs(v - round(v)) > 1e-6 for v in s)


def _contains(p, r):
    """r's centre lies inside p's box in at least two axes (the crossed rounding cubes poke out in one)."""
    k = 0
    for i in range(3):
        cc = r["origin"][i] + r["size"][i] / 2
        if p["origin"][i] - 1e-6 <= cc <= p["origin"][i] + p["size"][i] + 1e-6: k += 1
    return k >= 2


def remove_rounding(geo):
    """Drop the crossed rounding cubes: a fractional-size cube that reuses the UV origin of a bigger box in the same
    bone and sits inside it except for one axis, where it pokes out of the front/back (or sides) by ~0.7 as an extra
    layer. The box under it keeps the full texture, so nothing is lost but the extra layer."""
    removed = 0
    for b in geo["bones"]:
        cubes = b.get("cubes") or []
        vol = lambda c: c["size"][0] * c["size"][1] * c["size"][2]
        drop = []
        for r in cubes:
            uv = r.get("uv")
            if not isinstance(uv, list) or not _frac(r["size"]): continue
            same = [p for p in cubes if p is not r and p.get("uv") == uv and list(p["size"]) != list(r["size"])
                    and p.get("rotation") == r.get("rotation") and _contains(p, r) and vol(p) > vol(r)]
            if same: drop.append(id(r))
        if drop:
            b["cubes"] = [c for c in cubes if id(c) not in drop]; removed += len(drop)
    return removed


def fix_all_rounding(out):
    rep = []
    for p in sorted(glob.glob(f"{out}/resource_pack/models/**/*.json", recursive=True)):
        d = L(p); n = 0
        for g in d.get("minecraft:geometry", []):
            ds = g["description"]
            n += remove_rounding(g)
        if n:
            W(p, d); rep.append((os.path.basename(p), n))
    return rep


if __name__ == "__main__":
    out, ours, orig, ver = sys.argv[1], sys.argv[2], sys.argv[3], tuple(int(x) for x in sys.argv[4].split("."))
    print("orc files from the repository:", restore_orcs(out, ours))
    print("cannibal troll textures from v9.1:", restore_cannibal(out, orig))
    print("orc theme: overlay cubes pinned:", orc_theme(out))
    rep = fix_all_rounding(out)
    print("rounding cubes removed:", sum(n for _, n in rep), "in", len(rep), "models")
    for r in fix_items(out): print("  item anchor", r)
    import vanilla_combat
    print("vanilla combat: humans", vanilla_combat.humans(out), "orcs/shields.js", vanilla_combat.orcs(out))
    bump(out, ver)
    if len(sys.argv) > 5:
        from apply11 import check_and_pack
        check_and_pack(out, sys.argv[5])
