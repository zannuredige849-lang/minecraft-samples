"""v10.8.1 fixes on top of a built add-on folder:
1. Circe (cb:circe + cb:circe_orb) back to her original v9.1 textures (colour, MER, heightmap, texture sets) - geometry,
   animations and scripts were never changed.
2. Held items: every rightItem / leftItem bone is re-anchored exactly like vanilla (bone pivot = centre of the hand,
   3 px above the bottom of the arm, 1 px behind its centre), so items sit in the fist - not above, below or in front of it.
python3 fix_held.py <built folder> <original v9.1 folder> <version x.y.z>"""
import sys, os, json, re, glob, shutil

def L(p): return json.loads(re.sub(r'(?m)^\s*//.*$', '', open(p, encoding='utf-8').read()))
def W(p, d):
    with open(p, "w", encoding="utf-8") as f: json.dump(d, f, indent=2, ensure_ascii=False)


def restore_circe(out, orig):
    n = 0
    for name in ("circe", "circe_orb"):
        for suf in (".png", "_mer.png", "_height.png", ".texture_set.json"):
            s = f"{orig}/resource_pack/textures/entity/{name}{suf}"
            if os.path.exists(s):
                shutil.copy(s, f"{out}/resource_pack/textures/entity/{name}{suf}"); n += 1
    return n


def fix_items(out):
    rep = []
    for p in glob.glob(out + "/resource_pack/models/entity/**/*.json", recursive=True):
        d = L(p); ch = False
        for g in d.get("minecraft:geometry", []):
            by = {b["name"]: b for b in g["bones"]}
            for b in g["bones"]:
                if b["name"] not in ("rightItem", "leftItem"): continue
                arm = by.get(b.get("parent"))
                cs = [c for c in (arm or {}).get("cubes", []) if not c.get("rotation")]
                if not cs: continue
                # the arm proper = the tallest cube of the holding bone (ignore pads / bracelets)
                c = max(cs, key=lambda c: c["size"][1])
                cx = c["origin"][0] + c["size"][0] / 2
                cz = c["origin"][2] + c["size"][2] / 2
                new = [round(cx, 2), round(c["origin"][1] + 3, 2), round(cz + 1, 2)]
                if [round(v, 2) for v in b["pivot"]] != new:
                    rep.append((g["description"]["identifier"], b["name"], b["pivot"], new)); b["pivot"] = new; ch = True
        if ch: W(p, d)
    return rep


def bump(out, ver):
    for mp in (out + "/behavior_pack/manifest.json", out + "/resource_pack/manifest.json"):
        md = L(mp)
        def rec(o):
            if isinstance(o, dict):
                for k, v in o.items():
                    if k == "version" and isinstance(v, list) and len(v) == 3: o[k] = list(ver)
                    elif k in ("name", "description") and isinstance(v, str): o[k] = re.sub(r"v?\d+(?:\.\d+){2,}", "v" + ".".join(map(str, ver)), v)
                    else: rec(v)
            elif isinstance(o, list):
                for x in o: rec(x)
        rec(md); W(mp, md)


if __name__ == "__main__":
    out, orig, ver = sys.argv[1], sys.argv[2], tuple(int(x) for x in sys.argv[3].split("."))
    print("circe files restored:", restore_circe(out, orig))
    for r in fix_items(out): print("  item anchor", r)
    bump(out, ver)
    if len(sys.argv) > 4:
        from apply11 import check_and_pack
        check_and_pack(out, sys.argv[4])
