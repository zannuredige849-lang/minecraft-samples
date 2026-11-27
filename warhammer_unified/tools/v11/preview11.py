import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from mcgeo import render, bbox_units
from PIL import Image, ImageDraw


def sheet(models, path, cell=320, views=((-35, 10), (35, 10), (150, 10), (90, 5))):
    im = Image.new("RGB", (cell * len(views), cell * len(models)), (58, 62, 74)); d = ImageDraw.Draw(im)
    for r, (label, m) in enumerate(models):
        g = m.geometry(); geo = dict(bones=g["bones"], tw=g["description"]["texture_width"], th=g["description"]["texture_height"])
        bb = bbox_units(geo); h = bb[1][1] - bb[0][1]; w = max(bb[1][0] - bb[0][0], bb[1][2] - bb[0][2])
        sc = min((cell - 30) / max(h, 1), (cell - 20) / max(w, 1))
        for k, (yaw, pitch) in enumerate(views):
            t = render(geo, m.texture, yaw=yaw, pitch=pitch, scale=sc, size=(cell, cell), bg=(58, 62, 74, 255), center=(bb[0] + bb[1]) / 2)
            im.paste(t.convert("RGB"), (k * cell, r * cell))
        d.text((4, r * cell + 4), f"{label} cubes={m.cube_count()} uv={m.tw}", fill=(255, 255, 255))
    im.save(path)
