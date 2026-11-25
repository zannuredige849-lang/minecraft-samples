"""Player-model humans (v10.9).

Human mobs are built on the vanilla player model: 8x8x8 head, 8x12x4 body, 4x12x4 arms (3 wide = slim/Alex) and legs,
textured from a standard 64x64 player skin with the vanilla box-UV layout (base layer + hat/jacket/sleeve/pants overlay).

Where the skin comes from, in this order:
  1. tools/data/skins/<mob>.png  - any 64x64 player skin dropped in by hand (e.g. one downloaded from a skin site);
     used verbatim, slim arms detected like the game does (transparent column at x 54-55 of the right arm).
  2. otherwise it is generated: the vanilla Steve (or Alex) skin gives the head, face, eyes, hair and skin shading,
     recoloured to the mob's palette; clothes and armour are painted into the player layout by the add-on's own painter.
"""
import os, colorsys, functools
import numpy as np
from PIL import Image

DIR = os.path.join(os.path.dirname(__file__), "..", "data")
OVERRIDE = os.path.join(DIR, "skins")

# part -> (base uv, overlay uv, (w, h, d)) ; arm width 4 (classic) or 3 (slim)
def layout(slim=False):
    a = 3 if slim else 4
    return {
        "head": ((0, 0), (32, 0), (8, 8, 8)),
        "body": ((16, 16), (16, 32), (8, 12, 4)),
        "arm_r": ((40, 16), (40, 32), (a, 12, 4)),
        "arm_l": ((32, 48), (48, 48), (a, 12, 4)),
        "leg_r": ((0, 16), (0, 32), (4, 12, 4)),
        "leg_l": ((16, 48), (0, 48), (4, 12, 4)),
    }


def rects(u, v, w, h, d):
    """Vanilla box-UV face rectangles (same convention as the game and as core.Model.finalize)."""
    return {"east": (u, v + d, d, h), "north": (u + d, v + d, w, h), "west": (u + d + w, v + d, d, h),
            "south": (u + 2 * d + w, v + d, w, h), "up": (u + d, v, w, d), "down": (u + d + w, v, w, d)}


# which generated mobs are people (player model). value = slim arms (Alex) or classic (Steve)
PEOPLE = {k: False for k in (
    "royal_captain", "royal_knight", "dark_plate_knight", "elector_knight", "garithos_paladin", "heide_knight", "heide_hood_knight",
    "high_elf_spearman", "imperial_guard", "paladin_swordsman", "teutonic_cleric", "chival_warrior",
    "bandit_raider", "chaos_warrior", "norse_berserker", "norse_marauder", "norse_shaman", "skaal_villager", "wulfrik_champion",
    "sabertooth_rider", "santa_claus")}
PEOPLE["royal_queen"] = True

SPECS = {}          # key -> dict(pal, outfit, head, slim, seed)
_CACHE = {}


def register(key, **kw):
    SPECS.setdefault(key, {}).update(kw)
    _CACHE.pop(key, None)


def is_slim(img):
    a = np.asarray(img.convert("RGBA"))
    return a[20:32, 54:56, 3].max() == 0


def get_skin(key):
    """(64x64 RGBA image, slim) for a registered human."""
    if key in _CACHE: return _CACHE[key]
    p = os.path.join(OVERRIDE, key + ".png")
    if os.path.exists(p):
        im = Image.open(p).convert("RGBA")
        if im.size != (64, 64):
            raise ValueError(f"{p}: player skins must be 64x64, got {im.size}")
        res = (im, is_slim(im))
    else:
        sp = SPECS[key]
        res = (make_skin(sp["pal"], sp.get("outfit", {}), sp.get("head", {}), sp.get("slim", False), key), sp.get("slim", False))
    _CACHE[key] = res
    return res


def face_pixels(key, part, face, w, h, rows=None):
    """Pixels of one face of a body part, overlay composited over the base layer, resampled to (w, h)."""
    img, slim = get_skin(key)
    base_uv, over_uv, (pw, ph, pd) = layout(slim)[part]
    a = np.asarray(img).astype(float)
    x, y, fw, fh = rects(*base_uv, pw, ph, pd)[face]
    ox, oy, _, _ = rects(*over_uv, pw, ph, pd)[face]
    reg = a[y:y + fh, x:x + fw].copy()
    ov = a[oy:oy + fh, ox:ox + fw]
    al = ov[..., 3:4] / 255.0
    reg[..., :3] = reg[..., :3] * (1 - al) + ov[..., :3] * al
    reg[..., 3] = 255
    if rows is not None and face not in ("up", "down"):
        reg = reg[rows[0]:rows[1]]
    out = Image.fromarray(reg.astype(np.uint8))
    if out.size != (w, h):
        out = out.resize((w, h), Image.NEAREST)
    return np.asarray(out).copy()


# ------------------------------------------------------------------ generator
@functools.lru_cache(maxsize=None)
def _template(slim):
    return Image.open(os.path.join(DIR, "vanilla", "entity", ("alex" if slim else "steve") + ".png")).convert("RGBA")


def _classify(rgb, slim):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = rgb @ np.array([0.3, 0.59, 0.11])
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1)
    white = (mn > 215) & (sat < 0.12)
    if slim:
        iris = (g > r + 25) & (g > b + 15)
        hair = (sat > 0.5) & (r > g) & (g > b) & ~white
    else:
        iris = (b > r + 25)
        hair = (lum < 72) & ~iris
    skin = ~(white | iris | hair)
    return dict(white=white, iris=iris, hair=hair, skin=skin), lum


def _recolor(px, mask, lum, ramp, spread=0.9):
    from .core import ramp_at
    if not mask.any(): return
    mu = lum[mask].mean(); sd = lum[mask].std() or 1.0
    ys, xs = np.where(mask)
    for yy, xx in zip(ys, xs):
        px[yy, xx, :3] = ramp_at(ramp, 3.0 + spread * (lum[yy, xx] - mu) / sd)[:3]


def make_skin(pal, outfit, head, slim, key="x"):
    """Steve/Alex head + palette recolour, clothes painted by the add-on painter into the vanilla 64x64 layout."""
    from .core import paint_face, _hash
    out = np.zeros((64, 64, 4), np.uint8)
    tpl = np.asarray(_template(slim)).astype(float)
    L = layout(slim)
    seed = _hash(key, "skin")

    # ---- head: vanilla face, recoloured
    (hu, hv), _, (w, h, d) = L["head"]
    reg = tpl[hv:hv + 16, hu:hu + 32].copy()
    cls, lum = _classify(reg[..., :3], slim)
    for f in ("up", "south"):                                   # crown and back of the head are hair in the vanilla skins
        x, y, fw, fh = rects(0, 0, w, h, d)[f]
        cls["hair"][y:y + fh, x:x + fw] = True; cls["skin"][y:y + fh, x:x + fw] = False
        cls["iris"][y:y + fh, x:x + fw] = False; cls["white"][y:y + fh, x:x + fw] = False
    px = reg.copy()
    skin_slot = head.get("skin", "skin")
    if skin_slot in pal: _recolor(px, cls["skin"], lum, pal[skin_slot], 0.8)
    hair = head.get("hair")
    if hair and hair in pal: _recolor(px, cls["hair"], lum, pal[hair], 0.9)
    eyes = head.get("eyes")
    if eyes and eyes in pal and eyes not in ("dark",): _recolor(px, cls["iris"], lum, pal[eyes], 0.4)
    beard = head.get("beard")
    if beard and beard in pal:                                  # full beard: lower face + jaw sides
        from .core import ramp_at
        R_ = rects(hu, hv, w, h, d)
        for f in ("north", "east", "west"):
            x, y, fw, fh = R_[f]
            for yy in range(y + 5, y + fh):
                for xx in range(x, x + fw):
                    if f == "north" and yy == y + 6 and x + 3 <= xx <= x + 4: continue      # mouth stays visible
                    t = 3.0 + (0.5 if (xx + yy) % 3 == 0 else 0) - (0.6 if yy == y + fh - 1 else 0)
                    px[yy - hv, xx - hu, :3] = ramp_at(pal[beard], t)[:3]
    out[hv:hv + 16, hu:hu + 32] = px.astype(np.uint8)

    # ---- clothes: (part, row range, material) painted with the shared painter
    def M(slot, style, tone=3.0):
        return {"slot": slot if slot in pal else "armor", "style": style, "tone": tone, "asym": True}

    o = outfit
    chest = M(o.get("armor", "armor"), o.get("torso_style", "plate"), 3.0)
    cloth = M(o.get("cloth", "cloth"), "cloth", 2.6)
    leather = M(o.get("leather", "leather"), "leather", 2.4)
    sleeve = M(o.get("sleeves", o.get("cloth", "cloth")), o.get("arm_style", "cloth"), 2.9)
    legs = M(o.get("cloth", "cloth"), o.get("leg_style", "cloth"), 2.7)
    hand = leather if o.get("gauntlets", True) else M(skin_slot, "skin", 3.0)
    bare = M(skin_slot, "skin", 3.0)
    plan = {
        "body": [((0, 9), bare if o.get("torso_style") == "skin" else chest), ((9, 10), leather), ((10, 12), cloth)],
        "arm_r": [((0, 8), bare if o.get("arm_style") == "skin" else sleeve), ((8, 10), leather), ((10, 12), hand)],
        "leg_r": [((0, 7), legs), ((7, 12), leather if o.get("boots", True) else legs)],
    }
    plan["arm_l"] = plan["arm_r"]; plan["leg_l"] = plan["leg_r"]
    for part, bands in plan.items():
        (u, v), _, (w, h, d) = L[part]
        for face, (x, y, fw, fh) in rects(u, v, w, h, d).items():
            if face in ("up", "down"):
                mat = bands[0][1] if face == "up" else bands[-1][1]
                out[y:y + fh, x:x + fw] = paint_face(mat, face, fw, fh, pal, _hash(seed, part, face))
                continue
            for (r0, r1), mat in bands:
                tile = paint_face(mat, face, fw, h, pal, _hash(seed, part, face, r0))
                out[y + r0:y + r1, x:x + fw] = tile[r0:r1]
        if part == "body":                                      # collar and a centre seam give the vanilla-shirt read
            x, y, fw, fh = rects(u, v, w, h, d)["north"]
            out[y, x + 3:x + 5, :3] = (out[y, x + 3:x + 5, :3] * 0.6).astype(np.uint8)
    return Image.fromarray(out)
