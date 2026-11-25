"""Vanilla Minecraft banners for the orc leaders (the `banner` bone is only visible when cb:leader is set).
The vanilla 64x64 banner layout (flag 20x40, pole, bar) is pasted into the orc textures next to the old skin
(canvas 64x64 -> 128x64, old pixel coordinates unchanged) and mapped with per-face UVs."""
import sys, os, glob, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from mcgeo import load_json
from forge.core import hex2rgb

BANNER_DIR = os.path.join(os.path.dirname(__file__), "data", "vanilla", "banner")
# entity -> (geometry file, geometry id, base colour, [(pattern, colour)])
ORCS = {
    "cb:orc": ("orc.geo.json", "geometry.cb_orc", "#7a4a22", [("banner_border", "#2a1a0e"), ("banner_circle", "#e0c080")]),
    "cb:green_orc": ("green_orc.geo.json", "geometry.cb_green_orc", "#3f7d2a", [("banner_border", "#141c10"), ("banner_skull", "#d8e0c0")]),
    "cb:hell_orc": ("hell_orc.geo.json", "geometry.cb_hell_orc", "#a82020", [("banner_border", "#1c0808"), ("banner_skull", "#f0e0b0")]),
}
DX = 64   # banner atlas offset inside the widened orc texture


def _load(n):
    return Image.open(os.path.join(BANNER_DIR, n + ".tga")).convert("RGBA")


def compose(base_hex, layers):
    img = np.asarray(_load("banner_base")).astype(float)
    col = np.array(hex2rgb(base_hex), float) / 255.0
    flag = np.zeros(img.shape[:2], bool); flag[0:42, 0:44] = True
    flag &= img[..., 3] > 0
    img[..., :3][flag] = img[..., :3][flag] * col
    out = Image.fromarray(img.astype(np.uint8))
    for name, hx in layers:
        pat = np.asarray(_load(name)).astype(float)
        m = (pat[..., 3] / 255.0)[..., None] * flag[..., None]
        c = np.array(hex2rgb(hx), float)
        arr = np.asarray(out).astype(float)
        arr[..., :3] = arr[..., :3] * (1 - m) + c * m * (0.55 + 0.45 * (pat[..., :3].mean(axis=2, keepdims=True) / 255.0))
        out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    return out


def _uv(u, v, w, h): return {"uv": [u + DX, v], "uv_size": [w, h]}


def banner_cubes():
    flag = {"north": _uv(22, 1, 20, 40), "south": _uv(1, 1, 20, 40), "east": _uv(0, 1, 1, 40), "west": _uv(21, 1, 1, 40), "up": _uv(1, 0, 20, 1), "down": _uv(21, 0, 20, 1)}
    pole = {"north": _uv(46, 2, 2, 42), "east": _uv(44, 2, 2, 42), "south": _uv(50, 2, 2, 42), "west": _uv(48, 2, 2, 42), "up": _uv(46, 0, 2, 2), "down": _uv(48, 0, 2, 2)}
    bar = {"north": _uv(2, 44, 20, 2), "east": _uv(0, 44, 2, 2), "south": _uv(24, 44, 20, 2), "west": _uv(22, 44, 2, 2), "up": _uv(2, 42, 20, 2), "down": _uv(22, 42, 20, 2)}
    return [
        {"origin": [-0.5, 13, 2.2], "size": [1, 28, 1], "uv": pole},
        {"origin": [-5.5, 38, 2.0], "size": [11, 1, 1.6], "uv": bar},
        {"origin": [-4.5, 20, 3.4], "size": [9, 18, 0.6], "uv": flag},
        {"origin": [-1, 41, 2.0], "size": [2, 2, 1.6], "uv": pole},
    ]


def run(out):
    from forge.common import ENT
    rp = f"{out}/resource_pack"
    n = 0
    for ent, (gfile, gid, base, layers) in ORCS.items():
        p = f"{rp}/models/entity/{gfile}"
        d = load_json(p)
        for g in d["minecraft:geometry"]:
            if g["description"]["identifier"] != gid: continue
            g["description"]["texture_width"] = 128
            for b in g["bones"]:
                if b["name"] == "banner": b["cubes"] = banner_cubes()
        json.dump(d, open(p, "w", encoding="utf-8"), indent=1)
        art = compose(base, layers)
        for tpath in ENT[ent]["textures"].values():
            tf = f"{rp}/{tpath}.png"
            old = Image.open(tf).convert("RGBA")
            new = Image.new("RGBA", (128, old.height), (0, 0, 0, 0))
            new.paste(old, (0, 0)); new.paste(art, (DX, 0))
            new.save(tf); n += 1
            for suf in ("_mer.png", "_height.png", "_normal.png", ".texture_set.json"):
                f = f"{rp}/{tpath}{suf}"
                if os.path.exists(f): os.remove(f)
    return n
