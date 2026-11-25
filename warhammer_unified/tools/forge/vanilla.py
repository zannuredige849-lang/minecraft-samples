"""Vanilla Minecraft textures as the source of grain for generated materials, plus helpers to recolour vanilla icons."""
import os, functools, colorsys
import numpy as np
from PIL import Image

DIR = os.path.join(os.path.dirname(__file__), "..", "data", "vanilla")
LUM = np.array([0.3, 0.59, 0.11])

# style -> (vanilla block tile(s), grain amplitude in ramp tones)
STYLE_TILE = {
    "plate": (["iron_block"], 0.55), "metal": (["iron_block"], 0.6), "rock": (["cobblestone", "stone", "deepslate"], 1.1),
    "wood": (["planks_oak", "log_oak"], 0.9), "cloth": (["wool_colored_white"], 0.7), "fur": (["wool_colored_white"], 0.8),
    "leather": (["coarse_dirt"], 0.8), "skin": (["hardened_clay_stained_white"], 0.4), "bone": (["bone_block_side"], 0.8),
    "scale": (["prismarine_bricks"], 0.7), "ice": (["ice_packed", "blue_ice"], 0.6), "flame": (["magma"], 0.8),
    "glow": (["glowstone"], 0.5), "leaf": (["leaves_oak_opaque"], 1.0), "stripes": (["wool_colored_white"], 0.5),
}
SLOT_TILE = {"trim": ["gold_block"], "accent": ["gold_block"]}      # gilded parts use the gold block grain


@functools.lru_cache(maxsize=None)
def _tile(kind, name):
    im = Image.open(os.path.join(DIR, kind, name + ".png")).convert("RGBA")
    im = im.crop((0, 0, 16, 16))
    a = np.asarray(im).astype(float)
    lum = a[..., :3] @ LUM
    sd = lum.std() or 1.0
    return np.clip((lum - lum.mean()) / (2.2 * sd), -1, 1)


def grain(style, slot, seed):
    """Return (16x16 grain map in [-1,1], amplitude) or None."""
    if style not in STYLE_TILE: return None
    names, amp = STYLE_TILE[style]
    if style in ("plate", "metal") and slot in SLOT_TILE: names = SLOT_TILE[slot]
    return _tile("blocks", names[seed % len(names)]), amp


# ------------------------------------------------------------------ icons
def icon(name):
    return Image.open(os.path.join(DIR, "items", name + ".png")).convert("RGBA")


def tint(img, rgb, boost=1.0):
    """Recolour keeping the vanilla pixel structure: luminance -> 6-tone ramp of `rgb`."""
    from .core import make_ramp
    ramp = make_ramp(rgb)
    a = np.asarray(img.convert("RGBA")).copy()
    lum = a[..., :3] @ LUM / 255.0
    lo, hi = (lum[a[..., 3] > 8].min(), lum[a[..., 3] > 8].max()) if (a[..., 3] > 8).any() else (0, 1)
    t = np.clip((lum - lo) / max(hi - lo, 1e-6), 0, 1) * 5.0 * boost
    t = np.clip(t, 0, 5)
    i0 = np.floor(t).astype(int); i1 = np.minimum(i0 + 1, 5); f = (t - i0)[..., None]
    R = np.array(ramp, float)
    out = R[i0] * (1 - f) + R[i1] * f
    a[..., :3] = out[..., :3].astype(np.uint8)
    return Image.fromarray(a)


def palette_map(img, refs):
    """Snap every opaque pixel to the nearest colour of the vanilla reference icons (keeps the silhouette)."""
    pal = []
    for r in refs:
        ar = np.asarray(r.convert("RGBA"))
        for px in ar[ar[..., 3] > 200][:, :3]:
            pal.append(tuple(int(v) for v in px))
    pal = np.array(sorted(set(pal)), float)
    hsv = np.array([colorsys.rgb_to_hsv(*(c / 255)) for c in pal])
    a = np.asarray(img.convert("RGBA")).copy()
    ys, xs = np.nonzero(a[..., 3] > 8)
    for y, x in zip(ys, xs):
        h, s, v = colorsys.rgb_to_hsv(*(a[y, x, :3] / 255.0))
        dh = np.minimum(abs(hsv[:, 0] - h), 1 - abs(hsv[:, 0] - h)) * (s + hsv[:, 1]) * 1.2
        d = dh ** 2 + (hsv[:, 1] - s) ** 2 * 0.6 + (hsv[:, 2] - v) ** 2 * 1.4
        a[y, x, :3] = pal[int(np.argmin(d))].astype(np.uint8)
    return Image.fromarray(a)


def wool_fabric(size, dye_rgb):
    """Vanilla wool tiled to `size`, dyed (used for the fleece/sheepskin armour textures)."""
    tile = icon_block("wool_colored_white")
    big = Image.new("RGBA", (size, size))
    for y in range(0, size, 16):
        for x in range(0, size, 16):
            big.paste(tile, (x, y))
    return tint(big, dye_rgb)


def icon_block(name):
    return Image.open(os.path.join(DIR, "blocks", name + ".png")).convert("RGBA").crop((0, 0, 16, 16))
