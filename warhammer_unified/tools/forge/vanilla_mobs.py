"""Mobs rebuilt on vanilla Minecraft models (v10.11): the bears use Mojang's polar bear geometry cube for cube.

* grizzly bear  - vanilla polar bear model + the vanilla polar bear texture, its pixels recoloured to grizzly brown
* skeleton bear - the same model dressed with the vanilla skeleton texture: skull on the head, ribcage on the body,
                  leg bones on the legs; the gaps between the bones are dark (the inside of the carcass)
The body of a vanilla quadruped is modelled standing up and turned 90 degrees by the engine; here that turn is baked
into the body cubes (cube rotation about the vanilla body pivot), so the add-on's own walk/attack animations still work.
"""
import os, functools
import numpy as np
from PIL import Image
from .core import Model, Palette, make_ramp, ramp_at, hex2rgb

DIR = os.path.join(os.path.dirname(__file__), "..", "data", "vanilla", "entity")

# vanilla geometry.polarbear (bedrock-samples): bone -> (pivot, [(origin, size, uv)])
POLAR = {
    "body": ((-2.0, 15.0, 12.0), [((-7.0, 14.0, 5.0), (14, 14, 11), (0, 19)), ((-6.0, 28.0, 5.0), (12, 12, 10), (39, 0))]),
    "head": ((0.0, 14.0, -16.0), [((-3.5, 10.0, -19.0), (7, 7, 7), (0, 0)), ((-2.5, 10.0, -22.0), (5, 3, 3), (0, 44)),
                                 ((-4.5, 16.0, -17.0), (2, 2, 1), (26, 0)), ((2.5, 16.0, -17.0), (2, 2, 1), (26, 0))]),
    "leg_br": ((-4.5, 10.0, 6.0), [((-6.5, 0.0, 4.0), (4, 10, 8), (50, 22))]),     # vanilla leg0
    "leg_bl": ((4.5, 10.0, 6.0), [((2.5, 0.0, 4.0), (4, 10, 8), (50, 22))]),       # leg1
    "leg_fr": ((-3.5, 10.0, -8.0), [((-5.5, 0.0, -10.0), (4, 10, 6), (50, 40))]),  # leg2
    "leg_fl": ((3.5, 10.0, -8.0), [((1.5, 0.0, -10.0), (4, 10, 6), (50, 40))]),    # leg3
}

# where each part of the skeleton bear takes its pixels from on the vanilla skeleton texture (box uv, dims)
SKEL_SRC = {"body": ((16, 16), (8, 12, 4)), "head": ((0, 0), (8, 8, 8)), "leg": ((0, 16), (2, 12, 2)), "arm": ((40, 16), (2, 12, 2))}


def rects(u, v, w, h, d):
    return {"east": (u, v + d, d, h), "north": (u + d, v + d, w, h), "west": (u + d + w, v + d, d, h),
            "south": (u + 2 * d + w, v + d, w, h), "up": (u + d, v, w, d), "down": (u + d + w, v, w, d)}


@functools.lru_cache(maxsize=None)
def _img(name):
    return np.asarray(Image.open(os.path.join(DIR, name + ".png")).convert("RGBA")).astype(float)


def vbox_pixels(mat, face, w, h):
    """Paint one face of a cube that carries vanilla pixels (material style 'vbox')."""
    src = _img(mat["vimg"])
    u, v = mat["uv"]; dw, dh, dd = mat["dims"]
    x, y, fw, fh = rects(u, v, dw, dh, dd)[mat.get("srcface", face)]
    reg = src[y:y + fh, x:x + fw].copy()
    if mat.get("recolor"):                          # luminance of the vanilla pixels -> ramp of the new colour
        ramp = make_ramp(mat["recolor"])
        lum = reg[..., :3] @ np.array([0.3, 0.59, 0.11])
        for yy in range(reg.shape[0]):
            for xx in range(reg.shape[1]):
                if lum[yy, xx] < 70:                # nose, eyes, claws stay dark
                    continue
                reg[yy, xx, :3] = ramp_at(ramp, 0.6 + 3.3 * lum[yy, xx] / 255.0)[:3]
    if mat.get("hollow"):                           # transparent gaps between bones = the dark inside of the carcass
        hc = np.array(hex2rgb(mat["hollow"]), float)
        a = reg[..., 3:4] / 255.0
        reg[..., :3] = reg[..., :3] * a + hc * (1 - a)
    reg[..., 3] = 255
    out = Image.fromarray(reg.astype(np.uint8))
    if out.size != (w, h): out = out.resize((w, h), Image.NEAREST)
    return np.asarray(out).copy()


def polar_bear_model(ident, pal, skin):
    """skin(bone, cube_index, size, uv) -> material dict."""
    m = Model(ident, pal)
    m.bone("root", None, (0, 0, 0))
    bp = POLAR["body"][0]
    m.bone("body", "root", bp)
    for bn in ("head", "leg_br", "leg_bl", "leg_fr", "leg_fl"):
        m.bone(bn, "body", POLAR[bn][0])
    for bn, (piv, cubes) in POLAR.items():
        for i, (o, s, uv) in enumerate(cubes):
            mat = skin(bn, i, s, uv)
            if bn == "body":   # the engine's 90 degree quadruped turn, baked into the cube
                m.box(bn, o, s, mat, rot=[90, 0, 0], pivot=list(bp))
            else:
                m.box(bn, o, s, mat)
    return m


def grizzly(ident, pal):
    return polar_bear_model(ident, pal, lambda bn, i, s, uv: {"slot": "fur", "style": "vbox", "vimg": "polarbear", "uv": list(uv),
                                                              "dims": list(s), "recolor": "#7a5232", "asym": True})


def skeleton_bear(ident, pal):
    def skin(bn, i, s, uv):
        part = "head" if bn == "head" else ("body" if bn == "body" else "leg")
        if bn == "head" and i >= 2: part = "arm"            # ears: small bone knobs
        (u, v), dims = SKEL_SRC[part]
        mat = {"slot": "bone", "style": "vbox", "vimg": "skeleton", "uv": [u, v], "dims": list(dims), "hollow": "#3b3631",
               "asym": True, "part": f"{bn}{i}"}
        if bn == "body": mat["srcface"] = "north"         # the ribcage on every side of the lying body
        return mat
    return polar_bear_model(ident, pal, skin)
