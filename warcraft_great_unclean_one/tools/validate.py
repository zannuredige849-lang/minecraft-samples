"""Structural checks for the generated add-on (no game required)."""
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RP, BP = os.path.join(ROOT, "resource_pack"), os.path.join(ROOT, "behavior_pack")
NAME = "great_unclean_one"
errors = []


def err(msg):
    errors.append(msg)
    print("ERROR:", msg)


def load(p):
    with open(p) as fh:
        return json.load(fh)


geo = load(os.path.join(RP, "models/entity", NAME + ".geo.json"))["minecraft:geometry"][0]
d = geo["description"]
tw, th = d["texture_width"], d["texture_height"]
bones = geo["bones"]
names = [b["name"] for b in bones]
if len(names) != len(set(names)):
    err("duplicate bone names")
seen = set()
for b in bones:
    if "parent" in b and b["parent"] not in seen:
        err("bone %s: parent %s missing or listed later" % (b["name"], b.get("parent")))
    seen.add(b["name"])
tex = Image.open(os.path.join(RP, "textures/entity", NAME + ".png"))
if tex.size != (tw, th):
    err("texture is %s but geometry says %s" % (tex.size, (tw, th)))
ncubes = nfaces = 0
for b in bones:
    for c in b.get("cubes", []):
        ncubes += 1
        if min(c["size"]) <= 0:
            err("empty cube in %s" % b["name"])
        if not c["uv"]:
            err("cube without any visible face in %s" % b["name"])
        for f, u in c["uv"].items():
            nfaces += 1
            (x, y), (w, h) = u["uv"], u["uv_size"]
            x0, x1 = sorted((x, x + w))
            y0, y1 = sorted((y, y + h))
            if x0 < 0 or y0 < 0 or x1 > tw or y1 > th:
                err("face %s of a cube in %s leaves the atlas" % (f, b["name"]))
print("geometry: %d bones, %d cubes, %d textured faces, atlas %dx%d" % (len(bones), ncubes, nfaces, tw, th))

anims = load(os.path.join(RP, "animations", NAME + ".animation.json"))["animations"]
for an, a in anims.items():
    for bn, ch in a["bones"].items():
        if bn not in names:
            err("%s animates unknown bone %s" % (an, bn))
        for kind, keys in ch.items():
            for t in keys:
                if float(t) > a["animation_length"] + 1e-6:
                    err("%s: %s key %s beyond animation_length" % (an, bn, t))
    print("  %-34s %.3fs  %2d bones animated" % (an, a["animation_length"], len(a["bones"])))

ent = load(os.path.join(RP, "entity", NAME + ".entity.json"))["minecraft:client_entity"]["description"]
for k, v in ent["animations"].items():
    if not v.startswith("controller.") and v not in anims:
        err("client entity animation %s -> %s not defined" % (k, v))
ctrl = load(os.path.join(RP, "animation_controllers", NAME + ".animation_controllers.json"))["animation_controllers"]
for cn, c in ctrl.items():
    if ent["animations"].get("controller") != cn:
        err("controller %s not referenced by the client entity" % cn)
    for sn, s in c["states"].items():
        for a in s.get("animations", []):
            if a not in ent["animations"]:
                err("state %s uses unknown animation key %s" % (sn, a))
        for t in s.get("transitions", []):
            for target in t:
                if target not in c["states"]:
                    err("state %s transitions to unknown state %s" % (sn, target))
for a in ent["scripts"]["animate"]:
    key = a if isinstance(a, str) else list(a)[0]
    if key not in ent["animations"]:
        err("scripts.animate uses unknown key %s" % key)
if ent["geometry"]["default"] != d["identifier"]:
    err("client entity geometry mismatch")
bp_ent = load(os.path.join(BP, "entities", NAME + ".json"))["minecraft:entity"]["description"]["identifier"]
if bp_ent != ent["identifier"]:
    err("behavior and client entity identifiers differ")
if not os.path.exists(os.path.join(BP, "loot_tables/entities", NAME + ".json")):
    err("loot table missing")

rp, bp = load(os.path.join(RP, "manifest.json")), load(os.path.join(BP, "manifest.json"))
if bp["dependencies"][0]["uuid"] != rp["header"]["uuid"]:
    err("behavior pack does not depend on the resource pack")
uu = [rp["header"]["uuid"], rp["modules"][0]["uuid"], bp["header"]["uuid"], bp["modules"][0]["uuid"]]
if len(set(uu)) != 4:
    err("manifest uuids are not unique")
for p in (os.path.join(RP, "pack_icon.png"), os.path.join(BP, "pack_icon.png")):
    if not os.path.exists(p):
        err("missing " + p)
print("OK" if not errors else "FAILED (%d errors)" % len(errors))
sys.exit(1 if errors else 0)
