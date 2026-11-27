import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from mcgeo import render, bbox_units
from PIL import Image, ImageDraw


def geo_of(model):
    g = model.geometry()
    return dict(bones=g["bones"], tw=g["description"]["texture_width"], th=g["description"]["texture_height"])


def sheet(models, path, cell=300, views=((0, 12), (-40, 12), (90, 12), (180, 12)), pose_fn=None, cols=None):
    """models: list of (label, Model). One row per model, columns = views."""
    cols = len(views)
    rows = len(models)
    im = Image.new("RGBA", (cell * cols, cell * rows), (58, 62, 74, 255))
    d = ImageDraw.Draw(im)
    for r, (label, m) in enumerate(models):
        geo = geo_of(m)
        pose = pose_fn(m) if pose_fn else None
        bb = bbox_units(geo, pose)
        h = bb[1][1] - bb[0][1]; w = max(bb[1][0] - bb[0][0], bb[1][2] - bb[0][2])
        ctr = (bb[0] + bb[1]) / 2
        sc = min((cell - 36) / max(h, 1), (cell - 24) / max(w, 1))
        for c, (yaw, pitch) in enumerate(views):
            t = render(geo, m.texture, yaw=yaw, pitch=pitch, scale=sc, size=(cell, cell), bg=(58, 62, 74, 255), pose=pose, center=ctr)
            im.paste(t, (c * cell, r * cell))
        d.text((4, r * cell + 4), f"{label}  cubes={m.cube_count()} tex={m.tw}", fill=(255, 255, 255))
    im.convert("RGB").save(path)
