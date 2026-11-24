"""Structural checks for the generated add-on (no game required)."""
import glob
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP, BP = os.path.join(ROOT, "resource_pack"), os.path.join(ROOT, "behavior_pack")
errors = []


def err(msg):
    errors.append(msg)
    print("ERROR:", msg)


def load(p):
    with open(p) as fh:
        return json.load(fh)


def check_geo(path):
    j = load(path)
    g = j["minecraft:geometry"][0]
    d = g["description"]
    ident = d["identifier"]
    tw, th = d["texture_width"], d["texture_height"]
    names = [b["name"] for b in g["bones"]]
    if len(names) != len(set(names)):
        err(f"{ident}: duplicate bone names")
    for t in (tw, th):
        if t & (t - 1):
            err(f"{ident}: texture dimension {t} is not a power of two")
    ncubes = 0
    for b in g["bones"]:
        if "parent" in b and b["parent"] not in names:
            err(f"{ident}: bone {b['name']} has unknown parent {b['parent']}")
        for c in b.get("cubes", []):
            ncubes += 1
            w, h, dd = c["size"]
            u, v = c["uv"]
            if u < 0 or v < 0 or u + 2 * (w + dd) > tw or v + dd + h > th:
                err(f"{ident}: cube in {b['name']} uv {c['uv']} size {c['size']} leaves the {tw}x{th} atlas")
            if min(c["size"]) < 0:
                err(f"{ident}: negative cube size in {b['name']}")
            if ("rotation" in c) and "pivot" not in c:
                err(f"{ident}: rotated cube without pivot in {b['name']}")
    short = ident.split(".", 1)[1]
    tex = Image.open(os.path.join(RP, "textures/entity", short + ".png"))
    if tex.size != (tw, th):
        err(f"{ident}: texture is {tex.size}, geometry says {(tw, th)}")
    return short, set(names), ncubes


for gp in sorted(glob.glob(os.path.join(RP, "models/entity/*.geo.json"))):
    short, bones, n = check_geo(gp)
    anim = load(os.path.join(RP, "animations", short + ".animation.json"))["animations"]
    for an, a in anim.items():
        for bn in a["bones"]:
            if bn not in bones:
                err(f"{an}: animates unknown bone {bn}")
    ent = load(os.path.join(RP, "entity", short + ".entity.json"))["minecraft:client_entity"]["description"]
    for k, v in ent["animations"].items():
        if v not in anim:
            err(f"{short}: animation {v} not defined")
    if ent["geometry"]["default"] != "geometry." + short:
        err(f"{short}: client entity geometry mismatch")
    if not os.path.exists(os.path.join(BP, "entities", short + ".json")):
        err(f"{short}: missing behavior entity")
    print(f"{short}: {len(bones)} bones, {n} cubes, {len(anim)} animations OK")

rp, bp = load(os.path.join(RP, "manifest.json")), load(os.path.join(BP, "manifest.json"))
if bp["dependencies"][0]["uuid"] != rp["header"]["uuid"]:
    err("behavior pack does not depend on the resource pack")
uu = [rp["header"]["uuid"], rp["modules"][0]["uuid"], bp["header"]["uuid"], bp["modules"][0]["uuid"]]
if len(set(uu)) != 4:
    err("manifest uuids are not unique")
print("manifests OK" if not errors else "FAILED")
sys.exit(1 if errors else 0)
