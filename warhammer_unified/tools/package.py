"""Step 5: manifests, lang strings, validation, zip."""
import sys, os, json, glob, re, zipfile
sys.path.insert(0, os.path.dirname(__file__))
from mcgeo import load_json, collect_geometries

VERSION = [10, 0, 0]
NAME = "ZhekAziz x Warhammer UNIFIED v10 New Style"
DESC = ("v10.0.0 NEW STYLE: all mobs, golems, items and spawn eggs in one chunky block style with shared palettes/shading; "
        "factions & alliances (same faction and all golems never fight each other, summons stay loyal).")


def manifests(out):
    for part, tag in (("behavior_pack", "BP"), ("resource_pack", "RP")):
        p = f"{out}/{part}/manifest.json"
        m = load_json(p)
        m["header"]["name"] = f"{NAME} ({tag})"
        m["header"]["description"] = DESC
        m["header"]["version"] = VERSION
        for mod in m["modules"]: mod["version"] = VERSION
        for d in m.get("dependencies", []):
            if "uuid" in d: d["version"] = VERSION
        json.dump(m, open(p, "w", encoding="utf-8"), indent=2)
    for part in ("behavior_pack", "resource_pack"):
        for lang in glob.glob(f"{out}/{part}/texts/*.lang"):
            t = open(lang, encoding="utf-8").read()
            if "pack.description=" in t:
                t = re.sub(r"pack\.description=.*", "pack.description=" + DESC, t, count=1)
            else:
                t = "pack.description=" + DESC + "\n" + t
            open(lang, "w", encoding="utf-8").write(t)


VANILLA_ANIM = ("animation.humanoid.", "animation.pillager.", "animation.villager.", "animation.player.", "animation.armor.", "animation.zombie.", "animation.skeleton.", "animation.common.")
VANILLA_CTRL = ("controller.animation.humanoid.", "controller.animation.pillager", "controller.animation.villager.", "controller.animation.player.", "controller.animation.armor.")
VANILLA_RC = ("controller.render.default", "controller.render.armor", "controller.render.item_default")


def validate(out):
    errs, warns = [], []
    rp = f"{out}/resource_pack"
    # 1. every JSON parses
    for p in glob.glob(f"{out}/**/*.json", recursive=True):
        try: load_json(p)
        except Exception as e: errs.append(f"JSON {os.path.relpath(p, out)}: {e}")
    # 2. geometry sanity
    geos = {}
    for p in glob.glob(f"{rp}/models/entity/*.json"):
        try: geos.update(collect_geometries(p))
        except Exception as e: errs.append(f"geo {p}: {e}")
    for gid, g in geos.items():
        names = {b["name"] for b in g["bones"]}
        for b in g["bones"]:
            if b.get("parent") and b["parent"] not in names: errs.append(f"{gid}: bone {b['name']} parent {b['parent']} missing")
            for c in b.get("cubes", []) or []:
                uv = c.get("uv")
                if isinstance(uv, list):
                    w, h, d = [int(-(-v // 1)) for v in c["size"]]
                    if uv[0] < 0 or uv[1] < 0 or uv[0] + 2 * d + 2 * w > g["tw"] + 0.001 or uv[1] + d + h > g["th"] + 0.001:
                        warns.append(f"{gid}: cube uv {uv} size {c['size']} exceeds {g['tw']}x{g['th']}")
    # 3. client entities
    from PIL import Image
    anim_ids = {}
    for p in glob.glob(f"{rp}/animations/*.json"):
        d = load_json(p)
        anim_ids.update({k: (v, os.path.basename(p)) for k, v in d.get("animations", {}).items()})
    ctrl_ids = set()
    for p in glob.glob(f"{rp}/animation_controllers/*.json"):
        ctrl_ids.update(load_json(p).get("animation_controllers", {}).keys())
    rc = set()
    for p in glob.glob(f"{rp}/render_controllers/*.json"):
        rc.update(load_json(p).get("render_controllers", {}).keys())
    n_ent = 0
    for p in sorted(glob.glob(f"{rp}/entity/*.json")):
        c = load_json(p)["minecraft:client_entity"]["description"]
        ident = c["identifier"]; n_ent += 1
        for g in c.get("geometry", {}).values():
            if g not in geos: errs.append(f"{ident}: geometry {g} missing")
        for k, t in c.get("textures", {}).items():
            if t.startswith(("textures/entity/chicken", "textures/entity/goat/", "textures/entity/horse/", "textures/entity/pig/", "textures/entity/sheep/")):
                continue   # vanilla textures used by the witch's hex forms
            if not os.path.exists(f"{rp}/{t}.png") and not os.path.exists(f"{rp}/{t}.tga"): errs.append(f"{ident}: texture {t} missing")
            else:
                im = Image.open(f"{rp}/{t}.png")
                g = geos.get(c.get("geometry", {}).get("default"))
                if g and (im.size[0] != g["tw"] or im.size[1] != g["th"]): warns.append(f"{ident}: texture {t} is {im.size} but geometry says {g['tw']}x{g['th']}")
        for k, a in c.get("animations", {}).items():
            if a.startswith("animation.") and a not in anim_ids and not a.startswith(VANILLA_ANIM): errs.append(f"{ident}: animation {a} missing")
            if a.startswith("controller.") and a not in ctrl_ids and not a.startswith(VANILLA_CTRL): errs.append(f"{ident}: controller {a} missing")
        for r in c.get("render_controllers", []):
            if (r if isinstance(r, str) else list(r)[0]) not in rc and (r if isinstance(r, str) else list(r)[0]) not in VANILLA_RC: errs.append(f"{ident}: render controller {r} missing")
        se = c.get("spawn_egg")
        if se and "texture" in se:
            itd = load_json(f"{rp}/textures/item_texture.json")["texture_data"]
            if se["texture"] not in itd: errs.append(f"{ident}: egg texture {se['texture']} not in item_texture.json")
    # 4. animation bones exist in the model (only for regenerated mobs, informational)
    # 5. texture sets reference existing files
    for ts in glob.glob(f"{rp}/**/*.texture_set.json", recursive=True):
        d = load_json(ts)["minecraft:texture_set"]
        for v in d.values():
            if isinstance(v, str) and not os.path.exists(os.path.join(os.path.dirname(ts), v + ".png")):
                errs.append(f"{os.path.relpath(ts, rp)}: missing {v}.png")
    itd = load_json(f"{rp}/textures/item_texture.json")["texture_data"]
    for name, td in itd.items():
        path = td["textures"] if isinstance(td["textures"], str) else td["textures"][0]
        if not os.path.exists(f"{rp}/{path}.png") and not os.path.exists(f"{rp}/{path}.tga"):
            errs.append(f"item texture {name}: {path} missing")
    # 6. BP entities: families & filters present
    n_f = 0
    for p in glob.glob(f"{out}/behavior_pack/entities/*.json"):
        e = load_json(p)["minecraft:entity"]
        fam = e.get("components", {}).get("minecraft:type_family", {}).get("family", [])
        if any(f.startswith("f_") for f in fam): n_f += 1
    return errs, warns, dict(client_entities=n_ent, faction_entities=n_f, geometries=len(geos))


def zip_addon(out, path):
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for part in ("behavior_pack", "resource_pack"):
            for root, _, files in os.walk(f"{out}/{part}"):
                for f in sorted(files):
                    full = os.path.join(root, f)
                    z.write(full, os.path.relpath(full, out))
