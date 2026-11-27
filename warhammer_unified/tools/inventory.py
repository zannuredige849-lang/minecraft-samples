"""Build data/entities.json from the original add-on tree: per entity client + BP facts."""
import sys, os, glob, json
sys.path.insert(0, os.path.dirname(__file__))
from mcgeo import load_json

def main(src, out):
    anims = {}
    anim_file = {}
    for p in glob.glob(f"{src}/resource_pack/animations/*.json"):
        d = load_json(p)
        for k, v in d.get("animations", {}).items():
            anims[k] = dict(length=v.get("animation_length"), loop=v.get("loop"))
            anim_file[k] = os.path.basename(p)
    geo_file = {}
    for p in glob.glob(f"{src}/resource_pack/models/entity/*.json"):
        d = load_json(p)
        for g in d.get("minecraft:geometry", []):
            geo_file[g["description"]["identifier"]] = os.path.basename(p)
        for k in d:
            if k.startswith("geometry."): geo_file[k.split(":")[0]] = os.path.basename(p)
    ents = {}
    for p in sorted(glob.glob(f"{src}/behavior_pack/entities/*.json")):
        d = load_json(p)["minecraft:entity"]
        desc = d["description"]; comps = d.get("components", {})
        ident = desc["identifier"]
        cb = comps.get("minecraft:collision_box", {})
        sc = comps.get("minecraft:scale", {}).get("value", 1.0)
        ents[ident] = dict(bp=os.path.basename(p), width=cb.get("width"), height=cb.get("height"), scale=sc,
                           family=comps.get("minecraft:type_family", {}).get("family", []),
                           health=comps.get("minecraft:health", {}).get("max"),
                           spawnable=desc.get("is_spawnable"))
    for p in sorted(glob.glob(f"{src}/resource_pack/entity/*.json")):
        c = load_json(p)["minecraft:client_entity"]["description"]
        e = ents.setdefault(c["identifier"], {})
        e["client"] = os.path.basename(p)
        e["geometry"] = c.get("geometry", {})
        e["geo_file"] = {k: geo_file.get(v) for k, v in c.get("geometry", {}).items()}
        e["textures"] = c.get("textures", {})
        e["materials"] = c.get("materials", {})
        e["render_controllers"] = c.get("render_controllers", [])
        e["animations"] = {k: dict(id=v, **anims.get(v, {}), file=anim_file.get(v)) for k, v in c.get("animations", {}).items() if v.startswith("animation.")}
        e["controllers"] = {k: v for k, v in c.get("animations", {}).items() if v.startswith("controller.")}
        e["spawn_egg"] = c.get("spawn_egg")
    json.dump(ents, open(out, "w"), indent=1, ensure_ascii=False)
    print(len(ents))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
