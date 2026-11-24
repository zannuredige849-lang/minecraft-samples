"""Clean pixel-art painters for mcgeo cubes. Every painter is f(face, w, h) -> RGBA PIL image.

Style rules (user feedback from an earlier model): smooth banded gradients, crisp 1px rim light,
a few deliberate motifs, no speckle noise.
"""
from PIL import Image, ImageDraw

SIDES = ("north", "east", "south", "west")


def hexc(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def mix(c1, c2, t):
    return tuple(int(round(c1[i] + (c2[i] - c1[i]) * t)) for i in range(3)) + (255,)


def lit(c, k):
    """scale brightness (k>1 lighter, k<1 darker) without hue shift"""
    if k >= 1:
        return mix(c, (255, 255, 255, 255), min(1.0, k - 1))
    return tuple(int(c[i] * k) for i in range(3)) + (255,)


def solid(c, w, h):
    return Image.new("RGBA", (w, h), c)


def shaded(c, bands=3, top=1.14, bottom=0.78, rim=True, up=1.2, down=0.55, alpha=255):
    """base block colour: banded vertical gradient on sides, bright top, dark bottom, 1px rim light"""
    c = tuple(c[:3]) + (255,)

    def f(face, w, h):
        if face == "up":
            im = solid(lit(c, up), w, h)
            return im
        if face == "down":
            return solid(lit(c, down), w, h)
        im = Image.new("RGBA", (w, h))
        d = ImageDraw.Draw(im)
        for y in range(h):
            t = y / max(1, h - 1)
            k = top + (bottom - top) * (round(t * (bands - 1)) / max(1, bands - 1))
            d.line([(0, y), (w - 1, y)], fill=lit(c, k))
        if rim and h >= 3:
            d.line([(0, 0), (w - 1, 0)], fill=lit(c, top + 0.1))
        if face in ("east", "south") and w >= 3:
            d.line([(w - 1, 0), (w - 1, h - 1)], fill=lit(c, 0.82))
        return im

    return f


def layer(base, *overlays):
    """base painter + overlays drawn on top: overlay(face, im, w, h)"""

    def f(face, w, h):
        im = base(face, w, h).copy() if callable(base) else solid(base, w, h)
        for o in overlays:
            o(face, im, w, h)
        return im

    return f


def only(faces, fn):
    faces = (faces,) if isinstance(faces, str) else tuple(faces)

    def o(face, im, w, h):
        if face in faces:
            fn(face, im, w, h)

    return o


def sides_only(fn):
    return only(SIDES, fn)


def hbands(spec, faces=SIDES, margin=0):
    """horizontal colour bands from the top: spec = [(height_px, colour), ...]. Negative height = fill rest."""

    def o(face, im, w, h):
        if face not in faces:
            return
        d = ImageDraw.Draw(im)
        y = margin
        for hh, col in spec:
            if hh < 0:
                hh = h - y
            if y >= h:
                break
            d.rectangle([0, y, w - 1, min(h - 1, y + hh - 1)], fill=col)
            y += hh

    return o


def vstripes(spec, faces=SIDES):
    def o(face, im, w, h):
        if face not in faces:
            return
        d = ImageDraw.Draw(im)
        x = 0
        for ww, col in spec:
            if ww < 0:
                ww = w - x
            if x >= w:
                break
            d.rectangle([x, 0, min(w - 1, x + ww - 1), h - 1], fill=col)
            x += ww

    return o


def edge(color, sides=("top", "bottom", "left", "right"), width=1, faces=SIDES):
    def o(face, im, w, h):
        if face not in faces:
            return
        d = ImageDraw.Draw(im)
        for s in sides:
            for k in range(width):
                if s == "top":
                    d.line([(0, k), (w - 1, k)], fill=color)
                if s == "bottom":
                    d.line([(0, h - 1 - k), (w - 1, h - 1 - k)], fill=color)
                if s == "left":
                    d.line([(k, 0), (k, h - 1)], fill=color)
                if s == "right":
                    d.line([(w - 1 - k, 0), (w - 1 - k, h - 1)], fill=color)

    return o


def art(rows, palette, x=0, y=0, faces=None):
    """stamp ascii art. '.' (or space) is untouched; palette maps char -> RGBA ('~' = erase to transparent)."""

    def o(face, im, w, h):
        if faces is not None and face not in ((faces,) if isinstance(faces, str) else faces):
            return
        px = im.load()
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch in ". ":
                    continue
                xx, yy = x + i, y + j
                if 0 <= xx < w and 0 <= yy < h:
                    px[xx, yy] = (0, 0, 0, 0) if ch == "~" else palette[ch]

    return o


def cut(pred):
    """erase pixels where pred(face, x, y, w, h) is true (alpha cut-outs: jagged wings, blades)"""

    def o(face, im, w, h):
        px = im.load()
        for yy in range(h):
            for xx in range(w):
                if pred(face, xx, yy, w, h):
                    px[xx, yy] = (0, 0, 0, 0)

    return o


def fill_rect(x0, y0, x1, y1, color, faces=None):
    def o(face, im, w, h):
        if faces is not None and face not in ((faces,) if isinstance(faces, str) else faces):
            return
        ImageDraw.Draw(im).rectangle([x0, y0, x1, y1], fill=color)

    return o


def gradient_v(c_top, c_bottom, bands=None, up=None, down=None):
    """vertical gradient painter (optionally quantised to `bands` steps)"""

    def f(face, w, h):
        if face == "up":
            return solid(up or lit(c_top, 1.1), w, h)
        if face == "down":
            return solid(down or lit(c_bottom, 0.6), w, h)
        im = Image.new("RGBA", (w, h))
        d = ImageDraw.Draw(im)
        for y in range(h):
            t = y / max(1, h - 1)
            if bands:
                t = round(t * (bands - 1)) / max(1, bands - 1)
            d.line([(0, y), (w - 1, y)], fill=mix(c_top, c_bottom, t))
        return im

    return f


def fx_text(img_painter):
    return img_painter
