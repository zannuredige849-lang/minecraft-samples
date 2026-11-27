"""Remove floating decorative clusters that hover around mobs (auras, essences, orbiting skulls)."""
import sys, os, glob, json
sys.path.insert(0, os.path.dirname(__file__))
from mcgeo import load_json
STRIP = {"geometry.cb_death_knight": ["auraBone"], "geometry.cb_ice_spirit": ["auraBone"], "geometry.cb_lich_statue": ["auraBone"],
         "geometry.cb_fel_minion": ["essences"], "geometry.cb_troll_totem": ["floatingSkull"]}

def run(out):
    n = 0
    for p in glob.glob(f"{out}/resource_pack/models/entity/*.json"):
        d = load_json(p); ch = False
        for g in d.get("minecraft:geometry", []):
            for b in g["bones"]:
                if b["name"] in STRIP.get(g["description"]["identifier"], []) and b.get("cubes"):
                    n += len(b["cubes"]); b["cubes"] = []; ch = True
        if ch: json.dump(d, open(p, "w", encoding="utf-8"), indent=1)
    return n
