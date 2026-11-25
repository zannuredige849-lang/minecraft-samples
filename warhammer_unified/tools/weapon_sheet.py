"""Close-up sheet of every held-weapon kind (one generic humanoid each) for reviewing the voxel models."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from forge.common import *
from forge.preview import geo_of
from forge.humanoid import HOLD
from mcgeo import render, bbox_units
from PIL import Image, ImageDraw


def make(kind):
    p = pal(armor="#5a5f6a", cloth="#4a3a2a", trim="#c9a24a", metal="#9aa0aa", leather="#4a3322", glow="#6adfff", skin="#c89070", bone="#e6dcc0")
    m = Humanoid("geometry.t_" + kind, p, H=32, w=1.0)
    m.base(armor="armor", cloth="cloth", trim="trim")
    m.weapon(kind, slot="metal", glow=("glow" if kind in ("staff",) else None))
    m.finalize()
    return m


def main(dst, kinds=None, cell=360):
    kinds = kinds or list(HOLD)
    views = ((-60, 8), (90, 8))
    cols = len(views) * 3
    per_row = 3
    rows = (len(kinds) + per_row - 1) // per_row
    sheet = Image.new("RGBA", (cell * len(views) * per_row, cell * rows), (58, 62, 74, 255))
    d = ImageDraw.Draw(sheet)
    for i, k in enumerate(kinds):
        m = make(k)
        geo = geo_of(m)
        for bn, bd in geo["bones"].items() if isinstance(geo["bones"], dict) else []:
            pass
        geo["bones"] = [dict(b, cubes=(b.get("cubes", []) if b["name"].startswith("weapon") else [])) for b in geo["bones"]]
        bb = bbox_units(geo, None)
        ctr = (bb[0] + bb[1]) / 2
        sc = (cell - 30) / max(bb[1][1] - bb[0][1], bb[1][0] - bb[0][0], 1)
        import numpy as np
        for v, (yaw, pitch) in enumerate(views):
            big = render(geo, m.texture, yaw=yaw, pitch=pitch, scale=sc * 0.55, size=(cell * 2, cell * 2), bg=(58, 62, 74, 255), center=ctr).convert("RGB")
            a = np.asarray(big).astype(int)
            msk = (abs(a - np.array([58, 62, 74])).sum(-1) > 12)
            ys, xs = np.where(msk)
            if len(ys):
                big = big.crop((xs.min() - 6, ys.min() - 6, xs.max() + 6, ys.max() + 6))
            if k in ('spear','trident','staff','halberd','glaive','scythe'):
                big = big.crop((0, 0, big.width, int(big.height * 0.32)))
                a2 = np.asarray(big).astype(int); m2 = (abs(a2 - np.array([58, 62, 74])).sum(-1) > 12); y2, x2 = np.where(m2)
                if len(y2): big = big.crop((max(0, x2.min() - 6), max(0, y2.min() - 6), x2.max() + 6, y2.max() + 6))
                big = big.resize((big.width * 3, big.height * 3), Image.NEAREST)
            big.thumbnail((cell - 8, cell - 8), Image.NEAREST)
            t = Image.new("RGB", (cell, cell), (58, 62, 74)); t.paste(big, ((cell - big.width) // 2, (cell - big.height) // 2))
            sheet.paste(t, (((i % per_row) * len(views) + v) * cell, (i // per_row) * cell))
        d.text(((i % per_row) * len(views) * cell + 6, (i // per_row) * cell + 6), f"{k}  cubes={m.cube_count()}", fill=(255, 255, 255))
    sheet.convert("RGB").save(dst)
    print("saved", dst)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:] or None)
