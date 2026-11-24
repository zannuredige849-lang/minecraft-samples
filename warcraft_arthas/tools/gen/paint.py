"""Procedural texture painter for the Arthas / Frostmourne layers.

Alpha convention (verified against the Bedrock wiki "Glowing Entity Texture"):
  alpha 255 -> normal pixel, alpha 1..254 -> emissive (lower = brighter glow),
  alpha 0   -> fully transparent.   Material used in-game: entity_emissive_alpha.
"""
from __future__ import annotations
import math
import zlib
import numpy as np
from PIL import Image
from spec_lib import face_rects
from frostmourne_spec import BLADE_SEGS

FACE_LIGHT = {"up": 1.16, "north": 1.0, "east": 0.84, "west": 0.9, "south": 0.74, "down": 0.55}

PHASE = {
    1: dict(eye=(150, 228, 255), eye_a=80, frost=0.30, seam=0.0, crack=0.0, rune_a=95, rune=0.8, hue=0.0),
    2: dict(eye=(110, 238, 255), eye_a=52, frost=0.60, seam=0.8, crack=0.0, rune_a=70, rune=1.0, hue=0.1),
    3: dict(eye=(215, 248, 255), eye_a=30, frost=0.95, seam=1.0, crack=1.0, rune_a=45, rune=1.25, hue=0.2),
}

C = lambda r, g, b: np.array([r, g, b], dtype=np.float32)
STEEL_DARK, STEEL_MID, STEEL_HI = C(14, 18, 30), C(40, 50, 72), C(140, 170, 205)
TRIM_MID, TRIM_HI = C(66, 82, 110), C(190, 218, 242)
CLOTH_DARK, CLOTH_MID = C(18, 24, 44), C(30, 42, 78)
CAPE_MID, CAPE_HI, CAPE_LINE = C(24, 36, 80), C(52, 78, 140), C(150, 200, 235)
ICE_BASE, ICE_HI = C(150, 215, 250), C(235, 250, 255)
GLOW_BLUE, GLOW_WHITE = C(90, 215, 255), C(235, 252, 255)


# ----------------------------------------------------------------------- noise
def vnoise(h, w, cell, seed):
    gh, gw = max(2, h // max(1, cell) + 2), max(2, w // max(1, cell) + 2)
    g = np.random.RandomState(seed).rand(gh, gw).astype(np.float32)
    im = Image.fromarray((g * 255).astype(np.uint8)).resize((gw * cell, gh * cell), Image.BICUBIC)
    return np.asarray(im, dtype=np.float32)[:h, :w] / 255.0


def fbm(h, w, seed, cells=(8, 4, 2)):
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for i, c in enumerate(cells):
        out += amp * vnoise(h, w, c, seed + i * 17)
        tot += amp
        amp *= 0.5
    return out / tot


class Face:
    """A face rectangle with helpers; arrays are (h, w[, 3|4])."""

    def __init__(self, cube, name, rect, S, seed, phase):
        x, y, w, h = rect
        self.cube, self.name, self.S, self.phase = cube, name, S, phase
        self.x, self.y = int(round(x * S)), int(round(y * S))
        self.w, self.h = int(round(w * S)), int(round(h * S))
        self.seed = seed
        self.p = PHASE[phase]
        yy, xx = np.mgrid[0:self.h, 0:self.w].astype(np.float32)
        self.xx, self.yy = xx, yy
        self.U, self.V = (xx + 0.5) / self.w, (yy + 0.5) / self.h
        self.dl, self.dr = xx, self.w - 1 - xx
        self.dt, self.db = yy, self.h - 1 - yy
        self.dmin = np.minimum(np.minimum(self.dl, self.dr), np.minimum(self.dt, self.db))
        self.rgb = np.zeros((self.h, self.w, 3), np.float32)
        self.a = np.full((self.h, self.w), 255, np.float32)
        self.light = FACE_LIGHT.get(name, 1.0)
        self.n = fbm(self.h, self.w, seed)

    def fill(self, col):
        self.rgb[:] = col

    def lerp_v(self, c0, c1):
        t = self.V[..., None]
        self.rgb[:] = c0 * (1 - t) + c1 * t

    def glow(self, mask, col, alpha, strength=1.0):
        m = np.clip(mask, 0, 1)
        self.rgb[:] = self.rgb * (1 - m[..., None]) + col * m[..., None]
        self.a[:] = np.where(m > 0.05, self.a * (1 - m) + alpha * m, self.a)

    def bevel(self, hi, lo, width=None, strength=0.5):
        b = width or max(1, int(self.S * 0.5))
        top = np.clip(1 - self.dt / b, 0, 1) * (self.dt < b)
        left = np.clip(1 - self.dl / b, 0, 1) * (self.dl < b)
        bot = np.clip(1 - self.db / b, 0, 1) * (self.db < b)
        right = np.clip(1 - self.dr / b, 0, 1) * (self.dr < b)
        hi_m = np.maximum(top, left)[..., None] * strength
        lo_m = np.maximum(bot, right)[..., None] * strength
        self.rgb[:] = self.rgb * (1 - hi_m) + hi * hi_m
        self.rgb[:] = self.rgb * (1 - lo_m) + lo * lo_m

    def line(self, cond, col, k=1.0):
        m = cond.astype(np.float32)[..., None] * k
        self.rgb[:] = self.rgb * (1 - m) + col * m

    def rivet(self, cx, cy, r=None):
        r = r or max(1.0, self.S * 0.6)
        d = np.hypot(self.xx - cx, self.yy - cy)
        m = (d <= r)[..., None].astype(np.float32)
        sh = ((np.hypot(self.xx - cx - 0.7, self.yy - cy - 0.7) <= r)[..., None]).astype(np.float32)
        self.rgb[:] = self.rgb * (1 - sh * 0.5)
        self.rgb[:] = self.rgb * (1 - m) + TRIM_HI * 0.8 * m

    def world(self):
        """3D position (X, Y, Z) of every pixel of this face in geometry space."""
        ox, oy, oz = self.cube.origin
        sx, sy, sz = self.cube.size
        U, V, n = self.U, self.V, self.name
        Y = oy + sy - V * sy
        if n == "north":
            return ox + U * sx, Y, np.full_like(U, oz)
        if n == "south":
            return ox + sx - U * sx, Y, np.full_like(U, oz + sz)
        if n == "east":
            return np.full_like(U, ox), Y, oz + sz - U * sz
        if n == "west":
            return np.full_like(U, ox + sx), Y, oz + U * sz
        Yc = np.full_like(U, oy + (sy if n == "up" else 0))
        return ox + U * sx, Yc, oz + sz - V * sz

    def frost_speckle(self, amount, top_bias=True):
        """Rime that gathers on upper edges / upward faces, plus a few sparkles."""
        if amount <= 0:
            return
        n = self.n
        if self.name == "up":
            cover = np.clip((n - (0.82 - amount * 0.5)) * 7, 0, 1)
        elif top_bias:
            depth = amount * self.S * 2.6 * (0.3 + n * 1.3)
            cover = np.clip((depth - self.dt) / max(1.0, self.S * 0.8), 0, 1)
        else:
            cover = np.clip((n - (0.9 - amount * 0.4)) * 6, 0, 1)
        side = np.clip(1 - np.minimum(self.dl, self.dr) / (self.S * 1.5), 0, 1) * np.clip((n - 0.62) * 4, 0, 1) * amount
        cover = np.clip(cover + side, 0, 0.85)
        self.rgb[:] = self.rgb * (1 - 0.75 * cover[..., None]) + (ICE_HI * 0.9 + 10) * 0.75 * cover[..., None]
        rs = np.random.RandomState(self.seed + 5)
        sp = (rs.rand(self.h, self.w) > 1 - 0.012 * amount) & (cover > 0.2)
        self.rgb[sp] = 255

    def finish(self, canvas):
        rgb = np.clip(self.rgb * self.light, 0, 255)
        # emissive pixels (alpha<255) keep full brightness
        emis = (self.a < 250)[..., None]
        rgb = np.where(emis, np.clip(self.rgb, 0, 255), rgb)
        out = np.concatenate([rgb, self.a[..., None]], -1)
        canvas[self.y:self.y + self.h, self.x:self.x + self.w] = out


# ------------------------------------------------------------------- materials
def m_plate(f: Face, trim=False, spike=False):
    base_lo, base_hi = (TRIM_MID * 0.5, TRIM_MID) if trim else (STEEL_DARK, STEEL_MID)
    brushed = fbm(f.h, f.w, f.seed + 3, (max(1, f.S * 6), 1))
    f.lerp_v(base_hi, base_lo)
    f.rgb[:] *= (0.82 + 0.30 * f.n[..., None]) * (0.94 + 0.12 * brushed[..., None])
    f.rgb[:] += np.array([0, 3, 8], np.float32) * f.n[..., None]
    if spike:
        # smooth tapered horn: darker root, brighter tip, one soft ridge
        tip = (1 - f.V)[..., None]
        f.rgb[:] = f.rgb * (0.7 + 0.55 * tip) + C(30, 40, 60) * 0.25 * tip
        ridge = np.clip(1 - np.abs(f.U - 0.5) / 0.22, 0, 1)[..., None]
        f.rgb[:] = f.rgb * (1 - 0.35 * ridge) + STEEL_HI * 0.35 * ridge * (0.5 + 0.5 * tip)
    f.bevel(TRIM_HI if trim else STEEL_HI, STEEL_DARK * 0.5, width=max(1, int(f.S * 0.5)), strength=0.4 if not spike else 0.2)
    det = f.cube.detail
    if det == "plate_fluted" and f.name in ("north", "south", "up") and f.w >= 5 * f.S:
        fl = (0.5,) if f.w < 9 * f.S else (0.33, 0.67)
        for fx in fl:
            f.line(np.abs(f.U - fx) < (0.5 / f.w * f.S), STEEL_DARK * 0.5, 0.9)
            f.line(np.abs(f.U - fx - 1.0 / f.w * f.S) < 0.5 / f.w * f.S, STEEL_HI, 0.35)
    if det == "plate_lame" and f.name in ("north", "south"):
        f.line(f.dt < max(1, f.S * 0.5), STEEL_DARK * 0.4, 0.8)
        f.line((f.dt >= max(1, f.S * 0.5)) & (f.dt < f.S * 1.1), STEEL_HI, 0.22)
        if f.w >= 10 * f.S:
            for cx in range(int(f.S * 3), f.w - int(f.S * 2), int(f.S * 8)):
                f.rivet(cx, f.h * 0.5, f.S * 0.45)
    # phase effects ---------------------------------------------------------------
    p = f.p
    if p["seam"] > 0 and det in ("plate_fluted", "plate_lame") and f.w >= 5 * f.S:
        seam = (np.abs(f.U - 0.5) < 0.5 / f.w * f.S) if det == "plate_fluted" else (f.dt == int(f.S * 0.5))
        f.glow(seam.astype(np.float32) * p["seam"], GLOW_BLUE, p["rune_a"] + 40)
    if p["crack"] > 0 and f.name == "north" and f.w >= 6 * f.S and f.h >= 4 * f.S:
        rs = np.random.RandomState(f.seed + 11)
        x, y = rs.randint(0, f.w), 0
        for _ in range(f.h + f.w):
            if y >= f.h:
                break
            if 0 <= x < f.w:
                f.rgb[y, x] = GLOW_WHITE
                f.a[y, x] = p["rune_a"]
            y += 1
            x += rs.randint(-1, 2)
    f.frost_speckle(p["frost"] * (0.5 if spike else 0.8))


def m_cloth(f: Face, dark=True):
    col0, col1 = (CLOTH_DARK, CLOTH_MID) if dark else (CAPE_MID * 0.6, CAPE_MID)
    f.lerp_v(col1, col0)
    weave = ((f.xx + f.yy) % max(2, f.S * 2) < f.S).astype(np.float32)
    f.rgb[:] *= (0.8 + 0.3 * f.n[..., None]) * (0.95 + 0.07 * weave[..., None])
    f.bevel(CLOTH_MID * 1.6, CLOTH_DARK * 0.4, strength=0.25)


def m_cape(f: Face, fold=False):
    f.lerp_v(CAPE_HI * 0.85, CAPE_MID * 0.55)
    folds = 0.5 + 0.5 * np.sin(f.U * math.pi * 2 * max(1, f.w // (5 * f.S)) + f.n * 2.5)
    f.rgb[:] *= (0.65 + 0.5 * folds[..., None]) * (0.85 + 0.3 * f.n[..., None])
    if fold:
        f.rgb[:] *= 1.25
    f.line((f.dt < f.S * 0.6) & (f.name == "north"), CAPE_LINE * 0.6, 0.35)
    f.bevel(CAPE_HI * 1.1, CAPE_MID * 0.3, strength=0.2)
    det = f.cube.detail
    if det.startswith("cape_") and det[-1] in "abcd" and f.name in ("north", "south"):
        # frost-blue embroidered lower trim
        f.line((f.db < f.S * 1.2) & (f.db > f.S * 0.4), CAPE_LINE, 0.55)
    if det in ("cape_hem",):
        rs = np.random.RandomState(f.seed)
        tear = rs.rand(f.w) * 0.7
        f.a[:] = np.where(f.V >= (1 - tear[None, :] * 0.0 - 0.0), f.a, f.a)
        f.a[(f.db < f.S) & (rs.rand(f.h, f.w) > 0.55)] = 0
    if det == "cape_d" and f.name in ("north", "south"):
        rs = np.random.RandomState(f.seed + 2)
        jag = (rs.rand(f.w) * f.S * 1.5).astype(int)
        for x in range(f.w):
            f.a[f.h - jag[x]:, x] = 0
    f.frost_speckle(f.p["frost"] * 0.35, top_bias=False)


def m_skin(f: Face):
    f.lerp_v(C(208, 224, 236), C(160, 182, 202))
    f.rgb[:] *= 0.88 + 0.22 * f.n[..., None]
    f.rgb[:] += (np.array([0, 6, 12], np.float32)) * np.clip(f.n - 0.5, 0, 1)[..., None] * 2
    det = f.cube.detail
    if det == "face" and f.name == "north":
        W, H = f.w, f.h
        U, V = f.U, f.V
        # deep brow shadow + hollow cheeks + jaw shading
        brow = np.clip(1 - np.abs(V - 0.36) / 0.16, 0, 1)
        f.rgb[:] *= (1 - 0.55 * brow[..., None])
        for cx in (0.27, 0.73):
            sock = np.clip(1 - np.hypot((U - cx) * 1.5, (V - 0.5) * 2.6) / 0.28, 0, 1)
            f.rgb[:] *= (1 - 0.8 * sock[..., None])
            cheek = np.clip(1 - np.hypot((U - (0.2 if cx < .5 else 0.8)) * 1.4, (V - 0.78) * 1.8) / 0.22, 0, 1)
            f.rgb[:] *= (1 - 0.3 * cheek[..., None])
        # thin cruel mouth + lip highlight
        mouth = (np.abs(V - 0.82) < 0.04) & (np.abs(U - 0.5) < 0.2)
        f.line(mouth, C(60, 66, 84), 0.95)
        f.line((np.abs(V - 0.78) < 0.025) & (np.abs(U - 0.5) < 0.16), C(215, 228, 238), 0.5)
        # nose shadow
        f.line((np.abs(U - 0.5) < 0.05) & (V > 0.5) & (V < 0.68), C(100, 118, 134), 0.6)
        # scar across the left cheek
        d = np.abs((U - 0.62) * 0.9 - (V - 0.66) * 0.7)
        f.line((d < 0.025) & (V > 0.6) & (V < 0.9) & (U > 0.55), C(120, 70, 90), 0.8)
        # glowing frost veins (strengthen with phase)
        if f.p["seam"] > 0:
            vein = (np.abs(U - 0.5 - 0.35 * (V - 0.5)) < 0.018) & (V > 0.15)
            f.glow(vein.astype(np.float32) * f.p["seam"], GLOW_BLUE, f.p["rune_a"] + 60)
    f.bevel(C(210, 225, 235), C(100, 118, 134), strength=0.15)


def m_hair(f: Face):
    streak = fbm(f.h, f.w, f.seed + 9, (max(1, f.S * 5), 1))
    f.lerp_v(C(252, 254, 255), C(200, 214, 234))
    f.rgb[:] *= 0.72 + 0.4 * streak[..., None]
    det = f.cube.detail
    rs = np.random.RandomState(f.seed)
    if det in ("hair_strand", "hair_back"):
        f.a[(f.db < f.S * 2) & (rs.rand(f.h, f.w) > 0.45)] = 0
    f.frost_speckle(f.p["frost"] * 0.25, top_bias=False)


def m_eye(f: Face):
    p = f.p
    f.rgb[:] = GLOW_BLUE
    ring = np.clip(1 - f.dmin / (0.5 * f.S + 1), 0, 1)
    f.rgb[:] = f.rgb * (1 - 0.25 * ring[..., None]) + np.array(p["eye"], np.float32) * 0.25 * ring[..., None]
    core = np.clip(1 - (np.abs(f.U - 0.5) * 2) ** 2 - (np.abs(f.V - 0.5) * 2) ** 2, 0, 1)
    f.rgb[:] = f.rgb * (1 - core[..., None] * 0.9) + GLOW_WHITE * core[..., None] * 0.9
    f.rgb[:] = f.rgb * 0.5 + np.array(p["eye"], np.float32) * 0.5 * (1 - core[..., None])
    f.a[:] = p["eye_a"] + (1 - core) * 40


def m_gem(f: Face):
    p = f.p
    f.rgb[:] = GLOW_BLUE * 0.75
    facet = (np.abs(f.U - 0.5) + np.abs(f.V - 0.5))
    f.rgb[:] *= (0.7 + 0.6 * (1 - facet[..., None] * 1.6))
    f.rgb[:] = np.clip(f.rgb, 0, 255) + 40 * (facet < 0.2)[..., None]
    f.a[:] = p["rune_a"] + 25 + (facet * 80)
    f.bevel(GLOW_WHITE, C(30, 90, 150), strength=0.6)


def m_rune(f: Face):
    p = f.p
    f.rgb[:] = GLOW_BLUE
    core = np.clip(1 - np.abs((f.V if f.cube.detail == "rune_h" else f.U) - 0.5) * 2.4, 0, 1)
    f.rgb[:] = f.rgb * (1 - core[..., None]) + GLOW_WHITE * core[..., None]
    f.a[:] = p["rune_a"] + (1 - core) * 45


def m_ice(f: Face):
    p = f.p
    n = f.n
    f.lerp_v(ICE_HI, ICE_BASE * 0.78)
    f.rgb[:] *= 0.88 + 0.25 * n[..., None]
    facet = np.abs(f.U - 0.5) * 2
    f.rgb[:] = f.rgb * (1 - 0.25 * facet[..., None]) + ICE_HI * 0.25 * facet[..., None]
    f.line(np.abs(f.U - 0.5) < 0.6 / max(2, f.w) * f.S, C(250, 255, 255), 0.7)
    f.bevel(C(255, 255, 255), C(90, 160, 215), strength=0.5)
    f.a[:] = np.clip(120 + 110 * f.V + 25 * (1 - n) - 35 * (p["frost"] - 0.3), 70, 235)


def m_skull(f: Face, base=None):
    """Bone-coloured skull emblem on a dark plate (north face only)."""
    m_plate(f, trim=True)
    if f.name != "north":
        return
    U, V = f.U, f.V
    cran = (((U - 0.5) / 0.42) ** 2 + ((V - 0.4) / 0.38) ** 2) <= 1
    jaw = (np.abs(U - 0.5) < 0.24) & (V > 0.55) & (V < 0.92)
    bone = cran | jaw
    shade = 0.85 + 0.3 * (1 - V)
    col = C(206, 214, 214)[None, None, :] * shade[..., None]
    f.rgb[:] = np.where(bone[..., None], col, f.rgb)
    for cx in (0.34, 0.66):
        sock = (((U - cx) / 0.13) ** 2 + ((V - 0.45) / 0.15) ** 2) <= 1
        f.rgb[:] = np.where(sock[..., None], C(8, 12, 22), f.rgb)
        inner = (((U - cx) / 0.06) ** 2 + ((V - 0.46) / 0.08) ** 2) <= 1
        f.glow(inner.astype(np.float32), GLOW_BLUE, f.p["rune_a"] + 20)
    nose = (np.abs(U - 0.5) < 0.05) & (V > 0.56) & (V < 0.68)
    f.rgb[:] = np.where(nose[..., None], C(30, 36, 46), f.rgb)
    teeth = (V > 0.78) & (V < 0.9) & (np.abs(U - 0.5) < 0.2) & ((np.floor(U * f.w) % 2) == 0)
    f.rgb[:] = np.where(teeth[..., None], C(40, 46, 56), f.rgb)


def m_tabard(f: Face):
    f.lerp_v(CAPE_HI * 0.7, CAPE_MID * 0.5)
    f.rgb[:] *= 0.78 + 0.35 * f.n[..., None]
    if f.cube.detail == "tabard_main" and f.name == "north":
        f.line((f.dl < f.S * 1.0) | (f.dr < f.S * 1.0), CAPE_LINE, 0.8)
        f.line((f.db < f.S * 1.0) & (f.db > 0), CAPE_LINE, 0.8)
        # snowflake / rune sigil
        cx, cy = f.w / 2, f.h * 0.45
        for ang in range(0, 180, 60):
            a = math.radians(ang)
            dx, dy = math.cos(a), math.sin(a)
            dist = np.abs((f.xx - cx) * dy - (f.yy - cy) * dx)
            along = np.abs((f.xx - cx) * dx + (f.yy - cy) * dy)
            f.glow(((dist < 0.6) & (along < f.w * 0.3)).astype(np.float32), GLOW_BLUE, f.p["rune_a"] + 55)
    if f.cube.detail == "tabard_hem":
        rs = np.random.RandomState(f.seed)
        f.a[(f.db < f.S) & (rs.rand(f.h, f.w) > 0.5)] = 0
    f.bevel(CAPE_HI, CAPE_MID * 0.3, strength=0.2)


def m_chain(f: Face):
    f.fill(C(90, 100, 118))
    f.bevel(TRIM_HI, STEEL_DARK, strength=0.6)


# sword materials ----------------------------------------------------------------
def m_blade(f: Face, edge=False, spine=False):
    """Blade painted in *world space* so stacked segments read as one continuous steel blade."""
    p = f.p
    gx, gy, gz = f.cube.ref
    X, Y, Z = f.world()
    rx, ry = X - gx, Y - gy
    hw = np.zeros_like(rx)
    for y0, h, w_, t in BLADE_SEGS:
        hw = np.where((ry >= y0) & (ry < y0 + h), w_ / 2, hw)
    hw = np.where(hw == 0, 0.6, hw)
    d_edge = hw - np.abs(rx)                       # distance (units) from silhouette edge
    brushed = fbm(f.h, f.w, f.seed + 4, (max(1, f.S * 10), 1))
    base = np.array([50, 64, 94], np.float32)
    t = np.clip((ry + 7) / 52.0, 0, 1)
    col = base[None, None, :] * (1.15 - 0.45 * t[..., None])
    col = col * (0.82 + 0.22 * f.n[..., None]) * (0.92 + 0.16 * brushed[..., None])
    f.rgb[:] = col
    if f.name in ("north", "south"):
        # sharpened steel edge bevel, fading into the dark fuller flats
        bev = np.clip(1 - d_edge / 1.3, 0, 1)
        f.rgb[:] = f.rgb * (1 - bev[..., None] * 0.9) + C(205, 226, 245) * bev[..., None] * 0.9
        inner = np.clip(1 - np.abs(d_edge - 1.2) / 0.35, 0, 1)
        f.rgb[:] = f.rgb * (1 - 0.35 * inner[..., None]) + C(10, 14, 24) * 0.35 * inner[..., None]
        if spine:
            f.rgb[:] = C(20, 26, 42) * (0.85 + 0.3 * f.n[..., None])
            groove = np.clip(1 - np.abs(rx) / 0.42, 0, 1)
            f.glow(groove * 0.85 * min(1.0, p["rune"]), GLOW_BLUE, p["rune_a"] + 25)
            # rune glyphs march up the blade (world-space, so they stay aligned across segments)
            gph = 4.4
            ly = (ry - 9.0) % gph
            cell = np.floor((ry - 9.0) / gph).astype(int)
            kind = (cell * 7 + 3) % 5
            on = np.zeros_like(rx, bool)
            on |= (np.abs(rx) < 0.12) & (ly < 3.0)
            on |= (np.abs(np.abs(rx) - 0.9) < 0.14) & (ly > 0.3) & (ly < 1.3) & (kind % 2 == 0)
            on |= (np.abs(rx - 0.85) < 0.14) & (ly > 1.6) & (ly < 2.8) & (kind >= 2)
            on |= (np.abs(rx + 0.85) < 0.14) & (ly > 0.6) & (ly < 2.2) & (kind % 3 != 0)
            on |= (np.abs(ly - 3.4) < 0.14) & (np.abs(rx) < 0.9) & (kind == 1)
            on &= (ry > 8.5) & (ry < 35)
            f.glow(on.astype(np.float32) * min(1.0, 0.55 + 0.35 * p["rune"]), GLOW_WHITE, p["rune_a"] - 12)
    else:
        f.rgb[:] = f.rgb * 0.7
        f.bevel(C(190, 215, 235), STEEL_DARK * 0.4, strength=0.6)
    if edge:
        f.rgb[:] = f.rgb * 0.25 + C(205, 225, 240) * 0.75
        f.bevel(C(255, 255, 255), C(90, 120, 150), strength=0.6)
    f.frost_speckle(p["frost"] * 0.6, top_bias=False)


def m_guard(f: Face, trim=False):
    m_plate(f, trim=trim)
    f.rgb[:] = f.rgb * 0.85 + C(14, 12, 22) * 0.15
    if f.cube.detail == "guard_skull" and f.name == "north":
        m_skull(f)


def m_grip(f: Face):
    f.fill(C(30, 24, 30))
    wrap = ((f.xx + f.yy * 1.0) % max(2, f.S * 2) < f.S).astype(np.float32)
    f.rgb[:] *= (0.7 + 0.5 * wrap[..., None]) * (0.85 + 0.3 * f.n[..., None])
    f.rgb[:] += C(0, 6, 14) * wrap[..., None]


MATS = {
    "plate": lambda f: m_plate(f), "plate_trim": lambda f: m_plate(f, trim=True),
    "spike": lambda f: m_plate(f, trim=False, spike=True),
    "cloth_dark": lambda f: m_cloth(f), "cape": lambda f: m_cape(f), "cape_fold": lambda f: m_cape(f, fold=True),
    "tabard": m_tabard, "skin": m_skin, "hair": m_hair, "eye": m_eye, "gem": m_gem, "rune": m_rune,
    "ice": m_ice, "skull_plate": m_skull, "chain": m_chain,
    "blade": m_blade, "blade_edge": lambda f: m_blade(f, edge=True), "blade_spine": lambda f: m_blade(f, spine=True),
    "guard_dark": m_guard, "guard_trim": lambda f: m_guard(f, trim=True), "grip": m_grip,
}


def paint_layer(cubes, size, S, phase, seed=7):
    canvas = np.zeros((size * S, size * S, 4), np.float32)
    for i, c in enumerate(cubes):
        rects = face_rects(c)
        for name, r in rects.items():
            f = Face(c, name, r, S, seed + i * 31 + zlib.crc32(name.encode()) % 97, phase)
            MATS[c.mat](f)
            f.finish(canvas)
    return Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8), "RGBA")
