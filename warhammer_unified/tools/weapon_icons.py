"""Hand-built weapon icons in the Minecraft Dungeons / vanilla-item look: chunky dark outline, 3-tone metal, readable silhouette.
The 3D held model of these items is the extruded icon, so redrawing the icon redraws the weapon."""
import numpy as np
from PIL import Image, ImageDraw


def _hex(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def draw(size, parts, outline="#17101a"):
    """parts: list of (points, width, base_hex, light_hex, dark_hex). Lines are drawn thick, outlined and rim-lit."""
    layers = []
    for pts, w, base, light, dark in parts:
        im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.line(pts, fill=_hex(base), width=w)
        for (x, y) in pts:
            d.rectangle([x - (w - 1) // 2, y - (w - 1) // 2, x + w // 2, y + w // 2], fill=_hex(base))
        layers.append((im, light, dark))
    out = np.zeros((size, size, 4), np.uint8)
    for im, light, dark in layers:
        a = np.asarray(im)
        m = a[..., 3] > 0
        px = a.copy()
        up = np.pad(m, ((1, 0), (0, 0)))[:size]
        left = np.pad(m, ((0, 0), (1, 0)))[:, :size]
        dn = np.pad(m, ((0, 1), (0, 0)))[1:]
        rt = np.pad(m, ((0, 0), (0, 1)))[:, 1:]
        px[m & ~up | m & ~left] = _hex(light)
        px[m & ~dn | m & ~rt] = _hex(dark)
        out[m] = px[m]
    m = out[..., 3] > 0
    pad = np.pad(m, 1)
    border = ~m & (pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:])
    out[border] = _hex(outline)
    return Image.fromarray(out)


def hell_scimitar():
    blade = ("#c43b1e", "#ff9a3a", "#7a1a14"); steel = ("#e5622c", "#ffd36a", "#a1281a")
    return draw(16, [
        ([(4, 12), (6, 9), (8, 6), (10, 4), (12, 3), (13, 3)], 3, *blade),
        ([(5, 11), (7, 8), (9, 5), (11, 3)], 1, "#ffd36a", "#fff3c0", "#ff9a3a"),
        ([(2, 9), (4, 11), (6, 13)], 2, "#c9973a", "#fff0a0", "#7a5a1c"),
        ([(1, 14), (3, 12)], 2, "#4a2c1c", "#6e4428", "#2a1810"),
        ([(0, 15)], 2, "#e6dcc0", "#ffffff", "#9a9078"),
    ])


def laestrygonian_sword():
    return draw(20, [
        ([(5, 15), (8, 11), (11, 8), (14, 5), (16, 3)], 5, "#c98a3e", "#f0c070", "#8a5226"),
        ([(6, 14), (9, 11), (12, 8), (15, 5)], 1, "#f7dca0", "#ffffff", "#e0b060"),
        ([(17, 2), (18, 1)], 2, "#f0c070", "#fff1c0", "#c98a3e"),
        ([(2, 11), (5, 14), (8, 17)], 3, "#8a3a22", "#d9703a", "#4a1e12"),
        ([(2, 18), (4, 16)], 3, "#4a2c1c", "#6e4428", "#2a1810"),
        ([(1, 19)], 2, "#e8b060", "#fff0a0", "#a8742a"),
    ])
