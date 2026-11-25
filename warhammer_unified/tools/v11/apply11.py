"""Apply the v11 sculpts to an extracted add-on (v10.6.2): only the 10 listed mobs change.
python3 tools/v11/apply11.py <extracted add-on> <out dir> <out .mcaddon> <showcase.png>"""
import sys, os, json, re, glob, shutil, subprocess, zipfile
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import importlib
BUILDERS = importlib.import_module("v11." + os.environ.get("MOBS", "mobs11")).BUILDERS

def L(p): return json.loads(re.sub(r'(?m)^\s*//.*$', '', open(p, encoding='utf-8').read()))
def W(p, d):
    with open(p, "w", encoding="utf-8") as f: json.dump(d, f, indent=2, ensure_ascii=False)

VERSION = tuple(int(x) for x in os.environ.get("ADDON_VERSION", "11.0.0").split("."))

# extra animation channels for bones that the old rig did not have
EXTRA_ANIM = {"lowerArmR": {"idle": ["math.sin(query.anim_time * 120) * 10", 0, "math.sin(query.anim_time * 90) * 6"],
                            "walk": ["math.sin(query.anim_time * 400) * 22", 0, 0], "attack": ["-60 * math.sin(query.anim_time * 240)", 0, 10]},
              "lowerArmL": {"idle": ["math.sin(query.anim_time * 120 + 90) * 10", 0, "-math.sin(query.anim_time * 90) * 6"],
                            "walk": ["-math.sin(query.anim_time * 400) * 22", 0, 0], "attack": ["-60 * math.sin(query.anim_time * 240)", 0, -10]}}


def kind(aid):
    a = aid.split(".")[-1]
    if "walk" in a or "move" in a: return "walk"
    if any(k in a for k in ("attack", "ability", "slam", "spell", "channel")): return "attack"
    if "death" in a: return None
    return "idle"


def main(src, out, mca, show):
    if os.path.exists(out): shutil.rmtree(out)
    shutil.copytree(src, out)
    rp = out + "/resource_pack"
    ce = {}
    for p in glob.glob(rp + "/entity/*.json"):
        c = L(p)["minecraft:client_entity"]["description"]; ce[c["identifier"]] = c
    report = []
    for ident, fn in BUILDERS.items():
        c = ce[ident]; gid = c["geometry"]["default"]
        gp = [p for p in glob.glob(rp + "/models/entity/**/*.json", recursive=True)
              if any(g["description"]["identifier"] == gid for g in L(p).get("minecraft:geometry", []))][0]
        doc = L(gp)
        assert len(doc["minecraft:geometry"]) == 1, gp
        base = doc["minecraft:geometry"][0]
        m = fn(base); m.finalize()
        doc["minecraft:geometry"] = [m.geometry()]
        doc["format_version"] = doc.get("format_version", "1.12.0")
        W(gp, doc)
        for tpath in c["textures"].values():
            name = os.path.basename(tpath)
            m.texture.save(f"{rp}/{tpath}.png")
            m.mer.save(f"{rp}/{tpath}_mer.png")
            W(f"{rp}/{tpath}.texture_set.json", {"format_version": "1.16.100", "minecraft:texture_set": {
                "color": name, "metalness_emissive_roughness": name + "_mer"}})
            for old in (f"{rp}/{tpath}_mer.tga", f"{rp}/{tpath}_normal.png", f"{rp}/{tpath}_heightmap.png"):
                if os.path.exists(old): os.remove(old)
        new_bones = [b for b in m.order if b not in {x["name"] for x in base["bones"]}]
        if new_bones:
            for ap in glob.glob(rp + "/animations/*.json"):
                ad = L(ap); ch = False
                for aid, a in ad.get("animations", {}).items():
                    if aid.split(".")[1] != gid.split(".")[1].replace("cb_", ""): continue
                    k = kind(aid)
                    for b in new_bones:
                        if k and b in EXTRA_ANIM and b not in a.setdefault("bones", {}):
                            a["bones"][b] = {"rotation": EXTRA_ANIM[b][k]}; ch = True
                if ch: W(ap, ad)
        report.append((ident, m.cube_count(), m.tw, m.zfix, new_bones))
    # manifests -> 11.0.0
    for mp in (out + "/behavior_pack/manifest.json", out + "/resource_pack/manifest.json"):
        md = L(mp)
        def bump(o):
            if isinstance(o, dict):
                for k, v in o.items():
                    if k == "version" and isinstance(v, list) and len(v) == 3: o[k] = list(VERSION)
                    elif k == "min_engine_version": o[k] = [1, 21, 10]
                    elif k in ("name", "description") and isinstance(v, str): o[k] = re.sub(r"v?10\.6\.2", "v" + ".".join(map(str, VERSION)), v)
                    else: bump(v)
            elif isinstance(o, list):
                for x in o: bump(x)
        bump(md); W(mp, md)
    # checks: all JSON parse, texture sets point to files, JS syntax
    bad = []
    for p in glob.glob(out + "/**/*.json", recursive=True):
        try: L(p)
        except Exception as e: bad.append((p, str(e)[:80]))
    for p in glob.glob(rp + "/textures/**/*.texture_set.json", recursive=True):
        ts = L(p)["minecraft:texture_set"]; d = os.path.dirname(p)
        for k in ("color", "metalness_emissive_roughness", "normal", "heightmap"):
            v = ts.get(k)
            if isinstance(v, str) and not any(os.path.exists(f"{d}/{v}{e}") for e in (".png", ".tga", ".jpg")): bad.append((p, f"{k} -> {v} missing"))
    # references: client entity geometry / textures / render controllers, attachables
    geos = set(); rcs = set()
    for p in glob.glob(rp + "/models/**/*.json", recursive=True):
        for g in L(p).get("minecraft:geometry", []): geos.add(g["description"]["identifier"])
        for k in L(p):
            if k.startswith("geometry."): geos.add(k.split(":")[0])
    for p in glob.glob(rp + "/render_controllers/*.json"): rcs |= set(L(p).get("render_controllers", {}))
    def tex_ok(t): return any(os.path.exists(f"{rp}/{t}{e}") for e in (".png", ".tga", ".jpg"))
    for p in glob.glob(rp + "/entity/*.json") + glob.glob(rp + "/attachables/*.json"):
        d = L(p); dd = (d.get("minecraft:client_entity") or d.get("minecraft:attachable"))["description"]
        for g in dd.get("geometry", {}).values():
            if g not in geos and not g.startswith("geometry.humanoid") and not g.startswith("geometry.player"): bad.append((p, "geometry " + g))
        for t in dd.get("textures", {}).values():
            if not t.startswith("textures/misc") and not tex_ok(t) and t not in ("textures/entity/steve",): bad.append((p, "texture " + t))
        for r in dd.get("render_controllers", []):
            rid = r if isinstance(r, str) else next(iter(r))
            if rid not in rcs and not rid.startswith("controller.render.item_default") and rid not in ("controller.render.default", "controller.render.armor"): bad.append((p, "render controller " + rid))
    js = sorted(glob.glob(out + "/behavior_pack/scripts/**/*.js", recursive=True))
    js_bad = []
    for p in js:
        r = subprocess.run(["node", "--input-type=module", "--check"], stdin=open(p, "rb"), capture_output=True)
        if r.returncode: js_bad.append((p, r.stderr.decode()[:200]))
    # package
    os.makedirs(os.path.dirname(mca), exist_ok=True)
    if os.path.exists(mca): os.remove(mca)
    with zipfile.ZipFile(mca, "w", zipfile.ZIP_DEFLATED) as z:
        for part in ("behavior_pack", "resource_pack"):
            for p in sorted(glob.glob(f"{out}/{part}/**/*", recursive=True)):
                if os.path.isfile(p): z.write(p, os.path.relpath(p, out))
    for r in report: print("  %-30s cubes=%d uv=%d zfix=%d new_bones=%s" % r)
    print("entities:", len(glob.glob(out + "/behavior_pack/entities/*.json")), "items:", len(glob.glob(out + "/behavior_pack/items/*.json")))
    print("json/reference errors:", len(bad), bad[:8]); print("js modules:", len(js), "syntax errors:", len(js_bad), js_bad[:3])
    print("mcaddon:", mca, os.path.getsize(mca) // 1024, "KB")


if __name__ == "__main__":
    main(*sys.argv[1:5])
