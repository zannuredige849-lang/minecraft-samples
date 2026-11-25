"""Remove the orcs' implements: cb:orc_cleaver and cb:orc_war_axe (items, 3D models, textures, names, tables)."""
import sys, os, glob, json, re
sys.path.insert(0, os.path.dirname(__file__))
from mcgeo import load_json
NAMES = ("orc_cleaver", "orc_war_axe")

def run(out):
    n = 0
    rp, bp = f"{out}/resource_pack", f"{out}/behavior_pack"
    for nm in NAMES:
        for f in (f"{bp}/items/{nm}.json", f"{rp}/attachables/{nm}.json", f"{rp}/models/entity/weapon_{nm}.geo.json", f"{rp}/animations/{nm}.animation.json"):
            if os.path.exists(f): os.remove(f); n += 1
        for f in glob.glob(f"{rp}/textures/items/cb_{nm}*"):
            os.remove(f); n += 1
    itp = f"{rp}/textures/item_texture.json"
    d = load_json(itp)
    for nm in NAMES: d["texture_data"].pop("cb_" + nm, None)
    json.dump(d, open(itp, "w", encoding="utf-8"), indent=2)
    for lang in glob.glob(f"{rp}/texts/*.lang") + glob.glob(f"{bp}/texts/*.lang"):
        t = open(lang, encoding="utf-8").read()
        t2 = "\n".join(l for l in t.split("\n") if not any(f"cb:{nm}" in l for nm in NAMES))
        if t2 != t: open(lang, "w", encoding="utf-8").write(t2)
    sp = f"{bp}/scripts/settlements.js"
    s = open(sp, encoding="utf-8").read()
    s = re.sub(r'\n\s*"cb:orc_cleaver": \d+,', "", s)
    s = re.sub(r'\n\s*"cb:orc_war_axe": \d+,', "", s)
    s = s.replace(' || s === "cb:orc_cleaver"', "")
    open(sp, "w", encoding="utf-8").write(s)
    return n
