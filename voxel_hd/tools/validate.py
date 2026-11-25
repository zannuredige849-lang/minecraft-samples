#!/usr/bin/env python3
"""Sanity checks for a generated pack: JSON validity, texture-set references, map sizes, attachables."""
import json, sys
from pathlib import Path
from PIL import Image

root = Path(sys.argv[1])
errors = []

for j in root.rglob("*.json"):
    try:
        json.loads(j.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        errors.append(f"bad json {j}: {e}")

n_sets = 0
for ts in root.rglob("*.texture_set.json"):
    n_sets += 1
    d = json.loads(ts.read_text())["minecraft:texture_set"]
    base = None
    for k, v in d.items():
        if isinstance(v, str):
            f = ts.with_name(v + ".png")
            if not f.exists():
                errors.append(f"{ts}: missing {k} -> {v}.png")
                continue
            size = Image.open(f).size
            base = base or size
            if size != base:
                errors.append(f"{ts}: size mismatch {k} {size} vs {base}")

geos = set()
for g in (root / "models").rglob("*.geo.json"):
    for geo in json.loads(g.read_text())["minecraft:geometry"]:
        geos.add(geo["description"]["identifier"])
n_att = 0
for a in (root / "attachables").glob("*.json"):
    n_att += 1
    d = json.loads(a.read_text())["minecraft:attachable"]["description"]
    for name, path in d["textures"].items():
        if not name == "enchanted" and not (root / (path + ".png")).exists():
            errors.append(f"{a.name}: missing texture {path}")
    for gid in d["geometry"].values():
        if gid not in geos:
            errors.append(f"{a.name}: unknown geometry {gid}")
    im = Image.open(root / (d["textures"]["default"] + ".png"))
    if im.size != (32, 32):
        errors.append(f"{a.name}: held texture is {im.size}, expected 32x32")

print(f"texture sets: {n_sets}, attachables: {n_att}, geometries: {len(geos)}, errors: {len(errors)}")
for e in errors[:30]:
    print(" -", e)
sys.exit(1 if errors else 0)
