"""Forge core: palettes, cube-model DSL, atlas packer, face painter, Bedrock exporter.

STYLE RULES (the "unified chunky style"):
  * all cube sizes are integers >= 1, 1 texel == 1 model unit == 1/16 block;
  * every face = flat ramp tone + 1px bevel (light top/left, dark bottom/right) + sparse structured detail;
  * every model uses the same ramp construction (cool shadows / warm lights) so palettes harmonise;
  * textures are painted left/right symmetric per face (safe whatever the engine's face orientation is);
  * no random noise: detail comes from small deterministic patterns only.
Coordinates are Bedrock FILE coordinates: +y up, front is -z, character's LEFT is +x.
"""
import colorsys, math, json, hashlib
from collections import OrderedDict
import numpy as np
from PIL import Image


# ------------------------------------------------------------------ colour
def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def make_ramp(base, n=6):
    """6 tones dark->light around `base` at index 3. Cool shadows, warm lights."""
    r, g, b = [c / 255 for c in (hex2rgb(base) if isinstance(base, str) else base)]
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    out = []
    for i in range(n):
        o = i - 3
        ll = l + o * (0.085 if o < 0 else 0.07)
        ll = min(max(ll, 0.04), 0.96)
        ss = min(1.0, s * (1 - 0.06 * o)) if s > 0.05 else s
        hh = h
        if s > 0.05:
            tgt = 0.68 if o < 0 else 0.12
            d = ((tgt - h + 0.5) % 1.0) - 0.5
            hh = (h + d * (0.045 * abs(o))) % 1.0
        rr, gg, bb = colorsys.hls_to_rgb(hh, ll, ss)
        out.append((int(rr * 255 + .5), int(gg * 255 + .5), int(bb * 255 + .5), 255))
    return out


class Palette(dict):
    """slot -> ramp. Slots are free-form (skin, armor, cloth, trim, metal, glow, ...)."""

    def __init__(self, **slots):
        super().__init__()
        for k, v in slots.items():
            self[k] = make_ramp(v)

    def with_(self, **slots):
        p = Palette()
        p.update(self)
        for k, v in slots.items():
            p[k] = make_ramp(v)
        return p


def ramp_at(ramp, f):
    f = min(max(f, 0), len(ramp) - 1)
    i = int(math.floor(f)); t = f - i
    if i >= len(ramp) - 1: return ramp[-1]
    a, b = ramp[i], ramp[i + 1]
    return tuple(int(a[k] * (1 - t) + b[k] * t + .5) for k in range(4))


# ------------------------------------------------------------------ painter
FACE_TONE = {"up": 0.8, "north": 0.0, "south": -0.35, "east": -0.15, "west": -0.15, "down": -1.3}


def _hash(*a):
    return int(hashlib.md5(repr(a).encode()).hexdigest()[:8], 16)


def paint_face(mat, face, w, h, pal, seed=0):
    """Return (h,w,4) uint8 array for one face. mat = dict(slot, style, tone, decals=[...])."""
    ramp = pal[mat.get("slot", "armor")]
    style = mat.get("style", "plate")
    tone = mat.get("tone", 3.0) + FACE_TONE[face]
    img = np.zeros((h, w, 4), np.uint8)
    base = ramp_at(ramp, tone)
    img[:, :] = base
    light = ramp_at(ramp, tone + 1.0)
    dark = ramp_at(ramp, tone - 1.0)
    dark2 = ramp_at(ramp, tone - 2.0)
    hi = ramp_at(ramp, tone + 2.0)

    def put(x, y, c):
        if 0 <= x < w and 0 <= y < h: img[y, x] = c

    # ---- style layer
    if style in ("plate", "metal"):
        if style == "metal":
            for y in range(h):
                t = tone + 0.6 - 1.3 * y / max(h - 1, 1)
                img[y, :] = ramp_at(ramp, t)
            if w >= 4 and h >= 4:
                for i in range(min(w, h) // 2):
                    put(1 + i, h - 2 - i if False else 1 + i, hi)
        if w >= 6 and h >= 6:
            for (x, y) in ((1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2)):
                put(x, y, hi if (x + y) % 2 == 0 else light)
    elif style == "cloth":
        for x in range(w):
            if (x // 2) % 2 == 1:
                img[:, x] = ramp_at(ramp, tone - 0.55)
        if h >= 5:
            img[h - 1, :] = dark
    elif style == "leather":
        if h >= 5:
            for x in range(0, w, 2): put(x, h // 2, dark)
        img[0, :] = light if h > 2 else img[0, :]
    elif style == "fur":
        for x in range(w):
            ph = (x * 5 + _hash(seed, x // 3) % 3) % 4
            ytop = 0 if h < 4 else ph % 2
            for y in range(h):
                if (y + x) % 4 == 0:
                    img[y, x] = ramp_at(ramp, tone + 0.6)
                elif (y * 2 + x) % 5 == 0:
                    img[y, x] = ramp_at(ramp, tone - 0.7)
        if h >= 4:
            for x in range(w):
                if x % 2 == 0: put(x, h - 1, dark)
    elif style == "scale":
        for y in range(h):
            for x in range(w):
                ox = x + (2 if (y // 2) % 2 else 0)
                if ox % 4 == 0 and y % 2 == 1: img[y, x] = dark
                elif ox % 4 in (1, 2) and y % 2 == 0: img[y, x] = light
    elif style == "rock":
        for y in range(h):
            for x in range(w):
                hv = _hash(seed, x // 2, y // 2) % 7
                if hv == 0: img[y, x] = dark
                elif hv == 1: img[y, x] = light
        # one structured crack
        if w >= 6 and h >= 6:
            cx = 2 + _hash(seed, "cx") % max(w - 4, 1)
            for y in range(h // 2, h):
                put(cx + (y % 2), y, dark2)
    elif style == "bone":
        for y in range(1, h, 4):
            if h > 3:
                for x in range(w): 
                    if (x + y) % 5: put(x, y, dark)
    elif style == "glow":
        img[:, :] = ramp_at(ramp, 4.0)
        if w >= 3 and h >= 3:
            img[1:h - 1, 1:w - 1] = ramp_at(ramp, 5.0)
        if w >= 5 and h >= 5:
            img[2:h - 2, 2:w - 2] = ramp_at(ramp, 5.0) * 0 + (255, 255, 255, 255) if False else ramp_at(ramp, 5.0)
    elif style == "flame":
        for y in range(h):
            t = tone - 1.0 + 3.0 * (1 - y / max(h - 1, 1))
            for x in range(w):
                tt = t + (0.7 if (x + y) % 3 == 0 else 0.0)
                img[y, x] = ramp_at(ramp, tt)
    elif style == "ice":
        for y in range(h):
            for x in range(w):
                if (x + y) % 6 == 0: img[y, x] = hi
                elif (x - y) % 7 == 0: img[y, x] = light
    elif style == "leaf":
        for y in range(h):
            for x in range(w):
                hv = _hash(seed, x // 2, y // 2) % 6
                if hv == 0: img[y, x] = dark
                elif hv == 1: img[y, x] = light
                elif hv == 2 and (x + y) % 3 == 0: img[y, x] = hi
    elif style == "skin":
        if h >= 4:
            img[h - 1, :] = ramp_at(ramp, tone - 0.5)
    elif style == "wood":
        for x in range(w):
            if x % 3 == 1: img[:, x] = ramp_at(ramp, tone - 0.6)
    elif style == "stripes":
        for y in range(h):
            if (y // 2) % 2 == 1: img[y, :] = ramp_at(ramp, tone + 0.8)
    # "flat" -> nothing

    # ---- bevel (skipped for glow/flame so they stay bright)
    if style not in ("glow", "flame") and w >= 3 and h >= 3 and not mat.get("nobevel"):
        img[0, :] = light
        img[:, 0] = light
        img[h - 1, :] = dark
        img[:, w - 1] = dark
        img[0, w - 1] = base
        img[h - 1, 0] = base
    elif style in ("glow",) and w >= 3 and h >= 3:
        img[0, :] = ramp_at(ramp, 3.0); img[h - 1, :] = ramp_at(ramp, 3.0)
        img[:, 0] = ramp_at(ramp, 3.0); img[:, w - 1] = ramp_at(ramp, 3.0)

    # ---- decals
    for d in mat.get("decals", ()):
        if d[0] != face and d[0] != "*":
            continue
        _decal(img, d[1], d[2:] , pal, w, h)
    # symmetry safety: mirror left half onto right half unless decal says asym
    if not mat.get("asym"):
        half = w // 2
        img[:, w - half:] = img[:, :half][:, ::-1]
    return img


def _decal(img, kind, args, pal, w, h):
    def put(x, y, c):
        if 0 <= x < w and 0 <= y < h: img[y, x] = c
    if kind == "eyes":      # ("eyes", slotname, y)
        slot = args[0] if args else "glow"; y = args[1] if len(args) > 1 else h // 2
        r = pal[slot]
        gap = max(1, w // 4)
        cx0 = w // 2 - gap - 1; cx1 = w // 2 + gap
        for cx in (cx0, cx1):
            for dx in (0, 1):
                put(cx + dx, y, r[5]); 
                if h > 6: put(cx + dx, y + 1, r[4])
        # brow
        d = pal["dark"] if "dark" in pal else pal[slot]
    elif kind == "visor":   # ("visor", y, height, slot)
        y = args[0]; hh = args[1] if len(args) > 1 else 1; slot = args[2] if len(args) > 2 else "dark"
        for yy in range(y, y + hh):
            for x in range(1, w - 1): put(x, yy, pal[slot][0])
    elif kind == "slit":    # glowing visor slit
        y = args[0]; slot = args[1] if len(args) > 1 else "glow"
        for x in range(1, w - 1): put(x, y, pal[slot][5])
    elif kind == "mouth":   # ("mouth", y, slot)
        y = args[0]; slot = args[1] if len(args) > 1 else "dark"
        for x in range(w // 2 - 2, w // 2 + 2): put(x, y, pal[slot][0])
        put(w // 2 - 2, y - 1, pal[slot][1]); put(w // 2 + 1, y - 1, pal[slot][1])
    elif kind == "teeth":
        y = args[0]; slot = args[1] if len(args) > 1 else "bone"
        for x in range(1, w - 1, 2): put(x, y, pal[slot][5]); put(x, y + 1, pal[slot][4])
    elif kind == "skull":   # skull emblem
        c = pal[args[0] if args else "bone"]; dk = pal["dark"][0] if "dark" in pal else c[0]
        cx = w // 2
        for dy in range(0, 3):
            for dx in range(-2, 2): put(cx + dx, h // 2 - 2 + dy, c[5] if dy < 3 else c[4])
        put(cx - 2, h // 2 - 1, dk); put(cx + 1, h // 2 - 1, dk)
        put(cx - 1, h // 2 + 1, c[4]); put(cx, h // 2 + 1, c[4])
        put(cx - 1, h // 2 + 2, dk); put(cx, h // 2 + 2, dk)
    elif kind == "stripe":  # ("stripe", y, height, slot, tone)
        y = args[0]; hh = args[1]; slot = args[2]; t = args[3] if len(args) > 3 else 3
        for yy in range(y, y + hh):
            for x in range(w): put(x, yy, pal[slot][int(t)])
    elif kind == "vstripe":  # ("vstripe", x, width, slot, tone)
        x0 = args[0]; ww = args[1]; slot = args[2]; t = args[3] if len(args) > 3 else 3
        for xx in range(x0, x0 + ww):
            for y in range(h): put(xx, y, pal[slot][int(t)])
            put(w - 1 - xx, 0, pal[slot][int(t)])
        for xx in range(x0, x0 + ww):
            for y in range(h): put(w - 1 - xx, y, pal[slot][int(t)])
    elif kind == "dot":     # ("dot", x, y, slot, tone)
        put(args[0], args[1], pal[args[2]][int(args[3])]); put(w - 1 - args[0], args[1], pal[args[2]][int(args[3])])
    elif kind == "cross":   # emblem cross
        slot = args[0]
        cx, cy = w // 2, h // 2
        for d in range(-2, 2):
            put(cx + d, cy, pal[slot][5]); put(cx, cy + d, pal[slot][5])
    elif kind == "rune":    # ("rune", slot)
        slot = args[0]; cx, cy = w // 2, h // 2
        for (dx, dy) in ((0, -2), (0, -1), (0, 0), (1, 1), (-1, 1), (0, 2)):
            put(cx + dx, cy + dy, pal[slot][5])
    elif kind == "chevrons":
        slot = args[0]
        for y0 in range(2, h - 2, 5):
            for x in range(1, w - 1):
                yy = y0 + abs(x - (w - 1) / 2.0) * 0.5
                put(x, int(yy), pal[slot][5])
    elif kind == "grate":   # forge grate / vents
        slot = args[0]
        for x in range(2, w - 2, 2):
            for y in range(2, h - 2): put(x, y, pal[slot][5] if y % 4 else pal[slot][3])
    elif kind == "crack":
        slot = args[0]
        x = w // 2
        for y in range(1, h - 1):
            put(x + ((y // 2) % 2), y, pal[slot][5])
    elif kind == "fill":     # ("fill", slot, tone)
        img[:, :] = pal[args[0]][int(args[1])]
    elif kind == "checker":
        slot = args[0]
        for y in range(h):
            for x in range(w):
                if (x // 2 + y // 2) % 2 == 0: img[y, x] = pal[slot][int(args[1])]
    elif kind == "gem":
        slot = args[0]; cx, cy = w // 2, h // 2
        for (dx, dy) in ((0, 0), (-1, 0), (0, -1), (-1, -1)):
            put(cx + dx, cy + dy, pal[slot][5])
        put(cx, cy, pal[slot][4]); put(cx - 1, cy - 1, (255, 255, 255, 255))


# ------------------------------------------------------------------ model
class Cube:
    __slots__ = ("o", "s", "mat", "rot", "pivot", "inflate", "uv", "key")

    def __init__(self, o, s, mat, rot=None, pivot=None, inflate=0):
        self.o, self.s, self.mat, self.rot, self.pivot, self.inflate = o, s, mat, rot, pivot, inflate
        self.uv = None
        self.key = None


class Model:
    def __init__(self, ident, pal):
        self.ident = ident
        self.pal = pal
        self.bones = OrderedDict()   # name -> dict(parent,pivot,rot,cubes)
        self.locators = {}

    def bone(self, name, parent=None, pivot=(0, 0, 0), rot=None):
        self.bones[name] = dict(parent=parent, pivot=list(pivot), rot=rot, cubes=[])
        return name

    def box(self, bone, o, s, mat=None, rot=None, pivot=None, **kw):
        """o = min corner (file coords), s = size (ints)."""
        if mat is None: mat = {}
        s = tuple(max(1, int(round(v))) for v in s)
        o = tuple(float(v) for v in o)
        m = dict(mat); m.update(kw)
        self.bones[bone]["cubes"].append(Cube(o, s, m, rot, pivot))

    def mbox(self, bone, o, s, mat=None, **kw):
        """Mirrored pair about x=0: o is the +x (char left) side cube; adds the -x twin."""
        self.box(bone, o, s, mat, **kw)

    # -------- packing & painting
    def _key(self, c):
        m = c.mat
        return (c.s, json.dumps(m, sort_keys=True, default=str))

    def finalize(self, tex_sizes=(64, 128, 256, 512, 1024), seed=0):
        cubes = []
        uniq = OrderedDict()
        for bn, b in self.bones.items():
            for c in b["cubes"]:
                c.key = self._key(c)
                uniq.setdefault(c.key, []).append(c)
        items = []
        for k, lst in uniq.items():
            s = lst[0].s
            w, h, d = s
            items.append((k, 2 * d + 2 * w, d + h, w, h, d))
        items.sort(key=lambda t: (-t[2], -t[1]))
        for size in tex_sizes:
            placed = self._pack(items, size)
            if placed is not None: break
        else:
            raise RuntimeError(f"{self.ident}: does not fit {tex_sizes[-1]}")
        self.tw = self.th = size
        tex = np.zeros((size, size, 4), np.uint8)
        for k, (u, v) in placed.items():
            lst = uniq[k]
            for c in lst: c.uv = (u, v)
            c = lst[0]
            w, h, d = c.s
            rects = {"east": (u, v + d, d, h), "north": (u + d, v + d, w, h), "west": (u + d + w, v + d, d, h),
                     "south": (u + 2 * d + w, v + d, w, h), "up": (u + d, v, w, d), "down": (u + d + w, v, w, d)}
            for face, (x, y, fw, fh) in rects.items():
                sd = _hash(self.ident, k[1][:40], face) & 0xffff
                tex[y:y + fh, x:x + fw] = paint_face(c.mat, face, fw, fh, self.pal, sd)
        self.texture = Image.fromarray(tex)
        return self.texture

    @staticmethod
    def _pack(items, size):
        shelves = []  # [y, h, xcursor]
        placed = {}
        for k, rw, rh, *_ in items:
            if rw > size or rh > size: return None
            for sh in shelves:
                if rh <= sh[1] and sh[2] + rw <= size:
                    placed[k] = (sh[2], sh[0]); sh[2] += rw; break
            else:
                y = (shelves[-1][0] + shelves[-1][1]) if shelves else 0
                if y + rh > size: return None
                shelves.append([y, rh, rw]); placed[k] = (0, y)
        return placed

    def geometry(self):
        bones = []
        xs = []; ys = []; zs = []
        for name, b in self.bones.items():
            bd = {"name": name}
            if b["parent"]: bd["parent"] = b["parent"]
            bd["pivot"] = b["pivot"]
            if b["rot"]: bd["rotation"] = b["rot"]
            cl = []
            for c in b["cubes"]:
                cd = {"origin": list(c.o), "size": list(c.s), "uv": list(c.uv)}
                if c.rot: cd["rotation"] = c.rot; cd["pivot"] = list(c.pivot if c.pivot else b["pivot"])
                cl.append(cd)
                xs += [c.o[0], c.o[0] + c.s[0]]; ys += [c.o[1], c.o[1] + c.s[1]]; zs += [c.o[2], c.o[2] + c.s[2]]
            if cl: bd["cubes"] = cl
            bones.append(bd)
        ext = max(max(abs(v) for v in xs), max(abs(v) for v in zs), max(ys)) if xs else 16
        vb = max(ext / 16.0 * 2.2, 2.0)
        geo = {"description": {"identifier": self.ident, "texture_width": self.tw, "texture_height": self.th,
                               "visible_bounds_width": round(vb * 2, 2), "visible_bounds_height": round(vb * 2, 2),
                               "visible_bounds_offset": [0, round(vb * 0.5, 2), 0]}, "bones": bones}
        return geo

    def cube_count(self):
        return sum(len(b["cubes"]) for b in self.bones.values())
