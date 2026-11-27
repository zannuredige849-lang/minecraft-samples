"""Step 2: bring every hand-made (cb:*) texture, item icon and armour texture to the unified look.
Geometry of these models is kept (already chunky); textures get: despeckle (only if noisy), palette reduction,
the shared colour grade (cool shadows / warm lights) and the same 1px bevel as the generated mobs."""
import sys, os, glob, json, math
import numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from mcgeo import load_json, collect_geometries, cube_faces

SKIP_SUFFIX = ("_mer", "_height", "_normal")


def noise_score(a):
    op = a[..., 3] > 128
    lum = a[..., :3].astype(float) @ np.array([0.3, 0.59, 0.11])
    d = np.abs(np.diff(lum, axis=1))
    m = op[:, 1:] & op[:, :-1]
    return float(d[m].mean()) if m.any() else 0.0


def grade_rgb(rgb):
    x = rgb.astype(float) / 255.0
    lum = (x @ np.array([0.3, 0.59, 0.11]))[..., None]
    # saturation +8%
    x = lum + (x - lum) * 1.08
    # gentle S-curve contrast
    x = np.clip((x - 0.5) * 1.07 + 0.5, 0, 1)
    lum = (x @ np.array([0.3, 0.59, 0.11]))[..., None]
    shadow = np.clip(0.55 - lum, 0, 1) / 0.55
    light = np.clip(lum - 0.55, 0, 1) / 0.45
    x = x + shadow * np.array([-0.012, 0.0, 0.03]) + light * np.array([0.03, 0.015, -0.015])
    return (np.clip(x, 0, 1) * 255 + 0.5).astype(np.uint8)


def quantize_keep_alpha(a, colors):
    op = a[..., 3] > 8
    rgb = a[..., :3].copy()
    if op.any():
        fill = rgb[op].mean(axis=0).astype(np.uint8)
        rgb[~op] = fill
    q = Image.fromarray(rgb).quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    out = a.copy()
    out[..., :3] = np.asarray(q)
    return out


def bevel(a, rects, tw, th):
    H, W = a.shape[:2]
    sx, sy = W / tw, H / th
    seen = set()
    for (x, y, w, h) in rects:
        x0, y0 = int(round(x * sx)), int(round(y * sy))
        ww, hh = int(round(w * sx)), int(round(h * sy))
        if ww < 4 or hh < 4 or (x0, y0, ww, hh) in seen: continue
        seen.add((x0, y0, ww, hh))
        if x0 < 0 or y0 < 0 or x0 + ww > W or y0 + hh > H: continue
        sub = a[y0:y0 + hh, x0:x0 + ww]
        if (sub[..., 3] > 200).mean() < 0.9: continue
        f = sub[..., :3].astype(float)
        f[0, :] = f[0, :] * 0.86 + 255 * 0.14
        f[:, 0] = f[:, 0] * 0.86 + 255 * 0.14
        f[hh - 1, :] *= 0.78
        f[:, ww - 1] *= 0.78
        sub[..., :3] = np.clip(f, 0, 255).astype(np.uint8)


def restyle_entity_texture(img, rects=None, tw=None, th=None, despeckle=False):
    a = np.asarray(img.convert("RGBA")).copy()
    ns = noise_score(a)
    if despeckle:   # speckled hand paint (cannibal troll): flatten first
        im = Image.fromarray(a[..., :3]).filter(ImageFilter.MedianFilter(3))
        a[..., :3] = np.asarray(im)
    a = quantize_keep_alpha(a, (16 if despeckle else 40) if a.shape[0] >= 128 else 24)
    a[..., :3] = grade_rgb(a[..., :3])
    if rects is not None:
        bevel(a, rects, tw, th)
    return Image.fromarray(a), ns


def restyle_icon(img, outline=True):
    a = np.asarray(img.convert("RGBA")).copy()
    op = a[..., 3] > 8
    if not op.any(): return img
    a = quantize_keep_alpha(a, 10)
    a[..., :3] = grade_rgb(a[..., :3])
    if outline:
        H, W = op.shape
        pad = np.pad(op, 1, constant_values=False)
        edge = op & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
        a[edge, :3] = (a[edge, :3].astype(float) * 0.55).astype(np.uint8)
        # top-left inner highlight
        hl = op & ~edge & ~np.pad(op, ((1, 0), (1, 0)), constant_values=False)[:H, :W]
        a[hl, :3] = np.clip(a[hl, :3].astype(float) * 1.25 + 8, 0, 255).astype(np.uint8)
    return Image.fromarray(a)


def faces_for(geo):
    rects = []
    for b in geo["bones"]:
        for c in b.get("cubes", []) or []:
            for name, corner, ua, va, rect in cube_faces(c, geo["tw"], geo["th"]):
                u, v, w, h = rect
                if w > 0 and h > 0: rects.append((u, v, w, h))
    return rects


def run(out, skip_textures=(), log=None):
    rp = os.path.join(out, "resource_pack")
    geos = {}
    for p in glob.glob(f"{rp}/models/entity/*.json"):
        try: geos.update(collect_geometries(p))
        except Exception: pass
    tex_geo = {}
    for p in glob.glob(f"{rp}/entity/*.json"):
        c = load_json(p)["minecraft:client_entity"]["description"]
        g = c.get("geometry", {}).get("default") or next(iter(c.get("geometry", {}).values()), None)
        for t in c.get("textures", {}).values():
            tex_geo.setdefault(t, g)
    n = 0
    for p in sorted(glob.glob(f"{rp}/textures/entity/**/*.png", recursive=True)):
        stem = os.path.splitext(p)[0]
        rel = os.path.relpath(stem, rp)
        if stem.endswith(SKIP_SUFFIX) or rel in skip_textures:
            continue
        img = Image.open(p)
        g = geos.get(tex_geo.get(rel))
        rects = faces_for(g) if g and g["bones"] else None
        new, ns = restyle_entity_texture(img, rects, g["tw"] if g else None, g["th"] if g else None, despeckle=os.path.basename(stem).startswith("cannibal_troll"))
        new.save(p); n += 1
        if log is not None: log.append((rel, round(ns, 1), bool(rects)))
    # armour textures: grade only
    for p in sorted(glob.glob(f"{rp}/textures/models/**/*.png", recursive=True)):
        if os.path.splitext(p)[0].endswith(SKIP_SUFFIX): continue
        new, _ = restyle_entity_texture(Image.open(p), None)
        new.save(p); n += 1
    return n


if __name__ == "__main__":
    lg = []
    from forge.registry import REG
    from forge.common import ENT
    skip = set()
    for ent in REG:
        for t in ENT[ent]["textures"].values(): skip.add(t)
    print(run(sys.argv[1], skip, lg))
    for l in lg[:200]: print(l)
