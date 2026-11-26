"""v10.8.7: a new texture for cb:cannibal_troll, painted in the add-on's style (1 texel per model unit,
6-tone clustered pixel art + MER), on the model as it is (cubes and pivots unchanged).

The old model mapped one and the same square of the texture onto all six faces of a cube (stretched,
the same picture on the front, sides and top). Now every cube gets its own island with real faces
(per-face UV, fractional sizes rounded up to whole texels). The material of each cube comes from what that
old square was: skin, belly, mane, dark hide, leather straps, loincloth, bone (tusks, horns, toes, spikes), eyes.
Three skins (cannibal_troll_0/1/2): blood-brown, swamp-grey, ash-blue.

python3 cannibal_tex.py <built add-on folder>
"""
import sys, os, glob, json, math
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.dirname(HERE))
from fix_held import L, W
from forge.core import Palette
from v11.paint11 import paint, decal

# old square (north uv) -> material
OLD = {(8, 8): "skin", (136, 8): "belly", (136, 72): "mane", (72, 200): "hide", (136, 136): "leather",
       (72, 136): "loin", (8, 136): "bone", (8, 200): "eye", (200, 136): "leather"}
MAT = {"skin": ("skin", "flesh", 3.0), "belly": ("belly", "flesh", 3.2), "mane": ("mane", "fur", 2.8),
       "hide": ("hide", "flesh", 2.7), "leather": ("leather", "leather", 2.8), "loin": ("loin", "cloth", 2.6),
       "bone": ("bone", "bone", 3.4), "eye": ("glow", "glow", 4.2)}
SKINS = [
    dict(skin="#8a5a4a", belly="#a0715c", hide="#6a4034", mane="#5a3a2c", leather="#4a3022", loin="#5c2620", gore="#7a1c18"),
    dict(skin="#6f7a5e", belly="#87906f", hide="#535c45", mane="#4a5238", leather="#3f3324", loin="#4a3a26", gore="#6a2a1e"),
    dict(skin="#5f6a7c", belly="#7a8494", hide="#465062", mane="#404a5e", leather="#3a2e2a", loin="#2e3a52", gore="#6a2230"),
]
BASE = dict(dark="#140e10", bone="#e2d6b4", glow="#ff3a24", armor="#5a5a62")


def _ceil(v): return max(1, int(math.ceil(v - 1e-6)))


def _decals(bone, mat, c):
    if bone == "jaw" and mat == "hide" and c["size"][0] >= 10: return [("north", "mouth", 1, 8, "bone")]
    if bone == "body" and mat == "belly" and c["size"][0] >= 20: return [("north", "scar", 3)]
    if bone == "body2" and mat == "skin" and c["size"][0] >= 28: return [("north", "scar", 3), ("south", "veins", "gore")]
    if bone in ("rightArm", "leftArm") and mat == "skin": return [("east", "veins", "hide"), ("west", "veins", "hide")]
    return []


def _pack(cubes, size):
    items = sorted(cubes, key=lambda c: (-(c["_d"] + c["_h"]), -(2 * c["_d"] + 2 * c["_w"])))
    shelves = []
    for c in items:
        rw, rh = 2 * c["_d"] + 2 * c["_w"], c["_d"] + c["_h"]
        if rw > size: return False
        for sh in shelves:
            if rh <= sh[1] and sh[2] + rw <= size: c["_uv"] = (sh[2], sh[0]); sh[2] += rw; break
        else:
            y = (shelves[-1][0] + shelves[-1][1]) if shelves else 0
            if y + rh > size: return False
            shelves.append([y, rh, rw]); c["_uv"] = (0, y)
    return True


def run(out):
    rp = f"{out}/resource_pack"
    gp = f"{rp}/models/entity/cannibal_troll.geo.json"; d = L(gp); g = d["minecraft:geometry"][0]
    cubes = []
    for b in g["bones"]:
        for i, c in enumerate(b.get("cubes") or []):
            uv = c.get("uv")
            key = tuple(uv["north"]["uv"]) if isinstance(uv, dict) else tuple(uv)
            m = OLD.get(key, "skin")
            c["_m"], c["_bone"], c["_seed"] = m, b["name"], len(cubes) + 1
            c["_w"], c["_h"], c["_d"] = (_ceil(v) for v in c["size"])
            cubes.append(c)
    for size in (128, 256, 512):
        if _pack(cubes, size): break
    for k, skin in enumerate(SKINS):
        p = Palette(**{**BASE, **skin})
        tex = np.zeros((size, size, 4), np.uint8); mer = np.zeros((size, size, 3), np.uint8); mer[..., 2] = 255
        for c in cubes:
            slot, style, tone = MAT[c["_m"]]
            mat = {"slot": slot, "style": style, "tone": tone, "decals": _decals(c["_bone"], c["_m"], c)}
            u, v = c["_uv"]; w, h, dd = c["_w"], c["_h"], c["_d"]
            rects = {"east": (u, v + dd, dd, h), "north": (u + dd, v + dd, w, h), "west": (u + dd + w, v + dd, dd, h),
                     "south": (u + 2 * dd + w, v + dd, w, h), "up": (u + dd, v, w, dd), "down": (u + dd + w, v, w, dd)}
            for face, (x, y, fw, fh) in rects.items():
                rgba, m = paint(mat, face, fw, fh, 1, p, c["_seed"] * 7 + len(face))
                decal(rgba, m, mat, face, 1, p)
                tex[y:y + fh, x:x + fw] = rgba; mer[y:y + fh, x:x + fw] = m
            if k == 0:
                c["uv"] = {f: {"uv": [r[0], r[1]], "uv_size": [r[2], r[3]]} for f, r in rects.items()}
        name = f"{rp}/textures/entity/cannibal_troll_{k}"
        Image.fromarray(tex).save(name + ".png"); Image.fromarray(mer).save(name + "_mer.png")
        for ext in ("_height.png", "_heightmap.png", "_normal.png"):
            if os.path.exists(name + ext): os.remove(name + ext)
        json.dump({"format_version": "1.16.100", "minecraft:texture_set": {"color": f"cannibal_troll_{k}",
                   "metalness_emissive_roughness": f"cannibal_troll_{k}_mer"}}, open(name + ".texture_set.json", "w"), indent=2)
        if k == 0:   # the unused base file follows variant 0, so nothing old is left behind
            Image.fromarray(tex).save(f"{rp}/textures/entity/cannibal_troll.png")
            Image.fromarray(mer).save(f"{rp}/textures/entity/cannibal_troll_mer.png")
            for ext in ("_height.png",):
                if os.path.exists(f"{rp}/textures/entity/cannibal_troll{ext}"): os.remove(f"{rp}/textures/entity/cannibal_troll{ext}")
            json.dump({"format_version": "1.16.100", "minecraft:texture_set": {"color": "cannibal_troll",
                       "metalness_emissive_roughness": "cannibal_troll_mer"}}, open(f"{rp}/textures/entity/cannibal_troll.texture_set.json", "w"), indent=2)
    for c in cubes:
        for k in [k for k in c if k.startswith("_")]: del c[k]
    g["description"]["texture_width"] = g["description"]["texture_height"] = size
    W(gp, d)
    return len(cubes), size


if __name__ == "__main__":
    print("cannibal troll repainted (cubes, texture size):", run(sys.argv[1]))
