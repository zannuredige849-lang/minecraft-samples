"""Contact sheets of the FINAL add-on (all 118 client entities, default texture)."""
import sys, os, glob
sys.path.insert(0, os.path.dirname(__file__))
from mcgeo import *
from PIL import Image, ImageDraw
from forge.factions import FACTION_OF


def main(out, dst, per=20, cols=5, cell=260):
    rp = f"{out}/resource_pack"
    geos = {}
    for p in glob.glob(f"{rp}/models/entity/*.json"):
        geos.update(collect_geometries(p))
    items = []
    for p in sorted(glob.glob(f"{rp}/entity/*.json")):
        c = load_json(p)["minecraft:client_entity"]["description"]
        g = geos.get(c.get("geometry", {}).get("default"))
        tp = next(iter(c.get("textures", {}).values()), None)
        if not g or not tp or not g["bones"]: continue
        f = f"{rp}/{tp}.png"
        if not os.path.exists(f): continue
        items.append((c["identifier"], g, f))
    items.sort(key=lambda t: (FACTION_OF.get(t[0], "zz"), t[0]))
    os.makedirs(dst, exist_ok=True)
    for si in range(0, len(items), per):
        chunk = items[si:si + per]
        rows = (len(chunk) + cols - 1) // cols
        sheet = Image.new("RGBA", (cell * cols, cell * rows), (58, 62, 74, 255))
        d = ImageDraw.Draw(sheet)
        for i, (ident, g, f) in enumerate(chunk):
            tex = Image.open(f).convert("RGBA")
            bb = bbox_units(g)
            if bb is None: continue
            h = bb[1][1] - bb[0][1]; w = max(bb[1][0] - bb[0][0], bb[1][2] - bb[0][2])
            sc = min((cell - 40) / max(h, 1), (cell - 20) / max(w, 1))
            im = render(g, tex, yaw=-35, pitch=12, scale=sc, size=(cell, cell), bg=(58, 62, 74, 255), center=(bb[0] + bb[1]) / 2)
            sheet.paste(im, ((i % cols) * cell, (i // cols) * cell))
            d.text(((i % cols) * cell + 4, (i // cols) * cell + 4), f"{ident}  [{FACTION_OF.get(ident, '-')}]", fill=(255, 255, 255))
        sheet.convert("RGB").save(f"{dst}/gallery_{si // per + 1:02d}.png", optimize=True)
    print(len(items), "entities,", (len(items) + per - 1) // per, "sheets")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
