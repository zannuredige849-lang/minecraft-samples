"""v11 painter: clustered pixel art with 4-6 hue-shifted tones per material + PBR (MER) per pixel.

Every face is painted as a field of tone indices 0..5 (dark -> light) on the material's 6-tone ramp
(core.make_ramp: cool deep shadows -> clean mid tones -> warm highlights), quantised and cleaned so that
isolated single pixels are absorbed by their neighbours (~80%+ connected clusters, no "sand", no 1px frames).
Material textures: forged metal (diagonal glints + rivets), chitin (overlapping plates), scale, fur strands,
stitched flesh, ribbed skin, cloth folds, bone/horn rings, ice facets, glowing parts.
MER: R = metalness, G = emissive, B = roughness (Bedrock texture_set metalness_emissive_roughness).
"""
import math
import numpy as np
from forge.core import ramp_at, hex2rgb

FACE_SHIFT = {"up": 0.55, "north": 0.0, "south": -0.35, "east": -0.15, "west": -0.15, "down": -1.0}
# style -> (metalness, roughness, emissive)
PBR = {"forged": (225, 70, 0), "plate": (210, 90, 0), "gold": (245, 55, 0), "chitin": (25, 110, 0), "scale": (20, 120, 0),
       "fur": (0, 235, 0), "flesh": (0, 195, 0), "ribbed": (0, 175, 0), "cloth": (0, 240, 0), "robe": (0, 235, 0),
       "leather": (0, 210, 0), "bone": (0, 160, 0), "horn": (0, 140, 0), "ice": (10, 40, 70), "glow": (0, 120, 255),
       "flame": (0, 150, 255), "teeth": (0, 120, 0), "flat": (0, 200, 0), "gem": (40, 30, 200), "skin": (0, 185, 0)}


def _h(*a):
    x = 2166136261
    for v in a:
        for ch in str(v):
            x = ((x ^ ord(ch)) * 16777619) & 0xffffffff
    return x


def _noise(w, h, cell, seed):
    """Smooth value noise in [-1, 1]."""
    gw, gh = w // cell + 2, h // cell + 2
    g = np.array([[(_h(seed, i, j) % 1000) / 500.0 - 1 for i in range(gw)] for j in range(gh)])
    ys, xs = np.mgrid[0:h, 0:w]
    fx, fy = xs / cell, ys / cell
    x0, y0 = fx.astype(int), fy.astype(int)
    tx, ty = fx - x0, fy - y0
    tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    return (g[y0, x0] * (1 - tx) * (1 - ty) + g[y0, x0 + 1] * tx * (1 - ty) + g[y0 + 1, x0] * (1 - tx) * ty + g[y0 + 1, x0 + 1] * tx * ty)


def tone_field(style, face, w, h, d, seed, tone, mat):
    ys, xs = np.mgrid[0:h, 0:w].astype(float)
    T = np.full((h, w), tone + FACE_SHIFT[face])
    n2 = _noise(w, h, max(2, 3 * d), seed)
    vgrad = 0.35 - 0.7 * ys / max(h - 1, 1)          # light from above, inside every face
    if style in ("forged", "plate", "gold"):
        T += vgrad * 0.8 + n2 * 0.25
        band = ((xs + ys) // (2 * d)) % 6
        T += np.where(band == 0, 1.1, 0) + np.where(band == 1, 0.5, 0)        # diagonal forged glints
        if style == "forged" and w >= 5 * d and h >= 4 * d:                      # rivets along the top and bottom
            step = 4 * d
            for yy in (d, h - 2 * d):
                for xx in range(2 * d, w - 2 * d, step):
                    T[yy:yy + d, xx:xx + d] = tone + 1.8
                    T[min(h - 1, yy + d):min(h, yy + 2 * d), xx:xx + d] = tone - 1.4
    elif style == "chitin":
        bh = 4 * d
        band = (ys // bh).astype(int)
        off = (band * 3 * d) % (7 * d)
        r = (ys % bh)
        plate = ((xs + off) // (6 * d)).astype(int)
        ptone = np.vectorize(lambda b, q: ((_h(seed, b, q) % 5) - 2) * 0.25)(band, plate)
        T += ptone + np.where(r < d, 0.7, 0) + np.where(r >= bh - d, -0.9, 0) + n2 * 0.25 + vgrad * 0.5
        seam = ((xs + off) % (6 * d)) < d
        T += np.where(seam & (r >= d), -0.5, 0)
    elif style == "scale":
        sh, sw = 3 * d, 4 * d
        row = (ys // sh).astype(int)
        xo = (xs + (row % 2) * sw / 2) % sw
        ry = ys % sh
        edge = (ry >= sh - d) | ((xo < d * 0.9) & (ry > d))
        T += np.where(ry < d, 0.6, 0) + np.where(edge, -0.8, 0) + n2 * 0.35 + vgrad * 0.5
    elif style == "fur":
        col = (xs // (2 * d)).astype(int)
        L = np.array([3 + _h(seed, c) % 5 for c in range(int(w // (2 * d)) + 2)]) * d
        layer = 5 * d
        ph = (ys + (col * 3 * d) % layer) % layer
        tip = ph < (L[col] * 0.35)
        T += np.where(tip, 0.9, 0) + np.where(ph > layer - d, -1.2, 0) + vgrad * 0.5 + n2 * 0.25
        T += np.where((col % 3) == 0, -0.4, 0)
    elif style in ("flesh", "skin"):
        blobs = _noise(w, h, max(3, 3 * d), seed + 7)
        T += np.rint(blobs * (1.6 if style == "flesh" else 0.8)) * 0.6 + vgrad * 0.5
        spots = _noise(w, h, max(2, 4 * d), seed + 11) > 0.62
        T += np.where(spots, -1.0, 0)
    elif style == "ribbed":
        T += np.rint(np.sin(ys / (2.0 * d) * math.pi)) * 0.45 + np.rint(n2 * 1.5) * 0.35 + vgrad * 0.5
    elif style in ("cloth", "robe"):
        fold = np.sin(xs / (3.0 * d) * math.pi + (_h(seed) % 7))
        T += fold * 0.75 + vgrad * 0.3 + n2 * 0.15
        T += np.where(ys >= h - 2 * d, -0.9, 0) if face not in ("up", "down") else 0
    elif style == "leather":
        T += n2 * 0.4 + vgrad * 0.5
        T += np.where((ys % (4 * d)) < 1, -0.7, 0)
    elif style in ("bone", "horn", "teeth"):
        T += np.where(((ys // (2 * d)) % 2) == 0, 0.45, -0.1) + n2 * 0.2
        if style == "horn":
            T += 0.9 - 1.8 * ys / max(h - 1, 1)
    elif style == "ice":
        f = ((xs - ys) // (3 * d)) % 4
        T += np.where(f == 0, 1.2, np.where(f == 2, -0.7, 0.2)) + n2 * 0.2
        T += np.where(((xs + ys) % (7 * d)) < d, 1.4, 0)
    elif style in ("glow", "flame", "gem"):
        cx, cy = (w - 1) / 2, (h - 1) / 2
        rr = np.sqrt(((xs - cx) / max(w / 2, 1)) ** 2 + ((ys - cy) / max(h / 2, 1)) ** 2)
        T = np.full((h, w), 4.6) - rr * 1.8 + n2 * 0.4
        if style == "flame": T += np.where(((xs + ys * 0.5) // d) % 3 == 0, 0.6, 0)
    else:  # flat
        T += vgrad * 0.4 + n2 * 0.2
    return T


def cluster(idx):
    """Absorb isolated pixels into the dominant neighbouring tone (two passes)."""
    for _ in range(2):
        p = np.pad(idx, 1, mode="edge")
        nb = np.stack([p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]])
        same = (nb == idx[None]).any(0)
        if same.all(): break
        mode = np.apply_along_axis(lambda v: np.bincount(v, minlength=6).argmax(), 0, nb)
        idx = np.where(same, idx, mode)
    return idx


def paint(mat, face, w, h, d, pal, seed):
    """-> (rgba uint8 h*w*4, mer uint8 h*w*3) for one face of w*h texels (already at density d)."""
    style = mat.get("style", "flat")
    slot = mat.get("slot", "armor")
    ramp = pal[slot] if slot in pal else pal["armor"]
    tone = mat.get("tone", 3.0)
    T = tone_field(style, face, w, h, d, seed, tone, mat)
    lo, hi = mat.get("range", (0, 5))
    idx = cluster(np.clip(np.rint(T), lo, hi).astype(int))
    rgba = np.zeros((h, w, 4), np.uint8)
    for i in range(6):
        rgba[idx == i] = ramp_at(ramp, i)
    met, rough, em = PBR.get(style, (0, 200, 0))
    mer = np.zeros((h, w, 3), np.uint8)
    mer[..., 0] = met
    mer[..., 2] = np.clip(rough - (idx - 3) * 12, 20, 255)        # highlights a little smoother
    if em:
        mer[..., 1] = np.clip(em * (0.55 + 0.09 * idx), 0, 255)
    # bands of a second material (hems, belts, trims) - mat["band"] = [(slot, style, from_frac, to_frac), ...]
    for bslot, bstyle, f0, f1 in mat.get("bands", ()):
        if face in ("up", "down"): continue
        y0, y1 = int(round(h * f0)), max(int(round(h * f0)) + 1, int(round(h * f1)))
        sub = dict(mat); sub.update(slot=bslot, style=bstyle); sub.pop("bands", None); sub.pop("decals", None)
        r2, m2 = paint(sub, face, w, y1 - y0, d, pal, seed + 101)
        rgba[y0:y1] = r2; mer[y0:y1] = m2
    return rgba, mer


def decal(rgba, mer, mat, face, d, pal):
    """Simple decals at texel density d: eyes, mouth/teeth, stitches, runes, emblem gem."""
    h, w = rgba.shape[:2]
    for dc in mat.get("decals", ()):
        if dc[0] not in (face, "*"): continue
        kind = dc[1]
        def put(x, y, slot, i, emit=0, rx=1, ry=1):
            ramp = pal[slot]
            for yy in range(int(y * d), int((y + ry) * d)):
                for xx in range(int(x * d), int((x + rx) * d)):
                    if 0 <= xx < w and 0 <= yy < h:
                        rgba[yy, xx] = ramp_at(ramp, i)
                        if emit: mer[yy, xx] = (0, emit, 60)
        W, H = w // d, h // d
        if kind == "eyes":            # ("north","eyes", slot, y, n=2, spread=None, size=1)
            slot, y = dc[2], dc[3]; n = dc[4] if len(dc) > 4 else 2; sz = dc[5] if len(dc) > 5 else 1
            gap = max(1, (W - n * sz) // (n + 1))
            xs = [gap + k * (sz + gap) for k in range(n)]
            if n == 2: xs = [W // 2 - 1 - sz - max(0, (W // 6) - 1), W // 2 + 1 + max(0, (W // 6) - 1)]
            for x in xs:
                put(x - (1 if sz > 1 else 0) * 0, y, slot, 5, 255, sz, sz)
                put(x, y + sz, "dark" if "dark" in pal else slot, 0, 0, sz, 1)
        elif kind == "mouth":         # ("north","mouth", y, width, teeth_slot)
            y, mw = dc[2], dc[3]; ts = dc[4] if len(dc) > 4 else "bone"
            x0 = (W - mw) // 2
            put(x0, y, "dark", 0, 0, mw, 2)
            for k in range(0, mw, 2):
                put(x0 + k, y, ts, 4, 0, 1, 1)
                put(x0 + k + 1, y + 1, ts, 3, 0, 1, 1)
        elif kind == "tongue":        # ("north","tongue", y, slot)
            put(W // 2 - 1, dc[2], dc[3], 3, 0, 2, 3)
        elif kind == "stitch":        # ("north","stitch", y) horizontal suture with crosses
            y = dc[2]
            for x in range(1, W - 1):
                put(x, y, "dark", 0, 0, 1, 1)
                if x % 3 == 1: put(x, y - 1, "dark", 1, 0, 1, 1); put(x, y + 1, "dark", 1, 0, 1, 1)
        elif kind == "vstitch":
            x = dc[2]
            for y in range(1, H - 1):
                put(x, y, "dark", 0, 0, 1, 1)
                if y % 3 == 1: put(x - 1, y, "dark", 1, 0, 1, 1); put(x + 1, y, "dark", 1, 0, 1, 1)
        elif kind == "runes":         # ("north","runes", slot) glowing glyph column
            slot = dc[2]
            for y in range(1, H - 1, 3):
                put(W // 2, y, slot, 5, 255, 1, 2); put(W // 2 - 1, y + 1, slot, 4, 220, 1, 1)
        elif kind == "gem":           # ("north","gem", slot, x, y, size)
            slot, x, y, sz = dc[2], dc[3], dc[4], dc[5] if len(dc) > 5 else 2
            put(x, y, slot, 3, 200, sz, sz); put(x, y, slot, 5, 255, 1, 1)
        elif kind == "skull":         # small white skull buckle
            x, y = (W - 3) // 2, dc[2]
            put(x, y, "bone", 4, 0, 3, 2); put(x, y + 2, "bone", 3, 0, 3, 1)
            put(x, y + 1, "dark", 0, 0, 1, 1); put(x + 2, y + 1, "dark", 0, 0, 1, 1)
        elif kind == "veins":         # dark veins
            slot = dc[2]
            for k in range(2):
                x = 2 + (k * 7 + 3) % max(2, W - 3)
                for y in range(1, H - 1):
                    if (y + k) % 5 == 4: continue
                    xx = x + int(math.sin(y * 0.6 + k) * 1.5)
                    put(xx, y, slot, 1, 0, 1, 1)
        elif kind == "spots":         # pustules (glowing)
            slot = dc[2]
            for k in range(dc[3] if len(dc) > 3 else 3):
                x = 1 + (_h(k, w, h) % max(1, W - 2)); y = 1 + (_h(k, h, w, 3) % max(1, H - 2))
                put(x, y, slot, 4, 120, 1, 1); put(x, y + 1, slot, 2, 0, 1, 1)
        elif kind == "scar":          # pale diagonal battle scar
            y0 = dc[2]
            for k in range(min(W - 2, 6)):
                put(1 + k, y0 + k // 2, slot if (slot := mat.get("slot")) else "bone", 5, 0, 1, 1)
        elif kind == "ribs":          # exposed ribs
            slot = dc[2]
            for k in range(1, H - 1, 3):
                put(1, k, slot, 4, 0, W - 2, 1); put(1, k + 1, "dark", 0, 0, W - 2, 1)
