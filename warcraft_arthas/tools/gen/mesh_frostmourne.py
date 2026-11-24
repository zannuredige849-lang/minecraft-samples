"""Smooth high-detail Frostmourne built as a real mesh (not limited to Minecraft cubes).

Outputs
  models_mesh/frostmourne_hero.{glb,obj,mtl} + base/emissive PNGs   (any DCC tool / glTF viewer / Blender)
  resource_pack/models/entity/frostmourne_mesh.geo.json            (EXPERIMENTAL Bedrock poly_mesh geometry)
  resource_pack/textures/entity/frostmourne/frostmourne_mesh.png    (RGBA, alpha<255 = emissive)
Blade: lenticular cross-section with a raised rune ridge and a glowing fuller, serrated silhouette.
"""
import io, json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from meshlib import Mesh, sweep, sphere, cylinder, export_obj, export_glb, poly_mesh_json

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ATLAS = 512
RECT = {  # normalized uv rects (u0, v0, u1, v1) inside the 512 atlas
    "blade": (0.00, 0.00, 0.25, 1.00), "skull": (0.25, 0.00, 0.50, 0.25), "metal": (0.25, 0.25, 0.50, 0.50),
    "grip": (0.25, 0.50, 0.50, 0.75), "ice": (0.25, 0.75, 0.50, 1.00), "gem": (0.50, 0.00, 0.75, 0.25),
}
GRIP = np.array([0.0, 14.0, 0.0])
Y0, Y1, MAXHW, T = 6.0, 30.3, 3.5, 0.75
KEYS = [(6, 2.1), (8, 2.4), (11, 2.6), (16, 2.4), (21, 2.1), (25, 1.6), (28, 0.9), (30.3, 0.0)]
TEETH = (12.0, 16.5, 21.0)


def hw(y):
    base = float(np.interp(y, [k[0] for k in KEYS], [k[1] for k in KEYS]))
    for ty in TEETH:
        d = y - ty
        if 0 <= d < 1.9:
            base += 0.6 * (1 - d / 1.9)
    return base


def rot_z(deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0, 0], [s, c, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1.0]])


def trans(x, y, z):
    M = np.eye(4); M[:3, 3] = (x, y, z); return M


def build_blade():
    xs = np.array([-1, -0.55, -0.24, -0.09, 0.09, 0.24, 0.55, 1.0])
    zs = np.array([0, 0.38, 0.72, 0.50, 0.50, 0.72, 0.38, 0.0]) * T
    ys = np.unique(np.concatenate([np.arange(Y0, Y1, 0.2), [Y1], [t - 0.001 for t in TEETH], list(TEETH)]))
    R, Cc = len(ys), len(xs)
    P = np.zeros((R, Cc, 3)); UV = np.zeros((R, Cc, 2))
    u0, v0, u1, v1 = RECT["blade"]
    for i, y in enumerate(ys):
        h = hw(y)
        for j in range(Cc):
            P[i, j] = (xs[j] * h, y, -zs[j])
            UV[i, j] = (u0 + (u1 - u0) * ((xs[j] * h / MAXHW + 1) / 2), v0 + (v1 - v0) * ((Y1 - y) / (Y1 - Y0)))
    front = Mesh().grid(P, UV, flip=True)
    Pb = P.copy(); Pb[:, :, 2] *= -1
    back = Mesh().grid(Pb, UV, flip=False)
    front.merge(back)
    return front


def path_frame(pts, wscale, tscale):
    pts = [np.array(p, float) for p in pts]
    out = []
    for i, p in enumerate(pts):
        t = pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]
        t /= max(np.linalg.norm(t), 1e-9)
        n = np.array([-t[1], t[0], 0.0]); b = np.array([0, 0, 1.0])
        k = i / (len(pts) - 1)
        out.append((p, t, n, b, wscale(k), tscale(k)))
    return out


def bezier(p0, p1, p2, p3, n=26):
    ts = np.linspace(0, 1, n)
    return [((1 - t) ** 3) * np.array(p0) + 3 * ((1 - t) ** 2) * t * np.array(p1) + 3 * (1 - t) * t * t * np.array(p2) + t ** 3 * np.array(p3) for t in ts]


def build_all():
    m = Mesh()
    m.merge(build_blade())
    diamond = [(1, 0), (0, 1), (-1, 0), (0, -1)]
    metal = RECT["metal"]
    for s in (-1, 1):
        prongs = [
            ((1.4, 4.4, 0), (4.6, 3.6, 0), (8.0, 5.2, 0), (9.3, 10.2, 0), 0.95, 0.55),   # main wing: sweeps out, hooks up
            ((1.6, 3.4, 0), (3.6, 2.4, 0), (5.4, 1.4, 0), (6.2, -0.8, 0), 0.6, 0.4),       # lower barb
        ]
        for p0, p1, p2, p3, w0, t0 in prongs:
            pts = [(s * x, y, z) for x, y, z in bezier(p0, p1, p2, p3)]
            fr = path_frame(pts, lambda k, w0=w0: w0 * (1 - k) ** 0.9 + 0.05, lambda k, t0=t0: t0 * (1 - k) ** 0.8 + 0.06)
            m.merge(sweep(fr, diamond, metal, flip=(s > 0)))
    m.merge(sphere((0, 4.7, 0), (1.9, 1.6, 1.35), RECT["skull"], 20, 14))                   # skull
    m.merge(sphere((0, 5.0, -1.2), (0.5, 0.5, 0.35), RECT["gem"], 10, 8))                    # soul gem on the brow
    m.merge(cylinder((0, 3.0, 0), 1.45, 0.7, metal, 12, 2))                                  # guard collar
    m.merge(cylinder((0, -5.0, 0), 0.92, 8.0, RECT["grip"], 12, 6))                          # grip
    for y in (-3.6, -0.8, 2.0):
        m.merge(cylinder((0, y, 0), 1.2, 0.5, metal, 12, 2))
    m.merge(sphere((0, -6.4, 0), (1.35, 1.2, 1.35), metal, 14, 10))                          # pommel
    m.merge(cylinder((0, -11.0, 0), 1.0, 3.6, metal, 8, 3, taper=(0.0, 1.0)))                # pommel point
    # frost crystals on the edges
    for y, side, ang in ((13.0, 1, 30), (20.0, -1, 30), (24.5, 1, 26), (17.5, -1, 24)):
        c = cylinder((0, 0, 0), 0.5, 3.2, RECT["ice"], 6, 3, taper=(1.0, 0.05))
        c.transform(trans(side * (hw(y) + 0.05), y, 0) @ rot_z(-side * ang))
        m.merge(c)
    m.transform(trans(*GRIP))
    return m


# ------------------------------------------------------------------ textures
def paint_atlas(phase=1):
    A = np.zeros((ATLAS, ATLAS, 4), np.float32)
    rs = np.random.RandomState(11)
    glow_a = {1: 90, 2: 62, 3: 38}[phase]
    px = lambda key: tuple(int(round(v * ATLAS)) for v in RECT[key])

    # ---- blade (128 x 512)
    x0, y0, x1, y1 = px("blade"); W, H = x1 - x0, y1 - y0
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    xr = ((xx + 0.5) / W * 2 - 1) * MAXHW
    yl = Y1 - (yy + 0.5) / H * (Y1 - Y0)
    hwv = np.vectorize(hw)(yl)
    d_edge = hwv - np.abs(xr)
    rel = np.clip(d_edge / np.maximum(hwv, 0.2), 0, 1)
    base = np.array([44, 56, 80], np.float32)
    col = base[None, None, :] * (0.85 + 0.9 * rel[..., None] * 0.5) + np.array([6, 10, 18], np.float32) * (yl[..., None] - 6) / 24
    col *= (0.96 + 0.08 * (rs.rand(H, W)[..., None]))
    edge = np.clip(1 - d_edge / 0.45, 0, 1)[..., None]
    col = col * (1 - 0.92 * edge) + np.array([214, 232, 247], np.float32) * 0.92 * edge
    bevel = np.clip(1 - np.abs(d_edge - 0.55) / 0.12, 0, 1)[..., None]
    col = col * (1 - 0.3 * bevel) + np.array([8, 12, 22], np.float32) * 0.3 * bevel
    rgba = np.concatenate([col, np.full((H, W, 1), 255, np.float32)], -1)
    # fuller glow (centre groove) + rune glyphs on the flats
    glow = Image.new("L", (W, H), 0); gd = ImageDraw.Draw(glow)
    cx = W // 2
    gd.line([(cx, 4), (cx, H - 2)], fill=255, width=2)
    glyphs = [[((.5, 0), (.5, 1)), ((.5, .5), (.95, .22)), ((.5, .78), (.05, .55))],
              [((.2, 0), (.2, 1)), ((.2, .3), (.85, .08)), ((.2, .7), (.85, .92))],
              [((.5, 0), (.5, 1)), ((.1, .3), (.9, .3)), ((.2, .82), (.8, .82))],
              [((.1, .05), (.5, .5)), ((.9, .05), (.5, .5)), ((.5, .5), (.5, 1))],
              [((.3, 0), (.3, 1)), ((.7, 0), (.7, 1)), ((.3, .5), (.7, .5))]]
    unit_y = H / (Y1 - Y0); unit_x = W / (2 * MAXHW)
    gy, k = 8.2, 0
    while gy < Y1 - 4.5:
        side = -1 if k % 2 == 0 else 1
        glyph = glyphs[(k * 3 + 1) % len(glyphs)]
        gh, gw = 2.7 * unit_y, 1.15 * unit_x
        gx0 = cx + side * (hw(gy) * 0.62) * unit_x - gw / 2
        ytop = (Y1 - (gy + 2.7)) * unit_y
        for (a, b) in glyph:
            gd.line([(gx0 + a[0] * gw, ytop + a[1] * gh), (gx0 + b[0] * gw, ytop + b[1] * gh)], fill=255, width=2)
        gy += 3.6; k += 1
    halo = glow.filter(ImageFilter.GaussianBlur(2.2))
    g = np.asarray(glow, np.float32) / 255; h = np.asarray(halo, np.float32) / 255
    inside = (d_edge > 0.25).astype(np.float32)
    g *= inside; h *= inside
    blue, white = np.array([70, 205, 255], np.float32), np.array([235, 252, 255], np.float32)
    rgba[..., :3] = rgba[..., :3] * (1 - np.clip(h * 0.8, 0, 1)[..., None]) + blue * np.clip(h * 0.8, 0, 1)[..., None]
    rgba[..., :3] = rgba[..., :3] * (1 - g[..., None]) + white * g[..., None]
    rgba[..., 3] = np.where(h > 0.12, 255 - (255 - glow_a) * np.clip(h * 1.1 + g, 0, 1), 255)
    A[y0:y1, x0:x1] = rgba

    def fill(key, fn):
        a, b, c, d = px(key); h_, w_ = d - b, c - a
        Y, X = np.mgrid[0:h_, 0:w_].astype(np.float32); U, V = (X + 0.5) / w_, (Y + 0.5) / h_
        A[b:d, a:c] = fn(U, V, h_, w_)

    def metal(U, V, h_, w_):
        c = np.array([34, 42, 62], np.float32) * (1 - V[..., None]) + np.array([86, 104, 138], np.float32) * V[..., None]
        c *= 0.95 + 0.1 * rs.rand(h_, w_)[..., None]
        c = np.where((np.abs(U - 0.5) < 0.012)[..., None], np.array([140, 170, 205], np.float32), c)  # ridge highlight
        return np.concatenate([c, np.full((h_, w_, 1), 255, np.float32)], -1)

    def grip(U, V, h_, w_):
        wrap = (((U * 6 + V * 14) % 1.0) < 0.55).astype(np.float32)
        c = np.array([24, 20, 28], np.float32) * (0.7 + 0.5 * wrap[..., None]) + np.array([0, 6, 14], np.float32) * wrap[..., None]
        return np.concatenate([c, np.full((h_, w_, 1), 255, np.float32)], -1)

    def ice(U, V, h_, w_):
        c = np.array([236, 250, 255], np.float32) * (1 - V[..., None]) + np.array([130, 200, 245], np.float32) * V[..., None]
        c = np.where((np.abs(U - 0.5) < 0.02)[..., None], np.array([255, 255, 255], np.float32), c)
        a = np.clip(120 + 100 * V, 80, 230)[..., None]
        return np.concatenate([c, a], -1)

    def gem(U, V, h_, w_):
        r = np.hypot(U - 0.5, V - 0.5) * 2
        c = np.array([80, 215, 255], np.float32) * (1 - r[..., None] * 0.6) + np.array([240, 255, 255], np.float32) * np.clip(1 - r * 2.2, 0, 1)[..., None]
        a = np.clip(glow_a + r * 70, 20, 200)[..., None]
        return np.concatenate([c, a], -1)

    def skull(U, V, h_, w_):
        bone = np.array([208, 214, 212], np.float32)
        c = bone[None, None, :] * (0.78 + 0.3 * (1 - V[..., None])) * np.ones((h_, w_, 3), np.float32)
        a = np.full((h_, w_), 255, np.float32)
        for cxx in (0.355, 0.645):
            sock = (((U - cxx) / 0.115) ** 2 + ((V - 0.46) / 0.13) ** 2) <= 1
            c[sock] = (8, 12, 22)
            inner = (((U - cxx) / 0.055) ** 2 + ((V - 0.465) / 0.065) ** 2) <= 1
            c[inner] = (110, 230, 255); a[inner] = glow_a
        nose = (np.abs(U - 0.5) < 0.04 * (1 + (V - 0.58) * 3)) & (V > 0.56) & (V < 0.68)
        c[nose] = (30, 36, 46)
        crack = (np.abs((U - 0.5) * 0.4 - (V - 0.12) * 0.2 * ((U > 0.5) * 2 - 1)) < 0.004) & (V < 0.3)
        c[crack] = (70, 78, 86)
        teeth = (V > 0.8) & (V < 0.92) & (np.abs(U - 0.5) < 0.22)
        c[teeth & ((np.floor(U * w_ / 2.5) % 2) == 0)] = (44, 50, 58)
        c[teeth & ((np.floor(U * w_ / 2.5) % 2) == 1)] = (190, 196, 196)
        return np.concatenate([c, a[..., None]], -1)

    fill("metal", metal); fill("grip", grip); fill("ice", ice); fill("gem", gem); fill("skull", skull)
    return Image.fromarray(np.clip(A, 0, 255).astype(np.uint8), "RGBA")


def png_bytes(im):
    b = io.BytesIO(); im.save(b, "PNG"); return b.getvalue()


def main():
    mesh = build_all()
    tex = paint_atlas(1)
    out = os.path.join(ROOT, "models_mesh"); os.makedirs(out, exist_ok=True)
    arr = np.asarray(tex, np.float32)
    base = Image.fromarray(np.concatenate([arr[..., :3], np.full(arr.shape[:2] + (1,), 255, np.float32)], -1).astype(np.uint8), "RGBA").convert("RGB")
    glowk = np.clip((255 - arr[..., 3]) / 195.0, 0, 1)[..., None]
    emis = Image.fromarray(np.clip(arr[..., :3] * glowk, 0, 255).astype(np.uint8), "RGB")
    base.save(os.path.join(out, "frostmourne_hero_base.png")); emis.save(os.path.join(out, "frostmourne_hero_emissive.png"))
    export_glb(mesh, os.path.join(out, "frostmourne_hero.glb"), png_bytes(base), png_bytes(emis))
    export_obj(mesh, os.path.join(out, "frostmourne_hero.obj"), "frostmourne_hero.mtl", "frostmourne_hero_base.png", "frostmourne_hero_emissive.png", scale=1 / 16)
    # experimental Bedrock poly_mesh geometry + RGBA texture (alpha<255 = emissive)
    tex.save(os.path.join(ROOT, "resource_pack/textures/entity/frostmourne/frostmourne_mesh.png"), optimize=True)
    geo = {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": "geometry.warcraft_frostmourne_mesh", "texture_width": ATLAS, "texture_height": ATLAS,
                        "visible_bounds_width": 2, "visible_bounds_height": 3.4, "visible_bounds_offset": [0, 1.4, 0]},
        "bones": [
            {"name": "root", "pivot": [0, 0, 0]},
            {"name": "frostmourne", "parent": "root", "pivot": GRIP.tolist(),
             "locators": {"grip": GRIP.tolist(), "sword_tip": [0, 14 + Y1, 0], "guard": [0, 18.5, 0]},
             "poly_mesh": poly_mesh_json(mesh)}]}]}
    with open(os.path.join(ROOT, "resource_pack/models/entity/frostmourne_mesh.geo.json"), "w") as f:
        json.dump(geo, f, separators=(",", ":")); f.write("\n")
    print(f"mesh: {len(mesh.pos)} verts, {len(mesh.tri)} tris")


if __name__ == "__main__":
    main()
